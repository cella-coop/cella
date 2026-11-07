<script lang="ts">
  import { power, Section, Table, type Column } from '@cella/org-ui'
  import type { Depth, Provenance } from '../../models/circle.ts'
  import { cap, covers, narrows } from '../words.ts'

  // Where a mandate's authority comes from: its chain, the root the
  // assembly issued first, down to the mandate, each link with how it
  // narrows the one above; and below it what was issued under it, which
  // its revocation revokes the same day. Each row opens its mandate.
  let { data }: { data: Provenance; id: string } = $props()

  const above = (k: Depth) => data.chain.find((p) => p.depth === k.depth - 1)
  const chain: Column<Depth>[] = [
    { key: 'grantee', label: 'Granted to', kind: 'title', value: (k) => (k.id === data.id ? `${k.granteeName} (this one)` : k.granteeName) },
    { key: 'issuer', label: 'Issued by', kind: 'mono', value: (k) => k.issuer },
    { key: 'cap', label: 'Cap', value: (k) => cap(k).replace(/^up to /, '') },
    { key: 'scope', label: 'Covers', value: (k) => covers(k) },
    {
      key: 'narrows',
      label: 'Narrows the one above',
      value: (k) => {
        const a = above(k)
        return a ? narrows(k, a).join('; ') || 'as wide' : 'the root, the assembly\'s'
      },
    },
  ]
  const under: Column<Depth>[] = [
    { key: 'depth', label: 'Below', kind: 'number', value: (k) => k.depth },
    { key: 'power', label: 'Power', value: (k) => power(k.power) },
    { key: 'grantee', label: 'Granted to', kind: 'title', value: (k) => k.granteeName },
    { key: 'issuer', label: 'Issued by', kind: 'mono', value: (k) => k.issuer },
    { key: 'cap', label: 'Cap', value: (k) => cap(k) },
    { key: 'scope', label: 'Covers', value: (k) => covers(k) },
    { key: 'state', label: 'State', kind: 'badge', value: (k) => k.state },
  ]
  const open = (k: Depth) => `/mandates/${k.id}`
</script>

<Section title="Chain" count={data.chain.length}>
  <Table columns={chain} rows={data.chain} href={open} />
</Section>
<Section title="Issued under it" count={data.under.length}>
  <Table columns={under} rows={data.under} href={open} empty="Nothing is issued under it" />
</Section>
