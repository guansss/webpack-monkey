# Note

This directory will be built into both CommonJS modules (for node) and ES modules (for client).

When writing code in this directory, make sure it is compatible in both environments, and does not break the tree-shaking.

For example, if you import a CommonJS module into an ES module, the whole CommonJS module will be emitted into the user's bundle if the user intentionally/unintentionally imports this ES module.
