import { create } from 'zustand'
import type { Task, TimerState, TimerPhase, CreateSessionInput } from '../types'
import { useAppStore } from './app.store'
import { useTaskStore } from './task.store'
import { localISOString } from '../lib/utils'

interface PomodoroStore extends TimerState {
  workerRef: Worker | null
  showOutcome: boolean

  startSession: (task: Task) => void
  startBreakSession: () => void
  pauseSession: () => void
  resumeSession: () => void
  stopSession: () => void
  completeSession: (outcome: 'done' | 'still-going' | 'blocked', blockNote?: string) => Promise<void>
  dismissOutcome: () => void
  tick: (remaining: number) => void
  setWorker: (worker: Worker | null) => void
}

function getWorkDuration(settings: ReturnType<typeof useAppStore.getState>['settings']): number {
  return parseInt(settings?.timer_work_minutes ?? '25', 10) * 60
}
function getShortBreakDuration(settings: ReturnType<typeof useAppStore.getState>['settings']): number {
  return parseInt(settings?.timer_short_break_minutes ?? '5', 10) * 60
}
function getLongBreakDuration(settings: ReturnType<typeof useAppStore.getState>['settings']): number {
  return parseInt(settings?.timer_long_break_minutes ?? '15', 10) * 60
}

const INITIAL_TIMER: TimerState = {
  isRunning: false,
  isPaused: false,
  phase: 'work',
  remaining: 25 * 60,
  totalDuration: 25 * 60,
  sessionCount: 0,
  activeTask: null,
  startedAt: null,
  endedAt: null
}

export const usePomodoroStore = create<PomodoroStore>((set, get) => ({
  ...INITIAL_TIMER,
  workerRef: null,
  showOutcome: false,

  setWorker: (worker) => set({ workerRef: worker }),

  tick: (remaining) => {
    set({ remaining })
    if (remaining <= 0) {
      const { workerRef, phase } = get()
      workerRef?.postMessage({ type: 'STOP' })
      if (phase === 'work') {
        // Work session ended — show outcome modal
        set({ isRunning: false, remaining: 0, endedAt: localISOString(), showOutcome: true })
        playTimerSound()
      } else {
        // Break ended — just reset, play sound
        set({ ...INITIAL_TIMER, showOutcome: false })
        playTimerSound()
      }
    }
  },

  startSession: (task) => {
    const settings = useAppStore.getState().settings
    const duration = getWorkDuration(settings)
    set({
      isRunning: true,
      isPaused: false,
      phase: 'work',
      remaining: duration,
      totalDuration: duration,
      activeTask: task,
      startedAt: localISOString()
    })
    const { workerRef } = get()
    workerRef?.postMessage({ type: 'START', duration })
  },

  startBreakSession: () => {
    const { phase, remaining, totalDuration, workerRef } = get()
    // Use the already-set phase and duration from completeSession
    set({
      isRunning: true,
      isPaused: false,
      activeTask: null,
      startedAt: localISOString()
    })
    workerRef?.postMessage({ type: 'START', duration: remaining })
  },

  pauseSession: () => {
    set({ isPaused: true, isRunning: false })
    get().workerRef?.postMessage({ type: 'PAUSE' })
  },

  resumeSession: () => {
    set({ isPaused: false, isRunning: true })
    const { remaining } = get()
    get().workerRef?.postMessage({ type: 'RESUME', remaining })
  },

  stopSession: () => {
    get().workerRef?.postMessage({ type: 'STOP' })
    set({ ...INITIAL_TIMER, showOutcome: false })
  },

  completeSession: async (outcome, blockNote) => {
    const { activeTask, startedAt, endedAt: storedEndedAt, totalDuration, phase } = get()
    if (!activeTask || !startedAt) return

    const settings = useAppStore.getState().settings
    const endedAt = storedEndedAt ?? localISOString()
    const durationMinutes = Math.round(totalDuration / 60)

    const input: CreateSessionInput = {
      task_id: activeTask.id,
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      outcome,
      block_note: blockNote
    }

    await window.api.createSession(input)

    // Refresh session counts, today stats, and streak
    useTaskStore.getState().loadSessionCounts()
    useTaskStore.getState().loadTodayStats()
    useTaskStore.getState().loadStreak()

    // Update task status based on outcome
    if (outcome === 'done') {
      await useTaskStore.getState().updateTask({ id: activeTask.id, status: 'done' })
    } else if (outcome === 'blocked') {
      await useTaskStore.getState().updateTask({ id: activeTask.id, status: 'blocked' })
    } else {
      await useTaskStore.getState().updateTask({ id: activeTask.id, status: 'in-progress' })
    }

    // Determine next phase
    const newCount = phase === 'work' ? get().sessionCount + 1 : get().sessionCount
    let nextPhase: TimerPhase = 'work'
    let nextDuration = getWorkDuration(settings)

    if (phase === 'work') {
      if (newCount % 4 === 0) {
        nextPhase = 'long-break'
        nextDuration = getLongBreakDuration(settings)
      } else {
        nextPhase = 'short-break'
        nextDuration = getShortBreakDuration(settings)
      }
    }

    set({
      isRunning: false,
      isPaused: false,
      phase: nextPhase,
      remaining: nextDuration,
      totalDuration: nextDuration,
      sessionCount: newCount,
      activeTask: null,
      startedAt: null,
      endedAt: null,
      // showOutcome stays true for break prompt
    })
  },

  dismissOutcome: () => {
    set({ showOutcome: false })
  }
}))

