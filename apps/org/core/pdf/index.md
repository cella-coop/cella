+++
title = "PDF"
updated = 2026-10-25
+++

The PDF a slice prints (`@cella/org-pdf`): text and rules placed on A4
pages, written by hand with no dependency. It uses Helvetica and
Helvetica-Bold, two of the fourteen fonts every PDF reader has, so no font
is embedded, and encodes text in WinAnsi, which holds French, the euro sign
and typographic quotes; a character outside it prints as `?`. Content
streams are left uncompressed, and a document always makes the same bytes,
since it carries no date.

- `Pdf(title)`: a document; `page()` adds an A4 page, `bytes()` writes the
  file: the catalog, the page tree, the two fonts, each page and its
  content, the document's title and the cross-reference table.
- `Page`: `text(x, y, text, style)` places a text in points from the
  page's bottom-left corner, its start or, with `align: 'right'`, its end
  at `x`, in a size, bold and a grey; `rule` draws a line and `fill` a
  grey rectangle.
- `width(text, style)`: how wide a text prints, from Adobe's metrics for
  the two fonts; an accented letter is as wide as its letter.
- `wrap(text, room, style)`: a text broken at its spaces into lines no
  wider than `room`.
- `A4`: the page's width and height in points.

The invoice feat prints an issued invoice with it
([invoice](../../feats/invoice/index.md#the-pdf)).
