/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      },
      colors: {
        surface: "#0B0B0C",
        elev: "#161719",
        txt: "#EDEDED",
        primary: "#3B82F6",
        success: "#16A34A",
        warn: "#F59E0B",
        error: "#DC2626",
        neutral: "#64748B"
      },
      borderRadius: {
        chip: '12px',
        card: '16px'
      },
      boxShadow: {
        chip: "0 1px 2px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.06)",
        card: "0 6px 18px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.12)"
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.2s infinite',
        'snack-in': 'snackIn var(--dur-in) var(--ease-in)',
        'snack-out': 'snackOut var(--dur-out) var(--ease-out) forwards'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '0% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        },
        snackIn: {
          'from': { opacity: '0', transform: 'translate(-50%, 12px)' },
          'to': { opacity: '1', transform: 'translate(-50%, 0)' }
        },
        snackOut: {
          'from': { opacity: '1', transform: 'translate(-50%, 0)' },
          'to': { opacity: '0', transform: 'translate(-50%, 8px)' }
        }
      }
    }
  },
  plugins: [],
}
