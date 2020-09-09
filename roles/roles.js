const Agilite = require('agilite')
const typeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function Roles (config) {
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
      let roleName = config.roleName
      let conditionalLevels = config.conditionalLevels
      let processKey = config.processKey
      let bpmRecordId = config.bpmRecordId
      let currentUser = config.currentUser
      let responsibleUsers = config.responsibleUsers
      let url = serverConfig.server
      let data = {}
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
      if (typeDetect(msg.payload) !== 'Object') {
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

          if (msg.agilite.roles.processKey) {
            if (msg.agilite.roles.processKey !== '') {
              processKey = msg.agilite.roles.processKey
            }
          }

          if (msg.agilite.roles.bpmRecordId) {
            if (msg.agilite.roles.bpmRecordId !== '') {
              bpmRecordId = msg.agilite.roles.bpmRecordId
            }
          }

          if (msg.agilite.roles.currentUser) {
            if (msg.agilite.roles.currentUser !== '') {
              currentUser = msg.agilite.roles.currentUser
            }
          }

          if (msg.agilite.roles.responsibleUsers) {
            if (msg.agilite.roles.responsibleUsers !== '') {
              responsibleUsers = msg.agilite.roles.responsibleUsers
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

      if (conditionalLevels === '') {
        conditionalLevels = config.conditionalLevels
      }

      if (processKey === '') {
        processKey = config.processKey
      }

      if (bpmRecordId === '') {
        bpmRecordId = config.bpmRecordId
      }

      if (currentUser === '') {
        currentUser = config.currentUser
      }

      if (responsibleUsers === '') {
        responsibleUsers = config.responsibleUsers
      }

      // Mustache
      roleName = Mustache.render(roleName, msg)
      conditionalLevels = Mustache.render(conditionalLevels, msg)
      processKey = Mustache.render(processKey, msg)
      bpmRecordId = Mustache.render(bpmRecordId, msg)
      currentUser = Mustache.render(currentUser, msg)
      responsibleUsers = Mustache.render(responsibleUsers, msg)

      //  Finalize array properties
      roleName = roleName.split(',')
      conditionalLevels = conditionalLevels.split(',')
      responsibleUsers = responsibleUsers.split(',')

      // We need a apiKey, key and data to proceed
      if (apiKey === '') {
        success = false
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (url === '') {
        success = false
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '3': // Get Role
            if (roleName === '') {
              success = false
              errorMessage = 'No Role Name found'
            }

            break
          case '2': // Get Assigned Roles
            if (processKey === '') {
              success = false
              errorMessage = 'No BPM Process Key found'
            } else if (bpmRecordId === '') {
              success = false
              errorMessage = 'No BPM Record Id found'
            } else if (roleName === '') {
              success = false
              errorMessage = 'No Role Name found'
            }

            break
          case '1': // Assign Role
            if (processKey === '') {
              success = false
              errorMessage = 'No BPM Process Key found'
            } else if (bpmRecordId === '') {
              success = false
              errorMessage = 'No BPM Record Id found'
            } else if (roleName === '') {
              success = false
              errorMessage = 'No Role Name found'
            } else if (currentUser === '') {
              success = false
              errorMessage = 'No Current User found'
            } else if (responsibleUsers === '') {
              success = false
              errorMessage = 'No Responsible User(s) found'
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
        case '3': // Get Role
          agilite.Roles.getRole(roleName, conditionalLevels, data, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '2': // Get Assigned Roles
          agilite.Roles.getAssignedRoles(processKey, bpmRecordId, roleName, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '1': // Assign Role
          agilite.Roles.assignRole(processKey, bpmRecordId, roleName, currentUser, responsibleUsers, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        default:
          reqCatch({ response: { data: { errorMessage: 'No valid Action Type specified' }}})
          break
      }
    })
  }

  RED.nodes.registerType('roles', Roles)
}
