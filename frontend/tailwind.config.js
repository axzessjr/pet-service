/** @type {import('tailwindcss').Config} */

// Each colour reads a CSS variable set in src/index.css, so one class works
// in light and dark mode and opacity modifiers like bg-white/95 still work.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const scale = (name) =>
  Object.fromEntries(
    SHADES.map((shade) => [shade, `rgb(var(--color-${name}-${shade}) / <alpha-value>)`]),
  );

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        white: 'rgb(var(--color-white) / <alpha-value>)',
        // White that stays white in dark mode, for text on fixed-colour pins.
        snow: '#ffffff',
        // The palette's yellow, the same in both modes, with its dark text.
        sun: { DEFAULT: '#efc65d', ink: '#3d2c00' },
        page: 'rgb(var(--page) / <alpha-value>)',
        gray: scale('gray'),
        teal: scale('teal'),
        amber: scale('amber'),
        red: scale('red'),
        green: scale('green'),
        blue: scale('blue'),
      },
    },
  },
  plugins: [],
}
