import { enableHMR } from "webpack-monkey/client"

GM_log("Hello, world!")

if (module.hot) {
  enableHMR(module)
}
