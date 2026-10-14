/* ═══════════════════════════════════════════════════════════════════
   BILLING WORKSPACE — the Workspace tab.
   Holds the billing rows the user moved here from Find Billings
   (Parser → FIND BILLINGS → Parse & Match → Add selected to Workspace).
   Compact table (billing-table.js): Date · BIN · Country · Bank · Charged ·
   Status, details on row click, date range filter, sort by date / sum.
   Pure logic lives in billing-statement.js (bs*). This file = UI only.
   ═══════════════════════════════════════════════════════════════════ */

const BW_KEY_RECORDS = 'ct_bw_records';
const BW_KEY_SELECT = 'ct_bw_selections';

const BW = {
    records: bwLoad(BW_KEY_RECORDS, []),
    selections: bwLoad(BW_KEY_SELECT, {}),
    view: btDefaultView()
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
        if (typeof toast === 'function') toast('Could not save Workspace (localStorage is full)', 'error');
    }
}

/**
 * Workspace row. Rows added from Find Billings carry a frozen `card` snapshot;
 * legacy records (saved before snapshots) are matched live when the bases are loaded.
 */
function bwRowOf(rec, ctx) {
    if (rec.card !== undefined) return { ...rec, chosen: rec.card };
    if (ctx) return bsMatchRecord(rec, ctx, BW.selections);
    return { ...rec, chosen: null, candidates: [], status: 'missing', inWork: false };
}

function bwAllRows() {
    const legacy = BW.records.some(r => r.card === undefined);
    const ctx = legacy && typeof fbEnsureContext === 'function' ? fbEnsureContext(renderBillingWorkspace) : null;
    return BW.records.map(r => bwRowOf(r, ctx));
}

/* ───────────────────────── FILES (shared with Find Billings) ───────────────────────── */

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

/* ───────────────────────── ACTIONS ───────────────────────── */

function bwSetRecords(records) {
    BW.records = records;
    const keep = new Set(records.map(r => r.id));
    BW.selections = Object.fromEntries(Object.entries(BW.selections).filter(([id]) => keep.has(id)));
    BW.view = { ...BW.view, checked: new Set([...BW.view.checked].filter(id => keep.has(id))) };
    bwPersist();
    renderBillingWorkspace();
}

function bwRemoveSelected() {
    const n = BW.view.checked.size;
    if (!n || !confirm(`Remove ${n} selected row${n > 1 ? 's' : ''} from Workspace?`)) return;
    bwSetRecords(BW.records.filter(r => !BW.view.checked.has(r.id)));
}

function bwClearAll() {
    if (!BW.records.length || !confirm('Clear the whole Workspace?')) return;
    bwSetRecords([]);
}

/* ───────────────────────── RENDER ───────────────────────── */

function bwEmptyHtml() {
    return `<div class="bw-drop" id="bw-find">
        <div class="bw-drop-ico">🧾</div>
        <div class="bw-drop-t">Workspace is empty</div>
        <div class="bw-drop-s">Open <b>Find Billings</b>, upload statements, Parse &amp; Match, tick rows → Add selected to Workspace</div>
    </div>`;
}

function renderBillingWorkspace() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    if (!area) return;
    if (bar) bar.innerHTML = '';

    const entering = !area.querySelector('[data-screen="workspace"]');
    const prepared = btPrepare(bwAllRows(), BW.view);
    const n = BW.view.checked.size;
    const body = !BW.records.length ? bwEmptyHtml() : `
        ${btStatsHtml(prepared)}
        ${btToolbarHtml(BW.view)}
        ${btTableHtml(prepared, BW.view, true)}`;

    area.innerHTML = `<div class="bw-wrap ${entering ? 'bt-enter' : ''}" data-screen="workspace">
        <div class="bw-head">
            <div><h2 class="bw-title">Workspace <span>Billing activity</span></h2>
            <div class="bw-sub">Cards moved from Find Billings · click a row for full card data</div></div>
            <div class="bw-actions">
                <button class="bw-btn bw-btn-primary" id="bw-upload">⬆ Upload statements</button>
                <button class="bw-btn bw-btn-danger" id="bw-remove" ${n ? '' : 'disabled'}>Remove selected${n ? ` (${n})` : ''}</button>
                <button class="bw-btn bw-btn-danger" id="bw-clear" ${BW.records.length ? '' : 'disabled'}>Clear</button>
            </div>
        </div>
        ${body}
    </div>`;
    bwBind(area, prepared);
}

function bwBind(area, prepared) {
    const goFind = () => (typeof fbOpen === 'function' ? fbOpen() : null);
    area.querySelector('#bw-upload')?.addEventListener('click', goFind);
    area.querySelector('#bw-find')?.addEventListener('click', goFind);
    area.querySelector('#bw-remove')?.addEventListener('click', bwRemoveSelected);
    area.querySelector('#bw-clear')?.addEventListener('click', bwClearAll);
    btBind(area, BW.view, prepared, {
        setView: patch => { BW.view = { ...BW.view, ...patch }; renderBillingWorkspace(); },
        pick: (id, cc) => {
            const next = { ...BW.selections };
            if (cc) next[id] = cc; else delete next[id];
            BW.selections = next;
            bwPersist();
            renderBillingWorkspace();
        }
    });
}
