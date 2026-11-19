<script lang="ts">
  import type { Component } from 'svelte'
  import Frame from './PageFrame.svelte'

  // A page's skeleton while its queries load the first time: its frame,
  // named by what the shell knows without them, and quiet lines where its
  // content goes. Static, drawing no data, and holding no component with
  // state, since a pending snippet remounts what it holds
  // (sveltejs/svelte#19107).
  let { title = '', icon }: { title?: string; icon?: Component<any> } = $props()
</script>

<Frame {title} {icon}>
  <div class="skeleton" aria-busy="true" aria-label="Loading" data-pending>
    {#each [72, 56, 64, 40, 52] as width}
      <span class="line" style:inline-size="{width}%"></span>
    {/each}
  </div>
</Frame>

<style>
  .skeleton {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-3);
  }
  .line {
    display: block;
    block-size: var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--sunk);
  }
</style>
