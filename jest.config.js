module.exports = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules',
    '<rootDir>/doc',
    '<rootDir>/.eslintrc.js',
    '<rootDir>/test/.eslintrc.js'
  ],
  moduleFileExtensions: ['js', 'ts', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        diagnostics: {
          warnOnly: false,
          pathRegex: /\.(spec|test)\.ts$/
        }
      }
    ]
  },
  collectCoverage: true,
  collectCoverageFrom: ['<rootDir>/src/**/*.{js,ts}'],
  coverageDirectory: '<rootDir>/doc/coverage',
  globals: {}
};
