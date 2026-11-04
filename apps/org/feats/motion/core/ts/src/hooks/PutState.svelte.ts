import type { Kind } from '../models/circles.ts'

// What a circle's Propose form proposes, whose arguments it then asks
// for.
export class PutState {
  kind = $state<Kind>('grant')
}
