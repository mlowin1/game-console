import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<GameDetails | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    window.launcher.getGames()
      .then(setGames)
      .catch((error) => {
        console.error('Failed to load games:', error)
      })
  }, [])

  async function openGame(gameId: number) {
    try {
      setLoadingDetails(true)

      const game = await window.launcher.getGameDetails(gameId)

      if (game) {
        setSelectedGame(game)
      }
    } catch (error) {
      console.error('Failed to load game details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  async function handlePlay(gameId: number) {
    try {
      const result = await window.launcher.launchGame(gameId)

      if (!result.success) {
        console.error('Launch failed:', result.error)
      }
    } catch (error) {
      console.error('Failed to launch game:', error)
    }
  }

  if (selectedGame) {
    const installedSource = selectedGame.sources.find(
      (source) => source.install_state === 'installed'
    )

    return (
      <main className="details">
        <button
          className="back-button"
          onClick={() => setSelectedGame(null)}
        >
          ← Back
        </button>

        <h1>{selectedGame.title}</h1>

        <p className="description">
          {selectedGame.description}
        </p>

        <h2>Owned On</h2>

        <div className="source-list">
          {selectedGame.sources.map((source) => (
            <div className="source-row" key={source.source_id}>
              <strong>{source.store.toUpperCase()}</strong>

              <span>
                {source.install_state === 'installed'
                  ? 'Installed'
                  : 'Not Installed'}
              </span>
            </div>
          ))}
        </div>

        <button
          className="play-button"
          disabled={!installedSource}
          onClick={() => handlePlay(selectedGame.id)}
        >
          {installedSource ? 'Play' : 'Install'}
        </button>
      </main>
    )
  }

  return (
    <main className="library">
      <h1>Library</h1>

      {loadingDetails && <p>Loading...</p>}

      <div className="game-grid">
        {games.map((game) => (
          <button
            className="game-card"
            key={game.id}
            onClick={() => openGame(game.id)}
          >
            <div className="game-cover">
              <span>{game.title}</span>
            </div>

            <h2>{game.title}</h2>

            <p className={game.installed ? 'installed' : 'not-installed'}>
              {game.installed ? 'Installed' : 'Not Installed'}
            </p>
          </button>
        ))}
      </div>
    </main>
  )
}

export default App
