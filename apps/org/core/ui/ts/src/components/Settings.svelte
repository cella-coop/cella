<script lang="ts">
  import type { Decider, Setting as Declared } from '../models/settings.ts'
  import { useSettings } from '../hooks/useSettings.ts'
  import { useWrites } from '../hooks/useWrites.ts'
  import ProposeInstead from './ProposeInstead.svelte'
  import Setting from './Setting.svelte'

  // A settings page's form: one setting a row, each its value in force
  // and what changes it, and no Save button. Each field saves as its
  // reader leaves it, by its own write, posted by the page's `send` and
  // its outcome shown; or it opens the motion that changes it, proposed
  // through the page's `propose` write, in the dialog it opens
  // (`ProposeInstead`).
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

  const writes = useWrites()
  useSettings(
    () => settings,
    () => decider,
    (write, fields) => writes.shown(writes.send(write, fields)),
  )
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
