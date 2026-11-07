// The components the renderer hands every section's body (index.md, the
// text), so the text places a figure by its name and imports none.
import Diagram from './Diagram.astro'

import Photo from './Photo.astro'
import Icon from './Icon.astro'
import Figure from './Figure.astro'

export const figures = { Diagram, Photo, Icon, Figure }
