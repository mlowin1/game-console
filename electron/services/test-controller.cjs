const {
  findController,
  startController,
} = require('./controller-service.cjs')

console.log(
  'Controller test started.'
)

console.log(
  'Press Ctrl+C to stop.\n'
)

const controllerPath =
  findController()

console.log(
  'Detected controller:',
  controllerPath
)

const controller =
  startController({
    onCommand: (command) => {
      console.log(
        `APP COMMAND -> ${command}`
      )
    },

    onConnected: (devicePath) => {
      console.log(
        `CONNECTED -> ${devicePath}`
      )
    },

    onDisconnected: () => {
      console.log(
        'DISCONNECTED'
      )
    },
  })

if (!controller) {
  process.exit(1)
}
