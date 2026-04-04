/** @odoo-module **/
// ============================================================================
// EinkNoteField — OWL field component that replaces HtmlField under E Ink mode.
//
// Uses js-draw (MIT, bundled under static/lib/js-draw/bundle.js) to provide:
//   - Pen, eraser, text, select, undo/redo, zoom tools
//   - Palm rejection: only pointerType === 'pen' draws; touch = pan/zoom
//   - Pressure sensitivity via Pointer Events API (BOOX Pen 2 Plus Wacom EMR)
//
// Storage: editor.toSVG().outerHTML → stored directly in the html field value.
// Load:    editor.loadFromSVG(fieldValue) on mount.
//
// Hooks into Odoo's save lifecycle via the model bus (WILL_SAVE_URGENTLY and
// NEED_LOCAL_CHANGES) so pending draws are flushed before the record saves.
// ============================================================================
import { Component, useRef, onMounted, onWillUnmount, markup } from "@odoo/owl";
import { useBus } from "@web/core/utils/hooks";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

export class EinkNoteField extends Component {
    static template = "odoo_eink.EinkNoteField";
    static props = {
        ...standardFieldProps,
        "*": true,
    };

    setup() {
        this.containerRef = useRef("container");
        this.editor = null;
        this._saveTimeout = null;
        this._lastSaved = "";
        // Guard against saving before initial load completes
        this._ready = false;

        // Hook into Odoo save lifecycle — flush pending draws before save.
        const model = this.props.record && this.props.record.model;
        if (model && model.bus) {
            useBus(model.bus, "WILL_SAVE_URGENTLY", () => this._commitChanges());
            useBus(model.bus, "NEED_LOCAL_CHANGES", ({ detail }) => {
                detail.proms.push(this._commitChanges());
            });
        }

        onMounted(() => this._initEditor());
        onWillUnmount(() => this._destroyEditor());
    }

    async _initEditor() {
        if (typeof window.jsdraw === "undefined") {
            console.warn("[eink] js-draw not loaded; falling back");
            this._renderFallback();
            return;
        }
        const { Editor, EditorEventType } = window.jsdraw;

        this.editor = new Editor(this.containerRef.el, {
            wheelEventsEnabled: "only-if-focused",
            minZoom: 0.25,
            maxZoom: 8,
        });
        this.toolbar = this.editor.addToolbar();

        // Fill available height
        try {
            const inner = this.containerRef.el.querySelector(".imageEditorContainer");
            if (inner) {
                inner.style.height = "100%";
                inner.style.minHeight = "600px";
            }
        } catch (e) {
            /* ignore */
        }

        // Load existing SVG BEFORE wiring listeners, so initial load doesn't
        // trigger an empty save.
        const initialValue = this._fieldValue();
        if (initialValue) {
            try {
                const p = this.editor.loadFromSVG(initialValue);
                if (p && typeof p.then === "function") await p;
                this._lastSaved = initialValue;
                console.info("[eink] loaded initial SVG, length:", initialValue.length);
            } catch (e) {
                console.warn("[eink] loadFromSVG failed", e);
            }
        }

        // Now it's safe to enable auto-save
        this._ready = true;

        const onChange = () => {
            if (!this._ready) return;
            // Flush pending draw to the record immediately (not debounced)
            // so the model stays in sync. Odoo's own save debouncing takes
            // care of not hammering the backend.
            this._flushToRecord();
        };
        this.editor.notifier.on(EditorEventType.CommandDone, onChange);
        this.editor.notifier.on(EditorEventType.CommandUndone, onChange);

        // Palm rejection
        this._installPalmRejection();

        console.info("[eink] editor ready");
    }

    _renderFallback() {
        const el = this.containerRef.el;
        if (!el) return;
        el.innerHTML =
            '<div style="padding:1rem;border:1px solid #000;background:#fffbe6;">' +
            "<strong>E Ink mode:</strong> js-draw library not loaded." +
            "</div>";
    }

    _installPalmRejection() {
        const container = this.containerRef.el;
        const handler = (evt) => {
            if (evt.pointerType === "touch") {
                evt.target.setAttribute("data-eink-touch", "1");
            } else {
                evt.target.removeAttribute("data-eink-touch");
            }
        };
        container.addEventListener("pointerdown", handler, true);
        this._palmRejectionCleanup = () => {
            container.removeEventListener("pointerdown", handler, true);
        };
    }

    _fieldValue() {
        const record = this.props.record;
        if (!record || !record.data) return "";
        const v = record.data[this.props.name];
        if (v && typeof v === "object" && "toString" in v) {
            return v.toString();
        }
        return v || "";
    }

    /**
     * Serialize the current editor state to SVG and push it into the record.
     * Called on every draw command AND when Odoo fires WILL_SAVE_URGENTLY /
     * NEED_LOCAL_CHANGES. Debounced internally to avoid thrashing.
     */
    async _flushToRecord() {
        if (!this.editor || !this._ready) return;
        try {
            const svgEl = this.editor.toSVG();
            const svg = svgEl && svgEl.outerHTML ? svgEl.outerHTML : "";
            if (!svg || svg === this._lastSaved) return;
            this._lastSaved = svg;
            console.info("[eink] flush to record, SVG length:", svg.length);
            // Plain string works too; markup() tells Odoo not to re-escape.
            await this.props.record.update({ [this.props.name]: markup(svg) });
            console.info("[eink] record updated");
        } catch (e) {
            console.error("[eink] flushToRecord failed:", e);
        }
    }

    /**
     * Called synchronously when Odoo is about to save the record.
     * Must return a promise that resolves when the field value is committed
     * to the in-memory record.
     */
    async _commitChanges() {
        console.info("[eink] commitChanges fired");
        await this._flushToRecord();
    }

    _destroyEditor() {
        if (this._saveTimeout) {
            clearTimeout(this._saveTimeout);
            this._saveTimeout = null;
        }
        if (this._palmRejectionCleanup) {
            this._palmRejectionCleanup();
            this._palmRejectionCleanup = null;
        }
        if (this.editor) {
            // Final flush — fire-and-forget since we're unmounting
            this._flushToRecord();
            try {
                if (typeof this.editor.remove === "function") {
                    this.editor.remove();
                }
            } catch (e) {
                /* ignore */
            }
            this.editor = null;
        }
    }
}

export const einkNoteField = {
    component: EinkNoteField,
    displayName: "E Ink Note Field",
    supportedTypes: ["html"],
    extractProps: ({ attrs, options }) => ({
        placeholder: (attrs && attrs.placeholder) || "",
    }),
};
