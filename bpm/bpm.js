const Agilite = require('agilite')
const TypeDetect = require('type-detect')
const Mustache = require('mustache')

module.exports = function (RED) {
  function BPM (config) {
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
      const history = config.excludeHistory
      const stepOptions = config.excludeStepOptions
      const visibleObjects = config.excludeVisibleObjects
      const comments = ''
      const url = serverConfig.server
      const failFlow = config.failFlow
      let agilite = null
      const includeKeywords = config.includeKeywords
      let apiKey = ''
      let logProfileKey = ''
      let profileKey = config.profileKey
      let currentUser = config.currentUser
      let currentStep = config.currentStep
      let bpmRecordId = config.bpmRecordId
      let optionSelected = config.optionSelected
      let bpmRecordIds = config.bpmRecordIds
      let responsibleUsers = config.responsibleUsers
      let stepNames = config.stepNames
      let roleNames = config.roleNames
      let relevantUsers = config.relevantUsers
      let relevantRoles = config.relevantRoles
      let eventStamps = config.eventStamps
      let eventStartDate = config.eventStartDate
      let eventEndDate = config.eventEndDate
      let profileKeys = config.profileKeys
      let isoLanguage = config.isoLanguage
      let page = config.page
      let pageLimit = config.pageLimit
      let sort = config.sort
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
      if (msg.agilite) if (msg.agilite.logProfileKey) logProfileKey = msg.agilite.logProfileKey
      if (!apiKey) apiKey = serverConfig.credentials.apiKey

      // We need a apiKey, key and data to proceed
      if (!apiKey) {
        errorMessage = 'No valid API Key Provided. Please authenticate with Agilit-e first'
      } else if (!url) {
        errorMessage = 'No Server URL Provided'
      } else {
        switch (config.actionType) {
          case '1': // Register BPM Record
            if (!profileKey) errorMessage = 'No Profile Key found'
            if (!currentUser) errorMessage = 'No Current User found'
            break
          case '2': // Execute
            if (!profileKey) errorMessage = 'No Profile Key found'
            if (!bpmRecordId) errorMessage = 'No BPM Record Id found'
            if (!optionSelected) errorMessage = 'No Option Selected found'
            if (!currentUser) errorMessage = 'No Current User found'
            if (!currentStep) errorMessage = 'No Current Step found'
            break
          case '3': // Get Record State
            if (!profileKeys) errorMessage = 'No Profile Keys found'
            break
          case '4': // Get By Profile Key
            if (!profileKey) errorMessage = 'No Profile Key found'
            break
          case '5': // Get Active Steps
          case '6': // Get Active Users
            if (!profileKey) errorMessage = 'No Profile Key found'
            break
          case '7': // Assign Role
            if (!profileKey) {
              errorMessage = 'No Profile Key found'
            } else if (!bpmRecordId) {
              errorMessage = 'No BPM Record Id found'
            } else if (!roleNames) {
              errorMessage = 'No Role Name(s) found'
            } else if (!currentUser) {
              errorMessage = 'No Current User found'
            } else if (!responsibleUsers) {
              errorMessage = 'No Responsible User(s) found'
            }

            break
          case '8': // Get Assigned Roles
            if (!profileKey) {
              errorMessage = 'No Profile Key found'
            } else if (!bpmRecordId) {
              errorMessage = 'No BPM Record Id found'
            } else if (!roleNames) {
              errorMessage = 'No Role Name(s) found'
            }
            break
        }
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

      //  Format Mustache properties
      if (profileKey) profileKey = Mustache.render(profileKey, msg)
      if (currentUser) currentUser = Mustache.render(currentUser, msg)
      if (currentStep) currentStep = Mustache.render(currentStep, msg)
      if (bpmRecordId) bpmRecordId = Mustache.render(bpmRecordId, msg)
      if (optionSelected) optionSelected = Mustache.render(optionSelected, msg)
      if (bpmRecordIds) bpmRecordIds = Mustache.render(bpmRecordIds, msg)
      if (responsibleUsers) responsibleUsers = Mustache.render(responsibleUsers, msg)
      if (stepNames) stepNames = Mustache.render(stepNames, msg)
      if (roleNames) roleNames = Mustache.render(roleNames, msg)
      if (relevantUsers) relevantUsers = Mustache.render(relevantUsers, msg)
      if (profileKeys) profileKeys = Mustache.render(profileKeys, msg)
      if (isoLanguage) isoLanguage = Mustache.render(isoLanguage, msg)
      if (page) page = Mustache.render(page, msg)
      if (pageLimit) pageLimit = Mustache.render(pageLimit, msg)
      if (relevantRoles) relevantRoles = Mustache.render(relevantRoles, msg)
      if (eventStartDate) eventStartDate = Mustache.render(eventStartDate, msg)
      if (eventEndDate) eventEndDate = Mustache.render(eventEndDate, msg)
      if (eventStamps) eventStamps = Mustache.render(eventStamps, msg)
      if (sort) sort = Mustache.render(sort, msg)

      //  Finalize array properties
      profileKeys ? profileKeys = profileKeys.split(',') : profileKeys = []
      bpmRecordIds ? bpmRecordIds = bpmRecordIds.split(',') : bpmRecordIds = []
      stepNames ? stepNames = stepNames.split(',') : stepNames = []
      roleNames ? roleNames = roleNames.split(',') : roleNames = []
      responsibleUsers ? responsibleUsers = responsibleUsers.split(',') : responsibleUsers = []
      relevantUsers ? relevantUsers = relevantUsers.split(',') : relevantUsers = []
      relevantRoles ? relevantRoles = relevantRoles.split(',') : relevantRoles = []
      eventStamps ? eventStamps = eventStamps.split(',') : eventStamps = []

      node.status({
        fill: 'yellow',
        text: 'Running',
        shape: 'ring'
      })

      try {
        switch (config.actionType) {
          case '1': // Register BPM Record
            result = await agilite.BPM.registerBPMRecord(profileKey, currentUser, history, stepOptions, visibleObjects, includeKeywords, isoLanguage, logProfileKey)
            break
          case '2': // Execute
            result = await agilite.BPM.execute(profileKey, bpmRecordId, optionSelected, currentUser, currentStep, comments, data, history, stepOptions, visibleObjects, includeKeywords, isoLanguage, logProfileKey)
            break
          case '3': // Get Record State
            result = await agilite.BPM.getRecordState(profileKeys, bpmRecordIds, stepNames, responsibleUsers, relevantUsers, relevantRoles, eventStamps, eventStartDate, eventEndDate, history, stepOptions, visibleObjects, includeKeywords, page, pageLimit, sort, isoLanguage, logProfileKey)
            break
          case '4': // Get By Profile Key
            result = await agilite.BPM.getByProfileKey(profileKey, logProfileKey)
            break
          case '5': // Get Active Steps
            result = await agilite.BPM.getActiveSteps(profileKey, isoLanguage, logProfileKey)
            break
          case '6': // Get Active Users
            result = await agilite.BPM.getActiveUsers(profileKey, logProfileKey)
            break
          case '7': // Assign Role
            result = await agilite.BPM.assignRole(profileKey, bpmRecordId, roleNames[0], currentUser, responsibleUsers, logProfileKey)
            break
          case '8': // Get Assigned Roles
            result = await agilite.BPM.getAssignedRoles(profileKey, bpmRecordId, roleNames, logProfileKey)
            break
          case '9': // Lock Record
            result = await agilite.BPM.lockRecord(bpmRecordId, logProfileKey)
            break
          case '10': // Unlock Record
            result = await agilite.BPM.unlockRecord(bpmRecordId, logProfileKey)
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

  RED.nodes.registerType('bpm', BPM)
}
