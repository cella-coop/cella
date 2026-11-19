<script lang="ts">
  import { Field, icons, Panel, Row, short, type Embed } from '@cella/org-ui'
  import { Reader } from '@cella/org-body/app'
  import type { OnMotion } from '../../models/adoption.ts'
  import { Card } from '@cella/org-motion/bindings'

  // The document version a motion asks to adopt, in full: its version,
  // hash and what it replaces or when it was adopted as read-only fields,
  // over the version read from its canonical form, which the database
  // computed from its snapshot, with its hash, which the motion names; a
  // panel each after the motion's proposal.
  let { data }: { data: OnMotion; id: string } = $props()

  const motion: Embed<OnMotion> = { label: 'Motion', block: Card }
  const embeds = $derived({ motion: { embed: motion, data } })
</script>

{#each data.adopting as a (a.id)}
  <Panel title="Adopts {a.name}" icon={icons.FileText} status={a.adopted ? { label: 'adopted', tone: 'positive' } : null}>
    <Row spaced>
      <Field readonly label="Version" value={a.version} kind="mono" href="/documents/{a.document}" />
      <Field readonly label="Hash" value={short(a.hash, 16)} kind="mono" />
      {#if a.adopted}
        <Field readonly label="Adopted" value={a.adopted} kind="date" />
      {:else if a.current}
        <Field readonly label="Replaces" value="@{a.current.split('@')[1]}" kind="mono" href="/documents/{a.document}" />
      {:else}
        <Field readonly label="Replaces" value="nothing adopted yet" />
      {/if}
    </Row>
    <Reader canon={a.canonical} label="{a.name}, {a.version}" {embeds} />
  </Panel>
{/each}
