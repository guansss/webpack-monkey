import mitt from "mitt"
import { overrideValue } from "../shared/patching"
import { MapValues } from "../types/utils"
import { WebpackModule, WebpackModuleId } from "../types/webpack"
import { log } from "./log"

type HotEventOf<T extends webpack.HotEvent["type"]> = HasType<OverrideIds<webpack.HotEvent>, T>
type HasType<T, U> = T extends { type: U } ? T : never

// override the module ID's type `number` with `WebpackModuleId` because it's more accurate
type OverrideIds<T extends webpack.HotEvent> = MapValues<
  T,
  [number, WebpackModuleId] | [number[], WebpackModuleId[]]
>

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

type HMREvents = {
  accepted: HotEventOf<"accepted">
}

const hmrEmitter = mitt<HMREvents>()

setupHMR()

export interface EnableHMROptions {
  ignore?: (string | RegExp)[]
  filter?(id: WebpackModuleId): boolean
}

export function enableHMR(_module: NodeModule, { ignore, filter }: EnableHMROptions = {}) {
  const rootModule = _module as unknown as WebpackModule

  if (!rootModule.hot) {
    throw new Error("HMR is not available")
  }

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

    const collectDescendantsToAffected = (mod?: WebpackModule) => {
      if (mod) {
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

function setupHMR() {
  ;(__webpack_require__ as any).hmrC["webpack-monkey"] = (
    chunkIds: unknown[],
    removedChunks: unknown[],
    removedModules: WebpackModuleId[],
    promises: Promise<unknown>[],
    applyHandlers: Function[],
    updatedModules: WebpackModuleId[]
  ) => {
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
}
