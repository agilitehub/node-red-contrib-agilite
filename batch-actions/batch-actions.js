const Agilite = require('agilite')
const typeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function BatchActions (config) {
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
      let profileKey = config.profileKey
      let data = null
      let url = serverConfig.server
      let failFlow = config.failFlow

      //  Function that is called inside .then of requests
      let reqSuccess = function (response) {
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
      if (typeDetect(msg.payload) !== 'Object') { // TODO: These values should be stored and referenced as Enums
        msg.payload = {}
      }

      data = msg.payload

      // Check if we need to use a profile key passed to this node
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

        if (msg.agilite.batchactions) {
          if (msg.agilite.batchactions.profileKey) {
            if (msg.agilite.batchactions.profileKey !== '') {
              profileKey = msg.agilite.batchactions.profileKey
            }
          }
        }
      }

      if (apiKey === '') {
        apiKey = serverConfig.credentials.apiKey
      }

      if (profileKey === '') {
        profileKey = config.profileKey
      }

      // Mustache
      profileKey = Mustache.render(profileKey, msg)

      // We need a token, keys and data to proceed
      if (apiKey === '') {
        success = false
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (url === '') {
        success = false
        errorMessage = 'No Server URL Provided'
      } else if (profileKey === '') {
        success = false
        errorMessage = 'No Profile Key Provided'
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

      agilite.BatchActions.execute(profileKey, data, logProcessId)
        .then(reqSuccess)
        .catch(reqCatch)
    })
  }

  RED.nodes.registerType('batch-actions', BatchActions)
}
