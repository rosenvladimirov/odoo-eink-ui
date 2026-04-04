{
    "name": "Odoo E Ink UI",
    "version": "18.0.1.0.0",
    "summary": "E Ink tablet UI optimization for BOOX, reMarkable and other e-paper devices",
    "description": """
Odoo 18 E Ink tablet UI optimization.

Activated via ?eink=1 query parameter (same pattern as ?debug=1).

Features:
- High-contrast theme: no shadows, no transitions, no animations
- System font stack only, base 16px+, line-height 1.6
- Borders over fills for all UI elements
- Drawing-enabled html fields via js-draw (pen + palm rejection)
- Pressure sensitivity via Pointer Events API
- Targets note.note, mail.message chatter, any html_field

Hardware target: BOOX Note Max 13.3 with Wacom EMR stylus (Pen 2 Plus).
    """,
    "author": "Rosen Vladimirov, BL Consulting",
    "license": "LGPL-3",
    "website": "https://github.com/rosenvladimirov/odoo-eink-ui",
    "category": "Tools",
    "depends": ["web"],
    "data": [],
    "assets": {
        # Primary variables are prepended so they're visible to all SCSS
        "web._assets_primary_variables": [
            ("prepend", "odoo_eink/static/src/scss/primary_variables.scss"),
        ],
        # Bootstrap overrides for E Ink (no shadows, no radius, no transitions)
        "web._assets_backend_helpers": [
            ("prepend", "odoo_eink/static/src/scss/bootstrap_overridden.scss"),
        ],
        # Backend bundle: vendor libs + our JS + SCSS mapping
        "web.assets_backend": [
            "odoo_eink/static/lib/epaper-components/epaper-components.css",
            "odoo_eink/static/lib/js-draw/Editor.css",
            "odoo_eink/static/lib/js-draw/bundle.js",
            "odoo_eink/static/src/scss/eink_odoo.scss",
            "odoo_eink/static/src/js/eink_mode.js",
            "odoo_eink/static/src/js/components/eink_note_field.js",
            "odoo_eink/static/src/xml/eink_note_field.xml",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
