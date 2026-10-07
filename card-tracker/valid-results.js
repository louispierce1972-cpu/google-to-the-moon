/* ═══════════════════════════════════════════════════════════════════
   VALID CARDS — results page.
   Cards grouped by BIN (click a BIN to open its full card list),
   country filter (Германия 13, США 23 ...), search, per-card / per-BIN /
   all selection, export to Notes in Checker / Pipe / Full format.
   State lives in VALID_STATE (valid-trash-ui.js).
   ═══════════════════════════════════════════════════════════════════ */

const CK_REGION_NAMES = (() => {
    try { return new Intl.DisplayNames(['ru'], { type: 'region' }); } catch (e) { return null; }
})();

function ckCountryName(code) {
    if (!code || code === '??') return 'Неизвестно';
    try { return (CK_REGION_NAMES && CK_REGION_NAMES.of(code)) || code; } catch (e) { return code; }
}

/** Cards after the country filter and search. */
function ckFilteredCards() {
    const { cards, countries, search } = VALID_STATE;
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\s/g, '');
    return cards.filter(c => {
        if (countries.size > 0 && !countries.has(c.geo)) return false;
        if (!q) return true;
        return (qDigits && c.cc.includes(qDigits)) || c.holder.toLowerCase().includes(q) || c.bank.toLowerCase().includes(q);
    });
}

/** BIN groups sorted by size; cards inside sorted by country, then name. */
function ckGroupByBin(cards) {
    const map = new Map();
    cards.forEach(c => map.set(c.bin, [...(map.get(c.bin) || []), c]));
    return [...map.entries()]
        .map(([bin, list]) => ({
            bin,
            cards: [...list].sort((a, b) => a.geo.localeCompare(b.geo) || a.holder.localeCompare(b.holder)),
            bank: (list.find(c => c.bank) || {}).bank || '',
            type: (list.find(c => c.cardType) || {}).cardType || ''
        }))
        .sort((a, b) => b.cards.length - a.cards.length || a.bin.localeCompare(b.bin));
}

function ckCountBy(cards, key) {
    const out = new Map();
    cards.forEach(c => out.set(c[key], (out.get(c[key]) || 0) + 1));
    return [...out.entries()].sort((a, b) => b[1] - a[1]);
}

function ckGroupRows(group) {
    const dash = '<span class="vc-empty">—</span>';
    return group.cards.map(c => {
        const on = VALID_STATE.selected.has(c.cc);
        return `<tr class="${on ? 'selected' : ''}">
            <td class="vc-td-chk"><input type="checkbox" class="ck-card-chk" data-cc="${ckEsc(c.cc)}" ${on ? 'checked' : ''}></td>
            <td class="vc-card">${ckEsc(c.cc.replace(/(\d{4})(?=\d)/g, '$1 '))}</td>
            <td class="vc-td-exp">${c.mm && c.yy ? ckEsc(`${c.mm}/${c.yy}`) : dash}</td>
            <td class="vc-td-cvv">${c.cvv ? ckEsc(c.cvv) : dash}</td>
            <td class="vc-td-name">${c.holder ? ckEsc(c.holder.toUpperCase()) : dash}</td>
            <td class="vc-td-type">${c.cardType ? ckEsc(c.cardType.toUpperCase()) : dash}</td>
            <td class="vc-td-bank" title="${ckEsc(c.bank)}">${c.bank ? ckEsc(c.bank) : dash}</td>
            <td class="vc-td-geo"><span class="ck-geo-code">${ckEsc(c.geo)}</span> ${ckEsc(ckCountryName(c.geo))}</td>
        </tr>`;
    }).join('');
}

