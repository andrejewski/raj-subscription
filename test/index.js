import test from 'ava'
import { mapSubscription, batchSubscriptions, withSubscriptions } from '../src'

const testSubscription = () => {
  let dispatch
  const events = []
  return {
    events,
    emit (msg) {
      if (dispatch) {
        dispatch(msg)
        events.push(msg)
      }
    },
    effect: callback => {
      events.push('begin')
      dispatch = callback
    },
    cancel: () => {
      events.push('end')
    }
  }
}

test('mapSubscription should wrap messages with callback', t => {
  const sub = testSubscription()
  const messages = []

  const mappedSub = mapSubscription(sub, msg => ({ value: msg }))
  mappedSub.effect(msg => messages.push(msg))

  sub.emit('foo')
  sub.emit('bar')

  t.deepEqual(messages, [{ value: 'foo' }, { value: 'bar' }])
})

test('mapSubscription should call original effect/cancel', t => {
  const sub = testSubscription()
  const mappedSub = mapSubscription(sub, x => x)
  mappedSub.effect(() => {})
  mappedSub.cancel()

  t.deepEqual(sub.events, ['begin', 'end'])
})

test('batchSubscriptions should dispatch subscription messages', t => {
  const subs = [1, 2, 3].map(() => testSubscription())
  const batchSub = batchSubscriptions(subs)
  const messages = []

  batchSub.effect(msg => messages.push(msg))
  subs[0].emit('foo')
  subs[1].emit('bar')
  subs[0].emit('baz')
  subs[2].emit('faz')

  t.deepEqual(messages, ['foo', 'bar', 'baz', 'faz'])
})

test('batchSubscriptions should call all original effects/cancels', t => {
  const subs = [1, 2, 3].map(() => testSubscription())
  const batchSub = batchSubscriptions(subs)

  batchSub.effect(() => {})
  batchSub.cancel()

  subs.forEach(sub => {
    t.deepEqual(sub.events, ['begin', 'end'])
  })
})

test('withSubscriptions should setup/teardown subscriptions on init/done', t => {
  const sub = testSubscription()
  const childProgram = {
    init: [],
    update: () => [],
    subscriptions: model => ({
      sub: () => sub
    }),
    done () {}
  }

  const program = withSubscriptions(childProgram)
  const [model, effect] = program.init
  effect(() => {})

  t.deepEqual(sub.events, ['begin'])

  program.done(model)

  t.deepEqual(sub.events, ['begin', 'end'])
})

test('withSubscriptions should do nothing for no active subscriptions', t => {
  const sub = testSubscription()
  const childProgram = {
    init: [{ isSubscribed: false }],
    update: () => [],
    subscriptions: model => ({
      sub: model.isSubscribed && (() => sub)
    })
  }

  const program = withSubscriptions(childProgram)
  const [model, effect] = program.init

  effect(() => {})
  t.deepEqual(sub.events, [])
  program.done(model)
  t.deepEqual(sub.events, [])
})

test('withSubscriptions should setup/teardown subscriptions on model change', t => {
  const sub = testSubscription()
  const childProgram = {
    init: [{ isSubscribed: false }],
    update: isSubscribed => [{ isSubscribed }],
    subscriptions: model => ({
      sub: model.isSubscribed && (() => sub)
    })
  }

  const program = withSubscriptions(childProgram)
  const [initialModel] = program.init
  const [activeModel, effect] = program.update(true, initialModel)

  effect(() => {})
  t.deepEqual(sub.events, ['begin'])

  const [, cancel] = program.update(false, activeModel)
  cancel(() => {})
  t.deepEqual(sub.events, ['begin', 'end'])
})
