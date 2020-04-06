// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.PUBLIC_URL = '';

const useReport = Boolean(process.env.REPORT);

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  console.log('ee');
  throw err;
});

// const webpack = require('webpack');

// Ensure environment variables are read.
class WebpackKarmaWarningsPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync(
      'WebpackKarmaWarningsPlugin',
      (compilation, callback) => {
        if (compilation.warnings.length) { // https://github.com/webpack-contrib/karma-webpack/issues/49#issuecomment-162036339
          console.log('compilation.warnings', compilation.warnings);
          throw new Error(compilation.warnings.toString());
        }
        callback();
      }
    );
  }
};

function createWebpackConfig() {
  const craWebpackConfig = require('./webpack.config.js');
  delete craWebpackConfig['output'];
  delete craWebpackConfig['entry'];
  delete craWebpackConfig['optimization'];
  delete craWebpackConfig['plugins'];
  craWebpackConfig['devtool'] = 'inline-source-map';
  craWebpackConfig['plugins'] = [
    // new webpack.DefinePlugin(getClientEnvironment().stringified),
    /**
     * exit the process when webpack build failed
     * new WebpackKarmaWarningsPlugin()
     */
  ];
  craWebpackConfig['devtool'] = 'inline-source-map';
  craWebpackConfig['mode'] = 'development';
  craWebpackConfig['watch'] = true;
  return craWebpackConfig;
}

module.exports = function(config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],

    client: {
      jasmine: {
        captureConsole: true,
        random: false,
        seed: '4321',
        oneFailurePerSpec: true,
        failFast: true,
        timeoutInterval: 70000
      }
    },

    browserConsoleLogOptions: {
      level: 'log',
      format: '%b %T: %m',
      terminal: true
    },

    // list of files / patterns to load in the browser
    files: [
      // { pattern: 'src/**/DController.spec.ts', watched: false },
      { pattern: 'src/**/DController.spec.ts', watched: false },
    ],

    // list of files / patterns to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      '**/*.spec.*': useReport ? ['webpack', 'coverage'] : ['webpack']
    },

    webpack: createWebpackConfig(),

    webpackMiddleware: {
      // webpack-dev-middleware configuration
      stats: 'errors-only',
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: useReport ? ['spec', 'coverage'] : ['spec'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_DEBUG,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    // browsers: ['ChromeHeadlessCustom'],
    browsers: ['Safari'],


     // you can define custom flags
     customLaunchers: {
      ChromeHeadlessCustom: {
        base: 'ChromeHeadless',
        flags: ['--remote-debugging-port=9333']
        // FIXME: how to make it download automatically
      }
    },

    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity,
    coverageReporter: {
      includeAllSources: true,
      dir: 'coverage/',
      reporters: [
          { type: "lcov", subdir: "html" },
          { type: 'text-summary' }
      ]
    },

    // https://github.com/jasmine/jasmine/issues/1413
    captureTimeout: 210000,
    browserDisconnectTolerance: 3,
    browserDisconnectTimeout : 210000,
    browserNoActivityTimeout : 210000,
  })
}