function ckGroupHtml(group) {
    const open = VALID_STATE.expanded.has(group.bin);
    const selCount = group.cards.filter(c => VALID_STATE.selected.has(c.cc)).length;
    const geos = ckCountBy(group.cards, 'geo').slice(0, 4)
        .map(([g, n]) => `<span class="ck-g-geo"><b>${ckEsc(g)}</b> ${n}</span>`).join('');
    return `<div class="ck-group ${open ? 'open' : ''} ${selCount ? 'has-sel' : ''}">
        <div class="ck-group-head" data-act="toggle" data-bin="${ckEsc(group.bin)}">
            <input type="checkbox" class="ck-group-chk" data-bin="${ckEsc(group.bin)}"
                data-state="${selCount === 0 ? 'none' : selCount === group.cards.length ? 'all' : 'some'}">
            <span class="ck-caret">${open ? '▾' : '▸'}</span>
            <span class="ck-g-bin">${ckEsc(group.bin)}</span>
            <span class="ck-g-bank" title="${ckEsc(group.bank)}">${ckEsc(group.bank || 'Банк неизвестен')}</span>
            <span class="ck-g-type">${ckEsc((group.type || '').toUpperCase())}</span>
            <span class="ck-g-geos">${geos}</span>
            <span class="ck-g-sel">${selCount ? `✓ ${selCount}/${group.cards.length}` : ''}</span>
            <span class="ck-g-count">${group.cards.length} карт</span>
        </div>
        ${open ? `<div class="ck-group-body"><table class="data-table vc-table ck-table">
            <thead><tr><th class="vc-td-chk"></th><th>КАРТА</th><th>EXP</th><th>CVV</th><th>ИМЯ ФАМИЛИЯ</th><th>ТИП</th><th>БАНК</th><th>СТРАНА</th></tr></thead>
            <tbody>${ckGroupRows(group)}</tbody></table></div>` : ''}
    </div>`;
}

function ckNoteTitle(list) {
    const bins = [...new Set(list.map(c => c.bin))];
    const geos = [...new Set(list.map(c => c.geo))];
    const binPart = bins.length <= 3 ? `BIN ${bins.join(', ')}` : `${bins.length} BIN`;
    const geoPart = geos.length <= 3 ? ` · ${geos.join(', ')}` : '';
    return `VALID · ${binPart}${geoPart} (${list.length})`;
}

function ckExportToNotes(list) {
    if (list.length === 0) { toast('Сначала выбери карты (галочки, BIN или «Выбрать все»)', 'warning'); return; }
    ckPushNote(ckNoteTitle(list), ckFormatLines(list, VALID_STATE.format), 'Valid Cards');
}

function renderValidCardsResults() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    if (bar) bar.innerHTML = '';
    const { cards, stats, countries, selected } = VALID_STATE;

    const filtered = ckFilteredCards();
    const groups = ckGroupByBin(filtered);
    const countryList = ckCountBy(cards, 'geo');
    const matched = cards.filter(c => c.inBase).length;
    const hasBase = (PARSER_STATE.rawMessages || []).length > 0;
    const selectedCards = cards.filter(c => selected.has(c.cc));

    const countryChips = [
        `<button class="ck-country ${countries.size === 0 ? 'active' : ''}" data-act="country-all">🌍 Все <span>${cards.length}</span></button>`,
        ...countryList.map(([code, n]) => `<button class="ck-country ${countries.has(code) ? 'active' : ''}" data-act="country" data-geo="${ckEsc(code)}">
            <b>${ckEsc(code)}</b> ${ckEsc(ckCountryName(code))} <span>${n}</span></button>`)
    ].join('');

    const formatOptions = Object.entries(CK_FORMATS)
        .map(([key, f]) => `<option value="${key}" ${VALID_STATE.format === key ? 'selected' : ''}>${ckEsc(f.label)}</option>`).join('');

    area.innerHTML = `
    <div class="vc-container ck-res" id="ck-res">
        <div class="vc-header">
            <button class="pz-btn pz-btn-dim vc-back-btn" data-act="back">← Back to Parser</button>
            <h2 class="vc-title">✅ Valid Cards</h2>
            <span class="vc-base-note">${hasBase
                ? `📎 Данные из базы найдены для ${matched} из ${cards.length}`
                : '⚠ База не загружена — загрузите result.json в Parser, чтобы подтянуть имя / банк / страну'}</span>
        </div>

        <div class="vc-stats-row">
            <div class="vc-stat-card vc-stat-green"><span class="vc-stat-val">${stats.valid}</span><span class="vc-stat-lbl">VALID</span></div>
            <div class="vc-stat-card vc-stat-red"><span class="vc-stat-val">${stats.trash}</span><span class="vc-stat-lbl">TRASH ИСКЛЮЧЕНО</span></div>
            <div class="vc-stat-card vc-stat-dim"><span class="vc-stat-val">${stats.inTrashBefore}</span><span class="vc-stat-lbl">УЖЕ В КОРЗИНЕ</span></div>
            <div class="vc-stat-card vc-stat-blue"><span class="vc-stat-val">${new Set(cards.map(c => c.bin)).size}</span><span class="vc-stat-lbl">BIN</span></div>
            <div class="vc-stat-card vc-stat-blue"><span class="vc-stat-val">${countryList.length}</span><span class="vc-stat-lbl">СТРАН</span></div>
        </div>

        <div class="ck-countries">${countryChips}</div>

        <div class="ck-toolbar">
            <input type="search" class="ck-search" id="ck-search" placeholder="Поиск: номер, BIN, имя, банк…" value="${ckEsc(VALID_STATE.search)}">
            <span class="vc-sel-count">Выбрано: ${selectedCards.length}</span>
            <button class="pz-btn pz-btn-dim" data-act="sel-shown">✓ Выбрать все показанные (${filtered.length})</button>
            <button class="pz-btn pz-btn-dim" data-act="sel-none">☐ Снять всё</button>
            <button class="pz-btn pz-btn-dim" data-act="expand-all">⊞ Раскрыть все</button>
            <button class="pz-btn pz-btn-dim" data-act="collapse-all">⊟ Свернуть все</button>
            <span class="vc-bar-spacer"></span>
            <label class="vc-fmt-label">Формат <select id="ck-format" class="vc-fmt-select">${formatOptions}</select></label>
            <button class="pz-btn pz-btn-primary" data-act="notes-selected" ${selectedCards.length ? '' : 'disabled'}>📝 Выбранные → Notes (${selectedCards.length})</button>
        </div>

        <div class="ck-groups-head">BIN-ы: ${groups.length} · карт: ${filtered.length} — нажми на BIN, чтобы раскрыть карты; галочка слева выбирает весь BIN</div>
        <div class="ck-groups">${groups.map(ckGroupHtml).join('') || '<div class="vc-no-rows">Ничего не найдено</div>'}</div>
    </div>`;

    ckBindResults(area, groups, filtered);
}

