import {
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  ArrowDownToLine,
  Bell,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock3,
  Download,
  Gamepad2,
  Grid2X2,
  HardDrive,
  House,
  Keyboard,
  Library,
  Link2,
  List,
  Monitor,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react'
import {
  siEpicgames,
  siSteam,
} from 'simple-icons'
import './App.css'

type Direction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'

type ArtworkOption = {
  id: number
  url: string
  width: number | null
  height: number | null
  score: number | null
}

type ArtworkResult = {
  game: {
    id: number
    name: string | null
  } | null
  artwork: ArtworkOption[]
}

type HubView =
  | 'home'
  | 'library'
  | 'store'
  | 'downloads'
  | 'account'
  | 'settings'

type LibraryFilter =
  | 'all'
  | 'installed'
  | 'not-installed'
  | 'steam'
  | 'epic'

type SettingsTab =
  | 'account'
  | 'services'
  | 'controller'
  | 'interface'
  | 'downloads'
  | 'game'
  | 'system'

function PlatformLogo({
  store,
  className = '',
}: {
  store: 'steam' | 'epic'
  className?: string
}) {
  const icon = store === 'steam' ? siSteam : siEpicgames

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      role="img"
      aria-label={store === 'steam' ? 'Steam' : 'Epic Games'}
    >
      <path d={icon.path} />
    </svg>
  )
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 MB'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (
    value >= 1024 &&
    unitIndex < units.length - 1
  ) {
    value /= 1024
    unitIndex += 1
  }

  const precision =
    value >= 10 || unitIndex === 0 ? 0 : 1

  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function preferredStoreName(game: GameDetails | null) {
  const ownedSources =
    game?.sources.filter((source) => source.owned) ?? []
  const source =
    ownedSources.find((item) => item.install_state === 'installed') ??
    ownedSources.find((item) => item.store === 'steam') ??
    ownedSources[0]

  if (source?.store === 'epic') {
    return 'Legendary'
  }

  if (source?.store === 'steam') {
    return 'Steam'
  }

  return source?.store ?? 'Launcher'
}

