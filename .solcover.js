module.exports = {
  compileCommand: '../node_modules/.bin/truffle compile',
  copyPackages: ['zeppelin-solidity'],
  skipFiles: ['CustomPOAToken.sol', 'POAToken.sol'],
  testCommand: 'yarn test'
}
