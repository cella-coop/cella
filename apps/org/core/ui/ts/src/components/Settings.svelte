<script lang="ts">
  import type { Decider, Setting as Declared } from '../models/settings.ts'
  import { useSettings } from '../hooks/useSettings.ts'
  import { useWrites } from '../hooks/useWrites.ts'
  import { took, type Answer } from '../post.ts'
  import Button from './Button.svelte'
  import ProposeInstead from './ProposeInstead.svelte'
  import Setting from './Setting.svelte'

  // A settings page's form: one setting a row, each its value in force
  // and what changes it. Save posts the fields changed that the reader's
  // own writes save, each write once with its fields, by the page's
  // `send`, and offers the motion that changes the rest, proposed through
  // the page's `propose` write, in the dialog it opens (`ProposeInstead`).
  let {
    settings,
    decider = null,
    propose = 'propose',
    submit = 'Save',
  }: {
    settings: Declared[]
    // The circle that decides the motions this form offers, if any.
    decider?: Decider | null
    propose?: string
    submit?: string
  } = $props()

  const state = useSettings(() => settings, () => decider)
  const writes = useWrites()

  // One Save at a time; the writes go one after the other, and stop at
  // the first that does not settle, whose outcome the page shows; the
  // last that names one shows otherwise, as a theme kept in a cookie
  // names none.
  async function onsubmit(e: SubmitEvent) {
    e.preventDefault()
    const p = state.start()
    if (!p) {
      return
    }
    const settled: string[] = []
    try {
      for (const s of p.saves) {
        const r: Answer = await writes.shown(writes.send(s.write, Object.entries(s.fields)))
        if (!took(r)) {
          break
        }
        settled.push(s.write)
      }
    } finally {
      state.saved(p, settled)
    }
  }
</script>

<form method="post" class="settings" {onsubmit}>
  {#each settings as s (s.name)}
    <Setting setting={s} />
  {/each}
  <div class="submit"><Button type="submit" tone="primary" busy={state.pending} disabled={!state.changed}>{submit}</Button></div>
</form>
<ProposeInstead action={propose} />

<style>
  .settings {
    display: grid;
    grid-template-columns: minmax(0, 32rem);
    gap: var(--space-4);
    padding-inline: var(--inset, 0);
  }
  .submit {
    display: flex;
  }
</style>
