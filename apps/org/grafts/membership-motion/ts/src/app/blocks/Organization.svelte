<script lang="ts">
  import { Explained, Note, Section, Settings, type Declared } from '@cella/org-ui'
  import type { Organization, Particular } from '../../models/asking.ts'

  // Settings' Organization page: the co-op's particulars in force, none
  // saved by anyone's write, since only a motion of the assembly adopts
  // them: a value's edit, as it commits, joins the changes to propose to
  // the assembly; and the scope's address and timezone, which a host
  // sets, each with the host icon beside its label.
  let { data }: { data: Organization } = $props()

  const labels: Record<Particular, string> = {
    name: 'Name',
    legal_name: 'Legal name',
    form: 'Legal form',
    capital: 'Capital',
    seat: 'Seat',
    siren: 'SIREN',
    rcs: 'Trade register',
    vat: 'VAT number',
  }
  // A label within a sentence, an acronym kept as it is.
  const named = (label: string) => (/^[A-Z]{2,}/.test(label) ? label : label.toLowerCase())

  const settings: Declared[] = $derived(
    data.particulars
      ? (Object.keys(labels) as Particular[]).map((name) => ({
          name,
          label: labels[name],
          value: data.particulars?.[name] ?? '',
          refused: data.refused,
          motion: {
            kind: 'policy',
            args: (value: string) => ({ [`particulars_${name}`]: value }),
            labels: { [`particulars_${name}`]: `New ${named(labels[name])}` },
            says: (value: string, was: string) =>
              value ? (was ? `Change the co-op's ${named(labels[name])} to ${value}` : `Give the co-op the ${named(labels[name])} ${value}`) : `Clear the co-op's ${named(labels[name])}`,
          },
        }))
      : [],
  )

  const hosted = $derived([
    { key: 'scope', label: 'Address', value: data.scope, text: 'A host sets it, never a motion: every write the notary signs names it.' },
    { key: 'timezone', label: 'Timezone', value: data.timezone ?? 'UTC', text: 'A host sets it, never a motion: the notary dates every verdict by its day.' },
  ])
</script>

<Section title="Particulars">
  {#if data.particulars}
    <Settings {settings} decider={data.decider} where="The co-op" />
  {:else}
    <Note text="No particulars stand yet: the founding motion adopts them." />
  {/if}
</Section>
<Section title="Scope">
  <Explained
    items={hosted.map((h) => ({ key: h.key, label: h.label, values: [{ label: 'Set to', value: h.value ?? 'Unset' }], who: { kind: 'host' as const, label: 'Set by a host', text: h.text } }))}
  />
</Section>
