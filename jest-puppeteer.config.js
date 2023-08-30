const { getExtension } = require("./tests/extensions/extensions")

const extensions = []

try {
  extensions.push(getExtension(process.env.EXT).dir)
} catch (ignored) {}

/** @type {import('jest-environment-puppeteer').JestPuppeteerConfig} */
module.exports = {
  launch: {
    dumpio: true,
    devtools: process.env.HEADLESS === "false",
    headless: process.env.HEADLESS !== "false" ? "new" : false,
    args: [
      ...extensions.flatMap((dir) => [
        `--load-extension=${dir}`,
        `--disable-extensions-except=${dir}`,
      ]),
    ],
  },
}
