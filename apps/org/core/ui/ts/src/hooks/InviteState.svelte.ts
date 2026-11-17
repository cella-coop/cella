// Copy invite, on a demo's room banner: copies its link to the
// clipboard, confirmed by `copied`, briefly. A browser refusing the
// clipboard (no permission, no secure context) is left to follow the
// link itself, its own default not prevented, as Share this copy always
// did.
export class InviteState {
  copied = $state(false)
  #hide: ReturnType<typeof setTimeout> | undefined

  async copy(href: string, e: MouseEvent) {
    try {
      await navigator.clipboard.writeText(href)
    } catch {
      return
    }
    e.preventDefault()
    this.copied = true
    clearTimeout(this.#hide)
    this.#hide = setTimeout(() => {
      this.copied = false
    }, 2000)
  }
}
