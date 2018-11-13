const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')

// this helper functions allows us to run a command wrapped in a Promise; this allows for running
// multiple processes at once, and use async control flow like Promise.all
const promiseChildProcess = command =>
  new Promise((resolve, reject) => {
    const proc = childProcess.exec(command)

    proc.stdout.pipe(process.stdout)
    proc.stderr.pipe(process.stderr)

    proc.on('exit', code => (code === 0 ? resolve() : reject(command)))
  })

// all the sequence diagram are using `mmd` which is "mermaid markdown"
//
// https://mermaidjs.github.io/sequenceDiagram.html
const diagramFileRegEx = /\.mmd$/

const svgFileRegEx = /\.svg$/

const renderAll = async () => {
  const fileList = fs.readdirSync(path.resolve(__dirname)).reduce(
    (acc, filename) => {
      if (diagramFileRegEx.test(filename)) acc.diagrams.push(filename)

      if (svgFileRegEx.test(filename)) acc.svg.push(filename)

      return acc
    },
    { diagrams: [], svg: [] }
  )

  // clean rendered files (in case of name changes)
  fileList.svg.forEach(filename =>
    fs.unlinkSync(path.resolve(__dirname, filename))
  )

  try {
    // generate new diagram files
    await Promise.all(
      fileList.diagrams.map(filename =>
        promiseChildProcess(
          `yarn mmdc -i ${path.resolve(__dirname, filename)} -o ${path.resolve(
            __dirname,
            filename.replace('.mmd', '.svg')
          )}`
        )
      )
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(`command ${error} failed to execute`)
  }
}

renderAll()
