<script lang="ts">
  import { count } from '../models/format.ts'

  // A whole figure, muted and tabular, beside a title or a value: a
  // heading's count, a page's, a legend's.
  let { value }: { value: number } = $props()
</script>

<span class="count">{count(value)}</span>

<style>
  .count {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
