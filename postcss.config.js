export default {
  plugins: {
    // Tailwind v4 moved the PostCSS integration into its own package, and no
    // longer needs autoprefixer -- it handles vendor prefixes itself.
    "@tailwindcss/postcss": {},
  },
}
