import { UserscriptMeta } from "../../../src/shared/meta"

export default {
  name: "Hello world",
  version: "0.0.1",
  match: ["*://*/*"],
  require: ["https://unpkg.com/jquery@3.6.0"],
} satisfies UserscriptMeta
