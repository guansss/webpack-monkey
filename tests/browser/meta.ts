import type { UserscriptMeta } from "../../src/shared/meta"

export default {
  name: "webpack-monkey browser test",
  version: "1.0.0",
  match: ["http://127.0.0.1/*"],
} satisfies UserscriptMeta
