// The feat's public writes, POST /api/document/<op> once the server exists,
// the draft's reader, its reads, and its slice, which the shell mounts.
export { edit, version, comment, adopt, draft, merged, snapshot } from '../handlers/index.ts'
export { document, documents, shown } from '../drivers/document.ts'
export { slice } from './slice.ts'
