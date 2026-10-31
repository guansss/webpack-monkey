module.exports = {
  name: "Basic browser test",
  version: "1.0.0",
  match: ["*://*/*"],
  runAt: "document-end",
  "inject-into": "content",
}
