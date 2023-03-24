import { enableHMR } from "../../../src/client/hmr"
import { a } from "./a"
import "./style.css"

console.log("Hello, world!12")

// enableHMR(module)

enableHMR

a()

module.hot.accept((...args) => {
  console.log(1, ...args)
})
module.hot.accept(undefined, (...args) => {
  console.log(2, ...args)
})
module.hot.accept([], (...args) => {
  console.log(3, ...args)
})
