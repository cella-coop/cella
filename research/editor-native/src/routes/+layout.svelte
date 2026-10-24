<script lang="ts">
  import '@fontsource/alegreya/500.css'
  import '@fontsource/alegreya/500-italic.css'
  import '@fontsource/alegreya-sans/400.css'
  import '@fontsource/alegreya-sans/400-italic.css'
  import '@fontsource/alegreya-sans/700.css'
  import '@fontsource/alegreya-sans/700-italic.css'
  import '#lib/styles/tokens.css'
  import '#lib/styles/base.css'

  let { children } = $props()
</script>

{@render children()}
