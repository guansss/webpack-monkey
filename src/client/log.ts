let log: typeof console.log

setLogger(console.log)

export function setLogger(logger: typeof console.log) {
  log = logger.bind(console, `[${GM_info.script.name}]`)
}

export function tag(text: string, color: string) {
  return [`%c${text}`, `background: ${color}; color: white; padding: 2px 4px;`]
}

export { log }
