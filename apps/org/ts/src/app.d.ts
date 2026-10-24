declare global {
  namespace App {
    interface Locals {
      // The member the dev server signs as; always null outside dev mode.
      actor: string | null
      theme: 'light' | 'dark' | 'system'
    }
    interface Error {
      status: number
      message: string
    }
  }
}

export {}
