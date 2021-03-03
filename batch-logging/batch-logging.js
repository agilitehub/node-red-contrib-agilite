const Agilite = require('agilite')
const Mustache = require('mustache')

module.exports = function (RED) {
  function BatchLogging (config) {
    RED.nodes.createNode(this, config)

    const node = this
    let success = true
    let errorMessage = ''
    this.field = config.field || 'payload'
    this.fieldType = config.fieldType || 'msg'

    node.status({
      fill: 'blue',
      text: 'ready',
      shape: 'ring'
    })

    this.on('input', function (msg) {
      const serverConfig = RED.nodes.getNode(config.server)
      const url = serverConfig.server
      const failFlow = config.failFlow
      let agilite = null
      let apiKey = ''
      let data = null
      let logProcessId = null
      let profileKey = config.profileKey
      let processId = config.processId
      let qry = config.qry
      let fieldsToReturn = config.fieldsToReturn
      let qryOptions = config.qryOptions
      let page = config.page
      let pageLimit = config.pageLimit

      //  Function that is called inside .then of requests
      const reqSuccess = function (response) {
        switch (node.fieldType) {
          case 'msg':
            RED.util.setMessageProperty(msg, node.field, response.data)
            break
          case 'flow':
            node.context().flow.set(node.field, response.data)
            break
          case 'global':
            node.context().global.set(node.field, response.data)
            break
        }

        node.status({
          fill: 'green',
          text: 'Success',
          shape: 'ring'
        })

        node.send(msg)
      }

      //  Function that is used inside the .catch of requests
      const reqCatch = function (error) {
        let errorMessage = ''
        if (error.response && error.response.data) {
          msg.agilite.message = error.response.data.errorMessage
          errorMessage = msg.agilite.message
        } else {
          msg.agilite.message = 'Unknown Error Occurred'
          errorMessage = error.stack
        }

        msg.payload = msg.agilite.message

        node.status({
          fill: 'red',
          text: 'Error',
          shape: 'ring'
        })

        if (failFlow) {
          node.error(errorMessage, msg)
        } else {
          node.send(msg)
        }
      }

      data = msg.payload

      // Check if we need to use a profile key passed to this node
      if (msg.agilite) {
        if (msg.agilite.apiKey) {
          if (msg.agilite.apiKey !== '') {
            apiKey = msg.agilite.apiKey
          }
        }

        if (msg.agilite.logProcessId) {
          if (msg.agilite.logProcessId !== '') {
            logProcessId = msg.agilite.logProcessId
          }
        }

        if (msg.agilite.batchlogging) {
          if (msg.agilite.batchlogging.profileKey) {
            if (msg.agilite.batchlogging.profileKey !== '') {
              profileKey = msg.agilite.batchlogging.profileKey
            }
          }

          if (msg.agilite.batchlogging.processId) {
            if (msg.agilite.batchlogging.processsId !== '') {
              processId = msg.agilite.batchlogging.processId
            }
          }

          if (msg.agilite.batchlogging.qry) {
            if (msg.agilite.batchlogging.qry !== '') {
              qry = msg.agilite.batchlogging.qry
            }
          }

          if (msg.agilite.batchlogging.fieldsToReturn) {
            if (msg.agilite.batchlogging.fieldsToReturn !== '') {
              fieldsToReturn = msg.agilite.batchlogging.fieldsToReturn
            }
          }

          if (msg.agilite.batchlogging.qryOptions) {
            if (msg.agilite.batchlogging.qryOptions !== '') {
              qryOptions = msg.agilite.batchlogging.qryOptions
            }
          }

          if (msg.agilite.batchlogging.page) {
            if (msg.agilite.batchlogging.page !== '') {
              page = msg.agilite.batchlogging.page
            }
          }

          if (msg.agilite.batchlogging.pageLimit) {
            if (msg.agilite.batchlogging.pageLimit !== '') {
              pageLimit = msg.agilite.batchlogging.pageLimit
            }
          }
        }
      }

      if (apiKey === '') {
        apiKey = serverConfig.credentials.apiKey
      }

      if (profileKey === '') {
        profileKey = config.profileKey
      }

      if (processId === '') {
        processId = config.processId
      }

      // Mustache
      profileKey = Mustache.render(profileKey, msg)
      processId = Mustache.render(processId, msg)
      qry = Mustache.render(qry, msg)
      fieldsToReturn = Mustache.render(fieldsToReturn, msg)
      qryOptions = Mustache.render(qryOptions, msg)
      page = Mustache.render(page, msg)
      pageLimit = Mustache.render(pageLimit, msg)

      // We need a token, keys and data to proceed
      if (apiKey === '') {
        success = false
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (url === '') {
        success = false
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '1': // Init Batch Process
          case '3': // Get By Profile Key
            if (profileKey === '') {
              success = false
              errorMessage = 'No Profile Key found'
            }
            break
          case '2': // Complete Log Process
          case '4': // Create Log Entry
          case '5': // Generate Log Process Report
            if (processId === '') {
              success = false
              errorMessage = 'No Process Id found'
            }

            break
        }
      }

      if (!success) {
        msg.payload = errorMessage

        if (failFlow) {
          node.error(msg.payload)
        } else {
          node.send(msg)
        }
        return false
      }

      //  Create New instance of Agilite Module that will be performing requests
      agilite = new Agilite({
        apiServerUrl: url,
        apiKey
      })

      // Create msg.agilite if it's null so we can store the result
      if (!msg.agilite) {
        msg.agilite = {}
      }

      node.status({
        fill: 'yellow',
        text: 'Running',
        shape: 'ring'
      })

      switch (config.actionType) {
        case '1':
          agilite.BatchLogging.initLogProcess(profileKey, data, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '2':
          agilite.BatchLogging.completeLogProcess(processId, data)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '3':
          agilite.BatchLogging.getByProfileKey(profileKey, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '4':
          agilite.BatchLogging.createLogEntry(processId, data)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '5':
          agilite.BatchLogging.generateLogProcessReport(processId, qry, fieldsToReturn, qryOptions, page, pageLimit)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        default:
          reqCatch({ response: { data: { errorMessage: 'No valid Action Type specified' } } })
          break
      }
    })
  }

  RED.nodes.registerType('batch-logging', BatchLogging)
}
