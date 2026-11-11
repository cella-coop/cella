// Core person's public writes, POST /api/person/<op> once the server
// exists, what membership's and employment's writes run in their
// transaction, its reads, and its
// slice, which the shell mounts.
export { enrol, enrolling, entering, forget, profile, revoke } from '../handlers/index.ts'
export { devices } from '../drivers/device.ts'
export { people, person } from '../drivers/person.ts'
export { slice } from './slice.ts'
