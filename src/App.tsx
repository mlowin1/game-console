import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] =
    useState<GameDetails | null>(null)
  const [loadingDetails, setLoadingDetails] =
    useState(false)

  const [runtimeStatus, setRuntimeStatus] = useState<
    'stopped' | 'launching' | 'running'
  >('stopped')

  const gameCardRefs =
    useRef<(HTMLButtonElement | null)[]>([])

  /*
   * Load the game library when the app starts.
   */
  useEffect(() => {
    window.launcher
      .getGames()
      .then(setGames)
      .catch((error) => {
        console.error(
          'Failed to load games:',
          error
        )
      })
  }, [])

  /*
   * Automatically focus the first game whenever
   * we are on the library screen.
   */
  useEffect(() => {
    if (!selectedGame && games.length > 0) {
      requestAnimationFrame(() => {
        gameCardRefs.current[0]?.focus()
      })
    }
  }, [games, selectedGame])

  /*
   * Monitor the currently selected game's runtime
   * state while its details page is open.
   */
  useEffect(() => {
    if (!selectedGame) {
      setRuntimeStatus('stopped')
      return
    }

    let cancelled = false

    async function checkRuntimeStatus() {
      try {
        const result =
          await window.launcher.getGameRuntimeStatus(
            selectedGame!.id
          )

        if (!cancelled) {
          setRuntimeStatus(result.status)
        }
      } catch (error) {
        console.error(
          'Failed to get runtime status:',
          error
        )
      }
    }

    checkRuntimeStatus()

    const interval = window.setInterval(
      checkRuntimeStatus,
      1000
    )

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [selectedGame])

  /*
   * Escape or Backspace returns from the
   * game-details screen to the library.
   *
   * Later, the controller's Circle/B button
   * will trigger this same behavior.
   */
  useEffect(() => {
    if (!selectedGame) {
      return
    }

    function handleBack(event: KeyboardEvent) {
      if (
        event.key === 'Escape' ||
        event.key === 'Backspace'
      ) {
        event.preventDefault()
        setSelectedGame(null)
      }
    }

    window.addEventListener(
      'keydown',
      handleBack
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleBack
      )
    }
  }, [selectedGame])

  /*
   * Keyboard navigation for the game library.
   *
   * Left/right move between adjacent games.
   *
   * Up/down inspect the actual rendered
   * positions of the cards so navigation
   * continues to work if the number of
   * columns changes with screen size.
   */
  function handleGameKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    const currentCard =
      gameCardRefs.current[index]

    if (!currentCard) {
      return
    }

    let nextIndex = index

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = Math.min(
          index + 1,
          games.length - 1
        )
        break

      case 'ArrowLeft':
        nextIndex = Math.max(
          index - 1,
          0
        )
        break

      case 'ArrowDown': {
        const currentTop =
          currentCard.offsetTop

        /*
         * Find the first card physically
         * positioned on a lower row.
         */
        const nextRowIndex =
          gameCardRefs.current.findIndex(
            (card, cardIndex) =>
              cardIndex > index &&
              card !== null &&
              card.offsetTop > currentTop
          )

        if (nextRowIndex !== -1) {
          const nextRowTop =
            gameCardRefs.current[
              nextRowIndex
            ]?.offsetTop

          /*
           * Get every card on that row.
           */
          const candidates =
            gameCardRefs.current
              .map((card, cardIndex) => ({
                card,
                cardIndex,
              }))
              .filter(
                ({ card }) =>
                  card !== null &&
                  card.offsetTop ===
                    nextRowTop
              )

          const currentCenter =
            currentCard.offsetLeft +
            currentCard.offsetWidth / 2

          let closest = candidates[0]

          /*
           * Pick the card whose horizontal
           * center is closest to the current
           * card.
           */
          for (const candidate of candidates) {
            if (
              !candidate.card ||
              !closest.card
            ) {
              continue
            }

            const candidateCenter =
              candidate.card.offsetLeft +
              candidate.card.offsetWidth / 2

            const closestCenter =
              closest.card.offsetLeft +
              closest.card.offsetWidth / 2

            if (
              Math.abs(
                candidateCenter -
                  currentCenter
              ) <
              Math.abs(
                closestCenter -
                  currentCenter
              )
            ) {
              closest = candidate
            }
          }

          nextIndex = closest.cardIndex
        }

        break
      }

      case 'ArrowUp': {
        const currentTop =
          currentCard.offsetTop

        /*
         * Find all cards above the
         * current card.
         */
        const previousCards =
          gameCardRefs.current
            .map((card, cardIndex) => ({
              card,
              cardIndex,
            }))
            .filter(
              ({ card }) =>
                card !== null &&
                card.offsetTop <
                  currentTop
            )

        if (previousCards.length > 0) {
          /*
           * Find the row immediately above.
           */
          const previousRowTop =
            Math.max(
              ...previousCards.map(
                ({ card }) =>
                  card!.offsetTop
              )
            )

          const candidates =
            previousCards.filter(
              ({ card }) =>
                card!.offsetTop ===
                previousRowTop
            )

          const currentCenter =
            currentCard.offsetLeft +
            currentCard.offsetWidth / 2

          let closest = candidates[0]

          /*
           * Choose the card most closely
           * aligned horizontally.
           */
          for (const candidate of candidates) {
            if (
              !candidate.card ||
              !closest.card
            ) {
              continue
            }

            const candidateCenter =
              candidate.card.offsetLeft +
              candidate.card.offsetWidth / 2

            const closestCenter =
              closest.card.offsetLeft +
              closest.card.offsetWidth / 2

            if (
              Math.abs(
                candidateCenter -
                  currentCenter
              ) <
              Math.abs(
                closestCenter -
                  currentCenter
              )
            ) {
              closest = candidate
            }
          }

          nextIndex = closest.cardIndex
        }

        break
      }

      default:
        return
    }

    event.preventDefault()

    gameCardRefs.current[
      nextIndex
    ]?.focus()
  }

  /*
   * Open a game's details page.
   */
  async function openGame(gameId: number) {
    try {
      setLoadingDetails(true)

      const game =
        await window.launcher.getGameDetails(
          gameId
        )

      if (game) {
        setSelectedGame(game)
      }
    } catch (error) {
      console.error(
        'Failed to load game details:',
        error
      )
    } finally {
      setLoadingDetails(false)
    }
  }

  /*
   * Launch the selected game.
   */
  async function handlePlay(gameId: number) {
    try {
      setRuntimeStatus('launching')

      const result =
        await window.launcher.launchGame(
          gameId
        )

      if (!result.success) {
        console.error(
          'Launch failed:',
          result.error
        )

        setRuntimeStatus('stopped')
      }
    } catch (error) {
      console.error(
        'Failed to launch game:',
        error
      )

      setRuntimeStatus('stopped')
    }
  }

  /*
   * Game details screen.
   */
  if (selectedGame) {
    const installedSource =
      selectedGame.sources.find(
        (source) =>
          source.install_state ===
          'installed'
      )

    return (
      <main className="details">
        <button
          className="back-button"
          onClick={() =>
            setSelectedGame(null)
          }
        >
          ← Back
        </button>

        <h1>{selectedGame.title}</h1>

        <p className="description">
          {selectedGame.description}
        </p>

        <h2>Owned On</h2>

        <div className="source-list">
          {selectedGame.sources.map(
            (source) => (
              <div
                className="source-row"
                key={source.source_id}
              >
                <strong>
                  {source.store.toUpperCase()}
                </strong>

                <span>
                  {source.install_state ===
                  'installed'
                    ? 'Installed'
                    : 'Not Installed'}
                </span>
              </div>
            )
          )}
        </div>

        <button
          className="play-button"
          disabled={
            !installedSource ||
            runtimeStatus ===
              'launching' ||
            runtimeStatus === 'running'
          }
          onClick={() =>
            handlePlay(selectedGame.id)
          }
        >
          {!installedSource
            ? 'Install'
            : runtimeStatus ===
                'launching'
              ? 'Launching...'
              : runtimeStatus ===
                  'running'
                ? '● Running'
                : 'Play'}
        </button>
      </main>
    )
  }

  /*
   * Library screen.
   */
  return (
    <main className="library">
      <h1>Library</h1>

      {loadingDetails && (
        <p>Loading...</p>
      )}

      <div className="game-grid">
        {games.map(
          (game, index) => (
            <button
              className="game-card"
              key={game.id}
              ref={(element) => {
                gameCardRefs.current[
                  index
                ] = element
              }}
              onKeyDown={(event) =>
                handleGameKeyDown(
                  event,
                  index
                )
              }
              onClick={() =>
                openGame(game.id)
              }
            >
              <div className="game-cover">
                <span>
                  {game.title}
                </span>
              </div>

              <h2>{game.title}</h2>

              <p
                className={
                  game.installed
                    ? 'installed'
                    : 'not-installed'
                }
              >
                {game.installed
                  ? 'Installed'
                  : 'Not Installed'}
              </p>
            </button>
          )
        )}
      </div>
    </main>
  )
}

export default App
