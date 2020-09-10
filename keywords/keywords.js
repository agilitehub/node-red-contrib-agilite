const Agilite = require('agilite')

module.exports = function (RED) {
  function Keywords (config) {
    RED.nodes.createNode(this, config)

    let node = this
    let success = true
    let errorMessage = ''
    this.field = config.field || 'payload'
    this.fieldType = config.fieldType || 'msg'

    const typeDetect = require('type-detect')
    const Mustache = require('mustache')

    node.status({
      fill: 'blue',
      text: 'ready',
      shape: 'ring'
    })

    this.on('input', function (msg) {
      let serverConfig = RED.nodes.getNode(config.server)
      let apiKey = ''
      let logProcessId = null
      let recordId = config.recordId
      let profileKey = config.profileKey
      let groupName = config.groupName
      let labelKey = config.labelKey
      let valueKey = config.valueKey
      let sortBy = config.sortBy
      let sortBy2 = config.sortBy2
      let outputFormat = config.outputFormat
      let outputFormat2 = config.outputFormat2
      let url = ''
      let data = {}
      let failFlow = config.failFlow

      //  Function that is called inside .then of requests
      let reqSuccess = function (response) {
        if (response.status === 200) {
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
        } else {
          msg.payload = {}

          node.status({
            fill: 'red',
            text: 'Error',
            shape: 'ring'
          })

          if (failFlow) {
            node.error(msg.agilite.message, msg)
          } else {
            node.send(msg)
          }
        }
      }

      //  Function that is used inside the .catch of requests
      let reqCatch = function (error) {
        msg.payload = {}

        if (error.response && error.response.data) {
          msg.agilite.message = error.response.data.errorMessage
        } else {
          msg.agilite.message = 'Unknown Error Occurred'
        }

        node.status({
          fill: 'red',
          text: 'Error',
          shape: 'ring'
        })

        if (failFlow) {
          node.error(msg.agilite.message, msg)
        } else {
          node.send(msg)
        }
      }

      url = serverConfig.server

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

        if (msg.agilite.keywords) {
          if (msg.agilite.keywords.recordId) {
            if (msg.agilite.keywords.recordId !== '') {
              recordId = msg.agilite.keywords.recordId
            }
          }

          if (msg.agilite.keywords.profileKey) {
            if (msg.agilite.keywords.profileKey !== '') {
              profileKey = msg.agilite.keywords.profileKey
            }
          }

          if (msg.agilite.keywords.groupName) {
            if (msg.agilite.keywords.groupName !== '') {
              groupName = msg.agilite.keywords.groupName
            }
          }

          if (msg.agilite.keywords.labelKey) {
            if (msg.agilite.keywords.labelKey !== '') {
              labelKey = msg.agilite.keywords.labelKey
            }
          }

          if (msg.agilite.keywords.valueKey) {
            if (msg.agilite.keywords.valueKey !== '') {
              valueKey = msg.agilite.keywords.valueKey
            }
          }

          if (msg.agilite.keywords.sortBy) {
            if (msg.agilite.keywords.sortBy !== '') {
              sortBy = msg.agilite.keywords.sortBy
            }
          }

          if (msg.agilite.keywords.sortBy2) {
            if (msg.agilite.keywords.sortBy2 !== '') {
              sortBy2 = msg.agilite.keywords.sortBy2
            }
          }

          if (msg.agilite.keywords.outputFormat) {
            if (msg.agilite.keywords.outputFormat !== '') {
              outputFormat = msg.agilite.keywords.outputFormat
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
          case '1': // Get Keywords By Profile Key
            if (profileKey === '') {
              success = false
              errorMessage = 'No Profile Key found'
            }

            break
          case '2': // Get Profile Keys By Group
            if (groupName === '') {
              success = false
              errorMessage = 'No Group Name found'
            }

            break
          case '3': // Get Keyword Value by Label
            if (profileKey === '') {
              success = false
              errorMessage = 'No Profile Key found'
            } else if (labelKey === '') {
              success = false
              errorMessage = 'No Label Key found'
            }

            break
          case '4': // Get Keyword Label by Value
            if (profileKey === '') {
              success = false
              errorMessage = 'No Profile Key found'
            } else if (valueKey === '') {
              success = false
              errorMessage = 'No Value Key found'
            }

            break
          case '5': // Create Keyword
            // data object should exist in msg.payload i.e msg.payload.data.isActive etc
            if (!data.data) {
              success = false
              errorMessage = 'No valid data object found in msg.payload'
            }

            if (data.data) {
              if (data.data.isActive === '') {
                success = false
                errorMessage = 'isActive Property is required'
              }

              if (data.data.key === '') {
                success = false
                errorMessage = 'No Key Property found'
              }
            }

            break
          case '6': // Update Keyword Record
          case '7': // Get Keyword Record By Id
            if (recordId === '') {
              success = false
              errorMessage = 'No Record Id found'
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

      // Mustache
      recordId = Mustache.render(recordId, msg)
      profileKey = Mustache.render(profileKey, msg)
      groupName = Mustache.render(groupName, msg)
      labelKey = Mustache.render(labelKey, msg)
      valueKey = Mustache.render(valueKey, msg)

      //  Create New instance of Agilite Module that will be performing requests
      const agilite = new Agilite({
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
        case '1': // Get Keywords By Profile Key
          agilite.Keywords.getByProfileKey(profileKey, sortBy, outputFormat, logProcessId)
            .then(function (response) {
              reqSuccess(response)
            })
            .catch(function (error) {
              reqCatch(error)
            })
          break
        case '2': // Get Profile Keys By Group
          agilite.Keywords.getProfileKeysByGroup(groupName, sortBy2, logProcessId)
            .then(function (response) {
              reqSuccess(response)
            })
            .catch(function (error) {
              reqCatch(error)
            })
          break
        case '3': // Get Keyword Value by Label
          agilite.Keywords.getValueByLabel(profileKey, labelKey, outputFormat2, logProcessId)
            .then(function (response) {
              reqSuccess(response)
            })
            .catch(function (error) {
              reqCatch(error)
            })
          break
        case '4': // Get Keyword Label by Value
          agilite.Keywords.getLabelByValue(profileKey, valueKey, outputFormat2, logProcessId)
            .then(function (response) {
              reqSuccess(response)
            })
            .catch(function (error) {
              reqCatch(error)
            })
          break
        case '5': // Create Keyword Record
          agilite.Keywords.postData(data, logProcessId)
            .then(function (response) {
              reqSuccess(response)
            })
            .catch(function (error) {
              reqCatch(error)
            })
          break
        case '6': // Update Keyword Record
          agilite.Keywords.putData(recordId, data, logProcessId)
            .then(function (response) {
              reqSuccess(response)
            })
            .catch(function (error) {
              reqCatch(error)
            })
          break
        default:
          reqCatch({ response: { data: { errorMessage: 'No valid Action Type specified' }}})
          break
      }
    })
  }

  RED.nodes.registerType('keywords', Keywords)
}
