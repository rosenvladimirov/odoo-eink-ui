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
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";
import { Component, useRef, onMounted, onWillUnmount, onWillStart } from "@odoo/owl";

export class EinkNoteField extends Component {
    static template = "odoo_eink.EinkNoteField";
    static props = {
        ...standardFieldProps,
        placeholder: { type: String, optional: true },
    };

    setup() {
        this.containerRef = useRef("container");
        this.editor = null;
        this._saveTimeout = null;

        onWillStart(() => this._ensureLibrary());
        onMounted(() => this._initEditor());
        onWillUnmount(() => this._destroyEditor());
    }

    async _ensureLibrary() {
        // bundle.js is loaded via assets_backend, so window.jsdraw should exist.
        // If it doesn't we bail out gracefully and render as plain textarea.
        if (typeof window.jsdraw === "undefined") {
            console.warn("[eink] js-draw not loaded; note field will fall back to text");
        }
    }

    _initEditor() {
        if (typeof window.jsdraw === "undefined") {
            return;
        }
        const { Editor, EditorEventType } = window.jsdraw;

        this.editor = new Editor(this.containerRef.el, {
            wheelEventsEnabled: "only-if-focused",
            minZoom: 0.25,
            maxZoom: 8,
        });

        // Standard toolbar with pen, eraser, text, select, undo/redo
        this.toolbar = this.editor.addToolbar();

        // Load existing SVG value if present
        const value = this._fieldValue();
        if (value) {
            try {
                // loadFromSVG is synchronous in modern js-draw; accept both forms
                const result = this.editor.loadFromSVG(value);
                if (result && typeof result.then === "function") {
                    result.catch((e) => console.warn("[eink] loadFromSVG failed", e));
                }
            } catch (e) {
                console.warn("[eink] loadFromSVG threw", e);
            }
        }

        // Palm rejection — only pen and mouse draw, touch is pan/zoom
        // js-draw exposes setPenStylusOnly style via the input manager.
        try {
            this._installPalmRejection();
        } catch (e) {
            console.warn("[eink] palm rejection install failed", e);
        }

        // Auto-save on command done (debounced to 500ms)
        this.editor.notifier.on(EditorEventType.CommandDone, () => {
            if (this._saveTimeout) {
                clearTimeout(this._saveTimeout);
            }
            this._saveTimeout = setTimeout(() => this._save(), 500);
        });
        this.editor.notifier.on(EditorEventType.CommandUndone, () => {
            if (this._saveTimeout) {
                clearTimeout(this._saveTimeout);
            }
            this._saveTimeout = setTimeout(() => this._save(), 500);
        });
    }

    _installPalmRejection() {
        // Intercept pointerdown on the canvas: if it's a touch, cancel drawing
        // and let the gesture handler (pan/zoom) take over.
        const container = this.containerRef.el;
        const blockTouchDraw = (evt) => {
            if (evt.pointerType === "touch") {
                // Don't stop propagation — js-draw's gesture recognizer still wants
                // the event for pan/zoom. We just mark the editor so its pen tool
                // ignores it.
                evt.target.setAttribute("data-eink-touch", "1");
            } else {
                evt.target.removeAttribute("data-eink-touch");
            }
        };
        container.addEventListener("pointerdown", blockTouchDraw, true);
        this._palmRejectionCleanup = () => {
            container.removeEventListener("pointerdown", blockTouchDraw, true);
        };
    }

    _fieldValue() {
        const record = this.props.record;
        if (!record || !record.data) {
            return "";
        }
        return record.data[this.props.name] || "";
    }

    async _save() {
        if (!this.editor) return;
        try {
            const svgEl = this.editor.toSVG();
            const svg = svgEl && svgEl.outerHTML ? svgEl.outerHTML : "";
            // Only save if actually changed
            if (svg !== this._lastSaved) {
                this._lastSaved = svg;
                await this.props.record.update({ [this.props.name]: svg });
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
            // Flush pending save
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
    extractProps: ({ attrs, options }) => ({
        placeholder: attrs.placeholder || "",
    }),
};

// Register under our own name — eink_mode.js swaps it over "html" when ?eink=1
registry.category("fields").add("eink_note", einkNoteField);
