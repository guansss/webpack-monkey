export class PortReceiver {
  port?: number
  set!: (port: number) => void

  private timerId?: NodeJS.Timeout
  private promise: Promise<number>

  constructor() {
    this.promise = new Promise<number>((resolve) => {
      this.set = (port) => {
        if (this.port === undefined) {
          this.port = port
          resolve(port)
        } else {
          throw new Error("Port already set to " + this.port)
        }
      }
    })
  }

  waitOrSetDefault(timeout: number, getDefault: () => number) {
    if (this.timerId || this.port !== undefined) {
      return
    }

    this.timerId = setTimeout(() => {
      if (this.timerId) {
        clearTimeout(this.timerId)
        this.timerId = undefined
      }
      if (this.port === undefined) {
        this.set(getDefault())
      }
    }, timeout)
  }

  get() {
    return this.promise
  }

  cancelWait() {
    if (this.timerId) {
      clearTimeout(this.timerId)
    }
  }
}
