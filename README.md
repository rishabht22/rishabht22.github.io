# rishabht.com

My personal website. Plain HTML, CSS, and a little JavaScript, served by GitHub Pages. There's no build step: edit a file, push, done.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | Homepage: hero, selected work, experience, about, highlights, contact |
| `projects/` | Project index plus one folder per project page |
| `notes/` | Notes index plus one folder per note (KaTeX for math) |
| `coursework/` | Coursework, grouped by term |
| `stylesheet.css` | The whole design system: colours, type, spacing, every component |
| `site.js` | Header, mobile menu, scroll reveals, hover video, copy email, footer clock, fig. 0 |
| `disclosure.js` | Animated open/close for the coursework sections |
| `vendor/` | Self-hosted `model-viewer` and Draco decoder for the Cupid 3D viewer |

## Editing content

Each homepage section in `index.html` is marked with a comment like `<!-- Experience ==== -->`.

- **New experience entry:** copy an `<li class="exp">` block in the experience list.
- **New featured project:** copy an `<a class="feature">` block. Add `is-reversed` to flip the image side, and `data-hover-video` plus a `<video data-src>` to play a demo on hover.
- **New note:** copy a note folder, then add it to `notes/index.html`, the Notes list on the homepage, and `sitemap.xml`.
- **Colours and spacing:** change the variables at the top of `stylesheet.css`.

When you change `stylesheet.css` or `site.js`, bump the `?v=` query string in the HTML so browsers fetch the new version.
