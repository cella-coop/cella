<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLAttributes } from 'svelte/elements'

  // A block of code: its language, the caller's own control, a static
  // word or the editable `Select` the editor binds (`language`), then
  // its text (`children`) in `Blocks`' monospace well.
  let {
    language,
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & { language: Snippet; children: Snippet } = $props()
</script>

<div class="code" {...rest}>
  <span class="language">{@render language()}</span>
  {@render children()}
</div>
