const KEY = 'cella-demo-dismissed'

// This browser's own choice, read behind try and catch: a throw (no
// storage, or a private window refusing it) means not dismissed.
function read(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function write(hidden: boolean) {
  try {
    sessionStorage.setItem(KEY, hidden ? '1' : '0')
  } catch {
    // No storage to keep it in: the choice holds only this load.
  }
}

// Whether the demo banner hides behind its watermark: this browser's own
// choice, for its room's life, kept in sessionStorage so a reload keeps
// it. The idle warning (`warn`) brings the strip back on its own and
// keeps it back until the viewer dismisses it again.
export class DismissState {
  hidden = $state(read())

  constructor(warn: () => boolean) {
    $effect(() => {
      if (warn()) {
        this.show()
      }
    })
  }

  hide() {
    this.hidden = true
    write(true)
  }

  show() {
    this.hidden = false
    write(false)
  }
}
