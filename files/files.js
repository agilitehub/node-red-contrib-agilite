const Agilite = require('agilite')
const Mustache = require('mustache')
const Bas64ArrayBuffer = require('base64-arraybuffer')

module.exports = function (RED) {
  function Files (config) {
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
      const persistFile = config.persistFile
      const isPublic = config.isPublic
      const url = serverConfig.server
      const failFlow = config.failFlow
      const data = msg.payload
      let apiKey = ''
      let logProcessKey = ''
      let fileName = config.fileName
      let contentType = config.contentType
      let responseType = ''
      let recordId = config.recordId

      //  Function that is called inside .then of requests
      const reqSuccess = (response) => {
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

      // Check if we need to use programmatic values
      if (msg.agilite) if (msg.agilite.logProcessKey) logProcessKey = msg.agilite.logProcessKey
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

      agilite = new Agilite({ apiServerUrl: url, apiKey })

      node.status({
        fill: 'yellow',
        text: 'Running',
        shape: 'ring'
      })

      try {
        switch (config.actionType) {
          case '1': // Get File
            result = await agilite.Files.getFile(recordId, responseType, logProcessKey)
            break
          case '2': // Get File Name
            result = await agilite.Files.getFileName(recordId, logProcessKey)
            break
          case '3': // Delete File
            result = await agilite.Files.deleteFile(recordId, logProcessKey)
            break
          case '4': // Post File
            result = await agilite.Files.uploadFile(fileName, contentType, data, persistFile, isPublic, logProcessKey)
            break
          case '5': // Unzip File
            result = await agilite.Files.unzip(recordId, logProcessKey)
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

  RED.nodes.registerType('files', Files)
}
