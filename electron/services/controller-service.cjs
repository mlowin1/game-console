const fs = require('fs')
const path = require('path')

const {
  getControllerMapping,
} = require('../controllers/mappings.cjs')

const INPUT_BY_ID = '/dev/input/by-id'

/*
 * Analog-stick thresholds.
 */
const STICK_DEADZONE = 16000
const STICK_RELEASE_ZONE = 8000

/*
 * Console-style hold behavior.
 */
const REPEAT_DELAY = 300
const REPEAT_INTERVAL = 110

/*
 * How often we look for a controller when
 * one isn't currently connected.
 */
const DISCOVERY_INTERVAL = 1000

function findController() {
  if (!fs.existsSync(INPUT_BY_ID)) {
    return null
  }

  try {
    const devices =
      fs.readdirSync(INPUT_BY_ID)

    const joystick = devices.find(
      (device) =>
        device.endsWith('-joystick') &&
        !device.includes(
          '-event-joystick'
        )
    )

    if (!joystick) {
      return null
    }

    return path.join(
      INPUT_BY_ID,
      joystick
    )
  } catch (error) {
    console.error(
      'Failed to scan for controllers:',
      error
    )

    return null
  }
}

/*
 * Open one controller and translate its
 * Linux joystick events into normalized
 * launcher commands.
 */
function openController(
  devicePath,
  {
    onCommand,
    onConnected,
    onDisconnected,
  } = {}
) {
  const mapping =
    getControllerMapping(
      path.basename(devicePath)
    )

  console.log(
    `Controller detected: ${devicePath}`
  )

  console.log(
    `Controller mapping: ${mapping.name}`
  )

  const stream =
    fs.createReadStream(
      devicePath,
      {
        highWaterMark: 8,
      }
    )

  const stickState = {
    horizontal: 0,
    vertical: 0,
  }

  const dpadState = {
    horizontal: 0,
    vertical: 0,
  }

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

  let disconnected = false

  function emitCommand(command) {
    console.log(
      `Controller command: ${command}`
    )

    if (onCommand) {
      onCommand(command)
    }
  }

  function startDirection(
    direction,
    source
  ) {
    const state =
      repeatStates[direction]

    if (!state) {
      return
    }

    if (state.sources.has(source)) {
      return
    }

    const wasInactive =
      state.sources.size === 0

    state.sources.add(source)

    if (!wasInactive) {
      return
    }

    /*
     * Immediate movement.
     */
    emitCommand(direction)

    /*
     * Begin repeating after a short delay.
     */
    state.delayTimer =
      setTimeout(() => {
        state.delayTimer = null

        if (
          state.sources.size === 0
        ) {
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

    stickState.horizontal = 0
    stickState.vertical = 0

    dpadState.horizontal = 0
    dpadState.vertical = 0
  }

  function handleButton(
    number,
    value
  ) {
    /*
     * Only act on button-down.
     */
    if (value !== 1) {
      return
    }

    const command =
      mapping.buttons[number]

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
      mapping.axes.dpadX
    ) {
      updateDpadHorizontal(
        value
      )

      return true
    }

    if (
      number ===
      mapping.axes.dpadY
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
      mapping.axes.leftStickX
    ) {
      updateStickHorizontal(
        value
      )

      return
    }

    if (
      number ===
      mapping.axes.leftStickY
    ) {
      updateStickVertical(
        value
      )
    }
  }

  /*
   * We only want disconnect cleanup to run
   * once. Depending on the failure, Node can
   * emit both error and close.
   */
  function handleDisconnect() {
    if (disconnected) {
      return
    }

    disconnected = true

    stopAllDirections()

    console.log(
      'Controller disconnected'
    )

    if (onDisconnected) {
      onDisconnected()
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

      if (eventType === 0x01) {
        handleButton(
          number,
          value
        )

        continue
      }

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
    /*
     * Device removal commonly causes a stream
     * error. The manager will begin searching
     * for another controller afterward.
     */
    console.error(
      'Controller stream error:',
      error.message
    )

    handleDisconnect()
  })

  stream.on('close', () => {
    handleDisconnect()
  })

  return stream
}

/*
 * Controller manager.
 *
 * Unlike the old implementation, this keeps
 * searching when no controller is available
 * and resumes searching after disconnection.
 */
function startController({
  onCommand,
  onConnected,
  onDisconnected,
} = {}) {
  let activeStream = null
  let activeDevicePath = null
  let stopped = false

  function scan() {
    if (
      stopped ||
      activeStream
    ) {
      return
    }

    const devicePath =
      findController()

    if (!devicePath) {
      return
    }

    activeDevicePath =
      devicePath

    activeStream =
      openController(
        devicePath,
        {
          onCommand,

          onConnected:
            (connectedPath) => {
              if (onConnected) {
                onConnected(
                  connectedPath
                )
              }
            },

          onDisconnected: () => {
            /*
             * Clear the active controller so
             * the next discovery pass can
             * reconnect it or find another.
             */
            activeStream = null
            activeDevicePath = null

            if (onDisconnected) {
              onDisconnected()
            }
          },
        }
      )
  }

  /*
   * Search immediately.
   */
  scan()

  /*
   * Continue searching whenever no controller
   * is currently active.
   */
  const discoveryTimer =
    setInterval(
      scan,
      DISCOVERY_INTERVAL
    )

  /*
   * Return a manager object instead of the raw
   * stream. This gives us a clean shutdown API.
   */
  return {
    stop() {
      stopped = true

      clearInterval(
        discoveryTimer
      )

      if (activeStream) {
        activeStream.destroy()
        activeStream = null
      }

      activeDevicePath = null
    },

    getConnectedDevice() {
      return activeDevicePath
    },
  }
}

module.exports = {
  findController,
  startController,
}
