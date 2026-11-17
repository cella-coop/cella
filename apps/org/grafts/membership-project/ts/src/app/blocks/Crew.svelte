<script lang="ts">
  import { Pick, useWrites } from '@cella/org-ui'
  import type { Pot } from '../../models/share.ts'

  // Who runs the project, Linear's lead and members, independent of who
  // edits it: both from active membership, the lead one of them or no
  // one, the members as many as join it, chosen in the popover of its
  // People property. Each choice writes the whole crew, which replaces
  // the last, members comma-separated.
  let { data }: { data: Pot; close: () => void } = $props()

  const writes = useWrites()
  const people = $derived(data.members.map((m) => ({ value: m.address, label: m.name, who: m.name })))

  const set = (lead: string, members: string[]) =>
    writes.shown(writes.send('crew', [['lead', lead], ['members', members.join(',')]]))
</script>

<Pick
  label="Lead"
  heading="Lead"
  options={people}
  value={data.lead?.address ?? ''}
  none="No one"
  stay
  onpick={(v) => set(String(v), data.crew.map((m) => m.address))}
/>
<Pick
  label="Members"
  heading="Members"
  options={people}
  value={data.crew.map((m) => m.address)}
  multi
  onpick={(v) => set(data.lead?.address ?? '', [...v])}
/>
