# odoo-eink

## Project
Odoo 18 E Ink tablet optimization module. Single module: `odoo_eink`. LGPL-3.0.
GitHub repo: odoo-eink (public).

## Activation
`?eink=1` query param — exactly like `?debug=1`. No routing changes.

## CSS Stack (bottom to top)
1. `static/lib/epaper-components/epaper-components.css` — MIT vendor E Ink design system
2. `static/src/scss/eink_odoo.scss` — maps --epaper-* tokens → Odoo $o-* variables
3. `static/src/scss/primary_variables.scss` — Odoo $o-* overrides
4. `static/src/scss/bootstrap_overridden.scss` — $border-radius:0, $box-shadow:none, $transition-base:none

## Key E Ink CSS Rules
- No animations, no transitions, no box-shadow
- System font stack only (no webfonts)
- Base font size 16px+, line-height 1.6
- High contrast: black on white
- Borders over fills everywhere

## html_field Replacement
- OWL component: `EinkNoteField` replaces standard `HtmlField`
- Drawing engine: `static/lib/js-draw/bundle.js` (MIT, v1.33.0)
- Full js-draw functionality: pen, eraser, text tool, select, undo/redo, zoom
- Palm rejection: only pointerType === 'pen' draws, touch = pan/zoom
- Pressure sensitivity via Pointer Events API (e.pressure) — BOOX Pen 2 Plus Wacom EMR

## Storage
- Save: `editor.toSVG().outerHTML` → stored directly in html_field value
- Load: `editor.loadFromSVG(fieldValue)` on open
- SVG is valid HTML5 — readable in normal browser without conversion
- Targets: note.note, mail.message chatter, any html_field

## File Structure
```
odoo-eink/
├── odoo_eink/
│   ├── __manifest__.py
│   ├── static/
│   │   ├── lib/
│   │   │   ├── epaper-components/
│   │   │   │   └── epaper-components.css
│   │   │   └── js-draw/
│   │   │       └── bundle.js
│   │   └── src/
│   │       ├── scss/
│   │       │   ├── primary_variables.scss
│   │       │   ├── bootstrap_overridden.scss
│   │       │   └── eink_odoo.scss
│   │       ├── js/
│   │       │   ├── eink_mode.js
│   │       │   └── components/
│   │       │       └── eink_note_field.js
│   │       └── xml/
│   │           └── eink_note_field.xml
│   └── views/
│       └── assets.xml
└── CLAUDE.md
```

## No OCR
Not in scope for this phase.

## Hardware Target
BOOX Note Max 13.3" — Android 13, Chrome browser, Wacom EMR stylus (Pen 2 Plus).
