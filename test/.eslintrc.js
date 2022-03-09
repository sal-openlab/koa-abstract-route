module.exports = {
  root: false,
  env: {
    jest: true
  },
  extends: ['plugin:@typescript-eslint/recommended'],
  plugins: ['jest'],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': ['warn'],
    '@typescript-eslint/no-var-requires': ['warn']
  },
  overrides: [],
  globals: {}
};
