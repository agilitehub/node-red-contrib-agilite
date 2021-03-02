import Agilite from 'agilite'
import typeDetect from 'type-detect'
import Mustache from 'mustache'
import { NodeProperties, Red } from 'node-red'
import { Node } from 'node-red-contrib-typescript-node'

module.exports = function (RED: Red) {
  class EventsNode extends Node {
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
        let data: any = null
  
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
  
        // Check if we need to use a profile key passed to this node
        if (msg.agilite) if (msg.agilite.logProcessId) logProcessId = msg.agilite.logProcessId
        if (apiKey) apiKey = serverConfig.credentials.apiKey
        if (profileKey) profileKey = config.profileKey
  
        // Mustache
        profileKey = Mustache.render(profileKey, msg)
  
        // We need a token, keys and data to proceed
        if (!apiKey) {
          errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
        } else if (!url) {
          errorMessage = 'No Server URL Provided'
        } else {
          switch (config.actionType) {
            case '1': // Execute
            case '2': // Subscribe
              if (!profileKey) errorMessage = 'No Profile Key found'
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
  
        node.status({
          fill: 'yellow',
          text: 'Running',
          shape: 'ring'
        })
  
        try {
          switch (config.actionType) {
            case '1':
              result = await agilite.Events.execute(profileKey, data, logProcessId)
              break
            case '2':
              result = await agilite.Events.subscribe(profileKey, data, logProcessId)
              break
            default:
              throw new Error('No valid Action Type specified')
              break
          }

          reqSuccess(result)
        } catch (error) {
          reqCatch(error)
        }
      })
    }
  }

  EventsNode.registerType(RED, 'events')
}
