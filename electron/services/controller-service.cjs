const fs = require('fs')
const path = require('path')

const INPUT_BY_ID = '/dev/input/by-id'

const BUTTONS = {
  0: 'select',
  1: 'back',
  2: 'menu',
  3: 'secondary',
}

const DPAD_HORIZONTAL_AXIS = 6
const DPAD_VERTICAL_AXIS = 7

const LEFT_STICK_X_AXIS = 0
const LEFT_STICK_Y_AXIS = 1

/*
 * Analog-stick thresholds.
 *
 * The stick must pass DEADZONE to activate.
 * It must return inside RELEASE_ZONE before
 * that axis is considered centered again.
 */
const STICK_DEADZONE = 16000
const STICK_RELEASE_ZONE = 8000

/*
 * Console-style hold behavior.
 *
 * First movement happens immediately.
 * Repeating begins after REPEAT_DELAY.
 * Then movement repeats every REPEAT_INTERVAL.
 */
const REPEAT_DELAY = 300
const REPEAT_INTERVAL = 110

function findController() {
  if (!fs.existsSync(INPUT_BY_ID)) {
    return null
  }

  const devices = fs.readdirSync(INPUT_BY_ID)

  const joystick = devices.find(
    (device) =>
      device.endsWith('-joystick') &&
      !device.includes('-event-joystick')
  )

  if (!joystick) {
    return null
  }

  return path.join(
    INPUT_BY_ID,
    joystick
  )
}

