<script lang="ts">
  import { Badge, Button, Card, Failed, Frame, Panel, Section, Stat, Stats, icons } from '@cella/org-ui'
  import { states } from '#lib/remote/states.remote.ts'

  // DEV ONLY. The states specimen, for the operator's review: a state has
  // one look everywhere, a pill with a dot, including the one the kit
  // gains here, Failed, an operational failure rather than a refusal;
  // and the drawer's Card and a tab's Section share Panel's own header,
  // its icon, its count, its pill and its quiet facts. The dev server
  // alone serves it, which its query says.
  const served = states()
  const tones = ['neutral', 'accent', 'positive', 'warning', 'negative', 'failed'] as const
  const words: Record<(typeof tones)[number], string> = {
    neutral: 'Draft',
    accent: 'Open',
    positive: 'Paid',
    warning: 'Overdue',
    negative: 'Refused',
    failed: 'Failed',
  }
</script>

{#snippet help()}
  A run failed once, as a row of an import might; not refused, which a
  guard decides.
{/snippet}

{#snippet actions()}
  <Button tone="primary">Retry</Button>
{/snippet}

<svelte:boundary>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {#if await served}
    <Frame title="States specimen">
      <Panel title="Import" icon={icons.FileArrowUp} count={tones.length} status={{ label: 'Failed', tone: 'failed' }} meta="19 Nov" {help} {actions}>
        <Stats>
          {#each tones as tone (tone)}
            <Stat label={tone} value={words[tone]} kind="badge" {tone} />
          {/each}
        </Stats>
      </Panel>
      <Section title="Rows" icon={icons.Tray} count={tones.length} status={{ label: 'Failed', tone: 'failed' }}>
        <ul>
          {#each tones as tone (tone)}
            <li><Badge {tone}>{words[tone]}</Badge></li>
          {/each}
        </ul>
      </Section>
      <Card title="Legend" icon={icons.ChatCircle} count={tones.length} status={{ label: 'Failed', tone: 'failed' }}>
        <ul>
          {#each tones as tone (tone)}
            <li><Badge {tone}>{words[tone]}</Badge></li>
          {/each}
        </ul>
      </Card>
    </Frame>
  {/if}
</svelte:boundary>
