// Something waiting on a person, in their inbox: a stance to take, time,
// an expense or a pay run to approve, an invitation to take up, a meeting
// to answer, a mention to read. Core's person keeps the inbox; membership adds
// an invitation, and each slice that knows another kind adds its own. `kind`
// names it in a word, `what` says it, `about` is what it concerns,
// `since` when it began to wait and `due` by when, if anything is, and
// `href` where it is done.
export interface Ask {
  id: string
  kind: string
  what: string
  about: string
  since: string | null
  due: string | null
  href: string
}
