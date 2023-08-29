import path from "path"
import { monkey } from "webpack-monkey"

module.exports = monkey({
  entry: "./src/index.ts",
  output: {
    filename: "ts-hello-word.user.js",
    path: path.resolve(__dirname, "dist"),
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: "ts-loader",
      },
    ],
  },
  resolve: {
    extensions: [".ts", "..."],
  },
})
