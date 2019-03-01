var Module = typeof Module !== "undefined" ? Module : {};

var moduleOverrides = {};

var key;

for (key in Module) {
 if (Module.hasOwnProperty(key)) {
  moduleOverrides[key] = Module[key];
 }
}

Module["arguments"] = [];

Module["thisProgram"] = "./this.program";

Module["quit"] = function(status, toThrow) {
 throw toThrow;
};

Module["preRun"] = [];

Module["postRun"] = [];

var ENVIRONMENT_IS_WEB = false;

var ENVIRONMENT_IS_WORKER = false;

var ENVIRONMENT_IS_NODE = false;

var ENVIRONMENT_IS_SHELL = false;

ENVIRONMENT_IS_WEB = typeof window === "object";

ENVIRONMENT_IS_WORKER = typeof importScripts === "function";

ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;

ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

var scriptDirectory = "";

function locateFile(path) {
 if (Module["locateFile"]) {
  return Module["locateFile"](path, scriptDirectory);
 } else {
  return scriptDirectory + path;
 }
}

if (ENVIRONMENT_IS_NODE) {
 scriptDirectory = __dirname + "/";
 var nodeFS;
 var nodePath;
 Module["read"] = function shell_read(filename, binary) {
  var ret;
  if (!nodeFS) nodeFS = require("fs");
  if (!nodePath) nodePath = require("path");
  filename = nodePath["normalize"](filename);
  ret = nodeFS["readFileSync"](filename);
  return binary ? ret : ret.toString();
 };
 Module["readBinary"] = function readBinary(filename) {
  var ret = Module["read"](filename, true);
  if (!ret.buffer) {
   ret = new Uint8Array(ret);
  }
  assert(ret.buffer);
  return ret;
 };
 if (process["argv"].length > 1) {
  Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
 }
 Module["arguments"] = process["argv"].slice(2);
 if (typeof module !== "undefined") {
  module["exports"] = Module;
 }
 process["on"]("uncaughtException", function(ex) {
  if (!(ex instanceof ExitStatus)) {
   throw ex;
  }
 });
 process["on"]("unhandledRejection", abort);
 Module["quit"] = function(status) {
  process["exit"](status);
 };
 Module["inspect"] = function() {
  return "[Emscripten Module object]";
 };
} else if (ENVIRONMENT_IS_SHELL) {
 if (typeof read != "undefined") {
  Module["read"] = function shell_read(f) {
   return read(f);
  };
 }
 Module["readBinary"] = function readBinary(f) {
  var data;
  if (typeof readbuffer === "function") {
   return new Uint8Array(readbuffer(f));
  }
  data = read(f, "binary");
  assert(typeof data === "object");
  return data;
 };
 if (typeof scriptArgs != "undefined") {
  Module["arguments"] = scriptArgs;
 } else if (typeof arguments != "undefined") {
  Module["arguments"] = arguments;
 }
 if (typeof quit === "function") {
  Module["quit"] = function(status) {
   quit(status);
  };
 }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
 if (ENVIRONMENT_IS_WORKER) {
  scriptDirectory = self.location.href;
 } else if (document.currentScript) {
  scriptDirectory = document.currentScript.src;
 }
 if (scriptDirectory.indexOf("blob:") !== 0) {
  scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
 } else {
  scriptDirectory = "";
 }
 Module["read"] = function shell_read(url) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.send(null);
  return xhr.responseText;
 };
 if (ENVIRONMENT_IS_WORKER) {
  Module["readBinary"] = function readBinary(url) {
   var xhr = new XMLHttpRequest();
   xhr.open("GET", url, false);
   xhr.responseType = "arraybuffer";
   xhr.send(null);
   return new Uint8Array(xhr.response);
  };
 }
 Module["readAsync"] = function readAsync(url, onload, onerror) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";
  xhr.onload = function xhr_onload() {
   if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
    onload(xhr.response);
    return;
   }
   onerror();
  };
  xhr.onerror = onerror;
  xhr.send(null);
 };
 Module["setWindowTitle"] = function(title) {
  document.title = title;
 };
} else {}

var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);

var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);

for (key in moduleOverrides) {
 if (moduleOverrides.hasOwnProperty(key)) {
  Module[key] = moduleOverrides[key];
 }
}

moduleOverrides = undefined;

var STACK_ALIGN = 16;

function dynamicAlloc(size) {
 var ret = HEAP32[DYNAMICTOP_PTR >> 2];
 var end = ret + size + 15 & -16;
 if (end <= _emscripten_get_heap_size()) {
  HEAP32[DYNAMICTOP_PTR >> 2] = end;
 } else {
  return 0;
 }
 return ret;
}

function getNativeTypeSize(type) {
 switch (type) {
 case "i1":
 case "i8":
  return 1;

 case "i16":
  return 2;

 case "i32":
  return 4;

 case "i64":
  return 8;

 case "float":
  return 4;

 case "double":
  return 8;

 default:
  {
   if (type[type.length - 1] === "*") {
    return 4;
   } else if (type[0] === "i") {
    var bits = parseInt(type.substr(1));
    assert(bits % 8 === 0, "getNativeTypeSize invalid bits " + bits + ", type " + type);
    return bits / 8;
   } else {
    return 0;
   }
  }
 }
}

function warnOnce(text) {
 if (!warnOnce.shown) warnOnce.shown = {};
 if (!warnOnce.shown[text]) {
  warnOnce.shown[text] = 1;
  err(text);
 }
}

var jsCallStartIndex = 1;

var functionPointers = new Array(0);

var funcWrappers = {};

function dynCall(sig, ptr, args) {
 if (args && args.length) {
  return Module["dynCall_" + sig].apply(null, [ ptr ].concat(args));
 } else {
  return Module["dynCall_" + sig].call(null, ptr);
 }
}

var tempRet0 = 0;

var setTempRet0 = function(value) {
 tempRet0 = value;
};

var getTempRet0 = function() {
 return tempRet0;
};

var GLOBAL_BASE = 8;

var ABORT = false;

var EXITSTATUS = 0;

function assert(condition, text) {
 if (!condition) {
  abort("Assertion failed: " + text);
 }
}

function getCFunc(ident) {
 var func = Module["_" + ident];
 assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
 return func;
}

function ccall(ident, returnType, argTypes, args, opts) {
 var toC = {
  "string": function(str) {
   var ret = 0;
   if (str !== null && str !== undefined && str !== 0) {
    var len = (str.length << 2) + 1;
    ret = stackAlloc(len);
    stringToUTF8(str, ret, len);
   }
   return ret;
  },
  "array": function(arr) {
   var ret = stackAlloc(arr.length);
   writeArrayToMemory(arr, ret);
   return ret;
  }
 };
 function convertReturnValue(ret) {
  if (returnType === "string") return UTF8ToString(ret);
  if (returnType === "boolean") return Boolean(ret);
  return ret;
 }
 var func = getCFunc(ident);
 var cArgs = [];
 var stack = 0;
 if (args) {
  for (var i = 0; i < args.length; i++) {
   var converter = toC[argTypes[i]];
   if (converter) {
    if (stack === 0) stack = stackSave();
    cArgs[i] = converter(args[i]);
   } else {
    cArgs[i] = args[i];
   }
  }
 }
 var ret = func.apply(null, cArgs);
 ret = convertReturnValue(ret);
 if (stack !== 0) stackRestore(stack);
 return ret;
}

function setValue(ptr, value, type, noSafe) {
 type = type || "i8";
 if (type.charAt(type.length - 1) === "*") type = "i32";
 switch (type) {
 case "i1":
  HEAP8[ptr >> 0] = value;
  break;

 case "i8":
  HEAP8[ptr >> 0] = value;
  break;

 case "i16":
  HEAP16[ptr >> 1] = value;
  break;

 case "i32":
  HEAP32[ptr >> 2] = value;
  break;

 case "i64":
  tempI64 = [ value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0) ], 
  HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
  break;

 case "float":
  HEAPF32[ptr >> 2] = value;
  break;

 case "double":
  HEAPF64[ptr >> 3] = value;
  break;

 default:
  abort("invalid type for setValue: " + type);
 }
}

var ALLOC_NONE = 3;

function allocate(slab, types, allocator, ptr) {
 var zeroinit, size;
 if (typeof slab === "number") {
  zeroinit = true;
  size = slab;
 } else {
  zeroinit = false;
  size = slab.length;
 }
 var singleType = typeof types === "string" ? types : null;
 var ret;
 if (allocator == ALLOC_NONE) {
  ret = ptr;
 } else {
  ret = [ _malloc, stackAlloc, dynamicAlloc ][allocator](Math.max(size, singleType ? 1 : types.length));
 }
 if (zeroinit) {
  var stop;
  ptr = ret;
  assert((ret & 3) == 0);
  stop = ret + (size & ~3);
  for (;ptr < stop; ptr += 4) {
   HEAP32[ptr >> 2] = 0;
  }
  stop = ret + size;
  while (ptr < stop) {
   HEAP8[ptr++ >> 0] = 0;
  }
  return ret;
 }
 if (singleType === "i8") {
  if (slab.subarray || slab.slice) {
   HEAPU8.set(slab, ret);
  } else {
   HEAPU8.set(new Uint8Array(slab), ret);
  }
  return ret;
 }
 var i = 0, type, typeSize, previousType;
 while (i < size) {
  var curr = slab[i];
  type = singleType || types[i];
  if (type === 0) {
   i++;
   continue;
  }
  if (type == "i64") type = "i32";
  setValue(ret + i, curr, type);
  if (previousType !== type) {
   typeSize = getNativeTypeSize(type);
   previousType = type;
  }
  i += typeSize;
 }
 return ret;
}

var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
 var endIdx = idx + maxBytesToRead;
 var endPtr = idx;
 while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
 if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
  return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
 } else {
  var str = "";
  while (idx < endPtr) {
   var u0 = u8Array[idx++];
   if (!(u0 & 128)) {
    str += String.fromCharCode(u0);
    continue;
   }
   var u1 = u8Array[idx++] & 63;
   if ((u0 & 224) == 192) {
    str += String.fromCharCode((u0 & 31) << 6 | u1);
    continue;
   }
   var u2 = u8Array[idx++] & 63;
   if ((u0 & 240) == 224) {
    u0 = (u0 & 15) << 12 | u1 << 6 | u2;
   } else {
    u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63;
   }
   if (u0 < 65536) {
    str += String.fromCharCode(u0);
   } else {
    var ch = u0 - 65536;
    str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
   }
  }
 }
 return str;
}

function UTF8ToString(ptr, maxBytesToRead) {
 return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
}

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
 if (!(maxBytesToWrite > 0)) return 0;
 var startIdx = outIdx;
 var endIdx = outIdx + maxBytesToWrite - 1;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) {
   var u1 = str.charCodeAt(++i);
   u = 65536 + ((u & 1023) << 10) | u1 & 1023;
  }
  if (u <= 127) {
   if (outIdx >= endIdx) break;
   outU8Array[outIdx++] = u;
  } else if (u <= 2047) {
   if (outIdx + 1 >= endIdx) break;
   outU8Array[outIdx++] = 192 | u >> 6;
   outU8Array[outIdx++] = 128 | u & 63;
  } else if (u <= 65535) {
   if (outIdx + 2 >= endIdx) break;
   outU8Array[outIdx++] = 224 | u >> 12;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  } else {
   if (outIdx + 3 >= endIdx) break;
   outU8Array[outIdx++] = 240 | u >> 18;
   outU8Array[outIdx++] = 128 | u >> 12 & 63;
   outU8Array[outIdx++] = 128 | u >> 6 & 63;
   outU8Array[outIdx++] = 128 | u & 63;
  }
 }
 outU8Array[outIdx] = 0;
 return outIdx - startIdx;
}

function stringToUTF8(str, outPtr, maxBytesToWrite) {
 return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}

function lengthBytesUTF8(str) {
 var len = 0;
 for (var i = 0; i < str.length; ++i) {
  var u = str.charCodeAt(i);
  if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
  if (u <= 127) ++len; else if (u <= 2047) len += 2; else if (u <= 65535) len += 3; else len += 4;
 }
 return len;
}

var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

function allocateUTF8OnStack(str) {
 var size = lengthBytesUTF8(str) + 1;
 var ret = stackAlloc(size);
 stringToUTF8Array(str, HEAP8, ret, size);
 return ret;
}

function writeArrayToMemory(array, buffer) {
 HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
 for (var i = 0; i < str.length; ++i) {
  HEAP8[buffer++ >> 0] = str.charCodeAt(i);
 }
 if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}

function demangle(func) {
 return func;
}

function demangleAll(text) {
 var regex = /__Z[\w\d_]+/g;
 return text.replace(regex, function(x) {
  var y = demangle(x);
  return x === y ? x : y + " [" + x + "]";
 });
}

function jsStackTrace() {
 var err = new Error();
 if (!err.stack) {
  try {
   throw new Error(0);
  } catch (e) {
   err = e;
  }
  if (!err.stack) {
   return "(no stack trace available)";
  }
 }
 return err.stack.toString();
}

function stackTrace() {
 var js = jsStackTrace();
 if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
 return demangleAll(js);
}

var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

function updateGlobalBufferViews() {
 Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
 Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
 Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
 Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
 Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
 Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
 Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
 Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
}

var STACK_BASE = 10144, DYNAMIC_BASE = 5253024, DYNAMICTOP_PTR = 9888;

var TOTAL_STACK = 5242880;

var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;

if (TOTAL_MEMORY < TOTAL_STACK) err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");

if (Module["buffer"]) {
 buffer = Module["buffer"];
} else {
 {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
 }
 Module["buffer"] = buffer;
}

updateGlobalBufferViews();

HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

function callRuntimeCallbacks(callbacks) {
 while (callbacks.length > 0) {
  var callback = callbacks.shift();
  if (typeof callback == "function") {
   callback();
   continue;
  }
  var func = callback.func;
  if (typeof func === "number") {
   if (callback.arg === undefined) {
    Module["dynCall_v"](func);
   } else {
    Module["dynCall_vi"](func, callback.arg);
   }
  } else {
   func(callback.arg === undefined ? null : callback.arg);
  }
 }
}

var __ATPRERUN__ = [];

var __ATINIT__ = [];

var __ATMAIN__ = [];

var __ATEXIT__ = [];

var __ATPOSTRUN__ = [];

var runtimeInitialized = false;

var runtimeExited = false;

function preRun() {
 if (Module["preRun"]) {
  if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
  while (Module["preRun"].length) {
   addOnPreRun(Module["preRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
 if (runtimeInitialized) return;
 runtimeInitialized = true;
 callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
 callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
 callRuntimeCallbacks(__ATEXIT__);
 runtimeExited = true;
}

function postRun() {
 if (Module["postRun"]) {
  if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
  while (Module["postRun"].length) {
   addOnPostRun(Module["postRun"].shift());
  }
 }
 callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
 __ATPRERUN__.unshift(cb);
}

function addOnPostRun(cb) {
 __ATPOSTRUN__.unshift(cb);
}

var Math_abs = Math.abs;

var Math_ceil = Math.ceil;

var Math_floor = Math.floor;

var Math_min = Math.min;

var runDependencies = 0;

var runDependencyWatcher = null;

var dependenciesFulfilled = null;

function getUniqueRunDependency(id) {
 return id;
}

function addRunDependency(id) {
 runDependencies++;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
}

function removeRunDependency(id) {
 runDependencies--;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (runDependencies == 0) {
  if (runDependencyWatcher !== null) {
   clearInterval(runDependencyWatcher);
   runDependencyWatcher = null;
  }
  if (dependenciesFulfilled) {
   var callback = dependenciesFulfilled;
   dependenciesFulfilled = null;
   callback();
  }
 }
}

Module["preloadedImages"] = {};

Module["preloadedAudios"] = {};

var memoryInitializer = null;

var dataURIPrefix = "data:application/octet-stream;base64,";

function isDataURI(filename) {
 return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0;
}

function _getWindowHeight() {
 var w = window, d = document, e = d.documentElement, g = d.getElementsByTagName("body")[0], y = w.innerHeight || e.clientHeight || g.clientHeight;
 return y;
}

function _getWindowWidth() {
 var w = window, d = document, e = d.documentElement, g = d.getElementsByTagName("body")[0], x = w.innerWidth || e.clientWidth || g.clientWidth;
 return x;
}

__ATINIT__.push({
 func: function() {
  __GLOBAL__sub_I_main_cpp();
 }
});

memoryInitializer = "main.js.mem";

var tempDoublePtr = 10128;

function ___setErrNo(value) {
 if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
 return value;
}

var PATH = {
 splitPath: function(filename) {
  var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  return splitPathRe.exec(filename).slice(1);
 },
 normalizeArray: function(parts, allowAboveRoot) {
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
   var last = parts[i];
   if (last === ".") {
    parts.splice(i, 1);
   } else if (last === "..") {
    parts.splice(i, 1);
    up++;
   } else if (up) {
    parts.splice(i, 1);
    up--;
   }
  }
  if (allowAboveRoot) {
   for (;up; up--) {
    parts.unshift("..");
   }
  }
  return parts;
 },
 normalize: function(path) {
  var isAbsolute = path.charAt(0) === "/", trailingSlash = path.substr(-1) === "/";
  path = PATH.normalizeArray(path.split("/").filter(function(p) {
   return !!p;
  }), !isAbsolute).join("/");
  if (!path && !isAbsolute) {
   path = ".";
  }
  if (path && trailingSlash) {
   path += "/";
  }
  return (isAbsolute ? "/" : "") + path;
 },
 dirname: function(path) {
  var result = PATH.splitPath(path), root = result[0], dir = result[1];
  if (!root && !dir) {
   return ".";
  }
  if (dir) {
   dir = dir.substr(0, dir.length - 1);
  }
  return root + dir;
 },
 basename: function(path) {
  if (path === "/") return "/";
  var lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) return path;
  return path.substr(lastSlash + 1);
 },
 extname: function(path) {
  return PATH.splitPath(path)[3];
 },
 join: function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return PATH.normalize(paths.join("/"));
 },
 join2: function(l, r) {
  return PATH.normalize(l + "/" + r);
 },
 resolve: function() {
  var resolvedPath = "", resolvedAbsolute = false;
  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
   var path = i >= 0 ? arguments[i] : FS.cwd();
   if (typeof path !== "string") {
    throw new TypeError("Arguments to path.resolve must be strings");
   } else if (!path) {
    return "";
   }
   resolvedPath = path + "/" + resolvedPath;
   resolvedAbsolute = path.charAt(0) === "/";
  }
  resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function(p) {
   return !!p;
  }), !resolvedAbsolute).join("/");
  return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
 },
 relative: function(from, to) {
  from = PATH.resolve(from).substr(1);
  to = PATH.resolve(to).substr(1);
  function trim(arr) {
   var start = 0;
   for (;start < arr.length; start++) {
    if (arr[start] !== "") break;
   }
   var end = arr.length - 1;
   for (;end >= 0; end--) {
    if (arr[end] !== "") break;
   }
   if (start > end) return [];
   return arr.slice(start, end - start + 1);
  }
  var fromParts = trim(from.split("/"));
  var toParts = trim(to.split("/"));
  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
   if (fromParts[i] !== toParts[i]) {
    samePartsLength = i;
    break;
   }
  }
  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
   outputParts.push("..");
  }
  outputParts = outputParts.concat(toParts.slice(samePartsLength));
  return outputParts.join("/");
 }
};

var TTY = {
 ttys: [],
 init: function() {},
 shutdown: function() {},
 register: function(dev, ops) {
  TTY.ttys[dev] = {
   input: [],
   output: [],
   ops: ops
  };
  FS.registerDevice(dev, TTY.stream_ops);
 },
 stream_ops: {
  open: function(stream) {
   var tty = TTY.ttys[stream.node.rdev];
   if (!tty) {
    throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
   }
   stream.tty = tty;
   stream.seekable = false;
  },
  close: function(stream) {
   stream.tty.ops.flush(stream.tty);
  },
  flush: function(stream) {
   stream.tty.ops.flush(stream.tty);
  },
  read: function(stream, buffer, offset, length, pos) {
   if (!stream.tty || !stream.tty.ops.get_char) {
    throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
   }
   var bytesRead = 0;
   for (var i = 0; i < length; i++) {
    var result;
    try {
     result = stream.tty.ops.get_char(stream.tty);
    } catch (e) {
     throw new FS.ErrnoError(ERRNO_CODES.EIO);
    }
    if (result === undefined && bytesRead === 0) {
     throw new FS.ErrnoError(ERRNO_CODES.EAGAIN);
    }
    if (result === null || result === undefined) break;
    bytesRead++;
    buffer[offset + i] = result;
   }
   if (bytesRead) {
    stream.node.timestamp = Date.now();
   }
   return bytesRead;
  },
  write: function(stream, buffer, offset, length, pos) {
   if (!stream.tty || !stream.tty.ops.put_char) {
    throw new FS.ErrnoError(ERRNO_CODES.ENXIO);
   }
   try {
    for (var i = 0; i < length; i++) {
     stream.tty.ops.put_char(stream.tty, buffer[offset + i]);
    }
   } catch (e) {
    throw new FS.ErrnoError(ERRNO_CODES.EIO);
   }
   if (length) {
    stream.node.timestamp = Date.now();
   }
   return i;
  }
 },
 default_tty_ops: {
  get_char: function(tty) {
   if (!tty.input.length) {
    var result = null;
    if (ENVIRONMENT_IS_NODE) {
     var BUFSIZE = 256;
     var buf = new Buffer(BUFSIZE);
     var bytesRead = 0;
     var isPosixPlatform = process.platform != "win32";
     var fd = process.stdin.fd;
     if (isPosixPlatform) {
      var usingDevice = false;
      try {
       fd = fs.openSync("/dev/stdin", "r");
       usingDevice = true;
      } catch (e) {}
     }
     try {
      bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null);
     } catch (e) {
      if (e.toString().indexOf("EOF") != -1) bytesRead = 0; else throw e;
     }
     if (usingDevice) {
      fs.closeSync(fd);
     }
     if (bytesRead > 0) {
      result = buf.slice(0, bytesRead).toString("utf-8");
     } else {
      result = null;
     }
    } else if (typeof window != "undefined" && typeof window.prompt == "function") {
     result = window.prompt("Input: ");
     if (result !== null) {
      result += "\n";
     }
    } else if (typeof readline == "function") {
     result = readline();
     if (result !== null) {
      result += "\n";
     }
    }
    if (!result) {
     return null;
    }
    tty.input = intArrayFromString(result, true);
   }
   return tty.input.shift();
  },
  put_char: function(tty, val) {
   if (val === null || val === 10) {
    out(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   } else {
    if (val != 0) tty.output.push(val);
   }
  },
  flush: function(tty) {
   if (tty.output && tty.output.length > 0) {
    out(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   }
  }
 },
 default_tty1_ops: {
  put_char: function(tty, val) {
   if (val === null || val === 10) {
    err(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   } else {
    if (val != 0) tty.output.push(val);
   }
  },
  flush: function(tty) {
   if (tty.output && tty.output.length > 0) {
    err(UTF8ArrayToString(tty.output, 0));
    tty.output = [];
   }
  }
 }
};

var MEMFS = {
 ops_table: null,
 mount: function(mount) {
  return MEMFS.createNode(null, "/", 16384 | 511, 0);
 },
 createNode: function(parent, name, mode, dev) {
  if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }
  if (!MEMFS.ops_table) {
   MEMFS.ops_table = {
    dir: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr,
      lookup: MEMFS.node_ops.lookup,
      mknod: MEMFS.node_ops.mknod,
      rename: MEMFS.node_ops.rename,
      unlink: MEMFS.node_ops.unlink,
      rmdir: MEMFS.node_ops.rmdir,
      readdir: MEMFS.node_ops.readdir,
      symlink: MEMFS.node_ops.symlink
     },
     stream: {
      llseek: MEMFS.stream_ops.llseek
     }
    },
    file: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr
     },
     stream: {
      llseek: MEMFS.stream_ops.llseek,
      read: MEMFS.stream_ops.read,
      write: MEMFS.stream_ops.write,
      allocate: MEMFS.stream_ops.allocate,
      mmap: MEMFS.stream_ops.mmap,
      msync: MEMFS.stream_ops.msync
     }
    },
    link: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr,
      readlink: MEMFS.node_ops.readlink
     },
     stream: {}
    },
    chrdev: {
     node: {
      getattr: MEMFS.node_ops.getattr,
      setattr: MEMFS.node_ops.setattr
     },
     stream: FS.chrdev_stream_ops
    }
   };
  }
  var node = FS.createNode(parent, name, mode, dev);
  if (FS.isDir(node.mode)) {
   node.node_ops = MEMFS.ops_table.dir.node;
   node.stream_ops = MEMFS.ops_table.dir.stream;
   node.contents = {};
  } else if (FS.isFile(node.mode)) {
   node.node_ops = MEMFS.ops_table.file.node;
   node.stream_ops = MEMFS.ops_table.file.stream;
   node.usedBytes = 0;
   node.contents = null;
  } else if (FS.isLink(node.mode)) {
   node.node_ops = MEMFS.ops_table.link.node;
   node.stream_ops = MEMFS.ops_table.link.stream;
  } else if (FS.isChrdev(node.mode)) {
   node.node_ops = MEMFS.ops_table.chrdev.node;
   node.stream_ops = MEMFS.ops_table.chrdev.stream;
  }
  node.timestamp = Date.now();
  if (parent) {
   parent.contents[name] = node;
  }
  return node;
 },
 getFileDataAsRegularArray: function(node) {
  if (node.contents && node.contents.subarray) {
   var arr = [];
   for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
   return arr;
  }
  return node.contents;
 },
 getFileDataAsTypedArray: function(node) {
  if (!node.contents) return new Uint8Array();
  if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
  return new Uint8Array(node.contents);
 },
 expandFileStorage: function(node, newCapacity) {
  var prevCapacity = node.contents ? node.contents.length : 0;
  if (prevCapacity >= newCapacity) return;
  var CAPACITY_DOUBLING_MAX = 1024 * 1024;
  newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
  if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
  var oldContents = node.contents;
  node.contents = new Uint8Array(newCapacity);
  if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
  return;
 },
 resizeFileStorage: function(node, newSize) {
  if (node.usedBytes == newSize) return;
  if (newSize == 0) {
   node.contents = null;
   node.usedBytes = 0;
   return;
  }
  if (!node.contents || node.contents.subarray) {
   var oldContents = node.contents;
   node.contents = new Uint8Array(new ArrayBuffer(newSize));
   if (oldContents) {
    node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)));
   }
   node.usedBytes = newSize;
   return;
  }
  if (!node.contents) node.contents = [];
  if (node.contents.length > newSize) node.contents.length = newSize; else while (node.contents.length < newSize) node.contents.push(0);
  node.usedBytes = newSize;
 },
 node_ops: {
  getattr: function(node) {
   var attr = {};
   attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
   attr.ino = node.id;
   attr.mode = node.mode;
   attr.nlink = 1;
   attr.uid = 0;
   attr.gid = 0;
   attr.rdev = node.rdev;
   if (FS.isDir(node.mode)) {
    attr.size = 4096;
   } else if (FS.isFile(node.mode)) {
    attr.size = node.usedBytes;
   } else if (FS.isLink(node.mode)) {
    attr.size = node.link.length;
   } else {
    attr.size = 0;
   }
   attr.atime = new Date(node.timestamp);
   attr.mtime = new Date(node.timestamp);
   attr.ctime = new Date(node.timestamp);
   attr.blksize = 4096;
   attr.blocks = Math.ceil(attr.size / attr.blksize);
   return attr;
  },
  setattr: function(node, attr) {
   if (attr.mode !== undefined) {
    node.mode = attr.mode;
   }
   if (attr.timestamp !== undefined) {
    node.timestamp = attr.timestamp;
   }
   if (attr.size !== undefined) {
    MEMFS.resizeFileStorage(node, attr.size);
   }
  },
  lookup: function(parent, name) {
   throw FS.genericErrors[ERRNO_CODES.ENOENT];
  },
  mknod: function(parent, name, mode, dev) {
   return MEMFS.createNode(parent, name, mode, dev);
  },
  rename: function(old_node, new_dir, new_name) {
   if (FS.isDir(old_node.mode)) {
    var new_node;
    try {
     new_node = FS.lookupNode(new_dir, new_name);
    } catch (e) {}
    if (new_node) {
     for (var i in new_node.contents) {
      throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
     }
    }
   }
   delete old_node.parent.contents[old_node.name];
   old_node.name = new_name;
   new_dir.contents[new_name] = old_node;
   old_node.parent = new_dir;
  },
  unlink: function(parent, name) {
   delete parent.contents[name];
  },
  rmdir: function(parent, name) {
   var node = FS.lookupNode(parent, name);
   for (var i in node.contents) {
    throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY);
   }
   delete parent.contents[name];
  },
  readdir: function(node) {
   var entries = [ ".", ".." ];
   for (var key in node.contents) {
    if (!node.contents.hasOwnProperty(key)) {
     continue;
    }
    entries.push(key);
   }
   return entries;
  },
  symlink: function(parent, newname, oldpath) {
   var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
   node.link = oldpath;
   return node;
  },
  readlink: function(node) {
   if (!FS.isLink(node.mode)) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return node.link;
  }
 },
 stream_ops: {
  read: function(stream, buffer, offset, length, position) {
   var contents = stream.node.contents;
   if (position >= stream.node.usedBytes) return 0;
   var size = Math.min(stream.node.usedBytes - position, length);
   assert(size >= 0);
   if (size > 8 && contents.subarray) {
    buffer.set(contents.subarray(position, position + size), offset);
   } else {
    for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i];
   }
   return size;
  },
  write: function(stream, buffer, offset, length, position, canOwn) {
   if (!length) return 0;
   var node = stream.node;
   node.timestamp = Date.now();
   if (buffer.subarray && (!node.contents || node.contents.subarray)) {
    if (canOwn) {
     node.contents = buffer.subarray(offset, offset + length);
     node.usedBytes = length;
     return length;
    } else if (node.usedBytes === 0 && position === 0) {
     node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
     node.usedBytes = length;
     return length;
    } else if (position + length <= node.usedBytes) {
     node.contents.set(buffer.subarray(offset, offset + length), position);
     return length;
    }
   }
   MEMFS.expandFileStorage(node, position + length);
   if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); else {
    for (var i = 0; i < length; i++) {
     node.contents[position + i] = buffer[offset + i];
    }
   }
   node.usedBytes = Math.max(node.usedBytes, position + length);
   return length;
  },
  llseek: function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     position += stream.node.usedBytes;
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return position;
  },
  allocate: function(stream, offset, length) {
   MEMFS.expandFileStorage(stream.node, offset + length);
   stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length);
  },
  mmap: function(stream, buffer, offset, length, position, prot, flags) {
   if (!FS.isFile(stream.node.mode)) {
    throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
   }
   var ptr;
   var allocated;
   var contents = stream.node.contents;
   if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
    allocated = false;
    ptr = contents.byteOffset;
   } else {
    if (position > 0 || position + length < stream.node.usedBytes) {
     if (contents.subarray) {
      contents = contents.subarray(position, position + length);
     } else {
      contents = Array.prototype.slice.call(contents, position, position + length);
     }
    }
    allocated = true;
    ptr = _malloc(length);
    if (!ptr) {
     throw new FS.ErrnoError(ERRNO_CODES.ENOMEM);
    }
    buffer.set(contents, ptr);
   }
   return {
    ptr: ptr,
    allocated: allocated
   };
  },
  msync: function(stream, buffer, offset, length, mmapFlags) {
   if (!FS.isFile(stream.node.mode)) {
    throw new FS.ErrnoError(ERRNO_CODES.ENODEV);
   }
   if (mmapFlags & 2) {
    return 0;
   }
   var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
   return 0;
  }
 }
};

var IDBFS = {
 dbs: {},
 indexedDB: function() {
  if (typeof indexedDB !== "undefined") return indexedDB;
  var ret = null;
  if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  assert(ret, "IDBFS used, but indexedDB not supported");
  return ret;
 },
 DB_VERSION: 21,
 DB_STORE_NAME: "FILE_DATA",
 mount: function(mount) {
  return MEMFS.mount.apply(null, arguments);
 },
 syncfs: function(mount, populate, callback) {
  IDBFS.getLocalSet(mount, function(err, local) {
   if (err) return callback(err);
   IDBFS.getRemoteSet(mount, function(err, remote) {
    if (err) return callback(err);
    var src = populate ? remote : local;
    var dst = populate ? local : remote;
    IDBFS.reconcile(src, dst, callback);
   });
  });
 },
 getDB: function(name, callback) {
  var db = IDBFS.dbs[name];
  if (db) {
   return callback(null, db);
  }
  var req;
  try {
   req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION);
  } catch (e) {
   return callback(e);
  }
  if (!req) {
   return callback("Unable to connect to IndexedDB");
  }
  req.onupgradeneeded = function(e) {
   var db = e.target.result;
   var transaction = e.target.transaction;
   var fileStore;
   if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
    fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME);
   } else {
    fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME);
   }
   if (!fileStore.indexNames.contains("timestamp")) {
    fileStore.createIndex("timestamp", "timestamp", {
     unique: false
    });
   }
  };
  req.onsuccess = function() {
   db = req.result;
   IDBFS.dbs[name] = db;
   callback(null, db);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 getLocalSet: function(mount, callback) {
  var entries = {};
  function isRealDir(p) {
   return p !== "." && p !== "..";
  }
  function toAbsolute(root) {
   return function(p) {
    return PATH.join2(root, p);
   };
  }
  var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
  while (check.length) {
   var path = check.pop();
   var stat;
   try {
    stat = FS.stat(path);
   } catch (e) {
    return callback(e);
   }
   if (FS.isDir(stat.mode)) {
    check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)));
   }
   entries[path] = {
    timestamp: stat.mtime
   };
  }
  return callback(null, {
   type: "local",
   entries: entries
  });
 },
 getRemoteSet: function(mount, callback) {
  var entries = {};
  IDBFS.getDB(mount.mountpoint, function(err, db) {
   if (err) return callback(err);
   try {
    var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readonly");
    transaction.onerror = function(e) {
     callback(this.error);
     e.preventDefault();
    };
    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
    var index = store.index("timestamp");
    index.openKeyCursor().onsuccess = function(event) {
     var cursor = event.target.result;
     if (!cursor) {
      return callback(null, {
       type: "remote",
       db: db,
       entries: entries
      });
     }
     entries[cursor.primaryKey] = {
      timestamp: cursor.key
     };
     cursor.continue();
    };
   } catch (e) {
    return callback(e);
   }
  });
 },
 loadLocalEntry: function(path, callback) {
  var stat, node;
  try {
   var lookup = FS.lookupPath(path);
   node = lookup.node;
   stat = FS.stat(path);
  } catch (e) {
   return callback(e);
  }
  if (FS.isDir(stat.mode)) {
   return callback(null, {
    timestamp: stat.mtime,
    mode: stat.mode
   });
  } else if (FS.isFile(stat.mode)) {
   node.contents = MEMFS.getFileDataAsTypedArray(node);
   return callback(null, {
    timestamp: stat.mtime,
    mode: stat.mode,
    contents: node.contents
   });
  } else {
   return callback(new Error("node type not supported"));
  }
 },
 storeLocalEntry: function(path, entry, callback) {
  try {
   if (FS.isDir(entry.mode)) {
    FS.mkdir(path, entry.mode);
   } else if (FS.isFile(entry.mode)) {
    FS.writeFile(path, entry.contents, {
     canOwn: true
    });
   } else {
    return callback(new Error("node type not supported"));
   }
   FS.chmod(path, entry.mode);
   FS.utime(path, entry.timestamp, entry.timestamp);
  } catch (e) {
   return callback(e);
  }
  callback(null);
 },
 removeLocalEntry: function(path, callback) {
  try {
   var lookup = FS.lookupPath(path);
   var stat = FS.stat(path);
   if (FS.isDir(stat.mode)) {
    FS.rmdir(path);
   } else if (FS.isFile(stat.mode)) {
    FS.unlink(path);
   }
  } catch (e) {
   return callback(e);
  }
  callback(null);
 },
 loadRemoteEntry: function(store, path, callback) {
  var req = store.get(path);
  req.onsuccess = function(event) {
   callback(null, event.target.result);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 storeRemoteEntry: function(store, path, entry, callback) {
  var req = store.put(entry, path);
  req.onsuccess = function() {
   callback(null);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 removeRemoteEntry: function(store, path, callback) {
  var req = store.delete(path);
  req.onsuccess = function() {
   callback(null);
  };
  req.onerror = function(e) {
   callback(this.error);
   e.preventDefault();
  };
 },
 reconcile: function(src, dst, callback) {
  var total = 0;
  var create = [];
  Object.keys(src.entries).forEach(function(key) {
   var e = src.entries[key];
   var e2 = dst.entries[key];
   if (!e2 || e.timestamp > e2.timestamp) {
    create.push(key);
    total++;
   }
  });
  var remove = [];
  Object.keys(dst.entries).forEach(function(key) {
   var e = dst.entries[key];
   var e2 = src.entries[key];
   if (!e2) {
    remove.push(key);
    total++;
   }
  });
  if (!total) {
   return callback(null);
  }
  var errored = false;
  var completed = 0;
  var db = src.type === "remote" ? src.db : dst.db;
  var transaction = db.transaction([ IDBFS.DB_STORE_NAME ], "readwrite");
  var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
  function done(err) {
   if (err) {
    if (!done.errored) {
     done.errored = true;
     return callback(err);
    }
    return;
   }
   if (++completed >= total) {
    return callback(null);
   }
  }
  transaction.onerror = function(e) {
   done(this.error);
   e.preventDefault();
  };
  create.sort().forEach(function(path) {
   if (dst.type === "local") {
    IDBFS.loadRemoteEntry(store, path, function(err, entry) {
     if (err) return done(err);
     IDBFS.storeLocalEntry(path, entry, done);
    });
   } else {
    IDBFS.loadLocalEntry(path, function(err, entry) {
     if (err) return done(err);
     IDBFS.storeRemoteEntry(store, path, entry, done);
    });
   }
  });
  remove.sort().reverse().forEach(function(path) {
   if (dst.type === "local") {
    IDBFS.removeLocalEntry(path, done);
   } else {
    IDBFS.removeRemoteEntry(store, path, done);
   }
  });
 }
};

var NODEFS = {
 isWindows: false,
 staticInit: function() {
  NODEFS.isWindows = !!process.platform.match(/^win/);
  var flags = process["binding"]("constants");
  if (flags["fs"]) {
   flags = flags["fs"];
  }
  NODEFS.flagsForNodeMap = {
   1024: flags["O_APPEND"],
   64: flags["O_CREAT"],
   128: flags["O_EXCL"],
   0: flags["O_RDONLY"],
   2: flags["O_RDWR"],
   4096: flags["O_SYNC"],
   512: flags["O_TRUNC"],
   1: flags["O_WRONLY"]
  };
 },
 bufferFrom: function(arrayBuffer) {
  return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer);
 },
 mount: function(mount) {
  assert(ENVIRONMENT_IS_NODE);
  return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0);
 },
 createNode: function(parent, name, mode, dev) {
  if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
  var node = FS.createNode(parent, name, mode);
  node.node_ops = NODEFS.node_ops;
  node.stream_ops = NODEFS.stream_ops;
  return node;
 },
 getMode: function(path) {
  var stat;
  try {
   stat = fs.lstatSync(path);
   if (NODEFS.isWindows) {
    stat.mode = stat.mode | (stat.mode & 292) >> 2;
   }
  } catch (e) {
   if (!e.code) throw e;
   throw new FS.ErrnoError(ERRNO_CODES[e.code]);
  }
  return stat.mode;
 },
 realPath: function(node) {
  var parts = [];
  while (node.parent !== node) {
   parts.push(node.name);
   node = node.parent;
  }
  parts.push(node.mount.opts.root);
  parts.reverse();
  return PATH.join.apply(null, parts);
 },
 flagsForNode: function(flags) {
  flags &= ~2097152;
  flags &= ~2048;
  flags &= ~32768;
  flags &= ~524288;
  var newFlags = 0;
  for (var k in NODEFS.flagsForNodeMap) {
   if (flags & k) {
    newFlags |= NODEFS.flagsForNodeMap[k];
    flags ^= k;
   }
  }
  if (!flags) {
   return newFlags;
  } else {
   throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
  }
 },
 node_ops: {
  getattr: function(node) {
   var path = NODEFS.realPath(node);
   var stat;
   try {
    stat = fs.lstatSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
   if (NODEFS.isWindows && !stat.blksize) {
    stat.blksize = 4096;
   }
   if (NODEFS.isWindows && !stat.blocks) {
    stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0;
   }
   return {
    dev: stat.dev,
    ino: stat.ino,
    mode: stat.mode,
    nlink: stat.nlink,
    uid: stat.uid,
    gid: stat.gid,
    rdev: stat.rdev,
    size: stat.size,
    atime: stat.atime,
    mtime: stat.mtime,
    ctime: stat.ctime,
    blksize: stat.blksize,
    blocks: stat.blocks
   };
  },
  setattr: function(node, attr) {
   var path = NODEFS.realPath(node);
   try {
    if (attr.mode !== undefined) {
     fs.chmodSync(path, attr.mode);
     node.mode = attr.mode;
    }
    if (attr.timestamp !== undefined) {
     var date = new Date(attr.timestamp);
     fs.utimesSync(path, date, date);
    }
    if (attr.size !== undefined) {
     fs.truncateSync(path, attr.size);
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  lookup: function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   var mode = NODEFS.getMode(path);
   return NODEFS.createNode(parent, name, mode);
  },
  mknod: function(parent, name, mode, dev) {
   var node = NODEFS.createNode(parent, name, mode, dev);
   var path = NODEFS.realPath(node);
   try {
    if (FS.isDir(node.mode)) {
     fs.mkdirSync(path, node.mode);
    } else {
     fs.writeFileSync(path, "", {
      mode: node.mode
     });
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
   return node;
  },
  rename: function(oldNode, newDir, newName) {
   var oldPath = NODEFS.realPath(oldNode);
   var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
   try {
    fs.renameSync(oldPath, newPath);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  unlink: function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   try {
    fs.unlinkSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  rmdir: function(parent, name) {
   var path = PATH.join2(NODEFS.realPath(parent), name);
   try {
    fs.rmdirSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  readdir: function(node) {
   var path = NODEFS.realPath(node);
   try {
    return fs.readdirSync(path);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  symlink: function(parent, newName, oldPath) {
   var newPath = PATH.join2(NODEFS.realPath(parent), newName);
   try {
    fs.symlinkSync(oldPath, newPath);
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  readlink: function(node) {
   var path = NODEFS.realPath(node);
   try {
    path = fs.readlinkSync(path);
    path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
    return path;
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  }
 },
 stream_ops: {
  open: function(stream) {
   var path = NODEFS.realPath(stream.node);
   try {
    if (FS.isFile(stream.node.mode)) {
     stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags));
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  close: function(stream) {
   try {
    if (FS.isFile(stream.node.mode) && stream.nfd) {
     fs.closeSync(stream.nfd);
    }
   } catch (e) {
    if (!e.code) throw e;
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  read: function(stream, buffer, offset, length, position) {
   if (length === 0) return 0;
   try {
    return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
   } catch (e) {
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  write: function(stream, buffer, offset, length, position) {
   try {
    return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position);
   } catch (e) {
    throw new FS.ErrnoError(ERRNO_CODES[e.code]);
   }
  },
  llseek: function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     try {
      var stat = fs.fstatSync(stream.nfd);
      position += stat.size;
     } catch (e) {
      throw new FS.ErrnoError(ERRNO_CODES[e.code]);
     }
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return position;
  }
 }
};

var WORKERFS = {
 DIR_MODE: 16895,
 FILE_MODE: 33279,
 reader: null,
 mount: function(mount) {
  assert(ENVIRONMENT_IS_WORKER);
  if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync();
  var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
  var createdParents = {};
  function ensureParent(path) {
   var parts = path.split("/");
   var parent = root;
   for (var i = 0; i < parts.length - 1; i++) {
    var curr = parts.slice(0, i + 1).join("/");
    if (!createdParents[curr]) {
     createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0);
    }
    parent = createdParents[curr];
   }
   return parent;
  }
  function base(path) {
   var parts = path.split("/");
   return parts[parts.length - 1];
  }
  Array.prototype.forEach.call(mount.opts["files"] || [], function(file) {
   WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate);
  });
  (mount.opts["blobs"] || []).forEach(function(obj) {
   WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"]);
  });
  (mount.opts["packages"] || []).forEach(function(pack) {
   pack["metadata"].files.forEach(function(file) {
    var name = file.filename.substr(1);
    WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end));
   });
  });
  return root;
 },
 createNode: function(parent, name, mode, dev, contents, mtime) {
  var node = FS.createNode(parent, name, mode);
  node.mode = mode;
  node.node_ops = WORKERFS.node_ops;
  node.stream_ops = WORKERFS.stream_ops;
  node.timestamp = (mtime || new Date()).getTime();
  assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
  if (mode === WORKERFS.FILE_MODE) {
   node.size = contents.size;
   node.contents = contents;
  } else {
   node.size = 4096;
   node.contents = {};
  }
  if (parent) {
   parent.contents[name] = node;
  }
  return node;
 },
 node_ops: {
  getattr: function(node) {
   return {
    dev: 1,
    ino: undefined,
    mode: node.mode,
    nlink: 1,
    uid: 0,
    gid: 0,
    rdev: undefined,
    size: node.size,
    atime: new Date(node.timestamp),
    mtime: new Date(node.timestamp),
    ctime: new Date(node.timestamp),
    blksize: 4096,
    blocks: Math.ceil(node.size / 4096)
   };
  },
  setattr: function(node, attr) {
   if (attr.mode !== undefined) {
    node.mode = attr.mode;
   }
   if (attr.timestamp !== undefined) {
    node.timestamp = attr.timestamp;
   }
  },
  lookup: function(parent, name) {
   throw new FS.ErrnoError(ERRNO_CODES.ENOENT);
  },
  mknod: function(parent, name, mode, dev) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  rename: function(oldNode, newDir, newName) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  unlink: function(parent, name) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  rmdir: function(parent, name) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  readdir: function(node) {
   var entries = [ ".", ".." ];
   for (var key in node.contents) {
    if (!node.contents.hasOwnProperty(key)) {
     continue;
    }
    entries.push(key);
   }
   return entries;
  },
  symlink: function(parent, newName, oldPath) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  },
  readlink: function(node) {
   throw new FS.ErrnoError(ERRNO_CODES.EPERM);
  }
 },
 stream_ops: {
  read: function(stream, buffer, offset, length, position) {
   if (position >= stream.node.size) return 0;
   var chunk = stream.node.contents.slice(position, position + length);
   var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
   buffer.set(new Uint8Array(ab), offset);
   return chunk.size;
  },
  write: function(stream, buffer, offset, length, position) {
   throw new FS.ErrnoError(ERRNO_CODES.EIO);
  },
  llseek: function(stream, offset, whence) {
   var position = offset;
   if (whence === 1) {
    position += stream.position;
   } else if (whence === 2) {
    if (FS.isFile(stream.node.mode)) {
     position += stream.node.size;
    }
   }
   if (position < 0) {
    throw new FS.ErrnoError(ERRNO_CODES.EINVAL);
   }
   return position;
  }
 }
};

var FS = {
 root: null,
 mounts: [],
 devices: {},
 streams: [],
 nextInode: 1,
 nameTable: null,
 currentPath: "/",
 initialized: false,
 ignorePermissions: true,
 trackingDelegate: {},
 tracking: {
  openFlags: {
   READ: 1,
   WRITE: 2
  }
 },
 ErrnoError: null,
 genericErrors: {},
 filesystems: null,
 syncFSRequests: 0,
 handleFSError: function(e) {
  if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
  return ___setErrNo(e.errno);
 },
 lookupPath: function(path, opts) {
  path = PATH.resolve(FS.cwd(), path);
  opts = opts || {};
  if (!path) return {
   path: "",
   node: null
  };
  var defaults = {
   follow_mount: true,
   recurse_count: 0
  };
  for (var key in defaults) {
   if (opts[key] === undefined) {
    opts[key] = defaults[key];
   }
  }
  if (opts.recurse_count > 8) {
   throw new FS.ErrnoError(40);
  }
  var parts = PATH.normalizeArray(path.split("/").filter(function(p) {
   return !!p;
  }), false);
  var current = FS.root;
  var current_path = "/";
  for (var i = 0; i < parts.length; i++) {
   var islast = i === parts.length - 1;
   if (islast && opts.parent) {
    break;
   }
   current = FS.lookupNode(current, parts[i]);
   current_path = PATH.join2(current_path, parts[i]);
   if (FS.isMountpoint(current)) {
    if (!islast || islast && opts.follow_mount) {
     current = current.mounted.root;
    }
   }
   if (!islast || opts.follow) {
    var count = 0;
    while (FS.isLink(current.mode)) {
     var link = FS.readlink(current_path);
     current_path = PATH.resolve(PATH.dirname(current_path), link);
     var lookup = FS.lookupPath(current_path, {
      recurse_count: opts.recurse_count
     });
     current = lookup.node;
     if (count++ > 40) {
      throw new FS.ErrnoError(40);
     }
    }
   }
  }
  return {
   path: current_path,
   node: current
  };
 },
 getPath: function(node) {
  var path;
  while (true) {
   if (FS.isRoot(node)) {
    var mount = node.mount.mountpoint;
    if (!path) return mount;
    return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path;
   }
   path = path ? node.name + "/" + path : node.name;
   node = node.parent;
  }
 },
 hashName: function(parentid, name) {
  var hash = 0;
  for (var i = 0; i < name.length; i++) {
   hash = (hash << 5) - hash + name.charCodeAt(i) | 0;
  }
  return (parentid + hash >>> 0) % FS.nameTable.length;
 },
 hashAddNode: function(node) {
  var hash = FS.hashName(node.parent.id, node.name);
  node.name_next = FS.nameTable[hash];
  FS.nameTable[hash] = node;
 },
 hashRemoveNode: function(node) {
  var hash = FS.hashName(node.parent.id, node.name);
  if (FS.nameTable[hash] === node) {
   FS.nameTable[hash] = node.name_next;
  } else {
   var current = FS.nameTable[hash];
   while (current) {
    if (current.name_next === node) {
     current.name_next = node.name_next;
     break;
    }
    current = current.name_next;
   }
  }
 },
 lookupNode: function(parent, name) {
  var err = FS.mayLookup(parent);
  if (err) {
   throw new FS.ErrnoError(err, parent);
  }
  var hash = FS.hashName(parent.id, name);
  for (var node = FS.nameTable[hash]; node; node = node.name_next) {
   var nodeName = node.name;
   if (node.parent.id === parent.id && nodeName === name) {
    return node;
   }
  }
  return FS.lookup(parent, name);
 },
 createNode: function(parent, name, mode, rdev) {
  if (!FS.FSNode) {
   FS.FSNode = function(parent, name, mode, rdev) {
    if (!parent) {
     parent = this;
    }
    this.parent = parent;
    this.mount = parent.mount;
    this.mounted = null;
    this.id = FS.nextInode++;
    this.name = name;
    this.mode = mode;
    this.node_ops = {};
    this.stream_ops = {};
    this.rdev = rdev;
   };
   FS.FSNode.prototype = {};
   var readMode = 292 | 73;
   var writeMode = 146;
   Object.defineProperties(FS.FSNode.prototype, {
    read: {
     get: function() {
      return (this.mode & readMode) === readMode;
     },
     set: function(val) {
      val ? this.mode |= readMode : this.mode &= ~readMode;
     }
    },
    write: {
     get: function() {
      return (this.mode & writeMode) === writeMode;
     },
     set: function(val) {
      val ? this.mode |= writeMode : this.mode &= ~writeMode;
     }
    },
    isFolder: {
     get: function() {
      return FS.isDir(this.mode);
     }
    },
    isDevice: {
     get: function() {
      return FS.isChrdev(this.mode);
     }
    }
   });
  }
  var node = new FS.FSNode(parent, name, mode, rdev);
  FS.hashAddNode(node);
  return node;
 },
 destroyNode: function(node) {
  FS.hashRemoveNode(node);
 },
 isRoot: function(node) {
  return node === node.parent;
 },
 isMountpoint: function(node) {
  return !!node.mounted;
 },
 isFile: function(mode) {
  return (mode & 61440) === 32768;
 },
 isDir: function(mode) {
  return (mode & 61440) === 16384;
 },
 isLink: function(mode) {
  return (mode & 61440) === 40960;
 },
 isChrdev: function(mode) {
  return (mode & 61440) === 8192;
 },
 isBlkdev: function(mode) {
  return (mode & 61440) === 24576;
 },
 isFIFO: function(mode) {
  return (mode & 61440) === 4096;
 },
 isSocket: function(mode) {
  return (mode & 49152) === 49152;
 },
 flagModes: {
  "r": 0,
  "rs": 1052672,
  "r+": 2,
  "w": 577,
  "wx": 705,
  "xw": 705,
  "w+": 578,
  "wx+": 706,
  "xw+": 706,
  "a": 1089,
  "ax": 1217,
  "xa": 1217,
  "a+": 1090,
  "ax+": 1218,
  "xa+": 1218
 },
 modeStringToFlags: function(str) {
  var flags = FS.flagModes[str];
  if (typeof flags === "undefined") {
   throw new Error("Unknown file open mode: " + str);
  }
  return flags;
 },
 flagsToPermissionString: function(flag) {
  var perms = [ "r", "w", "rw" ][flag & 3];
  if (flag & 512) {
   perms += "w";
  }
  return perms;
 },
 nodePermissions: function(node, perms) {
  if (FS.ignorePermissions) {
   return 0;
  }
  if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
   return 13;
  } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
   return 13;
  } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
   return 13;
  }
  return 0;
 },
 mayLookup: function(dir) {
  var err = FS.nodePermissions(dir, "x");
  if (err) return err;
  if (!dir.node_ops.lookup) return 13;
  return 0;
 },
 mayCreate: function(dir, name) {
  try {
   var node = FS.lookupNode(dir, name);
   return 17;
  } catch (e) {}
  return FS.nodePermissions(dir, "wx");
 },
 mayDelete: function(dir, name, isdir) {
  var node;
  try {
   node = FS.lookupNode(dir, name);
  } catch (e) {
   return e.errno;
  }
  var err = FS.nodePermissions(dir, "wx");
  if (err) {
   return err;
  }
  if (isdir) {
   if (!FS.isDir(node.mode)) {
    return 20;
   }
   if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
    return 16;
   }
  } else {
   if (FS.isDir(node.mode)) {
    return 21;
   }
  }
  return 0;
 },
 mayOpen: function(node, flags) {
  if (!node) {
   return 2;
  }
  if (FS.isLink(node.mode)) {
   return 40;
  } else if (FS.isDir(node.mode)) {
   if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
    return 21;
   }
  }
  return FS.nodePermissions(node, FS.flagsToPermissionString(flags));
 },
 MAX_OPEN_FDS: 4096,
 nextfd: function(fd_start, fd_end) {
  fd_start = fd_start || 0;
  fd_end = fd_end || FS.MAX_OPEN_FDS;
  for (var fd = fd_start; fd <= fd_end; fd++) {
   if (!FS.streams[fd]) {
    return fd;
   }
  }
  throw new FS.ErrnoError(24);
 },
 getStream: function(fd) {
  return FS.streams[fd];
 },
 createStream: function(stream, fd_start, fd_end) {
  if (!FS.FSStream) {
   FS.FSStream = function() {};
   FS.FSStream.prototype = {};
   Object.defineProperties(FS.FSStream.prototype, {
    object: {
     get: function() {
      return this.node;
     },
     set: function(val) {
      this.node = val;
     }
    },
    isRead: {
     get: function() {
      return (this.flags & 2097155) !== 1;
     }
    },
    isWrite: {
     get: function() {
      return (this.flags & 2097155) !== 0;
     }
    },
    isAppend: {
     get: function() {
      return this.flags & 1024;
     }
    }
   });
  }
  var newStream = new FS.FSStream();
  for (var p in stream) {
   newStream[p] = stream[p];
  }
  stream = newStream;
  var fd = FS.nextfd(fd_start, fd_end);
  stream.fd = fd;
  FS.streams[fd] = stream;
  return stream;
 },
 closeStream: function(fd) {
  FS.streams[fd] = null;
 },
 chrdev_stream_ops: {
  open: function(stream) {
   var device = FS.getDevice(stream.node.rdev);
   stream.stream_ops = device.stream_ops;
   if (stream.stream_ops.open) {
    stream.stream_ops.open(stream);
   }
  },
  llseek: function() {
   throw new FS.ErrnoError(29);
  }
 },
 major: function(dev) {
  return dev >> 8;
 },
 minor: function(dev) {
  return dev & 255;
 },
 makedev: function(ma, mi) {
  return ma << 8 | mi;
 },
 registerDevice: function(dev, ops) {
  FS.devices[dev] = {
   stream_ops: ops
  };
 },
 getDevice: function(dev) {
  return FS.devices[dev];
 },
 getMounts: function(mount) {
  var mounts = [];
  var check = [ mount ];
  while (check.length) {
   var m = check.pop();
   mounts.push(m);
   check.push.apply(check, m.mounts);
  }
  return mounts;
 },
 syncfs: function(populate, callback) {
  if (typeof populate === "function") {
   callback = populate;
   populate = false;
  }
  FS.syncFSRequests++;
  if (FS.syncFSRequests > 1) {
   console.log("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work");
  }
  var mounts = FS.getMounts(FS.root.mount);
  var completed = 0;
  function doCallback(err) {
   assert(FS.syncFSRequests > 0);
   FS.syncFSRequests--;
   return callback(err);
  }
  function done(err) {
   if (err) {
    if (!done.errored) {
     done.errored = true;
     return doCallback(err);
    }
    return;
   }
   if (++completed >= mounts.length) {
    doCallback(null);
   }
  }
  mounts.forEach(function(mount) {
   if (!mount.type.syncfs) {
    return done(null);
   }
   mount.type.syncfs(mount, populate, done);
  });
 },
 mount: function(type, opts, mountpoint) {
  var root = mountpoint === "/";
  var pseudo = !mountpoint;
  var node;
  if (root && FS.root) {
   throw new FS.ErrnoError(16);
  } else if (!root && !pseudo) {
   var lookup = FS.lookupPath(mountpoint, {
    follow_mount: false
   });
   mountpoint = lookup.path;
   node = lookup.node;
   if (FS.isMountpoint(node)) {
    throw new FS.ErrnoError(16);
   }
   if (!FS.isDir(node.mode)) {
    throw new FS.ErrnoError(20);
   }
  }
  var mount = {
   type: type,
   opts: opts,
   mountpoint: mountpoint,
   mounts: []
  };
  var mountRoot = type.mount(mount);
  mountRoot.mount = mount;
  mount.root = mountRoot;
  if (root) {
   FS.root = mountRoot;
  } else if (node) {
   node.mounted = mount;
   if (node.mount) {
    node.mount.mounts.push(mount);
   }
  }
  return mountRoot;
 },
 unmount: function(mountpoint) {
  var lookup = FS.lookupPath(mountpoint, {
   follow_mount: false
  });
  if (!FS.isMountpoint(lookup.node)) {
   throw new FS.ErrnoError(22);
  }
  var node = lookup.node;
  var mount = node.mounted;
  var mounts = FS.getMounts(mount);
  Object.keys(FS.nameTable).forEach(function(hash) {
   var current = FS.nameTable[hash];
   while (current) {
    var next = current.name_next;
    if (mounts.indexOf(current.mount) !== -1) {
     FS.destroyNode(current);
    }
    current = next;
   }
  });
  node.mounted = null;
  var idx = node.mount.mounts.indexOf(mount);
  assert(idx !== -1);
  node.mount.mounts.splice(idx, 1);
 },
 lookup: function(parent, name) {
  return parent.node_ops.lookup(parent, name);
 },
 mknod: function(path, mode, dev) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  if (!name || name === "." || name === "..") {
   throw new FS.ErrnoError(22);
  }
  var err = FS.mayCreate(parent, name);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.mknod) {
   throw new FS.ErrnoError(1);
  }
  return parent.node_ops.mknod(parent, name, mode, dev);
 },
 create: function(path, mode) {
  mode = mode !== undefined ? mode : 438;
  mode &= 4095;
  mode |= 32768;
  return FS.mknod(path, mode, 0);
 },
 mkdir: function(path, mode) {
  mode = mode !== undefined ? mode : 511;
  mode &= 511 | 512;
  mode |= 16384;
  return FS.mknod(path, mode, 0);
 },
 mkdirTree: function(path, mode) {
  var dirs = path.split("/");
  var d = "";
  for (var i = 0; i < dirs.length; ++i) {
   if (!dirs[i]) continue;
   d += "/" + dirs[i];
   try {
    FS.mkdir(d, mode);
   } catch (e) {
    if (e.errno != 17) throw e;
   }
  }
 },
 mkdev: function(path, mode, dev) {
  if (typeof dev === "undefined") {
   dev = mode;
   mode = 438;
  }
  mode |= 8192;
  return FS.mknod(path, mode, dev);
 },
 symlink: function(oldpath, newpath) {
  if (!PATH.resolve(oldpath)) {
   throw new FS.ErrnoError(2);
  }
  var lookup = FS.lookupPath(newpath, {
   parent: true
  });
  var parent = lookup.node;
  if (!parent) {
   throw new FS.ErrnoError(2);
  }
  var newname = PATH.basename(newpath);
  var err = FS.mayCreate(parent, newname);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.symlink) {
   throw new FS.ErrnoError(1);
  }
  return parent.node_ops.symlink(parent, newname, oldpath);
 },
 rename: function(old_path, new_path) {
  var old_dirname = PATH.dirname(old_path);
  var new_dirname = PATH.dirname(new_path);
  var old_name = PATH.basename(old_path);
  var new_name = PATH.basename(new_path);
  var lookup, old_dir, new_dir;
  try {
   lookup = FS.lookupPath(old_path, {
    parent: true
   });
   old_dir = lookup.node;
   lookup = FS.lookupPath(new_path, {
    parent: true
   });
   new_dir = lookup.node;
  } catch (e) {
   throw new FS.ErrnoError(16);
  }
  if (!old_dir || !new_dir) throw new FS.ErrnoError(2);
  if (old_dir.mount !== new_dir.mount) {
   throw new FS.ErrnoError(18);
  }
  var old_node = FS.lookupNode(old_dir, old_name);
  var relative = PATH.relative(old_path, new_dirname);
  if (relative.charAt(0) !== ".") {
   throw new FS.ErrnoError(22);
  }
  relative = PATH.relative(new_path, old_dirname);
  if (relative.charAt(0) !== ".") {
   throw new FS.ErrnoError(39);
  }
  var new_node;
  try {
   new_node = FS.lookupNode(new_dir, new_name);
  } catch (e) {}
  if (old_node === new_node) {
   return;
  }
  var isdir = FS.isDir(old_node.mode);
  var err = FS.mayDelete(old_dir, old_name, isdir);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!old_dir.node_ops.rename) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
   throw new FS.ErrnoError(16);
  }
  if (new_dir !== old_dir) {
   err = FS.nodePermissions(old_dir, "w");
   if (err) {
    throw new FS.ErrnoError(err);
   }
  }
  try {
   if (FS.trackingDelegate["willMovePath"]) {
    FS.trackingDelegate["willMovePath"](old_path, new_path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
  }
  FS.hashRemoveNode(old_node);
  try {
   old_dir.node_ops.rename(old_node, new_dir, new_name);
  } catch (e) {
   throw e;
  } finally {
   FS.hashAddNode(old_node);
  }
  try {
   if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path);
  } catch (e) {
   console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message);
  }
 },
 rmdir: function(path) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  var node = FS.lookupNode(parent, name);
  var err = FS.mayDelete(parent, name, true);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.rmdir) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isMountpoint(node)) {
   throw new FS.ErrnoError(16);
  }
  try {
   if (FS.trackingDelegate["willDeletePath"]) {
    FS.trackingDelegate["willDeletePath"](path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
  }
  parent.node_ops.rmdir(parent, name);
  FS.destroyNode(node);
  try {
   if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
  } catch (e) {
   console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
  }
 },
 readdir: function(path) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  var node = lookup.node;
  if (!node.node_ops.readdir) {
   throw new FS.ErrnoError(20);
  }
  return node.node_ops.readdir(node);
 },
 unlink: function(path) {
  var lookup = FS.lookupPath(path, {
   parent: true
  });
  var parent = lookup.node;
  var name = PATH.basename(path);
  var node = FS.lookupNode(parent, name);
  var err = FS.mayDelete(parent, name, false);
  if (err) {
   throw new FS.ErrnoError(err);
  }
  if (!parent.node_ops.unlink) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isMountpoint(node)) {
   throw new FS.ErrnoError(16);
  }
  try {
   if (FS.trackingDelegate["willDeletePath"]) {
    FS.trackingDelegate["willDeletePath"](path);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message);
  }
  parent.node_ops.unlink(parent, name);
  FS.destroyNode(node);
  try {
   if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path);
  } catch (e) {
   console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message);
  }
 },
 readlink: function(path) {
  var lookup = FS.lookupPath(path);
  var link = lookup.node;
  if (!link) {
   throw new FS.ErrnoError(2);
  }
  if (!link.node_ops.readlink) {
   throw new FS.ErrnoError(22);
  }
  return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link));
 },
 stat: function(path, dontFollow) {
  var lookup = FS.lookupPath(path, {
   follow: !dontFollow
  });
  var node = lookup.node;
  if (!node) {
   throw new FS.ErrnoError(2);
  }
  if (!node.node_ops.getattr) {
   throw new FS.ErrnoError(1);
  }
  return node.node_ops.getattr(node);
 },
 lstat: function(path) {
  return FS.stat(path, true);
 },
 chmod: function(path, mode, dontFollow) {
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: !dontFollow
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(1);
  }
  node.node_ops.setattr(node, {
   mode: mode & 4095 | node.mode & ~4095,
   timestamp: Date.now()
  });
 },
 lchmod: function(path, mode) {
  FS.chmod(path, mode, true);
 },
 fchmod: function(fd, mode) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(9);
  }
  FS.chmod(stream.node, mode);
 },
 chown: function(path, uid, gid, dontFollow) {
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: !dontFollow
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(1);
  }
  node.node_ops.setattr(node, {
   timestamp: Date.now()
  });
 },
 lchown: function(path, uid, gid) {
  FS.chown(path, uid, gid, true);
 },
 fchown: function(fd, uid, gid) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(9);
  }
  FS.chown(stream.node, uid, gid);
 },
 truncate: function(path, len) {
  if (len < 0) {
   throw new FS.ErrnoError(22);
  }
  var node;
  if (typeof path === "string") {
   var lookup = FS.lookupPath(path, {
    follow: true
   });
   node = lookup.node;
  } else {
   node = path;
  }
  if (!node.node_ops.setattr) {
   throw new FS.ErrnoError(1);
  }
  if (FS.isDir(node.mode)) {
   throw new FS.ErrnoError(21);
  }
  if (!FS.isFile(node.mode)) {
   throw new FS.ErrnoError(22);
  }
  var err = FS.nodePermissions(node, "w");
  if (err) {
   throw new FS.ErrnoError(err);
  }
  node.node_ops.setattr(node, {
   size: len,
   timestamp: Date.now()
  });
 },
 ftruncate: function(fd, len) {
  var stream = FS.getStream(fd);
  if (!stream) {
   throw new FS.ErrnoError(9);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(22);
  }
  FS.truncate(stream.node, len);
 },
 utime: function(path, atime, mtime) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  var node = lookup.node;
  node.node_ops.setattr(node, {
   timestamp: Math.max(atime, mtime)
  });
 },
 open: function(path, flags, mode, fd_start, fd_end) {
  if (path === "") {
   throw new FS.ErrnoError(2);
  }
  flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
  mode = typeof mode === "undefined" ? 438 : mode;
  if (flags & 64) {
   mode = mode & 4095 | 32768;
  } else {
   mode = 0;
  }
  var node;
  if (typeof path === "object") {
   node = path;
  } else {
   path = PATH.normalize(path);
   try {
    var lookup = FS.lookupPath(path, {
     follow: !(flags & 131072)
    });
    node = lookup.node;
   } catch (e) {}
  }
  var created = false;
  if (flags & 64) {
   if (node) {
    if (flags & 128) {
     throw new FS.ErrnoError(17);
    }
   } else {
    node = FS.mknod(path, mode, 0);
    created = true;
   }
  }
  if (!node) {
   throw new FS.ErrnoError(2);
  }
  if (FS.isChrdev(node.mode)) {
   flags &= ~512;
  }
  if (flags & 65536 && !FS.isDir(node.mode)) {
   throw new FS.ErrnoError(20);
  }
  if (!created) {
   var err = FS.mayOpen(node, flags);
   if (err) {
    throw new FS.ErrnoError(err);
   }
  }
  if (flags & 512) {
   FS.truncate(node, 0);
  }
  flags &= ~(128 | 512);
  var stream = FS.createStream({
   node: node,
   path: FS.getPath(node),
   flags: flags,
   seekable: true,
   position: 0,
   stream_ops: node.stream_ops,
   ungotten: [],
   error: false
  }, fd_start, fd_end);
  if (stream.stream_ops.open) {
   stream.stream_ops.open(stream);
  }
  if (Module["logReadFiles"] && !(flags & 1)) {
   if (!FS.readFiles) FS.readFiles = {};
   if (!(path in FS.readFiles)) {
    FS.readFiles[path] = 1;
    console.log("FS.trackingDelegate error on read file: " + path);
   }
  }
  try {
   if (FS.trackingDelegate["onOpenFile"]) {
    var trackingFlags = 0;
    if ((flags & 2097155) !== 1) {
     trackingFlags |= FS.tracking.openFlags.READ;
    }
    if ((flags & 2097155) !== 0) {
     trackingFlags |= FS.tracking.openFlags.WRITE;
    }
    FS.trackingDelegate["onOpenFile"](path, trackingFlags);
   }
  } catch (e) {
   console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message);
  }
  return stream;
 },
 close: function(stream) {
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if (stream.getdents) stream.getdents = null;
  try {
   if (stream.stream_ops.close) {
    stream.stream_ops.close(stream);
   }
  } catch (e) {
   throw e;
  } finally {
   FS.closeStream(stream.fd);
  }
  stream.fd = null;
 },
 isClosed: function(stream) {
  return stream.fd === null;
 },
 llseek: function(stream, offset, whence) {
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if (!stream.seekable || !stream.stream_ops.llseek) {
   throw new FS.ErrnoError(29);
  }
  if (whence != 0 && whence != 1 && whence != 2) {
   throw new FS.ErrnoError(22);
  }
  stream.position = stream.stream_ops.llseek(stream, offset, whence);
  stream.ungotten = [];
  return stream.position;
 },
 read: function(stream, buffer, offset, length, position) {
  if (length < 0 || position < 0) {
   throw new FS.ErrnoError(22);
  }
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if ((stream.flags & 2097155) === 1) {
   throw new FS.ErrnoError(9);
  }
  if (FS.isDir(stream.node.mode)) {
   throw new FS.ErrnoError(21);
  }
  if (!stream.stream_ops.read) {
   throw new FS.ErrnoError(22);
  }
  var seeking = typeof position !== "undefined";
  if (!seeking) {
   position = stream.position;
  } else if (!stream.seekable) {
   throw new FS.ErrnoError(29);
  }
  var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
  if (!seeking) stream.position += bytesRead;
  return bytesRead;
 },
 write: function(stream, buffer, offset, length, position, canOwn) {
  if (length < 0 || position < 0) {
   throw new FS.ErrnoError(22);
  }
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(9);
  }
  if (FS.isDir(stream.node.mode)) {
   throw new FS.ErrnoError(21);
  }
  if (!stream.stream_ops.write) {
   throw new FS.ErrnoError(22);
  }
  if (stream.flags & 1024) {
   FS.llseek(stream, 0, 2);
  }
  var seeking = typeof position !== "undefined";
  if (!seeking) {
   position = stream.position;
  } else if (!stream.seekable) {
   throw new FS.ErrnoError(29);
  }
  var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
  if (!seeking) stream.position += bytesWritten;
  try {
   if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path);
  } catch (e) {
   console.log("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message);
  }
  return bytesWritten;
 },
 allocate: function(stream, offset, length) {
  if (FS.isClosed(stream)) {
   throw new FS.ErrnoError(9);
  }
  if (offset < 0 || length <= 0) {
   throw new FS.ErrnoError(22);
  }
  if ((stream.flags & 2097155) === 0) {
   throw new FS.ErrnoError(9);
  }
  if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
   throw new FS.ErrnoError(19);
  }
  if (!stream.stream_ops.allocate) {
   throw new FS.ErrnoError(95);
  }
  stream.stream_ops.allocate(stream, offset, length);
 },
 mmap: function(stream, buffer, offset, length, position, prot, flags) {
  if ((stream.flags & 2097155) === 1) {
   throw new FS.ErrnoError(13);
  }
  if (!stream.stream_ops.mmap) {
   throw new FS.ErrnoError(19);
  }
  return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags);
 },
 msync: function(stream, buffer, offset, length, mmapFlags) {
  if (!stream || !stream.stream_ops.msync) {
   return 0;
  }
  return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags);
 },
 munmap: function(stream) {
  return 0;
 },
 ioctl: function(stream, cmd, arg) {
  if (!stream.stream_ops.ioctl) {
   throw new FS.ErrnoError(25);
  }
  return stream.stream_ops.ioctl(stream, cmd, arg);
 },
 readFile: function(path, opts) {
  opts = opts || {};
  opts.flags = opts.flags || "r";
  opts.encoding = opts.encoding || "binary";
  if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
   throw new Error('Invalid encoding type "' + opts.encoding + '"');
  }
  var ret;
  var stream = FS.open(path, opts.flags);
  var stat = FS.stat(path);
  var length = stat.size;
  var buf = new Uint8Array(length);
  FS.read(stream, buf, 0, length, 0);
  if (opts.encoding === "utf8") {
   ret = UTF8ArrayToString(buf, 0);
  } else if (opts.encoding === "binary") {
   ret = buf;
  }
  FS.close(stream);
  return ret;
 },
 writeFile: function(path, data, opts) {
  opts = opts || {};
  opts.flags = opts.flags || "w";
  var stream = FS.open(path, opts.flags, opts.mode);
  if (typeof data === "string") {
   var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
   var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
   FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn);
  } else if (ArrayBuffer.isView(data)) {
   FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn);
  } else {
   throw new Error("Unsupported data type");
  }
  FS.close(stream);
 },
 cwd: function() {
  return FS.currentPath;
 },
 chdir: function(path) {
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  if (lookup.node === null) {
   throw new FS.ErrnoError(2);
  }
  if (!FS.isDir(lookup.node.mode)) {
   throw new FS.ErrnoError(20);
  }
  var err = FS.nodePermissions(lookup.node, "x");
  if (err) {
   throw new FS.ErrnoError(err);
  }
  FS.currentPath = lookup.path;
 },
 createDefaultDirectories: function() {
  FS.mkdir("/tmp");
  FS.mkdir("/home");
  FS.mkdir("/home/web_user");
 },
 createDefaultDevices: function() {
  FS.mkdir("/dev");
  FS.registerDevice(FS.makedev(1, 3), {
   read: function() {
    return 0;
   },
   write: function(stream, buffer, offset, length, pos) {
    return length;
   }
  });
  FS.mkdev("/dev/null", FS.makedev(1, 3));
  TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
  TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
  FS.mkdev("/dev/tty", FS.makedev(5, 0));
  FS.mkdev("/dev/tty1", FS.makedev(6, 0));
  var random_device;
  if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
   var randomBuffer = new Uint8Array(1);
   random_device = function() {
    crypto.getRandomValues(randomBuffer);
    return randomBuffer[0];
   };
  } else if (ENVIRONMENT_IS_NODE) {
   try {
    var crypto_module = require("crypto");
    random_device = function() {
     return crypto_module["randomBytes"](1)[0];
    };
   } catch (e) {
    random_device = function() {
     return Math.random() * 256 | 0;
    };
   }
  } else {
   random_device = function() {
    abort("random_device");
   };
  }
  FS.createDevice("/dev", "random", random_device);
  FS.createDevice("/dev", "urandom", random_device);
  FS.mkdir("/dev/shm");
  FS.mkdir("/dev/shm/tmp");
 },
 createSpecialDirectories: function() {
  FS.mkdir("/proc");
  FS.mkdir("/proc/self");
  FS.mkdir("/proc/self/fd");
  FS.mount({
   mount: function() {
    var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
    node.node_ops = {
     lookup: function(parent, name) {
      var fd = +name;
      var stream = FS.getStream(fd);
      if (!stream) throw new FS.ErrnoError(9);
      var ret = {
       parent: null,
       mount: {
        mountpoint: "fake"
       },
       node_ops: {
        readlink: function() {
         return stream.path;
        }
       }
      };
      ret.parent = ret;
      return ret;
     }
    };
    return node;
   }
  }, {}, "/proc/self/fd");
 },
 createStandardStreams: function() {
  if (Module["stdin"]) {
   FS.createDevice("/dev", "stdin", Module["stdin"]);
  } else {
   FS.symlink("/dev/tty", "/dev/stdin");
  }
  if (Module["stdout"]) {
   FS.createDevice("/dev", "stdout", null, Module["stdout"]);
  } else {
   FS.symlink("/dev/tty", "/dev/stdout");
  }
  if (Module["stderr"]) {
   FS.createDevice("/dev", "stderr", null, Module["stderr"]);
  } else {
   FS.symlink("/dev/tty1", "/dev/stderr");
  }
  var stdin = FS.open("/dev/stdin", "r");
  assert(stdin.fd === 0, "invalid handle for stdin (" + stdin.fd + ")");
  var stdout = FS.open("/dev/stdout", "w");
  assert(stdout.fd === 1, "invalid handle for stdout (" + stdout.fd + ")");
  var stderr = FS.open("/dev/stderr", "w");
  assert(stderr.fd === 2, "invalid handle for stderr (" + stderr.fd + ")");
 },
 ensureErrnoError: function() {
  if (FS.ErrnoError) return;
  FS.ErrnoError = function ErrnoError(errno, node) {
   this.node = node;
   this.setErrno = function(errno) {
    this.errno = errno;
   };
   this.setErrno(errno);
   this.message = "FS error";
   if (this.stack) Object.defineProperty(this, "stack", {
    value: new Error().stack,
    writable: true
   });
  };
  FS.ErrnoError.prototype = new Error();
  FS.ErrnoError.prototype.constructor = FS.ErrnoError;
  [ 2 ].forEach(function(code) {
   FS.genericErrors[code] = new FS.ErrnoError(code);
   FS.genericErrors[code].stack = "<generic error, no stack>";
  });
 },
 staticInit: function() {
  FS.ensureErrnoError();
  FS.nameTable = new Array(4096);
  FS.mount(MEMFS, {}, "/");
  FS.createDefaultDirectories();
  FS.createDefaultDevices();
  FS.createSpecialDirectories();
  FS.filesystems = {
   "MEMFS": MEMFS,
   "IDBFS": IDBFS,
   "NODEFS": NODEFS,
   "WORKERFS": WORKERFS
  };
 },
 init: function(input, output, error) {
  assert(!FS.init.initialized, "FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");
  FS.init.initialized = true;
  FS.ensureErrnoError();
  Module["stdin"] = input || Module["stdin"];
  Module["stdout"] = output || Module["stdout"];
  Module["stderr"] = error || Module["stderr"];
  FS.createStandardStreams();
 },
 quit: function() {
  FS.init.initialized = false;
  var fflush = Module["_fflush"];
  if (fflush) fflush(0);
  for (var i = 0; i < FS.streams.length; i++) {
   var stream = FS.streams[i];
   if (!stream) {
    continue;
   }
   FS.close(stream);
  }
 },
 getMode: function(canRead, canWrite) {
  var mode = 0;
  if (canRead) mode |= 292 | 73;
  if (canWrite) mode |= 146;
  return mode;
 },
 joinPath: function(parts, forceRelative) {
  var path = PATH.join.apply(null, parts);
  if (forceRelative && path[0] == "/") path = path.substr(1);
  return path;
 },
 absolutePath: function(relative, base) {
  return PATH.resolve(base, relative);
 },
 standardizePath: function(path) {
  return PATH.normalize(path);
 },
 findObject: function(path, dontResolveLastLink) {
  var ret = FS.analyzePath(path, dontResolveLastLink);
  if (ret.exists) {
   return ret.object;
  } else {
   ___setErrNo(ret.error);
   return null;
  }
 },
 analyzePath: function(path, dontResolveLastLink) {
  try {
   var lookup = FS.lookupPath(path, {
    follow: !dontResolveLastLink
   });
   path = lookup.path;
  } catch (e) {}
  var ret = {
   isRoot: false,
   exists: false,
   error: 0,
   name: null,
   path: null,
   object: null,
   parentExists: false,
   parentPath: null,
   parentObject: null
  };
  try {
   var lookup = FS.lookupPath(path, {
    parent: true
   });
   ret.parentExists = true;
   ret.parentPath = lookup.path;
   ret.parentObject = lookup.node;
   ret.name = PATH.basename(path);
   lookup = FS.lookupPath(path, {
    follow: !dontResolveLastLink
   });
   ret.exists = true;
   ret.path = lookup.path;
   ret.object = lookup.node;
   ret.name = lookup.node.name;
   ret.isRoot = lookup.path === "/";
  } catch (e) {
   ret.error = e.errno;
  }
  return ret;
 },
 createFolder: function(parent, name, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(canRead, canWrite);
  return FS.mkdir(path, mode);
 },
 createPath: function(parent, path, canRead, canWrite) {
  parent = typeof parent === "string" ? parent : FS.getPath(parent);
  var parts = path.split("/").reverse();
  while (parts.length) {
   var part = parts.pop();
   if (!part) continue;
   var current = PATH.join2(parent, part);
   try {
    FS.mkdir(current);
   } catch (e) {}
   parent = current;
  }
  return current;
 },
 createFile: function(parent, name, properties, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(canRead, canWrite);
  return FS.create(path, mode);
 },
 createDataFile: function(parent, name, data, canRead, canWrite, canOwn) {
  var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
  var mode = FS.getMode(canRead, canWrite);
  var node = FS.create(path, mode);
  if (data) {
   if (typeof data === "string") {
    var arr = new Array(data.length);
    for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
    data = arr;
   }
   FS.chmod(node, mode | 146);
   var stream = FS.open(node, "w");
   FS.write(stream, data, 0, data.length, 0, canOwn);
   FS.close(stream);
   FS.chmod(node, mode);
  }
  return node;
 },
 createDevice: function(parent, name, input, output) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  var mode = FS.getMode(!!input, !!output);
  if (!FS.createDevice.major) FS.createDevice.major = 64;
  var dev = FS.makedev(FS.createDevice.major++, 0);
  FS.registerDevice(dev, {
   open: function(stream) {
    stream.seekable = false;
   },
   close: function(stream) {
    if (output && output.buffer && output.buffer.length) {
     output(10);
    }
   },
   read: function(stream, buffer, offset, length, pos) {
    var bytesRead = 0;
    for (var i = 0; i < length; i++) {
     var result;
     try {
      result = input();
     } catch (e) {
      throw new FS.ErrnoError(5);
     }
     if (result === undefined && bytesRead === 0) {
      throw new FS.ErrnoError(11);
     }
     if (result === null || result === undefined) break;
     bytesRead++;
     buffer[offset + i] = result;
    }
    if (bytesRead) {
     stream.node.timestamp = Date.now();
    }
    return bytesRead;
   },
   write: function(stream, buffer, offset, length, pos) {
    for (var i = 0; i < length; i++) {
     try {
      output(buffer[offset + i]);
     } catch (e) {
      throw new FS.ErrnoError(5);
     }
    }
    if (length) {
     stream.node.timestamp = Date.now();
    }
    return i;
   }
  });
  return FS.mkdev(path, mode, dev);
 },
 createLink: function(parent, name, target, canRead, canWrite) {
  var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
  return FS.symlink(target, path);
 },
 forceLoadFile: function(obj) {
  if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
  var success = true;
  if (typeof XMLHttpRequest !== "undefined") {
   throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.");
  } else if (Module["read"]) {
   try {
    obj.contents = intArrayFromString(Module["read"](obj.url), true);
    obj.usedBytes = obj.contents.length;
   } catch (e) {
    success = false;
   }
  } else {
   throw new Error("Cannot load without read() or XMLHttpRequest.");
  }
  if (!success) ___setErrNo(5);
  return success;
 },
 createLazyFile: function(parent, name, url, canRead, canWrite) {
  function LazyUint8Array() {
   this.lengthKnown = false;
   this.chunks = [];
  }
  LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
   if (idx > this.length - 1 || idx < 0) {
    return undefined;
   }
   var chunkOffset = idx % this.chunkSize;
   var chunkNum = idx / this.chunkSize | 0;
   return this.getter(chunkNum)[chunkOffset];
  };
  LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
   this.getter = getter;
  };
  LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
   var xhr = new XMLHttpRequest();
   xhr.open("HEAD", url, false);
   xhr.send(null);
   if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
   var datalength = Number(xhr.getResponseHeader("Content-length"));
   var header;
   var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
   var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
   var chunkSize = 1024 * 1024;
   if (!hasByteServing) chunkSize = datalength;
   var doXHR = function(from, to) {
    if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
    if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
    if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
    if (xhr.overrideMimeType) {
     xhr.overrideMimeType("text/plain; charset=x-user-defined");
    }
    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
    if (xhr.response !== undefined) {
     return new Uint8Array(xhr.response || []);
    } else {
     return intArrayFromString(xhr.responseText || "", true);
    }
   };
   var lazyArray = this;
   lazyArray.setDataGetter(function(chunkNum) {
    var start = chunkNum * chunkSize;
    var end = (chunkNum + 1) * chunkSize - 1;
    end = Math.min(end, datalength - 1);
    if (typeof lazyArray.chunks[chunkNum] === "undefined") {
     lazyArray.chunks[chunkNum] = doXHR(start, end);
    }
    if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
    return lazyArray.chunks[chunkNum];
   });
   if (usesGzip || !datalength) {
    chunkSize = datalength = 1;
    datalength = this.getter(0).length;
    chunkSize = datalength;
    console.log("LazyFiles on gzip forces download of the whole file when length is accessed");
   }
   this._length = datalength;
   this._chunkSize = chunkSize;
   this.lengthKnown = true;
  };
  if (typeof XMLHttpRequest !== "undefined") {
   if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
   var lazyArray = new LazyUint8Array();
   Object.defineProperties(lazyArray, {
    length: {
     get: function() {
      if (!this.lengthKnown) {
       this.cacheLength();
      }
      return this._length;
     }
    },
    chunkSize: {
     get: function() {
      if (!this.lengthKnown) {
       this.cacheLength();
      }
      return this._chunkSize;
     }
    }
   });
   var properties = {
    isDevice: false,
    contents: lazyArray
   };
  } else {
   var properties = {
    isDevice: false,
    url: url
   };
  }
  var node = FS.createFile(parent, name, properties, canRead, canWrite);
  if (properties.contents) {
   node.contents = properties.contents;
  } else if (properties.url) {
   node.contents = null;
   node.url = properties.url;
  }
  Object.defineProperties(node, {
   usedBytes: {
    get: function() {
     return this.contents.length;
    }
   }
  });
  var stream_ops = {};
  var keys = Object.keys(node.stream_ops);
  keys.forEach(function(key) {
   var fn = node.stream_ops[key];
   stream_ops[key] = function forceLoadLazyFile() {
    if (!FS.forceLoadFile(node)) {
     throw new FS.ErrnoError(5);
    }
    return fn.apply(null, arguments);
   };
  });
  stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
   if (!FS.forceLoadFile(node)) {
    throw new FS.ErrnoError(5);
   }
   var contents = stream.node.contents;
   if (position >= contents.length) return 0;
   var size = Math.min(contents.length - position, length);
   assert(size >= 0);
   if (contents.slice) {
    for (var i = 0; i < size; i++) {
     buffer[offset + i] = contents[position + i];
    }
   } else {
    for (var i = 0; i < size; i++) {
     buffer[offset + i] = contents.get(position + i);
    }
   }
   return size;
  };
  node.stream_ops = stream_ops;
  return node;
 },
 createPreloadedFile: function(parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
  Browser.init();
  var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
  var dep = getUniqueRunDependency("cp " + fullname);
  function processData(byteArray) {
   function finish(byteArray) {
    if (preFinish) preFinish();
    if (!dontCreateFile) {
     FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn);
    }
    if (onload) onload();
    removeRunDependency(dep);
   }
   var handled = false;
   Module["preloadPlugins"].forEach(function(plugin) {
    if (handled) return;
    if (plugin["canHandle"](fullname)) {
     plugin["handle"](byteArray, fullname, finish, function() {
      if (onerror) onerror();
      removeRunDependency(dep);
     });
     handled = true;
    }
   });
   if (!handled) finish(byteArray);
  }
  addRunDependency(dep);
  if (typeof url == "string") {
   Browser.asyncLoad(url, function(byteArray) {
    processData(byteArray);
   }, onerror);
  } else {
   processData(url);
  }
 },
 indexedDB: function() {
  return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
 },
 DB_NAME: function() {
  return "EM_FS_" + window.location.pathname;
 },
 DB_VERSION: 20,
 DB_STORE_NAME: "FILE_DATA",
 saveFilesToDB: function(paths, onload, onerror) {
  onload = onload || function() {};
  onerror = onerror || function() {};
  var indexedDB = FS.indexedDB();
  try {
   var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
  } catch (e) {
   return onerror(e);
  }
  openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
   console.log("creating db");
   var db = openRequest.result;
   db.createObjectStore(FS.DB_STORE_NAME);
  };
  openRequest.onsuccess = function openRequest_onsuccess() {
   var db = openRequest.result;
   var transaction = db.transaction([ FS.DB_STORE_NAME ], "readwrite");
   var files = transaction.objectStore(FS.DB_STORE_NAME);
   var ok = 0, fail = 0, total = paths.length;
   function finish() {
    if (fail == 0) onload(); else onerror();
   }
   paths.forEach(function(path) {
    var putRequest = files.put(FS.analyzePath(path).object.contents, path);
    putRequest.onsuccess = function putRequest_onsuccess() {
     ok++;
     if (ok + fail == total) finish();
    };
    putRequest.onerror = function putRequest_onerror() {
     fail++;
     if (ok + fail == total) finish();
    };
   });
   transaction.onerror = onerror;
  };
  openRequest.onerror = onerror;
 },
 loadFilesFromDB: function(paths, onload, onerror) {
  onload = onload || function() {};
  onerror = onerror || function() {};
  var indexedDB = FS.indexedDB();
  try {
   var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION);
  } catch (e) {
   return onerror(e);
  }
  openRequest.onupgradeneeded = onerror;
  openRequest.onsuccess = function openRequest_onsuccess() {
   var db = openRequest.result;
   try {
    var transaction = db.transaction([ FS.DB_STORE_NAME ], "readonly");
   } catch (e) {
    onerror(e);
    return;
   }
   var files = transaction.objectStore(FS.DB_STORE_NAME);
   var ok = 0, fail = 0, total = paths.length;
   function finish() {
    if (fail == 0) onload(); else onerror();
   }
   paths.forEach(function(path) {
    var getRequest = files.get(path);
    getRequest.onsuccess = function getRequest_onsuccess() {
     if (FS.analyzePath(path).exists) {
      FS.unlink(path);
     }
     FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
     ok++;
     if (ok + fail == total) finish();
    };
    getRequest.onerror = function getRequest_onerror() {
     fail++;
     if (ok + fail == total) finish();
    };
   });
   transaction.onerror = onerror;
  };
  openRequest.onerror = onerror;
 }
};

function _emscripten_set_main_loop_timing(mode, value) {
 Browser.mainLoop.timingMode = mode;
 Browser.mainLoop.timingValue = value;
 if (!Browser.mainLoop.func) {
  return 1;
 }
 if (mode == 0) {
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
   var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
   setTimeout(Browser.mainLoop.runner, timeUntilNextTick);
  };
  Browser.mainLoop.method = "timeout";
 } else if (mode == 1) {
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
   Browser.requestAnimationFrame(Browser.mainLoop.runner);
  };
  Browser.mainLoop.method = "rAF";
 } else if (mode == 2) {
  if (typeof setImmediate === "undefined") {
   var setImmediates = [];
   var emscriptenMainLoopMessageId = "setimmediate";
   var Browser_setImmediate_messageHandler = function(event) {
    if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
     event.stopPropagation();
     setImmediates.shift()();
    }
   };
   addEventListener("message", Browser_setImmediate_messageHandler, true);
   setImmediate = function Browser_emulated_setImmediate(func) {
    setImmediates.push(func);
    if (ENVIRONMENT_IS_WORKER) {
     if (Module["setImmediates"] === undefined) Module["setImmediates"] = [];
     Module["setImmediates"].push(func);
     postMessage({
      target: emscriptenMainLoopMessageId
     });
    } else postMessage(emscriptenMainLoopMessageId, "*");
   };
  }
  Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
   setImmediate(Browser.mainLoop.runner);
  };
  Browser.mainLoop.method = "immediate";
 }
 return 0;
}

function _emscripten_get_now() {
 abort();
}

function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
 Module["noExitRuntime"] = true;
 assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
 Browser.mainLoop.func = func;
 Browser.mainLoop.arg = arg;
 var browserIterationFunc;
 if (typeof arg !== "undefined") {
  browserIterationFunc = function() {
   Module["dynCall_vi"](func, arg);
  };
 } else {
  browserIterationFunc = function() {
   Module["dynCall_v"](func);
  };
 }
 var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
 Browser.mainLoop.runner = function Browser_mainLoop_runner() {
  if (ABORT) return;
  if (Browser.mainLoop.queue.length > 0) {
   var start = Date.now();
   var blocker = Browser.mainLoop.queue.shift();
   blocker.func(blocker.arg);
   if (Browser.mainLoop.remainingBlockers) {
    var remaining = Browser.mainLoop.remainingBlockers;
    var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
    if (blocker.counted) {
     Browser.mainLoop.remainingBlockers = next;
    } else {
     next = next + .5;
     Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9;
    }
   }
   console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
   Browser.mainLoop.updateStatus();
   if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
   setTimeout(Browser.mainLoop.runner, 0);
   return;
  }
  if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
  if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
   Browser.mainLoop.scheduler();
   return;
  } else if (Browser.mainLoop.timingMode == 0) {
   Browser.mainLoop.tickStartTime = _emscripten_get_now();
  }
  if (Browser.mainLoop.method === "timeout" && Module.ctx) {
   err("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
   Browser.mainLoop.method = "";
  }
  Browser.mainLoop.runIter(browserIterationFunc);
  if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
  if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
  Browser.mainLoop.scheduler();
 };
 if (!noSetTiming) {
  if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps); else _emscripten_set_main_loop_timing(1, 1);
  Browser.mainLoop.scheduler();
 }
 if (simulateInfiniteLoop) {
  throw "SimulateInfiniteLoop";
 }
}

var Browser = {
 mainLoop: {
  scheduler: null,
  method: "",
  currentlyRunningMainloop: 0,
  func: null,
  arg: 0,
  timingMode: 0,
  timingValue: 0,
  currentFrameNumber: 0,
  queue: [],
  pause: function() {
   Browser.mainLoop.scheduler = null;
   Browser.mainLoop.currentlyRunningMainloop++;
  },
  resume: function() {
   Browser.mainLoop.currentlyRunningMainloop++;
   var timingMode = Browser.mainLoop.timingMode;
   var timingValue = Browser.mainLoop.timingValue;
   var func = Browser.mainLoop.func;
   Browser.mainLoop.func = null;
   _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
   _emscripten_set_main_loop_timing(timingMode, timingValue);
   Browser.mainLoop.scheduler();
  },
  updateStatus: function() {
   if (Module["setStatus"]) {
    var message = Module["statusMessage"] || "Please wait...";
    var remaining = Browser.mainLoop.remainingBlockers;
    var expected = Browser.mainLoop.expectedBlockers;
    if (remaining) {
     if (remaining < expected) {
      Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")");
     } else {
      Module["setStatus"](message);
     }
    } else {
     Module["setStatus"]("");
    }
   }
  },
  runIter: function(func) {
   if (ABORT) return;
   if (Module["preMainLoop"]) {
    var preRet = Module["preMainLoop"]();
    if (preRet === false) {
     return;
    }
   }
   try {
    func();
   } catch (e) {
    if (e instanceof ExitStatus) {
     return;
    } else {
     if (e && typeof e === "object" && e.stack) err("exception thrown: " + [ e, e.stack ]);
     throw e;
    }
   }
   if (Module["postMainLoop"]) Module["postMainLoop"]();
  }
 },
 isFullscreen: false,
 pointerLock: false,
 moduleContextCreatedCallbacks: [],
 workers: [],
 init: function() {
  if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
  if (Browser.initted) return;
  Browser.initted = true;
  try {
   new Blob();
   Browser.hasBlobConstructor = true;
  } catch (e) {
   Browser.hasBlobConstructor = false;
   console.log("warning: no blob constructor, cannot create blobs with mimetypes");
  }
  Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
  Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
  if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
   console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
   Module.noImageDecoding = true;
  }
  var imagePlugin = {};
  imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
   return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name);
  };
  imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
   var b = null;
   if (Browser.hasBlobConstructor) {
    try {
     b = new Blob([ byteArray ], {
      type: Browser.getMimetype(name)
     });
     if (b.size !== byteArray.length) {
      b = new Blob([ new Uint8Array(byteArray).buffer ], {
       type: Browser.getMimetype(name)
      });
     }
    } catch (e) {
     warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder");
    }
   }
   if (!b) {
    var bb = new Browser.BlobBuilder();
    bb.append(new Uint8Array(byteArray).buffer);
    b = bb.getBlob();
   }
   var url = Browser.URLObject.createObjectURL(b);
   var img = new Image();
   img.onload = function img_onload() {
    assert(img.complete, "Image " + name + " could not be decoded");
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    Module["preloadedImages"][name] = canvas;
    Browser.URLObject.revokeObjectURL(url);
    if (onload) onload(byteArray);
   };
   img.onerror = function img_onerror(event) {
    console.log("Image " + url + " could not be decoded");
    if (onerror) onerror();
   };
   img.src = url;
  };
  Module["preloadPlugins"].push(imagePlugin);
  var audioPlugin = {};
  audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
   return !Module.noAudioDecoding && name.substr(-4) in {
    ".ogg": 1,
    ".wav": 1,
    ".mp3": 1
   };
  };
  audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
   var done = false;
   function finish(audio) {
    if (done) return;
    done = true;
    Module["preloadedAudios"][name] = audio;
    if (onload) onload(byteArray);
   }
   function fail() {
    if (done) return;
    done = true;
    Module["preloadedAudios"][name] = new Audio();
    if (onerror) onerror();
   }
   if (Browser.hasBlobConstructor) {
    try {
     var b = new Blob([ byteArray ], {
      type: Browser.getMimetype(name)
     });
    } catch (e) {
     return fail();
    }
    var url = Browser.URLObject.createObjectURL(b);
    var audio = new Audio();
    audio.addEventListener("canplaythrough", function() {
     finish(audio);
    }, false);
    audio.onerror = function audio_onerror(event) {
     if (done) return;
     console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");
     function encode64(data) {
      var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var PAD = "=";
      var ret = "";
      var leftchar = 0;
      var leftbits = 0;
      for (var i = 0; i < data.length; i++) {
       leftchar = leftchar << 8 | data[i];
       leftbits += 8;
       while (leftbits >= 6) {
        var curr = leftchar >> leftbits - 6 & 63;
        leftbits -= 6;
        ret += BASE[curr];
       }
      }
      if (leftbits == 2) {
       ret += BASE[(leftchar & 3) << 4];
       ret += PAD + PAD;
      } else if (leftbits == 4) {
       ret += BASE[(leftchar & 15) << 2];
       ret += PAD;
      }
      return ret;
     }
     audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
     finish(audio);
    };
    audio.src = url;
    Browser.safeSetTimeout(function() {
     finish(audio);
    }, 1e4);
   } else {
    return fail();
   }
  };
  Module["preloadPlugins"].push(audioPlugin);
  function pointerLockChange() {
   Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"];
  }
  var canvas = Module["canvas"];
  if (canvas) {
   canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || function() {};
   canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || function() {};
   canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
   document.addEventListener("pointerlockchange", pointerLockChange, false);
   document.addEventListener("mozpointerlockchange", pointerLockChange, false);
   document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
   document.addEventListener("mspointerlockchange", pointerLockChange, false);
   if (Module["elementPointerLock"]) {
    canvas.addEventListener("click", function(ev) {
     if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
      Module["canvas"].requestPointerLock();
      ev.preventDefault();
     }
    }, false);
   }
  }
 },
 createContext: function(canvas, useWebGL, setInModule, webGLContextAttributes) {
  if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
  var ctx;
  var contextHandle;
  if (useWebGL) {
   var contextAttributes = {
    antialias: false,
    alpha: false,
    majorVersion: 1
   };
   if (webGLContextAttributes) {
    for (var attribute in webGLContextAttributes) {
     contextAttributes[attribute] = webGLContextAttributes[attribute];
    }
   }
   if (typeof GL !== "undefined") {
    contextHandle = GL.createContext(canvas, contextAttributes);
    if (contextHandle) {
     ctx = GL.getContext(contextHandle).GLctx;
    }
   }
  } else {
   ctx = canvas.getContext("2d");
  }
  if (!ctx) return null;
  if (setInModule) {
   if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
   Module.ctx = ctx;
   if (useWebGL) GL.makeContextCurrent(contextHandle);
   Module.useWebGL = useWebGL;
   Browser.moduleContextCreatedCallbacks.forEach(function(callback) {
    callback();
   });
   Browser.init();
  }
  return ctx;
 },
 destroyContext: function(canvas, useWebGL, setInModule) {},
 fullscreenHandlersInstalled: false,
 lockPointer: undefined,
 resizeCanvas: undefined,
 requestFullscreen: function(lockPointer, resizeCanvas, vrDevice) {
  Browser.lockPointer = lockPointer;
  Browser.resizeCanvas = resizeCanvas;
  Browser.vrDevice = vrDevice;
  if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
  if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
  if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
  var canvas = Module["canvas"];
  function fullscreenChange() {
   Browser.isFullscreen = false;
   var canvasContainer = canvas.parentNode;
   if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
    canvas.exitFullscreen = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || function() {};
    canvas.exitFullscreen = canvas.exitFullscreen.bind(document);
    if (Browser.lockPointer) canvas.requestPointerLock();
    Browser.isFullscreen = true;
    if (Browser.resizeCanvas) {
     Browser.setFullscreenCanvasSize();
    } else {
     Browser.updateCanvasDimensions(canvas);
    }
   } else {
    canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
    canvasContainer.parentNode.removeChild(canvasContainer);
    if (Browser.resizeCanvas) {
     Browser.setWindowedCanvasSize();
    } else {
     Browser.updateCanvasDimensions(canvas);
    }
   }
   if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullscreen);
   if (Module["onFullscreen"]) Module["onFullscreen"](Browser.isFullscreen);
  }
  if (!Browser.fullscreenHandlersInstalled) {
   Browser.fullscreenHandlersInstalled = true;
   document.addEventListener("fullscreenchange", fullscreenChange, false);
   document.addEventListener("mozfullscreenchange", fullscreenChange, false);
   document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
   document.addEventListener("MSFullscreenChange", fullscreenChange, false);
  }
  var canvasContainer = document.createElement("div");
  canvas.parentNode.insertBefore(canvasContainer, canvas);
  canvasContainer.appendChild(canvas);
  canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? function() {
   canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"]);
  } : null) || (canvasContainer["webkitRequestFullScreen"] ? function() {
   canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"]);
  } : null);
  if (vrDevice) {
   canvasContainer.requestFullscreen({
    vrDisplay: vrDevice
   });
  } else {
   canvasContainer.requestFullscreen();
  }
 },
 requestFullScreen: function(lockPointer, resizeCanvas, vrDevice) {
  err("Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.");
  Browser.requestFullScreen = function(lockPointer, resizeCanvas, vrDevice) {
   return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
  };
  return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
 },
 nextRAF: 0,
 fakeRequestAnimationFrame: function(func) {
  var now = Date.now();
  if (Browser.nextRAF === 0) {
   Browser.nextRAF = now + 1e3 / 60;
  } else {
   while (now + 2 >= Browser.nextRAF) {
    Browser.nextRAF += 1e3 / 60;
   }
  }
  var delay = Math.max(Browser.nextRAF - now, 0);
  setTimeout(func, delay);
 },
 requestAnimationFrame: function requestAnimationFrame(func) {
  if (typeof window === "undefined") {
   Browser.fakeRequestAnimationFrame(func);
  } else {
   if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame;
   }
   window.requestAnimationFrame(func);
  }
 },
 safeCallback: function(func) {
  return function() {
   if (!ABORT) return func.apply(null, arguments);
  };
 },
 allowAsyncCallbacks: true,
 queuedAsyncCallbacks: [],
 pauseAsyncCallbacks: function() {
  Browser.allowAsyncCallbacks = false;
 },
 resumeAsyncCallbacks: function() {
  Browser.allowAsyncCallbacks = true;
  if (Browser.queuedAsyncCallbacks.length > 0) {
   var callbacks = Browser.queuedAsyncCallbacks;
   Browser.queuedAsyncCallbacks = [];
   callbacks.forEach(function(func) {
    func();
   });
  }
 },
 safeRequestAnimationFrame: function(func) {
  return Browser.requestAnimationFrame(function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   } else {
    Browser.queuedAsyncCallbacks.push(func);
   }
  });
 },
 safeSetTimeout: function(func, timeout) {
  Module["noExitRuntime"] = true;
  return setTimeout(function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   } else {
    Browser.queuedAsyncCallbacks.push(func);
   }
  }, timeout);
 },
 safeSetInterval: function(func, timeout) {
  Module["noExitRuntime"] = true;
  return setInterval(function() {
   if (ABORT) return;
   if (Browser.allowAsyncCallbacks) {
    func();
   }
  }, timeout);
 },
 getMimetype: function(name) {
  return {
   "jpg": "image/jpeg",
   "jpeg": "image/jpeg",
   "png": "image/png",
   "bmp": "image/bmp",
   "ogg": "audio/ogg",
   "wav": "audio/wav",
   "mp3": "audio/mpeg"
  }[name.substr(name.lastIndexOf(".") + 1)];
 },
 getUserMedia: function(func) {
  if (!window.getUserMedia) {
   window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"];
  }
  window.getUserMedia(func);
 },
 getMovementX: function(event) {
  return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0;
 },
 getMovementY: function(event) {
  return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0;
 },
 getMouseWheelDelta: function(event) {
  var delta = 0;
  switch (event.type) {
  case "DOMMouseScroll":
   delta = event.detail;
   break;

  case "mousewheel":
   delta = event.wheelDelta;
   break;

  case "wheel":
   delta = event["deltaY"];
   break;

  default:
   throw "unrecognized mouse wheel event: " + event.type;
  }
  return delta;
 },
 mouseX: 0,
 mouseY: 0,
 mouseMovementX: 0,
 mouseMovementY: 0,
 touches: {},
 lastTouches: {},
 calculateMouseEvent: function(event) {
  if (Browser.pointerLock) {
   if (event.type != "mousemove" && "mozMovementX" in event) {
    Browser.mouseMovementX = Browser.mouseMovementY = 0;
   } else {
    Browser.mouseMovementX = Browser.getMovementX(event);
    Browser.mouseMovementY = Browser.getMovementY(event);
   }
   if (typeof SDL != "undefined") {
    Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
    Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
   } else {
    Browser.mouseX += Browser.mouseMovementX;
    Browser.mouseY += Browser.mouseMovementY;
   }
  } else {
   var rect = Module["canvas"].getBoundingClientRect();
   var cw = Module["canvas"].width;
   var ch = Module["canvas"].height;
   var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
   var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
   if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
    var touch = event.touch;
    if (touch === undefined) {
     return;
    }
    var adjustedX = touch.pageX - (scrollX + rect.left);
    var adjustedY = touch.pageY - (scrollY + rect.top);
    adjustedX = adjustedX * (cw / rect.width);
    adjustedY = adjustedY * (ch / rect.height);
    var coords = {
     x: adjustedX,
     y: adjustedY
    };
    if (event.type === "touchstart") {
     Browser.lastTouches[touch.identifier] = coords;
     Browser.touches[touch.identifier] = coords;
    } else if (event.type === "touchend" || event.type === "touchmove") {
     var last = Browser.touches[touch.identifier];
     if (!last) last = coords;
     Browser.lastTouches[touch.identifier] = last;
     Browser.touches[touch.identifier] = coords;
    }
    return;
   }
   var x = event.pageX - (scrollX + rect.left);
   var y = event.pageY - (scrollY + rect.top);
   x = x * (cw / rect.width);
   y = y * (ch / rect.height);
   Browser.mouseMovementX = x - Browser.mouseX;
   Browser.mouseMovementY = y - Browser.mouseY;
   Browser.mouseX = x;
   Browser.mouseY = y;
  }
 },
 asyncLoad: function(url, onload, onerror, noRunDep) {
  var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
  Module["readAsync"](url, function(arrayBuffer) {
   assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
   onload(new Uint8Array(arrayBuffer));
   if (dep) removeRunDependency(dep);
  }, function(event) {
   if (onerror) {
    onerror();
   } else {
    throw 'Loading data file "' + url + '" failed.';
   }
  });
  if (dep) addRunDependency(dep);
 },
 resizeListeners: [],
 updateResizeListeners: function() {
  var canvas = Module["canvas"];
  Browser.resizeListeners.forEach(function(listener) {
   listener(canvas.width, canvas.height);
  });
 },
 setCanvasSize: function(width, height, noUpdates) {
  var canvas = Module["canvas"];
  Browser.updateCanvasDimensions(canvas, width, height);
  if (!noUpdates) Browser.updateResizeListeners();
 },
 windowedWidth: 0,
 windowedHeight: 0,
 setFullscreenCanvasSize: function() {
  if (typeof SDL != "undefined") {
   var flags = HEAPU32[SDL.screen >> 2];
   flags = flags | 8388608;
   HEAP32[SDL.screen >> 2] = flags;
  }
  Browser.updateCanvasDimensions(Module["canvas"]);
  Browser.updateResizeListeners();
 },
 setWindowedCanvasSize: function() {
  if (typeof SDL != "undefined") {
   var flags = HEAPU32[SDL.screen >> 2];
   flags = flags & ~8388608;
   HEAP32[SDL.screen >> 2] = flags;
  }
  Browser.updateCanvasDimensions(Module["canvas"]);
  Browser.updateResizeListeners();
 },
 updateCanvasDimensions: function(canvas, wNative, hNative) {
  if (wNative && hNative) {
   canvas.widthNative = wNative;
   canvas.heightNative = hNative;
  } else {
   wNative = canvas.widthNative;
   hNative = canvas.heightNative;
  }
  var w = wNative;
  var h = hNative;
  if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
   if (w / h < Module["forcedAspectRatio"]) {
    w = Math.round(h * Module["forcedAspectRatio"]);
   } else {
    h = Math.round(w / Module["forcedAspectRatio"]);
   }
  }
  if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
   var factor = Math.min(screen.width / w, screen.height / h);
   w = Math.round(w * factor);
   h = Math.round(h * factor);
  }
  if (Browser.resizeCanvas) {
   if (canvas.width != w) canvas.width = w;
   if (canvas.height != h) canvas.height = h;
   if (typeof canvas.style != "undefined") {
    canvas.style.removeProperty("width");
    canvas.style.removeProperty("height");
   }
  } else {
   if (canvas.width != wNative) canvas.width = wNative;
   if (canvas.height != hNative) canvas.height = hNative;
   if (typeof canvas.style != "undefined") {
    if (w != wNative || h != hNative) {
     canvas.style.setProperty("width", w + "px", "important");
     canvas.style.setProperty("height", h + "px", "important");
    } else {
     canvas.style.removeProperty("width");
     canvas.style.removeProperty("height");
    }
   }
  }
 },
 wgetRequests: {},
 nextWgetRequestHandle: 0,
 getNextWgetRequestHandle: function() {
  var handle = Browser.nextWgetRequestHandle;
  Browser.nextWgetRequestHandle++;
  return handle;
 }
};

function _SDL_GetTicks() {
 return Date.now() - SDL.startTime | 0;
}

function _SDL_LockSurface(surf) {
 var surfData = SDL.surfaces[surf];
 surfData.locked++;
 if (surfData.locked > 1) return 0;
 if (!surfData.buffer) {
  surfData.buffer = _malloc(surfData.width * surfData.height * 4);
  HEAP32[surf + 20 >> 2] = surfData.buffer;
 }
 HEAP32[surf + 20 >> 2] = surfData.buffer;
 if (surf == SDL.screen && Module.screenIsReadOnly && surfData.image) return 0;
 if (SDL.defaults.discardOnLock) {
  if (!surfData.image) {
   surfData.image = surfData.ctx.createImageData(surfData.width, surfData.height);
  }
  if (!SDL.defaults.opaqueFrontBuffer) return;
 } else {
  surfData.image = surfData.ctx.getImageData(0, 0, surfData.width, surfData.height);
 }
 if (surf == SDL.screen && SDL.defaults.opaqueFrontBuffer) {
  var data = surfData.image.data;
  var num = data.length;
  for (var i = 0; i < num / 4; i++) {
   data[i * 4 + 3] = 255;
  }
 }
 if (SDL.defaults.copyOnLock && !SDL.defaults.discardOnLock) {
  if (surfData.isFlagSet(2097152)) {
   throw "CopyOnLock is not supported for SDL_LockSurface with SDL_HWPALETTE flag set" + new Error().stack;
  } else {
   HEAPU8.set(surfData.image.data, surfData.buffer);
  }
 }
 return 0;
}

var SDL = {
 defaults: {
  width: 320,
  height: 200,
  copyOnLock: true,
  discardOnLock: false,
  opaqueFrontBuffer: true
 },
 version: null,
 surfaces: {},
 canvasPool: [],
 events: [],
 fonts: [ null ],
 audios: [ null ],
 rwops: [ null ],
 music: {
  audio: null,
  volume: 1
 },
 mixerFrequency: 22050,
 mixerFormat: 32784,
 mixerNumChannels: 2,
 mixerChunkSize: 1024,
 channelMinimumNumber: 0,
 GL: false,
 glAttributes: {
  0: 3,
  1: 3,
  2: 2,
  3: 0,
  4: 0,
  5: 1,
  6: 16,
  7: 0,
  8: 0,
  9: 0,
  10: 0,
  11: 0,
  12: 0,
  13: 0,
  14: 0,
  15: 1,
  16: 0,
  17: 0,
  18: 0
 },
 keyboardState: null,
 keyboardMap: {},
 canRequestFullscreen: false,
 isRequestingFullscreen: false,
 textInput: false,
 startTime: null,
 initFlags: 0,
 buttonState: 0,
 modState: 0,
 DOMButtons: [ 0, 0, 0 ],
 DOMEventToSDLEvent: {},
 TOUCH_DEFAULT_ID: 0,
 eventHandler: null,
 eventHandlerContext: null,
 eventHandlerTemp: 0,
 keyCodes: {
  16: 1249,
  17: 1248,
  18: 1250,
  20: 1081,
  33: 1099,
  34: 1102,
  35: 1101,
  36: 1098,
  37: 1104,
  38: 1106,
  39: 1103,
  40: 1105,
  44: 316,
  45: 1097,
  46: 127,
  91: 1251,
  93: 1125,
  96: 1122,
  97: 1113,
  98: 1114,
  99: 1115,
  100: 1116,
  101: 1117,
  102: 1118,
  103: 1119,
  104: 1120,
  105: 1121,
  106: 1109,
  107: 1111,
  109: 1110,
  110: 1123,
  111: 1108,
  112: 1082,
  113: 1083,
  114: 1084,
  115: 1085,
  116: 1086,
  117: 1087,
  118: 1088,
  119: 1089,
  120: 1090,
  121: 1091,
  122: 1092,
  123: 1093,
  124: 1128,
  125: 1129,
  126: 1130,
  127: 1131,
  128: 1132,
  129: 1133,
  130: 1134,
  131: 1135,
  132: 1136,
  133: 1137,
  134: 1138,
  135: 1139,
  144: 1107,
  160: 94,
  161: 33,
  162: 34,
  163: 35,
  164: 36,
  165: 37,
  166: 38,
  167: 95,
  168: 40,
  169: 41,
  170: 42,
  171: 43,
  172: 124,
  173: 45,
  174: 123,
  175: 125,
  176: 126,
  181: 127,
  182: 129,
  183: 128,
  188: 44,
  190: 46,
  191: 47,
  192: 96,
  219: 91,
  220: 92,
  221: 93,
  222: 39,
  224: 1251
 },
 scanCodes: {
  8: 42,
  9: 43,
  13: 40,
  27: 41,
  32: 44,
  35: 204,
  39: 53,
  44: 54,
  46: 55,
  47: 56,
  48: 39,
  49: 30,
  50: 31,
  51: 32,
  52: 33,
  53: 34,
  54: 35,
  55: 36,
  56: 37,
  57: 38,
  58: 203,
  59: 51,
  61: 46,
  91: 47,
  92: 49,
  93: 48,
  96: 52,
  97: 4,
  98: 5,
  99: 6,
  100: 7,
  101: 8,
  102: 9,
  103: 10,
  104: 11,
  105: 12,
  106: 13,
  107: 14,
  108: 15,
  109: 16,
  110: 17,
  111: 18,
  112: 19,
  113: 20,
  114: 21,
  115: 22,
  116: 23,
  117: 24,
  118: 25,
  119: 26,
  120: 27,
  121: 28,
  122: 29,
  127: 76,
  305: 224,
  308: 226,
  316: 70
 },
 loadRect: function(rect) {
  return {
   x: HEAP32[rect + 0 >> 2],
   y: HEAP32[rect + 4 >> 2],
   w: HEAP32[rect + 8 >> 2],
   h: HEAP32[rect + 12 >> 2]
  };
 },
 updateRect: function(rect, r) {
  HEAP32[rect >> 2] = r.x;
  HEAP32[rect + 4 >> 2] = r.y;
  HEAP32[rect + 8 >> 2] = r.w;
  HEAP32[rect + 12 >> 2] = r.h;
 },
 intersectionOfRects: function(first, second) {
  var leftX = Math.max(first.x, second.x);
  var leftY = Math.max(first.y, second.y);
  var rightX = Math.min(first.x + first.w, second.x + second.w);
  var rightY = Math.min(first.y + first.h, second.y + second.h);
  return {
   x: leftX,
   y: leftY,
   w: Math.max(leftX, rightX) - leftX,
   h: Math.max(leftY, rightY) - leftY
  };
 },
 checkPixelFormat: function(fmt) {},
 loadColorToCSSRGB: function(color) {
  var rgba = HEAP32[color >> 2];
  return "rgb(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + ")";
 },
 loadColorToCSSRGBA: function(color) {
  var rgba = HEAP32[color >> 2];
  return "rgba(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + "," + (rgba >> 24 & 255) / 255 + ")";
 },
 translateColorToCSSRGBA: function(rgba) {
  return "rgba(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + "," + (rgba >>> 24) / 255 + ")";
 },
 translateRGBAToCSSRGBA: function(r, g, b, a) {
  return "rgba(" + (r & 255) + "," + (g & 255) + "," + (b & 255) + "," + (a & 255) / 255 + ")";
 },
 translateRGBAToColor: function(r, g, b, a) {
  return r | g << 8 | b << 16 | a << 24;
 },
 makeSurface: function(width, height, flags, usePageCanvas, source, rmask, gmask, bmask, amask) {
  flags = flags || 0;
  var is_SDL_HWSURFACE = flags & 1;
  var is_SDL_HWPALETTE = flags & 2097152;
  var is_SDL_OPENGL = flags & 67108864;
  var surf = _malloc(60);
  var pixelFormat = _malloc(44);
  var bpp = is_SDL_HWPALETTE ? 1 : 4;
  var buffer = 0;
  if (!is_SDL_HWSURFACE && !is_SDL_OPENGL) {
   buffer = _malloc(width * height * 4);
  }
  HEAP32[surf >> 2] = flags;
  HEAP32[surf + 4 >> 2] = pixelFormat;
  HEAP32[surf + 8 >> 2] = width;
  HEAP32[surf + 12 >> 2] = height;
  HEAP32[surf + 16 >> 2] = width * bpp;
  HEAP32[surf + 20 >> 2] = buffer;
  HEAP32[surf + 36 >> 2] = 0;
  HEAP32[surf + 40 >> 2] = 0;
  HEAP32[surf + 44 >> 2] = Module["canvas"].width;
  HEAP32[surf + 48 >> 2] = Module["canvas"].height;
  HEAP32[surf + 56 >> 2] = 1;
  HEAP32[pixelFormat >> 2] = -2042224636;
  HEAP32[pixelFormat + 4 >> 2] = 0;
  HEAP8[pixelFormat + 8 >> 0] = bpp * 8;
  HEAP8[pixelFormat + 9 >> 0] = bpp;
  HEAP32[pixelFormat + 12 >> 2] = rmask || 255;
  HEAP32[pixelFormat + 16 >> 2] = gmask || 65280;
  HEAP32[pixelFormat + 20 >> 2] = bmask || 16711680;
  HEAP32[pixelFormat + 24 >> 2] = amask || 4278190080;
  SDL.GL = SDL.GL || is_SDL_OPENGL;
  var canvas;
  if (!usePageCanvas) {
   if (SDL.canvasPool.length > 0) {
    canvas = SDL.canvasPool.pop();
   } else {
    canvas = document.createElement("canvas");
   }
   canvas.width = width;
   canvas.height = height;
  } else {
   canvas = Module["canvas"];
  }
  var webGLContextAttributes = {
   antialias: SDL.glAttributes[13] != 0 && SDL.glAttributes[14] > 1,
   depth: SDL.glAttributes[6] > 0,
   stencil: SDL.glAttributes[7] > 0,
   alpha: SDL.glAttributes[3] > 0
  };
  var ctx = Browser.createContext(canvas, is_SDL_OPENGL, usePageCanvas, webGLContextAttributes);
  SDL.surfaces[surf] = {
   width: width,
   height: height,
   canvas: canvas,
   ctx: ctx,
   surf: surf,
   buffer: buffer,
   pixelFormat: pixelFormat,
   alpha: 255,
   flags: flags,
   locked: 0,
   usePageCanvas: usePageCanvas,
   source: source,
   isFlagSet: function(flag) {
    return flags & flag;
   }
  };
  return surf;
 },
 copyIndexedColorData: function(surfData, rX, rY, rW, rH) {
  if (!surfData.colors) {
   return;
  }
  var fullWidth = Module["canvas"].width;
  var fullHeight = Module["canvas"].height;
  var startX = rX || 0;
  var startY = rY || 0;
  var endX = (rW || fullWidth - startX) + startX;
  var endY = (rH || fullHeight - startY) + startY;
  var buffer = surfData.buffer;
  if (!surfData.image.data32) {
   surfData.image.data32 = new Uint32Array(surfData.image.data.buffer);
  }
  var data32 = surfData.image.data32;
  var colors32 = surfData.colors32;
  for (var y = startY; y < endY; ++y) {
   var base = y * fullWidth;
   for (var x = startX; x < endX; ++x) {
    data32[base + x] = colors32[HEAPU8[buffer + base + x >> 0]];
   }
  }
 },
 freeSurface: function(surf) {
  var refcountPointer = surf + 56;
  var refcount = HEAP32[refcountPointer >> 2];
  if (refcount > 1) {
   HEAP32[refcountPointer >> 2] = refcount - 1;
   return;
  }
  var info = SDL.surfaces[surf];
  if (!info.usePageCanvas && info.canvas) SDL.canvasPool.push(info.canvas);
  if (info.buffer) _free(info.buffer);
  _free(info.pixelFormat);
  _free(surf);
  SDL.surfaces[surf] = null;
  if (surf === SDL.screen) {
   SDL.screen = null;
  }
 },
 blitSurface: function(src, srcrect, dst, dstrect, scale) {
  var srcData = SDL.surfaces[src];
  var dstData = SDL.surfaces[dst];
  var sr, dr;
  if (srcrect) {
   sr = SDL.loadRect(srcrect);
  } else {
   sr = {
    x: 0,
    y: 0,
    w: srcData.width,
    h: srcData.height
   };
  }
  if (dstrect) {
   dr = SDL.loadRect(dstrect);
  } else {
   dr = {
    x: 0,
    y: 0,
    w: srcData.width,
    h: srcData.height
   };
  }
  if (dstData.clipRect) {
   var widthScale = !scale || sr.w === 0 ? 1 : sr.w / dr.w;
   var heightScale = !scale || sr.h === 0 ? 1 : sr.h / dr.h;
   dr = SDL.intersectionOfRects(dstData.clipRect, dr);
   sr.w = dr.w * widthScale;
   sr.h = dr.h * heightScale;
   if (dstrect) {
    SDL.updateRect(dstrect, dr);
   }
  }
  var blitw, blith;
  if (scale) {
   blitw = dr.w;
   blith = dr.h;
  } else {
   blitw = sr.w;
   blith = sr.h;
  }
  if (sr.w === 0 || sr.h === 0 || blitw === 0 || blith === 0) {
   return 0;
  }
  var oldAlpha = dstData.ctx.globalAlpha;
  dstData.ctx.globalAlpha = srcData.alpha / 255;
  dstData.ctx.drawImage(srcData.canvas, sr.x, sr.y, sr.w, sr.h, dr.x, dr.y, blitw, blith);
  dstData.ctx.globalAlpha = oldAlpha;
  if (dst != SDL.screen) {
   warnOnce("WARNING: copying canvas data to memory for compatibility");
   _SDL_LockSurface(dst);
   dstData.locked--;
  }
  return 0;
 },
 downFingers: {},
 savedKeydown: null,
 receiveEvent: function(event) {
  function unpressAllPressedKeys() {
   for (var code in SDL.keyboardMap) {
    SDL.events.push({
     type: "keyup",
     keyCode: SDL.keyboardMap[code]
    });
   }
  }
  switch (event.type) {
  case "touchstart":
  case "touchmove":
   {
    event.preventDefault();
    var touches = [];
    if (event.type === "touchstart") {
     for (var i = 0; i < event.touches.length; i++) {
      var touch = event.touches[i];
      if (SDL.downFingers[touch.identifier] != true) {
       SDL.downFingers[touch.identifier] = true;
       touches.push(touch);
      }
     }
    } else {
     touches = event.touches;
    }
    var firstTouch = touches[0];
    if (firstTouch) {
     if (event.type == "touchstart") {
      SDL.DOMButtons[0] = 1;
     }
     var mouseEventType;
     switch (event.type) {
     case "touchstart":
      mouseEventType = "mousedown";
      break;

     case "touchmove":
      mouseEventType = "mousemove";
      break;
     }
     var mouseEvent = {
      type: mouseEventType,
      button: 0,
      pageX: firstTouch.clientX,
      pageY: firstTouch.clientY
     };
     SDL.events.push(mouseEvent);
    }
    for (var i = 0; i < touches.length; i++) {
     var touch = touches[i];
     SDL.events.push({
      type: event.type,
      touch: touch
     });
    }
    break;
   }

  case "touchend":
   {
    event.preventDefault();
    for (var i = 0; i < event.changedTouches.length; i++) {
     var touch = event.changedTouches[i];
     if (SDL.downFingers[touch.identifier] === true) {
      delete SDL.downFingers[touch.identifier];
     }
    }
    var mouseEvent = {
     type: "mouseup",
     button: 0,
     pageX: event.changedTouches[0].clientX,
     pageY: event.changedTouches[0].clientY
    };
    SDL.DOMButtons[0] = 0;
    SDL.events.push(mouseEvent);
    for (var i = 0; i < event.changedTouches.length; i++) {
     var touch = event.changedTouches[i];
     SDL.events.push({
      type: "touchend",
      touch: touch
     });
    }
    break;
   }

  case "DOMMouseScroll":
  case "mousewheel":
  case "wheel":
   var delta = -Browser.getMouseWheelDelta(event);
   delta = delta == 0 ? 0 : delta > 0 ? Math.max(delta, 1) : Math.min(delta, -1);
   var button = delta > 0 ? 3 : 4;
   SDL.events.push({
    type: "mousedown",
    button: button,
    pageX: event.pageX,
    pageY: event.pageY
   });
   SDL.events.push({
    type: "mouseup",
    button: button,
    pageX: event.pageX,
    pageY: event.pageY
   });
   SDL.events.push({
    type: "wheel",
    deltaX: 0,
    deltaY: delta
   });
   event.preventDefault();
   break;

  case "mousemove":
   if (SDL.DOMButtons[0] === 1) {
    SDL.events.push({
     type: "touchmove",
     touch: {
      identifier: 0,
      deviceID: -1,
      pageX: event.pageX,
      pageY: event.pageY
     }
    });
   }
   if (Browser.pointerLock) {
    if ("mozMovementX" in event) {
     event["movementX"] = event["mozMovementX"];
     event["movementY"] = event["mozMovementY"];
    }
    if (event["movementX"] == 0 && event["movementY"] == 0) {
     event.preventDefault();
     return;
    }
   }

  case "keydown":
  case "keyup":
  case "keypress":
  case "mousedown":
  case "mouseup":
   if (event.type !== "keydown" || !SDL.unicode && !SDL.textInput || (event.keyCode === 8 || event.keyCode === 9)) {
    event.preventDefault();
   }
   if (event.type == "mousedown") {
    SDL.DOMButtons[event.button] = 1;
    SDL.events.push({
     type: "touchstart",
     touch: {
      identifier: 0,
      deviceID: -1,
      pageX: event.pageX,
      pageY: event.pageY
     }
    });
   } else if (event.type == "mouseup") {
    if (!SDL.DOMButtons[event.button]) {
     return;
    }
    SDL.events.push({
     type: "touchend",
     touch: {
      identifier: 0,
      deviceID: -1,
      pageX: event.pageX,
      pageY: event.pageY
     }
    });
    SDL.DOMButtons[event.button] = 0;
   }
   if (event.type === "keydown" || event.type === "mousedown") {
    SDL.canRequestFullscreen = true;
   } else if (event.type === "keyup" || event.type === "mouseup") {
    if (SDL.isRequestingFullscreen) {
     Module["requestFullscreen"](true, true);
     SDL.isRequestingFullscreen = false;
    }
    SDL.canRequestFullscreen = false;
   }
   if (event.type === "keypress" && SDL.savedKeydown) {
    SDL.savedKeydown.keypressCharCode = event.charCode;
    SDL.savedKeydown = null;
   } else if (event.type === "keydown") {
    SDL.savedKeydown = event;
   }
   if (event.type !== "keypress" || SDL.textInput) {
    SDL.events.push(event);
   }
   break;

  case "mouseout":
   for (var i = 0; i < 3; i++) {
    if (SDL.DOMButtons[i]) {
     SDL.events.push({
      type: "mouseup",
      button: i,
      pageX: event.pageX,
      pageY: event.pageY
     });
     SDL.DOMButtons[i] = 0;
    }
   }
   event.preventDefault();
   break;

  case "focus":
   SDL.events.push(event);
   event.preventDefault();
   break;

  case "blur":
   SDL.events.push(event);
   unpressAllPressedKeys();
   event.preventDefault();
   break;

  case "visibilitychange":
   SDL.events.push({
    type: "visibilitychange",
    visible: !document.hidden
   });
   unpressAllPressedKeys();
   event.preventDefault();
   break;

  case "unload":
   if (Browser.mainLoop.runner) {
    SDL.events.push(event);
    Browser.mainLoop.runner();
   }
   return;

  case "resize":
   SDL.events.push(event);
   if (event.preventDefault) {
    event.preventDefault();
   }
   break;
  }
  if (SDL.events.length >= 1e4) {
   err("SDL event queue full, dropping events");
   SDL.events = SDL.events.slice(0, 1e4);
  }
  SDL.flushEventsToHandler();
  return;
 },
 lookupKeyCodeForEvent: function(event) {
  var code = event.keyCode;
  if (code >= 65 && code <= 90) {
   code += 32;
  } else {
   code = SDL.keyCodes[event.keyCode] || event.keyCode;
   if (event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT && code >= (224 | 1 << 10) && code <= (227 | 1 << 10)) {
    code += 4;
   }
  }
  return code;
 },
 handleEvent: function(event) {
  if (event.handled) return;
  event.handled = true;
  switch (event.type) {
  case "touchstart":
  case "touchend":
  case "touchmove":
   {
    Browser.calculateMouseEvent(event);
    break;
   }

  case "keydown":
  case "keyup":
   {
    var down = event.type === "keydown";
    var code = SDL.lookupKeyCodeForEvent(event);
    HEAP8[SDL.keyboardState + code >> 0] = down;
    SDL.modState = (HEAP8[SDL.keyboardState + 1248 >> 0] ? 64 : 0) | (HEAP8[SDL.keyboardState + 1249 >> 0] ? 1 : 0) | (HEAP8[SDL.keyboardState + 1250 >> 0] ? 256 : 0) | (HEAP8[SDL.keyboardState + 1252 >> 0] ? 128 : 0) | (HEAP8[SDL.keyboardState + 1253 >> 0] ? 2 : 0) | (HEAP8[SDL.keyboardState + 1254 >> 0] ? 512 : 0);
    if (down) {
     SDL.keyboardMap[code] = event.keyCode;
    } else {
     delete SDL.keyboardMap[code];
    }
    break;
   }

  case "mousedown":
  case "mouseup":
   if (event.type == "mousedown") {
    SDL.buttonState |= 1 << event.button;
   } else if (event.type == "mouseup") {
    SDL.buttonState &= ~(1 << event.button);
   }

  case "mousemove":
   {
    Browser.calculateMouseEvent(event);
    break;
   }
  }
 },
 flushEventsToHandler: function() {
  if (!SDL.eventHandler) return;
  while (SDL.pollEvent(SDL.eventHandlerTemp)) {
   Module["dynCall_iii"](SDL.eventHandler, SDL.eventHandlerContext, SDL.eventHandlerTemp);
  }
 },
 pollEvent: function(ptr) {
  if (SDL.initFlags & 512 && SDL.joystickEventState) {
   SDL.queryJoysticks();
  }
  if (ptr) {
   while (SDL.events.length > 0) {
    if (SDL.makeCEvent(SDL.events.shift(), ptr) !== false) return 1;
   }
   return 0;
  } else {
   return SDL.events.length > 0;
  }
 },
 makeCEvent: function(event, ptr) {
  if (typeof event === "number") {
   _memcpy(ptr, event, 28);
   _free(event);
   return;
  }
  SDL.handleEvent(event);
  switch (event.type) {
  case "keydown":
  case "keyup":
   {
    var down = event.type === "keydown";
    var key = SDL.lookupKeyCodeForEvent(event);
    var scan;
    if (key >= 1024) {
     scan = key - 1024;
    } else {
     scan = SDL.scanCodes[key] || key;
    }
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP8[ptr + 8 >> 0] = down ? 1 : 0;
    HEAP8[ptr + 9 >> 0] = 0;
    HEAP32[ptr + 12 >> 2] = scan;
    HEAP32[ptr + 16 >> 2] = key;
    HEAP16[ptr + 20 >> 1] = SDL.modState;
    HEAP32[ptr + 24 >> 2] = event.keypressCharCode || key;
    break;
   }

  case "keypress":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    var cStr = intArrayFromString(String.fromCharCode(event.charCode));
    for (var i = 0; i < cStr.length; ++i) {
     HEAP8[ptr + (8 + i) >> 0] = cStr[i];
    }
    break;
   }

  case "mousedown":
  case "mouseup":
  case "mousemove":
   {
    if (event.type != "mousemove") {
     var down = event.type === "mousedown";
     HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
     HEAP32[ptr + 4 >> 2] = 0;
     HEAP32[ptr + 8 >> 2] = 0;
     HEAP32[ptr + 12 >> 2] = 0;
     HEAP8[ptr + 16 >> 0] = event.button + 1;
     HEAP8[ptr + 17 >> 0] = down ? 1 : 0;
     HEAP32[ptr + 20 >> 2] = Browser.mouseX;
     HEAP32[ptr + 24 >> 2] = Browser.mouseY;
    } else {
     HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
     HEAP32[ptr + 4 >> 2] = 0;
     HEAP32[ptr + 8 >> 2] = 0;
     HEAP32[ptr + 12 >> 2] = 0;
     HEAP32[ptr + 16 >> 2] = SDL.buttonState;
     HEAP32[ptr + 20 >> 2] = Browser.mouseX;
     HEAP32[ptr + 24 >> 2] = Browser.mouseY;
     HEAP32[ptr + 28 >> 2] = Browser.mouseMovementX;
     HEAP32[ptr + 32 >> 2] = Browser.mouseMovementY;
    }
    break;
   }

  case "wheel":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 16 >> 2] = event.deltaX;
    HEAP32[ptr + 20 >> 2] = event.deltaY;
    break;
   }

  case "touchstart":
  case "touchend":
  case "touchmove":
   {
    var touch = event.touch;
    if (!Browser.touches[touch.identifier]) break;
    var w = Module["canvas"].width;
    var h = Module["canvas"].height;
    var x = Browser.touches[touch.identifier].x / w;
    var y = Browser.touches[touch.identifier].y / h;
    var lx = Browser.lastTouches[touch.identifier].x / w;
    var ly = Browser.lastTouches[touch.identifier].y / h;
    var dx = x - lx;
    var dy = y - ly;
    if (touch["deviceID"] === undefined) touch.deviceID = SDL.TOUCH_DEFAULT_ID;
    if (dx === 0 && dy === 0 && event.type === "touchmove") return false;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = _SDL_GetTicks();
    tempI64 = [ touch.deviceID >>> 0, (tempDouble = touch.deviceID, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0) ], 
    HEAP32[ptr + 8 >> 2] = tempI64[0], HEAP32[ptr + 12 >> 2] = tempI64[1];
    tempI64 = [ touch.identifier >>> 0, (tempDouble = touch.identifier, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0) ], 
    HEAP32[ptr + 16 >> 2] = tempI64[0], HEAP32[ptr + 20 >> 2] = tempI64[1];
    HEAPF32[ptr + 24 >> 2] = x;
    HEAPF32[ptr + 28 >> 2] = y;
    HEAPF32[ptr + 32 >> 2] = dx;
    HEAPF32[ptr + 36 >> 2] = dy;
    if (touch.force !== undefined) {
     HEAPF32[ptr + 40 >> 2] = touch.force;
    } else {
     HEAPF32[ptr + 40 >> 2] = event.type == "touchend" ? 0 : 1;
    }
    break;
   }

  case "unload":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    break;
   }

  case "resize":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = event.w;
    HEAP32[ptr + 8 >> 2] = event.h;
    break;
   }

  case "joystick_button_up":
  case "joystick_button_down":
   {
    var state = event.type === "joystick_button_up" ? 0 : 1;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP8[ptr + 4 >> 0] = event.index;
    HEAP8[ptr + 5 >> 0] = event.button;
    HEAP8[ptr + 6 >> 0] = state;
    break;
   }

  case "joystick_axis_motion":
   {
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP8[ptr + 4 >> 0] = event.index;
    HEAP8[ptr + 5 >> 0] = event.axis;
    HEAP32[ptr + 8 >> 2] = SDL.joystickAxisValueConversion(event.value);
    break;
   }

  case "focus":
   {
    var SDL_WINDOWEVENT_FOCUS_GAINED = 12;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = 0;
    HEAP8[ptr + 8 >> 0] = SDL_WINDOWEVENT_FOCUS_GAINED;
    break;
   }

  case "blur":
   {
    var SDL_WINDOWEVENT_FOCUS_LOST = 13;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = 0;
    HEAP8[ptr + 8 >> 0] = SDL_WINDOWEVENT_FOCUS_LOST;
    break;
   }

  case "visibilitychange":
   {
    var SDL_WINDOWEVENT_SHOWN = 1;
    var SDL_WINDOWEVENT_HIDDEN = 2;
    var visibilityEventID = event.visible ? SDL_WINDOWEVENT_SHOWN : SDL_WINDOWEVENT_HIDDEN;
    HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
    HEAP32[ptr + 4 >> 2] = 0;
    HEAP8[ptr + 8 >> 0] = visibilityEventID;
    break;
   }

  default:
   throw "Unhandled SDL event: " + event.type;
  }
 },
 makeFontString: function(height, fontName) {
  if (fontName.charAt(0) != "'" && fontName.charAt(0) != '"') {
   fontName = '"' + fontName + '"';
  }
  return height + "px " + fontName + ", serif";
 },
 estimateTextWidth: function(fontData, text) {
  var h = fontData.size;
  var fontString = SDL.makeFontString(h, fontData.name);
  var tempCtx = SDL.ttfContext;
  tempCtx.save();
  tempCtx.font = fontString;
  var ret = tempCtx.measureText(text).width | 0;
  tempCtx.restore();
  return ret;
 },
 allocateChannels: function(num) {
  if (SDL.numChannels && SDL.numChannels >= num && num != 0) return;
  SDL.numChannels = num;
  SDL.channels = [];
  for (var i = 0; i < num; i++) {
   SDL.channels[i] = {
    audio: null,
    volume: 1
   };
  }
 },
 setGetVolume: function(info, volume) {
  if (!info) return 0;
  var ret = info.volume * 128;
  if (volume != -1) {
   info.volume = Math.min(Math.max(volume, 0), 128) / 128;
   if (info.audio) {
    try {
     info.audio.volume = info.volume;
     if (info.audio.webAudioGainNode) info.audio.webAudioGainNode["gain"]["value"] = info.volume;
    } catch (e) {
     err("setGetVolume failed to set audio volume: " + e);
    }
   }
  }
  return ret;
 },
 setPannerPosition: function(info, x, y, z) {
  if (!info) return;
  if (info.audio) {
   if (info.audio.webAudioPannerNode) {
    info.audio.webAudioPannerNode["setPosition"](x, y, z);
   }
  }
 },
 playWebAudio: function(audio) {
  if (!audio) return;
  if (audio.webAudioNode) return;
  if (!SDL.webAudioAvailable()) return;
  try {
   var webAudio = audio.resource.webAudio;
   audio.paused = false;
   if (!webAudio.decodedBuffer) {
    if (webAudio.onDecodeComplete === undefined) abort("Cannot play back audio object that was not loaded");
    webAudio.onDecodeComplete.push(function() {
     if (!audio.paused) SDL.playWebAudio(audio);
    });
    return;
   }
   audio.webAudioNode = SDL.audioContext["createBufferSource"]();
   audio.webAudioNode["buffer"] = webAudio.decodedBuffer;
   audio.webAudioNode["loop"] = audio.loop;
   audio.webAudioNode["onended"] = function() {
    audio["onended"]();
   };
   audio.webAudioPannerNode = SDL.audioContext["createPanner"]();
   audio.webAudioPannerNode["setPosition"](0, 0, -.5);
   audio.webAudioPannerNode["panningModel"] = "equalpower";
   audio.webAudioGainNode = SDL.audioContext["createGain"]();
   audio.webAudioGainNode["gain"]["value"] = audio.volume;
   audio.webAudioNode["connect"](audio.webAudioPannerNode);
   audio.webAudioPannerNode["connect"](audio.webAudioGainNode);
   audio.webAudioGainNode["connect"](SDL.audioContext["destination"]);
   audio.webAudioNode["start"](0, audio.currentPosition);
   audio.startTime = SDL.audioContext["currentTime"] - audio.currentPosition;
  } catch (e) {
   err("playWebAudio failed: " + e);
  }
 },
 pauseWebAudio: function(audio) {
  if (!audio) return;
  if (audio.webAudioNode) {
   try {
    audio.currentPosition = (SDL.audioContext["currentTime"] - audio.startTime) % audio.resource.webAudio.decodedBuffer.duration;
    audio.webAudioNode["onended"] = undefined;
    audio.webAudioNode.stop(0);
    audio.webAudioNode = undefined;
   } catch (e) {
    err("pauseWebAudio failed: " + e);
   }
  }
  audio.paused = true;
 },
 openAudioContext: function() {
  if (!SDL.audioContext) {
   if (typeof AudioContext !== "undefined") SDL.audioContext = new AudioContext(); else if (typeof webkitAudioContext !== "undefined") SDL.audioContext = new webkitAudioContext();
  }
 },
 webAudioAvailable: function() {
  return !!SDL.audioContext;
 },
 fillWebAudioBufferFromHeap: function(heapPtr, sizeSamplesPerChannel, dstAudioBuffer) {
  var numChannels = SDL.audio.channels;
  for (var c = 0; c < numChannels; ++c) {
   var channelData = dstAudioBuffer["getChannelData"](c);
   if (channelData.length != sizeSamplesPerChannel) {
    throw "Web Audio output buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + sizeSamplesPerChannel + " samples!";
   }
   if (SDL.audio.format == 32784) {
    for (var j = 0; j < sizeSamplesPerChannel; ++j) {
     channelData[j] = HEAP16[heapPtr + (j * numChannels + c) * 2 >> 1] / 32768;
    }
   } else if (SDL.audio.format == 8) {
    for (var j = 0; j < sizeSamplesPerChannel; ++j) {
     var v = HEAP8[heapPtr + (j * numChannels + c) >> 0];
     channelData[j] = (v >= 0 ? v - 128 : v + 128) / 128;
    }
   } else if (SDL.audio.format == 33056) {
    for (var j = 0; j < sizeSamplesPerChannel; ++j) {
     channelData[j] = HEAPF32[heapPtr + (j * numChannels + c) * 4 >> 2];
    }
   } else {
    throw "Invalid SDL audio format " + SDL.audio.format + "!";
   }
  }
 },
 debugSurface: function(surfData) {
  console.log("dumping surface " + [ surfData.surf, surfData.source, surfData.width, surfData.height ]);
  var image = surfData.ctx.getImageData(0, 0, surfData.width, surfData.height);
  var data = image.data;
  var num = Math.min(surfData.width, surfData.height);
  for (var i = 0; i < num; i++) {
   console.log("   diagonal " + i + ":" + [ data[i * surfData.width * 4 + i * 4 + 0], data[i * surfData.width * 4 + i * 4 + 1], data[i * surfData.width * 4 + i * 4 + 2], data[i * surfData.width * 4 + i * 4 + 3] ]);
  }
 },
 joystickEventState: 1,
 lastJoystickState: {},
 joystickNamePool: {},
 recordJoystickState: function(joystick, state) {
  var buttons = new Array(state.buttons.length);
  for (var i = 0; i < state.buttons.length; i++) {
   buttons[i] = SDL.getJoystickButtonState(state.buttons[i]);
  }
  SDL.lastJoystickState[joystick] = {
   buttons: buttons,
   axes: state.axes.slice(0),
   timestamp: state.timestamp,
   index: state.index,
   id: state.id
  };
 },
 getJoystickButtonState: function(button) {
  if (typeof button === "object") {
   return button["pressed"];
  } else {
   return button > 0;
  }
 },
 queryJoysticks: function() {
  for (var joystick in SDL.lastJoystickState) {
   var state = SDL.getGamepad(joystick - 1);
   var prevState = SDL.lastJoystickState[joystick];
   if (typeof state === "undefined") return;
   if (state === null) return;
   if (typeof state.timestamp !== "number" || state.timestamp !== prevState.timestamp || !state.timestamp) {
    var i;
    for (i = 0; i < state.buttons.length; i++) {
     var buttonState = SDL.getJoystickButtonState(state.buttons[i]);
     if (buttonState !== prevState.buttons[i]) {
      SDL.events.push({
       type: buttonState ? "joystick_button_down" : "joystick_button_up",
       joystick: joystick,
       index: joystick - 1,
       button: i
      });
     }
    }
    for (i = 0; i < state.axes.length; i++) {
     if (state.axes[i] !== prevState.axes[i]) {
      SDL.events.push({
       type: "joystick_axis_motion",
       joystick: joystick,
       index: joystick - 1,
       axis: i,
       value: state.axes[i]
      });
     }
    }
    SDL.recordJoystickState(joystick, state);
   }
  }
 },
 joystickAxisValueConversion: function(value) {
  value = Math.min(1, Math.max(value, -1));
  return Math.ceil((value + 1) * 32767.5 - 32768);
 },
 getGamepads: function() {
  var fcn = navigator.getGamepads || navigator.webkitGamepads || navigator.mozGamepads || navigator.gamepads || navigator.webkitGetGamepads;
  if (fcn !== undefined) {
   return fcn.apply(navigator);
  } else {
   return [];
  }
 },
 getGamepad: function(deviceIndex) {
  var gamepads = SDL.getGamepads();
  if (gamepads.length > deviceIndex && deviceIndex >= 0) {
   return gamepads[deviceIndex];
  }
  return null;
 }
};

function _SDL_Init(initFlags) {
 SDL.startTime = Date.now();
 SDL.initFlags = initFlags;
 if (!Module["doNotCaptureKeyboard"]) {
  var keyboardListeningElement = Module["keyboardListeningElement"] || document;
  keyboardListeningElement.addEventListener("keydown", SDL.receiveEvent);
  keyboardListeningElement.addEventListener("keyup", SDL.receiveEvent);
  keyboardListeningElement.addEventListener("keypress", SDL.receiveEvent);
  window.addEventListener("focus", SDL.receiveEvent);
  window.addEventListener("blur", SDL.receiveEvent);
  document.addEventListener("visibilitychange", SDL.receiveEvent);
 }
 window.addEventListener("unload", SDL.receiveEvent);
 SDL.keyboardState = _malloc(65536);
 _memset(SDL.keyboardState, 0, 65536);
 SDL.DOMEventToSDLEvent["keydown"] = 768;
 SDL.DOMEventToSDLEvent["keyup"] = 769;
 SDL.DOMEventToSDLEvent["keypress"] = 771;
 SDL.DOMEventToSDLEvent["mousedown"] = 1025;
 SDL.DOMEventToSDLEvent["mouseup"] = 1026;
 SDL.DOMEventToSDLEvent["mousemove"] = 1024;
 SDL.DOMEventToSDLEvent["wheel"] = 1027;
 SDL.DOMEventToSDLEvent["touchstart"] = 1792;
 SDL.DOMEventToSDLEvent["touchend"] = 1793;
 SDL.DOMEventToSDLEvent["touchmove"] = 1794;
 SDL.DOMEventToSDLEvent["unload"] = 256;
 SDL.DOMEventToSDLEvent["resize"] = 28673;
 SDL.DOMEventToSDLEvent["visibilitychange"] = 512;
 SDL.DOMEventToSDLEvent["focus"] = 512;
 SDL.DOMEventToSDLEvent["blur"] = 512;
 SDL.DOMEventToSDLEvent["joystick_axis_motion"] = 1536;
 SDL.DOMEventToSDLEvent["joystick_button_down"] = 1539;
 SDL.DOMEventToSDLEvent["joystick_button_up"] = 1540;
 return 0;
}

function _SDL_PollEvent(ptr) {
 return SDL.pollEvent(ptr);
}

function _SDL_AudioQuit() {
 for (var i = 0; i < SDL.numChannels; ++i) {
  if (SDL.channels[i].audio) {
   SDL.channels[i].audio.pause();
   SDL.channels[i].audio = undefined;
  }
 }
 if (SDL.music.audio) SDL.music.audio.pause();
 SDL.music.audio = undefined;
}

function _SDL_Quit() {
 _SDL_AudioQuit();
 out("SDL_Quit called (and ignored)");
}

var GL = {
 counter: 1,
 lastError: 0,
 buffers: [],
 mappedBuffers: {},
 programs: [],
 framebuffers: [],
 renderbuffers: [],
 textures: [],
 uniforms: [],
 shaders: [],
 vaos: [],
 contexts: {},
 currentContext: null,
 offscreenCanvases: {},
 timerQueriesEXT: [],
 programInfos: {},
 stringCache: {},
 unpackAlignment: 4,
 init: function() {
  GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
  for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
   GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1);
  }
 },
 recordError: function recordError(errorCode) {
  if (!GL.lastError) {
   GL.lastError = errorCode;
  }
 },
 getNewId: function(table) {
  var ret = GL.counter++;
  for (var i = table.length; i < ret; i++) {
   table[i] = null;
  }
  return ret;
 },
 MINI_TEMP_BUFFER_SIZE: 256,
 miniTempBuffer: null,
 miniTempBufferViews: [ 0 ],
 getSource: function(shader, count, string, length) {
  var source = "";
  for (var i = 0; i < count; ++i) {
   var len = length ? HEAP32[length + i * 4 >> 2] : -1;
   source += UTF8ToString(HEAP32[string + i * 4 >> 2], len < 0 ? undefined : len);
  }
  return source;
 },
 createContext: function(canvas, webGLContextAttributes) {
  var ctx = canvas.getContext("webgl", webGLContextAttributes) || canvas.getContext("experimental-webgl", webGLContextAttributes);
  return ctx && GL.registerContext(ctx, webGLContextAttributes);
 },
 registerContext: function(ctx, webGLContextAttributes) {
  var handle = _malloc(8);
  var context = {
   handle: handle,
   attributes: webGLContextAttributes,
   version: webGLContextAttributes.majorVersion,
   GLctx: ctx
  };
  if (ctx.canvas) ctx.canvas.GLctxObject = context;
  GL.contexts[handle] = context;
  if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
   GL.initExtensions(context);
  }
  return handle;
 },
 makeContextCurrent: function(contextHandle) {
  GL.currentContext = GL.contexts[contextHandle];
  Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
  return !(contextHandle && !GLctx);
 },
 getContext: function(contextHandle) {
  return GL.contexts[contextHandle];
 },
 deleteContext: function(contextHandle) {
  if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
  if (typeof JSEvents === "object") JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
  if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
  _free(GL.contexts[contextHandle]);
  GL.contexts[contextHandle] = null;
 },
 initExtensions: function(context) {
  if (!context) context = GL.currentContext;
  if (context.initExtensionsDone) return;
  context.initExtensionsDone = true;
  var GLctx = context.GLctx;
  if (context.version < 2) {
   var instancedArraysExt = GLctx.getExtension("ANGLE_instanced_arrays");
   if (instancedArraysExt) {
    GLctx["vertexAttribDivisor"] = function(index, divisor) {
     instancedArraysExt["vertexAttribDivisorANGLE"](index, divisor);
    };
    GLctx["drawArraysInstanced"] = function(mode, first, count, primcount) {
     instancedArraysExt["drawArraysInstancedANGLE"](mode, first, count, primcount);
    };
    GLctx["drawElementsInstanced"] = function(mode, count, type, indices, primcount) {
     instancedArraysExt["drawElementsInstancedANGLE"](mode, count, type, indices, primcount);
    };
   }
   var vaoExt = GLctx.getExtension("OES_vertex_array_object");
   if (vaoExt) {
    GLctx["createVertexArray"] = function() {
     return vaoExt["createVertexArrayOES"]();
    };
    GLctx["deleteVertexArray"] = function(vao) {
     vaoExt["deleteVertexArrayOES"](vao);
    };
    GLctx["bindVertexArray"] = function(vao) {
     vaoExt["bindVertexArrayOES"](vao);
    };
    GLctx["isVertexArray"] = function(vao) {
     return vaoExt["isVertexArrayOES"](vao);
    };
   }
   var drawBuffersExt = GLctx.getExtension("WEBGL_draw_buffers");
   if (drawBuffersExt) {
    GLctx["drawBuffers"] = function(n, bufs) {
     drawBuffersExt["drawBuffersWEBGL"](n, bufs);
    };
   }
  }
  GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
  var automaticallyEnabledExtensions = [ "OES_texture_float", "OES_texture_half_float", "OES_standard_derivatives", "OES_vertex_array_object", "WEBGL_compressed_texture_s3tc", "WEBGL_depth_texture", "OES_element_index_uint", "EXT_texture_filter_anisotropic", "EXT_frag_depth", "WEBGL_draw_buffers", "ANGLE_instanced_arrays", "OES_texture_float_linear", "OES_texture_half_float_linear", "EXT_blend_minmax", "EXT_shader_texture_lod", "WEBGL_compressed_texture_pvrtc", "EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "EXT_sRGB", "WEBGL_compressed_texture_etc1", "EXT_disjoint_timer_query", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_astc", "EXT_color_buffer_float", "WEBGL_compressed_texture_s3tc_srgb", "EXT_disjoint_timer_query_webgl2" ];
  var exts = GLctx.getSupportedExtensions();
  if (exts && exts.length > 0) {
   GLctx.getSupportedExtensions().forEach(function(ext) {
    if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
     GLctx.getExtension(ext);
    }
   });
  }
 },
 populateUniformTable: function(program) {
  var p = GL.programs[program];
  var ptable = GL.programInfos[program] = {
   uniforms: {},
   maxUniformLength: 0,
   maxAttributeLength: -1,
   maxUniformBlockNameLength: -1
  };
  var utable = ptable.uniforms;
  var numUniforms = GLctx.getProgramParameter(p, 35718);
  for (var i = 0; i < numUniforms; ++i) {
   var u = GLctx.getActiveUniform(p, i);
   var name = u.name;
   ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length + 1);
   var ls = name.lastIndexOf("[");
   if (ls > 0) {
    name = name.slice(0, ls);
   }
   var loc = GLctx.getUniformLocation(p, name);
   if (loc) {
    var id = GL.getNewId(GL.uniforms);
    utable[name] = [ u.size, id ];
    GL.uniforms[id] = loc;
    for (var j = 1; j < u.size; ++j) {
     var n = name + "[" + j + "]";
     loc = GLctx.getUniformLocation(p, n);
     id = GL.getNewId(GL.uniforms);
     GL.uniforms[id] = loc;
    }
   }
  }
 }
};

function _SDL_SetVideoMode(width, height, depth, flags) {
 [ "touchstart", "touchend", "touchmove", "mousedown", "mouseup", "mousemove", "DOMMouseScroll", "mousewheel", "wheel", "mouseout" ].forEach(function(event) {
  Module["canvas"].addEventListener(event, SDL.receiveEvent, true);
 });
 var canvas = Module["canvas"];
 if (width == 0 && height == 0) {
  width = canvas.width;
  height = canvas.height;
 }
 if (!SDL.addedResizeListener) {
  SDL.addedResizeListener = true;
  Browser.resizeListeners.push(function(w, h) {
   if (!SDL.settingVideoMode) {
    SDL.receiveEvent({
     type: "resize",
     w: w,
     h: h
    });
   }
  });
 }
 SDL.settingVideoMode = true;
 Browser.setCanvasSize(width, height);
 SDL.settingVideoMode = false;
 if (SDL.screen) {
  SDL.freeSurface(SDL.screen);
  assert(!SDL.screen);
 }
 if (SDL.GL) flags = flags | 67108864;
 SDL.screen = SDL.makeSurface(width, height, flags, true, "screen");
 return SDL.screen;
}

function _SDL_UpdateRect(surf, x, y, w, h) {}

function ___cxa_allocate_exception(size) {
 return _malloc(size);
}

function __ZSt18uncaught_exceptionv() {
 return !!__ZSt18uncaught_exceptionv.uncaught_exception;
}

function ___cxa_free_exception(ptr) {
 try {
  return _free(ptr);
 } catch (e) {}
}

var EXCEPTIONS = {
 last: 0,
 caught: [],
 infos: {},
 deAdjust: function(adjusted) {
  if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
  for (var key in EXCEPTIONS.infos) {
   var ptr = +key;
   var adj = EXCEPTIONS.infos[ptr].adjusted;
   var len = adj.length;
   for (var i = 0; i < len; i++) {
    if (adj[i] === adjusted) {
     return ptr;
    }
   }
  }
  return adjusted;
 },
 addRef: function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  info.refcount++;
 },
 decRef: function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  assert(info.refcount > 0);
  info.refcount--;
  if (info.refcount === 0 && !info.rethrown) {
   if (info.destructor) {
    Module["dynCall_vi"](info.destructor, ptr);
   }
   delete EXCEPTIONS.infos[ptr];
   ___cxa_free_exception(ptr);
  }
 },
 clearRef: function(ptr) {
  if (!ptr) return;
  var info = EXCEPTIONS.infos[ptr];
  info.refcount = 0;
 }
};

function ___cxa_begin_catch(ptr) {
 var info = EXCEPTIONS.infos[ptr];
 if (info && !info.caught) {
  info.caught = true;
  __ZSt18uncaught_exceptionv.uncaught_exception--;
 }
 if (info) info.rethrown = false;
 EXCEPTIONS.caught.push(ptr);
 EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
 return ptr;
}

function ___resumeException(ptr) {
 if (!EXCEPTIONS.last) {
  EXCEPTIONS.last = ptr;
 }
 throw ptr;
}

function ___cxa_find_matching_catch() {
 var thrown = EXCEPTIONS.last;
 if (!thrown) {
  return (setTempRet0(0), 0) | 0;
 }
 var info = EXCEPTIONS.infos[thrown];
 var throwntype = info.type;
 if (!throwntype) {
  return (setTempRet0(0), thrown) | 0;
 }
 var typeArray = Array.prototype.slice.call(arguments);
 var pointer = Module["___cxa_is_pointer_type"](throwntype);
 if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
 HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
 thrown = ___cxa_find_matching_catch.buffer;
 for (var i = 0; i < typeArray.length; i++) {
  if (typeArray[i] && Module["___cxa_can_catch"](typeArray[i], throwntype, thrown)) {
   thrown = HEAP32[thrown >> 2];
   info.adjusted.push(thrown);
   return (setTempRet0(typeArray[i]), thrown) | 0;
  }
 }
 thrown = HEAP32[thrown >> 2];
 return (setTempRet0(throwntype), thrown) | 0;
}

function ___cxa_throw(ptr, type, destructor) {
 EXCEPTIONS.infos[ptr] = {
  ptr: ptr,
  adjusted: [ ptr ],
  type: type,
  destructor: destructor,
  refcount: 0,
  caught: false,
  rethrown: false
 };
 EXCEPTIONS.last = ptr;
 if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
  __ZSt18uncaught_exceptionv.uncaught_exception = 1;
 } else {
  __ZSt18uncaught_exceptionv.uncaught_exception++;
 }
 throw ptr;
}

function ___gxx_personality_v0() {}

var ERRNO_CODES = {
 EPERM: 1,
 ENOENT: 2,
 ESRCH: 3,
 EINTR: 4,
 EIO: 5,
 ENXIO: 6,
 E2BIG: 7,
 ENOEXEC: 8,
 EBADF: 9,
 ECHILD: 10,
 EAGAIN: 11,
 EWOULDBLOCK: 11,
 ENOMEM: 12,
 EACCES: 13,
 EFAULT: 14,
 ENOTBLK: 15,
 EBUSY: 16,
 EEXIST: 17,
 EXDEV: 18,
 ENODEV: 19,
 ENOTDIR: 20,
 EISDIR: 21,
 EINVAL: 22,
 ENFILE: 23,
 EMFILE: 24,
 ENOTTY: 25,
 ETXTBSY: 26,
 EFBIG: 27,
 ENOSPC: 28,
 ESPIPE: 29,
 EROFS: 30,
 EMLINK: 31,
 EPIPE: 32,
 EDOM: 33,
 ERANGE: 34,
 ENOMSG: 42,
 EIDRM: 43,
 ECHRNG: 44,
 EL2NSYNC: 45,
 EL3HLT: 46,
 EL3RST: 47,
 ELNRNG: 48,
 EUNATCH: 49,
 ENOCSI: 50,
 EL2HLT: 51,
 EDEADLK: 35,
 ENOLCK: 37,
 EBADE: 52,
 EBADR: 53,
 EXFULL: 54,
 ENOANO: 55,
 EBADRQC: 56,
 EBADSLT: 57,
 EDEADLOCK: 35,
 EBFONT: 59,
 ENOSTR: 60,
 ENODATA: 61,
 ETIME: 62,
 ENOSR: 63,
 ENONET: 64,
 ENOPKG: 65,
 EREMOTE: 66,
 ENOLINK: 67,
 EADV: 68,
 ESRMNT: 69,
 ECOMM: 70,
 EPROTO: 71,
 EMULTIHOP: 72,
 EDOTDOT: 73,
 EBADMSG: 74,
 ENOTUNIQ: 76,
 EBADFD: 77,
 EREMCHG: 78,
 ELIBACC: 79,
 ELIBBAD: 80,
 ELIBSCN: 81,
 ELIBMAX: 82,
 ELIBEXEC: 83,
 ENOSYS: 38,
 ENOTEMPTY: 39,
 ENAMETOOLONG: 36,
 ELOOP: 40,
 EOPNOTSUPP: 95,
 EPFNOSUPPORT: 96,
 ECONNRESET: 104,
 ENOBUFS: 105,
 EAFNOSUPPORT: 97,
 EPROTOTYPE: 91,
 ENOTSOCK: 88,
 ENOPROTOOPT: 92,
 ESHUTDOWN: 108,
 ECONNREFUSED: 111,
 EADDRINUSE: 98,
 ECONNABORTED: 103,
 ENETUNREACH: 101,
 ENETDOWN: 100,
 ETIMEDOUT: 110,
 EHOSTDOWN: 112,
 EHOSTUNREACH: 113,
 EINPROGRESS: 115,
 EALREADY: 114,
 EDESTADDRREQ: 89,
 EMSGSIZE: 90,
 EPROTONOSUPPORT: 93,
 ESOCKTNOSUPPORT: 94,
 EADDRNOTAVAIL: 99,
 ENETRESET: 102,
 EISCONN: 106,
 ENOTCONN: 107,
 ETOOMANYREFS: 109,
 EUSERS: 87,
 EDQUOT: 122,
 ESTALE: 116,
 ENOTSUP: 95,
 ENOMEDIUM: 123,
 EILSEQ: 84,
 EOVERFLOW: 75,
 ECANCELED: 125,
 ENOTRECOVERABLE: 131,
 EOWNERDEAD: 130,
 ESTRPIPE: 86
};

var SYSCALLS = {
 DEFAULT_POLLMASK: 5,
 mappings: {},
 umask: 511,
 calculateAt: function(dirfd, path) {
  if (path[0] !== "/") {
   var dir;
   if (dirfd === -100) {
    dir = FS.cwd();
   } else {
    var dirstream = FS.getStream(dirfd);
    if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
    dir = dirstream.path;
   }
   path = PATH.join2(dir, path);
  }
  return path;
 },
 doStat: function(func, path, buf) {
  try {
   var stat = func(path);
  } catch (e) {
   if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
    return -ERRNO_CODES.ENOTDIR;
   }
   throw e;
  }
  HEAP32[buf >> 2] = stat.dev;
  HEAP32[buf + 4 >> 2] = 0;
  HEAP32[buf + 8 >> 2] = stat.ino;
  HEAP32[buf + 12 >> 2] = stat.mode;
  HEAP32[buf + 16 >> 2] = stat.nlink;
  HEAP32[buf + 20 >> 2] = stat.uid;
  HEAP32[buf + 24 >> 2] = stat.gid;
  HEAP32[buf + 28 >> 2] = stat.rdev;
  HEAP32[buf + 32 >> 2] = 0;
  HEAP32[buf + 36 >> 2] = stat.size;
  HEAP32[buf + 40 >> 2] = 4096;
  HEAP32[buf + 44 >> 2] = stat.blocks;
  HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
  HEAP32[buf + 52 >> 2] = 0;
  HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
  HEAP32[buf + 60 >> 2] = 0;
  HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
  HEAP32[buf + 68 >> 2] = 0;
  HEAP32[buf + 72 >> 2] = stat.ino;
  return 0;
 },
 doMsync: function(addr, stream, len, flags) {
  var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
  FS.msync(stream, buffer, 0, len, flags);
 },
 doMkdir: function(path, mode) {
  path = PATH.normalize(path);
  if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
  FS.mkdir(path, mode, 0);
  return 0;
 },
 doMknod: function(path, mode, dev) {
  switch (mode & 61440) {
  case 32768:
  case 8192:
  case 24576:
  case 4096:
  case 49152:
   break;

  default:
   return -ERRNO_CODES.EINVAL;
  }
  FS.mknod(path, mode, dev);
  return 0;
 },
 doReadlink: function(path, buf, bufsize) {
  if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
  var ret = FS.readlink(path);
  var len = Math.min(bufsize, lengthBytesUTF8(ret));
  var endChar = HEAP8[buf + len];
  stringToUTF8(ret, buf, bufsize + 1);
  HEAP8[buf + len] = endChar;
  return len;
 },
 doAccess: function(path, amode) {
  if (amode & ~7) {
   return -ERRNO_CODES.EINVAL;
  }
  var node;
  var lookup = FS.lookupPath(path, {
   follow: true
  });
  node = lookup.node;
  var perms = "";
  if (amode & 4) perms += "r";
  if (amode & 2) perms += "w";
  if (amode & 1) perms += "x";
  if (perms && FS.nodePermissions(node, perms)) {
   return -ERRNO_CODES.EACCES;
  }
  return 0;
 },
 doDup: function(path, flags, suggestFD) {
  var suggest = FS.getStream(suggestFD);
  if (suggest) FS.close(suggest);
  return FS.open(path, flags, 0, suggestFD, suggestFD).fd;
 },
 doReadv: function(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   var curr = FS.read(stream, HEAP8, ptr, len, offset);
   if (curr < 0) return -1;
   ret += curr;
   if (curr < len) break;
  }
  return ret;
 },
 doWritev: function(stream, iov, iovcnt, offset) {
  var ret = 0;
  for (var i = 0; i < iovcnt; i++) {
   var ptr = HEAP32[iov + i * 8 >> 2];
   var len = HEAP32[iov + (i * 8 + 4) >> 2];
   var curr = FS.write(stream, HEAP8, ptr, len, offset);
   if (curr < 0) return -1;
   ret += curr;
  }
  return ret;
 },
 varargs: 0,
 get: function(varargs) {
  SYSCALLS.varargs += 4;
  var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
  return ret;
 },
 getStr: function() {
  var ret = UTF8ToString(SYSCALLS.get());
  return ret;
 },
 getStreamFromFD: function() {
  var stream = FS.getStream(SYSCALLS.get());
  if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  return stream;
 },
 getSocketFromFD: function() {
  var socket = SOCKFS.getSocket(SYSCALLS.get());
  if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
  return socket;
 },
 getSocketAddress: function(allowNull) {
  var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
  if (allowNull && addrp === 0) return null;
  var info = __read_sockaddr(addrp, addrlen);
  if (info.errno) throw new FS.ErrnoError(info.errno);
  info.addr = DNS.lookup_addr(info.addr) || info.addr;
  return info;
 },
 get64: function() {
  var low = SYSCALLS.get(), high = SYSCALLS.get();
  return low;
 },
 getZero: function() {
  SYSCALLS.get();
 }
};

function ___syscall140(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
  var offset = offset_low;
  FS.llseek(stream, offset, whence);
  HEAP32[result >> 2] = stream.position;
  if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall146(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
  return SYSCALLS.doWritev(stream, iov, iovcnt);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall221(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
  switch (cmd) {
  case 0:
   {
    var arg = SYSCALLS.get();
    if (arg < 0) {
     return -ERRNO_CODES.EINVAL;
    }
    var newStream;
    newStream = FS.open(stream.path, stream.flags, 0, arg);
    return newStream.fd;
   }

  case 1:
  case 2:
   return 0;

  case 3:
   return stream.flags;

  case 4:
   {
    var arg = SYSCALLS.get();
    stream.flags |= arg;
    return 0;
   }

  case 12:
   {
    var arg = SYSCALLS.get();
    var offset = 0;
    HEAP16[arg + offset >> 1] = 2;
    return 0;
   }

  case 13:
  case 14:
   return 0;

  case 16:
  case 8:
   return -ERRNO_CODES.EINVAL;

  case 9:
   ___setErrNo(ERRNO_CODES.EINVAL);
   return -1;

  default:
   {
    return -ERRNO_CODES.EINVAL;
   }
  }
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall3(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
  return FS.read(stream, HEAP8, buf, count);
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall5(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get();
  var stream = FS.open(pathname, flags, mode);
  return stream.fd;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall54(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
  switch (op) {
  case 21509:
  case 21505:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  case 21510:
  case 21511:
  case 21512:
  case 21506:
  case 21507:
  case 21508:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  case 21519:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    var argp = SYSCALLS.get();
    HEAP32[argp >> 2] = 0;
    return 0;
   }

  case 21520:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return -ERRNO_CODES.EINVAL;
   }

  case 21531:
   {
    var argp = SYSCALLS.get();
    return FS.ioctl(stream, op, argp);
   }

  case 21523:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  case 21524:
   {
    if (!stream.tty) return -ERRNO_CODES.ENOTTY;
    return 0;
   }

  default:
   abort("bad ioctl syscall " + op);
  }
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function ___syscall6(which, varargs) {
 SYSCALLS.varargs = varargs;
 try {
  var stream = SYSCALLS.getStreamFromFD();
  FS.close(stream);
  return 0;
 } catch (e) {
  if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
  return -e.errno;
 }
}

function _abort() {
 Module["abort"]();
}

var SDL_gfx = {
 drawRectangle: function(surf, x1, y1, x2, y2, action, cssColor, alpha) {
  x1 = x1 << 16 >> 16;
  y1 = y1 << 16 >> 16;
  x2 = x2 << 16 >> 16;
  y2 = y2 << 16 >> 16;
  var surfData = SDL.surfaces[surf];
  assert(!surfData.locked);
  var x = x1 < x2 ? x1 : x2;
  var y = y1 < y2 ? y1 : y2;
  var w = Math.abs(x2 - x1);
  var h = Math.abs(y2 - y1);
  surfData.ctx.save();
  surfData.ctx.globalAlpha = alpha / 255;
  surfData.ctx[action + "Style"] = cssColor;
  surfData.ctx[action + "Rect"](x, y, w, h);
  surfData.ctx.restore();
 },
 drawLine: function(surf, x1, y1, x2, y2, cssColor) {
  x1 = x1 << 16 >> 16;
  y1 = y1 << 16 >> 16;
  x2 = x2 << 16 >> 16;
  y2 = y2 << 16 >> 16;
  var surfData = SDL.surfaces[surf];
  assert(!surfData.locked);
  surfData.ctx.save();
  surfData.ctx.strokeStyle = cssColor;
  surfData.ctx.beginPath();
  surfData.ctx.moveTo(x1, y1);
  surfData.ctx.lineTo(x2, y2);
  surfData.ctx.stroke();
  surfData.ctx.restore();
 },
 drawEllipse: function(surf, x, y, rx, ry, action, cssColor) {
  x = x << 16 >> 16;
  y = y << 16 >> 16;
  rx = rx << 16 >> 16;
  ry = ry << 16 >> 16;
  var surfData = SDL.surfaces[surf];
  assert(!surfData.locked);
  surfData.ctx.save();
  surfData.ctx.beginPath();
  surfData.ctx.translate(x, y);
  surfData.ctx.scale(rx, ry);
  surfData.ctx.arc(0, 0, 1, 0, 2 * Math.PI);
  surfData.ctx.restore();
  surfData.ctx.save();
  surfData.ctx[action + "Style"] = cssColor;
  surfData.ctx[action]();
  surfData.ctx.restore();
 },
 drawFilledText: function(surf, text, x, y, cssColor) {
  text = UTF8ToString(text);
  x = x << 16 >> 16;
  y = y << 16 >> 16;
  var surfData = SDL.surfaces[surf];
  assert(!surfData.locked);
  surfData.ctx.save();
  surfData.ctx.font = "30px Monospace";
  surfData.ctx.fillStyle = cssColor;
  surfData.ctx.fillText(text, x, y);
  surfData.ctx.restore();
 },
 translateColorToCSSRGBA: function(rgba) {
  var ret = "rgba(" + (rgba >>> 24) + "," + (rgba >> 16 & 255) + "," + (rgba >> 8 & 255) + "," + (rgba & 255) + ")";
  return ret;
 }
};

function _boxColor(surf, x1, y1, x2, y2, color) {
 return SDL_gfx.drawRectangle(surf, x1, y1, x2, y2, "fill", SDL_gfx.translateColorToCSSRGBA(color), color & 255);
}

function _emscripten_get_heap_size() {
 return TOTAL_MEMORY;
}

function abortOnCannotGrowMemory(requestedSize) {
 abort("Cannot enlarge memory arrays to size " + requestedSize + " bytes. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + TOTAL_MEMORY + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ");
}

function _emscripten_resize_heap(requestedSize) {
 abortOnCannotGrowMemory(requestedSize);
}

function _filledEllipseColor(surf, x, y, rx, ry, color) {
 return SDL_gfx.drawEllipse(surf, x, y, rx, ry, "fill", SDL_gfx.translateColorToCSSRGBA(color));
}

function _filledTextColor(surf, text, x, y, color) {
 return SDL_gfx.drawFilledText(surf, text, x, y, SDL_gfx.translateColorToCSSRGBA(color));
}

function _emscripten_memcpy_big(dest, src, num) {
 HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
}

var PTHREAD_SPECIFIC = {};

function _pthread_getspecific(key) {
 return PTHREAD_SPECIFIC[key] || 0;
}

var PTHREAD_SPECIFIC_NEXT_KEY = 1;

function _pthread_key_create(key, destructor) {
 if (key == 0) {
  return ERRNO_CODES.EINVAL;
 }
 HEAP32[key >> 2] = PTHREAD_SPECIFIC_NEXT_KEY;
 PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
 PTHREAD_SPECIFIC_NEXT_KEY++;
 return 0;
}

function _pthread_once(ptr, func) {
 if (!_pthread_once.seen) _pthread_once.seen = {};
 if (ptr in _pthread_once.seen) return;
 dynCall_v(func);
 _pthread_once.seen[ptr] = 1;
}

function _pthread_setspecific(key, value) {
 if (!(key in PTHREAD_SPECIFIC)) {
  return ERRNO_CODES.EINVAL;
 }
 PTHREAD_SPECIFIC[key] = value;
 return 0;
}

FS.staticInit();

__ATINIT__.unshift(function() {
 if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
});

__ATMAIN__.push(function() {
 FS.ignorePermissions = false;
});

__ATEXIT__.push(function() {
 FS.quit();
});

__ATINIT__.unshift(function() {
 TTY.init();
});

__ATEXIT__.push(function() {
 TTY.shutdown();
});

if (ENVIRONMENT_IS_NODE) {
 var fs = require("fs");
 var NODEJS_PATH = require("path");
 NODEFS.staticInit();
}

Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
 err("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.");
 Module["requestFullScreen"] = Module["requestFullscreen"];
 Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice);
};

Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) {
 Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice);
};

Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
 Browser.requestAnimationFrame(func);
};

Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
 Browser.setCanvasSize(width, height, noUpdates);
};

Module["pauseMainLoop"] = function Module_pauseMainLoop() {
 Browser.mainLoop.pause();
};

Module["resumeMainLoop"] = function Module_resumeMainLoop() {
 Browser.mainLoop.resume();
};

Module["getUserMedia"] = function Module_getUserMedia() {
 Browser.getUserMedia();
};

Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
 return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes);
};

if (ENVIRONMENT_IS_NODE) {
 _emscripten_get_now = function _emscripten_get_now_actual() {
  var t = process["hrtime"]();
  return t[0] * 1e3 + t[1] / 1e6;
 };
} else if (typeof dateNow !== "undefined") {
 _emscripten_get_now = dateNow;
} else if (typeof self === "object" && self["performance"] && typeof self["performance"]["now"] === "function") {
 _emscripten_get_now = function() {
  return self["performance"]["now"]();
 };
} else if (typeof performance === "object" && typeof performance["now"] === "function") {
 _emscripten_get_now = function() {
  return performance["now"]();
 };
} else {
 _emscripten_get_now = Date.now;
}

var GLctx;

GL.init();

var ASSERTIONS = false;

function intArrayFromString(stringy, dontAddNull, length) {
 var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
 var u8array = new Array(len);
 var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
 if (dontAddNull) u8array.length = numBytesWritten;
 return u8array;
}

var asmGlobalArg = {
 "Math": Math,
 "Int8Array": Int8Array,
 "Int16Array": Int16Array,
 "Int32Array": Int32Array,
 "Uint8Array": Uint8Array,
 "Uint16Array": Uint16Array,
 "Float32Array": Float32Array,
 "Float64Array": Float64Array
};

var asmLibraryArg = {
 "a": abort,
 "b": setTempRet0,
 "c": getTempRet0,
 "d": _SDL_AudioQuit,
 "e": _SDL_GetTicks,
 "f": _SDL_Init,
 "g": _SDL_LockSurface,
 "h": _SDL_PollEvent,
 "i": _SDL_Quit,
 "j": _SDL_SetVideoMode,
 "k": _SDL_UpdateRect,
 "l": __ZSt18uncaught_exceptionv,
 "m": ___cxa_allocate_exception,
 "n": ___cxa_begin_catch,
 "o": ___cxa_find_matching_catch,
 "p": ___cxa_free_exception,
 "q": ___cxa_throw,
 "r": ___gxx_personality_v0,
 "s": ___resumeException,
 "t": ___setErrNo,
 "u": ___syscall140,
 "v": ___syscall146,
 "w": ___syscall221,
 "x": ___syscall3,
 "y": ___syscall5,
 "z": ___syscall54,
 "A": ___syscall6,
 "B": _abort,
 "C": _boxColor,
 "D": _emscripten_get_heap_size,
 "E": _emscripten_get_now,
 "F": _emscripten_memcpy_big,
 "G": _emscripten_resize_heap,
 "H": _emscripten_set_main_loop,
 "I": _emscripten_set_main_loop_timing,
 "J": _filledEllipseColor,
 "K": _filledTextColor,
 "L": _getWindowHeight,
 "M": _getWindowWidth,
 "N": _pthread_getspecific,
 "O": _pthread_key_create,
 "P": _pthread_once,
 "Q": _pthread_setspecific,
 "R": abortOnCannotGrowMemory,
 "S": tempDoublePtr,
 "T": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.S|0,i=env.T|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.ceil,s=global.Math.imul,t=global.Math.clz32,u=env.a,v=env.b,w=env.c,x=env.d,y=env.e,z=env.f,A=env.g,B=env.h,C=env.i,D=env.j,E=env.k,F=env.l,G=env.m,H=env.n,I=env.o,J=env.p,K=env.q,L=env.r,M=env.s,N=env.t,O=env.u,P=env.v,Q=env.w,R=env.x,S=env.y,T=env.z,U=env.A,V=env.B,W=env.C,X=env.D,Y=env.E,Z=env.F,_=env.G,$=env.H,aa=env.I,ba=env.J,ca=env.K,da=env.L,ea=env.M,fa=env.N,ga=env.O,ha=env.P,ia=env.Q,ja=env.R,ka=10144,la=5253024,ma=0.0;
// EMSCRIPTEN_START_FUNCS
function ya(a){a=a|0;var b=0;b=ka;ka=ka+a|0;ka=ka+15&-16;return b|0}function za(){return ka|0}function Aa(a){a=a|0;ka=a}function Ba(a,b){a=a|0;b=b|0;ka=a;la=b}function Ca(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0;b=ka;ka=ka+432|0;d=b+336|0;e=b+288|0;f=b+240|0;g=b+192|0;h=b+144|0;i=b+96|0;j=b+48|0;k=b;c[e>>2]=0;l=e+4|0;c[l>>2]=0;m=e+8|0;c[m>>2]=0;n=Pc(16)|0;c[e>>2]=n;o=n+16|0;c[m>>2]=o;c[n>>2]=0;c[n+4>>2]=16750848;c[n+8>>2]=0;c[n+12>>2]=0;c[l>>2]=o;o=e+12|0;c[o>>2]=0;l=e+16|0;c[l>>2]=0;m=e+20|0;c[m>>2]=0;p=Pc(16)|0;c[o>>2]=p;o=p+16|0;c[m>>2]=o;c[p>>2]=0;c[p+4>>2]=16750848;c[p+8>>2]=0;c[p+12>>2]=0;c[l>>2]=o;o=e+24|0;c[o>>2]=0;l=e+28|0;c[l>>2]=0;m=e+32|0;c[m>>2]=0;q=Pc(16)|0;c[o>>2]=q;o=q+16|0;c[m>>2]=o;c[q>>2]=0;c[q+4>>2]=16750848;c[q+8>>2]=16750848;c[q+12>>2]=0;c[l>>2]=o;o=e+36|0;c[o>>2]=0;l=e+40|0;c[l>>2]=0;m=e+44|0;c[m>>2]=0;r=Pc(16)|0;c[o>>2]=r;o=r+16|0;c[m>>2]=o;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;c[r+12>>2]=0;c[l>>2]=o;c[d>>2]=0;o=d+4|0;c[o>>2]=0;l=d+8|0;c[l>>2]=0;m=Pc(48)|0;c[o>>2]=m;c[d>>2]=m;c[l>>2]=m+48;c[m>>2]=0;l=m+4|0;c[l>>2]=0;s=m+8|0;c[s>>2]=0;t=Pc(16)|0;c[m>>2]=t;c[s>>2]=t+16;c[t>>2]=c[n>>2];c[t+4>>2]=c[n+4>>2];c[t+8>>2]=c[n+8>>2];c[t+12>>2]=c[n+12>>2];c[l>>2]=t+16;t=m+12|0;c[o>>2]=t;c[t>>2]=0;l=m+16|0;c[l>>2]=0;n=m+20|0;c[n>>2]=0;s=Pc(16)|0;c[t>>2]=s;c[n>>2]=s+16;c[s>>2]=c[p>>2];c[s+4>>2]=c[p+4>>2];c[s+8>>2]=c[p+8>>2];c[s+12>>2]=c[p+12>>2];c[l>>2]=s+16;s=m+24|0;c[o>>2]=s;c[s>>2]=0;l=m+28|0;c[l>>2]=0;p=m+32|0;c[p>>2]=0;n=Pc(16)|0;c[s>>2]=n;c[p>>2]=n+16;c[n>>2]=c[q>>2];c[n+4>>2]=c[q+4>>2];c[n+8>>2]=c[q+8>>2];c[n+12>>2]=c[q+12>>2];c[l>>2]=n+16;n=m+36|0;c[o>>2]=n;c[n>>2]=0;l=m+40|0;c[l>>2]=0;q=m+44|0;c[q>>2]=0;p=Pc(16)|0;c[n>>2]=p;c[q>>2]=p+16;c[p>>2]=c[r>>2];c[p+4>>2]=c[r+4>>2];c[p+8>>2]=c[r+8>>2];c[p+12>>2]=c[r+12>>2];c[l>>2]=p+16;c[o>>2]=m+48;m=d+12|0;c[f>>2]=0;o=f+4|0;c[o>>2]=0;p=f+8|0;c[p>>2]=0;l=Pc(16)|0;c[f>>2]=l;r=l+16|0;c[p>>2]=r;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=16750848;c[l+12>>2]=0;c[o>>2]=r;r=f+12|0;c[r>>2]=0;o=f+16|0;c[o>>2]=0;p=f+20|0;c[p>>2]=0;q=Pc(16)|0;c[r>>2]=q;r=q+16|0;c[p>>2]=r;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=16750848;c[q+12>>2]=0;c[o>>2]=r;r=f+24|0;c[r>>2]=0;o=f+28|0;c[o>>2]=0;p=f+32|0;c[p>>2]=0;n=Pc(16)|0;c[r>>2]=n;r=n+16|0;c[p>>2]=r;c[n>>2]=0;c[n+4>>2]=16750848;c[n+8>>2]=16750848;c[n+12>>2]=0;c[o>>2]=r;r=f+36|0;c[r>>2]=0;o=f+40|0;c[o>>2]=0;p=f+44|0;c[p>>2]=0;s=Pc(16)|0;c[r>>2]=s;r=s+16|0;c[p>>2]=r;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[o>>2]=r;c[m>>2]=0;r=d+16|0;c[r>>2]=0;o=d+20|0;c[o>>2]=0;p=Pc(48)|0;c[r>>2]=p;c[m>>2]=p;c[o>>2]=p+48;c[p>>2]=0;o=p+4|0;c[o>>2]=0;m=p+8|0;c[m>>2]=0;t=Pc(16)|0;c[p>>2]=t;c[m>>2]=t+16;c[t>>2]=c[l>>2];c[t+4>>2]=c[l+4>>2];c[t+8>>2]=c[l+8>>2];c[t+12>>2]=c[l+12>>2];c[o>>2]=t+16;t=p+12|0;c[r>>2]=t;c[t>>2]=0;o=p+16|0;c[o>>2]=0;l=p+20|0;c[l>>2]=0;m=Pc(16)|0;c[t>>2]=m;c[l>>2]=m+16;c[m>>2]=c[q>>2];c[m+4>>2]=c[q+4>>2];c[m+8>>2]=c[q+8>>2];c[m+12>>2]=c[q+12>>2];c[o>>2]=m+16;m=p+24|0;c[r>>2]=m;c[m>>2]=0;o=p+28|0;c[o>>2]=0;q=p+32|0;c[q>>2]=0;l=Pc(16)|0;c[m>>2]=l;c[q>>2]=l+16;c[l>>2]=c[n>>2];c[l+4>>2]=c[n+4>>2];c[l+8>>2]=c[n+8>>2];c[l+12>>2]=c[n+12>>2];c[o>>2]=l+16;l=p+36|0;c[r>>2]=l;c[l>>2]=0;o=p+40|0;c[o>>2]=0;n=p+44|0;c[n>>2]=0;q=Pc(16)|0;c[l>>2]=q;c[n>>2]=q+16;c[q>>2]=c[s>>2];c[q+4>>2]=c[s+4>>2];c[q+8>>2]=c[s+8>>2];c[q+12>>2]=c[s+12>>2];c[o>>2]=q+16;c[r>>2]=p+48;p=d+24|0;c[g>>2]=0;r=g+4|0;c[r>>2]=0;q=g+8|0;c[q>>2]=0;o=Pc(16)|0;c[g>>2]=o;s=o+16|0;c[q>>2]=s;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;c[o+12>>2]=0;c[r>>2]=s;s=g+12|0;c[s>>2]=0;r=g+16|0;c[r>>2]=0;q=g+20|0;c[q>>2]=0;n=Pc(16)|0;c[s>>2]=n;s=n+16|0;c[q>>2]=s;c[n>>2]=0;c[n+4>>2]=16750848;c[n+8>>2]=0;c[n+12>>2]=0;c[r>>2]=s;s=g+24|0;c[s>>2]=0;r=g+28|0;c[r>>2]=0;q=g+32|0;c[q>>2]=0;l=Pc(16)|0;c[s>>2]=l;s=l+16|0;c[q>>2]=s;c[l>>2]=16750848;c[l+4>>2]=16750848;c[l+8>>2]=16750848;c[l+12>>2]=0;c[r>>2]=s;s=g+36|0;c[s>>2]=0;r=g+40|0;c[r>>2]=0;q=g+44|0;c[q>>2]=0;m=Pc(16)|0;c[s>>2]=m;s=m+16|0;c[q>>2]=s;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[r>>2]=s;c[p>>2]=0;s=d+28|0;c[s>>2]=0;r=d+32|0;c[r>>2]=0;q=Pc(48)|0;c[s>>2]=q;c[p>>2]=q;c[r>>2]=q+48;c[q>>2]=0;r=q+4|0;c[r>>2]=0;p=q+8|0;c[p>>2]=0;t=Pc(16)|0;c[q>>2]=t;c[p>>2]=t+16;c[t>>2]=c[o>>2];c[t+4>>2]=c[o+4>>2];c[t+8>>2]=c[o+8>>2];c[t+12>>2]=c[o+12>>2];c[r>>2]=t+16;t=q+12|0;c[s>>2]=t;c[t>>2]=0;r=q+16|0;c[r>>2]=0;o=q+20|0;c[o>>2]=0;p=Pc(16)|0;c[t>>2]=p;c[o>>2]=p+16;c[p>>2]=c[n>>2];c[p+4>>2]=c[n+4>>2];c[p+8>>2]=c[n+8>>2];c[p+12>>2]=c[n+12>>2];c[r>>2]=p+16;p=q+24|0;c[s>>2]=p;c[p>>2]=0;r=q+28|0;c[r>>2]=0;n=q+32|0;c[n>>2]=0;o=Pc(16)|0;c[p>>2]=o;c[n>>2]=o+16;c[o>>2]=c[l>>2];c[o+4>>2]=c[l+4>>2];c[o+8>>2]=c[l+8>>2];c[o+12>>2]=c[l+12>>2];c[r>>2]=o+16;o=q+36|0;c[s>>2]=o;c[o>>2]=0;r=q+40|0;c[r>>2]=0;l=q+44|0;c[l>>2]=0;n=Pc(16)|0;c[o>>2]=n;c[l>>2]=n+16;c[n>>2]=c[m>>2];c[n+4>>2]=c[m+4>>2];c[n+8>>2]=c[m+8>>2];c[n+12>>2]=c[m+12>>2];c[r>>2]=n+16;c[s>>2]=q+48;q=d+36|0;c[h>>2]=0;s=h+4|0;c[s>>2]=0;n=h+8|0;c[n>>2]=0;r=Pc(16)|0;c[h>>2]=r;m=r+16|0;c[n>>2]=m;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;c[r+12>>2]=0;c[s>>2]=m;m=h+12|0;c[m>>2]=0;s=h+16|0;c[s>>2]=0;n=h+20|0;c[n>>2]=0;l=Pc(16)|0;c[m>>2]=l;m=l+16|0;c[n>>2]=m;c[l>>2]=16750848;c[l+4>>2]=16750848;c[l+8>>2]=0;c[l+12>>2]=0;c[s>>2]=m;m=h+24|0;c[m>>2]=0;s=h+28|0;c[s>>2]=0;n=h+32|0;c[n>>2]=0;o=Pc(16)|0;c[m>>2]=o;m=o+16|0;c[n>>2]=m;c[o>>2]=0;c[o+4>>2]=16750848;c[o+8>>2]=16750848;c[o+12>>2]=0;c[s>>2]=m;m=h+36|0;c[m>>2]=0;s=h+40|0;c[s>>2]=0;n=h+44|0;c[n>>2]=0;p=Pc(16)|0;c[m>>2]=p;m=p+16|0;c[n>>2]=m;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[s>>2]=m;c[q>>2]=0;m=d+40|0;c[m>>2]=0;s=d+44|0;c[s>>2]=0;n=Pc(48)|0;c[m>>2]=n;c[q>>2]=n;c[s>>2]=n+48;c[n>>2]=0;s=n+4|0;c[s>>2]=0;q=n+8|0;c[q>>2]=0;t=Pc(16)|0;c[n>>2]=t;c[q>>2]=t+16;c[t>>2]=c[r>>2];c[t+4>>2]=c[r+4>>2];c[t+8>>2]=c[r+8>>2];c[t+12>>2]=c[r+12>>2];c[s>>2]=t+16;t=n+12|0;c[m>>2]=t;c[t>>2]=0;s=n+16|0;c[s>>2]=0;r=n+20|0;c[r>>2]=0;q=Pc(16)|0;c[t>>2]=q;c[r>>2]=q+16;c[q>>2]=c[l>>2];c[q+4>>2]=c[l+4>>2];c[q+8>>2]=c[l+8>>2];c[q+12>>2]=c[l+12>>2];c[s>>2]=q+16;q=n+24|0;c[m>>2]=q;c[q>>2]=0;s=n+28|0;c[s>>2]=0;l=n+32|0;c[l>>2]=0;r=Pc(16)|0;c[q>>2]=r;c[l>>2]=r+16;c[r>>2]=c[o>>2];c[r+4>>2]=c[o+4>>2];c[r+8>>2]=c[o+8>>2];c[r+12>>2]=c[o+12>>2];c[s>>2]=r+16;r=n+36|0;c[m>>2]=r;c[r>>2]=0;s=n+40|0;c[s>>2]=0;o=n+44|0;c[o>>2]=0;l=Pc(16)|0;c[r>>2]=l;c[o>>2]=l+16;c[l>>2]=c[p>>2];c[l+4>>2]=c[p+4>>2];c[l+8>>2]=c[p+8>>2];c[l+12>>2]=c[p+12>>2];c[s>>2]=l+16;c[m>>2]=n+48;n=d+48|0;c[i>>2]=0;m=i+4|0;c[m>>2]=0;l=i+8|0;c[l>>2]=0;s=Pc(16)|0;c[i>>2]=s;p=s+16|0;c[l>>2]=p;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[m>>2]=p;p=i+12|0;c[p>>2]=0;m=i+16|0;c[m>>2]=0;l=i+20|0;c[l>>2]=0;o=Pc(16)|0;c[p>>2]=o;p=o+16|0;c[l>>2]=p;c[o>>2]=0;c[o+4>>2]=16750848;c[o+8>>2]=16750848;c[o+12>>2]=0;c[m>>2]=p;p=i+24|0;c[p>>2]=0;m=i+28|0;c[m>>2]=0;l=i+32|0;c[l>>2]=0;r=Pc(16)|0;c[p>>2]=r;p=r+16|0;c[l>>2]=p;c[r>>2]=16750848;c[r+4>>2]=16750848;c[r+8>>2]=0;c[r+12>>2]=0;c[m>>2]=p;p=i+36|0;c[p>>2]=0;m=i+40|0;c[m>>2]=0;l=i+44|0;c[l>>2]=0;q=Pc(16)|0;c[p>>2]=q;p=q+16|0;c[l>>2]=p;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;c[q+12>>2]=0;c[m>>2]=p;c[n>>2]=0;p=d+52|0;c[p>>2]=0;m=d+56|0;c[m>>2]=0;l=Pc(48)|0;c[p>>2]=l;c[n>>2]=l;c[m>>2]=l+48;c[l>>2]=0;m=l+4|0;c[m>>2]=0;n=l+8|0;c[n>>2]=0;t=Pc(16)|0;c[l>>2]=t;c[n>>2]=t+16;c[t>>2]=c[s>>2];c[t+4>>2]=c[s+4>>2];c[t+8>>2]=c[s+8>>2];c[t+12>>2]=c[s+12>>2];c[m>>2]=t+16;t=l+12|0;c[p>>2]=t;c[t>>2]=0;m=l+16|0;c[m>>2]=0;s=l+20|0;c[s>>2]=0;n=Pc(16)|0;c[t>>2]=n;c[s>>2]=n+16;c[n>>2]=c[o>>2];c[n+4>>2]=c[o+4>>2];c[n+8>>2]=c[o+8>>2];c[n+12>>2]=c[o+12>>2];c[m>>2]=n+16;n=l+24|0;c[p>>2]=n;c[n>>2]=0;m=l+28|0;c[m>>2]=0;o=l+32|0;c[o>>2]=0;s=Pc(16)|0;c[n>>2]=s;c[o>>2]=s+16;c[s>>2]=c[r>>2];c[s+4>>2]=c[r+4>>2];c[s+8>>2]=c[r+8>>2];c[s+12>>2]=c[r+12>>2];c[m>>2]=s+16;s=l+36|0;c[p>>2]=s;c[s>>2]=0;m=l+40|0;c[m>>2]=0;r=l+44|0;c[r>>2]=0;o=Pc(16)|0;c[s>>2]=o;c[r>>2]=o+16;c[o>>2]=c[q>>2];c[o+4>>2]=c[q+4>>2];c[o+8>>2]=c[q+8>>2];c[o+12>>2]=c[q+12>>2];c[m>>2]=o+16;c[p>>2]=l+48;l=d+60|0;c[j>>2]=0;p=j+4|0;c[p>>2]=0;o=j+8|0;c[o>>2]=0;m=Pc(16)|0;c[j>>2]=m;q=m+16|0;c[o>>2]=q;c[m>>2]=0;c[m+4>>2]=0;c[m+8>>2]=0;c[m+12>>2]=0;c[p>>2]=q;q=j+12|0;c[q>>2]=0;p=j+16|0;c[p>>2]=0;o=j+20|0;c[o>>2]=0;r=Pc(16)|0;c[q>>2]=r;q=r+16|0;c[o>>2]=q;c[r>>2]=0;c[r+4>>2]=16750848;c[r+8>>2]=16750848;c[r+12>>2]=0;c[p>>2]=q;q=j+24|0;c[q>>2]=0;p=j+28|0;c[p>>2]=0;o=j+32|0;c[o>>2]=0;s=Pc(16)|0;c[q>>2]=s;q=s+16|0;c[o>>2]=q;c[s>>2]=0;c[s+4>>2]=16750848;c[s+8>>2]=16750848;c[s+12>>2]=0;c[p>>2]=q;q=j+36|0;c[q>>2]=0;p=j+40|0;c[p>>2]=0;o=j+44|0;c[o>>2]=0;n=Pc(16)|0;c[q>>2]=n;q=n+16|0;c[o>>2]=q;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;c[p>>2]=q;c[l>>2]=0;q=d+64|0;c[q>>2]=0;p=d+68|0;c[p>>2]=0;o=Pc(48)|0;c[q>>2]=o;c[l>>2]=o;c[p>>2]=o+48;c[o>>2]=0;p=o+4|0;c[p>>2]=0;l=o+8|0;c[l>>2]=0;t=Pc(16)|0;c[o>>2]=t;c[l>>2]=t+16;c[t>>2]=c[m>>2];c[t+4>>2]=c[m+4>>2];c[t+8>>2]=c[m+8>>2];c[t+12>>2]=c[m+12>>2];c[p>>2]=t+16;t=o+12|0;c[q>>2]=t;c[t>>2]=0;p=o+16|0;c[p>>2]=0;m=o+20|0;c[m>>2]=0;l=Pc(16)|0;c[t>>2]=l;c[m>>2]=l+16;c[l>>2]=c[r>>2];c[l+4>>2]=c[r+4>>2];c[l+8>>2]=c[r+8>>2];c[l+12>>2]=c[r+12>>2];c[p>>2]=l+16;l=o+24|0;c[q>>2]=l;c[l>>2]=0;p=o+28|0;c[p>>2]=0;r=o+32|0;c[r>>2]=0;m=Pc(16)|0;c[l>>2]=m;c[r>>2]=m+16;c[m>>2]=c[s>>2];c[m+4>>2]=c[s+4>>2];c[m+8>>2]=c[s+8>>2];c[m+12>>2]=c[s+12>>2];c[p>>2]=m+16;m=o+36|0;c[q>>2]=m;c[m>>2]=0;p=o+40|0;c[p>>2]=0;s=o+44|0;c[s>>2]=0;r=Pc(16)|0;c[m>>2]=r;c[s>>2]=r+16;c[r>>2]=c[n>>2];c[r+4>>2]=c[n+4>>2];c[r+8>>2]=c[n+8>>2];c[r+12>>2]=c[n+12>>2];c[p>>2]=r+16;c[q>>2]=o+48;o=d+72|0;c[k>>2]=0;q=k+4|0;c[q>>2]=0;r=k+8|0;c[r>>2]=0;p=Pc(16)|0;c[k>>2]=p;n=p+16|0;c[r>>2]=n;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;c[p+12>>2]=0;c[q>>2]=n;n=k+12|0;c[n>>2]=0;q=k+16|0;c[q>>2]=0;r=k+20|0;c[r>>2]=0;s=Pc(16)|0;c[n>>2]=s;n=s+16|0;c[r>>2]=n;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[q>>2]=n;n=k+24|0;c[n>>2]=0;q=k+28|0;c[q>>2]=0;r=k+32|0;c[r>>2]=0;m=Pc(16)|0;c[n>>2]=m;n=m+16|0;c[r>>2]=n;c[m>>2]=16750848;c[m+4>>2]=16750848;c[m+8>>2]=16750848;c[m+12>>2]=16750848;c[q>>2]=n;n=k+36|0;c[n>>2]=0;q=k+40|0;c[q>>2]=0;r=k+44|0;c[r>>2]=0;l=Pc(16)|0;c[n>>2]=l;n=l+16|0;c[r>>2]=n;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;c[l+12>>2]=0;c[q>>2]=n;c[o>>2]=0;n=d+76|0;c[n>>2]=0;q=d+80|0;c[q>>2]=0;r=Pc(48)|0;c[n>>2]=r;c[o>>2]=r;c[q>>2]=r+48;c[r>>2]=0;q=r+4|0;c[q>>2]=0;o=r+8|0;c[o>>2]=0;t=Pc(16)|0;c[r>>2]=t;c[o>>2]=t+16;c[t>>2]=c[p>>2];c[t+4>>2]=c[p+4>>2];c[t+8>>2]=c[p+8>>2];c[t+12>>2]=c[p+12>>2];c[q>>2]=t+16;t=r+12|0;c[n>>2]=t;c[t>>2]=0;q=r+16|0;c[q>>2]=0;p=r+20|0;c[p>>2]=0;o=Pc(16)|0;c[t>>2]=o;c[p>>2]=o+16;c[o>>2]=c[s>>2];c[o+4>>2]=c[s+4>>2];c[o+8>>2]=c[s+8>>2];c[o+12>>2]=c[s+12>>2];c[q>>2]=o+16;o=r+24|0;c[n>>2]=o;c[o>>2]=0;q=r+28|0;c[q>>2]=0;s=r+32|0;c[s>>2]=0;p=Pc(16)|0;c[o>>2]=p;c[s>>2]=p+16;c[p>>2]=c[m>>2];c[p+4>>2]=c[m+4>>2];c[p+8>>2]=c[m+8>>2];c[p+12>>2]=c[m+12>>2];c[q>>2]=p+16;p=r+36|0;c[n>>2]=p;c[p>>2]=0;q=r+40|0;c[q>>2]=0;m=r+44|0;c[m>>2]=0;s=Pc(16)|0;c[p>>2]=s;c[m>>2]=s+16;c[s>>2]=c[l>>2];c[s+4>>2]=c[l+4>>2];c[s+8>>2]=c[l+8>>2];c[s+12>>2]=c[l+12>>2];c[q>>2]=s+16;c[n>>2]=r+48;c[a>>2]=0;r=a+4|0;c[r>>2]=0;n=a+8|0;c[n>>2]=0;s=Pc(84)|0;c[r>>2]=s;c[a>>2]=s;c[n>>2]=s+84;Va(s,d);n=s+12|0;c[r>>2]=n;Va(n,d+12|0);n=s+24|0;c[r>>2]=n;Va(n,d+24|0);n=s+36|0;c[r>>2]=n;Va(n,d+36|0);n=s+48|0;c[r>>2]=n;Va(n,d+48|0);n=s+60|0;c[r>>2]=n;Va(n,d+60|0);n=s+72|0;c[r>>2]=n;Va(n,d+72|0);c[r>>2]=s+84;s=d+72|0;r=c[s>>2]|0;if(r|0){n=d+76|0;a=c[n>>2]|0;if((a|0)==(r|0))u=r;else{q=a;do{a=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[a+-8>>2]=l;Qc(l)}}while((q|0)!=(r|0));u=c[s>>2]|0}c[n>>2]=r;Qc(u)}u=d+60|0;r=c[u>>2]|0;if(r|0){n=d+64|0;s=c[n>>2]|0;if((s|0)==(r|0))v=r;else{q=s;do{s=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[s+-8>>2]=l;Qc(l)}}while((q|0)!=(r|0));v=c[u>>2]|0}c[n>>2]=r;Qc(v)}v=d+48|0;r=c[v>>2]|0;if(r|0){n=d+52|0;u=c[n>>2]|0;if((u|0)==(r|0))w=r;else{q=u;do{u=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[u+-8>>2]=l;Qc(l)}}while((q|0)!=(r|0));w=c[v>>2]|0}c[n>>2]=r;Qc(w)}w=d+36|0;r=c[w>>2]|0;if(r|0){n=d+40|0;v=c[n>>2]|0;if((v|0)==(r|0))x=r;else{q=v;do{v=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[v+-8>>2]=l;Qc(l)}}while((q|0)!=(r|0));x=c[w>>2]|0}c[n>>2]=r;Qc(x)}x=d+24|0;r=c[x>>2]|0;if(r|0){n=d+28|0;w=c[n>>2]|0;if((w|0)==(r|0))y=r;else{q=w;do{w=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[w+-8>>2]=l;Qc(l)}}while((q|0)!=(r|0));y=c[x>>2]|0}c[n>>2]=r;Qc(y)}y=d+12|0;r=c[y>>2]|0;if(r|0){n=d+16|0;x=c[n>>2]|0;if((x|0)==(r|0))z=r;else{q=x;do{x=q;q=q+-12|0;l=c[q>>2]|0;if(l|0){c[x+-8>>2]=l;Qc(l)}}while((q|0)!=(r|0));z=c[y>>2]|0}c[n>>2]=r;Qc(z)}z=c[d>>2]|0;if(z|0){r=d+4|0;n=c[r>>2]|0;if((n|0)==(z|0))A=z;else{y=n;do{n=y;y=y+-12|0;q=c[y>>2]|0;if(q|0){c[n+-8>>2]=q;Qc(q)}}while((y|0)!=(z|0));A=c[d>>2]|0}c[r>>2]=z;Qc(A)}A=c[k+36>>2]|0;if(A|0){c[k+40>>2]=A;Qc(A)}A=c[k+24>>2]|0;if(A|0){c[k+28>>2]=A;Qc(A)}A=c[k+12>>2]|0;if(A|0){c[k+16>>2]=A;Qc(A)}A=c[k>>2]|0;if(A|0){c[k+4>>2]=A;Qc(A)}A=c[j+36>>2]|0;if(A|0){c[j+40>>2]=A;Qc(A)}A=c[j+24>>2]|0;if(A|0){c[j+28>>2]=A;Qc(A)}A=c[j+12>>2]|0;if(A|0){c[j+16>>2]=A;Qc(A)}A=c[j>>2]|0;if(A|0){c[j+4>>2]=A;Qc(A)}A=c[i+36>>2]|0;if(A|0){c[i+40>>2]=A;Qc(A)}A=c[i+24>>2]|0;if(A|0){c[i+28>>2]=A;Qc(A)}A=c[i+12>>2]|0;if(A|0){c[i+16>>2]=A;Qc(A)}A=c[i>>2]|0;if(A|0){c[i+4>>2]=A;Qc(A)}A=c[h+36>>2]|0;if(A|0){c[h+40>>2]=A;Qc(A)}A=c[h+24>>2]|0;if(A|0){c[h+28>>2]=A;Qc(A)}A=c[h+12>>2]|0;if(A|0){c[h+16>>2]=A;Qc(A)}A=c[h>>2]|0;if(A|0){c[h+4>>2]=A;Qc(A)}A=c[g+36>>2]|0;if(A|0){c[g+40>>2]=A;Qc(A)}A=c[g+24>>2]|0;if(A|0){c[g+28>>2]=A;Qc(A)}A=c[g+12>>2]|0;if(A|0){c[g+16>>2]=A;Qc(A)}A=c[g>>2]|0;if(A|0){c[g+4>>2]=A;Qc(A)}A=c[f+36>>2]|0;if(A|0){c[f+40>>2]=A;Qc(A)}A=c[f+24>>2]|0;if(A|0){c[f+28>>2]=A;Qc(A)}A=c[f+12>>2]|0;if(A|0){c[f+16>>2]=A;Qc(A)}A=c[f>>2]|0;if(A|0){c[f+4>>2]=A;Qc(A)}A=c[e+36>>2]|0;if(A|0){c[e+40>>2]=A;Qc(A)}A=c[e+24>>2]|0;if(A|0){c[e+28>>2]=A;Qc(A)}A=c[e+12>>2]|0;if(A|0){c[e+16>>2]=A;Qc(A)}A=c[e>>2]|0;if(!A){ka=b;return}c[e+4>>2]=A;Qc(A);ka=b;return}function Da(){return 3889}function Ea(){return 4053}function Fa(){var a=0,b=0;a=c[1684]|0;if(!a){b=G(4)|0;c[b>>2]=3740;K(b|0,2856,6)}else{ra[c[(c[a>>2]|0)+24>>2]&31](a);return}}function Ga(){var a=0,b=0,d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0.0,p=0.0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,A=0,B=0,E=0;a=ka;ka=ka+144|0;b=a+40|0;d=a+24|0;e=a+80|0;h=a+68|0;i=a+32|0;j=a+112|0;k=a+16|0;l=a+64|0;m=a+8|0;n=a;o=+ea();p=+da();g[b>>3]=o;g[b+8>>3]=p;Fc(4218,b)|0;f[d>>2]=o;q=d+4|0;f[q>>2]=p;r=d;s=c[r>>2]|0;t=c[r+4>>2]|0;c[e>>2]=0;r=e+4|0;c[r>>2]=s;c[r+4>>2]=t;c[e+12>>2]=-1;r=Pc(512)|0;c[e+16>>2]=r;c[e+24>>2]=128;c[e+20>>2]=4096;ce(r|0,0,512)|0;c[h>>2]=0;r=h+4|0;c[r>>2]=0;c[h+8>>2]=0;u=Pc(280)|0;v=i;c[v>>2]=s;c[v+4>>2]=t;c[j>>2]=0;c[j+4>>2]=0;c[j+8>>2]=0;c[j+28>>2]=1;t=j+12|0;c[t>>2]=20;c[t+4>>2]=24;t=j+20|0;c[t>>2]=5;c[t+4>>2]=14;Ca(b);t=j+4|0;v=c[b+4>>2]|0;s=c[b+8>>2]|0;c[j>>2]=c[b>>2];c[t>>2]=v;c[j+8>>2]=s;c[b>>2]=c[i>>2];c[b+4>>2]=c[i+4>>2];Ha(u,b,-1,h,j);i=c[j>>2]|0;if(i|0){s=c[t>>2]|0;if((s|0)==(i|0))w=i;else{v=s;do{s=v;v=v+-12|0;x=c[v>>2]|0;if(x|0){y=s+-8|0;s=c[y>>2]|0;if((s|0)==(x|0))A=x;else{B=s;do{s=B;B=B+-12|0;E=c[B>>2]|0;if(E|0){c[s+-8>>2]=E;Qc(E)}}while((B|0)!=(x|0));A=c[v>>2]|0}c[y>>2]=x;Qc(A)}}while((v|0)!=(i|0));w=c[j>>2]|0}c[t>>2]=i;Qc(w)}w=Pc(216)|0;i=d;t=c[i+4>>2]|0;j=k;c[j>>2]=c[i>>2];c[j+4>>2]=t;c[b>>2]=c[k>>2];c[b+4>>2]=c[k+4>>2];Ia(w,b,-1,h,u);c[e>>2]=w;u=c[(c[w>>2]|0)+20>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;ua[u&3](w,b,d);z(32)|0;c[l>>2]=D(~~+f[d>>2]|0,~~+f[q>>2]|0,32,0)|0;q=m;c[q>>2]=0;c[q+4>>2]=0;g[n>>3]=+Y();q=b+16|0;d=Pc(20)|0;c[d>>2]=3072;c[d+4>>2]=e;c[d+8>>2]=m;c[d+12>>2]=l;c[d+16>>2]=n;c[q>>2]=d;yb(b,6720);d=c[q>>2]|0;if((b|0)!=(d|0)){if(d|0)ra[c[(c[d>>2]|0)+20>>2]&31](d)}else ra[c[(c[d>>2]|0)+16>>2]&31](d);$(2,0,1);C();d=c[h>>2]|0;if(d|0){c[r>>2]=d;Qc(d)}d=c[e+16>>2]|0;if(!d){ka=a;return 1}Qc(d);ka=a;return 1}function Ha(b,d,e,h,i){b=b|0;d=d|0;e=e|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0.0,P=0.0,Q=0.0,R=0.0,S=0.0,T=0.0,U=0,V=0,W=0,X=0,Y=0,Z=0;j=ka;ka=ka+304|0;k=j+232|0;l=j+224|0;m=j+136|0;n=j+128|0;o=j+56|0;p=j+48|0;q=j+40|0;r=j+32|0;t=j+24|0;u=j+16|0;v=j;w=d;d=c[w>>2]|0;x=c[w+4>>2]|0;w=b+4|0;c[w>>2]=h;y=b+8|0;c[y>>2]=d;c[y+4>>2]=x;c[b+16>>2]=e;c[b>>2]=3008;e=b+24|0;g[e>>3]=200.0;x=b+40|0;y=b+96|0;d=b+32|0;z=d+64|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(z|0));f[y>>2]=-1.0;y=b+100|0;A=b+128|0;B=b+184|0;d=y;z=d+84|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(z|0));f[B>>2]=-1.0;c[b+188>>2]=0;c[b+192>>2]=0;B=b+196|0;c[B>>2]=1;C=b+200|0;c[C>>2]=0;D=b+204|0;c[D>>2]=0;Ua(b+208|0,i);E=b+220|0;F=i+12|0;c[E>>2]=c[F>>2];c[E+4>>2]=c[F+4>>2];c[E+8>>2]=c[F+8>>2];c[E+12>>2]=c[F+12>>2];c[E+16>>2]=c[F+16>>2];F=b+240|0;c[F>>2]=0;c[F+4>>2]=0;c[F+8>>2]=0;c[F+12>>2]=0;c[F+16>>2]=0;F=i+20|0;E=c[F+4>>2]|0;G=b+260|0;c[G>>2]=c[F>>2];c[G+4>>2]=E;E=b+268|0;c[E>>2]=0;c[b+272>>2]=0;f[n>>2]=.5;f[n+4>>2]=.5;f[o>>2]=0.0;f[o+4>>2]=0.0;f[p>>2]=.5;f[p+4>>2]=.800000011920929;f[q>>2]=0.0;f[q+4>>2]=0.0;f[r>>2]=.5;f[r+4>>2]=.5833333134651184;G=c[i+16>>2]|0;c[t>>2]=c[i+12>>2];c[t+4>>2]=G;f[u>>2]=15.0;f[u+4>>2]=15.0;c[l>>2]=c[t>>2];c[l+4>>2]=c[t+4>>2];c[k>>2]=c[u>>2];c[k+4>>2]=c[u+4>>2];Ka(m,n,o,p,q,r,l,k,2.0,h);d=x;x=m;z=d+68|0;do{c[d>>2]=c[x>>2];d=d+4|0;x=x+4|0}while((d|0)<(z|0));r=m+68|0;q=c[r+4>>2]|0;p=b+108|0;c[p>>2]=c[r>>2];c[p+4>>2]=q;q=b+116|0;p=c[q>>2]|0;if(!p){H=b+124|0;I=b+120|0}else{r=b+120|0;c[r>>2]=p;Qc(p);p=b+124|0;c[p>>2]=0;c[r>>2]=0;c[q>>2]=0;H=p;I=r}c[q>>2]=c[m+76>>2];c[I>>2]=c[m+80>>2];c[H>>2]=c[m+84>>2];f[l>>2]=1.0;f[l+4>>2]=.1666666716337204;f[m>>2]=20.0;f[m+4>>2]=0.0;f[n>>2]=0.0;f[n+4>>2]=0.0;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;a[o+11>>0]=5;a[o>>0]=a[4301]|0;a[o+1>>0]=a[4302]|0;a[o+2>>0]=a[4303]|0;a[o+3>>0]=a[4304]|0;a[o+4>>0]=a[4305]|0;a[o+5>>0]=0;H=o+12|0;c[H>>2]=0;c[H+4>>2]=0;c[H+8>>2]=0;a[H+11>>0]=1;a[H>>0]=49;a[H+1>>0]=0;H=o+24|0;c[H>>2]=0;c[H+4>>2]=0;c[H+8>>2]=0;a[H+11>>0]=5;a[H>>0]=a[4307]|0;a[H+1>>0]=a[4308]|0;a[H+2>>0]=a[4309]|0;a[H+3>>0]=a[4310]|0;a[H+4>>0]=a[4311]|0;a[H+5>>0]=0;H=o+36|0;c[H>>2]=0;c[H+4>>2]=0;c[H+8>>2]=0;a[H+11>>0]=1;a[H>>0]=48;a[H+1>>0]=0;H=o+48|0;c[H>>2]=0;c[H+4>>2]=0;c[H+8>>2]=0;a[H+11>>0]=5;a[H>>0]=a[4313]|0;a[H+1>>0]=a[4314]|0;a[H+2>>0]=a[4315]|0;a[H+3>>0]=a[4316]|0;a[H+4>>0]=a[4317]|0;a[H+5>>0]=0;H=o+60|0;c[H>>2]=0;c[H+4>>2]=0;c[H+8>>2]=0;a[H+11>>0]=1;a[H>>0]=48;a[H+1>>0]=0;c[v>>2]=0;H=v+4|0;c[H>>2]=0;I=v+8|0;c[I>>2]=0;q=Pc(72)|0;c[H>>2]=q;c[v>>2]=q;c[I>>2]=q+72;Yc(q,o);q=(c[H>>2]|0)+12|0;c[H>>2]=q;Yc(q,o+12|0);q=(c[H>>2]|0)+12|0;c[H>>2]=q;Yc(q,o+24|0);q=(c[H>>2]|0)+12|0;c[H>>2]=q;Yc(q,o+36|0);q=(c[H>>2]|0)+12|0;c[H>>2]=q;Yc(q,o+48|0);q=(c[H>>2]|0)+12|0;c[H>>2]=q;Yc(q,o+60|0);c[H>>2]=(c[H>>2]|0)+12;La(k,l,m,n,30.0,v,h);d=A;x=k;z=d+68|0;do{c[d>>2]=c[x>>2];d=d+4|0;x=x+4|0}while((d|0)<(z|0));x=c[v>>2]|0;if(x|0){d=c[H>>2]|0;if((d|0)==(x|0))J=x;else{z=d;do{z=z+-12|0;if((a[z+11>>0]|0)<0)Qc(c[z>>2]|0)}while((z|0)!=(x|0));J=c[v>>2]|0}c[H>>2]=x;Qc(J)}J=o+60|0;if((a[J+11>>0]|0)<0)Qc(c[J>>2]|0);J=o+48|0;if((a[J+11>>0]|0)<0)Qc(c[J>>2]|0);J=o+36|0;if((a[J+11>>0]|0)<0)Qc(c[J>>2]|0);J=o+24|0;if((a[J+11>>0]|0)<0)Qc(c[J>>2]|0);J=o+12|0;if((a[J+11>>0]|0)<0)Qc(c[J>>2]|0);if((a[o+11>>0]|0)<0)Qc(c[o>>2]|0);o=(((c[i+4>>2]|0)-(c[i>>2]|0)|0)/12|0)+-1|0;i=E;c[i>>2]=0;c[i+4>>2]=o;o=c[b+108>>2]|0;i=(o|0)>0;E=b+112|0;J=c[h>>2]|0;if(i){h=c[y>>2]|0;x=c[E>>2]|0;H=0;do{v=((s(x,H)|0)<<1)+h|0;z=J+(v*28|0)+16|0;d=J+((v+1|0)*28|0)+16|0;v=c[d>>2]&-256;c[z>>2]=c[z>>2]&-256;c[d>>2]=v;H=H+1|0}while((H|0)<(o|0));H=0;do{v=((s(x,H)|0)<<1)+2+h|0;d=J+(v*28|0)+16|0;z=J+((v+1|0)*28|0)+16|0;v=c[z>>2]&-256;c[d>>2]=c[d>>2]&-256;c[z>>2]=v;H=H+1|0}while((H|0)<(o|0));H=0;do{v=((s(x,H)|0)<<1)+4+h|0;z=J+(v*28|0)+16|0;d=J+((v+1|0)*28|0)+16|0;v=c[d>>2]&-256;c[z>>2]=c[z>>2]&-256;c[d>>2]=v;H=H+1|0}while((H|0)<(o|0));K=x}else K=c[E>>2]|0;if((K|0)<=0){Ma(b);L=c[C>>2]|0;M=(L>>>0)/10|0;N=M+1|0;c[B>>2]=N;O=+(N>>>0);P=O;Q=P+-1.0;R=Q*.6666666666666666;S=R+1.0;T=700.0/S;g[e>>3]=T;U=c[w>>2]|0;db(A,N,0,1,U);V=c[C>>2]|0;W=c[w>>2]|0;db(A,V,0,3,W);X=c[D>>2]|0;Y=c[w>>2]|0;db(A,X,0,5,Y);ka=j;return}E=b+264|0;if(!i){Ma(b);L=c[C>>2]|0;M=(L>>>0)/10|0;N=M+1|0;c[B>>2]=N;O=+(N>>>0);P=O;Q=P+-1.0;R=Q*.6666666666666666;S=R+1.0;T=700.0/S;g[e>>3]=T;U=c[w>>2]|0;db(A,N,0,1,U);V=c[C>>2]|0;W=c[w>>2]|0;db(A,V,0,3,W);X=c[D>>2]|0;Y=c[w>>2]|0;db(A,X,0,5,Y);ka=j;return}i=c[b+260>>2]|0;x=c[y>>2]|0;y=c[c[w>>2]>>2]|0;H=0;do{J=0;do{if((J|0)<(i|0))Z=-1431655936;else Z=(J|0)>(c[E>>2]|0)?-1431655936:-572662528;h=y+((((s(J,K)|0)+H<<1)+x|0)*28|0)+16|0;c[h>>2]=c[h>>2]&255|Z;J=J+1|0}while((J|0)!=(o|0));H=H+1|0}while((H|0)!=(K|0));Ma(b);L=c[C>>2]|0;M=(L>>>0)/10|0;N=M+1|0;c[B>>2]=N;O=+(N>>>0);P=O;Q=P+-1.0;R=Q*.6666666666666666;S=R+1.0;T=700.0/S;g[e>>3]=T;U=c[w>>2]|0;db(A,N,0,1,U);V=c[C>>2]|0;W=c[w>>2]|0;db(A,V,0,3,W);X=c[D>>2]|0;Y=c[w>>2]|0;db(A,X,0,5,Y);ka=j;return}function Ia(b,d,e,g,h){b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0.0;i=ka;ka=ka+128|0;j=i+36|0;k=i+24|0;l=i+16|0;m=i+8|0;n=i;o=d;p=c[o>>2]|0;q=c[o+4>>2]|0;c[b+4>>2]=g;o=b+8|0;c[o>>2]=p;c[o+4>>2]=q;c[b+16>>2]=e;c[b>>2]=3040;e=b+80|0;o=b+20|0;r=o+60|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(r|0));f[e>>2]=-1.0;e=b+84|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;c[e+16>>2]=0;c[e+20>>2]=0;c[e+24>>2]=0;a[e+28>>0]=0;e=b+116|0;s=b+172|0;o=e;r=o+56|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(r|0));f[s>>2]=-1.0;s=b+176|0;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;c[s+12>>2]=0;c[s+16>>2]=0;c[s+20>>2]=0;c[s+24>>2]=0;a[s+28>>0]=0;c[b+212>>2]=h;c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;h=k+11|0;a[h>>0]=5;a[k>>0]=a[4684]|0;a[k+1>>0]=a[4685]|0;a[k+2>>0]=a[4686]|0;a[k+3>>0]=a[4687]|0;a[k+4>>0]=a[4688]|0;a[k+5>>0]=0;f[l>>2]=1.0;f[l+4>>2]=0.0;f[m>>2]=-10.0;f[m+4>>2]=10.0;f[n>>2]=1.0;f[n+4>>2]=0.0;qb(j,k,l,m,n,30.0,-1431633921,g);s=b+24|0;o=s;t=j;r=o+88|0;do{c[o>>2]=c[t>>2];o=o+4|0;t=t+4|0}while((o|0)<(r|0));a[s+88>>0]=a[j+88>>0]|0;if((a[h>>0]|0)<0)Qc(c[k>>2]|0);h=g+4|0;s=c[h>>2]|0;c[b+208>>2]=(s-(c[g>>2]|0)|0)/28|0;u=-+f[d+4>>2];c[j>>2]=0;f[j+4>>2]=u;d=j+8|0;c[d>>2]=p;c[d+4>>2]=q;c[j+16>>2]=-154;c[j+24>>2]=1;if((c[g+8>>2]|0)>>>0>s>>>0){q=s;c[q>>2]=c[j>>2];c[q+4>>2]=c[j+4>>2];c[q+8>>2]=c[j+8>>2];c[q+12>>2]=c[j+12>>2];c[q+16>>2]=c[j+16>>2];c[q+20>>2]=c[j+20>>2];c[q+24>>2]=c[j+24>>2];c[h>>2]=(c[h>>2]|0)+28}else Wa(g,j);c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;h=k+11|0;a[h>>0]=6;a[k>>0]=a[4690]|0;a[k+1>>0]=a[4691]|0;a[k+2>>0]=a[4692]|0;a[k+3>>0]=a[4693]|0;a[k+4>>0]=a[4694]|0;a[k+5>>0]=a[4695]|0;a[k+6>>0]=0;f[l>>2]=.5;f[l+4>>2]=.5;f[m>>2]=0.0;f[m+4>>2]=u;f[n>>2]=.5;f[n+4>>2]=.5;qb(j,k,l,m,n,30.0,-1431633921,g);o=e;t=j;r=o+88|0;do{c[o>>2]=c[t>>2];o=o+4|0;t=t+4|0}while((o|0)<(r|0));a[e+88>>0]=a[j+88>>0]|0;if((a[h>>0]|0)>=0){ka=i;return}Qc(c[k>>2]|0);ka=i;return}function Ja(a){a=a|0;H(a|0)|0;Ed()}function Ka(a,b,d,e,g,h,i,j,k,l){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;i=i|0;j=j|0;k=+k;l=l|0;var m=0,n=0,o=0,p=0,q=0,r=0.0,s=0,t=0.0,u=0,v=0,w=0,x=0,y=0,z=0,A=0.0,B=0.0,C=0.0,D=0.0,E=0,F=0,G=0.0,H=0.0,I=0.0,J=0.0,K=0.0,L=0.0,M=0.0,N=0,O=0,P=0.0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0.0,X=0,Y=0.0,Z=0,_=0;m=ka;ka=ka+32|0;n=m;c[a>>2]=0;c[a+4>>2]=0;c[a+8>>2]=0;c[a+12>>2]=0;o=b;b=c[o+4>>2]|0;p=a+16|0;c[p>>2]=c[o>>2];c[p+4>>2]=b;b=e;e=c[b+4>>2]|0;p=a+24|0;c[p>>2]=c[b>>2];c[p+4>>2]=e;e=d;d=c[e+4>>2]|0;p=a+32|0;c[p>>2]=c[e>>2];c[p+4>>2]=d;d=g;g=c[d+4>>2]|0;p=a+40|0;c[p>>2]=c[d>>2];c[p+4>>2]=g;g=h;h=c[g+4>>2]|0;p=a+48|0;c[p>>2]=c[g>>2];c[p+4>>2]=h;h=a+56|0;f[h>>2]=-1.0;c[a+60>>2]=0;c[a+64>>2]=0;p=i;g=c[p>>2]|0;d=c[p+4>>2]|0;p=a+68|0;c[p>>2]=g;c[p+4>>2]=d;c[a+76>>2]=0;c[a+80>>2]=0;c[a+84>>2]=0;d=l+4|0;p=((c[d>>2]|0)-(c[l>>2]|0)|0)/28|0;if((g|0)<=0){q=p;r=+f[j>>2];s=c[i+4>>2]|0;t=+f[j+4>>2];u=q+-1|0;v=a+60|0;w=v;x=w;c[x>>2]=p;y=w+4|0;z=y;c[z>>2]=u;A=+(g|0);B=r*A;C=+(s|0);D=t*C;E=a+8|0;f[E>>2]=B;F=a+12|0;f[F>>2]=D;G=A/C;f[h>>2]=G;ka=m;return}e=c[i+4>>2]|0;H=+f[j>>2];I=H*.5;J=+f[j+4>>2];K=J*.5;L=k;k=L*.5;M=(H*.5-k)*2.0;j=n+4|0;i=n+8|0;b=n+12|0;o=n+16|0;N=n+24|0;O=l+8|0;P=L*.75;Q=n+4|0;R=n+8|0;S=n+12|0;T=n+16|0;U=n+24|0;if((e|0)<=0){q=p;r=H;s=e;t=J;u=q+-1|0;v=a+60|0;w=v;x=w;c[x>>2]=p;y=w+4|0;z=y;c[z>>2]=u;A=+(g|0);B=r*A;C=+(s|0);D=t*C;E=a+8|0;f[E>>2]=B;F=a+12|0;f[F>>2]=D;G=A/C;f[h>>2]=G;ka=m;return}V=0;do{L=H*+(V|0)+I;W=P+L;X=0;do{Y=J*+(X|0)+K;f[n>>2]=L;f[j>>2]=Y;f[i>>2]=M;f[b>>2]=M;c[o>>2]=-572662273;c[N>>2]=0;Z=c[d>>2]|0;if(Z>>>0<(c[O>>2]|0)>>>0){c[Z>>2]=c[n>>2];c[Z+4>>2]=c[n+4>>2];c[Z+8>>2]=c[n+8>>2];c[Z+12>>2]=c[n+12>>2];c[Z+16>>2]=c[n+16>>2];c[Z+20>>2]=c[n+20>>2];c[Z+24>>2]=c[n+24>>2];Z=(c[d>>2]|0)+28|0;c[d>>2]=Z;_=Z}else{Wa(l,n);_=c[d>>2]|0}f[n>>2]=W;f[Q>>2]=k+Y;f[R>>2]=M;f[S>>2]=M;c[T>>2]=0;c[U>>2]=0;if(_>>>0<(c[O>>2]|0)>>>0){c[_>>2]=c[n>>2];c[_+4>>2]=c[n+4>>2];c[_+8>>2]=c[n+8>>2];c[_+12>>2]=c[n+12>>2];c[_+16>>2]=c[n+16>>2];c[_+20>>2]=c[n+20>>2];c[_+24>>2]=c[n+24>>2];c[d>>2]=(c[d>>2]|0)+28}else Wa(l,n);X=X+1|0}while((X|0)<(e|0));V=V+1|0}while((V|0)<(g|0));q=((c[d>>2]|0)-(c[l>>2]|0)|0)/28|0;r=H;s=e;t=J;u=q+-1|0;v=a+60|0;w=v;x=w;c[x>>2]=p;y=w+4|0;z=y;c[z>>2]=u;A=+(g|0);B=r*A;C=+(s|0);D=t*C;E=a+8|0;f[E>>2]=B;F=a+12|0;f[F>>2]=D;G=A/C;f[h>>2]=G;ka=m;return}function La(b,d,e,g,h,i,j){b=b|0;d=d|0;e=e|0;g=g|0;h=+h;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0.0,p=0,q=0.0,r=0.0,s=0.0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0.0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0;k=ka;ka=ka+32|0;l=k;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;c[b+12>>2]=0;m=d;d=c[m+4>>2]|0;n=b+16|0;c[n>>2]=c[m>>2];c[n+4>>2]=d;c[b+24>>2]=0;c[b+28>>2]=0;d=e;e=c[d+4>>2]|0;n=b+32|0;c[n>>2]=c[d>>2];c[n+4>>2]=e;e=b+40|0;c[e>>2]=0;n=b+44|0;c[n>>2]=0;d=g;g=c[d+4>>2]|0;m=b+48|0;c[m>>2]=c[d>>2];c[m+4>>2]=g;f[b+56>>2]=-1.0;c[b+60>>2]=0;c[b+64>>2]=0;g=j+4|0;m=((c[g>>2]|0)-(c[j>>2]|0)|0)/28|0;o=h*1.2;d=i+4|0;p=c[i>>2]|0;if((c[d>>2]|0)==(p|0)){q=0.0;r=0.0;s=r*o;t=b+8|0;f[t>>2]=q;u=b+12|0;f[u>>2]=s;f[e>>2]=q;f[n>>2]=s;v=c[g>>2]|0;w=c[j>>2]|0;x=v-w|0;y=(x|0)/28|0;z=b+60|0;A=z;B=A;c[B>>2]=m;C=A+4|0;D=C;c[D>>2]=y;ka=k;return}E=l+4|0;F=l+8|0;G=l+12|0;H=l+16|0;I=l+20|0;J=l+24|0;K=j+8|0;L=0;M=0.0;N=p;do{p=N;O=p+(L*12|0)|0;P=a[O+11>>0]|0;if(P<<24>>24<0)Q=c[p+(L*12|0)+4>>2]|0;else Q=P&255;R=+(Q>>>0)*h*.6;M=M<R?R:M;L=L+1|0;R=o*+(L|0);if(!(Ya(9260,O)|0)){P=c[2313]|0;p=(P-(c[2312]|0)|0)/12|0;S=P;if((c[2314]|0)==(S|0))Za(9248,O);else{Yc(S,O);c[2313]=(c[2313]|0)+12}c[(Xa(9260,O)|0)>>2]=p}p=c[(Xa(9260,O)|0)>>2]|0;f[l>>2]=0.0;f[E>>2]=R;f[F>>2]=h;f[G>>2]=h;c[H>>2]=255;c[I>>2]=p;c[J>>2]=2;p=c[g>>2]|0;if(p>>>0<(c[K>>2]|0)>>>0){c[p>>2]=c[l>>2];c[p+4>>2]=c[l+4>>2];c[p+8>>2]=c[l+8>>2];c[p+12>>2]=c[l+12>>2];c[p+16>>2]=c[l+16>>2];c[p+20>>2]=c[l+20>>2];c[p+24>>2]=c[l+24>>2];c[g>>2]=(c[g>>2]|0)+28}else Wa(j,l);N=c[i>>2]|0;T=((c[d>>2]|0)-N|0)/12|0}while(L>>>0<T>>>0);q=M;r=+(T>>>0);s=r*o;t=b+8|0;f[t>>2]=q;u=b+12|0;f[u>>2]=s;f[e>>2]=q;f[n>>2]=s;v=c[g>>2]|0;w=c[j>>2]|0;x=v-w|0;y=(x|0)/28|0;z=b+60|0;A=z;B=A;c[B>>2]=m;C=A+4|0;D=C;c[D>>2]=y;ka=k;return}function Ma(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0;b=ka;ka=ka+32|0;d=b+12|0;e=b;f=a+252|0;g=f;c[g>>2]=((c[a+108>>2]|0)/2|0)+-2;c[g+4>>2]=0;g=a+268|0;h=ab(g,6748,g)|0;Va(d,(c[a+208>>2]|0)+(h*12|0)|0);Va(e,d);h=f;f=c[h>>2]|0;g=c[h+4>>2]|0;h=e+4|0;i=c[h>>2]|0;j=c[e>>2]|0;k=j;l=i;if((i|0)!=(j|0)){m=a+100|0;n=a+112|0;o=c[c[a+4>>2]>>2]|0;p=(i-j|0)/12|0;i=0;do{q=c[k+(i*12|0)+4>>2]|0;r=c[k+(i*12|0)>>2]|0;t=r;if((q|0)!=(r|0)){u=i+g|0;v=q-r>>2;r=c[t>>2]|0;q=c[m>>2]|0;w=c[n>>2]|0;x=((s(w,f)|0)+u<<1)+q|0;if(!r)y=0;else y=c[o+(x*28|0)+16>>2]&255;c[o+((x+1|0)*28|0)+16>>2]=y|r<<8;if(v>>>0>1){r=1;do{x=c[t+(r<<2)>>2]|0;z=((s(r+f|0,w)|0)+u<<1)+q|0;if(!x)A=0;else A=c[o+(z*28|0)+16>>2]&255;c[o+((z+1|0)*28|0)+16>>2]=A|x<<8;r=r+1|0}while((r|0)!=(v|0))}}i=i+1|0}while(i>>>0<p>>>0)}if(j|0){if((l|0)==(k|0))B=j;else{j=l;do{l=j;j=j+-12|0;p=c[j>>2]|0;if(p|0){c[l+-8>>2]=p;Qc(p)}}while((j|0)!=(k|0));B=c[e>>2]|0}c[h>>2]=k;Qc(B)}B=a+240|0;if((B|0)!=(d|0))bb(B,c[d>>2]|0,c[d+4>>2]|0);B=c[d>>2]|0;if(!B){ka=b;return}a=d+4|0;k=c[a>>2]|0;if((k|0)==(B|0))C=B;else{h=k;do{k=h;h=h+-12|0;e=c[h>>2]|0;if(e|0){c[k+-8>>2]=e;Qc(e)}}while((h|0)!=(B|0));C=c[d>>2]|0}c[a>>2]=B;Qc(C);ka=b;return}function Na(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,h=0;d=a+200|0;e=(c[d>>2]|0)+b|0;c[d>>2]=e;f=((e>>>0)/10|0)+1|0;c[a+196>>2]=f;switch(b|0){case 1:{b=a+204|0;c[b>>2]=(c[b>>2]|0)+100;h=b;break}case 2:{b=a+204|0;c[b>>2]=(c[b>>2]|0)+300;h=b;break}case 3:{b=a+204|0;c[b>>2]=(c[b>>2]|0)+500;h=b;break}case 4:{b=a+204|0;c[b>>2]=(c[b>>2]|0)+800;h=b;break}case 5:{b=a+204|0;c[b>>2]=(c[b>>2]|0)+1100;h=b;break}case 6:{b=a+204|0;c[b>>2]=(c[b>>2]|0)+1500;h=b;break}default:h=a+204|0}g[a+24>>3]=700.0/((+(f>>>0)+-1.0)*.6666666666666666+1.0);b=a+128|0;e=a+4|0;db(b,f,0,1,c[e>>2]|0);db(b,c[d>>2]|0,0,3,c[e>>2]|0);db(b,c[h>>2]|0,0,5,c[e>>2]|0);return}function Oa(a,b,d){a=a|0;b=+b;d=d|0;var e=0,f=0,h=0,i=0.0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0;e=ka;ka=ka+16|0;f=e;h=(c[a+236>>2]|0)==1?52326:16750848;i=+g[a+24>>3];j=a+32|0;if(!(b-+g[j>>3]>((c[(c[d>>2]|0)+136>>2]&131072|0)==0?i:i/10.0))){ka=e;return}if(eb(a)|0){k=gb(a,h)|0;l=hb(a,h)|0;ib(a,-1,16750848);if(c[(c[d>>2]|0)+136>>2]&65536|0?!(k|(gb(a,h)|0)^1):0){jb(a,h);fb(a)}if(c[(c[d>>2]|0)+136>>2]&32768|0?!(l|(hb(a,h)|0)^1):0){kb(a,h);fb(a)}}else{h=a+112|0;l=c[h>>2]|0;if((l|0)>0){d=a+108|0;k=a+4|0;m=a+100|0;n=l;o=c[d>>2]|0;p=l;while(1){l=n;n=n+-1|0;if((o|0)>0){q=0;r=p;t=o;u=c[k>>2]|0;while(1){if(r>>>0>n>>>0&t>>>0>q>>>0){v=r;w=u}else{c[f>>2]=n;c[f+4>>2]=q;Fc(4345,f)|0;v=c[h>>2]|0;w=c[k>>2]|0}x=((s(v,q)|0)+n<<1)+(c[m>>2]|0)|0;y=x+1|0;z=(c[(c[u>>2]|0)+(y*28|0)+16>>2]|0)>>>0<256;A=c[w>>2]|0;if(z)B=0;else B=c[A+(x*28|0)+16>>2]&255;c[A+(y*28|0)+16>>2]=B|(z?0:13395456);q=q+1|0;z=c[d>>2]|0;if((q|0)>=(z|0)){C=v;D=z;break}else{r=v;t=z;u=w}}}else{C=p;D=o}if((l|0)<=1)break;else{o=D;p=C}}}fb(a);Ma(a)}g[j>>3]=b;ka=e;return}function Pa(a,b){a=a|0;b=b|0;return}function Qa(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=ka;ka=ka+32|0;e=d;f=d+16|0;g=c[a+236>>2]|0;h=(g|0)==1?52326:16750848;switch(b|0){case 32:{if(!(eb(a)|0)){ka=d;return}do{ib(a,-1,16750848);fb(a)}while(eb(a)|0);ka=d;return}case 1104:{if(!(gb(a,h)|0)){ka=d;return}jb(a,h);fb(a);ka=d;return}case 1103:{if(!(hb(a,h)|0)){ka=d;return}kb(a,h);fb(a);ka=d;return}case 1106:{switch(g|0){case 0:{g=a+252|0;h=a+240|0;b=a+244|0;if(!(lb(a,g,((c[b>>2]|0)-(c[h>>2]|0)|0)/12|0,16750848)|0)){ka=d;return}mb(a,g,((c[b>>2]|0)-(c[h>>2]|0)|0)/12|0,16750848);ka=d;return}case 1:{nb(f,a+40|0,52326,c[a+4>>2]|0);h=c[f>>2]|0;if(((h|0)>-1?(b=f+8|0,g=c[b>>2]|0,(g|0)>-1):0)?(i=c[f+4>>2]|0,j=c[f+12>>2]|0,c[e>>2]=h,c[e+4>>2]=i,c[e+8>>2]=g,c[e+12>>2]=j,Fc(4374,e)|0,lb(a,f,c[b>>2]|0,52326)|0):0){mb(a,f,c[b>>2]|0,52326);fb(a)}ka=d;return}default:{ka=d;return}}break}default:{ka=d;return}}}function Ra(a,b){a=a|0;b=b|0;return}function Sa(a,b){a=a|0;b=b|0;return}function Ta(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=a+40|0;f=a+4|0;pb(e,b,d,c[f>>2]|0);pb(a+128|0,e,a+48|0,c[f>>2]|0);return}function Ua(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0;c[a>>2]=0;d=a+4|0;c[d>>2]=0;e=a+8|0;c[e>>2]=0;f=b+4|0;g=(c[f>>2]|0)-(c[b>>2]|0)|0;h=(g|0)/12|0;if(!g)return;if(h>>>0>357913941)gd(a);i=Pc(g)|0;c[d>>2]=i;c[a>>2]=i;c[e>>2]=i+(h*12|0);h=c[b>>2]|0;b=c[f>>2]|0;if((h|0)==(b|0))return;f=h;h=i;do{Va(h,f);f=f+12|0;h=(c[d>>2]|0)+12|0;c[d>>2]=h}while((f|0)!=(b|0));return}function Va(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;c[a>>2]=0;d=a+4|0;c[d>>2]=0;e=a+8|0;c[e>>2]=0;f=b+4|0;g=(c[f>>2]|0)-(c[b>>2]|0)|0;h=(g|0)/12|0;if(!g)return;if(h>>>0>357913941)gd(a);i=Pc(g)|0;c[d>>2]=i;c[a>>2]=i;c[e>>2]=i+(h*12|0);h=c[b>>2]|0;b=c[f>>2]|0;if((h|0)==(b|0))return;f=h;h=i;while(1){c[h>>2]=0;i=h+4|0;c[i>>2]=0;e=h+8|0;c[e>>2]=0;a=f+4|0;g=(c[a>>2]|0)-(c[f>>2]|0)|0;j=g>>2;if(g|0){if(j>>>0>1073741823){k=8;break}l=Pc(g)|0;c[i>>2]=l;c[h>>2]=l;c[e>>2]=l+(j<<2);j=c[f>>2]|0;e=(c[a>>2]|0)-j|0;if((e|0)>0){ae(l|0,j|0,e|0)|0;c[i>>2]=l+(e>>>2<<2)}}f=f+12|0;e=(c[d>>2]|0)+12|0;c[d>>2]=e;if((f|0)==(b|0)){k=12;break}else h=e}if((k|0)==8)gd(h);else if((k|0)==12)return}function Wa(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/28|0;h=g+1|0;if(h>>>0>153391689)gd(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/28|0;k=j<<1;l=j>>>0<76695844?(k>>>0<h>>>0?h:k):153391689;do if(l)if(l>>>0>153391689){k=G(8)|0;Vc(k,4233);c[k>>2]=3864;K(k|0,2952,13)}else{m=Pc(l*28|0)|0;break}else m=0;while(0);k=m+(g*28|0)|0;c[k>>2]=c[b>>2];c[k+4>>2]=c[b+4>>2];c[k+8>>2]=c[b+8>>2];c[k+12>>2]=c[b+12>>2];c[k+16>>2]=c[b+16>>2];c[k+20>>2]=c[b+20>>2];c[k+24>>2]=c[b+24>>2];b=k+(((f|0)/-28|0)*28|0)|0;if((f|0)>0)ae(b|0,e|0,f|0)|0;c[a>>2]=b;c[d>>2]=k+28;c[i>>2]=m+(l*28|0);if(!e)return;Qc(e);return}function Xa(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=s(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(s(l>>>24^l,1540483477)|0)^(s(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{t=o;q=8;break}default:u=o}if((q|0)==7){t=d[n+1>>0]<<8^p;q=8}if((q|0)==8)u=s(t^d[n>>0],1540483477)|0;n=s(u>>>13^u,1540483477)|0;u=n>>>15^n;n=b+4|0;t=c[n>>2]|0;p=(t|0)==0;a:do if(!p){o=t+-1|0;m=(o&t|0)==0;if(!m)if(u>>>0<t>>>0)v=u;else v=(u>>>0)%(t>>>0)|0;else v=u&o;h=c[(c[b>>2]|0)+(v<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(yc(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(u|0)){if(o>>>0<t>>>0)D=o;else D=(o>>>0)%(t>>>0)|0;if((D|0)!=(v|0)){w=v;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(u|0)){if(h>>>0<t>>>0)E=h;else E=(h>>>0)%(t>>>0)|0;if((E|0)!=(v|0)){w=v;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(yc(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=v}else w=0;while(0);v=Pc(24)|0;Yc(v+8|0,e);c[v+20>>2]=0;c[v+4>>2]=u;c[v>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(t>>>0)<F){i=t<<1|(t>>>0<3|(t+-1&t|0)!=0)&1;j=~~+r(+(F/G))>>>0;_a(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&u;break}if(u>>>0<i>>>0){H=i;I=u}else{H=i;I=(u>>>0)%(i>>>0)|0}}else{H=t;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){t=b+8|0;c[v>>2]=c[t>>2];c[t>>2]=v;c[w>>2]=t;t=c[v>>2]|0;if(t|0){w=c[t+4>>2]|0;t=H+-1|0;if(t&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&t;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[v>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=v;c[e>>2]=(c[e>>2]|0)+1;x=v;y=x+20|0;return y|0}function Ya(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=s(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(s(j>>>24^j,1540483477)|0)^(s(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=s(p^d[l>>0],1540483477)|0;l=s(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)t=q;else t=(q>>>0)%(l>>>0)|0;else t=q&p;m=c[(c[b>>2]|0)+(t<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(t|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;u=f?g:k;v=g&255;if(f){if(m){r=n;o=45;break a}if(!(yc(u,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==v<<24>>24){v=k;k=j;j=h;do{k=k+-1|0;v=v+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[v>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;v=e&255;if(((j?c[n+12>>2]|0:v)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;u=e&255;if(j){if(m){r=n;o=45;break b}if(!(yc(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==u<<24>>24){u=p;p=v;v=h;do{p=p+-1|0;u=u+1|0;if(!p){r=n;o=45;break b}v=v+1|0}while((a[u>>0]|0)==(a[v>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(t|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function Za(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)gd(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=G(8)|0;Vc(f,4233);c[f>>2]=3864;K(f|0,2952,13)}else{l=Pc(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;Yc(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)Qc(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;Qc(n);return}function _a(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=Nc(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){$a(a,d);return}if(d>>>0>=b>>>0)return;e=~~+r(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(t(e+-1|0)|0);h=e>>>0<2?e:g}else h=Nc(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;$a(a,e);return}function $a(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)Qc(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=G(8)|0;Vc(f,4233);c[f>>2]=3864;K(f|0,2952,13)}f=Pc(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)Qc(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?yc(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function ab(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(t(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function bb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;e=(d-b|0)/12|0;f=a+8|0;g=c[f>>2]|0;h=c[a>>2]|0;i=h;if(e>>>0>((g-h|0)/12|0)>>>0){if(!h)j=g;else{g=a+4|0;k=c[g>>2]|0;if((k|0)==(i|0))l=h;else{m=k;do{k=m;m=m+-12|0;n=c[m>>2]|0;if(n|0){c[k+-8>>2]=n;Qc(n)}}while((m|0)!=(i|0));l=c[a>>2]|0}c[g>>2]=i;Qc(l);c[f>>2]=0;c[g>>2]=0;c[a>>2]=0;j=0}if(e>>>0>357913941)gd(a);g=(j|0)/12|0;j=g<<1;l=g>>>0<178956970?(j>>>0<e>>>0?e:j):357913941;if(l>>>0>357913941)gd(a);j=Pc(l*12|0)|0;g=a+4|0;c[g>>2]=j;c[a>>2]=j;c[f>>2]=j+(l*12|0);if((b|0)==(d|0))return;l=b;f=j;while(1){c[f>>2]=0;j=f+4|0;c[j>>2]=0;m=f+8|0;c[m>>2]=0;n=l+4|0;k=(c[n>>2]|0)-(c[l>>2]|0)|0;o=k>>2;if(k|0){if(o>>>0>1073741823){p=38;break}q=Pc(k)|0;c[j>>2]=q;c[f>>2]=q;c[m>>2]=q+(o<<2);o=c[l>>2]|0;m=(c[n>>2]|0)-o|0;if((m|0)>0){ae(q|0,o|0,m|0)|0;c[j>>2]=q+(m>>>2<<2)}}l=l+12|0;m=(c[g>>2]|0)+12|0;c[g>>2]=m;if((l|0)==(d|0)){p=42;break}else f=m}if((p|0)==38)gd(f);else if((p|0)==42)return}f=a+4|0;a=((c[f>>2]|0)-h|0)/12|0;h=e>>>0>a>>>0;e=b+(a*12|0)|0;a=h?e:d;if((a|0)==(b|0))r=i;else{l=b;b=i;while(1){if((b|0)!=(l|0))cb(b,c[l>>2]|0,c[l+4>>2]|0);l=l+12|0;i=b+12|0;if((l|0)==(a|0)){r=i;break}else b=i}}if(!h){h=c[f>>2]|0;if((h|0)!=(r|0)){b=h;do{h=b;b=b+-12|0;l=c[b>>2]|0;if(l|0){c[h+-8>>2]=l;Qc(l)}}while((b|0)!=(r|0))}c[f>>2]=r;return}if((a|0)==(d|0))return;a=e;e=c[f>>2]|0;while(1){c[e>>2]=0;r=e+4|0;c[r>>2]=0;b=e+8|0;c[b>>2]=0;l=a+4|0;h=(c[l>>2]|0)-(c[a>>2]|0)|0;i=h>>2;if(h|0){if(i>>>0>1073741823){p=12;break}g=Pc(h)|0;c[r>>2]=g;c[e>>2]=g;c[b>>2]=g+(i<<2);i=c[a>>2]|0;b=(c[l>>2]|0)-i|0;if((b|0)>0){ae(g|0,i|0,b|0)|0;c[r>>2]=g+(b>>>2<<2)}}a=a+12|0;b=(c[f>>2]|0)+12|0;c[f>>2]=b;if((a|0)==(d|0)){p=42;break}else e=b}if((p|0)==12)gd(e);else if((p|0)==42)return}function cb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;e=d;f=b;g=e-f|0;h=g>>2;i=a+8|0;j=c[i>>2]|0;k=c[a>>2]|0;l=k;if(h>>>0<=j-k>>2>>>0){m=a+4|0;n=(c[m>>2]|0)-k>>2;o=h>>>0>n>>>0;p=o?b+(n<<2)|0:d;d=p;n=d-f|0;if(n|0)be(k|0,b|0,n|0)|0;if(!o){c[m>>2]=l+(n>>2<<2);return}n=e-d|0;if((n|0)<=0)return;ae(c[m>>2]|0,p|0,n|0)|0;c[m>>2]=(c[m>>2]|0)+(n>>>2<<2);return}if(!k)q=j;else{j=a+4|0;c[j>>2]=k;Qc(k);c[i>>2]=0;c[j>>2]=0;c[a>>2]=0;q=0}if(h>>>0>1073741823)gd(a);j=q>>1;k=q>>2>>>0<536870911?(j>>>0<h>>>0?h:j):1073741823;if(k>>>0>1073741823)gd(a);j=Pc(k<<2)|0;h=a+4|0;c[h>>2]=j;c[a>>2]=j;c[i>>2]=j+(k<<2);if((g|0)<=0)return;ae(j|0,b|0,g|0)|0;c[h>>2]=j+(g>>>2<<2);return}function db(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;h=ka;ka=ka+272|0;i=h+256|0;j=h;k=c[b+60>>2]|0;b=i;c[b>>2]=d;c[b+4>>2]=e;Dc(j,4340,i)|0;c[i>>2]=0;c[i+4>>2]=0;c[i+8>>2]=0;e=Ub(j)|0;if(e>>>0>4294967279)Xc(i);if(e>>>0<11){a[i+11>>0]=e;if(!e)l=i;else{m=i;n=6}}else{b=e+16&-16;d=Pc(b)|0;c[i>>2]=d;c[i+8>>2]=b|-2147483648;c[i+4>>2]=e;m=d;n=6}if((n|0)==6){ae(m|0,j|0,e|0)|0;l=m}a[l+e>>0]=0;if(!(Ya(9260,i)|0)){e=c[2313]|0;l=(e-(c[2312]|0)|0)/12|0;m=e;if((c[2314]|0)==(m|0))Za(9248,i);else{Yc(m,i);c[2313]=(c[2313]|0)+12}c[(Xa(9260,i)|0)>>2]=l}l=c[(Xa(9260,i)|0)>>2]|0;m=k+f|0;if((a[i+11>>0]|0)>=0){o=c[g>>2]|0;p=o+(m*28|0)+20|0;c[p>>2]=l;ka=h;return}Qc(c[i>>2]|0);o=c[g>>2]|0;p=o+(m*28|0)+20|0;c[p>>2]=l;ka=h;return}function eb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;b=ka;ka=ka+32|0;d=b+16|0;e=b+8|0;f=b;g=a+112|0;h=c[g>>2]|0;if((h|0)<=0){i=1;ka=b;return i|0}j=a+108|0;k=a+4|0;l=a+100|0;a=h;m=h;h=c[j>>2]|0;a:while(1){n=a;a=a+-1|0;b:do if((h|0)>0){o=n+-2|0;if((n|0)<=1){p=0;q=m;r=h;while(1){t=c[k>>2]|0;if(q>>>0>a>>>0&r>>>0>p>>>0)u=q;else{c[d>>2]=a;c[d+4>>2]=p;Fc(4345,d)|0;u=c[g>>2]|0}if((n|0)==(u|0)?(c[(c[t>>2]|0)+(((c[l>>2]|0)+1+((s(u,p)|0)+a<<1)|0)*28|0)+16>>2]&-256|0)==-6750208:0){i=0;v=20;break a}p=p+1|0;t=c[j>>2]|0;if((p|0)>=(t|0)){w=u;x=t;break b}else{q=u;r=t}}}r=0;q=m;p=h;while(1){t=c[k>>2]|0;if(q>>>0>o>>>0&p>>>0>r>>>0){y=q;z=t}else{c[f>>2]=o;c[f+4>>2]=r;Fc(4345,f)|0;y=c[g>>2]|0;z=c[k>>2]|0}A=s(y,r)|0;B=(c[l>>2]|0)+1|0;C=c[(c[t>>2]|0)+((B+(A+o<<1)|0)*28|0)+16>>2]|0;if(y>>>0>a>>>0?(c[j>>2]|0)>>>0>r>>>0:0){D=B;E=A;F=y}else{c[e>>2]=a;c[e+4>>2]=r;Fc(4345,e)|0;A=c[g>>2]|0;D=(c[l>>2]|0)+1|0;E=s(A,r)|0;F=A}A=(c[(c[z>>2]|0)+((D+(E+a<<1)|0)*28|0)+16>>2]|0)>>>8;if((C&-256|0)==-6750208&(A|0)==52326){i=0;v=20;break a}r=r+1|0;if((A|0)==16750848&(n|0)==(F|0)){i=0;v=20;break a}A=c[j>>2]|0;if((r|0)>=(A|0)){w=F;x=A;break}else{q=F;p=A}}}else{w=m;x=h}while(0);if((n|0)<=1){i=1;v=20;break}else{m=w;h=x}}if((v|0)==20){ka=b;return i|0}return 0}function fb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0;b=ka;ka=ka+16|0;d=b;e=a+112|0;f=c[e>>2]|0;if((f|0)<=0){g=0;Na(a,g);ka=b;return}h=a+260|0;i=a+264|0;j=a+4|0;k=a+108|0;l=a+100|0;m=0;n=f;while(1){f=n+-1|0;o=c[h>>2]|0;p=c[i>>2]|0;if((o|0)<=(p|0)){q=o;o=1;r=c[e>>2]|0;t=p;while(1){u=c[j>>2]|0;if(r>>>0>f>>>0?(c[k>>2]|0)>>>0>q>>>0:0){v=r;w=t}else{c[d>>2]=f;c[d+4>>2]=q;Fc(4345,d)|0;v=c[e>>2]|0;w=c[i>>2]|0}x=(c[l>>2]|0)+1+((s(v,q)|0)+f<<1)|0;o=o&(c[(c[u>>2]|0)+(x*28|0)+16>>2]&-256|0)==13395456;if((q|0)>=(w|0))break;else{q=q+1|0;r=v;t=w}}if(o){y=w;z=11}else{A=m;B=f}}else{y=p;z=11}if((z|0)==11){z=0;t=m+1|0;r=c[h>>2]|0;if((r|0)<=(y|0)){q=c[e>>2]|0;x=(c[l>>2]|0)+1|0;u=c[c[j>>2]>>2]|0;C=r;while(1){c[u+((x+((s(q,C)|0)+f<<1)|0)*28|0)+16>>2]=0;if((C|0)<(y|0))C=C+1|0;else break}}ib(a,f,52326);A=t;B=n}if((B|0)>0){m=A;n=B}else{g=A;break}}Na(a,g);ka=b;return}function gb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0;d=ka;ka=ka+32|0;e=d+24|0;f=d+16|0;g=d+8|0;h=d;i=a+108|0;if((c[i>>2]|0)<=0){j=1;ka=d;return j|0}k=a+112|0;l=a+4|0;m=a+100|0;a=0;n=c[k>>2]|0;a:while(1){o=n+-1|0;p=a;a=a+1|0;b:do if((n|0)>0){if(p|0){q=o;r=n;while(1){t=c[l>>2]|0;if(r>>>0>q>>>0?(u=c[i>>2]|0,u>>>0>p>>>0):0){v=r;w=u}else{c[f>>2]=q;c[f+4>>2]=p;Fc(4345,f)|0;v=c[k>>2]|0;w=c[i>>2]|0}u=(c[m>>2]|0)+1|0;x=u+((s(v,p)|0)+q<<1)|0;y=(c[(c[t>>2]|0)+(x*28|0)+16>>2]|0)>>>8;if((p|0)<(w+-1|0)){x=c[l>>2]|0;if(v>>>0>q>>>0&w>>>0>a>>>0){z=u;A=v}else{c[e>>2]=q;c[e+4>>2]=a;Fc(4345,e)|0;z=(c[m>>2]|0)+1|0;A=c[k>>2]|0}u=z+((s(A,a)|0)+q<<1)|0;B=(c[(c[x>>2]|0)+(u*28|0)+16>>2]|0)>>>8;C=A}else{B=0;C=v}if((B|0)==(b|0)?(y|0)!=(b|0)&(y|0)!=0:0){j=0;D=29;break a}if((q|0)>0){q=q+-1|0;r=C}else{E=C;break b}}}r=o;q=n;while(1){y=c[l>>2]|0;if(q>>>0>r>>>0?(u=c[i>>2]|0,(u|0)!=0):0){F=u;G=q}else{c[h>>2]=r;c[h+4>>2]=0;Fc(4345,h)|0;F=c[i>>2]|0;G=c[k>>2]|0}u=(c[m>>2]|0)+1|0;x=(c[(c[y>>2]|0)+((u+(r<<1)|0)*28|0)+16>>2]|0)>>>8;if((F|0)>1){y=c[l>>2]|0;if(G>>>0>r>>>0&F>>>0>a>>>0){H=u;I=G}else{c[g>>2]=r;c[g+4>>2]=a;Fc(4345,g)|0;H=(c[m>>2]|0)+1|0;I=c[k>>2]|0}u=H+((s(I,a)|0)+r<<1)|0;J=(c[(c[y>>2]|0)+(u*28|0)+16>>2]|0)>>>8;K=I}else{J=0;K=G}if((J|0)==(b|0)){if((x|0)!=0|(x|0)==(b|0)){j=0;D=29;break a}}else if((x|0)==(b|0)){j=0;D=29;break a}if((r|0)>0){r=r+-1|0;q=K}else{E=K;break}}}else E=n;while(0);if((a|0)>=(c[i>>2]|0)){j=1;D=29;break}else n=E}if((D|0)==29){ka=d;return j|0}return 0}function hb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0;d=ka;ka=ka+32|0;e=d+16|0;f=d+8|0;g=d;h=a+108|0;i=c[h>>2]|0;if((i|0)<=0){j=1;ka=d;return j|0}k=a+112|0;l=a+4|0;m=a+100|0;a=(b|0)!=0;n=i;o=i;i=c[k>>2]|0;a:while(1){p=n;n=n+-1|0;q=i+-1|0;b:do if((i|0)>0){r=p+-2|0;if((p|0)<=1){t=q;u=i;v=o;while(1){w=c[l>>2]|0;if(u>>>0>t>>>0&v>>>0>n>>>0)x=u;else{c[e>>2]=t;c[e+4>>2]=n;Fc(4345,e)|0;x=c[k>>2]|0}y=(c[m>>2]|0)+1+((s(x,n)|0)+t<<1)|0;z=(c[(c[w>>2]|0)+(y*28|0)+16>>2]|0)>>>8;if(!(a|(z|0)==0)){j=0;A=22;break a}y=c[h>>2]|0;if((z|0)==(b|0)&(p|0)==(y|0)){j=0;A=22;break a}if((t|0)>0){t=t+-1|0;u=x;v=y}else{B=y;C=x;break b}}}v=q;u=i;t=o;while(1){y=c[l>>2]|0;if(u>>>0>v>>>0&t>>>0>n>>>0){D=u;E=y}else{c[g>>2]=v;c[g+4>>2]=n;Fc(4345,g)|0;D=c[k>>2]|0;E=c[l>>2]|0}z=(c[m>>2]|0)+1|0;w=z+((s(D,n)|0)+v<<1)|0;F=(c[(c[y>>2]|0)+(w*28|0)+16>>2]|0)>>>8;if(D>>>0>v>>>0?(c[h>>2]|0)>>>0>r>>>0:0){G=z;H=D}else{c[f>>2]=v;c[f+4>>2]=r;Fc(4345,f)|0;G=(c[m>>2]|0)+1|0;H=c[k>>2]|0}z=G+((s(H,r)|0)+v<<1)|0;if(((c[(c[E>>2]|0)+(z*28|0)+16>>2]|0)>>>8|0)==(b|0)?(F|0)!=(b|0)&(F|0)!=0:0){j=0;A=22;break a}z=c[h>>2]|0;if((F|0)==(b|0)&(p|0)==(z|0)){j=0;A=22;break a}if((v|0)>0){v=v+-1|0;u=H;t=z}else{B=z;C=H;break}}}else{B=o;C=i}while(0);if((p|0)<=1){j=1;A=22;break}else{o=B;i=C}}if((A|0)==22){ka=d;return j|0}return 0}function ib(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0;e=ka;ka=ka+32|0;f=e+16|0;g=e+8|0;h=e;if((b|0)<0){i=c[a+112>>2]|0;if((i|0)>0)j=i+-1|0;else{k=a+256|0;l=c[k>>2]|0;m=l+1|0;c[k>>2]=m;ka=e;return}}else j=b;b=a+108|0;i=a+4|0;n=a+112|0;o=a+100|0;p=j;j=c[b>>2]|0;while(1){a:do if((j|0)>0){q=p+-1|0;r=c[n>>2]|0;if((p|0)<=0){t=0;u=r;v=j;while(1){w=c[i>>2]|0;if(u>>>0>p>>>0&v>>>0>t>>>0)x=u;else{c[f>>2]=p;c[f+4>>2]=t;Fc(4345,f)|0;x=c[n>>2]|0}y=c[o>>2]|0;z=(s(x,t)|0)+p<<1;A=(c[(c[w>>2]|0)+((y+1+z|0)*28|0)+16>>2]|0)>>>8;if((A|0)==(d|0)|(A|d|0)==0)c[(c[c[i>>2]>>2]|0)+((z+y+1|0)*28|0)+16>>2]=0;t=t+1|0;y=c[b>>2]|0;if((t|0)>=(y|0)){B=q;C=y;break a}else{u=x;v=y}}}v=0;u=r;t=j;while(1){y=c[i>>2]|0;if(u>>>0>p>>>0&t>>>0>v>>>0){D=u;E=y}else{c[h>>2]=p;c[h+4>>2]=v;Fc(4345,h)|0;D=c[n>>2]|0;E=c[i>>2]|0}z=c[o>>2]|0;A=s(D,v)|0;w=z+1|0;F=(c[(c[y>>2]|0)+((w+(A+p<<1)|0)*28|0)+16>>2]|0)>>>8;if(D>>>0>q>>>0?(c[b>>2]|0)>>>0>v>>>0:0){G=w;H=A;I=z;J=D}else{c[g>>2]=q;c[g+4>>2]=v;Fc(4345,g)|0;z=c[n>>2]|0;A=c[o>>2]|0;G=A+1|0;H=s(z,v)|0;I=A;J=z}z=(c[(c[E>>2]|0)+((G+(H+q<<1)|0)*28|0)+16>>2]|0)>>>8;A=(F|0)==(d|0);w=(z|0)==(d|0)|A^1?z:0;z=(w|0)==0;if(!(!(A&z)?!((F|0)==0&(w|0)==(d|0)):0)){F=(H+p<<1)+I|0;A=c[c[i>>2]>>2]|0;if(z)K=0;else K=c[A+(F*28|0)+16>>2]&255;c[A+((F+1|0)*28|0)+16>>2]=K|w<<8}v=v+1|0;w=c[b>>2]|0;if((v|0)>=(w|0)){B=q;C=w;break}else{u=J;t=w}}}else{B=p+-1|0;C=j}while(0);if((p|0)>0){p=B;j=C}else break}k=a+256|0;l=c[k>>2]|0;m=l+1|0;c[k>>2]=m;ka=e;return}function jb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0;d=ka;ka=ka+16|0;e=d+8|0;f=d;g=a+108|0;h=c[g>>2]|0;if((h|0)>0){i=a+112|0;j=a+4|0;k=a+100|0;l=0;m=c[i>>2]|0;n=h;while(1){o=l;l=l+1|0;if((m|0)>0){p=m;q=m;while(1){r=p;p=p+-1|0;t=c[j>>2]|0;if(q>>>0>p>>>0?(u=c[g>>2]|0,u>>>0>o>>>0):0){v=q;w=u}else{c[f>>2]=p;c[f+4>>2]=o;Fc(4345,f)|0;v=c[i>>2]|0;w=c[g>>2]|0}u=c[k>>2]|0;x=u+1|0;y=x+((s(v,o)|0)+p<<1)|0;z=(c[(c[t>>2]|0)+(y*28|0)+16>>2]|0)>>>8;if((o|0)<(w+-1|0)){y=c[j>>2]|0;if(v>>>0>p>>>0&w>>>0>l>>>0){A=x;B=v;C=u}else{c[e>>2]=p;c[e+4>>2]=l;Fc(4345,e)|0;x=c[k>>2]|0;A=x+1|0;B=c[i>>2]|0;C=x}x=A+((s(B,l)|0)+p<<1)|0;D=(c[(c[y>>2]|0)+(x*28|0)+16>>2]|0)>>>8;E=B;F=C}else{D=0;E=v;F=u}u=(D|0)!=(b|0)&(D|0)!=0?0:D;if((z|0)==(b|0))if(!u){G=0;H=1;I=19}else{J=u;K=0;I=18}else{J=D;K=(D|0)==0;I=18}if((I|0)==18?(I=0,(z|0)==0&(J|0)==(b|0)):0){G=b;H=K;I=19}if((I|0)==19){I=0;z=((s(E,o)|0)+p<<1)+F|0;u=c[c[j>>2]>>2]|0;if(H)L=0;else L=c[u+(z*28|0)+16>>2]&255;c[u+((z+1|0)*28|0)+16>>2]=L|G<<8}if((r|0)<=1)break;else q=E}M=c[g>>2]|0;N=E}else{M=n;N=m}if((l|0)>=(M|0)){O=M;break}else{m=N;n=M}}}else O=h;h=a+252|0;c[h>>2]=(c[h>>2]|0)+-1;if((c[a+236>>2]|0)!=1){ka=d;return}h=a+260|0;M=(c[h>>2]|0)+-1|0;c[h>>2]=M;h=a+264|0;n=c[h>>2]|0;c[h>>2]=n+-1;h=c[a+112>>2]|0;if(!((O|0)>0&(h|0)>0)){ka=d;return}N=c[a+100>>2]|0;m=c[c[a+4>>2]>>2]|0;a=0;do{l=0;do{E=m+((((s(l,h)|0)+a<<1)+N|0)*28|0)+16|0;c[E>>2]=((l|0)<(M|0)?-1431655936:(l|0)<(n|0)?-572662528:-1431655936)|c[E>>2]&255;l=l+1|0}while((l|0)!=(O|0));a=a+1|0}while((a|0)!=(h|0));ka=d;return}function kb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0;d=ka;ka=ka+32|0;e=d+16|0;f=d+8|0;g=d;h=a+108|0;i=c[h>>2]|0;if((i|0)>0){j=a+112|0;k=a+4|0;l=a+100|0;m=i;i=c[j>>2]|0;while(1){n=m;m=m+-1|0;o=i+-1|0;a:do if((i|0)>0){p=n+-2|0;if((n|0)<=1){q=o;r=i;while(1){t=c[k>>2]|0;if(r>>>0>q>>>0?(c[h>>2]|0)>>>0>m>>>0:0)u=r;else{c[e>>2]=q;c[e+4>>2]=m;Fc(4345,e)|0;u=c[j>>2]|0}v=c[l>>2]|0;w=(s(u,m)|0)+q<<1;x=(c[(c[t>>2]|0)+((v+1+w|0)*28|0)+16>>2]|0)>>>8;if((x|0)==(b|0)|(x|b|0)==0)c[(c[c[k>>2]>>2]|0)+((w+v+1|0)*28|0)+16>>2]=0;if((q|0)>0){q=q+-1|0;r=u}else{y=u;break a}}}r=o;q=i;while(1){v=c[k>>2]|0;if(q>>>0>r>>>0?(c[h>>2]|0)>>>0>m>>>0:0){z=q;A=v}else{c[g>>2]=r;c[g+4>>2]=m;Fc(4345,g)|0;z=c[j>>2]|0;A=c[k>>2]|0}w=c[l>>2]|0;x=w+1|0;t=x+((s(z,m)|0)+r<<1)|0;B=(c[(c[v>>2]|0)+(t*28|0)+16>>2]|0)>>>8;if(z>>>0>r>>>0?(c[h>>2]|0)>>>0>p>>>0:0){C=x;D=z;E=w}else{c[f>>2]=r;c[f+4>>2]=p;Fc(4345,f)|0;w=c[l>>2]|0;C=w+1|0;D=c[j>>2]|0;E=w}w=C+((s(D,p)|0)+r<<1)|0;x=(c[(c[A>>2]|0)+(w*28|0)+16>>2]|0)>>>8;w=(x|0)!=(b|0)&(x|0)!=0?0:x;if((B|0)==(b|0))if(!w){F=0;G=1;H=18}else{I=w;J=0;H=17}else{I=x;J=(x|0)==0;H=17}if((H|0)==17?(H=0,(B|0)==0&(I|0)==(b|0)):0){F=b;G=J;H=18}if((H|0)==18){H=0;B=((s(D,m)|0)+r<<1)+E|0;x=c[c[k>>2]>>2]|0;if(G)K=0;else K=c[x+(B*28|0)+16>>2]&255;c[x+((B+1|0)*28|0)+16>>2]=K|F<<8}if((r|0)>0){r=r+-1|0;q=D}else{y=D;break}}}else y=i;while(0);if((n|0)<=1)break;else i=y}}y=a+252|0;c[y>>2]=(c[y>>2]|0)+1;if((c[a+236>>2]|0)!=1){ka=d;return}y=a+260|0;i=c[y>>2]|0;c[y>>2]=i+1;y=a+264|0;D=(c[y>>2]|0)+1|0;c[y>>2]=D;y=c[a+112>>2]|0;if((y|0)<=0){ka=d;return}F=c[h>>2]|0;if((F|0)<=0){ka=d;return}h=c[a+100>>2]|0;K=c[c[a+4>>2]>>2]|0;a=0;do{G=0;do{k=K+((((s(G,y)|0)+a<<1)+h|0)*28|0)+16|0;c[k>>2]=((G|0)>(i|0)?((G|0)>(D|0)?-1431655936:-572662528):-1431655936)|c[k>>2]&255;G=G+1|0}while((G|0)!=(F|0));a=a+1|0}while((a|0)!=(y|0));ka=d;return}function lb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;f=ka;ka=ka+96|0;g=f+88|0;h=f+80|0;i=f+16|0;j=f+72|0;k=f+64|0;l=f+56|0;m=f+48|0;n=f+40|0;o=f+32|0;p=f+8|0;q=f;r=c[b>>2]|0;s=r+d|0;if((((r|0)>=0?s>>>0<=(c[a+108>>2]|0)>>>0:0)?(t=b+4|0,u=c[t>>2]|0,(u|0)>=0):0)?(u+d|0)>>>0<=(c[a+112>>2]|0)>>>0:0){if(!d){v=1;ka=f;return v|0}u=d+-1|0;w=0;a:while(1){x=u-w|0;if(w>>>0<x>>>0){y=w;do{z=c[b>>2]|0;A=z+w|0;B=c[t>>2]|0;C=B+y|0;D=z+y|0;E=u+B|0;F=E-w|0;G=u+z|0;z=G-y|0;H=B+w|0;B=j;c[B>>2]=A;c[B+4>>2]=C;B=k;c[B>>2]=D;c[B+4>>2]=F;c[h>>2]=c[j>>2];c[h+4>>2]=c[j+4>>2];c[g>>2]=c[k>>2];c[g+4>>2]=c[k+4>>2];if(!(ob(a,h,g,e)|0)){v=0;I=16;break a}B=G-w|0;G=l;c[G>>2]=D;c[G+4>>2]=F;F=m;c[F>>2]=B;c[F+4>>2]=E;c[h>>2]=c[l>>2];c[h+4>>2]=c[l+4>>2];c[g>>2]=c[m>>2];c[g+4>>2]=c[m+4>>2];if(!(ob(a,h,g,e)|0)){v=0;I=16;break a}F=n;c[F>>2]=B;c[F+4>>2]=E;E=o;c[E>>2]=z;c[E+4>>2]=H;c[h>>2]=c[n>>2];c[h+4>>2]=c[n+4>>2];c[g>>2]=c[o>>2];c[g+4>>2]=c[o+4>>2];if(!(ob(a,h,g,e)|0)){v=0;I=16;break a}E=p;c[E>>2]=z;c[E+4>>2]=H;H=q;c[H>>2]=A;c[H+4>>2]=C;c[h>>2]=c[p>>2];c[h+4>>2]=c[p+4>>2];c[g>>2]=c[q>>2];c[g+4>>2]=c[q+4>>2];y=y+1|0;if(!(ob(a,h,g,e)|0)){v=0;I=16;break a}}while(y>>>0<x>>>0)}w=w+1|0;if(w>>>0>=d>>>0){v=1;I=16;break}}if((I|0)==16){ka=f;return v|0}}v=c[b+4>>2]|0;c[i>>2]=r;c[i+4>>2]=v;c[i+8>>2]=s;c[i+12>>2]=v+d;Fc(4407,i)|0;ka=f;return 0}function mb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0;f=ka;ka=ka+64|0;g=f+56|0;h=f+48|0;i=f+40|0;j=f+32|0;k=f+24|0;l=f+16|0;m=f+8|0;n=f;o=d>>>1;if(o|0){p=d+-1|0;d=b+4|0;q=a+108|0;r=a+112|0;t=a+4|0;u=a+100|0;v=0;w=p;while(1){if(v>>>0<(p-v|0)>>>0){x=v;do{y=c[b>>2]|0;z=y+v|0;A=c[d>>2]|0;B=A+x|0;C=y+x|0;D=p+A|0;E=D-v|0;F=p+y|0;y=F-v|0;G=D-x|0;D=F-x|0;F=A+v|0;A=(B|z|0)>-1;if((A?(H=c[q>>2]|0,(z|0)<(H|0)):0)?(I=c[r>>2]|0,(B|0)<(I|0)):0){J=c[t>>2]|0;if(I>>>0>B>>>0&H>>>0>z>>>0)K=I;else{c[n>>2]=B;c[n+4>>2]=z;Fc(4345,n)|0;K=c[r>>2]|0}I=(c[u>>2]|0)+1+((s(K,z)|0)+B<<1)|0;L=(c[(c[J>>2]|0)+(I*28|0)+16>>2]|0)>>>8}else L=0;I=(E|C|0)>-1;if((I?(J=c[q>>2]|0,(C|0)<(J|0)):0)?(H=c[r>>2]|0,(E|0)<(H|0)):0){M=c[t>>2]|0;if(H>>>0>E>>>0&J>>>0>C>>>0)N=H;else{c[m>>2]=E;c[m+4>>2]=C;Fc(4345,m)|0;N=c[r>>2]|0}H=(c[u>>2]|0)+1+((s(N,C)|0)+E<<1)|0;O=(c[(c[M>>2]|0)+(H*28|0)+16>>2]|0)>>>8}else O=0;H=(G|y|0)>-1;if((H?(M=c[q>>2]|0,(y|0)<(M|0)):0)?(J=c[r>>2]|0,(G|0)<(J|0)):0){P=c[t>>2]|0;if(J>>>0>G>>>0&M>>>0>y>>>0)Q=J;else{c[l>>2]=G;c[l+4>>2]=y;Fc(4345,l)|0;Q=c[r>>2]|0}J=(c[u>>2]|0)+1+((s(Q,y)|0)+G<<1)|0;R=(c[(c[P>>2]|0)+(J*28|0)+16>>2]|0)>>>8}else R=0;J=(D|F|0)>-1;if((J?(P=c[q>>2]|0,(D|0)<(P|0)):0)?(M=c[r>>2]|0,(F|0)<(M|0)):0){S=c[t>>2]|0;if(M>>>0>F>>>0&P>>>0>D>>>0)T=M;else{c[k>>2]=F;c[k+4>>2]=D;Fc(4345,k)|0;T=c[r>>2]|0}M=(c[u>>2]|0)+1+((s(T,D)|0)+F<<1)|0;U=(c[(c[S>>2]|0)+(M*28|0)+16>>2]|0)>>>8}else U=0;if((A?(A=c[q>>2]|0,(z|0)<(A|0)):0)?(M=c[r>>2]|0,(B|0)<(M|0)):0){S=c[t>>2]|0;if(A>>>0>z>>>0&M>>>0>B>>>0)V=M;else{c[j>>2]=B;c[j+4>>2]=z;Fc(4345,j)|0;V=c[r>>2]|0}M=((s(V,z)|0)+B<<1)+(c[u>>2]|0)|0;B=M+1|0;z=(c[(c[S>>2]|0)+(B*28|0)+16>>2]|0)>>>8;if(!((z|0)!=(e|0)&(z|0)!=0)?!((O|0)!=0&(O|0)!=(e|0)):0){z=c[c[t>>2]>>2]|0;if(!O)W=0;else W=c[z+(M*28|0)+16>>2]&255;c[z+(B*28|0)+16>>2]=W|O<<8}}if((I?(I=c[q>>2]|0,(C|0)<(I|0)):0)?(B=c[r>>2]|0,(E|0)<(B|0)):0){z=c[t>>2]|0;if(I>>>0>C>>>0&B>>>0>E>>>0)X=B;else{c[i>>2]=E;c[i+4>>2]=C;Fc(4345,i)|0;X=c[r>>2]|0}B=((s(X,C)|0)+E<<1)+(c[u>>2]|0)|0;E=B+1|0;C=(c[(c[z>>2]|0)+(E*28|0)+16>>2]|0)>>>8;if(!((C|0)!=(e|0)&(C|0)!=0)?!((R|0)!=0&(R|0)!=(e|0)):0){C=c[c[t>>2]>>2]|0;if(!R)Y=0;else Y=c[C+(B*28|0)+16>>2]&255;c[C+(E*28|0)+16>>2]=Y|R<<8}}if((H?(H=c[q>>2]|0,(y|0)<(H|0)):0)?(E=c[r>>2]|0,(G|0)<(E|0)):0){C=c[t>>2]|0;if(H>>>0>y>>>0&E>>>0>G>>>0)Z=E;else{c[h>>2]=G;c[h+4>>2]=y;Fc(4345,h)|0;Z=c[r>>2]|0}E=((s(Z,y)|0)+G<<1)+(c[u>>2]|0)|0;G=E+1|0;y=(c[(c[C>>2]|0)+(G*28|0)+16>>2]|0)>>>8;if(!((y|0)!=(e|0)&(y|0)!=0)?!((U|0)!=0&(U|0)!=(e|0)):0){y=c[c[t>>2]>>2]|0;if(!U)_=0;else _=c[y+(E*28|0)+16>>2]&255;c[y+(G*28|0)+16>>2]=_|U<<8}}if((J?(J=c[q>>2]|0,(D|0)<(J|0)):0)?(G=c[r>>2]|0,(F|0)<(G|0)):0){y=c[t>>2]|0;if(J>>>0>D>>>0&G>>>0>F>>>0)$=G;else{c[g>>2]=F;c[g+4>>2]=D;Fc(4345,g)|0;$=c[r>>2]|0}G=((s($,D)|0)+F<<1)+(c[u>>2]|0)|0;F=G+1|0;D=(c[(c[y>>2]|0)+(F*28|0)+16>>2]|0)>>>8;if(!((D|0)!=(e|0)&(D|0)!=0)?!((L|0)!=0&(L|0)!=(e|0)):0){D=c[c[t>>2]>>2]|0;if(!L)aa=0;else aa=c[D+(G*28|0)+16>>2]&255;c[D+(F*28|0)+16>>2]=aa|L<<8}}x=x+1|0}while((x|0)!=(w|0))}v=v+1|0;if((v|0)==(o|0))break;else w=w+-1|0}}if((c[a+236>>2]|0)!=1){ka=f;return}w=a+260|0;v=c[w>>2]|0;L=a+264|0;aa=c[L>>2]|0;t=o-v+(c[b>>2]|0)+((1-v+aa|0)/-2|0)|0;b=t+v|0;c[w>>2]=b;w=t+aa|0;c[L>>2]=w;L=c[a+112>>2]|0;if((L|0)<=0){ka=f;return}aa=c[a+108>>2]|0;if((aa|0)<=0){ka=f;return}t=c[a+100>>2]|0;v=c[c[a+4>>2]>>2]|0;a=0;do{o=0;do{e=v+((((s(o,L)|0)+a<<1)+t|0)*28|0)+16|0;c[e>>2]=((o|0)<(b|0)|(o|0)>(w|0)?-1431655936:-572662528)|c[e>>2]&255;o=o+1|0}while((o|0)!=(aa|0));a=a+1|0}while((a|0)!=(L|0));ka=f;return}function nb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0;f=ka;ka=ka+16|0;g=f;h=b+68|0;i=c[h>>2]|0;j=b+72|0;k=c[j>>2]|0;if((i|0)>0){l=b+60|0;b=k;m=-1;n=0;o=i;p=-1;q=k;r=i;while(1){if((q|0)>0){t=0;u=p;v=b;w=m;x=o;y=q;while(1){if(y>>>0>t>>>0?(c[h>>2]|0)>>>0>n>>>0:0)z=y;else{c[g>>2]=t;c[g+4>>2]=n;Fc(4345,g)|0;z=c[j>>2]|0}A=(c[l>>2]|0)+1+((s(z,n)|0)+t<<1)|0;if(((c[(c[e>>2]|0)+(A*28|0)+16>>2]|0)>>>8|0)==(d|0)){B=(n|0)<(x|0)?n:x;C=(n|0)>(u|0)?n:u;D=(t|0)<(v|0)?t:v;E=(t|0)>(w|0)?t:w}else{B=x;C=u;D=v;E=w}t=t+1|0;if((t|0)>=(z|0))break;else{u=C;v=D;w=E;x=B;y=z}}F=B;G=C;H=D;I=E;J=c[h>>2]|0;K=z}else{F=o;G=p;H=b;I=m;J=r;K=q}n=n+1|0;if((n|0)>=(J|0)){L=F;M=H;N=I;O=G;P=J;Q=K;break}else{b=H;m=I;o=F;p=G;q=K;r=J}}}else{L=i;M=k;N=-1;O=-1;P=i;Q=k}k=O-L|0;i=N-M|0;if((k|0)>=(i|0))if((i|0)<(k|0)){J=k-i+N|0;R=J-M|0;S=k;T=M-((J|0)<(Q|0)?0:J+1-Q|0)|0;U=L}else{R=i;S=k;T=M;U=L}else{Q=i-k|0;J=(Q|0)/2|0;N=Q-(J<<1)|0;Q=(((k|0)/2|0)+L|0)>((P|0)/2|0|0);k=L-J+(Q?0-N|0:0)|0;L=J+O+(Q?0:N)|0;N=k-((L|0)<(P|0)?0:1-P+L|0)|0;R=i;S=L-k|0;T=M;U=(N|0)>0?N:0}N=a;c[N>>2]=U;c[N+4>>2]=T;T=a+8|0;c[T>>2]=S+1;c[T+4>>2]=R+1;ka=f;return}function ob(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0;f=ka;ka=ka+32|0;g=f+24|0;h=f+16|0;i=f+8|0;j=f;k=c[b>>2]|0;if(((k|0)>-1?(l=c[b+4>>2]|0,(l|0)>-1):0)?(k|0)<(c[a+108>>2]|0):0)m=(l|0)<(c[a+112>>2]|0);else m=0;l=c[d>>2]|0;if(((l|0)>-1?(n=c[d+4>>2]|0,(n|0)>-1):0)?(l|0)<(c[a+108>>2]|0):0)o=(n|0)<(c[a+112>>2]|0);else o=0;if(!(m|o)){p=1;ka=f;return p|0}if(!(o|m^1)){n=c[b+4>>2]|0;q=c[a+4>>2]|0;r=a+112|0;t=c[r>>2]|0;if(t>>>0>n>>>0?(c[a+108>>2]|0)>>>0>k>>>0:0)u=t;else{c[j>>2]=n;c[j+4>>2]=k;Fc(4345,j)|0;u=c[r>>2]|0}r=(c[a+100>>2]|0)+1+((s(u,k)|0)+n<<1)|0;p=(c[(c[q>>2]|0)+(r*28|0)+16>>2]&-256|0)!=-6750208;ka=f;return p|0}if(!(m|o^1)){o=c[d+4>>2]|0;m=c[a+4>>2]|0;r=a+112|0;q=c[r>>2]|0;if(q>>>0>o>>>0?(c[a+108>>2]|0)>>>0>l>>>0:0)v=q;else{c[i>>2]=o;c[i+4>>2]=l;Fc(4345,i)|0;v=c[r>>2]|0}r=(c[a+100>>2]|0)+1+((s(v,l)|0)+o<<1)|0;p=(c[(c[m>>2]|0)+(r*28|0)+16>>2]&-256|0)!=-6750208;ka=f;return p|0}r=c[b+4>>2]|0;b=a+4|0;m=c[b>>2]|0;o=a+112|0;v=c[o>>2]|0;if(v>>>0>r>>>0?(c[a+108>>2]|0)>>>0>k>>>0:0){w=v;x=m}else{c[h>>2]=r;c[h+4>>2]=k;Fc(4345,h)|0;w=c[o>>2]|0;x=c[b>>2]|0}b=a+100|0;h=(c[b>>2]|0)+1|0;v=h+((s(w,k)|0)+r<<1)|0;r=(c[(c[m>>2]|0)+(v*28|0)+16>>2]|0)>>>8;v=c[d+4>>2]|0;if(w>>>0>v>>>0?(c[a+108>>2]|0)>>>0>l>>>0:0){y=h;z=w}else{c[g>>2]=v;c[g+4>>2]=l;Fc(4345,g)|0;y=(c[b>>2]|0)+1|0;z=c[o>>2]|0}o=y+((s(z,l)|0)+v<<1)|0;v=(c[(c[x>>2]|0)+(o*28|0)+16>>2]|0)>>>8;o=(r|0)==(e|0);if(!o){A=(v|0)!=(e|0);B=(r|0)==0;C=o|B;D=C|A;ka=f;return D|0}if((v|0)!=(e|0)&(v|0)!=0){p=0;ka=f;return p|0}else{A=(v|0)!=(e|0);B=(r|0)==0;C=o|B;D=C|A;ka=f;return D|0}return 0}function pb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0.0,q=0.0,r=0.0,s=0.0,t=0.0,u=0.0,v=0;h=ka;ka=ka+80|0;i=h+64|0;j=h+48|0;k=h+32|0;l=h+16|0;m=h;n=+f[d>>2];o=+f[a+24>>2]*n+ +f[a+40>>2];p=+f[d+4>>2];q=+f[a+28>>2]*p+ +f[a+44>>2];r=+f[a+56>>2];if(r>0.0){s=q*r;if(s<o){t=s;u=q}else{t=o;u=o/r}}else{t=o;u=q}q=+f[b>>2];o=+f[a+32>>2]+(q+n*+f[a+16>>2]-t*+f[a+48>>2]);n=+f[b+4>>2];r=+f[a+36>>2]+(n+p*+f[a+20>>2]-u*+f[a+52>>2]);g[m>>3]=q;g[m+8>>3]=n;Fc(4434,m)|0;m=a+4|0;n=+f[m>>2];g[l>>3]=+f[a>>2];g[l+8>>3]=n;Fc(4486,l)|0;g[k>>3]=o;g[k+8>>3]=r;Fc(4536,k)|0;k=a+8|0;l=a+12|0;n=+f[l>>2];g[j>>3]=+f[k>>2];g[j+8>>3]=n;Fc(4589,j)|0;g[i>>3]=t;g[i+8>>3]=u;Fc(4635,i)|0;i=c[a+60>>2]|0;j=a+64|0;if((i|0)>(c[j>>2]|0)){f[a>>2]=o;f[m>>2]=r;f[k>>2]=t;f[l>>2]=u;ka=h;return}b=i;while(1){i=c[e>>2]|0;d=i+(b*28|0)|0;v=i+(b*28|0)+4|0;n=r+u*((+f[v>>2]-+f[m>>2])/+f[l>>2]);f[d>>2]=o+t*((+f[d>>2]-+f[a>>2])/+f[k>>2]);f[v>>2]=n;v=c[e>>2]|0;if((c[v+(b*28|0)+24>>2]|0)!=2){n=u*(+f[i+(b*28|0)+12>>2]/+f[l>>2]);f[v+(b*28|0)+8>>2]=t*(+f[i+(b*28|0)+8>>2]/+f[k>>2]);f[v+(b*28|0)+12>>2]=n}if((b|0)<(c[j>>2]|0))b=b+1|0;else break}f[a>>2]=o;f[m>>2]=r;f[k>>2]=t;f[l>>2]=u;ka=h;return}function qb(b,d,e,g,h,i,j,k){b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;i=+i;j=j|0;k=k|0;var l=0,m=0,n=0,o=0,p=0,q=0,r=0.0,s=0.0,t=0.0,u=0.0,v=0.0,w=0.0,x=0.0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0;l=ka;ka=ka+32|0;m=l;n=b+56|0;o=b;p=o+56|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));f[n>>2]=-1.0;n=b+60|0;o=b+68|0;p=b+80|0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;c[n+12>>2]=0;c[n+16>>2]=0;c[n+20>>2]=0;c[n+24>>2]=0;a[n+28>>0]=0;n=e;e=c[n+4>>2]|0;q=b+16|0;c[q>>2]=c[n>>2];c[q+4>>2]=e;e=g;g=c[e+4>>2]|0;q=b+32|0;c[q>>2]=c[e>>2];c[q+4>>2]=g;g=h;h=c[g+4>>2]|0;q=b+48|0;c[q>>2]=c[g>>2];c[q+4>>2]=h;r=i;s=r*.06;t=r*.1;h=a[d+11>>0]|0;u=t*2.0+ +((h<<24>>24<0?c[d+4>>2]|0:h&255)>>>0)*i*.6000000238418579;v=r*1.2;r=s*2.0;w=r+u;x=r+v;r=t+s;f[b+84>>2]=s;t=s*1.5;h=k+4|0;q=c[h>>2]|0;c[o>>2]=(q-(c[k>>2]|0)|0)/28|0;f[m>>2]=t;f[m+4>>2]=t;f[m+8>>2]=w;f[m+12>>2]=x;c[m+16>>2]=-1145324545;c[m+24>>2]=1;g=k+8|0;if((c[g>>2]|0)>>>0>q>>>0){e=q;c[e>>2]=c[m>>2];c[e+4>>2]=c[m+4>>2];c[e+8>>2]=c[m+8>>2];c[e+12>>2]=c[m+12>>2];c[e+16>>2]=c[m+16>>2];c[e+20>>2]=c[m+20>>2];c[e+24>>2]=c[m+24>>2];e=(c[h>>2]|0)+28|0;c[h>>2]=e;y=e;z=e}else{Wa(k,m);e=c[h>>2]|0;y=e;z=e}c[b+72>>2]=(y-(c[k>>2]|0)|0)/28|0;c[m>>2]=0;c[m+4>>2]=0;f[m+8>>2]=w;f[m+12>>2]=x;c[m+16>>2]=255;c[m+24>>2]=1;if(z>>>0<(c[g>>2]|0)>>>0){c[z>>2]=c[m>>2];c[z+4>>2]=c[m+4>>2];c[z+8>>2]=c[m+8>>2];c[z+12>>2]=c[m+12>>2];c[z+16>>2]=c[m+16>>2];c[z+20>>2]=c[m+20>>2];c[z+24>>2]=c[m+24>>2];z=(c[h>>2]|0)+28|0;c[h>>2]=z;A=z;B=z}else{Wa(k,m);z=c[h>>2]|0;A=z;B=z}c[b+76>>2]=(A-(c[k>>2]|0)|0)/28|0;f[m>>2]=s;f[m+4>>2]=s;f[m+8>>2]=u;f[m+12>>2]=v;c[m+16>>2]=j;c[m+24>>2]=1;if(B>>>0<(c[g>>2]|0)>>>0){c[B>>2]=c[m>>2];c[B+4>>2]=c[m+4>>2];c[B+8>>2]=c[m+8>>2];c[B+12>>2]=c[m+12>>2];c[B+16>>2]=c[m+16>>2];c[B+20>>2]=c[m+20>>2];c[B+24>>2]=c[m+24>>2];B=(c[h>>2]|0)+28|0;c[h>>2]=B;C=B}else{Wa(k,m);C=c[h>>2]|0}c[p>>2]=(C-(c[k>>2]|0)|0)/28|0;if(!(Ya(9260,d)|0)){C=c[2313]|0;B=(C-(c[2312]|0)|0)/12|0;j=C;if((c[2314]|0)==(j|0))Za(9248,d);else{Yc(j,d);c[2313]=(c[2313]|0)+12}c[(Xa(9260,d)|0)>>2]=B}B=c[(Xa(9260,d)|0)>>2]|0;f[m>>2]=r;f[m+4>>2]=i;f[m+8>>2]=i;f[m+12>>2]=i;c[m+16>>2]=255;c[m+20>>2]=B;c[m+24>>2]=2;B=c[h>>2]|0;if(B>>>0<(c[g>>2]|0)>>>0){c[B>>2]=c[m>>2];c[B+4>>2]=c[m+4>>2];c[B+8>>2]=c[m+8>>2];c[B+12>>2]=c[m+12>>2];c[B+16>>2]=c[m+16>>2];c[B+20>>2]=c[m+20>>2];c[B+24>>2]=c[m+24>>2];c[h>>2]=(c[h>>2]|0)+28;D=b+40|0;f[D>>2]=w;E=b+44|0;f[E>>2]=x;F=b+8|0;f[F>>2]=w;G=b+12|0;f[G>>2]=x;H=c[o>>2]|0;I=c[p>>2]|0;J=b+60|0;K=J;L=K;c[L>>2]=H;M=K+4|0;N=M;c[N>>2]=I;ka=l;return}else{Wa(k,m);D=b+40|0;f[D>>2]=w;E=b+44|0;f[E>>2]=x;F=b+8|0;f[F>>2]=w;G=b+12|0;f[G>>2]=x;H=c[o>>2]|0;I=c[p>>2]|0;J=b+60|0;K=J;L=K;c[L>>2]=H;M=K+4|0;N=M;c[N>>2]=I;ka=l;return}}function rb(a,b,d){a=a|0;b=+b;d=d|0;var e=0;if(c[a+20>>2]|0)return;e=c[a+212>>2]|0;sa[c[c[e>>2]>>2]&3](e,b,d);return}function sb(a,b){a=a|0;b=b|0;var d=0;if(c[a+20>>2]|0)return;d=c[a+212>>2]|0;ta[c[(c[d>>2]|0)+4>>2]&15](d,b);return}function tb(a,b){a=a|0;b=b|0;var d=0;if(c[a+20>>2]|0)return;d=c[a+212>>2]|0;ta[c[(c[d>>2]|0)+8>>2]&15](d,b);return}function ub(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;d=ka;ka=ka+16|0;e=d+8|0;f=d;g=c[a+212>>2]|0;h=c[(c[g>>2]|0)+12>>2]|0;i=b;j=c[i+4>>2]|0;k=f;c[k>>2]=c[i>>2];c[k+4>>2]=j;c[e>>2]=c[f>>2];c[e+4>>2]=c[f+4>>2];ta[h&15](g,e);if(!(c[a+20>>2]|0)){xb(a+24|0,b,c[a+4>>2]|0);ka=d;return}else{xb(a+116|0,b,c[a+4>>2]|0);ka=d;return}}function vb(b,d){b=b|0;d=d|0;var e=0,g=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0.0,p=0.0,q=0.0;e=ka;ka=ka+16|0;g=e+8|0;i=e;j=c[b+212>>2]|0;k=c[(c[j>>2]|0)+16>>2]|0;l=d;m=c[l>>2]|0;n=c[l+4>>2]|0;l=i;c[l>>2]=m;c[l+4>>2]=n;c[g>>2]=c[i>>2];c[g+4>>2]=c[i+4>>2];ta[k&15](j,g);j=b+4|0;k=b+112|0;o=(c[h>>2]=m,+f[h>>2]);if((((a[k>>0]|0?(m=c[j>>2]|0,a[k>>0]=0,p=+f[b+108>>2],k=c[b+96>>2]|0,i=c[m>>2]|0,m=i+(k*28|0)|0,f[m>>2]=p+ +f[m>>2],m=i+(k*28|0)+4|0,f[m>>2]=p+ +f[m>>2],m=c[b+100>>2]|0,k=i+(m*28|0)|0,f[k>>2]=p+ +f[k>>2],k=i+(m*28|0)+4|0,f[k>>2]=p+ +f[k>>2],k=c[b+104>>2]|0,m=i+(k*28|0)|0,f[m>>2]=p+ +f[m>>2],m=i+(k*28|0)+4|0,f[m>>2]=p+ +f[m>>2],p=+f[d+4>>2],q=+f[b+24>>2],q<=o):0)?q+ +f[b+32>>2]>=o:0)?(q=+f[b+28>>2],q<=p):0)?q+ +f[b+36>>2]>=p:0){Hc(4889)|0;Hc(4851)|0;c[b+20>>2]=1;m=c[b+208>>2]|0;k=c[c[j>>2]>>2]|0;c[k+(m*28|0)>>2]=0;c[k+(m*28|0)+4>>2]=0;c[b+148>>2]=0;c[b+152>>2]=0;f[g>>2]=0.0;f[g+4>>2]=0.0;pb(b+116|0,g,b+8|0,c[j>>2]|0);ka=e;return}m=b+116|0;k=b+204|0;if(!(a[k>>0]|0)){ka=e;return}i=c[j>>2]|0;a[k>>0]=0;p=+f[b+200>>2];k=c[b+188>>2]|0;n=c[i>>2]|0;i=n+(k*28|0)|0;f[i>>2]=p+ +f[i>>2];i=n+(k*28|0)+4|0;f[i>>2]=p+ +f[i>>2];i=c[b+192>>2]|0;k=n+(i*28|0)|0;f[k>>2]=p+ +f[k>>2];k=n+(i*28|0)+4|0;f[k>>2]=p+ +f[k>>2];k=c[b+196>>2]|0;i=n+(k*28|0)|0;f[i>>2]=p+ +f[i>>2];i=n+(k*28|0)+4|0;f[i>>2]=p+ +f[i>>2];p=+f[d+4>>2];q=+f[m>>2];if(!(q<=o)){ka=e;return}if(!(q+ +f[b+124>>2]>=o)){ka=e;return}o=+f[b+120>>2];if(!(o<=p)){ka=e;return}if(!(o+ +f[b+128>>2]>=p)){ka=e;return}Hc(4889)|0;Hc(4842)|0;c[b+20>>2]=0;d=b+12|0;p=-+f[d>>2];i=c[b+208>>2]|0;k=c[c[j>>2]>>2]|0;c[k+(i*28|0)>>2]=0;f[k+(i*28|0)+4>>2]=p;p=-+f[d>>2];c[b+148>>2]=0;f[b+152>>2]=p;f[g>>2]=0.0;f[g+4>>2]=0.0;pb(m,g,b+8|0,c[j>>2]|0);ka=e;return}function wb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=d;f=c[e+4>>2]|0;g=a+8|0;c[g>>2]=c[e>>2];c[g+4>>2]=f;f=a+4|0;pb(a+24|0,b,d,c[f>>2]|0);pb(a+116|0,b,d,c[f>>2]|0);f=c[a+212>>2]|0;ua[c[(c[f>>2]|0)+20>>2]&3](f,b,d);return}function xb(b,d,e){b=b|0;d=d|0;e=e|0;var g=0.0,h=0.0,i=0.0,j=0;Hc(4859)|0;g=+f[d>>2];h=+f[d+4>>2];i=+f[b>>2];if(!(i<=g))return;if(!(i+ +f[b+8>>2]>=g))return;g=+f[b+4>>2];if(!(g<=h))return;if(!(g+ +f[b+12>>2]>=h))return;Hc(4859)|0;h=+f[b+84>>2];d=c[b+72>>2]|0;j=c[e>>2]|0;e=j+(d*28|0)|0;f[e>>2]=+f[e>>2]-h;e=j+(d*28|0)+4|0;f[e>>2]=+f[e>>2]-h;e=c[b+76>>2]|0;d=j+(e*28|0)|0;f[d>>2]=+f[d>>2]-h;d=j+(e*28|0)+4|0;f[d>>2]=+f[d>>2]-h;d=c[b+80>>2]|0;e=j+(d*28|0)|0;f[e>>2]=+f[e>>2]-h;e=j+(d*28|0)+4|0;f[e>>2]=+f[e>>2]-h;a[b+88>>0]=1;return}function yb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=ka;ka=ka+16|0;e=d;if((b|0)==(a|0)){ka=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){ta[c[(c[g>>2]|0)+12>>2]&15](g,e);j=c[f>>2]|0;ra[c[(c[j>>2]|0)+16>>2]&31](j);c[f>>2]=0;j=c[i>>2]|0;ta[c[(c[j>>2]|0)+12>>2]&15](j,a);j=c[i>>2]|0;ra[c[(c[j>>2]|0)+16>>2]&31](j);c[i>>2]=0;c[f>>2]=a;ta[c[(c[e>>2]|0)+12>>2]&15](e,b);ra[c[(c[e>>2]|0)+16>>2]&31](e);c[i>>2]=b;ka=d;return}else{ta[c[(c[g>>2]|0)+12>>2]&15](g,b);g=c[f>>2]|0;ra[c[(c[g>>2]|0)+16>>2]&31](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;ka=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){ta[c[(c[g>>2]|0)+12>>2]&15](g,a);b=c[i>>2]|0;ra[c[(c[b>>2]|0)+16>>2]&31](b);c[i>>2]=c[f>>2];c[f>>2]=a;ka=d;return}else{c[f>>2]=g;c[i>>2]=h;ka=d;return}}}function zb(a){a=a|0;Qc(a);return}function Ab(a){a=a|0;var b=0,d=0;b=Pc(20)|0;d=a+4|0;c[b>>2]=3072;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return b|0}function Bb(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=3072;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return}function Cb(a){a=a|0;return}function Db(a){a=a|0;Qc(a);return}function Eb(a){a=a|0;var b=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0.0;b=ka;ka=ka+80|0;e=b+64|0;h=b+56|0;i=b+48|0;j=b;k=a+4|0;a:do if(!(B(j|0)|0))l=k;else{m=j+16|0;n=j+20|0;o=j+24|0;p=i+4|0;q=i+4|0;r=j+8|0;b:while(1){switch(c[j>>2]|0){case 256:{break b;break}case 769:{s=c[k>>2]|0;t=c[m>>2]|0;u=(c[s+16>>2]|0)+(t>>>5<<2)|0;c[u>>2]=c[u>>2]&~(1<<(t&31));u=c[s>>2]|0;ta[c[(c[u>>2]|0)+4>>2]&15](u,t);break}case 768:{t=c[k>>2]|0;u=c[m>>2]|0;s=(c[t+16>>2]|0)+(u>>>5<<2)|0;c[s>>2]=c[s>>2]|1<<(u&31);s=c[t>>2]|0;ta[c[(c[s>>2]|0)+8>>2]&15](s,u);break}case 1025:{v=+(c[o>>2]|0);u=c[c[k>>2]>>2]|0;s=c[(c[u>>2]|0)+12>>2]|0;f[i>>2]=+(c[n>>2]|0);f[p>>2]=v;c[e>>2]=c[i>>2];c[e+4>>2]=c[i+4>>2];ta[s&15](u,e);break}case 1026:{v=+(c[o>>2]|0);u=c[c[k>>2]>>2]|0;s=c[(c[u>>2]|0)+16>>2]|0;f[i>>2]=+(c[n>>2]|0);f[q>>2]=v;c[e>>2]=c[i>>2];c[e+4>>2]=c[i+4>>2];ta[s&15](u,e);break}case 512:{u=d[r>>0]|0;c[h>>2]=512;c[h+4>>2]=u;Fc(4810,h)|0;break}default:{}}if(!(B(j|0)|0)){l=k;break a}}Ed()}while(0);k=a+8|0;j=c[k>>2]|0;h=j;e=Ud(c[h>>2]|0,c[h+4>>2]|0,1,0)|0;h=w()|0;i=j;c[i>>2]=e;c[i+4>>2]=h;v=+Y();h=c[l>>2]|0;l=c[c[a+12>>2]>>2]|0;i=c[k>>2]|0;k=c[i>>2]|0;e=c[i+4>>2]|0;i=c[h>>2]|0;sa[c[c[i>>2]>>2]&3](i,v,h+16|0);Ib(h,l,v,k,e);g[c[a+16>>2]>>3]=v;ka=b;return}function Fb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==4830?a+4|0:0)|0}function Gb(a){a=a|0;return 2848}function Hb(a){a=a|0;return}function Ib(b,d,e,g,h){b=b|0;d=d|0;e=+e;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0.0,n=0,o=0;h=c[(c[b>>2]|0)+4>>2]|0;W(d|0,0,0,~~+f[b+4>>2]|0,~~+f[b+8>>2]|0,c[b+12>>2]|0)|0;b=h+4|0;g=c[h>>2]|0;if((c[b>>2]|0)==(g|0)){E(d|0,0,0,0,0);return}i=g;g=0;j=0;do{k=i;l=k+(g*28|0)|0;switch(c[k+(g*28|0)+24>>2]|0){case 0:{e=+f[k+(g*28|0)+8>>2]*.5;m=+f[k+(g*28|0)+12>>2]*.5;ba(d|0,~~(e+ +f[l>>2])|0,~~(m+ +f[k+(g*28|0)+4>>2])|0,~~e|0,~~m|0,c[k+(g*28|0)+16>>2]|0)|0;break}case 1:{m=+f[l>>2];e=+f[k+(g*28|0)+4>>2];W(d|0,~~m|0,~~e|0,~~(m+ +f[k+(g*28|0)+8>>2])|0,~~(e+ +f[k+(g*28|0)+12>>2])|0,c[k+(g*28|0)+16>>2]|0)|0;break}case 2:{n=(c[2312]|0)+((c[k+(g*28|0)+20>>2]|0)*12|0)|0;if((a[n+11>>0]|0)<0)o=c[n>>2]|0;else o=n;ca(d|0,o|0,~~+f[l>>2]|0,~~+f[k+(g*28|0)+4>>2]|0,c[k+(g*28|0)+16>>2]|0)|0;break}default:{}}g=Ud(g|0,j|0,1,0)|0;j=w()|0;i=c[h>>2]|0}while(j>>>0<0|((j|0)==0?g>>>0<(((c[b>>2]|0)-i|0)/28|0)>>>0:0));E(d|0,0,0,0,0);return}function Jb(){var b=0,d=0,e=0,f=0,g=0,h=0;b=ka;ka=ka+16|0;d=b;e=Pc(16)|0;c[d>>2]=e;c[d+8>>2]=-2147483632;c[d+4>>2]=12;f=e;g=3876;h=f+12|0;do{a[f>>0]=a[g>>0]|0;f=f+1|0;g=g+1|0}while((f|0)<(h|0));a[e+12>>0]=0;Rc(6744,d);if((a[d+11>>0]|0)<0)Qc(c[d>>2]|0);d=Sc(6744)|0;c[1687]=d;e=1;g=d;do{g=(s(g>>>30^g,1812433253)|0)+e|0;c[6748+(e<<2)>>2]=g;e=e+1|0}while((e|0)!=624);c[2311]=0;c[2312]=0;c[2313]=0;c[2314]=0;c[2315]=0;c[2316]=0;c[2317]=0;c[2318]=0;c[2319]=1065353216;c[1684]=0;ka=b;return}function Kb(a){a=a|0;var b=0,d=0;b=ka;ka=ka+16|0;d=b;c[d>>2]=Pb(c[a+60>>2]|0)|0;a=Nb(U(6,d|0)|0)|0;ka=b;return a|0}function Lb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=ka;ka=ka+48|0;f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=Nb(P(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=Nb(P(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}ka=e;return v|0}function Mb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=ka;ka=ka+32|0;f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((Nb(O(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;ka=e;return h|0}function Nb(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(Ob()|0)>>2]=0-a;b=-1}else b=a;return b|0}function Ob(){return 9344}function Pb(a){a=a|0;return a|0}function Qb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=ka;ka=ka+32|0;g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,T(54,g|0)|0):0)a[b+75>>0]=-1;g=Lb(b,d,e)|0;ka=f;return g|0}function Rb(a){a=a|0;return (a+-48|0)>>>0<10|0}function Sb(){return 3364}function Tb(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function Ub(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function Vb(a,b){a=a|0;b=b|0;var c=0;c=Ub(a)|0;return ((Wb(a,1,c,b)|0)!=(c|0))<<31>>31|0}function Wb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=s(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(Yb(e)|0)==0;h=$b(a,f,e)|0;if(d)i=h;else{Xb(e);i=h}}else i=$b(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function Xb(a){a=a|0;return}function Yb(a){a=a|0;return 1}function Zb(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=ka;ka=ka+16|0;g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(_b(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((pa[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);ka=f;return m|0}function _b(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function $b(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(_b(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=pa[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=pa[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);ae(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function ac(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=bc(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function bc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=cc(c[b+8>>2]|0,f)|0;h=cc(c[b+12>>2]|0,f)|0;i=cc(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=cc(c[b+(q<<2)>>2]|0,f)|0;s=cc(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=Tb(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=cc(c[b+(m<<2)>>2]|0,f)|0;j=cc(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function cc(a,b){a=a|0;b=b|0;var c=0;c=$d(a|0)|0;return ((b|0)==0?a:c)|0}function dc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;t=p;m=5;break}}}else{q=b;r=e;t=g;m=5}while(0);if((m|0)==5)if(t){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{u=k;break}q=s(f,16843009)|0;c:do if(l>>>0>3){t=k;g=l;while(1){e=c[t>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){v=g;w=t;break c}e=t+4|0;b=g+-4|0;if(b>>>0>3){t=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{v=y;w=x}q=w;g=v;while(1){if((a[q>>0]|0)==r<<24>>24){u=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)u=0;return u|0}function ec(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=ka;ka=ka+224|0;g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((fc(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=Yb(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=fc(b,d,g,i,h)|0;if(!o)s=j;else{pa[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=fc(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)Xb(b);m=(h&32|0)==0?s:-1}ka=f;return m|0}function fc(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0;j=ka;ka=ka+64|0;k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;x=t;while(1){do if((x|0)>-1)if((v|0)>(2147483647-x|0)){c[(Ob()|0)>>2]=75;y=-1;break}else{y=v+x|0;break}else y=x;while(0);z=c[k>>2]|0;A=a[z>>0]|0;if(!(A<<24>>24)){B=94;break a}C=A;A=z;b:while(1){switch(C<<24>>24){case 37:{B=10;break b;break}case 0:{D=A;break b;break}default:{}}E=A+1|0;c[k>>2]=E;C=a[E>>0]|0;A=E}c:do if((B|0)==10){B=0;C=A;E=A;while(1){if((a[E+1>>0]|0)!=37){D=C;break c}F=C+1|0;E=E+2|0;c[k>>2]=E;if((a[E>>0]|0)!=37){D=F;break}else C=F}}while(0);v=D-z|0;if(e)gc(d,z,v);if(!v)break;else x=y}x=(Rb(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!x?(a[v+2>>0]|0)==36:0){G=(a[v+1>>0]|0)+-48|0;H=1;I=3}else{G=-1;H=u;I=1}x=v+I|0;c[k>>2]=x;v=a[x>>0]|0;A=(v<<24>>24)+-32|0;if(A>>>0>31|(1<<A&75913|0)==0){J=0;K=v;L=x}else{v=0;C=A;A=x;while(1){x=1<<C|v;E=A+1|0;c[k>>2]=E;F=a[E>>0]|0;C=(F<<24>>24)+-32|0;if(C>>>0>31|(1<<C&75913|0)==0){J=x;K=F;L=E;break}else{v=x;A=E}}}if(K<<24>>24==42){if((Rb(a[L+1>>0]|0)|0)!=0?(A=c[k>>2]|0,(a[A+2>>0]|0)==36):0){v=A+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;M=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;N=1;O=A+3|0}else{if(H|0){P=-1;break}if(e){A=(c[f>>2]|0)+(4-1)&~(4-1);v=c[A>>2]|0;c[f>>2]=A+4;Q=v}else Q=0;M=Q;N=0;O=(c[k>>2]|0)+1|0}c[k>>2]=O;v=(M|0)<0;R=v?0-M|0:M;S=v?J|8192:J;T=N;U=O}else{v=hc(k)|0;if((v|0)<0){P=-1;break}R=v;S=J;T=H;U=c[k>>2]|0}do if((a[U>>0]|0)==46){v=U+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=hc(k)|0;V=v;W=c[k>>2]|0;break}if(Rb(a[U+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){A=v+2|0;c[i+((a[A>>0]|0)+-48<<2)>>2]=10;C=c[h+((a[A>>0]|0)+-48<<3)>>2]|0;A=v+4|0;c[k>>2]=A;V=C;W=A;break}if(T|0){P=-1;break a}if(e){A=(c[f>>2]|0)+(4-1)&~(4-1);C=c[A>>2]|0;c[f>>2]=A+4;X=C}else X=0;C=(c[k>>2]|0)+2|0;c[k>>2]=C;V=X;W=C}else{V=-1;W=U}while(0);C=0;A=W;while(1){if(((a[A>>0]|0)+-65|0)>>>0>57){P=-1;break a}v=A;A=A+1|0;c[k>>2]=A;Y=a[(a[v>>0]|0)+-65+(16+(C*58|0))>>0]|0;Z=Y&255;if((Z+-1|0)>>>0>=8)break;else C=Z}if(!(Y<<24>>24)){P=-1;break}v=(G|0)>-1;do if(Y<<24>>24==19)if(v){P=-1;break a}else B=54;else{if(v){c[i+(G<<2)>>2]=Z;E=h+(G<<3)|0;x=c[E+4>>2]|0;F=l;c[F>>2]=c[E>>2];c[F+4>>2]=x;B=54;break}if(!e){P=0;break a}ic(l,Z,f);_=c[k>>2]|0;B=55}while(0);if((B|0)==54){B=0;if(e){_=A;B=55}else $=0}d:do if((B|0)==55){B=0;v=a[_+-1>>0]|0;x=(C|0)!=0&(v&15|0)==3?v&-33:v;v=S&-65537;F=(S&8192|0)==0?S:v;e:do switch(x|0){case 110:{switch((C&255)<<24>>24){case 0:{c[c[l>>2]>>2]=y;$=0;break d;break}case 1:{c[c[l>>2]>>2]=y;$=0;break d;break}case 2:{E=c[l>>2]|0;c[E>>2]=y;c[E+4>>2]=((y|0)<0)<<31>>31;$=0;break d;break}case 3:{b[c[l>>2]>>1]=y;$=0;break d;break}case 4:{a[c[l>>2]>>0]=y;$=0;break d;break}case 6:{c[c[l>>2]>>2]=y;$=0;break d;break}case 7:{E=c[l>>2]|0;c[E>>2]=y;c[E+4>>2]=((y|0)<0)<<31>>31;$=0;break d;break}default:{$=0;break d}}break}case 112:{aa=120;ba=V>>>0>8?V:8;ca=F|8;B=67;break}case 88:case 120:{aa=x;ba=V;ca=F;B=67;break}case 111:{E=l;da=c[E>>2]|0;ea=c[E+4>>2]|0;E=kc(da,ea,p)|0;fa=q-E|0;ga=E;ha=0;ia=4911;ja=(F&8|0)==0|(V|0)>(fa|0)?V:fa+1|0;la=F;ma=da;na=ea;B=73;break}case 105:case 100:{ea=l;da=c[ea>>2]|0;fa=c[ea+4>>2]|0;if((fa|0)<0){ea=Vd(0,0,da|0,fa|0)|0;E=w()|0;oa=l;c[oa>>2]=ea;c[oa+4>>2]=E;pa=1;qa=4911;ra=ea;sa=E;B=72;break e}else{pa=(F&2049|0)!=0&1;qa=(F&2048|0)==0?((F&1|0)==0?4911:4913):4912;ra=da;sa=fa;B=72;break e}break}case 117:{fa=l;pa=0;qa=4911;ra=c[fa>>2]|0;sa=c[fa+4>>2]|0;B=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=4911;wa=1;xa=v;ya=q;break}case 109:{za=mc(c[(Ob()|0)>>2]|0)|0;B=77;break}case 115:{fa=c[l>>2]|0;za=(fa|0)==0?4921:fa;B=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Aa=-1;B=81;break}case 83:{if(!V){nc(d,32,R,0,F);Ba=0;B=91}else{Aa=V;B=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{$=pc(d,+g[l>>3],R,V,F,x)|0;break d;break}default:{ta=z;ua=0;va=4911;wa=V;xa=F;ya=q}}while(0);f:do if((B|0)==67){B=0;x=l;fa=c[x>>2]|0;da=c[x+4>>2]|0;x=jc(fa,da,p,aa&32)|0;E=(ca&8|0)==0|(fa|0)==0&(da|0)==0;ga=x;ha=E?0:2;ia=E?4911:4911+(aa>>>4)|0;ja=ba;la=ca;ma=fa;na=da;B=73}else if((B|0)==72){B=0;ga=lc(ra,sa,p)|0;ha=pa;ia=qa;ja=V;la=F;ma=ra;na=sa;B=73}else if((B|0)==77){B=0;da=dc(za,0,V)|0;fa=(da|0)==0;ta=za;ua=0;va=4911;wa=fa?V:da-za|0;xa=v;ya=fa?za+V|0:da}else if((B|0)==81){B=0;da=c[l>>2]|0;fa=0;while(1){E=c[da>>2]|0;if(!E){Ca=fa;break}x=oc(o,E)|0;Da=(x|0)<0;if(Da|x>>>0>(Aa-fa|0)>>>0){B=85;break}E=x+fa|0;if(Aa>>>0>E>>>0){da=da+4|0;fa=E}else{Ca=E;break}}if((B|0)==85){B=0;if(Da){P=-1;break a}else Ca=fa}nc(d,32,R,Ca,F);if(!Ca){Ba=0;B=91}else{da=c[l>>2]|0;E=0;while(1){x=c[da>>2]|0;if(!x){Ba=Ca;B=91;break f}ea=oc(o,x)|0;E=ea+E|0;if((E|0)>(Ca|0)){Ba=Ca;B=91;break f}gc(d,o,ea);if(E>>>0>=Ca>>>0){Ba=Ca;B=91;break}else da=da+4|0}}}while(0);if((B|0)==73){B=0;v=(ma|0)!=0|(na|0)!=0;da=(ja|0)!=0|v;E=q-ga+((v^1)&1)|0;ta=da?ga:p;ua=ha;va=ia;wa=da?((ja|0)>(E|0)?ja:E):0;xa=(ja|0)>-1?la&-65537:la;ya=q}else if((B|0)==91){B=0;nc(d,32,R,Ba,F^8192);$=(R|0)>(Ba|0)?R:Ba;break}E=ya-ta|0;da=(wa|0)<(E|0)?E:wa;v=da+ua|0;fa=(R|0)<(v|0)?v:R;nc(d,32,fa,v,xa);gc(d,va,ua);nc(d,48,fa,v,xa^65536);nc(d,48,da,E,0);gc(d,ta,E);nc(d,32,fa,v,xa^8192);$=fa}while(0);s=$;t=y;u=T}g:do if((B|0)==94)if(!d)if(!u)P=0;else{T=1;while(1){t=c[i+(T<<2)>>2]|0;if(!t)break;ic(h+(T<<3)|0,t,f);t=T+1|0;if(t>>>0<10)T=t;else{P=1;break g}}t=T;while(1){if(c[i+(t<<2)>>2]|0){P=-1;break g}t=t+1|0;if(t>>>0>=10){P=1;break}}}else P=y;while(0);ka=j;return P|0}function gc(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))$b(b,d,a)|0;return}function hc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(Rb(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(Rb(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function ic(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function jc(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=Zd(c|0,e|0,4)|0;e=w()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function kc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=Zd(c|0,d|0,3)|0;d=w()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function lc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=Yd(f|0,g|0,10,0)|0;h=g;g=w()|0;i=Td(f|0,g|0,10,0)|0;j=Vd(c|0,h|0,i|0,w()|0)|0;w()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function mc(a){a=a|0;return wc(a,c[(vc()|0)+188>>2]|0)|0}function nc(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=ka;ka=ka+256|0;g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;ce(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{gc(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;gc(a,g,h)}ka=f;return}function oc(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=tc(a,b,0)|0;return c|0}function pc(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0.0,u=0,v=0.0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0,H=0,I=0,J=0.0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0.0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0.0,ia=0.0,ja=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0;j=ka;ka=ka+560|0;k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=qc(e)|0;r=w()|0;if((r|0)<0){t=-e;u=qc(t)|0;v=t;x=1;y=4928;z=w()|0;A=u}else{v=e;x=(h&2049|0)!=0&1;y=(h&2048|0)==0?((h&1|0)==0?4929:4934):4931;z=r;A=q}do if(0==0&(z&2146435072|0)==2146435072){q=(i&32|0)!=0;A=x+3|0;nc(b,32,f,A,h&-65537);gc(b,y,x);gc(b,v!=v|0.0!=0.0?(q?4955:4959):q?4947:4951,3);nc(b,32,f,A,h^8192);B=A}else{e=+rc(v,l)*2.0;A=e!=0.0;if(A)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;u=(r|0)==0?y:y+9|0;C=x|2;D=12-g|0;do if(!(g>>>0>11|(D|0)==0)){t=8.0;E=D;do{E=E+-1|0;t=t*16.0}while((E|0)!=0);if((a[u>>0]|0)==45){F=-(t+(-e-t));break}else{F=e+t-t;break}}else F=e;while(0);D=c[l>>2]|0;E=(D|0)<0?0-D|0:D;G=lc(E,((E|0)<0)<<31>>31,p)|0;if((G|0)==(p|0)){E=o+11|0;a[E>>0]=48;H=E}else H=G;a[H+-1>>0]=(D>>31&2)+43;D=H+-2|0;a[D>>0]=i+15;G=(g|0)<1;E=(h&8|0)==0;I=m;J=F;while(1){K=~~J;L=I+1|0;a[I>>0]=r|d[480+K>>0];J=(J-+(K|0))*16.0;if((L-n|0)==1?!(E&(G&J==0.0)):0){a[L>>0]=46;M=I+2|0}else M=L;if(!(J!=0.0))break;else I=M}I=M;if((g|0)!=0?(-2-n+I|0)<(g|0):0){G=p;E=D;N=g+2+G-E|0;O=G;P=E}else{E=p;G=D;N=E-n-G+I|0;O=E;P=G}G=N+C|0;nc(b,32,f,G,h);gc(b,u,C);nc(b,48,f,G,h^65536);E=I-n|0;gc(b,m,E);I=O-P|0;nc(b,48,N-(E+I)|0,0,0);gc(b,D,I);nc(b,32,f,G,h^8192);B=G;break}G=(g|0)<0?6:g;if(A){I=(c[l>>2]|0)+-28|0;c[l>>2]=I;Q=e*268435456.0;R=I}else{Q=e;R=c[l>>2]|0}I=(R|0)<0?k:k+288|0;E=I;J=Q;do{r=~~J>>>0;c[E>>2]=r;E=E+4|0;J=(J-+(r>>>0))*1.0e9}while(J!=0.0);A=I;if((R|0)>0){D=I;C=E;u=R;while(1){r=(u|0)<29?u:29;L=C+-4|0;if(L>>>0>=D>>>0){K=L;L=0;do{S=_d(c[K>>2]|0,0,r|0)|0;T=Ud(S|0,w()|0,L|0,0)|0;S=w()|0;L=Yd(T|0,S|0,1e9,0)|0;U=Td(L|0,w()|0,1e9,0)|0;V=Vd(T|0,S|0,U|0,w()|0)|0;w()|0;c[K>>2]=V;K=K+-4|0}while(K>>>0>=D>>>0);if(L){K=D+-4|0;c[K>>2]=L;W=K}else W=D}else W=D;a:do if(C>>>0>W>>>0){K=C;while(1){V=K+-4|0;if(c[V>>2]|0){X=K;break a}if(V>>>0>W>>>0)K=V;else{X=V;break}}}else X=C;while(0);L=(c[l>>2]|0)-r|0;c[l>>2]=L;if((L|0)>0){D=W;C=X;u=L}else{Y=W;Z=X;_=L;break}}}else{Y=I;Z=E;_=R}if((_|0)<0){u=((G+25|0)/9|0)+1|0;C=(q|0)==102;D=Y;L=Z;K=_;while(1){V=0-K|0;U=(V|0)<9?V:9;if(D>>>0<L>>>0){V=(1<<U)+-1|0;S=1e9>>>U;T=0;$=D;do{aa=c[$>>2]|0;c[$>>2]=(aa>>>U)+T;T=s(aa&V,S)|0;$=$+4|0}while($>>>0<L>>>0);$=(c[D>>2]|0)==0?D+4|0:D;if(!T){ba=L;ca=$}else{c[L>>2]=T;ba=L+4|0;ca=$}}else{ba=L;ca=(c[D>>2]|0)==0?D+4|0:D}$=C?I:ca;S=(ba-$>>2|0)>(u|0)?$+(u<<2)|0:ba;K=(c[l>>2]|0)+U|0;c[l>>2]=K;if((K|0)>=0){da=ca;ea=S;break}else{D=ca;L=S}}}else{da=Y;ea=Z}if(da>>>0<ea>>>0){L=(A-da>>2)*9|0;D=c[da>>2]|0;if(D>>>0<10)fa=L;else{K=L;L=10;while(1){L=L*10|0;u=K+1|0;if(D>>>0<L>>>0){fa=u;break}else K=u}}}else fa=0;K=(q|0)==103;L=(G|0)!=0;D=G-((q|0)==102?0:fa)+((L&K)<<31>>31)|0;if((D|0)<(((ea-A>>2)*9|0)+-9|0)){u=D+9216|0;D=(u|0)/9|0;C=I+4+(D+-1024<<2)|0;E=u-(D*9|0)|0;if((E|0)<8){D=E;E=10;while(1){u=E*10|0;if((D|0)<7){D=D+1|0;E=u}else{ga=u;break}}}else ga=10;E=c[C>>2]|0;D=(E>>>0)/(ga>>>0)|0;q=E-(s(D,ga)|0)|0;u=(C+4|0)==(ea|0);if(!(u&(q|0)==0)){t=(D&1|0)==0?9007199254740992.0:9007199254740994.0;D=ga>>>1;J=q>>>0<D>>>0?.5:u&(q|0)==(D|0)?1.0:1.5;if(!x){ha=J;ia=t}else{D=(a[y>>0]|0)==45;ha=D?-J:J;ia=D?-t:t}D=E-q|0;c[C>>2]=D;if(ia+ha!=ia){q=D+ga|0;c[C>>2]=q;if(q>>>0>999999999){q=C;D=da;while(1){E=q+-4|0;c[q>>2]=0;if(E>>>0<D>>>0){u=D+-4|0;c[u>>2]=0;ja=u}else ja=D;u=(c[E>>2]|0)+1|0;c[E>>2]=u;if(u>>>0>999999999){q=E;D=ja}else{la=E;ma=ja;break}}}else{la=C;ma=da}D=(A-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=D;pa=ma}else{E=D;D=10;while(1){D=D*10|0;u=E+1|0;if(q>>>0<D>>>0){na=la;oa=u;pa=ma;break}else E=u}}}else{na=C;oa=fa;pa=da}}else{na=C;oa=fa;pa=da}E=na+4|0;qa=oa;ra=ea>>>0>E>>>0?E:ea;sa=pa}else{qa=fa;ra=ea;sa=da}E=0-qa|0;b:do if(ra>>>0>sa>>>0){D=ra;while(1){q=D+-4|0;if(c[q>>2]|0){ta=D;ua=1;break b}if(q>>>0>sa>>>0)D=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(K){C=G+((L^1)&1)|0;if((C|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=C+-1-qa|0}else{va=i+-2|0;wa=C+-1|0}if(!(h&8)){if(ua?(C=c[ta+-4>>2]|0,(C|0)!=0):0)if(!((C>>>0)%10|0)){D=0;U=10;while(1){U=U*10|0;T=D+1|0;if((C>>>0)%(U>>>0)|0|0){xa=T;break}else D=T}}else xa=0;else xa=9;D=((ta-A>>2)*9|0)+-9|0;if((va|32|0)==102){U=D-xa|0;C=(U|0)>0?U:0;ya=va;za=(wa|0)<(C|0)?wa:C;break}else{C=D+qa-xa|0;D=(C|0)>0?C:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}}else{ya=va;za=wa}}else{ya=i;za=G}while(0);G=(za|0)!=0;A=G?1:h>>>3&1;L=(ya|32|0)==102;if(L){Aa=0;Ba=(qa|0)>0?qa:0}else{K=(qa|0)<0?E:qa;D=lc(K,((K|0)<0)<<31>>31,p)|0;K=p;if((K-D|0)<2){C=D;while(1){U=C+-1|0;a[U>>0]=48;if((K-U|0)<2)C=U;else{Ca=U;break}}}else Ca=D;a[Ca+-1>>0]=(qa>>31&2)+43;C=Ca+-2|0;a[C>>0]=ya;Aa=C;Ba=K-C|0}C=x+1+za+A+Ba|0;nc(b,32,f,C,h);gc(b,y,x);nc(b,48,f,C,h^65536);if(L){E=sa>>>0>I>>>0?I:sa;U=m+9|0;T=U;q=m+8|0;u=E;do{S=lc(c[u>>2]|0,0,U)|0;if((u|0)==(E|0))if((S|0)==(U|0)){a[q>>0]=48;Da=q}else Da=S;else if(S>>>0>m>>>0){ce(m|0,48,S-n|0)|0;$=S;while(1){V=$+-1|0;if(V>>>0>m>>>0)$=V;else{Da=V;break}}}else Da=S;gc(b,Da,T-Da|0);u=u+4|0}while(u>>>0<=I>>>0);if(!((h&8|0)==0&(G^1)))gc(b,4963,1);if(u>>>0<ta>>>0&(za|0)>0){I=za;T=u;while(1){q=lc(c[T>>2]|0,0,U)|0;if(q>>>0>m>>>0){ce(m|0,48,q-n|0)|0;E=q;while(1){L=E+-1|0;if(L>>>0>m>>>0)E=L;else{Ea=L;break}}}else Ea=q;gc(b,Ea,(I|0)<9?I:9);T=T+4|0;E=I+-9|0;if(!(T>>>0<ta>>>0&(I|0)>9)){Fa=E;break}else I=E}}else Fa=za;nc(b,48,Fa+9|0,9,0)}else{I=ua?ta:sa+4|0;if(sa>>>0<I>>>0&(za|0)>-1){T=m+9|0;U=(h&8|0)==0;u=T;G=0-n|0;E=m+8|0;S=za;L=sa;while(1){A=lc(c[L>>2]|0,0,T)|0;if((A|0)==(T|0)){a[E>>0]=48;Ga=E}else Ga=A;do if((L|0)==(sa|0)){A=Ga+1|0;gc(b,Ga,1);if(U&(S|0)<1){Ha=A;break}gc(b,4963,1);Ha=A}else{if(Ga>>>0<=m>>>0){Ha=Ga;break}ce(m|0,48,Ga+G|0)|0;A=Ga;while(1){K=A+-1|0;if(K>>>0>m>>>0)A=K;else{Ha=K;break}}}while(0);q=u-Ha|0;gc(b,Ha,(S|0)>(q|0)?q:S);A=S-q|0;L=L+4|0;if(!(L>>>0<I>>>0&(A|0)>-1)){Ia=A;break}else S=A}}else Ia=za;nc(b,48,Ia+18|0,18,0);gc(b,Aa,p-Aa|0)}nc(b,32,f,C,h^8192);B=C}while(0);ka=j;return ((B|0)<(f|0)?f:B)|0}function qc(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;v(c[h+4>>2]|0);return b|0}function rc(a,b){a=+a;b=b|0;return +(+sc(a,b))}function sc(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=Zd(d|0,e|0,52)|0;w()|0;switch(f&2047){case 0:{if(a!=0.0){i=+sc(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function tc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(uc()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(Ob()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(Ob()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function uc(){return Sb()|0}function vc(){return Sb()|0}function wc(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return xc(j,c[e+20>>2]|0)|0}function xc(a,b){a=a|0;b=b|0;return ac(a,b)|0}function yc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function zc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=ka;ka=ka+48|0;f=e+32|0;g=e+16|0;h=e;if(!(b&4194368))i=0;else{c[h>>2]=d;d=(c[h>>2]|0)+(4-1)&~(4-1);j=c[d>>2]|0;c[h>>2]=d+4;i=j}c[g>>2]=a;c[g+4>>2]=b|32768;c[g+8>>2]=i;i=S(5,g|0)|0;if(!((b&524288|0)==0|(i|0)<0)){c[f>>2]=i;c[f+4>>2]=2;c[f+8>>2]=1;Q(221,f|0)|0}f=Nb(i)|0;ka=e;return f|0}function Ac(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;g=ka;ka=ka+128|0;h=g+124|0;i=g;j=i;k=3608;l=j+124|0;do{c[j>>2]=c[k>>2];j=j+4|0;k=k+4|0}while((j|0)<(l|0));if((d+-1|0)>>>0>2147483646)if(!d){m=h;n=1;o=4}else{c[(Ob()|0)>>2]=75;p=-1}else{m=b;n=d;o=4}if((o|0)==4){o=-2-m|0;d=n>>>0>o>>>0?o:n;c[i+48>>2]=d;n=i+20|0;c[n>>2]=m;c[i+44>>2]=m;o=m+d|0;m=i+16|0;c[m>>2]=o;c[i+28>>2]=o;o=ec(i,e,f)|0;if(!d)p=o;else{d=c[n>>2]|0;a[d+(((d|0)==(c[m>>2]|0))<<31>>31)>>0]=0;p=o}}ka=g;return p|0}function Bc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=a+20|0;f=c[e>>2]|0;g=(c[a+16>>2]|0)-f|0;a=g>>>0>d>>>0?d:g;ae(f|0,b|0,a|0)|0;c[e>>2]=(c[e>>2]|0)+a;return d|0}function Cc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=ka;ka=ka+16|0;f=e;c[f>>2]=a;c[f+4>>2]=b;c[f+8>>2]=d;d=Nb(R(3,f|0)|0)|0;ka=e;return d|0}function Dc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=ka;ka=ka+16|0;f=e;c[f>>2]=d;d=Ec(a,b,f)|0;ka=e;return d|0}function Ec(a,b,c){a=a|0;b=b|0;c=c|0;return Ac(a,2147483647,b,c)|0}function Fc(a,b){a=a|0;b=b|0;var d=0,e=0;d=ka;ka=ka+16|0;e=d;c[e>>2]=b;b=ec(c[809]|0,a,e)|0;ka=d;return b|0}function Gc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(Yb(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=Zb(d,b)|0;Xb(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=Zb(d,b)|0}while(0);return j|0}function Hc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[809]|0;if((c[d+76>>2]|0)>-1)e=Yb(d)|0;else e=0;do if((Vb(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(Zb(d,10)|0)>>31}while(0);if(e|0)Xb(d);return f|0}function Ic(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0;b=ka;ka=ka+16|0;d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[2337]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=9388+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[2337]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;ka=b;return o|0}m=c[2339]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=9388+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[2337]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[2342]|0;h=m>>>3;l=9388+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[2337]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[2339]=j;c[2342]=k;o=f;ka=b;return o|0}f=c[2338]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[9652+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;y=u}}else{x=k;y=j}j=x;k=y;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){z=j+16|0;A=c[z>>2]|0;if(!A)break;else{B=A;C=z}}else{B=v;C=u}j=B;k=C}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=9652+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[2338]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[2342]|0;s=m>>>3;l=9388+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[2337]=u|g;D=l;E=l+8|0}else{u=l+8|0;D=c[u>>2]|0;E=u}c[E>>2]=f;c[D+12>>2]=f;c[f+8>>2]=D;c[f+12>>2]=l}c[2339]=n;c[2342]=i}o=h+8|0;ka=b;return o|0}else F=e}else F=e}else F=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[2338]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)G=31;else{l=(v+1048320|0)>>>16&8;z=v<<l;v=(z+520192|0)>>>16&4;A=z<<v;z=(A+245760|0)>>>16&2;H=14-(v|l|z)+(A<<z>>>15)|0;G=f>>>(H+7|0)&1|H<<1}else G=0;H=c[9652+(G<<2)>>2]|0;a:do if(!H){I=0;J=0;K=s;L=61}else{z=0;A=s;l=H;v=f<<((G|0)==31?0:25-(G>>>1)|0);M=0;while(1){N=(c[l+4>>2]&-8)-f|0;if(N>>>0<A>>>0)if(!N){O=l;P=0;Q=l;L=65;break a}else{R=l;S=N}else{R=z;S=A}N=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;T=(N|0)==0|(N|0)==(l|0)?M:N;if(!l){I=T;J=R;K=S;L=61;break}else{z=R;A=S;v=v<<1;M=T}}}while(0);if((L|0)==61){if((I|0)==0&(J|0)==0){H=2<<G;s=(H|0-H)&u;if(!s){F=f;break}H=(s&0-s)+-1|0;s=H>>>12&16;e=H>>>s;H=e>>>5&8;h=e>>>H;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;U=0;V=c[9652+((H|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{U=J;V=I}if(!V){W=U;X=K}else{O=U;P=K;Q=V;L=65}}if((L|0)==65){i=O;n=P;h=Q;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;H=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Y=c[h+20>>2]|0;else Y=s;if(!Y){W=e;X=H;break}else{i=e;n=H;h=Y}}}if(((W|0)!=0?X>>>0<((c[2339]|0)-f|0)>>>0:0)?(h=W+f|0,h>>>0>W>>>0):0){n=c[W+24>>2]|0;i=c[W+12>>2]|0;do if((i|0)==(W|0)){H=W+20|0;e=c[H>>2]|0;if(!e){s=W+16|0;g=c[s>>2]|0;if(!g){Z=0;break}else{_=g;$=s}}else{_=e;$=H}H=_;e=$;while(1){s=H+20|0;g=c[s>>2]|0;if(!g){m=H+16|0;M=c[m>>2]|0;if(!M)break;else{aa=M;ba=m}}else{aa=g;ba=s}H=aa;e=ba}c[e>>2]=0;Z=H}else{s=c[W+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;Z=i}while(0);do if(n){i=c[W+28>>2]|0;s=9652+(i<<2)|0;if((W|0)==(c[s>>2]|0)){c[s>>2]=Z;if(!Z){s=u&~(1<<i);c[2338]=s;ca=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(W|0)?s:n+20|0)>>2]=Z;if(!Z){ca=u;break}}c[Z+24>>2]=n;s=c[W+16>>2]|0;if(s|0){c[Z+16>>2]=s;c[s+24>>2]=Z}s=c[W+20>>2]|0;if(s){c[Z+20>>2]=s;c[s+24>>2]=Z;ca=u}else ca=u}else ca=u;while(0);b:do if(X>>>0<16){u=X+f|0;c[W+4>>2]=u|3;n=W+u+4|0;c[n>>2]=c[n>>2]|1}else{c[W+4>>2]=f|3;c[h+4>>2]=X|1;c[h+X>>2]=X;n=X>>>3;if(X>>>0<256){u=9388+(n<<1<<2)|0;s=c[2337]|0;i=1<<n;if(!(s&i)){c[2337]=s|i;da=u;ea=u+8|0}else{i=u+8|0;da=c[i>>2]|0;ea=i}c[ea>>2]=h;c[da+12>>2]=h;c[h+8>>2]=da;c[h+12>>2]=u;break}u=X>>>8;if(u)if(X>>>0>16777215)fa=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;fa=X>>>(g+7|0)&1|g<<1}else fa=0;g=9652+(fa<<2)|0;c[h+28>>2]=fa;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<fa;if(!(ca&s)){c[2338]=ca|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(X|0))ga=s;else{g=X<<((fa|0)==31?0:25-(fa>>>1)|0);n=s;while(1){ha=n+16+(g>>>31<<2)|0;i=c[ha>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(X|0)){ga=i;break c}else{g=g<<1;n=i}}c[ha>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ga+8|0;H=c[s>>2]|0;c[H+12>>2]=h;c[s>>2]=h;c[h+8>>2]=H;c[h+12>>2]=ga;c[h+24>>2]=0}while(0);o=W+8|0;ka=b;return o|0}else F=f}else F=f}else F=-1;while(0);W=c[2339]|0;if(W>>>0>=F>>>0){ga=W-F|0;ha=c[2342]|0;if(ga>>>0>15){X=ha+F|0;c[2342]=X;c[2339]=ga;c[X+4>>2]=ga|1;c[ha+W>>2]=ga;c[ha+4>>2]=F|3}else{c[2339]=0;c[2342]=0;c[ha+4>>2]=W|3;ga=ha+W+4|0;c[ga>>2]=c[ga>>2]|1}o=ha+8|0;ka=b;return o|0}ha=c[2340]|0;if(ha>>>0>F>>>0){ga=ha-F|0;c[2340]=ga;W=c[2343]|0;X=W+F|0;c[2343]=X;c[X+4>>2]=ga|1;c[W+4>>2]=F|3;o=W+8|0;ka=b;return o|0}if(!(c[2455]|0)){c[2457]=4096;c[2456]=4096;c[2458]=-1;c[2459]=-1;c[2460]=0;c[2448]=0;c[2455]=d&-16^1431655768;ia=4096}else ia=c[2457]|0;d=F+48|0;W=F+47|0;ga=ia+W|0;X=0-ia|0;ia=ga&X;if(ia>>>0<=F>>>0){o=0;ka=b;return o|0}fa=c[2447]|0;if(fa|0?(ca=c[2445]|0,da=ca+ia|0,da>>>0<=ca>>>0|da>>>0>fa>>>0):0){o=0;ka=b;return o|0}d:do if(!(c[2448]&4)){fa=c[2343]|0;e:do if(fa){da=9796;while(1){ca=c[da>>2]|0;if(ca>>>0<=fa>>>0?(ca+(c[da+4>>2]|0)|0)>>>0>fa>>>0:0)break;ca=c[da+8>>2]|0;if(!ca){L=128;break e}else da=ca}ca=ga-ha&X;if(ca>>>0<2147483647){ea=de(ca|0)|0;if((ea|0)==((c[da>>2]|0)+(c[da+4>>2]|0)|0))if((ea|0)==(-1|0))ja=ca;else{la=ca;ma=ea;L=145;break d}else{na=ea;oa=ca;L=136}}else ja=0}else L=128;while(0);do if((L|0)==128){fa=de(0)|0;if((fa|0)!=(-1|0)?(f=fa,ca=c[2456]|0,ea=ca+-1|0,Z=((ea&f|0)==0?0:(ea+f&0-ca)-f|0)+ia|0,f=c[2445]|0,ca=Z+f|0,Z>>>0>F>>>0&Z>>>0<2147483647):0){ea=c[2447]|0;if(ea|0?ca>>>0<=f>>>0|ca>>>0>ea>>>0:0){ja=0;break}ea=de(Z|0)|0;if((ea|0)==(fa|0)){la=Z;ma=fa;L=145;break d}else{na=ea;oa=Z;L=136}}else ja=0}while(0);do if((L|0)==136){Z=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ja=0;break}else{la=oa;ma=na;L=145;break d}ea=c[2457]|0;fa=W-oa+ea&0-ea;if(fa>>>0>=2147483647){la=oa;ma=na;L=145;break d}if((de(fa|0)|0)==(-1|0)){de(Z|0)|0;ja=0;break}else{la=fa+oa|0;ma=na;L=145;break d}}while(0);c[2448]=c[2448]|4;pa=ja;L=143}else{pa=0;L=143}while(0);if(((L|0)==143?ia>>>0<2147483647:0)?(ja=de(ia|0)|0,ia=de(0)|0,na=ia-ja|0,oa=na>>>0>(F+40|0)>>>0,!((ja|0)==(-1|0)|oa^1|ja>>>0<ia>>>0&((ja|0)!=(-1|0)&(ia|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ja;L=145}if((L|0)==145){ja=(c[2445]|0)+la|0;c[2445]=ja;if(ja>>>0>(c[2446]|0)>>>0)c[2446]=ja;ja=c[2343]|0;f:do if(ja){pa=9796;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){L=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((L|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ja>>>0&qa>>>0<=ja>>>0:0){c[na>>2]=ra+la;na=(c[2340]|0)+la|0;oa=ja+8|0;ia=(oa&7|0)==0?0:0-oa&7;oa=ja+ia|0;W=na-ia|0;c[2343]=oa;c[2340]=W;c[oa+4>>2]=W|1;c[ja+na+4>>2]=40;c[2344]=c[2459];break}if(ma>>>0<(c[2341]|0)>>>0)c[2341]=ma;na=ma+la|0;W=9796;while(1){if((c[W>>2]|0)==(na|0)){L=162;break}oa=c[W+8>>2]|0;if(!oa)break;else W=oa}if((L|0)==162?(c[W+12>>2]&8|0)==0:0){c[W>>2]=ma;pa=W+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ia=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+F|0;d=ia-oa-F|0;c[oa+4>>2]=F|3;g:do if((ja|0)==(ia|0)){X=(c[2340]|0)+d|0;c[2340]=X;c[2343]=pa;c[pa+4>>2]=X|1}else{if((c[2342]|0)==(ia|0)){X=(c[2339]|0)+d|0;c[2339]=X;c[2342]=pa;c[pa+4>>2]=X|1;c[pa+X>>2]=X;break}X=c[ia+4>>2]|0;if((X&3|0)==1){ha=X&-8;ga=X>>>3;h:do if(X>>>0<256){fa=c[ia+8>>2]|0;Z=c[ia+12>>2]|0;if((Z|0)==(fa|0)){c[2337]=c[2337]&~(1<<ga);break}else{c[fa+12>>2]=Z;c[Z+8>>2]=fa;break}}else{fa=c[ia+24>>2]|0;Z=c[ia+12>>2]|0;do if((Z|0)==(ia|0)){ea=ia+16|0;ca=ea+4|0;f=c[ca>>2]|0;if(!f){ba=c[ea>>2]|0;if(!ba){sa=0;break}else{ta=ba;ua=ea}}else{ta=f;ua=ca}ca=ta;f=ua;while(1){ea=ca+20|0;ba=c[ea>>2]|0;if(!ba){aa=ca+16|0;$=c[aa>>2]|0;if(!$)break;else{va=$;wa=aa}}else{va=ba;wa=ea}ca=va;f=wa}c[f>>2]=0;sa=ca}else{ea=c[ia+8>>2]|0;c[ea+12>>2]=Z;c[Z+8>>2]=ea;sa=Z}while(0);if(!fa)break;Z=c[ia+28>>2]|0;n=9652+(Z<<2)|0;do if((c[n>>2]|0)!=(ia|0)){ea=fa+16|0;c[((c[ea>>2]|0)==(ia|0)?ea:fa+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[2338]=c[2338]&~(1<<Z);break h}while(0);c[sa+24>>2]=fa;Z=ia+16|0;n=c[Z>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[Z+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ia+ha|0;ya=ha+d|0}else{xa=ia;ya=d}ga=xa+4|0;c[ga>>2]=c[ga>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ga=ya>>>3;if(ya>>>0<256){X=9388+(ga<<1<<2)|0;da=c[2337]|0;n=1<<ga;if(!(da&n)){c[2337]=da|n;za=X;Aa=X+8|0}else{n=X+8|0;za=c[n>>2]|0;Aa=n}c[Aa>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=X;break}X=ya>>>8;do if(!X)Ba=0;else{if(ya>>>0>16777215){Ba=31;break}n=(X+1048320|0)>>>16&8;da=X<<n;ga=(da+520192|0)>>>16&4;Z=da<<ga;da=(Z+245760|0)>>>16&2;ea=14-(ga|n|da)+(Z<<da>>>15)|0;Ba=ya>>>(ea+7|0)&1|ea<<1}while(0);X=9652+(Ba<<2)|0;c[pa+28>>2]=Ba;ha=pa+16|0;c[ha+4>>2]=0;c[ha>>2]=0;ha=c[2338]|0;ea=1<<Ba;if(!(ha&ea)){c[2338]=ha|ea;c[X>>2]=pa;c[pa+24>>2]=X;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}ea=c[X>>2]|0;i:do if((c[ea+4>>2]&-8|0)==(ya|0))Ca=ea;else{X=ya<<((Ba|0)==31?0:25-(Ba>>>1)|0);ha=ea;while(1){Da=ha+16+(X>>>31<<2)|0;da=c[Da>>2]|0;if(!da)break;if((c[da+4>>2]&-8|0)==(ya|0)){Ca=da;break i}else{X=X<<1;ha=da}}c[Da>>2]=pa;c[pa+24>>2]=ha;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);ea=Ca+8|0;X=c[ea>>2]|0;c[X+12>>2]=pa;c[ea>>2]=pa;c[pa+8>>2]=X;c[pa+12>>2]=Ca;c[pa+24>>2]=0}while(0);o=oa+8|0;ka=b;return o|0}pa=9796;while(1){d=c[pa>>2]|0;if(d>>>0<=ja>>>0?(Ea=d+(c[pa+4>>2]|0)|0,Ea>>>0>ja>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ea+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ja+16|0;pa=d>>>0<oa>>>0?ja:d;d=pa+8|0;ia=la+-40|0;na=ma+8|0;W=(na&7|0)==0?0:0-na&7;na=ma+W|0;X=ia-W|0;c[2343]=na;c[2340]=X;c[na+4>>2]=X|1;c[ma+ia+4>>2]=40;c[2344]=c[2459];ia=pa+4|0;c[ia>>2]=27;c[d>>2]=c[2449];c[d+4>>2]=c[2450];c[d+8>>2]=c[2451];c[d+12>>2]=c[2452];c[2449]=ma;c[2450]=la;c[2452]=0;c[2451]=d;d=pa+24|0;do{X=d;d=d+4|0;c[d>>2]=7}while((X+8|0)>>>0<Ea>>>0);if((pa|0)!=(ja|0)){d=pa-ja|0;c[ia>>2]=c[ia>>2]&-2;c[ja+4>>2]=d|1;c[pa>>2]=d;X=d>>>3;if(d>>>0<256){na=9388+(X<<1<<2)|0;W=c[2337]|0;ea=1<<X;if(!(W&ea)){c[2337]=W|ea;Fa=na;Ga=na+8|0}else{ea=na+8|0;Fa=c[ea>>2]|0;Ga=ea}c[Ga>>2]=ja;c[Fa+12>>2]=ja;c[ja+8>>2]=Fa;c[ja+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ha=31;else{ea=(na+1048320|0)>>>16&8;W=na<<ea;na=(W+520192|0)>>>16&4;X=W<<na;W=(X+245760|0)>>>16&2;fa=14-(na|ea|W)+(X<<W>>>15)|0;Ha=d>>>(fa+7|0)&1|fa<<1}else Ha=0;fa=9652+(Ha<<2)|0;c[ja+28>>2]=Ha;c[ja+20>>2]=0;c[oa>>2]=0;W=c[2338]|0;X=1<<Ha;if(!(W&X)){c[2338]=W|X;c[fa>>2]=ja;c[ja+24>>2]=fa;c[ja+12>>2]=ja;c[ja+8>>2]=ja;break}X=c[fa>>2]|0;j:do if((c[X+4>>2]&-8|0)==(d|0))Ia=X;else{fa=d<<((Ha|0)==31?0:25-(Ha>>>1)|0);W=X;while(1){Ja=W+16+(fa>>>31<<2)|0;ea=c[Ja>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(d|0)){Ia=ea;break j}else{fa=fa<<1;W=ea}}c[Ja>>2]=ja;c[ja+24>>2]=W;c[ja+12>>2]=ja;c[ja+8>>2]=ja;break f}while(0);d=Ia+8|0;X=c[d>>2]|0;c[X+12>>2]=ja;c[d>>2]=ja;c[ja+8>>2]=X;c[ja+12>>2]=Ia;c[ja+24>>2]=0}}else{X=c[2341]|0;if((X|0)==0|ma>>>0<X>>>0)c[2341]=ma;c[2449]=ma;c[2450]=la;c[2452]=0;c[2346]=c[2455];c[2345]=-1;c[2350]=9388;c[2349]=9388;c[2352]=9396;c[2351]=9396;c[2354]=9404;c[2353]=9404;c[2356]=9412;c[2355]=9412;c[2358]=9420;c[2357]=9420;c[2360]=9428;c[2359]=9428;c[2362]=9436;c[2361]=9436;c[2364]=9444;c[2363]=9444;c[2366]=9452;c[2365]=9452;c[2368]=9460;c[2367]=9460;c[2370]=9468;c[2369]=9468;c[2372]=9476;c[2371]=9476;c[2374]=9484;c[2373]=9484;c[2376]=9492;c[2375]=9492;c[2378]=9500;c[2377]=9500;c[2380]=9508;c[2379]=9508;c[2382]=9516;c[2381]=9516;c[2384]=9524;c[2383]=9524;c[2386]=9532;c[2385]=9532;c[2388]=9540;c[2387]=9540;c[2390]=9548;c[2389]=9548;c[2392]=9556;c[2391]=9556;c[2394]=9564;c[2393]=9564;c[2396]=9572;c[2395]=9572;c[2398]=9580;c[2397]=9580;c[2400]=9588;c[2399]=9588;c[2402]=9596;c[2401]=9596;c[2404]=9604;c[2403]=9604;c[2406]=9612;c[2405]=9612;c[2408]=9620;c[2407]=9620;c[2410]=9628;c[2409]=9628;c[2412]=9636;c[2411]=9636;X=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=X-oa|0;c[2343]=d;c[2340]=pa;c[d+4>>2]=pa|1;c[ma+X+4>>2]=40;c[2344]=c[2459]}while(0);ma=c[2340]|0;if(ma>>>0>F>>>0){la=ma-F|0;c[2340]=la;ma=c[2343]|0;ja=ma+F|0;c[2343]=ja;c[ja+4>>2]=la|1;c[ma+4>>2]=F|3;o=ma+8|0;ka=b;return o|0}}c[(Ob()|0)>>2]=12;o=0;ka=b;return o|0}function Jc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[2341]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[2342]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[2339]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[2337]=c[2337]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=9652+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[2338]=c[2338]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[2343]|0)==(f|0)){r=(c[2340]|0)+m|0;c[2340]=r;c[2343]=l;c[l+4>>2]=r|1;if((l|0)!=(c[2342]|0))return;c[2342]=0;c[2339]=0;return}if((c[2342]|0)==(f|0)){r=(c[2339]|0)+m|0;c[2339]=r;c[2342]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[2337]=c[2337]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=9652+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[2338]=c[2338]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[2342]|0)){c[2339]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=9388+(m<<1<<2)|0;a=c[2337]|0;b=1<<m;if(!(a&b)){c[2337]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=9652+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[2338]|0;b=1<<G;a:do if(!(F&b)){c[2338]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[2345]|0)+-1|0;c[2345]=l;if(l|0)return;l=9804;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[2345]=-1;return}function Kc(a){a=a|0;return}function Lc(a){a=a|0;Kc(a);Qc(a);return}function Mc(a){a=a|0;return 4965}function Nc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0;b=ka;ka=ka+16|0;d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(Oc(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(s(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(s(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(s(r,q)|0)){r=l+12|0;t=(k>>>0)/(r>>>0)|0;if(t>>>0>=r>>>0)if((k|0)!=(s(t,r)|0)){t=l+16|0;u=(k>>>0)/(t>>>0)|0;if(u>>>0>=t>>>0)if((k|0)!=(s(u,t)|0)){u=l+18|0;v=(k>>>0)/(u>>>0)|0;if(v>>>0>=u>>>0)if((k|0)!=(s(v,u)|0)){v=l+22|0;w=(k>>>0)/(v>>>0)|0;if(w>>>0>=v>>>0)if((k|0)!=(s(w,v)|0)){w=l+28|0;x=(k>>>0)/(w>>>0)|0;if(x>>>0>=w>>>0)if((k|0)==(s(x,w)|0)){y=w;z=9;A=n}else{x=l+30|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+36|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+40|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+42|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+46|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+52|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+58|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+60|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+66|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+70|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+72|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+78|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+82|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+88|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+96|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+100|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+102|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+106|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+108|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+112|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+120|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+126|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+130|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+136|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+138|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+142|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+148|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+150|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+156|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+162|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+166|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+168|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+172|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+178|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+180|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+186|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+190|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+192|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+196|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+198|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+208|0;B=(k>>>0)/(x>>>0)|0;C=B>>>0<x>>>0;D=(k|0)==(s(B,x)|0);y=C|D?x:l+210|0;z=C?1:D?9:0;A=C?k:n}else{y=w;z=1;A=k}}else{y=v;z=9;A=n}else{y=v;z=1;A=k}}else{y=u;z=9;A=n}else{y=u;z=1;A=k}}else{y=t;z=9;A=n}else{y=t;z=1;A=k}}else{y=r;z=9;A=n}else{y=r;z=1;A=k}}else{y=q;z=9;A=n}else{y=q;z=1;A=k}}else{y=l;z=9;A=n}else{y=l;z=1;A=k}while(0);switch(z&15){case 9:{p=A;break b;break}case 0:{l=y;n=A;break}default:break c}}if(!z)p=A;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;E=k;break}else if((m|0)==108){c[e>>2]=k;E=A;break}}else E=c[(Oc(2400,2592,e,d)|0)>>2]|0;while(0);ka=b;return E|0}
function Oc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function Pc(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=Ic(b)|0;if(a|0){c=a;break}a=Pd()|0;if(!a){c=0;break}qa[a&3]()}return c|0}function Qc(a){a=a|0;Jc(a);return}function Rc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0;e=ka;ka=ka+16|0;f=e;g=zc((a[d+11>>0]|0)<0?c[d>>2]|0:d,0,f)|0;c[b>>2]=g;if((g|0)<0){g=c[(Ob()|0)>>2]|0;ed(f,5016,d);fd(g,(a[f+11>>0]|0)<0?c[f>>2]|0:f)}else{ka=e;return}}function Sc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=ka;ka=ka+16|0;d=b;e=4;f=d;a:while(1){if(!e){g=9;break}b:while(1){h=Cc(c[a>>2]|0,f,e)|0;switch(h|0){case 0:{g=5;break a;break}case -1:break;default:break b}if((c[(Ob()|0)>>2]|0)!=4){g=7;break a}}e=e-h|0;f=f+h|0}if((g|0)==5)fd(61,5046);else if((g|0)==7)fd(c[(Ob()|0)>>2]|0,5068);else if((g|0)==9){ka=b;return c[d>>2]|0}return 0}function Tc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=Ub(b)|0;e=Pc(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=Uc(e)|0;ae(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function Uc(a){a=a|0;return a+12|0}function Vc(a,b){a=a|0;b=b|0;c[a>>2]=3844;Tc(a+4|0,b);return}function Wc(a){a=a|0;return 1}function Xc(a){a=a|0;V()}function Yc(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)Zc(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function Zc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=ka;ka=ka+16|0;g=f;if(e>>>0>4294967279)Xc(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=Pc(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}_c(h,d,e)|0;a[g>>0]=0;$c(h+e|0,g);ka=f;return}function _c(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)ae(a|0,b|0,c|0)|0;return a|0}function $c(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function ad(a){a=a|0;return Ub(a)|0}function bd(b,d,e,f,g,h,i,j){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0;k=ka;ka=ka+16|0;l=k;if((-18-d|0)>>>0<e>>>0)Xc(b);if((a[b+11>>0]|0)<0)m=c[b>>2]|0;else m=b;if(d>>>0<2147483623){n=e+d|0;e=d<<1;o=n>>>0<e>>>0?e:n;p=o>>>0<11?11:o+16&-16}else p=-17;o=Pc(p)|0;if(g|0)_c(o,m,g)|0;if(i|0)_c(o+g|0,j,i)|0;j=f-h|0;f=j-g|0;if(f|0)_c(o+g+i|0,m+g+h|0,f)|0;if((d|0)!=10)Qc(m);c[b>>2]=o;c[b+8>>2]=p|-2147483648;p=j+i|0;c[b+4>>2]=p;a[l>>0]=0;$c(o+p|0,l);ka=k;return}function cd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=ka;ka=ka+16|0;g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j){k=(c[b+8>>2]&2147483647)+-1|0;l=c[b+4>>2]|0}else{k=10;l=i&255}if((k-l|0)>>>0>=e>>>0){if(e|0){if(j)m=c[b>>2]|0;else m=b;_c(m+l|0,d,e)|0;j=l+e|0;if((a[h>>0]|0)<0)c[b+4>>2]=j;else a[h>>0]=j;a[g>>0]=0;$c(m+j|0,g)}}else bd(b,k,l+e-k|0,l,l,0,e,d);ka=f;return b|0}function dd(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0;g=ka;ka=ka+16|0;h=g;if(f>>>0>4294967279)Xc(b);if(f>>>0<11){a[b+11>>0]=e;i=b}else{j=f+16&-16;f=Pc(j)|0;c[b>>2]=f;c[b+8>>2]=j|-2147483648;c[b+4>>2]=e;i=f}_c(i,d,e)|0;a[h>>0]=0;$c(i+e|0,h);ka=g;return}function ed(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;f=0;while(1){if((f|0)==3)break;c[b+(f<<2)>>2]=0;f=f+1|0}f=ad(d)|0;g=e+11|0;h=a[g>>0]|0;i=h<<24>>24<0?c[e+4>>2]|0:h&255;dd(b,d,f,i+f|0);cd(b,(a[g>>0]|0)<0?c[e>>2]|0:e,i)|0;return}function fd(a,b){a=a|0;b=b|0;V()}function gd(a){a=a|0;V()}function hd(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=ka;ka=ka+48|0;b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=id()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=5242;jd(5192,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(pa[c[(c[718]|0)+16>>2]&7](2872,k,g)|0){k=c[g>>2]|0;g=na[c[(c[k>>2]|0)+8>>2]&7](k)|0;c[f>>2]=5242;c[f+4>>2]=h;c[f+8>>2]=g;jd(5106,f)}else{c[e>>2]=5242;c[e+4>>2]=h;jd(5151,e)}}jd(5230,b)}function id(){var a=0,b=0;a=ka;ka=ka+16|0;if(!(ha(9844,3)|0)){b=fa(c[2462]|0)|0;ka=a;return b|0}else jd(5381,a);return 0}function jd(a,b){a=a|0;b=b|0;var d=0,e=0;d=ka;ka=ka+16|0;e=d;c[e>>2]=b;b=c[777]|0;ec(b,a,e)|0;Gc(10,b)|0;V()}function kd(a){a=a|0;return}function ld(a){a=a|0;kd(a);Qc(a);return}function md(a){a=a|0;return}function nd(a){a=a|0;return}function od(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=ka;ka=ka+64|0;f=e;if(!(sd(a,b,0)|0))if((b|0)!=0?(g=wd(b,2896,2880,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;va[c[(c[g>>2]|0)+28>>2]&3](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;ka=e;return j|0}function pd(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(sd(a,c[b+8>>2]|0,g)|0)vd(0,b,d,e,f);return}function qd(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(sd(b,c[d+8>>2]|0,g)|0)){if(sd(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else ud(0,d,e,f);while(0);return}function rd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(sd(a,c[b+8>>2]|0,0)|0)td(0,b,d,e);return}function sd(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function td(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function ud(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function vd(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function wd(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=ka;ka=ka+64|0;i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(sd(l,f,0)|0){c[i+48>>2]=1;xa[c[(c[l>>2]|0)+20>>2]&3](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{wa[c[(c[l>>2]|0)+24>>2]&3](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);ka=h;return q|0}function xd(a){a=a|0;kd(a);Qc(a);return}function yd(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(sd(a,c[b+8>>2]|0,g)|0)vd(0,b,d,e,f);else{h=c[a+8>>2]|0;xa[c[(c[h>>2]|0)+20>>2]&3](h,b,d,e,f,g)}return}function zd(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(sd(b,c[d+8>>2]|0,g)|0)){if(!(sd(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;wa[c[(c[h>>2]|0)+24>>2]&3](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;xa[c[(c[l>>2]|0)+20>>2]&3](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else ud(0,d,e,f);while(0);return}function Ad(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(sd(a,c[b+8>>2]|0,0)|0)td(0,b,d,e);else{f=c[a+8>>2]|0;va[c[(c[f>>2]|0)+28>>2]&3](f,b,d,e)}return}function Bd(a){a=a|0;return}function Cd(){var a=0;a=ka;ka=ka+16|0;if(!(ga(9848,16)|0)){ka=a;return}else jd(5430,a)}function Dd(a){a=a|0;var b=0;b=ka;ka=ka+16|0;Jc(a);if(!(ia(c[2462]|0,0)|0)){ka=b;return}else jd(5480,b)}function Ed(){var a=0,b=0;a=id()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)Fd(c[b+12>>2]|0);Fd(Gd()|0)}function Fd(a){a=a|0;var b=0;b=ka;ka=ka+16|0;qa[a&3]();jd(5533,b)}function Gd(){var a=0;a=c[938]|0;c[938]=a+0;return a|0}function Hd(a){a=a|0;return}function Id(a){a=a|0;c[a>>2]=3844;Md(a+4|0);return}function Jd(a){a=a|0;Id(a);Qc(a);return}function Kd(a){a=a|0;return Ld(a+4|0)|0}function Ld(a){a=a|0;return c[a>>2]|0}function Md(a){a=a|0;var b=0,d=0;if(Wc(a)|0?(b=Nd(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)Qc(b);return}function Nd(a){a=a|0;return a+-12|0}function Od(a){a=a|0;Id(a);Qc(a);return}function Pd(){var a=0;a=c[2463]|0;c[2463]=a+0;return a|0}function Qd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=ka;ka=ka+16|0;f=e;c[f>>2]=c[d>>2];g=pa[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];ka=e;return g&1|0}function Rd(a){a=a|0;var b=0;if(!a)b=0;else b=(wd(a,2896,2984,0)|0)!=0&1;return b|0}function Sd(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=s(d,c)|0;f=a>>>16;a=(e>>>16)+(s(d,f)|0)|0;d=b>>>16;b=s(d,c)|0;return (v((a>>>16)+(s(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function Td(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=Sd(e,a)|0;f=w()|0;return (v((s(b,a)|0)+(s(d,e)|0)+f|f&0|0),c|0|0)|0}function Ud(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (v(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function Vd(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (v(e|0),a-c>>>0|0)|0}function Wd(a){a=a|0;return (a?31-(t(a^a-1)|0)|0:32)|0}function Xd(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (v(n|0),o)|0}else{if(!m){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (v(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(t(l|0)|0)-(t(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;u=q;x=g>>>(q>>>0)&s|i<<r;y=i>>>(q>>>0)&s;z=0;A=g<<r;break}if(!f){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (v(n|0),o)|0}r=j-1|0;if(r&j|0){s=(t(j|0)|0)+33-(t(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;u=s;x=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;y=D&i>>>(s>>>0);z=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (v(n|0),o)|0}else{r=Wd(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (v(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (v(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (v(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((Wd(l|0)|0)>>>0);return (v(n|0),o)|0}r=(t(l|0)|0)-(t(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;u=s;x=i<<p|g>>>(s>>>0);y=i>>>(s>>>0);z=0;A=g<<p;break}if(!f){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (v(n|0),o)|0}while(0);if(!u){E=A;F=z;G=y;H=x;I=0;J=0}else{b=d|0|0;d=k|e&0;e=Ud(b|0,d|0,-1,-1)|0;k=w()|0;h=A;A=z;z=y;y=x;x=u;u=0;do{a=h;h=A>>>31|h<<1;A=u|A<<1;g=y<<1|a>>>31|0;a=y>>>31|z<<1|0;Vd(e|0,k|0,g|0,a|0)|0;i=w()|0;l=i>>31|((i|0)<0?-1:0)<<1;u=l&1;y=Vd(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;z=w()|0;x=x-1|0}while((x|0)!=0);E=h;F=A;G=z;H=y;I=0;J=u}u=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(u|0)>>>31|(E|F)<<1|(F<<1|u>>>31)&0|I;o=(u<<1|0>>>31)&-2|J;return (v(n|0),o)|0}function Yd(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Xd(a,b,c,d,0)|0}function Zd(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){v(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}v(0);return b>>>c-32|0}function _d(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){v(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}v(a<<c-32|0);return 0}function $d(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function ae(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){Z(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function be(b,c,d){b=b|0;c=c|0;d=d|0;var e=0;if((c|0)<(b|0)&(b|0)<(c+d|0)){e=b;c=c+d|0;b=b+d|0;while((d|0)>0){b=b-1|0;c=c-1|0;d=d-1|0;a[b>>0]=a[c>>0]|0}b=e}else ae(b,c,d)|0;return b|0}function ce(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function de(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){ja(d|0)|0;N(12);return -1}if((d|0)>(X()|0)){if(!(_(d|0)|0)){N(12);return -1}}else c[i>>2]=d;return b|0}function ee(a,b){a=a|0;b=b|0;return na[a&7](b|0)|0}function fe(a,b,c){a=a|0;b=b|0;c=c|0;return oa[a&1](b|0,c|0)|0}function ge(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return pa[a&7](b|0,c|0,d|0)|0}function he(a){a=a|0;qa[a&3]()}function ie(a,b){a=a|0;b=b|0;ra[a&31](b|0)}function je(a,b,c,d){a=a|0;b=b|0;c=+c;d=d|0;sa[a&3](b|0,+c,d|0)}function ke(a,b,c){a=a|0;b=b|0;c=c|0;ta[a&15](b|0,c|0)}function le(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;ua[a&3](b|0,c|0,d|0)}function me(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;va[a&3](b|0,c|0,d|0,e|0)}function ne(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;wa[a&3](b|0,c|0,d|0,e|0,f|0)}function oe(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;xa[a&3](b|0,c|0,d|0,e|0,f|0,g|0)}function pe(a){a=a|0;u(0);return 0}function qe(a,b){a=a|0;b=b|0;u(1);return 0}function re(a,b,c){a=a|0;b=b|0;c=c|0;u(2);return 0}function se(){u(3)}function te(a){a=a|0;u(4)}function ue(a,b,c){a=a|0;b=+b;c=c|0;u(5)}function ve(a,b){a=a|0;b=b|0;u(6)}function we(a,b,c){a=a|0;b=b|0;c=c|0;u(7)}function xe(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;u(8)}function ye(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;u(9)}function ze(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;u(10)}

// EMSCRIPTEN_END_FUNCS
var na=[pe,Ab,Gb,Kb,Mc,Kd,pe,pe];var oa=[qe,Fb];var pa=[re,Lb,Mb,Qb,Bc,od,re,re];var qa=[se,hd,Fa,Cd];var ra=[te,Hb,zb,Cb,Db,Eb,Kc,Lc,kd,ld,md,nd,xd,Id,Jd,Od,Dd,te,te,te,te,te,te,te,te,te,te,te,te,te,te,te];var sa=[ue,Oa,rb,ue];var ta=[ve,Pa,Qa,Ra,Sa,sb,tb,ub,vb,Bb,ve,ve,ve,ve,ve,ve];var ua=[we,Ta,wb,we];var va=[xe,rd,Ad,xe];var wa=[ye,qd,zd,ye];var xa=[ze,pd,yd,ze];return{__GLOBAL__sub_I_main_cpp:Jb,___cxa_can_catch:Qd,___cxa_is_pointer_type:Rd,___em_js__getWindowHeight:Ea,___em_js__getWindowWidth:Da,___errno_location:Ob,___muldi3:Td,___udivdi3:Yd,_bitshift64Lshr:Zd,_bitshift64Shl:_d,_free:Jc,_i64Add:Ud,_i64Subtract:Vd,_llvm_bswap_i32:$d,_main:Ga,_malloc:Ic,_memcpy:ae,_memmove:be,_memset:ce,_sbrk:de,dynCall_ii:ee,dynCall_iii:fe,dynCall_iiii:ge,dynCall_v:he,dynCall_vi:ie,dynCall_vidi:je,dynCall_vii:ke,dynCall_viii:le,dynCall_viiii:me,dynCall_viiiii:ne,dynCall_viiiiii:oe,establishStackSpace:Ba,stackAlloc:ya,stackRestore:Aa,stackSave:za}})


// EMSCRIPTEN_END_ASM
(asmGlobalArg, asmLibraryArg, buffer);

var __GLOBAL__sub_I_main_cpp = Module["__GLOBAL__sub_I_main_cpp"] = asm["__GLOBAL__sub_I_main_cpp"];

var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];

var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];

var ___em_js__getWindowHeight = Module["___em_js__getWindowHeight"] = asm["___em_js__getWindowHeight"];

var ___em_js__getWindowWidth = Module["___em_js__getWindowWidth"] = asm["___em_js__getWindowWidth"];

var ___errno_location = Module["___errno_location"] = asm["___errno_location"];

var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];

var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];

var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];

var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];

var _free = Module["_free"] = asm["_free"];

var _i64Add = Module["_i64Add"] = asm["_i64Add"];

var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];

var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];

var _main = Module["_main"] = asm["_main"];

var _malloc = Module["_malloc"] = asm["_malloc"];

var _memcpy = Module["_memcpy"] = asm["_memcpy"];

var _memmove = Module["_memmove"] = asm["_memmove"];

var _memset = Module["_memset"] = asm["_memset"];

var _sbrk = Module["_sbrk"] = asm["_sbrk"];

var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];

var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];

var stackRestore = Module["stackRestore"] = asm["stackRestore"];

var stackSave = Module["stackSave"] = asm["stackSave"];

var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];

var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];

var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];

var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];

var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];

var dynCall_vidi = Module["dynCall_vidi"] = asm["dynCall_vidi"];

var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];

var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];

var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];

var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];

var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];

Module["asm"] = asm;

if (memoryInitializer) {
 if (!isDataURI(memoryInitializer)) {
  memoryInitializer = locateFile(memoryInitializer);
 }
 if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
  var data = Module["readBinary"](memoryInitializer);
  HEAPU8.set(data, GLOBAL_BASE);
 } else {
  addRunDependency("memory initializer");
  var applyMemoryInitializer = function(data) {
   if (data.byteLength) data = new Uint8Array(data);
   HEAPU8.set(data, GLOBAL_BASE);
   if (Module["memoryInitializerRequest"]) delete Module["memoryInitializerRequest"].response;
   removeRunDependency("memory initializer");
  };
  var doBrowserLoad = function() {
   Module["readAsync"](memoryInitializer, applyMemoryInitializer, function() {
    throw "could not load memory initializer " + memoryInitializer;
   });
  };
  if (Module["memoryInitializerRequest"]) {
   var useRequest = function() {
    var request = Module["memoryInitializerRequest"];
    var response = request.response;
    if (request.status !== 200 && request.status !== 0) {
     console.warn("a problem seems to have happened with Module.memoryInitializerRequest, status: " + request.status + ", retrying " + memoryInitializer);
     doBrowserLoad();
     return;
    }
    applyMemoryInitializer(response);
   };
   if (Module["memoryInitializerRequest"].response) {
    setTimeout(useRequest, 0);
   } else {
    Module["memoryInitializerRequest"].addEventListener("load", useRequest);
   }
  } else {
   doBrowserLoad();
  }
 }
}

function ExitStatus(status) {
 this.name = "ExitStatus";
 this.message = "Program terminated with exit(" + status + ")";
 this.status = status;
}

ExitStatus.prototype = new Error();

ExitStatus.prototype.constructor = ExitStatus;

var calledMain = false;

dependenciesFulfilled = function runCaller() {
 if (!Module["calledRun"]) run();
 if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
};

Module["callMain"] = function callMain(args) {
 args = args || [];
 ensureInitRuntime();
 var argc = args.length + 1;
 var argv = stackAlloc((argc + 1) * 4);
 HEAP32[argv >> 2] = allocateUTF8OnStack(Module["thisProgram"]);
 for (var i = 1; i < argc; i++) {
  HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1]);
 }
 HEAP32[(argv >> 2) + argc] = 0;
 try {
  var ret = Module["_main"](argc, argv, 0);
  exit(ret, true);
 } catch (e) {
  if (e instanceof ExitStatus) {
   return;
  } else if (e == "SimulateInfiniteLoop") {
   Module["noExitRuntime"] = true;
   return;
  } else {
   var toLog = e;
   if (e && typeof e === "object" && e.stack) {
    toLog = [ e, e.stack ];
   }
   err("exception thrown: " + toLog);
   Module["quit"](1, e);
  }
 } finally {
  calledMain = true;
 }
};

function run(args) {
 args = args || Module["arguments"];
 if (runDependencies > 0) {
  return;
 }
 preRun();
 if (runDependencies > 0) return;
 if (Module["calledRun"]) return;
 function doRun() {
  if (Module["calledRun"]) return;
  Module["calledRun"] = true;
  if (ABORT) return;
  ensureInitRuntime();
  preMain();
  if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
  if (Module["_main"] && shouldRunNow) Module["callMain"](args);
  postRun();
 }
 if (Module["setStatus"]) {
  Module["setStatus"]("Running...");
  setTimeout(function() {
   setTimeout(function() {
    Module["setStatus"]("");
   }, 1);
   doRun();
  }, 1);
 } else {
  doRun();
 }
}

Module["run"] = run;

function exit(status, implicit) {
 if (implicit && Module["noExitRuntime"] && status === 0) {
  return;
 }
 if (Module["noExitRuntime"]) {} else {
  ABORT = true;
  EXITSTATUS = status;
  exitRuntime();
  if (Module["onExit"]) Module["onExit"](status);
 }
 Module["quit"](status, new ExitStatus(status));
}

function abort(what) {
 if (Module["onAbort"]) {
  Module["onAbort"](what);
 }
 if (what !== undefined) {
  out(what);
  err(what);
  what = JSON.stringify(what);
 } else {
  what = "";
 }
 ABORT = true;
 EXITSTATUS = 1;
 throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
}

Module["abort"] = abort;

if (Module["preInit"]) {
 if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
 while (Module["preInit"].length > 0) {
  Module["preInit"].pop()();
 }
}

var shouldRunNow = true;

if (Module["noInitialRun"]) {
 shouldRunNow = false;
}

Module["noExitRuntime"] = true;

run();

