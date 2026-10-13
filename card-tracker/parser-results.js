/* ═══════════════════════════════════════════════════════════════════
   PARSER RESULTS — screen after "Parse".
   Compact Region → Country → BIN drill-down + Tier 1/2/3 filter.
   Table of cards is shown only once a country is opened.
   Depends on parser-geo.js and app.js globals (PARSER_STATE, STATE,
   toast, save, _updateStatsBar, _applyTestMode, formatCardBin,
   _buildExportTabTitle). View state lives in PARSER_STATE.resView.
   ═══════════════════════════════════════════════════════════════════ */

const PR_ROW_LIMIT = 1500;

function prEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** Small flag image (emoji flags don't render on Windows); hidden if offline / unknown. */
function prFlag(code) {
    const c = geoCode(code);
    if (!/^[A-Z]{2}$/.test(c)) return '<span class="pres-flag-ph">🏳</span>';
    return `<img class="pres-flag-img" src="https://flagcdn.com/20x15/${c.toLowerCase()}.png" alt="" loading="lazy" onerror="this.remove()">`;
}

function prView() {
    return PARSER_STATE.resView || { tiers: new Set(), region: '', country: '', bin: '', showAll: false };
}

function prSetView(patch) {
    PARSER_STATE.resView = { ...prView(), ...patch };
    renderParserResults();
}

function prCardLine(c) {
    return `${(c.cc || '').replace(/\s/g, '')} ${(c.mm || '').padStart(2, '0')} ${c.yy || ''} ${c.cvv || '000'}`;
}

function prScopeLabel(view) {
    const parts = [];
    if (view.tiers.size) parts.push(`Tier ${[...view.tiers].sort().join('+')}`);
    if (view.country) parts.push(view.country);
    else if (view.region) parts.push(view.region);
    if (view.bin) parts.push(`BIN ${view.bin}`);
    return parts.join(' · ');
}

function prPushNote(title, lines, source) {
    const block = lines.join('\n');
    const newTab = {
        id: 'tab-parser-' + Date.now(), title, content: block, pinned: false, tag: null,
        created: Date.now(), scrollPos: 0, exportSource: source, exportedAt: new Date().toISOString()
    };
    STATE.notesTabs = [newTab, ...(STATE.notesTabs || [])];
    STATE.notesActiveTab = newTab.id;
    STATE.notesLastSaved = Date.now();
    save();
    toast(`${lines.length} cards exported → "${title}"`, 'success');
}

function prCopy(lines, label) {
    if (!lines.length) { toast('Nothing to copy', 'warning'); return; }
    if (!navigator.clipboard) { toast('Clipboard is not available', 'error'); return; }
    navigator.clipboard.writeText(lines.join('\n'))
        .then(() => toast(`${label}: ${lines.length} cards copied`, 'success'))
        .catch(() => toast('Copy failed', 'error'));
}

/* ── HTML pieces ── */

function prTierChips(tree, view) {
    return [1, 2, 3].map(t => `<button class="pres-tier-chip t${t} ${view.tiers.has(t) ? 'active' : ''}" data-act="tier" data-tier="${t}"
        title="Show only Tier ${t} countries (multi-select)">Tier ${t} <span>${tree.tierCounts[t]}</span></button>`).join('');
}

function prRegionChips(tree, view) {
    return tree.regions.map(r => {
        const info = geoRegionInfo(r.name);
        return `<button class="pres-region-chip ${r.name === view.region ? 'active' : ''}" data-act="region" data-region="${prEsc(r.name)}" title="${prEsc(info.tip)}">
        <span class="pres-region-ico">${r.icon}</span>${prEsc(info.label)} <span class="pres-chip-count">${r.count}</span>
        <span class="pres-caret">${r.name === view.region ? '▾' : '▸'}</span></button>`;
    }).join('');
}

function prCountryChips(region, view) {
    return region.countries.map(c => `<button class="pres-country-chip ${c.code === view.country ? 'active' : ''}" data-act="country" data-country="${prEsc(c.code)}" title="${prEsc(c.name)}">
        <span class="pres-flag">${prFlag(c.code)}</span><b>${prEsc(c.code || '??')}</b><span class="pres-cname">${prEsc(c.name)}</span>
        <span class="pres-tier-badge t${c.tier}">T${c.tier}</span><span class="pres-chip-count">${c.count}</span></button>`).join('');
}

function prBinCards(country, view) {
    return country.bins.map(b => `<div class="pres-bin-card ${b.bin === view.bin ? 'active' : ''}" data-act="bin" data-bin="${prEsc(b.bin)}" title="${prEsc(b.bank || 'Unknown bank')} — click to show only this BIN">
        <div class="pres-bin-top">
            <span class="pres-bin-num">${prEsc(b.bin)}</span>
            <span class="pres-bin-count">${b.count}</span>
            <button class="pres-bin-icon" data-act="bin-notes" data-bin="${prEsc(b.bin)}" title="Export this BIN to Notes">📝</button>
            <button class="pres-bin-icon" data-act="bin-copy" data-bin="${prEsc(b.bin)}" title="Copy this BIN cards">📋</button>
        </div>
        <div class="pres-bin-bank">${prEsc(b.bank || '—')}</div>
    </div>`).join('');
}

function prTableHtml(rows, total, view) {
    const sortBy = PARSER_STATE.sortBy || 'index';
    const binSortIcon = sortBy === 'bin-desc' ? '↓' : sortBy === 'bin-asc' ? '↑' : '↕';
    const more = total > rows.length
        ? `<button class="pres-more-btn" data-act="show-all">Show all ${total} cards (${total - rows.length} hidden)</button>` : '';
    return `<div class="pres-table-wrap">
        <table class="pres-table">
            <colgroup><col style="width:28px"><col style="width:15%"><col style="width:16%"><col style="width:18%">
                <col style="width:52px"><col style="width:72px"><col style="width:80px"></colgroup>
            <thead><tr><th></th><th>NAME</th><th>CARD</th><th>BANK</th><th>EXP</th>
                <th class="pres-sort-th" data-act="sort-bin">BIN ${binSortIcon}</th><th>GEO</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>${more}`;
}

function prRowsHtml(cards, idxOf) {
    return cards.map(c => {
        const idx = idxOf.get(c);
        const code = geoCode(c.detectedGeo);
        const name = `${(c.name || '').toUpperCase()} ${(c.surname || '').toUpperCase()}`.trim();
        return `<tr>
            <td class="pc-chk"><input type="checkbox" ${PARSER_STATE.selected.has(idx) ? 'checked' : ''} data-idx="${idx}" class="parser-check"></td>
            <td class="pc-holder">${prEsc(name)}</td>
            <td class="pc-card">${formatCardBin(c.cc)}</td>
            <td class="pc-bank" title="${prEsc(c.bank || '')}">${prEsc(c.bank || '—')}</td>
            <td class="pc-exp">${prEsc(c.validity || '')}</td>
            <td class="pc-bin">${prEsc(c.bin)}</td>
            <td class="pc-geo">${code ? `${prFlag(code)} ${prEsc(code)} <span class="pres-tier-badge t${geoTier(code)}">T${geoTier(code)}</span>` : '—'}</td>
        </tr>`;
    }).join('');
}

function prSortCards(cards) {
    const sortBy = PARSER_STATE.sortBy || 'index';
    if (sortBy === 'index') return cards;
    const counts = new Map();
    cards.forEach(c => counts.set(c.bin, (counts.get(c.bin) || 0) + 1));
    const dir = sortBy === 'bin-asc' ? 1 : -1;
    return [...cards].sort((a, b) => dir * (counts.get(a.bin) - counts.get(b.bin)));
}

/** Resets parts of the view that no longer exist after a re-parse / filter change. */
function prSanitizeView(view, tree) {
    const region = tree.regions.find(r => r.name === view.region);
    if (!region) return { ...view, region: '', country: '', bin: '' };
    const country = region.countries.find(c => c.code === view.country);
    if (!country) return { ...view, country: '', bin: '' };
    if (view.bin && !country.bins.some(b => b.bin === view.bin)) return { ...view, bin: '' };
    return view;
}

/* ── main render ── */

function renderParserResults(geoFilter) {
    const el = document.getElementById('parser-results');
    if (!el) return;

    const all = PARSER_STATE.collected;
    if (all.length === 0) { el.innerHTML = '<div class="pres-empty">No cards found after all filters</div>'; return; }
    _updateStatsBar();

    const testModeActive = !!PARSER_STATE.testMode;
    const base = testModeActive ? _applyTestMode(all, false) : all;
    const testEl = document.getElementById('ps-test-mode');
    if (testEl) testEl.style.display = testModeActive ? 'inline' : 'none';

    let view = prView();
    if (geoFilter) {
        const code = geoCode(geoFilter);
        view = { ...view, region: geoRegion(code), country: code, bin: '' };
    }
    const tree = buildGeoTree(base, view.tiers);
    view = prSanitizeView(view, tree);
    PARSER_STATE.resView = view;

    const region = tree.regions.find(r => r.name === view.region);
    const country = region && region.countries.find(c => c.code === view.country);
    const scope = filterScope(base, view);
    const idxOf = new Map(all.map((c, i) => [c, i]));
    const selInScope = scope.filter(c => PARSER_STATE.selected.has(idxOf.get(c))).length;
    const exportCount = selInScope || scope.length;
    const exportHint = selInScope ? `${selInScope} selected` : `all ${scope.length}`;
    const totalBins = new Set(base.map(c => c.bin)).size;

    let tableHtml = '';
    if (country) {
        const sorted = prSortCards(scope);
        const shown = view.showAll ? sorted : sorted.slice(0, PR_ROW_LIMIT);
        tableHtml = prTableHtml(prRowsHtml(shown, idxOf), sorted.length, view);
    }

    const keepScroll = ['.pres-region-row', '.pres-country-row', '.pres-bins-grid']
        .map(sel => [sel, el.querySelector(sel)]).filter(([, n]) => n)
        .map(([sel, n]) => [sel, n.scrollLeft, n.scrollTop]);

    el.innerHTML = `
    <div class="pres-wrap" id="pres-root">
        <div class="pres-topbar">
            <div class="pres-topbar-left">
                <span class="pres-total-badge">${tree.total} cards · ${totalBins} BIN</span>
                ${testModeActive ? `<span class="pres-test-badge">🧪 TEST: ${base.length} / ${totalBins} BINs</span>` : ''}
                <span class="pres-tier-label">Tier</span>${prTierChips(tree, view)}
                ${view.tiers.size ? '<button class="pres-link-btn" data-act="tier-clear">reset</button>' : ''}
            </div>
            <div class="pres-topbar-right">
                <span class="pres-scope">${prEsc(prScopeLabel(view) || 'All cards')}: ${scope.length}</span>
                <label class="pres-selall-label">
                    <input type="checkbox" id="parser-select-all" ${selInScope === scope.length && scope.length > 0 ? 'checked' : ''}> Select all
                </label>
                <button class="pres-btn pres-btn-copy" data-act="copy-scope" title="Copy cards of the current view (selected ones, or all if none selected)">📋 Copy (${exportHint})</button>
                <button class="pres-btn pres-btn-export" id="parser-import-btn" data-act="notes-scope" title="Export cards of the current view to Notes">📝 Export to Notes (${exportCount})</button>
            </div>
        </div>

        <div class="pres-level-label">Regions <span>— click a region to open its countries</span></div>
        <div class="pres-region-row pres-scroll">${prRegionChips(tree, view) || '<span class="pres-empty-inline">No cards for the selected tier</span>'}</div>

        ${region ? `
        <div class="pres-level-label" title="${prEsc(geoRegionInfo(region.name).tip)}">${region.icon} ${prEsc(geoRegionInfo(region.name).label)} · ${region.countries.length} countries <span>— click a country to open its BINs</span></div>
        <div class="pres-country-row pres-scroll">${prCountryChips(region, view)}</div>` : ''}

        ${country ? `
        <div class="pres-bins-section">
            <div class="pres-level-label">${prFlag(country.code)} ${prEsc(country.name)} <span class="pres-tier-badge t${country.tier}">T${country.tier}</span>
                · BINs (${country.bins.length}) <span>— click a BIN to filter the table, 📝/📋 to export one BIN</span>
                ${view.bin ? '<button class="pres-link-btn" data-act="bin-clear">show all BINs</button>' : ''}</div>
            <div class="pres-bins-grid pres-scroll">${prBinCards(country, view)}</div>
        </div>
        ${tableHtml}` : ''}
    </div>`;

    prBind(el, { all, base, scope, idxOf });
    keepScroll.forEach(([sel, left, top]) => {
        const n = el.querySelector(sel);
        if (n) { n.scrollLeft = left; n.scrollTop = top; }
    });
}

/* ── events ── */

function prToggleTier(tier) {
    const next = new Set(prView().tiers);
    if (next.has(tier)) next.delete(tier); else next.add(tier);
    prSetView({ tiers: next, showAll: false });
}

function prBinLines(base, view, bin) {
    return filterScope(base, { ...view, bin }).map(prCardLine);
}

function prSelectedLines(scope, idxOf) {
    const sel = scope.filter(c => PARSER_STATE.selected.has(idxOf.get(c)));
    return (sel.length ? sel : scope).map(prCardLine);
}

function prHandleAction(act, ds, ctx) {
    const view = prView();
    const { base, scope, idxOf } = ctx;
    switch (act) {
        case 'tier': return prToggleTier(Number(ds.tier));
        case 'tier-clear': return prSetView({ tiers: new Set(), showAll: false });
        case 'region': return prSetView({ region: ds.region === view.region ? '' : ds.region, country: '', bin: '', showAll: false });
        case 'country': return prSetView({ country: ds.country === view.country ? '' : ds.country, bin: '', showAll: false });
        case 'bin': return prSetView({ bin: ds.bin === view.bin ? '' : ds.bin, showAll: false });
        case 'bin-clear': return prSetView({ bin: '', showAll: false });
        case 'show-all': return prSetView({ showAll: true });
        case 'sort-bin':
            PARSER_STATE.sortBy = PARSER_STATE.sortBy === 'bin-desc' ? 'bin-asc' : 'bin-desc';
            return renderParserResults();
        case 'bin-notes': {
            const lines = prBinLines(base, view, ds.bin);
            if (!lines.length) { toast('No cards for this BIN', 'info'); return; }
            return prPushNote(`BIN ${ds.bin} (${lines.length})`, lines, 'Parser BIN');
        }
        case 'bin-copy': return prCopy(prBinLines(base, view, ds.bin), `BIN ${ds.bin}`);
        case 'copy-scope': return prCopy(prSelectedLines(scope, idxOf), prScopeLabel(view) || 'All');
        case 'notes-scope': {
            const lines = prSelectedLines(scope, idxOf);
            if (!lines.length) { toast('No cards in this view', 'warning'); return; }
            const scopeLabel = prScopeLabel(view);
            const title = [_buildExportTabTitle(), scopeLabel].filter(Boolean).join(' — ');
            return prPushNote(title, lines, 'Parser');
        }
        default: return undefined;
    }
}

function prBind(el, ctx) {
    const root = el.querySelector('#pres-root');
    if (!root) return;

    root.addEventListener('click', e => {
        if (e.target.closest('input')) return;
        const target = e.target.closest('[data-act]');
        if (!target) return;
        e.stopPropagation();
        prHandleAction(target.dataset.act, target.dataset, ctx);
    });

    root.addEventListener('change', e => {
        const t = e.target;
        if (t.classList.contains('parser-check')) {
            const idx = parseInt(t.dataset.idx, 10);
            if (t.checked) PARSER_STATE.selected.add(idx); else PARSER_STATE.selected.delete(idx);
            renderParserResults();
        } else if (t.id === 'parser-select-all') {
            ctx.scope.forEach(c => {
                const idx = ctx.idxOf.get(c);
                if (t.checked) PARSER_STATE.selected.add(idx); else PARSER_STATE.selected.delete(idx);
            });
            renderParserResults();
        }
    });

    // Mouse wheel scrolls chip rows horizontally
    root.querySelectorAll('.pres-region-row, .pres-country-row').forEach(row => {
        row.addEventListener('wheel', e => {
            if (row.scrollWidth <= row.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            row.scrollLeft += e.deltaY;
        }, { passive: false });
    });
}
