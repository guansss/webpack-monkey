import { enableHMR } from "../../../src/client/hmr"
import { a } from "./a"
import { b } from "./b"
import "./style.css"

console.log(`[hello] Hello, world! (a = ${a}, b = ${b})`)

enableHMR(module)
