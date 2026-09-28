const CONTROLLER_MAPPINGS = {
  dualsense: {
    id: 'dualsense',
    name: 'PlayStation DualSense',

    match: (deviceName) => {
      const name = deviceName.toLowerCase()

      return (
        name.includes('sony') &&
        name.includes('dualsense')
      )
    },

    buttons: {
      0: 'select',
      1: 'back',
      2: 'menu',
      3: 'secondary',
    },

    axes: {
      leftStickX: 0,
      leftStickY: 1,
      dpadX: 6,
      dpadY: 7,
    },
  },

  /*
   * Used when we don't have a specific mapping
   * for the controller yet.
   *
   * We deliberately do NOT guess button/axis
   * numbers here. Unsupported controllers
   * shouldn't produce incorrect commands.
   */
  generic: {
    id: 'generic',
    name: 'Generic Controller',

    match: () => true,

    buttons: {},

    axes: {
      leftStickX: null,
      leftStickY: null,
      dpadX: null,
      dpadY: null,
    },
  },
}

function getControllerMapping(
  deviceName
) {
  for (
    const mapping of
    Object.values(
      CONTROLLER_MAPPINGS
    )
  ) {
    if (
      mapping.id !== 'generic' &&
      mapping.match(deviceName)
    ) {
      return mapping
    }
  }

  return CONTROLLER_MAPPINGS.generic
}

module.exports = {
  CONTROLLER_MAPPINGS,
  getControllerMapping,
}
