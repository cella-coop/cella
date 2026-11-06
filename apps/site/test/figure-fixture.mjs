// Build-only fixture: no invented credit is committed as a vendored photo.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const root = new URL('../../..', import.meta.url).pathname
const site = join(root, 'apps/site')
const photos = join(site, 'src/photos')
mkdirSync(photos, { recursive: true })
const fixture = JSON.parse(readFileSync(join(root, 'tools/_tests/brand/explorer-print.json'), 'utf8'))
const jpg = join(photos, 'fixture.jpg')
const json = join(photos, 'fixture.json')
try {
  await sharp(Buffer.from(fixture.input, 'base64'), { raw: { width: fixture.width, height: fixture.height, channels: 4 } }).jpeg().toFile(jpg)
  writeFileSync(json, JSON.stringify({ photographer: 'Fixture', photographerUrl: 'https://unsplash.com/@fixture', photoUrl: 'https://unsplash.com/photos/fixture', id: 'fixture', license: 'https://unsplash.com/license' }))
  for (const bad of [true, false]) {
    const result = spawnSync('pnpm', ['exec', 'astro', 'build', '--config', 'test/astro.config.mjs', '--outDir', join(site, 'dist')], {
      cwd: site, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', FIGURE_TEST_BAD_ICON: bad ? '1' : '' },
    })
    if (bad ? result.status === 0 || !result.stderr.includes('not-a-phosphor-icon') : result.status !== 0) {
      throw new Error(`figure fixture build (bad=${bad}) unexpected exit ${result.status}: ${result.stdout}\n${result.stderr}`)
    }
  }
} finally {
  rmSync(jpg, { force: true })
  rmSync(json, { force: true })
}
