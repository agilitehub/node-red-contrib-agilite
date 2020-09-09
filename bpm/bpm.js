const Agilite = require('agilite')
const typeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function Bpm (config) {
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
      let currentUser = config.currentUser
      let bpmRecordId = config.bpmRecordId
      let optionSelected = config.optionSelected
      let bpmRecordIds = config.bpmRecordIds
      let responsibleUsers = config.responsibleUsers
      let stepNames = config.stepNames
      let relevantUsers = config.relevantUsers
      let history = config.excludeHistory
      let stepOptions = config.excludeStepOptions
      let visibleObjects = config.excludeVisibleObjects
      let profileKeys = config.profileKeys
      let page = config.page
      let pageLimit = config.pageLimit
      let sort = config.sort
      let comments = ''
      let url = serverConfig.server
      let data = {}
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

        if (msg.agilite.bpm) {
          if (msg.agilite.bpm.profileKey) {
            if (msg.agilite.bpm.profileKey !== '') {
              profileKey = msg.agilite.bpm.profileKey
            }
          }

          if (msg.agilite.bpm.currentUser) {
            if (msg.agilite.bpm.currentUser !== '') {
              currentUser = msg.agilite.bpm.currentUser
            }
          }

          if (msg.agilite.bpm.bpmRecordId) {
            if (msg.agilite.bpm.bpmRecordId !== '') {
              bpmRecordId = msg.agilite.bpm.bpmRecordId
            }
          }

          if (msg.agilite.bpm.optionSelected) {
            if (msg.agilite.bpm.optionSelected !== '') {
              optionSelected = msg.agilite.bpm.optionSelected
            }
          }

          if (msg.agilite.bpm.bpmRecordIds) {
            if (msg.agilite.bpm.bpmRecordIds !== '') {
              bpmRecordIds = msg.agilite.bpm.bpmRecordIds
            }
          }

          if (msg.agilite.bpm.responsibleUsers) {
            if (msg.agilite.bpm.responsibleUsers !== '') {
              responsibleUsers = msg.agilite.bpm.responsibleUsers
            }
          }

          if (msg.agilite.bpm.stepNames) {
            if (msg.agilite.bpm.stepNames !== '') {
              stepNames = msg.agilite.bpm.stepNames
            }
          }

          if (msg.agilite.bpm.relevantUsers) {
            if (msg.agilite.bpm.relevantUsers !== '') {
              relevantUsers = msg.agilite.bpm.relevantUsers
            }
          }

          if (msg.agilite.bpm.profileKeys) {
            if (msg.agilite.bpm.profileKeys !== '') {
              profileKeys = msg.agilite.bpm.profileKeys
            }
          }

          if (msg.agilite.bpm.page) {
            if (msg.agilite.bpm.page !== '') {
              page = msg.agilite.bpm.page
            }
          }

          if (msg.agilite.bpm.pageLimit) {
            if (msg.agilite.bpm.pageLimit !== '') {
              pageLimit = msg.agilite.bpm.pageLimit
            }
          }

          if (msg.agilite.bpm.sort) {
            if (msg.agilite.bpm.sort !== '') {
              sort = msg.agilite.bpm.sort
            }
          }
        }
      }

      if (apiKey === '') {
        apiKey = serverConfig.credentials.apiKey
      }

      // We need a apiKey, key and data to proceed
      if (apiKey === '') {
        success = false
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (url === '') {
        success = false
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '1': // Register BPM Record
            if (profileKey === '') {
              success = false
              errorMessage = 'No Profile Key found'
            }

            if (currentUser === '') {
              success = false
              errorMessage = 'No Current User found'
            }

            break
          case '2': // Execute
            if (profileKey === '') {
              success = false
              errorMessage = 'No Profile Key found'
            }

            if (bpmRecordId === '') {
              success = false
              errorMessage = 'No BPM Record Id found'
            }

            if (optionSelected === '') {
              success = false
              errorMessage = 'No Option Selected found'
            }

            if (currentUser === '') {
              success = false
              errorMessage = 'No Current User found'
            }

            break
          case '3': // Get Record State
            if (profileKeys === '') {
              success = false
              errorMessage = 'No Profile Keys found'
            }

            break
          case '4': // Get By Profile Key
            if (profileKey === '') {
              success = false
              errorMessage = 'No Profile Key found'
            }

            break
          case '5': // Get Active Steps
          case '6': // Get Active Users
            if (profileKey === '') {
              success = false
              errorMessage = 'No Profile Key found'
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

      //  Format Mustache properties
      profileKey = Mustache.render(profileKey, msg)
      currentUser = Mustache.render(currentUser, msg)
      bpmRecordId = Mustache.render(bpmRecordId, msg)
      optionSelected = Mustache.render(optionSelected, msg)
      bpmRecordIds = Mustache.render(bpmRecordIds, msg)
      responsibleUsers = Mustache.render(responsibleUsers, msg)
      stepNames = Mustache.render(stepNames, msg)
      relevantUsers = Mustache.render(relevantUsers, msg)
      profileKeys = Mustache.render(profileKeys, msg)
      if (page) page = Mustache.render(page, msg)
      if (pageLimit) pageLimit = Mustache.render(pageLimit, msg)
      if (sort) sort = Mustache.render(sort, msg)

      //  Finalize array properties
      profileKeys = profileKeys.split(',')
      bpmRecordIds = bpmRecordIds.split(',')
      stepNames = stepNames.split(',')
      responsibleUsers = responsibleUsers.split(',')
      relevantUsers = relevantUsers.split(',')

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
        case '1': // Register BPM Record
          agilite.BPM.registerBPMRecord(profileKey, currentUser, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '2': // Execute
          agilite.BPM.execute(profileKey, bpmRecordId, optionSelected, currentUser, comments, data, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '3': // Get Record State
          agilite.BPM.getRecordState(profileKeys, bpmRecordIds, stepNames, responsibleUsers, relevantUsers, history, stepOptions, visibleObjects, page, pageLimit, sort, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '4': // Get By Profile Key
          agilite.BPM.getByProfileKey(profileKey, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '5': // Get Active Steps
          agilite.BPM.getActiveSteps(profileKey, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        case '6': // Get Active Users
          agilite.BPM.getActiveUsers(profileKey, logProcessId)
            .then(reqSuccess)
            .catch(reqCatch)
          break
        default:
          reqCatch({ response: { data: { errorMessage: 'No valid Action Type specified' } } })
          break
      }
    })
  }

  RED.nodes.registerType('bpm', Bpm)
}
