const Agilite = require('agilite')
const TypeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function Adhoc (config) {
    RED.nodes.createNode(this, config)

    const node = this
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
      const serverConfig = RED.nodes.getNode(config.server)
      const failFlow = config.failFlow
      const url = serverConfig.server
      const fullName = config.fullName
      let agilite = null
      let apiKey = ''
      let logProcessId = null
      let dateTimeValue = config.dateTimeValue
      let formatKey = config.formatKey
      let recordId = config.recordId
      let action = ''
      let data = null
      let apiKeyValue = config.apiKey

      //  Function that is called inside .then of requests
      const reqSuccess = function (response) {
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
      const reqCatch = function (error) {
        let errorMessage = ''

        if (error.response && error.response.data) {
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

      // Check if there's valid data to pass
      switch (config.actionType) {
        case '1': // Encode XML
        case '6': // Decode XML
        case '7': // XML to JS
        case '2': // Convert HTML to JSON
          // Make sure data is a string
          if (TypeDetect(msg.payload) !== 'string') {
            msg.payload = ''
          }

          data = msg.payload
          break
        case '8': // JS to XML
        case '3': // Generate PDF
          // Make sure data is a object
          if (TypeDetect(msg.payload) !== 'Object') {
            msg.payload = {}
          }

          data = msg.payload
          break
        case '9': // Json Diff
          data = msg.payload
          break
        case '10': // Generate Username
        // Make sure data is an Array
          if (TypeDetect(msg.payload) !== 'Array') {
            msg.payload = []
          }

          data = msg.payload

          if (fullName === '') {
            node.error('Please provide a \'Full Name\' in the node interface')
            return false
          }

          break
        case '11': // Generate OCR
          if (recordId === '') {
            node.error('Please provide a \'Record ID\'')
            return false
          }
          break
        case '12': // Authenticate Token
          if (msg.agilite && msg.agilite.apiKey) {
            apiKeyValue = msg.agilite.apiKey
            break
          } else if (apiKeyValue === '') {
            node.error('Please provide an API Key')
            return false
          }
          break
        default: // get request
          data = null
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
      }

      if (apiKey === '') {
        apiKey = serverConfig.credentials.apiKey
      }

      // We need a token, key and data to proceed
      if (apiKey === '') {
        success = false
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (url === '') {
        success = false
        errorMessage = 'No Server URL Provided'
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

      dateTimeValue = Mustache.render(dateTimeValue, msg)
      formatKey = Mustache.render(formatKey, msg)
      recordId = Mustache.render(recordId, msg)
      apiKeyValue = Mustache.render(apiKeyValue, msg)

      // Create msg.agilite if it's null so we can store the result
      if (!msg.agilite) {
        msg.agilite = {}
      }

      switch (config.actionType) {
        case '1': // Encode XML
          action = 'encodeXML'
          break
        case '2': // Convert HTML to JSON
          action = 'html2json'
          break
        case '3': // Generate PDF
          action = 'generatePDF'
          break
        case '4': // Generate UUID
          action = 'generateUUID'
          break
        case '5': // Format Dated/Time Value
          action = 'formatDateTime'
          break
        case '6': // Decode XML
          action = 'decodeXML'
          break
        case '7': // XML to JS
          action = 'XMLToJS'
          break
        case '8': // JS to XML
          action = 'JSToXML'
          break
        case '9': // JSON Diff
          action = 'jsonDiff'
          break
      }

      node.status({
        fill: 'yellow',
        text: 'Running',
        shape: 'ring'
      })

      switch (config.actionType) {
        case '10': // Generate Username
          agilite.Utils.generateUsername(fullName, data, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '11': // Generate OCR
          agilite.Utils.generateOCR(recordId, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '12': // Authenticate Token
          agilite.authenticateToken(apiKeyValue)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        default:
          agilite.Utils[action](action !== 'formatDateTime' ? data : dateTimeValue, formatKey, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
      }
    })
  }

  RED.nodes.registerType('adhoc', Adhoc)
}
