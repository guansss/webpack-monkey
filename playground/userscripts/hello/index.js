import { add } from "lodash"
import { a } from "./a"
import { b } from "./b"
import "./style.css"

module.hot?.monkeyReload()

console.log(`[hello] Hello, world! (a = ${a}, b = ${b}, sum = ${add(a, b)})`)
