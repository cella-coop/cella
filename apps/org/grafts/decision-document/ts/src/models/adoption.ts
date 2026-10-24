// A version a decision asks to adopt, and the day it was adopted, once it
// was.
export interface Asked {
  id: string
  decision: string
  title: string
  document: string
  version: string
  adopted: string | null
}
