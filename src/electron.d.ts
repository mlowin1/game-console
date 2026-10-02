export {}

declare global {
  type ControllerCommand =
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'select'
    | 'back'
    | 'menu'
    | 'secondary'

  type InstallState =
    | 'not_installed'
    | 'downloading'
    | 'installing'
    | 'uninstalling'
    | 'installed'
    | 'unknown'

  interface Game {
    id: number
    title: string
    description: string | null
    cover_image: string | null
    hero_image: string | null
    stores: string
    last_played_at: string | null
    installed: number
  }

  interface GameSource {
    source_id: number
    store: string
    store_game_id: string
    owned: number
    install_state: string | null
    install_path: string | null
    launch_method: string | null
    launch_target: string | null
  }

  interface GameDetails {
    id: number
    title: string
    description: string | null
    cover_image: string | null
    hero_image: string | null
    sources: GameSource[]
  }

  interface GameInstallStatus {
    store?: string

    state: InstallState

    appId?: string
    name?: string

    stateFlags?: number

    progress: number

    downloadedBytes: number
    totalBytes: number

    stagingProgress?: number
    stagedBytes?: number
    totalStageBytes?: number

    sizeOnDisk?: number

    libraryPath?: string
    manifestPath?: string
    error?: string
  }

  interface ArtworkOption {
    id: number
    url: string
    width: number
    height: number
    score: number
  }

  interface ArtworkOptionsResult {
    game: {
      id: number
      name: string | null
    } | null

    artwork: ArtworkOption[]
  }

  interface LauncherActionResult {
    success: boolean
    error?: string
  }

  interface SteamSyncResult {
    success: boolean
    found: boolean
    games: unknown[]
    error?: string
  }

  interface EpicConnectionStatus {
    available: boolean
    connected: boolean
    foundGames: number
    error: string | null
  }

  interface Window {
    launcher: {
      platform: string
      version: string

      getGames: () =>
        Promise<Game[]>

      getGameDetails: (
        gameId: number
      ) =>
        Promise<GameDetails | null>

      getArtworkOptions: (
        gameId: number
      ) =>
        Promise<ArtworkOptionsResult>

      setCoverOverride: (
        gameId: number,
        coverUrl: string
      ) =>
        Promise<unknown>

      clearCoverOverride: (
        gameId: number
      ) =>
        Promise<unknown>

      installGame: (
        gameId: number
      ) =>
        Promise<LauncherActionResult>

      uninstallGame: (
        gameId: number
      ) => Promise<{
        success: boolean
        error?: string
      }>

      launchGame: (
        gameId: number
      ) =>
        Promise<LauncherActionResult>

      hideWindow: () => Promise<{ success: boolean }>

      showWindow: () => Promise<{ success: boolean }>

      getGameInstallStatus: (
        gameId: number
      ) => Promise<{
        state:
          | 'not_installed'
          | 'downloading'
          | 'installing'
          | 'uninstalling'
          | 'installed'
          | 'unknown'
        progress: number
        appId?: string
        name?: string
        downloadedBytes?: number
        totalBytes?: number
        sizeOnDisk?: number
        error?: string
      }>

      syncSteam: () =>
        Promise<SteamSyncResult>

      syncEpic: () =>
        Promise<SteamSyncResult>

      getEpicConnectionStatus: () =>
        Promise<EpicConnectionStatus>

      getGameRuntimeStatus: (
        gameId: number
      ) =>
        Promise<{
          status:
            | 'stopped'
            | 'launching'
            | 'running'

          sessionId: number | null
          startedAt?: string
        }>

      onControllerCommand: (
        callback: (
          command: ControllerCommand
        ) => void
      ) => () => void
    }
  }
}