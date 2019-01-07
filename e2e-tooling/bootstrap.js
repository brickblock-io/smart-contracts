/* eslint-disable no-console */
const exec = require('child_process').exec
const express = require('express')
const kill = require('tree-kill')
const proxy = require('http-proxy-middleware')
const waitOn = require('wait-on')

const deploySmartContracts = require('./setup-smart-contract-ecosystem')

const config = {
  ganachePort: 8000,
  expressPort: 8545,
}

const cleanupAndExitWithCode = code => {
  kill(process.pid, () => process.exit(code))
}

const bootstrap = async () => {
  // networkId 4447 is the "standard" when using truffle develop since v4.0.0
  // https://github.com/trufflesuite/truffle/releases/tag/v4.0.0
  //
  // we're using 4448 here so its clear we are using a private testnet
  const ganache = exec(
    `node ./node_modules/.bin/ganache-cli --deterministic --networkId 4448 --port ${
      config.ganachePort
    }`
  )
  ganache.stdout.pipe(process.stdout)
  ganache.stderr.pipe(process.stderr)

  waitOn(
    {
      resources: [`http://localhost:${config.ganachePort}`],
      delay: 2000,
      interval: 1000,
      timeout: 30 * 1000,
    },
    async () => {
      try {
        await deploySmartContracts(config.ganachePort)
      } catch (error) {
        console.log('ERROR: deploySmartContracts failed\n', error)
        cleanupAndExitWithCode(1)
      }

      const app = express()
      app.get('/ganache/health', (req, res) => {
        res.send({
          status: 'up',
        })
      })
      app.use(
        '/ganache',
        proxy({
          target: `http://localhost:${config.ganachePort}`,
          pathRewrite: {
            '/ganache': '/',
          },
        })
      )
      app.listen(config.expressPort, () => {
        console.log('Server started!')
      })
    }
  )
}

process.on('SIGTERM', () => {
  cleanupAndExitWithCode(0)
})

try {
  bootstrap()
} catch (error) {
  console.log('ERROR: bootstrap failed\n', error)
  cleanupAndExitWithCode(1)
}
