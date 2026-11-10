// An email address shown to people and hidden from harvesters
// (index.md, the address): its parts are shown with a few digits between
// them that the page hides, so the source never holds the address whole
// and a copy of the text holds it right; its link is written once the
// page runs, from the address encoded.

const AT = '@'

/** The parts an `Email` lays out, and its link, encoded. */
export function obscure(address: string) {
  const at = address.indexOf(AT)
  if (at < 1 || at === address.length - 1) {
    throw new Error(`site.toml's email "${address}" is not an address: write it as name${AT}domain`)
  }
  const user = address.slice(0, at)
  const domain = address.slice(at + 1)
  // digits from the address, the same on every build
  const decoy = String(1000 + ([...address].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 9000))
  const link = Buffer.from(`mailto:${address}`).toString('base64')
  return { user, at: AT, domain, decoy, link }
}
