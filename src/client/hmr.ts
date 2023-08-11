import mitt from "mitt"
import { overrideValue } from "../shared/patching"
import { MapValues } from "../types/utils"
import { WebpackModule, WebpackModuleId } from "../types/webpack"
import { log } from "./log"

type HotEventOf<T extends webpack.HotEvent["type"]> = FilterByType<OverrideIds<webpack.HotEvent>, T>
type FilterByType<T, U> = T extends { type: U } ? T : never

// override the module ID's type `number` with `WebpackModuleId` because it's more accurate
type OverrideIds<T extends webpack.HotEvent> = MapValues<
  T,
  [number, WebpackModuleId] | [number[], WebpackModuleId[]]
>

type HMREvents = {
  accepted: HotEventOf<"accepted">
}

export interface MonkeyReloadOptions {
  ignore?: (string | RegExp)[]
  filter?(id: WebpackModuleId): boolean
}

const hmrEmitter = mitt<HMREvents>()

;(__webpack_require__ as any).hmrC["webpack-monkey"] = monkeyDownloadUpdateHandler
;(__webpack_require__ as any).i.push(monkeyModuleInterceptor)

function monkeyModuleInterceptor(options: { module: WebpackModule }) {
  if (!options?.module?.hot) {
    console.warn("module.hot is not available")
    return
  }

  options.module.hot.monkeyReload = (opt) => monkeyReload(options.module, opt)
}

export function monkeyReload(
  rootModule: WebpackModule,
  { ignore, filter }: MonkeyReloadOptions = {}
) {
  if (!ignore) {
    ignore = ["node_modules"]
  }

  if (!filter) {
    filter = (id) => {
      const idStr = String(id)

      return !ignore!.some((pattern) => {
        if (typeof pattern === "string") {
          return idStr.includes(pattern)
        }

        return pattern.test(idStr)
      })
    }
  }

  const getModuleFromCache = (id: WebpackModuleId) => require.cache[id] as WebpackModule | undefined

  const onAccepted = ({ outdatedModules }: HMREvents["accepted"]) => {
    if (!outdatedModules.includes(rootModule.id)) {
      return
    }

    const visited = new Set<WebpackModule>()

    const collectDescendantsToAffected = (mod?: WebpackModule) => {
      if (mod) {
        if (visited.has(mod)) {
          return
        }

        visited.add(mod)

        const alreadyIncluded = outdatedModules.includes(mod.id)

        if (!alreadyIncluded && filter!(mod.id)) {
          outdatedModules.push(mod.id)
        }

        mod.children?.forEach((id) => collectDescendantsToAffected(getModuleFromCache(id)))
      }
    }

    collectDescendantsToAffected(rootModule)

    log("HMR all:", outdatedModules)
  }

  hmrEmitter.on("accepted", onAccepted)

  rootModule.hot.accept()
  rootModule.hot.dispose(() => {
    hmrEmitter.off("accepted", onAccepted)
  })
}

function monkeyDownloadUpdateHandler(
  chunkIds: unknown[],
  removedChunks: unknown[],
  removedModules: WebpackModuleId[],
  promises: Promise<unknown>[],
  applyHandlers: Function[],
  updatedModules: WebpackModuleId[]
) {
  // the definition of webpack.ApplyOptions is wrong, we make a correct one here
  interface ApplyOptions {
    ignoreUnaccepted?: boolean
    ignoreDeclined?: boolean
    ignoreErrored?: boolean
    onDeclined?(info: webpack.HotEvent): void
    onUnaccepted?(info: webpack.HotEvent): void
    onAccepted?(info: webpack.HotEvent): void
    onDisposed?(info: webpack.HotEvent): void
    onErrored?(info: webpack.HotEvent): void
  }

  // insert the handler at the beginning of the array
  // because we will modify the options
  applyHandlers.unshift((options: ApplyOptions) => {
    if (options) {
      overrideValue(options, "onAccepted", (originalFn) => {
        return (event) => {
          if (event.type === "accepted") {
            hmrEmitter.emit("accepted", event)
          }

          originalFn?.(event)
        }
      })
    }

    // this return is required
    return {
      dispose: () => {},
      apply: () => {},
    }
  })
}
