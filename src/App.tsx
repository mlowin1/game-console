import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [games, setGames] = useState<Game[]>([])

  useEffect(() => {
    window.launcher.getGames()
      .then(setGames)
      .catch((error) => {
        console.error('Failed to load games:', error)
      })
  }, [])

  return (
    <main className="library">
      <h1>Library</h1>

      <div className="game-grid">
        {games.map((game) => (
          <div className="game-card" key={game.id}>
            <div className="game-cover">
              <span>{game.title}</span>
            </div>

            <h2>{game.title}</h2>

            <p className={game.installed ? 'installed' : 'not-installed'}>
              {game.installed ? 'Installed' : 'Not Installed'}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}

export default App
