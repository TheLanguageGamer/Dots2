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

var STACK_BASE = 10992, DYNAMIC_BASE = 5253872, DYNAMICTOP_PTR = 10736;

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

var tempDoublePtr = 10976;

var Engine = {
 ctx: null,
 init: function() {
  console.log("$Engine.init");
  var canvas = Module["canvas"];
  Engine.ctx = canvas.getContext("2d");
 },
 translateColorToCSSRGB: function(rgba) {
  var ret = "rgb(" + (rgba >>> 24) + "," + (rgba >> 16 & 255) + "," + (rgba >> 8 & 255) + ")";
  return ret;
 },
 filledEllipse: function(x, y, width, height, rgba) {
  Engine.ctx.globalAlpha = (rgba & 255) / 255;
  Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(rgba);
  Engine.ctx.beginPath();
  Engine.ctx.ellipse(x, y, width, height, 0, 0, 2 * Math.PI);
  Engine.ctx.fill();
 },
 filledRectangle: function(x, y, width, height, rgba) {
  Engine.ctx.globalAlpha = (rgba & 255) / 255;
  Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(rgba);
  Engine.ctx.beginPath();
  Engine.ctx.fillRect(x, y, width, height);
  Engine.ctx.fill();
 },
 roundedRectangle: function(x, y, width, height, radius, thickness, strokeRgba, fillRgba) {
  Engine.ctx.beginPath();
  Engine.ctx.moveTo(x + radius, y);
  Engine.ctx.lineTo(x + width - radius, y);
  Engine.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  Engine.ctx.lineTo(x + width, y + height - radius);
  Engine.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  Engine.ctx.lineTo(x + radius, y + height);
  Engine.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  Engine.ctx.lineTo(x, y + radius);
  Engine.ctx.quadraticCurveTo(x, y, x + radius, y);
  Engine.ctx.closePath();
  var fillAlpha = (fillRgba & 255) / 255;
  var strokeAlpha = (strokeRgba & 255) / 255;
  if (fillAlpha > 0) {
   Engine.ctx.globalAlpha = fillAlpha;
   Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(fillRgba);
   Engine.ctx.fill();
  }
  if (strokeAlpha > 0) {
   Engine.ctx.globalAlpha = strokeAlpha;
   Engine.ctx.strokeStyle = Engine.translateColorToCSSRGB(strokeRgba);
   Engine.ctx.stroke();
  }
 },
 filledText: function(text, x, y, fontSize, rgba) {
  text = UTF8ToString(text);
  Engine.ctx.globalAlpha = (rgba & 255) / 255;
  Engine.ctx.fillStyle = Engine.translateColorToCSSRGB(rgba);
  Engine.ctx.font = "" + fontSize + "px Monospace";
  Engine.ctx.beginPath();
  Engine.ctx.fillText(text, x, y);
  Engine.ctx.fill();
 }
};

function _Engine_FilledEllipse(x, y, width, height, rgba) {
 Engine.filledEllipse(x, y, width, height, rgba);
}

function _Engine_FilledRectangle(x, y, width, height, rgba) {
 Engine.filledRectangle(x, y, width, height, rgba);
}

function _Engine_FilledText(text, x, y, fontSize, rgba) {
 Engine.filledText(text, x, y, fontSize, rgba);
}

function _Engine_Init() {
 console.log("Engine_Init");
 Engine.init();
 return;
}

