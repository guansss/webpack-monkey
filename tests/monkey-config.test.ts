import { test, mock } from "node:test"
import assert from "node:assert/strict"
import { monkey } from "../src"

/**
 * Tests monkey() config merging and validation logic.
 * Verifies that the returned webpack Configuration has correct defaults
 * and that invalid inputs are rejected.
 */

test("throws when externals is not an object or function", () => {
  assert.throws(
    () => monkey({ externals: ["foo"] as any }),
    /externals.*must be an object or a function/,
  )

  assert.throws(
    () => monkey({ externals: "foo" as any }),
    /externals.*must be an object or a function/,
  )
})

test("accepts externals as an object", () => {
  const config = monkey({ externals: { jquery: "jQuery" } })
  assert.ok(config.externals) // should not throw
})

test("accepts externals as a function", () => {
  const config = monkey({ externals: () => {} })
  assert.ok(config.externals)
})

test("sets devServer.hot to 'only' by default", () => {
  const config = monkey({})
  assert.equal(config.devServer?.hot, "only")
})

test("sets output.filename to '[name].user.js'", () => {
  const config = monkey({})
  assert.equal(config.output?.filename, "[name].user.js")
})

test("preserves user entry and plugins", () => {
  const config = monkey({
    entry: "./src/index.ts",
    plugins: [],
  })
  assert.equal(config.entry, "./src/index.ts")
  // MonkeyPlugin is added
  assert.ok(config.plugins!.length >= 1)
})

test("warns when optimization.runtimeChunk is set", () => {
  const originalWarn = console.warn
  const warnings: string[] = []
  console.warn = (...args: any[]) => warnings.push(args.join(" "))

  try {
    monkey({ optimization: { runtimeChunk: "single" } })
    assert.ok(
      warnings.some((w) => w.includes("runtimeChunk")),
      "should warn about runtimeChunk being overwritten",
    )
  } finally {
    console.warn = originalWarn
  }
})

test("sets externalsType to 'var'", () => {
  const config = monkey({})
  assert.equal(config.externalsType, "var")
})

test("sets webSocketServer and webSocketTransport to 'sockjs'", () => {
  const config = monkey({})
  assert.equal(config.devServer?.webSocketServer, "sockjs")
  assert.equal((config.devServer?.client as any)?.webSocketTransport, "sockjs")
})
