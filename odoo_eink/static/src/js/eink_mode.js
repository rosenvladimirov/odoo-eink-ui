/** @odoo-module **/
// ============================================================================
// E Ink mode activation
//
// Activated via `?eink=1` query parameter. When active:
//   1. Adds `html.o_eink_mode` class → eink_odoo.scss kicks in
//   2. Swaps the "html" field widget for EinkNoteField (js-draw canvas)
//   3. Preserves `?eink=1` across navigations via History API patch
//
// Runs at module load time (not as a service) so the field registry swap
// happens BEFORE any form view looks up the "html" widget.
// ============================================================================
import { registry } from "@web/core/registry";
import { einkNoteField } from "./components/eink_note_field";

function isEinkMode() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get("eink") === "1";
    } catch (e) {
        return false;
    }
}

// Run at module load — BEFORE any form view renders
if (isEinkMode()) {
    // 1) Add CSS hook
    document.documentElement.classList.add("o_eink_mode");

    // 2) Swap the field widget. Keep the original accessible under a new name
    //    so users can opt back via widget="html_original".
    const fields = registry.category("fields");

    // Do the swap once the original html widget is registered.
    // html_editor registers "html" at its own module load — due to alphabetic
    // load order ("html_editor" < "odoo_eink") ours runs after, which is what
    // we want.
    if (fields.contains("html")) {
        fields.add("html_original", fields.get("html"), { force: true });
    }
    fields.add("html", einkNoteField, { force: true });

    // Also publish under "eink_note" for explicit opt-in.
    if (!fields.contains("eink_note")) {
        fields.add("eink_note", einkNoteField);
    }

    // 3) Preserve ?eink=1 across navigations
    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);

    function ensureEinkParam(url) {
        if (!url) return url;
        try {
            const u = new URL(url, window.location.origin);
            if (u.searchParams.get("eink") !== "1") {
                u.searchParams.set("eink", "1");
            }
            return u.pathname + u.search + u.hash;
        } catch (e) {
            return url;
        }
    }

    history.pushState = function (state, title, url) {
        return origPushState(state, title, ensureEinkParam(url));
    };
    history.replaceState = function (state, title, url) {
        return origReplaceState(state, title, ensureEinkParam(url));
    };

    // Patch anchor clicks that navigate within the backend
    document.addEventListener("click", function (evt) {
        const a = evt.target.closest && evt.target.closest("a[href]");
        if (!a) return;
        const href = a.getAttribute("href");
        if (!href || href.startsWith("javascript:") || href.startsWith("#")) return;
        try {
            const u = new URL(href, window.location.origin);
            // Only patch same-origin URLs
            if (u.origin === window.location.origin && u.searchParams.get("eink") !== "1") {
                u.searchParams.set("eink", "1");
                a.setAttribute("href", u.pathname + u.search + u.hash);
            }
        } catch (e) {
            // ignore
        }
    }, true);

    console.info("[eink] mode active — html field swapped for EinkNoteField");
} else {
    // Still register eink_note for explicit opt-in (widget="eink_note")
    const fields = registry.category("fields");
    if (!fields.contains("eink_note")) {
        fields.add("eink_note", einkNoteField);
    }
}
