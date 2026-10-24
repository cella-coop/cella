// The feat's public writes, POST /api/member/<op> once the server exists,
// its reads, and its slice, which the shell mounts.
export { admit, profile } from '../handlers/index.ts'
export { member, members } from '../drivers/member.ts'
export { slice } from './slice.ts'
