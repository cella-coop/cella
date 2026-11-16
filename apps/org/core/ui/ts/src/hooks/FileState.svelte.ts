import { accepts, offered, sized, type Picked } from '../models/file.ts'

// A file picker's state: the file chosen, by its name and size, whether a
// file is dragged over it, and why the last one was refused or why the
// form is held back, or nothing.
export class FileState {
  chosen: Picked | null = $state(null)
  dragging = $state(false)
  complaint = $state('')

  // What the picker says of its file, as a reader hears it.
  get said(): string {
    return this.chosen ? `${this.chosen.name}, ${sized(this.chosen.size)}` : ''
  }

  get size(): string {
    return this.chosen ? sized(this.chosen.size) : ''
  }

  // A file chosen or dropped, or none: one `accept` refuses is not taken,
  // and the picker says what it takes.
  take(file: Picked | null, accept?: string): boolean {
    this.dragging = false
    if (file && !accepts(accept, file)) {
      this.complaint = `${file.name} is not a file this takes: choose one of ${offered(accept)}.`
      return false
    }
    this.chosen = file ? { name: file.name, type: file.type, size: file.size } : null
    this.complaint = ''
    return true
  }

  // Required and empty, the form is held back.
  missing() {
    this.complaint = 'Choose a file.'
  }

  drag(over: boolean) {
    this.dragging = over
  }
}
