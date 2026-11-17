<script lang="ts">
  import { usePair } from '../hooks/usePair.ts'
  import Field from './Field.svelte'
  import Form from './Form.svelte'

  // Enrolling another browser's key, from the person's Account settings:
  // the key and its name as that browser's link filled them in, and the
  // code that browser shows large, typed by hand. The code is derived
  // from the key here and never taken from the link, so a link carrying
  // someone else's key cannot be enrolled by a click: Enrol stays
  // disabled until the typed code is the key's.
  let { key, label }: { key: string; label: string } = $props()

  const pair = usePair(() => key)
</script>

<div class="enrol" {@attach pair.watch}>
  <p class="ask">Enrol only a browser you are holding right now. Type the code it shows:</p>
  <Form action="enrol" submit="Enrol this browser" reset={false} ready={pair.ok}>
    <Field label="Key of the new browser" name="key" bind:value={pair.key} placeholder="Shown on its sign-in page" required />
    <Field label="Name for it" name="label" value={label} placeholder="laptop" />
    <label class="code">
      Code on the new browser
      <input bind:value={pair.typed} autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7Q-4MX" />
    </label>
  </Form>
</div>

<style>
  .enrol {
    display: grid;
    gap: var(--space-3);
    max-width: 32rem;
    margin-top: var(--space-4);
  }
  .ask {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .code {
    display: grid;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .code input {
    height: 2rem;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: var(--radius-control);
    background: var(--sunk);
    color: var(--text);
    font-family: var(--font-mono, monospace);
    font-size: var(--text-md);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
</style>
