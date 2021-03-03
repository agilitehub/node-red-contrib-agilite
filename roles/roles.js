const Agilite = require('agilite')
const TypeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function Roles (config) {
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
      let agilite = null
      let apiKey = ''
      let logProcessId = null
      let roleName = config.roleName
      let conditionalLevels = config.conditionalLevels
      let data = {}

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
      if (TypeDetect(msg.payload) !== 'Object') {
        msg.payload = {}
      }

      data = msg.payload

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

        if (msg.agilite.roles) {
          if (msg.agilite.roles.roleName) {
            if (msg.agilite.roles.roleName !== '') {
              roleName = msg.agilite.roles.roleName
            }
          }

          if (msg.agilite.roles.conditionalLevels) {
            if (msg.agilite.roles.conditionalLevels !== '') {
              conditionalLevels = msg.agilite.roles.conditionalLevels
            }
          }
        }
      }

      if (apiKey === '') {
        apiKey = serverConfig.credentials.apiKey
      }

      if (roleName === '') {
        roleName = config.roleName
      }

      // Mustache
      roleName = Mustache.render(roleName, msg)
      conditionalLevels = Mustache.render(conditionalLevels, msg)

      //  Finalize array properties
      roleName = roleName.split(',')
      conditionalLevels = conditionalLevels.split(',')

      // We need a apiKey, key and data to proceed
      if (apiKey === '') {
        success = false
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (url === '') {
        success = false
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '1': // Get Role
            if (roleName === '') {
              success = false
              errorMessage = 'No Role Name found'
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
        case '1': // Get Role
          agilite.Roles.getRole(roleName, conditionalLevels, data, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        default:
          reqCatch({ response: { data: { errorMessage: 'No valid Action Type specified' } } })
          break
      }
    })
  }

  RED.nodes.registerType('roles', Roles)
}
