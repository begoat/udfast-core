const merge = require('webpack-merge');
const path = require('path');

const common = require('./webpack.config.js');

module.exports = merge(common, {
  entry: {
    'udfast-core': './src/index.ts',
    'udfast-core.min': './src/index.ts',
  },
  mode: 'production',
  output: {
    path: path.resolve(__dirname, '_bundles'),
    filename: '[name].js',
    libraryTarget: 'umd',
    library: 'MyLib',
    umdNamedDefine: true
  },
  // TODO: need sourcemap
  // TODO: minfiy https://webpack.js.org/configuration/optimization/ min.js
});
