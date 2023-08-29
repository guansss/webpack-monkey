declare function GM_log(message: string): void

GM_log("Hello, world!")

if (module.hot) {
  module.hot.monkeyReload()
}
