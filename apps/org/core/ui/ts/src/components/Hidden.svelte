<script lang="ts">
  import { useForm } from '../hooks/useForm.ts'

  // A value a form posts that no one types, named as the form it is in
  // posts it.
  let { name, value }: { name: string; value: string | number } = $props()

  const form = useForm()
</script>

<input type="hidden" name={form.name(name)} {value} />
