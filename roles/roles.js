const Agilite = require('agilite')
const TypeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function Roles (config) {
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
      const url = serverConfig.server
      const failFlow = config.failFlow
      let agilite = null
      let roleName = config.roleName
      let conditionalLevels = config.conditionalLevels
      let apiKey = ''
      let logProcessKey = ''
      let data = {}

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

      // Check if there's valid data to pass
      if (TypeDetect(msg.payload) !== 'Object') msg.payload = {}
      data = msg.payload

      // Check if we need to use programmatic values
      if (msg.agilite) if (msg.agilite.logProcessKey) logProcessKey = msg.agilite.logProcessKey
      if (!apiKey) apiKey = serverConfig.credentials.apiKey
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
            if (!roleName) {
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

      agilite = new Agilite({ apiServerUrl: url, apiKey })

      node.status({
        fill: 'yellow',
        text: 'Running',
        shape: 'ring'
      })

      try {
        switch (config.actionType) {
          case '1': // Get Role
            result = await agilite.Roles.getRole(roleName, conditionalLevels, data, logProcessKey)
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

  RED.nodes.registerType('roles', Roles)
}
