/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        canvas: '#F2F8F7',
        card: '#FFFFFF',
        ink: '#0E1B33',
        muted: '#5A6780',
        line: '#DCE8E6',
        teal: { 50: '#EEF8F6', 100: '#DDF2EF', 200: '#B8E4DE', 500: '#14A594', 600: '#0E9384', 700: '#0B7468', 800: '#0A5C53' },
        navy: { 700: '#1A2A4A', 800: '#13213D', 900: '#0E1B33' },
        risk: {
          high: '#C93A3A', highBg: '#FDECEC', highLine: '#F5C7C7',
          medium: '#8A5A00', mediumDot: '#D99A1E', mediumBg: '#FDF0D5', mediumLine: '#F1D9A6',
          low: '#17804A', lowBg: '#E3F6EA', lowLine: '#BFE6CD',
        },
        note: { bg: '#FFF8E6', line: '#E8C46A', ink: '#6E5212' },
      },
      borderRadius: { xl2: '1.25rem', xl3: '1.75rem' },
      keyframes: {
        wave: { '0%,100%': { transform: 'rotate(0deg)' }, '20%': { transform: 'rotate(16deg)' }, '40%': { transform: 'rotate(-8deg)' }, '60%': { transform: 'rotate(14deg)' }, '80%': { transform: 'rotate(-4deg)' } },
      },
      boxShadow: {
        card: '0 1px 2px rgba(14,27,51,0.04), 0 8px 24px rgba(14,27,51,0.06)',
        lift: '0 2px 4px rgba(14,27,51,0.05), 0 16px 40px rgba(14,27,51,0.10)',
        phone: '0 30px 80px rgba(14,27,51,0.22)',
      },
    },
  },
  plugins: [],
};
