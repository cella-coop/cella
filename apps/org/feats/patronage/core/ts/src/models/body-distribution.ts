// A distribution's save of its body: the merged snapshot as its browser holds
// it, the hash of the saved body it merged, empty for none, and who
// contributed since the last save, by address. The body itself, as the
// page reads it, is core body's own shape (`Bodied`,
// `@cella/org-body/models`), which every slice with a body shares.

export interface BodySaveDistribution {
  distribution: string
  snapshot: Uint8Array
  base: string
  contributors: string[]
}

export interface BodySavedDistribution {
  distribution: string
  circle: string
}
