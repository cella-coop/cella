<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Suggest } from '../hooks/RichState.svelte.ts'
  import Form from './Form.svelte'
  import Hidden from './Hidden.svelte'
  import RichField from './RichField.svelte'

  // What starts or answers a `Conversation`: a `Form` posting `action`,
  // its other fields as `hidden` names them, around one `RichField`
  // named `name`, as a record's own box that starts a thread and the
  // box at a thread's foot that replies both are. `head` sits inside its
  // top, as the quote a reply answers.
  let {
    action,
    hidden = {},
    label,
    name = 'text',
    placeholder = '',
    rows = 2,
    send,
    suggest,
    head,
  }: {
    action: string
    // Its other fields, by name, as a reply's parent or a quote's version.
    hidden?: Record<string, string>
    label: string
    name?: string
    placeholder?: string
    rows?: number
    send?: string
    suggest?: Suggest
    head?: Snippet
  } = $props()
</script>

<Form {action} bare>
  {#each Object.entries(hidden) as [k, v] (k)}
    <Hidden name={k} value={v} />
  {/each}
  <RichField {label} {name} {placeholder} {rows} {send} {suggest} {head} />
</Form>
