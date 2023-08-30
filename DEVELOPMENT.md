# Development Notes

This project uses workspaces to place the examples and requires npm version 7.x or higher.

## Setup

```sh
npm install

# download the browser extensions required for testing
npm run setup
```

## Playground

You'll be playing with the playground's userscripts during development.

1. Run:
   ```sh
   npm run playground
   ```
2. Open the dev script's URL printed in the console and install it as in the user guide.
3. Open the dev server's URL printed in the console, e.g. `http://localhost:8080`.
4. Now the playground userscripts are running on that page.

## Testing

```sh
# [headless] run all tests
npm run test

# [headless] run non-browser tests and update snapshots
npm run test:u

# [headless] run browser tests with Tampermonkey and Violentmonkey
npm run test:ext

# [headless] run browser tests with Tampermonkey
npm run test:tm

# [headless] run browser tests with Violentmonkey
npm run test:vm

# [GUI] run browser tests with Tampermonkey
npm run test:tm:h

# [GUI] run browser tests with Violentmonkey
npm run test:vm:h
```

To change the test server's port, set the `TEST_PORT` environment variable either in your shell or in the `.env` / `.env.local` file.

## Rebuilding examples

After making changes to the code, you can rebuild the examples to check if everything works as expected:

```sh
npm run build
npm run examples
```
