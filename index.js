const sourceMapSupport = require("source-map-support");
const babel = require("@babel/core");
const pirates = require("pirates");
const path = require("path");
const fsExtra = require("fs-extra");

const maps = {};
let cache = {};
let babelOptions = {};

sourceMapSupport.install({
  handleUncaughtExceptions: false,
  environment: "node",
  retrieveSourceMap(source) {
    const map = maps && maps[source];
    if (map) {
      return {
        url: null,
        map: map
      };
    } else {
      return null;
    }
  }
});

function compile(code, filename) {
  const cacheKey = `${filename}:${code}`;
  let cached = cache[cacheKey];

  if (!cached) {
    cached = babel.transformSync(code, { ...babelOptions, filename });
    cache[cacheKey] = { code: cached.code, map: cached.map };
  }

  if (cached.map) {
    maps[filename] = cached.map;
  }

  return cached.code;
}

let compiling = false;

function compileHook(code, filename) {
  if (compiling) return code;

  try {
    compiling = true;
    return compile(code, filename);
  } finally {
    compiling = false;
  }
}

module.exports = function register(options) {
  const {
    ignoreNodeModules = false,
    extensions: exts = babel.DEFAULT_EXTENSIONS,
    cache: cacheFilename = path.join(
      __dirname,
      "..",
      ".cache",
      "fast-babel-register-cache.json"
    )
  } = options;

  if (cacheFilename) {
    function saveCache() {
      fsExtra.outputJsonSync(cacheFilename, cache, { spaces: "  " });
    }
    process.on("exit", saveCache);
    process.nextTick(saveCache);

    try {
      cache = fsExtra.readJsonSync(cacheFilename);
    } catch (err) {}
  }

  delete options.cache;
  delete options.ignoreNodeModules;
  delete options.extensions;

  babelOptions = options;
  // babelOptions = babel.loadOptions(options)
  pirates.addHook(compileHook, {
    exts,
    ignoreNodeModules
  });
};
