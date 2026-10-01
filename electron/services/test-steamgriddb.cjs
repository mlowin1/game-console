require('dotenv').config()

const {
  getSteamGridArtwork,
} = require('./steamgriddb-service.cjs')

async function main() {
  const tests = [
    ['Battlefield 6', '2807960'],
    ['Rainbow Six Test Server', '623990'],
    ['The Division PTS', '524440'],
    ['UberStrike', '291210'],
  ]

  for (const [name, appId] of tests) {
    console.log(
      `\nTesting ${name} (${appId})...`
    )

    try {
      const result =
        await getSteamGridArtwork(appId)

      console.log(result)
    } catch (error) {
      console.error(
        'FAILED:',
        error.message
      )
    }
  }
}

main()