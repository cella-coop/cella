// A collection's New while it is open: the shell's one Dialog, in the top
// layer, holding the create forms the collection or its extensions
// declare. New and its C shortcut open it; a create form's settled write,
// its Cancel, Escape or a click outside close it, and the forms in it
// unmount, so the next New starts empty. A refusal leaves it open, the
// form saying why with what was typed.
export class CreateState {
  open = $state(false)
  dialog: HTMLDialogElement | undefined = $state()

  constructor() {
    // The dialog follows `open`: shown modal over the page, or closed.
    $effect(() => {
      const d = this.dialog
      if (d && this.open && !d.open) {
        d.showModal()
      } else if (d && !this.open && d.open) {
        d.close()
      }
    })
  }

  show() {
    this.open = true
  }

  close() {
    this.open = false
  }

  // The dialog's close event, which a browser may fire after it was
  // opened again: only a dialog that is shut closes New.
  closed() {
    if (!this.dialog?.open) {
      this.open = false
    }
  }
}
