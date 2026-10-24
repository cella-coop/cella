<script lang="ts">
  import '@fontsource/alegreya/400.css'
  import '@fontsource/alegreya/500.css'
  import '@fontsource/alegreya/400-italic.css'
  import '@fontsource/alegreya/700.css'
  import '@fontsource/alegreya-sans/400.css'
  import '@fontsource/alegreya-sans/700.css'
  import '../lib/tokens.css'
  import '../lib/theme.css'

  let { children } = $props()
</script>

{@render children()}
