// import { add } from "lodash"
import { a } from "./a"
import { b } from "./b"
import "./style.css"
import y, { x } from "https://unpkg.com/mitt/dist/mitt.umd.js"

module.hot?.monkeyReload()

console.log(1, x)
// console.log(m, foo, window.mitt)

// console.log(`[hello] Hello, world! (a = ${a}, b = ${b}, sum = ${add(a, b)})`)
