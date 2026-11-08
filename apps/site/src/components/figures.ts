// The components the renderer hands every section's and post's body
// (index.md, the text), so the text places a figure or a list by its name
// and imports none.
import Diagram from './Diagram.astro'
import Figure from './Figure.astro'
import Icon from './Icon.astro'
import Item from './Item.astro'
import List from './List.astro'
import Photo from './Photo.astro'

export const figures = { List, Item, Diagram, Photo, Icon, Figure }
