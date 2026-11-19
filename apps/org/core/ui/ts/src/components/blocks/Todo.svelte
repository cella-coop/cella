<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import Checkbox from '../Checkbox.svelte'

  // A to-do: the UI core's own `Checkbox`, never the browser's, then its
  // text (`children`), struck through once `checked`
  // (`Blocks`' `.item[data-done]`). `oncheck` hears a turn; this
  // component commits nothing itself.
  let {
    checked = false,
    oncheck,
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & { checked?: boolean; oncheck?: (checked: boolean) => void; children: Snippet } = $props()
</script>

<div class="item" data-done={checked || undefined} {...rest}>
  <Checkbox label="Done" {checked} onchange={oncheck} />
  {@render children()}
</div>
