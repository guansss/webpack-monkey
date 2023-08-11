import { DefinePlugin } from "webpack"
import { webpackMonkey } from "../src"

it("does not mutate given config", () => {
  const config = {
    plugins: [new DefinePlugin({})],
  }
  const newConfig = webpackMonkey(config)

  expect(newConfig).not.toBe(config)
  expect(newConfig.plugins).toHaveLength(2)
  expect(config.plugins).toHaveLength(1)

  const newConfig2 = webpackMonkey(config)
  expect(newConfig2.plugins).toHaveLength(2)
})
