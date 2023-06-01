import { DefinePlugin } from "webpack"
import { monkeyWebpack } from "../src"

it("does not mutate given config", () => {
  const config = {
    plugins: [new DefinePlugin({})],
  }
  const newConfig = monkeyWebpack()(config)

  expect(newConfig).not.toBe(config)
  expect(newConfig.plugins).toHaveLength(2)
  expect(config.plugins).toHaveLength(1)

  const newConfig2 = monkeyWebpack()(config)
  expect(newConfig2.plugins).toHaveLength(2)
})
