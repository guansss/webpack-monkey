const path = require("path")
const { monkey } = require("webpack-monkey")

module.exports = monkey({
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
  },
  externals: {
    jquery: "$",
    mitt: "mitt@https://unpkg.com/mitt/dist/mitt.umd.js",
  },
})
