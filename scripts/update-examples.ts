import { execSync } from "child_process"
import * as glob from "glob"
import path from "path"
import { rimraf } from "rimraf"
import { copyFiles } from "./utils"

const root = path.resolve(__dirname, "..")
const dist = path.resolve(__dirname, "../dist")
const monkeyDep = path.resolve(__dirname, "../node_modules/webpack-monkey")

async function main() {
  // we should have used `overrides` in package.json to redirect node_modules/webpack-monkey to dist,
  // but it doesn't work with workspaces, may be an npm's bug

  // clear node_modules/webpack-monkey
  await rimraf(monkeyDep + "/**/*", { glob: { windowsPathsNoEscape: true } })

  // copy dist to node_modules/webpack-monkey
  copyFiles(
    glob.sync(dist + "/**/*", { nodir: true, windowsPathsNoEscape: true }).map((file) => {
      return {
        from: file,
        to: path.resolve(monkeyDep, path.relative(dist, file)),
      }
    })
  )

  execSync("npm run build -w examples", { cwd: root, stdio: "inherit" })
}

main().catch(console.error)
