import { pairCode, sameCode } from '../models/pairing.ts'

// Enrolling another browser's key: the key as the form holds it, the code
// derived from it, and what the person typed from that browser's screen.
// The code is derived here and never taken from the link; the form is
// ready only when the typed code is the key's.
export class PairState {
  key = $state('')
  typed = $state('')
  code = $state('')

  constructor(initial: () => string) {
    this.key = initial()
  }

  get ok() {
    return sameCode(this.typed, this.code)
  }

  // Attached to the form: derives the code again whenever the key changes.
  watch = () => {
    const key = this.key
    this.code = ''
    if (!key.trim()) {
      return
    }
    void pairCode(key).then((c) => {
      if (key === this.key) {
        this.code = c
      }
    })
  }
}