function _Engine_RoundedRectangle(x, y, width, height, radius, thickness, strokeRgba, fillRgba) {
 Engine.roundedRectangle(x, y, width, height, radius, thickness, strokeRgba, fillRgba);
}

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
 drawArc: function(surf, x, y, r, w, ax, ay, cssColor) {
  var surfData = SDL.surfaces[surf];
  assert(!surfData.locked);
  surfData.ctx.save();
  surfData.ctx.lineWidth = w;
  surfData.ctx.lineCap = "round";
  surfData.ctx.strokeStyle = cssColor;
  surfData.ctx.beginPath();
  surfData.ctx.arc(x, y, r, ax, ay);
  surfData.ctx.stroke();
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
 "d": _Engine_FilledEllipse,
 "e": _Engine_FilledRectangle,
 "f": _Engine_FilledText,
 "g": _Engine_Init,
 "h": _Engine_RoundedRectangle,
 "i": _SDL_AudioQuit,
 "j": _SDL_GetTicks,
 "k": _SDL_Init,
 "l": _SDL_LockSurface,
 "m": _SDL_PollEvent,
 "n": _SDL_Quit,
 "o": _SDL_SetVideoMode,
 "p": __ZSt18uncaught_exceptionv,
 "q": ___cxa_allocate_exception,
 "r": ___cxa_begin_catch,
 "s": ___cxa_find_matching_catch,
 "t": ___cxa_free_exception,
 "u": ___cxa_throw,
 "v": ___gxx_personality_v0,
 "w": ___resumeException,
 "x": ___setErrNo,
 "y": ___syscall140,
 "z": ___syscall146,
 "A": ___syscall221,
 "B": ___syscall3,
 "C": ___syscall5,
 "D": ___syscall54,
 "E": ___syscall6,
 "F": _abort,
 "G": _boxColor,
 "H": _emscripten_get_heap_size,
 "I": _emscripten_get_now,
 "J": _emscripten_memcpy_big,
 "K": _emscripten_resize_heap,
 "L": _emscripten_set_main_loop,
 "M": _emscripten_set_main_loop_timing,
 "N": _getWindowHeight,
 "O": _getWindowWidth,
 "P": _pthread_getspecific,
 "Q": _pthread_key_create,
 "R": _pthread_once,
 "S": _pthread_setspecific,
 "T": abortOnCannotGrowMemory,
 "U": tempDoublePtr,
 "V": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.U|0,i=env.V|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.ceil,s=global.Math.imul,t=global.Math.clz32,u=env.a,v=env.b,w=env.c,x=env.d,y=env.e,z=env.f,A=env.g,B=env.h,C=env.i,D=env.j,E=env.k,F=env.l,G=env.m,H=env.n,I=env.o,J=env.p,K=env.q,L=env.r,M=env.s,N=env.t,O=env.u,P=env.v,Q=env.w,R=env.x,S=env.y,T=env.z,U=env.A,V=env.B,W=env.C,X=env.D,Y=env.E,Z=env.F,_=env.G,$=env.H,aa=env.I,ba=env.J,ca=env.K,da=env.L,ea=env.M,fa=env.N,ga=env.O,ha=env.P,ia=env.Q,ja=env.R,ka=env.S,la=env.T,ma=10992,na=5253872,oa=0.0;
// EMSCRIPTEN_START_FUNCS
function Aa(a){a=a|0;var b=0;b=ma;ma=ma+a|0;ma=ma+15&-16;return b|0}function Ba(){return ma|0}function Ca(a){a=a|0;ma=a}function Da(a,b){a=a|0;b=b|0;ma=a;na=b}function Ea(){return 4049}function Fa(){return 4213}function Ga(){var a=0,b=0;a=c[1896]|0;if(!a){b=K(4)|0;c[b>>2]=3860;O(b|0,2928,16)}else{ua[c[(c[a>>2]|0)+24>>2]&31](a);return}}function Ha(){var a=0,b=0,d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0.0,n=0.0,o=0,p=0,q=0,r=0,s=0,t=0;a=ma;ma=ma+112|0;b=a+32|0;d=a+24|0;e=a+72|0;h=a+60|0;i=a+16|0;j=a+56|0;k=a+8|0;l=a;A();m=+ga();n=+fa();g[b>>3]=m;g[b+8>>3]=n;Ic(4378,b)|0;f[d>>2]=m;o=d+4|0;f[o>>2]=n;p=d;q=c[p>>2]|0;r=c[p+4>>2]|0;c[e>>2]=0;p=e+4|0;c[p>>2]=q;c[p+4>>2]=r;c[e+12>>2]=-1;p=Vc(512)|0;c[e+16>>2]=p;c[e+24>>2]=128;c[e+20>>2]=4096;oe(p|0,0,512)|0;c[h>>2]=0;p=h+4|0;c[p>>2]=0;c[h+8>>2]=0;s=Vc(160)|0;t=i;c[t>>2]=q;c[t+4>>2]=r;c[b>>2]=c[i>>2];c[b+4>>2]=c[i+4>>2];Ia(s,b,-1,h);c[e>>2]=s;i=c[(c[s>>2]|0)+28>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;wa[i&3](s,b,d);E(32)|0;c[j>>2]=I(~~+f[d>>2]|0,~~+f[o>>2]|0,32,0)|0;o=k;c[o>>2]=0;c[o+4>>2]=0;g[l>>3]=+aa();o=b+16|0;d=Vc(20)|0;c[d>>2]=3316;c[d+4>>2]=e;c[d+8>>2]=k;c[d+12>>2]=j;c[d+16>>2]=l;c[o>>2]=d;Fb(b,7568);d=c[o>>2]|0;if((b|0)!=(d|0)){if(d|0)ua[c[(c[d>>2]|0)+20>>2]&31](d)}else ua[c[(c[d>>2]|0)+16>>2]&31](d);da(2,0,1);H();d=c[h>>2]|0;if(d|0){c[p>>2]=d;Wc(d)}d=c[e+16>>2]|0;if(!d){ma=a;return 1}Wc(d);ma=a;return 1}function Ia(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,Za=0,_a=0,$a=0,ab=0,bb=0,cb=0,db=0,eb=0,fb=0,gb=0,hb=0,ib=0,jb=0,kb=0,lb=0,mb=0,nb=0,ob=0,pb=0,qb=0,rb=0,sb=0,tb=0,ub=0,vb=0,wb=0,xb=0,yb=0,Ab=0,Bb=0,Cb=0;h=ma;ma=ma+1568|0;i=h+920|0;j=h+912|0;k=h+884|0;l=h+896|0;m=h+872|0;n=h+860|0;o=h+848|0;p=h+828|0;q=h+816|0;r=h+788|0;s=h+776|0;t=h+752|0;u=h+720|0;v=h+104|0;w=h+708|0;x=h+696|0;y=h+684|0;z=h+672|0;A=h+660|0;B=h+648|0;C=h+636|0;D=h+624|0;E=h+88|0;F=h+612|0;G=h+600|0;H=h+588|0;I=h+576|0;J=h+564|0;K=h+72|0;L=h+56|0;M=h+552|0;N=h+40|0;O=h+540|0;P=h+528|0;Q=h+516|0;R=h+504|0;S=h+492|0;T=h+480|0;U=h+468|0;V=h+456|0;W=h+444|0;X=h+432|0;Y=h+420|0;Z=h+408|0;_=h+396|0;$=h+384|0;aa=h+372|0;ba=h+360|0;ca=h+348|0;da=h+336|0;ea=h+324|0;fa=h+312|0;ga=h+24|0;ha=h+300|0;ia=h+288|0;ja=h+276|0;ka=h+264|0;la=h+840|0;na=h+120|0;oa=h+808|0;pa=h+800|0;qa=h+768|0;ra=h+744|0;sa=h+736|0;ta=h+256|0;va=h+248|0;wa=h;xa=d;d=c[xa>>2]|0;ya=c[xa+4>>2]|0;c[b+4>>2]=g;xa=b+8|0;c[xa>>2]=d;c[xa+4>>2]=ya;c[b+16>>2]=e;c[b>>2]=3128;e=b+24|0;ya=b+84|0;xa=b+28|0;d=xa+56|0;do{c[xa>>2]=0;xa=xa+4|0}while((xa|0)<(d|0));f[ya>>2]=-1.0;c[b+88>>2]=0;c[b+92>>2]=0;c[e>>2]=3172;c[b+96>>2]=0;c[b+100>>2]=0;e=b+108|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;c[b+124>>2]=1065353216;c[b+128>>2]=0;e=b+132|0;c[e>>2]=0;ya=b+136|0;c[ya>>2]=0;za=b+152|0;c[za>>2]=0;c[b+156>>2]=-1;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;Aa=l+11|0;a[Aa>>0]=6;a[l>>0]=a[4461]|0;a[l+1>>0]=a[4462]|0;a[l+2>>0]=a[4463]|0;a[l+3>>0]=a[4464]|0;a[l+4>>0]=a[4465]|0;a[l+5>>0]=a[4466]|0;a[l+6>>0]=0;Ba=m+11|0;a[Ba>>0]=10;xa=m;Ca=4468;d=xa+10|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[m+10>>0]=0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;Da=n+11|0;a[Da>>0]=5;a[n>>0]=a[4479]|0;a[n+1>>0]=a[4480]|0;a[n+2>>0]=a[4481]|0;a[n+3>>0]=a[4482]|0;a[n+4>>0]=a[4483]|0;a[n+5>>0]=0;cd(i,l);cd(i+12|0,m);cd(i+24|0,n);Ea=i+36|0;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;Fa=o+11|0;a[Fa>>0]=6;a[o>>0]=a[4485]|0;a[o+1>>0]=a[4486]|0;a[o+2>>0]=a[4487]|0;a[o+3>>0]=a[4488]|0;a[o+4>>0]=a[4489]|0;a[o+5>>0]=a[4490]|0;a[o+6>>0]=0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;Ga=Vc(16)|0;c[p>>2]=Ga;c[p+8>>2]=-2147483632;c[p+4>>2]=12;xa=Ga;Ca=4492;d=xa+12|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[Ga+12>>0]=0;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;Ga=q+11|0;a[Ga>>0]=6;a[q>>0]=a[4505]|0;a[q+1>>0]=a[4506]|0;a[q+2>>0]=a[4507]|0;a[q+3>>0]=a[4508]|0;a[q+4>>0]=a[4509]|0;a[q+5>>0]=a[4510]|0;a[q+6>>0]=0;cd(Ea,o);cd(i+48|0,p);cd(i+60|0,q);Ea=i+72|0;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;Ha=r+11|0;a[Ha>>0]=6;a[r>>0]=a[4512]|0;a[r+1>>0]=a[4513]|0;a[r+2>>0]=a[4514]|0;a[r+3>>0]=a[4515]|0;a[r+4>>0]=a[4516]|0;a[r+5>>0]=a[4517]|0;a[r+6>>0]=0;Ia=s+11|0;a[Ia>>0]=10;xa=s;Ca=4519;d=xa+10|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[s+10>>0]=0;c[t>>2]=0;c[t+4>>2]=0;c[t+8>>2]=0;Ja=t+11|0;a[Ja>>0]=5;a[t>>0]=a[4530]|0;a[t+1>>0]=a[4531]|0;a[t+2>>0]=a[4532]|0;a[t+3>>0]=a[4533]|0;a[t+4>>0]=a[4534]|0;a[t+5>>0]=0;cd(Ea,r);cd(i+84|0,s);cd(i+96|0,t);c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;Ea=u+11|0;a[Ea>>0]=6;a[u>>0]=a[4536]|0;a[u+1>>0]=a[4537]|0;a[u+2>>0]=a[4538]|0;a[u+3>>0]=a[4539]|0;a[u+4>>0]=a[4540]|0;a[u+5>>0]=a[4541]|0;a[u+6>>0]=0;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;La=v+11|0;a[La>>0]=8;Ma=v;c[Ma>>2]=549110640;c[Ma+4>>2]=1872872308;a[v+8>>0]=0;c[w>>2]=0;c[w+4>>2]=0;c[w+8>>2]=0;Ma=w+11|0;a[Ma>>0]=5;a[w>>0]=a[4543]|0;a[w+1>>0]=a[4544]|0;a[w+2>>0]=a[4545]|0;a[w+3>>0]=a[4546]|0;a[w+4>>0]=a[4547]|0;a[w+5>>0]=0;cd(i+108|0,u);cd(i+120|0,v);cd(i+132|0,w);Na=i+144|0;c[x>>2]=0;c[x+4>>2]=0;c[x+8>>2]=0;Oa=x+11|0;a[Oa>>0]=6;a[x>>0]=a[4549]|0;a[x+1>>0]=a[4550]|0;a[x+2>>0]=a[4551]|0;a[x+3>>0]=a[4552]|0;a[x+4>>0]=a[4553]|0;a[x+5>>0]=a[4554]|0;a[x+6>>0]=0;Pa=y+11|0;a[Pa>>0]=10;xa=y;Ca=4556;d=xa+10|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[y+10>>0]=0;c[z>>2]=0;c[z+4>>2]=0;c[z+8>>2]=0;Qa=z+11|0;a[Qa>>0]=6;a[z>>0]=a[4567]|0;a[z+1>>0]=a[4568]|0;a[z+2>>0]=a[4569]|0;a[z+3>>0]=a[4570]|0;a[z+4>>0]=a[4571]|0;a[z+5>>0]=a[4572]|0;a[z+6>>0]=0;cd(Na,x);cd(i+156|0,y);cd(i+168|0,z);Na=i+180|0;c[A>>2]=0;c[A+4>>2]=0;c[A+8>>2]=0;Ra=A+11|0;a[Ra>>0]=6;a[A>>0]=a[4574]|0;a[A+1>>0]=a[4575]|0;a[A+2>>0]=a[4576]|0;a[A+3>>0]=a[4577]|0;a[A+4>>0]=a[4578]|0;a[A+5>>0]=a[4579]|0;a[A+6>>0]=0;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=0;Sa=B+11|0;a[Sa>>0]=9;xa=B;Ca=4581;d=xa+9|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[B+9>>0]=0;Ta=C+11|0;a[Ta>>0]=10;xa=C;Ca=4591;d=xa+10|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[C+10>>0]=0;cd(Na,A);cd(i+192|0,B);cd(i+204|0,C);c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=0;Na=D+11|0;a[Na>>0]=6;a[D>>0]=a[4602]|0;a[D+1>>0]=a[4603]|0;a[D+2>>0]=a[4604]|0;a[D+3>>0]=a[4605]|0;a[D+4>>0]=a[4606]|0;a[D+5>>0]=a[4607]|0;a[D+6>>0]=0;c[E>>2]=0;c[E+4>>2]=0;c[E+8>>2]=0;Ua=E+11|0;a[Ua>>0]=8;Va=E;c[Va>>2]=548127864;c[Va+4>>2]=-2117831321;a[E+8>>0]=0;c[F>>2]=0;c[F+4>>2]=0;c[F+8>>2]=0;Va=F+11|0;a[Va>>0]=5;a[F>>0]=a[4609]|0;a[F+1>>0]=a[4610]|0;a[F+2>>0]=a[4611]|0;a[F+3>>0]=a[4612]|0;a[F+4>>0]=a[4613]|0;a[F+5>>0]=0;cd(i+216|0,D);cd(i+228|0,E);cd(i+240|0,F);Wa=i+252|0;c[G>>2]=0;c[G+4>>2]=0;c[G+8>>2]=0;Xa=G+11|0;a[Xa>>0]=6;a[G>>0]=a[4615]|0;a[G+1>>0]=a[4616]|0;a[G+2>>0]=a[4617]|0;a[G+3>>0]=a[4618]|0;a[G+4>>0]=a[4619]|0;a[G+5>>0]=a[4620]|0;a[G+6>>0]=0;Ya=H+11|0;a[Ya>>0]=10;xa=H;Ca=4622;d=xa+10|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[H+10>>0]=0;c[I>>2]=0;c[I+4>>2]=0;c[I+8>>2]=0;Za=I+11|0;a[Za>>0]=6;a[I>>0]=a[4633]|0;a[I+1>>0]=a[4634]|0;a[I+2>>0]=a[4635]|0;a[I+3>>0]=a[4636]|0;a[I+4>>0]=a[4637]|0;a[I+5>>0]=a[4638]|0;a[I+6>>0]=0;cd(Wa,G);cd(i+264|0,H);cd(i+276|0,I);c[J>>2]=0;c[J+4>>2]=0;c[J+8>>2]=0;Wa=J+11|0;a[Wa>>0]=6;a[J>>0]=a[4640]|0;a[J+1>>0]=a[4641]|0;a[J+2>>0]=a[4642]|0;a[J+3>>0]=a[4643]|0;a[J+4>>0]=a[4644]|0;a[J+5>>0]=a[4645]|0;a[J+6>>0]=0;c[K>>2]=0;c[K+4>>2]=0;c[K+8>>2]=0;_a=K+11|0;a[_a>>0]=8;$a=K;c[$a>>2]=1853998183;c[$a+4>>2]=-1161598432;a[K+8>>0]=0;c[L>>2]=0;c[L+4>>2]=0;c[L+8>>2]=0;$a=L+11|0;a[$a>>0]=8;ab=L;c[ab>>2]=1684955501;c[ab+4>>2]=1852404321;a[L+8>>0]=0;cd(i+288|0,J);cd(i+300|0,K);cd(i+312|0,L);c[M>>2]=0;c[M+4>>2]=0;c[M+8>>2]=0;ab=M+11|0;a[ab>>0]=6;a[M>>0]=a[4647]|0;a[M+1>>0]=a[4648]|0;a[M+2>>0]=a[4649]|0;a[M+3>>0]=a[4650]|0;a[M+4>>0]=a[4651]|0;a[M+5>>0]=a[4652]|0;a[M+6>>0]=0;c[N>>2]=0;c[N+4>>2]=0;c[N+8>>2]=0;bb=N+11|0;a[bb>>0]=8;cb=N;c[cb>>2]=1872872308;c[cb+4>>2]=-1865975264;a[N+8>>0]=0;c[O>>2]=0;c[O+4>>2]=0;c[O+8>>2]=0;cb=O+11|0;a[cb>>0]=5;a[O>>0]=a[4654]|0;a[O+1>>0]=a[4655]|0;a[O+2>>0]=a[4656]|0;a[O+3>>0]=a[4657]|0;a[O+4>>0]=a[4658]|0;a[O+5>>0]=0;cd(i+324|0,M);cd(i+336|0,N);cd(i+348|0,O);db=P+4|0;c[db>>2]=0;c[db+4>>2]=0;db=P+11|0;a[db>>0]=3;a[P>>0]=a[4660]|0;a[P+1>>0]=a[4661]|0;a[P+2>>0]=a[4662]|0;a[P+3>>0]=0;eb=Q+4|0;c[eb>>2]=0;c[eb+4>>2]=0;eb=Q+11|0;a[eb>>0]=3;a[Q>>0]=a[4664]|0;a[Q+1>>0]=a[4665]|0;a[Q+2>>0]=a[4666]|0;a[Q+3>>0]=0;c[R>>2]=0;c[R+4>>2]=0;c[R+8>>2]=0;fb=R+11|0;a[fb>>0]=4;c[R>>2]=1918985584;a[R+4>>0]=0;cd(i+360|0,P);cd(i+372|0,Q);cd(i+384|0,R);gb=i+396|0;c[S>>2]=0;c[S+4>>2]=0;c[S+8>>2]=0;hb=S+11|0;a[hb>>0]=6;a[S>>0]=a[4668]|0;a[S+1>>0]=a[4669]|0;a[S+2>>0]=a[4670]|0;a[S+3>>0]=a[4671]|0;a[S+4>>0]=a[4672]|0;a[S+5>>0]=a[4673]|0;a[S+6>>0]=0;c[T>>2]=0;c[T+4>>2]=0;c[T+8>>2]=0;ib=T+11|0;a[ib>>0]=9;xa=T;Ca=4675;d=xa+9|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[T+9>>0]=0;c[U>>2]=0;c[U+4>>2]=0;c[U+8>>2]=0;jb=U+11|0;a[jb>>0]=9;xa=U;Ca=4685;d=xa+9|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[U+9>>0]=0;cd(gb,S);cd(i+408|0,T);cd(i+420|0,U);c[V>>2]=0;c[V+4>>2]=0;c[V+8>>2]=0;gb=V+11|0;a[gb>>0]=6;a[V>>0]=a[4695]|0;a[V+1>>0]=a[4696]|0;a[V+2>>0]=a[4697]|0;a[V+3>>0]=a[4698]|0;a[V+4>>0]=a[4699]|0;a[V+5>>0]=a[4700]|0;a[V+6>>0]=0;c[W+8>>2]=0;kb=W+11|0;a[kb>>0]=7;a[W>>0]=a[4702]|0;a[W+1>>0]=a[4703]|0;a[W+2>>0]=a[4704]|0;a[W+3>>0]=a[4705]|0;a[W+4>>0]=a[4706]|0;a[W+5>>0]=a[4707]|0;a[W+6>>0]=a[4708]|0;a[W+7>>0]=0;c[X+8>>2]=0;lb=X+11|0;a[lb>>0]=7;a[X>>0]=a[4710]|0;a[X+1>>0]=a[4711]|0;a[X+2>>0]=a[4712]|0;a[X+3>>0]=a[4713]|0;a[X+4>>0]=a[4714]|0;a[X+5>>0]=a[4715]|0;a[X+6>>0]=a[4716]|0;a[X+7>>0]=0;cd(i+432|0,V);cd(i+444|0,W);cd(i+456|0,X);mb=i+468|0;c[Y>>2]=0;c[Y+4>>2]=0;c[Y+8>>2]=0;nb=Y+11|0;a[nb>>0]=9;xa=Y;Ca=4718;d=xa+9|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[Y+9>>0]=0;c[Z>>2]=0;c[Z+4>>2]=0;c[Z+8>>2]=0;ob=Vc(16)|0;c[Z>>2]=ob;c[Z+8>>2]=-2147483632;c[Z+4>>2]=12;xa=ob;Ca=4728;d=xa+12|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[ob+12>>0]=0;c[_>>2]=0;c[_+4>>2]=0;c[_+8>>2]=0;ob=_+11|0;a[ob>>0]=4;c[_>>2]=1769433451;a[_+4>>0]=0;cd(mb,Y);cd(i+480|0,Z);cd(i+492|0,_);mb=i+504|0;c[$>>2]=0;c[$+4>>2]=0;c[$+8>>2]=0;pb=$+11|0;a[pb>>0]=6;a[$>>0]=a[4741]|0;a[$+1>>0]=a[4742]|0;a[$+2>>0]=a[4743]|0;a[$+3>>0]=a[4744]|0;a[$+4>>0]=a[4745]|0;a[$+5>>0]=a[4746]|0;a[$+6>>0]=0;c[aa>>2]=0;c[aa+4>>2]=0;c[aa+8>>2]=0;qb=Vc(16)|0;c[aa>>2]=qb;c[aa+8>>2]=-2147483632;c[aa+4>>2]=11;xa=qb;Ca=4748;d=xa+11|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[qb+11>>0]=0;c[ba>>2]=0;c[ba+4>>2]=0;c[ba+8>>2]=0;qb=ba+11|0;a[qb>>0]=5;a[ba>>0]=a[4760]|0;a[ba+1>>0]=a[4761]|0;a[ba+2>>0]=a[4762]|0;a[ba+3>>0]=a[4763]|0;a[ba+4>>0]=a[4764]|0;a[ba+5>>0]=0;cd(mb,$);cd(i+516|0,aa);cd(i+528|0,ba);mb=i+540|0;c[ca>>2]=0;c[ca+4>>2]=0;c[ca+8>>2]=0;rb=ca+11|0;a[rb>>0]=9;xa=ca;Ca=4766;d=xa+9|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[ca+9>>0]=0;c[da>>2]=0;c[da+4>>2]=0;c[da+8>>2]=0;sb=Vc(16)|0;c[da>>2]=sb;c[da+8>>2]=-2147483632;c[da+4>>2]=14;xa=sb;Ca=4776;d=xa+14|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[sb+14>>0]=0;c[ea+8>>2]=0;sb=ea+11|0;a[sb>>0]=7;a[ea>>0]=a[4791]|0;a[ea+1>>0]=a[4792]|0;a[ea+2>>0]=a[4793]|0;a[ea+3>>0]=a[4794]|0;a[ea+4>>0]=a[4795]|0;a[ea+5>>0]=a[4796]|0;a[ea+6>>0]=a[4797]|0;a[ea+7>>0]=0;cd(mb,ca);cd(i+552|0,da);cd(i+564|0,ea);mb=i+576|0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;tb=fa+11|0;a[tb>>0]=6;a[fa>>0]=a[4799]|0;a[fa+1>>0]=a[4800]|0;a[fa+2>>0]=a[4801]|0;a[fa+3>>0]=a[4802]|0;a[fa+4>>0]=a[4803]|0;a[fa+5>>0]=a[4804]|0;a[fa+6>>0]=0;c[ga>>2]=0;c[ga+4>>2]=0;c[ga+8>>2]=0;ub=ga+11|0;a[ub>>0]=8;vb=ga;c[vb>>2]=546162018;c[vb+4>>2]=-1279036052;a[ga+8>>0]=0;c[ha>>2]=0;c[ha+4>>2]=0;c[ha+8>>2]=0;vb=ha+11|0;a[vb>>0]=9;xa=ha;Ca=4806;d=xa+9|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[ha+9>>0]=0;cd(mb,fa);cd(i+588|0,ga);cd(i+600|0,ha);mb=i+612|0;c[ia>>2]=0;c[ia+4>>2]=0;c[ia+8>>2]=0;wb=ia+11|0;a[wb>>0]=6;a[ia>>0]=a[4816]|0;a[ia+1>>0]=a[4817]|0;a[ia+2>>0]=a[4818]|0;a[ia+3>>0]=a[4819]|0;a[ia+4>>0]=a[4820]|0;a[ia+5>>0]=a[4821]|0;a[ia+6>>0]=0;c[ja>>2]=0;c[ja+4>>2]=0;c[ja+8>>2]=0;xb=ja+11|0;a[xb>>0]=9;xa=ja;Ca=4823;d=xa+9|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[ja+9>>0]=0;c[ka>>2]=0;c[ka+4>>2]=0;c[ka+8>>2]=0;yb=Vc(16)|0;c[ka>>2]=yb;c[ka+8>>2]=-2147483632;c[ka+4>>2]=11;xa=yb;Ca=4833;d=xa+11|0;do{a[xa>>0]=a[Ca>>0]|0;xa=xa+1|0;Ca=Ca+1|0}while((xa|0)<(d|0));a[yb+11>>0]=0;cd(mb,ia);cd(i+624|0,ja);cd(i+636|0,ka);c[k>>2]=0;mb=k+4|0;c[mb>>2]=0;yb=k+8|0;c[yb>>2]=0;Ab=Vc(648)|0;c[mb>>2]=Ab;c[k>>2]=Ab;c[yb>>2]=Ab+648;cd(Ab,i);cd(Ab+12|0,i+12|0);cd(Ab+24|0,i+24|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+36|0);cd(Ab+48|0,i+48|0);cd(Ab+60|0,i+60|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+72|0);cd(Ab+48|0,i+84|0);cd(Ab+60|0,i+96|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+108|0);cd(Ab+48|0,i+120|0);cd(Ab+60|0,i+132|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+144|0);cd(Ab+48|0,i+156|0);cd(Ab+60|0,i+168|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+180|0);cd(Ab+48|0,i+192|0);cd(Ab+60|0,i+204|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+216|0);cd(Ab+48|0,i+228|0);cd(Ab+60|0,i+240|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+252|0);cd(Ab+48|0,i+264|0);cd(Ab+60|0,i+276|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+288|0);cd(Ab+48|0,i+300|0);cd(Ab+60|0,i+312|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+324|0);cd(Ab+48|0,i+336|0);cd(Ab+60|0,i+348|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+360|0);cd(Ab+48|0,i+372|0);cd(Ab+60|0,i+384|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+396|0);cd(Ab+48|0,i+408|0);cd(Ab+60|0,i+420|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+432|0);cd(Ab+48|0,i+444|0);cd(Ab+60|0,i+456|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+468|0);cd(Ab+48|0,i+480|0);cd(Ab+60|0,i+492|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+504|0);cd(Ab+48|0,i+516|0);cd(Ab+60|0,i+528|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+540|0);cd(Ab+48|0,i+552|0);cd(Ab+60|0,i+564|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+576|0);cd(Ab+48|0,i+588|0);cd(Ab+60|0,i+600|0);Ab=c[mb>>2]|0;yb=Ab+36|0;c[mb>>2]=yb;cd(yb,i+612|0);cd(Ab+48|0,i+624|0);cd(Ab+60|0,i+636|0);c[mb>>2]=(c[mb>>2]|0)+36;Ab=i+648|0;do{yb=Ab+-12|0;if((a[yb+11>>0]|0)<0)Wc(c[yb>>2]|0);yb=Ab+-24|0;Ab=Ab+-36|0;if((a[yb+11>>0]|0)<0)Wc(c[yb>>2]|0);if((a[Ab+11>>0]|0)<0)Wc(c[Ab>>2]|0)}while((Ab|0)!=(i|0));if((a[ka+11>>0]|0)<0)Wc(c[ka>>2]|0);if((a[xb>>0]|0)<0)Wc(c[ja>>2]|0);if((a[wb>>0]|0)<0)Wc(c[ia>>2]|0);if((a[vb>>0]|0)<0)Wc(c[ha>>2]|0);if((a[ub>>0]|0)<0)Wc(c[ga>>2]|0);if((a[tb>>0]|0)<0)Wc(c[fa>>2]|0);if((a[sb>>0]|0)<0)Wc(c[ea>>2]|0);if((a[da+11>>0]|0)<0)Wc(c[da>>2]|0);if((a[rb>>0]|0)<0)Wc(c[ca>>2]|0);if((a[qb>>0]|0)<0)Wc(c[ba>>2]|0);if((a[aa+11>>0]|0)<0)Wc(c[aa>>2]|0);if((a[pb>>0]|0)<0)Wc(c[$>>2]|0);if((a[ob>>0]|0)<0)Wc(c[_>>2]|0);if((a[Z+11>>0]|0)<0)Wc(c[Z>>2]|0);if((a[nb>>0]|0)<0)Wc(c[Y>>2]|0);if((a[lb>>0]|0)<0)Wc(c[X>>2]|0);if((a[kb>>0]|0)<0)Wc(c[W>>2]|0);if((a[gb>>0]|0)<0)Wc(c[V>>2]|0);if((a[jb>>0]|0)<0)Wc(c[U>>2]|0);if((a[ib>>0]|0)<0)Wc(c[T>>2]|0);if((a[hb>>0]|0)<0)Wc(c[S>>2]|0);if((a[fb>>0]|0)<0)Wc(c[R>>2]|0);if((a[eb>>0]|0)<0)Wc(c[Q>>2]|0);if((a[db>>0]|0)<0)Wc(c[P>>2]|0);if((a[cb>>0]|0)<0)Wc(c[O>>2]|0);if((a[bb>>0]|0)<0)Wc(c[N>>2]|0);if((a[ab>>0]|0)<0)Wc(c[M>>2]|0);if((a[$a>>0]|0)<0)Wc(c[L>>2]|0);if((a[_a>>0]|0)<0)Wc(c[K>>2]|0);if((a[Wa>>0]|0)<0)Wc(c[J>>2]|0);if((a[Za>>0]|0)<0)Wc(c[I>>2]|0);if((a[Ya>>0]|0)<0)Wc(c[H>>2]|0);if((a[Xa>>0]|0)<0)Wc(c[G>>2]|0);if((a[Va>>0]|0)<0)Wc(c[F>>2]|0);if((a[Ua>>0]|0)<0)Wc(c[E>>2]|0);if((a[Na>>0]|0)<0)Wc(c[D>>2]|0);if((a[Ta>>0]|0)<0)Wc(c[C>>2]|0);if((a[Sa>>0]|0)<0)Wc(c[B>>2]|0);if((a[Ra>>0]|0)<0)Wc(c[A>>2]|0);if((a[Qa>>0]|0)<0)Wc(c[z>>2]|0);if((a[Pa>>0]|0)<0)Wc(c[y>>2]|0);if((a[Oa>>0]|0)<0)Wc(c[x>>2]|0);if((a[Ma>>0]|0)<0)Wc(c[w>>2]|0);if((a[La>>0]|0)<0)Wc(c[v>>2]|0);if((a[Ea>>0]|0)<0)Wc(c[u>>2]|0);if((a[Ja>>0]|0)<0)Wc(c[t>>2]|0);if((a[Ia>>0]|0)<0)Wc(c[s>>2]|0);if((a[Ha>>0]|0)<0)Wc(c[r>>2]|0);if((a[Ga>>0]|0)<0)Wc(c[q>>2]|0);if((a[p+11>>0]|0)<0)Wc(c[p>>2]|0);if((a[Fa>>0]|0)<0)Wc(c[o>>2]|0);if((a[Da>>0]|0)<0)Wc(c[n>>2]|0);if((a[Ba>>0]|0)<0)Wc(c[m>>2]|0);if((a[Aa>>0]|0)<0)Wc(c[l>>2]|0);l=za;c[l>>2]=0;c[l+4>>2]=4;f[la>>2]=135.0;f[la+4>>2]=75.0;f[oa>>2]=.5;f[oa+4>>2]=.5;f[pa>>2]=0.0;f[pa+4>>2]=0.0;f[qa>>2]=.800000011920929;f[qa+4>>2]=.800000011920929;f[ra>>2]=0.0;f[ra+4>>2]=0.0;f[sa>>2]=.5;f[sa+4>>2]=.5;c[ta>>2]=5;c[ta+4>>2]=5;f[va>>2]=143.0;f[va+4>>2]=83.0;l=wa+16|0;c[l>>2]=0;za=Vc(20)|0;c[za>>2]=3220;c[za+4>>2]=b;c[za+8>>2]=k;c[za+12>>2]=g;c[za+16>>2]=la;c[l>>2]=za;c[j>>2]=c[ta>>2];c[j+4>>2]=c[ta+4>>2];c[i>>2]=c[va>>2];c[i+4>>2]=c[va+4>>2];Ka(na,oa,pa,qa,ra,sa,j,i,0,wa,g);xa=b+28|0;Ca=na+4|0;d=xa+68|0;do{c[xa>>2]=c[Ca>>2];xa=xa+4|0;Ca=Ca+4|0}while((xa|0)<(d|0));Ca=b+96|0;xa=na+72|0;c[Ca>>2]=c[xa>>2];c[Ca+4>>2]=c[xa+4>>2];a[Ca+8>>0]=a[xa+8>>0]|0;a[i>>0]=a[j>>0]|0;zb(b+108|0,na+84|0,i);i=b+128|0;j=na+104|0;xa=c[i>>2]|0;if(!xa)Bb=e;else{c[e>>2]=xa;Wc(xa);c[ya>>2]=0;c[e>>2]=0;c[i>>2]=0;Bb=e}c[i>>2]=c[j>>2];i=na+108|0;c[Bb>>2]=c[i>>2];Bb=na+112|0;c[ya>>2]=c[Bb>>2];c[Bb>>2]=0;c[i>>2]=0;c[j>>2]=0;j=b+140|0;b=na+116|0;c[j>>2]=c[b>>2];c[j+4>>2]=c[b+4>>2];c[j+8>>2]=c[b+8>>2];c[na>>2]=3172;b=c[na+92>>2]|0;if(b|0){j=b;do{b=j;j=c[j>>2]|0;i=c[b+20>>2]|0;do if(i|0){Bb=i+4|0;ya=c[Bb>>2]|0;c[Bb>>2]=ya+-1;if(ya|0)break;ua[c[(c[i>>2]|0)+8>>2]&31](i);Uc(i)}while(0);Wc(b)}while((j|0)!=0)}j=na+84|0;na=c[j>>2]|0;c[j>>2]=0;if(na|0)Wc(na);na=c[l>>2]|0;do if((wa|0)==(na|0))ua[c[(c[na>>2]|0)+16>>2]&31](na);else{if(!na)break;ua[c[(c[na>>2]|0)+20>>2]&31](na)}while(0);na=c[k>>2]|0;if(!na){ma=h;return}wa=c[mb>>2]|0;if((wa|0)==(na|0))Cb=na;else{l=wa;do{wa=l+-12|0;if((a[wa+11>>0]|0)<0)Wc(c[wa>>2]|0);wa=l+-24|0;l=l+-36|0;if((a[wa+11>>0]|0)<0)Wc(c[wa>>2]|0);if((a[l+11>>0]|0)<0)Wc(c[l>>2]|0)}while((l|0)!=(na|0));Cb=c[k>>2]|0}c[mb>>2]=na;Wc(Cb);ma=h;return}function Ja(a){a=a|0;L(a|0)|0;Kd()}function Ka(b,d,e,g,h,i,j,k,l,m,n){b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;i=i|0;j=j|0;k=k|0;l=l|0;m=m|0;n=n|0;var o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0.0,I=0.0,J=0.0,L=0.0,M=0.0,N=0.0,P=0.0,Q=0.0,R=0.0,S=0.0,T=0.0,U=0,V=0,W=0.0,X=0.0,Y=0.0,Z=0.0,_=0.0,$=0.0,aa=0,ba=0,ca=0.0,da=0,ea=0.0,fa=0.0,ga=0.0,ha=0,ia=0,ja=0,ka=0,la=0,na=0,oa=0;o=ma;ma=ma+32|0;p=o;q=o+24|0;r=o+20|0;s=o+16|0;t=o+8|0;c[b>>2]=3196;u=b+4|0;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;c[u+12>>2]=0;u=d;d=c[u+4>>2]|0;v=b+20|0;c[v>>2]=c[u>>2];c[v+4>>2]=d;d=g;g=c[d+4>>2]|0;v=b+28|0;c[v>>2]=c[d>>2];c[v+4>>2]=g;g=e;e=c[g+4>>2]|0;v=b+36|0;c[v>>2]=c[g>>2];c[v+4>>2]=e;e=h;h=c[e+4>>2]|0;v=b+44|0;c[v>>2]=c[e>>2];c[v+4>>2]=h;h=i;i=c[h+4>>2]|0;v=b+52|0;c[v>>2]=c[h>>2];c[v+4>>2]=i;i=b+60|0;f[i>>2]=-1.0;c[b+64>>2]=0;c[b+68>>2]=0;c[b>>2]=3172;v=j;h=c[v>>2]|0;e=c[v+4>>2]|0;v=b+72|0;c[v>>2]=h;c[v+4>>2]=e;a[b+80>>0]=l&1;e=b+84|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;c[b+100>>2]=1065353216;v=b+104|0;g=n+4|0;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;a[v+12>>0]=0;v=((c[g>>2]|0)-(c[n>>2]|0)|0)/68|0;d=j+4|0;if((h|0)<=0){w=h;x=v;y=k;z=k+4|0;A=c[d>>2]|0;B=x+-1|0;C=b+64|0;D=C;E=D;c[E>>2]=v;F=D+4|0;G=F;c[G>>2]=B;H=+(w|0);I=H;J=l?.5:0.0;L=J+I;M=+f[y>>2];N=M;P=L*N;Q=P;R=+(A|0);S=+f[z>>2];T=S*R;U=b+12|0;f[U>>2]=Q;V=b+16|0;f[V>>2]=T;W=M/S;X=W;Y=L*X;Z=R;_=Y/Z;$=_;f[i>>2]=$;ma=o;return}h=k+4|0;u=m+16|0;m=t+4|0;aa=0;ba=c[d>>2]|0;a:while(1){if((ba|0)>0){ca=+(aa|0);if(l){da=0;while(1){ea=+f[k>>2];fa=ea*.5;ga=+f[h>>2];c[p>>2]=aa;c[q>>2]=da;f[r>>2]=((da&1|0)==0?0.0:fa)+(ea*ca+fa);f[s>>2]=ga*+(da|0)+ga*.5;ha=c[u>>2]|0;if(!ha){ia=22;break a}za[c[(c[ha>>2]|0)+24>>2]&7](t,ha,p,q,r,s);ha=p;c[ha>>2]=da;c[ha+4>>2]=aa;ha=wb(e,p)|0;ja=c[t>>2]|0;ka=c[m>>2]|0;if(ka|0){la=ka+4|0;c[la>>2]=(c[la>>2]|0)+1}c[ha>>2]=ja;ja=ha+4|0;ha=c[ja>>2]|0;c[ja>>2]=ka;if(ha|0?(ka=ha+4|0,ja=c[ka>>2]|0,c[ka>>2]=ja+-1,(ja|0)==0):0){ua[c[(c[ha>>2]|0)+8>>2]&31](ha);Uc(ha)}ha=c[m>>2]|0;if(ha|0?(ja=ha+4|0,ka=c[ja>>2]|0,c[ja>>2]=ka+-1,(ka|0)==0):0){ua[c[(c[ha>>2]|0)+8>>2]&31](ha);Uc(ha)}da=da+1|0;ha=c[d>>2]|0;if((da|0)>=(ha|0)){na=ha;break}}}else{da=0;while(1){ga=+f[k>>2];fa=+f[h>>2];c[p>>2]=aa;c[q>>2]=da;f[r>>2]=ga*ca+ga*.5+0.0;f[s>>2]=fa*+(da|0)+fa*.5;ha=c[u>>2]|0;if(!ha){ia=22;break a}za[c[(c[ha>>2]|0)+24>>2]&7](t,ha,p,q,r,s);ha=p;c[ha>>2]=da;c[ha+4>>2]=aa;ha=wb(e,p)|0;ka=c[t>>2]|0;ja=c[m>>2]|0;if(ja|0){la=ja+4|0;c[la>>2]=(c[la>>2]|0)+1}c[ha>>2]=ka;ka=ha+4|0;ha=c[ka>>2]|0;c[ka>>2]=ja;if(ha|0?(ja=ha+4|0,ka=c[ja>>2]|0,c[ja>>2]=ka+-1,(ka|0)==0):0){ua[c[(c[ha>>2]|0)+8>>2]&31](ha);Uc(ha)}ha=c[m>>2]|0;if(ha|0?(ka=ha+4|0,ja=c[ka>>2]|0,c[ka>>2]=ja+-1,(ja|0)==0):0){ua[c[(c[ha>>2]|0)+8>>2]&31](ha);Uc(ha)}da=da+1|0;ha=c[d>>2]|0;if((da|0)>=(ha|0)){na=ha;break}}}}else na=ba;aa=aa+1|0;oa=c[j>>2]|0;if((aa|0)>=(oa|0)){ia=4;break}else ba=na}if((ia|0)==4){w=oa;x=((c[g>>2]|0)-(c[n>>2]|0)|0)/68|0;y=k;z=h;A=na;B=x+-1|0;C=b+64|0;D=C;E=D;c[E>>2]=v;F=D+4|0;G=F;c[G>>2]=B;H=+(w|0);I=H;J=l?.5:0.0;L=J+I;M=+f[y>>2];N=M;P=L*N;Q=P;R=+(A|0);S=+f[z>>2];T=S*R;U=b+12|0;f[U>>2]=Q;V=b+16|0;f[V>>2]=T;W=M/S;X=W;Y=L*X;Z=R;_=Y/Z;$=_;f[i>>2]=$;ma=o;return}else if((ia|0)==22){ia=K(4)|0;c[ia>>2]=3860;O(ia|0,2928,16)}}function La(a,b,c){a=a|0;b=+b;c=c|0;return 0}function Ma(a,b){a=a|0;b=b|0;return}function Na(a,b){a=a|0;b=b|0;return}function Oa(a,b){a=a|0;b=b|0;Kc(5629)|0;Ab(a+24|0,b,c[a+4>>2]|0);return}function Pa(b,d){b=b|0;d=d|0;Bb(b+24|0,c[b+4>>2]|0);a[b+140>>0]=0;return}function Qa(a,b){a=a|0;b=b|0;Db(a+24|0,b,c[a+4>>2]|0);return}function Ra(a){a=a|0;return}function Sa(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0.0,i=0.0,j=0,k=0,l=0,m=0;g=c[b+4>>2]|0;Ya(b+24|0,d,e,g);h=+f[b+40>>2]/+(c[b+100>>2]|0);i=+f[b+36>>2]/(((a[b+104>>0]|0)==0?0.0:.5)+ +(c[b+96>>2]|0));e=c[b+116>>2]|0;if(!e)return;b=e;do{e=b;d=c[e+16>>2]|0;j=c[e+20>>2]|0;e=(j|0)==0;if(!e){k=j+4|0;c[k>>2]=(c[k>>2]|0)+1}k=(c[g>>2]|0)+((c[d+64>>2]|0)*68|0)|0;l=c[k+4>>2]|0;m=d+4|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;f[d+12>>2]=i;f[d+16>>2]=h;if(!e?(e=j+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){ua[c[(c[j>>2]|0)+8>>2]&31](j);Uc(j)}b=c[b>>2]|0}while((b|0)!=0);return}function Ta(a){a=a|0;return}function Ua(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0.0,i=0.0,j=0,k=0,l=0,m=0;Ya(b,d,e,g);h=+f[b+16>>2]/+(c[b+76>>2]|0);i=+f[b+12>>2]/(((a[b+80>>0]|0)==0?0.0:.5)+ +(c[b+72>>2]|0));e=c[b+92>>2]|0;if(!e)return;b=e;do{e=b;d=c[e+16>>2]|0;j=c[e+20>>2]|0;e=(j|0)==0;if(!e){k=j+4|0;c[k>>2]=(c[k>>2]|0)+1}k=(c[g>>2]|0)+((c[d+64>>2]|0)*68|0)|0;l=c[k+4>>2]|0;m=d+4|0;c[m>>2]=c[k>>2];c[m+4>>2]=l;f[d+12>>2]=i;f[d+16>>2]=h;if(!e?(e=j+4|0,d=c[e>>2]|0,c[e>>2]=d+-1,(d|0)==0):0){ua[c[(c[j>>2]|0)+8>>2]&31](j);Uc(j)}b=c[b>>2]|0}while((b|0)!=0);return}function Va(a,b,c){a=a|0;b=b|0;c=c|0;return}function Wa(a,b){a=a|0;b=b|0;return}function Xa(a,b){a=a|0;b=b|0;return 0}function Ya(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0.0,q=0.0,r=0.0,s=0.0,t=0.0,u=0.0,v=0;h=ma;ma=ma+80|0;i=h+64|0;j=h+48|0;k=h+32|0;l=h+16|0;m=h;n=+f[d>>2];o=+f[a+28>>2]*n+ +f[a+44>>2];p=+f[d+4>>2];q=+f[a+32>>2]*p+ +f[a+48>>2];r=+f[a+60>>2];if(r>0.0){s=q*r;if(s<o){t=s;u=q}else{t=o;u=o/r}}else{t=o;u=q}q=+f[b>>2];o=+f[a+36>>2]+(q+n*+f[a+20>>2]-t*+f[a+52>>2]);n=+f[b+4>>2];r=+f[a+40>>2]+(n+p*+f[a+24>>2]-u*+f[a+56>>2]);g[m>>3]=q;g[m+8>>3]=n;Ic(4890,m)|0;m=a+4|0;b=a+8|0;n=+f[b>>2];g[l>>3]=+f[m>>2];g[l+8>>3]=n;Ic(4942,l)|0;g[k>>3]=o;g[k+8>>3]=r;Ic(4992,k)|0;k=a+12|0;l=a+16|0;n=+f[l>>2];g[j>>3]=+f[k>>2];g[j+8>>3]=n;Ic(5045,j)|0;g[i>>3]=t;g[i+8>>3]=u;Ic(5091,i)|0;i=c[a+64>>2]|0;j=a+68|0;if((i|0)>(c[j>>2]|0)){f[m>>2]=o;f[b>>2]=r;f[k>>2]=t;f[l>>2]=u;ma=h;return}a=i;while(1){i=c[e>>2]|0;d=i+(a*68|0)|0;v=i+(a*68|0)+4|0;n=r+u*((+f[v>>2]-+f[b>>2])/+f[l>>2]);f[d>>2]=o+t*((+f[d>>2]-+f[m>>2])/+f[k>>2]);f[v>>2]=n;v=c[e>>2]|0;if((c[v+(a*68|0)+32>>2]|0)!=2){n=u*(+f[i+(a*68|0)+12>>2]/+f[l>>2]);f[v+(a*68|0)+8>>2]=t*(+f[i+(a*68|0)+8>>2]/+f[k>>2]);f[v+(a*68|0)+12>>2]=n}if((a|0)<(c[j>>2]|0))a=a+1|0;else break}f[m>>2]=o;f[b>>2]=r;f[k>>2]=t;f[l>>2]=u;ma=h;return}function Za(a){a=a|0;return}function _a(a){a=a|0;Wc(a);return}function $a(a){a=a|0;var b=0,d=0;b=Vc(20)|0;d=a+4|0;c[b>>2]=3220;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return b|0}function ab(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=3220;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return}function bb(a){a=a|0;return}function cb(a){a=a|0;Wc(a);return}function db(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;gb(a,b+4|0,c,d,e,f);return}function eb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5421?a+4|0:0)|0}function fb(a){a=a|0;return 2888}function gb(a,b,d,e,g,h){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0;e=ma;ma=ma+32|0;d=e;i=e+24|0;j=e+16|0;k=e+8|0;l=c[g>>2]|0;g=c[h>>2]|0;h=c[b+4>>2]|0;m=(c[b>>2]|0)+152|0;n=hb(m,7596,m)|0;m=(c[h>>2]|0)+(n*36|0)|0;n=c[b+12>>2]|0;c[i>>2]=l;c[i+4>>2]=g;f[j>>2]=0.0;f[j+4>>2]=0.0;g=c[b+8>>2]|0;b=Vc(104)|0;c[b+4>>2]=0;c[b+8>>2]=0;c[b>>2]=3264;l=b+12|0;mb(l,m,n,i,j,40.0,g);g=k+4|0;c[k>>2]=l;c[g>>2]=b;c[d>>2]=l;c[d+4>>2]=l;ib(k,d);c[a>>2]=c[k>>2];c[a+4>>2]=c[g>>2];ma=e;return}function hb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(t(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function ib(a,b){a=a|0;b=b|0;return}function jb(a){a=a|0;Sc(a);Wc(a);return}function kb(a){a=a|0;return}function lb(a){a=a|0;Wc(a);return}function mb(a,b,d,e,g,h,i){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;h=+h;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0.0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;j=ma;ma=ma+80|0;k=j;l=a+60|0;m=a+4|0;n=m+56|0;do{c[m>>2]=0;m=m+4|0}while((m|0)<(n|0));f[l>>2]=-1.0;c[a+64>>2]=0;c[a+68>>2]=0;c[a>>2]=3292;f[a+72>>2]=2.0;l=d;o=c[l+4>>2]|0;p=a+44|0;c[p>>2]=c[l>>2];c[p+4>>2]=o;o=e;p=c[o+4>>2]|0;l=a+36|0;c[l>>2]=c[o>>2];c[l+4>>2]=p;p=g;g=c[p+4>>2]|0;l=a+52|0;c[l>>2]=c[p>>2];c[l+4>>2]=g;g=i+4|0;l=c[g>>2]|0;p=a+76|0;c[p>>2]=(l-(c[i>>2]|0)|0)/68|0;o=e;q=c[o>>2]|0;r=c[o+4>>2]|0;o=d;s=c[o>>2]|0;t=c[o+4>>2]|0;o=k;c[o>>2]=q;c[o+4>>2]=r;o=k+8|0;c[o>>2]=s;c[o+4>>2]=t;c[k+16>>2]=1092616192;c[k+20>>2]=1073741824;c[k+24>>2]=842150655;c[k+28>>2]=-1768515841;c[k+32>>2]=5;o=k+40|0;c[o>>2]=q;c[o+4>>2]=r;r=k+48|0;c[r>>2]=s;c[r+4>>2]=t;c[k+56>>2]=1092616192;c[k+60>>2]=1073741824;c[k+64>>2]=0;t=i+8|0;if((c[t>>2]|0)>>>0>l>>>0){m=l;u=k;n=m+68|0;do{c[m>>2]=c[u>>2];m=m+4|0;u=u+4|0}while((m|0)<(n|0));l=(c[g>>2]|0)+68|0;c[g>>2]=l;v=l;w=l}else{qb(i,k);l=c[g>>2]|0;v=l;w=l}c[a+80>>2]=(w-(c[i>>2]|0)|0)/68|0;h=+f[e>>2]+4.0;w=e+4|0;x=+f[w>>2]+4.0;l=d;d=c[l>>2]|0;r=c[l+4>>2]|0;f[k>>2]=h;f[k+4>>2]=x;l=k+8|0;c[l>>2]=d;c[l+4>>2]=r;c[k+16>>2]=1092616192;c[k+20>>2]=1073741824;c[k+24>>2]=842150655;c[k+28>>2]=-387389185;c[k+32>>2]=5;f[k+40>>2]=h;f[k+44>>2]=x;l=k+48|0;c[l>>2]=d;c[l+4>>2]=r;c[k+56>>2]=1092616192;c[k+60>>2]=1073741824;c[k+64>>2]=0;if(v>>>0<(c[t>>2]|0)>>>0){m=v;u=k;n=m+68|0;do{c[m>>2]=c[u>>2];m=m+4|0;u=u+4|0}while((m|0)<(n|0));v=(c[g>>2]|0)+68|0;c[g>>2]=v;y=v}else{qb(i,k);y=c[g>>2]|0}v=a+88|0;c[v>>2]=(y-(c[i>>2]|0)|0)/68|0;x=+f[e>>2]+10.0;h=+f[w>>2]+44.0;if(!(sb(10108,b)|0)){w=c[2525]|0;e=(w-(c[2524]|0)|0)/12|0;y=w;if((c[2526]|0)==(y|0))tb(10096,b);else{cd(y,b);c[2525]=(c[2525]|0)+12}c[(rb(10108,b)|0)>>2]=e}e=c[(rb(10108,b)|0)>>2]|0;f[k>>2]=x;f[k+4>>2]=h;c[k+8>>2]=1109393408;c[k+12>>2]=1109393408;f[k+16>>2]=0.0;f[k+20>>2]=0.0;c[k+24>>2]=255;c[k+28>>2]=e;c[k+32>>2]=2;f[k+40>>2]=x;f[k+44>>2]=h;c[k+48>>2]=1109393408;c[k+52>>2]=1109393408;c[k+56>>2]=0;c[k+60>>2]=0;c[k+64>>2]=0;e=c[g>>2]|0;if(e>>>0<(c[t>>2]|0)>>>0){m=e;u=k;n=m+68|0;do{c[m>>2]=c[u>>2];m=m+4|0;u=u+4|0}while((m|0)<(n|0));c[g>>2]=(c[g>>2]|0)+68;z=c[p>>2]|0;A=c[v>>2]|0;B=a+64|0;C=B;D=C;c[D>>2]=z;E=C+4|0;F=E;c[F>>2]=A;ma=j;return}else{qb(i,k);z=c[p>>2]|0;A=c[v>>2]|0;B=a+64|0;C=B;D=C;c[D>>2]=z;E=C+4|0;F=E;c[F>>2]=A;ma=j;return}}function nb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0.0,j=0.0,k=0;e=c[a+80>>2]|0;g=c[d>>2]|0;c[g+(e*68|0)+28>>2]=b;b=g+(e*68|0)|0;h=g+(e*68|0)+4|0;e=a+72|0;i=+f[e>>2];j=+f[h>>2]-i;f[b>>2]=+f[b>>2]-i;f[h>>2]=j;h=c[a+88>>2]|0;b=c[d>>2]|0;g=b+(h*68|0)|0;k=b+(h*68|0)+4|0;j=+f[e>>2];i=+f[k>>2]-j;f[g>>2]=+f[g>>2]-j;f[k>>2]=i;k=a+12|0;g=a+16|0;i=+f[g>>2]*2.0;f[k>>2]=+f[k>>2]*2.0;f[g>>2]=i;g=a+44|0;k=a+48|0;i=+f[k>>2]*2.0;f[g>>2]=+f[g>>2]*2.0;f[k>>2]=i;k=c[a+64>>2]|0;g=a+68|0;if((k|0)>(c[g>>2]|0))return;a=k;while(1){k=c[d>>2]|0;i=+f[k+(a*68|0)+8>>2]*2.0;j=+f[k+(a*68|0)+12>>2]*2.0;f[k+(a*68|0)+36>>2]=50.0;f[k+(a*68|0)+48>>2]=i;f[k+(a*68|0)+52>>2]=j;e=k+(a*68|0)+64|0;c[e>>2]=c[e>>2]|2;if((a|0)<(c[g>>2]|0))a=a+1|0;else break}return}function ob(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0,i=0.0,j=0.0;d=c[a+80>>2]|0;e=c[b>>2]|0;c[e+(d*68|0)+28>>2]=-387389185;g=e+(d*68|0)|0;h=e+(d*68|0)+4|0;d=a+72|0;i=+f[d>>2];j=+f[h>>2]+i;f[g>>2]=+f[g>>2]+i;f[h>>2]=j;h=c[a+88>>2]|0;a=c[b>>2]|0;b=a+(h*68|0)|0;g=a+(h*68|0)+4|0;j=+f[d>>2];i=+f[g>>2]+j;f[b>>2]=+f[b>>2]+j;f[g>>2]=i;return}function pb(a,b){a=a|0;b=b|0;return c[(c[b>>2]|0)+((c[a+88>>2]|0)*68|0)+28>>2]|0}function qb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/68|0;h=g+1|0;if(h>>>0>63161283)md(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/68|0;k=j<<1;l=j>>>0<31580641?(k>>>0<h>>>0?h:k):63161283;do if(l)if(l>>>0>63161283){k=K(8)|0;$c(k,4393);c[k>>2]=3984;O(k|0,3056,23)}else{m=Vc(l*68|0)|0;break}else m=0;while(0);k=m+(g*68|0)|0;g=m+(l*68|0)|0;l=k;m=b;b=l+68|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-68|0)*68|0)|0;if((f|0)>0)ne(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+68;c[i>>2]=g;if(!e)return;Wc(e);return}function rb(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=s(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(s(l>>>24^l,1540483477)|0)^(s(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{t=o;q=8;break}default:u=o}if((q|0)==7){t=d[n+1>>0]<<8^p;q=8}if((q|0)==8)u=s(t^d[n>>0],1540483477)|0;n=s(u>>>13^u,1540483477)|0;u=n>>>15^n;n=b+4|0;t=c[n>>2]|0;p=(t|0)==0;a:do if(!p){o=t+-1|0;m=(o&t|0)==0;if(!m)if(u>>>0<t>>>0)v=u;else v=(u>>>0)%(t>>>0)|0;else v=u&o;h=c[(c[b>>2]|0)+(v<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(Fc(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(u|0)){if(o>>>0<t>>>0)D=o;else D=(o>>>0)%(t>>>0)|0;if((D|0)!=(v|0)){w=v;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(u|0)){if(h>>>0<t>>>0)E=h;else E=(h>>>0)%(t>>>0)|0;if((E|0)!=(v|0)){w=v;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(Fc(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=v}else w=0;while(0);v=Vc(24)|0;cd(v+8|0,e);c[v+20>>2]=0;c[v+4>>2]=u;c[v>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(t>>>0)<F){i=t<<1|(t>>>0<3|(t+-1&t|0)!=0)&1;j=~~+r(+(F/G))>>>0;ub(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&u;break}if(u>>>0<i>>>0){H=i;I=u}else{H=i;I=(u>>>0)%(i>>>0)|0}}else{H=t;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){t=b+8|0;c[v>>2]=c[t>>2];c[t>>2]=v;c[w>>2]=t;t=c[v>>2]|0;if(t|0){w=c[t+4>>2]|0;t=H+-1|0;if(t&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&t;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[v>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=v;c[e>>2]=(c[e>>2]|0)+1;x=v;y=x+20|0;return y|0}function sb(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=s(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(s(j>>>24^j,1540483477)|0)^(s(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=s(p^d[l>>0],1540483477)|0;l=s(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)t=q;else t=(q>>>0)%(l>>>0)|0;else t=q&p;m=c[(c[b>>2]|0)+(t<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(t|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;u=f?g:k;v=g&255;if(f){if(m){r=n;o=45;break a}if(!(Fc(u,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==v<<24>>24){v=k;k=j;j=h;do{k=k+-1|0;v=v+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[v>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;v=e&255;if(((j?c[n+12>>2]|0:v)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;u=e&255;if(j){if(m){r=n;o=45;break b}if(!(Fc(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==u<<24>>24){u=p;p=v;v=h;do{p=p+-1|0;u=u+1|0;if(!p){r=n;o=45;break b}v=v+1|0}while((a[u>>0]|0)==(a[v>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(t|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function tb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)md(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=K(8)|0;$c(f,4393);c[f>>2]=3984;O(f|0,3056,23)}else{l=Vc(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;cd(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)Wc(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;Wc(n);return}function ub(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=Qc(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){vb(a,d);return}if(d>>>0>=b>>>0)return;e=~~+r(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(t(e+-1|0)|0);h=e>>>0<2?e:g}else h=Qc(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;vb(a,e);return}function vb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)Wc(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=K(8)|0;$c(f,4393);c[f>>2]=3984;O(f|0,3056,23)}f=Vc(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)Wc(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?Fc(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function wb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,t=0,u=0.0,v=0.0,w=0,x=0,y=0,z=0,A=0;d=b;b=c[d>>2]|0;e=c[d+4>>2]|0;d=s(b,1540483477)|0;g=s(e,1540483477)|0;h=(s((s(d>>>24^d,1540483477)|0)^-561034072,1540483477)|0)^(s(g>>>24^g,1540483477)|0);g=s(h>>>13^h,1540483477)|0;h=g>>>15^g;g=a+4|0;d=c[g>>2]|0;i=(d|0)==0;a:do if(!i){j=d+-1|0;k=(j&d|0)==0;if(!k)if(h>>>0<d>>>0)l=h;else l=(h>>>0)%(d>>>0)|0;else l=h&j;m=c[(c[a>>2]|0)+(l<<2)>>2]|0;if((m|0)!=0?(n=c[m>>2]|0,(n|0)!=0):0){if(k){k=n;while(1){m=c[k+4>>2]|0;if(!((m|0)==(h|0)|(m&j|0)==(l|0))){o=l;break a}m=k+8|0;if((c[m>>2]|0)==(b|0)?(c[m+4>>2]|0)==(e|0):0){p=k;break}k=c[k>>2]|0;if(!k){o=l;break a}}q=p+16|0;return q|0}k=n;while(1){j=c[k+4>>2]|0;if((j|0)!=(h|0)){if(j>>>0<d>>>0)t=j;else t=(j>>>0)%(d>>>0)|0;if((t|0)!=(l|0)){o=l;break a}}j=k+8|0;if((c[j>>2]|0)==(b|0)?(c[j+4>>2]|0)==(e|0):0){p=k;break}k=c[k>>2]|0;if(!k){o=l;break a}}q=p+16|0;return q|0}else o=l}else o=0;while(0);l=Vc(24)|0;t=l+8|0;c[t>>2]=b;c[t+4>>2]=e;c[l+16>>2]=0;c[l+20>>2]=0;c[l+4>>2]=h;c[l>>2]=0;e=a+12|0;u=+(((c[e>>2]|0)+1|0)>>>0);v=+f[a+16>>2];do if(i|v*+(d>>>0)<u){t=d<<1|(d>>>0<3|(d+-1&d|0)!=0)&1;b=~~+r(+(u/v))>>>0;xb(a,t>>>0<b>>>0?b:t);t=c[g>>2]|0;b=t+-1|0;if(!(b&t)){w=t;x=b&h;break}if(h>>>0<t>>>0){w=t;x=h}else{w=t;x=(h>>>0)%(t>>>0)|0}}else{w=d;x=o}while(0);o=(c[a>>2]|0)+(x<<2)|0;x=c[o>>2]|0;if(!x){d=a+8|0;c[l>>2]=c[d>>2];c[d>>2]=l;c[o>>2]=d;d=c[l>>2]|0;if(d|0){o=c[d+4>>2]|0;d=w+-1|0;if(d&w)if(o>>>0<w>>>0)y=o;else y=(o>>>0)%(w>>>0)|0;else y=o&d;z=(c[a>>2]|0)+(y<<2)|0;A=33}}else{c[l>>2]=c[x>>2];z=x;A=33}if((A|0)==33)c[z>>2]=l;c[e>>2]=(c[e>>2]|0)+1;p=l;q=p+16|0;return q|0}function xb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=Qc(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){yb(a,d);return}if(d>>>0>=b>>>0)return;e=~~+r(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(t(e+-1|0)|0);h=e>>>0<2?e:g}else h=Qc(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;yb(a,e);return}function yb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;d=a+4|0;if(!b){e=c[a>>2]|0;c[a>>2]=0;if(e|0)Wc(e);c[d>>2]=0;return}if(b>>>0>1073741823){e=K(8)|0;$c(e,4393);c[e>>2]=3984;O(e|0,3056,23)}e=Vc(b<<2)|0;f=c[a>>2]|0;c[a>>2]=e;if(f|0)Wc(f);c[d>>2]=b;d=0;do{c[(c[a>>2]|0)+(d<<2)>>2]=0;d=d+1|0}while((d|0)!=(b|0));d=a+8|0;f=c[d>>2]|0;if(!f)return;e=c[f+4>>2]|0;g=b+-1|0;h=(g&b|0)==0;if(!h)if(e>>>0<b>>>0)i=e;else i=(e>>>0)%(b>>>0)|0;else i=e&g;c[(c[a>>2]|0)+(i<<2)>>2]=d;d=c[f>>2]|0;if(!d)return;if(h){h=i;e=d;j=f;while(1){k=c[e+4>>2]&g;do if((k|0)==(h|0)){l=h;m=e}else{n=(c[a>>2]|0)+(k<<2)|0;if(!(c[n>>2]|0)){c[n>>2]=j;l=k;m=e;break}n=c[e>>2]|0;a:do if(!n)o=e;else{p=e+8|0;q=c[p>>2]|0;r=c[p+4>>2]|0;p=e;s=n;while(1){t=s+8|0;if(!((q|0)==(c[t>>2]|0)?(r|0)==(c[t+4>>2]|0):0)){o=p;break a}t=c[s>>2]|0;if(!t){o=s;break}else{u=s;s=t;p=u}}}while(0);c[j>>2]=c[o>>2];c[o>>2]=c[c[(c[a>>2]|0)+(k<<2)>>2]>>2];c[c[(c[a>>2]|0)+(k<<2)>>2]>>2]=e;l=h;m=j}while(0);e=c[m>>2]|0;if(!e)break;else{h=l;j=m}}return}m=i;i=d;d=f;while(1){f=c[i+4>>2]|0;if(f>>>0<b>>>0)v=f;else v=(f>>>0)%(b>>>0)|0;do if((v|0)==(m|0)){w=m;x=i}else{f=(c[a>>2]|0)+(v<<2)|0;if(!(c[f>>2]|0)){c[f>>2]=d;w=v;x=i;break}f=c[i>>2]|0;b:do if(!f)y=i;else{j=i+8|0;l=c[j>>2]|0;h=c[j+4>>2]|0;j=i;e=f;while(1){o=e+8|0;if(!((l|0)==(c[o>>2]|0)?(h|0)==(c[o+4>>2]|0):0)){y=j;break b}o=c[e>>2]|0;if(!o){y=e;break}else{g=e;e=o;j=g}}}while(0);c[d>>2]=c[y>>2];c[y>>2]=c[c[(c[a>>2]|0)+(v<<2)>>2]>>2];c[c[(c[a>>2]|0)+(v<<2)>>2]>>2]=i;w=m;x=d}while(0);i=c[x>>2]|0;if(!i)break;else{m=w;d=x}}return}function zb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;d=a+12|0;if(c[d>>2]|0){e=a+8|0;f=c[e>>2]|0;if(f|0){g=f;do{f=g;g=c[g>>2]|0;h=c[f+20>>2]|0;if(h|0?(i=h+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){ua[c[(c[h>>2]|0)+8>>2]&31](h);Uc(h)}Wc(f)}while((g|0)!=0)}c[e>>2]=0;e=c[a+4>>2]|0;if(e|0){g=0;do{c[(c[a>>2]|0)+(g<<2)>>2]=0;g=g+1|0}while((g|0)!=(e|0))}c[d>>2]=0}e=c[b>>2]|0;c[b>>2]=0;g=c[a>>2]|0;c[a>>2]=e;if(g|0)Wc(g);g=b+4|0;e=a+4|0;c[e>>2]=c[g>>2];c[g>>2]=0;g=b+12|0;f=c[g>>2]|0;c[d>>2]=f;c[a+16>>2]=c[b+16>>2];d=b+8|0;b=c[d>>2]|0;h=a+8|0;c[h>>2]=b;if(!f)return;f=c[b+4>>2]|0;b=c[e>>2]|0;e=b+-1|0;if(e&b)if(f>>>0<b>>>0)k=f;else k=(f>>>0)%(b>>>0)|0;else k=e&f;c[(c[a>>2]|0)+(k<<2)>>2]=h;c[d>>2]=0;c[g>>2]=0;return}function Ab(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0.0,w=0.0,x=0.0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=ma;ma=ma+80|0;h=g;Bb(b,e);i=c[b+92>>2]|0;if(!i){ma=g;return}j=d+4|0;k=b+68|0;l=h+4|0;m=b+108|0;n=b+112|0;o=b+104|0;p=b+116|0;q=b+120|0;b=i;do{i=b;r=c[i+16>>2]|0;s=c[i+20>>2]|0;t=(s|0)==0;if(!t){u=s+4|0;c[u>>2]=(c[u>>2]|0)+1}v=+f[d>>2];w=+f[j>>2];x=+f[r+4>>2];if(((x<=v?x+ +f[r+12>>2]>=v:0)?(v=+f[r+8>>2],v<=w):0)?v+ +f[r+16>>2]>=w:0){if(!t){u=s+4|0;c[u>>2]=(c[u>>2]|0)+1}u=c[r+68>>2]|0;y=r+64|0;z=c[y>>2]|0;A=u-z|0;a:do if((A|0)>=0){B=u+1-z|0;C=0;D=z;while(1){E=c[e>>2]|0;F=E+((C+D|0)*68|0)|0;G=h;H=F;I=G+68|0;do{c[G>>2]=c[H>>2];G=G+4|0;H=H+4|0}while((G|0)<(I|0));J=C-A|0;G=F;H=E+(((c[k>>2]|0)+J|0)*68|0)|0;I=G+68|0;do{c[G>>2]=c[H>>2];G=G+4|0;H=H+4|0}while((G|0)<(I|0));G=(c[e>>2]|0)+(((c[k>>2]|0)+J|0)*68|0)|0;H=h;I=G+68|0;do{c[G>>2]=c[H>>2];G=G+4|0;H=H+4|0}while((G|0)<(I|0));H=C+1|0;if((H|0)==(B|0))break a;C=H;D=c[y>>2]|0}}while(0);y=c[k>>2]|0;z=r+64|0;c[z>>2]=y-A;c[z+4>>2]=y;if(!t?(y=s+4|0,z=c[y>>2]|0,c[y>>2]=z+-1,(z|0)==0):0){ua[c[(c[s>>2]|0)+8>>2]&31](s);Uc(s)}wa[c[(c[r>>2]|0)+4>>2]&3](r,-1996510465,e);z=i+8|0;y=c[z>>2]|0;c[h>>2]=c[z+4>>2];c[l>>2]=y;y=c[m>>2]|0;if((y|0)==(c[n>>2]|0))Cb(o,h);else{z=h;u=c[z+4>>2]|0;D=y;c[D>>2]=c[z>>2];c[D+4>>2]=u;c[m>>2]=(c[m>>2]|0)+8}a[p>>0]=1;u=q;c[u>>2]=ra[c[(c[r>>2]|0)+12>>2]&7](r,e)|0;c[u+4>>2]=0}if(!t?(u=s+4|0,D=c[u>>2]|0,c[u>>2]=D+-1,(D|0)==0):0){ua[c[(c[s>>2]|0)+8>>2]&31](s);Uc(s)}b=c[b>>2]|0}while((b|0)!=0);ma=g;return}function Bb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=ma;ma=ma+16|0;e=d;f=a+104|0;g=c[f>>2]|0;h=a+108|0;i=c[h>>2]|0;if((g|0)==(i|0)){j=g;c[h>>2]=j;ma=d;return}k=a+84|0;a=g;do{g=c[a+4>>2]|0;l=fe(0,c[a>>2]|0,g|0,((g|0)<0)<<31>>31|0)|0;g=w()|0;m=e;c[m>>2]=l;c[m+4>>2]=g;g=wb(k,e)|0;m=c[g>>2]|0;l=c[g+4>>2]|0;if(l){g=l+4|0;c[g>>2]=(c[g>>2]|0)+1;va[c[(c[m>>2]|0)+8>>2]&15](m,b);g=l+4|0;n=c[g>>2]|0;c[g>>2]=n+-1;if(!n){ua[c[(c[l>>2]|0)+8>>2]&31](l);Uc(l)}}else va[c[(c[m>>2]|0)+8>>2]&15](m,b);a=a+8|0}while((a|0)!=(i|0));j=c[f>>2]|0;c[h>>2]=j;ma=d;return}function Cb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=f>>3;h=g+1|0;if(h>>>0>536870911)md(a);i=a+8|0;j=(c[i>>2]|0)-e|0;k=j>>2;l=j>>3>>>0<268435455?(k>>>0<h>>>0?h:k):536870911;do if(l)if(l>>>0>536870911){k=K(8)|0;$c(k,4393);c[k>>2]=3984;O(k|0,3056,23)}else{k=Vc(l<<3)|0;m=k;n=k;break}else{m=0;n=0}while(0);k=m+(g<<3)|0;g=b;b=c[g+4>>2]|0;h=k;c[h>>2]=c[g>>2];c[h+4>>2]=b;if((f|0)>0)ne(n|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+8;c[i>>2]=m+(l<<3);if(!e)return;Wc(e);return}function Db(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0.0,y=0.0,z=0.0,A=0.0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=ma;ma=ma+16|0;h=g+8|0;i=g;if(!(a[b+116>>0]|0)){ma=g;return}j=b+84|0;k=c[b+92>>2]|0;if(!k){ma=g;return}l=d+4|0;m=i+4|0;n=b+104|0;o=b+108|0;p=b+120|0;q=b+112|0;r=k;while(1){k=r;s=c[k+16>>2]|0;t=c[k+20>>2]|0;u=(t|0)==0;if(!u){v=t+4|0;c[v>>2]=(c[v>>2]|0)+1}x=+f[d>>2];y=+f[l>>2];z=+f[s+4>>2];a:do if(((z<=x?z+ +f[s+12>>2]>=x:0)?(A=+f[s+8>>2],A<=y):0)?A+ +f[s+16>>2]>=y:0){v=k+8|0;B=c[v>>2]|0;C=c[v+4>>2]|0;c[i>>2]=C;c[m>>2]=B;v=c[o>>2]|0;D=c[n>>2]|0;E=v-D>>3;F=D;D=v;if((E>>>0>=2?(v=E+-2|0,(c[F+(v<<3)>>2]|0)==(C|0)):0)?(c[F+(v<<3)+4>>2]|0)==(B|0):0){v=E+-1|0;E=c[F+(v<<3)+4>>2]|0;G=fe(0,c[F+(v<<3)>>2]|0,E|0,((E|0)<0)<<31>>31|0)|0;E=w()|0;v=h;c[v>>2]=G;c[v+4>>2]=E;E=wb(j,h)|0;v=c[E>>2]|0;G=c[E+4>>2]|0;if(G){E=G+4|0;c[E>>2]=(c[E>>2]|0)+1;va[c[(c[v>>2]|0)+8>>2]&15](v,e);E=G+4|0;H=c[E>>2]|0;c[E>>2]=H+-1;if(!H){ua[c[(c[G>>2]|0)+8>>2]&31](G);Uc(G)}}else va[c[(c[v>>2]|0)+8>>2]&15](v,e);c[o>>2]=(c[o>>2]|0)+-8}else I=18;b:do if((I|0)==18){I=0;if((F|0)!=(D|0)){v=F;do{if((c[v>>2]|0)==(C|0)?(c[v+4>>2]|0)==(B|0):0)break b;v=v+8|0}while((v|0)!=(D|0))}v=ra[c[(c[s>>2]|0)+12>>2]&7](s,e)|0;G=p;if(((c[G+4>>2]|0)==0?(c[G>>2]|0)==(v|0):0)?Eb(b,i)|0:0){wa[c[(c[s>>2]|0)+4>>2]&3](s,-1996510465,e);v=c[o>>2]|0;if((v|0)==(c[q>>2]|0))Cb(n,i);else{G=i;H=c[G+4>>2]|0;E=v;c[E>>2]=c[G>>2];c[E+4>>2]=H;c[o>>2]=(c[o>>2]|0)+8}J=0;break a}}while(0);J=2}else J=0;while(0);if(!u?(s=t+4|0,k=c[s>>2]|0,c[s>>2]=k+-1,(k|0)==0):0){ua[c[(c[t>>2]|0)+8>>2]&31](t);Uc(t)}if(J|0){I=35;break}r=c[r>>2]|0;if(!r){I=35;break}}if((I|0)==35){ma=g;return}}function Eb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;e=c[b+104>>2]|0;f=(c[b+108>>2]|0)-e|0;g=e;if(!f){h=1;return h|0}e=(f>>3)+-1|0;f=c[g+(e<<3)+4>>2]|0;i=c[d+4>>2]|0;j=c[g+(e<<3)>>2]|0;e=c[d>>2]|0;if((f|0)==(i|0)?(j|0)==(e+-1|0)|(j|0)==(e+1|0):0){h=1;return h|0}if((j|0)==(e|0)?(f|0)==(i+-1|0)|(f|0)==(i+1|0):0){h=1;return h|0}d=(a[b+80>>0]|0)==0;if(((i|0)%2|0|0)==1|d){if((j|0)==(e+1|0)?(f|0)==(i+-1|0)|(f|0)==(i+1|0):0){h=1;return h|0}if((j|0)==(e+-1|0)&((i&1|0)==0|d))k=11}else if((i&1|0)==0&(j|0)==(e+-1|0))k=11;if((k|0)==11?(f|0)==(i+-1|0)|(f|0)==(i+1|0):0){h=1;return h|0}h=0;return h|0}function Fb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=ma;ma=ma+16|0;e=d;if((b|0)==(a|0)){ma=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){va[c[(c[g>>2]|0)+12>>2]&15](g,e);j=c[f>>2]|0;ua[c[(c[j>>2]|0)+16>>2]&31](j);c[f>>2]=0;j=c[i>>2]|0;va[c[(c[j>>2]|0)+12>>2]&15](j,a);j=c[i>>2]|0;ua[c[(c[j>>2]|0)+16>>2]&31](j);c[i>>2]=0;c[f>>2]=a;va[c[(c[e>>2]|0)+12>>2]&15](e,b);ua[c[(c[e>>2]|0)+16>>2]&31](e);c[i>>2]=b;ma=d;return}else{va[c[(c[g>>2]|0)+12>>2]&15](g,b);g=c[f>>2]|0;ua[c[(c[g>>2]|0)+16>>2]&31](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;ma=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){va[c[(c[g>>2]|0)+12>>2]&15](g,a);b=c[i>>2]|0;ua[c[(c[b>>2]|0)+16>>2]&31](b);c[i>>2]=c[f>>2];c[f>>2]=a;ma=d;return}else{c[f>>2]=g;c[i>>2]=h;ma=d;return}}}function Gb(a){a=a|0;Wc(a);return}function Hb(a){a=a|0;var b=0,d=0;b=Vc(20)|0;d=a+4|0;c[b>>2]=3316;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return b|0}function Ib(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=3316;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return}function Jb(a){a=a|0;return}function Kb(a){a=a|0;Wc(a);return}function Lb(b){b=b|0;var e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0.0;e=ma;ma=ma+80|0;h=e+64|0;i=e+56|0;j=e+48|0;k=e;l=b+4|0;a:do if(!(G(k|0)|0))m=l;else{n=k+16|0;o=k+20|0;p=k+24|0;q=j+4|0;r=j+4|0;s=k+20|0;t=j+4|0;u=k+8|0;b:while(1){switch(c[k>>2]|0){case 256:{break b;break}case 769:{v=c[l>>2]|0;x=c[n>>2]|0;y=(c[v+16>>2]|0)+(x>>>5<<2)|0;c[y>>2]=c[y>>2]&~(1<<(x&31));y=c[v>>2]|0;va[c[(c[y>>2]|0)+4>>2]&15](y,x);break}case 768:{x=c[l>>2]|0;y=c[n>>2]|0;v=(c[x+16>>2]|0)+(y>>>5<<2)|0;c[v>>2]=c[v>>2]|1<<(y&31);v=c[x>>2]|0;va[c[(c[v>>2]|0)+8>>2]&15](v,y);break}case 1025:{z=+(c[p>>2]|0);y=c[c[l>>2]>>2]|0;v=c[(c[y>>2]|0)+12>>2]|0;f[j>>2]=+(c[o>>2]|0);f[q>>2]=z;c[h>>2]=c[j>>2];c[h+4>>2]=c[j+4>>2];va[v&15](y,h);break}case 1026:{z=+(c[p>>2]|0);y=c[c[l>>2]>>2]|0;v=c[(c[y>>2]|0)+16>>2]|0;f[j>>2]=+(c[o>>2]|0);f[r>>2]=z;c[h>>2]=c[j>>2];c[h+4>>2]=c[j+4>>2];va[v&15](y,h);break}case 1024:{z=+(c[p>>2]|0);y=c[c[l>>2]>>2]|0;v=c[(c[y>>2]|0)+20>>2]|0;f[j>>2]=+(c[s>>2]|0);f[t>>2]=z;c[h>>2]=c[j>>2];c[h+4>>2]=c[j+4>>2];va[v&15](y,h);break}case 512:{y=d[u>>0]|0;c[i>>2]=512;c[i+4>>2]=y;Ic(5597,i)|0;if((a[u>>0]|0)==13){y=c[c[l>>2]>>2]|0;ua[c[(c[y>>2]|0)+24>>2]&31](y)}break}default:{}}if(!(G(k|0)|0)){m=l;break a}}Kd()}while(0);l=b+8|0;k=c[l>>2]|0;i=k;h=fe(c[i>>2]|0,c[i+4>>2]|0,1,0)|0;i=w()|0;j=k;c[j>>2]=h;c[j+4>>2]=i;z=+aa();i=c[m>>2]|0;m=c[c[b+12>>2]>>2]|0;j=c[l>>2]|0;l=c[j>>2]|0;h=c[j+4>>2]|0;j=c[i>>2]|0;qa[c[c[j>>2]>>2]&1](j,z,i+16|0)|0;Pb(i,m,z,l,h);g[c[b+16>>2]>>3]=z;ma=e;return}function Mb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==5617?a+4|0:0)|0}function Nb(a){a=a|0;return 2920}function Ob(a){a=a|0;return}function Pb(b,d,e,g,h){b=b|0;d=d|0;e=+e;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0.0,p=0,q=0.0,r=0.0,s=0,t=0,u=0,v=0;h=c[(c[b>>2]|0)+4>>2]|0;_(d|0,0,0,~~+f[b+4>>2]|0,~~+f[b+8>>2]|0,c[b+12>>2]|0)|0;b=h+4|0;d=c[h>>2]|0;if((c[b>>2]|0)==(d|0))return;g=d;d=0;i=0;do{j=g;k=j+(i*68|0)|0;l=j+(i*68|0)+64|0;m=c[l>>2]|0;if((m&1|0)!=0?(n=j+(i*68|0)+40|0,e=+f[k>>2],o=(+f[n>>2]-e)*.5,p=j+(i*68|0)+4|0,q=+f[p>>2],r=(+f[j+(i*68|0)+44>>2]-q)*.5,f[k>>2]=e+o,f[p>>2]=q+r,o<1.0&r<1.0):0){p=m&-2;s=n;n=c[s+4>>2]|0;t=k;c[t>>2]=c[s>>2];c[t+4>>2]=n;c[l>>2]=p;u=p}else u=m;if(u&2|0?(m=j+(i*68|0)+48|0,p=j+(i*68|0)+8|0,r=+f[p>>2],o=(+f[m>>2]-r)*.5,n=j+(i*68|0)+12|0,q=+f[n>>2],e=(+f[j+(i*68|0)+52>>2]-q)*.5,f[p>>2]=r+o,f[n>>2]=q+e,o<1.0&e<1.0):0){n=m;m=c[n+4>>2]|0;t=p;c[t>>2]=c[n>>2];c[t+4>>2]=m;c[l>>2]=u&-3}switch(c[j+(i*68|0)+32>>2]|0){case 2:{l=(c[2524]|0)+((c[j+(i*68|0)+28>>2]|0)*12|0)|0;if((a[l+11>>0]|0)<0)v=c[l>>2]|0;else v=l;z(v|0,+(+f[k>>2]),+(+f[j+(i*68|0)+4>>2]),+(+f[j+(i*68|0)+8>>2]),c[j+(i*68|0)+24>>2]|0);break}case 0:{e=+f[j+(i*68|0)+8>>2]*.5;o=+f[j+(i*68|0)+12>>2]*.5;x(+(e+ +f[k>>2]),+(o+ +f[j+(i*68|0)+4>>2]),+e,+o,c[j+(i*68|0)+24>>2]|0);break}case 5:{B(+(+f[k>>2]),+(+f[j+(i*68|0)+4>>2]),+(+f[j+(i*68|0)+8>>2]),+(+f[j+(i*68|0)+12>>2]),+(+f[j+(i*68|0)+16>>2]),+(+f[j+(i*68|0)+20>>2]),c[j+(i*68|0)+24>>2]|0,c[j+(i*68|0)+28>>2]|0);break}case 1:{y(+(+f[k>>2]),+(+f[j+(i*68|0)+4>>2]),+(+f[j+(i*68|0)+8>>2]),+(+f[j+(i*68|0)+12>>2]),c[j+(i*68|0)+24>>2]|0);break}default:{}}i=fe(i|0,d|0,1,0)|0;d=w()|0;g=c[h>>2]|0}while(d>>>0<0|((d|0)==0?i>>>0<(((c[b>>2]|0)-g|0)/68|0)>>>0:0));return}function Qb(){var b=0,d=0,e=0,f=0,g=0,h=0;b=ma;ma=ma+16|0;d=b;e=Vc(16)|0;c[d>>2]=e;c[d+8>>2]=-2147483632;c[d+4>>2]=12;f=e;g=4036;h=f+12|0;do{a[f>>0]=a[g>>0]|0;f=f+1|0;g=g+1|0}while((f|0)<(h|0));a[e+12>>0]=0;Xc(7592,d);if((a[d+11>>0]|0)<0)Wc(c[d>>2]|0);d=Yc(7592)|0;c[1899]=d;e=1;g=d;do{g=(s(g>>>30^g,1812433253)|0)+e|0;c[7596+(e<<2)>>2]=g;e=e+1|0}while((e|0)!=624);c[2523]=0;c[2524]=0;c[2525]=0;c[2526]=0;c[2527]=0;c[2528]=0;c[2529]=0;c[2530]=0;c[2531]=1065353216;c[1896]=0;ma=b;return}function Rb(a){a=a|0;var b=0,d=0;b=ma;ma=ma+16|0;d=b;c[d>>2]=Wb(c[a+60>>2]|0)|0;a=Ub(Y(6,d|0)|0)|0;ma=b;return a|0}function Sb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=ma;ma=ma+48|0;f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=Ub(T(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=Ub(T(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}ma=e;return v|0}function Tb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=ma;ma=ma+32|0;f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((Ub(S(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;ma=e;return h|0}function Ub(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(Vb()|0)>>2]=0-a;b=-1}else b=a;return b|0}function Vb(){return 10192}function Wb(a){a=a|0;return a|0}function Xb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=ma;ma=ma+32|0;g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,X(54,g|0)|0):0)a[b+75>>0]=-1;g=Sb(b,d,e)|0;ma=f;return g|0}function Yb(a){a=a|0;return (a+-48|0)>>>0<10|0}function Zb(){return 3608}function _b(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function $b(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function ac(a,b){a=a|0;b=b|0;var c=0;c=$b(a)|0;return ((bc(a,1,c,b)|0)!=(c|0))<<31>>31|0}function bc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=s(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(dc(e)|0)==0;h=gc(a,f,e)|0;if(d)i=h;else{cc(e);i=h}}else i=gc(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function cc(a){a=a|0;return}function dc(a){a=a|0;return 1}function ec(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=ma;ma=ma+16|0;g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(fc(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((sa[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);ma=f;return m|0}function fc(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function gc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(fc(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=sa[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=sa[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);ne(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function hc(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=ic(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function ic(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=jc(c[b+8>>2]|0,f)|0;h=jc(c[b+12>>2]|0,f)|0;i=jc(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=jc(c[b+(q<<2)>>2]|0,f)|0;s=jc(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=_b(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=jc(c[b+(m<<2)>>2]|0,f)|0;j=jc(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function jc(a,b){a=a|0;b=b|0;var c=0;c=me(a|0)|0;return ((b|0)==0?a:c)|0}function kc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;t=p;m=5;break}}}else{q=b;r=e;t=g;m=5}while(0);if((m|0)==5)if(t){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{u=k;break}q=s(f,16843009)|0;c:do if(l>>>0>3){t=k;g=l;while(1){e=c[t>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){v=g;w=t;break c}e=t+4|0;b=g+-4|0;if(b>>>0>3){t=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{v=y;w=x}q=w;g=v;while(1){if((a[q>>0]|0)==r<<24>>24){u=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)u=0;return u|0}function lc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=ma;ma=ma+224|0;g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((mc(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=dc(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=mc(b,d,g,i,h)|0;if(!o)s=j;else{sa[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=mc(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)cc(b);m=(h&32|0)==0?s:-1}ma=f;return m|0}function mc(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0;j=ma;ma=ma+64|0;k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;x=t;while(1){do if((x|0)>-1)if((v|0)>(2147483647-x|0)){c[(Vb()|0)>>2]=75;y=-1;break}else{y=v+x|0;break}else y=x;while(0);z=c[k>>2]|0;A=a[z>>0]|0;if(!(A<<24>>24)){B=94;break a}C=A;A=z;b:while(1){switch(C<<24>>24){case 37:{B=10;break b;break}case 0:{D=A;break b;break}default:{}}E=A+1|0;c[k>>2]=E;C=a[E>>0]|0;A=E}c:do if((B|0)==10){B=0;C=A;E=A;while(1){if((a[E+1>>0]|0)!=37){D=C;break c}F=C+1|0;E=E+2|0;c[k>>2]=E;if((a[E>>0]|0)!=37){D=F;break}else C=F}}while(0);v=D-z|0;if(e)nc(d,z,v);if(!v)break;else x=y}x=(Yb(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!x?(a[v+2>>0]|0)==36:0){G=(a[v+1>>0]|0)+-48|0;H=1;I=3}else{G=-1;H=u;I=1}x=v+I|0;c[k>>2]=x;v=a[x>>0]|0;A=(v<<24>>24)+-32|0;if(A>>>0>31|(1<<A&75913|0)==0){J=0;K=v;L=x}else{v=0;C=A;A=x;while(1){x=1<<C|v;E=A+1|0;c[k>>2]=E;F=a[E>>0]|0;C=(F<<24>>24)+-32|0;if(C>>>0>31|(1<<C&75913|0)==0){J=x;K=F;L=E;break}else{v=x;A=E}}}if(K<<24>>24==42){if((Yb(a[L+1>>0]|0)|0)!=0?(A=c[k>>2]|0,(a[A+2>>0]|0)==36):0){v=A+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;M=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;N=1;O=A+3|0}else{if(H|0){P=-1;break}if(e){A=(c[f>>2]|0)+(4-1)&~(4-1);v=c[A>>2]|0;c[f>>2]=A+4;Q=v}else Q=0;M=Q;N=0;O=(c[k>>2]|0)+1|0}c[k>>2]=O;v=(M|0)<0;R=v?0-M|0:M;S=v?J|8192:J;T=N;U=O}else{v=oc(k)|0;if((v|0)<0){P=-1;break}R=v;S=J;T=H;U=c[k>>2]|0}do if((a[U>>0]|0)==46){v=U+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=oc(k)|0;V=v;W=c[k>>2]|0;break}if(Yb(a[U+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){A=v+2|0;c[i+((a[A>>0]|0)+-48<<2)>>2]=10;C=c[h+((a[A>>0]|0)+-48<<3)>>2]|0;A=v+4|0;c[k>>2]=A;V=C;W=A;break}if(T|0){P=-1;break a}if(e){A=(c[f>>2]|0)+(4-1)&~(4-1);C=c[A>>2]|0;c[f>>2]=A+4;X=C}else X=0;C=(c[k>>2]|0)+2|0;c[k>>2]=C;V=X;W=C}else{V=-1;W=U}while(0);C=0;A=W;while(1){if(((a[A>>0]|0)+-65|0)>>>0>57){P=-1;break a}v=A;A=A+1|0;c[k>>2]=A;Y=a[(a[v>>0]|0)+-65+(16+(C*58|0))>>0]|0;Z=Y&255;if((Z+-1|0)>>>0>=8)break;else C=Z}if(!(Y<<24>>24)){P=-1;break}v=(G|0)>-1;do if(Y<<24>>24==19)if(v){P=-1;break a}else B=54;else{if(v){c[i+(G<<2)>>2]=Z;E=h+(G<<3)|0;x=c[E+4>>2]|0;F=l;c[F>>2]=c[E>>2];c[F+4>>2]=x;B=54;break}if(!e){P=0;break a}pc(l,Z,f);_=c[k>>2]|0;B=55}while(0);if((B|0)==54){B=0;if(e){_=A;B=55}else $=0}d:do if((B|0)==55){B=0;v=a[_+-1>>0]|0;x=(C|0)!=0&(v&15|0)==3?v&-33:v;v=S&-65537;F=(S&8192|0)==0?S:v;e:do switch(x|0){case 110:{switch((C&255)<<24>>24){case 0:{c[c[l>>2]>>2]=y;$=0;break d;break}case 1:{c[c[l>>2]>>2]=y;$=0;break d;break}case 2:{E=c[l>>2]|0;c[E>>2]=y;c[E+4>>2]=((y|0)<0)<<31>>31;$=0;break d;break}case 3:{b[c[l>>2]>>1]=y;$=0;break d;break}case 4:{a[c[l>>2]>>0]=y;$=0;break d;break}case 6:{c[c[l>>2]>>2]=y;$=0;break d;break}case 7:{E=c[l>>2]|0;c[E>>2]=y;c[E+4>>2]=((y|0)<0)<<31>>31;$=0;break d;break}default:{$=0;break d}}break}case 112:{aa=120;ba=V>>>0>8?V:8;ca=F|8;B=67;break}case 88:case 120:{aa=x;ba=V;ca=F;B=67;break}case 111:{E=l;da=c[E>>2]|0;ea=c[E+4>>2]|0;E=rc(da,ea,p)|0;fa=q-E|0;ga=E;ha=0;ia=5658;ja=(F&8|0)==0|(V|0)>(fa|0)?V:fa+1|0;ka=F;la=da;na=ea;B=73;break}case 105:case 100:{ea=l;da=c[ea>>2]|0;fa=c[ea+4>>2]|0;if((fa|0)<0){ea=ge(0,0,da|0,fa|0)|0;E=w()|0;oa=l;c[oa>>2]=ea;c[oa+4>>2]=E;pa=1;qa=5658;ra=ea;sa=E;B=72;break e}else{pa=(F&2049|0)!=0&1;qa=(F&2048|0)==0?((F&1|0)==0?5658:5660):5659;ra=da;sa=fa;B=72;break e}break}case 117:{fa=l;pa=0;qa=5658;ra=c[fa>>2]|0;sa=c[fa+4>>2]|0;B=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=5658;wa=1;xa=v;ya=q;break}case 109:{za=tc(c[(Vb()|0)>>2]|0)|0;B=77;break}case 115:{fa=c[l>>2]|0;za=(fa|0)==0?5668:fa;B=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Aa=-1;B=81;break}case 83:{if(!V){uc(d,32,R,0,F);Ba=0;B=91}else{Aa=V;B=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{$=wc(d,+g[l>>3],R,V,F,x)|0;break d;break}default:{ta=z;ua=0;va=5658;wa=V;xa=F;ya=q}}while(0);f:do if((B|0)==67){B=0;x=l;fa=c[x>>2]|0;da=c[x+4>>2]|0;x=qc(fa,da,p,aa&32)|0;E=(ca&8|0)==0|(fa|0)==0&(da|0)==0;ga=x;ha=E?0:2;ia=E?5658:5658+(aa>>>4)|0;ja=ba;ka=ca;la=fa;na=da;B=73}else if((B|0)==72){B=0;ga=sc(ra,sa,p)|0;ha=pa;ia=qa;ja=V;ka=F;la=ra;na=sa;B=73}else if((B|0)==77){B=0;da=kc(za,0,V)|0;fa=(da|0)==0;ta=za;ua=0;va=5658;wa=fa?V:da-za|0;xa=v;ya=fa?za+V|0:da}else if((B|0)==81){B=0;da=c[l>>2]|0;fa=0;while(1){E=c[da>>2]|0;if(!E){Ca=fa;break}x=vc(o,E)|0;Da=(x|0)<0;if(Da|x>>>0>(Aa-fa|0)>>>0){B=85;break}E=x+fa|0;if(Aa>>>0>E>>>0){da=da+4|0;fa=E}else{Ca=E;break}}if((B|0)==85){B=0;if(Da){P=-1;break a}else Ca=fa}uc(d,32,R,Ca,F);if(!Ca){Ba=0;B=91}else{da=c[l>>2]|0;E=0;while(1){x=c[da>>2]|0;if(!x){Ba=Ca;B=91;break f}ea=vc(o,x)|0;E=ea+E|0;if((E|0)>(Ca|0)){Ba=Ca;B=91;break f}nc(d,o,ea);if(E>>>0>=Ca>>>0){Ba=Ca;B=91;break}else da=da+4|0}}}while(0);if((B|0)==73){B=0;v=(la|0)!=0|(na|0)!=0;da=(ja|0)!=0|v;E=q-ga+((v^1)&1)|0;ta=da?ga:p;ua=ha;va=ia;wa=da?((ja|0)>(E|0)?ja:E):0;xa=(ja|0)>-1?ka&-65537:ka;ya=q}else if((B|0)==91){B=0;uc(d,32,R,Ba,F^8192);$=(R|0)>(Ba|0)?R:Ba;break}E=ya-ta|0;da=(wa|0)<(E|0)?E:wa;v=da+ua|0;fa=(R|0)<(v|0)?v:R;uc(d,32,fa,v,xa);nc(d,va,ua);uc(d,48,fa,v,xa^65536);uc(d,48,da,E,0);nc(d,ta,E);uc(d,32,fa,v,xa^8192);$=fa}while(0);s=$;t=y;u=T}g:do if((B|0)==94)if(!d)if(!u)P=0;else{T=1;while(1){t=c[i+(T<<2)>>2]|0;if(!t)break;pc(h+(T<<3)|0,t,f);t=T+1|0;if(t>>>0<10)T=t;else{P=1;break g}}t=T;while(1){if(c[i+(t<<2)>>2]|0){P=-1;break g}t=t+1|0;if(t>>>0>=10){P=1;break}}}else P=y;while(0);ma=j;return P|0}function nc(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))gc(b,d,a)|0;return}function oc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(Yb(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(Yb(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function pc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function qc(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=ke(c|0,e|0,4)|0;e=w()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function rc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=ke(c|0,d|0,3)|0;d=w()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function sc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=je(f|0,g|0,10,0)|0;h=g;g=w()|0;i=ee(f|0,g|0,10,0)|0;j=ge(c|0,h|0,i|0,w()|0)|0;w()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function tc(a){a=a|0;return Dc(a,c[(Cc()|0)+188>>2]|0)|0}function uc(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=ma;ma=ma+256|0;g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;oe(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{nc(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;nc(a,g,h)}ma=f;return}function vc(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=Ac(a,b,0)|0;return c|0}function wc(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0.0,u=0,v=0.0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0,H=0,I=0,J=0.0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0.0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0.0,ia=0.0,ja=0,ka=0,la=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0;j=ma;ma=ma+560|0;k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=xc(e)|0;r=w()|0;if((r|0)<0){t=-e;u=xc(t)|0;v=t;x=1;y=5675;z=w()|0;A=u}else{v=e;x=(h&2049|0)!=0&1;y=(h&2048|0)==0?((h&1|0)==0?5676:5681):5678;z=r;A=q}do if(0==0&(z&2146435072|0)==2146435072){q=(i&32|0)!=0;A=x+3|0;uc(b,32,f,A,h&-65537);nc(b,y,x);nc(b,v!=v|0.0!=0.0?(q?5702:5706):q?5694:5698,3);uc(b,32,f,A,h^8192);B=A}else{e=+yc(v,l)*2.0;A=e!=0.0;if(A)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;u=(r|0)==0?y:y+9|0;C=x|2;D=12-g|0;do if(!(g>>>0>11|(D|0)==0)){t=8.0;E=D;do{E=E+-1|0;t=t*16.0}while((E|0)!=0);if((a[u>>0]|0)==45){F=-(t+(-e-t));break}else{F=e+t-t;break}}else F=e;while(0);D=c[l>>2]|0;E=(D|0)<0?0-D|0:D;G=sc(E,((E|0)<0)<<31>>31,p)|0;if((G|0)==(p|0)){E=o+11|0;a[E>>0]=48;H=E}else H=G;a[H+-1>>0]=(D>>31&2)+43;D=H+-2|0;a[D>>0]=i+15;G=(g|0)<1;E=(h&8|0)==0;I=m;J=F;while(1){K=~~J;L=I+1|0;a[I>>0]=r|d[480+K>>0];J=(J-+(K|0))*16.0;if((L-n|0)==1?!(E&(G&J==0.0)):0){a[L>>0]=46;M=I+2|0}else M=L;if(!(J!=0.0))break;else I=M}I=M;if((g|0)!=0?(-2-n+I|0)<(g|0):0){G=p;E=D;N=g+2+G-E|0;O=G;P=E}else{E=p;G=D;N=E-n-G+I|0;O=E;P=G}G=N+C|0;uc(b,32,f,G,h);nc(b,u,C);uc(b,48,f,G,h^65536);E=I-n|0;nc(b,m,E);I=O-P|0;uc(b,48,N-(E+I)|0,0,0);nc(b,D,I);uc(b,32,f,G,h^8192);B=G;break}G=(g|0)<0?6:g;if(A){I=(c[l>>2]|0)+-28|0;c[l>>2]=I;Q=e*268435456.0;R=I}else{Q=e;R=c[l>>2]|0}I=(R|0)<0?k:k+288|0;E=I;J=Q;do{r=~~J>>>0;c[E>>2]=r;E=E+4|0;J=(J-+(r>>>0))*1.0e9}while(J!=0.0);A=I;if((R|0)>0){D=I;C=E;u=R;while(1){r=(u|0)<29?u:29;L=C+-4|0;if(L>>>0>=D>>>0){K=L;L=0;do{S=le(c[K>>2]|0,0,r|0)|0;T=fe(S|0,w()|0,L|0,0)|0;S=w()|0;L=je(T|0,S|0,1e9,0)|0;U=ee(L|0,w()|0,1e9,0)|0;V=ge(T|0,S|0,U|0,w()|0)|0;w()|0;c[K>>2]=V;K=K+-4|0}while(K>>>0>=D>>>0);if(L){K=D+-4|0;c[K>>2]=L;W=K}else W=D}else W=D;a:do if(C>>>0>W>>>0){K=C;while(1){V=K+-4|0;if(c[V>>2]|0){X=K;break a}if(V>>>0>W>>>0)K=V;else{X=V;break}}}else X=C;while(0);L=(c[l>>2]|0)-r|0;c[l>>2]=L;if((L|0)>0){D=W;C=X;u=L}else{Y=W;Z=X;_=L;break}}}else{Y=I;Z=E;_=R}if((_|0)<0){u=((G+25|0)/9|0)+1|0;C=(q|0)==102;D=Y;L=Z;K=_;while(1){V=0-K|0;U=(V|0)<9?V:9;if(D>>>0<L>>>0){V=(1<<U)+-1|0;S=1e9>>>U;T=0;$=D;do{aa=c[$>>2]|0;c[$>>2]=(aa>>>U)+T;T=s(aa&V,S)|0;$=$+4|0}while($>>>0<L>>>0);$=(c[D>>2]|0)==0?D+4|0:D;if(!T){ba=L;ca=$}else{c[L>>2]=T;ba=L+4|0;ca=$}}else{ba=L;ca=(c[D>>2]|0)==0?D+4|0:D}$=C?I:ca;S=(ba-$>>2|0)>(u|0)?$+(u<<2)|0:ba;K=(c[l>>2]|0)+U|0;c[l>>2]=K;if((K|0)>=0){da=ca;ea=S;break}else{D=ca;L=S}}}else{da=Y;ea=Z}if(da>>>0<ea>>>0){L=(A-da>>2)*9|0;D=c[da>>2]|0;if(D>>>0<10)fa=L;else{K=L;L=10;while(1){L=L*10|0;u=K+1|0;if(D>>>0<L>>>0){fa=u;break}else K=u}}}else fa=0;K=(q|0)==103;L=(G|0)!=0;D=G-((q|0)==102?0:fa)+((L&K)<<31>>31)|0;if((D|0)<(((ea-A>>2)*9|0)+-9|0)){u=D+9216|0;D=(u|0)/9|0;C=I+4+(D+-1024<<2)|0;E=u-(D*9|0)|0;if((E|0)<8){D=E;E=10;while(1){u=E*10|0;if((D|0)<7){D=D+1|0;E=u}else{ga=u;break}}}else ga=10;E=c[C>>2]|0;D=(E>>>0)/(ga>>>0)|0;q=E-(s(D,ga)|0)|0;u=(C+4|0)==(ea|0);if(!(u&(q|0)==0)){t=(D&1|0)==0?9007199254740992.0:9007199254740994.0;D=ga>>>1;J=q>>>0<D>>>0?.5:u&(q|0)==(D|0)?1.0:1.5;if(!x){ha=J;ia=t}else{D=(a[y>>0]|0)==45;ha=D?-J:J;ia=D?-t:t}D=E-q|0;c[C>>2]=D;if(ia+ha!=ia){q=D+ga|0;c[C>>2]=q;if(q>>>0>999999999){q=C;D=da;while(1){E=q+-4|0;c[q>>2]=0;if(E>>>0<D>>>0){u=D+-4|0;c[u>>2]=0;ja=u}else ja=D;u=(c[E>>2]|0)+1|0;c[E>>2]=u;if(u>>>0>999999999){q=E;D=ja}else{ka=E;la=ja;break}}}else{ka=C;la=da}D=(A-la>>2)*9|0;q=c[la>>2]|0;if(q>>>0<10){na=ka;oa=D;pa=la}else{E=D;D=10;while(1){D=D*10|0;u=E+1|0;if(q>>>0<D>>>0){na=ka;oa=u;pa=la;break}else E=u}}}else{na=C;oa=fa;pa=da}}else{na=C;oa=fa;pa=da}E=na+4|0;qa=oa;ra=ea>>>0>E>>>0?E:ea;sa=pa}else{qa=fa;ra=ea;sa=da}E=0-qa|0;b:do if(ra>>>0>sa>>>0){D=ra;while(1){q=D+-4|0;if(c[q>>2]|0){ta=D;ua=1;break b}if(q>>>0>sa>>>0)D=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(K){C=G+((L^1)&1)|0;if((C|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=C+-1-qa|0}else{va=i+-2|0;wa=C+-1|0}if(!(h&8)){if(ua?(C=c[ta+-4>>2]|0,(C|0)!=0):0)if(!((C>>>0)%10|0)){D=0;U=10;while(1){U=U*10|0;T=D+1|0;if((C>>>0)%(U>>>0)|0|0){xa=T;break}else D=T}}else xa=0;else xa=9;D=((ta-A>>2)*9|0)+-9|0;if((va|32|0)==102){U=D-xa|0;C=(U|0)>0?U:0;ya=va;za=(wa|0)<(C|0)?wa:C;break}else{C=D+qa-xa|0;D=(C|0)>0?C:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}}else{ya=va;za=wa}}else{ya=i;za=G}while(0);G=(za|0)!=0;A=G?1:h>>>3&1;L=(ya|32|0)==102;if(L){Aa=0;Ba=(qa|0)>0?qa:0}else{K=(qa|0)<0?E:qa;D=sc(K,((K|0)<0)<<31>>31,p)|0;K=p;if((K-D|0)<2){C=D;while(1){U=C+-1|0;a[U>>0]=48;if((K-U|0)<2)C=U;else{Ca=U;break}}}else Ca=D;a[Ca+-1>>0]=(qa>>31&2)+43;C=Ca+-2|0;a[C>>0]=ya;Aa=C;Ba=K-C|0}C=x+1+za+A+Ba|0;uc(b,32,f,C,h);nc(b,y,x);uc(b,48,f,C,h^65536);if(L){E=sa>>>0>I>>>0?I:sa;U=m+9|0;T=U;q=m+8|0;u=E;do{S=sc(c[u>>2]|0,0,U)|0;if((u|0)==(E|0))if((S|0)==(U|0)){a[q>>0]=48;Da=q}else Da=S;else if(S>>>0>m>>>0){oe(m|0,48,S-n|0)|0;$=S;while(1){V=$+-1|0;if(V>>>0>m>>>0)$=V;else{Da=V;break}}}else Da=S;nc(b,Da,T-Da|0);u=u+4|0}while(u>>>0<=I>>>0);if(!((h&8|0)==0&(G^1)))nc(b,5710,1);if(u>>>0<ta>>>0&(za|0)>0){I=za;T=u;while(1){q=sc(c[T>>2]|0,0,U)|0;if(q>>>0>m>>>0){oe(m|0,48,q-n|0)|0;E=q;while(1){L=E+-1|0;if(L>>>0>m>>>0)E=L;else{Ea=L;break}}}else Ea=q;nc(b,Ea,(I|0)<9?I:9);T=T+4|0;E=I+-9|0;if(!(T>>>0<ta>>>0&(I|0)>9)){Fa=E;break}else I=E}}else Fa=za;uc(b,48,Fa+9|0,9,0)}else{I=ua?ta:sa+4|0;if(sa>>>0<I>>>0&(za|0)>-1){T=m+9|0;U=(h&8|0)==0;u=T;G=0-n|0;E=m+8|0;S=za;L=sa;while(1){A=sc(c[L>>2]|0,0,T)|0;if((A|0)==(T|0)){a[E>>0]=48;Ga=E}else Ga=A;do if((L|0)==(sa|0)){A=Ga+1|0;nc(b,Ga,1);if(U&(S|0)<1){Ha=A;break}nc(b,5710,1);Ha=A}else{if(Ga>>>0<=m>>>0){Ha=Ga;break}oe(m|0,48,Ga+G|0)|0;A=Ga;while(1){K=A+-1|0;if(K>>>0>m>>>0)A=K;else{Ha=K;break}}}while(0);q=u-Ha|0;nc(b,Ha,(S|0)>(q|0)?q:S);A=S-q|0;L=L+4|0;if(!(L>>>0<I>>>0&(A|0)>-1)){Ia=A;break}else S=A}}else Ia=za;uc(b,48,Ia+18|0,18,0);nc(b,Aa,p-Aa|0)}uc(b,32,f,C,h^8192);B=C}while(0);ma=j;return ((B|0)<(f|0)?f:B)|0}function xc(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;v(c[h+4>>2]|0);return b|0}function yc(a,b){a=+a;b=b|0;return +(+zc(a,b))}function zc(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=ke(d|0,e|0,52)|0;w()|0;switch(f&2047){case 0:{if(a!=0.0){i=+zc(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function Ac(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(Bc()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(Vb()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(Vb()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function Bc(){return Zb()|0}function Cc(){return Zb()|0}function Dc(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return Ec(j,c[e+20>>2]|0)|0}function Ec(a,b){a=a|0;b=b|0;return hc(a,b)|0}function Fc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function Gc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=ma;ma=ma+48|0;f=e+32|0;g=e+16|0;h=e;if(!(b&4194368))i=0;else{c[h>>2]=d;d=(c[h>>2]|0)+(4-1)&~(4-1);j=c[d>>2]|0;c[h>>2]=d+4;i=j}c[g>>2]=a;c[g+4>>2]=b|32768;c[g+8>>2]=i;i=W(5,g|0)|0;if(!((b&524288|0)==0|(i|0)<0)){c[f>>2]=i;c[f+4>>2]=2;c[f+8>>2]=1;U(221,f|0)|0}f=Ub(i)|0;ma=e;return f|0}function Hc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=ma;ma=ma+16|0;f=e;c[f>>2]=a;c[f+4>>2]=b;c[f+8>>2]=d;d=Ub(V(3,f|0)|0)|0;ma=e;return d|0}function Ic(a,b){a=a|0;b=b|0;var d=0,e=0;d=ma;ma=ma+16|0;e=d;c[e>>2]=b;b=lc(c[870]|0,a,e)|0;ma=d;return b|0}function Jc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(dc(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=ec(d,b)|0;cc(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=ec(d,b)|0}while(0);return j|0}function Kc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[870]|0;if((c[d+76>>2]|0)>-1)e=dc(d)|0;else e=0;do if((ac(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(ec(d,10)|0)>>31}while(0);if(e|0)cc(d);return f|0}function Lc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0;b=ma;ma=ma+16|0;d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[2549]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=10236+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[2549]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;ma=b;return o|0}m=c[2551]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=10236+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[2549]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[2554]|0;h=m>>>3;l=10236+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[2549]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[2551]=j;c[2554]=k;o=f;ma=b;return o|0}f=c[2550]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[10500+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;y=u}}else{x=k;y=j}j=x;k=y;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){z=j+16|0;A=c[z>>2]|0;if(!A)break;else{B=A;C=z}}else{B=v;C=u}j=B;k=C}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=10500+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[2550]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[2554]|0;s=m>>>3;l=10236+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[2549]=u|g;D=l;E=l+8|0}else{u=l+8|0;D=c[u>>2]|0;E=u}c[E>>2]=f;c[D+12>>2]=f;c[f+8>>2]=D;c[f+12>>2]=l}c[2551]=n;c[2554]=i}o=h+8|0;ma=b;return o|0}else F=e}else F=e}else F=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[2550]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)G=31;else{l=(v+1048320|0)>>>16&8;z=v<<l;v=(z+520192|0)>>>16&4;A=z<<v;z=(A+245760|0)>>>16&2;H=14-(v|l|z)+(A<<z>>>15)|0;G=f>>>(H+7|0)&1|H<<1}else G=0;H=c[10500+(G<<2)>>2]|0;a:do if(!H){I=0;J=0;K=s;L=61}else{z=0;A=s;l=H;v=f<<((G|0)==31?0:25-(G>>>1)|0);M=0;while(1){N=(c[l+4>>2]&-8)-f|0;if(N>>>0<A>>>0)if(!N){O=l;P=0;Q=l;L=65;break a}else{R=l;S=N}else{R=z;S=A}N=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;T=(N|0)==0|(N|0)==(l|0)?M:N;if(!l){I=T;J=R;K=S;L=61;break}else{z=R;A=S;v=v<<1;M=T}}}while(0);if((L|0)==61){if((I|0)==0&(J|0)==0){H=2<<G;s=(H|0-H)&u;if(!s){F=f;break}H=(s&0-s)+-1|0;s=H>>>12&16;e=H>>>s;H=e>>>5&8;h=e>>>H;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;U=0;V=c[10500+((H|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{U=J;V=I}if(!V){W=U;X=K}else{O=U;P=K;Q=V;L=65}}if((L|0)==65){i=O;n=P;h=Q;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;H=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Y=c[h+20>>2]|0;else Y=s;if(!Y){W=e;X=H;break}else{i=e;n=H;h=Y}}}if(((W|0)!=0?X>>>0<((c[2551]|0)-f|0)>>>0:0)?(h=W+f|0,h>>>0>W>>>0):0){n=c[W+24>>2]|0;i=c[W+12>>2]|0;do if((i|0)==(W|0)){H=W+20|0;e=c[H>>2]|0;if(!e){s=W+16|0;g=c[s>>2]|0;if(!g){Z=0;break}else{_=g;$=s}}else{_=e;$=H}H=_;e=$;while(1){s=H+20|0;g=c[s>>2]|0;if(!g){m=H+16|0;M=c[m>>2]|0;if(!M)break;else{aa=M;ba=m}}else{aa=g;ba=s}H=aa;e=ba}c[e>>2]=0;Z=H}else{s=c[W+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;Z=i}while(0);do if(n){i=c[W+28>>2]|0;s=10500+(i<<2)|0;if((W|0)==(c[s>>2]|0)){c[s>>2]=Z;if(!Z){s=u&~(1<<i);c[2550]=s;ca=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(W|0)?s:n+20|0)>>2]=Z;if(!Z){ca=u;break}}c[Z+24>>2]=n;s=c[W+16>>2]|0;if(s|0){c[Z+16>>2]=s;c[s+24>>2]=Z}s=c[W+20>>2]|0;if(s){c[Z+20>>2]=s;c[s+24>>2]=Z;ca=u}else ca=u}else ca=u;while(0);b:do if(X>>>0<16){u=X+f|0;c[W+4>>2]=u|3;n=W+u+4|0;c[n>>2]=c[n>>2]|1}else{c[W+4>>2]=f|3;c[h+4>>2]=X|1;c[h+X>>2]=X;n=X>>>3;if(X>>>0<256){u=10236+(n<<1<<2)|0;s=c[2549]|0;i=1<<n;if(!(s&i)){c[2549]=s|i;da=u;ea=u+8|0}else{i=u+8|0;da=c[i>>2]|0;ea=i}c[ea>>2]=h;c[da+12>>2]=h;c[h+8>>2]=da;c[h+12>>2]=u;break}u=X>>>8;if(u)if(X>>>0>16777215)fa=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;fa=X>>>(g+7|0)&1|g<<1}else fa=0;g=10500+(fa<<2)|0;c[h+28>>2]=fa;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<fa;if(!(ca&s)){c[2550]=ca|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(X|0))ga=s;else{g=X<<((fa|0)==31?0:25-(fa>>>1)|0);n=s;while(1){ha=n+16+(g>>>31<<2)|0;i=c[ha>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(X|0)){ga=i;break c}else{g=g<<1;n=i}}c[ha>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ga+8|0;H=c[s>>2]|0;c[H+12>>2]=h;c[s>>2]=h;c[h+8>>2]=H;c[h+12>>2]=ga;c[h+24>>2]=0}while(0);o=W+8|0;ma=b;return o|0}else F=f}else F=f}else F=-1;while(0);W=c[2551]|0;if(W>>>0>=F>>>0){ga=W-F|0;ha=c[2554]|0;if(ga>>>0>15){X=ha+F|0;c[2554]=X;c[2551]=ga;c[X+4>>2]=ga|1;c[ha+W>>2]=ga;c[ha+4>>2]=F|3}else{c[2551]=0;c[2554]=0;c[ha+4>>2]=W|3;ga=ha+W+4|0;c[ga>>2]=c[ga>>2]|1}o=ha+8|0;ma=b;return o|0}ha=c[2552]|0;if(ha>>>0>F>>>0){ga=ha-F|0;c[2552]=ga;W=c[2555]|0;X=W+F|0;c[2555]=X;c[X+4>>2]=ga|1;c[W+4>>2]=F|3;o=W+8|0;ma=b;return o|0}if(!(c[2667]|0)){c[2669]=4096;c[2668]=4096;c[2670]=-1;c[2671]=-1;c[2672]=0;c[2660]=0;c[2667]=d&-16^1431655768;ia=4096}else ia=c[2669]|0;d=F+48|0;W=F+47|0;ga=ia+W|0;X=0-ia|0;ia=ga&X;if(ia>>>0<=F>>>0){o=0;ma=b;return o|0}fa=c[2659]|0;if(fa|0?(ca=c[2657]|0,da=ca+ia|0,da>>>0<=ca>>>0|da>>>0>fa>>>0):0){o=0;ma=b;return o|0}d:do if(!(c[2660]&4)){fa=c[2555]|0;e:do if(fa){da=10644;while(1){ca=c[da>>2]|0;if(ca>>>0<=fa>>>0?(ca+(c[da+4>>2]|0)|0)>>>0>fa>>>0:0)break;ca=c[da+8>>2]|0;if(!ca){L=128;break e}else da=ca}ca=ga-ha&X;if(ca>>>0<2147483647){ea=pe(ca|0)|0;if((ea|0)==((c[da>>2]|0)+(c[da+4>>2]|0)|0))if((ea|0)==(-1|0))ja=ca;else{ka=ca;la=ea;L=145;break d}else{na=ea;oa=ca;L=136}}else ja=0}else L=128;while(0);do if((L|0)==128){fa=pe(0)|0;if((fa|0)!=(-1|0)?(f=fa,ca=c[2668]|0,ea=ca+-1|0,Z=((ea&f|0)==0?0:(ea+f&0-ca)-f|0)+ia|0,f=c[2657]|0,ca=Z+f|0,Z>>>0>F>>>0&Z>>>0<2147483647):0){ea=c[2659]|0;if(ea|0?ca>>>0<=f>>>0|ca>>>0>ea>>>0:0){ja=0;break}ea=pe(Z|0)|0;if((ea|0)==(fa|0)){ka=Z;la=fa;L=145;break d}else{na=ea;oa=Z;L=136}}else ja=0}while(0);do if((L|0)==136){Z=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ja=0;break}else{ka=oa;la=na;L=145;break d}ea=c[2669]|0;fa=W-oa+ea&0-ea;if(fa>>>0>=2147483647){ka=oa;la=na;L=145;break d}if((pe(fa|0)|0)==(-1|0)){pe(Z|0)|0;ja=0;break}else{ka=fa+oa|0;la=na;L=145;break d}}while(0);c[2660]=c[2660]|4;pa=ja;L=143}else{pa=0;L=143}while(0);if(((L|0)==143?ia>>>0<2147483647:0)?(ja=pe(ia|0)|0,ia=pe(0)|0,na=ia-ja|0,oa=na>>>0>(F+40|0)>>>0,!((ja|0)==(-1|0)|oa^1|ja>>>0<ia>>>0&((ja|0)!=(-1|0)&(ia|0)!=(-1|0))^1)):0){ka=oa?na:pa;la=ja;L=145}if((L|0)==145){ja=(c[2657]|0)+ka|0;c[2657]=ja;if(ja>>>0>(c[2658]|0)>>>0)c[2658]=ja;ja=c[2555]|0;f:do if(ja){pa=10644;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((la|0)==(qa+ra|0)){L=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((L|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?la>>>0>ja>>>0&qa>>>0<=ja>>>0:0){c[na>>2]=ra+ka;na=(c[2552]|0)+ka|0;oa=ja+8|0;ia=(oa&7|0)==0?0:0-oa&7;oa=ja+ia|0;W=na-ia|0;c[2555]=oa;c[2552]=W;c[oa+4>>2]=W|1;c[ja+na+4>>2]=40;c[2556]=c[2671];break}if(la>>>0<(c[2553]|0)>>>0)c[2553]=la;na=la+ka|0;W=10644;while(1){if((c[W>>2]|0)==(na|0)){L=162;break}oa=c[W+8>>2]|0;if(!oa)break;else W=oa}if((L|0)==162?(c[W+12>>2]&8|0)==0:0){c[W>>2]=la;pa=W+4|0;c[pa>>2]=(c[pa>>2]|0)+ka;pa=la+8|0;oa=la+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ia=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+F|0;d=ia-oa-F|0;c[oa+4>>2]=F|3;g:do if((ja|0)==(ia|0)){X=(c[2552]|0)+d|0;c[2552]=X;c[2555]=pa;c[pa+4>>2]=X|1}else{if((c[2554]|0)==(ia|0)){X=(c[2551]|0)+d|0;c[2551]=X;c[2554]=pa;c[pa+4>>2]=X|1;c[pa+X>>2]=X;break}X=c[ia+4>>2]|0;if((X&3|0)==1){ha=X&-8;ga=X>>>3;h:do if(X>>>0<256){fa=c[ia+8>>2]|0;Z=c[ia+12>>2]|0;if((Z|0)==(fa|0)){c[2549]=c[2549]&~(1<<ga);break}else{c[fa+12>>2]=Z;c[Z+8>>2]=fa;break}}else{fa=c[ia+24>>2]|0;Z=c[ia+12>>2]|0;do if((Z|0)==(ia|0)){ea=ia+16|0;ca=ea+4|0;f=c[ca>>2]|0;if(!f){ba=c[ea>>2]|0;if(!ba){sa=0;break}else{ta=ba;ua=ea}}else{ta=f;ua=ca}ca=ta;f=ua;while(1){ea=ca+20|0;ba=c[ea>>2]|0;if(!ba){aa=ca+16|0;$=c[aa>>2]|0;if(!$)break;else{va=$;wa=aa}}else{va=ba;wa=ea}ca=va;f=wa}c[f>>2]=0;sa=ca}else{ea=c[ia+8>>2]|0;c[ea+12>>2]=Z;c[Z+8>>2]=ea;sa=Z}while(0);if(!fa)break;Z=c[ia+28>>2]|0;n=10500+(Z<<2)|0;do if((c[n>>2]|0)!=(ia|0)){ea=fa+16|0;c[((c[ea>>2]|0)==(ia|0)?ea:fa+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[2550]=c[2550]&~(1<<Z);break h}while(0);c[sa+24>>2]=fa;Z=ia+16|0;n=c[Z>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[Z+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ia+ha|0;ya=ha+d|0}else{xa=ia;ya=d}ga=xa+4|0;c[ga>>2]=c[ga>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ga=ya>>>3;if(ya>>>0<256){X=10236+(ga<<1<<2)|0;da=c[2549]|0;n=1<<ga;if(!(da&n)){c[2549]=da|n;za=X;Aa=X+8|0}else{n=X+8|0;za=c[n>>2]|0;Aa=n}c[Aa>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=X;break}X=ya>>>8;do if(!X)Ba=0;else{if(ya>>>0>16777215){Ba=31;break}n=(X+1048320|0)>>>16&8;da=X<<n;ga=(da+520192|0)>>>16&4;Z=da<<ga;da=(Z+245760|0)>>>16&2;ea=14-(ga|n|da)+(Z<<da>>>15)|0;Ba=ya>>>(ea+7|0)&1|ea<<1}while(0);X=10500+(Ba<<2)|0;c[pa+28>>2]=Ba;ha=pa+16|0;c[ha+4>>2]=0;c[ha>>2]=0;ha=c[2550]|0;ea=1<<Ba;if(!(ha&ea)){c[2550]=ha|ea;c[X>>2]=pa;c[pa+24>>2]=X;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}ea=c[X>>2]|0;i:do if((c[ea+4>>2]&-8|0)==(ya|0))Ca=ea;else{X=ya<<((Ba|0)==31?0:25-(Ba>>>1)|0);ha=ea;while(1){Da=ha+16+(X>>>31<<2)|0;da=c[Da>>2]|0;if(!da)break;if((c[da+4>>2]&-8|0)==(ya|0)){Ca=da;break i}else{X=X<<1;ha=da}}c[Da>>2]=pa;c[pa+24>>2]=ha;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);ea=Ca+8|0;X=c[ea>>2]|0;c[X+12>>2]=pa;c[ea>>2]=pa;c[pa+8>>2]=X;c[pa+12>>2]=Ca;c[pa+24>>2]=0}while(0);o=oa+8|0;ma=b;return o|0}pa=10644;while(1){d=c[pa>>2]|0;if(d>>>0<=ja>>>0?(Ea=d+(c[pa+4>>2]|0)|0,Ea>>>0>ja>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ea+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ja+16|0;pa=d>>>0<oa>>>0?ja:d;d=pa+8|0;ia=ka+-40|0;na=la+8|0;W=(na&7|0)==0?0:0-na&7;na=la+W|0;X=ia-W|0;c[2555]=na;c[2552]=X;c[na+4>>2]=X|1;c[la+ia+4>>2]=40;c[2556]=c[2671];ia=pa+4|0;c[ia>>2]=27;c[d>>2]=c[2661];c[d+4>>2]=c[2662];c[d+8>>2]=c[2663];c[d+12>>2]=c[2664];c[2661]=la;c[2662]=ka;c[2664]=0;c[2663]=d;d=pa+24|0;do{X=d;d=d+4|0;c[d>>2]=7}while((X+8|0)>>>0<Ea>>>0);if((pa|0)!=(ja|0)){d=pa-ja|0;c[ia>>2]=c[ia>>2]&-2;c[ja+4>>2]=d|1;c[pa>>2]=d;X=d>>>3;if(d>>>0<256){na=10236+(X<<1<<2)|0;W=c[2549]|0;ea=1<<X;if(!(W&ea)){c[2549]=W|ea;Fa=na;Ga=na+8|0}else{ea=na+8|0;Fa=c[ea>>2]|0;Ga=ea}c[Ga>>2]=ja;c[Fa+12>>2]=ja;c[ja+8>>2]=Fa;c[ja+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ha=31;else{ea=(na+1048320|0)>>>16&8;W=na<<ea;na=(W+520192|0)>>>16&4;X=W<<na;W=(X+245760|0)>>>16&2;fa=14-(na|ea|W)+(X<<W>>>15)|0;Ha=d>>>(fa+7|0)&1|fa<<1}else Ha=0;fa=10500+(Ha<<2)|0;c[ja+28>>2]=Ha;c[ja+20>>2]=0;c[oa>>2]=0;W=c[2550]|0;X=1<<Ha;if(!(W&X)){c[2550]=W|X;c[fa>>2]=ja;c[ja+24>>2]=fa;c[ja+12>>2]=ja;c[ja+8>>2]=ja;break}X=c[fa>>2]|0;j:do if((c[X+4>>2]&-8|0)==(d|0))Ia=X;else{fa=d<<((Ha|0)==31?0:25-(Ha>>>1)|0);W=X;while(1){Ja=W+16+(fa>>>31<<2)|0;ea=c[Ja>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(d|0)){Ia=ea;break j}else{fa=fa<<1;W=ea}}c[Ja>>2]=ja;c[ja+24>>2]=W;c[ja+12>>2]=ja;c[ja+8>>2]=ja;break f}while(0);d=Ia+8|0;X=c[d>>2]|0;c[X+12>>2]=ja;c[d>>2]=ja;c[ja+8>>2]=X;c[ja+12>>2]=Ia;c[ja+24>>2]=0}}else{X=c[2553]|0;if((X|0)==0|la>>>0<X>>>0)c[2553]=la;c[2661]=la;c[2662]=ka;c[2664]=0;c[2558]=c[2667];c[2557]=-1;c[2562]=10236;c[2561]=10236;c[2564]=10244;c[2563]=10244;c[2566]=10252;c[2565]=10252;c[2568]=10260;c[2567]=10260;c[2570]=10268;c[2569]=10268;c[2572]=10276;c[2571]=10276;c[2574]=10284;c[2573]=10284;c[2576]=10292;c[2575]=10292;c[2578]=10300;c[2577]=10300;c[2580]=10308;c[2579]=10308;c[2582]=10316;c[2581]=10316;c[2584]=10324;c[2583]=10324;c[2586]=10332;c[2585]=10332;c[2588]=10340;c[2587]=10340;c[2590]=10348;c[2589]=10348;c[2592]=10356;c[2591]=10356;c[2594]=10364;c[2593]=10364;c[2596]=10372;c[2595]=10372;c[2598]=10380;c[2597]=10380;c[2600]=10388;c[2599]=10388;c[2602]=10396;c[2601]=10396;c[2604]=10404;c[2603]=10404;c[2606]=10412;c[2605]=10412;c[2608]=10420;c[2607]=10420;c[2610]=10428;c[2609]=10428;c[2612]=10436;c[2611]=10436;c[2614]=10444;c[2613]=10444;c[2616]=10452;c[2615]=10452;c[2618]=10460;c[2617]=10460;c[2620]=10468;c[2619]=10468;c[2622]=10476;c[2621]=10476;c[2624]=10484;c[2623]=10484;X=ka+-40|0;d=la+8|0;oa=(d&7|0)==0?0:0-d&7;d=la+oa|0;pa=X-oa|0;c[2555]=d;c[2552]=pa;c[d+4>>2]=pa|1;c[la+X+4>>2]=40;c[2556]=c[2671]}while(0);la=c[2552]|0;if(la>>>0>F>>>0){ka=la-F|0;c[2552]=ka;la=c[2555]|0;ja=la+F|0;c[2555]=ja;c[ja+4>>2]=ka|1;c[la+4>>2]=F|3;o=la+8|0;ma=b;return o|0}}c[(Vb()|0)>>2]=12;o=0;ma=b;return o|0}function Mc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[2553]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[2554]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[2551]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[2549]=c[2549]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=10500+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[2550]=c[2550]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[2555]|0)==(f|0)){r=(c[2552]|0)+m|0;c[2552]=r;c[2555]=l;c[l+4>>2]=r|1;if((l|0)!=(c[2554]|0))return;c[2554]=0;c[2551]=0;return}if((c[2554]|0)==(f|0)){r=(c[2551]|0)+m|0;c[2551]=r;c[2554]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[2549]=c[2549]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=10500+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[2550]=c[2550]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[2554]|0)){c[2551]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=10236+(m<<1<<2)|0;a=c[2549]|0;b=1<<m;if(!(a&b)){c[2549]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=10500+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[2550]|0;b=1<<G;a:do if(!(F&b)){c[2550]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[2557]|0)+-1|0;c[2557]=l;if(l|0)return;l=10652;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[2557]=-1;return}function Nc(a){a=a|0;return}function Oc(a){a=a|0;Nc(a);Wc(a);return}function Pc(a){a=a|0;return 5712}function Qc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0;b=ma;ma=ma+16|0;d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(Rc(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(s(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(s(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(s(r,q)|0)){r=l+12|0;t=(k>>>0)/(r>>>0)|0;if(t>>>0>=r>>>0)if((k|0)!=(s(t,r)|0)){t=l+16|0;u=(k>>>0)/(t>>>0)|0;if(u>>>0>=t>>>0)if((k|0)!=(s(u,t)|0)){u=l+18|0;v=(k>>>0)/(u>>>0)|0;if(v>>>0>=u>>>0)if((k|0)!=(s(v,u)|0)){v=l+22|0;w=(k>>>0)/(v>>>0)|0;if(w>>>0>=v>>>0)if((k|0)!=(s(w,v)|0)){w=l+28|0;x=(k>>>0)/(w>>>0)|0;if(x>>>0>=w>>>0)if((k|0)==(s(x,w)|0)){y=w;z=9;A=n}else{x=l+30|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+36|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+40|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+42|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+46|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+52|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+58|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+60|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+66|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+70|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+72|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+78|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+82|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+88|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+96|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+100|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+102|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+106|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+108|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+112|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+120|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+126|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+130|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+136|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+138|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+142|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+148|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+150|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+156|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+162|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+166|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+168|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+172|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+178|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+180|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+186|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+190|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+192|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+196|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+198|0;B=(k>>>0)/(x>>>0)|0;if(B>>>0<x>>>0){y=x;z=1;A=k;break}if((k|0)==(s(B,x)|0)){y=x;z=9;A=n;break}x=l+208|0;B=(k>>>0)/(x>>>0)|0;C=B>>>0<x>>>0;D=(k|0)==(s(B,x)|0);y=C|D?x:l+210|0;z=C?1:D?9:0;A=C?k:n}else{y=w;z=1;A=k}}else{y=v;z=9;A=n}else{y=v;z=1;A=k}}else{y=u;z=9;A=n}else{y=u;z=1;A=k}}else{y=t;z=9;A=n}else{y=t;z=1;A=k}}else{y=r;z=9;A=n}else{y=r;z=1;A=k}}else{y=q;z=9;A=n}else{y=q;z=1;A=k}}else{y=l;z=9;A=n}else{y=l;z=1;A=k}while(0);switch(z&15){case 9:{p=A;break b;break}case 0:{l=y;n=A;break}default:break c}}if(!z)p=A;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;E=k;break}else if((m|0)==108){c[e>>2]=k;E=A;break}}else E=c[(Rc(2400,2592,e,d)|0)>>2]|0;while(0);ma=b;return E|0}function Rc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function Sc(a){a=a|0;return}function Tc(a,b){a=a|0;b=b|0;return 0}function Uc(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))ua[c[(c[a>>2]|0)+16>>2]&31](a);return}function Vc(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=Lc(b)|0;if(a|0){c=a;break}a=ae()|0;if(!a){c=0;break}ta[a&3]()}return c|0}function Wc(a){a=a|0;Mc(a);return}function Xc(b,d){b=b|0;d=d|0;var e=0,f=0,g=0;e=ma;ma=ma+16|0;f=e;g=Gc((a[d+11>>0]|0)<0?c[d>>2]|0:d,0,f)|0;c[b>>2]=g;if((g|0)<0){g=c[(Vb()|0)>>2]|0;kd(f,5818,d);ld(g,(a[f+11>>0]|0)<0?c[f>>2]|0:f)}else{ma=e;return}}function Yc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=ma;ma=ma+16|0;d=b;e=4;f=d;a:while(1){if(!e){g=9;break}b:while(1){h=Hc(c[a>>2]|0,f,e)|0;switch(h|0){case 0:{g=5;break a;break}case -1:break;default:break b}if((c[(Vb()|0)>>2]|0)!=4){g=7;break a}}e=e-h|0;f=f+h|0}if((g|0)==5)ld(61,5848);else if((g|0)==7)ld(c[(Vb()|0)>>2]|0,5870);else if((g|0)==9){ma=b;return c[d>>2]|0}return 0}function Zc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=$b(b)|0;e=Vc(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=_c(e)|0;ne(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function _c(a){a=a|0;return a+12|0}function $c(a,b){a=a|0;b=b|0;c[a>>2]=3964;Zc(a+4|0,b);return}function ad(a){a=a|0;return 1}function bd(a){a=a|0;Z()}function cd(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)dd(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function dd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=ma;ma=ma+16|0;g=f;if(e>>>0>4294967279)bd(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=Vc(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}ed(h,d,e)|0;a[g>>0]=0;fd(h+e|0,g);ma=f;return}function ed(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)ne(a|0,b|0,c|0)|0;return a|0}function fd(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function gd(a){a=a|0;return $b(a)|0}function hd(b,d,e,f,g,h,i,j){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0;k=ma;ma=ma+16|0;l=k;if((-18-d|0)>>>0<e>>>0)bd(b);if((a[b+11>>0]|0)<0)m=c[b>>2]|0;else m=b;if(d>>>0<2147483623){n=e+d|0;e=d<<1;o=n>>>0<e>>>0?e:n;p=o>>>0<11?11:o+16&-16}else p=-17;o=Vc(p)|0;if(g|0)ed(o,m,g)|0;if(i|0)ed(o+g|0,j,i)|0;j=f-h|0;f=j-g|0;if(f|0)ed(o+g+i|0,m+g+h|0,f)|0;if((d|0)!=10)Wc(m);c[b>>2]=o;c[b+8>>2]=p|-2147483648;p=j+i|0;c[b+4>>2]=p;a[l>>0]=0;fd(o+p|0,l);ma=k;return}function id(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=ma;ma=ma+16|0;g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j){k=(c[b+8>>2]&2147483647)+-1|0;l=c[b+4>>2]|0}else{k=10;l=i&255}if((k-l|0)>>>0>=e>>>0){if(e|0){if(j)m=c[b>>2]|0;else m=b;ed(m+l|0,d,e)|0;j=l+e|0;if((a[h>>0]|0)<0)c[b+4>>2]=j;else a[h>>0]=j;a[g>>0]=0;fd(m+j|0,g)}}else hd(b,k,l+e-k|0,l,l,0,e,d);ma=f;return b|0}function jd(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0;g=ma;ma=ma+16|0;h=g;if(f>>>0>4294967279)bd(b);if(f>>>0<11){a[b+11>>0]=e;i=b}else{j=f+16&-16;f=Vc(j)|0;c[b>>2]=f;c[b+8>>2]=j|-2147483648;c[b+4>>2]=e;i=f}ed(i,d,e)|0;a[h>>0]=0;fd(i+e|0,h);ma=g;return}function kd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;f=0;while(1){if((f|0)==3)break;c[b+(f<<2)>>2]=0;f=f+1|0}f=gd(d)|0;g=e+11|0;h=a[g>>0]|0;i=h<<24>>24<0?c[e+4>>2]|0:h&255;jd(b,d,f,i+f|0);id(b,(a[g>>0]|0)<0?c[e>>2]|0:e,i)|0;return}function ld(a,b){a=a|0;b=b|0;Z()}function md(a){a=a|0;Z()}function nd(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=ma;ma=ma+48|0;b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=od()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=6044;pd(5994,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(sa[c[(c[744]|0)+16>>2]&7](2976,k,g)|0){k=c[g>>2]|0;g=pa[c[(c[k>>2]|0)+8>>2]&7](k)|0;c[f>>2]=6044;c[f+4>>2]=h;c[f+8>>2]=g;pd(5908,f)}else{c[e>>2]=6044;c[e+4>>2]=h;pd(5953,e)}}pd(6032,b)}function od(){var a=0,b=0;a=ma;ma=ma+16|0;if(!(ja(10692,3)|0)){b=ha(c[2674]|0)|0;ma=a;return b|0}else pd(6183,a);return 0}function pd(a,b){a=a|0;b=b|0;var d=0,e=0;d=ma;ma=ma+16|0;e=d;c[e>>2]=b;b=c[838]|0;lc(b,a,e)|0;Jc(10,b)|0;Z()}function qd(a){a=a|0;return}function rd(a){a=a|0;qd(a);Wc(a);return}function sd(a){a=a|0;return}function td(a){a=a|0;return}function ud(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=ma;ma=ma+64|0;f=e;if(!(yd(a,b,0)|0))if((b|0)!=0?(g=Cd(b,3e3,2984,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;xa[c[(c[g>>2]|0)+28>>2]&7](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;ma=e;return j|0}function vd(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(yd(a,c[b+8>>2]|0,g)|0)Bd(0,b,d,e,f);return}function wd(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(yd(b,c[d+8>>2]|0,g)|0)){if(yd(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else Ad(0,d,e,f);while(0);return}function xd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(yd(a,c[b+8>>2]|0,0)|0)zd(0,b,d,e);return}function yd(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function zd(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function Ad(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function Bd(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function Cd(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=ma;ma=ma+64|0;i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(yd(l,f,0)|0){c[i+48>>2]=1;za[c[(c[l>>2]|0)+20>>2]&7](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{ya[c[(c[l>>2]|0)+24>>2]&3](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);ma=h;return q|0}function Dd(a){a=a|0;qd(a);Wc(a);return}function Ed(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(yd(a,c[b+8>>2]|0,g)|0)Bd(0,b,d,e,f);else{h=c[a+8>>2]|0;za[c[(c[h>>2]|0)+20>>2]&7](h,b,d,e,f,g)}return}function Fd(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(yd(b,c[d+8>>2]|0,g)|0)){if(!(yd(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;ya[c[(c[h>>2]|0)+24>>2]&3](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;za[c[(c[l>>2]|0)+20>>2]&7](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else Ad(0,d,e,f);while(0);return}function Gd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(yd(a,c[b+8>>2]|0,0)|0)zd(0,b,d,e);else{f=c[a+8>>2]|0;xa[c[(c[f>>2]|0)+28>>2]&7](f,b,d,e)}return}function Hd(a){a=a|0;return}function Id(){var a=0;a=ma;ma=ma+16|0;if(!(ia(10696,27)|0)){ma=a;return}else pd(6232,a)}function Jd(a){a=a|0;var b=0;b=ma;ma=ma+16|0;Mc(a);if(!(ka(c[2674]|0,0)|0)){ma=b;return}else pd(6282,b)}function Kd(){var a=0,b=0;a=od()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)Ld(c[b+12>>2]|0);Ld(Md()|0)}function Ld(a){a=a|0;var b=0;b=ma;ma=ma+16|0;ta[a&3]();pd(6335,b)}function Md(){var a=0;a=c[968]|0;c[968]=a+0;return a|0}function Nd(a){a=a|0;return}function Od(a){a=a|0;c[a>>2]=3964;Sd(a+4|0);return}function Pd(a){a=a|0;Od(a);Wc(a);return}function Qd(a){a=a|0;return Rd(a+4|0)|0}function Rd(a){a=a|0;return c[a>>2]|0}function Sd(a){a=a|0;var b=0,d=0;if(ad(a)|0?(b=Td(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)Wc(b);return}function Td(a){a=a|0;return a+-12|0}function Ud(a){a=a|0;Od(a);Wc(a);return}function Vd(a){a=a|0;qd(a);Wc(a);return}function Wd(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(yd(b,c[d+8>>2]|0,h)|0)Bd(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;_d(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;_d(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function Xd(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(yd(b,c[d+8>>2]|0,g)|0)){if(!(yd(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;$d(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;$d(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;$d(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;$d(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;_d(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else Ad(0,d,e,f);while(0);return}function Yd(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(yd(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;Zd(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{Zd(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else zd(0,d,e,f);while(0);return}function Zd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;xa[c[(c[g>>2]|0)+28>>2]&7](g,b,d+h|0,(f&2|0)==0?2:e);return}function _d(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;za[c[(c[i>>2]|0)+20>>2]&7](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function $d(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;ya[c[(c[h>>2]|0)+24>>2]&3](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function ae(){var a=0;a=c[2675]|0;c[2675]=a+0;return a|0}function be(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=ma;ma=ma+16|0;f=e;c[f>>2]=c[d>>2];g=sa[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];ma=e;return g&1|0}function ce(a){a=a|0;var b=0;if(!a)b=0;else b=(Cd(a,3e3,3088,0)|0)!=0&1;return b|0}function de(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=s(d,c)|0;f=a>>>16;a=(e>>>16)+(s(d,f)|0)|0;d=b>>>16;b=s(d,c)|0;return (v((a>>>16)+(s(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function ee(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=de(e,a)|0;f=w()|0;return (v((s(b,a)|0)+(s(d,e)|0)+f|f&0|0),c|0|0)|0}function fe(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (v(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function ge(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (v(e|0),a-c>>>0|0)|0}function he(a){a=a|0;return (a?31-(t(a^a-1)|0)|0:32)|0}function ie(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (v(n|0),o)|0}else{if(!m){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (v(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(t(l|0)|0)-(t(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;u=q;x=g>>>(q>>>0)&s|i<<r;y=i>>>(q>>>0)&s;z=0;A=g<<r;break}if(!f){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (v(n|0),o)|0}r=j-1|0;if(r&j|0){s=(t(j|0)|0)+33-(t(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;u=s;x=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;y=D&i>>>(s>>>0);z=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (v(n|0),o)|0}else{r=he(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (v(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (v(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (v(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((he(l|0)|0)>>>0);return (v(n|0),o)|0}r=(t(l|0)|0)-(t(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;u=s;x=i<<p|g>>>(s>>>0);y=i>>>(s>>>0);z=0;A=g<<p;break}if(!f){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (v(n|0),o)|0}while(0);if(!u){E=A;F=z;G=y;H=x;I=0;J=0}else{b=d|0|0;d=k|e&0;e=fe(b|0,d|0,-1,-1)|0;k=w()|0;h=A;A=z;z=y;y=x;x=u;u=0;do{a=h;h=A>>>31|h<<1;A=u|A<<1;g=y<<1|a>>>31|0;a=y>>>31|z<<1|0;ge(e|0,k|0,g|0,a|0)|0;i=w()|0;l=i>>31|((i|0)<0?-1:0)<<1;u=l&1;y=ge(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;z=w()|0;x=x-1|0}while((x|0)!=0);E=h;F=A;G=z;H=y;I=0;J=u}u=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(u|0)>>>31|(E|F)<<1|(F<<1|u>>>31)&0|I;o=(u<<1|0>>>31)&-2|J;return (v(n|0),o)|0}function je(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return ie(a,b,c,d,0)|0}function ke(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){v(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}v(0);return b>>>c-32|0}function le(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){v(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}v(a<<c-32|0);return 0}function me(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function ne(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){ba(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function oe(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function pe(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){la(d|0)|0;R(12);return -1}if((d|0)>($()|0)){if(!(ca(d|0)|0)){R(12);return -1}}else c[i>>2]=d;return b|0}function qe(a,b){a=a|0;b=b|0;return pa[a&7](b|0)|0}function re(a,b,c,d){a=a|0;b=b|0;c=+c;d=d|0;return qa[a&1](b|0,+c,d|0)|0}function se(a,b,c){a=a|0;b=b|0;c=c|0;return ra[a&7](b|0,c|0)|0}function te(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return sa[a&7](b|0,c|0,d|0)|0}function ue(a){a=a|0;ta[a&3]()}function ve(a,b){a=a|0;b=b|0;ua[a&31](b|0)}function we(a,b,c){a=a|0;b=b|0;c=c|0;va[a&15](b|0,c|0)}function xe(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;wa[a&3](b|0,c|0,d|0)}function ye(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;xa[a&7](b|0,c|0,d|0,e|0)}function ze(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;ya[a&3](b|0,c|0,d|0,e|0,f|0)}function Ae(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;za[a&7](b|0,c|0,d|0,e|0,f|0,g|0)}function Be(a){a=a|0;u(0);return 0}function Ce(a,b,c){a=a|0;b=+b;c=c|0;u(1);return 0}function De(a,b){a=a|0;b=b|0;u(2);return 0}function Ee(a,b,c){a=a|0;b=b|0;c=c|0;u(3);return 0}function Fe(){u(4)}function Ge(a){a=a|0;u(5)}function He(a,b){a=a|0;b=b|0;u(6)}function Ie(a,b,c){a=a|0;b=b|0;c=c|0;u(7)}function Je(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;u(8)}function Ke(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;u(9)}function Le(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;u(10)}

// EMSCRIPTEN_END_FUNCS
var pa=[Be,$a,fb,Hb,Nb,Rb,Pc,Qd];var qa=[Ce,La];var ra=[De,Xa,eb,Tc,pb,Mb,De,De];var sa=[Ee,Sb,Tb,Xb,ud,Ee,Ee,Ee];var ta=[Fe,nd,Ga,Id];var ua=[Ge,Ra,Ta,Za,_a,bb,cb,Sc,jb,kb,lb,Ob,Gb,Jb,Kb,Lb,Nc,Oc,qd,rd,sd,td,Dd,Od,Pd,Ud,Vd,Jd,Ge,Ge,Ge,Ge];var va=[He,Ma,Na,Oa,Pa,Qa,Wa,ab,ob,Ib,He,He,He,He,He,He];var wa=[Ie,Sa,Va,nb];var xa=[Je,Ua,Ya,xd,Gd,Yd,Je,Je];var ya=[Ke,wd,Fd,Xd];var za=[Le,db,vd,Ed,Wd,Le,Le,Le];return{__GLOBAL__sub_I_main_cpp:Qb,___cxa_can_catch:be,___cxa_is_pointer_type:ce,___em_js__getWindowHeight:Fa,___em_js__getWindowWidth:Ea,___errno_location:Vb,___muldi3:ee,___udivdi3:je,_bitshift64Lshr:ke,_bitshift64Shl:le,_free:Mc,_i64Add:fe,_i64Subtract:ge,_llvm_bswap_i32:me,_main:Ha,_malloc:Lc,_memcpy:ne,_memset:oe,_sbrk:pe,dynCall_ii:qe,dynCall_iidi:re,dynCall_iii:se,dynCall_iiii:te,dynCall_v:ue,dynCall_vi:ve,dynCall_vii:we,dynCall_viii:xe,dynCall_viiii:ye,dynCall_viiiii:ze,dynCall_viiiiii:Ae,establishStackSpace:Da,stackAlloc:Aa,stackRestore:Ca,stackSave:Ba}})


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

var _memset = Module["_memset"] = asm["_memset"];

var _sbrk = Module["_sbrk"] = asm["_sbrk"];

var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];

var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];

var stackRestore = Module["stackRestore"] = asm["stackRestore"];

var stackSave = Module["stackSave"] = asm["stackSave"];

var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];

var dynCall_iidi = Module["dynCall_iidi"] = asm["dynCall_iidi"];

var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];

var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];

var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];

var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];

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

