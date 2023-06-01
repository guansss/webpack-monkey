import webpack from "webpack"
import { MonkeyWebpackPlugin } from "../src/node/MonkeyWebpackPlugin"

beforeEach(() => {
  jest.useFakeTimers()
})

it.only("does not leak the timer", async () => {
  const plugin = new MonkeyWebpackPlugin()
  expect(jest.getTimerCount()).toBe(0)

  const compiler = webpack({})
  plugin.apply(compiler)
  expect(jest.getTimerCount()).toBe(1)

  await new Promise((resolve, reject) =>
    compiler.close((err) => (err ? reject(err) : resolve(null)))
  )
  expect(jest.getTimerCount()).toBe(0)
})
