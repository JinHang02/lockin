import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export default function Dialog({ open, onClose, title, children, className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-lg rounded-xl shadow-elevated animate-slide-down',
            'bg-[var(--bg-surface)] border border-[var(--border)]',
            'p-6 focus:outline-none',
            className
          )}
        >
          {title && (
            <div className="flex items-center justify-between mb-5">
              <RadixDialog.Title className="text-base font-semibold text-[var(--text-primary)]">
                {title}
              </RadixDialog.Title>
              <RadixDialog.Close asChild>
                <button
                  className="h-7 w-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  onClick={onClose}
                >
                  <X size={15} />
                </button>
              </RadixDialog.Close>
            </div>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
