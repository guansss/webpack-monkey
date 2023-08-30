import { add } from "lodash"
import { a } from "./a"
import { b } from "./b"
import "./style.css"
import "https://unpkg.com/mitt/dist/mitt.umd.js"

declare global {
  var mitt: typeof import("mitt").default
}

if (module.hot) {
  module.hot.monkeyReload()
}

mitt()

console.log(`[hello] Hello, world! (a = ${a}, b = ${b}, sum = ${add(a, b)})`)
