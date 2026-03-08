import { useEffect, useState, useRef } from 'react'
import { Flame, Trophy, TrendingUp } from 'lucide-react'
import type { StreakDetail } from '@/types'

interface StreakPopoverProps {
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
}

export default function StreakPopover({ anchorRef, onClose }: StreakPopoverProps) {
  const [detail, setDetail] = useState<StreakDetail | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.getStreakDetail().then(setDetail).catch(() => {})
  }, [])

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!detail) return null

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-0 mb-2 w-56 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-elevated z-50 p-3"
    >
      {/* Current & best streak */}
      <div className="flex gap-3 mb-3">
        <div className="flex-1 rounded-md bg-[var(--bg-elevated)] px-2.5 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Flame size={12} className="text-amber-400" />
            <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums leading-none">{detail.current}</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">Current</p>
        </div>
        <div className="flex-1 rounded-md bg-[var(--bg-elevated)] px-2.5 py-2 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Trophy size={12} className="text-amber-400" />
            <span className="text-lg font-bold text-[var(--text-primary)] tabular-nums leading-none">{detail.best}</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">Best</p>
        </div>
      </div>

      {/* 14-day dot grid */}
      <div>
        <div className="flex items-center gap-1 mb-1.5">
          <TrendingUp size={11} className="text-[var(--text-muted)]" />
          <p className="text-[10px] font-medium text-[var(--text-muted)]">Last 14 days</p>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {/* Day-of-week headers */}
          {dayLabels.map((label, i) => (
            <div key={`h-${i}`} className="text-[9px] text-[var(--text-muted)] text-center leading-none pb-0.5">
              {label}
            </div>
          ))}

          {/* Pad first row to align with day-of-week */}
          {(() => {
            if (detail.recentDays.length === 0) return null
            const firstDate = new Date(detail.recentDays[0].date + 'T00:00:00')
            const dayOfWeek = firstDate.getDay() // 0 = Sunday
            const pads = []
            for (let i = 0; i < dayOfWeek; i++) {
              pads.push(<div key={`pad-${i}`} />)
            }
            return pads
          })()}

          {/* Day dots */}
          {detail.recentDays.map(({ date, active }) => {
            const d = new Date(date + 'T00:00:00')
            const label = `${d.getMonth() + 1}/${d.getDate()}`
            return (
              <div key={date} className="flex justify-center" title={label}>
                <div
                  className={`w-4 h-4 rounded-sm ${
                    active
                      ? 'bg-amber-400/80'
                      : 'bg-[var(--bg-base)] border border-[var(--border)]'
                  }`}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
