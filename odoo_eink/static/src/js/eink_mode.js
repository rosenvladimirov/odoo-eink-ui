/** @odoo-module **/
// ============================================================================
// E Ink mode activation
//
// Activated via `?eink=1` query parameter. Persistence strategy depends on
// the device:
//
//   • E-paper devices (BOOX, reMarkable, Kindle, PocketBook, Meebook) →
//     cookie + localStorage (persistent across sessions, 1 year).
//   • Everything else (desktop browsers) →
//     sessionStorage (lasts only until the browser tab is closed).
//
// This way a user who activates eink mode on a BOOX stays in eink mode
// forever, while a desktop user who activates it for testing won't get
// stuck — closing the tab resets the mode.
//
// To disable on any device: append `?eink=0` to the URL.
//
// When active:
//   1. Adds `html.o_eink_mode` class → eink_odoo.scss kicks in
//   2. Swaps the "html" field widget for EinkNoteField (js-draw canvas)
// ============================================================================
import { registry } from "@web/core/registry";
import { einkNoteField } from "./components/eink_note_field";

const COOKIE_NAME = "odoo_eink_mode";
const STORAGE_KEY = "odoo_eink_mode";

// --- Device detection ------------------------------------------------------

/**
 * True if the current user-agent looks like an e-paper / e-ink reading device.
 * These devices benefit from persistent mode since they *always* need it.
 */
function isEpaperDevice() {
    const ua = (navigator.userAgent || "").toLowerCase();
    // BOOX runs Android with custom UA strings containing "onyx" or "boox"
    if (ua.includes("onyx") || ua.includes("boox")) return true;
    // reMarkable Paper Pro runs Chromium with "remarkable" in UA
    if (ua.includes("remarkable")) return true;
    // Kindle / Silk browser
    if (ua.includes("kindle") || ua.includes("silk/")) return true;
    // PocketBook readers
    if (ua.includes("pocketbook")) return true;
    // Meebook
    if (ua.includes("meebook")) return true;
    // Bigme
    if (ua.includes("bigme")) return true;
    return false;
}

// --- Persistence helpers ---------------------------------------------------

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

// --- State resolution ------------------------------------------------------

function enableEink(persistent) {
    if (persistent) {
        setCookie(COOKIE_NAME, "1", 365);
        try {
            localStorage.setItem(STORAGE_KEY, "1");
        } catch (e) {
            /* ignore */
        }
    } else {
        try {
            sessionStorage.setItem(STORAGE_KEY, "1");
        } catch (e) {
            /* ignore */
        }
    }
}

function disableEink() {
    clearCookie(COOKIE_NAME);
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        /* ignore */
    }
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        /* ignore */
    }
}

function resolveEinkState() {
    const epaper = isEpaperDevice();
    const urlVal = readUrlParam();

    // ---- User intent trumps UA detection ----
    // Explicit `?eink=1` always switches to persistent mode (cookie +
    // localStorage), regardless of what the user-agent string looks like.
    // Custom firmware on BOOX Note Max, reMarkable web apps, and similar
    // devices frequently mask their UA with generic Chrome/Android strings,
    // so we can't rely on isEpaperDevice() alone.  If someone typed
    // `?eink=1` they know what they're doing — honor it.
    //
    // Explicit `?eink=0` always disables and clears all persistence.
    //
    // When no URL param is present, we still fall back to heuristic
    // persistence: cookies for auto-detected e-paper devices, session
    // storage for desktops that previously opted in.
    if (urlVal === "1") {
        enableEink(true);
        return true;
    }
    if (urlVal === "0") {
        disableEink();
        return false;
    }

    // No URL param → check persistence.
    //   • Cookie / localStorage (persistent) — set by previous `?eink=1`
    //     visit.  Kept for both e-paper and desktop users: removing it on
    //     desktop would unstick testers but also break the "enable once
    //     on BOOX, works forever" contract, which is the whole point.
    //   • sessionStorage — legacy transient flag, still honored.
    if (getCookie(COOKIE_NAME) === "1") return true;
    try {
        if (localStorage.getItem(STORAGE_KEY) === "1") {
            // Re-seed the cookie so it survives cache clears that leave
            // localStorage intact.
            setCookie(COOKIE_NAME, "1", 365);
            return true;
        }
    } catch (e) {
        /* ignore */
    }
    try {
        if (sessionStorage.getItem(STORAGE_KEY) === "1") return true;
    } catch (e) {
        /* ignore */
    }
    // Belt-and-braces: if auto-detection recognizes the UA as e-paper and
    // no explicit opt-out was set, turn eink on by default.
    if (epaper) {
        enableEink(true);
        return true;
    }
    return false;
}

const EINK_ACTIVE = resolveEinkState();

if (EINK_ACTIVE) {
    // 1) CSS hook
    document.documentElement.classList.add("o_eink_mode");

    // 2) Swap the html field widget
    const fields = registry.category("fields");
    if (fields.contains("html")) {
        fields.add("html_original", fields.get("html"), { force: true });
    }
    fields.add("html", einkNoteField, { force: true });
    if (!fields.contains("eink_note")) {
        fields.add("eink_note", einkNoteField);
    }

    console.info(
        "[eink] mode active (device:",
        isEpaperDevice() ? "e-paper" : "desktop",
        "persistence:",
        isEpaperDevice() ? "cookie" : "sessionStorage",
        ")"
    );
} else {
    // Still publish eink_note for explicit opt-in
    const fields = registry.category("fields");
    if (!fields.contains("eink_note")) {
        fields.add("eink_note", einkNoteField);
    }
}
