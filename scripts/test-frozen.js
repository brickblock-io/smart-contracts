const exec = require('child_process').exec
const path = require('path')

// we use console to log out in this script, turning this rule off for the file
/* eslint-disable no-console */

const directories = {
  cwd: __dirname,
  frozen: path.join(__dirname, '../frozen'),
  node_modules: path.join(__dirname, '../node_modules')
}

const execPromise = (command, options) =>
  new Promise((resolve, reject) => {
    const runner = exec(command, options)

    // we want to log output as it arrives
    runner.stdout.on('data', console.log)
    runner.stderr.on('data', console.log)

    // when the runner is done we can cleanup
    runner.on('close', exitCode => {
      exitCode === 0 ? resolve() : reject()
    })
  })

const prepare = () =>
  execPromise(
    `
    if [[ ! -d ${directories.frozen}/node_modules ]]; then
      ln -s ${directories.node_modules} ${directories.frozen}/node_modules
    fi

    if [[ -d ${directories.frozen}/build ]]; then
      rm -rf ${directories.frozen}/build
    fi
    `
  )

const runTruffleCommand = truffleCommand => () =>
  execPromise(
    `node -e "require('frozen-truffle/build/cli.bundled.js');" -- noop ${truffleCommand}`,
    { cwd: directories.frozen }
  ).catch(() => {
    throw Error(`command "${truffleCommand}" did not exit successfully`)
  })

prepare()
  .then(runTruffleCommand('compile'))
  .then(runTruffleCommand('test test/main-tests/*'))
  .catch(error => console.log('ERROR:', error.message))
