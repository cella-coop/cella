<script lang="ts">
  import type { Kind, Tone } from '../models/view.ts'
  import type { Lifecycle } from '../models/status.ts'
  import Value from './Value.svelte'

  // A value as a cell, `Value` at its cell size: kept for the call sites
  // that have not named it yet.
  let { value, kind = 'text', tone, states, record }: { value: unknown; kind?: Kind; tone?: Tone; states?: Lifecycle; record?: string } = $props()
</script>

<Value {value} {kind} {tone} {states} {record} size="cell" />
