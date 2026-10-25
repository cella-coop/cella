<script lang="ts">
  import type { Snippet } from 'svelte'
  import { fromAction } from 'svelte/attachments'
  import { enhance, type SubmitFunction } from '$app/forms'
  import { page } from '$app/state'
  import { useForm } from '../hooks/useForm.ts'
  import Button from './Button.svelte'

  // A write: the fields post to the page's named action, which signs and
  // submits it, files and all; the outcome comes back as the page's form data. `reset`
  // false keeps what was typed after a settled write, for a field whose
  // value follows the page's data.
  let {
    action,
    submit,
    tone = 'primary',
    inline = false,
    reset = true,
    ready = true,
    children,
  }: {
    action: string
    submit: string
    tone?: 'primary' | 'quiet' | 'danger'
    inline?: boolean
    reset?: boolean
    // Whether there is anything to post yet.
    ready?: boolean
    children?: Snippet
  } = $props()

  const form = useForm()

  // One post at a time: a press while one is under way is dropped, since
  // each post signs a write of its own.
  const submitting: SubmitFunction<Record<string, unknown> | undefined, Record<string, unknown> | undefined> = ({ cancel }) => {
    if (!form.start()) {
      cancel()
      return
    }
    return async ({ update }) => {
      try {
        await update({ reset })
      } finally {
        form.done()
      }
    }
  }
  const enhanced = $derived(fromAction(enhance, () => submitting))

  // The action keeps the page's address, as its open tab, so the page
  // the write returns to is the one it was made from.
  const target = $derived.by(() => {
    const kept = [...page.url.searchParams].filter(([k]) => !k.startsWith('/'))
    return `?/${action}${kept.length ? `&${new URLSearchParams(kept)}` : ''}`
  })
</script>

<form method="post" enctype="multipart/form-data" action={target} class="form" class:inline {@attach enhanced}>
  {#if children}
    <div class="fields">{@render children()}</div>
  {/if}
  <div class="submit"><Button type="submit" {tone} busy={form.pending} disabled={!ready}>{submit}</Button></div>
</form>

<style>
  .form {
    display: grid;
    gap: var(--space-3);
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-3);
  }
  .inline {
    display: flex;
    align-items: end;
    gap: var(--space-2);
  }
  .inline .fields {
    display: flex;
    gap: var(--space-2);
  }
</style>
