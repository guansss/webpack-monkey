import "./styles.css"

// intentionally uses plain DOM APIs so that the test only depends on the CSS pipeline
const div = document.createElement("div")
div.className = "css-ready"
document.body.appendChild(div)
