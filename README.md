# Raj Subscription
> Subscription utilities for [Raj](https://github.com/andrejewski/raj)

```sh
npm install raj-subscription
```

[![npm](https://img.shields.io/npm/v/raj-subscription.svg)](https://www.npmjs.com/package/raj-subscription)
[![Build Status](https://travis-ci.org/andrejewski/raj-subscription.svg?branch=master)](https://travis-ci.org/andrejewski/raj-subscription)
[![Greenkeeper badge](https://badges.greenkeeper.io/andrejewski/raj-subscription.svg)](https://greenkeeper.io/)

The `raj-subscription` package contains utilities to reduce the boilerplate of
working with subscriptions. Subscriptions are effects that can be cancelled.
The subscription shape is:

```ts
interface RajSubscription<T> {
  effect: Effect<T>,
  cancel: Effect<Never>
}
```

## Documentation
The package contains the following utilities:

- [`mapSubscription(subscription, callback)`](#mapsubscription)
- [`batchSubscription(subscriptions)`](#batchsubscriptions)
- [`withSubscriptions(program)`](#withsubscriptions)

### `mapSubscription`

> `mapSubscription(subscription: RajSubscription, callback(any): any): RajSubscription`

The `mapSubscription` function "lifts" a given `subscription` so that `callback` transforms
  each message produced by that subscription before dispatch.

This function is analogous to the [`raj-compose/mapEffect`](https://github.com/andrejewski/raj-compose/blob/master/README.md#mapeffecteffect-function-callbackany-any-function) function.

#### Example
We want to distinguish the messages dispatched by an subscription.
We use `mapSubscription` to wrap each message in an "important" wrapper.

```js
import assert from 'assert'
import { mapSubscription } from 'raj-subscription'

function tickSubscription () {
  let timerId
  let count = 1
  return {
    effect (dispatch) {
      timerId = setInterval(() => dispatch(count++), 1000)
    },
    cancel () {
      clearInterval(timerId)
    }
  }
}

const importantSubscription = mapSubscription(tickSubscription(), message => ({
  type: 'important',
  value: message
}))

const messages = []
importantSubscription.effect(message => {
  messages.push(message)
})

setTimeout(() => {
  importantSubscription.cancel()

  assert.deepEqual(messages, [
    {type: 'important', value: 1},
    {type: 'important', value: 2}
  ])
}, 2500)
```

### `batchSubscriptions`

> `batchSubscriptions(subscriptions: Array<RajSubscription>): RajSubscription`

The `batchSubscriptions` function takes an array of `subscriptions` and returns a new
  subscription which will call each subscription.

This function is analogous to the [`raj-compose/batchEffects`](https://github.com/andrejewski/raj-compose/blob/master/README.md#batcheffectseffects-arrayfunction-function) function.

### `withSubscriptions`

> `withSubscriptions(program: RajProgramWithSubscriptions): RajProgram`

Subscriptions are setup and torn down during a program's lifetime.
To make subscriptions declarative, we can define our active subscriptions as a function of the current state.

```js
const subscriptions = model => ({
  tick: model.isTicking && () => tickSubscription()
})
```

When `model.isTicking` is true, the `tickSubscription` will be active.
When the `tick` subscription appears in the map, we start the subscription.
When the `tick` subscription leaves the map, we cancel the subscription.

Notice the function closure around the `tickSubscription` call.
We do not create new subscriptions every time `subscriptions` is called, because they may already be active.
While redundant for `tickSubscription`, plain subscriptions need to be wrapped in a function.

To use this declarative style, we add a `subscriptions` function to our program's definition.
The program is then wrapped with the high-order-program (HOP) `withSubscription`. 
This wrapper will manage our declarative subscriptions for us.

```js
import { withSubscriptions } from 'raj-subscription'

const program = withSubscriptions({
  init: [],
  update: (msg, model) => [model],
  subscriptions: model => ({}),
  view (model, dispatch) {}
})
```