const Agilite = require('agilite')
const TypeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function BatchActions (config) {
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
      let profileKey = config.profileKey
      const url = serverConfig.server
      const failFlow = config.failFlow
      let apiKey = ''
      let logProcessKey = ''
      let data = null

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

      // Check if we need to use a profile key passed to this node
      if (msg.agilite) if (msg.agilite.logProcessKey) logProcessKey = msg.agilite.logProcessKey
      if (!apiKey) apiKey = serverConfig.credentials.apiKey

      // Mustache
      profileKey = Mustache.render(profileKey, msg)

      // We need a token, keys and data to proceed
      if (apiKey === '') {
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (url === '') {
        errorMessage = 'No Server URL Provided'
      } else if (profileKey === '') {
        errorMessage = 'No Profile Key Provided'
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
        result = await agilite.BatchActions.execute(profileKey, data, logProcessKey)
        reqSuccess(result)
      } catch (error) {
        reqCatch(error)
      }
    })
  }

  RED.nodes.registerType('batch-actions', BatchActions)
}
