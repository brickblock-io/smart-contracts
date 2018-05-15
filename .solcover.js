module.exports = {
  compileCommand: '../node_modules/.bin/truffle compile',
  copyPackages: ['openzeppelin-solidity'],
  skipFiles: ['CustomPOAToken.sol', 'POAToken.sol'],
  testCommand: 'yarn test'
}
