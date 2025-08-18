// PostCSS config (CommonJS) – evita problemas ESM en Vercel/Node
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
