import type { Kind } from '../models/index.ts'

// What a circle's Propose form proposes, whose arguments it then asks
// for.
export class PutState {
  kind = $state<Kind>('grant')
}
