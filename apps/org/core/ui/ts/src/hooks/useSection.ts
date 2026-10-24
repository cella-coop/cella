import { createContext } from 'svelte'

const [get, set, has] = createContext<() => string>()

// The title of the section a component sits in, so a table in it can say
// what it lacks ("No roles") without each block spelling it out. A
// section hands its own title; anything below reads the nearest one.
export function useSection(title?: () => string): (() => string) | undefined {
  if (title) {
    return set(title)
  }
  return has() ? get() : undefined
}
