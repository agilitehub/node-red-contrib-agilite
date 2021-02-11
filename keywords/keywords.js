const Agilite = require('agilite')

module.exports = (RED) => {
  function Keywords (config) {
    RED.nodes.createNode(this, config)

    const node = this
    let success = true
    let errorMessage = ''
    this.field = config.field || 'payload'
    this.fieldType = config.fieldType || 'msg'

    const typeDetect = require('type-detect')
    const Mustache = require('mustache')

    node.status({
      fill: 'blue',
      text: 'ready',
      shape: 'ring'
    })

    this.on('input', async (msg) => {
      const serverConfig = RED.nodes.getNode(config.server)
      const failFlow = config.failFlow
      const outputFormat2 = config.outputFormat2
      let apiKey = ''
      let logProcessId = null
      let recordId = config.recordId
      let profileKey = config.profileKey
      let groupName = config.groupName
      let labelKey = config.labelKey
      let valueKey = config.valueKey
      let sortBy = config.sortBy
      let sortBy2 = config.sortBy2
      let values = config.values
      let profileKeys = config.profileKeys
      let recordIds = config.recordIds
      let outputFormat = config.outputFormat
      let url = ''
      let data = {}

      const reqSuccess = (response) => {
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

      const reqCatch = (error) => {
        let errMsg = null
        msg.payload = {}

        if (error.response) {
          errMsg = error.response.data.errorMessage
        } else if (error.message) {
          errMsg = error.message
        } else {
          errMsg = 'Unknown Error Occurred'
        }

        node.status({
          fill: 'red',
          text: 'Error',
          shape: 'ring'
        })

        if (failFlow) {
          node.error(errMsg, msg)
        } else {
          node.send(msg)
        }
      }

      // Check if there's valid data to pass
      if (typeDetect(msg.payload) !== 'Object') {
        msg.payload = {}
      }

      if (!apiKey) {
        apiKey = serverConfig.credentials.apiKey
      }

      url = serverConfig.server
      data = msg.payload

      // We need a apiKey, key and data to proceed
      if (!apiKey) {
        success = false
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (!url) {
        success = false
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '1': // Get Keywords By Profile Key
            if (!profileKey) {
              success = false
              errorMessage = 'Please provide a Profile Key'
            }

            break
          case '2': // Get Profile Keys By Group
            if (!groupName) {
              success = false
              errorMessage = 'Please provide a Group Name'
            }

            break
          case '3': // Get Keyword Value by Label
            if (!profileKey) {
              success = false
              errorMessage = 'Please provide a Profile Key'
            } else if (!labelKey) {
              success = false
              errorMessage = 'Please provide a Label Key'
            }

            break
          case '4': // Get Keyword Label by Value
            if (!profileKey) {
              success = false
              errorMessage = 'Please provide a Profile Key'
            } else if (!valueKey) {
              success = false
              errorMessage = 'Please provide a Value Key'
            }

            break
          case '5': // Create Keyword
            // data object should exist in msg.payload i.e msg.payload.data.isActive etc
            if (!data.data) {
              success = false
              errorMessage = 'No valid data object found in msg.payload'
            }

            if (data.data) {
              if (!data.data.isActive) {
                success = false
                errorMessage = 'Please provide an "isActive" property'
              }

              if (!data.data.key) {
                success = false
                errorMessage = 'Please provide a "key" property'
              }
            }

            break
          case '6': // Update Keyword Record
          case '7': // Delete Keyword Record
            if (!recordId) {
              success = false
              errorMessage = 'Please provide a Record Id'
            }
          
            break
          case '8': // Set Values By Profille Key
            if (!profileKey) {
              success = false
              errorMessage = 'Please provide a Profile Key'
            } else if (!values) {
              success = false
              errorMessage = 'Please provide values'
            }
            break
          case '9': // Set Value By Label
          case '10': // Set Value By Label
            if (!profileKey) {
              success = false
              errorMessage = 'Please provide a Record Id'
            } else if (!valueKey) {
              success = false
              errorMessage = 'Please provide a Value Key'
            } else if (!labelKey) {
              success = false
              errorMessage = 'Please provide a Label Key'
            }
            break
          case '11': // Get Data
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
      const agilite = new Agilite({
        apiServerUrl: url,
        apiKey
      })
      let response = null

      // Mustache
      if (recordId) recordId = Mustache.render(recordId, msg)
      if (profileKey) profileKey = Mustache.render(profileKey, msg)
      if (groupName) groupName = Mustache.render(groupName, msg)
      if (labelKey) labelKey = Mustache.render(labelKey, msg)
      if (valueKey) valueKey = Mustache.render(valueKey, msg)
      if (values) values = Mustache.render(values, msg)
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
            response = await agilite.Keywords.setValuesByProfileKey(profileKey, values, logProcessId)
            break
          case '9': // Set Value By Label
            response = await agilite.Keywords.setValueByLabel(profileKey, labelKey, valueKey, logProcessId)
            break
          case '10': // Set Label By Value
            response = await agilite.Keywords.setLabelByValue(profileKey, valueKey, labelKey, logProcessId)
            break
          case '11': // Get Data
            // TODO: Slim Result needs to be toggled
            response = 'test'
            response = await agilite.Keywords.getData(profileKeys.split(','), recordIds.split(','), false, logProcessId)
            break
          default:
            throw new Error({ response: { data: { errorMessage: 'No valid Action Type specified' } } })
        }

        reqSuccess(response)
      } catch (error) {
        reqCatch(error)
      }
    })
  }

  RED.nodes.registerType('keywords', Keywords)
}
