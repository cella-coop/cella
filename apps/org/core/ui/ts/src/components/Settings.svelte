<script lang="ts">
  import type { Decider, Setting as Declared } from '../models/settings.ts'
  import { useSettings } from '../hooks/useSettings.ts'
  import ProposeInstead from './ProposeInstead.svelte'
  import Setting from './Setting.svelte'

  // A settings page's form: one setting a row, each its value in force
  // and what changes it, and no Save: a setting the reader's own write
  // saves is saved as its field commits, and one only a motion changes
  // opens the dialog proposing it (`ProposeInstead`), through the page's
  // `propose` write.
  let {
    settings,
    decider = null,
    propose = 'propose',
  }: {
    settings: Declared[]
    // The circle that decides the motions this form offers, if any.
    decider?: Decider | null
    propose?: string
  } = $props()

  useSettings(() => settings, () => decider)
</script>

<form method="post" class="settings" onsubmit={(e) => e.preventDefault()}>
  {#each settings as s (s.name)}
    <Setting setting={s} />
  {/each}
</form>
<ProposeInstead action={propose} />

<style>
  .settings {
    display: grid;
    grid-template-columns: minmax(0, 32rem);
    gap: var(--space-4);
    padding-inline: var(--inset, 0);
  }
</style>
