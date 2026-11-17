// A property's popover editor: what was typed since it opened, and why a
// change was refused.
export class EditState {
  typed: string | null = $state(null)
  problem = $state('')
}
