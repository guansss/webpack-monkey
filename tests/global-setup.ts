import { type FullConfig } from "@playwright/test"
import { createServer } from "http"
import WebpackDevServer from "webpack-dev-server"
import { mustGetExtension } from "./extensions/extensions"

if (process.env.EXT) {
  console.log(`============= Testing with ${mustGetExtension(process.env.EXT).name} =============`)
}

const GLOBAL_SERVER_HOST = "127.0.0.1"
const GLOBAL_SERVER_PORT = +process.env.WEBPACK_DEV_SERVER_BASE_PORT! || 8080

const usedPorts = new Set<number>([GLOBAL_SERVER_PORT])

export default async function globalSetup(config: FullConfig) {
  process.env.GLOBAL_SERVER = `http://${GLOBAL_SERVER_HOST}:${GLOBAL_SERVER_PORT}`

  const server = createServer(async (req, res) => {
    if (!req.url) return

    const url = new URL(req.url, `http://${req.headers.host}`)

    if (url.pathname === "/freePort") {
      res.end(`${await getFreePort()}`)
    }
  })
  server.on("error", console.error)
  server.listen(GLOBAL_SERVER_PORT, GLOBAL_SERVER_HOST, () => {
    console.log(`Global server running at ${process.env.GLOBAL_SERVER}`)
  })

  return () => {
    server.close()
  }
}

async function getFreePort() {
  let basePort = Math.max(...usedPorts)

  let retries = 10

  while (retries--) {
    // getFreePort() will read this env var
    process.env.WEBPACK_DEV_SERVER_BASE_PORT = `${basePort}`

    const port = await WebpackDevServer.getFreePort("auto", "127.0.0.1")

    if (isNaN(+port)) {
      throw new Error(`Getting invalid port: ${port}`)
    }

    if (!usedPorts.has(+port)) {
      usedPorts.add(+port)

      return +port
    }

    basePort++
  }

  throw new Error("Failed to get free port")
}
