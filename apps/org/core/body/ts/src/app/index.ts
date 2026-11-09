// Core body's client side, which every slice that keeps a body mounts:
// the block editor over a Loro document, the draft's live sync, which the
// slice hands its edit action and its stream, a record's body kept live
// over its session and saved by this browser, and a canonical form read,
// not edited; and a record's threads, each drawn, with the box that posts
// a comment and its mention picker, through the writes the feat names.
export { default as Editor } from '../components/Editor.svelte'
export { default as Reader } from '../components/Reader.svelte'
export { default as Thread } from '../components/Thread.svelte'
export { default as Threads } from '../components/Threads.svelte'
export { SyncState, type Where } from '../hooks/SyncState.svelte.ts'
export { LiveState, type Seat } from '../hooks/LiveState.svelte.ts'
