/* ═══════════════════════════════════════════════════════════════════
   FIND BILLINGS — screen inside the Parser tab.
   Upload Google Ads billing CSV/ZIP → Parse & Match:
     1) last4 + network → "Compare with old base" (cards really used on Ads)
     2) BIN / Country / Bank → main base (LOAD & PARSE) by full number
   Results stay on this screen; the user ticks rows and adds them to the
   Workspace manually. Pure logic: billing-statement.js, table: billing-table.js.
   ═══════════════════════════════════════════════════════════════════ */

const FB = {
    open: false,
    records: [],      // staged statement records (bsSummarize)
    selections: {},   // record id → chosen full number ("choose" rows)
    rows: null,       // match result, null = not parsed yet
    matching: false,
    view: btDefaultView(),
    lastAdded: 0
};

const FB_CTX = { ctx: null, key: '', building: false, waiters: [] };

function fbEsc(s) { return btEsc(s); }

function fbParser() {
    return typeof PARSER_STATE !== 'undefined' ? PARSER_STATE : { rawMessages: [], _compareSet: null, compareFile: null };
}

function fbCtxKey() {
    const P = fbParser();
    return `${(P.rawMessages || []).length}|${P._compareSet ? P._compareSet.size : 0}|${P.compareFile ? P.compareFile.name : ''}`;
}

function fbBuildContextNow() {
    const P = fbParser();
    const raw = P.rawMessages || [];
    const main = raw.length ? extractCardsFromMessages(raw).map(c => ({
        ...c, detectedGeo: detectGeo(c.billing, c.country, c.countryCode, c.bankCountryCode, c.bank)
    })) : [];
    return bsMatchContext(main, P._compareSet || null);
}

/** Matching context (cached by base sizes). Returns it, or null and calls onReady when built. */
function fbEnsureContext(onReady) {
    const key = fbCtxKey();
    if (FB_CTX.ctx && FB_CTX.key === key) return FB_CTX.ctx;
    if (onReady) FB_CTX.waiters = [...FB_CTX.waiters, onReady];
    if (FB_CTX.building) return null;
    FB_CTX.building = true;
    setTimeout(() => {
        try {
            FB_CTX.ctx = fbBuildContextNow();
            FB_CTX.key = key;
        } catch (e) {
            console.error('Billing match context failed', e);
            FB_CTX.ctx = null;
            if (typeof toast === 'function') toast('Could not index the bases: ' + e.message, 'error');
        }
        FB_CTX.building = false;
        const waiters = FB_CTX.waiters;
        FB_CTX.waiters = [];
        waiters.forEach(fn => fn());
    }, 30);
    return null;
}

/* ───────────────────────── ACTIONS ───────────────────────── */

function fbRematch() {
    if (!FB_CTX.ctx) return;
    FB.rows = FB.records.map(r => bsMatchRecord(r, FB_CTX.ctx, FB.selections));
}

async function fbAddFiles(fileList) {
    try {
        const items = await bwReadFiles(fileList);
        if (!items.length) return toast('Billing activity report CSV (or ZIP) files are required', 'warning');
        let added = 0, skipped = 0, records = FB.records;
        for (const it of items) {
            const recs = bsSummarize(bsParseStatement(it.text, it.name));
            if (!recs.length) { skipped++; continue; }
            records = bsMergeRecords(records, recs);
            added += recs.length;
        }
        FB.records = records;
        FB.rows = null;
        toast(`Loaded ${added} cards from ${items.length - skipped} files${skipped ? `, ${skipped} skipped (no card payments)` : ''} — press Parse & Match`, added ? 'success' : 'warning');
    } catch (e) {
        console.error(e);
        toast('Could not read the files: ' + e.message, 'error');
    }
    renderFindBillings();
}

function fbRemoveFile(name) {
    FB.records = FB.records.filter(r => r.fileName !== name);
    const keep = new Set(FB.records.map(r => r.id));
    FB.selections = Object.fromEntries(Object.entries(FB.selections).filter(([id]) => keep.has(id)));
    FB.view = { ...FB.view, checked: new Set([...FB.view.checked].filter(id => keep.has(id))) };
    FB.rows = FB.rows ? FB.rows.filter(r => keep.has(r.id)) : null;
    renderFindBillings();
}

function fbClear() {
    FB.records = [];
    FB.selections = {};
    FB.rows = null;
    FB.lastAdded = 0;
    FB.view = btDefaultView();
    renderFindBillings();
}

