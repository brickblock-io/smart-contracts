const bunyan = require('bunyan')
const bformat = require('bunyan-format')
const formatOut = bformat({ outputMode: 'long' })
const logger = bunyan.createLogger({
  name: 'smartContracts',
  src: true,
  stream: formatOut
})

process.env.LOG_LEVEL
  ? logger.level(process.env.LOG_LEVEL)
  : logger.level('info')

module.exports = logger
