<script lang="ts">
  import { Note, Section, Settings, type Declared } from '@cella/org-ui'
  import type { Organization, Particular } from '../../models/asking.ts'

  // Settings' Organization page: the coop's particulars in force, none
  // saved by anyone's write, since only a motion of the assembly adopts
  // them: a value's edit, as it commits, joins the changes to propose to
  // the assembly. The scope's address and timezone, which a host sets,
  // are the page's Details (`app/circles.ts`).
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
              value ? (was ? `Change the coop's ${named(labels[name])} to ${value}` : `Give the coop the ${named(labels[name])} ${value}`) : `Clear the coop's ${named(labels[name])}`,
          },
        }))
      : [],
  )
</script>

<Section title="Particulars">
  {#if data.particulars}
    <Settings {settings} decider={data.decider} where="The coop" />
  {:else}
    <Note text="No particulars stand yet: the founding motion adopts them." />
  {/if}
</Section>
