# CSS Example

Demonstrates CSS handling with webpack-monkey:

- **Global styles** (`styles.css`) — extracted by `mini-css-extract-plugin` and inlined via `GM_addStyle` in the production build
- **CSS Modules** (`styles.module.css`) — scoped class names with hashed identifiers

## Build

```bash
npm run build
```

The output `dist/main.user.js` will contain the CSS inlined as a `GM_addStyle(...)` call at the end of the script.
