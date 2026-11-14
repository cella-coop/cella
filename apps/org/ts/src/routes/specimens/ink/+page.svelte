<script lang="ts">
  import { Failed, Frame, Inks, icons } from '@cella/org-ui'
  import { ink } from '#lib/remote/specimen.remote.ts'

  // DEV ONLY. Where the brand's inks would go in the shell, for the
  // operator's review: accordions of collections as the sidebar shows a
  // circle's, a few of Lanterne's circles and people, and a motion's
  // page's writes. The dev server alone serves it, which its query says.
  const served = ink()
  const areas = [
    { name: 'Governance', collections: [{ title: 'Motions', icon: icons.Scales }, { title: 'Meetings', icon: icons.Calendar }, { title: 'Circles', icon: icons.CirclesThree }] },
    { name: 'Office', collections: [{ title: 'Documents', icon: icons.FileText }, { title: 'Contacts', icon: icons.Buildings }] },
    { name: 'Work', collections: [{ title: 'Projects', icon: icons.Briefcase }, { title: 'Tasks', icon: icons.CheckSquare }] },
    { name: 'Payments', collections: [{ title: 'Invoices', icon: icons.Receipt }] },
    { name: 'Ledger', collections: [{ title: 'Accounts', icon: icons.Bank }] },
    { name: 'Equity', collections: [{ title: 'Capital', icon: icons.PiggyBank }] },
  ]
  const names = ['General assembly', 'Coordination', 'Web', 'Camille Martin', 'Noé Lambert', 'Aïcha Benali']
</script>

<svelte:boundary>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {#if await served}
    <Frame title="Ink specimen">
      <Inks {areas} {names} actions={['Propose', 'Export']} record={{ title: 'Motion 12', icon: icons.Scales }} />
    </Frame>
  {/if}
</svelte:boundary>
