const Agilite = require('agilite')
const TypeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function TierStructures (config) {
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
      let agilite = null
      let apiKey = ''
      let logProfileKey = ''
      let tierKeys = config.tierKeys
      let sortValues = config.sortValues
      let valuesOutputFormat = config.valuesOutputFormat
      const includeValues = config.includeValues
      const includeMetaData = config.includeMetaData
      const includeTierEntries = config.includeTierEntries
      const url = serverConfig.server
      const failFlow = config.failFlow

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

      // Check if there's valid data to pass
      if (TypeDetect(msg.payload) !== 'Object') msg.payload = {}

      // Check if we need to use programmatic values
      if (msg.agilite) if (msg.agilite.logProfileKey) logProfileKey = msg.agilite.logProfileKey
      if (!apiKey) apiKey = serverConfig.credentials.apiKey

      // We need a apiKey, key and data to proceed
      if (!apiKey) {
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (!url) {
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '1': // getTierByKey
            if (!tierKeys) errorMessage = 'No Tier Keys Provided'
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

      //  Format Mustache properties
      tierKeys = Mustache.render(tierKeys, msg)
      sortValues = Mustache.render(sortValues, msg)
      valuesOutputFormat = Mustache.render(valuesOutputFormat, msg)

      //  Finalize array properties
      tierKeys = tierKeys.split(',')

      node.status({
        fill: 'yellow',
        text: 'Running',
        shape: 'ring'
      })

      try {
        switch (config.actionType) {
          case '1': // getTierByKey
            result = await agilite.TierStructures.getTierByKey(tierKeys, includeValues, includeMetaData, includeTierEntries, sortValues, valuesOutputFormat, logProfileKey)
            break
        }

        reqSuccess(result)
      } catch (error) {
        reqCatch(error)
      }
    })
  }

  RED.nodes.registerType('tier-structures', TierStructures)
}
