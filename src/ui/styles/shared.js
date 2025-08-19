import { css } from '../assets/lit-core-2.7.4.min.js';

// Base panel styles for small floating windows (settings, notes, etc.)
export const panelBaseStyles = css`
    .container {
        -webkit-app-region: no-drag;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        position: relative;
    }

    .title-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .left-title {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
    }

    .title {
        font-size: 12px;
        font-weight: 600;
        color: rgba(255,255,255,0.9);
    }

    select {
        -webkit-app-region: no-drag;
        background: rgba(255,255,255,0.1);
        color: white;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        font-size: 12px;
        padding: 6px 8px;
        cursor: pointer;
        outline: none;
    }

    .content {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        padding: 10px;
        font-size: 12px;
        line-height: 1.45;
        overflow: auto;
    }
`;

// Shared markdown presentation within a .content container
export const markdownStyles = css`
    .content h1, .content h2, .content h3 {
        margin: 8px 0 6px;
        font-size: 13px;
        font-weight: 700;
        color: #fff;
    }

    .content p, .content li {
        color: rgba(255,255,255,0.9);
    }

    .content code {
        font-family: 'Monaco','Menlo','Consolas',monospace;
        background: rgba(255,255,255,0.1);
        padding: 1px 4px;
        border-radius: 3px;
    }

    .content pre code {
        display: block;
        background: rgba(0,0,0,0.4);
        padding: 8px;
        border-radius: 6px;
        overflow-x: auto;
    }

    .content a { color: #9ed0ff; }
    .content ul { padding-left: 16px; }
`;

// Common minimal icon button (e.g., close) used in panels
export const iconButtonStyles = css`
    .close-btn {
        -webkit-app-region: no-drag;
        background: transparent;
        color: rgba(255,255,255,0.8);
        border: none;
        border-radius: 6px;
        width: 24px;
        height: 24px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s ease;
        flex-shrink: 0;
    }

    .close-btn:hover {
        background: rgba(255,255,255,0.12);
    }
`; 