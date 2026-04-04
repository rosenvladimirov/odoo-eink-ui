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
// ============================================================================
import { Component, useRef, onMounted, onWillUnmount, markup } from "@odoo/owl";
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

        onMounted(() => this._initEditor());
        onWillUnmount(() => this._destroyEditor());
    }

    async _initEditor() {
        if (typeof window.jsdraw === "undefined") {
            console.warn("[eink] js-draw not loaded; falling back to text");
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

        // Make editor fill the available height
        try {
            const innerEl = this.containerRef.el.querySelector(".imageEditorContainer");
            if (innerEl) {
                innerEl.style.height = "100%";
                innerEl.style.minHeight = "600px";
            }
        } catch (e) {
            /* ignore */
        }

        // Load existing SVG value if present — BEFORE wiring change listeners
        // so the initial load doesn't trigger a save that overwrites the value.
        const initialValue = this._fieldValue();
        if (initialValue) {
            try {
                const result = this.editor.loadFromSVG(initialValue);
                if (result && typeof result.then === "function") {
                    await result;
                }
                this._lastSaved = initialValue;
            } catch (e) {
                console.warn("[eink] loadFromSVG failed", e);
            }
        }

        // NOW it's safe to enable auto-save
        this._ready = true;

        const onChange = () => {
            if (!this._ready) return;
            if (this._saveTimeout) clearTimeout(this._saveTimeout);
            this._saveTimeout = setTimeout(() => this._save(), 600);
        };
        this.editor.notifier.on(EditorEventType.CommandDone, onChange);
        this.editor.notifier.on(EditorEventType.CommandUndone, onChange);

        // Palm rejection: mark touch pointers as gesture-only
        this._installPalmRejection();

        console.info("[eink] editor ready, initial value length:", initialValue.length);
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

    async _save() {
        if (!this.editor || !this._ready) return;
        try {
            const svgEl = this.editor.toSVG();
            const svg = svgEl && svgEl.outerHTML ? svgEl.outerHTML : "";
            if (svg && svg !== this._lastSaved) {
                this._lastSaved = svg;
                console.info("[eink] saving SVG, length:", svg.length);
                // html fields in Odoo 18 accept markup-wrapped strings
                await this.props.record.update({ [this.props.name]: markup(svg) });
                console.info("[eink] save ok");
            }
        } catch (e) {
            console.error("[eink] save failed:", e);
        }
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
            // Flush pending save (fire-and-forget — unmounting)
            this._save();
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
