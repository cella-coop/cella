<script lang="ts">
  import { Failed, Frame, Section, Settings, useWrites, type Declared } from '@cella/org-ui'
  import { specimen } from '#lib/remote/settings.remote.ts'
  import { onSettings } from '#lib/writes.ts'

  // DEV ONLY. Two settings as a circle's page would declare them for its
  // manager: their own name, which their write saves, and the circle's
  // name, which their write may not change, its refusal in its guard's
  // words, and which a motion of the assembly changes. The dev server
  // alone serves it, which its query says.
  const served = specimen()
  const settings: Declared[] = [
    { name: 'name', label: 'Your name', value: 'Camille Martin', write: 'profile' },
    {
      name: 'circle',
      label: 'Circle name',
      value: 'Coordination',
      write: 'rename',
      refused: 'camille@lanterne.example holds no amend-circle in coordination: only a motion of Assembly renames it',
      motion: {
        kind: 'amend-circle',
        args: (value) => ({ circle: 'coordination', name: value }),
        labels: { name: 'New name' },
        says: (value, was) => `Rename ${was} to ${value}`,
      },
    },
  ]

  // Its writes are sent as a settings page's, which a test answers.
  useWrites().serve(() => onSettings(() => 'specimen', false))
</script>

<svelte:boundary>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {#if await served}
    <Frame title="Settings specimen">
      <Section title="Coordination">
        <Settings {settings} decider={{ circle: 'ag', name: 'Assembly', deadline: '2026-11-23' }} />
      </Section>
    </Frame>
  {/if}
</svelte:boundary>
