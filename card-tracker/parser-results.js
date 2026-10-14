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
    return PARSER_STATE.resView || { tiers: new Set(), region: '', country: '', bin: '', showAll: false, multi: new Set(), full: false, expanded: new Set() };
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
    if (view.multi && view.multi.size) {
        const codes = [...view.multi];
        parts.push(codes.length <= 4 ? codes.join('+') : `${codes.length} countries`);
        return parts.join(' · ');
    }
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
    const all = tree.tierCounts[1] + tree.tierCounts[2] + tree.tierCounts[3];
    const allChip = `<button class="pres-tier-chip all ${view.tiers.size === 0 ? 'active' : ''}" data-act="tier-clear"
        title="Show all tiers (no tier filter)">All <span>${all}</span></button>`;
    return allChip + [1, 2, 3].map(t => `<button class="pres-tier-chip t${t} ${view.tiers.has(t) ? 'active' : ''}" data-act="tier" data-tier="${t}"
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
    const multi = view.multi || new Set();
    return region.countries.map(c => `<div class="pres-country-chip ${c.code === view.country ? 'active' : ''} ${multi.has(c.code) ? 'multi' : ''}" role="button" tabindex="0" data-act="country" data-country="${prEsc(c.code)}" title="${prEsc(c.name)} — click to open its BINs, tick the box to add it to the multi-selection">
        <input type="checkbox" class="pres-multi-check" data-multi="${prEsc(c.code)}" ${multi.has(c.code) ? 'checked' : ''} title="Add to multi-selection">
        <span class="pres-flag">${prFlag(c.code)}</span><b>${prEsc(c.code || '??')}</b><span class="pres-cname">${prEsc(c.name)}</span>
        <span class="pres-tier-badge t${c.tier}">T${c.tier}</span><span class="pres-chip-count">${c.count}</span></div>`).join('');
}

/** Tags of the chosen countries (removable) + quick actions. */
function prMultiBar(view, region, count) {
    if (!view.multi || !view.multi.size) return '';
    const tags = [...view.multi].map(code => `<span class="pres-mtag">${prFlag(code)} <b>${prEsc(code)}</b><button data-act="multi-remove" data-country="${prEsc(code)}" title="Remove">✕</button></span>`).join('');
    const regionBtn = region ? `<button class="pres-link-btn" data-act="multi-region" data-region="${prEsc(region.name)}">+ all of ${prEsc(geoRegionInfo(region.name).label)}</button>` : '';
    return `<div class="pres-multibar"><span class="pres-multi-label">Selected countries (${view.multi.size}) · ${count} cards</span>${tags}${regionBtn}
        <button class="pres-link-btn" data-act="multi-clear">clear</button></div>`;
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

function prBinInfo(c) {
    return typeof BIN_CACHE !== 'undefined' ? BIN_CACHE[c.bin] : null;
}

function prNetworkOf(cc) {
    return typeof getCardType === 'function' ? String(getCardType(cc || '') || '').toUpperCase() : '';
}

function prDesc(c) {
    return cdDescribe(c, prBinInfo(c), prNetworkOf);
}

function prTableHtml(rows, total, view) {
    const sortBy = PARSER_STATE.sortBy || 'index';
    const binSortIcon = sortBy === 'bin-desc' ? '↓' : sortBy === 'bin-asc' ? '↑' : '↕';
    const more = total > rows.length
        ? `<button class="pres-more-btn" data-act="show-all">Show all ${total} cards (${total - rows.length} hidden)</button>` : '';
    const full = !!view.full;
    const cols = full
        ? '<col style="width:28px"><col style="width:12%"><col style="width:17%"><col style="width:6%"><col style="width:13%"><col style="width:6%"><col style="width:7%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:6%"><col style="width:9%">'
        : '<col style="width:28px"><col style="width:15%"><col style="width:16%"><col style="width:18%"><col style="width:52px"><col style="width:72px"><col style="width:80px">';
    const head = full
        ? '<th></th><th>NAME</th><th>CARD (FULL)</th><th>CVV</th><th>BANK</th><th>EXP</th><th>TYPE</th><th>CLASS</th><th>NETWORK</th><th class="pres-sort-th" data-act="sort-bin">BIN ' + binSortIcon + '</th><th>GEO</th>'
        : '<th></th><th>NAME</th><th>CARD</th><th>BANK</th><th>EXP</th><th class="pres-sort-th" data-act="sort-bin">BIN ' + binSortIcon + '</th><th>GEO</th>';
    return `<div class="pres-table-tools">
            <button class="pres-link-btn pres-full-toggle ${full ? 'on' : ''}" data-act="toggle-full" title="Add the full number, CVV, type, class and network columns">${full ? '☑' : '☐'} Show full details</button>
            <span class="pres-hint">Click a row to open all fields of the card</span>
        </div>
        <div class="pres-table-wrap ${full ? 'pres-table-full' : ''}">
        <table class="pres-table">
            <colgroup>${cols}</colgroup>
            <thead><tr>${head}</tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>${more}`;
}

function prDetailsHtml(c, idx) {
    const cells = cdDetailRows(c, prBinInfo(c), prNetworkOf)
        .map(r => `<div class="pres-d"><em>${prEsc(r.label)}</em><span>${r.value ? prEsc(r.value) : '<i>—</i>'}</span></div>`).join('');
    return `<div class="pres-details">${cells}
        <button class="pres-link-btn pres-d-copy" data-act="row-copy" data-idx="${idx}" title="Copy: number mm yy cvv">📋 Copy card</button></div>`;
}

function prRowsHtml(cards, idxOf, view) {
    const full = !!(view && view.full);
    const expanded = (view && view.expanded) || new Set();
    const span = full ? 11 : 7;
    return cards.map(c => {
        const idx = idxOf.get(c);
        const code = geoCode(c.detectedGeo);
        const d = prDesc(c);
        const open = expanded.has(idx);
        const name = `${(c.name || '').toUpperCase()} ${(c.surname || '').toUpperCase()}`.trim();
        const geoTitle = typeof geoName === 'function' && code ? geoName(code) : (d.countryName || '');
        const tailCols = full ? `
            <td class="pc-type">${prEsc(d.type || '—')}</td>
            <td class="pc-class">${prEsc(d.cardClass || '—')}</td>
            <td class="pc-net">${prEsc(d.network || '—')}</td>` : '';
        const cardCol = full ? '' : `<td class="pc-card">${formatCardBin(c.cc)}</td>`;
        const head = full
            ? `<td class="pc-fullnum">${prEsc(d.fullNumber)}</td><td class="pc-cvv">${prEsc(d.cvv)}</td>`
            : cardCol;
        return `<tr class="pres-row ${open ? 'open' : ''}" data-act="row-toggle" data-idx="${idx}">
            <td class="pc-chk"><input type="checkbox" ${PARSER_STATE.selected.has(idx) ? 'checked' : ''} data-idx="${idx}" class="parser-check"></td>
            <td class="pc-holder">${prEsc(name)}</td>
            ${head}
            <td class="pc-bank" title="${prEsc(c.bank || '')}">${prEsc(c.bank || '—')}</td>
            <td class="pc-exp">${prEsc(d.exp)}</td>${tailCols}
            <td class="pc-bin">${prEsc(c.bin)}</td>
            <td class="pc-geo" title="${prEsc(geoTitle)}">${code ? `${prFlag(code)} ${prEsc(code)} <span class="pres-tier-badge t${geoTier(code)}">T${geoTier(code)}</span>` : '—'}</td>
        </tr>${open ? `<tr class="pres-drow"><td colspan="${span}">${prDetailsHtml(c, idx)}</td></tr>` : ''}`;
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
function prSanitizeView(rawView, tree) {
    const known = new Set(tree.regions.flatMap(r => r.countries.map(c => c.code)));
    const multi = new Set([...(rawView.multi || [])].filter(code => known.has(code)));
    const view = { ...rawView, multi };
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
    const viewScope = filterScope(base, view);
    // Several countries ticked → export / select-all / copy work on all of them together
    const multiOn = view.multi.size > 0;
    const scope = multiOn ? filterMultiScope(base, view.tiers, view.multi) : viewScope;
    const idxOf = new Map(all.map((c, i) => [c, i]));
    const selInScope = scope.filter(c => PARSER_STATE.selected.has(idxOf.get(c))).length;
    const exportCount = selInScope || scope.length;
    const exportHint = selInScope ? `${selInScope} selected` : `all ${scope.length}`;
    const totalBins = new Set(base.map(c => c.bin)).size;

    let tableHtml = '';
    if (country) {
        const sorted = prSortCards(viewScope);
        const shown = view.showAll ? sorted : sorted.slice(0, PR_ROW_LIMIT);
        tableHtml = prTableHtml(prRowsHtml(shown, idxOf, view), sorted.length, view);
    }

    const keepScroll = ['.pres-bins-grid']
        .map(sel => [sel, el.querySelector(sel)]).filter(([, n]) => n)
        .map(([sel, n]) => [sel, n.scrollLeft, n.scrollTop]);

    el.innerHTML = `
    <div class="pres-wrap" id="pres-root">
        <div class="pres-topbar">
            <div class="pres-topbar-left">
                <span class="pres-total-badge">${tree.total} cards · ${totalBins} BIN</span>
                ${testModeActive ? `<span class="pres-test-badge">🧪 TEST: ${base.length} / ${totalBins} BINs</span>` : ''}
                <span class="pres-tier-label">Tier</span>${prTierChips(tree, view)}
            </div>
            <div class="pres-topbar-right">
                <span class="pres-scope">${prEsc(prScopeLabel(view) || 'All cards')}: ${scope.length}</span>
                <label class="pres-selall-label">
                    <input type="checkbox" id="parser-select-all" ${selInScope === scope.length && scope.length > 0 ? 'checked' : ''}> Select all
                </label>
                <span class="pres-sel-counter ${selInScope ? 'on' : ''}" id="pres-sel-counter">${prEsc(multiOn ? prScopeLabel(view) : 'Selected')}: ${selInScope} selected</span>
                <button class="pres-btn pres-btn-copy" data-act="copy-scope" title="Copy cards of the current view (selected ones, or all if none selected)">📋 Copy (${exportHint})</button>
                <button class="pres-btn pres-btn-export" id="parser-import-btn" data-act="notes-scope" title="Export cards of the current view to Notes">📝 Export to Notes (${exportCount})</button>
            </div>
        </div>

        <div class="pres-level-label">Regions <span>— click a region to open its countries</span></div>
        <div class="pres-region-row pres-scroll">${prRegionChips(tree, view) || '<span class="pres-empty-inline">No cards for the selected tier</span>'}</div>
        ${prMultiBar(view, region, scope.length)}

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
        case 'toggle-full': return prSetView({ full: !view.full });
        case 'row-toggle': {
            const idx = Number(ds.idx);
            const next = new Set(view.expanded || []);
            if (next.has(idx)) next.delete(idx); else next.add(idx);
            return prSetView({ expanded: next });
        }
        case 'row-copy': {
            const card = ctx.all[Number(ds.idx)];
            return card ? prCopy([prCardLine(card)], 'Card') : undefined;
        }
        case 'multi-remove': return prSetView({ multi: new Set([...view.multi].filter(code => code !== ds.country)) });
        case 'multi-clear': return prSetView({ multi: new Set() });
        case 'multi-region': {
            const tree = buildGeoTree(base, view.tiers);
            const reg = tree.regions.find(r => r.name === ds.region);
            return reg ? prSetView({ multi: new Set([...view.multi, ...reg.countries.map(c => c.code)]) }) : undefined;
        }
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
        if (t.classList.contains('pres-multi-check')) {
            const next = new Set(prView().multi);
            if (t.checked) next.add(t.dataset.multi); else next.delete(t.dataset.multi);
            prSetView({ multi: next });
        } else if (t.classList.contains('parser-check')) {
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
}
