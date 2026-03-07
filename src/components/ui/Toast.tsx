import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { useToastStore } from '@/store/toast.store'
import { cn } from '@/lib/utils'

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const COLORS = {
  success: 'text-emerald-500',
  error: 'text-red-400',
  info: 'text-accent-400',
}

export default function ToastContainer() {
  const { toasts, dismissToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-lg shadow-elevated',
              'bg-[var(--bg-surface)] border border-[var(--border)]',
              'min-w-[240px] max-w-[360px]',
              toast.dismissing ? 'animate-slide-down-out' : 'animate-slide-up'
            )}
          >
            <Icon size={15} className={cn('flex-shrink-0', COLORS[toast.type])} aria-hidden="true" />
            <span className="text-sm text-[var(--text-primary)] flex-1">{toast.message}</span>
            {toast.undoAction && (
              <button
                onClick={() => {
                  toast.undoAction!()
                  dismissToast(toast.id)
                }}
                className="text-xs font-semibold text-accent-400 hover:text-accent-300 transition-colors flex-shrink-0 px-1"
              >
                Undo
              </button>
            )}
            <button
              onClick={() => dismissToast(toast.id)}
              className="h-5 w-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
