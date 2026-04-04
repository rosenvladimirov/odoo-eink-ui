/** @odoo-module **/
// ============================================================================
// E Ink mode activation service
//
// Activates E Ink optimizations when `?eink=1` is in the URL (same pattern
// as `?debug=1`). When active, sets html.o_eink_mode class — eink_odoo.scss
// then applies all theme overrides via CSS variables.
//
// Also patches the "html" field widget to use EinkNoteField when in eink mode.
// ============================================================================
import { registry } from "@web/core/registry";

function isEinkMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get("eink") === "1";
}

export const einkModeService = {
    dependencies: [],
    start() {
        if (!isEinkMode()) {
            return { active: false };
        }

        // Add class for SCSS selectors
        document.documentElement.classList.add("o_eink_mode");

        // Preserve the ?eink=1 param across navigations by patching history
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

        // Swap the "html" field widget for EinkNoteField when in eink mode.
        // Done in setTimeout so the eink_note_field module has registered first.
        Promise.resolve().then(() => {
            const fields = registry.category("fields");
            if (fields.contains("eink_note")) {
                const einkNote = fields.get("eink_note");
                if (fields.contains("html")) {
                    // Keep the original under a new name so users can opt back
                    const originalHtml = fields.get("html");
                    fields.add("html_original", originalHtml, { force: true });
                }
                fields.add("html", einkNote, { force: true });
                console.info("[eink] html field swapped for EinkNoteField");
            }
        });

        console.info("[eink] mode active");
        return { active: true };
    },
};

registry.category("services").add("eink_mode", einkModeService);
