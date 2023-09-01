import { UserscriptMeta } from "../../../src/shared/meta"

export default {
  name: "Hello world",
  description: {
    default: "Hello world",
    "zh-CN": "你好世界",
  },
  version: "0.0.1",
  match: ["*://*/*"],
  require: ["https://unpkg.com/jquery@3.6.0"],
} satisfies UserscriptMeta
