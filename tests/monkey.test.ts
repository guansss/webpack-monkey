import { test } from "node:test"
import assert from "node:assert/strict"
import { DefinePlugin } from "webpack"
import { monkey } from "../src"

/**
 * Verifies that monkey() returns a new config object without mutating the original.
 * Ensures plugins array is extended (MonkeyPlugin added) only in the returned copy.
 */
test("does not mutate given config", () => {
  const config = {
    plugins: [new DefinePlugin({})],
  }
  const newConfig = monkey(config)

  assert.notStrictEqual(newConfig, config)
  assert.equal(newConfig.plugins!.length, 2)
  assert.equal(config.plugins!.length, 1)

  const newConfig2 = monkey(config)
  assert.equal(newConfig2.plugins!.length, 2)
})
