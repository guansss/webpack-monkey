import "./depB"

const div = GM_addElement(document.body, "div", { class: "depC1" })

module.hot?.dispose(() => {
  div.remove()
})
