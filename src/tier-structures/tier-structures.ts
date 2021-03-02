import Agilite from 'agilite'
import typeDetect from 'type-detect'
import Mustache from 'mustache'
import { NodeProperties, Red } from 'node-red'
import { Node } from 'node-red-contrib-typescript-node'

module.exports = function (RED: Red) {
  class TierStructuresNode extends Node {
    constructor (config: NodeProperties) {
      super(RED)

      const node = this
      const field: string = config.field || 'payload'
      const fieldType: string = config.fieldType || 'msg'
      let errorMessage: string = ''
      let result: any = null

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
        let tierKeys: any = config.tierKeys
        let sortValues: string = config.sortValues
        let valuesOutputFormat: string = config.valuesOutputFormat
        let includeValues: boolean = config.includeValues
        let includeMetaData: boolean = config.includeMetaData
        let includeTierEntries: boolean = config.includeTierEntries
        let url: string = serverConfig.server
        let failFlow: string = config.failFlow
  
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
  
        // Check if there's valid data to pass
        if (typeDetect(msg.payload) !== 'Object') msg.payload = {}
  
        // Check if we need to use programmatic values
        if (msg.agilite) if (msg.agilite.logProcessId) logProcessId = msg.agilite.logProcessId
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
              result = await agilite.TierStructures.getTierByKey(tierKeys, includeValues, includeMetaData, includeTierEntries, sortValues, valuesOutputFormat, logProcessId)
              break
          }

          reqSuccess(result)
        } catch (error) {
          reqCatch(error)
        }
      })
    }
  }

  TierStructuresNode.registerType(RED, 'tier-structures')
}
