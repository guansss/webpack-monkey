import { add } from "lodash"
import { a } from "./a"
import { b } from "./b"
import "./style.css"
import mitt from "mitt@https://unpkg.com/mitt/dist/mitt.umd.js"

module.hot?.monkeyReload()

mitt()

console.log(`[hello] Hello, world! (a = ${a}, b = ${b}, sum = ${add(a, b)})`)
