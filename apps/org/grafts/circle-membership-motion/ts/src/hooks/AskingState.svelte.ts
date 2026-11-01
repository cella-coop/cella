// What a member's or a circle's Propose form proposes, whose fields it
// then asks for; it starts at the first the page offers.
export class AskingState {
  kind = $state('')

  constructor(first: () => string) {
    this.kind = first()
  }
}
