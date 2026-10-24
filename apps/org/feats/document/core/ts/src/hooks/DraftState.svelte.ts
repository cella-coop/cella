// The draft as the text area holds it: the merged draft until the member
// types, and the draft again once a save brings it back changed.
export class DraftState {
  readonly #draft: () => string

  constructor(draft: () => string) {
    this.#draft = draft
  }

  text = $derived.by(() => this.#draft())

  dirty = $derived.by(() => this.text.replaceAll('\r\n', '\n') !== this.#draft())

  revert() {
    this.text = this.#draft()
  }
}
