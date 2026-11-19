<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements'

  // A divider: one rule, atomic, no text of its own.
  let { ...rest }: HTMLAttributes<HTMLDivElement> = $props()
</script>

<div class="divider" {...rest}><hr /></div>
