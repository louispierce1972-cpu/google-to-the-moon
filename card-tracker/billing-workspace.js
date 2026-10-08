/* ═══════════════════════════════════════════════════════════════════
   BILLING WORKSPACE — the Workspace tab.
   Upload Google Ads "Billing activity report" CSV files (or a ZIP with
   them) → one row per (file, card) with spend, declines, chargebacks,
   campaign cost, period + full card data from the main base.
   Pure logic lives in billing-statement.js (bs*). This file = UI only.
   ═══════════════════════════════════════════════════════════════════ */

const BW_KEY_RECORDS = 'ct_bw_records';
const BW_KEY_SELECT = 'ct_bw_selections';

const BW = {
    records: bwLoad(BW_KEY_RECORDS, []),
    selections: bwLoad(BW_KEY_SELECT, {}),
    index: null,
    indexKey: '',
    indexing: false,
    status: 'all',
    search: ''
};

function bwLoad(key, fallback) {
    try {
        const v = JSON.parse(localStorage.getItem(key));
        return v == null ? fallback : v;
    } catch (_) { return fallback; }
}

function bwPersist() {
    try {
        localStorage.setItem(BW_KEY_RECORDS, JSON.stringify(BW.records));
        localStorage.setItem(BW_KEY_SELECT, JSON.stringify(BW.selections));
    } catch (e) {
        if (typeof toast === 'function') toast('Не удалось сохранить Workspace (localStorage переполнен)', 'error');
    }
}

function bwEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bwMoney(n, cur) {
    if (!n) return '<span class="bw-zero">—</span>';
    return bwEsc(cur || '') + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function bwMoneyMap(map) {
    const parts = Object.entries(map).filter(([, v]) => v).map(([c, v]) => `${c}${Math.round(v).toLocaleString('en-US')}`);
    return parts.length ? parts.join(' + ') : '—';
}

function bwDateRu(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : '';
}

/** Cards of the main base, indexed by last 4 (built lazily, cached by message count). */
function bwEnsureIndex(onReady) {
    const raw = (typeof PARSER_STATE !== 'undefined' && PARSER_STATE.rawMessages) || [];
    if (!raw.length) { BW.index = null; BW.indexKey = ''; return false; }
    const key = String(raw.length);
    if (BW.index && BW.indexKey === key) return true;
    if (BW.indexing) return false;
    BW.indexing = true;
    setTimeout(() => {
        try {
            BW.index = bsBuildIndex(extractCardsFromMessages(raw));
            BW.indexKey = key;
        } catch (e) {
            console.error('Billing index failed', e);
            BW.index = null;
        }
        BW.indexing = false;
        onReady();
    }, 30);
    return false;
}

function bwCurrentRows() {
    const rows = bsBuildRows(BW.records, BW.index || new Map(), BW.selections);
    const q = BW.search.trim().toLowerCase();
    return rows.filter(r => {
        if (BW.status !== 'all' && r.status !== BW.status) return false;
        if (!q) return true;
        const hay = [r.last4, r.network, r.fileName, r.chosen && r.chosen.cc, r.chosen && r.chosen.bank, r.chosen && r.chosen.country, r.chosen && r.chosen.countryCode].join(' ').toLowerCase();
        return hay.includes(q);
    });
}

/* ───────────────────────── FILES ───────────────────────── */

function bwFileText(f) {
    if (typeof f.text === 'function') return f.text();
    return new Promise((resolve, reject) => {
        const rd = new FileReader();
        rd.onload = () => resolve(String(rd.result));
        rd.onerror = () => reject(rd.error);
        rd.readAsText(f);
    });
}

async function bwReadFiles(fileList) {
    const files = [...fileList];
    const out = [];
    for (const f of files) {
        if (/\.zip$/i.test(f.name) && typeof JSZip !== 'undefined') {
            const zip = await JSZip.loadAsync(f);
            for (const entry of Object.values(zip.files)) {
                if (!entry.dir && /\.csv$/i.test(entry.name)) out.push({ name: entry.name.split('/').pop(), text: await entry.async('string') });
            }
        } else if (/\.csv$/i.test(f.name)) {
            out.push({ name: f.name, text: await bwFileText(f) });
        }
    }
    return out;
}

async function bwAddFiles(fileList) {
    const items = await bwReadFiles(fileList);
    if (!items.length) { toast('Нужны CSV-файлы «Billing activity report»', 'warning'); return; }
    let added = 0, skipped = 0;
    for (const it of items) {
        const recs = bsSummarize(bsParseStatement(it.text, it.name));
        if (!recs.length) { skipped++; continue; }
        BW.records = bsMergeRecords(BW.records, recs);
        added += recs.length;
    }
    bwPersist();
    toast(`Billing: +${added} карт из ${items.length - skipped} файлов${skipped ? `, пропущено ${skipped} (нет платежей по картам)` : ''}`, added ? 'success' : 'warning');
    renderBillingWorkspace();
}

function bwRemoveFile(name) {
    BW.records = BW.records.filter(r => r.fileName !== name);
    const keep = new Set(BW.records.map(r => r.id));
    BW.selections = Object.fromEntries(Object.entries(BW.selections).filter(([id]) => keep.has(id)));
    bwPersist();
    renderBillingWorkspace();
}

function bwClearAll() {
    if (!BW.records.length || !confirm('Очистить все загруженные выписки в Workspace?')) return;
    BW.records = [];
    BW.selections = {};
    bwPersist();
    renderBillingWorkspace();
}

/* ───────────────────────── RENDER ───────────────────────── */

function bwStatusCell(r) {
    if (r.status === 'matched') return '<span class="bw-st bw-st-ok">✓ найдена</span>';
    if (r.status === 'choose') return `<span class="bw-st bw-st-pick">выберите (${r.candidates.length})</span>`;
    return '<span class="bw-st bw-st-miss">не найдена</span>';
}

function bwCardCells(r) {
    if (r.status === 'choose') {
        const opts = ['<option value="">— выбрать —</option>'].concat(r.candidates.map(c =>
            `<option value="${bwEsc(c.cc)}">${bwEsc(c.cc)} · ${bwEsc(c.mm)}/${bwEsc(c.yy)} · ${bwEsc(c.bank || '?')} · ${bwEsc(c.country || c.countryCode || '?')}</option>`));
        return `<td colspan="6"><select class="bw-select" data-bw-pick="${bwEsc(r.id)}">${opts.join('')}</select></td>`;
    }
    if (!r.chosen) return '<td colspan="6" class="bw-dim">нет в общей базе</td>';
    const c = r.chosen;
    const copy = `${c.cc} ${c.mm} ${c.yy} ${c.cvv}`;
    return `<td><span class="bw-copy" data-bw-copy="${bwEsc(copy)}" title="Копировать: номер мм гг cvv">${bwEsc(c.cc)}</span></td>
        <td>${bwEsc(c.mm)}/${bwEsc(c.yy)}</td><td>${bwEsc(c.cvv)}</td><td>${bwEsc(c.cc.slice(0, 6))}</td>
        <td>${bwEsc(c.country || c.countryCode || '—')}</td><td class="bw-bank">${bwEsc(c.bank || '—')}<small>${bwEsc(c.cardType || '')}</small></td>`;
}

function bwRowHtml(r, i) {
    return `<tr class="bw-row bw-${r.status}">
        <td class="bw-num">${i + 1}</td>
        <td class="bw-file" title="${bwEsc(r.fileName)}">${bwEsc(r.fileName.replace(/\.csv$/i, ''))}<small>${bwDateRu(r.periodFrom)} – ${bwDateRu(r.periodTo)}</small></td>
        <td class="bw-net"><b>${bwEsc(r.network)}</b> •••• ${bwEsc(r.last4)}<small>${bwDateRu(r.firstDate)} → ${bwDateRu(r.lastDate)}</small></td>
        ${bwCardCells(r)}
        <td class="bw-money bw-ok">${bwMoney(r.charged, r.cur)}<small>${r.chargedCount ? r.chargedCount + '×' : ''}</small></td>
        <td class="bw-money bw-bad" title="${bwEsc(r.reasons.join('; '))}">${bwMoney(r.declined, r.cur)}<small>${r.declinedCount ? r.declinedCount + '×' : ''}</small></td>
        <td class="bw-money bw-warn">${bwMoney(r.chargedBack, r.cur)}<small>${r.chargedBackCount ? r.chargedBackCount + '×' : ''}</small></td>
        <td class="bw-money" title="${r.fileCardCount > 1 ? 'Расход по всему файлу — в нём несколько карт' : 'Расход кампаний за период файла'}">${bwMoney(r.campaignCost, r.cur)}${r.fileCardCount > 1 ? '<small>файл*</small>' : ''}</td>
        <td>${bwStatusCell(r)}</td></tr>`;
}

function bwHeaderHtml(all, indexReady) {
    const T = bsTotals(all);
    const baseNote = indexReady ? ''
        : `<div class="bw-banner">${BW.indexing ? '⏳ Индексирую общую базу…' : '⚠ Общая база не загружена — загрузите её во вкладке Parser (drag & drop + PARSE), чтобы подтянуть полные данные карт.'}</div>`;
    const files = [...new Set(BW.records.map(r => r.fileName))].map(n =>
        `<span class="bw-fchip">${bwEsc(n.replace(/\.csv$/i, ''))}<button data-bw-del="${bwEsc(n)}" title="Убрать файл">✕</button></span>`).join('');
    return `
    <div class="bw-head">
        <div><h2 class="bw-title">Workspace <span>Billing activity</span></h2>
        <div class="bw-sub">Выписки Google Ads → карты из общей базы + траты за период</div></div>
        <div class="bw-actions">
            <button class="bw-btn bw-btn-primary" id="bw-upload">⬆ Загрузить выписки</button>
            <button class="bw-btn" id="bw-copy-all" ${T.matched ? '' : 'disabled'}>📋 Карты</button>
            <button class="bw-btn" id="bw-export" ${all.length ? '' : 'disabled'}>⬇ CSV</button>
            <button class="bw-btn bw-btn-danger" id="bw-clear" ${all.length ? '' : 'disabled'}>Очистить</button>
            <input type="file" id="bw-file" accept=".csv,.zip" multiple hidden>
        </div>
    </div>
    ${baseNote}
    <div class="bw-stats">
        <div class="bw-stat"><em>Файлов</em><b>${T.files}</b></div>
        <div class="bw-stat"><em>Карт</em><b>${T.cards}</b></div>
        <div class="bw-stat bw-s-ok"><em>Найдено</em><b>${T.matched}</b></div>
        <div class="bw-stat bw-s-pick"><em>Выбрать</em><b>${T.choose}</b></div>
        <div class="bw-stat bw-s-miss"><em>Не найдено</em><b>${T.missing}</b></div>
        <div class="bw-stat bw-s-ok"><em>Списано</em><b>${bwMoneyMap(T.charged)}</b></div>
        <div class="bw-stat bw-s-miss"><em>Отклонено</em><b>${bwMoneyMap(T.declined)}</b></div>
        <div class="bw-stat bw-s-pick"><em>Возвраты</em><b>${bwMoneyMap(T.chargedBack)}</b></div>
        <div class="bw-stat"><em>Кампании</em><b>${bwMoneyMap(T.campaign)}</b></div>
    </div>
    ${files ? `<div class="bw-files">${files}</div>` : ''}`;
}

function bwToolbarHtml() {
    const opt = (v, t) => `<option value="${v}" ${BW.status === v ? 'selected' : ''}>${t}</option>`;
    return `<div class="bw-toolbar">
        <input id="bw-search" class="bw-input" placeholder="Поиск: last4, номер, банк, страна, файл…" value="${bwEsc(BW.search)}">
        <select id="bw-status" class="bw-select bw-select-sm">${opt('all', 'Все')}${opt('matched', 'Найденные')}${opt('choose', 'Нужно выбрать')}${opt('missing', 'Не найденные')}</select>
    </div>`;
}

function bwEmptyHtml() {
    return `<div class="bw-drop" id="bw-drop">
        <div class="bw-drop-ico">🧾</div>
        <div class="bw-drop-t">Перетащите сюда выписки Google Ads</div>
        <div class="bw-drop-s">Billing activity report (.csv) — можно много файлов сразу, либо .zip</div>
    </div>`;
}

function renderBillingWorkspace() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    if (!area) return;
    if (bar) bar.innerHTML = '';

    const indexReady = bwEnsureIndex(renderBillingWorkspace);
    const allRows = bsBuildRows(BW.records, BW.index || new Map(), BW.selections);
    const rows = bwCurrentRows();

    const table = !BW.records.length ? bwEmptyHtml() : `
        ${bwToolbarHtml()}
        <div class="bw-table-wrap"><table class="bw-table"><thead><tr>
            <th>#</th><th>Файл · период</th><th>Карта в выписке</th><th>Полный номер</th><th>Exp</th><th>CVV</th><th>BIN</th><th>Страна</th><th>Банк</th>
            <th>Списано</th><th>Отклонено</th><th>Возвраты</th><th>Кампании</th><th>Статус</th>
        </tr></thead><tbody>${rows.map(bwRowHtml).join('') || '<tr><td colspan="14" class="bw-dim bw-center">Ничего не найдено по фильтру</td></tr>'}</tbody></table></div>`;

    area.innerHTML = `<div class="bw-wrap fade-in">${bwHeaderHtml(allRows, indexReady)}${table}</div>`;
    bwBind(area, rows);
}

