import { PortReceiver } from "../src/node/PortReceiver"

beforeEach(() => {
  jest.useFakeTimers()
})

it("sets default port after timeout", async () => {
  const port = new PortReceiver()
  port.waitOrSetDefault(1000, () => 3000)
  jest.runAllTimers()
  await expect(port.get()).resolves.toBe(3000)
})

it("does not set default port if port is already set", async () => {
  const port = new PortReceiver()
  port.set(4000)
  port.waitOrSetDefault(1000, () => 3000)
  expect(jest.getTimerCount()).toBe(0)
  await expect(port.get()).resolves.toBe(4000)
})

it("waitOrSetDefault does not set default port if cancelWait is called", async () => {
  const port = new PortReceiver()
  port.waitOrSetDefault(1000, () => 3000)
  port.cancelWait()
  expect(jest.getTimerCount()).toBe(0)
})
