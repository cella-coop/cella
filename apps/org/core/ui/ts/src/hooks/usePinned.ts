import { createContext } from 'svelte'
import { FavoritesState } from './FavoritesState.svelte.ts'

const [get, set, has] = createContext<FavoritesState>()

// The viewer's Favorites: the shell's, which it put in context, so a
// collection pinning a view shows it in the sidebar at once; or new ones
// where no shell is above.
export function useFavorites(): FavoritesState {
  if (has()) {
    return get()
  }
  return set(new FavoritesState())
}