function fbParse() {
    if (!FB.records.length) return toast('Upload billing statements first', 'warning');
    const P = fbParser();
    if (!(P.rawMessages || []).length && !(P._compareSet && P._compareSet.size)) {
        return toast('Load the main base and / or Compare with old base in the Parser first', 'warning');
    }
    FB.matching = true;
    renderFindBillings();
    const done = () => {
        FB.matching = false;
        fbRematch();
        if (FB.rows) {
            const found = FB.rows.filter(r => r.status === 'matched').length;
            toast(`Matched ${found} of ${FB.rows.length} cards`, 'success');
        }
        renderFindBillings();
    };
    if (fbEnsureContext(done)) done();
}

function fbAddSelected(rows) {
    const picked = rows.filter(r => FB.view.checked.has(r.id));
    const ready = picked.filter(r => r.status !== 'choose');
    const pending = picked.length - ready.length;
    if (!ready.length) return toast(pending ? 'Choose a card for the selected "choose" rows first' : 'Tick the rows to add', 'warning');
    const full = new Map((FB.rows || []).map(r => [r.id, r]));
    const snaps = ready.map(r => bsSnapshot(full.get(r.id) || r));
    BW.records = bsUpsertById(BW.records, snaps);
    bwPersist();
    FB.lastAdded = snaps.length;
    FB.view = { ...FB.view, checked: new Set() };
    toast(`Added to Workspace: ${snaps.length}${pending ? ` · ${pending} skipped (choose a card first)` : ''}`, pending ? 'warning' : 'success');
    renderFindBillings();
}

function fbOpenWorkspace() {
    document.querySelector('.tn-tab[data-view="all-cards"]')?.click();
}

function fbClose() {
    FB.open = false;
    renderParser();
}

/** Open the screen (from the Parser button or from the Workspace tab). */
function fbOpen() {
    FB.open = true;
    if (typeof STATE !== 'undefined' && STATE.currentView !== 'new-cards') {
        document.querySelector('.tn-tab[data-view="new-cards"]')?.click();
        return;
    }
    renderFindBillings();
}

/* ───────────────────────── RENDER ───────────────────────── */

function fbBasesHtml() {
    const P = fbParser();
    const mainN = (P.rawMessages || []).length;
    const work = P.compareFile;
    const mainChip = mainN
        ? `<span class="fb-base ok" title="LOAD & PARSE — source of BIN, country, bank">● Main base <b>${mainN.toLocaleString('en-US')}</b> msgs</span>`
        : '<span class="fb-base miss" title="Load it in the Parser (drag & drop the base)">○ Main base not loaded</span>';
    const workChip = work
        ? `<span class="fb-base ok" title="Compare with old base — cards really used on Google Ads">● Work base <b>${fbEsc(work.name)}</b> · ${Number(work.cardCount || 0).toLocaleString('en-US')} cards</span>`
        : '<span class="fb-base warn" title="Compare with old base — cards really used on Google Ads">○ Work base not loaded</span>';
    const loadWork = `<button class="bw-btn fb-mini" id="fb-load-work">${work ? '↻ Replace work base' : '＋ Load work base'}</button>
        <input type="file" id="fb-work-file" accept=".json" hidden>`;
    const stale = FB.rows && FB_CTX.key && FB_CTX.key !== fbCtxKey()
        ? '<div class="bw-banner">Bases changed since the last match — press <b>Parse &amp; Match</b> again.</div>' : '';
    const noWork = !work ? '<div class="bw-banner">Work base (Compare with old base) is not loaded — cards will be matched against the main base only and marked <b>main base only</b>.</div>' : '';
    return `<div class="fb-bases">${mainChip}${workChip}${loadWork}</div>${stale}${noWork}`;
}

function fbUploadHtml() {
    const files = [...new Set(FB.records.map(r => r.fileName))];
    const chips = files.map(n => `<span class="bw-fchip">${fbEsc(n.replace(/\.csv$/i, ''))}<button data-fb-del="${fbEsc(n)}" title="Remove file">✕</button></span>`).join('');
    return `<div class="fb-upload">
        <div class="bw-drop fb-drop" id="fb-drop">
            <div class="bw-drop-ico">🧾</div>
            <div class="bw-drop-t">${files.length ? `${files.length} statement${files.length > 1 ? 's' : ''} · ${FB.records.length} cards loaded` : 'Drop Google Ads billing statements here'}</div>
            <div class="bw-drop-s">Billing activity report (.csv) — many files at once, or a .zip · click to browse</div>
        </div>
        <input type="file" id="fb-file" accept=".csv,.zip" multiple hidden>
        ${chips ? `<div class="bw-files">${chips}</div>` : ''}
        <div class="fb-actions">
            <button class="bw-btn bw-btn-primary fb-parse" id="fb-parse" ${FB.records.length && !FB.matching ? '' : 'disabled'}>${FB.matching ? '⏳ Matching…' : '⚡ Parse &amp; Match'}</button>
            <button class="bw-btn bw-btn-danger" id="fb-clear" ${FB.records.length ? '' : 'disabled'}>Clear</button>
        </div>
    </div>`;
}

