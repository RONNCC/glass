import { html, css, LitElement } from '../assets/lit-core-2.7.4.min.js';
import { panelBaseStyles, markdownStyles, iconButtonStyles } from '../styles/shared.js';

export class NotesView extends LitElement {
    static styles = [
        css`
            :host {
                display: block;
                width: 353px;
                box-sizing: border-box;
                color: white;
                background: rgba(0, 0, 0, 0.6);
                border-radius: 12px;
                overflow: hidden;
            }
            .content { max-height: 680px; }
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
        const savedNotesRaw = localStorage.getItem('glass_notes') || '[]';
        let savedNotes = [];
        try { savedNotes = JSON.parse(savedNotesRaw); } catch { savedNotes = []; }
        const hasSample = savedNotes.some(n => n.id === 'sample');
        if (!hasSample) {
            savedNotes.unshift({
                id: 'sample',
                title: 'Sample note',
                content: '# Welcome to Notes\n\nUse this to keep quick docs/snippets.\n\n- Markdown supported (lists, code blocks, links)\n- Hover over the note icon to open\n- Move your mouse away to hide\n\n```js\nconsole.log(\'Hello from sample note!\');\n```\n\n[Pickle Glass](https://github.com/qwopqwop200/PickGlass)'
            });
            localStorage.setItem('glass_notes', JSON.stringify(savedNotes));
        }
        this.notes = savedNotes;
        this.selectedId = this.notes[0]?.id || '';
        this._renderedHtml = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this._enter = () => {
            this._renderMarkdown();
            this._requestHeightFit();
        };
        this.addEventListener('mouseenter', this._enter);
        setTimeout(() => { this._renderMarkdown(); this._requestHeightFit(); }, 50);

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
    }

    updated(changed) {
        if (changed.has('selectedId')) {
            this._renderMarkdown();
            this._requestHeightFit();
        }
    }

    _requestHeightFit() {
        const content = this.shadowRoot?.querySelector('.content');
        if (!content || !window.api?.askView?.adjustWindowHeight) return;
        const baseChrome = 56; // approx header + paddings inside window
        const desired = Math.min(720, baseChrome + content.scrollHeight);
        window.api.askView.adjustWindowHeight('notes', desired).catch(() => {});
    }

    _onSelect(e) {
        this.selectedId = e.target.value;
    }

    _close() {
        if (window.api?.mainHeader?.hideNotesWindow) window.api.mainHeader.hideNotesWindow();
    }

    get selectedNote() {
        return this.notes.find(n => n.id === this.selectedId) || { content: '' };
    }

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

    render() {
        return html`
            <div class="container">
                <div class="title-row">
                    <div class="left-title">
                        <div class="title">Notes</div>
                        <select @change=${(e) => this._onSelect(e)} .value=${this.selectedId}>
                            ${this.notes.map(n => html`<option value=${n.id}>${n.title}</option>`)}
                        </select>
                    </div>
                    <button class="close-btn" @click=${() => this._close()} aria-label="Close">
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