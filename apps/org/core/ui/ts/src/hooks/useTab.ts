import { createContext } from 'svelte'

const [get, set, has] = createContext<() => string | undefined>()

// The name of the record page's open tab, so a section in it that holds
// nothing can leave out a heading that would only repeat the tab's name.
// The record page hands it; anything below reads it.
export function useTab(name?: () => string | undefined): (() => string | undefined) | undefined {
  if (name) {
    return set(name)
  }
  return has() ? get() : undefined
}
