export {}

declare global {
  interface Game {
    id: number
    title: string
    description: string | null
    cover_image: string | null
    hero_image: string | null
    installed: number
  }

  interface Window {
    launcher: {
      platform: string
      version: string
      getGames: () => Promise<Game[]>
      getGameDetails: (gameId: number) => Promise<GameDetails | null>   
      launchGame: (
        gameId: number
      ) => Promise<{
        success: boolean
        error?: string
      }>
    }
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
}
