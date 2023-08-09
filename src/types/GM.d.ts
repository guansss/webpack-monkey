// https://www.tampermonkey.net/documentation.php

declare const unsafeWindow: Window

declare function GM_setValue(name: string, value: any): void

declare function GM_getValue<T>(name: string, defaultValue?: T): T

declare function GM_addStyle(css: string): HTMLStyleElement

declare function GM_getResourceText(name: string): string

declare function GM_registerMenuCommand(
  name: string,
  fn: (e: MouseEvent | KeyboardEvent) => void,
  accessKey?: string
): number

declare function GM_unregisterMenuCommand(menuCmdId: number): void

declare const GM_info: {
  script: {
    name: string
    version: string
  }
  downloadMode: "native" | "browser" | "disabled"
}

declare function GM_download(details: {
  url: string
  name?: string
  headers?: any
  saveAs?: boolean
  onerror?(e: {
    error: "not_enabled" | "not_forceLoaded" | "not_permitted" | "not_supported" | "not_succeeded"
    details: { current?: string }
  }): void
  onload?(): void
  onprogress?(): void
  ontimeout?(): void
}): {
  abort(): void
}

declare interface GM_xmlhttpRequestParams {
  // one of GET, HEAD, POST
  method?: string

  // the destination URL
  url: string

  // ie. user-agent, referer, ... (some special headers are not supported by Safari and Android browsers)
  headers?: Record<string, string>

  // some string to send via a POST request
  data?: string

  // a cookie to be patched into the sent cookie set
  cookie?: string

  // send the data string in binary mode
  binary?: string

  // don't cache the resource
  nocache?: boolean

  // revalidate maybe cached content
  revalidate?: boolean

  // a timeout in ms
  timeout?: number

  // a property which will be added to the response object
  context?: any

  // one of arraybuffer, blob, json, stream
  responseType?: "arraybuffer" | "blob" | "json" | "stream" | "text"

  // a MIME type for the request
  overrideMimeType?: string

  // don't send cookies with the requests (please see the fetch notes)
  anonymous?: boolean

  // (beta) use a fetch instead of a xhr request (at Chrome this causes xhr.abort, details.timeout and xhr.onprogress to not work and makes xhr.onreadystatechange receive only readyState 4 events)
  fetch?: boolean

  // a username for authentication
  username?: string

  // a password
  password?: string

  // callback to be executed if the request was aborted
  onabort?(): void

  // callback to be executed if the request ended up with an error
  onerror?(): void

  // callback to be executed if the request started to load
  onloadstart?(): void

  // callback to be executed if the request made some progress
  onprogress?(): void

  // callback to be executed if the request's ready state changed
  onreadystatechange?(response: GM_xmlhttpRequestResponse): void

  // callback to be executed if the request failed due to a timeout
  ontimeout?(): void

  // callback to be executed if the request was loaded.
  onload?(response: GM_xmlhttpRequestResponse): void
}

declare interface GM_xmlhttpRequestResponse {
  // the final URL after all redirects from where the data was loaded
  finalUrl: string

  // the ready state
  readyState: number

  // the request status
  status: number

  // the request status text
  statusText: string

  // the request response headers
  responseHeaders: string

  // the response data as object if details.responseType was set
  response: any

  // the response data as XML document
  responseXML: any

  // the response data as plain string
  responseText: string
}

declare function GM_xmlhttpRequest(details: GM_xmlhttpRequestParams): {
  abort(): void
}

declare function GM_addElement<K extends keyof HTMLElementTagNameMap>(
  tag_name: K,
  attributes: Record<string, string>
): HTMLElementTagNameMap[K]

declare function GM_addElement<K extends keyof HTMLElementTagNameMap>(
  parent_node: HTMLElement,
  tag_name: K,
  attributes: Record<string, string>
): HTMLElementTagNameMap[K]
