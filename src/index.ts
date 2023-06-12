declare global {
  namespace webpack {
    interface Hot {
      monkeyReload(options?: import("./client/hmr").MonkeyReloadOptions): void
    }
  }
}

export * from "./node/monkey"
