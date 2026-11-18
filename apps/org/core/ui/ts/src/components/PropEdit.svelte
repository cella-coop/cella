<script lang="ts">
  import { useEdit } from '../hooks/useEdit.ts'
  import { useWrites } from '../hooks/useWrites.ts'
  import { took } from '../post.ts'
  import { stash, unstash, propertyDraftId } from '../hooks/drafts.svelte.ts'
  import { editValue, type Edit, type Editor } from '../models/view.ts'
  import DateField from './DateField.svelte'
  import IconGrid from './IconGrid.svelte'
  import Pick from './Pick.svelte'

  // The body of a property's popover: the editor its kind asks for, or
  // the slice's own, and the write the choice goes through, as a form
  // posts it; the page reads again once it settles.
  let { edit, label }: { edit: Edit | Editor; label: string } = $props()

  const writes = useWrites()
  const uid = $props.id()
  let root: HTMLElement
  const s = useEdit()

  const close = () => (root?.closest('[popover]') as HTMLElement | null)?.hidePopover()

  // Kept the moment the choice is accepted, by who made it and which
  // demo copy, with the value it replaces (`was`), so a reload right
  // after, before the signed write itself survives it, still reaches
  // the server: `Properties`' own mount, on the page the change is made
  // on, posts it again, but only where the field still reads `was`, so
  // it never overwrites a value this draft never saw. Refused outright,
  // it is dropped, never retried with the same stale value; offline, it
  // stands for the next opening to try again.
  async function commit(e: Edit, value: string) {
    s.problem = ''
    const write = e.writes?.[value] ?? e.write
    const fields: [string, string][] = [[e.field, value], ...(e.extra ?? [])]
    const id = propertyDraftId(writes.actor, writes.copy, location.pathname, e.field)
    const tok = stash(id, write, fields, editValue(e))
    const answer = await writes.shown(writes.send(write, fields))
    if (took(answer) || ('done' in answer && answer.done && answer.done.state !== 'unknown')) {
      unstash(id, tok)
    }
    if (!took(answer)) {
      s.problem = 'The change was not made.'
    }
  }

  const text = editValue
  const isDate = (e: Edit) => e.kind === 'date'
</script>

<div bind:this={root} class="edit">
  {#if 'block' in edit}
    {const Block = $derived(edit.block)}
    <Block data={edit.data} {close} />
  {:else if edit.kind === 'pick'}
    <Pick
      {label}
      options={edit.options ?? []}
      value={edit.current ?? (edit.multi ? [] : '')}
      multi={edit.multi}
      none={edit.none}
      onpick={(v) => commit(edit, Array.isArray(v) ? v.join(',') : v)}
    />
  {:else if edit.kind === 'icon'}
    <IconGrid value={typeof edit.current === 'string' ? edit.current : null} onpick={(slug) => commit(edit, slug ?? '')} />
  {:else if isDate(edit)}
    <label class="field">
      <span class="visually-hidden">{label}</span>
      <DateField
        id="{uid}-day"
        name={edit.field}
        bind:value={() => s.typed ?? text(edit), (v) => {
          s.typed = String(v)
          commit(edit, String(v))
        }}
      />
    </label>
  {:else}
    <form
      class="field"
      onsubmit={(ev) => {
        ev.preventDefault()
        commit(edit, s.typed ?? text(edit)).then(close)
      }}
    >
      <!-- svelte-ignore a11y_autofocus -->
      <input type={edit.number ? 'number' : 'text'} aria-label={label} placeholder={edit.hint} value={s.typed ?? text(edit)} oninput={(ev) => (s.typed = ev.currentTarget.value)} autofocus />
    </form>
  {/if}
  {#if s.problem}<p class="problem" role="alert">{s.problem}</p>{/if}
</div>

<style>
  .edit {
    display: grid;
    gap: var(--space-1);
  }
  .field input {
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font: inherit;
    font-size: var(--text-sm);
  }
  .problem {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--negative-text);
  }
</style>
