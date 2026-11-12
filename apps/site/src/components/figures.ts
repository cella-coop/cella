// The components every page's and post's body may place by name, with no
// import (index.md, the text): the sections, what goes in them, and the
// figures; and its markdown headings a level down, `#` an h2 and so on,
// since the page's title, its hero's heading, is its one h1.
import Action from './Action.astro'
import Actions from './Actions.astro'
import Band from './Band.astro'
import ContactForm from './ContactForm.astro'
import Diagram from './Diagram.astro'
import Email from './Email.astro'
import Figure from './Figure.astro'
import Hero from './Hero.astro'
import Icon from './Icon.astro'
import Item from './Item.astro'
import List from './List.astro'
import Photo from './Photo.astro'
import H2 from './prose/H2.astro'
import H3 from './prose/H3.astro'
import H4 from './prose/H4.astro'
import Section from './Section.astro'
import Signup from './Signup.astro'

export const figures = { Hero, Section, Band, List, Item, Actions, Action, Signup, ContactForm, Email, Diagram, Photo, Icon, Figure, h1: H2, h2: H3, h3: H4 }
