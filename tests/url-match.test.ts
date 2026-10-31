import { test } from "node:test"
import assert from "node:assert/strict"
import { urlMatch } from "../src/shared/utils"

/**
 * Tests urlMatch: determines whether a URL matches a userscript @match/@include pattern.
 * This is the core function that decides if a userscript runs on a given page.
 */

test("matches wildcard pattern *://*/*", () => {
  assert.ok(urlMatch("*://*/*", "https://example.com/page"))
  assert.ok(urlMatch("*://*/*", "http://foo.bar/anything"))
})

test("matches specific host pattern", () => {
  assert.ok(urlMatch("https://example.com/*", "https://example.com/page"))
  assert.ok(urlMatch("https://example.com/*", "https://example.com/"))
})

test("rejects non-matching URLs", () => {
  assert.ok(!urlMatch("https://example.com/*", "https://other.com/page"))
  assert.ok(!urlMatch("https://example.com/*", "http://example.com/page")) // wrong scheme
})

test("matches patterns with subdomain wildcard", () => {
  assert.ok(urlMatch("https://*.example.com/*", "https://sub.example.com/page"))
  assert.ok(urlMatch("https://*.example.com/*", "https://a.b.example.com/page"))
  // Per Chrome extension match pattern spec, *.example.com also matches example.com itself
  assert.ok(urlMatch("https://*.example.com/*", "https://example.com/page"))
})

test("matches patterns with specific path", () => {
  assert.ok(urlMatch("https://example.com/api/*", "https://example.com/api/users"))
  assert.ok(!urlMatch("https://example.com/api/*", "https://example.com/other"))
})

test("throws on invalid patterns", () => {
  assert.throws(() => urlMatch("not a valid pattern", "https://example.com"), /Invalid pattern/)
})

test("handles http and https schemes", () => {
  assert.ok(urlMatch("http://*/*", "http://example.com/page"))
  assert.ok(!urlMatch("http://*/*", "https://example.com/page"))
  assert.ok(urlMatch("https://*/*", "https://example.com/page"))
  assert.ok(!urlMatch("https://*/*", "http://example.com/page"))
})

test("matches URLs with port numbers", () => {
  assert.ok(urlMatch("*://*/*", "http://localhost:8080/page"))
  assert.ok(urlMatch("http://*/*", "http://localhost:8080/path"))
  assert.ok(urlMatch("*://localhost/*", "http://localhost:8080/page"))
})
