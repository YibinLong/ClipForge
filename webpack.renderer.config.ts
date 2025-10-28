import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

// Add CSS processing with Tailwind support
rules.push({
  test: /\.css$/,
  use: [
    { loader: 'style-loader' },  // Injects CSS into the DOM
    { loader: 'css-loader' },    // Resolves @import and url()
    { 
      loader: 'postcss-loader',  // Processes CSS with PostCSS (Tailwind)
      options: {
        postcssOptions: {
          config: './postcss.config.js',
        },
      },
    },
  ],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};
