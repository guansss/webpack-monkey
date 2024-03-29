import mitt, { Emitter } from "mitt"
import { log } from "../log"

type GM_XHRShape = Pick<
  XMLHttpRequest,
  | "open"
  | "withCredentials"
  | "setRequestHeader"
  | "readyState"
  | "onreadystatechange"
  | "onload"
  | "send"
  | "timeout"
  | "ontimeout"
  | "abort"
  | "status"
  | "response"
  | "responseText"
>

type GM_XHREvents = {
  send: { params: GM_xmlhttpRequestParams }
  load: { response: GM_xmlhttpRequestResponse }
}

export interface GM_XHR extends Emitter<GM_XHREvents> {}

/**
 * Simulate the native XHR object using GM_xmlhttpRequest.
 * Note that this is not a complete implementation, it depends on the use cases.
 *
 * Current use cases:
 * - /dev/client/socket.ts
 */
export class GM_XHR implements GM_XHRShape {
  _params: GM_xmlhttpRequestParams = { url: "" }
  _response?: GM_xmlhttpRequestResponse

  // note: this is ignored
  withCredentials = false

  timeout: GM_XHRShape["timeout"] = 0
  ontimeout: GM_XHRShape["ontimeout"] = null
  onreadystatechange: GM_XHRShape["onreadystatechange"] = null
  onload: GM_XHRShape["onload"] = null

  get readyState(): GM_XHRShape["readyState"] {
    return this._response?.readyState ?? 0
  }

  get status(): GM_XHRShape["status"] {
    return this._response?.status ?? 0
  }

  get response(): GM_XHRShape["response"] {
    return this._response?.response ?? ""
  }

  get responseText(): GM_XHRShape["responseText"] {
    return this._response?.responseText ?? ""
  }

  constructor() {
    Object.assign(this, mitt())
  }

  open(method: string, url: string | URL) {
    // the "async" argument
    if (arguments[2] === false) {
      throw new Error("Synchronous XHR is not supported")
    }

    this._params.method = method as any
    this._params.url = url.toString()
  }

  setRequestHeader(name: string, value: string) {
    ;(this._params.headers ||= {})[name] = value
  }

  send(data?: any) {
    const params = this._params

    // maybe we should validate its type?
    params.data = data

    params.onreadystatechange = (resp) => {
      this._response = resp

      this.warnIfHasArguments("onreadystatechange")
      ;(this.onreadystatechange as Function)?.call(this)
    }

    params.ontimeout = () => {
      this.warnIfHasArguments("ontimeout")
      ;(this.ontimeout as Function)?.call(this)
    }

    params.onload = (resp) => {
      this.emit("load", { response: resp })
      this.warnIfHasArguments("onload")
      ;(this.onload as Function)?.call(this)
    }

    this.emit("send", { params })

    const { abort } = GM_xmlhttpRequest(params)

    this.abort = abort
  }

  abort = () => {}

  warnIfHasArguments(name: keyof this & string) {
    if ((this[name] as Function)?.length) {
      log(`warning: ${name} with arguments is not supported and may cause errors.`)
    }
  }
}
