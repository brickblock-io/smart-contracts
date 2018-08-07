module.exports = {
  compileCommand: '../node_modules/.bin/truffle compile',
  copyPackages: ['openzeppelin-solidity'],
  skipFiles: ['CustomPOAToken.sol'],
  testCommand: 'yarn test'
}
