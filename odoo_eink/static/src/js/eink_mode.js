/** @odoo-module **/
// ============================================================================
// E Ink mode activation
//
// Activated via `?eink=1` query parameter. Once activated, the mode is
// persisted in a cookie + localStorage so it survives across all Odoo
// navigations (the built-in router strips query params we don't own).
//
// To disable: open any page with `?eink=0`.
//
// When active:
//   1. Adds `html.o_eink_mode` class → eink_odoo.scss kicks in
//   2. Swaps the "html" field widget for EinkNoteField (js-draw canvas)
// ============================================================================
import { registry } from "@web/core/registry";
import { einkNoteField } from "./components/eink_note_field";

const COOKIE_NAME = "odoo_eink_mode";
const STORAGE_KEY = "odoo_eink_mode";

function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie =
        name + "=" + value + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
}

function getCookie(name) {
    const match = document.cookie.match(
        new RegExp("(^|;\\s*)(" + name + ")=([^;]+)")
    );
    return match ? decodeURIComponent(match[3]) : null;
}

function clearCookie(name) {
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
}

function readUrlParam() {
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get("eink"); // "1", "0", or null
    } catch (e) {
        return null;
    }
}

function resolveEinkState() {
    // URL param takes precedence and updates the persisted state
    const urlVal = readUrlParam();
    if (urlVal === "1") {
        setCookie(COOKIE_NAME, "1", 365);
        try {
            localStorage.setItem(STORAGE_KEY, "1");
        } catch (e) {
            /* quota / private mode */
        }
        return true;
    }
    if (urlVal === "0") {
        clearCookie(COOKIE_NAME);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            /* ignore */
        }
        return false;
    }
    // No URL param → read from persisted state
    if (getCookie(COOKIE_NAME) === "1") return true;
    try {
        if (localStorage.getItem(STORAGE_KEY) === "1") {
            // Rebuild the cookie in case it was wiped
            setCookie(COOKIE_NAME, "1", 365);
            return true;
        }
    } catch (e) {
        /* ignore */
    }
    return false;
}

const EINK_ACTIVE = resolveEinkState();

if (EINK_ACTIVE) {
    // 1) Add CSS hook
    document.documentElement.classList.add("o_eink_mode");

    // 2) Swap the field widget
    const fields = registry.category("fields");
    if (fields.contains("html")) {
        fields.add("html_original", fields.get("html"), { force: true });
    }
    fields.add("html", einkNoteField, { force: true });
    if (!fields.contains("eink_note")) {
        fields.add("eink_note", einkNoteField);
    }

    console.info("[eink] mode active — html field swapped for EinkNoteField");
} else {
    // Still publish eink_note for explicit opt-in
    const fields = registry.category("fields");
    if (!fields.contains("eink_note")) {
        fields.add("eink_note", einkNoteField);
    }
}
