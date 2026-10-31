import { test } from "node:test"
import assert from "node:assert/strict"
import { generateMetaBlock } from "../src/node/utils"

/**
 * Tests generateMetaBlock: the function that turns a meta object + source code
 * into a // ==UserScript== ... // ==/UserScript== header block.
 */

test("generates meta block with basic fields", () => {
  const meta = { name: "My Script", version: "1.0.0", match: "*://*/*" as string | string[] }
  const block = generateMetaBlock("console.log('hello')", meta)

  assert.ok(block.startsWith("// ==UserScript=="))
  assert.ok(block.endsWith("// ==/UserScript=="))
  assert.ok(block.includes("// @name"))
  assert.ok(block.includes("My Script"))
  assert.ok(block.includes("// @version"))
  assert.ok(block.includes("1.0.0"))
  assert.ok(block.includes("// @match"))
  assert.ok(block.includes("*://*/*"))
})

test("auto-detects @grant from source code", () => {
  const meta = { name: "Test", version: "1.0" }
  const source = `
    GM_log("hello")
    GM_addStyle(".foo { color: red }")
    GM_xmlhttpRequest({ url: "https://example.com" })
  `
  const block = generateMetaBlock(source, meta)

  assert.ok(block.includes("GM_log"), "should detect GM_log")
  assert.ok(block.includes("GM_addStyle"), "should detect GM_addStyle")
  assert.ok(block.includes("GM_xmlhttpRequest"), "should detect GM_xmlhttpRequest")
  assert.ok(!block.includes("GM_addElement"), "should not include unused GM APIs")
})

test("does not include grants for APIs not present in source", () => {
  const meta = { name: "Test", version: "1.0" }
  const source = "console.log('no GM calls')"
  const block = generateMetaBlock(source, meta)

  // @grant line should not appear if no GM APIs are used and no manual grants
  assert.ok(!block.includes("GM_"))
})

test("includes manual grants from meta even if not in source", () => {
  const meta = { name: "Test", version: "1.0", grant: "GM_setValue" as string | string[] }
  const source = "console.log('nothing')"
  const block = generateMetaBlock(source, meta)

  assert.ok(block.includes("GM_setValue"))
})

test("handles i18n fields", () => {
  const meta = {
    name: { default: "My Script", en: "My Script EN", fr: "Mon Script" },
    version: "1.0",
  }
  const block = generateMetaBlock("", meta)

  assert.ok(block.includes("// @name"), "should have default name")
  assert.ok(block.includes("My Script"))
  assert.ok(block.includes("// @name:en"), "should have English name")
  assert.ok(block.includes("My Script EN"))
  assert.ok(block.includes("// @name:fr"), "should have French name")
  assert.ok(block.includes("Mon Script"))
})

test("applies field aliases (runAt → run-at)", () => {
  const meta = { name: "Test", version: "1.0", runAt: "document-end" }
  const block = generateMetaBlock("", meta)

  assert.ok(block.includes("// @run-at"), "should use run-at alias")
  assert.ok(block.includes("document-end"))
  assert.ok(!block.includes("// @runAt"), "should not use camelCase field name")
})

test("handles multiple match patterns as array", () => {
  const meta = {
    name: "Test",
    version: "1.0",
    match: ["https://example.com/*", "https://other.com/*"],
  }
  const block = generateMetaBlock("", meta)

  assert.ok(block.includes("https://example.com/*"))
  assert.ok(block.includes("https://other.com/*"))
})

test("omits fields with nil values", () => {
  const meta = {
    name: "Test",
    version: "1.0",
    namespace: undefined as any,
    author: undefined as any,
  }
  const block = generateMetaBlock("", meta)

  assert.ok(!block.includes("// @namespace"))
  assert.ok(!block.includes("// @author"))
})