export type SoundName = 'chime' | 'bell' | 'pulse' | 'gong' | 'digital'

export const SOUND_OPTIONS: Array<{ value: SoundName; label: string }> = [
  { value: 'chime',   label: 'Chime' },
  { value: 'bell',    label: 'Bell' },
  { value: 'pulse',   label: 'Pulse' },
  { value: 'gong',    label: 'Gong' },
  { value: 'digital', label: 'Digital' },
]

export function playTimerSound(soundName?: SoundName): void {
  const settings = useAppStore.getState().settings
  if (settings?.sound_enabled !== 'true') return
  const volume = parseInt(settings?.sound_volume ?? '80', 10) / 100
  const sound = soundName ?? (settings?.sound_type as SoundName | undefined) ?? 'chime'
  try {
    const ctx = new AudioContext()
    const t = ctx.currentTime
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    switch (sound) {
      case 'chime': {
        const osc = ctx.createOscillator()
        osc.connect(gain)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(880, t)
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.3)
        gain.gain.setValueAtTime(volume * 0.4, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
        osc.start(t)
        osc.stop(t + 1.2)
        break
      }
      case 'bell': {
        for (const [freq, delay] of [[523, 0], [659, 0.15], [784, 0.3]] as const) {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.connect(g)
          g.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, t + delay)
          g.gain.setValueAtTime(volume * 0.3, t + delay)
          g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.8)
          osc.start(t + delay)
          osc.stop(t + delay + 0.8)
        }
        break
      }
      case 'pulse': {
        for (let i = 0; i < 3; i++) {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.connect(g)
          g.connect(ctx.destination)
          osc.type = 'square'
          osc.frequency.setValueAtTime(600, t + i * 0.2)
          g.gain.setValueAtTime(volume * 0.15, t + i * 0.2)
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.12)
          osc.start(t + i * 0.2)
          osc.stop(t + i * 0.2 + 0.12)
        }
        break
      }
      case 'gong': {
        const osc = ctx.createOscillator()
        osc.connect(gain)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(180, t)
        osc.frequency.exponentialRampToValueAtTime(120, t + 2)
        gain.gain.setValueAtTime(volume * 0.5, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.5)
        osc.start(t)
        osc.stop(t + 2.5)
        break
      }
      case 'digital': {
        for (let i = 0; i < 4; i++) {
          const osc = ctx.createOscillator()
          const g = ctx.createGain()
          osc.connect(g)
          g.connect(ctx.destination)
          osc.type = 'triangle'
          osc.frequency.setValueAtTime(1200, t + i * 0.12)
          g.gain.setValueAtTime(volume * 0.2, t + i * 0.12)
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.06)
          osc.start(t + i * 0.12)
          osc.stop(t + i * 0.12 + 0.06)
        }
        break
      }
    }
  } catch {
    // AudioContext not available
  }
}
