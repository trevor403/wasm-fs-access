module.exports = {
  plugins: [
    ["@babel/plugin-transform-modules-umd", {
      "globals": {
        "es6-promise": "Promise"
      }
    }]
  ],
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
      },
    ],
  ],
};