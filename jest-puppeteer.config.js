const { availableExtensions } = require("./tests/extensions/available-extensions")

/** @type {import('jest-environment-puppeteer').JestPuppeteerConfig} */
module.exports = {
  launch: {
    dumpio: true,
    devtools: process.env.HEADLESS === "false",
    headless: process.env.HEADLESS !== "false" ? "new" : false,
    args: [
      ...availableExtensions().flatMap((dir) => [
        `--load-extension=${dir}`,
        `--disable-extensions-except=${dir}`,
      ]),
    ],
  },
}
