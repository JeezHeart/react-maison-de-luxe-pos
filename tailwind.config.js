/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg-base)',
        elevated: 'var(--bg-elevated)',
        card: 'var(--bg-card)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-deep': 'var(--accent-deep)',
        'accent-ink': '#1a1410',
        surface: 'var(--surface-border)',
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif'],
        receipt: ['Georgia', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        glow: '0 4px 14px rgba(232, 184, 109, 0.25)',
        'glow-lg': '0 8px 32px rgba(196, 154, 74, 0.35)',
        'btn-glow': '0 4px 20px rgba(232, 184, 109, 0.2)',
      },
    },
  },
  plugins: [],
};