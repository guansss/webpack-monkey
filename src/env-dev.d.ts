/// <reference types="webpack/module" />
/// <reference types="webpack-dev-server" />

declare const __EXT__: string
declare const __PORT__: number
declare const __BROWSER_CASE_TIMEOUT__: number

declare module globalThis {
  var __PUPPETEER_TIMEOUT__: number
}
