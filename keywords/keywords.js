const Agilite = require('agilite')
const TypeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function Keywords (config) {
    RED.nodes.createNode(this, config)

    const node = this
    const field = config.field || 'payload'
    const fieldType = config.fieldType || 'msg'
    let errorMessage = ''

    node.status({
      fill: 'blue',
      text: 'ready',
      shape: 'ring'
    })

    this.on('input', async (msg) => {
      const serverConfig = RED.nodes.getNode(config.server)
      let agilite = null
      const outputFormat = config.outputFormat
      const outputFormat2 = config.outputFormat2
      const sortBy = config.sortBy
      const sortBy2 = config.sortBy2
      const url = serverConfig.server
      const failFlow = config.failFlow
      let apiKey = ''
      let logProcessId = ''
      let profileKey = config.profileKey
      let recordId = config.recordId
      let groupName = config.groupName
      let labelKey = config.labelKey
      let valueKey = config.valueKey
      let profileKeys = config.profileKeys
      let recordIds = config.recordIds
      let response = null
      let data = {}

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

      if (msg.agilite) if (msg.agilite.logProcessId) logProcessId = msg.agilite.logProcessId

      // Check if there's valid data to pass
      if (TypeDetect(msg.payload) !== 'Object' && TypeDetect(msg.payload) !== 'Array') msg.payload = {}
      data = msg.payload

      if (!apiKey) apiKey = serverConfig.credentials.apiKey

      // We need a apiKey, key and data to proceed
      if (!apiKey) {
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (!url) {
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '1': // Get Keywords By Profile Key
            if (!profileKey) errorMessage = 'Please provide a Profile Key'
            break
          case '2': // Get Profile Keys By Group
            if (!groupName) errorMessage = 'Please provide a Group Name'
            break
          case '3': // Get Keyword Value by Label
            if (!profileKey) {
              errorMessage = 'Please provide a Profile Key'
            } else if (!labelKey) {
              errorMessage = 'Please provide a Label Key'
            }
            break
          case '4': // Get Keyword Label by Value
            if (!profileKey) {
              errorMessage = 'Please provide a Profile Key'
            } else if (!valueKey) {
              errorMessage = 'Please provide a Value Key'
            }
            break
          case '5': // Create Keyword
            if (!data.data) errorMessage = 'No valid data object found in msg.payload'

            if (data.data) {
              if (!data.data.isActive) errorMessage = 'Please provide an "isActive" property'
              if (!data.data.key) errorMessage = 'Please provide a "key" property'
            }
            break
          case '6': // Update Keyword Record
          case '7': // Delete Keyword Record
            if (!recordId) errorMessage = 'Please provide a Record Id'
            break
          case '8': // Set Values By Profille Key
            if (!profileKey) errorMessage = 'Please provide a Profile Key'
            break
          case '9': // Set Value By Label
          case '10': // Set Value By Label
            if (!profileKey) {
              errorMessage = 'Please provide a Record Id'
            } else if (!valueKey) {
              errorMessage = 'Please provide a Value Key'
            } else if (!labelKey) {
              errorMessage = 'Please provide a Label Key'
            }
            break
          case '11': // Get Data
            break
        }
      }

      if (errorMessage) {
        msg.payload = errorMessage

        if (failFlow) {
          return node.error(msg.payload)
        } else {
          return node.send(msg)
        }
      }

      agilite = new Agilite({ apiServerUrl: url, apiKey })

      // Mustache
      if (recordId) recordId = Mustache.render(recordId, msg)
      if (profileKey) profileKey = Mustache.render(profileKey, msg)
      if (groupName) groupName = Mustache.render(groupName, msg)
      if (labelKey) labelKey = Mustache.render(labelKey, msg)
      if (valueKey) valueKey = Mustache.render(valueKey, msg)
      if (profileKeys) profileKeys = Mustache.render(profileKeys, msg)
      if (recordIds) recordIds = Mustache.render(recordIds, msg)

      node.status({
        fill: 'yellow',
        text: 'Running',
        shape: 'ring'
      })

      try {
        switch (config.actionType) {
          case '1': // Get Values By Profile Key
            response = await agilite.Keywords.getValuesByProfileKey(profileKey, sortBy, outputFormat, logProcessId)
            break
          case '2': // Get Profile Keys By Group
            response = await agilite.Keywords.getProfileKeysByGroup(groupName, sortBy2, logProcessId)
            break
          case '3': // Get Keyword Value by Label
            response = await agilite.Keywords.getValueByLabel(profileKey, labelKey, outputFormat2, logProcessId)
            break
          case '4': // Get Keyword Label by Value
            response = await agilite.Keywords.getLabelByValue(profileKey, valueKey, outputFormat2, logProcessId)
            break
          case '5': // Create Keyword Record
            response = await agilite.Keywords.postData(data, logProcessId)
            break
          case '6': // Update Keyword Record
            response = await agilite.Keywords.putData(recordId, data, logProcessId)
            break
          case '7': // Delete Keyword Record
            response = await agilite.Keywords.deleteData(recordId, logProcessId)
            break
          case '8': // Set Values By Profile Key
            response = await agilite.Keywords.setValuesByProfileKey(profileKey, data, logProcessId)
            break
          case '9': // Set Value By Label
            response = await agilite.Keywords.setValueByLabel(profileKey, labelKey, valueKey, logProcessId)
            break
          case '10': // Set Label By Value
            response = await agilite.Keywords.setLabelByValue(profileKey, valueKey, labelKey, logProcessId)
            break
          case '11': // Get Data
            response = await agilite.Keywords.getData(profileKeys.split(','), recordIds.split(','), false, logProcessId)
            break
          default:
            throw new Error('No valid Action Type specified')
        }

        reqSuccess(response)
      } catch (error) {
        reqCatch(error)
      }
    })
  }

  RED.nodes.registerType('keywords', Keywords)
}
