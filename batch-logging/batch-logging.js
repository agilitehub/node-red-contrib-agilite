const Agilite = require('agilite')
const Mustache = require('mustache')

module.exports = function (RED) {
  function BatchLogging (config) {
    RED.nodes.createNode(this, config)

    const node = this
    const field = config.field || 'payload'
    const fieldType = config.fieldType || 'msg'
    let errorMessage = ''
    let result = null

    node.status({
      fill: 'blue',
      text: 'ready',
      shape: 'ring'
    })

    this.on('input', async (msg) => {
      const serverConfig = RED.nodes.getNode(config.server)
      const url = serverConfig.server
      const failFlow = config.failFlow
      let agilite = null
      let apiKey = ''
      let data = null
      let logProcessKey = null
      let profileKey = config.profileKey
      let processId = config.processId
      let qry = config.qry
      let fieldsToReturn = config.fieldsToReturn
      let qryOptions = config.qryOptions
      let page = config.page
      let pageLimit = config.pageLimit

      //  Function that is called inside .then of requests
      const reqSuccess = (response) => {
        switch (fieldType) {
          case 'msg':
            RED.util.setMessageProperty(msg, field, response.data)
            break
          case 'flow':
            node.context().flow.set(field, response.data)
            break
          case 'global':
            node.context().global.set(field, response.data)
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
      const reqCatch = (error) => {
        let errorMessage = ''

        if (error.response && error.response.data.errorMessage) {
          errorMessage = error.response.data.errorMessage
        } else if (error.message) {
          errorMessage = error.message
        } else {
          errorMessage = error
        }

        msg.payload = errorMessage

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
      if (msg.agilite) if (msg.agilite.logProcessKey) logProcessKey = msg.agilite.logProcessKey
      if (!apiKey) apiKey = serverConfig.credentials.apiKey

      // Mustache
      profileKey = Mustache.render(profileKey, msg)
      processId = Mustache.render(processId, msg)
      qry = Mustache.render(qry, msg)
      fieldsToReturn = Mustache.render(fieldsToReturn, msg)
      qryOptions = Mustache.render(qryOptions, msg)
      page = Mustache.render(page, msg)
      pageLimit = Mustache.render(pageLimit, msg)

      // We need a token, keys and data to proceed
      if (!apiKey) {
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (!url) {
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '1': // Init Batch Process
          case '3': // Get By Profile Key
            if (!profileKey) errorMessage = 'No Profile Key found'
            break
          case '2': // Complete Log Process
          case '4': // Create Log Entry
          case '5': // Generate Log Process Report
            if (!processId) errorMessage = 'No Process Id found'
            break
        }
      }

      if (errorMessage) {
        msg.payload = errorMessage

        if (failFlow) {
          node.error(msg.payload)
        } else {
          node.send(msg)
        }
        return false
      }

      agilite = new Agilite({ apiServerUrl: url, apiKey })

      node.status({
        fill: 'yellow',
        text: 'Running',
        shape: 'ring'
      })

      try {
        switch (config.actionType) {
          case '1':
            result = await agilite.BatchLogging.initLogProcess(profileKey, data, logProcessKey)
            break
          case '2':
            result = await agilite.BatchLogging.completeLogProcess(processId, data)
            break
          case '3':
            result = await agilite.BatchLogging.getByProfileKey(profileKey, logProcessKey)
            break
          case '4':
            result = await agilite.BatchLogging.createLogEntry(processId, data)
            break
          case '5':
            result = await agilite.BatchLogging.generateLogProcessReport(processId, qry, fieldsToReturn, qryOptions, page, pageLimit)
            break
          default:
            throw new Error('No valid Action Type specified')
        }

        reqSuccess(result)
      } catch (error) {
        reqCatch(error)
      }
    })
  }

  RED.nodes.registerType('batch-logging', BatchLogging)
}
