const { mapEffect, batchEffects } = require('raj-compose')

function mapSubscription (subscription, callback) {
  return {
    effect: mapEffect(subscription.effect, callback),
    cancel: subscription.cancel
  }
}

function batchSubscriptions (subscriptions) {
  const effects = []
  const cancels = []
  subscriptions.forEach(subscription => {
    effects.push(subscription.effect)
    cancels.push(subscription.cancel)
  })

  return {
    effect: batchEffects(effects),
    cancel: batchEffects(cancels)
  }
}

const hasOwnProperty = Object.prototype.hasOwnProperty

function transition (cancelMap, subscriptionMap) {
  const keys = [].concat(Object.keys(cancelMap), Object.keys(subscriptionMap))
  const visitedKeyMap = {}
  const effects = []
  const newCancelMap = {}
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    if (visitedKeyMap[key]) {
      continue
    }
    visitedKeyMap[key] = true

    const cancel = cancelMap[key]
    const hasCancel = hasOwnProperty.call(cancelMap, key)
    const subscription = subscriptionMap[key]
    if (hasCancel && !subscription) {
      effects.push(cancel)
    } else if (!hasCancel && subscription) {
      const { effect, cancel } = subscription()
      effects.push(effect)
      newCancelMap[key] = cancel
    } else if (hasCancel) {
      newCancelMap[key] = cancel
    }
  }
  return { effect: batchEffects(effects), cancelMap: newCancelMap }
}

function withSubscriptions (program) {
  const [programModel, programEffect] = program.init
  const { effect, cancelMap } = transition(
    {},
    program.subscriptions(programModel)
  )
  const init = [
    { cancelMap, programModel },
    batchEffects([programEffect, effect])
  ]

  function update (msg, model) {
    const [programModel, programEffect] = program.update(
      msg,
      model.programModel
    )
    const { effect, cancelMap } = transition(
      model.cancelMap,
      program.subscriptions(programModel)
    )
    return [{ cancelMap, programModel }, batchEffects([programEffect, effect])]
  }

  function done (model) {
    transition(model.cancelMap, {}).effect()
    if (program.done) {
      program.done(model.programModel)
    }
  }

  function view (model, dispatch) {
    return program.view(model.programModel, dispatch)
  }

  return { init, update, done, view }
}

exports.mapSubscription = mapSubscription
exports.batchSubscriptions = batchSubscriptions
exports.withSubscriptions = withSubscriptions
