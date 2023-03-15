let colorette: any

try {
  colorette = require("colorette")
} catch (ignored) {}

export function colorize(color: string, text: string) {
  if (!colorette?.isColorSupported || typeof colorette?.[color] !== "function") {
    return text
  }

  return colorette[color]?.(text)
}
