const logger = require('bristol')
const palin = require('palin')
const path = require('path')

const projectFolderArr = process.env.PWD.split(path.sep)
const projectFolderName = projectFolderArr[projectFolderArr.length - 1]

logger.addTarget('console').withFormatter(palin, {
  rootFolderName: projectFolderName
})

logger.addTransform(function(elem) {
  // check if elem is BigNumber
  if (elem && elem.s && elem.e && elem.c) {
    return elem.toString()
  }

  return elem
})

module.exports = logger
