<script lang="ts">
  import { useJoin } from '../hooks/useJoin.ts'
  import Button from './Button.svelte'
  import { verb } from '../verbs.ts'
  import Field from './Field.svelte'

  // An invitation's link, opened: taking it up makes the invitee's first
  // device here, a key this browser keeps and never exports, which signs
  // the acceptance itself and everything they do from then on.
  let {
    scope,
    invited,
  }: {
    scope: { address: string; name: string }
    invited: { member: string; name: string }
  } = $props()

  const state = useJoin(
    () => scope.address,
    () => invited.member,
  )
</script>

<h1 class="title">Join {scope.name}</h1>
<p class="hint">
  {invited.name}, you are invited to join {scope.name} as {invited.member}. Taking up the invitation makes a key on this
  device: it signs everything you do here, and never leaves it.
</p>
<Field label="This device" name="label" bind:value={state.label} placeholder="laptop" />
<Button lead={verb('Take up the invitation')} tone="positive" busy={state.busy} onclick={() => state.take()}>Take up the invitation</Button>
{#if state.problem}
  <p class="problem" role="alert">{state.problem}</p>
{/if}

<style>
  .title {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 500;
    font-size: var(--text-xl);
  }
  .hint {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-muted);
  }
  .problem {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--negative-text);
  }
</style>
