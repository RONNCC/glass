import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';
import { panelBaseStyles, markdownStyles, iconButtonStyles } from '../styles/shared.js';

export class NotesView extends LitElement {
    static styles = [
        css`
            :host {
                display: block;
                width: 380px;
                box-sizing: border-box;
                color: white;
                background: rgba(0, 0, 0, 0.6);
                border-radius: 12px;
                overflow: hidden;
            }
            .content { max-height: 780px; }
            .hint { color: rgba(255,255,255,0.6); font-size: 11px; }
            /* Make the top bar draggable like ask window */
            .title-row { -webkit-app-region: drag; cursor: move; }

            /* Inline highlight.js theme (GitHub dark-ish) for shadow DOM */
            .content pre code.hljs {
                display: block;
                overflow-x: auto;
                padding: 10px;
                color: #c9d1d9;
                background: #0d1117;
                border-radius: 6px;
            }
            .content code.hljs { padding: 2px 4px; }
            .hljs-comment, .hljs-quote { color: #8b949e; font-style: italic; }
            .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-type, .hljs-addition { color: #ff7b72; }
            .hljs-number, .hljs-string, .hljs-doctag, .hljs-regexp { color: #a5d6ff; }
            .hljs-title, .hljs-section, .hljs-name { color: #d2a8ff; }
            .hljs-attr, .hljs-attribute { color: #79c0ff; }
            .hljs-built_in, .hljs-builtin-name { color: #ffa657; }
            .hljs-params { color: #c9d1d9; }
            .hljs-bullet, .hljs-code { color: #d2a8ff; }
            .hljs-meta { color: #79c0ff; }
            .hljs-emphasis { font-style: italic; }
            .hljs-strong { font-weight: 700; }
        `,
        panelBaseStyles,
        markdownStyles,
        iconButtonStyles,
    ];

    static properties = {
        notes: { type: Array },
        selectedId: { type: String },
        _renderedHtml: { type: String, state: true },
    };

    constructor() {
        super();
        this.notes = [];
        this.selectedId = '';
        this._renderedHtml = '';
    }

    async _loadNotes() {
        try {
            const items = await window.api?.notes?.list?.();
            if (Array.isArray(items)) {
                this.notes = items;
                if (!this.selectedId && items.length > 0) this.selectedId = items[0].id;
            }
        } catch {}
    }

    async _seedIfEmpty() {
        if (this.notes.length > 0) return;
        const title = 'Sample note';
        const content = '# Welcome to Notes\n\nUse this page to manage notes.\n\n- Markdown supported (lists, code blocks, links)\n- Visit the web Notes tab to create and edit.';
        try {
            const res = await window.api?.notes?.create?.(title, content);
            await this._loadNotes();
            if (res?.id) this.selectedId = res.id;
        } catch {}
    }

    connectedCallback() {
        super.connectedCallback();
        this._enter = () => {
            this._renderMarkdown();
            this._requestHeightFit();
        };
        this.addEventListener('mouseenter', this._enter);
        this._onRefresh = async () => {
            await this._loadNotes();
            this._renderMarkdown();
            this._requestHeightFit();
        };
        window.api?.notes?.onRefresh?.(this._onRefresh);
        setTimeout(async () => {
            await this._loadNotes();
            await this._seedIfEmpty();
            this._renderMarkdown();
            this._requestHeightFit();
        }, 50);

        this._onClick = (e) => {
            const anchor = e.composedPath().find(el => el && el.tagName === 'A');
            if (anchor && anchor.href) {
                e.preventDefault();
                if (window.api?.common?.openExternal) {
                    window.api.common.openExternal(anchor.href);
                } else {
                    window.open(anchor.href, '_blank');
                }
            }
        };
        this.addEventListener('click', this._onClick);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._enter) this.removeEventListener('mouseenter', this._enter);
        if (this._onClick) this.removeEventListener('click', this._onClick);
        if (this._onRefresh) window.api?.notes?.removeOnRefresh?.(this._onRefresh);
    }

    updated(changed) {
        if (changed.has('selectedId')) {
            this._renderMarkdown();
        }
        if (changed.has('_renderedHtml')) {
            this._applySyntaxHighlighting();
            this._requestHeightFit();
        }
    }

    _requestHeightFit() {
        const content = this.shadowRoot?.querySelector('.content');
        if (!content || !window.api?.askView?.adjustWindowHeight) return;
        const baseChrome = 56; // header + paddings
        const desired = Math.min(820, baseChrome + content.scrollHeight);
        window.api.askView.adjustWindowHeight('notes', desired).catch(() => {});
    }

    _onSelect(e) { this.selectedId = e.target.value; }

    _close() { if (window.api?.mainHeader?.hideNotesWindow) window.api.mainHeader.hideNotesWindow(); }

    get selectedNote() { return this.notes.find(n => n.id === this.selectedId) || { content: '' }; }

    _renderMarkdown() {
        try {
            const raw = this.selectedNote.content || '';
            const html = (window.marked?.parse ? window.marked.parse(raw) : raw);
            const clean = (window.DOMPurify?.sanitize ? window.DOMPurify.sanitize(html) : html);
            this._renderedHtml = clean;
        } catch (e) {
            this._renderedHtml = this.selectedNote.content || '';
        }
    }

    _applySyntaxHighlighting() {
        try {
            const root = this.shadowRoot;
            if (!root || !window.hljs) return;
            const blocks = root.querySelectorAll('pre code');
            blocks.forEach((block) => {
                try { window.hljs.highlightElement(block); } catch {}
            });
        } catch {}
    }

    render() {
        return html`
            <div class="container">
                <div class="title-row">
                    <div class="left-title" style="gap:6px; -webkit-app-region: no-drag;">
                        <div class="title">Notes</div>
                        <select @change=${(e) => this._onSelect(e)} .value=${this.selectedId} style="-webkit-app-region: no-drag;">
                            ${this.notes.map(n => html`<option value=${n.id}>${n.title}</option>`)}
                        </select>
                    </div>
                    <button class="close-btn" @click=${() => this._close()} aria-label="Close" style="-webkit-app-region: no-drag;">
                        <svg width="10" height="10" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="content" .innerHTML=${this._renderedHtml}></div>
            </div>
        `;
    }
}

customElements.define('notes-view', NotesView); 