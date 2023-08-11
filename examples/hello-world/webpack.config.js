const path = require("path")
const { webpackMonkey } = require("webpack-monkey")

module.exports = webpackMonkey({
  entry: "./src/index.js",
  output: {
    filename: "hello-word.user.js",
    path: path.resolve(__dirname, "dist"),
  },
})
