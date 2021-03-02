import Agilite from 'agilite'
import typeDetect from 'type-detect'
import Mustache from 'mustache'
import { Node } from 'node-red-contrib-typescript-node'
import { NodeProperties, Red } from 'node-red'

module.exports = function (RED) {
  class DataMappingNode extends Node {
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
        let serverConfig: any = RED.nodes.getNode(config.server)
        let agilite: Agilite = new Agilite({ apiServerUrl: '', apiKey: '' })
        let profileKey: string = config.profileKey
        let url: string = serverConfig.server
        let failFlow: boolean = config.failFlow
        let apiKey: string = ''
        let logProcessId: string = ''
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
  
        // Check if there's valid data to pass
        if (typeDetect(msg.payload) !== 'Object') msg.payload = {}
        data = msg.payload
  
        // Check if we need to use programmatic values
        if (msg.agilite) if (msg.agilite.logProcessId) logProcessId = msg.agilite.logProcessId
        if (!apiKey) apiKey = serverConfig.credentials.apiKey
  
        // Mustache
        profileKey = Mustache.render(profileKey, msg)
  
        // We need an apiKey, profileKey and data to proceed
        if (!apiKey) {
          errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
        } else if (!url) {
          errorMessage = 'No Server URL Provided'
        } else if (!profileKey) {
          errorMessage = 'No Valid Profile Key Provided - ' + profileKey
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
  
        node.status({
          fill: 'yellow',
          text: 'Running',
          shape: 'ring'
        })
  
        try {
          result = await agilite.DataMappings.execute(profileKey, data, logProcessId)
          reqSuccess(result)
        } catch (error) {
          reqCatch(error)
        }
      })
    }
  }

  DataMappingNode.registerType(RED, 'data-mapping')
}
