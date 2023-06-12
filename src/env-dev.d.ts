/// <reference types="webpack/module" />
/// <reference types="webpack-dev-server" />

declare const __PORT__: number
declare const __BROWSER_SUITE_TIMEOUT__: number

declare module globalThis {
  var __PUPPETEER_TIMEOUT__: number
}
