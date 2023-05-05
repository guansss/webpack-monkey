let log: typeof console.log = (...args: any[]) => {
  if (!log) {
    setLogger(console.log)
  }

  log(...args)
}

export function setLogger(logger: typeof console.log) {
  let tagName = GM_info.script.name

  try {
    if (window.top && window.top !== window.self) {
      let number: number | string = "?"

      if (window.top === window.parent && window.parent.document) {
        const index = Array.from(window.parent.document?.getElementsByTagName("iframe")).indexOf(
          window.frameElement as any
        )

        if (index >= 0) {
          number = index + 1
        }
      }

      tagName = `iframe${number ? `#${number}` : ""}: ${tagName}`
    }
  } catch (ignored) {}

  log = logger.bind(console, `[${tagName}]`)
}

export function tag(text: string, color: string) {
  return [`%c${text}`, `background: ${color}; color: white; padding: 2px 4px;`]
}

export { log }