function fbResultsHtml(prepared) {
    if (FB.matching) return '<div class="fb-wait">⏳ Matching: Compare with old base → main base…</div>';
    if (!FB.rows) return FB.records.length ? '<div class="fb-wait">Press <b>Parse &amp; Match</b> to see the results.</div>' : '';
    const n = prepared.filter(r => FB.view.checked.has(r.id)).length;
    const added = FB.lastAdded
        ? `<span class="fb-added">✓ ${FB.lastAdded} added <button class="bt-link" id="fb-open-ws">Open Workspace →</button></span>` : '';
    return `<div class="fb-results">
        ${btStatsHtml(prepared)}
        ${btToolbarHtml(FB.view)}
        <div class="fb-addbar">
            <span class="fb-hint">Click a row for details · tick rows to move them</span>
            ${added}
            <button class="bw-btn bw-btn-primary" id="fb-add" ${n ? '' : 'disabled'}>➕ Add selected to Workspace${n ? ` (${n})` : ''}</button>
        </div>
        ${btTableHtml(prepared, FB.view, true)}
    </div>`;
}

function renderFindBillings() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    if (!area) return;
    if (bar) bar.innerHTML = '';
    const prepared = FB.rows && !FB.matching ? btPrepare(FB.rows, FB.view) : [];
    area.innerHTML = `<div class="bw-wrap fb-wrap fade-in">
        <div class="bw-head">
            <div><button class="bt-link fb-back" id="fb-back">← Back to Parser</button>
            <h2 class="bw-title">Find Billings <span>statements → work base → main base</span></h2>
            <div class="bw-sub">1) last 4 + network are checked in <b>Compare with old base</b> · 2) BIN, country, bank come from the <b>main base</b></div></div>
        </div>
        ${fbBasesHtml()}
        ${fbUploadHtml()}
        ${fbResultsHtml(prepared)}
    </div>`;
    fbBind(area, prepared);
}

function fbBind(area, prepared) {
    const wrap = area.querySelector('.fb-wrap');
    const fileInput = area.querySelector('#fb-file');
    area.querySelector('#fb-back')?.addEventListener('click', fbClose);
    area.querySelector('#fb-drop')?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', e => { if (e.target.files.length) fbAddFiles(e.target.files); });
    ['dragover', 'dragenter'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.add('bw-dragging'); }));
    ['dragleave', 'drop'].forEach(ev => wrap.addEventListener(ev, e => { e.preventDefault(); wrap.classList.remove('bw-dragging'); }));
    wrap.addEventListener('drop', e => { e.stopPropagation(); if (e.dataTransfer && e.dataTransfer.files.length) fbAddFiles(e.dataTransfer.files); });

    const workInput = area.querySelector('#fb-work-file');
    area.querySelector('#fb-load-work')?.addEventListener('click', () => workInput.click());
    workInput?.addEventListener('change', e => { if (e.target.files[0] && typeof _loadCompareFile === 'function') _loadCompareFile(e.target.files[0]); });

    area.querySelectorAll('[data-fb-del]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); fbRemoveFile(b.dataset.fbDel); }));
    area.querySelector('#fb-clear')?.addEventListener('click', fbClear);
    area.querySelector('#fb-parse')?.addEventListener('click', fbParse);
    area.querySelector('#fb-add')?.addEventListener('click', () => fbAddSelected(prepared));
    area.querySelector('#fb-open-ws')?.addEventListener('click', fbOpenWorkspace);

    const results = area.querySelector('.fb-results');
    if (!results) return;
    btBind(results, FB.view, prepared, {
        setView: patch => { FB.view = { ...FB.view, ...patch }; renderFindBillings(); },
        pick: (id, cc) => {
            const next = { ...FB.selections };
            if (cc) next[id] = cc; else delete next[id];
            FB.selections = next;
            fbRematch();
            renderFindBillings();
        }
    });
}
