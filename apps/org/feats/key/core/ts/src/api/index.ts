// The feat's public writes, POST /api/key/<op> once the server exists, its
// reads, and its slice, which the shell mounts.
export { enrol, revoke } from '../handlers/index.ts'
export { devices } from '../drivers/device.ts'
export { slice } from './slice.ts'
