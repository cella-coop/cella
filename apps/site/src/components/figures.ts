// The components every page's and post's body may place by name, with no
// import (index.md, the text): the sections, what goes in them, and the
// figures.
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
import Section from './Section.astro'
import Signup from './Signup.astro'

export const figures = { Hero, Section, Band, List, Item, Actions, Action, Signup, ContactForm, Email, Diagram, Photo, Icon, Figure }
