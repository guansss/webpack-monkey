// @ts-nocheck
const tsPreset = require("ts-jest/presets/default/jest-preset")
const puppeteerPreset = require("jest-puppeteer/jest-preset")

// combine ts-jest and jest-puppeteer
// https://github.com/argos-ci/jest-puppeteer/issues/364#issuecomment-671843215
module.exports = {
  ...tsPreset,
  ...puppeteerPreset,
}
