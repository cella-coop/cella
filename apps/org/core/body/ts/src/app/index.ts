// Core body's client side, which every slice that keeps a body mounts:
// the block editor over a Loro document, the draft's live sync, which the
// slice hands its edit action and its stream, and a canonical form read,
// not edited.
export { default as Editor } from '../components/Editor.svelte'
export { default as Reader } from '../components/Reader.svelte'
export { SyncState, type Where } from '../hooks/SyncState.svelte.ts'
