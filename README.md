# webpack-monkey

A webpack plugin for developing your userscripts with a modern workflow.

Focusing on support for [Tampermonkey](https://www.tampermonkey.net/) and [Violentmonkey](https://violentmonkey.github.io/).

Still in early development and only tested on Tampermonkey for now. Things may not work as expected.

## Features

- **HMR (Hot Module Replacement)**: Easily apply changes without page reload.
- **CSP bypassing**: No worries about CSP restrictions during development.
- **Meta generation**: Automatically generate the userscript meta block.

The modern workflow also allows:

- **Compiling**: Use the latest JavaScript features and even TypeScript.
- **Bundling**: Bundle multiple files into a single userscript.

## Installation

```sh
npm install webpack-monkey

# peer dependencies
npm install webpack webpack-dev-server
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

1. Create a new project and initialize it with npm:

```sh
npm init -y
npm install webpack webpack-cli webpack-dev-server webpack-monkey
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
const { monkey } = require("webpack-monkey")

module.exports = monkey({
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
[MonkeyPlugin] Dev script hosted at: http://localhost:xxxx/monkey-dev.user.js
```

Now open the URL in your browser and install the dev script. Then go to `http://example.com` and open the console, you should see the message `Hello world!`.

Note: unless the dev server's _port_ has changed, you don't need to install the dev script again after running `npm run dev` next time.

### HMR

This one is optional. Edit `src/index.js` and add the following code:

```js
if (module.hot) {
  module.hot.monkeyReload()
}
```

If you've already opened the page, you need to reload the page because the HMR functionality is just added and not applied yet.

Now try to change the message text in `GM_log`, and you'll see the new message printed in the console without page reload.

### Build

Run `npm run build`, and the final userscript will be generated at `dist/hello.user.js`.

The output will be like this:

```js
// ==UserScript==
// @name     Hello world
// @grant    GM_log
// @match    *://example.com
// @version  1.0.0
// ==/UserScript==

;(() => {
  GM_log("Hello, world!")
})()
```

Note that the `GM_log` function is automatically added to `@grant`.

## API / Configuration

### `monkey(config)`

Takes a webpack config object and returns a new config object with plugins added and some options modified.

The followings are some major changes to the original config, for more details please check [the source code](src/node/monkey.ts).

- Adds some sensible defaults for userscript development.
- Adds `MonkeyPlugin` to the plugins list.
- Replaces the default `TerserPlugin` (minimizer) with `MonkeyMinimizer`, which extends `TerserPlugin` with some extra features.

### Options

The options are passed as the `monkey` property of the webpack config object:

```js
monkey({
  // normal webpack options
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
  },

  // monkey options
  monkey: {
    debug: true,
  },
})
```

Some function options are passed with a context object, which has the same structure:

```ts
interface OptionFunctionContext {
  logger: WebpackLogger | Console
}
```

#### `debug`

Type: `boolean`\
Default: `false`

When enabled, some debug messages will be printed in the console (just a few for now).

#### `meta.resolve`

Type: `string | string[] | function`

Default: `["meta.ts", "meta.js", "meta.json"]`

The path of meta file to be used for generating the userscript meta block. The first file that matches will be used.

You can pass a function to return the path dynamically:

<!-- prettier-ignore -->
```ts
type MetaResolver = (arg: { entryName: string; entry: string }, context: object) => string | undefined | Promise<string | undefined>

meta.resolve = ({ entry }, context) => {
  return path.resolve(path.dirname(entry), "meta.js")
}
```

#### `meta.load`

Type: `(arg: { file: string }, context) => UserscriptMeta | Promise<UserscriptMeta>`\
Default: `require()`

Function to load the meta file and return the meta object. The default function uses `require()` to load the meta file with supported extensions: `.js`, `.ts`, `.json`.

#### `meta.transform`

Type: `(arg: { meta: UserscriptMeta }, context) => UserscriptMeta | Promise<UserscriptMeta>`\
Default: `undefined`

Function to transform the meta object before using it for serving or building. Can be used to add or modify meta properties.

#### `require`

Type: `"jsdelivr" | "unpkg" | object | function`\
Default: `"unpkg"`

Defines the way to generate the `@require` directives for external dependencies. Handling external dependencies is a bit tricky, please read the [External dependencies](#external-dependencies) section for more details.

#### `devScript.meta`

Type: `UserscriptMeta | ((arg: { meta: UserscriptMeta }) => UserscriptMeta)`\
Default: `undefined`

The meta object to be used for the dev script. If an object, it will be merged with the default meta object; if a function, it will be called with the default meta object as the argument, and the returned object will be used as a replacement.

#### `devScript.transform`

Type: `(arg: { content: string }, context) => string`\
Default: `undefined`

Function to transform the dev script content before serving. Can be used to add or modify the script content.

## External dependencies

TODO
