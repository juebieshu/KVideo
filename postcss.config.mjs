const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "postcss-preset-env": {
      features: {
        // preset-env's cascade-layers transform drops Tailwind v4 responsive
        // variant rules; target browsers support native layers, so leave it off.
        "cascade-layers": false,
        "color-mix": true,
      },
      browsers: "Chrome >= 130, Edge >= 130, Safari >= 17.5, Firefox >= 121",
    },
  },
};

export default config;
