const {
  findSteamRoot,
  syncSteam,
} = require('./steam-service.cjs')

console.log(
  'Detected Steam root:',
  findSteamRoot()
)

console.log()

const result = syncSteam()

console.log()
console.log('Result:')
console.log(result)
