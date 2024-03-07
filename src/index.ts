import EventEmitter from 'eventemitter3'

const console = self.console

/**
 * Hook into the console api to provide custom functionality.
 * @param con
 * @returns
 */
export default function SimplyConsole(con: Console = console) {
  const events = new EventEmitter<EventMethods>()

  const handleError = (e: ErrorEvent) => events.emit('error', e.error)
  const handleUnhandledRejection = (e: PromiseRejectionEvent) =>
    events.emit('error', e.reason)

  const simplyConsole = {
    on(name, fn) {
      events.on(name, fn)
    },
    off(name, fn) {
      events.off(name, fn)
    },
    cleanup() {
      events.removeAllListeners()
      self.removeEventListener('error', handleError)
      self.removeEventListener('unhandledrejection', handleUnhandledRejection)
      return con
    },
  } as ISimplyConsole

  for (const key of Object.keys(con) as EventName[]) {
    if (!con.hasOwnProperty(key) || simplyConsole.hasOwnProperty(key)) continue
    if (typeof con[key] === 'function') {
      // @ts-ignore
      const builtIn = con[key].bind(con)
      // @ts-ignore
      simplyConsole[key] = function (...args: any[]) {
        builtIn(...args)
        if (isCyclic()) return
        events.emit(key, ...args)
      }
    } else {
      Object.defineProperty(simplyConsole, key, {
        get() {
          return con[key]
        },
        set(v) {
          con[key] = v
        },
      })
    }
  }

  // ! Errors are logged to the console internally and therefore don't use console.error to log them, but we still want to emit them
  self.addEventListener('error', handleError, EventOptions)
  self.addEventListener(
    'unhandledrejection',
    handleUnhandledRejection,
    EventOptions
  )

  return simplyConsole
}

const EventOptions = { capture: true }

type EventName = {
  [K in keyof Console]: Console[K] extends Function ? K : never
}[keyof Console]
type EventMethods = { [K in EventName]: Console[K] }

export interface ISimplyConsole extends Console {
  on<T extends EventEmitter.EventNames<EventMethods>>(
    event: T,
    fn: EventEmitter.EventListener<EventMethods, T>
  ): void
  off<T extends EventEmitter.EventNames<EventMethods>>(
    event: T,
    fn?: EventEmitter.EventListener<EventMethods, T>
  ): void
  cleanup(): Console
}

function isCyclic() {
  const stackTrace = new Error().stack
  if (!stackTrace) return false
  const regex = /at\s(.+)\s\(/g
  let match = regex.exec(stackTrace)
  let callerFn
  while ((match = regex.exec(stackTrace)) !== null)
    if (!callerFn) callerFn = match[1]
    else if (callerFn === match[1]) return true
  return false
}
