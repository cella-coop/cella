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
  unlistedInNav: (hrefs: string[]) => new Error(`site.toml's nav links ${hrefs.join(', ')}, unlisted: take the link out of nav, or drop unlisted from the page`),
}

const SENDS: Record<string, string> = {
  signup: 'PUBLIC_SIGNUP_URL, PUBLIC_SIGNUP_LIST and PUBLIC_PILOT_LIST',
  contact: 'PUBLIC_CONTACT_URL',
}

/** A form placed on a page needs its words, `[signup]` or `[contact]` in
 * site.toml. */
export function worded<T>(form: string, text: T | undefined): T {
  if (!text) {
    throw new Error(`a page places the ${form} form, but site.toml has no [${form}]: write its words there, or take the form out of the page`)
  }
  return text
}

/** A release refuses a form that posts nowhere, which in the dev server
 * only says what it would send, and would tell a visitor it had sent. */
export function nowhere(form: string, sends: unknown) {
  if (!import.meta.env.DEV && process.env.CELLA_SITE_RELEASE === '1' && !sends) {
    throw new Error(`the ${form} form posts nowhere: set ${SENDS[form]} for the release, or take the form out of the page`)
  }
}

/** How an error names a section: its kind and its heading. */
export const where = (kind: string, heading: string) => `${kind} "${heading}"`

/** What an unlisted page asks of search engines. */
export const NOINDEX = 'noindex, nofollow'
