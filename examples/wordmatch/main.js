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

if (Module["ENVIRONMENT"]) {
 throw new Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)");
}

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
} else {
 throw new Error("environment detection error");
}

var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);

var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);

for (key in moduleOverrides) {
 if (moduleOverrides.hasOwnProperty(key)) {
  Module[key] = moduleOverrides[key];
 }
}

moduleOverrides = undefined;

assert(typeof Module["memoryInitializerPrefixURL"] === "undefined", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["pthreadMainPrefixURL"] === "undefined", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["cdInitializerPrefixURL"] === "undefined", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["filePackagePrefixURL"] === "undefined", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead");

var STACK_ALIGN = 16;

stackSave = stackRestore = stackAlloc = function() {
 abort("cannot use the stack before compiled code is ready to run, and has provided stack access");
};

function dynamicAlloc(size) {
 assert(DYNAMICTOP_PTR);
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
  assert(args.length == sig.length - 1);
  assert("dynCall_" + sig in Module, "bad function pointer type - no table for sig '" + sig + "'");
  return Module["dynCall_" + sig].apply(null, [ ptr ].concat(args));
 } else {
  assert(sig.length == 1);
  assert("dynCall_" + sig in Module, "bad function pointer type - no table for sig '" + sig + "'");
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
 assert(returnType !== "array", 'Return type should not be "array".');
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
  assert(type, "Must know what type to store in allocate!");
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
    if ((u0 & 248) != 240) warnOnce("Invalid UTF-8 leading byte 0x" + u0.toString(16) + " encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!");
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
   if (u >= 2097152) warnOnce("Invalid Unicode code point 0x" + u.toString(16) + " encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).");
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
 assert(typeof maxBytesToWrite == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
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
 assert(array.length >= 0, "writeArrayToMemory array must have a length (should be an array or typed array)");
 HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
 for (var i = 0; i < str.length; ++i) {
  assert(str.charCodeAt(i) === str.charCodeAt(i) & 255);
  HEAP8[buffer++ >> 0] = str.charCodeAt(i);
 }
 if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}

function demangle(func) {
 warnOnce("warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling");
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

var STACK_BASE = 12160, STACK_MAX = 5255040, DYNAMIC_BASE = 5255040, DYNAMICTOP_PTR = 11904;

assert(STACK_BASE % 16 === 0, "stack must start aligned");

assert(DYNAMIC_BASE % 16 === 0, "heap must start aligned");

var TOTAL_STACK = 5242880;

if (Module["TOTAL_STACK"]) assert(TOTAL_STACK === Module["TOTAL_STACK"], "the stack size can no longer be determined at runtime");

var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;

if (TOTAL_MEMORY < TOTAL_STACK) err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");

assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined, "JS engine does not provide full typed array support");

if (Module["buffer"]) {
 buffer = Module["buffer"];
 assert(buffer.byteLength === TOTAL_MEMORY, "provided buffer should be " + TOTAL_MEMORY + " bytes, but it is " + buffer.byteLength);
} else {
 {
  buffer = new ArrayBuffer(TOTAL_MEMORY);
 }
 assert(buffer.byteLength === TOTAL_MEMORY);
 Module["buffer"] = buffer;
}

updateGlobalBufferViews();

HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

function writeStackCookie() {
 assert((STACK_MAX & 3) == 0);
 HEAPU32[(STACK_MAX >> 2) - 1] = 34821223;
 HEAPU32[(STACK_MAX >> 2) - 2] = 2310721022;
}

function checkStackCookie() {
 if (HEAPU32[(STACK_MAX >> 2) - 1] != 34821223 || HEAPU32[(STACK_MAX >> 2) - 2] != 2310721022) {
  abort("Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x" + HEAPU32[(STACK_MAX >> 2) - 2].toString(16) + " " + HEAPU32[(STACK_MAX >> 2) - 1].toString(16));
 }
 if (HEAP32[0] !== 1668509029) throw "Runtime error: The application has corrupted its heap memory area (address zero)!";
}

function abortStackOverflow(allocSize) {
 abort("Stack overflow! Attempted to allocate " + allocSize + " bytes on the stack, but stack has only " + (STACK_MAX - stackSave() + allocSize) + " bytes available!");
}

HEAP32[0] = 1668509029;

HEAP16[1] = 25459;

if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99) throw "Runtime error: expected the system to be little-endian!";

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
 checkStackCookie();
 if (runtimeInitialized) return;
 runtimeInitialized = true;
 callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
 checkStackCookie();
 callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
 checkStackCookie();
 callRuntimeCallbacks(__ATEXIT__);
 runtimeExited = true;
}

function postRun() {
 checkStackCookie();
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

assert(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

var Math_abs = Math.abs;

var Math_ceil = Math.ceil;

var Math_floor = Math.floor;

var Math_min = Math.min;

var runDependencies = 0;

var runDependencyWatcher = null;

var dependenciesFulfilled = null;

var runDependencyTracking = {};

function getUniqueRunDependency(id) {
 var orig = id;
 while (1) {
  if (!runDependencyTracking[id]) return id;
  id = orig + Math.random();
 }
 return id;
}

function addRunDependency(id) {
 runDependencies++;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (id) {
  assert(!runDependencyTracking[id]);
  runDependencyTracking[id] = 1;
  if (runDependencyWatcher === null && typeof setInterval !== "undefined") {
   runDependencyWatcher = setInterval(function() {
    if (ABORT) {
     clearInterval(runDependencyWatcher);
     runDependencyWatcher = null;
     return;
    }
    var shown = false;
    for (var dep in runDependencyTracking) {
     if (!shown) {
      shown = true;
      err("still waiting on run dependencies:");
     }
     err("dependency: " + dep);
    }
    if (shown) {
     err("(end of list)");
    }
   }, 1e4);
  }
 } else {
  err("warning: run dependency added without ID");
 }
}

function removeRunDependency(id) {
 runDependencies--;
 if (Module["monitorRunDependencies"]) {
  Module["monitorRunDependencies"](runDependencies);
 }
 if (id) {
  assert(runDependencyTracking[id]);
  delete runDependencyTracking[id];
 } else {
  err("warning: run dependency removed without ID");
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

var tempDoublePtr = 12144;

assert(tempDoublePtr % 8 == 0);

var Engine = {
 ctx: null,
 IMAGE_FOLDER: "../../images/",
 images: {},
 init: function() {
  console.log("$Engine.init");
  var canvas = Module["canvas"];
  Engine.ctx = canvas.getContext("2d");
 },
 translateColorToCSSRGB: function(rgba) {
  var ret = "rgb(" + (rgba >>> 24) + "," + (rgba >> 16 & 255) + "," + (rgba >> 8 & 255) + ")";
  return ret;
 },
 drawImage: function(name, x, y, width, height, rgba) {
  name = UTF8ToString(name);
  var image = Engine.images[name];
  if (image === undefined) {
   image = new Image();
   image.src = Engine.IMAGE_FOLDER + name;
   Engine.images[name] = image;
   return;
  }
  if (!image.complete) {
   return;
  }
  var alphaInt = rgba & 255;
  if (alphaInt == 0) {
   return;
  }
  Engine.ctx.globalAlpha = alphaInt / 255;
  Engine.ctx.drawImage(image, x, y, width, height);
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

function _Engine_Image(name, x, y, width, height, rgba) {
 Engine.drawImage(name, x, y, width, height, rgba);
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
 if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value; else err("failed to set errno from JS");
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
     assert(position === 0, "canOwn must imply no weird position inside the file");
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

var ERRNO_MESSAGES = {
 0: "Success",
 1: "Not super-user",
 2: "No such file or directory",
 3: "No such process",
 4: "Interrupted system call",
 5: "I/O error",
 6: "No such device or address",
 7: "Arg list too long",
 8: "Exec format error",
 9: "Bad file number",
 10: "No children",
 11: "No more processes",
 12: "Not enough core",
 13: "Permission denied",
 14: "Bad address",
 15: "Block device required",
 16: "Mount device busy",
 17: "File exists",
 18: "Cross-device link",
 19: "No such device",
 20: "Not a directory",
 21: "Is a directory",
 22: "Invalid argument",
 23: "Too many open files in system",
 24: "Too many open files",
 25: "Not a typewriter",
 26: "Text file busy",
 27: "File too large",
 28: "No space left on device",
 29: "Illegal seek",
 30: "Read only file system",
 31: "Too many links",
 32: "Broken pipe",
 33: "Math arg out of domain of func",
 34: "Math result not representable",
 35: "File locking deadlock error",
 36: "File or path name too long",
 37: "No record locks available",
 38: "Function not implemented",
 39: "Directory not empty",
 40: "Too many symbolic links",
 42: "No message of desired type",
 43: "Identifier removed",
 44: "Channel number out of range",
 45: "Level 2 not synchronized",
 46: "Level 3 halted",
 47: "Level 3 reset",
 48: "Link number out of range",
 49: "Protocol driver not attached",
 50: "No CSI structure available",
 51: "Level 2 halted",
 52: "Invalid exchange",
 53: "Invalid request descriptor",
 54: "Exchange full",
 55: "No anode",
 56: "Invalid request code",
 57: "Invalid slot",
 59: "Bad font file fmt",
 60: "Device not a stream",
 61: "No data (for no delay io)",
 62: "Timer expired",
 63: "Out of streams resources",
 64: "Machine is not on the network",
 65: "Package not installed",
 66: "The object is remote",
 67: "The link has been severed",
 68: "Advertise error",
 69: "Srmount error",
 70: "Communication error on send",
 71: "Protocol error",
 72: "Multihop attempted",
 73: "Cross mount point (not really error)",
 74: "Trying to read unreadable message",
 75: "Value too large for defined data type",
 76: "Given log. name not unique",
 77: "f.d. invalid for this operation",
 78: "Remote address changed",
 79: "Can   access a needed shared lib",
 80: "Accessing a corrupted shared lib",
 81: ".lib section in a.out corrupted",
 82: "Attempting to link in too many libs",
 83: "Attempting to exec a shared library",
 84: "Illegal byte sequence",
 86: "Streams pipe error",
 87: "Too many users",
 88: "Socket operation on non-socket",
 89: "Destination address required",
 90: "Message too long",
 91: "Protocol wrong type for socket",
 92: "Protocol not available",
 93: "Unknown protocol",
 94: "Socket type not supported",
 95: "Not supported",
 96: "Protocol family not supported",
 97: "Address family not supported by protocol family",
 98: "Address already in use",
 99: "Address not available",
 100: "Network interface is not configured",
 101: "Network is unreachable",
 102: "Connection reset by network",
 103: "Connection aborted",
 104: "Connection reset by peer",
 105: "No buffer space available",
 106: "Socket is already connected",
 107: "Socket is not connected",
 108: "Can't send after socket shutdown",
 109: "Too many references",
 110: "Connection timed out",
 111: "Connection refused",
 112: "Host is down",
 113: "Host is unreachable",
 114: "Socket already connected",
 115: "Connection already in progress",
 116: "Stale file handle",
 122: "Quota exceeded",
 123: "No medium (in tape drive)",
 125: "Operation canceled",
 130: "Previous owner died",
 131: "State not recoverable"
};

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
    for (var key in ERRNO_CODES) {
     if (ERRNO_CODES[key] === errno) {
      this.code = key;
      break;
     }
    }
   };
   this.setErrno(errno);
   this.message = ERRNO_MESSAGES[errno];
   if (this.stack) Object.defineProperty(this, "stack", {
    value: new Error().stack,
    writable: true
   });
   if (this.stack) this.stack = demangleAll(this.stack);
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
  console.error("emscripten_set_main_loop_timing: Cannot set timing mode for main loop since a main loop does not exist! Call emscripten_set_main_loop first to set one up.");
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
  checkStackCookie();
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
   assert(typeof url == "string", "createObjectURL must return a url as a string");
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
    assert(typeof url == "string", "createObjectURL must return a url as a string");
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
   assert(typeof scrollX !== "undefined" && typeof scrollY !== "undefined", "Unable to retrieve scroll position, mouse positions likely broken.");
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
 checkPixelFormat: function(fmt) {
  var format = HEAP32[fmt >> 2];
  if (format != -2042224636) {
   warnOnce("Unsupported pixel format!");
  }
 },
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
  assert(tempCtx, "TTF_Init must have been called");
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
 } catch (e) {
  err("exception during cxa_free_exception: " + e);
 }
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
 throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
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
 throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
}

function ___gxx_personality_v0() {}

function ___lock() {}

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
  if (low >= 0) assert(high === 0); else assert(high === -1);
  return low;
 },
 getZero: function() {
  assert(SYSCALLS.get() === 0);
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

function ___unlock() {}

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

function _emscripten_get_now_is_monotonic() {
 return ENVIRONMENT_IS_NODE || typeof dateNow !== "undefined" || (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && self["performance"] && self["performance"]["now"];
}

function _clock_gettime(clk_id, tp) {
 var now;
 if (clk_id === 0) {
  now = Date.now();
 } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
  now = _emscripten_get_now();
 } else {
  ___setErrNo(22);
  return -1;
 }
 HEAP32[tp >> 2] = now / 1e3 | 0;
 HEAP32[tp + 4 >> 2] = now % 1e3 * 1e3 * 1e3 | 0;
 return 0;
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

var ASSERTIONS = true;

function intArrayFromString(stringy, dontAddNull, length) {
 var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
 var u8array = new Array(len);
 var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
 if (dontAddNull) u8array.length = numBytesWritten;
 return u8array;
}

var debug_table_ii = [ "0", "__ZNKSt3__210__function6__funcIZN7MatcherC1E7Vector2jRNS_6vectorI6EntityNS_9allocatorIS5_EEEEEUliiffE_NS6_ISA_EEFNS_10shared_ptrI9ComponentEEiiffEE7__cloneEv", "__ZNKSt3__210__function6__funcIZN7MatcherC1E7Vector2jRNS_6vectorI6EntityNS_9allocatorIS5_EEEEEUliiffE_NS6_ISA_EEFNS_10shared_ptrI9ComponentEEiiffEE11target_typeEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEv", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE11target_typeEv", "___stdio_close", "__ZNKSt3__217bad_function_call4whatEv", "__ZNKSt11logic_error4whatEv" ];

var debug_table_iidi = [ "0", "__ZN7Matcher4loopEdRKNSt3__26vectorIbNS0_9allocatorIbEEEE" ];

var debug_table_iii = [ "0", "__ZN9Component11getCategoryERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEE", "__ZNKSt3__210__function6__funcIZN7MatcherC1E7Vector2jRNS_6vectorI6EntityNS_9allocatorIS5_EEEEEUliiffE_NS6_ISA_EEFNS_10shared_ptrI9ComponentEEiiffEE6targetERKSt9type_info", "__ZNKSt3__219__shared_weak_count13__get_deleterERKSt9type_info", "__ZN8TextTile11getCategoryERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEE", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE6targetERKSt9type_info", "0", "0" ];

var debug_table_iiii = [ "0", "___stdio_write", "___stdio_seek", "___stdout_write", "__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv", "0", "0", "0" ];

var debug_table_v = [ "0", "__ZL25default_terminate_handlerv", "__Z9main_loopv", "__ZN10__cxxabiv112_GLOBAL__N_110construct_Ev" ];

var debug_table_vi = [ "0", "__ZN7Matcher11onFocusLostEv", "__ZN7Matcher5resetEv", "__ZNSt3__210__function6__baseIFNS_10shared_ptrI9ComponentEEiiffEED2Ev", "__ZNSt3__210__function6__funcIZN7MatcherC1E7Vector2jRNS_6vectorI6EntityNS_9allocatorIS5_EEEEEUliiffE_NS6_ISA_EEFNS_10shared_ptrI9ComponentEEiiffEED0Ev", "__ZNSt3__210__function6__funcIZN7MatcherC1E7Vector2jRNS_6vectorI6EntityNS_9allocatorIS5_EEEEEUliiffE_NS6_ISA_EEFNS_10shared_ptrI9ComponentEEiiffEE7destroyEv", "__ZNSt3__210__function6__funcIZN7MatcherC1E7Vector2jRNS_6vectorI6EntityNS_9allocatorIS5_EEEEEUliiffE_NS6_ISA_EEFNS_10shared_ptrI9ComponentEEiiffEE18destroy_deallocateEv", "__ZNSt3__220__shared_ptr_emplaceI8TextTileNS_9allocatorIS1_EEED2Ev", "__ZNSt3__220__shared_ptr_emplaceI8TextTileNS_9allocatorIS1_EEED0Ev", "__ZNSt3__220__shared_ptr_emplaceI8TextTileNS_9allocatorIS1_EEE16__on_zero_sharedEv", "__ZNSt3__220__shared_ptr_emplaceI8TextTileNS_9allocatorIS1_EEE21__on_zero_shared_weakEv", "__ZNSt3__210__function6__baseIFvvEED2Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEED0Ev", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7destroyEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE18destroy_deallocateEv", "__ZNSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEEclEv", "__ZNSt3__217bad_function_callD2Ev", "__ZNSt3__217bad_function_callD0Ev", "__ZN10__cxxabiv116__shim_type_infoD2Ev", "__ZN10__cxxabiv117__class_type_infoD0Ev", "__ZNK10__cxxabiv116__shim_type_info5noop1Ev", "__ZNK10__cxxabiv116__shim_type_info5noop2Ev", "__ZN10__cxxabiv120__si_class_type_infoD0Ev", "__ZNSt11logic_errorD2Ev", "__ZNSt11logic_errorD0Ev", "__ZNSt12length_errorD0Ev", "__ZN10__cxxabiv121__vmi_class_type_infoD0Ev", "__ZN10__cxxabiv112_GLOBAL__N_19destruct_EPv", "0", "0", "0", "0" ];

var debug_table_vii = [ "0", "__ZN7Matcher7onKeyUpEi", "__ZN7Matcher9onKeyDownEi", "__ZN7Matcher18onMouseButton1DownE7Vector2", "__ZN7Matcher16onMouseButton1UpE7Vector2", "__ZN7Matcher11onMouseMoveE7Vector2", "__ZN9Component8deselectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEE", "__ZNKSt3__210__function6__funcIZN7MatcherC1E7Vector2jRNS_6vectorI6EntityNS_9allocatorIS5_EEEEEUliiffE_NS6_ISA_EEFNS_10shared_ptrI9ComponentEEiiffEE7__cloneEPNS0_6__baseISF_EE", "__ZN8TextTile8deselectERNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEE", "__ZNKSt3__210__function6__funcIZ4mainE3__0NS_9allocatorIS2_EEFvvEE7__cloneEPNS0_6__baseIS5_EE", "0", "0", "0", "0", "0", "0" ];

var debug_table_viii = [ "0", "__ZN7Matcher8onLayoutERK7Vector2S2_", "__ZN9Component8onSelectEjRNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEE", "__ZN8TextTile8onSelectEjRNSt3__26vectorI6EntityNS0_9allocatorIS2_EEEE" ];

var debug_table_viiii = [ "0", "__ZN13ComponentGrid8onLayoutERK7Vector2S2_RNSt3__26vectorI6EntityNS3_9allocatorIS5_EEEE", "__ZN9Component8onLayoutERK7Vector2S2_RNSt3__26vectorI6EntityNS3_9allocatorIS5_EEEE", "__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi", "0", "0" ];

var debug_table_viiiii = [ "0", "__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib" ];

var debug_table_viiiiii = [ "0", "__ZNSt3__210__function6__funcIZN7MatcherC1E7Vector2jRNS_6vectorI6EntityNS_9allocatorIS5_EEEEEUliiffE_NS6_ISA_EEFNS_10shared_ptrI9ComponentEEiiffEEclEOiSH_OfSI_", "__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib", "0", "0", "0" ];

function nullFunc_ii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  iidi: " + debug_table_iidi[x] + "  iiii: " + debug_table_iiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iidi(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iidi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  v: " + debug_table_v[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  iidi: " + debug_table_iidi[x] + "  viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  v: " + debug_table_v[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ");
 abort(x);
}

function nullFunc_iiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iidi: " + debug_table_iidi[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  ");
 abort(x);
}

function nullFunc_v(x) {
 err("Invalid function pointer '" + x + "' called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  vii: " + debug_table_vii[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iidi: " + debug_table_iidi[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vi(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: v: " + debug_table_v[x] + "  vii: " + debug_table_vii[x] + "  viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iidi: " + debug_table_iidi[x] + "  iiii: " + debug_table_iiii[x] + "  ");
 abort(x);
}

function nullFunc_vii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vi: " + debug_table_vi[x] + "  viii: " + debug_table_viii[x] + "  v: " + debug_table_v[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  ii: " + debug_table_ii[x] + "  iii: " + debug_table_iii[x] + "  iiii: " + debug_table_iiii[x] + "  iidi: " + debug_table_iidi[x] + "  ");
 abort(x);
}

function nullFunc_viii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiii: " + debug_table_viiii[x] + "  v: " + debug_table_v[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iiii: " + debug_table_iiii[x] + "  iidi: " + debug_table_iidi[x] + "  ");
 abort(x);
}

function nullFunc_viiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiii: " + debug_table_viiiii[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iidi: " + debug_table_iidi[x] + "  ");
 abort(x);
}

function nullFunc_viiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  viiiiii: " + debug_table_viiiiii[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iidi: " + debug_table_iidi[x] + "  ");
 abort(x);
}

function nullFunc_viiiiii(x) {
 err("Invalid function pointer '" + x + "' called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");
 err("This pointer might make sense in another type signature: viii: " + debug_table_viii[x] + "  viiii: " + debug_table_viiii[x] + "  viiiii: " + debug_table_viiiii[x] + "  vii: " + debug_table_vii[x] + "  vi: " + debug_table_vi[x] + "  v: " + debug_table_v[x] + "  iiii: " + debug_table_iiii[x] + "  iii: " + debug_table_iii[x] + "  ii: " + debug_table_ii[x] + "  iidi: " + debug_table_iidi[x] + "  ");
 abort(x);
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
 "d": abortStackOverflow,
 "e": nullFunc_ii,
 "f": nullFunc_iidi,
 "g": nullFunc_iii,
 "h": nullFunc_iiii,
 "i": nullFunc_v,
 "j": nullFunc_vi,
 "k": nullFunc_vii,
 "l": nullFunc_viii,
 "m": nullFunc_viiii,
 "n": nullFunc_viiiii,
 "o": nullFunc_viiiiii,
 "p": _Engine_FilledEllipse,
 "q": _Engine_FilledRectangle,
 "r": _Engine_FilledText,
 "s": _Engine_Image,
 "t": _Engine_Init,
 "u": _Engine_RoundedRectangle,
 "v": _SDL_AudioQuit,
 "w": _SDL_GetTicks,
 "x": _SDL_Init,
 "y": _SDL_LockSurface,
 "z": _SDL_PollEvent,
 "A": _SDL_Quit,
 "B": _SDL_SetVideoMode,
 "C": __ZSt18uncaught_exceptionv,
 "D": ___cxa_allocate_exception,
 "E": ___cxa_begin_catch,
 "F": ___cxa_find_matching_catch,
 "G": ___cxa_free_exception,
 "H": ___cxa_throw,
 "I": ___gxx_personality_v0,
 "J": ___lock,
 "K": ___resumeException,
 "L": ___setErrNo,
 "M": ___syscall140,
 "N": ___syscall146,
 "O": ___syscall221,
 "P": ___syscall3,
 "Q": ___syscall5,
 "R": ___syscall54,
 "S": ___syscall6,
 "T": ___unlock,
 "U": _abort,
 "V": _boxColor,
 "W": _clock_gettime,
 "X": _emscripten_get_heap_size,
 "Y": _emscripten_get_now,
 "Z": _emscripten_get_now_is_monotonic,
 "_": _emscripten_memcpy_big,
 "$": _emscripten_resize_heap,
 "aa": _emscripten_set_main_loop,
 "ab": _emscripten_set_main_loop_timing,
 "ac": _getWindowHeight,
 "ad": _getWindowWidth,
 "ae": _pthread_getspecific,
 "af": _pthread_key_create,
 "ag": _pthread_once,
 "ah": _pthread_setspecific,
 "ai": abortOnCannotGrowMemory,
 "aj": tempDoublePtr,
 "ak": DYNAMICTOP_PTR
};

// EMSCRIPTEN_START_ASM


var asm = (/** @suppress {uselessCode} */ function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer),b=new global.Int16Array(buffer),c=new global.Int32Array(buffer),d=new global.Uint8Array(buffer),e=new global.Uint16Array(buffer),f=new global.Float32Array(buffer),g=new global.Float64Array(buffer),h=env.aj|0,i=env.ak|0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0.0,r=global.Math.ceil,s=global.Math.imul,t=global.Math.clz32,u=env.a,v=env.b,w=env.c,x=env.d,y=env.e,z=env.f,A=env.g,B=env.h,C=env.i,D=env.j,E=env.k,F=env.l,G=env.m,H=env.n,I=env.o,J=env.p,K=env.q,L=env.r,M=env.s,N=env.t,O=env.u,P=env.v,Q=env.w,R=env.x,S=env.y,T=env.z,U=env.A,V=env.B,W=env.C,X=env.D,Y=env.E,Z=env.F,_=env.G,$=env.H,aa=env.I,ba=env.J,ca=env.K,da=env.L,ea=env.M,fa=env.N,ga=env.O,ha=env.P,ia=env.Q,ja=env.R,ka=env.S,la=env.T,ma=env.U,na=env.V,oa=env.W,pa=env.X,qa=env.Y,ra=env.Z,sa=env._,ta=env.$,ua=env.aa,va=env.ab,wa=env.ac,xa=env.ad,ya=env.ae,za=env.af,Aa=env.ag,Ba=env.ah,Ca=env.ai,Da=12160,Ea=5255040,Fa=0.0;
// EMSCRIPTEN_START_FUNCS
function Ra(a){a=a|0;var b=0;b=Da;Da=Da+a|0;Da=Da+15&-16;if((Da|0)>=(Ea|0))x(a|0);return b|0}function Sa(){return Da|0}function Ta(a){a=a|0;Da=a}function Ua(a,b){a=a|0;b=b|0;Da=a;Ea=b}function Va(){return 4053}function Wa(){return 4217}function Xa(){var a=0,b=0;a=c[2184]|0;if(!a){b=X(4)|0;c[b>>2]=3864;$(b|0,2928,16)}else{La[c[(c[a>>2]|0)+24>>2]&31](a);return}}function Ya(){var a=0,b=0,d=0,e=0,h=0,i=0,j=0,k=0,l=0,m=0.0,n=0.0,o=0,p=0,q=0,r=0,s=0,t=0;a=Da;Da=Da+112|0;if((Da|0)>=(Ea|0))x(112);b=a+32|0;d=a+24|0;e=a+72|0;h=a+60|0;i=a+16|0;j=a+56|0;k=a+8|0;l=a;N();m=+xa();n=+wa();g[b>>3]=m;g[b+8>>3]=n;md(4382,b)|0;f[d>>2]=m;o=d+4|0;f[o>>2]=n;p=d;q=c[p>>2]|0;r=c[p+4>>2]|0;c[e>>2]=0;p=e+4|0;c[p>>2]=q;c[p+4>>2]=r;c[e+12>>2]=-1;p=Ad(512)|0;c[e+16>>2]=p;c[e+24>>2]=128;c[e+20>>2]=4096;Xe(p|0,0,512)|0;c[h>>2]=0;p=h+4|0;c[p>>2]=0;c[h+8>>2]=0;s=Ad(184)|0;t=i;c[t>>2]=q;c[t+4>>2]=r;c[b>>2]=c[i>>2];c[b+4>>2]=c[i+4>>2];Za(s,b,-1,h);c[e>>2]=s;i=c[(c[s>>2]|0)+28>>2]|0;f[b>>2]=0.0;f[b+4>>2]=0.0;Na[i&3](s,b,d);R(32)|0;c[j>>2]=V(~~+f[d>>2]|0,~~+f[o>>2]|0,32,0)|0;o=k;c[o>>2]=0;c[o+4>>2]=0;g[l>>3]=+qa();o=b+16|0;d=Ad(20)|0;c[d>>2]=3316;c[d+4>>2]=e;c[d+8>>2]=k;c[d+12>>2]=j;c[d+16>>2]=l;c[o>>2]=d;fc(b,8720);d=c[o>>2]|0;if((b|0)!=(d|0)){if(d|0)La[c[(c[d>>2]|0)+20>>2]&31](d)}else La[c[(c[d>>2]|0)+16>>2]&31](d);ua(2,0,1);U();d=c[h>>2]|0;if(d|0){c[p>>2]=d;Bd(d)}d=c[e+16>>2]|0;if(!d){Da=a;return 1}Bd(d);Da=a;return 1}function Za(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,Za=0,_a=0,db=0,eb=0,fb=0,gb=0,hb=0,ib=0,jb=0,kb=0,lb=0,mb=0,nb=0,ob=0,pb=0,qb=0,rb=0,sb=0,tb=0,ub=0,vb=0,xb=0,yb=0,zb=0,Ab=0,Bb=0,Cb=0,Db=0,Eb=0,Fb=0,Gb=0,Hb=0,Ib=0,Jb=0,Kb=0,Lb=0,Mb=0,Nb=0,Ob=0,Pb=0,Qb=0,Rb=0,Sb=0,Tb=0,Ub=0,Vb=0,Wb=0,Xb=0,Yb=0,Zb=0,$b=0,ac=0,bc=0,cc=0,dc=0,ec=0,fc=0,gc=0,hc=0,ic=0,jc=0,kc=0,lc=0,mc=0,nc=0,oc=0,pc=0,qc=0,rc=0,sc=0,tc=0,uc=0,vc=0,wc=0,xc=0,yc=0,zc=0,Ac=0,Bc=0,Cc=0,Dc=0,Ec=0,Fc=0,Gc=0,Hc=0,Ic=0,Jc=0,Kc=0,Lc=0,Mc=0,Nc=0,Oc=0,Pc=0,Qc=0,Rc=0,Sc=0,Tc=0,Uc=0,Vc=0,Wc=0,Xc=0,Yc=0,Zc=0,_c=0,$c=0,ad=0,bd=0,cd=0,dd=0,ed=0,fd=0,gd=0,hd=0,id=0,jd=0,kd=0,ld=0,md=0,nd=0,od=0,pd=0,qd=0,sd=0,td=0,ud=0,vd=0,wd=0,xd=0,yd=0,Cd=0,Dd=0,Ed=0,Fd=0,Gd=0,Hd=0,Id=0,Jd=0,Kd=0,Ld=0,Md=0,Nd=0,Od=0,Pd=0,Qd=0,Rd=0,Sd=0,Td=0,Ud=0,Vd=0,Wd=0,Xd=0,Yd=0,Zd=0,_d=0,$d=0,ae=0,be=0,ce=0,de=0,ee=0,fe=0,ge=0,he=0,ie=0,je=0,ke=0,le=0,me=0,ne=0,oe=0,pe=0,qe=0,re=0,se=0,te=0,ue=0,ve=0,we=0,xe=0,ye=0,ze=0,Ae=0,Be=0,Ce=0,De=0,Ee=0,Fe=0,Ge=0,He=0,Ie=0,Je=0,Ke=0,Le=0,Me=0,Ne=0,Oe=0,Pe=0,Qe=0,Re=0,Se=0,Te=0,Ue=0,Ve=0,We=0,Xe=0,Ye=0,Ze=0,_e=0,$e=0,af=0,bf=0,cf=0,df=0,ef=0,ff=0,gf=0,hf=0,jf=0,kf=0,lf=0,mf=0,nf=0,of=0,pf=0,qf=0,rf=0,sf=0,tf=0;h=Da;Da=Da+4400|0;if((Da|0)>=(Ea|0))x(4400);i=h+2376|0;j=h+2368|0;k=h+2316|0;l=h+2352|0;m=h+2340|0;n=h+2328|0;o=h+2304|0;p=h+2292|0;q=h+2280|0;r=h+2260|0;s=h+2248|0;t=h+2224|0;u=h+296|0;v=h+2192|0;y=h+2168|0;z=h+2144|0;A=h+2132|0;B=h+2120|0;C=h+2108|0;D=h+2096|0;E=h+2084|0;F=h+2072|0;G=h+2060|0;H=h+2048|0;I=h+2036|0;J=h+2024|0;K=h+2012|0;L=h+2e3|0;M=h+1988|0;N=h+1976|0;O=h+280|0;P=h+1964|0;Q=h+1952|0;R=h+1940|0;S=h+1928|0;T=h+1916|0;U=h+1904|0;V=h+1892|0;W=h+264|0;X=h+1880|0;Y=h+1868|0;Z=h+1856|0;_=h+1844|0;$=h+1832|0;aa=h+1820|0;ba=h+1808|0;ca=h+1796|0;da=h+1784|0;ea=h+248|0;fa=h+1772|0;ga=h+1760|0;ha=h+1748|0;ia=h+1736|0;ja=h+1724|0;ka=h+232|0;la=h+1712|0;ma=h+216|0;na=h+1700|0;oa=h+1688|0;pa=h+1676|0;qa=h+1664|0;ra=h+1652|0;sa=h+1640|0;ta=h+1628|0;ua=h+1616|0;va=h+1604|0;wa=h+1592|0;xa=h+1580|0;ya=h+1568|0;za=h+200|0;Aa=h+1556|0;Ba=h+1544|0;Ca=h+1532|0;Fa=h+184|0;Ga=h+1520|0;Ha=h+1508|0;Ia=h+1496|0;Ja=h+1484|0;Ka=h+1472|0;Ma=h+1460|0;Na=h+1448|0;Oa=h+1436|0;Pa=h+1424|0;Qa=h+1412|0;Ra=h+1400|0;Sa=h+1388|0;Ta=h+1376|0;Ua=h+1364|0;Va=h+1352|0;Wa=h+1340|0;Xa=h+1328|0;Ya=h+1316|0;Za=h+1304|0;_a=h+168|0;db=h+1292|0;eb=h+1280|0;fb=h+1268|0;gb=h+1256|0;hb=h+1244|0;ib=h+1232|0;jb=h+1220|0;kb=h+1208|0;lb=h+1196|0;mb=h+1184|0;nb=h+1172|0;ob=h+1160|0;pb=h+1148|0;qb=h+1136|0;rb=h+1124|0;sb=h+1112|0;tb=h+1100|0;ub=h+1088|0;vb=h+1076|0;xb=h+1064|0;yb=h+1052|0;zb=h+1040|0;Ab=h+152|0;Bb=h+1028|0;Cb=h+1016|0;Db=h+1004|0;Eb=h+992|0;Fb=h+980|0;Gb=h+968|0;Hb=h+956|0;Ib=h+944|0;Jb=h+932|0;Kb=h+920|0;Lb=h+908|0;Mb=h+896|0;Nb=h+884|0;Ob=h+872|0;Pb=h+860|0;Qb=h+848|0;Rb=h+836|0;Sb=h+136|0;Tb=h+824|0;Ub=h+120|0;Vb=h+104|0;Wb=h+812|0;Xb=h+800|0;Yb=h+788|0;Zb=h+776|0;$b=h+764|0;ac=h+752|0;bc=h+740|0;cc=h+728|0;dc=h+716|0;ec=h+704|0;fc=h+692|0;gc=h+680|0;hc=h+668|0;ic=h+656|0;jc=h+88|0;kc=h+644|0;lc=h+72|0;mc=h+632|0;nc=h+56|0;oc=h+620|0;pc=h+608|0;qc=h+596|0;rc=h+584|0;sc=h+572|0;tc=h+560|0;uc=h+548|0;vc=h+536|0;wc=h+524|0;xc=h+40|0;yc=h+512|0;zc=h+500|0;Ac=h+488|0;Bc=h+24|0;Cc=h+484|0;Dc=h+480|0;Ec=h+2272|0;Fc=h+312|0;Gc=h+2240|0;Hc=h+2216|0;Ic=h+2208|0;Jc=h+2184|0;Kc=h+2160|0;Lc=h+472|0;Mc=h+464|0;Nc=h;Oc=d;d=c[Oc>>2]|0;Pc=c[Oc+4>>2]|0;c[b+4>>2]=g;Oc=b+8|0;c[Oc>>2]=d;c[Oc+4>>2]=Pc;c[b+16>>2]=e;c[b>>2]=3128;e=b+24|0;Pc=b+84|0;Oc=b+28|0;d=Oc+56|0;do{c[Oc>>2]=0;Oc=Oc+4|0}while((Oc|0)<(d|0));f[Pc>>2]=-1.0;a[b+88>>0]=1;c[b+92>>2]=0;c[b+96>>2]=0;c[e>>2]=3172;e=b+100|0;Pc=b+120|0;c[Pc>>2]=0;c[Pc+4>>2]=0;c[Pc+8>>2]=0;c[Pc+12>>2]=0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;c[b+136>>2]=1065353216;e=b+140|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;c[e+16>>2]=0;e=b+176|0;c[e>>2]=0;c[b+180>>2]=-1;c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;Pc=l+11|0;a[Pc>>0]=6;a[l>>0]=a[4465]|0;a[l+1>>0]=a[4466]|0;a[l+2>>0]=a[4467]|0;a[l+3>>0]=a[4468]|0;a[l+4>>0]=a[4469]|0;a[l+5>>0]=a[4470]|0;a[l+6>>0]=0;Qc=m+11|0;a[Qc>>0]=10;Oc=m;Rc=4472;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[m+10>>0]=0;c[n>>2]=0;c[n+4>>2]=0;c[n+8>>2]=0;Sc=n+11|0;a[Sc>>0]=5;a[n>>0]=a[4483]|0;a[n+1>>0]=a[4484]|0;a[n+2>>0]=a[4485]|0;a[n+3>>0]=a[4486]|0;a[n+4>>0]=a[4487]|0;a[n+5>>0]=0;c[o>>2]=0;c[o+4>>2]=0;c[o+8>>2]=0;Tc=Ad(16)|0;c[o>>2]=Tc;c[o+8>>2]=-2147483632;c[o+4>>2]=13;Oc=Tc;Rc=4489;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Tc+13>>0]=0;$a(i,l,m,n,o);Tc=i+48|0;c[p>>2]=0;c[p+4>>2]=0;c[p+8>>2]=0;Uc=p+11|0;a[Uc>>0]=6;a[p>>0]=a[4503]|0;a[p+1>>0]=a[4504]|0;a[p+2>>0]=a[4505]|0;a[p+3>>0]=a[4506]|0;a[p+4>>0]=a[4507]|0;a[p+5>>0]=a[4508]|0;a[p+6>>0]=0;c[q>>2]=0;c[q+4>>2]=0;c[q+8>>2]=0;Vc=Ad(16)|0;c[q>>2]=Vc;c[q+8>>2]=-2147483632;c[q+4>>2]=12;Oc=Vc;Rc=4510;d=Oc+12|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Vc+12>>0]=0;c[r>>2]=0;c[r+4>>2]=0;c[r+8>>2]=0;Vc=r+11|0;a[Vc>>0]=6;a[r>>0]=a[4523]|0;a[r+1>>0]=a[4524]|0;a[r+2>>0]=a[4525]|0;a[r+3>>0]=a[4526]|0;a[r+4>>0]=a[4527]|0;a[r+5>>0]=a[4528]|0;a[r+6>>0]=0;c[s>>2]=0;c[s+4>>2]=0;c[s+8>>2]=0;Wc=Ad(16)|0;c[s>>2]=Wc;c[s+8>>2]=-2147483632;c[s+4>>2]=11;Oc=Wc;Rc=4530;d=Oc+11|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Wc+11>>0]=0;$a(Tc,p,q,r,s);Tc=i+96|0;c[t>>2]=0;c[t+4>>2]=0;c[t+8>>2]=0;Wc=t+11|0;a[Wc>>0]=6;a[t>>0]=a[4542]|0;a[t+1>>0]=a[4543]|0;a[t+2>>0]=a[4544]|0;a[t+3>>0]=a[4545]|0;a[t+4>>0]=a[4546]|0;a[t+5>>0]=a[4547]|0;a[t+6>>0]=0;c[u>>2]=0;c[u+4>>2]=0;c[u+8>>2]=0;Xc=u+11|0;a[Xc>>0]=8;Yc=u;c[Yc>>2]=549110640;c[Yc+4>>2]=1872872308;a[u+8>>0]=0;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;Yc=v+11|0;a[Yc>>0]=5;a[v>>0]=a[4549]|0;a[v+1>>0]=a[4550]|0;a[v+2>>0]=a[4551]|0;a[v+3>>0]=a[4552]|0;a[v+4>>0]=a[4553]|0;a[v+5>>0]=0;Zc=y+11|0;a[Zc>>0]=10;Oc=y;Rc=4555;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[y+10>>0]=0;$a(Tc,t,u,v,y);Tc=i+144|0;c[z>>2]=0;c[z+4>>2]=0;c[z+8>>2]=0;_c=z+11|0;a[_c>>0]=6;a[z>>0]=a[4566]|0;a[z+1>>0]=a[4567]|0;a[z+2>>0]=a[4568]|0;a[z+3>>0]=a[4569]|0;a[z+4>>0]=a[4570]|0;a[z+5>>0]=a[4571]|0;a[z+6>>0]=0;$c=A+11|0;a[$c>>0]=10;Oc=A;Rc=4573;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[A+10>>0]=0;c[B>>2]=0;c[B+4>>2]=0;c[B+8>>2]=0;ad=B+11|0;a[ad>>0]=6;a[B>>0]=a[4584]|0;a[B+1>>0]=a[4585]|0;a[B+2>>0]=a[4586]|0;a[B+3>>0]=a[4587]|0;a[B+4>>0]=a[4588]|0;a[B+5>>0]=a[4589]|0;a[B+6>>0]=0;bd=C+11|0;a[bd>>0]=10;Oc=C;Rc=4591;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[C+10>>0]=0;$a(Tc,z,A,B,C);Tc=i+192|0;c[D>>2]=0;c[D+4>>2]=0;c[D+8>>2]=0;cd=D+11|0;a[cd>>0]=6;a[D>>0]=a[4602]|0;a[D+1>>0]=a[4603]|0;a[D+2>>0]=a[4604]|0;a[D+3>>0]=a[4605]|0;a[D+4>>0]=a[4606]|0;a[D+5>>0]=a[4607]|0;a[D+6>>0]=0;c[E>>2]=0;c[E+4>>2]=0;c[E+8>>2]=0;dd=E+11|0;a[dd>>0]=9;Oc=E;Rc=4609;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[E+9>>0]=0;ed=F+11|0;a[ed>>0]=10;Oc=F;Rc=4619;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[F+10>>0]=0;c[G>>2]=0;c[G+4>>2]=0;c[G+8>>2]=0;fd=Ad(16)|0;c[G>>2]=fd;c[G+8>>2]=-2147483632;c[G+4>>2]=14;Oc=fd;Rc=4630;d=Oc+14|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[fd+14>>0]=0;$a(Tc,D,E,F,G);Tc=i+240|0;c[H>>2]=0;c[H+4>>2]=0;c[H+8>>2]=0;fd=H+11|0;a[fd>>0]=6;a[H>>0]=a[4645]|0;a[H+1>>0]=a[4646]|0;a[H+2>>0]=a[4647]|0;a[H+3>>0]=a[4648]|0;a[H+4>>0]=a[4649]|0;a[H+5>>0]=a[4650]|0;a[H+6>>0]=0;gd=I+11|0;a[gd>>0]=10;Oc=I;Rc=4652;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[I+10>>0]=0;c[J>>2]=0;c[J+4>>2]=0;c[J+8>>2]=0;hd=J+11|0;a[hd>>0]=6;a[J>>0]=a[4663]|0;a[J+1>>0]=a[4664]|0;a[J+2>>0]=a[4665]|0;a[J+3>>0]=a[4666]|0;a[J+4>>0]=a[4667]|0;a[J+5>>0]=a[4668]|0;a[J+6>>0]=0;id=K+11|0;a[id>>0]=10;Oc=K;Rc=4670;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[K+10>>0]=0;$a(Tc,H,I,J,K);Tc=L+4|0;c[Tc>>2]=0;c[Tc+4>>2]=0;Tc=L+11|0;a[Tc>>0]=3;a[L>>0]=a[4681]|0;a[L+1>>0]=a[4682]|0;a[L+2>>0]=a[4683]|0;a[L+3>>0]=0;jd=M+4|0;c[jd>>2]=0;c[jd+4>>2]=0;jd=M+11|0;a[jd>>0]=3;a[M>>0]=a[4685]|0;a[M+1>>0]=a[4686]|0;a[M+2>>0]=a[4687]|0;a[M+3>>0]=0;c[N>>2]=0;c[N+4>>2]=0;c[N+8>>2]=0;kd=N+11|0;a[kd>>0]=4;c[N>>2]=1918985584;a[N+4>>0]=0;c[O>>2]=0;c[O+4>>2]=0;c[O+8>>2]=0;ld=O+11|0;a[ld>>0]=8;md=O;c[md>>2]=1918985584;c[md+4>>2]=1735815982;a[O+8>>0]=0;$a(i+288|0,L,M,N,O);md=i+336|0;c[P>>2]=0;c[P+4>>2]=0;c[P+8>>2]=0;nd=P+11|0;a[nd>>0]=6;a[P>>0]=a[4689]|0;a[P+1>>0]=a[4690]|0;a[P+2>>0]=a[4691]|0;a[P+3>>0]=a[4692]|0;a[P+4>>0]=a[4693]|0;a[P+5>>0]=a[4694]|0;a[P+6>>0]=0;c[Q+8>>2]=0;od=Q+11|0;a[od>>0]=7;a[Q>>0]=a[4696]|0;a[Q+1>>0]=a[4697]|0;a[Q+2>>0]=a[4698]|0;a[Q+3>>0]=a[4699]|0;a[Q+4>>0]=a[4700]|0;a[Q+5>>0]=a[4701]|0;a[Q+6>>0]=a[4702]|0;a[Q+7>>0]=0;c[R+8>>2]=0;pd=R+11|0;a[pd>>0]=7;a[R>>0]=a[4704]|0;a[R+1>>0]=a[4705]|0;a[R+2>>0]=a[4706]|0;a[R+3>>0]=a[4707]|0;a[R+4>>0]=a[4708]|0;a[R+5>>0]=a[4709]|0;a[R+6>>0]=a[4710]|0;a[R+7>>0]=0;c[S>>2]=0;c[S+4>>2]=0;c[S+8>>2]=0;qd=Ad(16)|0;c[S>>2]=qd;c[S+8>>2]=-2147483632;c[S+4>>2]=11;Oc=qd;Rc=4712;d=Oc+11|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[qd+11>>0]=0;$a(md,P,Q,R,S);md=i+384|0;c[T>>2]=0;c[T+4>>2]=0;c[T+8>>2]=0;qd=T+11|0;a[qd>>0]=9;Oc=T;Rc=4724;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[T+9>>0]=0;c[U>>2]=0;c[U+4>>2]=0;c[U+8>>2]=0;sd=Ad(16)|0;c[U>>2]=sd;c[U+8>>2]=-2147483632;c[U+4>>2]=12;Oc=sd;Rc=4734;d=Oc+12|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[sd+12>>0]=0;c[V>>2]=0;c[V+4>>2]=0;c[V+8>>2]=0;sd=V+11|0;a[sd>>0]=4;c[V>>2]=1769433451;a[V+4>>0]=0;c[W>>2]=0;c[W+4>>2]=0;c[W+8>>2]=0;td=W+11|0;a[td>>0]=8;ud=W;c[ud>>2]=1769433451;c[ud+4>>2]=1735290926;a[W+8>>0]=0;$a(md,T,U,V,W);md=i+432|0;c[X>>2]=0;c[X+4>>2]=0;c[X+8>>2]=0;ud=X+11|0;a[ud>>0]=6;a[X>>0]=a[4747]|0;a[X+1>>0]=a[4748]|0;a[X+2>>0]=a[4749]|0;a[X+3>>0]=a[4750]|0;a[X+4>>0]=a[4751]|0;a[X+5>>0]=a[4752]|0;a[X+6>>0]=0;c[Y>>2]=0;c[Y+4>>2]=0;c[Y+8>>2]=0;vd=Ad(16)|0;c[Y>>2]=vd;c[Y+8>>2]=-2147483632;c[Y+4>>2]=11;Oc=vd;Rc=4754;d=Oc+11|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[vd+11>>0]=0;c[Z>>2]=0;c[Z+4>>2]=0;c[Z+8>>2]=0;vd=Z+11|0;a[vd>>0]=5;a[Z>>0]=a[4766]|0;a[Z+1>>0]=a[4767]|0;a[Z+2>>0]=a[4768]|0;a[Z+3>>0]=a[4769]|0;a[Z+4>>0]=a[4770]|0;a[Z+5>>0]=0;c[_>>2]=0;c[_+4>>2]=0;c[_+8>>2]=0;wd=_+11|0;a[wd>>0]=9;Oc=_;Rc=4772;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[_+9>>0]=0;$a(md,X,Y,Z,_);md=i+480|0;c[$>>2]=0;c[$+4>>2]=0;c[$+8>>2]=0;xd=$+11|0;a[xd>>0]=9;Oc=$;Rc=4782;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[$+9>>0]=0;c[aa>>2]=0;c[aa+4>>2]=0;c[aa+8>>2]=0;yd=Ad(16)|0;c[aa>>2]=yd;c[aa+8>>2]=-2147483632;c[aa+4>>2]=14;Oc=yd;Rc=4792;d=Oc+14|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[yd+14>>0]=0;c[ba+8>>2]=0;yd=ba+11|0;a[yd>>0]=7;a[ba>>0]=a[4807]|0;a[ba+1>>0]=a[4808]|0;a[ba+2>>0]=a[4809]|0;a[ba+3>>0]=a[4810]|0;a[ba+4>>0]=a[4811]|0;a[ba+5>>0]=a[4812]|0;a[ba+6>>0]=a[4813]|0;a[ba+7>>0]=0;c[ca>>2]=0;c[ca+4>>2]=0;c[ca+8>>2]=0;Cd=Ad(16)|0;c[ca>>2]=Cd;c[ca+8>>2]=-2147483632;c[ca+4>>2]=11;Oc=Cd;Rc=4815;d=Oc+11|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Cd+11>>0]=0;$a(md,$,aa,ba,ca);md=i+528|0;c[da>>2]=0;c[da+4>>2]=0;c[da+8>>2]=0;Cd=da+11|0;a[Cd>>0]=6;a[da>>0]=a[4827]|0;a[da+1>>0]=a[4828]|0;a[da+2>>0]=a[4829]|0;a[da+3>>0]=a[4830]|0;a[da+4>>0]=a[4831]|0;a[da+5>>0]=a[4832]|0;a[da+6>>0]=0;c[ea>>2]=0;c[ea+4>>2]=0;c[ea+8>>2]=0;Dd=ea+11|0;a[Dd>>0]=8;Ed=ea;c[Ed>>2]=546162018;c[Ed+4>>2]=-1279036052;a[ea+8>>0]=0;c[fa>>2]=0;c[fa+4>>2]=0;c[fa+8>>2]=0;Ed=fa+11|0;a[Ed>>0]=9;Oc=fa;Rc=4834;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[fa+9>>0]=0;c[ga>>2]=0;c[ga+4>>2]=0;c[ga+8>>2]=0;Fd=Ad(16)|0;c[ga>>2]=Fd;c[ga+8>>2]=-2147483632;c[ga+4>>2]=13;Oc=Fd;Rc=4844;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Fd+13>>0]=0;$a(md,da,ea,fa,ga);c[ha>>2]=0;c[ha+4>>2]=0;c[ha+8>>2]=0;md=ha+11|0;a[md>>0]=6;a[ha>>0]=a[4858]|0;a[ha+1>>0]=a[4859]|0;a[ha+2>>0]=a[4860]|0;a[ha+3>>0]=a[4861]|0;a[ha+4>>0]=a[4862]|0;a[ha+5>>0]=a[4863]|0;a[ha+6>>0]=0;c[ia+8>>2]=0;Fd=ia+11|0;a[Fd>>0]=7;a[ia>>0]=a[4865]|0;a[ia+1>>0]=a[4866]|0;a[ia+2>>0]=a[4867]|0;a[ia+3>>0]=a[4868]|0;a[ia+4>>0]=a[4869]|0;a[ia+5>>0]=a[4870]|0;a[ia+6>>0]=a[4871]|0;a[ia+7>>0]=0;c[ja>>2]=0;c[ja+4>>2]=0;c[ja+8>>2]=0;Gd=ja+11|0;a[Gd>>0]=4;c[ja>>2]=1852993379;a[ja+4>>0]=0;c[ka>>2]=0;c[ka+4>>2]=0;c[ka+8>>2]=0;Hd=ka+11|0;a[Hd>>0]=8;Id=ka;c[Id>>2]=1852993379;c[Id+4>>2]=1735815982;a[ka+8>>0]=0;$a(i+576|0,ha,ia,ja,ka);Id=i+624|0;c[la>>2]=0;c[la+4>>2]=0;c[la+8>>2]=0;Jd=la+11|0;a[Jd>>0]=6;a[la>>0]=a[4873]|0;a[la+1>>0]=a[4874]|0;a[la+2>>0]=a[4875]|0;a[la+3>>0]=a[4876]|0;a[la+4>>0]=a[4877]|0;a[la+5>>0]=a[4878]|0;a[la+6>>0]=0;c[ma>>2]=0;c[ma+4>>2]=0;c[ma+8>>2]=0;Kd=ma+11|0;a[Kd>>0]=8;Ld=ma;c[Ld>>2]=546621300;c[Ld+4>>2]=1974649700;a[ma+8>>0]=0;c[na>>2]=0;c[na+4>>2]=0;c[na+8>>2]=0;Ld=na+11|0;a[Ld>>0]=6;a[na>>0]=a[4880]|0;a[na+1>>0]=a[4881]|0;a[na+2>>0]=a[4882]|0;a[na+3>>0]=a[4883]|0;a[na+4>>0]=a[4884]|0;a[na+5>>0]=a[4885]|0;a[na+6>>0]=0;Md=oa+11|0;a[Md>>0]=10;Oc=oa;Rc=4887;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[oa+10>>0]=0;$a(Id,la,ma,na,oa);Id=i+672|0;c[pa>>2]=0;c[pa+4>>2]=0;c[pa+8>>2]=0;Nd=pa+11|0;a[Nd>>0]=6;a[pa>>0]=a[4898]|0;a[pa+1>>0]=a[4899]|0;a[pa+2>>0]=a[4900]|0;a[pa+3>>0]=a[4901]|0;a[pa+4>>0]=a[4902]|0;a[pa+5>>0]=a[4903]|0;a[pa+6>>0]=0;c[qa>>2]=0;c[qa+4>>2]=0;c[qa+8>>2]=0;Od=Ad(16)|0;c[qa>>2]=Od;c[qa+8>>2]=-2147483632;c[qa+4>>2]=13;Oc=Od;Rc=4905;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Od+13>>0]=0;c[ra>>2]=0;c[ra+4>>2]=0;c[ra+8>>2]=0;Od=ra+11|0;a[Od>>0]=6;a[ra>>0]=a[4919]|0;a[ra+1>>0]=a[4920]|0;a[ra+2>>0]=a[4921]|0;a[ra+3>>0]=a[4922]|0;a[ra+4>>0]=a[4923]|0;a[ra+5>>0]=a[4924]|0;a[ra+6>>0]=0;Pd=sa+11|0;a[Pd>>0]=10;Oc=sa;Rc=4926;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[sa+10>>0]=0;$a(Id,pa,qa,ra,sa);Id=i+720|0;c[ta>>2]=0;c[ta+4>>2]=0;c[ta+8>>2]=0;Qd=ta+11|0;a[Qd>>0]=6;a[ta>>0]=a[4937]|0;a[ta+1>>0]=a[4938]|0;a[ta+2>>0]=a[4939]|0;a[ta+3>>0]=a[4940]|0;a[ta+4>>0]=a[4941]|0;a[ta+5>>0]=a[4942]|0;a[ta+6>>0]=0;c[ua>>2]=0;c[ua+4>>2]=0;c[ua+8>>2]=0;Rd=ua+11|0;a[Rd>>0]=9;Oc=ua;Rc=4944;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[ua+9>>0]=0;c[va>>2]=0;c[va+4>>2]=0;c[va+8>>2]=0;Sd=va+11|0;a[Sd>>0]=6;a[va>>0]=a[4954]|0;a[va+1>>0]=a[4955]|0;a[va+2>>0]=a[4956]|0;a[va+3>>0]=a[4957]|0;a[va+4>>0]=a[4958]|0;a[va+5>>0]=a[4959]|0;a[va+6>>0]=0;Td=wa+11|0;a[Td>>0]=10;Oc=wa;Rc=4961;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[wa+10>>0]=0;$a(Id,ta,ua,va,wa);Id=i+768|0;c[xa>>2]=0;c[xa+4>>2]=0;c[xa+8>>2]=0;Ud=xa+11|0;a[Ud>>0]=9;Oc=xa;Rc=4972;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[xa+9>>0]=0;c[ya>>2]=0;c[ya+4>>2]=0;c[ya+8>>2]=0;Vd=Ad(16)|0;c[ya>>2]=Vd;c[ya+8>>2]=-2147483632;c[ya+4>>2]=13;Oc=Vd;Rc=4982;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Vd+13>>0]=0;c[za>>2]=0;c[za+4>>2]=0;c[za+8>>2]=0;Vd=za+11|0;a[Vd>>0]=8;Wd=za;c[Wd>>2]=1668248162;c[Wd+4>>2]=1768714083;a[za+8>>0]=0;c[Aa>>2]=0;c[Aa+4>>2]=0;c[Aa+8>>2]=0;Wd=Ad(16)|0;c[Aa>>2]=Wd;c[Aa+8>>2]=-2147483632;c[Aa+4>>2]=12;Oc=Wd;Rc=4996;d=Oc+12|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Wd+12>>0]=0;$a(Id,xa,ya,za,Aa);Id=i+816|0;c[Ba>>2]=0;c[Ba+4>>2]=0;c[Ba+8>>2]=0;Wd=Ba+11|0;a[Wd>>0]=6;a[Ba>>0]=a[5009]|0;a[Ba+1>>0]=a[5010]|0;a[Ba+2>>0]=a[5011]|0;a[Ba+3>>0]=a[5012]|0;a[Ba+4>>0]=a[5013]|0;a[Ba+5>>0]=a[5014]|0;a[Ba+6>>0]=0;c[Ca+8>>2]=0;Xd=Ca+11|0;a[Xd>>0]=7;a[Ca>>0]=a[5016]|0;a[Ca+1>>0]=a[5017]|0;a[Ca+2>>0]=a[5018]|0;a[Ca+3>>0]=a[5019]|0;a[Ca+4>>0]=a[5020]|0;a[Ca+5>>0]=a[5021]|0;a[Ca+6>>0]=a[5022]|0;a[Ca+7>>0]=0;c[Fa>>2]=0;c[Fa+4>>2]=0;c[Fa+8>>2]=0;Yd=Fa+11|0;a[Yd>>0]=8;Zd=Fa;c[Zd>>2]=1752397165;c[Zd+4>>2]=1836019570;a[Fa+8>>0]=0;c[Ga>>2]=0;c[Ga+4>>2]=0;c[Ga+8>>2]=0;Zd=Ad(16)|0;c[Ga>>2]=Zd;c[Ga+8>>2]=-2147483632;c[Ga+4>>2]=12;Oc=Zd;Rc=5024;d=Oc+12|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Zd+12>>0]=0;$a(Id,Ba,Ca,Fa,Ga);Id=i+864|0;c[Ha>>2]=0;c[Ha+4>>2]=0;c[Ha+8>>2]=0;Zd=Ha+11|0;a[Zd>>0]=9;Oc=Ha;Rc=5037;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Ha+9>>0]=0;c[Ia>>2]=0;c[Ia+4>>2]=0;c[Ia+8>>2]=0;_d=Ad(16)|0;c[Ia>>2]=_d;c[Ia+8>>2]=-2147483632;c[Ia+4>>2]=14;Oc=_d;Rc=5047;d=Oc+14|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[_d+14>>0]=0;c[Ja>>2]=0;c[Ja+4>>2]=0;c[Ja+8>>2]=0;_d=Ja+11|0;a[_d>>0]=6;a[Ja>>0]=a[5062]|0;a[Ja+1>>0]=a[5063]|0;a[Ja+2>>0]=a[5064]|0;a[Ja+3>>0]=a[5065]|0;a[Ja+4>>0]=a[5066]|0;a[Ja+5>>0]=a[5067]|0;a[Ja+6>>0]=0;$d=Ka+11|0;a[$d>>0]=10;Oc=Ka;Rc=5069;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Ka+10>>0]=0;$a(Id,Ha,Ia,Ja,Ka);Id=i+912|0;c[Ma>>2]=0;c[Ma+4>>2]=0;c[Ma+8>>2]=0;ae=Ma+11|0;a[ae>>0]=9;Oc=Ma;Rc=5080;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Ma+9>>0]=0;c[Na>>2]=0;c[Na+4>>2]=0;c[Na+8>>2]=0;be=Ad(16)|0;c[Na>>2]=be;c[Na+8>>2]=-2147483632;c[Na+4>>2]=13;Oc=be;Rc=5090;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[be+13>>0]=0;c[Oa>>2]=0;c[Oa+4>>2]=0;c[Oa+8>>2]=0;be=Oa+11|0;a[be>>0]=6;a[Oa>>0]=a[5104]|0;a[Oa+1>>0]=a[5105]|0;a[Oa+2>>0]=a[5106]|0;a[Oa+3>>0]=a[5107]|0;a[Oa+4>>0]=a[5108]|0;a[Oa+5>>0]=a[5109]|0;a[Oa+6>>0]=0;ce=Pa+11|0;a[ce>>0]=10;Oc=Pa;Rc=5111;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Pa+10>>0]=0;$a(Id,Ma,Na,Oa,Pa);Id=i+960|0;c[Qa>>2]=0;c[Qa+4>>2]=0;c[Qa+8>>2]=0;de=Qa+11|0;a[de>>0]=6;a[Qa>>0]=a[5122]|0;a[Qa+1>>0]=a[5123]|0;a[Qa+2>>0]=a[5124]|0;a[Qa+3>>0]=a[5125]|0;a[Qa+4>>0]=a[5126]|0;a[Qa+5>>0]=a[5127]|0;a[Qa+6>>0]=0;c[Ra>>2]=0;c[Ra+4>>2]=0;c[Ra+8>>2]=0;ee=Ra+11|0;a[ee>>0]=6;a[Ra>>0]=a[5129]|0;a[Ra+1>>0]=a[5130]|0;a[Ra+2>>0]=a[5131]|0;a[Ra+3>>0]=a[5132]|0;a[Ra+4>>0]=a[5133]|0;a[Ra+5>>0]=a[5134]|0;a[Ra+6>>0]=0;c[Sa>>2]=0;c[Sa+4>>2]=0;c[Sa+8>>2]=0;fe=Sa+11|0;a[fe>>0]=6;a[Sa>>0]=a[5136]|0;a[Sa+1>>0]=a[5137]|0;a[Sa+2>>0]=a[5138]|0;a[Sa+3>>0]=a[5139]|0;a[Sa+4>>0]=a[5140]|0;a[Sa+5>>0]=a[5141]|0;a[Sa+6>>0]=0;ge=Ta+11|0;a[ge>>0]=10;Oc=Ta;Rc=5143;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Ta+10>>0]=0;$a(Id,Qa,Ra,Sa,Ta);Id=i+1008|0;c[Ua>>2]=0;c[Ua+4>>2]=0;c[Ua+8>>2]=0;he=Ua+11|0;a[he>>0]=6;a[Ua>>0]=a[5154]|0;a[Ua+1>>0]=a[5155]|0;a[Ua+2>>0]=a[5156]|0;a[Ua+3>>0]=a[5157]|0;a[Ua+4>>0]=a[5158]|0;a[Ua+5>>0]=a[5159]|0;a[Ua+6>>0]=0;c[Va>>2]=0;c[Va+4>>2]=0;c[Va+8>>2]=0;ie=Ad(16)|0;c[Va>>2]=ie;c[Va+8>>2]=-2147483632;c[Va+4>>2]=11;Oc=ie;Rc=5161;d=Oc+11|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[ie+11>>0]=0;c[Wa>>2]=0;c[Wa+4>>2]=0;c[Wa+8>>2]=0;ie=Wa+11|0;a[ie>>0]=5;a[Wa>>0]=a[5173]|0;a[Wa+1>>0]=a[5174]|0;a[Wa+2>>0]=a[5175]|0;a[Wa+3>>0]=a[5176]|0;a[Wa+4>>0]=a[5177]|0;a[Wa+5>>0]=0;c[Xa>>2]=0;c[Xa+4>>2]=0;c[Xa+8>>2]=0;je=Xa+11|0;a[je>>0]=9;Oc=Xa;Rc=5179;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Xa+9>>0]=0;$a(Id,Ua,Va,Wa,Xa);Id=i+1056|0;c[Ya>>2]=0;c[Ya+4>>2]=0;c[Ya+8>>2]=0;ke=Ya+11|0;a[ke>>0]=9;Oc=Ya;Rc=5189;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Ya+9>>0]=0;c[Za>>2]=0;c[Za+4>>2]=0;c[Za+8>>2]=0;le=Ad(16)|0;c[Za>>2]=le;c[Za+8>>2]=-2147483632;c[Za+4>>2]=13;Oc=le;Rc=5199;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[le+13>>0]=0;c[_a>>2]=0;c[_a+4>>2]=0;c[_a+8>>2]=0;le=_a+11|0;a[le>>0]=8;me=_a;c[me>>2]=1836413540;c[me+4>>2]=1952805664;a[_a+8>>0]=0;c[db>>2]=0;c[db+4>>2]=0;c[db+8>>2]=0;me=Ad(16)|0;c[db>>2]=me;c[db+8>>2]=-2147483632;c[db+4>>2]=12;Oc=me;Rc=5213;d=Oc+12|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[me+12>>0]=0;$a(Id,Ya,Za,_a,db);Id=i+1104|0;c[eb>>2]=0;c[eb+4>>2]=0;c[eb+8>>2]=0;me=Ad(16)|0;c[eb>>2]=me;c[eb+8>>2]=-2147483632;c[eb+4>>2]=12;Oc=me;Rc=5226;d=Oc+12|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[me+12>>0]=0;c[fb>>2]=0;c[fb+4>>2]=0;c[fb+8>>2]=0;me=Ad(32)|0;c[fb>>2]=me;c[fb+8>>2]=-2147483616;c[fb+4>>2]=20;Oc=me;Rc=5239;d=Oc+20|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[me+20>>0]=0;me=gb+4|0;c[me>>2]=0;c[me+4>>2]=0;me=gb+11|0;a[me>>0]=3;a[gb>>0]=a[5260]|0;a[gb+1>>0]=a[5261]|0;a[gb+2>>0]=a[5262]|0;a[gb+3>>0]=0;c[hb+8>>2]=0;ne=hb+11|0;a[ne>>0]=7;a[hb>>0]=a[5264]|0;a[hb+1>>0]=a[5265]|0;a[hb+2>>0]=a[5266]|0;a[hb+3>>0]=a[5267]|0;a[hb+4>>0]=a[5268]|0;a[hb+5>>0]=a[5269]|0;a[hb+6>>0]=a[5270]|0;a[hb+7>>0]=0;$a(Id,eb,fb,gb,hb);Id=i+1152|0;c[ib>>2]=0;c[ib+4>>2]=0;c[ib+8>>2]=0;oe=ib+11|0;a[oe>>0]=9;Oc=ib;Rc=5272;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[ib+9>>0]=0;c[jb>>2]=0;c[jb+4>>2]=0;c[jb+8>>2]=0;pe=Ad(16)|0;c[jb>>2]=pe;c[jb+8>>2]=-2147483632;c[jb+4>>2]=14;Oc=pe;Rc=5282;d=Oc+14|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[pe+14>>0]=0;pe=kb+4|0;c[pe>>2]=0;c[pe+4>>2]=0;pe=kb+11|0;a[pe>>0]=3;a[kb>>0]=a[5297]|0;a[kb+1>>0]=a[5298]|0;a[kb+2>>0]=a[5299]|0;a[kb+3>>0]=0;c[lb+8>>2]=0;qe=lb+11|0;a[qe>>0]=7;a[lb>>0]=a[5301]|0;a[lb+1>>0]=a[5302]|0;a[lb+2>>0]=a[5303]|0;a[lb+3>>0]=a[5304]|0;a[lb+4>>0]=a[5305]|0;a[lb+5>>0]=a[5306]|0;a[lb+6>>0]=a[5307]|0;a[lb+7>>0]=0;$a(Id,ib,jb,kb,lb);Id=i+1200|0;c[mb>>2]=0;c[mb+4>>2]=0;c[mb+8>>2]=0;re=mb+11|0;a[re>>0]=6;a[mb>>0]=a[5309]|0;a[mb+1>>0]=a[5310]|0;a[mb+2>>0]=a[5311]|0;a[mb+3>>0]=a[5312]|0;a[mb+4>>0]=a[5313]|0;a[mb+5>>0]=a[5314]|0;a[mb+6>>0]=0;se=nb+11|0;a[se>>0]=10;Oc=nb;Rc=5316;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[nb+10>>0]=0;te=ob+11|0;a[te>>0]=10;Oc=ob;Rc=5327;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[ob+10>>0]=0;c[pb>>2]=0;c[pb+4>>2]=0;c[pb+8>>2]=0;ue=Ad(16)|0;c[pb>>2]=ue;c[pb+8>>2]=-2147483632;c[pb+4>>2]=14;Oc=ue;Rc=5338;d=Oc+14|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[ue+14>>0]=0;$a(Id,mb,nb,ob,pb);Id=i+1248|0;c[qb>>2]=0;c[qb+4>>2]=0;c[qb+8>>2]=0;ue=qb+11|0;a[ue>>0]=9;Oc=qb;Rc=5353;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[qb+9>>0]=0;c[rb>>2]=0;c[rb+4>>2]=0;c[rb+8>>2]=0;ve=Ad(16)|0;c[rb>>2]=ve;c[rb+8>>2]=-2147483632;c[rb+4>>2]=13;Oc=ve;Rc=5363;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[ve+13>>0]=0;c[sb>>2]=0;c[sb+4>>2]=0;c[sb+8>>2]=0;ve=sb+11|0;a[ve>>0]=9;Oc=sb;Rc=5377;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[sb+9>>0]=0;c[tb>>2]=0;c[tb+4>>2]=0;c[tb+8>>2]=0;we=Ad(16)|0;c[tb>>2]=we;c[tb+8>>2]=-2147483632;c[tb+4>>2]=13;Oc=we;Rc=5387;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[we+13>>0]=0;$a(Id,qb,rb,sb,tb);Id=i+1296|0;c[ub>>2]=0;c[ub+4>>2]=0;c[ub+8>>2]=0;we=ub+11|0;a[we>>0]=9;Oc=ub;Rc=5401;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[ub+9>>0]=0;c[vb>>2]=0;c[vb+4>>2]=0;c[vb+8>>2]=0;xe=Ad(32)|0;c[vb>>2]=xe;c[vb+8>>2]=-2147483616;c[vb+4>>2]=16;Oc=xe;Rc=5411;d=Oc+16|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[xe+16>>0]=0;xe=xb+11|0;a[xe>>0]=10;Oc=xb;Rc=5428;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[xb+10>>0]=0;c[yb>>2]=0;c[yb+4>>2]=0;c[yb+8>>2]=0;ye=Ad(16)|0;c[yb>>2]=ye;c[yb+8>>2]=-2147483632;c[yb+4>>2]=14;Oc=ye;Rc=5439;d=Oc+14|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[ye+14>>0]=0;$a(Id,ub,vb,xb,yb);Id=i+1344|0;c[zb>>2]=0;c[zb+4>>2]=0;c[zb+8>>2]=0;ye=zb+11|0;a[ye>>0]=6;a[zb>>0]=a[5454]|0;a[zb+1>>0]=a[5455]|0;a[zb+2>>0]=a[5456]|0;a[zb+3>>0]=a[5457]|0;a[zb+4>>0]=a[5458]|0;a[zb+5>>0]=a[5459]|0;a[zb+6>>0]=0;c[Ab>>2]=0;c[Ab+4>>2]=0;c[Ab+8>>2]=0;ze=Ab+11|0;a[ze>>0]=8;Ae=Ab;c[Ae>>2]=546228075;c[Ae+4>>2]=-1815844765;a[Ab+8>>0]=0;c[Bb>>2]=0;c[Bb+4>>2]=0;c[Bb+8>>2]=0;Ae=Bb+11|0;a[Ae>>0]=5;a[Bb>>0]=a[5461]|0;a[Bb+1>>0]=a[5462]|0;a[Bb+2>>0]=a[5463]|0;a[Bb+3>>0]=a[5464]|0;a[Bb+4>>0]=a[5465]|0;a[Bb+5>>0]=0;c[Cb>>2]=0;c[Cb+4>>2]=0;c[Cb+8>>2]=0;Be=Cb+11|0;a[Be>>0]=9;Oc=Cb;Rc=5467;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Cb+9>>0]=0;$a(Id,zb,Ab,Bb,Cb);Id=i+1392|0;c[Db>>2]=0;c[Db+4>>2]=0;c[Db+8>>2]=0;Ce=Db+11|0;a[Ce>>0]=6;a[Db>>0]=a[5477]|0;a[Db+1>>0]=a[5478]|0;a[Db+2>>0]=a[5479]|0;a[Db+3>>0]=a[5480]|0;a[Db+4>>0]=a[5481]|0;a[Db+5>>0]=a[5482]|0;a[Db+6>>0]=0;c[Eb>>2]=0;c[Eb+4>>2]=0;c[Eb+8>>2]=0;De=Eb+11|0;a[De>>0]=9;Oc=Eb;Rc=5484;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Eb+9>>0]=0;c[Fb>>2]=0;c[Fb+4>>2]=0;c[Fb+8>>2]=0;Ee=Fb+11|0;a[Ee>>0]=5;a[Fb>>0]=a[5494]|0;a[Fb+1>>0]=a[5495]|0;a[Fb+2>>0]=a[5496]|0;a[Fb+3>>0]=a[5497]|0;a[Fb+4>>0]=a[5498]|0;a[Fb+5>>0]=0;c[Gb>>2]=0;c[Gb+4>>2]=0;c[Gb+8>>2]=0;Fe=Gb+11|0;a[Fe>>0]=9;Oc=Gb;Rc=5500;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Gb+9>>0]=0;$a(Id,Db,Eb,Fb,Gb);Id=i+1440|0;c[Hb>>2]=0;c[Hb+4>>2]=0;c[Hb+8>>2]=0;Ge=Hb+11|0;a[Ge>>0]=9;Oc=Hb;Rc=5510;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Hb+9>>0]=0;c[Ib>>2]=0;c[Ib+4>>2]=0;c[Ib+8>>2]=0;He=Ad(16)|0;c[Ib>>2]=He;c[Ib+8>>2]=-2147483632;c[Ib+4>>2]=14;Oc=He;Rc=5520;d=Oc+14|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[He+14>>0]=0;c[Jb+8>>2]=0;He=Jb+11|0;a[He>>0]=7;a[Jb>>0]=a[5535]|0;a[Jb+1>>0]=a[5536]|0;a[Jb+2>>0]=a[5537]|0;a[Jb+3>>0]=a[5538]|0;a[Jb+4>>0]=a[5539]|0;a[Jb+5>>0]=a[5540]|0;a[Jb+6>>0]=a[5541]|0;a[Jb+7>>0]=0;c[Kb>>2]=0;c[Kb+4>>2]=0;c[Kb+8>>2]=0;Ie=Ad(16)|0;c[Kb>>2]=Ie;c[Kb+8>>2]=-2147483632;c[Kb+4>>2]=11;Oc=Ie;Rc=5543;d=Oc+11|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Ie+11>>0]=0;$a(Id,Hb,Ib,Jb,Kb);Id=i+1488|0;c[Lb>>2]=0;c[Lb+4>>2]=0;c[Lb+8>>2]=0;Ie=Lb+11|0;a[Ie>>0]=9;Oc=Lb;Rc=5555;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Lb+9>>0]=0;c[Mb>>2]=0;c[Mb+4>>2]=0;c[Mb+8>>2]=0;Je=Ad(16)|0;c[Mb>>2]=Je;c[Mb+8>>2]=-2147483632;c[Mb+4>>2]=13;Oc=Je;Rc=5565;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Je+13>>0]=0;Je=Nb+11|0;a[Je>>0]=10;Oc=Nb;Rc=5579;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Nb+10>>0]=0;c[Ob>>2]=0;c[Ob+4>>2]=0;c[Ob+8>>2]=0;Ke=Ad(16)|0;c[Ob>>2]=Ke;c[Ob+8>>2]=-2147483632;c[Ob+4>>2]=14;Oc=Ke;Rc=5590;d=Oc+14|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Ke+14>>0]=0;$a(Id,Lb,Mb,Nb,Ob);Id=i+1536|0;c[Pb>>2]=0;c[Pb+4>>2]=0;c[Pb+8>>2]=0;Ke=Pb+11|0;a[Ke>>0]=6;a[Pb>>0]=a[5605]|0;a[Pb+1>>0]=a[5606]|0;a[Pb+2>>0]=a[5607]|0;a[Pb+3>>0]=a[5608]|0;a[Pb+4>>0]=a[5609]|0;a[Pb+5>>0]=a[5610]|0;a[Pb+6>>0]=0;c[Qb>>2]=0;c[Qb+4>>2]=0;c[Qb+8>>2]=0;Le=Ad(16)|0;c[Qb>>2]=Le;c[Qb+8>>2]=-2147483632;c[Qb+4>>2]=11;Oc=Le;Rc=5612;d=Oc+11|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Le+11>>0]=0;c[Rb>>2]=0;c[Rb+4>>2]=0;c[Rb+8>>2]=0;Le=Rb+11|0;a[Le>>0]=4;c[Rb>>2]=1952542562;a[Rb+4>>0]=0;c[Sb>>2]=0;c[Sb+4>>2]=0;c[Sb+8>>2]=0;Me=Sb+11|0;a[Me>>0]=8;Ne=Sb;c[Ne>>2]=1952542562;c[Ne+4>>2]=1735290926;a[Sb+8>>0]=0;$a(Id,Pb,Qb,Rb,Sb);Id=i+1584|0;c[Tb>>2]=0;c[Tb+4>>2]=0;c[Tb+8>>2]=0;Ne=Tb+11|0;a[Ne>>0]=6;a[Tb>>0]=a[5624]|0;a[Tb+1>>0]=a[5625]|0;a[Tb+2>>0]=a[5626]|0;a[Tb+3>>0]=a[5627]|0;a[Tb+4>>0]=a[5628]|0;a[Tb+5>>0]=a[5629]|0;a[Tb+6>>0]=0;c[Ub>>2]=0;c[Ub+4>>2]=0;c[Ub+8>>2]=0;Oe=Ub+11|0;a[Oe>>0]=8;Pe=Ub;c[Pe>>2]=1771291750;c[Pe+4>>2]=-1413191136;a[Ub+8>>0]=0;c[Vb>>2]=0;c[Vb+4>>2]=0;c[Vb+8>>2]=0;Pe=Vb+11|0;a[Pe>>0]=8;Qe=Vb;c[Qe>>2]=1886546273;c[Qe+4>>2]=1701732716;a[Vb+8>>0]=0;c[Wb>>2]=0;c[Wb+4>>2]=0;c[Wb+8>>2]=0;Qe=Ad(16)|0;c[Wb>>2]=Qe;c[Wb+8>>2]=-2147483632;c[Wb+4>>2]=12;Oc=Qe;Rc=5631;d=Oc+12|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Qe+12>>0]=0;$a(Id,Tb,Ub,Vb,Wb);Id=i+1632|0;c[Xb>>2]=0;c[Xb+4>>2]=0;c[Xb+8>>2]=0;Qe=Xb+11|0;a[Qe>>0]=9;Oc=Xb;Rc=5644;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Xb+9>>0]=0;c[Yb>>2]=0;c[Yb+4>>2]=0;c[Yb+8>>2]=0;Re=Ad(16)|0;c[Yb>>2]=Re;c[Yb+8>>2]=-2147483632;c[Yb+4>>2]=15;Oc=Re;Rc=5654;d=Oc+15|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Re+15>>0]=0;Re=Zb+11|0;a[Re>>0]=10;Oc=Zb;Rc=5670;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Zb+10>>0]=0;c[$b>>2]=0;c[$b+4>>2]=0;c[$b+8>>2]=0;Se=Ad(16)|0;c[$b>>2]=Se;c[$b+8>>2]=-2147483632;c[$b+4>>2]=14;Oc=Se;Rc=5681;d=Oc+14|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Se+14>>0]=0;$a(Id,Xb,Yb,Zb,$b);Id=i+1680|0;c[ac>>2]=0;c[ac+4>>2]=0;c[ac+8>>2]=0;Se=Ad(16)|0;c[ac>>2]=Se;c[ac+8>>2]=-2147483632;c[ac+4>>2]=12;Oc=Se;Rc=5696;d=Oc+12|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Se+12>>0]=0;c[bc>>2]=0;c[bc+4>>2]=0;c[bc+8>>2]=0;Se=Ad(32)|0;c[bc>>2]=Se;c[bc+8>>2]=-2147483616;c[bc+4>>2]=21;Oc=Se;Rc=5709;d=Oc+21|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Se+21>>0]=0;c[cc>>2]=0;c[cc+4>>2]=0;c[cc+8>>2]=0;Se=cc+11|0;a[Se>>0]=9;Oc=cc;Rc=5731;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[cc+9>>0]=0;c[dc>>2]=0;c[dc+4>>2]=0;c[dc+8>>2]=0;Te=Ad(16)|0;c[dc>>2]=Te;c[dc+8>>2]=-2147483632;c[dc+4>>2]=13;Oc=Te;Rc=5741;d=Oc+13|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[Te+13>>0]=0;$a(Id,ac,bc,cc,dc);Id=ec+4|0;c[Id>>2]=0;c[Id+4>>2]=0;Id=ec+11|0;a[Id>>0]=3;a[ec>>0]=a[5755]|0;a[ec+1>>0]=a[5756]|0;a[ec+2>>0]=a[5757]|0;a[ec+3>>0]=0;c[fc+8>>2]=0;Te=fc+11|0;a[Te>>0]=7;a[fc>>0]=a[5759]|0;a[fc+1>>0]=a[5760]|0;a[fc+2>>0]=a[5761]|0;a[fc+3>>0]=a[5762]|0;a[fc+4>>0]=a[5763]|0;a[fc+5>>0]=a[5764]|0;a[fc+6>>0]=a[5765]|0;a[fc+7>>0]=0;Ue=gc+4|0;c[Ue>>2]=0;c[Ue+4>>2]=0;Ue=gc+11|0;a[Ue>>0]=3;a[gc>>0]=a[5767]|0;a[gc+1>>0]=a[5768]|0;a[gc+2>>0]=a[5769]|0;a[gc+3>>0]=0;c[hc+8>>2]=0;Ve=hc+11|0;a[Ve>>0]=7;a[hc>>0]=a[5771]|0;a[hc+1>>0]=a[5772]|0;a[hc+2>>0]=a[5773]|0;a[hc+3>>0]=a[5774]|0;a[hc+4>>0]=a[5775]|0;a[hc+5>>0]=a[5776]|0;a[hc+6>>0]=a[5777]|0;a[hc+7>>0]=0;$a(i+1728|0,ec,fc,gc,hc);c[ic>>2]=0;c[ic+4>>2]=0;c[ic+8>>2]=0;We=ic+11|0;a[We>>0]=6;a[ic>>0]=a[5779]|0;a[ic+1>>0]=a[5780]|0;a[ic+2>>0]=a[5781]|0;a[ic+3>>0]=a[5782]|0;a[ic+4>>0]=a[5783]|0;a[ic+5>>0]=a[5784]|0;a[ic+6>>0]=0;c[jc>>2]=0;c[jc+4>>2]=0;c[jc+8>>2]=0;Xe=jc+11|0;a[Xe>>0]=8;Ye=jc;c[Ye>>2]=-2117834637;c[Ye+4>>2]=-2117835232;a[jc+8>>0]=0;c[kc>>2]=0;c[kc+4>>2]=0;c[kc+8>>2]=0;Ye=kc+11|0;a[Ye>>0]=4;c[kc>>2]=1634103155;a[kc+4>>0]=0;c[lc>>2]=0;c[lc+4>>2]=0;c[lc+8>>2]=0;Ze=lc+11|0;a[Ze>>0]=8;_e=lc;c[_e>>2]=1634103155;c[_e+4>>2]=1735290926;a[lc+8>>0]=0;$a(i+1776|0,ic,jc,kc,lc);_e=i+1824|0;c[mc>>2]=0;c[mc+4>>2]=0;c[mc+8>>2]=0;$e=mc+11|0;a[$e>>0]=6;a[mc>>0]=a[5786]|0;a[mc+1>>0]=a[5787]|0;a[mc+2>>0]=a[5788]|0;a[mc+3>>0]=a[5789]|0;a[mc+4>>0]=a[5790]|0;a[mc+5>>0]=a[5791]|0;a[mc+6>>0]=0;c[nc>>2]=0;c[nc+4>>2]=0;c[nc+8>>2]=0;af=nc+11|0;a[af>>0]=8;bf=nc;c[bf>>2]=-982161286;c[bf+4>>2]=1769611405;a[nc+8>>0]=0;c[oc>>2]=0;c[oc+4>>2]=0;c[oc+8>>2]=0;bf=oc+11|0;a[bf>>0]=5;a[oc>>0]=a[5793]|0;a[oc+1>>0]=a[5794]|0;a[oc+2>>0]=a[5795]|0;a[oc+3>>0]=a[5796]|0;a[oc+4>>0]=a[5797]|0;a[oc+5>>0]=0;c[pc>>2]=0;c[pc+4>>2]=0;c[pc+8>>2]=0;cf=pc+11|0;a[cf>>0]=9;Oc=pc;Rc=5799;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[pc+9>>0]=0;$a(_e,mc,nc,oc,pc);_e=i+1872|0;c[qc>>2]=0;c[qc+4>>2]=0;c[qc+8>>2]=0;df=qc+11|0;a[df>>0]=6;a[qc>>0]=a[5809]|0;a[qc+1>>0]=a[5810]|0;a[qc+2>>0]=a[5811]|0;a[qc+3>>0]=a[5812]|0;a[qc+4>>0]=a[5813]|0;a[qc+5>>0]=a[5814]|0;a[qc+6>>0]=0;c[rc>>2]=0;c[rc+4>>2]=0;c[rc+8>>2]=0;ef=rc+11|0;a[ef>>0]=6;a[rc>>0]=a[5816]|0;a[rc+1>>0]=a[5817]|0;a[rc+2>>0]=a[5818]|0;a[rc+3>>0]=a[5819]|0;a[rc+4>>0]=a[5820]|0;a[rc+5>>0]=a[5821]|0;a[rc+6>>0]=0;c[sc>>2]=0;c[sc+4>>2]=0;c[sc+8>>2]=0;ff=sc+11|0;a[ff>>0]=5;a[sc>>0]=a[5823]|0;a[sc+1>>0]=a[5824]|0;a[sc+2>>0]=a[5825]|0;a[sc+3>>0]=a[5826]|0;a[sc+4>>0]=a[5827]|0;a[sc+5>>0]=0;c[tc>>2]=0;c[tc+4>>2]=0;c[tc+8>>2]=0;gf=tc+11|0;a[gf>>0]=9;Oc=tc;Rc=5829;d=Oc+9|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[tc+9>>0]=0;$a(_e,qc,rc,sc,tc);_e=i+1920|0;c[uc>>2]=0;c[uc+4>>2]=0;c[uc+8>>2]=0;hf=uc+11|0;a[hf>>0]=6;a[uc>>0]=a[5839]|0;a[uc+1>>0]=a[5840]|0;a[uc+2>>0]=a[5841]|0;a[uc+3>>0]=a[5842]|0;a[uc+4>>0]=a[5843]|0;a[uc+5>>0]=a[5844]|0;a[uc+6>>0]=0;jf=vc+11|0;a[jf>>0]=10;Oc=vc;Rc=5846;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[vc+10>>0]=0;c[wc>>2]=0;c[wc+4>>2]=0;c[wc+8>>2]=0;kf=wc+11|0;a[kf>>0]=4;c[wc>>2]=1886216556;a[wc+4>>0]=0;c[xc>>2]=0;c[xc+4>>2]=0;c[xc+8>>2]=0;lf=xc+11|0;a[lf>>0]=8;mf=xc;c[mf>>2]=1886216556;c[mf+4>>2]=1735290926;a[xc+8>>0]=0;$a(_e,uc,vc,wc,xc);_e=i+1968|0;c[yc>>2]=0;c[yc+4>>2]=0;c[yc+8>>2]=0;mf=yc+11|0;a[mf>>0]=6;a[yc>>0]=a[5857]|0;a[yc+1>>0]=a[5858]|0;a[yc+2>>0]=a[5859]|0;a[yc+3>>0]=a[5860]|0;a[yc+4>>0]=a[5861]|0;a[yc+5>>0]=a[5862]|0;a[yc+6>>0]=0;nf=zc+11|0;a[nf>>0]=10;Oc=zc;Rc=5864;d=Oc+10|0;do{a[Oc>>0]=a[Rc>>0]|0;Oc=Oc+1|0;Rc=Rc+1|0}while((Oc|0)<(d|0));a[zc+10>>0]=0;c[Ac>>2]=0;c[Ac+4>>2]=0;c[Ac+8>>2]=0;of=Ac+11|0;a[of>>0]=4;c[Ac>>2]=1802724708;a[Ac+4>>0]=0;c[Bc>>2]=0;c[Bc+4>>2]=0;c[Bc+8>>2]=0;pf=Bc+11|0;a[pf>>0]=8;qf=Bc;c[qf>>2]=1802724708;c[qf+4>>2]=1735815982;a[Bc+8>>0]=0;$a(_e,yc,zc,Ac,Bc);c[k>>2]=0;_e=k+4|0;c[_e>>2]=0;qf=k+8|0;c[qf>>2]=0;rf=Ad(2016)|0;c[_e>>2]=rf;c[k>>2]=rf;c[qf>>2]=rf+2016;wb(rf,i);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+48|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+96|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+144|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+192|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+240|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+288|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+336|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+384|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+432|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+480|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+528|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+576|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+624|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+672|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+720|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+768|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+816|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+864|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+912|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+960|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1008|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1056|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1104|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1152|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1200|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1248|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1296|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1344|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1392|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1440|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1488|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1536|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1584|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1632|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1680|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1728|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1776|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1824|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1872|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1920|0);rf=(c[_e>>2]|0)+48|0;c[_e>>2]=rf;wb(rf,i+1968|0);c[_e>>2]=(c[_e>>2]|0)+48;rf=i+2016|0;do{qf=rf+-12|0;if((a[qf+11>>0]|0)<0)Bd(c[qf>>2]|0);qf=rf+-24|0;if((a[qf+11>>0]|0)<0)Bd(c[qf>>2]|0);qf=rf+-36|0;rf=rf+-48|0;if((a[qf+11>>0]|0)<0)Bd(c[qf>>2]|0);if((a[rf+11>>0]|0)<0)Bd(c[rf>>2]|0)}while((rf|0)!=(i|0));if((a[pf>>0]|0)<0)Bd(c[Bc>>2]|0);if((a[of>>0]|0)<0)Bd(c[Ac>>2]|0);if((a[nf>>0]|0)<0)Bd(c[zc>>2]|0);if((a[mf>>0]|0)<0)Bd(c[yc>>2]|0);if((a[lf>>0]|0)<0)Bd(c[xc>>2]|0);if((a[kf>>0]|0)<0)Bd(c[wc>>2]|0);if((a[jf>>0]|0)<0)Bd(c[vc>>2]|0);if((a[hf>>0]|0)<0)Bd(c[uc>>2]|0);if((a[gf>>0]|0)<0)Bd(c[tc>>2]|0);if((a[ff>>0]|0)<0)Bd(c[sc>>2]|0);if((a[ef>>0]|0)<0)Bd(c[rc>>2]|0);if((a[df>>0]|0)<0)Bd(c[qc>>2]|0);if((a[cf>>0]|0)<0)Bd(c[pc>>2]|0);if((a[bf>>0]|0)<0)Bd(c[oc>>2]|0);if((a[af>>0]|0)<0)Bd(c[nc>>2]|0);if((a[$e>>0]|0)<0)Bd(c[mc>>2]|0);if((a[Ze>>0]|0)<0)Bd(c[lc>>2]|0);if((a[Ye>>0]|0)<0)Bd(c[kc>>2]|0);if((a[Xe>>0]|0)<0)Bd(c[jc>>2]|0);if((a[We>>0]|0)<0)Bd(c[ic>>2]|0);if((a[Ve>>0]|0)<0)Bd(c[hc>>2]|0);if((a[Ue>>0]|0)<0)Bd(c[gc>>2]|0);if((a[Te>>0]|0)<0)Bd(c[fc>>2]|0);if((a[Id>>0]|0)<0)Bd(c[ec>>2]|0);if((a[dc+11>>0]|0)<0)Bd(c[dc>>2]|0);if((a[Se>>0]|0)<0)Bd(c[cc>>2]|0);if((a[bc+11>>0]|0)<0)Bd(c[bc>>2]|0);if((a[ac+11>>0]|0)<0)Bd(c[ac>>2]|0);if((a[$b+11>>0]|0)<0)Bd(c[$b>>2]|0);if((a[Re>>0]|0)<0)Bd(c[Zb>>2]|0);if((a[Yb+11>>0]|0)<0)Bd(c[Yb>>2]|0);if((a[Qe>>0]|0)<0)Bd(c[Xb>>2]|0);if((a[Wb+11>>0]|0)<0)Bd(c[Wb>>2]|0);if((a[Pe>>0]|0)<0)Bd(c[Vb>>2]|0);if((a[Oe>>0]|0)<0)Bd(c[Ub>>2]|0);if((a[Ne>>0]|0)<0)Bd(c[Tb>>2]|0);if((a[Me>>0]|0)<0)Bd(c[Sb>>2]|0);if((a[Le>>0]|0)<0)Bd(c[Rb>>2]|0);if((a[Qb+11>>0]|0)<0)Bd(c[Qb>>2]|0);if((a[Ke>>0]|0)<0)Bd(c[Pb>>2]|0);if((a[Ob+11>>0]|0)<0)Bd(c[Ob>>2]|0);if((a[Je>>0]|0)<0)Bd(c[Nb>>2]|0);if((a[Mb+11>>0]|0)<0)Bd(c[Mb>>2]|0);if((a[Ie>>0]|0)<0)Bd(c[Lb>>2]|0);if((a[Kb+11>>0]|0)<0)Bd(c[Kb>>2]|0);if((a[He>>0]|0)<0)Bd(c[Jb>>2]|0);if((a[Ib+11>>0]|0)<0)Bd(c[Ib>>2]|0);if((a[Ge>>0]|0)<0)Bd(c[Hb>>2]|0);if((a[Fe>>0]|0)<0)Bd(c[Gb>>2]|0);if((a[Ee>>0]|0)<0)Bd(c[Fb>>2]|0);if((a[De>>0]|0)<0)Bd(c[Eb>>2]|0);if((a[Ce>>0]|0)<0)Bd(c[Db>>2]|0);if((a[Be>>0]|0)<0)Bd(c[Cb>>2]|0);if((a[Ae>>0]|0)<0)Bd(c[Bb>>2]|0);if((a[ze>>0]|0)<0)Bd(c[Ab>>2]|0);if((a[ye>>0]|0)<0)Bd(c[zb>>2]|0);if((a[yb+11>>0]|0)<0)Bd(c[yb>>2]|0);if((a[xe>>0]|0)<0)Bd(c[xb>>2]|0);if((a[vb+11>>0]|0)<0)Bd(c[vb>>2]|0);if((a[we>>0]|0)<0)Bd(c[ub>>2]|0);if((a[tb+11>>0]|0)<0)Bd(c[tb>>2]|0);if((a[ve>>0]|0)<0)Bd(c[sb>>2]|0);if((a[rb+11>>0]|0)<0)Bd(c[rb>>2]|0);if((a[ue>>0]|0)<0)Bd(c[qb>>2]|0);if((a[pb+11>>0]|0)<0)Bd(c[pb>>2]|0);if((a[te>>0]|0)<0)Bd(c[ob>>2]|0);if((a[se>>0]|0)<0)Bd(c[nb>>2]|0);if((a[re>>0]|0)<0)Bd(c[mb>>2]|0);if((a[qe>>0]|0)<0)Bd(c[lb>>2]|0);if((a[pe>>0]|0)<0)Bd(c[kb>>2]|0);if((a[jb+11>>0]|0)<0)Bd(c[jb>>2]|0);if((a[oe>>0]|0)<0)Bd(c[ib>>2]|0);if((a[ne>>0]|0)<0)Bd(c[hb>>2]|0);if((a[me>>0]|0)<0)Bd(c[gb>>2]|0);if((a[fb+11>>0]|0)<0)Bd(c[fb>>2]|0);if((a[eb+11>>0]|0)<0)Bd(c[eb>>2]|0);if((a[db+11>>0]|0)<0)Bd(c[db>>2]|0);if((a[le>>0]|0)<0)Bd(c[_a>>2]|0);if((a[Za+11>>0]|0)<0)Bd(c[Za>>2]|0);if((a[ke>>0]|0)<0)Bd(c[Ya>>2]|0);if((a[je>>0]|0)<0)Bd(c[Xa>>2]|0);if((a[ie>>0]|0)<0)Bd(c[Wa>>2]|0);if((a[Va+11>>0]|0)<0)Bd(c[Va>>2]|0);if((a[he>>0]|0)<0)Bd(c[Ua>>2]|0);if((a[ge>>0]|0)<0)Bd(c[Ta>>2]|0);if((a[fe>>0]|0)<0)Bd(c[Sa>>2]|0);if((a[ee>>0]|0)<0)Bd(c[Ra>>2]|0);if((a[de>>0]|0)<0)Bd(c[Qa>>2]|0);if((a[ce>>0]|0)<0)Bd(c[Pa>>2]|0);if((a[be>>0]|0)<0)Bd(c[Oa>>2]|0);if((a[Na+11>>0]|0)<0)Bd(c[Na>>2]|0);if((a[ae>>0]|0)<0)Bd(c[Ma>>2]|0);if((a[$d>>0]|0)<0)Bd(c[Ka>>2]|0);if((a[_d>>0]|0)<0)Bd(c[Ja>>2]|0);if((a[Ia+11>>0]|0)<0)Bd(c[Ia>>2]|0);if((a[Zd>>0]|0)<0)Bd(c[Ha>>2]|0);if((a[Ga+11>>0]|0)<0)Bd(c[Ga>>2]|0);if((a[Yd>>0]|0)<0)Bd(c[Fa>>2]|0);if((a[Xd>>0]|0)<0)Bd(c[Ca>>2]|0);if((a[Wd>>0]|0)<0)Bd(c[Ba>>2]|0);if((a[Aa+11>>0]|0)<0)Bd(c[Aa>>2]|0);if((a[Vd>>0]|0)<0)Bd(c[za>>2]|0);if((a[ya+11>>0]|0)<0)Bd(c[ya>>2]|0);if((a[Ud>>0]|0)<0)Bd(c[xa>>2]|0);if((a[Td>>0]|0)<0)Bd(c[wa>>2]|0);if((a[Sd>>0]|0)<0)Bd(c[va>>2]|0);if((a[Rd>>0]|0)<0)Bd(c[ua>>2]|0);if((a[Qd>>0]|0)<0)Bd(c[ta>>2]|0);if((a[Pd>>0]|0)<0)Bd(c[sa>>2]|0);if((a[Od>>0]|0)<0)Bd(c[ra>>2]|0);if((a[qa+11>>0]|0)<0)Bd(c[qa>>2]|0);if((a[Nd>>0]|0)<0)Bd(c[pa>>2]|0);if((a[Md>>0]|0)<0)Bd(c[oa>>2]|0);if((a[Ld>>0]|0)<0)Bd(c[na>>2]|0);if((a[Kd>>0]|0)<0)Bd(c[ma>>2]|0);if((a[Jd>>0]|0)<0)Bd(c[la>>2]|0);if((a[Hd>>0]|0)<0)Bd(c[ka>>2]|0);if((a[Gd>>0]|0)<0)Bd(c[ja>>2]|0);if((a[Fd>>0]|0)<0)Bd(c[ia>>2]|0);if((a[md>>0]|0)<0)Bd(c[ha>>2]|0);if((a[ga+11>>0]|0)<0)Bd(c[ga>>2]|0);if((a[Ed>>0]|0)<0)Bd(c[fa>>2]|0);if((a[Dd>>0]|0)<0)Bd(c[ea>>2]|0);if((a[Cd>>0]|0)<0)Bd(c[da>>2]|0);if((a[ca+11>>0]|0)<0)Bd(c[ca>>2]|0);if((a[yd>>0]|0)<0)Bd(c[ba>>2]|0);if((a[aa+11>>0]|0)<0)Bd(c[aa>>2]|0);if((a[xd>>0]|0)<0)Bd(c[$>>2]|0);if((a[wd>>0]|0)<0)Bd(c[_>>2]|0);if((a[vd>>0]|0)<0)Bd(c[Z>>2]|0);if((a[Y+11>>0]|0)<0)Bd(c[Y>>2]|0);if((a[ud>>0]|0)<0)Bd(c[X>>2]|0);if((a[td>>0]|0)<0)Bd(c[W>>2]|0);if((a[sd>>0]|0)<0)Bd(c[V>>2]|0);if((a[U+11>>0]|0)<0)Bd(c[U>>2]|0);if((a[qd>>0]|0)<0)Bd(c[T>>2]|0);if((a[S+11>>0]|0)<0)Bd(c[S>>2]|0);if((a[pd>>0]|0)<0)Bd(c[R>>2]|0);if((a[od>>0]|0)<0)Bd(c[Q>>2]|0);if((a[nd>>0]|0)<0)Bd(c[P>>2]|0);if((a[ld>>0]|0)<0)Bd(c[O>>2]|0);if((a[kd>>0]|0)<0)Bd(c[N>>2]|0);if((a[jd>>0]|0)<0)Bd(c[M>>2]|0);if((a[Tc>>0]|0)<0)Bd(c[L>>2]|0);if((a[id>>0]|0)<0)Bd(c[K>>2]|0);if((a[hd>>0]|0)<0)Bd(c[J>>2]|0);if((a[gd>>0]|0)<0)Bd(c[I>>2]|0);if((a[fd>>0]|0)<0)Bd(c[H>>2]|0);if((a[G+11>>0]|0)<0)Bd(c[G>>2]|0);if((a[ed>>0]|0)<0)Bd(c[F>>2]|0);if((a[dd>>0]|0)<0)Bd(c[E>>2]|0);if((a[cd>>0]|0)<0)Bd(c[D>>2]|0);if((a[bd>>0]|0)<0)Bd(c[C>>2]|0);if((a[ad>>0]|0)<0)Bd(c[B>>2]|0);if((a[$c>>0]|0)<0)Bd(c[A>>2]|0);if((a[_c>>0]|0)<0)Bd(c[z>>2]|0);if((a[Zc>>0]|0)<0)Bd(c[y>>2]|0);if((a[Yc>>0]|0)<0)Bd(c[v>>2]|0);if((a[Xc>>0]|0)<0)Bd(c[u>>2]|0);if((a[Wc>>0]|0)<0)Bd(c[t>>2]|0);if((a[s+11>>0]|0)<0)Bd(c[s>>2]|0);if((a[Vc>>0]|0)<0)Bd(c[r>>2]|0);if((a[q+11>>0]|0)<0)Bd(c[q>>2]|0);if((a[Uc>>0]|0)<0)Bd(c[p>>2]|0);if((a[o+11>>0]|0)<0)Bd(c[o>>2]|0);if((a[Sc>>0]|0)<0)Bd(c[n>>2]|0);if((a[Qc>>0]|0)<0)Bd(c[m>>2]|0);if((a[Pc>>0]|0)<0)Bd(c[l>>2]|0);l=rd()|0;w()|0;c[Cc>>2]=c[k>>2];c[Dc>>2]=c[_e>>2];_e=(l>>>0)%2147483647|0;c[Ec>>2]=(_e|0)==0?1:_e;c[j>>2]=c[Cc>>2];c[i>>2]=c[Dc>>2];ab(j,i,Ec);Dc=e;c[Dc>>2]=0;c[Dc+4>>2]=2;f[Ec>>2]=135.0;f[Ec+4>>2]=75.0;f[Gc>>2]=.5;f[Gc+4>>2]=.5;f[Hc>>2]=0.0;f[Hc+4>>2]=0.0;f[Ic>>2]=.800000011920929;f[Ic+4>>2]=.800000011920929;f[Jc>>2]=0.0;f[Jc+4>>2]=0.0;f[Kc>>2]=.5;f[Kc+4>>2]=.5;c[Lc>>2]=5;c[Lc+4>>2]=5;f[Mc>>2]=143.0;f[Mc+4>>2]=83.0;Dc=Nc+16|0;c[Dc>>2]=0;e=Ad(20)|0;c[e>>2]=3220;c[e+4>>2]=b;c[e+8>>2]=k;c[e+12>>2]=g;c[e+16>>2]=Ec;c[Dc>>2]=e;c[j>>2]=c[Lc>>2];c[j+4>>2]=c[Lc+4>>2];c[i>>2]=c[Mc>>2];c[i+4>>2]=c[Mc+4>>2];bb(Fc,Gc,Hc,Ic,Jc,Kc,j,i,0,Nc,g);Oc=b+28|0;Rc=Fc+4|0;d=Oc+72|0;do{c[Oc>>2]=c[Rc>>2];Oc=Oc+4|0;Rc=Rc+4|0}while((Oc|0)<(d|0));Rc=b+100|0;Oc=Fc+76|0;c[Rc>>2]=c[Oc>>2];c[Rc+4>>2]=c[Oc+4>>2];c[Rc+8>>2]=c[Oc+8>>2];c[Rc+12>>2]=c[Oc+12>>2];a[Rc+16>>0]=a[Oc+16>>0]|0;a[i>>0]=a[j>>0]|0;_b(b+120|0,Fc+96|0,i);i=Fc+116|0;j=c[i>>2]|0;Oc=Fc+120|0;Rc=c[Oc>>2]|0;c[i>>2]=0;c[Oc>>2]=0;c[b+140>>2]=j;j=b+144|0;i=c[j>>2]|0;c[j>>2]=Rc;do if(i|0){Rc=i+4|0;j=c[Rc>>2]|0;c[Rc>>2]=j+-1;if(j|0)break;La[c[(c[i>>2]|0)+8>>2]&31](i);zd(i)}while(0);i=b+148|0;j=Fc+124|0;Rc=c[i>>2]|0;if(!Rc){sf=b+156|0;tf=b+152|0}else{d=b+152|0;c[d>>2]=Rc;Bd(Rc);Rc=b+156|0;c[Rc>>2]=0;c[d>>2]=0;c[i>>2]=0;sf=Rc;tf=d}c[i>>2]=c[j>>2];i=Fc+128|0;c[tf>>2]=c[i>>2];tf=Fc+132|0;c[sf>>2]=c[tf>>2];c[tf>>2]=0;c[i>>2]=0;c[j>>2]=0;j=b+160|0;b=Fc+136|0;c[j>>2]=c[b>>2];c[j+4>>2]=c[b+4>>2];c[j+8>>2]=c[b+8>>2];c[j+12>>2]=c[b+12>>2];c[Fc>>2]=3172;b=c[Oc>>2]|0;do if(b|0){Oc=b+4|0;j=c[Oc>>2]|0;c[Oc>>2]=j+-1;if(j|0)break;La[c[(c[b>>2]|0)+8>>2]&31](b);zd(b)}while(0);b=c[Fc+104>>2]|0;if(b|0){j=b;do{b=j;j=c[j>>2]|0;Oc=c[b+20>>2]|0;do if(Oc|0){i=Oc+4|0;tf=c[i>>2]|0;c[i>>2]=tf+-1;if(tf|0)break;La[c[(c[Oc>>2]|0)+8>>2]&31](Oc);zd(Oc)}while(0);Bd(b)}while((j|0)!=0)}j=Fc+96|0;Fc=c[j>>2]|0;c[j>>2]=0;if(Fc|0)Bd(Fc);Fc=c[Dc>>2]|0;if((Nc|0)==(Fc|0)){La[c[(c[Fc>>2]|0)+16>>2]&31](Fc);cb(k);Da=h;return}if(!Fc){cb(k);Da=h;return}La[c[(c[Fc>>2]|0)+20>>2]&31](Fc);cb(k);Da=h;return}function _a(a){a=a|0;Y(a|0)|0;qe()}function $a(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Jd(a,b);Jd(a+12|0,c);Jd(a+24|0,d);Jd(a+36|0,e);return}function ab(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Da;Da=Da+64|0;if((Da|0)>=(Ea|0))x(64);g=f+8|0;h=f;i=c[d>>2]|0;j=c[b>>2]|0;k=i-j|0;l=j;if((k|0)<=48){Da=f;return}c[h>>2]=0;c[h+4>>2]=2147483647;j=i+-48|0;c[d>>2]=j;if(j>>>0>l>>>0){d=g+4|0;i=g+12|0;m=g+24|0;n=g+36|0;o=n+11|0;p=m+11|0;q=i+11|0;r=g+11|0;s=(k>>>0)/48|0;k=l;do{s=s+-1|0;c[g>>2]=0;c[d>>2]=s;l=xb(h,e,g)|0;if(l|0){t=k+(l*48|0)|0;c[g>>2]=c[k>>2];c[g+4>>2]=c[k+4>>2];c[g+8>>2]=c[k+8>>2];c[k>>2]=0;c[k+4>>2]=0;c[k+8>>2]=0;l=k+12|0;c[i>>2]=c[l>>2];c[i+4>>2]=c[l+4>>2];c[i+8>>2]=c[l+8>>2];c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;l=k+24|0;c[m>>2]=c[l>>2];c[m+4>>2]=c[l+4>>2];c[m+8>>2]=c[l+8>>2];c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;l=k+36|0;c[n>>2]=c[l>>2];c[n+4>>2]=c[l+4>>2];c[n+8>>2]=c[l+8>>2];c[l>>2]=0;c[l+4>>2]=0;c[l+8>>2]=0;zb(k,t)|0;zb(t,g)|0;if((a[o>>0]|0)<0)Bd(c[n>>2]|0);if((a[p>>0]|0)<0)Bd(c[m>>2]|0);if((a[q>>0]|0)<0)Bd(c[i>>2]|0);if((a[r>>0]|0)<0)Bd(c[g>>2]|0)}k=k+48|0;c[b>>2]=k}while(k>>>0<j>>>0)}Da=f;return}function bb(b,d,e,g,i,j,k,l,m,n,o){b=b|0;d=d|0;e=e|0;g=g|0;i=i|0;j=j|0;k=k|0;l=l|0;m=m|0;n=n|0;o=o|0;var p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0,C=0.0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0.0,L=0.0,M=0.0,N=0.0,O=0.0,P=0.0,Q=0.0,R=0.0,S=0,T=0.0,U=0.0,V=0,W=0,Y=0.0,Z=0.0,_=0.0,aa=0.0,ba=0.0,ca=0.0,da=0,ea=0,fa=0,ga=0,ha=0.0,ia=0,ja=0.0,ka=0.0,la=0.0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0;p=Da;Da=Da+32|0;if((Da|0)>=(Ea|0))x(32);q=p;r=p+24|0;s=p+20|0;t=p+16|0;u=p+8|0;c[b>>2]=3196;v=b+4|0;c[v>>2]=0;c[v+4>>2]=0;c[v+8>>2]=0;c[v+12>>2]=0;v=d;d=c[v+4>>2]|0;w=b+20|0;c[w>>2]=c[v>>2];c[w+4>>2]=d;d=g;g=c[d+4>>2]|0;w=b+28|0;c[w>>2]=c[d>>2];c[w+4>>2]=g;g=e;e=c[g+4>>2]|0;w=b+36|0;c[w>>2]=c[g>>2];c[w+4>>2]=e;e=i;i=c[e+4>>2]|0;w=b+44|0;c[w>>2]=c[e>>2];c[w+4>>2]=i;i=j;j=c[i+4>>2]|0;w=b+52|0;c[w>>2]=c[i>>2];c[w+4>>2]=j;j=b+60|0;f[j>>2]=-1.0;a[b+64>>0]=1;c[b+68>>2]=0;c[b+72>>2]=0;c[b>>2]=3172;w=k;i=c[w>>2]|0;e=c[w+4>>2]|0;w=b+76|0;c[w>>2]=i;c[w+4>>2]=e;e=l;w=c[e>>2]|0;g=c[e+4>>2]|0;e=b+84|0;c[e>>2]=w;c[e+4>>2]=g;g=b+92|0;a[g>>0]=m&1;e=b+96|0;c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;c[e+12>>2]=0;c[b+112>>2]=1065353216;d=b+116|0;v=b+120|0;y=o+4|0;c[d>>2]=0;c[d+4>>2]=0;c[d+8>>2]=0;c[d+12>>2]=0;c[d+16>>2]=0;a[d+20>>0]=0;z=((c[y>>2]|0)-(c[o>>2]|0)|0)/80|0;if((i|0)<=0){A=i;B=z;C=(c[h>>2]=w,+f[h>>2]);D=c[k+4>>2]|0;E=B+-1|0;F=b+68|0;G=F;H=G;c[H>>2]=z;I=G+4|0;J=I;c[J>>2]=E;K=+(A|0);L=K;M=m?.5:0.0;N=M+L;O=C;P=N*O;Q=P;R=+(D|0);S=l+4|0;T=+f[S>>2];U=T*R;V=b+12|0;f[V>>2]=Q;W=b+16|0;f[W>>2]=U;Y=C/T;Z=Y;_=N*Z;aa=R;ba=_/aa;ca=ba;f[j>>2]=ca;Da=p;return}w=k+4|0;i=b+84|0;da=b+88|0;ea=n+16|0;n=u+4|0;fa=0;ga=c[w>>2]|0;a:while(1){if((ga|0)>0){ha=+(fa|0);ia=0;while(1){ja=+f[i>>2];ka=ja*.5;la=((ia&1|0)==0|(a[g>>0]|0)==0?0.0:ka)+(ja*ha+ka);ka=+f[da>>2];c[q>>2]=fa;c[r>>2]=ia;f[s>>2]=la;f[t>>2]=ka*+(ia|0)+ka*.5;ma=c[ea>>2]|0;if(!ma){na=10;break a}Qa[c[(c[ma>>2]|0)+24>>2]&7](u,ma,q,r,s,t);ma=q;c[ma>>2]=ia;c[ma+4>>2]=fa;ma=sb(e,q)|0;oa=c[u>>2]|0;pa=c[n>>2]|0;if(pa|0){qa=pa+4|0;c[qa>>2]=(c[qa>>2]|0)+1}c[ma>>2]=oa;oa=ma+4|0;ma=c[oa>>2]|0;c[oa>>2]=pa;if(ma|0?(pa=ma+4|0,oa=c[pa>>2]|0,c[pa>>2]=oa+-1,(oa|0)==0):0){La[c[(c[ma>>2]|0)+8>>2]&31](ma);zd(ma)}ma=c[u>>2]|0;oa=c[n>>2]|0;if(oa|0){pa=oa+4|0;c[pa>>2]=(c[pa>>2]|0)+1}c[d>>2]=ma;ma=c[v>>2]|0;c[v>>2]=oa;if(ma|0?(oa=ma+4|0,pa=c[oa>>2]|0,c[oa>>2]=pa+-1,(pa|0)==0):0){La[c[(c[ma>>2]|0)+8>>2]&31](ma);zd(ma)}ma=c[n>>2]|0;if(ma|0?(pa=ma+4|0,oa=c[pa>>2]|0,c[pa>>2]=oa+-1,(oa|0)==0):0){La[c[(c[ma>>2]|0)+8>>2]&31](ma);zd(ma)}ia=ia+1|0;ma=c[w>>2]|0;if((ia|0)>=(ma|0)){ra=ma;break}}}else ra=ga;fa=fa+1|0;sa=c[k>>2]|0;if((fa|0)>=(sa|0))break;else ga=ra}if((na|0)==10){na=X(4)|0;c[na>>2]=3864;$(na|0,2928,16)}A=sa;B=((c[y>>2]|0)-(c[o>>2]|0)|0)/80|0;C=+f[l>>2];D=ra;E=B+-1|0;F=b+68|0;G=F;H=G;c[H>>2]=z;I=G+4|0;J=I;c[J>>2]=E;K=+(A|0);L=K;M=m?.5:0.0;N=M+L;O=C;P=N*O;Q=P;R=+(D|0);S=l+4|0;T=+f[S>>2];U=T*R;V=b+12|0;f[V>>2]=Q;W=b+16|0;f[W>>2]=U;Y=C/T;Z=Y;_=N*Z;aa=R;ba=_/aa;ca=ba;f[j>>2]=ca;Da=p;return}function cb(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[b>>2]|0;if(!d)return;e=b+4|0;f=c[e>>2]|0;if((f|0)==(d|0))g=d;else{h=f;do{f=h+-12|0;if((a[f+11>>0]|0)<0)Bd(c[f>>2]|0);f=h+-24|0;if((a[f+11>>0]|0)<0)Bd(c[f>>2]|0);f=h+-36|0;h=h+-48|0;if((a[f+11>>0]|0)<0)Bd(c[f>>2]|0);if((a[h+11>>0]|0)<0)Bd(c[h>>2]|0)}while((h|0)!=(d|0));g=c[b>>2]|0}c[e>>2]=d;Bd(g);return}function db(a,b,c){a=a|0;b=+b;c=c|0;return 0}function eb(a,b){a=a|0;b=b|0;return}function fb(a,b){a=a|0;b=b|0;return}function gb(a,b){a=a|0;b=b|0;od(6753)|0;$b(a+24|0,b,c[a+4>>2]|0);return}function hb(b,d){b=b|0;d=d|0;var e=0,f=0;d=b+24|0;e=c[b+4>>2]|0;if((c[b+152>>2]|0)-(c[b+148>>2]|0)>>3>>>0>2){cc(d,e);f=b+160|0;a[f>>0]=0;return}else{ac(d,e);f=b+160|0;a[f>>0]=0;return}}function ib(a,b){a=a|0;b=b|0;dc(a+24|0,b,c[a+4>>2]|0);return}function jb(a){a=a|0;return}function kb(a,b,d){a=a|0;b=b|0;d=d|0;mb(a+24|0,b,d,c[a+4>>2]|0);return}function lb(a){a=a|0;return}function mb(b,d,e,g){b=b|0;d=d|0;e=e|0;g=g|0;var h=0.0,i=0.0,j=0.0,k=0,l=0,m=0.0,n=0,o=0.0,p=0.0,q=0,r=0,s=0,t=0.0,u=0.0,v=0,w=0.0,x=0.0,y=0.0,z=0.0,A=0.0,B=0.0,C=0,D=0,E=0,F=0,G=0,H=0;qb(b,d,e,g);e=b+80|0;h=+(c[e>>2]|0);i=+f[b+16>>2]/h;d=b+76|0;j=+(c[d>>2]|0);k=b+92|0;l=a[k>>0]|0;m=+f[b+12>>2]/((l<<24>>24==0?0.0:.5)+j);n=c[b+104>>2]|0;if(!n){o=j;p=h;q=l;r=b+84|0;f[r>>2]=m;s=b+88|0;f[s>>2]=i;t=m/i;u=t;v=q<<24>>24==0;w=v?0.0:.5;x=w+o;y=x*u;z=p;A=y/z;B=A;C=b+60|0;f[C>>2]=B;rb(b,g);return}l=n;do{n=l;D=c[n+16>>2]|0;E=c[n+20>>2]|0;n=(E|0)==0;if(!n){F=E+4|0;c[F>>2]=(c[F>>2]|0)+1}F=(c[g>>2]|0)+((c[D+68>>2]|0)*80|0)|0;G=c[F+4>>2]|0;H=D+4|0;c[H>>2]=c[F>>2];c[H+4>>2]=G;f[D+12>>2]=m;f[D+16>>2]=i;if(!n?(n=E+4|0,D=c[n>>2]|0,c[n>>2]=D+-1,(D|0)==0):0){La[c[(c[E>>2]|0)+8>>2]&31](E);zd(E)}l=c[l>>2]|0}while((l|0)!=0);o=+(c[d>>2]|0);p=+(c[e>>2]|0);q=a[k>>0]|0;r=b+84|0;f[r>>2]=m;s=b+88|0;f[s>>2]=i;t=m/i;u=t;v=q<<24>>24==0;w=v?0.0:.5;x=w+o;y=x*u;z=p;A=y/z;B=A;C=b+60|0;f[C>>2]=B;rb(b,g);return}function nb(a,b,c){a=a|0;b=b|0;c=c|0;return}function ob(a,b){a=a|0;b=b|0;return}function pb(a,b){a=a|0;b=b|0;return 0}function qb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0.0,o=0.0,p=0.0,q=0.0,r=0.0,s=0.0,t=0.0,u=0.0,v=0;h=Da;Da=Da+80|0;if((Da|0)>=(Ea|0))x(80);i=h+64|0;j=h+48|0;k=h+32|0;l=h+16|0;m=h;n=+f[d>>2];o=+f[a+28>>2]*n+ +f[a+44>>2];p=+f[d+4>>2];q=+f[a+32>>2]*p+ +f[a+48>>2];r=+f[a+60>>2];if(r>0.0){s=q*r;if(s<o){t=s;u=q}else{t=o;u=o/r}}else{t=o;u=q}q=+f[b>>2];o=+f[a+36>>2]+(q+n*+f[a+20>>2]-t*+f[a+52>>2]);n=+f[b+4>>2];r=+f[a+40>>2]+(n+p*+f[a+24>>2]-u*+f[a+56>>2]);g[m>>3]=q;g[m+8>>3]=n;md(5919,m)|0;m=a+4|0;b=a+8|0;n=+f[b>>2];g[l>>3]=+f[m>>2];g[l+8>>3]=n;md(5971,l)|0;g[k>>3]=o;g[k+8>>3]=r;md(6021,k)|0;k=a+12|0;l=a+16|0;n=+f[l>>2];g[j>>3]=+f[k>>2];g[j+8>>3]=n;md(6074,j)|0;g[i>>3]=t;g[i+8>>3]=u;md(6120,i)|0;i=c[a+68>>2]|0;j=a+72|0;if((i|0)>(c[j>>2]|0)){f[m>>2]=o;f[b>>2]=r;f[k>>2]=t;f[l>>2]=u;Da=h;return}a=i;while(1){i=c[e>>2]|0;d=i+(a*80|0)|0;v=i+(a*80|0)+4|0;n=r+u*((+f[v>>2]-+f[b>>2])/+f[l>>2]);f[d>>2]=o+t*((+f[d>>2]-+f[m>>2])/+f[k>>2]);f[v>>2]=n;v=c[e>>2]|0;if((c[v+(a*80|0)+32>>2]|0)!=2){n=u*(+f[i+(a*80|0)+12>>2]/+f[l>>2]);f[v+(a*80|0)+8>>2]=t*(+f[i+(a*80|0)+8>>2]/+f[k>>2]);f[v+(a*80|0)+12>>2]=n}if((a|0)<(c[j>>2]|0))a=a+1|0;else break}f[m>>2]=o;f[b>>2]=r;f[k>>2]=t;f[l>>2]=u;Da=h;return}function rb(b,d){b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0.0,u=0,v=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0.0,F=0.0,G=0.0,H=0,I=0,J=0.0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0;e=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);g=e+8|0;h=e;i=b+76|0;j=c[i>>2]|0;if((j|0)<=0){Da=e;return}k=b+80|0;l=b+96|0;m=b+84|0;n=b+92|0;o=b+88|0;p=b+100|0;q=b+104|0;r=b+108|0;b=0;s=j;while(1){j=c[k>>2]|0;if((j|0)>0){t=+(b|0);u=j;j=0;while(1){v=u;u=u+-1|0;y=Le(0,b|0,u|0,((u|0)<0)<<31>>31|0)|0;z=w()|0;A=g;c[A>>2]=y;c[A+4>>2]=z;z=sb(l,g)|0;A=c[z>>2]|0;y=c[z+4>>2]|0;z=(y|0)==0;if(!z){B=y+4|0;c[B>>2]=(c[B>>2]|0)+1}B=A;if(!(a[B+64>>0]|0))C=j+1|0;else{D=u+j|0;E=+f[m>>2];F=E*.5;G=((D&1|0)==0|(a[n>>0]|0)==0?0.0:F)+(E*t+F);F=+f[o>>2];E=F*+(D|0)+F*.5;H=B+4|0;F=G-+f[H>>2];I=B+8|0;J=E-+f[I>>2];f[H>>2]=G;f[I>>2]=E;f[B+36>>2]=G;f[B+40>>2]=E;I=c[B+68>>2]|0;H=B+72|0;if((I|0)<=(c[H>>2]|0)){B=I;while(1){I=c[d>>2]|0;E=F+ +f[I+(B*80|0)>>2];G=J+ +f[I+(B*80|0)+4>>2];f[I+(B*80|0)+36>>2]=50.0;f[I+(B*80|0)+40>>2]=E;f[I+(B*80|0)+44>>2]=G;K=I+(B*80|0)+76|0;c[K>>2]=c[K>>2]|1;if((B|0)<(c[H>>2]|0))B=B+1|0;else break}}B=Le(0,b|0,D|0,((D|0)<0)<<31>>31|0)|0;H=w()|0;K=h;c[K>>2]=B;c[K+4>>2]=H;H=vb(l,g)|0;if(H|0){K=c[p>>2]|0;B=c[H+4>>2]|0;I=K+-1|0;L=(I&K|0)==0;if(!L)if(B>>>0<K>>>0)M=B;else M=(B>>>0)%(K>>>0)|0;else M=I&B;B=(c[l>>2]|0)+(M<<2)|0;N=c[B>>2]|0;while(1){O=c[N>>2]|0;if((O|0)==(H|0))break;else N=O}if((N|0)!=(q|0)){D=c[N+4>>2]|0;if(!L)if(D>>>0<K>>>0)P=D;else P=(D>>>0)%(K>>>0)|0;else P=D&I;if((P|0)==(M|0))Q=H;else R=28}else R=28;do if((R|0)==28){R=0;D=c[H>>2]|0;if(D|0){O=c[D+4>>2]|0;if(!L)if(O>>>0<K>>>0)S=O;else S=(O>>>0)%(K>>>0)|0;else S=O&I;if((S|0)==(M|0)){Q=H;break}}c[B>>2]=0;Q=H}while(0);B=c[Q>>2]|0;O=B;if(B){D=c[B+4>>2]|0;if(!L)if(D>>>0<K>>>0)T=D;else T=(D>>>0)%(K>>>0)|0;else T=D&I;if((T|0)!=(M|0)){c[(c[l>>2]|0)+(T<<2)>>2]=N;U=c[H>>2]|0}else U=O}else U=O;c[N>>2]=U;c[Q>>2]=0;c[r>>2]=(c[r>>2]|0)+-1;O=c[H+20>>2]|0;if(O|0?(D=O+4|0,B=c[D>>2]|0,c[D>>2]=B+-1,(B|0)==0):0){La[c[(c[O>>2]|0)+8>>2]&31](O);zd(O)}Bd(H)}O=sb(l,h)|0;if(!z){B=y+4|0;c[B>>2]=(c[B>>2]|0)+1}c[O>>2]=A;B=O+4|0;O=c[B>>2]|0;c[B>>2]=y;if(O|0?(B=O+4|0,D=c[B>>2]|0,c[B>>2]=D+-1,(D|0)==0):0){La[c[(c[O>>2]|0)+8>>2]&31](O);zd(O)}C=j}if(!z?(O=y+4|0,D=c[O>>2]|0,c[O>>2]=D+-1,(D|0)==0):0){La[c[(c[y>>2]|0)+8>>2]&31](y);zd(y)}if((v|0)<=1)break;else j=C}V=c[i>>2]|0}else V=s;b=b+1|0;if((b|0)>=(V|0))break;else s=V}Da=e;return}function sb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,t=0,u=0.0,v=0.0,w=0,x=0,y=0,z=0,A=0;d=b;b=c[d>>2]|0;e=c[d+4>>2]|0;d=s(b,1540483477)|0;g=s(e,1540483477)|0;h=(s((s(d>>>24^d,1540483477)|0)^-561034072,1540483477)|0)^(s(g>>>24^g,1540483477)|0);g=s(h>>>13^h,1540483477)|0;h=g>>>15^g;g=a+4|0;d=c[g>>2]|0;i=(d|0)==0;a:do if(!i){j=d+-1|0;k=(j&d|0)==0;if(!k)if(h>>>0<d>>>0)l=h;else l=(h>>>0)%(d>>>0)|0;else l=h&j;m=c[(c[a>>2]|0)+(l<<2)>>2]|0;if((m|0)!=0?(n=c[m>>2]|0,(n|0)!=0):0){if(k){k=n;while(1){m=c[k+4>>2]|0;if(!((m|0)==(h|0)|(m&j|0)==(l|0))){o=l;break a}m=k+8|0;if((c[m>>2]|0)==(b|0)?(c[m+4>>2]|0)==(e|0):0){p=k;break}k=c[k>>2]|0;if(!k){o=l;break a}}q=p+16|0;return q|0}k=n;while(1){j=c[k+4>>2]|0;if((j|0)!=(h|0)){if(j>>>0<d>>>0)t=j;else t=(j>>>0)%(d>>>0)|0;if((t|0)!=(l|0)){o=l;break a}}j=k+8|0;if((c[j>>2]|0)==(b|0)?(c[j+4>>2]|0)==(e|0):0){p=k;break}k=c[k>>2]|0;if(!k){o=l;break a}}q=p+16|0;return q|0}else o=l}else o=0;while(0);l=Ad(24)|0;t=l+8|0;c[t>>2]=b;c[t+4>>2]=e;c[l+16>>2]=0;c[l+20>>2]=0;c[l+4>>2]=h;c[l>>2]=0;e=a+12|0;u=+(((c[e>>2]|0)+1|0)>>>0);v=+f[a+16>>2];do if(i|v*+(d>>>0)<u){t=d<<1|(d>>>0<3|(d+-1&d|0)!=0)&1;b=~~+r(+(u/v))>>>0;tb(a,t>>>0<b>>>0?b:t);t=c[g>>2]|0;b=t+-1|0;if(!(b&t)){w=t;x=b&h;break}if(h>>>0<t>>>0){w=t;x=h}else{w=t;x=(h>>>0)%(t>>>0)|0}}else{w=d;x=o}while(0);o=(c[a>>2]|0)+(x<<2)|0;x=c[o>>2]|0;if(!x){d=a+8|0;c[l>>2]=c[d>>2];c[d>>2]=l;c[o>>2]=d;d=c[l>>2]|0;if(d|0){o=c[d+4>>2]|0;d=w+-1|0;if(d&w)if(o>>>0<w>>>0)y=o;else y=(o>>>0)%(w>>>0)|0;else y=o&d;z=(c[a>>2]|0)+(y<<2)|0;A=33}}else{c[l>>2]=c[x>>2];z=x;A=33}if((A|0)==33)c[z>>2]=l;c[e>>2]=(c[e>>2]|0)+1;p=l;q=p+16|0;return q|0}function tb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=vd(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){ub(a,d);return}if(d>>>0>=b>>>0)return;e=~~+r(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(t(e+-1|0)|0);h=e>>>0<2?e:g}else h=vd(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;ub(a,e);return}function ub(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;d=a+4|0;if(!b){e=c[a>>2]|0;c[a>>2]=0;if(e|0)Bd(e);c[d>>2]=0;return}if(b>>>0>1073741823){e=X(8)|0;Gd(e,4397);c[e>>2]=3988;$(e|0,3056,23)}e=Ad(b<<2)|0;f=c[a>>2]|0;c[a>>2]=e;if(f|0)Bd(f);c[d>>2]=b;d=0;do{c[(c[a>>2]|0)+(d<<2)>>2]=0;d=d+1|0}while((d|0)!=(b|0));d=a+8|0;f=c[d>>2]|0;if(!f)return;e=c[f+4>>2]|0;g=b+-1|0;h=(g&b|0)==0;if(!h)if(e>>>0<b>>>0)i=e;else i=(e>>>0)%(b>>>0)|0;else i=e&g;c[(c[a>>2]|0)+(i<<2)>>2]=d;d=c[f>>2]|0;if(!d)return;if(h){h=i;e=d;j=f;while(1){k=c[e+4>>2]&g;do if((k|0)==(h|0)){l=h;m=e}else{n=(c[a>>2]|0)+(k<<2)|0;if(!(c[n>>2]|0)){c[n>>2]=j;l=k;m=e;break}n=c[e>>2]|0;a:do if(!n)o=e;else{p=e+8|0;q=c[p>>2]|0;r=c[p+4>>2]|0;p=e;s=n;while(1){t=s+8|0;if(!((q|0)==(c[t>>2]|0)?(r|0)==(c[t+4>>2]|0):0)){o=p;break a}t=c[s>>2]|0;if(!t){o=s;break}else{u=s;s=t;p=u}}}while(0);c[j>>2]=c[o>>2];c[o>>2]=c[c[(c[a>>2]|0)+(k<<2)>>2]>>2];c[c[(c[a>>2]|0)+(k<<2)>>2]>>2]=e;l=h;m=j}while(0);e=c[m>>2]|0;if(!e)break;else{h=l;j=m}}return}m=i;i=d;d=f;while(1){f=c[i+4>>2]|0;if(f>>>0<b>>>0)v=f;else v=(f>>>0)%(b>>>0)|0;do if((v|0)==(m|0)){w=m;x=i}else{f=(c[a>>2]|0)+(v<<2)|0;if(!(c[f>>2]|0)){c[f>>2]=d;w=v;x=i;break}f=c[i>>2]|0;b:do if(!f)y=i;else{j=i+8|0;l=c[j>>2]|0;h=c[j+4>>2]|0;j=i;e=f;while(1){o=e+8|0;if(!((l|0)==(c[o>>2]|0)?(h|0)==(c[o+4>>2]|0):0)){y=j;break b}o=c[e>>2]|0;if(!o){y=e;break}else{g=e;e=o;j=g}}}while(0);c[d>>2]=c[y>>2];c[y>>2]=c[c[(c[a>>2]|0)+(v<<2)>>2]>>2];c[c[(c[a>>2]|0)+(v<<2)>>2]>>2]=i;w=m;x=d}while(0);i=c[x>>2]|0;if(!i)break;else{m=w;d=x}}return}function vb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=b;b=c[d>>2]|0;e=c[d+4>>2]|0;d=s(b,1540483477)|0;f=s(e,1540483477)|0;g=(s((s(d>>>24^d,1540483477)|0)^-561034072,1540483477)|0)^(s(f>>>24^f,1540483477)|0);f=s(g>>>13^g,1540483477)|0;g=f>>>15^f;f=c[a+4>>2]|0;if(!f){h=0;return h|0}d=f+-1|0;i=(d&f|0)==0;if(!i)if(g>>>0<f>>>0)j=g;else j=(g>>>0)%(f>>>0)|0;else j=g&d;k=c[(c[a>>2]|0)+(j<<2)>>2]|0;if(!k){h=0;return h|0}a=c[k>>2]|0;if(!a){h=0;return h|0}if(i){i=a;while(1){k=c[i+4>>2]|0;l=(k|0)==(g|0);if(!(l|(k&d|0)==(j|0))){h=0;m=21;break}if(l?(l=i+8|0,(c[l>>2]|0)==(b|0)?(c[l+4>>2]|0)==(e|0):0):0){h=i;m=21;break}i=c[i>>2]|0;if(!i){h=0;m=21;break}}if((m|0)==21)return h|0}i=a;while(1){a=c[i+4>>2]|0;if((a|0)==(g|0)){d=i+8|0;if((c[d>>2]|0)==(b|0)?(c[d+4>>2]|0)==(e|0):0){h=i;m=21;break}}else{if(a>>>0<f>>>0)n=a;else n=(a>>>0)%(f>>>0)|0;if((n|0)!=(j|0)){h=0;m=21;break}}i=c[i>>2]|0;if(!i){h=0;m=21;break}}if((m|0)==21)return h|0;return 0}function wb(a,b){a=a|0;b=b|0;Jd(a,b);Jd(a+12|0,b+12|0);Jd(a+24|0,b+24|0);Jd(a+36|0,b+36|0);return}function xb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0;b=Da;Da=Da+80|0;if((Da|0)>=(Ea|0))x(80);f=b+73|0;g=b+72|0;h=b+36|0;i=b;j=c[e>>2]|0;k=(c[e+4>>2]|0)-j|0;l=k+1|0;if(!k){m=j;Da=b;return m|0}if(!l){c[h>>2]=d;c[h+4>>2]=32;c[h+12>>2]=2;c[h+8>>2]=16;c[h+20>>2]=2147418112;c[h+16>>2]=2;c[h+24>>2]=2147352576;c[h+28>>2]=65535;c[h+32>>2]=131071;a[f>>0]=a[g>>0]|0;m=yb(h,f)|0;Da=b;return m|0}h=32-(t(l|0)|0)|0;j=h+(((-1>>>(33-h|0)&l|0)==0)<<31>>31)|0;c[i>>2]=d;c[i+4>>2]=j;d=(j>>>0)/30|0;h=d+((j-(d*30|0)|0)!=0&1)|0;d=i+12|0;c[d>>2]=h;k=(j>>>0)/(h>>>0)|0;n=i+8|0;c[n>>2]=k;o=k>>>0<32?2147483646>>>k<<k:0;p=i+20|0;c[p>>2]=o;do if((2147483646-o|0)>>>0>((o>>>0)/(h>>>0)|0)>>>0){q=h+1|0;c[d>>2]=q;r=(j>>>0)/(q>>>0)|0;c[n>>2]=r;if(r>>>0<32){c[p>>2]=2147483646>>>r<<r;u=r;v=q;w=8;break}else{c[p>>2]=0;c[i+16>>2]=q-(j-(s(r,q)|0));y=0;z=r;A=0;break}}else{u=k;v=h;w=8}while(0);if((w|0)==8){c[i+16>>2]=v-((j>>>0)%(v>>>0)|0);if(u>>>0<31){v=u+1|0;y=2147483646>>>v<<v;z=u;A=1}else{y=0;z=u;A=0}}c[i+24>>2]=y;c[i+28>>2]=(z|0)==0?0:-1>>>(32-z|0);c[i+32>>2]=A?-1>>>(31-z|0):-1;do{a[f>>0]=a[g>>0]|0;B=yb(i,f)|0}while(B>>>0>=l>>>0);m=(c[e>>2]|0)+B|0;Da=b;return m|0}function yb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0;b=c[a+16>>2]|0;if(!b){d=0;e=0}else{f=c[a>>2]|0;g=c[a+20>>2]|0;h=c[a+8>>2]|0;i=c[a+28>>2]|0;j=c[f>>2]|0;if(h>>>0<32){k=0;l=0;m=j;while(1){n=m;do{o=(n>>>0)/44488|0;p=(n-(o*44488|0)|0)*48271|0;q=o*3399|0;n=(p>>>0<q>>>0?2147483647:0)+(p-q)|0;r=n+-1|0}while(r>>>0>=g>>>0);q=(l<<h)+(i&r)|0;k=k+1|0;if(k>>>0>=b>>>0){s=n;t=q;break}else{l=q;m=n}}}else{m=0;l=j;while(1){u=l;do{j=(u>>>0)/44488|0;k=(u-(j*44488|0)|0)*48271|0;r=j*3399|0;u=(k>>>0<r>>>0?2147483647:0)+(k-r)|0;v=u+-1|0}while(v>>>0>=g>>>0);m=m+1|0;if(m>>>0>=b>>>0)break;else l=u}s=u;t=i&v}c[f>>2]=s;d=t;e=b}b=c[a+12>>2]|0;if(e>>>0>=b>>>0){w=d;return w|0}t=c[a>>2]|0;s=c[a+24>>2]|0;f=c[a+8>>2]|0;v=f+1|0;i=c[a+32>>2]|0;a=c[t>>2]|0;if(f>>>0<31){f=e;u=d;d=a;while(1){l=d;do{m=(l>>>0)/44488|0;g=(l-(m*44488|0)|0)*48271|0;n=m*3399|0;l=(g>>>0<n>>>0?2147483647:0)+(g-n)|0;x=l+-1|0}while(x>>>0>=s>>>0);n=(u<<v)+(i&x)|0;f=f+1|0;if(f>>>0>=b>>>0){y=l;z=n;break}else{u=n;d=l}}}else{d=e;e=a;while(1){A=e;do{a=(A>>>0)/44488|0;u=(A-(a*44488|0)|0)*48271|0;f=a*3399|0;A=(u>>>0<f>>>0?2147483647:0)+(u-f)|0;B=A+-1|0}while(B>>>0>=s>>>0);d=d+1|0;if(d>>>0>=b>>>0)break;else e=A}y=A;z=i&B}c[t>>2]=y;w=z;return w|0}function zb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0;e=b+11|0;if((a[e>>0]|0)<0){a[c[b>>2]>>0]=0;c[b+4>>2]=0}else{a[b>>0]=0;a[e>>0]=0}Pd(b,0);c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[d>>2]=0;c[d+4>>2]=0;c[d+8>>2]=0;e=b+12|0;f=d+12|0;g=e+11|0;if((a[g>>0]|0)<0){a[c[e>>2]>>0]=0;c[b+16>>2]=0}else{a[e>>0]=0;a[g>>0]=0}Pd(e,0);c[e>>2]=c[f>>2];c[e+4>>2]=c[f+4>>2];c[e+8>>2]=c[f+8>>2];c[f>>2]=0;c[f+4>>2]=0;c[f+8>>2]=0;f=b+24|0;e=d+24|0;g=f+11|0;if((a[g>>0]|0)<0){a[c[f>>2]>>0]=0;c[b+28>>2]=0}else{a[f>>0]=0;a[g>>0]=0}Pd(f,0);c[f>>2]=c[e>>2];c[f+4>>2]=c[e+4>>2];c[f+8>>2]=c[e+8>>2];c[e>>2]=0;c[e+4>>2]=0;c[e+8>>2]=0;e=b+36|0;f=d+36|0;d=e+11|0;if((a[d>>0]|0)<0){a[c[e>>2]>>0]=0;c[b+40>>2]=0;Pd(e,0);c[e>>2]=c[f>>2];c[e+4>>2]=c[f+4>>2];c[e+8>>2]=c[f+8>>2];c[f>>2]=0;c[f+4>>2]=0;c[f+8>>2]=0;return b|0}else{a[e>>0]=0;a[d>>0]=0;Pd(e,0);c[e>>2]=c[f>>2];c[e+4>>2]=c[f+4>>2];c[e+8>>2]=c[f+8>>2];c[f>>2]=0;c[f+4>>2]=0;c[f+8>>2]=0;return b|0}return 0}function Ab(a){a=a|0;return}function Bb(a){a=a|0;Bd(a);return}function Cb(a){a=a|0;var b=0,d=0;b=Ad(20)|0;d=a+4|0;c[b>>2]=3220;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return b|0}function Db(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=3220;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return}function Eb(a){a=a|0;return}function Fb(a){a=a|0;Bd(a);return}function Gb(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Jb(a,b+4|0,c,d,e,f);return}function Hb(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6449?a+4|0:0)|0}function Ib(a){a=a|0;return 2888}function Jb(a,b,d,e,g,h){a=a|0;b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0;e=Da;Da=Da+32|0;if((Da|0)>=(Ea|0))x(32);d=e;i=e+24|0;j=e+16|0;k=e+8|0;l=c[g>>2]|0;g=c[h>>2]|0;h=c[b+4>>2]|0;m=(c[b>>2]|0)+176|0;n=Kb(m,8748,m)|0;m=(c[h>>2]|0)+(n*48|0)|0;n=c[b+12>>2]|0;c[i>>2]=l;c[i+4>>2]=g;f[j>>2]=0.0;f[j+4>>2]=0.0;g=c[b+8>>2]|0;b=Ad(156)|0;c[b+4>>2]=0;c[b+8>>2]=0;c[b>>2]=3264;l=b+12|0;Qb(l,m,n,i,j,40.0,g);g=k+4|0;c[k>>2]=l;c[g>>2]=b;c[d>>2]=l;c[d+4>>2]=l;Lb(k,d);c[a>>2]=c[k>>2];c[a+4>>2]=c[g>>2];Da=e;return}function Kb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;a=c[d>>2]|0;e=(c[d+4>>2]|0)-a|0;f=e+1|0;if(!e){g=a;return g|0}if(!f){a=b+2496|0;e=c[a>>2]|0;h=((e+1|0)>>>0)%624|0;i=b+(e<<2)|0;j=c[b+(h<<2)>>2]|0;k=0-(j&1)&-1727483681^c[b+((((e+397|0)>>>0)%624|0)<<2)>>2]^(j&2147483646|c[i>>2]&-2147483648)>>>1;c[i>>2]=k;i=k>>>11^k;c[a>>2]=h;h=i<<7&-1658038656^i;i=h<<15&-272236544^h;g=i>>>18^i;return g|0}i=32-(t(f|0)|0)|0;h=i+(((-1>>>(33-i|0)&f|0)==0)<<31>>31)|0;i=(h>>>5)+((h&31|0)!=0&1)|0;a=i>>>0>h>>>0?0:-1>>>(32-((h>>>0)/(i>>>0)|0)|0);i=b+2496|0;h=c[i>>2]|0;do{k=h;h=((h+1|0)>>>0)%624|0;j=b+(k<<2)|0;e=c[b+(h<<2)>>2]|0;l=0-(e&1)&-1727483681^c[b+((((k+397|0)>>>0)%624|0)<<2)>>2]^(e&2147483646|c[j>>2]&-2147483648)>>>1;c[j>>2]=l;j=l>>>11^l;l=j<<7&-1658038656^j;j=l<<15&-272236544^l;m=(j>>>18^j)&a}while(m>>>0>=f>>>0);c[i>>2]=h;g=(c[d>>2]|0)+m|0;return g|0}function Lb(a,b){a=a|0;b=b|0;return}function Mb(b){b=b|0;var d=0,e=0;c[b>>2]=3264;c[b+12>>2]=3292;d=b+88|0;e=b+124|0;if((a[e+11>>0]|0)<0)Bd(c[e>>2]|0);e=b+112|0;if((a[e+11>>0]|0)<0)Bd(c[e>>2]|0);e=b+100|0;if((a[e+11>>0]|0)<0)Bd(c[e>>2]|0);if((a[d+11>>0]|0)>=0){xd(b);return}Bd(c[d>>2]|0);xd(b);return}function Nb(b){b=b|0;var d=0,e=0;c[b>>2]=3264;c[b+12>>2]=3292;d=b+88|0;e=b+124|0;if((a[e+11>>0]|0)<0)Bd(c[e>>2]|0);e=b+112|0;if((a[e+11>>0]|0)<0)Bd(c[e>>2]|0);e=b+100|0;if((a[e+11>>0]|0)<0)Bd(c[e>>2]|0);if((a[d+11>>0]|0)>=0){xd(b);Bd(b);return}Bd(c[d>>2]|0);xd(b);Bd(b);return}function Ob(b){b=b|0;var d=0,e=0;c[b+12>>2]=3292;d=b+88|0;e=b+124|0;if((a[e+11>>0]|0)<0)Bd(c[e>>2]|0);e=b+112|0;if((a[e+11>>0]|0)<0)Bd(c[e>>2]|0);e=b+100|0;if((a[e+11>>0]|0)<0)Bd(c[e>>2]|0);if((a[d+11>>0]|0)>=0)return;Bd(c[d>>2]|0);return}function Pb(a){a=a|0;Bd(a);return}function Qb(b,d,e,g,h,i,j){b=b|0;d=d|0;e=e|0;g=g|0;h=h|0;i=+i;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0.0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;k=Da;Da=Da+80|0;if((Da|0)>=(Ea|0))x(80);l=k;m=b+60|0;n=b+4|0;o=n+56|0;do{c[n>>2]=0;n=n+4|0}while((n|0)<(o|0));f[m>>2]=-1.0;a[b+64>>0]=1;c[b+68>>2]=0;c[b+72>>2]=0;c[b>>2]=3292;wb(b+76|0,d);f[b+124>>2]=2.0;m=e;p=c[m+4>>2]|0;q=b+44|0;c[q>>2]=c[m>>2];c[q+4>>2]=p;p=g;q=c[p+4>>2]|0;m=b+36|0;c[m>>2]=c[p>>2];c[m+4>>2]=q;q=h;h=c[q+4>>2]|0;m=b+52|0;c[m>>2]=c[q>>2];c[m+4>>2]=h;h=j+4|0;m=c[h>>2]|0;q=b+128|0;c[q>>2]=(m-(c[j>>2]|0)|0)/80|0;p=g;r=c[p>>2]|0;s=c[p+4>>2]|0;p=e;t=c[p>>2]|0;u=c[p+4>>2]|0;p=l;c[p>>2]=r;c[p+4>>2]=s;p=l+8|0;c[p>>2]=t;c[p+4>>2]=u;c[l+16>>2]=1092616192;c[l+20>>2]=1073741824;c[l+24>>2]=842150655;c[l+28>>2]=-1768515841;c[l+32>>2]=6;f[l+36>>2]=0.0;p=l+40|0;c[p>>2]=r;c[p+4>>2]=s;s=l+48|0;c[s>>2]=t;c[s+4>>2]=u;c[l+56>>2]=1092616192;c[l+60>>2]=1073741824;c[l+64>>2]=0;c[l+76>>2]=0;u=j+8|0;if((c[u>>2]|0)>>>0>m>>>0){n=m;v=l;o=n+80|0;do{c[n>>2]=c[v>>2];n=n+4|0;v=v+4|0}while((n|0)<(o|0));m=(c[h>>2]|0)+80|0;c[h>>2]=m;w=m;y=m}else{Ub(j,l);m=c[h>>2]|0;w=m;y=m}m=b+132|0;c[m>>2]=(w-(c[j>>2]|0)|0)/80|0;i=+f[g>>2]+4.0;w=g+4|0;z=+f[w>>2]+4.0;s=e;t=c[s>>2]|0;p=c[s+4>>2]|0;f[l>>2]=i;f[l+4>>2]=z;s=l+8|0;c[s>>2]=t;c[s+4>>2]=p;c[l+16>>2]=1092616192;c[l+20>>2]=1073741824;c[l+24>>2]=842150655;c[l+28>>2]=-387389185;c[l+32>>2]=6;f[l+36>>2]=0.0;f[l+40>>2]=i;f[l+44>>2]=z;s=l+48|0;c[s>>2]=t;c[s+4>>2]=p;c[l+56>>2]=1092616192;c[l+60>>2]=1073741824;c[l+64>>2]=0;c[l+76>>2]=0;if(y>>>0<(c[u>>2]|0)>>>0){n=y;v=l;o=n+80|0;do{c[n>>2]=c[v>>2];n=n+4|0;v=v+4|0}while((n|0)<(o|0));y=(c[h>>2]|0)+80|0;c[h>>2]=y;A=y}else{Ub(j,l);A=c[h>>2]|0}y=b+136|0;c[y>>2]=(A-(c[j>>2]|0)|0)/80|0;A=d+36|0;if(!(Wb(11260,A)|0)){p=c[2813]|0;s=(p-(c[2812]|0)|0)/12|0;t=p;if((c[2814]|0)==(t|0))Xb(11248,A);else{Jd(t,A);c[2813]=(c[2813]|0)+12}c[(Vb(11260,A)|0)>>2]=s}s=c[(Vb(11260,A)|0)>>2]|0;A=g;t=c[A>>2]|0;p=c[A+4>>2]|0;A=e;e=c[A>>2]|0;r=c[A+4>>2]|0;A=l;c[A>>2]=t;c[A+4>>2]=p;A=l+8|0;c[A>>2]=e;c[A+4>>2]=r;f[l+16>>2]=0.0;f[l+20>>2]=0.0;c[l+24>>2]=-256;c[l+28>>2]=s;c[l+32>>2]=3;f[l+36>>2]=0.0;s=l+40|0;c[s>>2]=t;c[s+4>>2]=p;p=l+48|0;c[p>>2]=e;c[p+4>>2]=r;c[l+56>>2]=0;c[l+60>>2]=0;c[l+64>>2]=0;c[l+76>>2]=0;r=c[h>>2]|0;if(r>>>0<(c[u>>2]|0)>>>0){n=r;v=l;o=n+80|0;do{c[n>>2]=c[v>>2];n=n+4|0;v=v+4|0}while((n|0)<(o|0));r=(c[h>>2]|0)+80|0;c[h>>2]=r;B=r}else{Ub(j,l);B=c[h>>2]|0}r=b+140|0;c[r>>2]=(B-(c[j>>2]|0)|0)/80|0;z=+f[g>>2]+10.0;i=+f[w>>2]+44.0;if(!(Wb(11260,d)|0)){w=c[2813]|0;g=(w-(c[2812]|0)|0)/12|0;B=w;if((c[2814]|0)==(B|0))Xb(11248,d);else{Jd(B,d);c[2813]=(c[2813]|0)+12}c[(Vb(11260,d)|0)>>2]=g}g=c[(Vb(11260,d)|0)>>2]|0;f[l>>2]=z;f[l+4>>2]=i;c[l+8>>2]=1109393408;c[l+12>>2]=1109393408;f[l+16>>2]=0.0;f[l+20>>2]=0.0;c[l+24>>2]=255;c[l+28>>2]=g;c[l+32>>2]=2;f[l+36>>2]=0.0;f[l+40>>2]=z;f[l+44>>2]=i;c[l+48>>2]=1109393408;c[l+52>>2]=1109393408;c[l+56>>2]=0;c[l+60>>2]=0;c[l+64>>2]=0;c[l+76>>2]=0;g=c[h>>2]|0;if(g>>>0<(c[u>>2]|0)>>>0){n=g;v=l;o=n+80|0;do{c[n>>2]=c[v>>2];n=n+4|0;v=v+4|0}while((n|0)<(o|0));c[h>>2]=(c[h>>2]|0)+80;C=c[q>>2]|0;D=c[r>>2]|0;E=b+68|0;F=E;G=F;c[G>>2]=C;H=F+4|0;I=H;c[I>>2]=D;c[q>>2]=0;c[m>>2]=1;c[y>>2]=2;c[r>>2]=3;Da=k;return}else{Ub(j,l);C=c[q>>2]|0;D=c[r>>2]|0;E=b+68|0;F=E;G=F;c[G>>2]=C;H=F+4|0;I=H;c[I>>2]=D;c[q>>2]=0;c[m>>2]=1;c[y>>2]=2;c[r>>2]=3;Da=k;return}}function Rb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0.0,k=0.0,l=0,m=0;e=a+68|0;g=(c[a+132>>2]|0)+(c[e>>2]|0)|0;h=c[d>>2]|0;c[h+(g*80|0)+28>>2]=b;b=h+(g*80|0)|0;i=h+(g*80|0)+4|0;g=a+124|0;j=+f[g>>2];k=+f[i>>2]-j;f[b>>2]=+f[b>>2]-j;f[i>>2]=k;i=a+140|0;b=(c[i>>2]|0)+(c[e>>2]|0)|0;h=c[d>>2]|0;l=h+(b*80|0)|0;m=h+(b*80|0)+4|0;k=+f[g>>2];j=+f[m>>2]-k;f[l>>2]=+f[l>>2]-k;f[m>>2]=j;m=c[e>>2]|0;e=c[d>>2]|0;d=e+(((c[i>>2]|0)+m|0)*80|0)+24|0;c[d>>2]=c[d>>2]&-256;c[e+(((c[a+136>>2]|0)+m|0)*80|0)+24>>2]=-1;return}function Sb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0,i=0,j=0.0,k=0.0,l=0,m=0;d=a+68|0;e=(c[a+132>>2]|0)+(c[d>>2]|0)|0;g=c[b>>2]|0;c[g+(e*80|0)+28>>2]=-387389185;h=g+(e*80|0)|0;i=g+(e*80|0)+4|0;e=a+124|0;j=+f[e>>2];k=+f[i>>2]+j;f[h>>2]=+f[h>>2]+j;f[i>>2]=k;i=a+140|0;h=(c[i>>2]|0)+(c[d>>2]|0)|0;g=c[b>>2]|0;l=g+(h*80|0)|0;m=g+(h*80|0)+4|0;k=+f[e>>2];j=+f[m>>2]+k;f[l>>2]=+f[l>>2]+k;f[m>>2]=j;m=c[d>>2]|0;d=c[b>>2]|0;b=d+(((c[i>>2]|0)+m|0)*80|0)+24|0;c[b>>2]=c[b>>2]|255;c[d+(((c[a+136>>2]|0)+m|0)*80|0)+24>>2]=-256;return}function Tb(a,b){a=a|0;b=b|0;return c[(c[b>>2]|0)+(((c[a+140>>2]|0)+(c[a+68>>2]|0)|0)*80|0)+28>>2]|0}function Ub(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=(f|0)/80|0;h=g+1|0;if(h>>>0>53687091)Ud(a);i=a+8|0;j=((c[i>>2]|0)-e|0)/80|0;k=j<<1;l=j>>>0<26843545?(k>>>0<h>>>0?h:k):53687091;do if(l)if(l>>>0>53687091){k=X(8)|0;Gd(k,4397);c[k>>2]=3988;$(k|0,3056,23)}else{m=Ad(l*80|0)|0;break}else m=0;while(0);k=m+(g*80|0)|0;g=m+(l*80|0)|0;l=k;m=b;b=l+80|0;do{c[l>>2]=c[m>>2];l=l+4|0;m=m+4|0}while((l|0)<(b|0));m=k+(((f|0)/-80|0)*80|0)|0;if((f|0)>0)We(m|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+80;c[i>>2]=g;if(!e)return;Bd(e);return}function Vb(b,e){b=b|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0.0,G=0.0,H=0,I=0,J=0,K=0;g=a[e+11>>0]|0;h=g<<24>>24<0;i=h?c[e>>2]|0:e;j=h?c[e+4>>2]|0:g&255;if(j>>>0>3){g=i;h=j;k=j;while(1){l=s(d[g>>0]|d[g+1>>0]<<8|d[g+2>>0]<<16|d[g+3>>0]<<24,1540483477)|0;h=(s(l>>>24^l,1540483477)|0)^(s(h,1540483477)|0);k=k+-4|0;if(k>>>0<=3)break;else g=g+4|0}g=j+-4|0;k=g&-4;m=g-k|0;n=i+(k+4)|0;o=h}else{m=j;n=i;o=j}switch(m|0){case 3:{p=d[n+2>>0]<<16^o;q=7;break}case 2:{p=o;q=7;break}case 1:{t=o;q=8;break}default:u=o}if((q|0)==7){t=d[n+1>>0]<<8^p;q=8}if((q|0)==8)u=s(t^d[n>>0],1540483477)|0;n=s(u>>>13^u,1540483477)|0;u=n>>>15^n;n=b+4|0;t=c[n>>2]|0;p=(t|0)==0;a:do if(!p){o=t+-1|0;m=(o&t|0)==0;if(!m)if(u>>>0<t>>>0)v=u;else v=(u>>>0)%(t>>>0)|0;else v=u&o;h=c[(c[b>>2]|0)+(v<<2)>>2]|0;if((h|0)!=0?(k=c[h>>2]|0,(k|0)!=0):0){h=(j|0)==0;if(m){if(h){m=k;while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=a[m+8+11>>0]|0;if(!((g<<24>>24<0?c[m+12>>2]|0:g&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;b:while(1){g=c[m+4>>2]|0;if(!((g|0)==(u|0)|(g&o|0)==(v|0))){w=v;break a}g=m+8|0;l=a[g+11>>0]|0;z=l<<24>>24<0;A=l&255;do if(((z?c[m+12>>2]|0:A)|0)==(j|0)){l=c[g>>2]|0;if(z)if(!(jd(l,i,j)|0)){x=m;q=68;break b}else break;if((a[i>>0]|0)==(l&255)<<24>>24){l=g;B=A;C=i;do{B=B+-1|0;l=l+1|0;if(!B){x=m;q=68;break b}C=C+1|0}while((a[l>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}if(h){m=k;while(1){o=c[m+4>>2]|0;if((o|0)!=(u|0)){if(o>>>0<t>>>0)D=o;else D=(o>>>0)%(t>>>0)|0;if((D|0)!=(v|0)){w=v;break a}}o=a[m+8+11>>0]|0;if(!((o<<24>>24<0?c[m+12>>2]|0:o&255)|0)){x=m;break}m=c[m>>2]|0;if(!m){w=v;break a}}y=x+20|0;return y|0}m=k;c:while(1){h=c[m+4>>2]|0;if((h|0)!=(u|0)){if(h>>>0<t>>>0)E=h;else E=(h>>>0)%(t>>>0)|0;if((E|0)!=(v|0)){w=v;break a}}h=m+8|0;o=a[h+11>>0]|0;A=o<<24>>24<0;g=o&255;do if(((A?c[m+12>>2]|0:g)|0)==(j|0)){o=c[h>>2]|0;if(A)if(!(jd(o,i,j)|0)){x=m;q=68;break c}else break;if((a[i>>0]|0)==(o&255)<<24>>24){o=h;z=g;C=i;do{z=z+-1|0;o=o+1|0;if(!z){x=m;q=68;break c}C=C+1|0}while((a[o>>0]|0)==(a[C>>0]|0))}}while(0);m=c[m>>2]|0;if(!m){w=v;break a}}if((q|0)==68){y=x+20|0;return y|0}}else w=v}else w=0;while(0);v=Ad(24)|0;Jd(v+8|0,e);c[v+20>>2]=0;c[v+4>>2]=u;c[v>>2]=0;e=b+12|0;F=+(((c[e>>2]|0)+1|0)>>>0);G=+f[b+16>>2];do if(p|G*+(t>>>0)<F){i=t<<1|(t>>>0<3|(t+-1&t|0)!=0)&1;j=~~+r(+(F/G))>>>0;Yb(b,i>>>0<j>>>0?j:i);i=c[n>>2]|0;j=i+-1|0;if(!(j&i)){H=i;I=j&u;break}if(u>>>0<i>>>0){H=i;I=u}else{H=i;I=(u>>>0)%(i>>>0)|0}}else{H=t;I=w}while(0);w=(c[b>>2]|0)+(I<<2)|0;I=c[w>>2]|0;if(!I){t=b+8|0;c[v>>2]=c[t>>2];c[t>>2]=v;c[w>>2]=t;t=c[v>>2]|0;if(t|0){w=c[t+4>>2]|0;t=H+-1|0;if(t&H)if(w>>>0<H>>>0)J=w;else J=(w>>>0)%(H>>>0)|0;else J=w&t;K=(c[b>>2]|0)+(J<<2)|0;q=66}}else{c[v>>2]=c[I>>2];K=I;q=66}if((q|0)==66)c[K>>2]=v;c[e>>2]=(c[e>>2]|0)+1;x=v;y=x+20|0;return y|0}function Wb(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0;f=a[e+11>>0]|0;g=f<<24>>24<0;h=g?c[e>>2]|0:e;i=g?c[e+4>>2]|0:f&255;if(i>>>0>3){f=h;e=i;g=i;while(1){j=s(d[f>>0]|d[f+1>>0]<<8|d[f+2>>0]<<16|d[f+3>>0]<<24,1540483477)|0;e=(s(j>>>24^j,1540483477)|0)^(s(e,1540483477)|0);g=g+-4|0;if(g>>>0<=3)break;else f=f+4|0}f=i+-4|0;g=f&-4;k=f-g|0;l=h+(g+4)|0;m=e}else{k=i;l=h;m=i}switch(k|0){case 3:{n=d[l+2>>0]<<16^m;o=7;break}case 2:{n=m;o=7;break}case 1:{p=m;o=8;break}default:q=m}if((o|0)==7){p=d[l+1>>0]<<8^n;o=8}if((o|0)==8)q=s(p^d[l>>0],1540483477)|0;l=s(q>>>13^q,1540483477)|0;q=l>>>15^l;l=c[b+4>>2]|0;if(!l){r=0;return r|0}p=l+-1|0;n=(p&l|0)==0;if(!n)if(q>>>0<l>>>0)t=q;else t=(q>>>0)%(l>>>0)|0;else t=q&p;m=c[(c[b>>2]|0)+(t<<2)>>2]|0;if(!m){r=0;return r|0}b=c[m>>2]|0;if(!b){r=0;return r|0}m=(i|0)==0;if(n){n=b;a:while(1){k=c[n+4>>2]|0;e=(k|0)==(q|0);if(!(e|(k&p|0)==(t|0))){r=0;o=45;break}do if(e?(k=n+8|0,g=a[k+11>>0]|0,f=g<<24>>24<0,j=g&255,((f?c[n+12>>2]|0:j)|0)==(i|0)):0){g=c[k>>2]|0;u=f?g:k;v=g&255;if(f){if(m){r=n;o=45;break a}if(!(jd(u,h,i)|0)){r=n;o=45;break a}else break}if(m){r=n;o=45;break a}if((a[h>>0]|0)==v<<24>>24){v=k;k=j;j=h;do{k=k+-1|0;v=v+1|0;if(!k){r=n;o=45;break a}j=j+1|0}while((a[v>>0]|0)==(a[j>>0]|0))}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0}n=b;b:while(1){b=c[n+4>>2]|0;do if((b|0)==(q|0)){p=n+8|0;e=a[p+11>>0]|0;j=e<<24>>24<0;v=e&255;if(((j?c[n+12>>2]|0:v)|0)==(i|0)){e=c[p>>2]|0;k=j?e:p;u=e&255;if(j){if(m){r=n;o=45;break b}if(!(jd(k,h,i)|0)){r=n;o=45;break b}else break}if(m){r=n;o=45;break b}if((a[h>>0]|0)==u<<24>>24){u=p;p=v;v=h;do{p=p+-1|0;u=u+1|0;if(!p){r=n;o=45;break b}v=v+1|0}while((a[u>>0]|0)==(a[v>>0]|0))}}}else{if(b>>>0<l>>>0)w=b;else w=(b>>>0)%(l>>>0)|0;if((w|0)!=(t|0)){r=0;o=45;break b}}while(0);n=c[n>>2]|0;if(!n){r=0;o=45;break}}if((o|0)==45)return r|0;return 0}function Xb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=b+4|0;f=c[b>>2]|0;g=((c[e>>2]|0)-f|0)/12|0;h=g+1|0;if(h>>>0>357913941)Ud(b);i=b+8|0;j=((c[i>>2]|0)-f|0)/12|0;f=j<<1;k=j>>>0<178956970?(f>>>0<h>>>0?h:f):357913941;do if(k)if(k>>>0>357913941){f=X(8)|0;Gd(f,4397);c[f>>2]=3988;$(f|0,3056,23)}else{l=Ad(k*12|0)|0;break}else l=0;while(0);f=l+(g*12|0)|0;g=l+(k*12|0)|0;Jd(f,d);d=f+12|0;k=c[b>>2]|0;l=c[e>>2]|0;if((l|0)==(k|0)){m=f;n=k;o=k}else{h=l;l=f;do{l=l+-12|0;h=h+-12|0;c[l>>2]=c[h>>2];c[l+4>>2]=c[h+4>>2];c[l+8>>2]=c[h+8>>2];c[h>>2]=0;c[h+4>>2]=0;c[h+8>>2]=0}while((h|0)!=(k|0));m=l;n=c[b>>2]|0;o=c[e>>2]|0}c[b>>2]=m;c[e>>2]=d;c[i>>2]=g;g=n;if((o|0)!=(g|0)){i=o;do{i=i+-12|0;if((a[i+11>>0]|0)<0)Bd(c[i>>2]|0)}while((i|0)!=(g|0))}if(!n)return;Bd(n);return}function Yb(a,b){a=a|0;b=b|0;var d=0,e=0,g=0,h=0;if((b|0)!=1)if(!(b+-1&b))d=b;else d=vd(b)|0;else d=2;b=c[a+4>>2]|0;if(d>>>0>b>>>0){Zb(a,d);return}if(d>>>0>=b>>>0)return;e=~~+r(+(+((c[a+12>>2]|0)>>>0)/+f[a+16>>2]))>>>0;if(b>>>0>2&(b+-1&b|0)==0){g=1<<32-(t(e+-1|0)|0);h=e>>>0<2?e:g}else h=vd(e)|0;e=d>>>0<h>>>0?h:d;if(e>>>0>=b>>>0)return;Zb(a,e);return}function Zb(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;e=b+4|0;if(!d){f=c[b>>2]|0;c[b>>2]=0;if(f|0)Bd(f);c[e>>2]=0;return}if(d>>>0>1073741823){f=X(8)|0;Gd(f,4397);c[f>>2]=3988;$(f|0,3056,23)}f=Ad(d<<2)|0;g=c[b>>2]|0;c[b>>2]=f;if(g|0)Bd(g);c[e>>2]=d;e=0;do{c[(c[b>>2]|0)+(e<<2)>>2]=0;e=e+1|0}while((e|0)!=(d|0));e=b+8|0;g=c[e>>2]|0;if(!g)return;f=c[g+4>>2]|0;h=d+-1|0;i=(h&d|0)==0;if(!i)if(f>>>0<d>>>0)j=f;else j=(f>>>0)%(d>>>0)|0;else j=f&h;c[(c[b>>2]|0)+(j<<2)>>2]=e;e=c[g>>2]|0;if(!e)return;f=j;j=e;e=g;while(1){g=c[j+4>>2]|0;if(!i)if(g>>>0<d>>>0)k=g;else k=(g>>>0)%(d>>>0)|0;else k=g&h;do if((k|0)==(f|0)){l=f;m=j}else{g=(c[b>>2]|0)+(k<<2)|0;if(!(c[g>>2]|0)){c[g>>2]=e;l=k;m=j;break}g=c[j>>2]|0;a:do if(!g)n=j;else{o=j+8|0;p=a[o+11>>0]|0;q=p<<24>>24<0;r=p&255;p=q?c[j+12>>2]|0:r;s=(p|0)==0;if(q){q=j;t=g;while(1){u=t+8|0;v=a[u+11>>0]|0;w=v<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:v&255)|0)){n=q;break a}if(!s?jd(c[o>>2]|0,w?c[u>>2]|0:u,p)|0:0){n=q;break a}u=c[t>>2]|0;if(!u){n=t;break a}else{w=t;t=u;q=w}}}if(s){q=j;t=g;while(1){w=a[t+8+11>>0]|0;if((w<<24>>24<0?c[t+12>>2]|0:w&255)|0){n=q;break a}w=c[t>>2]|0;if(!w){n=t;break a}else{u=t;t=w;q=u}}}q=j;t=g;while(1){s=t+8|0;u=a[s+11>>0]|0;w=u<<24>>24<0;if((p|0)!=((w?c[t+12>>2]|0:u&255)|0)){n=q;break a}u=w?c[s>>2]|0:s;if((a[u>>0]|0)!=(c[o>>2]&255)<<24>>24){n=q;break a}s=o;w=r;v=u;while(1){w=w+-1|0;s=s+1|0;if(!w)break;v=v+1|0;if((a[s>>0]|0)!=(a[v>>0]|0)){n=q;break a}}v=c[t>>2]|0;if(!v){n=t;break}else{s=t;t=v;q=s}}}while(0);c[e>>2]=c[n>>2];c[n>>2]=c[c[(c[b>>2]|0)+(k<<2)>>2]>>2];c[c[(c[b>>2]|0)+(k<<2)>>2]>>2]=j;l=f;m=e}while(0);j=c[m>>2]|0;if(!j)break;else{f=l;e=m}}return}function _b(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;d=a+12|0;if(c[d>>2]|0){e=a+8|0;f=c[e>>2]|0;if(f|0){g=f;do{f=g;g=c[g>>2]|0;h=c[f+20>>2]|0;if(h|0?(i=h+4|0,j=c[i>>2]|0,c[i>>2]=j+-1,(j|0)==0):0){La[c[(c[h>>2]|0)+8>>2]&31](h);zd(h)}Bd(f)}while((g|0)!=0)}c[e>>2]=0;e=c[a+4>>2]|0;if(e|0){g=0;do{c[(c[a>>2]|0)+(g<<2)>>2]=0;g=g+1|0}while((g|0)!=(e|0))}c[d>>2]=0}e=c[b>>2]|0;c[b>>2]=0;g=c[a>>2]|0;c[a>>2]=e;if(g|0)Bd(g);g=b+4|0;e=a+4|0;c[e>>2]=c[g>>2];c[g>>2]=0;g=b+12|0;f=c[g>>2]|0;c[d>>2]=f;c[a+16>>2]=c[b+16>>2];d=b+8|0;b=c[d>>2]|0;h=a+8|0;c[h>>2]=b;if(!f)return;f=c[b+4>>2]|0;b=c[e>>2]|0;e=b+-1|0;if(e&b)if(f>>>0<b>>>0)k=f;else k=(f>>>0)%(b>>>0)|0;else k=e&f;c[(c[a>>2]|0)+(k<<2)>>2]=h;c[d>>2]=0;c[g>>2]=0;return}function $b(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0.0,z=0.0,A=0.0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0;g=Da;Da=Da+96|0;if((Da|0)>=(Ea|0))x(96);h=g+80|0;i=g;ac(b,e);j=c[b+104>>2]|0;if(!j){Da=g;return}k=d+4|0;l=b+116|0;m=b+120|0;n=i+4|0;o=b+128|0;p=b+132|0;q=b+124|0;r=b+136|0;s=b+144|0;b=j;do{j=b;t=c[j+16>>2]|0;u=c[j+20>>2]|0;v=(u|0)==0;if(!v){w=u+4|0;c[w>>2]=(c[w>>2]|0)+1}w=t;if((((a[w+64>>0]|0?(y=+f[d>>2],z=+f[k>>2],A=+f[w+4>>2],A<=y):0)?A+ +f[w+12>>2]>=y:0)?(y=+f[w+8>>2],y<=z):0)?y+ +f[w+16>>2]>=z:0){if(!v){B=u+4|0;c[B>>2]=(c[B>>2]|0)+1}B=c[l>>2]|0;C=c[m>>2]|0;D=(C|0)==0;if(!D){E=C+4|0;c[E>>2]=(c[E>>2]|0)+1}c[h>>2]=w;c[h+4>>2]=B;md(6526,h)|0;E=c[w+72>>2]|0;F=w+68|0;G=c[F>>2]|0;if((E|0)>=(G|0)){H=E+1-G|0;E=c[e>>2]|0;I=E+(G*80|0)|0;G=i;J=I;K=G+80|0;do{c[G>>2]=c[J>>2];G=G+4|0;J=J+4|0}while((G|0)<(K|0));L=B+68|0;G=I;J=E+((c[L>>2]|0)*80|0)|0;K=G+80|0;do{c[G>>2]=c[J>>2];G=G+4|0;J=J+4|0}while((G|0)<(K|0));G=(c[e>>2]|0)+((c[L>>2]|0)*80|0)|0;J=i;K=G+80|0;do{c[G>>2]=c[J>>2];G=G+4|0;J=J+4|0}while((G|0)<(K|0));if((H|0)!=1){E=1;do{I=c[e>>2]|0;M=I+((E+(c[F>>2]|0)|0)*80|0)|0;G=i;J=M;K=G+80|0;do{c[G>>2]=c[J>>2];G=G+4|0;J=J+4|0}while((G|0)<(K|0));G=M;J=I+(((c[L>>2]|0)+E|0)*80|0)|0;K=G+80|0;do{c[G>>2]=c[J>>2];G=G+4|0;J=J+4|0}while((G|0)<(K|0));G=(c[e>>2]|0)+(((c[L>>2]|0)+E|0)*80|0)|0;J=i;K=G+80|0;do{c[G>>2]=c[J>>2];G=G+4|0;J=J+4|0}while((G|0)<(K|0));E=E+1|0}while((E|0)!=(H|0))}}H=w+68|0;E=H;J=c[E>>2]|0;G=c[E+4>>2]|0;E=B+68|0;K=E;L=c[K+4>>2]|0;F=H;c[F>>2]=c[K>>2];c[F+4>>2]=L;L=E;c[L>>2]=J;c[L+4>>2]=G;if(!D?(G=C+4|0,L=c[G>>2]|0,c[G>>2]=L+-1,(L|0)==0):0){La[c[(c[C>>2]|0)+8>>2]&31](C);zd(C)}if(!v){L=u+4|0;G=c[L>>2]|0;c[L>>2]=G+-1;if(!G){La[c[(c[u>>2]|0)+8>>2]&31](u);zd(u)}c[L>>2]=(c[L>>2]|0)+1}c[l>>2]=t;L=c[m>>2]|0;c[m>>2]=u;if(L|0?(G=L+4|0,J=c[G>>2]|0,c[G>>2]=J+-1,(J|0)==0):0){La[c[(c[L>>2]|0)+8>>2]&31](L);zd(L)}Na[c[(c[t>>2]|0)+4>>2]&3](w,-33686017,e);L=j+8|0;J=c[L>>2]|0;c[i>>2]=c[L+4>>2];c[n>>2]=J;J=c[o>>2]|0;if((J|0)==(c[p>>2]|0))bc(q,i);else{L=i;G=c[L+4>>2]|0;E=J;c[E>>2]=c[L>>2];c[E+4>>2]=G;c[o>>2]=(c[o>>2]|0)+8}a[r>>0]=1;G=s;c[G>>2]=Ia[c[(c[t>>2]|0)+12>>2]&7](w,e)|0;c[G+4>>2]=0}if(!v?(G=u+4|0,E=c[G>>2]|0,c[G>>2]=E+-1,(E|0)==0):0){La[c[(c[u>>2]|0)+8>>2]&31](u);zd(u)}b=c[b>>2]|0}while((b|0)!=0);Da=g;return}function ac(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);e=d;f=a+124|0;g=c[f>>2]|0;h=a+128|0;i=c[h>>2]|0;if((g|0)==(i|0)){j=g;c[h>>2]=j;Da=d;return}k=a+96|0;a=g;do{g=c[a+4>>2]|0;l=Le(0,c[a>>2]|0,g|0,((g|0)<0)<<31>>31|0)|0;g=w()|0;m=e;c[m>>2]=l;c[m+4>>2]=g;g=sb(k,e)|0;m=c[g>>2]|0;l=c[g+4>>2]|0;if(l){g=l+4|0;c[g>>2]=(c[g>>2]|0)+1;Ma[c[(c[m>>2]|0)+8>>2]&15](m,b);g=l+4|0;n=c[g>>2]|0;c[g>>2]=n+-1;if(!n){La[c[(c[l>>2]|0)+8>>2]&31](l);zd(l)}}else Ma[c[(c[m>>2]|0)+8>>2]&15](m,b);a=a+8|0}while((a|0)!=(i|0));j=c[f>>2]|0;c[h>>2]=j;Da=d;return}function bc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;d=a+4|0;e=c[a>>2]|0;f=(c[d>>2]|0)-e|0;g=f>>3;h=g+1|0;if(h>>>0>536870911)Ud(a);i=a+8|0;j=(c[i>>2]|0)-e|0;k=j>>2;l=j>>3>>>0<268435455?(k>>>0<h>>>0?h:k):536870911;do if(l)if(l>>>0>536870911){k=X(8)|0;Gd(k,4397);c[k>>2]=3988;$(k|0,3056,23)}else{k=Ad(l<<3)|0;m=k;n=k;break}else{m=0;n=0}while(0);k=m+(g<<3)|0;g=b;b=c[g+4>>2]|0;h=k;c[h>>2]=c[g>>2];c[h+4>>2]=b;if((f|0)>0)We(n|0,e|0,f|0)|0;c[a>>2]=m;c[d>>2]=k+8;c[i>>2]=m+(l<<3);if(!e)return;Bd(e);return}function cc(b,d){b=b|0;d=d|0;var e=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0.0,t=0,u=0,v=0,y=0,z=0.0,A=0,B=0,C=0,D=0,E=0,F=0;e=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);g=e;h=b+124|0;i=c[h>>2]|0;j=b+128|0;k=c[j>>2]|0;if((i|0)==(k|0)){l=i;c[j>>2]=l;rb(b,d);Da=e;return}m=b+96|0;n=i;do{i=c[n+4>>2]|0;o=Le(0,c[n>>2]|0,i|0,((i|0)<0)<<31>>31|0)|0;i=w()|0;p=g;c[p>>2]=o;c[p+4>>2]=i;i=sb(m,g)|0;p=c[i>>2]|0;o=c[i+4>>2]|0;i=(o|0)==0;if(!i){q=o+4|0;c[q>>2]=(c[q>>2]|0)+1}Ma[c[(c[p>>2]|0)+8>>2]&15](p,d);q=p+12|0;r=p+16|0;s=+f[r>>2]*2.0;f[q>>2]=+f[q>>2]*2.0;f[r>>2]=s;r=p+44|0;q=p+48|0;s=+f[q>>2]*2.0;f[r>>2]=+f[r>>2]*2.0;f[q>>2]=s;q=p+68|0;r=c[q>>2]|0;t=p+72|0;u=c[t>>2]|0;if((r|0)>(u|0)){v=r;y=u}else{u=r;while(1){r=c[d>>2]|0;s=+f[r+(u*80|0)+8>>2]*2.0;z=+f[r+(u*80|0)+12>>2]*2.0;f[r+(u*80|0)+36>>2]=50.0;f[r+(u*80|0)+48>>2]=s;f[r+(u*80|0)+52>>2]=z;A=r+(u*80|0)+76|0;c[A>>2]=c[A>>2]|2;B=c[t>>2]|0;if((u|0)<(B|0))u=u+1|0;else break}v=c[q>>2]|0;y=B}if((v|0)<=(y|0)){u=c[d>>2]|0;t=v;while(1){if((c[u+(t*80|0)+32>>2]|0)==6){A=c[u+(t*80|0)+28>>2]&-256;r=u+(t*80|0)+64|0;c[r>>2]=25;c[u+(t*80|0)+72>>2]=A;A=u+(t*80|0)+76|0;C=c[A>>2]|8;c[A>>2]=C;D=r;E=A;F=C}else{C=u+(t*80|0)+76|0;D=u+(t*80|0)+64|0;E=C;F=c[C>>2]|0}C=c[u+(t*80|0)+24>>2]&-256;c[D>>2]=25;c[u+(t*80|0)+68>>2]=C;c[E>>2]=F|4;if((t|0)<(y|0))t=t+1|0;else break}}a[p+64>>0]=0;if(!i?(t=o+4|0,u=c[t>>2]|0,c[t>>2]=u+-1,(u|0)==0):0){La[c[(c[o>>2]|0)+8>>2]&31](o);zd(o)}n=n+8|0}while((n|0)!=(k|0));l=c[h>>2]|0;c[j>>2]=l;rb(b,d);Da=e;return}function dc(b,d,e){b=b|0;d=d|0;e=e|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,y=0,z=0.0,A=0.0,B=0.0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;g=Da;Da=Da+48|0;if((Da|0)>=(Ea|0))x(48);h=g+16|0;i=g+8|0;j=g;if(!(a[b+136>>0]|0)){Da=g;return}k=b+96|0;l=c[b+104>>2]|0;if(!l){Da=g;return}m=d+4|0;n=j+4|0;o=b+144|0;p=b+124|0;q=b+128|0;r=b+132|0;s=l;while(1){l=s;t=c[l+16>>2]|0;u=c[l+20>>2]|0;v=(u|0)==0;if(!v){y=u+4|0;c[y>>2]=(c[y>>2]|0)+1}a:do if(((((a[t+64>>0]|0)!=0?(z=+f[d>>2],A=+f[m>>2],B=+f[t+4>>2],B<=z):0)?B+ +f[t+12>>2]>=z:0)?(z=+f[t+8>>2],z<=A):0)?z+ +f[t+16>>2]>=A:0){y=l+8|0;C=c[y>>2]|0;D=c[y+4>>2]|0;c[j>>2]=D;c[n>>2]=C;y=Ia[c[(c[t>>2]|0)+12>>2]&7](t,e)|0;E=o;F=c[E>>2]|0;G=c[E+4>>2]|0;c[h>>2]=D;c[h+4>>2]=C;c[h+8>>2]=y;y=h+16|0;c[y>>2]=F;c[y+4>>2]=G;md(6552,h)|0;G=c[q>>2]|0;y=c[p>>2]|0;F=G-y>>3;C=y;y=G;if((F>>>0>=2?(G=F+-2|0,(c[C+(G<<3)>>2]|0)==(c[j>>2]|0)):0)?(c[C+(G<<3)+4>>2]|0)==(c[n>>2]|0):0){G=F+-1|0;F=c[C+(G<<3)+4>>2]|0;D=Le(0,c[C+(G<<3)>>2]|0,F|0,((F|0)<0)<<31>>31|0)|0;F=w()|0;G=i;c[G>>2]=D;c[G+4>>2]=F;F=sb(k,i)|0;G=c[F>>2]|0;D=c[F+4>>2]|0;if(D){F=D+4|0;c[F>>2]=(c[F>>2]|0)+1;Ma[c[(c[G>>2]|0)+8>>2]&15](G,e);F=D+4|0;E=c[F>>2]|0;c[F>>2]=E+-1;if(!E){La[c[(c[D>>2]|0)+8>>2]&31](D);zd(D)}}else Ma[c[(c[G>>2]|0)+8>>2]&15](G,e);c[q>>2]=(c[q>>2]|0)+-8}else H=19;b:do if((H|0)==19){H=0;if((C|0)!=(y|0)){G=c[j>>2]|0;D=c[n>>2]|0;E=C;do{if((c[E>>2]|0)==(G|0)?(c[E+4>>2]|0)==(D|0):0)break b;E=E+8|0}while((E|0)!=(y|0))}E=Ia[c[(c[t>>2]|0)+12>>2]&7](t,e)|0;D=o;if(((c[D+4>>2]|0)==0?(c[D>>2]|0)==(E|0):0)?ec(b,j)|0:0){Na[c[(c[t>>2]|0)+4>>2]&3](t,-33686017,e);E=c[q>>2]|0;if((E|0)==(c[r>>2]|0))bc(p,j);else{D=j;G=c[D+4>>2]|0;F=E;c[F>>2]=c[D>>2];c[F+4>>2]=G;c[q>>2]=(c[q>>2]|0)+8}I=0;break a}}while(0);I=2}else I=0;while(0);if(!v?(t=u+4|0,l=c[t>>2]|0,c[t>>2]=l+-1,(l|0)==0):0){La[c[(c[u>>2]|0)+8>>2]&31](u);zd(u)}if(I|0){H=36;break}s=c[s>>2]|0;if(!s){H=36;break}}if((H|0)==36){Da=g;return}}function ec(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;e=c[b+124>>2]|0;f=(c[b+128>>2]|0)-e|0;g=e;if(!f){h=1;return h|0}e=(f>>3)+-1|0;f=c[g+(e<<3)+4>>2]|0;i=c[d+4>>2]|0;j=c[g+(e<<3)>>2]|0;e=c[d>>2]|0;if((f|0)==(i|0)?(j|0)==(e+-1|0)|(j|0)==(e+1|0):0){h=1;return h|0}if((j|0)==(e|0)?(f|0)==(i+-1|0)|(f|0)==(i+1|0):0){h=1;return h|0}d=(a[b+92>>0]|0)==0;if(((i|0)%2|0|0)==1|d){if((j|0)==(e+1|0)?(f|0)==(i+-1|0)|(f|0)==(i+1|0):0){h=1;return h|0}if((j|0)==(e+-1|0)&((i&1|0)==0|d))k=11}else if((i&1|0)==0&(j|0)==(e+-1|0))k=11;if((k|0)==11?(f|0)==(i+-1|0)|(f|0)==(i+1|0):0){h=1;return h|0}h=0;return h|0}function fc(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0;d=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);e=d;if((b|0)==(a|0)){Da=d;return}f=a+16|0;g=c[f>>2]|0;h=g;i=b+16|0;if((g|0)==(a|0))if((c[i>>2]|0)==(b|0)){Ma[c[(c[g>>2]|0)+12>>2]&15](g,e);j=c[f>>2]|0;La[c[(c[j>>2]|0)+16>>2]&31](j);c[f>>2]=0;j=c[i>>2]|0;Ma[c[(c[j>>2]|0)+12>>2]&15](j,a);j=c[i>>2]|0;La[c[(c[j>>2]|0)+16>>2]&31](j);c[i>>2]=0;c[f>>2]=a;Ma[c[(c[e>>2]|0)+12>>2]&15](e,b);La[c[(c[e>>2]|0)+16>>2]&31](e);c[i>>2]=b;Da=d;return}else{Ma[c[(c[g>>2]|0)+12>>2]&15](g,b);g=c[f>>2]|0;La[c[(c[g>>2]|0)+16>>2]&31](g);g=b+16|0;c[f>>2]=c[g>>2];c[g>>2]=b;Da=d;return}else{g=c[i>>2]|0;if((b|0)==(g|0)){Ma[c[(c[g>>2]|0)+12>>2]&15](g,a);b=c[i>>2]|0;La[c[(c[b>>2]|0)+16>>2]&31](b);c[i>>2]=c[f>>2];c[f>>2]=a;Da=d;return}else{c[f>>2]=g;c[i>>2]=h;Da=d;return}}}function gc(a){a=a|0;Bd(a);return}function hc(a){a=a|0;var b=0,d=0;b=Ad(20)|0;d=a+4|0;c[b>>2]=3316;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return b|0}function ic(a,b){a=a|0;b=b|0;var d=0;d=a+4|0;c[b>>2]=3316;a=b+4|0;c[a>>2]=c[d>>2];c[a+4>>2]=c[d+4>>2];c[a+8>>2]=c[d+8>>2];c[a+12>>2]=c[d+12>>2];return}function jc(a){a=a|0;return}function kc(a){a=a|0;Bd(a);return}function lc(b){b=b|0;var e=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,y=0,z=0,A=0,B=0,C=0,D=0.0;e=Da;Da=Da+96|0;if((Da|0)>=(Ea|0))x(96);h=e+80|0;i=e+64|0;j=e+56|0;k=e+48|0;l=e;m=b+4|0;a:do if(!(T(l|0)|0))n=m;else{o=l+16|0;p=l+20|0;q=l+24|0;r=k+4|0;s=k+4|0;t=l+20|0;u=k+4|0;v=l+8|0;y=l+4|0;z=l+12|0;b:while(1){c:do switch(c[l>>2]|0){case 256:{break b;break}case 769:{A=c[m>>2]|0;B=c[o>>2]|0;C=(c[A+16>>2]|0)+(B>>>5<<2)|0;c[C>>2]=c[C>>2]&~(1<<(B&31));C=c[A>>2]|0;Ma[c[(c[C>>2]|0)+4>>2]&15](C,B);break}case 768:{B=c[m>>2]|0;C=c[o>>2]|0;A=(c[B+16>>2]|0)+(C>>>5<<2)|0;c[A>>2]=c[A>>2]|1<<(C&31);A=c[B>>2]|0;Ma[c[(c[A>>2]|0)+8>>2]&15](A,C);break}case 1025:{D=+(c[q>>2]|0);C=c[c[m>>2]>>2]|0;A=c[(c[C>>2]|0)+12>>2]|0;f[k>>2]=+(c[p>>2]|0);f[r>>2]=D;c[h>>2]=c[k>>2];c[h+4>>2]=c[k+4>>2];Ma[A&15](C,h);break}case 1026:{D=+(c[q>>2]|0);C=c[c[m>>2]>>2]|0;A=c[(c[C>>2]|0)+16>>2]|0;f[k>>2]=+(c[p>>2]|0);f[s>>2]=D;c[h>>2]=c[k>>2];c[h+4>>2]=c[k+4>>2];Ma[A&15](C,h);break}case 1024:{D=+(c[q>>2]|0);C=c[c[m>>2]>>2]|0;A=c[(c[C>>2]|0)+20>>2]|0;f[k>>2]=+(c[t>>2]|0);f[u>>2]=D;c[h>>2]=c[k>>2];c[h+4>>2]=c[k+4>>2];Ma[A&15](C,h);break}case 512:{C=d[v>>0]|0;c[j>>2]=512;c[j+4>>2]=C;md(6694,j)|0;switch(a[v>>0]|0){case 13:{C=c[c[m>>2]>>2]|0;La[c[(c[C>>2]|0)+24>>2]&31](C);break c;break}case 5:{C=c[z>>2]|0;A=c[o>>2]|0;c[i>>2]=c[y>>2];c[i+4>>2]=C;c[i+8>>2]=A;md(6714,i)|0;break c;break}default:break c}break}default:{}}while(0);if(!(T(l|0)|0)){n=m;break a}}qe()}while(0);m=b+8|0;l=c[m>>2]|0;i=l;j=Le(c[i>>2]|0,c[i+4>>2]|0,1,0)|0;i=w()|0;h=l;c[h>>2]=j;c[h+4>>2]=i;D=+qa();i=c[n>>2]|0;n=c[c[b+12>>2]>>2]|0;h=c[m>>2]|0;m=c[h>>2]|0;j=c[h+4>>2]|0;h=c[i>>2]|0;Ha[c[c[h>>2]>>2]&1](h,D,i+16|0)|0;pc(i,n,D,m,j);g[c[b+16>>2]>>3]=D;Da=e;return}function mc(a,b){a=a|0;b=b|0;return ((c[b+4>>2]|0)==6741?a+4|0:0)|0}function nc(a){a=a|0;return 2920}function oc(a){a=a|0;return}function pc(b,d,e,g,h){b=b|0;d=d|0;e=+e;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0.0,p=0,q=0.0,r=0.0,s=0,t=0,u=0,v=0,x=0,y=0,z=0;h=c[(c[b>>2]|0)+4>>2]|0;na(d|0,0,0,~~+f[b+4>>2]|0,~~+f[b+8>>2]|0,c[b+12>>2]|0)|0;b=h+4|0;d=c[h>>2]|0;if((c[b>>2]|0)==(d|0))return;g=d;d=0;i=0;do{j=g;k=j+(i*80|0)|0;l=j+(i*80|0)+76|0;m=c[l>>2]|0;if((m&1|0)!=0?(n=j+(i*80|0)+40|0,e=+f[k>>2],o=(+f[n>>2]-e)*.5,p=j+(i*80|0)+4|0,q=+f[p>>2],r=(+f[j+(i*80|0)+44>>2]-q)*.5,f[k>>2]=e+o,f[p>>2]=q+r,o<1.0&r<1.0):0){p=m&-2;s=n;n=c[s+4>>2]|0;t=k;c[t>>2]=c[s>>2];c[t+4>>2]=n;c[l>>2]=p;u=p}else u=m;if((u&2|0)!=0?(m=j+(i*80|0)+48|0,p=j+(i*80|0)+8|0,r=+f[p>>2],o=(+f[m>>2]-r)*.5,n=j+(i*80|0)+12|0,q=+f[n>>2],e=(+f[j+(i*80|0)+52>>2]-q)*.5,f[p>>2]=r+o,f[n>>2]=q+e,o<1.0&e<1.0):0){n=u&-3;t=m;m=c[t+4>>2]|0;s=p;c[s>>2]=c[t>>2];c[s+4>>2]=m;c[l>>2]=n;v=n}else v=u;if((v&4|0)!=0?(n=j+(i*80|0)+24|0,m=c[n>>2]|0,s=Me(c[j+(i*80|0)+68>>2]|0,0,m|0,0)|0,t=Pe(s|0,w()|0,2,0)|0,w()|0,c[n>>2]=m+t,(t|0)==0):0){t=v&-5;c[l>>2]=t;x=t}else x=v;if(x&8|0?(t=j+(i*80|0)+28|0,m=c[t>>2]|0,n=Me(c[j+(i*80|0)+72>>2]|0,0,m|0,0)|0,s=Pe(n|0,w()|0,2,0)|0,w()|0,c[t>>2]=m+s,(s|0)==0):0)c[l>>2]=x&-9;switch(c[j+(i*80|0)+32>>2]|0){case 3:{l=(c[2812]|0)+((c[j+(i*80|0)+28>>2]|0)*12|0)|0;if((a[l+11>>0]|0)<0)y=c[l>>2]|0;else y=l;M(y|0,+(+f[k>>2]),+(+f[j+(i*80|0)+4>>2]),+(+f[j+(i*80|0)+8>>2]),+(+f[j+(i*80|0)+12>>2]),c[j+(i*80|0)+24>>2]|0);break}case 0:{e=+f[j+(i*80|0)+8>>2]*.5;o=+f[j+(i*80|0)+12>>2]*.5;J(+(e+ +f[k>>2]),+(o+ +f[j+(i*80|0)+4>>2]),+e,+o,c[j+(i*80|0)+24>>2]|0);break}case 2:{l=(c[2812]|0)+((c[j+(i*80|0)+28>>2]|0)*12|0)|0;if((a[l+11>>0]|0)<0)z=c[l>>2]|0;else z=l;L(z|0,+(+f[k>>2]),+(+f[j+(i*80|0)+4>>2]),+(+f[j+(i*80|0)+8>>2]),c[j+(i*80|0)+24>>2]|0);break}case 1:{K(+(+f[k>>2]),+(+f[j+(i*80|0)+4>>2]),+(+f[j+(i*80|0)+8>>2]),+(+f[j+(i*80|0)+12>>2]),c[j+(i*80|0)+24>>2]|0);break}case 6:{O(+(+f[k>>2]),+(+f[j+(i*80|0)+4>>2]),+(+f[j+(i*80|0)+8>>2]),+(+f[j+(i*80|0)+12>>2]),+(+f[j+(i*80|0)+16>>2]),+(+f[j+(i*80|0)+20>>2]),c[j+(i*80|0)+24>>2]|0,c[j+(i*80|0)+28>>2]|0);break}default:{}}i=Le(i|0,d|0,1,0)|0;d=w()|0;g=c[h>>2]|0}while(d>>>0<0|((d|0)==0?i>>>0<(((c[b>>2]|0)-g|0)/80|0)>>>0:0));return}function qc(){var b=0,d=0,e=0,f=0,g=0,h=0;b=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);d=b;e=Ad(16)|0;c[d>>2]=e;c[d+8>>2]=-2147483632;c[d+4>>2]=12;f=e;g=4040;h=f+12|0;do{a[f>>0]=a[g>>0]|0;f=f+1|0;g=g+1|0}while((f|0)<(h|0));a[e+12>>0]=0;Cd(8744,d);if((a[d+11>>0]|0)<0)Bd(c[d>>2]|0);d=Dd(8744)|0;c[2187]=d;e=1;g=d;do{g=(s(g>>>30^g,1812433253)|0)+e|0;c[8748+(e<<2)>>2]=g;e=e+1|0}while((e|0)!=624);c[2811]=0;c[2812]=0;c[2813]=0;c[2814]=0;c[2815]=0;c[2816]=0;c[2817]=0;c[2818]=0;c[2819]=1065353216;c[2184]=0;Da=b;return}function rc(a){a=a|0;var b=0,d=0;b=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);d=b;c[d>>2]=wc(c[a+60>>2]|0)|0;a=uc(ka(6,d|0)|0)|0;Da=b;return a|0}function sc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0;e=Da;Da=Da+48|0;if((Da|0)>=(Ea|0))x(48);f=e+32|0;g=e+16|0;h=e;i=a+28|0;j=c[i>>2]|0;c[h>>2]=j;k=a+20|0;l=(c[k>>2]|0)-j|0;c[h+4>>2]=l;c[h+8>>2]=b;c[h+12>>2]=d;b=l+d|0;l=a+60|0;c[g>>2]=c[l>>2];c[g+4>>2]=h;c[g+8>>2]=2;j=uc(fa(146,g|0)|0)|0;a:do if((b|0)!=(j|0)){g=2;m=b;n=h;o=j;while(1){if((o|0)<0)break;m=m-o|0;p=c[n+4>>2]|0;q=o>>>0>p>>>0;r=q?n+8|0:n;s=g+(q<<31>>31)|0;t=o-(q?p:0)|0;c[r>>2]=(c[r>>2]|0)+t;p=r+4|0;c[p>>2]=(c[p>>2]|0)-t;c[f>>2]=c[l>>2];c[f+4>>2]=r;c[f+8>>2]=s;o=uc(fa(146,f|0)|0)|0;if((m|0)==(o|0)){u=3;break a}else{g=s;n=r}}c[a+16>>2]=0;c[i>>2]=0;c[k>>2]=0;c[a>>2]=c[a>>2]|32;if((g|0)==2)v=0;else v=d-(c[n+4>>2]|0)|0}else u=3;while(0);if((u|0)==3){u=c[a+44>>2]|0;c[a+16>>2]=u+(c[a+48>>2]|0);a=u;c[i>>2]=a;c[k>>2]=a;v=d}Da=e;return v|0}function tc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0;e=Da;Da=Da+32|0;if((Da|0)>=(Ea|0))x(32);f=e;g=e+20|0;c[f>>2]=c[a+60>>2];c[f+4>>2]=0;c[f+8>>2]=b;c[f+12>>2]=g;c[f+16>>2]=d;if((uc(ea(140,f|0)|0)|0)<0){c[g>>2]=-1;h=-1}else h=c[g>>2]|0;Da=e;return h|0}function uc(a){a=a|0;var b=0;if(a>>>0>4294963200){c[(vc()|0)>>2]=0-a;b=-1}else b=a;return b|0}function vc(){return 11344}function wc(a){a=a|0;return a|0}function xc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0;f=Da;Da=Da+32|0;if((Da|0)>=(Ea|0))x(32);g=f;c[b+36>>2]=1;if((c[b>>2]&64|0)==0?(c[g>>2]=c[b+60>>2],c[g+4>>2]=21523,c[g+8>>2]=f+16,ja(54,g|0)|0):0)a[b+75>>0]=-1;g=sc(b,d,e)|0;Da=f;return g|0}function yc(a){a=a|0;return (a+-48|0)>>>0<10|0}function zc(){return 3612}function Ac(b,c){b=b|0;c=c|0;var d=0,e=0,f=0,g=0;d=a[b>>0]|0;e=a[c>>0]|0;if(d<<24>>24==0?1:d<<24>>24!=e<<24>>24){f=e;g=d}else{d=c;c=b;do{c=c+1|0;d=d+1|0;b=a[c>>0]|0;e=a[d>>0]|0}while(!(b<<24>>24==0?1:b<<24>>24!=e<<24>>24));f=e;g=b}return (g&255)-(f&255)|0}function Bc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=b;a:do if(!(d&3)){e=b;f=5}else{g=b;h=d;while(1){if(!(a[g>>0]|0)){i=h;break a}j=g+1|0;h=j;if(!(h&3)){e=j;f=5;break}else g=j}}while(0);if((f|0)==5){f=e;while(1){k=c[f>>2]|0;if(!((k&-2139062144^-2139062144)&k+-16843009))f=f+4|0;else break}if(!((k&255)<<24>>24))l=f;else{k=f;while(1){f=k+1|0;if(!(a[f>>0]|0)){l=f;break}else k=f}}i=l}return i-d|0}function Cc(a,b){a=a|0;b=b|0;var c=0;c=Bc(a)|0;return ((Dc(a,1,c,b)|0)!=(c|0))<<31>>31|0}function Dc(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=s(d,b)|0;g=(b|0)==0?0:d;if((c[e+76>>2]|0)>-1){d=(Fc(e)|0)==0;h=Ic(a,f,e)|0;if(d)i=h;else{Ec(e);i=h}}else i=Ic(a,f,e)|0;if((i|0)==(f|0))j=g;else j=(i>>>0)/(b>>>0)|0;return j|0}function Ec(a){a=a|0;return}function Fc(a){a=a|0;return 1}function Gc(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0;f=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);g=f;h=e&255;a[g>>0]=h;i=b+16|0;j=c[i>>2]|0;if(!j)if(!(Hc(b)|0)){k=c[i>>2]|0;l=4}else m=-1;else{k=j;l=4}do if((l|0)==4){j=b+20|0;i=c[j>>2]|0;if(i>>>0<k>>>0?(n=e&255,(n|0)!=(a[b+75>>0]|0)):0){c[j>>2]=i+1;a[i>>0]=h;m=n;break}if((Ja[c[b+36>>2]&7](b,g,1)|0)==1)m=d[g>>0]|0;else m=-1}while(0);Da=f;return m|0}function Hc(b){b=b|0;var d=0,e=0,f=0;d=b+74|0;e=a[d>>0]|0;a[d>>0]=e+255|e;e=c[b>>2]|0;if(!(e&8)){c[b+8>>2]=0;c[b+4>>2]=0;d=c[b+44>>2]|0;c[b+28>>2]=d;c[b+20>>2]=d;c[b+16>>2]=d+(c[b+48>>2]|0);f=0}else{c[b>>2]=e|32;f=-1}return f|0}function Ic(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;f=e+16|0;g=c[f>>2]|0;if(!g)if(!(Hc(e)|0)){h=c[f>>2]|0;i=5}else j=0;else{h=g;i=5}a:do if((i|0)==5){g=e+20|0;f=c[g>>2]|0;k=f;if((h-f|0)>>>0<d>>>0){j=Ja[c[e+36>>2]&7](e,b,d)|0;break}b:do if((a[e+75>>0]|0)<0|(d|0)==0){l=0;m=b;n=d;o=k}else{f=d;while(1){p=f+-1|0;if((a[b+p>>0]|0)==10)break;if(!p){l=0;m=b;n=d;o=k;break b}else f=p}p=Ja[c[e+36>>2]&7](e,b,f)|0;if(p>>>0<f>>>0){j=p;break a}l=f;m=b+f|0;n=d-f|0;o=c[g>>2]|0}while(0);We(o|0,m|0,n|0)|0;c[g>>2]=(c[g>>2]|0)+n;j=l+n|0}while(0);return j|0}function Jc(a,b){a=a|0;b=b|0;var d=0;if(!b)d=0;else d=Kc(c[b>>2]|0,c[b+4>>2]|0,a)|0;return ((d|0)==0?a:d)|0}function Kc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=(c[b>>2]|0)+1794895138|0;g=Lc(c[b+8>>2]|0,f)|0;h=Lc(c[b+12>>2]|0,f)|0;i=Lc(c[b+16>>2]|0,f)|0;a:do if((g>>>0<d>>>2>>>0?(j=d-(g<<2)|0,h>>>0<j>>>0&i>>>0<j>>>0):0)?((i|h)&3|0)==0:0){j=h>>>2;k=i>>>2;l=0;m=g;while(1){n=m>>>1;o=l+n|0;p=o<<1;q=p+j|0;r=Lc(c[b+(q<<2)>>2]|0,f)|0;s=Lc(c[b+(q+1<<2)>>2]|0,f)|0;if(!(s>>>0<d>>>0&r>>>0<(d-s|0)>>>0)){t=0;break a}if(a[b+(s+r)>>0]|0){t=0;break a}r=Ac(e,b+s|0)|0;if(!r)break;s=(r|0)<0;if((m|0)==1){t=0;break a}l=s?l:o;m=s?n:m-n|0}m=p+k|0;l=Lc(c[b+(m<<2)>>2]|0,f)|0;j=Lc(c[b+(m+1<<2)>>2]|0,f)|0;if(j>>>0<d>>>0&l>>>0<(d-j|0)>>>0)t=(a[b+(j+l)>>0]|0)==0?b+j|0:0;else t=0}else t=0;while(0);return t|0}function Lc(a,b){a=a|0;b=b|0;var c=0;c=Ve(a|0)|0;return ((b|0)==0?a:c)|0}function Mc(){ba(11348);return 11356}function Nc(){la(11348);return}function Oc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;do if(a){if((c[a+76>>2]|0)<=-1){b=Pc(a)|0;break}d=(Fc(a)|0)==0;e=Pc(a)|0;if(d)b=e;else{Ec(a);b=e}}else{if(!(c[902]|0))f=0;else f=Oc(c[902]|0)|0;e=c[(Mc()|0)>>2]|0;if(!e)g=f;else{d=e;e=f;while(1){if((c[d+76>>2]|0)>-1)h=Fc(d)|0;else h=0;if((c[d+20>>2]|0)>>>0>(c[d+28>>2]|0)>>>0)i=Pc(d)|0|e;else i=e;if(h|0)Ec(d);d=c[d+56>>2]|0;if(!d){g=i;break}else e=i}}Nc();b=g}while(0);return b|0}function Pc(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0;b=a+20|0;d=a+28|0;if((c[b>>2]|0)>>>0>(c[d>>2]|0)>>>0?(Ja[c[a+36>>2]&7](a,0,0)|0,(c[b>>2]|0)==0):0)e=-1;else{f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;if(g>>>0<i>>>0)Ja[c[a+40>>2]&7](a,g-i|0,1)|0;c[a+16>>2]=0;c[d>>2]=0;c[b>>2]=0;c[h>>2]=0;c[f>>2]=0;e=0}return e|0}function Qc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,x=0,y=0;f=d&255;g=(e|0)!=0;a:do if(g&(b&3|0)!=0){h=d&255;i=b;j=e;while(1){if((a[i>>0]|0)==h<<24>>24){k=i;l=j;m=6;break a}n=i+1|0;o=j+-1|0;p=(o|0)!=0;if(p&(n&3|0)!=0){i=n;j=o}else{q=n;r=o;t=p;m=5;break}}}else{q=b;r=e;t=g;m=5}while(0);if((m|0)==5)if(t){k=q;l=r;m=6}else m=16;b:do if((m|0)==6){r=d&255;if((a[k>>0]|0)==r<<24>>24)if(!l){m=16;break}else{u=k;break}q=s(f,16843009)|0;c:do if(l>>>0>3){t=k;g=l;while(1){e=c[t>>2]^q;if((e&-2139062144^-2139062144)&e+-16843009|0){v=g;w=t;break c}e=t+4|0;b=g+-4|0;if(b>>>0>3){t=e;g=b}else{x=e;y=b;m=11;break}}}else{x=k;y=l;m=11}while(0);if((m|0)==11)if(!y){m=16;break}else{v=y;w=x}q=w;g=v;while(1){if((a[q>>0]|0)==r<<24>>24){u=q;break b}g=g+-1|0;if(!g){m=16;break}else q=q+1|0}}while(0);if((m|0)==16)u=0;return u|0}function Rc(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;f=Da;Da=Da+224|0;if((Da|0)>=(Ea|0))x(224);g=f+208|0;h=f+160|0;i=f+80|0;j=f;k=h;l=k+40|0;do{c[k>>2]=0;k=k+4|0}while((k|0)<(l|0));c[g>>2]=c[e>>2];if((Sc(0,d,g,i,h)|0)<0)m=-1;else{if((c[b+76>>2]|0)>-1)n=Fc(b)|0;else n=0;e=c[b>>2]|0;k=e&32;if((a[b+74>>0]|0)<1)c[b>>2]=e&-33;e=b+48|0;if(!(c[e>>2]|0)){l=b+44|0;o=c[l>>2]|0;c[l>>2]=j;p=b+28|0;c[p>>2]=j;q=b+20|0;c[q>>2]=j;c[e>>2]=80;r=b+16|0;c[r>>2]=j+80;j=Sc(b,d,g,i,h)|0;if(!o)s=j;else{Ja[c[b+36>>2]&7](b,0,0)|0;t=(c[q>>2]|0)==0?-1:j;c[l>>2]=o;c[e>>2]=0;c[r>>2]=0;c[p>>2]=0;c[q>>2]=0;s=t}}else s=Sc(b,d,g,i,h)|0;h=c[b>>2]|0;c[b>>2]=h|k;if(n|0)Ec(b);m=(h&32|0)==0?s:-1}Da=f;return m|0}function Sc(d,e,f,h,i){d=d|0;e=e|0;f=f|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Fa=0;j=Da;Da=Da+64|0;if((Da|0)>=(Ea|0))x(64);k=j+56|0;l=j+40|0;m=j;n=j+48|0;o=j+60|0;c[k>>2]=e;e=(d|0)!=0;p=m+40|0;q=p;r=m+39|0;m=n+4|0;s=0;t=0;u=0;a:while(1){v=s;y=t;while(1){do if((y|0)>-1)if((v|0)>(2147483647-y|0)){c[(vc()|0)>>2]=75;z=-1;break}else{z=v+y|0;break}else z=y;while(0);A=c[k>>2]|0;B=a[A>>0]|0;if(!(B<<24>>24)){C=94;break a}D=B;B=A;b:while(1){switch(D<<24>>24){case 37:{C=10;break b;break}case 0:{E=B;break b;break}default:{}}F=B+1|0;c[k>>2]=F;D=a[F>>0]|0;B=F}c:do if((C|0)==10){C=0;D=B;F=B;while(1){if((a[F+1>>0]|0)!=37){E=D;break c}G=D+1|0;F=F+2|0;c[k>>2]=F;if((a[F>>0]|0)!=37){E=G;break}else D=G}}while(0);v=E-A|0;if(e)Tc(d,A,v);if(!v)break;else y=z}y=(yc(a[(c[k>>2]|0)+1>>0]|0)|0)==0;v=c[k>>2]|0;if(!y?(a[v+2>>0]|0)==36:0){H=(a[v+1>>0]|0)+-48|0;I=1;J=3}else{H=-1;I=u;J=1}y=v+J|0;c[k>>2]=y;v=a[y>>0]|0;B=(v<<24>>24)+-32|0;if(B>>>0>31|(1<<B&75913|0)==0){K=0;L=v;M=y}else{v=0;D=B;B=y;while(1){y=1<<D|v;F=B+1|0;c[k>>2]=F;G=a[F>>0]|0;D=(G<<24>>24)+-32|0;if(D>>>0>31|(1<<D&75913|0)==0){K=y;L=G;M=F;break}else{v=y;B=F}}}if(L<<24>>24==42){if((yc(a[M+1>>0]|0)|0)!=0?(B=c[k>>2]|0,(a[B+2>>0]|0)==36):0){v=B+1|0;c[i+((a[v>>0]|0)+-48<<2)>>2]=10;N=c[h+((a[v>>0]|0)+-48<<3)>>2]|0;O=1;P=B+3|0}else{if(I|0){Q=-1;break}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);v=c[B>>2]|0;c[f>>2]=B+4;R=v}else R=0;N=R;O=0;P=(c[k>>2]|0)+1|0}c[k>>2]=P;v=(N|0)<0;S=v?0-N|0:N;T=v?K|8192:K;U=O;V=P}else{v=Uc(k)|0;if((v|0)<0){Q=-1;break}S=v;T=K;U=I;V=c[k>>2]|0}do if((a[V>>0]|0)==46){v=V+1|0;if((a[v>>0]|0)!=42){c[k>>2]=v;v=Uc(k)|0;W=v;X=c[k>>2]|0;break}if(yc(a[V+2>>0]|0)|0?(v=c[k>>2]|0,(a[v+3>>0]|0)==36):0){B=v+2|0;c[i+((a[B>>0]|0)+-48<<2)>>2]=10;D=c[h+((a[B>>0]|0)+-48<<3)>>2]|0;B=v+4|0;c[k>>2]=B;W=D;X=B;break}if(U|0){Q=-1;break a}if(e){B=(c[f>>2]|0)+(4-1)&~(4-1);D=c[B>>2]|0;c[f>>2]=B+4;Y=D}else Y=0;D=(c[k>>2]|0)+2|0;c[k>>2]=D;W=Y;X=D}else{W=-1;X=V}while(0);D=0;B=X;while(1){if(((a[B>>0]|0)+-65|0)>>>0>57){Q=-1;break a}v=B;B=B+1|0;c[k>>2]=B;Z=a[(a[v>>0]|0)+-65+(16+(D*58|0))>>0]|0;_=Z&255;if((_+-1|0)>>>0>=8)break;else D=_}if(!(Z<<24>>24)){Q=-1;break}v=(H|0)>-1;do if(Z<<24>>24==19)if(v){Q=-1;break a}else C=54;else{if(v){c[i+(H<<2)>>2]=_;F=h+(H<<3)|0;y=c[F+4>>2]|0;G=l;c[G>>2]=c[F>>2];c[G+4>>2]=y;C=54;break}if(!e){Q=0;break a}Vc(l,_,f);$=c[k>>2]|0;C=55}while(0);if((C|0)==54){C=0;if(e){$=B;C=55}else aa=0}d:do if((C|0)==55){C=0;v=a[$+-1>>0]|0;y=(D|0)!=0&(v&15|0)==3?v&-33:v;v=T&-65537;G=(T&8192|0)==0?T:v;e:do switch(y|0){case 110:{switch((D&255)<<24>>24){case 0:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 1:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 2:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}case 3:{b[c[l>>2]>>1]=z;aa=0;break d;break}case 4:{a[c[l>>2]>>0]=z;aa=0;break d;break}case 6:{c[c[l>>2]>>2]=z;aa=0;break d;break}case 7:{F=c[l>>2]|0;c[F>>2]=z;c[F+4>>2]=((z|0)<0)<<31>>31;aa=0;break d;break}default:{aa=0;break d}}break}case 112:{ba=120;ca=W>>>0>8?W:8;da=G|8;C=67;break}case 88:case 120:{ba=y;ca=W;da=G;C=67;break}case 111:{F=l;ea=c[F>>2]|0;fa=c[F+4>>2]|0;F=Xc(ea,fa,p)|0;ga=q-F|0;ha=F;ia=0;ja=6782;ka=(G&8|0)==0|(W|0)>(ga|0)?W:ga+1|0;la=G;ma=ea;na=fa;C=73;break}case 105:case 100:{fa=l;ea=c[fa>>2]|0;ga=c[fa+4>>2]|0;if((ga|0)<0){fa=Me(0,0,ea|0,ga|0)|0;F=w()|0;oa=l;c[oa>>2]=fa;c[oa+4>>2]=F;pa=1;qa=6782;ra=fa;sa=F;C=72;break e}else{pa=(G&2049|0)!=0&1;qa=(G&2048|0)==0?((G&1|0)==0?6782:6784):6783;ra=ea;sa=ga;C=72;break e}break}case 117:{ga=l;pa=0;qa=6782;ra=c[ga>>2]|0;sa=c[ga+4>>2]|0;C=72;break}case 99:{a[r>>0]=c[l>>2];ta=r;ua=0;va=6782;wa=1;xa=v;ya=q;break}case 109:{za=Zc(c[(vc()|0)>>2]|0)|0;C=77;break}case 115:{ga=c[l>>2]|0;za=(ga|0)==0?6792:ga;C=77;break}case 67:{c[n>>2]=c[l>>2];c[m>>2]=0;c[l>>2]=n;Aa=-1;C=81;break}case 83:{if(!W){_c(d,32,S,0,G);Ba=0;C=91}else{Aa=W;C=81}break}case 65:case 71:case 70:case 69:case 97:case 103:case 102:case 101:{aa=ad(d,+g[l>>3],S,W,G,y)|0;break d;break}default:{ta=A;ua=0;va=6782;wa=W;xa=G;ya=q}}while(0);f:do if((C|0)==67){C=0;y=l;ga=c[y>>2]|0;ea=c[y+4>>2]|0;y=Wc(ga,ea,p,ba&32)|0;F=(da&8|0)==0|(ga|0)==0&(ea|0)==0;ha=y;ia=F?0:2;ja=F?6782:6782+(ba>>>4)|0;ka=ca;la=da;ma=ga;na=ea;C=73}else if((C|0)==72){C=0;ha=Yc(ra,sa,p)|0;ia=pa;ja=qa;ka=W;la=G;ma=ra;na=sa;C=73}else if((C|0)==77){C=0;ea=Qc(za,0,W)|0;ga=(ea|0)==0;ta=za;ua=0;va=6782;wa=ga?W:ea-za|0;xa=v;ya=ga?za+W|0:ea}else if((C|0)==81){C=0;ea=c[l>>2]|0;ga=0;while(1){F=c[ea>>2]|0;if(!F){Ca=ga;break}y=$c(o,F)|0;Fa=(y|0)<0;if(Fa|y>>>0>(Aa-ga|0)>>>0){C=85;break}F=y+ga|0;if(Aa>>>0>F>>>0){ea=ea+4|0;ga=F}else{Ca=F;break}}if((C|0)==85){C=0;if(Fa){Q=-1;break a}else Ca=ga}_c(d,32,S,Ca,G);if(!Ca){Ba=0;C=91}else{ea=c[l>>2]|0;F=0;while(1){y=c[ea>>2]|0;if(!y){Ba=Ca;C=91;break f}fa=$c(o,y)|0;F=fa+F|0;if((F|0)>(Ca|0)){Ba=Ca;C=91;break f}Tc(d,o,fa);if(F>>>0>=Ca>>>0){Ba=Ca;C=91;break}else ea=ea+4|0}}}while(0);if((C|0)==73){C=0;v=(ma|0)!=0|(na|0)!=0;ea=(ka|0)!=0|v;F=q-ha+((v^1)&1)|0;ta=ea?ha:p;ua=ia;va=ja;wa=ea?((ka|0)>(F|0)?ka:F):0;xa=(ka|0)>-1?la&-65537:la;ya=q}else if((C|0)==91){C=0;_c(d,32,S,Ba,G^8192);aa=(S|0)>(Ba|0)?S:Ba;break}F=ya-ta|0;ea=(wa|0)<(F|0)?F:wa;v=ea+ua|0;ga=(S|0)<(v|0)?v:S;_c(d,32,ga,v,xa);Tc(d,va,ua);_c(d,48,ga,v,xa^65536);_c(d,48,ea,F,0);Tc(d,ta,F);_c(d,32,ga,v,xa^8192);aa=ga}while(0);s=aa;t=z;u=U}g:do if((C|0)==94)if(!d)if(!u)Q=0;else{U=1;while(1){t=c[i+(U<<2)>>2]|0;if(!t)break;Vc(h+(U<<3)|0,t,f);t=U+1|0;if(t>>>0<10)U=t;else{Q=1;break g}}t=U;while(1){if(c[i+(t<<2)>>2]|0){Q=-1;break g}t=t+1|0;if(t>>>0>=10){Q=1;break}}}else Q=z;while(0);Da=j;return Q|0}function Tc(a,b,d){a=a|0;b=b|0;d=d|0;if(!(c[a>>2]&32))Ic(b,d,a)|0;return}function Uc(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;if(!(yc(a[c[b>>2]>>0]|0)|0))d=0;else{e=0;while(1){f=c[b>>2]|0;g=(e*10|0)+-48+(a[f>>0]|0)|0;h=f+1|0;c[b>>2]=h;if(!(yc(a[h>>0]|0)|0)){d=g;break}else e=g}}return d|0}function Vc(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,h=0,i=0,j=0.0;a:do if(b>>>0<=20)do switch(b|0){case 9:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;c[a>>2]=f;break a;break}case 10:{f=(c[d>>2]|0)+(4-1)&~(4-1);e=c[f>>2]|0;c[d>>2]=f+4;f=a;c[f>>2]=e;c[f+4>>2]=((e|0)<0)<<31>>31;break a;break}case 11:{e=(c[d>>2]|0)+(4-1)&~(4-1);f=c[e>>2]|0;c[d>>2]=e+4;e=a;c[e>>2]=f;c[e+4>>2]=0;break a;break}case 12:{e=(c[d>>2]|0)+(8-1)&~(8-1);f=e;h=c[f>>2]|0;i=c[f+4>>2]|0;c[d>>2]=e+8;e=a;c[e>>2]=h;c[e+4>>2]=i;break a;break}case 13:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&65535)<<16>>16;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 14:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&65535;c[i+4>>2]=0;break a;break}case 15:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=(e&255)<<24>>24;e=a;c[e>>2]=i;c[e+4>>2]=((i|0)<0)<<31>>31;break a;break}case 16:{i=(c[d>>2]|0)+(4-1)&~(4-1);e=c[i>>2]|0;c[d>>2]=i+4;i=a;c[i>>2]=e&255;c[i+4>>2]=0;break a;break}case 17:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}case 18:{i=(c[d>>2]|0)+(8-1)&~(8-1);j=+g[i>>3];c[d>>2]=i+8;g[a>>3]=j;break a;break}default:break a}while(0);while(0);return}function Wc(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0;if((b|0)==0&(c|0)==0)g=e;else{h=e;e=c;c=b;while(1){b=h+-1|0;a[b>>0]=d[480+(c&15)>>0]|0|f;c=Te(c|0,e|0,4)|0;e=w()|0;if((c|0)==0&(e|0)==0){g=b;break}else h=b}}return g|0}function Xc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0;if((b|0)==0&(c|0)==0)e=d;else{f=d;d=c;c=b;while(1){b=f+-1|0;a[b>>0]=c&7|48;c=Te(c|0,d|0,3)|0;d=w()|0;if((c|0)==0&(d|0)==0){e=b;break}else f=b}}return e|0}function Yc(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;if(c>>>0>0|(c|0)==0&b>>>0>4294967295){e=d;f=b;g=c;do{c=f;f=Se(f|0,g|0,10,0)|0;h=g;g=w()|0;i=Re(f|0,g|0,10,0)|0;j=Me(c|0,h|0,i|0,w()|0)|0;w()|0;e=e+-1|0;a[e>>0]=j&255|48}while(h>>>0>9|(h|0)==9&c>>>0>4294967295);k=f;l=e}else{k=b;l=d}if(!k)m=l;else{d=k;k=l;while(1){l=d;d=(d>>>0)/10|0;b=k+-1|0;a[b>>0]=l-(d*10|0)|48;if(l>>>0<10){m=b;break}else k=b}}return m|0}function Zc(a){a=a|0;return hd(a,c[(gd()|0)+188>>2]|0)|0}function _c(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=Da;Da=Da+256|0;if((Da|0)>=(Ea|0))x(256);g=f;if((c|0)>(d|0)&(e&73728|0)==0){e=c-d|0;Xe(g|0,b<<24>>24|0,(e>>>0<256?e:256)|0)|0;if(e>>>0>255){b=c-d|0;d=e;do{Tc(a,g,256);d=d+-256|0}while(d>>>0>255);h=b&255}else h=e;Tc(a,g,h)}Da=f;return}function $c(a,b){a=a|0;b=b|0;var c=0;if(!a)c=0;else c=ed(a,b,0)|0;return c|0}function ad(b,e,f,g,h,i){b=b|0;e=+e;f=f|0;g=g|0;h=h|0;i=i|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0.0,u=0,v=0.0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0.0,H=0,I=0,J=0,K=0.0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0.0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0.0,ja=0.0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0;j=Da;Da=Da+560|0;if((Da|0)>=(Ea|0))x(560);k=j+32|0;l=j+536|0;m=j;n=m;o=j+540|0;c[l>>2]=0;p=o+12|0;q=bd(e)|0;r=w()|0;if((r|0)<0){t=-e;u=bd(t)|0;v=t;y=1;z=6799;A=w()|0;B=u}else{v=e;y=(h&2049|0)!=0&1;z=(h&2048|0)==0?((h&1|0)==0?6800:6805):6802;A=r;B=q}do if(0==0&(A&2146435072|0)==2146435072){q=(i&32|0)!=0;B=y+3|0;_c(b,32,f,B,h&-65537);Tc(b,z,y);Tc(b,v!=v|0.0!=0.0?(q?6826:6830):q?6818:6822,3);_c(b,32,f,B,h^8192);C=B}else{e=+cd(v,l)*2.0;B=e!=0.0;if(B)c[l>>2]=(c[l>>2]|0)+-1;q=i|32;if((q|0)==97){r=i&32;u=(r|0)==0?z:z+9|0;D=y|2;E=12-g|0;do if(!(g>>>0>11|(E|0)==0)){t=8.0;F=E;do{F=F+-1|0;t=t*16.0}while((F|0)!=0);if((a[u>>0]|0)==45){G=-(t+(-e-t));break}else{G=e+t-t;break}}else G=e;while(0);E=c[l>>2]|0;F=(E|0)<0?0-E|0:E;H=Yc(F,((F|0)<0)<<31>>31,p)|0;if((H|0)==(p|0)){F=o+11|0;a[F>>0]=48;I=F}else I=H;a[I+-1>>0]=(E>>31&2)+43;E=I+-2|0;a[E>>0]=i+15;H=(g|0)<1;F=(h&8|0)==0;J=m;K=G;while(1){L=~~K;M=J+1|0;a[J>>0]=r|d[480+L>>0];K=(K-+(L|0))*16.0;if((M-n|0)==1?!(F&(H&K==0.0)):0){a[M>>0]=46;N=J+2|0}else N=M;if(!(K!=0.0))break;else J=N}J=N;if((g|0)!=0?(-2-n+J|0)<(g|0):0){H=p;F=E;O=g+2+H-F|0;P=H;Q=F}else{F=p;H=E;O=F-n-H+J|0;P=F;Q=H}H=O+D|0;_c(b,32,f,H,h);Tc(b,u,D);_c(b,48,f,H,h^65536);F=J-n|0;Tc(b,m,F);J=P-Q|0;_c(b,48,O-(F+J)|0,0,0);Tc(b,E,J);_c(b,32,f,H,h^8192);C=H;break}H=(g|0)<0?6:g;if(B){J=(c[l>>2]|0)+-28|0;c[l>>2]=J;R=e*268435456.0;S=J}else{R=e;S=c[l>>2]|0}J=(S|0)<0?k:k+288|0;F=J;K=R;do{r=~~K>>>0;c[F>>2]=r;F=F+4|0;K=(K-+(r>>>0))*1.0e9}while(K!=0.0);B=J;if((S|0)>0){E=J;D=F;u=S;while(1){r=(u|0)<29?u:29;M=D+-4|0;if(M>>>0>=E>>>0){L=M;M=0;do{T=Ue(c[L>>2]|0,0,r|0)|0;U=Le(T|0,w()|0,M|0,0)|0;T=w()|0;M=Se(U|0,T|0,1e9,0)|0;V=Re(M|0,w()|0,1e9,0)|0;W=Me(U|0,T|0,V|0,w()|0)|0;w()|0;c[L>>2]=W;L=L+-4|0}while(L>>>0>=E>>>0);if(M){L=E+-4|0;c[L>>2]=M;X=L}else X=E}else X=E;a:do if(D>>>0>X>>>0){L=D;while(1){W=L+-4|0;if(c[W>>2]|0){Y=L;break a}if(W>>>0>X>>>0)L=W;else{Y=W;break}}}else Y=D;while(0);M=(c[l>>2]|0)-r|0;c[l>>2]=M;if((M|0)>0){E=X;D=Y;u=M}else{Z=X;_=Y;$=M;break}}}else{Z=J;_=F;$=S}if(($|0)<0){u=((H+25|0)/9|0)+1|0;D=(q|0)==102;E=Z;M=_;L=$;while(1){W=0-L|0;V=(W|0)<9?W:9;if(E>>>0<M>>>0){W=(1<<V)+-1|0;T=1e9>>>V;U=0;aa=E;do{ba=c[aa>>2]|0;c[aa>>2]=(ba>>>V)+U;U=s(ba&W,T)|0;aa=aa+4|0}while(aa>>>0<M>>>0);aa=(c[E>>2]|0)==0?E+4|0:E;if(!U){ca=M;da=aa}else{c[M>>2]=U;ca=M+4|0;da=aa}}else{ca=M;da=(c[E>>2]|0)==0?E+4|0:E}aa=D?J:da;T=(ca-aa>>2|0)>(u|0)?aa+(u<<2)|0:ca;L=(c[l>>2]|0)+V|0;c[l>>2]=L;if((L|0)>=0){ea=da;fa=T;break}else{E=da;M=T}}}else{ea=Z;fa=_}if(ea>>>0<fa>>>0){M=(B-ea>>2)*9|0;E=c[ea>>2]|0;if(E>>>0<10)ga=M;else{L=M;M=10;while(1){M=M*10|0;u=L+1|0;if(E>>>0<M>>>0){ga=u;break}else L=u}}}else ga=0;L=(q|0)==103;M=(H|0)!=0;E=H-((q|0)==102?0:ga)+((M&L)<<31>>31)|0;if((E|0)<(((fa-B>>2)*9|0)+-9|0)){u=E+9216|0;E=(u|0)/9|0;D=J+4+(E+-1024<<2)|0;F=u-(E*9|0)|0;if((F|0)<8){E=F;F=10;while(1){u=F*10|0;if((E|0)<7){E=E+1|0;F=u}else{ha=u;break}}}else ha=10;F=c[D>>2]|0;E=(F>>>0)/(ha>>>0)|0;q=F-(s(E,ha)|0)|0;u=(D+4|0)==(fa|0);if(!(u&(q|0)==0)){t=(E&1|0)==0?9007199254740992.0:9007199254740994.0;E=ha>>>1;K=q>>>0<E>>>0?.5:u&(q|0)==(E|0)?1.0:1.5;if(!y){ia=K;ja=t}else{E=(a[z>>0]|0)==45;ia=E?-K:K;ja=E?-t:t}E=F-q|0;c[D>>2]=E;if(ja+ia!=ja){q=E+ha|0;c[D>>2]=q;if(q>>>0>999999999){q=D;E=ea;while(1){F=q+-4|0;c[q>>2]=0;if(F>>>0<E>>>0){u=E+-4|0;c[u>>2]=0;ka=u}else ka=E;u=(c[F>>2]|0)+1|0;c[F>>2]=u;if(u>>>0>999999999){q=F;E=ka}else{la=F;ma=ka;break}}}else{la=D;ma=ea}E=(B-ma>>2)*9|0;q=c[ma>>2]|0;if(q>>>0<10){na=la;oa=E;pa=ma}else{F=E;E=10;while(1){E=E*10|0;u=F+1|0;if(q>>>0<E>>>0){na=la;oa=u;pa=ma;break}else F=u}}}else{na=D;oa=ga;pa=ea}}else{na=D;oa=ga;pa=ea}F=na+4|0;qa=oa;ra=fa>>>0>F>>>0?F:fa;sa=pa}else{qa=ga;ra=fa;sa=ea}F=0-qa|0;b:do if(ra>>>0>sa>>>0){E=ra;while(1){q=E+-4|0;if(c[q>>2]|0){ta=E;ua=1;break b}if(q>>>0>sa>>>0)E=q;else{ta=q;ua=0;break}}}else{ta=ra;ua=0}while(0);do if(L){D=H+((M^1)&1)|0;if((D|0)>(qa|0)&(qa|0)>-5){va=i+-1|0;wa=D+-1-qa|0}else{va=i+-2|0;wa=D+-1|0}if(!(h&8)){if(ua?(D=c[ta+-4>>2]|0,(D|0)!=0):0)if(!((D>>>0)%10|0)){E=0;V=10;while(1){V=V*10|0;U=E+1|0;if((D>>>0)%(V>>>0)|0|0){xa=U;break}else E=U}}else xa=0;else xa=9;E=((ta-B>>2)*9|0)+-9|0;if((va|32|0)==102){V=E-xa|0;D=(V|0)>0?V:0;ya=va;za=(wa|0)<(D|0)?wa:D;break}else{D=E+qa-xa|0;E=(D|0)>0?D:0;ya=va;za=(wa|0)<(E|0)?wa:E;break}}else{ya=va;za=wa}}else{ya=i;za=H}while(0);H=(za|0)!=0;B=H?1:h>>>3&1;M=(ya|32|0)==102;if(M){Aa=0;Ba=(qa|0)>0?qa:0}else{L=(qa|0)<0?F:qa;E=Yc(L,((L|0)<0)<<31>>31,p)|0;L=p;if((L-E|0)<2){D=E;while(1){V=D+-1|0;a[V>>0]=48;if((L-V|0)<2)D=V;else{Ca=V;break}}}else Ca=E;a[Ca+-1>>0]=(qa>>31&2)+43;D=Ca+-2|0;a[D>>0]=ya;Aa=D;Ba=L-D|0}D=y+1+za+B+Ba|0;_c(b,32,f,D,h);Tc(b,z,y);_c(b,48,f,D,h^65536);if(M){F=sa>>>0>J>>>0?J:sa;V=m+9|0;U=V;q=m+8|0;u=F;do{T=Yc(c[u>>2]|0,0,V)|0;if((u|0)==(F|0))if((T|0)==(V|0)){a[q>>0]=48;Fa=q}else Fa=T;else if(T>>>0>m>>>0){Xe(m|0,48,T-n|0)|0;aa=T;while(1){W=aa+-1|0;if(W>>>0>m>>>0)aa=W;else{Fa=W;break}}}else Fa=T;Tc(b,Fa,U-Fa|0);u=u+4|0}while(u>>>0<=J>>>0);if(!((h&8|0)==0&(H^1)))Tc(b,6834,1);if(u>>>0<ta>>>0&(za|0)>0){J=za;U=u;while(1){q=Yc(c[U>>2]|0,0,V)|0;if(q>>>0>m>>>0){Xe(m|0,48,q-n|0)|0;F=q;while(1){M=F+-1|0;if(M>>>0>m>>>0)F=M;else{Ga=M;break}}}else Ga=q;Tc(b,Ga,(J|0)<9?J:9);U=U+4|0;F=J+-9|0;if(!(U>>>0<ta>>>0&(J|0)>9)){Ha=F;break}else J=F}}else Ha=za;_c(b,48,Ha+9|0,9,0)}else{J=ua?ta:sa+4|0;if(sa>>>0<J>>>0&(za|0)>-1){U=m+9|0;V=(h&8|0)==0;u=U;H=0-n|0;F=m+8|0;T=za;M=sa;while(1){B=Yc(c[M>>2]|0,0,U)|0;if((B|0)==(U|0)){a[F>>0]=48;Ia=F}else Ia=B;do if((M|0)==(sa|0)){B=Ia+1|0;Tc(b,Ia,1);if(V&(T|0)<1){Ja=B;break}Tc(b,6834,1);Ja=B}else{if(Ia>>>0<=m>>>0){Ja=Ia;break}Xe(m|0,48,Ia+H|0)|0;B=Ia;while(1){L=B+-1|0;if(L>>>0>m>>>0)B=L;else{Ja=L;break}}}while(0);q=u-Ja|0;Tc(b,Ja,(T|0)>(q|0)?q:T);B=T-q|0;M=M+4|0;if(!(M>>>0<J>>>0&(B|0)>-1)){Ka=B;break}else T=B}}else Ka=za;_c(b,48,Ka+18|0,18,0);Tc(b,Aa,p-Aa|0)}_c(b,32,f,D,h^8192);C=D}while(0);Da=j;return ((C|0)<(f|0)?f:C)|0}function bd(a){a=+a;var b=0;g[h>>3]=a;b=c[h>>2]|0;v(c[h+4>>2]|0);return b|0}function cd(a,b){a=+a;b=b|0;return +(+dd(a,b))}function dd(a,b){a=+a;b=b|0;var d=0,e=0,f=0,i=0.0,j=0.0,k=0,l=0.0;g[h>>3]=a;d=c[h>>2]|0;e=c[h+4>>2]|0;f=Te(d|0,e|0,52)|0;w()|0;switch(f&2047){case 0:{if(a!=0.0){i=+dd(a*18446744073709551616.0,b);j=i;k=(c[b>>2]|0)+-64|0}else{j=a;k=0}c[b>>2]=k;l=j;break}case 2047:{l=a;break}default:{c[b>>2]=(f&2047)+-1022;c[h>>2]=d;c[h+4>>2]=e&-2146435073|1071644672;l=+g[h>>3]}}return +l}function ed(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;do if(b){if(d>>>0<128){a[b>>0]=d;f=1;break}if(!(c[c[(fd()|0)+188>>2]>>2]|0))if((d&-128|0)==57216){a[b>>0]=d;f=1;break}else{c[(vc()|0)>>2]=84;f=-1;break}if(d>>>0<2048){a[b>>0]=d>>>6|192;a[b+1>>0]=d&63|128;f=2;break}if(d>>>0<55296|(d&-8192|0)==57344){a[b>>0]=d>>>12|224;a[b+1>>0]=d>>>6&63|128;a[b+2>>0]=d&63|128;f=3;break}if((d+-65536|0)>>>0<1048576){a[b>>0]=d>>>18|240;a[b+1>>0]=d>>>12&63|128;a[b+2>>0]=d>>>6&63|128;a[b+3>>0]=d&63|128;f=4;break}else{c[(vc()|0)>>2]=84;f=-1;break}}else f=1;while(0);return f|0}function fd(){return zc()|0}function gd(){return zc()|0}function hd(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=0;while(1){if((d[496+f>>0]|0)==(b|0)){g=4;break}h=f+1|0;if((h|0)==87){i=87;g=5;break}else f=h}if((g|0)==4)if(!f)j=592;else{i=f;g=5}if((g|0)==5){g=592;f=i;while(1){i=g;do{b=i;i=i+1|0}while((a[b>>0]|0)!=0);f=f+-1|0;if(!f){j=i;break}else g=i}}return id(j,c[e+20>>2]|0)|0}function id(a,b){a=a|0;b=b|0;return Jc(a,b)|0}function jd(b,c,d){b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;a:do if(!d)e=0;else{f=b;g=d;h=c;while(1){i=a[f>>0]|0;j=a[h>>0]|0;if(i<<24>>24!=j<<24>>24)break;g=g+-1|0;if(!g){e=0;break a}else{f=f+1|0;h=h+1|0}}e=(i&255)-(j&255)|0}while(0);return e|0}function kd(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Da;Da=Da+48|0;if((Da|0)>=(Ea|0))x(48);f=e+32|0;g=e+16|0;h=e;if(!(b&4194368))i=0;else{c[h>>2]=d;d=(c[h>>2]|0)+(4-1)&~(4-1);j=c[d>>2]|0;c[h>>2]=d+4;i=j}c[g>>2]=a;c[g+4>>2]=b|32768;c[g+8>>2]=i;i=ia(5,g|0)|0;if(!((b&524288|0)==0|(i|0)<0)){c[f>>2]=i;c[f+4>>2]=2;c[f+8>>2]=1;ga(221,f|0)|0}f=uc(i)|0;Da=e;return f|0}function ld(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0;e=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);f=e;c[f>>2]=a;c[f+4>>2]=b;c[f+8>>2]=d;d=uc(ha(3,f|0)|0)|0;Da=e;return d|0}function md(a,b){a=a|0;b=b|0;var d=0,e=0;d=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);e=d;c[e>>2]=b;b=Rc(c[870]|0,a,e)|0;Da=d;return b|0}function nd(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0;if((c[d+76>>2]|0)>=0?(Fc(d)|0)!=0:0){e=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=e;i=f}else i=Gc(d,b)|0;Ec(d);j=i}else k=3;do if((k|0)==3){i=b&255;f=b&255;if((f|0)!=(a[d+75>>0]|0)?(e=d+20|0,h=c[e>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[e>>2]=h+1;a[h>>0]=i;j=f;break}j=Gc(d,b)|0}while(0);return j|0}function od(b){b=b|0;var d=0,e=0,f=0,g=0,h=0;d=c[870]|0;if((c[d+76>>2]|0)>-1)e=Fc(d)|0;else e=0;do if((Cc(b,d)|0)<0)f=-1;else{if((a[d+75>>0]|0)!=10?(g=d+20|0,h=c[g>>2]|0,h>>>0<(c[d+16>>2]|0)>>>0):0){c[g>>2]=h+1;a[h>>0]=10;f=0;break}f=(Gc(d,10)|0)>>31}while(0);if(e|0)Ec(d);return f|0}function pd(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0;b=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);d=b;do if(a>>>0<245){e=a>>>0<11?16:a+11&-8;f=e>>>3;g=c[2840]|0;h=g>>>f;if(h&3|0){i=(h&1^1)+f|0;j=11400+(i<<1<<2)|0;k=j+8|0;l=c[k>>2]|0;m=l+8|0;n=c[m>>2]|0;if((n|0)==(j|0))c[2840]=g&~(1<<i);else{c[n+12>>2]=j;c[k>>2]=n}n=i<<3;c[l+4>>2]=n|3;i=l+n+4|0;c[i>>2]=c[i>>2]|1;o=m;Da=b;return o|0}m=c[2842]|0;if(e>>>0>m>>>0){if(h|0){i=2<<f;n=h<<f&(i|0-i);i=(n&0-n)+-1|0;n=i>>>12&16;f=i>>>n;i=f>>>5&8;h=f>>>i;f=h>>>2&4;l=h>>>f;h=l>>>1&2;k=l>>>h;l=k>>>1&1;j=(i|n|f|h|l)+(k>>>l)|0;l=11400+(j<<1<<2)|0;k=l+8|0;h=c[k>>2]|0;f=h+8|0;n=c[f>>2]|0;if((n|0)==(l|0)){i=g&~(1<<j);c[2840]=i;p=i}else{c[n+12>>2]=l;c[k>>2]=n;p=g}n=j<<3;j=n-e|0;c[h+4>>2]=e|3;k=h+e|0;c[k+4>>2]=j|1;c[h+n>>2]=j;if(m|0){n=c[2845]|0;h=m>>>3;l=11400+(h<<1<<2)|0;i=1<<h;if(!(p&i)){c[2840]=p|i;q=l;r=l+8|0}else{i=l+8|0;q=c[i>>2]|0;r=i}c[r>>2]=n;c[q+12>>2]=n;c[n+8>>2]=q;c[n+12>>2]=l}c[2842]=j;c[2845]=k;o=f;Da=b;return o|0}f=c[2841]|0;if(f){k=(f&0-f)+-1|0;j=k>>>12&16;l=k>>>j;k=l>>>5&8;n=l>>>k;l=n>>>2&4;i=n>>>l;n=i>>>1&2;h=i>>>n;i=h>>>1&1;s=c[11664+((k|j|l|n|i)+(h>>>i)<<2)>>2]|0;i=s;h=s;n=(c[s+4>>2]&-8)-e|0;while(1){s=c[i+16>>2]|0;if(!s){l=c[i+20>>2]|0;if(!l)break;else t=l}else t=s;s=(c[t+4>>2]&-8)-e|0;l=s>>>0<n>>>0;i=t;h=l?t:h;n=l?s:n}i=h+e|0;if(i>>>0>h>>>0){s=c[h+24>>2]|0;l=c[h+12>>2]|0;do if((l|0)==(h|0)){j=h+20|0;k=c[j>>2]|0;if(!k){u=h+16|0;v=c[u>>2]|0;if(!v){w=0;break}else{y=v;z=u}}else{y=k;z=j}j=y;k=z;while(1){u=j+20|0;v=c[u>>2]|0;if(!v){A=j+16|0;B=c[A>>2]|0;if(!B)break;else{C=B;D=A}}else{C=v;D=u}j=C;k=D}c[k>>2]=0;w=j}else{u=c[h+8>>2]|0;c[u+12>>2]=l;c[l+8>>2]=u;w=l}while(0);do if(s|0){l=c[h+28>>2]|0;u=11664+(l<<2)|0;if((h|0)==(c[u>>2]|0)){c[u>>2]=w;if(!w){c[2841]=f&~(1<<l);break}}else{l=s+16|0;c[((c[l>>2]|0)==(h|0)?l:s+20|0)>>2]=w;if(!w)break}c[w+24>>2]=s;l=c[h+16>>2]|0;if(l|0){c[w+16>>2]=l;c[l+24>>2]=w}l=c[h+20>>2]|0;if(l|0){c[w+20>>2]=l;c[l+24>>2]=w}}while(0);if(n>>>0<16){s=n+e|0;c[h+4>>2]=s|3;f=h+s+4|0;c[f>>2]=c[f>>2]|1}else{c[h+4>>2]=e|3;c[i+4>>2]=n|1;c[i+n>>2]=n;if(m|0){f=c[2845]|0;s=m>>>3;l=11400+(s<<1<<2)|0;u=1<<s;if(!(u&g)){c[2840]=u|g;E=l;F=l+8|0}else{u=l+8|0;E=c[u>>2]|0;F=u}c[F>>2]=f;c[E+12>>2]=f;c[f+8>>2]=E;c[f+12>>2]=l}c[2842]=n;c[2845]=i}o=h+8|0;Da=b;return o|0}else G=e}else G=e}else G=e}else if(a>>>0<=4294967231){l=a+11|0;f=l&-8;u=c[2841]|0;if(u){s=0-f|0;v=l>>>8;if(v)if(f>>>0>16777215)H=31;else{l=(v+1048320|0)>>>16&8;A=v<<l;v=(A+520192|0)>>>16&4;B=A<<v;A=(B+245760|0)>>>16&2;I=14-(v|l|A)+(B<<A>>>15)|0;H=f>>>(I+7|0)&1|I<<1}else H=0;I=c[11664+(H<<2)>>2]|0;a:do if(!I){J=0;K=0;L=s;M=61}else{A=0;B=s;l=I;v=f<<((H|0)==31?0:25-(H>>>1)|0);N=0;while(1){O=(c[l+4>>2]&-8)-f|0;if(O>>>0<B>>>0)if(!O){P=l;Q=0;R=l;M=65;break a}else{S=l;T=O}else{S=A;T=B}O=c[l+20>>2]|0;l=c[l+16+(v>>>31<<2)>>2]|0;U=(O|0)==0|(O|0)==(l|0)?N:O;if(!l){J=U;K=S;L=T;M=61;break}else{A=S;B=T;v=v<<1;N=U}}}while(0);if((M|0)==61){if((J|0)==0&(K|0)==0){I=2<<H;s=(I|0-I)&u;if(!s){G=f;break}I=(s&0-s)+-1|0;s=I>>>12&16;e=I>>>s;I=e>>>5&8;h=e>>>I;e=h>>>2&4;i=h>>>e;h=i>>>1&2;n=i>>>h;i=n>>>1&1;V=0;W=c[11664+((I|s|e|h|i)+(n>>>i)<<2)>>2]|0}else{V=K;W=J}if(!W){X=V;Y=L}else{P=V;Q=L;R=W;M=65}}if((M|0)==65){i=P;n=Q;h=R;while(1){e=(c[h+4>>2]&-8)-f|0;s=e>>>0<n>>>0;I=s?e:n;e=s?h:i;s=c[h+16>>2]|0;if(!s)Z=c[h+20>>2]|0;else Z=s;if(!Z){X=e;Y=I;break}else{i=e;n=I;h=Z}}}if(((X|0)!=0?Y>>>0<((c[2842]|0)-f|0)>>>0:0)?(h=X+f|0,h>>>0>X>>>0):0){n=c[X+24>>2]|0;i=c[X+12>>2]|0;do if((i|0)==(X|0)){I=X+20|0;e=c[I>>2]|0;if(!e){s=X+16|0;g=c[s>>2]|0;if(!g){_=0;break}else{$=g;aa=s}}else{$=e;aa=I}I=$;e=aa;while(1){s=I+20|0;g=c[s>>2]|0;if(!g){m=I+16|0;N=c[m>>2]|0;if(!N)break;else{ba=N;ca=m}}else{ba=g;ca=s}I=ba;e=ca}c[e>>2]=0;_=I}else{s=c[X+8>>2]|0;c[s+12>>2]=i;c[i+8>>2]=s;_=i}while(0);do if(n){i=c[X+28>>2]|0;s=11664+(i<<2)|0;if((X|0)==(c[s>>2]|0)){c[s>>2]=_;if(!_){s=u&~(1<<i);c[2841]=s;da=s;break}}else{s=n+16|0;c[((c[s>>2]|0)==(X|0)?s:n+20|0)>>2]=_;if(!_){da=u;break}}c[_+24>>2]=n;s=c[X+16>>2]|0;if(s|0){c[_+16>>2]=s;c[s+24>>2]=_}s=c[X+20>>2]|0;if(s){c[_+20>>2]=s;c[s+24>>2]=_;da=u}else da=u}else da=u;while(0);b:do if(Y>>>0<16){u=Y+f|0;c[X+4>>2]=u|3;n=X+u+4|0;c[n>>2]=c[n>>2]|1}else{c[X+4>>2]=f|3;c[h+4>>2]=Y|1;c[h+Y>>2]=Y;n=Y>>>3;if(Y>>>0<256){u=11400+(n<<1<<2)|0;s=c[2840]|0;i=1<<n;if(!(s&i)){c[2840]=s|i;ea=u;fa=u+8|0}else{i=u+8|0;ea=c[i>>2]|0;fa=i}c[fa>>2]=h;c[ea+12>>2]=h;c[h+8>>2]=ea;c[h+12>>2]=u;break}u=Y>>>8;if(u)if(Y>>>0>16777215)ga=31;else{i=(u+1048320|0)>>>16&8;s=u<<i;u=(s+520192|0)>>>16&4;n=s<<u;s=(n+245760|0)>>>16&2;g=14-(u|i|s)+(n<<s>>>15)|0;ga=Y>>>(g+7|0)&1|g<<1}else ga=0;g=11664+(ga<<2)|0;c[h+28>>2]=ga;s=h+16|0;c[s+4>>2]=0;c[s>>2]=0;s=1<<ga;if(!(da&s)){c[2841]=da|s;c[g>>2]=h;c[h+24>>2]=g;c[h+12>>2]=h;c[h+8>>2]=h;break}s=c[g>>2]|0;c:do if((c[s+4>>2]&-8|0)==(Y|0))ha=s;else{g=Y<<((ga|0)==31?0:25-(ga>>>1)|0);n=s;while(1){ia=n+16+(g>>>31<<2)|0;i=c[ia>>2]|0;if(!i)break;if((c[i+4>>2]&-8|0)==(Y|0)){ha=i;break c}else{g=g<<1;n=i}}c[ia>>2]=h;c[h+24>>2]=n;c[h+12>>2]=h;c[h+8>>2]=h;break b}while(0);s=ha+8|0;I=c[s>>2]|0;c[I+12>>2]=h;c[s>>2]=h;c[h+8>>2]=I;c[h+12>>2]=ha;c[h+24>>2]=0}while(0);o=X+8|0;Da=b;return o|0}else G=f}else G=f}else G=-1;while(0);X=c[2842]|0;if(X>>>0>=G>>>0){ha=X-G|0;ia=c[2845]|0;if(ha>>>0>15){Y=ia+G|0;c[2845]=Y;c[2842]=ha;c[Y+4>>2]=ha|1;c[ia+X>>2]=ha;c[ia+4>>2]=G|3}else{c[2842]=0;c[2845]=0;c[ia+4>>2]=X|3;ha=ia+X+4|0;c[ha>>2]=c[ha>>2]|1}o=ia+8|0;Da=b;return o|0}ia=c[2843]|0;if(ia>>>0>G>>>0){ha=ia-G|0;c[2843]=ha;X=c[2846]|0;Y=X+G|0;c[2846]=Y;c[Y+4>>2]=ha|1;c[X+4>>2]=G|3;o=X+8|0;Da=b;return o|0}if(!(c[2958]|0)){c[2960]=4096;c[2959]=4096;c[2961]=-1;c[2962]=-1;c[2963]=0;c[2951]=0;c[2958]=d&-16^1431655768;ja=4096}else ja=c[2960]|0;d=G+48|0;X=G+47|0;ha=ja+X|0;Y=0-ja|0;ja=ha&Y;if(ja>>>0<=G>>>0){o=0;Da=b;return o|0}ga=c[2950]|0;if(ga|0?(da=c[2948]|0,ea=da+ja|0,ea>>>0<=da>>>0|ea>>>0>ga>>>0):0){o=0;Da=b;return o|0}d:do if(!(c[2951]&4)){ga=c[2846]|0;e:do if(ga){ea=11808;while(1){da=c[ea>>2]|0;if(da>>>0<=ga>>>0?(da+(c[ea+4>>2]|0)|0)>>>0>ga>>>0:0)break;da=c[ea+8>>2]|0;if(!da){M=128;break e}else ea=da}da=ha-ia&Y;if(da>>>0<2147483647){fa=Ye(da|0)|0;if((fa|0)==((c[ea>>2]|0)+(c[ea+4>>2]|0)|0))if((fa|0)==(-1|0))ka=da;else{la=da;ma=fa;M=145;break d}else{na=fa;oa=da;M=136}}else ka=0}else M=128;while(0);do if((M|0)==128){ga=Ye(0)|0;if((ga|0)!=(-1|0)?(f=ga,da=c[2959]|0,fa=da+-1|0,_=((fa&f|0)==0?0:(fa+f&0-da)-f|0)+ja|0,f=c[2948]|0,da=_+f|0,_>>>0>G>>>0&_>>>0<2147483647):0){fa=c[2950]|0;if(fa|0?da>>>0<=f>>>0|da>>>0>fa>>>0:0){ka=0;break}fa=Ye(_|0)|0;if((fa|0)==(ga|0)){la=_;ma=ga;M=145;break d}else{na=fa;oa=_;M=136}}else ka=0}while(0);do if((M|0)==136){_=0-oa|0;if(!(d>>>0>oa>>>0&(oa>>>0<2147483647&(na|0)!=(-1|0))))if((na|0)==(-1|0)){ka=0;break}else{la=oa;ma=na;M=145;break d}fa=c[2960]|0;ga=X-oa+fa&0-fa;if(ga>>>0>=2147483647){la=oa;ma=na;M=145;break d}if((Ye(ga|0)|0)==(-1|0)){Ye(_|0)|0;ka=0;break}else{la=ga+oa|0;ma=na;M=145;break d}}while(0);c[2951]=c[2951]|4;pa=ka;M=143}else{pa=0;M=143}while(0);if(((M|0)==143?ja>>>0<2147483647:0)?(ka=Ye(ja|0)|0,ja=Ye(0)|0,na=ja-ka|0,oa=na>>>0>(G+40|0)>>>0,!((ka|0)==(-1|0)|oa^1|ka>>>0<ja>>>0&((ka|0)!=(-1|0)&(ja|0)!=(-1|0))^1)):0){la=oa?na:pa;ma=ka;M=145}if((M|0)==145){ka=(c[2948]|0)+la|0;c[2948]=ka;if(ka>>>0>(c[2949]|0)>>>0)c[2949]=ka;ka=c[2846]|0;f:do if(ka){pa=11808;while(1){qa=c[pa>>2]|0;ra=c[pa+4>>2]|0;if((ma|0)==(qa+ra|0)){M=154;break}na=c[pa+8>>2]|0;if(!na)break;else pa=na}if(((M|0)==154?(na=pa+4|0,(c[pa+12>>2]&8|0)==0):0)?ma>>>0>ka>>>0&qa>>>0<=ka>>>0:0){c[na>>2]=ra+la;na=(c[2843]|0)+la|0;oa=ka+8|0;ja=(oa&7|0)==0?0:0-oa&7;oa=ka+ja|0;X=na-ja|0;c[2846]=oa;c[2843]=X;c[oa+4>>2]=X|1;c[ka+na+4>>2]=40;c[2847]=c[2962];break}if(ma>>>0<(c[2844]|0)>>>0)c[2844]=ma;na=ma+la|0;X=11808;while(1){if((c[X>>2]|0)==(na|0)){M=162;break}oa=c[X+8>>2]|0;if(!oa)break;else X=oa}if((M|0)==162?(c[X+12>>2]&8|0)==0:0){c[X>>2]=ma;pa=X+4|0;c[pa>>2]=(c[pa>>2]|0)+la;pa=ma+8|0;oa=ma+((pa&7|0)==0?0:0-pa&7)|0;pa=na+8|0;ja=na+((pa&7|0)==0?0:0-pa&7)|0;pa=oa+G|0;d=ja-oa-G|0;c[oa+4>>2]=G|3;g:do if((ka|0)==(ja|0)){Y=(c[2843]|0)+d|0;c[2843]=Y;c[2846]=pa;c[pa+4>>2]=Y|1}else{if((c[2845]|0)==(ja|0)){Y=(c[2842]|0)+d|0;c[2842]=Y;c[2845]=pa;c[pa+4>>2]=Y|1;c[pa+Y>>2]=Y;break}Y=c[ja+4>>2]|0;if((Y&3|0)==1){ia=Y&-8;ha=Y>>>3;h:do if(Y>>>0<256){ga=c[ja+8>>2]|0;_=c[ja+12>>2]|0;if((_|0)==(ga|0)){c[2840]=c[2840]&~(1<<ha);break}else{c[ga+12>>2]=_;c[_+8>>2]=ga;break}}else{ga=c[ja+24>>2]|0;_=c[ja+12>>2]|0;do if((_|0)==(ja|0)){fa=ja+16|0;da=fa+4|0;f=c[da>>2]|0;if(!f){ca=c[fa>>2]|0;if(!ca){sa=0;break}else{ta=ca;ua=fa}}else{ta=f;ua=da}da=ta;f=ua;while(1){fa=da+20|0;ca=c[fa>>2]|0;if(!ca){ba=da+16|0;aa=c[ba>>2]|0;if(!aa)break;else{va=aa;wa=ba}}else{va=ca;wa=fa}da=va;f=wa}c[f>>2]=0;sa=da}else{fa=c[ja+8>>2]|0;c[fa+12>>2]=_;c[_+8>>2]=fa;sa=_}while(0);if(!ga)break;_=c[ja+28>>2]|0;n=11664+(_<<2)|0;do if((c[n>>2]|0)!=(ja|0)){fa=ga+16|0;c[((c[fa>>2]|0)==(ja|0)?fa:ga+20|0)>>2]=sa;if(!sa)break h}else{c[n>>2]=sa;if(sa|0)break;c[2841]=c[2841]&~(1<<_);break h}while(0);c[sa+24>>2]=ga;_=ja+16|0;n=c[_>>2]|0;if(n|0){c[sa+16>>2]=n;c[n+24>>2]=sa}n=c[_+4>>2]|0;if(!n)break;c[sa+20>>2]=n;c[n+24>>2]=sa}while(0);xa=ja+ia|0;ya=ia+d|0}else{xa=ja;ya=d}ha=xa+4|0;c[ha>>2]=c[ha>>2]&-2;c[pa+4>>2]=ya|1;c[pa+ya>>2]=ya;ha=ya>>>3;if(ya>>>0<256){Y=11400+(ha<<1<<2)|0;ea=c[2840]|0;n=1<<ha;if(!(ea&n)){c[2840]=ea|n;za=Y;Aa=Y+8|0}else{n=Y+8|0;za=c[n>>2]|0;Aa=n}c[Aa>>2]=pa;c[za+12>>2]=pa;c[pa+8>>2]=za;c[pa+12>>2]=Y;break}Y=ya>>>8;do if(!Y)Ba=0;else{if(ya>>>0>16777215){Ba=31;break}n=(Y+1048320|0)>>>16&8;ea=Y<<n;ha=(ea+520192|0)>>>16&4;_=ea<<ha;ea=(_+245760|0)>>>16&2;fa=14-(ha|n|ea)+(_<<ea>>>15)|0;Ba=ya>>>(fa+7|0)&1|fa<<1}while(0);Y=11664+(Ba<<2)|0;c[pa+28>>2]=Ba;ia=pa+16|0;c[ia+4>>2]=0;c[ia>>2]=0;ia=c[2841]|0;fa=1<<Ba;if(!(ia&fa)){c[2841]=ia|fa;c[Y>>2]=pa;c[pa+24>>2]=Y;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break}fa=c[Y>>2]|0;i:do if((c[fa+4>>2]&-8|0)==(ya|0))Ca=fa;else{Y=ya<<((Ba|0)==31?0:25-(Ba>>>1)|0);ia=fa;while(1){Fa=ia+16+(Y>>>31<<2)|0;ea=c[Fa>>2]|0;if(!ea)break;if((c[ea+4>>2]&-8|0)==(ya|0)){Ca=ea;break i}else{Y=Y<<1;ia=ea}}c[Fa>>2]=pa;c[pa+24>>2]=ia;c[pa+12>>2]=pa;c[pa+8>>2]=pa;break g}while(0);fa=Ca+8|0;Y=c[fa>>2]|0;c[Y+12>>2]=pa;c[fa>>2]=pa;c[pa+8>>2]=Y;c[pa+12>>2]=Ca;c[pa+24>>2]=0}while(0);o=oa+8|0;Da=b;return o|0}pa=11808;while(1){d=c[pa>>2]|0;if(d>>>0<=ka>>>0?(Ga=d+(c[pa+4>>2]|0)|0,Ga>>>0>ka>>>0):0)break;pa=c[pa+8>>2]|0}pa=Ga+-47|0;oa=pa+8|0;d=pa+((oa&7|0)==0?0:0-oa&7)|0;oa=ka+16|0;pa=d>>>0<oa>>>0?ka:d;d=pa+8|0;ja=la+-40|0;na=ma+8|0;X=(na&7|0)==0?0:0-na&7;na=ma+X|0;Y=ja-X|0;c[2846]=na;c[2843]=Y;c[na+4>>2]=Y|1;c[ma+ja+4>>2]=40;c[2847]=c[2962];ja=pa+4|0;c[ja>>2]=27;c[d>>2]=c[2952];c[d+4>>2]=c[2953];c[d+8>>2]=c[2954];c[d+12>>2]=c[2955];c[2952]=ma;c[2953]=la;c[2955]=0;c[2954]=d;d=pa+24|0;do{Y=d;d=d+4|0;c[d>>2]=7}while((Y+8|0)>>>0<Ga>>>0);if((pa|0)!=(ka|0)){d=pa-ka|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=d|1;c[pa>>2]=d;Y=d>>>3;if(d>>>0<256){na=11400+(Y<<1<<2)|0;X=c[2840]|0;fa=1<<Y;if(!(X&fa)){c[2840]=X|fa;Ha=na;Ia=na+8|0}else{fa=na+8|0;Ha=c[fa>>2]|0;Ia=fa}c[Ia>>2]=ka;c[Ha+12>>2]=ka;c[ka+8>>2]=Ha;c[ka+12>>2]=na;break}na=d>>>8;if(na)if(d>>>0>16777215)Ja=31;else{fa=(na+1048320|0)>>>16&8;X=na<<fa;na=(X+520192|0)>>>16&4;Y=X<<na;X=(Y+245760|0)>>>16&2;ga=14-(na|fa|X)+(Y<<X>>>15)|0;Ja=d>>>(ga+7|0)&1|ga<<1}else Ja=0;ga=11664+(Ja<<2)|0;c[ka+28>>2]=Ja;c[ka+20>>2]=0;c[oa>>2]=0;X=c[2841]|0;Y=1<<Ja;if(!(X&Y)){c[2841]=X|Y;c[ga>>2]=ka;c[ka+24>>2]=ga;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}Y=c[ga>>2]|0;j:do if((c[Y+4>>2]&-8|0)==(d|0))Ka=Y;else{ga=d<<((Ja|0)==31?0:25-(Ja>>>1)|0);X=Y;while(1){La=X+16+(ga>>>31<<2)|0;fa=c[La>>2]|0;if(!fa)break;if((c[fa+4>>2]&-8|0)==(d|0)){Ka=fa;break j}else{ga=ga<<1;X=fa}}c[La>>2]=ka;c[ka+24>>2]=X;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break f}while(0);d=Ka+8|0;Y=c[d>>2]|0;c[Y+12>>2]=ka;c[d>>2]=ka;c[ka+8>>2]=Y;c[ka+12>>2]=Ka;c[ka+24>>2]=0}}else{Y=c[2844]|0;if((Y|0)==0|ma>>>0<Y>>>0)c[2844]=ma;c[2952]=ma;c[2953]=la;c[2955]=0;c[2849]=c[2958];c[2848]=-1;c[2853]=11400;c[2852]=11400;c[2855]=11408;c[2854]=11408;c[2857]=11416;c[2856]=11416;c[2859]=11424;c[2858]=11424;c[2861]=11432;c[2860]=11432;c[2863]=11440;c[2862]=11440;c[2865]=11448;c[2864]=11448;c[2867]=11456;c[2866]=11456;c[2869]=11464;c[2868]=11464;c[2871]=11472;c[2870]=11472;c[2873]=11480;c[2872]=11480;c[2875]=11488;c[2874]=11488;c[2877]=11496;c[2876]=11496;c[2879]=11504;c[2878]=11504;c[2881]=11512;c[2880]=11512;c[2883]=11520;c[2882]=11520;c[2885]=11528;c[2884]=11528;c[2887]=11536;c[2886]=11536;c[2889]=11544;c[2888]=11544;c[2891]=11552;c[2890]=11552;c[2893]=11560;c[2892]=11560;c[2895]=11568;c[2894]=11568;c[2897]=11576;c[2896]=11576;c[2899]=11584;c[2898]=11584;c[2901]=11592;c[2900]=11592;c[2903]=11600;c[2902]=11600;c[2905]=11608;c[2904]=11608;c[2907]=11616;c[2906]=11616;c[2909]=11624;c[2908]=11624;c[2911]=11632;c[2910]=11632;c[2913]=11640;c[2912]=11640;c[2915]=11648;c[2914]=11648;Y=la+-40|0;d=ma+8|0;oa=(d&7|0)==0?0:0-d&7;d=ma+oa|0;pa=Y-oa|0;c[2846]=d;c[2843]=pa;c[d+4>>2]=pa|1;c[ma+Y+4>>2]=40;c[2847]=c[2962]}while(0);ma=c[2843]|0;if(ma>>>0>G>>>0){la=ma-G|0;c[2843]=la;ma=c[2846]|0;ka=ma+G|0;c[2846]=ka;c[ka+4>>2]=la|1;c[ma+4>>2]=G|3;o=ma+8|0;Da=b;return o|0}}c[(vc()|0)>>2]=12;o=0;Da=b;return o|0}
function qd(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0;if(!a)return;b=a+-8|0;d=c[2844]|0;e=c[a+-4>>2]|0;a=e&-8;f=b+a|0;do if(!(e&1)){g=c[b>>2]|0;if(!(e&3))return;h=b+(0-g)|0;i=g+a|0;if(h>>>0<d>>>0)return;if((c[2845]|0)==(h|0)){j=f+4|0;k=c[j>>2]|0;if((k&3|0)!=3){l=h;m=i;n=h;break}c[2842]=i;c[j>>2]=k&-2;c[h+4>>2]=i|1;c[h+i>>2]=i;return}k=g>>>3;if(g>>>0<256){g=c[h+8>>2]|0;j=c[h+12>>2]|0;if((j|0)==(g|0)){c[2840]=c[2840]&~(1<<k);l=h;m=i;n=h;break}else{c[g+12>>2]=j;c[j+8>>2]=g;l=h;m=i;n=h;break}}g=c[h+24>>2]|0;j=c[h+12>>2]|0;do if((j|0)==(h|0)){k=h+16|0;o=k+4|0;p=c[o>>2]|0;if(!p){q=c[k>>2]|0;if(!q){r=0;break}else{s=q;t=k}}else{s=p;t=o}o=s;p=t;while(1){k=o+20|0;q=c[k>>2]|0;if(!q){u=o+16|0;v=c[u>>2]|0;if(!v)break;else{w=v;x=u}}else{w=q;x=k}o=w;p=x}c[p>>2]=0;r=o}else{k=c[h+8>>2]|0;c[k+12>>2]=j;c[j+8>>2]=k;r=j}while(0);if(g){j=c[h+28>>2]|0;k=11664+(j<<2)|0;if((c[k>>2]|0)==(h|0)){c[k>>2]=r;if(!r){c[2841]=c[2841]&~(1<<j);l=h;m=i;n=h;break}}else{j=g+16|0;c[((c[j>>2]|0)==(h|0)?j:g+20|0)>>2]=r;if(!r){l=h;m=i;n=h;break}}c[r+24>>2]=g;j=h+16|0;k=c[j>>2]|0;if(k|0){c[r+16>>2]=k;c[k+24>>2]=r}k=c[j+4>>2]|0;if(k){c[r+20>>2]=k;c[k+24>>2]=r;l=h;m=i;n=h}else{l=h;m=i;n=h}}else{l=h;m=i;n=h}}else{l=b;m=a;n=b}while(0);if(n>>>0>=f>>>0)return;b=f+4|0;a=c[b>>2]|0;if(!(a&1))return;if(!(a&2)){if((c[2846]|0)==(f|0)){r=(c[2843]|0)+m|0;c[2843]=r;c[2846]=l;c[l+4>>2]=r|1;if((l|0)!=(c[2845]|0))return;c[2845]=0;c[2842]=0;return}if((c[2845]|0)==(f|0)){r=(c[2842]|0)+m|0;c[2842]=r;c[2845]=n;c[l+4>>2]=r|1;c[n+r>>2]=r;return}r=(a&-8)+m|0;x=a>>>3;do if(a>>>0<256){w=c[f+8>>2]|0;t=c[f+12>>2]|0;if((t|0)==(w|0)){c[2840]=c[2840]&~(1<<x);break}else{c[w+12>>2]=t;c[t+8>>2]=w;break}}else{w=c[f+24>>2]|0;t=c[f+12>>2]|0;do if((t|0)==(f|0)){s=f+16|0;d=s+4|0;e=c[d>>2]|0;if(!e){k=c[s>>2]|0;if(!k){y=0;break}else{z=k;A=s}}else{z=e;A=d}d=z;e=A;while(1){s=d+20|0;k=c[s>>2]|0;if(!k){j=d+16|0;q=c[j>>2]|0;if(!q)break;else{B=q;C=j}}else{B=k;C=s}d=B;e=C}c[e>>2]=0;y=d}else{o=c[f+8>>2]|0;c[o+12>>2]=t;c[t+8>>2]=o;y=t}while(0);if(w|0){t=c[f+28>>2]|0;h=11664+(t<<2)|0;if((c[h>>2]|0)==(f|0)){c[h>>2]=y;if(!y){c[2841]=c[2841]&~(1<<t);break}}else{t=w+16|0;c[((c[t>>2]|0)==(f|0)?t:w+20|0)>>2]=y;if(!y)break}c[y+24>>2]=w;t=f+16|0;h=c[t>>2]|0;if(h|0){c[y+16>>2]=h;c[h+24>>2]=y}h=c[t+4>>2]|0;if(h|0){c[y+20>>2]=h;c[h+24>>2]=y}}}while(0);c[l+4>>2]=r|1;c[n+r>>2]=r;if((l|0)==(c[2845]|0)){c[2842]=r;return}else D=r}else{c[b>>2]=a&-2;c[l+4>>2]=m|1;c[n+m>>2]=m;D=m}m=D>>>3;if(D>>>0<256){n=11400+(m<<1<<2)|0;a=c[2840]|0;b=1<<m;if(!(a&b)){c[2840]=a|b;E=n;F=n+8|0}else{b=n+8|0;E=c[b>>2]|0;F=b}c[F>>2]=l;c[E+12>>2]=l;c[l+8>>2]=E;c[l+12>>2]=n;return}n=D>>>8;if(n)if(D>>>0>16777215)G=31;else{E=(n+1048320|0)>>>16&8;F=n<<E;n=(F+520192|0)>>>16&4;b=F<<n;F=(b+245760|0)>>>16&2;a=14-(n|E|F)+(b<<F>>>15)|0;G=D>>>(a+7|0)&1|a<<1}else G=0;a=11664+(G<<2)|0;c[l+28>>2]=G;c[l+20>>2]=0;c[l+16>>2]=0;F=c[2841]|0;b=1<<G;a:do if(!(F&b)){c[2841]=F|b;c[a>>2]=l;c[l+24>>2]=a;c[l+12>>2]=l;c[l+8>>2]=l}else{E=c[a>>2]|0;b:do if((c[E+4>>2]&-8|0)==(D|0))H=E;else{n=D<<((G|0)==31?0:25-(G>>>1)|0);m=E;while(1){I=m+16+(n>>>31<<2)|0;r=c[I>>2]|0;if(!r)break;if((c[r+4>>2]&-8|0)==(D|0)){H=r;break b}else{n=n<<1;m=r}}c[I>>2]=l;c[l+24>>2]=m;c[l+12>>2]=l;c[l+8>>2]=l;break a}while(0);E=H+8|0;w=c[E>>2]|0;c[w+12>>2]=l;c[E>>2]=l;c[l+8>>2]=w;c[l+12>>2]=H;c[l+24>>2]=0}while(0);l=(c[2848]|0)+-1|0;c[2848]=l;if(l|0)return;l=11816;while(1){H=c[l>>2]|0;if(!H)break;else l=H+8|0}c[2848]=-1;return}function rd(){var a=0,b=0,d=0,e=0;a=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);b=a;if(!(oa(0,b|0)|0)){d=c[b>>2]|0;e=(c[b+4>>2]|0)/1e3|0;b=Re(d|0,((d|0)<0)<<31>>31|0,1e6,0)|0;d=Le(b|0,w()|0,e|0,((e|0)<0)<<31>>31|0)|0;v(w()|0);Da=a;return d|0}else Td(c[(vc()|0)>>2]|0,6836);return 0}function sd(a){a=a|0;return}function td(a){a=a|0;sd(a);Bd(a);return}function ud(a){a=a|0;return 6873}function vd(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,t=0,u=0,v=0,w=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;b=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);d=b;e=b+8|0;f=b+4|0;c[e>>2]=a;do if(a>>>0>=212){g=(a>>>0)/210|0;h=g*210|0;c[f>>2]=a-h;i=0;j=g;g=h;h=(wd(2592,2784,f,d)|0)-2592>>2;a:while(1){k=(c[2592+(h<<2)>>2]|0)+g|0;l=5;while(1){if(l>>>0>=47){m=6;break}n=c[2400+(l<<2)>>2]|0;o=(k>>>0)/(n>>>0)|0;if(o>>>0<n>>>0){m=107;break a}if((k|0)==(s(o,n)|0)){p=i;break}else l=l+1|0}b:do if((m|0)==6){m=0;l=211;n=i;c:while(1){o=(k>>>0)/(l>>>0)|0;do if(o>>>0>=l>>>0)if((k|0)!=(s(o,l)|0)){q=l+10|0;r=(k>>>0)/(q>>>0)|0;if(r>>>0>=q>>>0)if((k|0)!=(s(r,q)|0)){r=l+12|0;t=(k>>>0)/(r>>>0)|0;if(t>>>0>=r>>>0)if((k|0)!=(s(t,r)|0)){t=l+16|0;u=(k>>>0)/(t>>>0)|0;if(u>>>0>=t>>>0)if((k|0)!=(s(u,t)|0)){u=l+18|0;v=(k>>>0)/(u>>>0)|0;if(v>>>0>=u>>>0)if((k|0)!=(s(v,u)|0)){v=l+22|0;w=(k>>>0)/(v>>>0)|0;if(w>>>0>=v>>>0)if((k|0)!=(s(w,v)|0)){w=l+28|0;y=(k>>>0)/(w>>>0)|0;if(y>>>0>=w>>>0)if((k|0)==(s(y,w)|0)){z=w;A=9;B=n}else{y=l+30|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+36|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+40|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+42|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+46|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+52|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+58|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+60|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+66|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+70|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+72|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+78|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+82|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+88|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+96|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+100|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+102|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+106|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+108|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+112|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+120|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+126|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+130|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+136|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+138|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+142|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+148|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+150|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+156|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+162|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+166|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+168|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+172|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+178|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+180|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+186|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+190|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+192|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+196|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+198|0;C=(k>>>0)/(y>>>0)|0;if(C>>>0<y>>>0){z=y;A=1;B=k;break}if((k|0)==(s(C,y)|0)){z=y;A=9;B=n;break}y=l+208|0;C=(k>>>0)/(y>>>0)|0;D=C>>>0<y>>>0;E=(k|0)==(s(C,y)|0);z=D|E?y:l+210|0;A=D?1:E?9:0;B=D?k:n}else{z=w;A=1;B=k}}else{z=v;A=9;B=n}else{z=v;A=1;B=k}}else{z=u;A=9;B=n}else{z=u;A=1;B=k}}else{z=t;A=9;B=n}else{z=t;A=1;B=k}}else{z=r;A=9;B=n}else{z=r;A=1;B=k}}else{z=q;A=9;B=n}else{z=q;A=1;B=k}}else{z=l;A=9;B=n}else{z=l;A=1;B=k}while(0);switch(A&15){case 9:{p=B;break b;break}case 0:{l=z;n=B;break}default:break c}}if(!A)p=B;else{m=108;break a}}while(0);n=h+1|0;l=(n|0)==48;o=j+(l&1)|0;i=p;j=o;g=o*210|0;h=l?0:n}if((m|0)==107){c[e>>2]=k;F=k;break}else if((m|0)==108){c[e>>2]=k;F=B;break}}else F=c[(wd(2400,2592,e,d)|0)>>2]|0;while(0);Da=b;return F|0}function wd(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;e=c[d>>2]|0;d=a;f=b-a>>2;while(1){if(!f)break;a=(f|0)/2|0;b=d+(a<<2)|0;g=(c[b>>2]|0)>>>0<e>>>0;d=g?b+4|0:d;f=g?f+-1-a|0:a}return d|0}function xd(a){a=a|0;return}function yd(a,b){a=a|0;b=b|0;return 0}function zd(a){a=a|0;var b=0,d=0;b=a+8|0;if(!((c[b>>2]|0)!=0?(d=c[b>>2]|0,c[b>>2]=d+-1,(d|0)!=0):0))La[c[(c[a>>2]|0)+16>>2]&31](a);return}function Ad(a){a=a|0;var b=0,c=0;b=(a|0)==0?1:a;while(1){a=pd(b)|0;if(a|0){c=a;break}a=Ie()|0;if(!a){c=0;break}Ka[a&3]()}return c|0}function Bd(a){a=a|0;qd(a);return}function Cd(b,d){b=b|0;d=d|0;var e=0,f=0,g=0;e=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);f=e;g=kd((a[d+11>>0]|0)<0?c[d>>2]|0:d,0,f)|0;c[b>>2]=g;if((g|0)<0){g=c[(vc()|0)>>2]|0;Sd(f,6979,d);Td(g,(a[f+11>>0]|0)<0?c[f>>2]|0:f)}else{Da=e;return}}function Dd(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0;b=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);d=b;e=4;f=d;a:while(1){if(!e){g=9;break}b:while(1){h=ld(c[a>>2]|0,f,e)|0;switch(h|0){case 0:{g=5;break a;break}case -1:break;default:break b}if((c[(vc()|0)>>2]|0)!=4){g=7;break a}}e=e-h|0;f=f+h|0}if((g|0)==5)Td(61,7009);else if((g|0)==7)Td(c[(vc()|0)>>2]|0,7031);else if((g|0)==9){Da=b;return c[d>>2]|0}return 0}function Ed(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=Bc(b)|0;e=Ad(d+13|0)|0;c[e>>2]=d;c[e+4>>2]=d;c[e+8>>2]=0;f=Fd(e)|0;We(f|0,b|0,d+1|0)|0;c[a>>2]=f;return}function Fd(a){a=a|0;return a+12|0}function Gd(a,b){a=a|0;b=b|0;c[a>>2]=3968;Ed(a+4|0,b);return}function Hd(a){a=a|0;return 1}function Id(a){a=a|0;ma()}function Jd(b,d){b=b|0;d=d|0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;if((a[d+11>>0]|0)<0)Kd(b,c[d>>2]|0,c[d+4>>2]|0);else{c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2]}return}function Kd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0;f=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);g=f;if(e>>>0>4294967279)Id(b);if(e>>>0<11){a[b+11>>0]=e;h=b}else{i=e+16&-16;j=Ad(i)|0;c[b>>2]=j;c[b+8>>2]=i|-2147483648;c[b+4>>2]=e;h=j}Ld(h,d,e)|0;a[g>>0]=0;Md(h+e|0,g);Da=f;return}function Ld(a,b,c){a=a|0;b=b|0;c=c|0;if(c|0)We(a|0,b|0,c|0)|0;return a|0}function Md(b,c){b=b|0;c=c|0;a[b>>0]=a[c>>0]|0;return}function Nd(a){a=a|0;return Bc(a)|0}function Od(b,d,e,f,g,h,i,j){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;i=i|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0;k=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);l=k;if((-18-d|0)>>>0<e>>>0)Id(b);if((a[b+11>>0]|0)<0)m=c[b>>2]|0;else m=b;if(d>>>0<2147483623){n=e+d|0;e=d<<1;o=n>>>0<e>>>0?e:n;p=o>>>0<11?11:o+16&-16}else p=-17;o=Ad(p)|0;if(g|0)Ld(o,m,g)|0;if(i|0)Ld(o+g|0,j,i)|0;j=f-h|0;f=j-g|0;if(f|0)Ld(o+g+i|0,m+g+h|0,f)|0;if((d|0)!=10)Bd(m);c[b>>2]=o;c[b+8>>2]=p|-2147483648;p=j+i|0;c[b+4>>2]=p;a[l>>0]=0;Md(o+p|0,l);Da=k;return}function Pd(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0;if(d>>>0>4294967279)Id(b);e=b+11|0;f=a[e>>0]|0;g=f<<24>>24<0;if(g){h=c[b+4>>2]|0;i=(c[b+8>>2]&2147483647)+-1|0}else{h=f&255;i=10}j=h>>>0>d>>>0?h:d;d=j>>>0<11;k=d?10:(j+16&-16)+-1|0;do if((k|0)!=(i|0)){do if(d){j=c[b>>2]|0;if(g){l=0;m=j;n=b;o=13}else{Ld(b,j,(f&255)+1|0)|0;Bd(j);o=16}}else{j=k+1|0;p=Ad(j)|0;if(g){l=1;m=c[b>>2]|0;n=p;o=13;break}else{Ld(p,b,(f&255)+1|0)|0;q=p;r=j;s=b+4|0;o=15;break}}while(0);if((o|0)==13){j=b+4|0;Ld(n,m,(c[j>>2]|0)+1|0)|0;Bd(m);if(l){q=n;r=k+1|0;s=j;o=15}else o=16}if((o|0)==15){c[b+8>>2]=r|-2147483648;c[s>>2]=h;c[b>>2]=q;break}else if((o|0)==16){a[e>>0]=h;break}}while(0);return}function Qd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;f=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);g=f;h=b+11|0;i=a[h>>0]|0;j=i<<24>>24<0;if(j){k=(c[b+8>>2]&2147483647)+-1|0;l=c[b+4>>2]|0}else{k=10;l=i&255}if((k-l|0)>>>0>=e>>>0){if(e|0){if(j)m=c[b>>2]|0;else m=b;Ld(m+l|0,d,e)|0;j=l+e|0;if((a[h>>0]|0)<0)c[b+4>>2]=j;else a[h>>0]=j;a[g>>0]=0;Md(m+j|0,g)}}else Od(b,k,l+e-k|0,l,l,0,e,d);Da=f;return b|0}function Rd(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0;g=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);h=g;if(f>>>0>4294967279)Id(b);if(f>>>0<11){a[b+11>>0]=e;i=b}else{j=f+16&-16;f=Ad(j)|0;c[b>>2]=f;c[b+8>>2]=j|-2147483648;c[b+4>>2]=e;i=f}Ld(i,d,e)|0;a[h>>0]=0;Md(i+e|0,h);Da=g;return}function Sd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;c[b>>2]=0;c[b+4>>2]=0;c[b+8>>2]=0;f=0;while(1){if((f|0)==3)break;c[b+(f<<2)>>2]=0;f=f+1|0}f=Nd(d)|0;g=e+11|0;h=a[g>>0]|0;i=h<<24>>24<0?c[e+4>>2]|0:h&255;Rd(b,d,f,i+f|0);Qd(b,(a[g>>0]|0)<0?c[e>>2]|0:e,i)|0;return}function Td(a,b){a=a|0;b=b|0;ma()}function Ud(a){a=a|0;ma()}function Vd(){var a=0,b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0;a=Da;Da=Da+48|0;if((Da|0)>=(Ea|0))x(48);b=a+32|0;d=a+24|0;e=a+16|0;f=a;g=a+36|0;a=Wd()|0;if(a|0?(h=c[a>>2]|0,h|0):0){a=h+48|0;i=c[a>>2]|0;j=c[a+4>>2]|0;if(!((i&-256|0)==1126902528&(j|0)==1129074247)){c[d>>2]=7205;Xd(7155,d)}if((i|0)==1126902529&(j|0)==1129074247)k=c[h+44>>2]|0;else k=h+80|0;c[g>>2]=k;k=c[h>>2]|0;h=c[k+4>>2]|0;if(Ja[c[(c[744]|0)+16>>2]&7](2976,k,g)|0){k=c[g>>2]|0;g=Ga[c[(c[k>>2]|0)+8>>2]&7](k)|0;c[f>>2]=7205;c[f+4>>2]=h;c[f+8>>2]=g;Xd(7069,f)}else{c[e>>2]=7205;c[e+4>>2]=h;Xd(7114,e)}}Xd(7193,b)}function Wd(){var a=0,b=0;a=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);if(!(Aa(11856,3)|0)){b=ya(c[2965]|0)|0;Da=a;return b|0}else Xd(7344,a);return 0}function Xd(a,b){a=a|0;b=b|0;var d=0,e=0;d=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);e=d;c[e>>2]=b;b=c[838]|0;Rc(b,a,e)|0;nd(10,b)|0;ma()}function Yd(a){a=a|0;return}function Zd(a){a=a|0;Yd(a);Bd(a);return}function _d(a){a=a|0;return}function $d(a){a=a|0;return}function ae(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0;e=Da;Da=Da+64|0;if((Da|0)>=(Ea|0))x(64);f=e;if(!(ee(a,b,0)|0))if((b|0)!=0?(g=ie(b,3e3,2984,0)|0,(g|0)!=0):0){b=f+4|0;h=b+52|0;do{c[b>>2]=0;b=b+4|0}while((b|0)<(h|0));c[f>>2]=g;c[f+8>>2]=a;c[f+12>>2]=-1;c[f+48>>2]=1;Oa[c[(c[g>>2]|0)+28>>2]&7](g,f,c[d>>2]|0,1);if((c[f+24>>2]|0)==1){c[d>>2]=c[f+16>>2];i=1}else i=0;j=i}else j=0;else j=1;Da=e;return j|0}function be(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;if(ee(a,c[b+8>>2]|0,g)|0)he(0,b,d,e,f);return}function ce(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;do if(!(ee(b,c[d+8>>2]|0,g)|0)){if(ee(b,c[d>>2]|0,g)|0){if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;c[h>>2]=e;h=d+40|0;c[h>>2]=(c[h>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0)a[d+54>>0]=1;c[d+44>>2]=4;break}if((f|0)==1)c[d+32>>2]=1}}else ge(0,d,e,f);while(0);return}function de(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if(ee(a,c[b+8>>2]|0,0)|0)fe(0,b,d,e);return}function ee(a,b,c){a=a|0;b=b|0;c=c|0;return (a|0)==(b|0)|0}function fe(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0;b=d+16|0;g=c[b>>2]|0;do if(g){if((g|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;c[d+24>>2]=2;a[d+54>>0]=1;break}h=d+24|0;if((c[h>>2]|0)==2)c[h>>2]=f}else{c[b>>2]=e;c[d+24>>2]=f;c[d+36>>2]=1}while(0);return}function ge(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;if((c[b+4>>2]|0)==(d|0)?(d=b+28|0,(c[d>>2]|0)!=1):0)c[d>>2]=e;return}function he(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0;a[d+53>>0]=1;do if((c[d+4>>2]|0)==(f|0)){a[d+52>>0]=1;b=d+16|0;h=c[b>>2]|0;if(!h){c[b>>2]=e;c[d+24>>2]=g;c[d+36>>2]=1;if(!((g|0)==1?(c[d+48>>2]|0)==1:0))break;a[d+54>>0]=1;break}if((h|0)!=(e|0)){h=d+36|0;c[h>>2]=(c[h>>2]|0)+1;a[d+54>>0]=1;break}h=d+24|0;b=c[h>>2]|0;if((b|0)==2){c[h>>2]=g;i=g}else i=b;if((i|0)==1?(c[d+48>>2]|0)==1:0)a[d+54>>0]=1}while(0);return}function ie(d,e,f,g){d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=Da;Da=Da+64|0;if((Da|0)>=(Ea|0))x(64);i=h;j=c[d>>2]|0;k=d+(c[j+-8>>2]|0)|0;l=c[j+-4>>2]|0;c[i>>2]=f;c[i+4>>2]=d;c[i+8>>2]=e;c[i+12>>2]=g;g=i+16|0;e=i+20|0;d=i+24|0;j=i+28|0;m=i+32|0;n=i+40|0;o=g;p=o+36|0;do{c[o>>2]=0;o=o+4|0}while((o|0)<(p|0));b[g+36>>1]=0;a[g+38>>0]=0;a:do if(ee(l,f,0)|0){c[i+48>>2]=1;Qa[c[(c[l>>2]|0)+20>>2]&7](l,i,k,k,1,0);q=(c[d>>2]|0)==1?k:0}else{Pa[c[(c[l>>2]|0)+24>>2]&3](l,i,k,1,0);switch(c[i+36>>2]|0){case 0:{q=(c[n>>2]|0)==1&(c[j>>2]|0)==1&(c[m>>2]|0)==1?c[e>>2]|0:0;break a;break}case 1:break;default:{q=0;break a}}if((c[d>>2]|0)!=1?!((c[n>>2]|0)==0&(c[j>>2]|0)==1&(c[m>>2]|0)==1):0){q=0;break}q=c[g>>2]|0}while(0);Da=h;return q|0}function je(a){a=a|0;Yd(a);Bd(a);return}function ke(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0;if(ee(a,c[b+8>>2]|0,g)|0)he(0,b,d,e,f);else{h=c[a+8>>2]|0;Qa[c[(c[h>>2]|0)+20>>2]&7](h,b,d,e,f,g)}return}function le(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;do if(!(ee(b,c[d+8>>2]|0,g)|0)){if(!(ee(b,c[d>>2]|0,g)|0)){h=c[b+8>>2]|0;Pa[c[(c[h>>2]|0)+24>>2]&3](h,d,e,f,g);break}if((c[d+16>>2]|0)!=(e|0)?(h=d+20|0,(c[h>>2]|0)!=(e|0)):0){c[d+32>>2]=f;i=d+44|0;if((c[i>>2]|0)==4)break;j=d+52|0;a[j>>0]=0;k=d+53|0;a[k>>0]=0;l=c[b+8>>2]|0;Qa[c[(c[l>>2]|0)+20>>2]&7](l,d,e,e,1,g);if(a[k>>0]|0)if(!(a[j>>0]|0)){m=1;n=11}else n=15;else{m=0;n=11}do if((n|0)==11){c[h>>2]=e;j=d+40|0;c[j>>2]=(c[j>>2]|0)+1;if((c[d+36>>2]|0)==1?(c[d+24>>2]|0)==2:0){a[d+54>>0]=1;if(m){n=15;break}else{o=4;break}}if(m)n=15;else o=4}while(0);if((n|0)==15)o=3;c[i>>2]=o;break}if((f|0)==1)c[d+32>>2]=1}else ge(0,d,e,f);while(0);return}function me(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0;if(ee(a,c[b+8>>2]|0,0)|0)fe(0,b,d,e);else{f=c[a+8>>2]|0;Oa[c[(c[f>>2]|0)+28>>2]&7](f,b,d,e)}return}function ne(a){a=a|0;return}function oe(){var a=0;a=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);if(!(za(11860,27)|0)){Da=a;return}else Xd(7393,a)}function pe(a){a=a|0;var b=0;b=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);qd(a);if(!(Ba(c[2965]|0,0)|0)){Da=b;return}else Xd(7443,b)}function qe(){var a=0,b=0;a=Wd()|0;if((a|0?(b=c[a>>2]|0,b|0):0)?(a=b+48|0,(c[a>>2]&-256|0)==1126902528?(c[a+4>>2]|0)==1129074247:0):0)re(c[b+12>>2]|0);re(se()|0)}function re(a){a=a|0;var b=0;b=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);Ka[a&3]();Xd(7496,b)}function se(){var a=0;a=c[969]|0;c[969]=a+0;return a|0}function te(a){a=a|0;return}function ue(a){a=a|0;c[a>>2]=3968;ye(a+4|0);return}function ve(a){a=a|0;ue(a);Bd(a);return}function we(a){a=a|0;return xe(a+4|0)|0}function xe(a){a=a|0;return c[a>>2]|0}function ye(a){a=a|0;var b=0,d=0;if(Hd(a)|0?(b=ze(c[a>>2]|0)|0,a=b+8|0,d=c[a>>2]|0,c[a>>2]=d+-1,(d+-1|0)<0):0)Bd(b);return}function ze(a){a=a|0;return a+-12|0}function Ae(a){a=a|0;ue(a);Bd(a);return}function Be(a){a=a|0;Yd(a);Bd(a);return}function Ce(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0;if(ee(b,c[d+8>>2]|0,h)|0)he(0,d,e,f,g);else{i=d+52|0;j=a[i>>0]|0;k=d+53|0;l=a[k>>0]|0;m=c[b+12>>2]|0;n=b+16+(m<<3)|0;a[i>>0]=0;a[k>>0]=0;Ge(b+16|0,d,e,f,g,h);a:do if((m|0)>1){o=d+24|0;p=b+8|0;q=d+54|0;r=b+24|0;do{if(a[q>>0]|0)break a;if(!(a[i>>0]|0)){if(a[k>>0]|0?(c[p>>2]&1|0)==0:0)break a}else{if((c[o>>2]|0)==1)break a;if(!(c[p>>2]&2))break a}a[i>>0]=0;a[k>>0]=0;Ge(r,d,e,f,g,h);r=r+8|0}while(r>>>0<n>>>0)}while(0);a[i>>0]=j;a[k>>0]=l}return}function De(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0;a:do if(!(ee(b,c[d+8>>2]|0,g)|0)){if(!(ee(b,c[d>>2]|0,g)|0)){h=c[b+12>>2]|0;i=b+16+(h<<3)|0;He(b+16|0,d,e,f,g);j=b+24|0;if((h|0)<=1)break;h=c[b+8>>2]|0;if((h&2|0)==0?(k=d+36|0,(c[k>>2]|0)!=1):0){if(!(h&1)){h=d+54|0;l=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1)break a;He(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}l=d+24|0;h=d+54|0;m=j;while(1){if(a[h>>0]|0)break a;if((c[k>>2]|0)==1?(c[l>>2]|0)==1:0)break a;He(m,d,e,f,g);m=m+8|0;if(m>>>0>=i>>>0)break a}}m=d+54|0;l=j;while(1){if(a[m>>0]|0)break a;He(l,d,e,f,g);l=l+8|0;if(l>>>0>=i>>>0)break a}}if((c[d+16>>2]|0)!=(e|0)?(i=d+20|0,(c[i>>2]|0)!=(e|0)):0){c[d+32>>2]=f;l=d+44|0;if((c[l>>2]|0)==4)break;m=b+16+(c[b+12>>2]<<3)|0;j=d+52|0;k=d+53|0;h=d+54|0;n=b+8|0;o=d+24|0;p=0;q=b+16|0;r=0;b:while(1){if(q>>>0>=m>>>0){s=p;t=18;break}a[j>>0]=0;a[k>>0]=0;Ge(q,d,e,e,1,g);if(a[h>>0]|0){s=p;t=18;break}do if(a[k>>0]|0){if(!(a[j>>0]|0))if(!(c[n>>2]&1)){s=1;t=18;break b}else{u=1;v=r;break}if((c[o>>2]|0)==1){t=23;break b}if(!(c[n>>2]&2)){t=23;break b}else{u=1;v=1}}else{u=p;v=r}while(0);p=u;q=q+8|0;r=v}do if((t|0)==18){if((!r?(c[i>>2]=e,q=d+40|0,c[q>>2]=(c[q>>2]|0)+1,(c[d+36>>2]|0)==1):0)?(c[o>>2]|0)==2:0){a[h>>0]=1;if(s){t=23;break}else{w=4;break}}if(s)t=23;else w=4}while(0);if((t|0)==23)w=3;c[l>>2]=w;break}if((f|0)==1)c[d+32>>2]=1}else ge(0,d,e,f);while(0);return}function Ee(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;a:do if(!(ee(b,c[d+8>>2]|0,0)|0)){g=c[b+12>>2]|0;h=b+16+(g<<3)|0;Fe(b+16|0,d,e,f);if((g|0)>1){g=d+54|0;i=b+24|0;do{Fe(i,d,e,f);if(a[g>>0]|0)break a;i=i+8|0}while(i>>>0<h>>>0)}}else fe(0,d,e,f);while(0);return}function Fe(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=c[a+4>>2]|0;g=f>>8;if(!(f&1))h=g;else h=c[(c[d>>2]|0)+g>>2]|0;g=c[a>>2]|0;Oa[c[(c[g>>2]|0)+28>>2]&7](g,b,d+h|0,(f&2|0)==0?2:e);return}function Ge(a,b,d,e,f,g){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0;h=c[a+4>>2]|0;i=h>>8;if(!(h&1))j=i;else j=c[(c[e>>2]|0)+i>>2]|0;i=c[a>>2]|0;Qa[c[(c[i>>2]|0)+20>>2]&7](i,b,d,e+j|0,(h&2|0)==0?2:f,g);return}function He(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0;g=c[a+4>>2]|0;h=g>>8;if(!(g&1))i=h;else i=c[(c[d>>2]|0)+h>>2]|0;h=c[a>>2]|0;Pa[c[(c[h>>2]|0)+24>>2]&3](h,b,d+i|0,(g&2|0)==0?2:e,f);return}function Ie(){var a=0;a=c[2966]|0;c[2966]=a+0;return a|0}function Je(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0;e=Da;Da=Da+16|0;if((Da|0)>=(Ea|0))x(16);f=e;c[f>>2]=c[d>>2];g=Ja[c[(c[a>>2]|0)+16>>2]&7](a,b,f)|0;if(g)c[d>>2]=c[f>>2];Da=e;return g&1|0}function Ke(a){a=a|0;var b=0;if(!a)b=0;else b=(ie(a,3e3,3088,0)|0)!=0&1;return b|0}function Le(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (v(b+d+(e>>>0<a>>>0|0)>>>0|0),e|0)|0}function Me(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (v(e|0),a-c>>>0|0)|0}function Ne(a){a=a|0;return (a?31-(t(a^a-1)|0)|0:32)|0}function Oe(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,u=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (v(n|0),o)|0}else{if(!m){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (v(n|0),o)|0}}m=(l|0)==0;do if(j){if(!m){p=(t(l|0)|0)-(t(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;u=q;x=g>>>(q>>>0)&s|i<<r;y=i>>>(q>>>0)&s;z=0;A=g<<r;break}if(!f){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (v(n|0),o)|0}r=j-1|0;if(r&j|0){s=(t(j|0)|0)+33-(t(i|0)|0)|0;q=64-s|0;p=32-s|0;B=p>>31;C=s-32|0;D=C>>31;u=s;x=p-1>>31&i>>>(C>>>0)|(i<<p|g>>>(s>>>0))&D;y=D&i>>>(s>>>0);z=g<<q&B;A=(i<<q|g>>>(C>>>0))&B|g<<p&s-33>>31;break}if(f|0){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (v(n|0),o)|0}else{r=Ne(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (v(n|0),o)|0}}else{if(m){if(f|0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (v(n|0),o)|0}if(!g){if(f|0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (v(n|0),o)|0}r=l-1|0;if(!(r&l)){if(f|0){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((Ne(l|0)|0)>>>0);return (v(n|0),o)|0}r=(t(l|0)|0)-(t(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;u=s;x=i<<p|g>>>(s>>>0);y=i>>>(s>>>0);z=0;A=g<<p;break}if(!f){n=0;o=0;return (v(n|0),o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (v(n|0),o)|0}while(0);if(!u){E=A;F=z;G=y;H=x;I=0;J=0}else{b=d|0|0;d=k|e&0;e=Le(b|0,d|0,-1,-1)|0;k=w()|0;h=A;A=z;z=y;y=x;x=u;u=0;do{a=h;h=A>>>31|h<<1;A=u|A<<1;g=y<<1|a>>>31|0;a=y>>>31|z<<1|0;Me(e|0,k|0,g|0,a|0)|0;i=w()|0;l=i>>31|((i|0)<0?-1:0)<<1;u=l&1;y=Me(g|0,a|0,l&b|0,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d|0)|0;z=w()|0;x=x-1|0}while((x|0)!=0);E=h;F=A;G=z;H=y;I=0;J=u}u=F;F=0;if(f|0){c[f>>2]=H;c[f+4>>2]=G}n=(u|0)>>>31|(E|F)<<1|(F<<1|u>>>31)&0|I;o=(u<<1|0>>>31)&-2|J;return (v(n|0),o)|0}function Pe(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;e=b>>31|((b|0)<0?-1:0)<<1;f=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;g=d>>31|((d|0)<0?-1:0)<<1;h=((d|0)<0?-1:0)>>31|((d|0)<0?-1:0)<<1;i=Me(e^a|0,f^b|0,e|0,f|0)|0;b=w()|0;a=g^e;e=h^f;return Me((Oe(i,b,Me(g^c|0,h^d|0,g|0,h|0)|0,w()|0,0)|0)^a|0,(w()|0)^e|0,a|0,e|0)|0}function Qe(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=s(d,c)|0;f=a>>>16;a=(e>>>16)+(s(d,f)|0)|0;d=b>>>16;b=s(d,c)|0;return (v((a>>>16)+(s(d,f)|0)+(((a&65535)+b|0)>>>16)|0),a+b<<16|e&65535|0)|0}function Re(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=Qe(e,a)|0;f=w()|0;return (v((s(b,a)|0)+(s(d,e)|0)+f|f&0|0),c|0|0)|0}function Se(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Oe(a,b,c,d,0)|0}function Te(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){v(b>>>c|0);return a>>>c|(b&(1<<c)-1)<<32-c}v(0);return b>>>c-32|0}function Ue(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){v(b<<c|(a&(1<<c)-1<<32-c)>>>32-c|0);return a<<c}v(a<<c-32|0);return 0}function Ve(a){a=a|0;return (a&255)<<24|(a>>8&255)<<16|(a>>16&255)<<8|a>>>24|0}function We(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;if((e|0)>=8192){sa(b|0,d|0,e|0)|0;return b|0}f=b|0;g=b+e|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}h=g&-4|0;e=h-64|0;while((b|0)<=(e|0)){c[b>>2]=c[d>>2];c[b+4>>2]=c[d+4>>2];c[b+8>>2]=c[d+8>>2];c[b+12>>2]=c[d+12>>2];c[b+16>>2]=c[d+16>>2];c[b+20>>2]=c[d+20>>2];c[b+24>>2]=c[d+24>>2];c[b+28>>2]=c[d+28>>2];c[b+32>>2]=c[d+32>>2];c[b+36>>2]=c[d+36>>2];c[b+40>>2]=c[d+40>>2];c[b+44>>2]=c[d+44>>2];c[b+48>>2]=c[d+48>>2];c[b+52>>2]=c[d+52>>2];c[b+56>>2]=c[d+56>>2];c[b+60>>2]=c[d+60>>2];b=b+64|0;d=d+64|0}while((b|0)<(h|0)){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0}}else{h=g-4|0;while((b|0)<(h|0)){a[b>>0]=a[d>>0]|0;a[b+1>>0]=a[d+1>>0]|0;a[b+2>>0]=a[d+2>>0]|0;a[b+3>>0]=a[d+3>>0]|0;b=b+4|0;d=d+4|0}}while((b|0)<(g|0)){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0}return f|0}function Xe(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;d=d&255;if((e|0)>=67){while(b&3){a[b>>0]=d;b=b+1|0}g=f&-4|0;h=d|d<<8|d<<16|d<<24;i=g-64|0;while((b|0)<=(i|0)){c[b>>2]=h;c[b+4>>2]=h;c[b+8>>2]=h;c[b+12>>2]=h;c[b+16>>2]=h;c[b+20>>2]=h;c[b+24>>2]=h;c[b+28>>2]=h;c[b+32>>2]=h;c[b+36>>2]=h;c[b+40>>2]=h;c[b+44>>2]=h;c[b+48>>2]=h;c[b+52>>2]=h;c[b+56>>2]=h;c[b+60>>2]=h;b=b+64|0}while((b|0)<(g|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return f-e|0}function Ye(a){a=a|0;var b=0,d=0;b=c[i>>2]|0;d=b+a|0;if((a|0)>0&(d|0)<(b|0)|(d|0)<0){Ca(d|0)|0;da(12);return -1}if((d|0)>(pa()|0)){if(!(ta(d|0)|0)){da(12);return -1}}else c[i>>2]=d;return b|0}function Ze(a,b){a=a|0;b=b|0;return Ga[a&7](b|0)|0}function _e(a,b,c,d){a=a|0;b=b|0;c=+c;d=d|0;return Ha[a&1](b|0,+c,d|0)|0}function $e(a,b,c){a=a|0;b=b|0;c=c|0;return Ia[a&7](b|0,c|0)|0}function af(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;return Ja[a&7](b|0,c|0,d|0)|0}function bf(a){a=a|0;Ka[a&3]()}function cf(a,b){a=a|0;b=b|0;La[a&31](b|0)}function df(a,b,c){a=a|0;b=b|0;c=c|0;Ma[a&15](b|0,c|0)}function ef(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;Na[a&3](b|0,c|0,d|0)}function ff(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;Oa[a&7](b|0,c|0,d|0,e|0)}function gf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;Pa[a&3](b|0,c|0,d|0,e|0,f|0)}function hf(a,b,c,d,e,f,g){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;g=g|0;Qa[a&7](b|0,c|0,d|0,e|0,f|0,g|0)}function jf(a){a=a|0;y(0);return 0}function kf(a,b,c){a=a|0;b=+b;c=c|0;z(0);return 0}function lf(a,b){a=a|0;b=b|0;A(0);return 0}function mf(a,b){a=a|0;b=b|0;A(6);return 0}function nf(a,b){a=a|0;b=b|0;A(7);return 0}function of(a,b,c){a=a|0;b=b|0;c=c|0;B(0);return 0}function pf(a,b,c){a=a|0;b=b|0;c=c|0;B(5);return 0}function qf(a,b,c){a=a|0;b=b|0;c=c|0;B(6);return 0}function rf(a,b,c){a=a|0;b=b|0;c=c|0;B(7);return 0}function sf(){C(0)}function tf(a){a=a|0;D(0)}function uf(a){a=a|0;D(28)}function vf(a){a=a|0;D(29)}function wf(a){a=a|0;D(30)}function xf(a){a=a|0;D(31)}function yf(a,b){a=a|0;b=b|0;E(0)}function zf(a,b){a=a|0;b=b|0;E(10)}function Af(a,b){a=a|0;b=b|0;E(11)}function Bf(a,b){a=a|0;b=b|0;E(12)}function Cf(a,b){a=a|0;b=b|0;E(13)}function Df(a,b){a=a|0;b=b|0;E(14)}function Ef(a,b){a=a|0;b=b|0;E(15)}function Ff(a,b,c){a=a|0;b=b|0;c=c|0;F(0)}function Gf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(0)}function Hf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(6)}function If(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;G(7)}function Jf(a,b,c,d,e){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;H(0)}function Kf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;I(0)}function Lf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;I(5)}function Mf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;I(6)}function Nf(a,b,c,d,e,f){a=a|0;b=b|0;c=c|0;d=d|0;e=e|0;f=f|0;I(7)}

// EMSCRIPTEN_END_FUNCS
var Ga=[jf,Cb,Ib,hc,nc,rc,ud,we];var Ha=[kf,db];var Ia=[lf,pb,Hb,yd,Tb,mc,mf,nf];var Ja=[of,sc,tc,xc,ae,pf,qf,rf];var Ka=[sf,Vd,Xa,oe];var La=[tf,jb,lb,Ab,Bb,Eb,Fb,Mb,Nb,Ob,Pb,oc,gc,jc,kc,lc,sd,td,Yd,Zd,_d,$d,je,ue,ve,Ae,Be,pe,uf,vf,wf,xf];var Ma=[yf,eb,fb,gb,hb,ib,ob,Db,Sb,ic,zf,Af,Bf,Cf,Df,Ef];var Na=[Ff,kb,nb,Rb];var Oa=[Gf,mb,qb,de,me,Ee,Hf,If];var Pa=[Jf,ce,le,De];var Qa=[Kf,Gb,be,ke,Ce,Lf,Mf,Nf];return{__GLOBAL__sub_I_main_cpp:qc,___cxa_can_catch:Je,___cxa_is_pointer_type:Ke,___divdi3:Pe,___em_js__getWindowHeight:Wa,___em_js__getWindowWidth:Va,___errno_location:vc,___muldi3:Re,___udivdi3:Se,_bitshift64Lshr:Te,_bitshift64Shl:Ue,_fflush:Oc,_free:qd,_i64Add:Le,_i64Subtract:Me,_llvm_bswap_i32:Ve,_main:Ya,_malloc:pd,_memcpy:We,_memset:Xe,_sbrk:Ye,dynCall_ii:Ze,dynCall_iidi:_e,dynCall_iii:$e,dynCall_iiii:af,dynCall_v:bf,dynCall_vi:cf,dynCall_vii:df,dynCall_viii:ef,dynCall_viiii:ff,dynCall_viiiii:gf,dynCall_viiiiii:hf,establishStackSpace:Ua,stackAlloc:Ra,stackRestore:Ta,stackSave:Sa}})


// EMSCRIPTEN_END_ASM
(asmGlobalArg, asmLibraryArg, buffer);

var real___GLOBAL__sub_I_main_cpp = asm["__GLOBAL__sub_I_main_cpp"];

asm["__GLOBAL__sub_I_main_cpp"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real___GLOBAL__sub_I_main_cpp.apply(null, arguments);
};

var real____cxa_can_catch = asm["___cxa_can_catch"];

asm["___cxa_can_catch"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____cxa_can_catch.apply(null, arguments);
};

var real____cxa_is_pointer_type = asm["___cxa_is_pointer_type"];

asm["___cxa_is_pointer_type"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____cxa_is_pointer_type.apply(null, arguments);
};

var real____divdi3 = asm["___divdi3"];

asm["___divdi3"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____divdi3.apply(null, arguments);
};

var real____em_js__getWindowHeight = asm["___em_js__getWindowHeight"];

asm["___em_js__getWindowHeight"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____em_js__getWindowHeight.apply(null, arguments);
};

var real____em_js__getWindowWidth = asm["___em_js__getWindowWidth"];

asm["___em_js__getWindowWidth"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____em_js__getWindowWidth.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"];

asm["___errno_location"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____errno_location.apply(null, arguments);
};

var real____muldi3 = asm["___muldi3"];

asm["___muldi3"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____muldi3.apply(null, arguments);
};

var real____udivdi3 = asm["___udivdi3"];

asm["___udivdi3"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real____udivdi3.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"];

asm["_bitshift64Lshr"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__bitshift64Lshr.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"];

asm["_bitshift64Shl"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__bitshift64Shl.apply(null, arguments);
};

var real__fflush = asm["_fflush"];

asm["_fflush"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"];

asm["_free"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__free.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"];

asm["_i64Add"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__i64Add.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"];

asm["_i64Subtract"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__i64Subtract.apply(null, arguments);
};

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"];

asm["_llvm_bswap_i32"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__llvm_bswap_i32.apply(null, arguments);
};

var real__main = asm["_main"];

asm["_main"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__main.apply(null, arguments);
};

var real__malloc = asm["_malloc"];

asm["_malloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"];

asm["_sbrk"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real__sbrk.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"];

asm["establishStackSpace"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_establishStackSpace.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"];

asm["stackAlloc"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"];

asm["stackRestore"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"];

asm["stackSave"] = function() {
 assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
 assert(!runtimeExited, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
 return real_stackSave.apply(null, arguments);
};

var __GLOBAL__sub_I_main_cpp = Module["__GLOBAL__sub_I_main_cpp"] = asm["__GLOBAL__sub_I_main_cpp"];

var ___cxa_can_catch = Module["___cxa_can_catch"] = asm["___cxa_can_catch"];

var ___cxa_is_pointer_type = Module["___cxa_is_pointer_type"] = asm["___cxa_is_pointer_type"];

var ___divdi3 = Module["___divdi3"] = asm["___divdi3"];

var ___em_js__getWindowHeight = Module["___em_js__getWindowHeight"] = asm["___em_js__getWindowHeight"];

var ___em_js__getWindowWidth = Module["___em_js__getWindowWidth"] = asm["___em_js__getWindowWidth"];

var ___errno_location = Module["___errno_location"] = asm["___errno_location"];

var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];

var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];

var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];

var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];

var _fflush = Module["_fflush"] = asm["_fflush"];

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

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() {
 abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["intArrayToString"]) Module["intArrayToString"] = function() {
 abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["ccall"]) Module["ccall"] = function() {
 abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["cwrap"]) Module["cwrap"] = function() {
 abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["setValue"]) Module["setValue"] = function() {
 abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getValue"]) Module["getValue"] = function() {
 abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["allocate"]) Module["allocate"] = function() {
 abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getMemory"]) Module["getMemory"] = function() {
 abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["AsciiToString"]) Module["AsciiToString"] = function() {
 abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToAscii"]) Module["stringToAscii"] = function() {
 abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() {
 abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() {
 abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() {
 abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() {
 abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() {
 abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() {
 abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() {
 abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() {
 abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() {
 abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() {
 abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() {
 abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() {
 abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackTrace"]) Module["stackTrace"] = function() {
 abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() {
 abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnInit"]) Module["addOnInit"] = function() {
 abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() {
 abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnExit"]) Module["addOnExit"] = function() {
 abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() {
 abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() {
 abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() {
 abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() {
 abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addRunDependency"]) Module["addRunDependency"] = function() {
 abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() {
 abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["ENV"]) Module["ENV"] = function() {
 abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["FS"]) Module["FS"] = function() {
 abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() {
 abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createPath"]) Module["FS_createPath"] = function() {
 abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() {
 abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() {
 abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() {
 abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createLink"]) Module["FS_createLink"] = function() {
 abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() {
 abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["FS_unlink"]) Module["FS_unlink"] = function() {
 abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
};

if (!Module["GL"]) Module["GL"] = function() {
 abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() {
 abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["warnOnce"]) Module["warnOnce"] = function() {
 abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() {
 abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() {
 abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getLEB"]) Module["getLEB"] = function() {
 abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() {
 abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() {
 abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["registerFunctions"]) Module["registerFunctions"] = function() {
 abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["addFunction"]) Module["addFunction"] = function() {
 abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["removeFunction"]) Module["removeFunction"] = function() {
 abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() {
 abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["prettyPrint"]) Module["prettyPrint"] = function() {
 abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["makeBigInt"]) Module["makeBigInt"] = function() {
 abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["dynCall"]) Module["dynCall"] = function() {
 abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() {
 abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackSave"]) Module["stackSave"] = function() {
 abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackRestore"]) Module["stackRestore"] = function() {
 abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["stackAlloc"]) Module["stackAlloc"] = function() {
 abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() {
 abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["print"]) Module["print"] = function() {
 abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["printErr"]) Module["printErr"] = function() {
 abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["getTempRet0"]) Module["getTempRet0"] = function() {
 abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["setTempRet0"]) Module["setTempRet0"] = function() {
 abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() {
 abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
};

if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", {
 get: function() {
  abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", {
 get: function() {
  abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", {
 get: function() {
  abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", {
 get: function() {
  abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
 }
});

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
   for (var i = 0; i < data.length; i++) {
    assert(HEAPU8[GLOBAL_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
   }
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
 assert(runDependencies == 0, "cannot call main when async dependencies remain! (listen on __ATMAIN__)");
 assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
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
 writeStackCookie();
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
 checkStackCookie();
}

Module["run"] = run;

function checkUnflushedContent() {
 var print = out;
 var printErr = err;
 var has = false;
 out = err = function(x) {
  has = true;
 };
 try {
  var flush = Module["_fflush"];
  if (flush) flush(0);
  var hasFS = true;
  if (hasFS) {
   [ "stdout", "stderr" ].forEach(function(name) {
    var info = FS.analyzePath("/dev/" + name);
    if (!info) return;
    var stream = info.object;
    var rdev = stream.rdev;
    var tty = TTY.ttys[rdev];
    if (tty && tty.output && tty.output.length) {
     has = true;
    }
   });
  }
 } catch (e) {}
 out = print;
 err = printErr;
 if (has) {
  warnOnce("stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.");
 }
}

function exit(status, implicit) {
 checkUnflushedContent();
 if (implicit && Module["noExitRuntime"] && status === 0) {
  return;
 }
 if (Module["noExitRuntime"]) {
  if (!implicit) {
   err("exit(" + status + ") called, but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)");
  }
 } else {
  ABORT = true;
  EXITSTATUS = status;
  exitRuntime();
  if (Module["onExit"]) Module["onExit"](status);
 }
 Module["quit"](status, new ExitStatus(status));
}

var abortDecorators = [];

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
 var extra = "";
 var output = "abort(" + what + ") at " + stackTrace() + extra;
 if (abortDecorators) {
  abortDecorators.forEach(function(decorator) {
   output = decorator(output, what);
  });
 }
 throw output;
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

