/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-2': 'var(--bg-2)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        paper: 'var(--paper)',
        hot: 'var(--hot)',
        lime: 'var(--lime)',
        grape: 'var(--grape)',
        sky: 'var(--sky)',
        pink: 'var(--pink)',
        tape: 'var(--tape)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'cursive'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        wonk: 'var(--shadow)',
        'wonk-lg': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
};
