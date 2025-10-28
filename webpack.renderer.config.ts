import type { Configuration } from 'webpack';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpack = require('webpack');

import { rules as baseRules } from './webpack.rules';
import { plugins } from './webpack.plugins';

// Build renderer-specific rules by filtering out Node-targeted loaders
// 1) Remove native node module loader (node-loader)
// 2) Remove @vercel/webpack-asset-relocator-loader (injects __dirname references)
const rendererSafeBaseRules = baseRules.filter((rule) => {
  const testString = (rule as any).test ? (rule as any).test.toString() : '';
  // Filter out rules targeting native_modules or generic node_modules relocation
  if (testString.includes('native_modules') || testString.includes('node_modules')) {
    return false;
  }
  return true;
});

// CSS processing with Tailwind support (renderer only)
const cssRule = {
  test: /\.css$/,
  use: [
    { loader: 'style-loader' },
    { loader: 'css-loader' },
    {
      loader: 'postcss-loader',
      options: {
        postcssOptions: {
          config: './postcss.config.js',
        },
      },
    },
  ],
};

const rendererRules = [...rendererSafeBaseRules, cssRule];

// Renderer-specific plugins (avoid mutating shared plugins array)
const rendererPlugins = [
  ...plugins,
  new webpack.DefinePlugin({
    __dirname: JSON.stringify('/'),
    __filename: JSON.stringify('/index.js'),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  }),
];

export const rendererConfig: Configuration = {
  module: {
    rules: rendererRules,
  },
  plugins: rendererPlugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    /**
     * Fallbacks for Node.js core modules
     * 
     * WHY THIS IS NEEDED:
     * webpack-dev-server's HMR code tries to import Node.js modules like 'events'
     * But our renderer has nodeIntegration: false (no Node.js APIs)
     * 
     * We provide browser-compatible polyfills for modules webpack-dev-server needs,
     * and set others to false since they're not used by our renderer code
     */
    fallback: {
      events: require.resolve('events/'),
      path: require.resolve('path-browserify'),
      fs: false,
      child_process: false,
      crypto: false,
      stream: false,
      buffer: false,
      util: false,
      assert: false,
      os: false,
    },
  },
  /**
   * Configure for Electron renderer process
   * 
   * WHY 'web' instead of 'electron-renderer':
   * - Modern Electron apps use contextIsolation: true and nodeIntegration: false
   * - This means the renderer is essentially a web browser environment
   * - target: 'web' tells webpack to treat it as a browser (no Node.js APIs)
   * - target: 'electron-renderer' was designed for legacy apps with nodeIntegration: true
   * 
   * - node: false tells webpack that Node.js APIs are NOT available
   *   (prevents webpack from polyfilling Node modules or expecting require())
   */
  target: 'web',
  node: false,
};
