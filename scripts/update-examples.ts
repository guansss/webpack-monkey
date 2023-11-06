import { execSync } from "child_process"
import * as glob from "glob"
import path from "path"
import { rimraf } from "rimraf"
import { copyFiles, rewriteFile } from "./utils"
import axios from "axios"

const type = (process.argv[2] || "--local").slice(2) as "local" | "remote"

const root = path.resolve(__dirname, "..")
const dist = path.resolve(__dirname, "../dist")
const examples = path.resolve(__dirname, "../examples")
const monkeyDep = path.resolve(__dirname, "../node_modules/webpack-monkey")

async function main() {
  if (type === "remote") {
    await updateWithRemote()
  } else {
    await updateWithLocalBuild()
  }
}

async function updateWithLocalBuild() {
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
    }),
  )

  execSync("npm run build -w examples", { cwd: root, stdio: "inherit" })
}

async function updateWithRemote() {
  const packageInfo = (await axios.get("https://registry.npmjs.org/webpack-monkey")).data
  const latestVersion = packageInfo["dist-tags"].latest

  glob
    .sync(examples + "/*/package.json", { nodir: true, windowsPathsNoEscape: true })
    .forEach((file) => {
      rewriteFile(file, (content) => {
        let originalVersion = ""

        const result = content.replace(/"webpack-monkey": "([^"]+)"/, function (_, v) {
          originalVersion = v
          return `"webpack-monkey": "^${latestVersion}"`
        })

        console.log(
          `${path.basename(path.dirname(file))}:`,
          originalVersion || `***not found***`,
          originalVersion ? `-> ^${latestVersion}` : "(unchanged)",
        )

        return result
      })
    })

  execSync("npm install", { cwd: root, stdio: "inherit" })
  execSync("npm run build -w examples", { cwd: root, stdio: "inherit" })
}

main().catch(console.error)
