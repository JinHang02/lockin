import { cn } from '@/lib/utils'

interface BadgeProps {
  label: string
  color?: string
  className?: string
}

export default function Badge({ label, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
      style={
        color
          ? {
              backgroundColor: color + '22',
              color: color,
              border: `1px solid ${color}44`
            }
          : {
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)'
            }
      }
    >
      {color && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </span>
  )
}
