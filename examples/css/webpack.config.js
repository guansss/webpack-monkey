const path = require("path")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const { monkey } = require("webpack-monkey")

module.exports = monkey({
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  plugins: [new MiniCssExtractPlugin()],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              modules: {
                auto: true,
                localIdentName: "[name]__[local]--[hash:base64:4]",
                namedExport: false,
              },
            },
          },
          {
            loader: "postcss-loader",
            options: {
              postcssOptions: {
                plugins: [require("postcss-preset-env")()],
              },
            },
          },
        ],
      },
    ],
  },
})
