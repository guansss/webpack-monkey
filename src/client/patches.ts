// @ts-ignore
import SockJS from "webpack-dev-server/client/modules/sockjs-client"
import { isPatched, markAsPatched } from "../shared/patching"
import { parentUntil } from "../shared/utils"

import { GM_fetch } from "./counterfeits/fetch"
import { GM_XHR } from "./counterfeits/xhr"
import { enableHMR } from "./hmr"
import { log } from "./log"

enableHMR(module)

patchHMR()
patchLoadScript()
patchSockJS()

function patchHMR() {
  if (isPatched(__webpack_require__)) {
    return
  }

  markAsPatched(__webpack_require__)

  const hmrM = (__webpack_require__ as any).hmrM

  ;(__webpack_require__ as any).hmrM = () => {
    const originalFetch = window.fetch

    window.fetch = GM_fetch
    const result = hmrM()
    window.fetch = originalFetch

    return result
  }
}

function patchLoadScript() {
  const inProgress: Record<string, ((event: unknown) => void)[]> = {}

  ;(__webpack_require__ as any).l = (url: string, done: (event: unknown) => void, key: string) => {
    if (inProgress[url]) {
      inProgress[url]!.push(done)
      return
    }

    inProgress[url] = [done]

    GM_fetch(url)
      .then((res) => res.text())
      .then((code) => {
        eval(code)

        const doneFns = inProgress[url]
        delete inProgress[url]
        doneFns &&
          doneFns.forEach((fn) =>
            fn({
              type: "--- [Webpack monkey] unexpected error, looks like the hot update script is not being loaded, please report this. ---",
            })
          )
      })
  }
}

function patchSockJS() {
  if (isPatched(SockJS.prototype)) {
    return
  }

  markAsPatched(SockJS.prototype)

  Object.defineProperty(SockJS.prototype, "_transports", {
    set(v: any[]) {
      // since we'll be using XHR, only xhr-polling is supported
      // (maybe also xhr-streaming, but it froze the browser at my first attempt, so don't bother)
      this.__transports = v.filter((trans) => trans.transportName === "xhr-polling")
    },
    get() {
      return this.__transports
    },
  })

  // through EventTarget we can reach AbstractXHRObject.prototype
  // because many classes inherit from EventTarget, including SockJS and AbstractXHRObject
  const EventTarget = Object.getPrototypeOf(SockJS.prototype).constructor

  if (EventTarget?.name !== "EventTarget") {
    log("EventTarget not found")
    return
  }

  // this method is called when the derived classes are instantiated
  EventTarget.call = function (instance: any) {
    Function.call.call(EventTarget, instance)

    if (isPatched(instance)) {
      return
    }

    const AbstractXHRObject_prototype = parentUntil(
      instance,
      (obj) => Object.getPrototypeOf(obj),
      (obj) => obj?.constructor?.name === "AbstractXHRObject"
    )

    if (!AbstractXHRObject_prototype) {
      return
    }

    markAsPatched(AbstractXHRObject_prototype)

    Object.defineProperty(AbstractXHRObject_prototype, "xhr", {
      // triggered at `this.xhr = new XMLHttpRequest()`,
      // we simply replace the XHR with our own implementation
      set(_) {
        const xhr = new GM_XHR()

        xhr.on("send", ({ params }) => {
          const url = new URL(params.url)

          // webpack checks the origin and host for security reasons,
          // we need to fake them to pretend the request is from the same origin
          params.headers = {
            ...params.headers,
            Origin: url.origin,
            Host: url.host,
          }
        })

        this.__xhr = xhr
      },
      get() {
        return this.__xhr
      },
    })
  }
}
