// The drawer's Related: whether a long list shows every line, or its
// first few and Show N more.
export class RelatedState {
  all = $state(false)

  toggle() {
    this.all = !this.all
  }
}
