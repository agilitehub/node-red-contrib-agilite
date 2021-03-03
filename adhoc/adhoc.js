const Agilite = require('agilite')
const TypeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function Adhoc (config) {
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
      const failFlow = config.failFlow
      const url = serverConfig.server
      const fullName = config.fullName
      let agilite = null
      let apiKey = ''
      let logProcessId = ''
      let dateTimeValue = config.dateTimeValue
      let formatKey = config.formatKey
      let recordId = config.recordId
      let action = ''
      let data = null
      let apiKeyValue = config.apiKey

      //  Function that is called inside .then of requests
      const reqSuccess = (response) => {
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

        if (error.response.data.errorMessage) {
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

      // Check if there's valid data to pass
      switch (config.actionType) {
        case '1': // Encode XML
        case '6': // Decode XML
        case '7': // XML to JS
        case '2': // Convert HTML to JSON
          // Make sure data is a string
          if (TypeDetect(msg.payload) !== 'string') msg.payload = ''
          break
        case '8': // JS to XML
        case '3': // Generate PDF
          // Make sure data is a object
          if (TypeDetect(msg.payload) !== 'Object') msg.payload = {}
          break
        case '9': // Json Diff
          break
        case '10': // Generate Username
        // Make sure data is an Array
          if (TypeDetect(msg.payload) !== 'Array') msg.payload = []
          if (fullName === '') return node.error('Please provide a \'Full Name\' in the node interface')
          break
        case '11': // Generate OCR
          if (recordId === '') return node.error('Please provide a \'Record ID\'')
          break
        case '12': // Authenticate Token
          if (!apiKeyValue) return node.error('Please provide an API Key')
          break
        default: // get request
      }

      data = msg.payload

      // Check if we need to use programmatic values
      if (msg.agilite) if (msg.agilite.logProcessId) logProcessId = msg.agilite.logProcessId
      if (!apiKey) apiKey = serverConfig.credentials.apiKey

      // We need a token, key and data to proceed
      if (!apiKey) {
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (!url) {
        errorMessage = 'No Server URL Provided'
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

      dateTimeValue = Mustache.render(dateTimeValue, msg)
      formatKey = Mustache.render(formatKey, msg)
      recordId = Mustache.render(recordId, msg)
      apiKeyValue = Mustache.render(apiKeyValue, msg)

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

      try {
        switch (config.actionType) {
          case '10': // Generate Username
            result = await agilite.Utils.generateUsername(fullName, data, logProcessId)
            break
          case '11': // Generate OCR
            result = await agilite.Utils.generateOCR(recordId, logProcessId)
            break
          case '12': // Authenticate Token
            result = await agilite.authenticateToken(apiKeyValue)
            break
          default:
            result = await agilite.Utils[action](action !== 'formatDateTime' ? data : dateTimeValue, formatKey, logProcessId)
        }

        reqSuccess(result)
      } catch (error) {
        reqCatch(error)
      }
    })
  }

  RED.nodes.registerType('adhoc', Adhoc)
}
