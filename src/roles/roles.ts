import { NodeProperties, Red } from 'node-red'
import { Node } from 'node-red-contrib-typescript-node'
import Agilite from 'agilite'
import TypeDetect from 'type-detect'
import Mustache from 'mustache'

module.exports = function (RED: Red) {
  class RolesNode extends Node {
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

      node.on('input', async (msg: any) => {
        const serverConfig: any = RED.nodes.getNode(config.server)
        const url: string = serverConfig.server
        const failFlow: boolean = config.failFlow
        let agilite: Agilite = new Agilite({ apiServerUrl: '', apiKey: '' })
        let roleName: any = config.roleName
        let conditionalLevels: any = config.conditionalLevels
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
        if (TypeDetect(msg.payload) !== 'Object') msg.payload = {}
        data = msg.payload

        // Check if we need to use programmatic values
        if (msg.agilite) if (msg.agilite.logProcessId) logProcessId = msg.agilite.logProcessId
        if (apiKey) apiKey = serverConfig.credentials.apiKey
        if (roleName) roleName = config.roleName

        // Mustache
        roleName = Mustache.render(roleName, msg)
        conditionalLevels = Mustache.render(conditionalLevels, msg)

        //  Finalize array properties
        roleName = roleName.split(',')
        conditionalLevels = conditionalLevels.split(',')

        // We need a apiKey, key and data to proceed
        if (!apiKey) {
          errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
        } else if (!url) {
          errorMessage = 'No Server URL Provided'
        } else {
          switch (config.actionType) {
            case '1': // Get Role
              if (roleName) {
                errorMessage = 'No Role Name found'
              }

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

        //  Create New instance of Agilite Module that will be performing requests
        agilite = new Agilite({ apiServerUrl: url, apiKey })

        node.status({
          fill: 'yellow',
          text: 'Running',
          shape: 'ring'
        })

        try {
          switch (config.actionType) {
            case '1': // Get Role
              result = await agilite.Roles.getRole(roleName, conditionalLevels, data, logProcessId)
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

  RolesNode.registerType(RED, 'roles')
}
