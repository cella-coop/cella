// `cella site photo add`: vendor Unsplash's image and credit, never hotlink.
// `cella check site`: verify every vendored image and its sidecar.
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const requireBrand = createRequire(new URL('../packages/brand/package.json', import.meta.url))
const license = 'https://unsplash.com/license'
const licence = 'Unsplash License'

export function photoUrl(input) {
  const url = new URL(input)
  if (url.protocol !== 'https:' || !['unsplash.com', 'www.unsplash.com'].includes(url.hostname)) throw new Error('expected an https://unsplash.com/photos/ URL')
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length !== 2 || parts[0] !== 'photos' || !/^[a-zA-Z0-9_-]+$/.test(parts[1])) throw new Error('expected an Unsplash photo page, /photos/<slug>')
  return { page: `https://unsplash.com/photos/${parts[1]}`, id: parts[1] }
}

export function checkPhotos(dir) {
  if (!existsSync(dir)) return
  const files = readdirSync(dir)
  for (const file of files) {
    if (!/\.(jpg|json)$/.test(file)) throw new Error(`unexpected photo file: ${file}`)
    const name = file.replace(/\.(jpg|json)$/, '')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`invalid photo name: ${name}`)
    for (const ext of ['jpg', 'json']) if (!files.includes(`${name}.${ext}`)) throw new Error(`${name} is missing ${ext}`)
    const meta = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'))
    if (!meta.photographer || !meta.photographerUrl || !meta.photoUrl || !meta.id || meta.licence !== licence || meta.licenceUrl !== license) throw new Error(`${name}: incomplete Unsplash credit`)
    photoUrl(meta.photoUrl)
    const profile = new URL(meta.photographerUrl)
    if (profile.protocol !== 'https:' || !['unsplash.com', 'www.unsplash.com'].includes(profile.hostname) || !/^\/\@[^/]+\/?$/.test(profile.pathname)) throw new Error(`${name}: invalid photographer profile`)
    if (!readFileSync(join(dir, `${name}.jpg`)).length) throw new Error(`${name}: empty image`)
  }
}

async function get(request, url, headers = {}) {
  const res = await request(url, { headers })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res
}

/** A short name from a photo page's slug: the first three words of its
 * description, without the trailing id, `-2` and on where one is taken. */
export function shortName(slug, taken = () => false) {
  const words = slug.split('-')
  const described = words.length > 1 ? words.slice(0, -1) : words
  const base = described.slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '') || slug.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  let name = base
  for (let n = 2; taken(name); n++) name = `${base}-${n}`
  return name
}

/** Vendors every photo a list of pages names, one after another, skipping
 * a page a sidecar already credits before it asks Unsplash anything, so a
 * run again spends no request on a photo it has: two requests a photo,
 * its credit and the download Unsplash asks to be told of. */
export async function addAll(inputs, site, opts = {}) {
  const dir = join(site, 'src/photos')
  const sidecars = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))) : []
  const had = new Set(sidecars.map((m) => m.photoUrl))
  const taken = (name) => existsSync(join(dir, `${name}.jpg`)) || existsSync(join(dir, `${name}.json`))
  let added = 0
  for (const input of inputs) {
    const { page, id } = photoUrl(input)
    if (had.has(page)) {
      console.log(`skipped ${page}: already vendored`)
      continue
    }
    await add(page, site, shortName(id, taken), opts)
    had.add(page)
    added++
  }
  console.log(`vendored ${added} of ${inputs.length}`)
}

export async function add(input, site, named, { request = fetch, ask } = {}) {
  const { page, id } = photoUrl(input)
  const name = named ?? shortName(id)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error('name must be lowercase words separated by hyphens')
  const dir = join(site, 'src/photos')
  if (existsSync(join(dir, `${name}.jpg`)) || existsSync(join(dir, `${name}.json`))) throw new Error(`${name}: photo already exists`)
  let photographer, profile, image, photoId = id
  if (process.env.UNSPLASH_ACCESS_KEY) {
    const headers = { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }
    const photo = await (await get(request, `https://api.unsplash.com/photos/${encodeURIComponent(id)}`, headers)).json()
    photographer = photo.user.name
    profile = `https://unsplash.com/@${photo.user.username}`
    photoId = photo.id
    // Unsplash requires this call when a photo is downloaded through its API.
    const download = await (await get(request, photo.links.download_location, headers)).json()
    image = download.url
  } else {
    const html = await (await get(request, page)).text()
    const tag = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*>/i)?.[0]
      ?? html.match(/<meta\s+[^>]*content=["'][^"']+["'][^>]*property=["']og:image["'][^>]*>/i)?.[0]
    image = tag?.match(/content=["']([^"']+)["']/i)?.[1]?.replaceAll('&amp;', '&')
    if (!image) throw new Error('Unsplash page has no og:image; use an access key')
    const prompt = ask ?? (async (question) => {
      const reader = createInterface({ input: stdin, output: stdout })
      try { return await reader.question(question) } finally { reader.close() }
    })
    photographer = (await prompt('Photographer name: ')).trim()
    profile = (await prompt('Unsplash profile URL: ')).trim()
  }
  const imageUrl = new URL(image)
  if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'images.unsplash.com') throw new Error('photo download must be hosted by images.unsplash.com')
  const meta = { photographer, photographerUrl: profile, photoUrl: page, id: photoId, licence, licenceUrl: license }
  // Check credit before writing either file.
  if (!photographer || !/^https:\/\/(www\.)?unsplash\.com\/\@[^/]+\/?$/.test(profile)) throw new Error('name and Unsplash profile URL required')
  const data = Buffer.from(await (await get(request, image)).arrayBuffer())
  const jpeg = await requireBrand('sharp')(data).jpeg({ quality: 88 }).toBuffer()
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.jpg`), jpeg, { flag: 'wx' })
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(meta, null, 2) + '\n', { flag: 'wx' })
  console.log(`vendored ${name}: ${page}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const usage = 'usage: site-photo.mjs [--check SITE | --site SITE [--name NAME] URL...]'
  try {
    if (args[0] === '--check' && args[1]) checkPhotos(join(args[1], 'src/photos'))
    else if (args[0] === '--site' && args[1]) {
      const named = args[2] === '--name' ? args[3] : undefined
      const urls = args.slice(named ? 4 : 2)
      if (!urls.length || (named && urls.length > 1)) throw new Error(usage)
      if (named) await add(urls[0], args[1], named)
      else await addAll(urls, args[1])
    } else throw new Error(usage)
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}
