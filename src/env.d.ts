declare namespace webpack {
  interface Hot {
    monkeyReload(options?: import("./client/hmr").MonkeyReloadOptions): void
  }
}
