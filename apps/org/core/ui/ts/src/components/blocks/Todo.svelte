<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'
  import Checkbox from '../Checkbox.svelte'

  // A to-do: the UI core's own `Checkbox`, never the browser's, then its
  // text (`children`), struck through once `checked`
  // (`Blocks`' `.item[data-done]`). `oncheck` hears a turn; this
  // component commits nothing itself. `disabled` takes it out of the
  // reader's version, which shows a to-do's box but never turns it.
  let {
    checked = false,
    disabled = false,
    oncheck,
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & { checked?: boolean; disabled?: boolean; oncheck?: (checked: boolean) => void; children: Snippet } = $props()
</script>

<div class="item" data-done={checked || undefined} {...rest}>
  <Checkbox label="Done" {checked} {disabled} onchange={oncheck} />
  {@render children()}
</div>
