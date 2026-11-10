// What adopting or ending a policy did to the mandates: the mandate its
// policy grants or ended, none for a policy of another kind, and every
// mandate the write revoked, down the provenance tree from the one it
// ended or replaced, that one first.
export interface Granted {
  mandate: number | null
  revoked: number[]
}

// A mandate's policy as its page reads it: the sentence it reads as, from
// the register, and the motion that adopted it, none for one the founding
// adopted with no motion.
export interface Worded {
  policy: string
  sentence: string
  motion: string | null
}
