const sourceMapSupport = require("source-map-support");
const babel = require("@babel/core");
const pirates = require("pirates");
const path = require("path");
const fsExtra = require("fs-extra");

let cache = {};
let cacheClean = false;
let babelOptions = {};

sourceMapSupport.install({
  environment: "node",
  retrieveFile(filename) {
    const cached = cache[filename];
    if (!cached || !cached.source) {
      return null;
    }
    return {
      url: null,
      map: cached.map
    };
  },
  retrieveSourceMap(filename) {
    const cached = cache[filename];
    if (!cached || !cached.map) {
      return null;
    }
    return {
      url: null,
      map: cached.map
    };
  }
});

function compile(code, filename) {
  let cached = cache[filename];

  if (!cached || cached.source !== code) {
    cached = babel.transformSync(code, {
      ...babelOptions,
      filename,
      sourceMaps: true
    });
    cached.sources = cached.map.sourcesContent = undefined;
    cache[filename] = {
      timestamp: Date.now(),
      source: code,
      code: cached.code,
      map: cached.map
    };
    cacheClean = false;
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

function mergeIntoCache(cacheFilename) {
  if (cacheClean) {
    return;
  }
  try {
    const oldCache = fsExtra.readJsonSync(cacheFilename);
    for (const key of Object.keys(oldCache)) {
      const oldEntry = oldCache[key];
      const newEntry = cache[key];
      if (!newEntry || oldEntry.timestamp > newEntry.timestamp) {
        cache[key] = oldEntry;
      }
    }
  } catch (e) {
  } finally {
    fsExtra.outputJsonSync(cacheFilename, cache);
    cacheClean = true;
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
    const saveCache = () => mergeIntoCache(cacheFilename);
    const saveAndExit = () => {
      saveCache();
      process.exit();
    };
    process.on("beforeExit", saveCache);
    process.nextTick(saveCache);
    process.on("SIGINT", saveAndExit);
    process.on("SIGTERM", saveAndExit);

    try {
      cache = fsExtra.readJsonSync(cacheFilename);
      cacheClean = true;
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
