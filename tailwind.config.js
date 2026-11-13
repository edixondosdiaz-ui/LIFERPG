import { tokens } from './src/design/tokens.js'
const c = tokens.colors
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        app: c.background.violet, card: c.surface.DEFAULT, card2: c.surface.inset, line: c.border.DEFAULT,
        ink: c.text.primary, sub: c.text.secondary, gold: c.finance,
        pu: c.brand, panel: c.surface, stroke: c.border, success: c.success, warning: c.warning, error: c.error, 'error-strong':c.errorStrong,
        strength: c.strength, health: c.health, education: c.education, finance: c.finance,
        hydration: c.hydration, sleep: c.sleep, nutrition: c.nutrition,
        fire: c.fire,
      },
      fontFamily: { sans: tokens.fonts.body, display: tokens.fonts.display },
      backgroundImage: tokens.backgrounds,
      boxShadow: tokens.shadows,
      spacing: tokens.spacing,
      dropShadow: tokens.dropShadows,
      borderRadius: tokens.radii,
      transitionDuration: { ui: tokens.motion.duration },
      scale: { press: tokens.motion.press },
      backdropBlur: tokens.blur,
      keyframes: {
        'fade-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pop: { '0%': { opacity: 0, transform: 'scale(.92)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
      animation: { 'fade-up': `fade-up ${tokens.motion.enter} ease-out both`, pop: `pop ${tokens.motion.enter} ease-out both` },
    },
  },
  plugins: [],
}