function startController({
  onCommand,
  onConnected,
  onDisconnected,
} = {}) {
  const devicePath = findController()

  if (!devicePath) {
    console.log('No controller detected')
    return null
  }

  console.log(
    `Controller detected: ${devicePath}`
  )

  const stream = fs.createReadStream(
    devicePath,
    {
      highWaterMark: 8,
    }
  )

  /*
   * Current analog-stick direction.
   *
   * -1 = left/up
   *  0 = centered
   *  1 = right/down
   */
  const stickState = {
    horizontal: 0,
    vertical: 0,
  }

  /*
   * Track D-pad state separately from the
   * analog stick.
   */
  const dpadState = {
    horizontal: 0,
    vertical: 0,
  }

  /*
   * One repeat controller for each
   * navigation direction.
   */
  const repeatStates = {
    up: {
      sources: new Set(),
      delayTimer: null,
      intervalTimer: null,
    },

    down: {
      sources: new Set(),
      delayTimer: null,
      intervalTimer: null,
    },

    left: {
      sources: new Set(),
      delayTimer: null,
      intervalTimer: null,
    },

    right: {
      sources: new Set(),
      delayTimer: null,
      intervalTimer: null,
    },
  }

  function emitCommand(command) {
    console.log(
      `Controller command: ${command}`
    )

    if (onCommand) {
      onCommand(command)
    }
  }

  /*
   * Start navigation for a particular source.
   *
   * Example sources:
   *
   * dpad-horizontal
   * dpad-vertical
   * stick-horizontal
   * stick-vertical
   */
  function startDirection(
    direction,
    source
  ) {
    const state =
      repeatStates[direction]

    if (!state) {
      return
    }

    /*
     * Ignore duplicate events from the same
     * physical control while it remains held.
     */
    if (state.sources.has(source)) {
      return
    }

    const wasInactive =
      state.sources.size === 0

    state.sources.add(source)

    /*
     * If another source already holds this
     * direction, don't create another timer.
     */
    if (!wasInactive) {
      return
    }

    /*
     * Immediate first movement.
     */
    emitCommand(direction)

    /*
     * Wait briefly before beginning repeat.
     */
    state.delayTimer = setTimeout(() => {
      state.delayTimer = null

      /*
       * The direction may have been released
       * during the initial delay.
       */
      if (state.sources.size === 0) {
        return
      }

      state.intervalTimer =
        setInterval(() => {
          if (
            state.sources.size === 0
          ) {
            return
          }

          emitCommand(direction)
        }, REPEAT_INTERVAL)
    }, REPEAT_DELAY)
  }

  function stopDirection(
    direction,
    source
  ) {
    const state =
      repeatStates[direction]

    if (!state) {
      return
    }

    state.sources.delete(source)

    /*
     * Another physical control may still be
     * holding this same direction.
     */
    if (state.sources.size > 0) {
      return
    }

    if (state.delayTimer) {
      clearTimeout(
        state.delayTimer
      )

      state.delayTimer = null
    }

    if (state.intervalTimer) {
      clearInterval(
        state.intervalTimer
      )

      state.intervalTimer = null
    }
  }

  function stopAllDirections() {
    for (
      const state of
      Object.values(repeatStates)
    ) {
      state.sources.clear()

      if (state.delayTimer) {
        clearTimeout(
          state.delayTimer
        )

        state.delayTimer = null
      }

      if (state.intervalTimer) {
        clearInterval(
          state.intervalTimer
        )

        state.intervalTimer = null
      }
    }
  }

  function handleButton(
    number,
    value
  ) {
    /*
     * Face buttons currently fire only
     * on button-down.
     */
    if (value !== 1) {
      return
    }

    const command =
      BUTTONS[number]

    if (command) {
      emitCommand(command)
    }
  }

  function updateDpadHorizontal(
    value
  ) {
    const source =
      'dpad-horizontal'

    let nextState = 0

    if (value < 0) {
      nextState = -1
    } else if (value > 0) {
      nextState = 1
    }

    if (
      nextState ===
      dpadState.horizontal
    ) {
      return
    }

    /*
     * Release previous direction.
     */
    if (
      dpadState.horizontal === -1
    ) {
      stopDirection(
        'left',
        source
      )
    }

    if (
      dpadState.horizontal === 1
    ) {
      stopDirection(
        'right',
        source
      )
    }

    dpadState.horizontal =
      nextState

    /*
     * Start new direction.
     */
    if (nextState === -1) {
      startDirection(
        'left',
        source
      )
    }

    if (nextState === 1) {
      startDirection(
        'right',
        source
      )
    }
  }

  function updateDpadVertical(
    value
  ) {
    const source =
      'dpad-vertical'

    let nextState = 0

    if (value < 0) {
      nextState = -1
    } else if (value > 0) {
      nextState = 1
    }

    if (
      nextState ===
      dpadState.vertical
    ) {
      return
    }

    if (
      dpadState.vertical === -1
    ) {
      stopDirection(
        'up',
        source
      )
    }

    if (
      dpadState.vertical === 1
    ) {
      stopDirection(
        'down',
        source
      )
    }

    dpadState.vertical =
      nextState

    if (nextState === -1) {
      startDirection(
        'up',
        source
      )
    }

    if (nextState === 1) {
      startDirection(
        'down',
        source
      )
    }
  }

  function handleDpad(
    number,
    value
  ) {
    if (
      number ===
      DPAD_HORIZONTAL_AXIS
    ) {
      updateDpadHorizontal(
        value
      )

      return true
    }

    if (
      number ===
      DPAD_VERTICAL_AXIS
    ) {
      updateDpadVertical(
        value
      )

      return true
    }

    return false
  }

  function updateStickHorizontal(
    value
  ) {
    const source =
      'stick-horizontal'

    let nextState =
      stickState.horizontal

    if (
      value <=
      -STICK_DEADZONE
    ) {
      nextState = -1
    } else if (
      value >=
      STICK_DEADZONE
    ) {
      nextState = 1
    } else if (
      Math.abs(value) <=
      STICK_RELEASE_ZONE
    ) {
      nextState = 0
    }

    if (
      nextState ===
      stickState.horizontal
    ) {
      return
    }

    if (
      stickState.horizontal === -1
    ) {
      stopDirection(
        'left',
        source
      )
    }

    if (
      stickState.horizontal === 1
    ) {
      stopDirection(
        'right',
        source
      )
    }

    stickState.horizontal =
      nextState

    if (nextState === -1) {
      startDirection(
        'left',
        source
      )
    }

    if (nextState === 1) {
      startDirection(
        'right',
        source
      )
    }
  }

  function updateStickVertical(
    value
  ) {
    const source =
      'stick-vertical'

    let nextState =
      stickState.vertical

    if (
      value <=
      -STICK_DEADZONE
    ) {
      nextState = -1
    } else if (
      value >=
      STICK_DEADZONE
    ) {
      nextState = 1
    } else if (
      Math.abs(value) <=
      STICK_RELEASE_ZONE
    ) {
      nextState = 0
    }

    if (
      nextState ===
      stickState.vertical
    ) {
      return
    }

    if (
      stickState.vertical === -1
    ) {
      stopDirection(
        'up',
        source
      )
    }

    if (
      stickState.vertical === 1
    ) {
      stopDirection(
        'down',
        source
      )
    }

    stickState.vertical =
      nextState

    if (nextState === -1) {
      startDirection(
        'up',
        source
      )
    }

    if (nextState === 1) {
      startDirection(
        'down',
        source
      )
    }
  }

  function handleLeftStick(
    number,
    value
  ) {
    if (
      number ===
      LEFT_STICK_X_AXIS
    ) {
      updateStickHorizontal(
        value
      )

      return
    }

    if (
      number ===
      LEFT_STICK_Y_AXIS
    ) {
      updateStickVertical(
        value
      )
    }
  }

  stream.on('open', () => {
    console.log(
      'Controller connected'
    )

    if (onConnected) {
      onConnected(devicePath)
    }
  })

  stream.on('data', (buffer) => {
    for (
      let offset = 0;
      offset + 8 <= buffer.length;
      offset += 8
    ) {
      const event =
        buffer.subarray(
          offset,
          offset + 8
        )

      const value =
        event.readInt16LE(4)

      const rawType =
        event.readUInt8(6)

      const number =
        event.readUInt8(7)

      const isInitial =
        (rawType & 0x80) !== 0

      const eventType =
        rawType & 0x7f

      if (isInitial) {
        continue
      }

      /*
       * Button event.
       */
      if (eventType === 0x01) {
        handleButton(
          number,
          value
        )

        continue
      }

      /*
       * Axis event.
       */
      if (eventType === 0x02) {
        const handledAsDpad =
          handleDpad(
            number,
            value
          )

        if (!handledAsDpad) {
          handleLeftStick(
            number,
            value
          )
        }
      }
    }
  })

  stream.on('error', (error) => {
    stopAllDirections()

    console.error(
      'Controller error:',
      error
    )
  })

  stream.on('close', () => {
    stopAllDirections()

    console.log(
      'Controller disconnected'
    )

    if (onDisconnected) {
      onDisconnected()
    }
  })

  return stream
}

module.exports = {
  findController,
  startController,
}
