<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Adoption } from '../../models/adoption.ts'

  // Adopting the terms, citing the motion that moved to adopt them: it
  // settles only if that motion closed and passed, and the terms govern
  // from their year on.
  let { data }: { data: Adoption[]; id: string } = $props()

  const open = $derived(data.filter((a) => !a.adopted))
  const options = $derived(open.map((a) => ({ value: a.motion, label: `${a.motion}, ${a.title}` })))
</script>

{#if open.length}
  <Form action="adopt" submit="Adopt" tone="primary" inline>
    <Field label="Decided by" name="motion" {options} value={options[0]?.value} />
  </Form>
{/if}
