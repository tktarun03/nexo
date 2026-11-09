// Brand mark and wordmark as static, app-owned SVG (theme-aware via currentColor).
import { h, setTrustedSVG } from '../utils/dom.js';

const MARK = `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<defs><linearGradient id="nx-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#86ef3c"/><stop offset="1" stop-color="#109a43"/></linearGradient>
<linearGradient id="nx-w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e9eeea"/></linearGradient></defs>
<g transform="rotate(-10 60 40)"><rect x="30" y="12" width="76" height="50" rx="11" fill="url(#nx-g)"/>
<rect x="18" y="20" width="76" height="50" rx="11" fill="url(#nx-w)" stroke="rgba(0,0,0,.06)"/>
<circle cx="36" cy="38" r="6.5" fill="#17201b"/><path d="M25 58c0-7 5-10.5 11-10.5S47 51 47 58z" fill="#17201b"/>
<g stroke="#a7b0aa" stroke-width="3.2" stroke-linecap="round"><path d="M52 36h12M52 44h12M52 52h8"/></g>
<g fill="none" stroke="#17201b" stroke-width="2.6"><rect x="70" y="31" width="7" height="7" rx="1.6"/><rect x="80" y="31" width="7" height="7" rx="1.6"/><rect x="70" y="41" width="7" height="7" rx="1.6"/><rect x="80" y="41" width="7" height="7" rx="1.6"/></g>
<g fill="none" stroke="#22c55e" stroke-width="2.6" stroke-linecap="round"><path d="M67 31v-3h3M90 28h3v3M93 48v3h-3M70 51h-3v-3"/></g></g></svg>`;

const WORDMARK = `<svg viewBox="0 0 252 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
<g fill="currentColor"><path d="M0 2h12l30 34V2h11v56H41L11 24v34H0z"/><path d="M64 2h43v10H75v12h29v10H75v14h32v10H64z"/>
<path d="M114 2h14l13 13-7 7z"/><path d="M134 38l7-7 21 27h-14z"/>
<path d="M213 0c17 0 30 13 30 30s-13 30-30 30-30-13-30-30S196 0 213 0zm0 11c-11 0-19 8-19 19s8 19 19 19 19-8 19-19-8-19-19-19z"/></g>
<path d="M159 2h15l-43 56h-15z" fill="#22c55e"/></svg>`;

export function BrandMark(cls = '') {
  return setTrustedSVG(h('span', { class: ['brand-mark', cls] }), MARK);
}

export function Wordmark(cls = '') {
  const el = setTrustedSVG(h('span', { class: ['wordmark', cls], role: 'img', 'aria-label': 'NEXO' }), WORDMARK);
  return el;
}
