/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        border: 'rgba(255, 255, 255, 0.12)',
        input: 'rgba(255, 255, 255, 0.15)',
        ring: 'var(--accent, #1db954)',
        background: 'rgba(10, 10, 14, 0.95)',
        foreground: '#ffffff',
        primary: {
          DEFAULT: 'var(--accent, #1db954)',
          foreground: '#000000',
        },
        secondary: {
          DEFAULT: 'rgba(255, 255, 255, 0.1)',
          foreground: '#ffffff',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'rgba(255, 255, 255, 0.12)',
          foreground: 'rgba(255, 255, 255, 0.65)',
        },
        card: {
          DEFAULT: 'rgba(18, 18, 24, 0.88)',
          foreground: '#ffffff',
        },
      },
      borderRadius: {
        lg: '16px',
        md: '12px',
        sm: '8px',
      },
      boxShadow: {
        card: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
};

