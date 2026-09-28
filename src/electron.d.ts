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
    }
  }
}
