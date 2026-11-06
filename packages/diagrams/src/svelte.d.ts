// Svelte's generic component declaration does not describe module exports.
// site-diagrams.mjs checks that each diagram actually exports this metadata.
declare module '*.svelte' {
  import type { Component } from 'svelte'
  const component: Component
  export default component
  export const meta: { title: string; alt: string; made: 'ai' }
}
