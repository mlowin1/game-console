import { useEffect, useRef, useState } from 'react'
import './App.css'

type Direction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'

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

  const playButtonRef =
    useRef<HTMLButtonElement | null>(null)

  /*
   * Remember which game was most recently focused.
   */
  const lastFocusedGameIndex = useRef(0)

  /*
   * Keep current values available to the controller
   * event handler without constantly recreating the
   * IPC subscription.
   */
  const gamesRef = useRef<Game[]>([])
  const selectedGameRef =
    useRef<GameDetails | null>(null)

  useEffect(() => {
    gamesRef.current = games
  }, [games])

  useEffect(() => {
    selectedGameRef.current = selectedGame
  }, [selectedGame])

  /*
   * Load the game library.
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
   * Restore focus when returning to the library.
   */
  useEffect(() => {
    if (!selectedGame && games.length > 0) {
      requestAnimationFrame(() => {
        const index = Math.min(
          lastFocusedGameIndex.current,
          games.length - 1
        )

        gameCardRefs.current[index]?.focus()
      })
    }
  }, [games, selectedGame])

  /*
   * When game details open, focus the Play button.
   *
   * This means Cross can immediately activate it.
   */
  useEffect(() => {
    if (!selectedGame) {
      return
    }

    requestAnimationFrame(() => {
      playButtonRef.current?.focus()
    })
  }, [selectedGame])

  /*
   * Monitor the selected game's runtime status.
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
   * Keyboard Back behavior.
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
   * Find the game card currently focused.
   */
  function getFocusedGameIndex() {
    const focusedElement =
      document.activeElement

    const index =
      gameCardRefs.current.findIndex(
        (card) =>
          card === focusedElement
      )

    if (index !== -1) {
      return index
    }

    return Math.min(
      lastFocusedGameIndex.current,
      Math.max(
        gamesRef.current.length - 1,
        0
      )
    )
  }

  /*
   * Shared navigation engine.
   *
   * Both keyboard and controller navigation
   * ultimately use this function.
   */
  function moveGameFocus(
    direction: Direction,
    index: number
  ) {
    const currentCard =
      gameCardRefs.current[index]

    const currentGames =
      gamesRef.current

    if (
      !currentCard ||
      currentGames.length === 0
    ) {
      return
    }

    let nextIndex = index

    if (direction === 'right') {
      nextIndex = Math.min(
        index + 1,
        currentGames.length - 1
      )
    }

    if (direction === 'left') {
      nextIndex = Math.max(
        index - 1,
        0
      )
    }

    if (direction === 'down') {
      const currentTop =
        currentCard.offsetTop

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

        let closest =
          candidates[0]

        for (const candidate of candidates) {
          if (
            !candidate?.card ||
            !closest?.card
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

        if (closest) {
          nextIndex =
            closest.cardIndex
        }
      }
    }

    if (direction === 'up') {
      const currentTop =
        currentCard.offsetTop

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

        let closest =
          candidates[0]

        for (const candidate of candidates) {
          if (
            !candidate?.card ||
            !closest?.card
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

        if (closest) {
          nextIndex =
            closest.cardIndex
        }
      }
    }

    lastFocusedGameIndex.current =
      nextIndex

    gameCardRefs.current[
      nextIndex
    ]?.focus()
  }

  /*
   * Keyboard navigation.
   */
  function handleGameKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    let direction:
      | Direction
      | null = null

    switch (event.key) {
      case 'ArrowRight':
        direction = 'right'
        break

      case 'ArrowLeft':
        direction = 'left'
        break

      case 'ArrowDown':
        direction = 'down'
        break

      case 'ArrowUp':
        direction = 'up'
        break

      default:
        return
    }

    event.preventDefault()

    moveGameFocus(
      direction,
      index
    )
  }

  /*
   * Receive normalized controller commands
   * from Electron.
   */
  useEffect(() => {
    const unsubscribe =
      window.launcher.onControllerCommand(
        (command) => {
          console.log(
            'React controller command:',
            command
          )

          const currentSelectedGame =
            selectedGameRef.current

          /*
           * GAME DETAILS
           */
          if (currentSelectedGame) {
            if (command === 'back') {
              setSelectedGame(null)
              return
            }

            if (command === 'select') {
              playButtonRef.current?.click()
              return
            }

            return
          }

          /*
           * LIBRARY
           */
          if (
            command === 'up' ||
            command === 'down' ||
            command === 'left' ||
            command === 'right'
          ) {
            const index =
              getFocusedGameIndex()

            moveGameFocus(
              command,
              index
            )

            return
          }

          if (command === 'select') {
            const index =
              getFocusedGameIndex()

            const card =
              gameCardRefs.current[index]

            card?.click()
          }
        }
      )

    return unsubscribe
  }, [])

  /*
   * Open game details.
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
   * Launch selected game.
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
   * GAME DETAILS
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

        <h1>
          {selectedGame.title}
        </h1>

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
          ref={playButtonRef}
          className="play-button"
          disabled={
            !installedSource ||
            runtimeStatus ===
              'launching' ||
            runtimeStatus ===
              'running'
          }
          onClick={() =>
            handlePlay(
              selectedGame.id
            )
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
   * LIBRARY
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
              onClick={() => {
                lastFocusedGameIndex.current =
                  index

                openGame(game.id)
              }}
            >
              <div className="game-cover">
                <span>
                  {game.title}
                </span>
              </div>

              <h2>
                {game.title}
              </h2>

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
