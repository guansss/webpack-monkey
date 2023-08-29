import path from "path"
import { monkey } from "webpack-monkey"

export default monkey({
  entry: "./src/index.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  externals: {
    jquery: "$",
    mitt: "mitt@https://unpkg.com/mitt/dist/mitt.umd.js",
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
    extensions: [".ts", ".js"],
  },
})
