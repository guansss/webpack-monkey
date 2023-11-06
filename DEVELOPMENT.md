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
# run tests with Tampermonkey and Violentmonkey
npm run test

# run tests and update snapshots
npm run test:u

# run tests with Tampermonkey
npm run test:tm

# run tests with Violentmonkey
npm run test:vm

# run tests with Tampermonkey in debug mode
npm run test:tm:h

# run tests with Tampermonkey in UI mode
npm run test:tm:ui
```

## Rebuilding examples

After making changes to the code, you can rebuild the examples to check if everything works as expected:

```sh
npm run build
npm run examples
```

## Syncing latest release version for examples (for maintainers)

```sh
npm run examples:remote
```
