// The feat's public writes, POST /api/document/<op> once the server exists,
// the draft's reader, its reads, and its slice, which the shell mounts.
export { create, creating, slug, edit, version, comment, adopt, generate, generating, draft, merged, snapshot } from '../handlers/index.ts'
export { document, documents, shown } from '../drivers/document.ts'
export { slice } from './slice.ts'
