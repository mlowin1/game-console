const { getDatabase } = require('./db.cjs')

function seedDatabase() {
  const db = getDatabase()

  // Don't seed again if games already exist
  const existingGames = db
    .prepare('SELECT COUNT(*) AS count FROM games')
    .get()

  if (existingGames.count > 0) {
    console.log('Database already contains games. Skipping seed.')
    return
  }

  const insertGame = db.prepare(`
    INSERT INTO games (
      title,
      description,
      cover_image,
      hero_image
    )
    VALUES (?, ?, ?, ?)
  `)

  const insertSource = db.prepare(`
    INSERT INTO game_sources (
      game_id,
      store,
      store_game_id,
      owned
    )
    VALUES (?, ?, ?, ?)
  `)

  const insertInstallation = db.prepare(`
    INSERT INTO installations (
      game_source_id,
      install_state,
      install_path,
      launch_method,
      launch_target
    )
    VALUES (?, ?, ?, ?, ?)
  `)

  const seed = db.transaction(() => {
    // Cyberpunk 2077
    const cyberpunk = insertGame.run(
      'Cyberpunk 2077',
      'An open-world action RPG set in Night City.',
      null,
      null
    )

    const cyberpunkSteam = insertSource.run(
      cyberpunk.lastInsertRowid,
      'steam',
      '1091500',
      1
    )

    insertInstallation.run(
      cyberpunkSteam.lastInsertRowid,
      'installed',
      '/games/cyberpunk2077',
      'steam',
      'steam://rungameid/1091500'
    )

    const cyberpunkGog = insertSource.run(
      cyberpunk.lastInsertRowid,
      'gog',
      'cyberpunk-2077',
      1
    )

    insertInstallation.run(
      cyberpunkGog.lastInsertRowid,
      'not_installed',
      null,
      'gog',
      null
    )

    // Hades
    const hades = insertGame.run(
      'Hades',
      'A rogue-like dungeon crawler from Supergiant Games.',
      null,
      null
    )

    const hadesSteam = insertSource.run(
      hades.lastInsertRowid,
      'steam',
      '1145360',
      1
    )

    insertInstallation.run(
      hadesSteam.lastInsertRowid,
      'installed',
      '/games/hades',
      'steam',
      'steam://rungameid/1145360'
    )

    // Control
    const control = insertGame.run(
      'Control',
      'A supernatural third-person action adventure.',
      null,
      null
    )

    const controlEpic = insertSource.run(
      control.lastInsertRowid,
      'epic',
      'control',
      1
    )

    insertInstallation.run(
      controlEpic.lastInsertRowid,
      'not_installed',
      null,
      'epic',
      null
    )

    // The Witcher 3
    const witcher = insertGame.run(
      'The Witcher 3: Wild Hunt',
      'An open-world RPG following Geralt of Rivia.',
      null,
      null
    )

    const witcherSteam = insertSource.run(
      witcher.lastInsertRowid,
      'steam',
      '292030',
      1
    )

    insertInstallation.run(
      witcherSteam.lastInsertRowid,
      'installed',
      '/games/witcher3',
      'steam',
      'steam://rungameid/292030'
    )

    const witcherGog = insertSource.run(
      witcher.lastInsertRowid,
      'gog',
      'the-witcher-3',
      1
    )

    insertInstallation.run(
      witcherGog.lastInsertRowid,
      'not_installed',
      null,
      'gog',
      null
    )

    // Moonlighter
    const moonlighter = insertGame.run(
      'Moonlighter',
      'An action RPG about adventuring by night and shopkeeping by day.',
      null,
      null
    )

    const moonlighterSteam = insertSource.run(
      moonlighter.lastInsertRowid,
      'steam',
      '606150',
      1
    )

    insertInstallation.run(
      moonlighterSteam.lastInsertRowid,
      'installed',
      '/games/moonlighter',
      'steam',
      'steam://rungameid/606150'
    )
  })

  seed()

  console.log('Development games seeded successfully.')
}

module.exports = {
  seedDatabase,
}
