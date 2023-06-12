/// <reference types="webpack/module" />
/// <reference types="webpack-dev-server" />

declare const __PORT__: number
declare const __BROWSER_SUITE_TIMEOUT__: number

declare module globalThis {
  var __PUPPETEER_TIMEOUT__: number
}

declare namespace jest {
  interface It {
    /**
     * When the test fails in headful mode, the Puppeteer browser will keep open until
     * you close it manually. This is useful for debugging.
     */
    browser: It
  }
}
