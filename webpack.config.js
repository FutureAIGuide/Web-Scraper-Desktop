const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: './src/renderer/App.tsx',
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, 'dist', 'renderer'),
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  require('tailwindcss'),
                  require('autoprefixer'),
                ],
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src', 'renderer', 'index.html'),
    }),
  ],
};
