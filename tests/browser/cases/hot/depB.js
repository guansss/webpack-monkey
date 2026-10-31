import "./depC"

const div = GM_addElement(document.body, "div", { class: "depB1" })

module.hot?.dispose(() => {
  div.remove()
})
