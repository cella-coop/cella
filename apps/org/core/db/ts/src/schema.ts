// A Standard Schema (standardschema.dev, version 1): what a call declares
// of its argument, which every transport validates it by before the call
// runs, as SvelteKit's remote functions take it, so nothing reaches a
// slice unvalidated.
export interface Schema<T> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => { value: T } | { issues: { message: string; path?: PropertyKey[] }[] }
    readonly types?: { readonly input: T; readonly output: T }
  }
}

// An object of the texts `keys` names, each at most `most` characters,
// and nothing else.
export function texts<K extends string>(keys: readonly K[], most = 4096): Schema<Record<K, string>> {
  return {
    '~standard': {
      version: 1,
      vendor: 'cella',
      validate(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return { issues: [{ message: `expected an object of ${keys.join(', ')}` }] }
        }
        const given = value as Record<string, unknown>
        const issues = [
          ...keys.flatMap((k) =>
            typeof given[k] !== 'string'
              ? [{ message: `${k} is a text`, path: [k] }]
              : (given[k] as string).length > most
                ? [{ message: `${k} is at most ${most} characters`, path: [k] }]
                : [],
          ),
          ...Object.keys(given)
            .filter((k) => !(keys as readonly string[]).includes(k))
            .map((k) => ({ message: `${k} is not asked for`, path: [k] })),
        ]
        return issues.length ? { issues } : { value: Object.fromEntries(keys.map((k) => [k, given[k]])) as Record<K, string> }
      },
    },
  }
}