function App() {
  const [activeView, setActiveView] =
    useState<HubView>('home')

  const [libraryFilter, setLibraryFilter] =
    useState<LibraryFilter>('all')

  const [librarySearch, setLibrarySearch] =
    useState('')

  const [sortBy, setSortBy] =
    useState<'recent' | 'title' | 'installed'>('recent')

  const [settingsTab, setSettingsTab] =
    useState<SettingsTab>('account')

  const [libraryMessage, setLibraryMessage] =
    useState<string | null>(null)

  const [profileName, setProfileName] =
    useState(() =>
      window.localStorage.getItem('game-console-profile') || 'Player'
    )

  const [compactMode, setCompactMode] =
    useState(() =>
      window.localStorage.getItem('game-console-compact') === 'true'
    )

  const [syncingEpic, setSyncingEpic] =
    useState(false)

  const [games, setGames] =
    useState<Game[]>([])

  const [selectedGame, setSelectedGame] =
    useState<GameDetails | null>(null)

  const [loadingDetails, setLoadingDetails] =
    useState(false)

  const [runtimeStatus, setRuntimeStatus] =
    useState<
      'stopped' | 'launching' | 'running'
    >('stopped')

  const [
    installingGameId,
    setInstallingGameId,
  ] = useState<number | null>(null)

  const [
    installProgress,
    setInstallProgress,
  ] = useState(0)

  const [
    downloadedBytes,
    setDownloadedBytes,
  ] = useState(0)

  const [
    totalBytes,
    setTotalBytes,
  ] = useState(0)

  const [
    uninstallingGameId,
    setUninstallingGameId,
  ] = useState<number | null>(
    null
  )

  const [
    showInstallConfirm,
    setShowInstallConfirm,
  ] = useState(false)

  const [
    installChoice,
    setInstallChoice,
  ] = useState<'cancel' | 'install'>(
    'cancel'
  )

  const [
    showUninstallConfirm,
    setShowUninstallConfirm,
  ] = useState(false)

  const [
    uninstallChoice,
    setUninstallChoice,
  ] = useState<'cancel' | 'uninstall'>(
    'cancel'
  )

  const [
    actionState,
    setActionState,
  ] = useState<
    | 'idle'
    | 'installing'
    | 'uninstalling'
    | 'launching'
  >('idle')

  const [
    steamActionMessage,
    setSteamActionMessage,
  ] = useState<string | null>(null)

  const [epicConnected, setEpicConnected] =
    useState(false)
  const epicConnectedRef = useRef(false)
  const activeViewRef = useRef<HubView>('home')
  const sidebarRefs = useRef<(HTMLButtonElement | null)[]>([])
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    activeViewRef.current = activeView
  }, [activeView])

  useEffect(() => {
    window.localStorage.setItem('game-console-profile', profileName)
  }, [profileName])

  useEffect(() => {
    window.localStorage.setItem('game-console-compact', String(compactMode))
    document.body.classList.toggle('compact-mode', compactMode)
  }, [compactMode])

  function navigateTo(view: HubView) {
    setSelectedGame(null)
    setActiveView(view)
    setLibraryMessage(null)
  }

  function moveSpatialFocus(direction: Direction) {
    const controls = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-controller-focus]:not(:disabled)'
      )
    ).filter((element) => element.getClientRects().length > 0)

    if (controls.length === 0) return

    const current = document.activeElement as HTMLElement | null
    const currentIndex = controls.indexOf(current as HTMLElement)

    if (currentIndex < 0) {
      controls[0].focus()
      return
    }

    const currentRect = controls[currentIndex].getBoundingClientRect()
    const currentX = currentRect.left + currentRect.width / 2
    const currentY = currentRect.top + currentRect.height / 2
    let target: HTMLElement | null = null
    let bestScore = Number.POSITIVE_INFINITY

    for (const control of controls) {
      if (control === controls[currentIndex]) continue
      const rect = control.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2
      const dx = x - currentX
      const dy = y - currentY
      const inDirection =
        direction === 'left' ? dx < -2 :
        direction === 'right' ? dx > 2 :
        direction === 'up' ? dy < -2 : dy > 2

      if (!inDirection) continue

      const primary = direction === 'left' || direction === 'right'
        ? Math.abs(dx)
        : Math.abs(dy)
      const secondary = direction === 'left' || direction === 'right'
        ? Math.abs(dy)
        : Math.abs(dx)
      const score = primary + secondary * 1.7

      if (score < bestScore) {
        bestScore = score
        target = control
      }
    }

    target?.focus()
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  useEffect(() => {
    let cancelled = false

    async function refreshEpicConnection() {
      try {
        const status =
          await window.launcher.getEpicConnectionStatus()

        if (!cancelled) {
          setEpicConnected(status.connected)
          const newlyConnected =
            status.connected && !epicConnectedRef.current
          epicConnectedRef.current = status.connected

          if (newlyConnected) {
            const result =
              await window.launcher.syncEpic()

            if (result.success && !cancelled) {
              setGames(await window.launcher.getGames())
            }
          }
        }
      } catch (error) {
        console.error(
          'Failed to read Epic connection status:',
          error
        )
      }
    }

    refreshEpicConnection()

    const interval =
      window.setInterval(
        refreshEpicConnection,
        15000
      )

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  /*
   * Artwork picker state.
   */
  const [
    artworkPickerOpen,
    setArtworkPickerOpen,
  ] = useState(false)

  const [
    artworkOptions,
    setArtworkOptions,
  ] = useState<ArtworkOption[]>([])

  const [
    artworkLoading,
    setArtworkLoading,
  ] = useState(false)

  const [
    artworkIndex,
    setArtworkIndex,
  ] = useState(0)

  /*
   * Library refs.
   */
  const gameCardRefs =
    useRef<
      (HTMLButtonElement | null)[]
    >([])

  const lastFocusedGameIndex =
    useRef(0)

  /*
   * Details refs.
   *
   * 0 = Play / Install
   * 1 = Uninstall (when installed)
   * 2 = Change Artwork
   */
  const playButtonRef =
    useRef<HTMLButtonElement | null>(
      null
    )

  const artworkButtonRef =
    useRef<HTMLButtonElement | null>(
      null
    )

  const uninstallButtonRef =
    useRef<HTMLButtonElement | null>(
      null
    )

  const installConfirmCancelRef =
    useRef<HTMLButtonElement | null>(
      null
    )

  const installConfirmInstallRef =
    useRef<HTMLButtonElement | null>(
      null
    )

  const uninstallConfirmCancelRef =
    useRef<HTMLButtonElement | null>(
      null
    )

  const uninstallConfirmUninstallRef =
    useRef<HTMLButtonElement | null>(
      null
    )

  const detailsActionIndex =
    useRef(0)

  const installChoiceRef =
    useRef<'cancel' | 'install'>(
      'cancel'
    )

  const uninstallChoiceRef =
    useRef<'cancel' | 'uninstall'>(
      'cancel'
    )

  /*
   * Artwork picker refs.
   */
  const artworkOptionRefs =
    useRef<
      (HTMLButtonElement | null)[]
    >([])

  /*
   * Current-state refs.
   *
   * Controller subscription is created
   * once, so it reads current state from
   * refs instead of stale React closures.
   */
  const gamesRef =
    useRef<Game[]>([])

  const selectedGameRef =
    useRef<GameDetails | null>(null)

  const showInstallConfirmRef =
    useRef(false)

  const showUninstallConfirmRef =
    useRef(false)

  const artworkPickerOpenRef =
    useRef(false)

  const artworkOptionsRef =
    useRef<ArtworkOption[]>([])

  const artworkIndexRef =
    useRef(0)

  useEffect(() => {
    gamesRef.current = games
  }, [games])

  useEffect(() => {
    selectedGameRef.current =
      selectedGame
  }, [selectedGame])

  useEffect(() => {
    if (selectedGame) {
      setShowUninstallConfirm(false)
    }
  }, [selectedGame])

  useEffect(() => {
    installChoiceRef.current =
      installChoice
  }, [installChoice])

  useEffect(() => {
    showInstallConfirmRef.current =
      showInstallConfirm
  }, [showInstallConfirm])

  useEffect(() => {
    showUninstallConfirmRef.current =
      showUninstallConfirm
  }, [showUninstallConfirm])

  useEffect(() => {
    artworkPickerOpenRef.current =
      artworkPickerOpen
  }, [artworkPickerOpen])

  useEffect(() => {
    artworkOptionsRef.current =
      artworkOptions
  }, [artworkOptions])

  useEffect(() => {
    artworkIndexRef.current =
      artworkIndex
  }, [artworkIndex])

  useEffect(() => {
    uninstallChoiceRef.current =
      uninstallChoice
  }, [uninstallChoice])

  /*
   * Load library.
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
   * Restore library focus after
   * leaving details.
   */
  useEffect(() => {
    if (
      selectedGame ||
      activeView !== 'library' ||
      games.length === 0
    ) {
      return
    }

    requestAnimationFrame(() => {
      const index =
        Math.min(
          lastFocusedGameIndex.current,
          games.length - 1
        )

      gameCardRefs.current[
        index
      ]?.focus()
    })
  }, [activeView, games, selectedGame])

  /*
   * Default details focus = primary
   * Play / Install action.
   */
  useEffect(() => {
    if (!selectedGame) {
      return
    }

    detailsActionIndex.current = 0

    requestAnimationFrame(() => {
      playButtonRef.current?.focus()
    })
  }, [selectedGame])

  /*
   * Once artwork has loaded, focus
   * the selected artwork card.
   */
  useEffect(() => {
    if (
      !artworkPickerOpen ||
      artworkLoading ||
      artworkOptions.length === 0
    ) {
      return
    }

    const safeIndex =
      Math.min(
        artworkIndex,
        artworkOptions.length - 1
      )

    requestAnimationFrame(() => {
      artworkOptionRefs.current[
        safeIndex
      ]?.focus()
    })
  }, [
    artworkPickerOpen,
    artworkLoading,
    artworkOptions,
    artworkIndex,
  ])

  /*
   * Runtime status watcher.
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
          await window.launcher
            .getGameRuntimeStatus(
              selectedGame!.id
            )

        if (!cancelled) {
          setRuntimeStatus(
            result.status
          )
        }
      } catch (error) {
        console.error(
          'Failed to get runtime status:',
          error
        )
      }
    }

    checkRuntimeStatus()

    const interval =
      window.setInterval(
        checkRuntimeStatus,
        1000
      )

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [selectedGame])

  /*
   * Installation watcher.
   *
   * While an installation is pending,
   * periodically rescan Steam manifests.
   * Once Steam reports the game as
   * installed, refresh details/library.
   */
  useEffect(() => {
    if (installingGameId === null) {
      return
    }

    setActionState('installing')

    let cancelled = false

    async function checkInstallation() {
      try {
        const status =
          await window.launcher
            .getGameInstallStatus(
              installingGameId!
            )

        if (cancelled) {
          return
        }

        const nextProgress = Math.max(
          0,
          Math.min(
            100,
            status.progress ?? 0
          )
        )

        setInstallProgress(nextProgress)
        setDownloadedBytes(
          status.downloadedBytes ?? 0
        )
        setTotalBytes(
          status.totalBytes ?? 0
        )

        if (
          status.state === 'unknown' &&
          status.error
        ) {
          setInstallingGameId(null)
          setActionState('idle')
          setSteamActionMessage(
            `Install failed: ${status.error}`
          )
          return
        }

        if (
          status.state !==
          'installed'
        ) {
          return
        }

        console.log(
          'Steam installation complete'
        )

        await window.launcher
          .syncSteam()

        const updatedGame =
          await window.launcher
            .getGameDetails(
              installingGameId!
            )

        const updatedGames =
          await window.launcher
            .getGames()

        if (cancelled) {
          return
        }

        if (updatedGame) {
          setSelectedGame(
            updatedGame
          )
        }

        setGames(
          updatedGames
        )

        setInstallProgress(100)
        setDownloadedBytes(
          status.downloadedBytes ?? 0
        )
        setTotalBytes(
          status.totalBytes ?? 0
        )

        setInstallingGameId(
          null
        )
        setActionState('idle')
        setSteamActionMessage(null)

        await window.launcher.showWindow()
      } catch (error) {
        console.error(
          'Failed to check installation:',
          error
        )
      }
    }

    checkInstallation()

    const interval =
      window.setInterval(
        checkInstallation,
        1000
      )

    return () => {
      cancelled = true

      window.clearInterval(
        interval
      )
    }
  }, [installingGameId])

  /*
   * Back behavior.
   *
   * Escape / Backspace closes artwork
   * first, then returns to Library.
   */
  useEffect(() => {
    if (!selectedGame) {
      return
    }

    function handleBack(
      event: KeyboardEvent
    ) {
      if (
        event.key !== 'Escape' &&
        event.key !== 'Backspace'
      ) {
        return
      }

      event.preventDefault()

      if (
        showUninstallConfirmRef.current
      ) {
        closeUninstallConfirmation()
        return
      }

      if (
        artworkPickerOpenRef.current
      ) {
        closeArtworkPicker()
        return
      }

      setSelectedGame(null)
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
   * Library spatial navigation.
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
            card.offsetTop >
              currentTop
        )

      if (nextRowIndex !== -1) {
        const nextRowTop =
          gameCardRefs.current[
            nextRowIndex
          ]?.offsetTop

        const candidates =
          gameCardRefs.current
            .map(
              (
                card,
                cardIndex
              ) => ({
                card,
                cardIndex,
              })
            )
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

        for (
          const candidate
          of candidates
        ) {
          if (
            !candidate?.card ||
            !closest?.card
          ) {
            continue
          }

          const candidateCenter =
            candidate.card.offsetLeft +
            candidate.card
              .offsetWidth /
              2

          const closestCenter =
            closest.card.offsetLeft +
            closest.card
              .offsetWidth /
              2

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
          .map(
            (
              card,
              cardIndex
            ) => ({
              card,
              cardIndex,
            })
          )
          .filter(
            ({ card }) =>
              card !== null &&
              card.offsetTop <
                currentTop
          )

      if (
        previousCards.length > 0
      ) {
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

        for (
          const candidate
          of candidates
        ) {
          if (
            !candidate?.card ||
            !closest?.card
          ) {
            continue
          }

          const candidateCenter =
            candidate.card.offsetLeft +
            candidate.card
              .offsetWidth /
              2

          const closestCenter =
            closest.card.offsetLeft +
            closest.card
              .offsetWidth /
              2

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
   * Details navigation.
   *
   * 0 = Play / Install
   * 1 = Uninstall (when installed)
   * 2 = Change Artwork
   */
  function moveDetailsFocus(
    direction: Direction
  ) {
    if (
      !['up', 'down', 'left', 'right'].includes(
        direction
      )
    ) {
      return
    }

    const hasUninstallAction =
      selectedGameRef.current?.sources.some(
        (source) =>
          source.install_state ===
          'installed'
      ) &&
      runtimeStatus === 'stopped'

    const actionCount =
      hasUninstallAction ? 3 : 2

    if (direction === 'up' || direction === 'left') {
      detailsActionIndex.current =
        detailsActionIndex.current <= 0
          ? actionCount - 1
          : detailsActionIndex.current - 1
    }

    if (
      direction === 'down' ||
      direction === 'right'
    ) {
      detailsActionIndex.current =
        detailsActionIndex.current >=
        actionCount - 1
          ? 0
          : detailsActionIndex.current + 1
    }

    if (
      detailsActionIndex.current === 0
    ) {
      playButtonRef.current?.focus()
      return
    }

    if (
      detailsActionIndex.current === 1 &&
      hasUninstallAction
    ) {
      uninstallButtonRef.current?.focus()
      return
    }

    artworkButtonRef.current?.focus()
  }

  /*
   * Artwork spatial navigation.
   */
  function moveArtworkFocus(
    direction: Direction
  ) {
    const options =
      artworkOptionsRef.current

    if (options.length === 0) {
      return
    }

    let currentIndex =
      Math.min(
        artworkIndexRef.current,
        options.length - 1
      )

    let nextIndex =
      currentIndex

    if (direction === 'left') {
      nextIndex = Math.max(
        0,
        currentIndex - 1
      )
    }

    if (direction === 'right') {
      nextIndex = Math.min(
        options.length - 1,
        currentIndex + 1
      )
    }

    if (
      direction === 'up' ||
      direction === 'down'
    ) {
      const currentCard =
        artworkOptionRefs.current[
          currentIndex
        ]

      if (!currentCard) {
        return
      }

      const currentTop =
        currentCard.offsetTop

      const cards =
        artworkOptionRefs.current
          .map(
            (
              card,
              index
            ) => ({
              card,
              index,
            })
          )
          .filter(
            (
              item
            ): item is {
              card: HTMLButtonElement
              index: number
            } =>
              item.card !== null
          )

      const targetCards =
        cards.filter(
          ({ card }) =>
            direction === 'down'
              ? card.offsetTop >
                currentTop
              : card.offsetTop <
                currentTop
        )

      if (
        targetCards.length > 0
      ) {
        const targetTop =
          direction === 'down'
            ? Math.min(
                ...targetCards.map(
                  ({ card }) =>
                    card.offsetTop
                )
              )
            : Math.max(
                ...targetCards.map(
                  ({ card }) =>
                    card.offsetTop
                )
              )

        const candidates =
          targetCards.filter(
            ({ card }) =>
              card.offsetTop ===
                targetTop
          )

        const currentCenter =
          currentCard.offsetLeft +
          currentCard.offsetWidth / 2

        let closest =
          candidates[0]

        for (
          const candidate
          of candidates
        ) {
          if (!closest) {
            closest = candidate
            continue
          }

          const candidateCenter =
            candidate.card.offsetLeft +
            candidate.card
              .offsetWidth /
              2

          const closestCenter =
            closest.card.offsetLeft +
            closest.card
              .offsetWidth /
              2

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
            closest.index
        }
      }
    }

    artworkIndexRef.current =
      nextIndex

    setArtworkIndex(
      nextIndex
    )

    artworkOptionRefs.current[
      nextIndex
    ]?.focus()
  }

  /*
   * Keyboard navigation for library.
   */
  function handleGameKeyDown(
    event:
      React.KeyboardEvent<HTMLButtonElement>,
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
   * Keyboard navigation for details
   * and artwork picker.
   */
  useEffect(() => {
    function handleNavigation(
      event: KeyboardEvent
    ) {
      const directionMap:
        Record<
          string,
          Direction | undefined
        > = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        }

      const direction =
        directionMap[event.key]

      if (!direction) {
        return
      }

      if (
        artworkPickerOpenRef.current
      ) {
        event.preventDefault()

        moveArtworkFocus(
          direction
        )

        return
      }

      if (
        showInstallConfirmRef.current
      ) {
        if (
          direction === 'left' ||
          direction === 'right'
        ) {
          event.preventDefault()

          const nextChoice =
            installChoiceRef.current ===
            'cancel'
              ? 'install'
              : 'cancel'

          setInstallChoice(nextChoice)

          requestAnimationFrame(() => {
            if (nextChoice === 'cancel') {
              installConfirmCancelRef.current?.focus()
            } else {
              installConfirmInstallRef.current?.focus()
            }
          })
        }

        return
      }

      if (
        showUninstallConfirmRef.current
      ) {
        if (
          direction === 'left' ||
          direction === 'right'
        ) {
          event.preventDefault()

          const nextChoice =
            uninstallChoiceRef.current ===
            'cancel'
              ? 'uninstall'
              : 'cancel'

          setUninstallChoice(nextChoice)

          requestAnimationFrame(() => {
            if (nextChoice === 'cancel') {
              uninstallConfirmCancelRef.current?.focus()
            } else {
              uninstallConfirmUninstallRef.current?.focus()
            }
          })
        }

        return
      }

      if (
        selectedGameRef.current
      ) {
        const focused = document.activeElement
        if (
          focused instanceof Element &&
          focused.closest('.hub-sidebar, .hub-topbar')
        ) {
          event.preventDefault()
          moveSpatialFocus(direction)
          return
        }

        event.preventDefault()

        moveDetailsFocus(
          direction
        )
      }
    }

    window.addEventListener(
      'keydown',
      handleNavigation
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleNavigation
      )
    }
  }, [])

  /*
   * Controller navigation.
   *
   * Priority:
   * 1. Artwork picker
   * 2. Details
   * 3. Library
   */
  useEffect(() => {
    const unsubscribe =
      window.launcher
        .onControllerCommand(
          (command) => {
            /*
             * ARTWORK PICKER
             */
            if (
              artworkPickerOpenRef.current
            ) {
              if (
                command === 'up' ||
                command === 'down' ||
                command === 'left' ||
                command === 'right'
              ) {
                moveArtworkFocus(
                  command
                )

                return
              }

              if (
                command === 'select'
              ) {
                const index =
                  artworkIndexRef.current

                artworkOptionRefs
                  .current[
                    index
                  ]?.click()

                return
              }

              if (
                command === 'back'
              ) {
                closeArtworkPicker()
              }

              return
            }

            if (
              showInstallConfirmRef.current
            ) {
              if (
                command === 'left' ||
                command === 'right'
              ) {
                const nextChoice =
                  installChoiceRef.current ===
                  'cancel'
                    ? 'install'
                    : 'cancel'

                setInstallChoice(nextChoice)

                requestAnimationFrame(() => {
                  if (nextChoice === 'cancel') {
                    installConfirmCancelRef.current?.focus()
                  } else {
                    installConfirmInstallRef.current?.focus()
                  }
                })

                return
              }

              if (
                command === 'select'
              ) {
                if (
                  installChoiceRef.current ===
                  'install'
                ) {
                  confirmInstallGame()
                } else {
                  closeInstallConfirmation()
                }

                return
              }

              if (
                command === 'back'
              ) {
                closeInstallConfirmation()
              }

              return
            }

            if (
              showUninstallConfirmRef.current
            ) {
              if (
                command === 'left' ||
                command === 'right'
              ) {
                const nextChoice =
                  uninstallChoiceRef.current ===
                  'cancel'
                    ? 'uninstall'
                    : 'cancel'

                setUninstallChoice(nextChoice)

                requestAnimationFrame(() => {
                  if (nextChoice === 'cancel') {
                    uninstallConfirmCancelRef.current?.focus()
                  } else {
                    uninstallConfirmUninstallRef.current?.focus()
                  }
                })

                return
              }

              if (
                command === 'select'
              ) {
                if (
                  uninstallChoiceRef.current ===
                  'uninstall'
                ) {
                  confirmUninstallGame()
                } else {
                  closeUninstallConfirmation()
                }

                return
              }

              if (
                command === 'back'
              ) {
                closeUninstallConfirmation()
              }

              return
            }

            if (command === 'menu') {
              setSelectedGame(null)
              setSettingsTab('account')
              navigateTo('settings')
              return
            }

            /*
             * GAME DETAILS
             */
            if (
              selectedGameRef.current
            ) {
              if (
                command === 'up' ||
                command === 'down' ||
                command === 'left' ||
                command === 'right'
              ) {
                const focused = document.activeElement
                if (
                  focused instanceof Element &&
                  focused.closest('.hub-sidebar, .hub-topbar')
                ) {
                  moveSpatialFocus(command)
                } else {
                  moveDetailsFocus(command)
                }

                return
              }

              if (
                command === 'select'
              ) {
                const focused =
                  document.activeElement

                if (
                  focused instanceof
                    HTMLButtonElement
                ) {
                  focused.click()
                }

                return
              }

              if (
                command === 'back'
              ) {
                setSelectedGame(null)
              }

              return
            }

            if (
              command === 'up' ||
              command === 'down' ||
              command === 'left' ||
              command === 'right'
            ) {
              moveSpatialFocus(command)
              return
            }

            if (command === 'select') {
              const focused = document.activeElement
              if (focused instanceof HTMLElement && focused.matches('[data-controller-focus]')) {
                focused.click()
              } else {
                moveSpatialFocus('down')
              }
              return
            }

            if (command === 'back') {
              navigateTo(activeViewRef.current === 'library' ? 'home' : 'library')
            }
          }
        )

    return unsubscribe
  }, [])

  /*
   * Open game details.
   */
  async function openGame(
    gameId: number
  ) {
    try {
      setLoadingDetails(true)

      const game =
        await window.launcher
          .getGameDetails(
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
   * Install game.
   */
  async function handleInstall(
    gameId: number
  ) {
    try {
      const storeName = preferredStoreName(
        selectedGameRef.current
      )
      setInstallingGameId(
        gameId
      )
      setActionState('installing')
      setSteamActionMessage(
        storeName === 'Legendary'
          ? 'Legendary is installing this game...'
          : `${storeName} is handling this installation...`
      )
      setDownloadedBytes(0)
      setTotalBytes(0)

      const result =
        await window.launcher
          .installGame(
            gameId
          )

      if (!result.success) {
        console.error(
          'Install request failed:',
          result.error
        )

        setInstallingGameId(
          null
        )
        setActionState('idle')
        setSteamActionMessage(
          result.error ?? 'Install request failed.'
        )

        return
      }

      console.log(
        'Steam install requested:',
        result
      )
    } catch (error) {
      console.error(
        'Failed to request installation:',
        error
      )

      setInstallingGameId(
        null
      )
      setActionState('idle')
      setSteamActionMessage(
        error instanceof Error
          ? error.message
          : 'Install request failed.'
      )
    }
  }

  function openInstallConfirmation() {
    setInstallChoice('cancel')
    setShowInstallConfirm(true)

    requestAnimationFrame(() => {
      installConfirmCancelRef.current?.focus()
    })
  }

  function closeInstallConfirmation() {
    setShowInstallConfirm(false)
    setInstallChoice('cancel')

    requestAnimationFrame(() => {
      playButtonRef.current?.focus()
    })
  }

  async function confirmInstallGame() {
    const game =
      selectedGameRef.current

    if (!game) {
      return
    }

    setShowInstallConfirm(false)

    await handleInstall(game.id)
  }

  function openUninstallConfirmation() {
    setUninstallChoice('cancel')
    setShowUninstallConfirm(true)

    requestAnimationFrame(() => {
      uninstallConfirmCancelRef.current?.focus()
    })
  }

  function closeUninstallConfirmation() {
    setShowUninstallConfirm(false)
    setUninstallChoice('cancel')

    requestAnimationFrame(() => {
      uninstallButtonRef.current?.focus()
    })
  }

  async function confirmUninstallGame() {
    const game =
      selectedGameRef.current

    if (!game) {
      return
    }

    setShowUninstallConfirm(false)

    try {
      const storeName = preferredStoreName(game)
      setUninstallingGameId(
        game.id
      )
      setActionState('uninstalling')
      setSteamActionMessage(
        storeName === 'Legendary'
          ? 'Legendary is uninstalling this game...'
          : `${storeName} is handling this uninstall...`
      )

      const result =
        await window.launcher
          .uninstallGame(
            game.id
          )

      if (!result.success) {
        console.error(
          'Uninstall request failed:',
          result.error
        )

        setUninstallingGameId(
          null
        )
        setActionState('idle')
        setSteamActionMessage(
          result.error ?? 'Uninstall request failed.'
        )

        return
      }

      /*
      * Keep the launcher visible so the
      * user can monitor the state while
      * Steam completes the uninstall.
      */
      const checkForRemoval =
        async () => {
          try {
            await window.launcher
              .syncSteam()

            const updatedGame =
              await window.launcher
                .getGameDetails(
                  game.id
                )

            if (!updatedGame) {
              return
            }

            const stillInstalled =
              updatedGame.sources.some(
                (source) =>
                  source.install_state ===
                  'installed'
              )

            if (stillInstalled) {
              return
            }

            setSelectedGame(
              updatedGame
            )

            const updatedGames =
              await window.launcher
                .getGames()

            setGames(
              updatedGames
            )

            setInstallProgress(0)
            setDownloadedBytes(0)
            setTotalBytes(0)

            setUninstallingGameId(
              null
            )
            setActionState('idle')
            setSteamActionMessage(null)

            await window.launcher.showWindow()

            window.clearInterval(
              interval
            )
          } catch (error) {
            console.error(
              'Failed to check uninstall:',
              error
            )
          }
        }

      const interval =
        window.setInterval(
          checkForRemoval,
          1500
        )

      checkForRemoval()
    } catch (error) {
      console.error(
        'Failed to request uninstall:',
        error
      )

      setUninstallingGameId(
        null
      )
      setActionState('idle')
      setSteamActionMessage(
        error instanceof Error
          ? error.message
          : 'Uninstall request failed.'
      )
    }
  }

  /*
   * Launch game.
   */
  async function handlePlay(
    gameId: number
  ) {
    try {
      setSteamActionMessage(null)
      setRuntimeStatus(
        'launching'
      )
      setActionState('launching')

      const result =
        await window.launcher
          .launchGame(
            gameId
          )

      if (!result.success) {
        console.error(
          'Launch failed:',
          result.error
        )

        setRuntimeStatus(
          'stopped'
        )
        setActionState('idle')
        setSteamActionMessage(
          result.error ?? 'The game could not be launched.'
        )
      } else {
        setActionState('idle')
      }
    } catch (error) {
      console.error(
        'Failed to launch game:',
        error
      )

      setRuntimeStatus(
        'stopped'
      )
      setActionState('idle')
      setSteamActionMessage(
        error instanceof Error
          ? error.message
          : 'The game could not be launched.'
      )
    }
  }

  /*
   * Refresh library.
   */
  async function refreshLibrary() {
    try {
      const updatedGames =
        await window.launcher
          .getGames()

      setGames(
        updatedGames
      )
    } catch (error) {
      console.error(
        'Failed to refresh library:',
        error
      )
    }
  }

  /*
   * Refresh selected game.
   */
  async function refreshSelectedGame(
    gameId: number
  ) {
    try {
      const updatedGame =
        await window.launcher
          .getGameDetails(
            gameId
          )

      if (updatedGame) {
        setSelectedGame(
          updatedGame
        )
      }
    } catch (error) {
      console.error(
        'Failed to refresh game details:',
        error
      )
    }
  }

  /*
   * Open artwork picker.
   */
  async function openArtworkPicker() {
    const game =
      selectedGameRef.current

    if (!game) {
      return
    }

    try {
      setArtworkLoading(true)

      artworkPickerOpenRef.current =
        true

      setArtworkPickerOpen(true)

      artworkIndexRef.current = 0
      setArtworkIndex(0)

      const result:
        ArtworkResult =
        await window.launcher
          .getArtworkOptions(
            game.id
          )

      const artwork =
        result.artwork ?? []

      artworkOptionsRef.current =
        artwork

      setArtworkOptions(
        artwork
      )
    } catch (error) {
      console.error(
        'Failed to load artwork:',
        error
      )

      artworkOptionsRef.current =
        []

      setArtworkOptions([])
    } finally {
      setArtworkLoading(false)
    }
  }

  /*
   * Close artwork picker and return
   * focus to Change Artwork.
   */
  function closeArtworkPicker() {
    artworkPickerOpenRef.current =
      false

    artworkOptionsRef.current =
      []

    artworkIndexRef.current = 0

    setArtworkPickerOpen(false)
    setArtworkOptions([])
    setArtworkIndex(0)

    const hasInstalledAction =
      selectedGameRef.current?.sources.some(
        (source) =>
          source.install_state ===
          'installed'
      ) &&
      runtimeStatus === 'stopped'

    detailsActionIndex.current =
      hasInstalledAction ? 2 : 1

    requestAnimationFrame(() => {
      artworkButtonRef.current
        ?.focus()
    })
  }

  /*
   * Select custom cover.
   */
  async function chooseArtwork(
    coverUrl: string
  ) {
    const game =
      selectedGameRef.current

    if (!game) {
      return
    }

    try {
      await window.launcher
        .setCoverOverride(
          game.id,
          coverUrl
        )

      await Promise.all([
        refreshSelectedGame(
          game.id
        ),
        refreshLibrary(),
      ])

      closeArtworkPicker()
    } catch (error) {
      console.error(
        'Failed to select artwork:',
        error
      )
    }
  }

  /*
   * Restore provider artwork.
   */
  async function useDefaultArtwork() {
    const game =
      selectedGameRef.current

    if (!game) {
      return
    }

    try {
      await window.launcher
        .clearCoverOverride(
          game.id
        )

      await Promise.all([
        refreshSelectedGame(
          game.id
        ),
        refreshLibrary(),
      ])

      closeArtworkPicker()
    } catch (error) {
      console.error(
        'Failed to restore default artwork:',
        error
      )
    }
  }

  const installedGames = games.filter((game) => game.installed)
  const epicGames = games.filter((game) => game.stores.includes('epic'))
  const steamGames = games.filter((game) => game.stores.includes('steam'))
  const lastPlayedGames = [...games]
    .filter((game) => game.last_played_at)
    .sort((left, right) =>
      String(right.last_played_at).localeCompare(String(left.last_played_at))
    )
  const lastPlayedGame = lastPlayedGames[0] ?? null
  const featuredGame =
    [...games].sort((left, right) =>
      Number(Boolean(right.hero_image)) - Number(Boolean(left.hero_image))
    )[0] ?? null
  const continueGames = lastPlayedGames.length > 0
    ? lastPlayedGames.slice(0, 10)
    : installedGames.length > 0
      ? installedGames.slice(0, 10)
      : games.slice(0, 10)
  const filteredGames = games
    .filter((game) => {
      if (libraryFilter === 'installed' && !game.installed) return false
      if (libraryFilter === 'not-installed' && game.installed) return false
      if (libraryFilter === 'steam' && !game.stores.includes('steam')) return false
      if (libraryFilter === 'epic' && !game.stores.includes('epic')) return false
      return game.title.toLowerCase().includes(librarySearch.trim().toLowerCase())
    })
    .sort((left, right) => {
      if (sortBy === 'title') return left.title.localeCompare(right.title)
      if (sortBy === 'installed') return right.installed - left.installed || left.title.localeCompare(right.title)
      return right.id - left.id
    })

  useEffect(() => {
    gamesRef.current = filteredGames
    gameCardRefs.current.length = filteredGames.length
  }, [filteredGames])

  const navigationItems = [
    { id: 'home' as const, label: 'Home', icon: House },
    { id: 'library' as const, label: 'Library', icon: Library },
    { id: 'store' as const, label: 'Store', icon: Store },
    { id: 'downloads' as const, label: 'Downloads', icon: Download },
    { id: 'account' as const, label: 'Account', icon: UserRound },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ]

  function renderSidebar() {
    const providers = [
      { store: 'steam', label: 'Steam', count: steamGames.length },
      { store: 'epic', label: 'Epic Games', count: epicGames.length },
    ]

    return (
      <aside className="hub-sidebar">
        <button
          className="hub-brand"
          data-controller-focus
          onClick={() => navigateTo('home')}
          aria-label="FinalForm home"
        >
          <span className="hub-brand-mark"><Gamepad2 size={22} /></span>
          <span>FinalForm</span>
        </button>

        <nav className="hub-nav" aria-label="Main navigation">
          {navigationItems.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                ref={(element) => { sidebarRefs.current[index] = element }}
                className={activeView === item.id ? 'hub-nav-item active' : 'hub-nav-item'}
                data-controller-focus
                aria-current={activeView === item.id ? 'page' : undefined}
                onClick={() => navigateTo(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === 'downloads' && installingGameId !== null && (
                  <span className="nav-live-dot" />
                )}
              </button>
            )
          })}
        </nav>

        <div className="hub-sidebar-divider" />
        <p className="sidebar-label">Connected libraries</p>
        <div className="provider-nav">
          {providers.map((provider) => (
            <button
              key={provider.store}
              className="provider-nav-item"
              data-controller-focus
              onClick={() => {
                setLibraryFilter(provider.store as LibraryFilter)
                navigateTo('library')
              }}
            >
              <span className={`provider-mark ${provider.store}`}>
                <PlatformLogo store={provider.store as 'steam' | 'epic'} />
              </span>
              <span>{provider.label}</span>
              <span className="provider-count">{provider.count}</span>
            </button>
          ))}
        </div>

        <div className="hub-sidebar-spacer" />
        <div className="sidebar-controller-hint">
          <Gamepad2 size={16} />
          <span>Controller ready</span>
        </div>
      </aside>
    )
  }

  function renderTopbar() {
    const viewTitle = navigationItems.find((item) => item.id === activeView)?.label ?? 'Library'

    return (
      <header className="hub-topbar">
        <div className="topbar-heading">
          <span className="topbar-kicker">FinalForm</span>
          <h1>{viewTitle}</h1>
        </div>
        <label className="global-search">
          <Search size={17} />
          <input
            ref={searchInputRef}
            value={librarySearch}
            onChange={(event) => {
              setLibrarySearch(event.target.value)
              setActiveView('library')
            }}
            placeholder="Search your games"
            aria-label="Search your games"
          />
          <kbd>/</kbd>
        </label>
        <div className="topbar-actions">
          <button
            className="icon-button"
            data-controller-focus
            title="Notifications"
            aria-label="Notifications"
            onClick={() => setLibraryMessage('You are all caught up.')}
          ><Bell size={18} /></button>
          <button
            className="icon-button controller-status-button"
            data-controller-focus
            title="Controller settings"
            aria-label="Controller settings"
            onClick={() => {
              setSettingsTab('controller')
              navigateTo('settings')
            }}
          ><Gamepad2 size={18} /><span className="topbar-presence" /></button>
          <button
            className="profile-button"
            data-controller-focus
            onClick={() => navigateTo('account')}
          >
            <span className="profile-avatar"><UserRound size={17} /></span>
            <span>{profileName || 'Player'}</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </header>
    )
  }

  async function syncEpicLibrary() {
    setSyncingEpic(true)
    setLibraryMessage(null)

    try {
      const result = await window.launcher.syncEpic()
      if (!result.success) {
        setLibraryMessage(result.error ?? 'Epic library sync failed.')
        return
      }

      setGames(await window.launcher.getGames())
      setLibraryMessage(`Epic library refreshed: ${result.found} games.`)
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : 'Epic library sync failed.')
    } finally {
      setSyncingEpic(false)
    }
  }

  async function syncSteamLibrary() {
    setLibraryMessage(null)

    try {
      const result = await window.launcher.syncSteam()
      if (!result.success) {
        setLibraryMessage(result.error ?? 'Steam library sync failed.')
        return
      }

      setGames(await window.launcher.getGames())
      setLibraryMessage('Steam library refreshed.')
    } catch (error) {
      setLibraryMessage(error instanceof Error ? error.message : 'Steam library sync failed.')
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

    const isInstalling =
      installingGameId ===
      selectedGame.id

    const isUninstalling =
      uninstallingGameId ===
      selectedGame.id

    const isActionBusy =
      actionState === 'installing' ||
      actionState === 'uninstalling' ||
      actionState === 'launching'

    return (
      <div className={compactMode ? 'hub-layout compact-mode' : 'hub-layout'}>
        {renderSidebar()}
        <div className="hub-stage">
          {renderTopbar()}
          <main className="details hub-details">
        <button
          className="back-button"
          onClick={() =>
            setSelectedGame(null)
          }
        >
          ← Back
        </button>

        <div
          className="game-hero"
          style={
            selectedGame.hero_image
              ? {
                  backgroundImage:
                    `url("${selectedGame.hero_image}")`,
                }
              : undefined
          }
        >
          <div className="game-hero-overlay">
            <div className="game-hero-content">
              <h1>
                {selectedGame.title}
              </h1>

              <p className="description">
                {selectedGame.description ||
                  'No description available.'}
              </p>
            </div>
          </div>
        </div>

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
                    : isInstalling
                      ? 'Installing...'
                      : 'Not Installed'}
                </span>
              </div>
            )
          )}
        </div>

        <div className="details-actions">
          <button
            ref={playButtonRef}
            className="play-button"
            disabled={
              runtimeStatus ===
                'launching' ||
              runtimeStatus ===
                'running' ||
              isInstalling ||
              isActionBusy
            }
            onFocus={() => {
              detailsActionIndex.current =
                0
            }}
            onClick={() => {
              if (installedSource) {
                handlePlay(
                  selectedGame.id
                )
              } else {
                openInstallConfirmation()
              }
            }}
          >
            {isInstalling
              ? 'Installing...'
              : !installedSource
                ? 'Install'
                : runtimeStatus ===
                    'launching'
                  ? 'Launching...'
                  : runtimeStatus ===
                      'running'
                    ? '● Running'
                    : 'Play'}
          </button>

          {(isInstalling ||
            actionState === 'installing') && (
            <div className="install-progress">
              <div className="install-progress-header">
                <span>
                  {steamActionMessage ||
                  'Downloading'}
                </span>

                <span>
                  {Math.round(
                    installProgress
                  )}%
                </span>
              </div>

              <div className="install-progress-meta">
                <span>
                  {formatBytes(
                    downloadedBytes
                  )} / {formatBytes(totalBytes)}
                </span>
              </div>

              <div className="install-progress-track">
                <div
                  className="install-progress-fill"
                  style={{
                    width:
                      `${installProgress}%`,
                  }}
                />
              </div>
            </div>
          )}

          {installedSource &&
            runtimeStatus === 'stopped' && (
              <button
                ref={uninstallButtonRef}
                className="uninstall-button"
                disabled={
                  isUninstalling ||
                  isActionBusy
                }
                onFocus={() => {
                  detailsActionIndex.current =
                    1
                }}
                onClick={
                  openUninstallConfirmation
                }
              >
                {isUninstalling ||
                actionState === 'uninstalling'
                  ? 'Uninstalling...'
                  : 'Uninstall'}
              </button>
            )}

          <button
            ref={artworkButtonRef}
            className="change-artwork-button"
            onFocus={() => {
              detailsActionIndex.current =
                2
            }}
            onClick={
              openArtworkPicker
            }
          >
            Change Artwork
          </button>
        </div>

        {steamActionMessage &&
          !isInstalling &&
          !isUninstalling && (
            <p className="action-message" role="alert">
              {steamActionMessage}
            </p>
          )}

        {showInstallConfirm && (
          <div
            className="artwork-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm install"
          >
            <div className="artwork-picker">
              <div className="artwork-picker-header">
                <div>
                  <h2>
                    Install {selectedGame.title}?
                  </h2>
                  <p>
                    This will start the {preferredStoreName(selectedGame) === 'Legendary' ? 'Epic' : preferredStoreName(selectedGame)} installation for this game.
                    You can keep the launcher open and watch progress here.
                  </p>
                </div>
              </div>

              <div className="artwork-footer">
                <button
                  ref={installConfirmCancelRef}
                  className={
                    installChoice === 'cancel'
                      ? 'secondary-button selected'
                      : 'secondary-button'
                  }
                  onFocus={() =>
                    setInstallChoice('cancel')
                  }
                  onClick={
                    closeInstallConfirmation
                  }
                >
                  Cancel
                </button>

                <button
                  ref={installConfirmInstallRef}
                  className={
                    installChoice === 'install'
                      ? 'play-button selected'
                      : 'play-button'
                  }
                  onFocus={() =>
                    setInstallChoice('install')
                  }
                  onClick={
                    confirmInstallGame
                  }
                >
                  Install
                </button>
              </div>
            </div>
          </div>
        )}

        {showUninstallConfirm && (
          <div
            className="artwork-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm uninstall"
          >
            <div className="artwork-picker">
              <div className="artwork-picker-header">
                <div>
                  <h2>
                    Uninstall {selectedGame.title}?
                  </h2>
                  <p>
                    This will remove the game from this device.
                    You will still own it in your Steam library.
                  </p>
                </div>
              </div>

              <div className="artwork-footer">
                <button
                  ref={uninstallConfirmCancelRef}
                  className={
                    uninstallChoice === 'cancel'
                      ? 'secondary-button selected'
                      : 'secondary-button'
                  }
                  onFocus={() =>
                    setUninstallChoice('cancel')
                  }
                  onClick={
                    closeUninstallConfirmation
                  }
                >
                  Cancel
                </button>

                <button
                  ref={uninstallConfirmUninstallRef}
                  className={
                    uninstallChoice === 'uninstall'
                      ? 'play-button selected'
                      : 'play-button'
                  }
                  onFocus={() =>
                    setUninstallChoice('uninstall')
                  }
                  onClick={
                    confirmUninstallGame
                  }
                >
                  Uninstall
                </button>
              </div>
            </div>
          </div>
        )}

        {artworkPickerOpen && (
          <div
            className="artwork-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Choose artwork"
          >
            <div className="artwork-picker">
              <div className="artwork-picker-header">
                <div>
                  <h2>
                    Choose Artwork
                  </h2>

                  <p>
                    {selectedGame.title}
                  </p>
                </div>

                <button
                  className="artwork-close"
                  onClick={
                    closeArtworkPicker
                  }
                >
                  ✕
                </button>
              </div>

              {artworkLoading ? (
                <div className="artwork-message">
                  Loading artwork...
                </div>
              ) : artworkOptions.length ===
                0 ? (
                <div className="artwork-message">
                  No alternate artwork
                  found.
                </div>
              ) : (
                <div className="artwork-grid">
                  {artworkOptions.map(
                    (
                      artwork,
                      index
                    ) => (
                      <button
                        key={
                          artwork.id
                        }
                        ref={(
                          element
                        ) => {
                          artworkOptionRefs
                            .current[
                              index
                            ] =
                            element
                        }}
                        className={
                          index ===
                          artworkIndex
                            ? 'artwork-card selected'
                            : 'artwork-card'
                        }
                        onFocus={() => {
                          artworkIndexRef.current =
                            index

                          setArtworkIndex(
                            index
                          )
                        }}
                        onClick={() =>
                          chooseArtwork(
                            artwork.url
                          )
                        }
                      >
                        <img
                          src={
                            artwork.url
                          }
                          alt={`Artwork option ${
                            index + 1
                          }`}
                        />
                      </button>
                    )
                  )}
                </div>
              )}

              <div className="artwork-footer">
                <button
                  className="secondary-button"
                  onClick={
                    useDefaultArtwork
                  }
                >
                  Use Default
                </button>

                <div className="artwork-controls">
                  <span>
                    A Select
                  </span>

                  <span>
                    B Cancel
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
          </main>
        </div>
      </div>
    )
  }

  function renderGameCard(game: Game, compact = false, gridIndex: number | null = null) {
    return (
      <button
        key={game.id}
        className={compact ? 'hub-game-card compact' : 'hub-game-card'}
        ref={gridIndex === null ? undefined : (element) => { gameCardRefs.current[gridIndex] = element }}
        data-controller-focus
        onFocus={gridIndex === null ? undefined : () => { lastFocusedGameIndex.current = gridIndex }}
        onKeyDown={gridIndex === null ? undefined : (event) => handleGameKeyDown(event, gridIndex)}
        onClick={() => openGame(game.id)}
        aria-label={`Open ${game.title}`}
      >
        <span className="hub-game-art">
          {game.cover_image
            ? <img src={game.cover_image} alt={`${game.title} cover`} loading="lazy" />
            : <span className="art-placeholder">{game.title}</span>}
          <span className="game-platform-badges" aria-label={`Available on ${game.stores}`}>
            {game.stores.split(',').filter(Boolean).map((store) => (
              <span className={`game-platform-badge ${store}`} key={store} title={store === 'epic' ? 'Epic Games' : 'Steam'}>
                <PlatformLogo store={store as 'steam' | 'epic'} />
              </span>
            ))}
          </span>
          <span className={game.installed ? 'game-state installed' : 'game-state'}>
            {game.installed ? <CircleCheck size={14} /> : <ArrowDownToLine size={14} />}
          </span>
        </span>
        <span className="hub-game-title">{game.title}</span>
        <span className="hub-game-subtitle">
          {game.stores.split(',').filter(Boolean).map((store) => store === 'epic' ? 'Epic' : 'Steam').join(' · ') || 'Library'}
        </span>
      </button>
    )
  }

  function renderFeaturedGame(
    showStoreCallToAction = false,
    game = featuredGame,
    label = 'Featured from your library'
  ) {
    if (!game) {
      return (
        <section className="hub-featured empty-featured">
          <div className="featured-copy">
            <span className="eyebrow">Your collection</span>
            <h2>Your games, all together.</h2>
            <p>Connect a store library to bring its games into FinalForm.</p>
            <button className="primary-action" data-controller-focus onClick={() => navigateTo('account')}>
              <Link2 size={17} /> Connect a store
            </button>
          </div>
        </section>
      )
    }

    return (
      <section
        className="hub-featured"
        style={{
          backgroundImage: game.hero_image || game.cover_image
            ? `linear-gradient(90deg, rgba(5,10,17,.96) 0%, rgba(5,10,17,.72) 38%, rgba(5,10,17,.12) 100%), url("${game.hero_image || game.cover_image}")`
            : undefined,
        }}
      >
        <div className="featured-copy">
          <span className="eyebrow"><Sparkles size={14} /> {label}</span>
          <h2>{game.title}</h2>
          <div className="featured-platforms">
            {game.stores.split(',').filter(Boolean).map((store) => (
              <span className="platform-pill" key={store}>{store === 'epic' ? 'Epic Games' : 'Steam'}</span>
            ))}
            {game.installed && <span className="platform-pill ready"><CircleCheck size={13} /> Installed</span>}
            {game.last_played_at && <span className="platform-pill"><Clock3 size={13} /> Last played</span>}
          </div>
          <p>{game.description || 'Ready when you are.'}</p>
          <div className="featured-actions">
            <button className="primary-action" data-controller-focus onClick={() => openGame(game.id)}>
              {game.installed ? <Play size={17} fill="currentColor" /> : <ArrowDownToLine size={17} />}
              {game.installed ? 'Play' : 'View game'}
            </button>
            {showStoreCallToAction && (
              <button className="quiet-action" data-controller-focus onClick={() => navigateTo('store')}>
                <Store size={17} /> Explore stores
              </button>
            )}
          </div>
        </div>
        <button
          className="featured-open"
          data-controller-focus
          onClick={() => openGame(game.id)}
          aria-label={`View ${game.title}`}
        ><ChevronRight size={22} /></button>
      </section>
    )
  }

  function renderGameRail(title: string, items: Game[], icon: 'clock' | 'sparkles' = 'clock') {
    const RailIcon = icon === 'clock' ? Clock3 : Sparkles
    return (
      <section className="hub-section">
        <div className="section-heading">
          <h2><RailIcon size={18} /> {title}</h2>
          {items.length > 0 && <span>{items.length} games</span>}
        </div>
        {items.length > 0 ? (
          <div className="game-rail">
            {items.map((game) => renderGameCard(game, true))}
          </div>
        ) : (
          <div className="empty-strip">Games from your connected libraries will appear here.</div>
        )}
      </section>
    )
  }

  function renderLibraryToolbar() {
    const filters: { id: LibraryFilter; label: string; count: number }[] = [
      { id: 'all', label: 'All games', count: games.length },
      { id: 'installed', label: 'Installed', count: installedGames.length },
      { id: 'not-installed', label: 'Not installed', count: games.length - installedGames.length },
      { id: 'steam', label: 'Steam', count: steamGames.length },
      { id: 'epic', label: 'Epic Games', count: epicGames.length },
    ]

    return (
      <div className="library-toolbar">
        <div className="filter-tabs" role="group" aria-label="Filter games">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={libraryFilter === filter.id ? 'filter-tab active' : 'filter-tab'}
              data-controller-focus
              aria-pressed={libraryFilter === filter.id}
              onClick={() => setLibraryFilter(filter.id)}
            >
              {filter.label}<span>{filter.count}</span>
            </button>
          ))}
        </div>
        <div className="library-sort">
          <SlidersHorizontal size={16} />
          <span>Sort</span>
          <div className="sort-buttons">
            <button className={sortBy === 'recent' ? 'sort-button active' : 'sort-button'} data-controller-focus aria-label="Sort by recently added" onClick={() => setSortBy('recent')}><Clock3 size={15} /></button>
            <button className={sortBy === 'title' ? 'sort-button active' : 'sort-button'} data-controller-focus aria-label="Sort by title" onClick={() => setSortBy('title')}><List size={15} /></button>
            <button className={sortBy === 'installed' ? 'sort-button active' : 'sort-button'} data-controller-focus aria-label="Sort installed games first" onClick={() => setSortBy('installed')}><CircleCheck size={15} /></button>
          </div>
        </div>
      </div>
    )
  }

  function renderLibraryGrid() {
    return (
      <section className="hub-section library-all-section">
        <div className="section-heading all-games-heading">
          <h2>All games <span className="section-total">{filteredGames.length}</span></h2>
          {librarySearch && <button className="text-action" data-controller-focus onClick={() => setLibrarySearch('')}>Clear search</button>}
        </div>
        {renderLibraryToolbar()}
        {loadingDetails && <p className="loading-inline">Loading game details…</p>}
        {filteredGames.length > 0 ? (
          <div className="hub-game-grid">
            {filteredGames.map((game, index) => renderGameCard(game, false, index))}
          </div>
        ) : (
          <div className="empty-state">
            <Search size={24} />
            <h3>No games match this view</h3>
            <p>Try another filter or search term.</p>
            <button className="quiet-action" data-controller-focus onClick={() => { setLibraryFilter('all'); setLibrarySearch('') }}>Show all games</button>
          </div>
        )}
      </section>
    )
  }

  function renderProviderCard(store: 'steam' | 'epic') {
    const isEpic = store === 'epic'
    const count = isEpic ? epicGames.length : steamGames.length
    const connected = isEpic ? epicConnected : count > 0
    return (
      <article className="service-card" key={store}>
        <div className={`service-logo ${store}`}>
          <PlatformLogo store={store} />
        </div>
        <div className="service-info">
          <strong>{isEpic ? 'Epic Games' : 'Steam'}</strong>
          <span className={connected ? 'service-status connected' : 'service-status'}>
            <i />{connected ? (isEpic ? 'Connected' : 'Library imported') : 'Not connected'}
          </span>
          <small>{count} {count === 1 ? 'game' : 'games'} in FinalForm</small>
        </div>
        <button
          className="service-action"
          data-controller-focus
          disabled={isEpic && syncingEpic}
          onClick={isEpic ? syncEpicLibrary : syncSteamLibrary}
        >
          {isEpic && syncingEpic ? <RefreshCw className="spinning" size={15} /> : <RefreshCw size={15} />}
          {isEpic && syncingEpic ? 'Syncing' : 'Sync library'}
        </button>
      </article>
    )
  }

  function renderSettingsView() {
    const tabs: { id: SettingsTab; label: string; icon: typeof UserRound }[] = [
      { id: 'account', label: 'Account', icon: UserRound },
      { id: 'services', label: 'Connected services', icon: Link2 },
      { id: 'controller', label: 'Controller', icon: Gamepad2 },
      { id: 'interface', label: 'Interface', icon: Monitor },
      { id: 'downloads', label: 'Downloads', icon: Download },
      { id: 'game', label: 'Game settings', icon: SlidersHorizontal },
      { id: 'system', label: 'System', icon: HardDrive },
    ]
    const activeTab = tabs.find((tab) => tab.id === settingsTab) ?? tabs[0]
    const ActiveIcon = activeTab.icon

    return (
      <div className="settings-view">
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={settingsTab === tab.id}
                className={settingsTab === tab.id ? 'settings-tab active' : 'settings-tab'}
                data-controller-focus
                onClick={() => setSettingsTab(tab.id)}
              ><Icon size={16} /><span>{tab.label}</span></button>
            )
          })}
        </div>
        <section className="settings-content">
          <div className="settings-title-row">
            <div><span className="eyebrow">Preferences</span><h2><ActiveIcon size={21} />{activeTab.label}</h2></div>
          </div>
          {settingsTab === 'account' && (
            <div className="settings-panel account-panel">
              <div className="profile-summary">
                <span className="large-avatar"><UserRound size={27} /></span>
                <div><h3>{profileName || 'Player'}</h3><p>Local FinalForm profile</p></div>
              </div>
              <label className="form-field"><span>Display name</span><input value={profileName} maxLength={32} onChange={(event) => setProfileName(event.target.value)} /></label>
              <div className="account-numbers"><div><strong>{games.length}</strong><span>Games</span></div><div><strong>{installedGames.length}</strong><span>Installed</span></div><div><strong>{steamGames.length + epicGames.length}</strong><span>Store entries</span></div></div>
              <button className="quiet-action" data-controller-focus onClick={() => { setSettingsTab('services'); navigateTo('settings') }}>Manage connected services <ChevronRight size={16} /></button>
            </div>
          )}
          {settingsTab === 'services' && (
            <div className="service-list">
              <p className="settings-description">Synchronize game libraries from providers supported by this MVP.</p>
              {renderProviderCard('steam')}
              {renderProviderCard('epic')}
            </div>
          )}
          {settingsTab === 'controller' && (
            <div className="settings-panel">
              <div className="setting-row"><span className="setting-icon"><Gamepad2 size={18} /></span><div><strong>Controller navigation</strong><p>D-pad moves focus, Select activates, Back returns.</p></div><span className="enabled-pill"><CircleCheck size={14} /> Enabled</span></div>
              <div className="setting-row"><span className="setting-icon"><Keyboard size={18} /></span><div><strong>Keyboard navigation</strong><p>Arrow keys move focus; Enter selects; Escape goes back.</p></div><span className="enabled-pill"><CircleCheck size={14} /> Enabled</span></div>
            </div>
          )}
          {settingsTab === 'interface' && (
            <div className="settings-panel">
              <div className="setting-row"><span className="setting-icon"><Grid2X2 size={18} /></span><div><strong>Compact library</strong><p>Reduce card spacing to show more games at once.</p></div><button className={compactMode ? 'toggle-switch on' : 'toggle-switch'} role="switch" aria-checked={compactMode} data-controller-focus onClick={() => setCompactMode(!compactMode)}><span /></button></div>
              <div className="setting-row"><span className="setting-icon"><Monitor size={18} /></span><div><strong>Display mode</strong><p>Designed for desktop and TV-sized displays.</p></div><span className="setting-value">Automatic</span></div>
            </div>
          )}
          {settingsTab === 'downloads' && (
            <div className="settings-panel">
              <div className="setting-row"><span className="setting-icon"><HardDrive size={18} /></span><div><strong>Install location</strong><p>Epic installs use Legendary’s configured game directory.</p></div><span className="setting-value">Provider managed</span></div>
              <div className="setting-row"><span className="setting-icon"><ArrowDownToLine size={18} /></span><div><strong>Active downloads</strong><p>{installingGameId === null ? 'No active downloads.' : 'A game install is currently active.'}</p></div><button className="quiet-action" data-controller-focus onClick={() => navigateTo('downloads')}>View downloads <ChevronRight size={15} /></button></div>
            </div>
          )}
          {settingsTab === 'game' && (
            <div className="settings-panel">
              <div className="setting-row"><span className="setting-icon"><SlidersHorizontal size={18} /></span><div><strong>Default library order</strong><p>Choose how the library is organized.</p></div><div className="segmented-control"><button data-controller-focus className={sortBy === 'recent' ? 'selected' : ''} onClick={() => setSortBy('recent')}>Recent</button><button data-controller-focus className={sortBy === 'title' ? 'selected' : ''} onClick={() => setSortBy('title')}>Title</button></div></div>
            </div>
          )}
          {settingsTab === 'system' && (
            <div className="settings-panel">
              <div className="setting-row"><span className="setting-icon"><HardDrive size={18} /></span><div><strong>Platform</strong><p>FinalForm desktop runtime</p></div><span className="setting-value">{window.launcher.platform}</span></div>
              <div className="setting-row"><span className="setting-icon"><ShieldCheck size={18} /></span><div><strong>FinalForm version</strong><p>Launcher shell and local library database.</p></div><span className="setting-value">{window.launcher.version}</span></div>
            </div>
          )}
        </section>
      </div>
    )
  }

  const hubClassName = compactMode ? 'hub-layout compact-mode' : 'hub-layout'
  return (
    <div className={hubClassName} onKeyDown={(event) => {
      if (event.defaultPrevented || selectedGameRef.current) return
      const directionMap: Record<string, Direction | undefined> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      }
      const direction = directionMap[event.key]
      if (direction && (event.target as HTMLElement).tagName !== 'INPUT') {
        event.preventDefault()
        moveSpatialFocus(direction)
      }
    }}>
      {renderSidebar()}
      <div className="hub-stage">
        {renderTopbar()}
        <main className="hub-page">
          {activeView === 'home' && (
            <>
              {renderFeaturedGame(
                true,
                lastPlayedGame ?? featuredGame,
                lastPlayedGame ? 'Continue playing' : 'From your library'
              )}
              {renderGameRail('Continue playing', continueGames)}
              {renderGameRail('Recently added', [...games].sort((left, right) => right.id - left.id).slice(0, 10), 'sparkles')}
            </>
          )}

          {activeView === 'library' && (
            <>
              {renderFeaturedGame()}
              {renderGameRail('Continue playing', continueGames)}
              {renderLibraryGrid()}
            </>
          )}

          {activeView === 'store' && (
            <>
              <section className="store-intro">
                <div><span className="eyebrow"><Store size={14} /> Storefront preview</span><h2>Discover across your libraries</h2><p>Browse the games linked to your connected stores.</p></div>
                <button className="quiet-action" data-controller-focus onClick={() => navigateTo('account')}>Manage stores <ChevronRight size={16} /></button>
              </section>
              {renderFeaturedGame()}
              <div className="store-provider-heading"><h2>From Steam</h2><span>{steamGames.length} titles</span></div>
              <div className="hub-game-grid">{steamGames.slice(0, 12).map((game) => renderGameCard(game))}</div>
              <div className="store-provider-heading"><h2>From Epic Games</h2><span>{epicGames.length} titles</span></div>
              <div className="hub-game-grid">{epicGames.slice(0, 12).map((game) => renderGameCard(game))}</div>
            </>
          )}

          {activeView === 'downloads' && (
            <>
              <section className="downloads-summary"><div><span className="eyebrow">Install manager</span><h2>{installingGameId === null ? 'All caught up' : 'Download in progress'}</h2><p>{installingGameId === null ? 'Your active installs will appear here.' : games.find((game) => game.id === installingGameId)?.title}</p></div><span className="download-summary-icon"><ArrowDownToLine size={23} /></span></section>
              {installingGameId !== null && (
                <section className="download-task">
                  <div className="download-task-art">
                    {games.find((game) => game.id === installingGameId)?.cover_image && <img src={games.find((game) => game.id === installingGameId)?.cover_image ?? ''} alt="" />}
                  </div>
                  <div className="download-task-main"><strong>{games.find((game) => game.id === installingGameId)?.title}</strong><span>{steamActionMessage || 'Preparing install'}</span><div className="download-progress"><i style={{ width: `${installProgress}%` }} /></div></div>
                  <strong className="download-percent">{Math.round(installProgress)}%</strong>
                </section>
              )}
              <div className="section-heading"><h2><ArrowDownToLine size={18} /> Ready to install</h2><span>{games.length - installedGames.length}</span></div>
              <div className="hub-game-grid">{games.filter((game) => !game.installed).slice(0, 18).map((game) => renderGameCard(game))}</div>
              {games.length === installedGames.length && <div className="empty-state"><CircleCheck size={25} /><h3>Everything is installed</h3><p>New installs will appear here.</p></div>}
            </>
          )}

          {activeView === 'account' && (
            <>
              <section className="account-hero"><span className="large-avatar"><UserRound size={29} /></span><div><span className="eyebrow">Local profile</span><h2>{profileName || 'Player'}</h2><p>{games.length} games across connected libraries</p></div><button className="quiet-action" data-controller-focus onClick={() => navigateTo('settings')}>Account settings <ChevronRight size={16} /></button></section>
              <div className="section-heading"><h2>Connected store fronts</h2><button className="text-action" data-controller-focus onClick={() => { setSettingsTab('services'); navigateTo('settings') }}>Manage</button></div>
              <div className="service-grid">{renderProviderCard('steam')}{renderProviderCard('epic')}</div>
              <div className="account-library-summary"><div><strong>{games.length}</strong><span>Imported games</span></div><div><strong>{installedGames.length}</strong><span>Installed here</span></div><div><strong>{steamGames.length + epicGames.length}</strong><span>Store listings</span></div></div>
            </>
          )}

          {activeView === 'settings' && renderSettingsView()}

          {libraryMessage && (
            <div className="hub-toast" role="status">
              <CircleCheck size={16} />{libraryMessage}
              <button data-controller-focus aria-label="Dismiss message" onClick={() => setLibraryMessage(null)}>×</button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App