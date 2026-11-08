// A preview of the paper louder (uncommitted): the brand's own grain from
// house.json, its amount multiplied, as the CSS that redeclares the three
// surfaces' grain in either theme, as tokens.css declares them.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { grain, resolve, SURFACES } from '@cella/brand'

export function louder(times: number): string {
  const path = createRequire(import.meta.url).resolve('@cella/brand/house.json')
  const house = resolve(JSON.parse(readFileSync(path, 'utf8')))
  house.paper.amount *= times
  const vars = (t: 1 | -1) => SURFACES.map((s) => `--grain-${s}: ${grain(house, s, t)};`).join('\n')
  // doubled, so they outweigh tokens.css's, which loads after
  return [
    `:root:root, [data-theme='light'][data-theme='light'] { ${vars(1)} }`,
    `@media (prefers-color-scheme: dark) { :root:root:not([data-theme='light']) { ${vars(-1)} } }`,
    `[data-theme='dark'][data-theme='dark'] { ${vars(-1)} }`,
  ].join('\n')
}
