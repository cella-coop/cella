// A reading as its write names it: the member and the version they read.
export interface Read {
  member: string
  version: string
}

export interface Marked extends Read {
  read: string
}

// A text a member is to read: a document's binding version, adopted on a
// day, and the day they read it, or none.
export interface Text {
  id: string
  document: string
  title: string
  version: string
  adopted: string
  read: string | null
}

// A member's texts, as the acting member sees them: whether they are that
// member, who marks their own reading.
export interface Texts {
  texts: Text[]
  own: boolean
}
