const Agilite = require('agilite')
const Mustache = require('mustache')

module.exports = function (RED) {
  function Files (config) {
    RED.nodes.createNode(this, config)

    let node = this
    let success = true
    let errorMessage = ''

    this.field = config.field || 'payload'
    this.fieldType = config.fieldType || 'msg'

    node.status({
      fill: 'blue',
      text: 'ready',
      shape: 'ring'
    })

    this.on('input', function (msg) {
      let serverConfig = RED.nodes.getNode(config.server)
      let agilite = null
      let apiKey = ''
      let logProcessId = null
      let fileName = config.fileName
      let contentType = config.contentType
      let data = msg.payload
      let responseType = ''
      let recordId = config.recordId
      let persistFile = config.persistFile
      let isPublic = config.isPublic
      let url = serverConfig.server
      let failFlow = config.failFlow

      //  Function that is called inside .then of requests
      let reqSuccess = function (response) {
        msg.agilite.message = response.data.errorMessage

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

      //  Function that is used inside the .catch of requests
      let reqCatch = function (error) {
        let errorMessage = ''

        if (error.response && error.response.data.errorMessage) {
          msg.agilite.message = error.response.data.errorMessage
          errorMessage = msg.agilite.message
        } else {
          msg.agilite.message = 'Unknown Error Occurred'
          errorMessage = error.stack
        }

        msg.payload = msg.agilite.message

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
      if (msg.agilite) {
        if (msg.agilite.apiKey) {
          if (msg.agilite.apiKey !== '') {
            apiKey = msg.agilite.apiKey
          }
        }

        if (msg.agilite.logProcessId) {
          if (msg.agilite.logProcessId !== '') {
            logProcessId = msg.agilite.logProcessId
          }
        }

        if (msg.agilite.files) {
          if (msg.agilite.files.fileName) {
            if (msg.agilite.files.fileName !== '') {
              fileName = msg.agilite.files.fileName
            }
          }

          if (msg.agilite.files.contentType) {
            if (msg.agilite.files.contentType !== '') {
              contentType = msg.agilite.files.contentType
            }
          }

          if (msg.agilite.files.recordId) {
            if (msg.agilite.files.recordId !== '') {
              recordId = msg.agilite.files.recordId
            }
          }

          if (msg.agilite.files.responseType) {
            if (msg.agilite.files.responseType !== '') {
              responseType = msg.agilite.files.responseType
            }
          }
        }
      }

      if (apiKey === '') {
        apiKey = serverConfig.credentials.apiKey
      }

      if (fileName === '') {
        recordId = config.fileName
      }

      if (contentType === '') {
        contentType = config.contentType
      }

      if (recordId === '') {
        recordId = config.recordId
      }

      if (responseType === '' && config.responseType && config.responseType !== '') {
        responseType = config.responseType
      } else {
        responseType = 'arraybuffer'
      }

      // Mustache
      recordId = Mustache.render(recordId, msg)
      fileName = Mustache.render(fileName, msg)
      contentType = Mustache.render(contentType, msg)

      // Validate Values
      if (apiKey === '') {
        success = false
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (url === '') {
        success = false
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '1':
          case '2':
          case '3':
            if (!recordId) {
              success = false
              errorMessage = 'Please provide a Record Id'
            }
            break
          case '4':
            if (!fileName) {
              success = false
              errorMessage = 'Please provide a File Name (e.g. image.jpeg)'
            }
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
      agilite = new Agilite({
        apiServerUrl: url,
        apiKey
      })

      // Create msg.agilite if it's null so we can store the result
      if (!msg.agilite) {
        msg.agilite = {}
      }

      node.status({
        fill: 'yellow',
        text: 'Running',
        shape: 'ring'
      })

      switch (config.actionType) {
        case '1': // Get File
          agilite.Files.getFile(recordId, responseType, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '2': // Get File Name
          agilite.Files.getFileName(recordId, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '3': // Delete File
          agilite.Files.deleteFile(recordId, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '4': // Post File
          agilite.Files.uploadFile(fileName, contentType, data, persistFile, isPublic, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '5': // Unzip File
        agilite.Files.unzip(recordId, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        default:
          reqCatch({ response: { data: { errorMessage: 'No valid Action Type specified' }}})
          break
      }
    })
  }

  RED.nodes.registerType('files', Files)
}
