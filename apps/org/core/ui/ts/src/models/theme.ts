import type { Attachment } from 'svelte/attachments'
import type { Theme } from './view.ts'

// Wears the theme on the page's root, as the server wrote it there before
// any script ran, and again whenever a write changes it, as Account's
// Save does, with no reload.
export const worn =
  (theme: Theme): Attachment =>
  () => {
    document.documentElement.dataset.theme = theme === 'system' ? '' : theme
  }
