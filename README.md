# webpack-monkey

A webpack plugin for developing your userscripts with a modern workflow.

Focusing on support for [Tampermonkey](https://www.tampermonkey.net/) and [Violentmonkey](https://violentmonkey.github.io/).

Still in early development and only tested on Tampermonkey for now. Things may not work as expected.

## Features

- **HMR**: Easily apply changes without page reload.
- **CSP bypassing**: No worries about CSP restrictions during development.
- **Meta generation**: Automatically generate the userscript meta block.

The modern workflow also allows:

- **Compiling**: Use the latest JavaScript features and even TypeScript.
- **Bundling**: Bundle multiple files into a single userscript.

## Installation

**This package is not published to npm yet. The followings are just for early demonstration.**

```sh
npm install webpack-monkey
```

## Quick start

The final project structure at a glance:

```
.
├── dist
│   └── hello.user.js
├── src
│   ├── index.js
│   └── meta.js
├── webpack.config.js
└── package.json
```

### Setup

1. Create a new project directory and initialize it with the following commands:

```sh
npm init -y
npm install webpack webpack-cli webpack-monkey
```

2. Create `src/index.js`:

```js
GM_log("Hello world!")
```

3. Create `src/meta.js`:

```js
module.exports = {
  name: "Hello world",
  version: "1.0.0",
  match: ["*://example.com"],
}
```

4. Create `webpack.config.js`:

```js
const path = require("path")
const { monkeyWebpack } = require("webpack-monkey")

module.exports = monkeyWebpack()({
  entry: "./src/index.js",
  output: {
    filename: "hello.user.js",
    path: path.resolve(__dirname, "dist"),
  },
})
```

5. Add the following scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "webpack serve --mode development",
    "build": "webpack --mode production"
  }
}
```

### Development

Run `npm run dev`, a URL will be printed in the console like this:

```
[webpack-monkey] Start your development by installing the dev script: http://localhost:xxxx/monkey-dev.user.js
```

Now open the URL in your browser and install the dev script. Then go to `http://example.com` and open the console, you should see the message `Hello world!`.

Note: unless the dev server's _port_ has changed, you don't need to install the dev script again after re-running `npm run dev`.

### HMR

This one is optional. Edit `src/index.js` as follows:

```js
module.hot?.monkeyReload()

// or use the following if your environment doesn't support optional chaining
// if (module.hot) {
//   module.hot.monkeyReload()
// }

GM_log("Hello, world!")
```

If you've already opened the page, you need to reload the page because the HMR functionality is just added and not applied yet.

Now try to change the message in `GM_log`, you should see the message is updated without page reload.

### Build

Run `npm run build`, the final userscript will be generated at `dist/hello.user.js`.

The output will be like this:

```js
// ==UserScript==
// @name     Hello world
// @grant    GM_log
// @match    *://example.com
// @version  1.0.0
// ==/UserScript==

;(() => {
  "use strict"

  GM_log("Hello, world!")
})()
```

Note that the `GM_log` function is automatically added to `@grant`.

## Documentation

WIP. For now you can refer to the `examples` directory.
