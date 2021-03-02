import { NodeProperties, Red } from 'node-red'
import { Node } from 'node-red-contrib-typescript-node'
import Agilite from 'agilite'
import Mustache from 'mustache'
import Bas64ArrayBuffer from 'base64-arraybuffer'

module.exports = function (RED: Red) {
  class FilesNode extends Node {
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
        let fileName: string = config.fileName
        let contentType: string = config.contentType
        let data: any = msg.payload
        let responseType: string = ''
        let recordId: string = config.recordId
        let persistFile: boolean = config.persistFile
        let isPublic: boolean = config.isPublic
        let url: string = serverConfig.server
        let failFlow: boolean = config.failFlow
  
        //  Function that is called inside .then of requests
        let reqSuccess = (response: any) => {
          msg.agilite.message = response.data.errorMessage
  
          if (config.responseType === 'base64') response.data = Bas64ArrayBuffer.encode(response.data)
  
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
  
        // Check if we need to use programmatic values
        if (msg.agilite) if (msg.agilite.logProcessId) logProcessId = msg.agilite.logProcessId
        if (!apiKey) apiKey = serverConfig.credentials.apiKey
  
        if (config.responseType) {
          if (config.responseType === 'base64') {
            responseType = 'arraybuffer'
          } else {
            responseType = config.responseType
          }
        } else {
          responseType = 'arraybuffer'
        }
  
        // Mustache
        recordId = Mustache.render(recordId, msg)
        fileName = Mustache.render(fileName, msg)
        contentType = Mustache.render(contentType, msg)
  
        // Validate Values
        if (!apiKey) {
          errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
        } else if (!url) {
          errorMessage = 'No Server URL Provided'
        } else {
          switch (config.actionType) {
            case '1':
            case '2':
            case '3':
              if (!recordId) errorMessage = 'Please provide a Record Id'
              break
            case '4':
              if (!fileName) errorMessage = 'Please provide a File Name (e.g. image.jpeg)'
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
            case '1': // Get File
              result = await agilite.Files.getFile(recordId, responseType, logProcessId)
              break
            case '2': // Get File Name
              result = await agilite.Files.getFileName(recordId, logProcessId)
              break
            case '3': // Delete File
              result = await agilite.Files.deleteFile(recordId, logProcessId)
              break
            case '4': // Post File
              result = await agilite.Files.uploadFile(fileName, contentType, data, persistFile, isPublic, logProcessId)
              break
            case '5': // Unzip File
              result = await agilite.Files.unzip(recordId, logProcessId)
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

  FilesNode.registerType(RED, 'files')
}
