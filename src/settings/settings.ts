// import css from "./style.css?raw"
const css = ""
const html = String.raw

export class SettingsPanel extends HTMLElement {
  // make it non-null
  declare readonly shadowRoot: ShadowRoot

  constructor() {
    super()
    this.attachShadow({ mode: "open" })
    this.shadowRoot.innerHTML = html`
      <style>
        ${css}
      </style>
      <div class="settings">
        <div class="header">
          <div class="header-title">Settings</div>
          <button class="flat">X</button>
        </div>
        <div class="body"></div>
      </div>
    `
  }

  setupListeners() {}
}
