declare global {
  namespace App {
    interface Locals {
      // Who is signed in, and on which of their devices; null on the pages
      // a person reaches before signing in.
      session: { actor: string; device: string } | null
      // The signed-in person's address, or null.
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
