import { NodeProperties, Red } from 'node-red'
import { Node } from 'node-red-contrib-typescript-node'
import Agilite from 'agilite'
import TypeDetect from 'type-detect'
import Mustache from 'mustache'

module.exports = function (RED: Red) {
  class KeywordsNode extends Node {
    constructor (config: NodeProperties) {
      super(RED)

      const node = this
      const field: string = config.field || 'payload'
      const fieldType: string = config.fieldType || 'msg'
      let errorMessage: string = ''

      node.status({
        fill: 'blue',
        text: 'ready',
        shape: 'ring'
      })

      node.createNode(config)

      node.on('input', async (msg: any) => {
        let serverConfig = RED.nodes.getNode(config.server)
        let agilite: Agilite = new Agilite({ apiServerUrl: '', apiKey: '' })
        let apiKey: string = ''
        let logProcessId: string = ''
        let profileKey: string = config.profileKey
        let url: string = serverConfig.server
        let failFlow: boolean = config.failFlow
        let recordId: string = config.recordId
        let groupName: string = config.groupName
        let labelKey: string = config.labelKey
        let valueKey: string = config.valueKey
        let sortBy: string = config.sortBy
        let sortBy2: string = config.sortBy2
        let profileKeys: string = config.profileKeys
        let recordIds: string = config.recordIds
        let outputFormat: string = config.outputFormat
        let outputFormat2: string = config.outputFormat2
        let response: any = null
        let data: any = {}

        //  Function that is called inside .then of requests
        const reqSuccess = (response: any) => {
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
        const reqCatch = (error: any) => {
          let errorMessage: string = ''

          if (error.response) {
            errorMessage = error.response.data.errorMessage
          } else if (error.message) {
            errorMessage = error.message
          } else if (error) {
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
  }

  KeywordsNode.registerType(RED, 'keywords')
}
