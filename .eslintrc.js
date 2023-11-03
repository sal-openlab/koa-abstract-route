module.exports = {
  root: true,
  env: {
    node: true,
    'jest/globals': true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['jest'],
  rules: {
    '@typescript-eslint/no-var-requires': ['warn'],
    'lines-between-class-members': [
      'error',
      'always',
      { exceptAfterSingleLine: true }
    ],
    'no-useless-constructor': ['error'],
    'no-undef': ['off'] // disable 'error' to ts and js mixed code base
  },
  overrides: [],
  globals: {}
};
