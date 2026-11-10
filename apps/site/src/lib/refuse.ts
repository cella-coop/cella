// What a build says when a page places something wrongly (index.md, the
// layout): each names what is wrong, where, and what would fix it.
import { diagrams } from '@cella/diagrams'

const known = () => Object.keys(diagrams).join(', ')

export const refuse = {
  plateless: (where: string) => new Error(`the ${where} needs a diagram, one of ${known()}, or a Phosphor icon: write diagram="…" or icon="…"`),
  twoPlates: (where: string) => new Error(`the ${where} names a diagram and an icon: keep one`),
  photoOnBand: (where: string, photo: string) => new Error(`the ${where} has a photo, but a band holds a diagram or an icon: drop photo="${photo}"`),
  plateOffBand: (where: string) => new Error(`the ${where} names a diagram or an icon, which only a band holds: make it a <Band>, or drop them`),
  unknownDiagram: (where: string, name: string) => new Error(`the ${where} names the diagram "${name}", which is not one of ${known()}`),
  unknownPhoto: (where: string, photo: string) => new Error(`the ${where} names the photo "${photo}", which is not in src/photos/`),
  unlistedInNav: (hrefs: string[]) => new Error(`site.yaml's nav links ${hrefs.join(', ')}, unlisted: take the link out of nav, or drop unlisted from the page`),
}

/** How an error names a section: its kind and its heading. */
export const where = (kind: string, heading: string) => `${kind} "${heading}"`

/** What an unlisted page asks of search engines. */
export const NOINDEX = 'noindex, nofollow'
