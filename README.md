# odoo-eink-ui

Odoo 18 module that optimizes the backend UI for **E Ink tablets** such as
BOOX Note Max 13.3″, reMarkable and similar devices. Activated on demand via
the `?eink=1` query parameter — exactly the same pattern as `?debug=1`.

## What it does

When `?eink=1` is present:

1. **Theme overrides** — black on white, no shadows, no animations, no
   transitions, no rounded corners, borders over fills. System font stack
   only (no webfonts). Base font 16 px, line-height 1.6.
2. **Drawing-enabled `html` fields** — replaces the standard `HtmlField`
   with an OWL component that hosts a [js-draw](https://github.com/personalizedrefrigerator/js-draw)
   editor (MIT). Supports pen, eraser, text, select, undo/redo, zoom.
3. **Palm rejection** — only `pointerType === 'pen'` draws. Touch gestures
   pan and zoom instead.
4. **Pressure sensitivity** — uses the Pointer Events API `pressure`
   property, which BOOX Pen 2 Plus (Wacom EMR) reports natively.
5. **SVG storage** — the drawing is saved as `editor.toSVG().outerHTML`
   directly into the `html_field` value. Since SVG is valid HTML5, it
   renders in a normal browser without conversion when you open the
   record outside E Ink mode.

## Targets

- `note.note` (Notes app)
- `mail.message` chatter bodies
- Any model with an `html` field

## Install

```bash
# Drop the module into your addons path
cd /path/to/addons
git clone -b 18.0 git@github.com:rosenvladimirov/odoo-eink-ui.git
# Update the app list and install "Odoo E Ink UI" from Apps
```

## Usage

Open any backend URL with `?eink=1` appended:

```
https://myodoo.example.com/odoo?eink=1
```

The parameter is preserved across navigations by a history patch, so the
whole session stays in E Ink mode until you drop it manually.

## Hardware target

Primary: **BOOX Note Max 13.3″** (Android 13, Chrome, Wacom EMR stylus —
Pen 2 Plus). The module also works on reMarkable Paper Pro and any other
device that exposes `pointerType` and `pressure` via the Pointer Events API.

## File layout

```
odoo_eink/
├── __manifest__.py
├── static/
│   ├── lib/
│   │   ├── epaper-components/
│   │   │   └── epaper-components.css   MIT, design tokens
│   │   └── js-draw/
│   │       ├── bundle.js               MIT, v1.33.0
│   │       ├── Editor.css
│   │       └── LICENSE
│   └── src/
│       ├── scss/
│       │   ├── primary_variables.scss  Odoo $o-* defaults
│       │   ├── bootstrap_overridden.scss  kills shadows/transitions/radius
│       │   └── eink_odoo.scss          maps --epaper-* → Odoo tokens
│       ├── js/
│       │   ├── eink_mode.js            query-param activation service
│       │   └── components/
│       │       └── eink_note_field.js  OWL field replacing HtmlField
│       └── xml/
│           └── eink_note_field.xml
```

## CSS cascade (bottom to top)

1. `static/lib/epaper-components/epaper-components.css` — vendor E Ink design tokens
2. `static/src/scss/eink_odoo.scss` — maps `--epaper-*` onto `$o-*`
3. `static/src/scss/primary_variables.scss` — Odoo `$o-*` overrides
4. `static/src/scss/bootstrap_overridden.scss` — `$border-radius: 0`, `$box-shadow: none`, `$transition-base: none`

## OCR

Not in scope for this phase.

## License

- Module code: **LGPL-3.0**
- `js-draw`: **MIT** (see `static/lib/js-draw/LICENSE`)
- `epaper-components.css`: **MIT**
