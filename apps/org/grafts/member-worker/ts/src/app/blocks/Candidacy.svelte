<script lang="ts">
  import { Field, Form, Popover } from '@cella/org-ui'
  import type { Path } from '../../models/path.ts'

  // Opening an employee's candidacy: the probation they serve before the
  // assembly may admit them, six months to a year from their hire, and
  // the shares they will subscribe.
  let { data }: { data: Path | null; id: string } = $props()
</script>

{#if data?.stage === 'employee' && !data.ended}
  <Popover label="Open a candidacy for membership" menu={false} wide button>
    {#snippet trigger()}Candidacy…{/snippet}
    <Form action="candidacy" submit="Open the candidacy">
      <Field label="Probation from" name="from" type="date" value={data.today} required />
      <Field label="Probation to" name="to" type="date" required />
      <Field label="Shares pledged" name="shares" type="number" placeholder="20" required />
    </Form>
  </Popover>
{/if}
