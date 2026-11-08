// The components the renderer hands every section's and post's body
// (index.md, the text), so the text places a figure or a list of cells by
// its name and imports none.
import Cells from './Cells.astro'
import Diagram from './Diagram.astro'
import Figure from './Figure.astro'
import Icon from './Icon.astro'
import Photo from './Photo.astro'

export const figures = { Cells, Diagram, Photo, Icon, Figure }
