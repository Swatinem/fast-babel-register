const sourceMapSupport = require("source-map-support");
const babel = require("@babel/core");
const pirates = require("pirates");

const maps = {};
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
  const compiled = babel.transformSync(code, babelOptions);

  if (compiled.map) {
    maps[filename] = compiled.map;
  }

  return compiled.code;
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

module.exports = function register(opts) {
  const { ignoreNodeModules = false } = opts;
  delete opts.ignoreNodeModules;
  babelOptions = babel.loadOptions(opts);
  babelOptions.ast = false;
  pirates.addHook(compileHook, {
    exts: opts.extensions || babel.DEFAULT_EXTENSIONS,
    ignoreNodeModules
  });
};