function bwBind(area, rows) {
    const fileInput = area.querySelector('#bw-file');
    area.querySelector('#bw-upload')?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', e => { if (e.target.files.length) bwAddFiles(e.target.files); });
    area.querySelector('#bw-clear')?.addEventListener('click', bwClearAll);

    const wrap = area.querySelector('.bw-wrap');
    ['dragover', 'dragenter'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.add('bw-dragging'); }));
    ['dragleave', 'drop'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.remove('bw-dragging'); }));
    wrap.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) bwAddFiles(e.dataTransfer.files); });
    area.querySelector('#bw-drop')?.addEventListener('click', () => fileInput.click());

    area.querySelector('#bw-search')?.addEventListener('input', e => {
        BW.search = e.target.value;
        const pos = e.target.selectionStart;
        renderBillingWorkspace();
        const el = document.getElementById('bw-search');
        if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    });
    area.querySelector('#bw-status')?.addEventListener('change', e => { BW.status = e.target.value; renderBillingWorkspace(); });

    area.querySelectorAll('[data-bw-del]').forEach(b => b.addEventListener('click', () => bwRemoveFile(b.dataset.bwDel)));
    area.querySelectorAll('[data-bw-pick]').forEach(s => s.addEventListener('change', () => {
        const id = s.dataset.bwPick;
        const next = { ...BW.selections };
        if (s.value) next[id] = s.value; else delete next[id];
        BW.selections = next;
        bwPersist();
        renderBillingWorkspace();
    }));
    area.querySelectorAll('[data-bw-copy]').forEach(el => el.addEventListener('click', () => {
        navigator.clipboard && navigator.clipboard.writeText(el.dataset.bwCopy);
        toast('Скопировано: ' + el.dataset.bwCopy, 'success');
    }));

    area.querySelector('#bw-copy-all')?.addEventListener('click', () => {
        const lines = rows.filter(r => r.chosen).map(r => `${r.chosen.cc} ${r.chosen.mm} ${r.chosen.yy} ${r.chosen.cvv}`);
        if (!lines.length) return toast('Нет найденных карт', 'warning');
        navigator.clipboard && navigator.clipboard.writeText(lines.join('\n'));
        toast(`Скопировано карт: ${lines.length}`, 'success');
    });
    area.querySelector('#bw-export')?.addEventListener('click', () => {
        const blob = new Blob(['\uFEFF' + bsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `workspace-billing-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
}
