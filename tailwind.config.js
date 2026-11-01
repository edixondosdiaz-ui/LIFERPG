// Misma paleta de siempre (app, card, pu…), afinada, más tokens de animación y fuente
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: '#0d0d0f', card: '#15161c', card2: '#0f1015', line: '#25262f',
        ink: '#f3f4f8', sub: '#8b91a5', gold: '#e6b43c',
        pu: { DEFAULT: '#a855f7', dark: '#7c3aed', light: '#c084fc' },
      },
      fontFamily: { sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'] },
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { opacity: 0, transform: 'scale(.92)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
      animation: { 'fade-up': 'fade-up .4s ease-out both', pop: 'pop .25s ease-out both' },
    },
  },
  plugins: [],
}
