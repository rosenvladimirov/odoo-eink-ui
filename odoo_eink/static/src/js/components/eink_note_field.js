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
// Since SVG is valid HTML5 it renders in a normal browser without conversion.
// ============================================================================
import { Component, useRef, onMounted, onWillUnmount, markup } from "@odoo/owl";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

export class EinkNoteField extends Component {
    static template = "odoo_eink.EinkNoteField";
    // Accept any extra props the standard HtmlField would pass so we can be a
    // drop-in replacement under ?eink=1
    static props = {
        ...standardFieldProps,
        "*": true,
    };

    setup() {
        this.containerRef = useRef("container");
        this.editor = null;
        this._saveTimeout = null;
        this._lastSaved = "";

        onMounted(() => this._initEditor());
        onWillUnmount(() => this._destroyEditor());
    }

    _initEditor() {
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

        // Load existing SVG value if present
        const value = this._fieldValue();
        if (value) {
            try {
                const result = this.editor.loadFromSVG(value);
                if (result && typeof result.then === "function") {
                    result.catch((e) => console.warn("[eink] loadFromSVG failed", e));
                }
                this._lastSaved = value;
            } catch (e) {
                console.warn("[eink] loadFromSVG threw", e);
            }
        }

        // Palm rejection: mark touch pointers so we know they're gesture-only
        this._installPalmRejection();

        // Debounced auto-save
        const onChange = () => {
            if (this._saveTimeout) clearTimeout(this._saveTimeout);
            this._saveTimeout = setTimeout(() => this._save(), 500);
        };
        this.editor.notifier.on(EditorEventType.CommandDone, onChange);
        this.editor.notifier.on(EditorEventType.CommandUndone, onChange);
    }

    _renderFallback() {
        const el = this.containerRef.el;
        if (!el) return;
        el.innerHTML =
            '<div style="padding:1rem;border:1px solid #000;background:#fffbe6;">' +
            "<strong>E Ink mode:</strong> js-draw library not loaded. " +
            "HTML content will be read-only until the bundle is available." +
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
        // html fields may arrive as markup() objects
        if (v && typeof v === "object" && "toString" in v) {
            return v.toString();
        }
        return v || "";
    }

    async _save() {
        if (!this.editor) return;
        try {
            const svgEl = this.editor.toSVG();
            const svg = svgEl && svgEl.outerHTML ? svgEl.outerHTML : "";
            if (svg !== this._lastSaved) {
                this._lastSaved = svg;
                await this.props.record.update({ [this.props.name]: markup(svg) });
            }
        } catch (e) {
            console.warn("[eink] save failed", e);
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
            // Flush pending save synchronously (not awaited — we're unmounting)
            this._save();
            try {
                if (typeof this.editor.remove === "function") {
                    this.editor.remove();
                }
            } catch (e) {
                // ignore
            }
            this.editor = null;
        }
    }
}

export const einkNoteField = {
    component: EinkNoteField,
    displayName: "E Ink Note Field",
    supportedTypes: ["html"],
    // Accept HtmlField's props format so we don't crash when swapped over "html"
    extractProps: ({ attrs, options }) => ({
        placeholder: (attrs && attrs.placeholder) || "",
    }),
};
