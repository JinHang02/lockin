// Web Worker for accurate timer — uses wall-clock Date.now() to prevent drift

let intervalId: ReturnType<typeof setInterval> | null = null
let targetEnd = 0
let remaining = 0
let lastPosted = -1 // Track last posted value to avoid redundant messages

function tick() {
  const now = Math.max(0, Math.round((targetEnd - Date.now()) / 1000))
  if (now !== lastPosted) {
    lastPosted = now
    remaining = now
    self.postMessage({ type: 'TICK', remaining: now })
  }
  if (now <= 0) {
    clearInterval(intervalId!)
    intervalId = null
  }
}

self.onmessage = (e: MessageEvent) => {
  const { type, duration } = e.data

  switch (type) {
    case 'START':
      if (intervalId) clearInterval(intervalId)
      remaining = duration
      lastPosted = -1
      targetEnd = Date.now() + duration * 1000
      intervalId = setInterval(tick, 250)
      break

    case 'PAUSE':
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      remaining = Math.max(0, Math.round((targetEnd - Date.now()) / 1000))
      break

    case 'RESUME':
      if (e.data.remaining !== undefined) remaining = e.data.remaining
      targetEnd = Date.now() + remaining * 1000
      lastPosted = -1
      if (intervalId) clearInterval(intervalId)
      intervalId = setInterval(tick, 250)
      break

    case 'STOP':
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      remaining = 0
      targetEnd = 0
      lastPosted = -1
      break
  }
}
