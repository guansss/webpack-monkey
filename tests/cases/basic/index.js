import { enableHMR } from "@/client/exports"

GM_log("Hello, world!")

if (module.hot) {
  enableHMR(module)
}
