const Agilite = require('agilite')
const TypeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function IoEConnectors (config) {
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
      const url = serverConfig.server
      const failFlow = config.failFlow
      const payloadFile = config.payloadFile
      let agilite = null
      let apiKey = ''
      let logProcessId = null
      let profileKey = config.profileKey
      let routeKey = config.routeKey
      let data = null

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
      if (TypeDetect(msg.payload) !== 'Object' && TypeDetect(msg.payload) !== 'Uint8Array') { // TODO: These values should be stored and referenced as Enums
        msg.payload = {}
      }

      data = msg.payload

      // Check if we need to use a profile and route key passed to this node
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

        if (msg.agilite.connectors) {
          if (msg.agilite.connectors.profileKey) {
            if (msg.agilite.connectors.profileKey !== '') {
              profileKey = msg.agilite.connectors.profileKey
            }
          }

          if (msg.agilite.connectors.routeKey) {
            if (msg.agilite.connectors.routeKey !== '') {
              routeKey = msg.agilite.connectors.routeKey
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

      if (routeKey === '') {
        routeKey = config.routeKey
      }

      // Mustache
      profileKey = Mustache.render(profileKey, msg)
      routeKey = Mustache.render(routeKey, msg)

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
      } else if (routeKey === '') {
        success = false
        errorMessage = 'No Route Key Provided'
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

      agilite.Connectors.execute(profileKey, routeKey, data, payloadFile, logProcessId)
        .then(reqSuccess)
        .catch(reqCatch)
    })
  }

  RED.nodes.registerType('connectors', IoEConnectors)
}
