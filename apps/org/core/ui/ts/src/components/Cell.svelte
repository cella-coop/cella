<script lang="ts">
  import type { Kind, Tone } from '../models/view.ts'
  import Value from './Value.svelte'

  // A value as a cell, `Value` at its cell size: kept for the call sites
  // that have not named it yet.
  let { value, kind = 'text', tone, record }: { value: unknown; kind?: Kind; tone?: Tone; record?: string } = $props()
</script>

<Value {value} {kind} {tone} {record} size="cell" />
