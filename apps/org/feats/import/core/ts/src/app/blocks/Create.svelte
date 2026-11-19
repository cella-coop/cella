<script lang="ts">
  import { Field, Form } from '@cella/org-ui'
  import type { Kind, Run } from '../../models/run.ts'

  // A file from another tool, of a kind the coop imports, tried first in
  // a dry run, which makes every write and undoes them, or imported, as
  // the acting member.
  let { about }: { rows: Run[]; about: { kinds: Kind[] } } = $props()

  const kinds = $derived(about.kinds.map((k) => ({ value: k.kind, label: k.title })))
  const modes = [
    { value: 'dry', label: 'A dry run, undone' },
    { value: 'import', label: 'Import' },
  ]
</script>

<Form action="run" submit="Run" ready={kinds.length > 0}>
  <Field label="Kind" name="kind" options={kinds} value={kinds[0]?.value ?? ''} />
  <Field label="As" name="mode" options={modes} value="dry" />
  <Field label="File" name="file" type="file" accept=".csv,.txt,text/csv,text/plain" required wide />
</Form>
