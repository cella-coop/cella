// <cella-print src print ink alt>: a picture printed in the browser. It
// draws its picture on a canvas at its own width, at most 1.5 device
// pixels to a CSS pixel as the explorer prints, runs the print core and
// lays each mask as a layer print.css colours. Importing this module
// defines it; on a server, where there is no customElements, it does
// nothing.

import { PENTAD, type Status } from './house.ts'
import { print, printMarkup, PRINT_STYLES, type Mask, type PrintStyleName } from './print.ts'

function maskUrl(m: Mask, width: number, height: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const image = new ImageData(width, height)
  for (let i = 0; i < m.alpha.length; i++) {
    image.data[i * 4 + 3] = m.alpha[i]
  }
  canvas.getContext('2d')!.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

function define(): void {
  class CellaPrint extends HTMLElement {
    static observedAttributes = ['src', 'print', 'ink', 'alt']
    #turn = 0

    connectedCallback(): void {
      this.setAttribute('role', 'img')
      void this.#draw()
    }

    attributeChangedCallback(): void {
      if (this.isConnected) {
        void this.#draw()
      }
    }

    async #draw(): Promise<void> {
      const turn = ++this.#turn
      this.setAttribute('aria-label', this.getAttribute('alt') ?? '')
      const src = this.getAttribute('src')
      if (!src) {
        this.replaceChildren()
        return
      }
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = src
      try {
        await img.decode()
      } catch {
        return
      }
      if (turn !== this.#turn) {
        return
      }
      const scale = Math.min(1.5, devicePixelRatio || 1)
      const width = Math.max(8, Math.round((this.clientWidth || img.naturalWidth) * scale))
      const height = Math.max(1, Math.round((width * img.naturalHeight) / img.naturalWidth))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)
      const name = this.getAttribute('print') ?? 'house'
      const style = PRINT_STYLES[Object.hasOwn(PRINT_STYLES, name) ? (name as PrintStyleName) : 'house']
      const ink = this.getAttribute('ink')
      const p = print(ctx.getImageData(0, 0, width, height), {
        style,
        scale,
        ink: PENTAD.includes(ink as Status) ? (ink as Status) : undefined,
      })
      this.dataset.over = p.over
      this.style.aspectRatio = `${width} / ${height}`
      this.innerHTML = printMarkup(p, p.masks.map((m) => maskUrl(m, width, height)))
    }
  }
  customElements.define('cella-print', CellaPrint)
}

if (typeof customElements !== 'undefined' && !customElements.get('cella-print')) {
  define()
}
