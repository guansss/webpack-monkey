import "./depA"
import "./depB"
import "./styles.css"

const div = GM_addElement(document.body, "div", { class: "index1" })

module.hot?.monkeyReload()
module.hot?.dispose(() => {
  div.remove()
})

console.log("index finished")
