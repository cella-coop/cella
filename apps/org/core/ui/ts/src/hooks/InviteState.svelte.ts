// Copy invite, on a demo's room banner: copies its link to the
// clipboard, confirmed by `copied`, briefly, the navigation it sits on
// cancelled synchronously so a successful copy never also follows the
// link. A modified click (ctrl, meta, shift or the middle button) keeps
// its ordinary link behaviour instead, never touching the clipboard. A
// browser refusing the clipboard (no permission, no secure context)
// follows the link itself, navigated here since its default was already
// cancelled.
export class InviteState {
  copied = $state(false)
  #hide: ReturnType<typeof setTimeout> | undefined

  async copy(href: string, e: MouseEvent) {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) {
      return
    }
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(href)
    } catch {
      const w = e.view ?? window
      w.location.href = href
      return
    }
    this.copied = true
    clearTimeout(this.#hide)
    this.#hide = setTimeout(() => {
      this.copied = false
    }, 2000)
  }
}
