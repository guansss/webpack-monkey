const path = require("path")
const { monkey } = require("webpack-monkey")

module.exports = monkey({
  entry: "./src/index.js",
  output: {
    filename: "hello-word.user.js",
    path: path.resolve(__dirname, "dist"),
  },
})
