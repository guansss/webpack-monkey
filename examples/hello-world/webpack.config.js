const path = require("path")
const { monkeyWebpack } = require("webpack-monkey")

module.exports = monkeyWebpack()({
  entry: "src/index.js",
  output: {
    filename: "hello-word.user.js",
    path: path.resolve(__dirname, "dist"),
  },
})
