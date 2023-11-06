import { execSync } from "child_process"
import path from "path"
import { rewriteFile, rootDir } from "./utils"

// TODO: make a PR
rewriteFile(path.resolve(rootDir, "node_modules/dependency-check/lib/extensions.js"), (content) =>
  content.replace(`'.tsx': 'precinct/tsx',`, `'.d.ts': 'precinct/ts'`),
)

execSync(`dependency-check ./dist lib/**/*.js lib/**/*.d.ts --verbose --no-dev`, {
  cwd: rootDir,
  stdio: "inherit",
})