/** Re-render keeping scroll position and search focus. */
function ckRerender() {
    const area = document.getElementById('content-area');
    const areaTop = area ? area.scrollTop : 0;
    const winTop = window.scrollY;
    const searchFocused = document.activeElement && document.activeElement.id === 'ck-search';
    renderValidCardsResults();
    if (area) area.scrollTop = areaTop;
    window.scrollTo(0, winTop);
    if (searchFocused) {
        const input = document.getElementById('ck-search');
        if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    }
}

function ckSetSelected(ccs, on) {
    const next = new Set(VALID_STATE.selected);
    ccs.forEach(cc => { if (on) next.add(cc); else next.delete(cc); });
    VALID_STATE.selected = next;
}

function ckToggleIn(key, value) {
    const next = new Set(VALID_STATE[key]);
    if (next.has(value)) next.delete(value); else next.add(value);
    VALID_STATE[key] = next;
}

/** Event delegation for the results page (the container is recreated on every render). */
function ckBindResults(area, groups, filtered) {
    const root = area.querySelector('#ck-res');
    if (!root) return;
    const groupByBin = new Map(groups.map(g => [g.bin, g]));

    root.querySelectorAll('.ck-group-chk').forEach(cb => {
        cb.checked = cb.dataset.state === 'all';
        cb.indeterminate = cb.dataset.state === 'some';
    });

    root.addEventListener('click', e => {
        if (e.target.closest('input')) return;
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const act = el.dataset.act;
        if (act === 'back') { VALID_STATE.cards = []; navigate('new-cards'); return; }
        if (act === 'toggle') ckToggleIn('expanded', el.dataset.bin);
        else if (act === 'country') ckToggleIn('countries', el.dataset.geo);
        else if (act === 'country-all') VALID_STATE.countries = new Set();
        else if (act === 'sel-shown') ckSetSelected(filtered.map(c => c.cc), true);
        else if (act === 'sel-none') VALID_STATE.selected = new Set();
        else if (act === 'expand-all') VALID_STATE.expanded = new Set(groups.map(g => g.bin));
        else if (act === 'collapse-all') VALID_STATE.expanded = new Set();
        else if (act === 'notes-selected') {
            ckExportToNotes(VALID_STATE.cards.filter(c => VALID_STATE.selected.has(c.cc)));
            return;
        } else return;
        ckRerender();
    });

    root.addEventListener('change', e => {
        const t = e.target;
        if (t.classList.contains('ck-card-chk')) {
            ckSetSelected([t.dataset.cc], t.checked);
            ckRerender();
        } else if (t.classList.contains('ck-group-chk')) {
            const group = groupByBin.get(t.dataset.bin);
            if (group) ckSetSelected(group.cards.map(c => c.cc), t.dataset.state !== 'all');
            ckRerender();
        } else if (t.id === 'ck-format') {
            VALID_STATE.format = t.value;
        }
    });

    const search = root.querySelector('#ck-search');
    let timer = null;
    search?.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { VALID_STATE.search = search.value; ckRerender(); }, 200);
    });
}
