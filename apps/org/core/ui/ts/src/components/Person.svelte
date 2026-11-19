<script lang="ts">
  import { useShell } from '../hooks/useShell.ts'

  // A person wherever one appears: their name, their address on hover,
  // or the address alone where the coop knows no one by it.
  let { address }: { address: string } = $props()

  const shell = useShell()
  const name = $derived(shell.name(address))
</script>

<span class="person" class:unknown={!name} title={name ? address : undefined}>{name ?? address}</span>

<style>
  .person {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .unknown {
    color: var(--text-muted);
  }
</style>
