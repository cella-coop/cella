// A write's form while it posts: pending from submit until the page has
// its outcome, so a second press does not sign the write twice.
export class FormState {
  pending = $state(false)

  // Starts a post, or says one is already under way.
  start(): boolean {
    if (this.pending) {
      return false
    }
    this.pending = true
    return true
  }

  done() {
    this.pending = false
  }
}
