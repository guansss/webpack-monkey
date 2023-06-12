const div = GM_addElement(document.body, "div", { class: "depA1" })

module.hot?.dispose(() => {
  div.remove()
})

export {}
