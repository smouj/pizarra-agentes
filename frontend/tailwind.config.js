/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'mgs-black': '#001100',
        'mgs-green': '#00ff9d',
        'mgs-green-dark': '#00aa66',
        'mgs-cyan': '#00ffff',
        'mgs-magenta': '#ff00ff',
        'mgs-red': '#ff0033',
        'mgs-yellow': '#ffcc00',
      },
      fontFamily: {
        'mono': ['Courier New', 'monospace'],
        'vt323': ['VT323', 'monospace'],
      },
      animation: {
        'scanline': 'scanline 8s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'typewriter': 'typewriter 0.05s steps(1) forwards',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.7', filter: 'brightness(1.3)' },
        },
        typewriter: {
          'to': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}