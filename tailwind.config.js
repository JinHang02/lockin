/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './electron/renderer/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Neutral base palette — premium, not harsh
        neutral: {
          50:  '#fafafa',
          100: '#f5f5f4',
          200: '#e8e8e7',
          300: '#d4d4d2',
          400: '#a3a3a0',
          500: '#737370',
          600: '#525250',
          700: '#3a3a38',
          800: '#262624',
          900: '#171715',
          950: '#0e0e0c'
        },
        // Single accent — indigo, refined not loud
        accent: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b'
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'system-ui',
          'sans-serif'
        ],
        display: [
          'Sora',
          'Inter',
          'system-ui',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Cascadia Code',
          'monospace'
        ]
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }]
      },
      borderRadius: {
        DEFAULT: '0.375rem'
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)'
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-down': 'slideDown 150ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-down-out': 'slideDownOut 200ms ease-in forwards',
        'progress': 'progress 1s linear infinite',
        'flame-pulse': 'flamePulse 2s ease-in-out infinite',
        'timer-pulse': 'timerPulse 1s ease-in-out infinite',
        'task-complete': 'taskComplete 400ms ease-out',
        'ring-fill': 'ringFill 500ms ease-out forwards'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDownOut: {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(8px)', opacity: '0' }
        },
        flamePulse: {
          '0%, 100%': { filter: 'drop-shadow(0 0 2px rgba(251, 191, 36, 0.2))' },
          '50%': { filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.5))' }
        },
        timerPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        },
        taskComplete: {
          '0%': { transform: 'scale(1)' },
          '30%': { transform: 'scale(0.97)' },
          '60%': { transform: 'scale(1.01)' },
          '100%': { transform: 'scale(1)' }
        },
        ringFill: {
          '0%': { 'stroke-dashoffset': '88' },
          '100%': { 'stroke-dashoffset': '0' }
        }
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card': '0 4px 16px -2px rgb(0 0 0 / 0.08), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
        'elevated': '0 8px 32px -4px rgb(0 0 0 / 0.12), 0 4px 12px -4px rgb(0 0 0 / 0.08)'
      }
    }
  },
  plugins: []
}
