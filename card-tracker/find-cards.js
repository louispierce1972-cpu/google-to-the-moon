/* ═══════════════════════════════════════════
 * FIND CARDS — screen inside the Parser tab (button next to FIND BILLINGS).
 * Load a BIN stock file (BIN \t QTY \t COUNTRY \t TYPE \t BRAND \t LEVEL \t BANK),
 * browse it with a geo breakdown, paste your BINs / card numbers → Search → found / not found.
 * Pure logic: stock-core.js. Data lives in memory only (load the file each time).
 * ═══════════════════════════════════════════ */
(function () {
    'use strict';

    const S = window.StockCore;
    if (!S) { console.error('[FindCards] stock-core.js must be loaded before find-cards.js'); return; }

    const PAGE = 300;
    let FC = {
        open: false, loading: false, fileName: '', rows: null, index: null, skipped: 0, merged: 0,
        summary: [], totals: null, tier: 0, country: '', query: '', sort: 'qty', limit: PAGE,
        input: '', result: null, foundCountry: '',
    };
    const set = patch => { FC = { ...FC, ...patch }; };
    let queryTimer = null;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = n => Number(n || 0).toLocaleString('en-US');
    const notify = (m, t) => (typeof toast === 'function' ? toast(m, t) : console.log('[FindCards]', m));
    const codeOf = name => (typeof geoFromCountryText === 'function' ? geoFromCountryText(name) : '');
    const flagOf = cc => (cc && typeof geoFlag === 'function' ? geoFlag(cc) : '🏳');
    const tierOf = cc => (cc && typeof geoTier === 'function' ? geoTier(cc) : 3);
    const nameOf = g => (g.cc && typeof geoName === 'function' ? geoName(g.cc) : (g.key === 'UNKNOWN' ? 'Unknown' : g.country));

    // ── Data ──

    function loadText(name, text) {
        try {
            const parsed = S.parseStock(String(text || ''), { codeOf });
            if (!parsed.rows.length) throw new Error('No BIN rows found (expected tab-separated lines: BIN, QTY, COUNTRY, TYPE, BRAND, LEVEL, BANK)');
            const index = S.buildIndex(parsed.rows);
            set({
                loading: false, fileName: name, rows: parsed.rows, index, skipped: parsed.skipped, merged: parsed.merged,
                summary: S.geoSummary(parsed.rows), totals: S.stats(parsed.rows), tier: 0, country: '', query: '', limit: PAGE,
            });
            set({ result: FC.input ? runCheck() : null, foundCountry: '' });
            notify(`Loaded ${fmt(parsed.rows.length)} BINs from ${name}`, 'success');
        } catch (e) {
            set({ loading: false });
            notify(e.message, 'error');
        }
        render();
    }

    function loadFile(file) {
        if (!file) return;
        set({ loading: true, fileName: file.name });
        render();
        const reader = new FileReader();
        reader.onerror = () => { set({ loading: false }); notify('Could not read the file', 'error'); render(); };
        reader.onload = () => loadText(file.name, reader.result);
        reader.readAsText(file);
    }

    function runCheck() {
        if (!FC.rows) return null;
        const bins = S.extractBins(FC.input);
        return bins.length ? S.checkBins(FC.index, bins) : null;
    }

    function search() {
        const ta = document.getElementById('fc-input');
        if (ta) set({ input: ta.value });
        if (!FC.rows) { notify('Load the stock file first', 'warning'); return; }
        const result = runCheck();
        if (!result) { notify('No BINs found in the text (need 6+ digits per BIN or card number)', 'warning'); return; }
        set({ result, foundCountry: '' });
        render();
    }

    function addToNotes() {
        if (!FC.result || typeof STATE === 'undefined') return;
        const text = `Find Cards · ${FC.fileName}\n` + S.notesText(FC.result);
        const tab = {
            id: 'tab-fc-' + Date.now(), title: 'Find Cards', folder: 'parser', exportSource: 'Find Cards',
            content: esc(text).replace(/\n/g, '<br>'), pinned: false, tag: null, created: Date.now(), scrollPos: 0,
        };
        STATE.notesTabs = [tab, ...(STATE.notesTabs || [])];
        STATE.notesActiveTab = tab.id;
        if (typeof save === 'function') save();
        notify('Added to Notes (Parser folder)', 'success');
    }

    // ── Filtering / sorting ──

    const SORTS = {
        qty: (a, b) => b.qty - a.qty || a.bin.localeCompare(b.bin),
        bin: (a, b) => a.bin.localeCompare(b.bin),
        country: (a, b) => S.geoKey(a).localeCompare(S.geoKey(b)) || b.qty - a.qty,
        bank: (a, b) => a.bank.localeCompare(b.bank) || b.qty - a.qty,
    };

    function stockRows() {
        const byTier = FC.tier ? FC.rows.filter(r => tierOf(r.cc) === FC.tier) : FC.rows;
        return S.filterRows(byTier, { country: FC.country, query: FC.query }).sort(SORTS[FC.sort] || SORTS.qty);
    }

    // ── HTML ──

    function headHtml() {
        return `<div class="bw-head">
            <div><button class="bt-link fb-back" id="fc-back">← Back to Parser</button>
            <h2 class="bw-title">Find Cards <span>BIN stock → bank · country · level</span></h2>
            <div class="bw-sub">1) load the stock file · 2) paste your BINs or card numbers → <b>Search</b> shows which are in stock</div></div>
        </div>`;
    }

    function uploadHtml() {
        const t = FC.totals;
        const info = FC.loading ? '⏳ Reading file…'
            : t ? `<b>${esc(FC.fileName)}</b> · ${fmt(t.bins)} BINs · ${fmt(t.qty)} cards · ${fmt(t.countries)} countries`
                : 'Drop the stock file here (.txt) or click to browse';
        const extra = t && (FC.merged || FC.skipped)
            ? `<div class="bw-drop-s">${FC.merged ? `${fmt(FC.merged)} repeated lines merged (qty summed)` : ''}${FC.merged && FC.skipped ? ' · ' : ''}${FC.skipped ? `${fmt(FC.skipped)} lines without a valid BIN skipped` : ''}</div>`
            : '<div class="bw-drop-s">Tab-separated: BIN · QTY · COUNTRY · TYPE · BRAND · LEVEL · BANK</div>';
        return `<div class="bw-drop fc-drop ${t ? 'fc-loaded' : ''}" id="fc-drop">
            <div class="bw-drop-ico">${t ? '📦' : '📂'}</div>
            <div class="bw-drop-t">${info}</div>${extra}
        </div>
        <input type="file" id="fc-file" accept=".txt,.tsv,.csv,text/plain" hidden>`;
    }

    function tableHtml(rows, opts = {}) {
        if (!rows.length) return '<div class="fc-empty">No BINs match</div>';
        const shown = opts.limit ? rows.slice(0, opts.limit) : rows;
        const th = (key, label) => (opts.sortable
            ? `<th class="fc-sort ${FC.sort === key ? 'on' : ''}" data-fc-sort="${key}">${label}${FC.sort === key ? ' ▾' : ''}</th>`
            : `<th>${label}</th>`);
        const body = shown.map(r => `<tr>
            <td class="fc-bin">${esc(r.bin)}</td>
            <td class="fc-num">${fmt(r.qty)}</td>
            <td class="fc-geo"><span class="fc-flag">${flagOf(r.cc)}</span>${esc(r.country)}</td>
            <td><span class="fc-tag fc-${esc(r.type.toLowerCase())}">${esc(r.type)}</span></td>
            <td><span class="fc-brand fc-${esc(r.brand.toLowerCase().replace(/\s+/g, '-'))}">${esc(r.brand)}</span></td>
            <td>${esc(r.level)}</td>
            <td class="fc-bank">${esc(r.bank)}</td>
        </tr>`).join('');
        const more = opts.limit && rows.length > opts.limit
            ? `<button class="bw-btn fc-more" id="fc-more">Show ${fmt(Math.min(PAGE, rows.length - opts.limit))} more · ${fmt(rows.length - opts.limit)} hidden</button>` : '';
        return `<div class="fc-table-wrap"><table class="fc-table">
            <thead><tr>${th('bin', 'BIN')}${th('qty', 'Qty')}${th('country', 'Country')}<th>Type</th><th>Brand</th><th>Level</th>${th('bank', 'Bank')}</tr></thead>
            <tbody>${body}</tbody></table></div>${more}`;
    }

    function chipsHtml(summary, active, attr, allLabel, allCount) {
        const all = `<button class="fc-chip ${active ? '' : 'on'}" ${attr}="">${allLabel} <b>${allCount}</b></button>`;
        return all + summary.map(g => `<button class="fc-chip ${active === g.key ? 'on' : ''}" ${attr}="${esc(g.key)}" title="${esc(g.country)} · ${fmt(g.bins)} BINs · ${fmt(g.qty)} cards">
            <span class="fc-flag">${flagOf(g.cc)}</span>${esc(nameOf(g))} <b>${fmt(g.bins)}</b><i>${fmt(g.qty)}</i></button>`).join('');
    }

    function checkHtml() {
        const r = FC.result;
        let res = '';
        if (r) {
            const foundRows = r.found.flatMap(f => f.rows);
            const summary = S.geoSummary(foundRows);
            const visible = FC.foundCountry ? foundRows.filter(x => S.geoKey(x) === FC.foundCountry) : foundRows;
            res = `<div class="fc-result">
                <div class="fc-res-bar">
                    <span class="fc-pill ok">✓ Found <b>${fmt(r.found.length)}</b></span>
                    <span class="fc-pill miss">✕ Not found <b>${fmt(r.notFound.length)}</b></span>
                    <span class="fc-muted">of ${fmt(r.total)} unique BINs</span>
                    <span class="fc-spacer"></span>
                    <button class="bw-btn" id="fc-notes">📝 Add to Notes</button>
                </div>
                ${summary.length ? `<div class="fc-chips fc-chips-sm">${chipsHtml(summary, FC.foundCountry, 'data-fc-fcountry', 'All found', fmt(foundRows.length))}</div>` : ''}
                ${r.found.length ? tableHtml(visible) : ''}
                ${r.notFound.length ? `<div class="fc-sub-h">Not in stock (${fmt(r.notFound.length)})</div>
                    <div class="fc-missing">${r.notFound.map(b => `<span>${esc(b)}</span>`).join('')}</div>` : ''}
            </div>`;
        }
        return `<section class="fc-card">
            <div class="fc-card-h">🔍 Check my BINs</div>
            <textarea id="fc-input" class="fc-input" spellcheck="false" placeholder="Paste BINs or full card numbers, any format — one per line or mixed text. The first 6 digits are used.">${esc(FC.input)}</textarea>
            <div class="fc-actions">
                <button class="bw-btn bw-btn-primary" id="fc-search" ${FC.rows ? '' : 'disabled'}>🔍 Search</button>
                <button class="bw-btn" id="fc-input-clear" ${FC.input || r ? '' : 'disabled'}>Clear</button>
                ${FC.rows ? '' : '<span class="fc-muted">Load the stock file first</span>'}
            </div>
            ${res}
        </section>`;
    }

    function stockBodyHtml() {
        const rows = stockRows();
        const qty = rows.reduce((s, r) => s + r.qty, 0);
        return `<div class="fc-muted fc-count">${fmt(rows.length)} BINs · ${fmt(qty)} cards</div>${tableHtml(rows, { limit: FC.limit, sortable: true })}`;
    }

    function stockHtml() {
        if (!FC.rows) return '';
        const tiers = [0, 1, 2, 3].map(t => {
            const n = t ? FC.summary.filter(g => tierOf(g.cc) === t).reduce((s, g) => s + g.bins, 0) : FC.totals.bins;
            return `<button class="fc-chip fc-tier ${FC.tier === t ? 'on' : ''}" data-fc-tier="${t}">${t ? 'Tier ' + t : 'All tiers'} <b>${fmt(n)}</b></button>`;
        }).join('');
        const summary = FC.tier ? FC.summary.filter(g => tierOf(g.cc) === FC.tier) : FC.summary;
        const allBins = summary.reduce((s, g) => s + g.bins, 0);
        return `<section class="fc-card">
            <div class="fc-card-h">🌍 Stock by geo <span class="fc-muted">chip = country · BINs · <i>cards</i> · sorted by cards</span></div>
            <div class="fc-chips">${tiers}</div>
            <div class="fc-chips fc-geo-chips">${chipsHtml(summary, FC.country, 'data-fc-country', 'All countries', fmt(allBins))}</div>
            <input id="fc-query" class="fc-query" type="text" autocomplete="off" placeholder="Filter stock: BIN, bank, country, brand, level…" value="${esc(FC.query)}">
            <div id="fc-stock-body">${stockBodyHtml()}</div>
        </section>`;
    }

    function render() {
        const area = document.getElementById('content-area');
        if (!area) return;
        const bar = document.getElementById('stats-bar');
        if (bar) bar.innerHTML = '';
        const entering = !area.querySelector('.fc-wrap');
        area.innerHTML = `<div class="bw-wrap fc-wrap ${entering ? 'bt-enter' : ''}">
            ${headHtml()}${uploadHtml()}${checkHtml()}${stockHtml()}
        </div>`;
        bind(area);
    }

    function renderStockBody() {
        const body = document.getElementById('fc-stock-body');
        if (body) body.innerHTML = stockBodyHtml();
    }

    // ── Events ──

    function bind(area) {
        const wrap = area.querySelector('.fc-wrap');
        const fileInput = area.querySelector('#fc-file');
        area.querySelector('#fc-back')?.addEventListener('click', close);
        area.querySelector('#fc-drop')?.addEventListener('click', () => fileInput.click());
        fileInput?.addEventListener('change', e => loadFile(e.target.files[0]));
        ['dragover', 'dragenter'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.add('bw-dragging'); }));
        ['dragleave', 'drop'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.remove('bw-dragging'); }));
        wrap.addEventListener('drop', e => { e.stopPropagation(); if (e.dataTransfer?.files.length) loadFile(e.dataTransfer.files[0]); });

        const ta = area.querySelector('#fc-input');
        ta?.addEventListener('input', () => set({ input: ta.value }));
        ta?.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) search(); });
        area.querySelector('#fc-search')?.addEventListener('click', search);
        area.querySelector('#fc-input-clear')?.addEventListener('click', () => { set({ input: '', result: null, foundCountry: '' }); render(); });
        area.querySelector('#fc-notes')?.addEventListener('click', addToNotes);

        const q = area.querySelector('#fc-query');
        q?.addEventListener('input', () => {
            clearTimeout(queryTimer);
            queryTimer = setTimeout(() => { set({ query: q.value, limit: PAGE }); renderStockBody(); }, 180);
        });

        wrap.addEventListener('click', e => {
            const el = e.target.closest('[data-fc-tier],[data-fc-country],[data-fc-fcountry],[data-fc-sort],#fc-more');
            if (!el) return;
            if (el.id === 'fc-more') { set({ limit: FC.limit + PAGE }); return renderStockBody(); }
            if (el.dataset.fcSort) { set({ sort: el.dataset.fcSort }); return renderStockBody(); }
            if (el.dataset.fcTier !== undefined) set({ tier: +el.dataset.fcTier, country: '', limit: PAGE });
            else if (el.dataset.fcCountry !== undefined) set({ country: el.dataset.fcCountry, limit: PAGE });
            else set({ foundCountry: el.dataset.fcFcountry });
            render();
        });
    }

    // ── Open / close (same pattern as Find Billings) ──

    function close() {
        set({ open: false });
        if (typeof renderParser === 'function') renderParser();
    }

    function open() {
        set({ open: true });
        if (typeof FB !== 'undefined') FB.open = false;
        if (typeof STATE !== 'undefined' && STATE.currentView !== 'new-cards') {
            document.querySelector('.tn-tab[data-view="new-cards"]')?.click();
            return;
        }
        render();
    }

    window.FindCards = { open, close, render, loadText, hide: () => set({ open: false }), isOpen: () => FC.open };
})();
