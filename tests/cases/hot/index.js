import "./depA"
import "./depB"

const div = GM_addElement(document.body, "div", { class: "index1" })

module.hot?.monkeyReload()
module.hot?.dispose(() => {
  div.remove()
})
