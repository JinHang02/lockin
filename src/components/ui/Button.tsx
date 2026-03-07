import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline' | 'destructive' | 'accent'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded font-medium transition-all duration-150 focus-ring select-none disabled:opacity-40 disabled:cursor-not-allowed',
          {
            // Variants
            'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]':
              variant === 'default',
            'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]':
              variant === 'ghost',
            'border border-[var(--border)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]':
              variant === 'outline',
            'bg-red-500/10 text-red-500 hover:bg-red-500/20':
              variant === 'destructive',
            'bg-accent-500 text-white hover:bg-accent-600 dark:bg-accent-500 dark:hover:bg-accent-400':
              variant === 'accent',
          },
          {
            // Sizes
            'h-7 px-2.5 text-xs':   size === 'sm',
            'h-9 px-3.5 text-sm':   size === 'md',
            'h-10 px-5 text-sm':    size === 'lg',
            'h-9 w-9 p-0':          size === 'icon',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
