<script module lang="ts">
  export const meta = {
    title: 'One scope, one notary',
    alt: 'An action enters a scope server. Its notary writes state and a signed log together in one transaction.',
    made: 'ai',
  } as const
</script>

<svg viewBox="0 0 720 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="2" y="60" width="152" height="100" rx="12" />
  <text x="78" y="116" text-anchor="middle">Action</text>
  <path d="M158 110h66m-12-10 12 10-12 10" />
  <rect x="230" y="2" width="488" height="216" rx="16" />
  <text x="474" y="34" text-anchor="middle">Scope server</text>
  <rect x="250" y="60" width="154" height="100" rx="12" />
  <text x="327" y="116" text-anchor="middle">Notary</text>
  <path d="M408 110h44m-12-10 12 10-12 10" />
  <rect x="460" y="50" width="242" height="120" rx="12" />
  <text x="581" y="88" text-anchor="middle">One transaction</text>
  <text x="581" y="116" text-anchor="middle">State</text>
  <text x="581" y="144" text-anchor="middle">Signed log</text>
</svg>

<style>
  svg { width: 100%; height: auto; color: var(--text); font-family: var(--font-text); font-size: var(--t-md); }
  rect { fill: var(--ground); stroke: var(--line); stroke-width: 2; }
  path { fill: none; stroke: var(--text); stroke-width: 2; }
  text { fill: var(--text); }
</style>
