/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

var nodeExternals = require('webpack-node-externals');

// compress all files into one JS file
// https://medium.com/netscape/firebase-cloud-functions-with-typescript-and-webpack-7781c882a05b
module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'index.js',
    libraryTarget: 'this',
  },
  target: 'node',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        // options: {
        //     transpileOnly: true // disable type checking..
        // }
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  externals: [nodeExternals()],
};
