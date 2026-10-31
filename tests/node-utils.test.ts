import { test } from "node:test"
import assert from "node:assert/strict"
import { resolveUrlExternal } from "../src/node/utils"

/**
 * Tests the URL external resolution logic.
 * resolveUrlExternal parses strings like "var foo@https://..." into structured external definitions
 * used to generate @require headers and webpack externals config.
 */
test("resolves URL externals to valid external values", () => {
  const r1 = resolveUrlExternal("var foo@https://example.com")
  assert.equal(r1?.type, "var")
  assert.equal(r1?.identifier, "foo")
  assert.equal(r1?.url, "https://example.com")
  assert.equal(r1?.value, "var foo")

  const r2 = resolveUrlExternal("foo@https://example.com")
  assert.equal(r2?.type, undefined)
  assert.equal(r2?.identifier, "foo")
  assert.equal(r2?.url, "https://example.com")
  assert.equal(r2?.value, "foo")

  const r3 = resolveUrlExternal("https://example.com")
  assert.equal(r3?.type, undefined)
  assert.equal(r3?.identifier, undefined)
  assert.equal(r3?.url, "https://example.com")
  assert.equal(r3?.value, '"https://example.com"')

  const r4 = resolveUrlExternal("foo")
  assert.equal(r4, undefined)
})

test("resolves URL externals with port numbers", () => {
  const r1 = resolveUrlExternal("var lib@http://localhost:8080/lib.js")
  assert.equal(r1?.type, "var")
  assert.equal(r1?.identifier, "lib")
  assert.equal(r1?.url, "http://localhost:8080/lib.js")
  assert.equal(r1?.value, "var lib")

  const r2 = resolveUrlExternal("https://cdn.example.com:8443/bundle.js")
  assert.equal(r2?.type, undefined)
  assert.equal(r2?.identifier, undefined)
  assert.equal(r2?.url, "https://cdn.example.com:8443/bundle.js")
})
