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
    | 'failed'
    | 'cancelled'

  interface Game {
    id: number
    title: string
    description: string | null
    cover_image: string | null
    hero_image: string | null
    stores: string
    last_played_at: string | null
    compat_verdict: 'ok' | 'blocked' | 'unknown' | null
    compat_reason: string | null
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
    session_count: number
    last_played_at: string | null
    total_play_seconds: number
    compatibility: {
      verdict: 'ok' | 'blocked' | 'unknown'
      reason: string | null
      source: string | null
      reference_url: string | null
    } | null
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

  interface DownloadTask {
    game_id: number
    title: string
    cover_image: string | null
    store: string
    store_game_id: string
    state: InstallState
    progress: number
    downloadedBytes: number
    totalBytes: number
    error?: string | null
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

  interface ProviderSyncStatus {
    store: 'steam' | 'epic'
    syncState: 'never' | 'connected' | 'error'
    lastAttemptAt: string | null
    lastSuccessAt: string | null
    gameCount: number
    error: string | null
    configured: boolean
    connected: boolean
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
          | 'failed'
          | 'cancelled'
        progress: number
        appId?: string
        name?: string
        downloadedBytes?: number
        totalBytes?: number
        sizeOnDisk?: number
        error?: string
      }>

      getDownloadTasks: () => Promise<DownloadTask[]>

      cancelGameInstall: (gameId: number) => Promise<{
        success: boolean
        error?: string
      }>

      dismissDownloadTask: (gameId: number) => Promise<boolean>

      syncSteam: () =>
        Promise<SteamSyncResult>

      syncEpic: () =>
        Promise<SteamSyncResult>

      getEpicConnectionStatus: () =>
        Promise<EpicConnectionStatus>

      getProviderSyncStatus: () =>
        Promise<{
          steam: ProviderSyncStatus
          epic: ProviderSyncStatus
        }>

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

      onLibraryChanged: (callback: () => void) => () => void

      onControllerCommand: (
        callback: (
          command: ControllerCommand
        ) => void
      ) => () => void
    }
  }
}