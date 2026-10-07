/* ═══════════════════════════════════════════════════════════════════
   TRASH + VALID modals (Parser tab).
   Both buttons are enabled only after the main base is loaded AND parsed.
   Same flow for both: drop / pick / paste checker files → summary →
   main button. Parsing is shared (checker-extract.js); all loaded files
   are parsed together, every card gets the status of its NEWEST check and
   duplicate checks collapse into one card:
     TRASH adds ONLY cards whose newest check is dead; a trashed card whose
           newer check is alive is restored (trash dates: ct_trash_dates)
     VALID shows ONLY cards whose newest check is alive and that were not
           trashed after that check
   Uses app.js globals at call time: STATE, PARSER_STATE, BIN_CACHE, save,
   toast, navigate, runParse, extractCardsFromMessages, detectGeo,
   _loadBinDb, _findBankInDb.
   ═══════════════════════════════════════════════════════════════════ */

const VALID_STATE = {
    cards: [],                 // enriched valid cards
    selected: new Set(),       // selected card numbers
    countries: new Set(),      // active country filter
    expanded: new Set(),       // opened BIN groups
    search: '',
    format: 'checker',         // checker | pipe | full (see CK_FORMATS)
    stats: { valid: 0, trash: 0, inTrashBefore: 0, unknown: 0, files: 0 }
};

const ckEmptyPending = () => ({ files: [], chunks: [], records: new Map(), maskedUnmatched: 0, stats: { checks: 0, duplicates: 0 } });

const CK_PENDING = { trash: ckEmptyPending(), valid: ckEmptyPending() };

const CK_TRASH_DATES_KEY = 'ct_trash_dates';

/** cc → ts of the check that put the card into trash (undated legacy cards = oldest). */
function ckTrashDates() {
    try { return JSON.parse(localStorage.getItem(CK_TRASH_DATES_KEY) || '{}') || {}; } catch (e) { return {}; }
}

function ckSaveTrashDates(dates) {
    try { localStorage.setItem(CK_TRASH_DATES_KEY, JSON.stringify(dates)); } catch (e) { console.error('trash dates save:', e); }
}

/** TRASH / VALID work only after the main base is loaded and parsed. */
function ckBaseReady() {
    return (PARSER_STATE.rawMessages || []).length > 0 && Boolean(PARSER_STATE._pipelineStats);
}

function ckOpenModal(kind) {
    if (!ckBaseReady()) {
        toast('Сначала загрузите основную базу (result.json) и нажмите PARSE', 'warning');
        return;
    }
    document.getElementById(`${kind}-cards-overlay`)?.classList.remove('hidden');
}

function ckEsc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

function ckTrashSet() {
    return new Set((STATE.trashCards || []).map(n => String(n).replace(/[\s\-]/g, '')));
}

function ckUpdateTrashButton() {
    const btn = document.getElementById('parser-trash-btn');
    if (btn) btn.textContent = `🗑 TRASH (${(STATE.trashCards || []).length})`;
}

/**
 * Add checker chunks (from a file or clipboard) and re-parse ALL sources of the modal together,
 * so the newest check wins across files and masked AFF cards resolve from any loaded chat.
 */
function ckAddSource(kind, name, chunks, messages) {
    const prev = CK_PENDING[kind];
    const ownCards = ckExtractChunks(chunks).records.size;
    const allChunks = [...prev.chunks, ...chunks];
    const { records, maskedUnmatched, stats } = ckExtractChunks(allChunks);
    CK_PENDING[kind] = {
        files: [...prev.files, { name, messages, cards: ownCards }],
        chunks: allChunks, records, maskedUnmatched, stats
    };
}

function ckResetPending(kind) {
    CK_PENDING[kind] = ckEmptyPending();
}

/** Read File objects (any number) into the pending set, then refresh the summary. */
async function ckReadFiles(kind, files, onDone) {
    for (const file of files) {
        try {
            const raw = await file.text();
            const { chunks, messages } = ckFileToChunks(file.name, raw, file.lastModified);
            ckAddSource(kind, file.name, chunks, messages);
        } catch (err) {
            toast(`${file.name}: не удалось прочитать — ${err.message}`, 'error');
        }
    }
    onDone();
}

/** Drop zone + file picker + Ctrl+V paste for a modal. Bound only once per overlay. */
function ckBindDrop(kind, onChange) {
    const overlay = document.getElementById(`${kind}-cards-overlay`);
    const zone = document.getElementById(`${kind}-smart-drop`);
    const picker = document.getElementById(`${kind}-smart-file`);
    if (!overlay || !zone || !picker) return null;
    if (overlay.dataset.ckBound) return overlay;
    overlay.dataset.ckBound = '1';

    zone.addEventListener('click', () => picker.click());
    zone.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); }
    });
    picker.addEventListener('change', () => {
        const files = [...picker.files];
        picker.value = '';
        if (files.length) ckReadFiles(kind, files, onChange);
    });
    ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('drag-over'); }));
    zone.addEventListener('drop', e => {
        const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
        if (files.length) ckReadFiles(kind, files, onChange);
    });
    overlay.addEventListener('paste', e => {
        const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
        if (!text.trim()) return;
        e.preventDefault();
        ckAddSource(kind, 'Вставленный текст', [{ text, ts: Date.now() }], 0);
        onChange();
    });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
    new MutationObserver(() => {
        if (!overlay.classList.contains('hidden')) zone.focus();
    }).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    return overlay;
}

function ckFileChips(files) {
    return files.map(f => `<span class="ck-file-chip">📄 ${ckEsc(f.name)}${f.messages ? ` · ${f.messages.toLocaleString()} сообщ.` : ''} · ${f.cards} карт</span>`).join('');
}

function ckMaskedWarning(pending) {
    if (!pending.maskedUnmatched) return '';
    return `<div class="ck-sum-warn">⚠ ${pending.maskedUnmatched} маскированных карт (AFFChecker) не найдено ни в чате, ни в базе — пропущены</div>`;
}

/** "checks → unique cards, duplicates removed" line. */
function ckDedupeLine(pending) {
    const { checks, duplicates } = pending.stats || { checks: 0, duplicates: 0 };
    return `<span>🔁 проверок: ${checks} · дублей убрано: ${duplicates} · статус по последней дате</span>`;
}

/* ────────────────────────── TRASH ────────────────────────── */

/** Trash plan for the pending records (add / restore / dates). */
function ckTrashNumbers() {
    const plan = ckTrashPlan([...CK_PENDING.trash.records.values()], STATE.trashCards || [], ckTrashDates());
    const found = plan.add.length + plan.already;
    return { ...plan, found, fresh: plan.add };
}

function ckRenderTrashSummary() {
    const box = document.getElementById('trash-summary');
    const btn = document.getElementById('trash-cards-save');
    const pending = CK_PENDING.trash;
    if (!box) return;
    if (pending.files.length === 0) {
        box.innerHTML = '<span class="ck-summary-empty">Файлы ещё не загружены</span>';
        if (btn) btn.disabled = true;
        return;
    }
    const counts = ckCounts(pending.records);
    const { found, fresh, already, restore } = ckTrashNumbers();
    box.innerHTML = `
        <div class="ck-file-chips">${ckFileChips(pending.files)}</div>
        <div class="ck-sum-row">
            <span class="ck-sum-big ck-c-red">💀 ${found}</span><span class="ck-sum-lbl">trash (последняя проверка — dead)</span>
            <span class="ck-sum-pill ck-c-red">новых: ${fresh.length}</span>
            <span class="ck-sum-pill">уже в корзине: ${already}</span>
            ${restore.length ? `<span class="ck-sum-pill ck-c-green">♻ вернуть из корзины: ${restore.length}</span>` : ''}
        </div>
        <div class="ck-sum-row ck-sum-dim">
            <span>✅ живые пропущены: ${counts.valid}</span>
            <span>❔ без статуса (не трогаем): ${counts.unknown}</span>
        </div>
        <div class="ck-sum-row ck-sum-dim">${ckDedupeLine(pending)}</div>
        ${restore.length ? `<div class="ck-sum-row ck-sum-dim"><span>♻ ${restore.length} карт уже в корзине, но более новая проверка — живая: они будут убраны из корзины</span></div>` : ''}
        ${ckMaskedWarning(pending)}`;
    const changes = fresh.length + restore.length;
    if (btn) {
        btn.disabled = changes === 0;
        btn.textContent = fresh.length ? `🗑 ADD TO TRASH (${fresh.length})` : (restore.length ? `♻ UPDATE TRASH (${restore.length})` : '🗑 ADD TO TRASH');
    }
}

function _initTrashCardModal() {
    const overlay = ckBindDrop('trash', ckRenderTrashSummary);
    if (!overlay || overlay.dataset.ckButtons) return;
    overlay.dataset.ckButtons = '1';

    const close = () => { ckResetPending('trash'); ckRenderTrashSummary(); overlay.classList.add('hidden'); };
    document.getElementById('trash-cards-close')?.addEventListener('click', close);
    document.getElementById('trash-cards-cancel')?.addEventListener('click', close);

    document.getElementById('trash-cards-save')?.addEventListener('click', () => {
        const { fresh, already, restore, dates } = ckTrashNumbers();
        if (fresh.length === 0 && restore.length === 0) { toast('Новых trash-карт нет', 'info'); return; }
        const restoreSet = new Set(restore);
        const oldDates = ckTrashDates();
        const keptDates = Object.fromEntries(Object.entries(oldDates).filter(([cc]) => !restoreSet.has(cc)));
        STATE.trashCards = [...(STATE.trashCards || []).filter(n => !restoreSet.has(String(n).replace(/\D/g, ''))), ...fresh];
        ckSaveTrashDates({ ...keptDates, ...dates });
        save();
        ckUpdateTrashButton();
        const parts = [`+${fresh.length} trash`];
        if (already) parts.push(`${already} уже были`);
        if (restore.length) parts.push(`♻ ${restore.length} возвращено`);
        toast(`${parts.join(', ')} (всего ${STATE.trashCards.length})`, 'success');
        close();
        if ((PARSER_STATE.rawMessages || []).length > 0) runParse();
    });

    document.getElementById('trash-clear-all')?.addEventListener('click', () => {
        const count = (STATE.trashCards || []).length;
        if (count === 0) { toast('Trash is already empty', 'info'); return; }
        if (!confirm(`Clear all ${count} trash cards?`)) return;
        STATE.trashCards = [];
        ckSaveTrashDates({});
        save();
        ckUpdateTrashButton();
        ckRenderTrashSummary();
        toast(`Trash cleared (${count} cards removed)`, 'success');
    });

    document.getElementById('trash-show-list')?.addEventListener('click', () => {
        const cards = STATE.trashCards || [];
        if (cards.length === 0) { toast('Trash is empty', 'info'); return; }
        ckPushNote(`Trash List (${cards.length})`, cards.join('\n'), 'Trash');
        close();
        document.querySelector('[data-view="notes"]')?.click();
    });
}

/* ────────────────────────── VALID ────────────────────────── */

/** Newest check alive AND not trashed after that check. */
function ckValidRecords() {
    const trashNow = ckTrashSet();
    const dates = ckTrashDates();
    const valid = [];
    let inTrashBefore = 0;
    CK_PENDING.valid.records.forEach(r => {
        if (ckStatus(r) !== 'valid') return;
        if (!ckIsValidNow(r, trashNow, dates)) { inTrashBefore++; return; }
        valid.push(r);
    });
    return { valid, inTrashBefore };
}

function ckRenderValidSummary() {
    const box = document.getElementById('valid-summary');
    const btn = document.getElementById('valid-cards-process');
    const pending = CK_PENDING.valid;
    if (!box) return;
    if (pending.files.length === 0) {
        box.innerHTML = '<span class="ck-summary-empty">Файлы ещё не загружены</span>';
        if (btn) btn.disabled = true;
        return;
    }
    const counts = ckCounts(pending.records);
    const { valid, inTrashBefore } = ckValidRecords();
    box.innerHTML = `
        <div class="ck-file-chips">${ckFileChips(pending.files)}</div>
        <div class="ck-sum-row">
            <span class="ck-sum-big ck-c-green">✅ ${valid.length}</span><span class="ck-sum-lbl">валидных карт</span>
            <span class="ck-sum-pill">BIN: ${new Set(valid.map(v => v.cc.slice(0, 6))).size}</span>
        </div>
        <div class="ck-sum-row ck-sum-dim">
            <span>💀 последняя проверка dead: ${counts.trash}</span>
            <span>🗑 в корзине позже проверки: ${inTrashBefore}</span>
            <span>❔ без статуса: ${counts.unknown}</span>
        </div>
        <div class="ck-sum-row ck-sum-dim">${ckDedupeLine(pending)}</div>
        ${ckMaskedWarning(pending)}`;
    if (btn) {
        btn.disabled = valid.length === 0;
        btn.textContent = valid.length ? `✅ SHOW VALID CARDS (${valid.length})` : '✅ SHOW VALID CARDS';
    }
}

function _initValidCardsModal() {
    const overlay = ckBindDrop('valid', ckRenderValidSummary);
    if (!overlay || overlay.dataset.ckButtons) return;
    overlay.dataset.ckButtons = '1';

    const hide = () => overlay.classList.add('hidden');
    document.getElementById('valid-cards-close')?.addEventListener('click', hide);
    document.getElementById('valid-cards-cancel')?.addEventListener('click', hide);
    document.getElementById('valid-reset')?.addEventListener('click', () => { ckResetPending('valid'); ckRenderValidSummary(); });
    document.getElementById('valid-cards-process')?.addEventListener('click', () => {
        const counts = ckCounts(CK_PENDING.valid.records);
        const { valid, inTrashBefore } = ckValidRecords();
        if (valid.length === 0) { toast('Валидных карт не найдено', 'warning'); return; }
        ckShowValid(valid, {
            valid: valid.length, trash: counts.trash, inTrashBefore,
            unknown: counts.unknown, files: CK_PENDING.valid.files.length
        });
        hide();
    });
}

/** Build VALID_STATE from valid records and open the results page. */
function ckShowValid(records, stats) {
    const base = typeof extractCardsFromMessages === 'function' ? extractCardsFromMessages(PARSER_STATE.rawMessages || []) : [];
    VALID_STATE.cards = ckEnrich(records, base);
    VALID_STATE.selected = new Set();
    VALID_STATE.countries = new Set();
    VALID_STATE.expanded = new Set();
    VALID_STATE.search = '';
    VALID_STATE.stats = stats;
    navigate('new-cards');
    renderValidCardsResults();
    toast(`✅ ${records.length} валидных карт`, 'success');
}

/* ────────────────────────── ENRICH ────────────────────────── */

/** Most frequent value per BIN across the base (bank / card type). */
function ckTallyByBin(baseCards, pick) {
    const counts = new Map();
    baseCards.forEach(p => {
        const value = pick(p);
        if (!value || /^unknown/i.test(value)) return;
        const bin = String(p.cc || '').replace(/\s/g, '').slice(0, 6);
        const perBin = counts.get(bin) || new Map();
        perBin.set(value, (perBin.get(value) || 0) + 1);
        counts.set(bin, perBin);
    });
    const best = new Map();
    counts.forEach((perBin, bin) => best.set(bin, [...perBin.entries()].sort((a, b) => b[1] - a[1])[0][0]));
    return best;
}

/**
 * Valid records + common base → NEW card objects with name, type, bank, country.
 * Priority: loaded result.json card → same BIN in result.json → workspace → BIN cache / BIN database → checker lines.
 */
function ckEnrich(records, baseCards) {
    const byCc = new Map();
    baseCards.forEach(p => {
        const cc = String(p.cc || '').replace(/\s/g, '');
        if (cc && !byCc.has(cc)) byCc.set(cc, p);
    });
    const wsByCc = new Map((STATE.cards || []).map(w => [String(w.cardNumber || '').replace(/\s/g, ''), w]));
    const bankByBin = ckTallyByBin(baseCards, p => p.bank);
    const typeByBin = ckTallyByBin(baseCards, p => p.cardType);
    const binDb = typeof _loadBinDb === 'function' ? _loadBinDb() : {};

    return records.map(r => {
        const bin = r.cc.slice(0, 6);
        const p = byCc.get(r.cc);
        const ws = wsByCc.get(r.cc);
        const cache = BIN_CACHE[bin] && !BIN_CACHE[bin].error ? BIN_CACHE[bin] : null;

        const name = ((p && p.name) || (ws && ws.name) || '').trim();
        const surname = ((p && p.surname) || (ws && ws.surname) || '').trim();
        let bank = (p && p.bank) || bankByBin.get(bin) || (cache && cache.bank) || '';
        if (!bank && typeof _findBankInDb === 'function') bank = _findBankInDb(binDb, bin) || '';
        const cardType = (p && p.cardType) || typeByBin.get(bin)
            || (cache && [cache.level, cache.type, cache.brand].filter(Boolean).join(' '))
            || [r.level, r.type, r.system].filter(Boolean).join(' ')
            || (ws && ws.cardType) || '';
        const baseGeo = p && typeof detectGeo === 'function' ? detectGeo(p.billing, p.country, p.countryCode, p.bankCountryCode) : '';
        const geo = String(r.geo || baseGeo || (ws && ws.country) || '').toUpperCase().slice(0, 2) || '??';

        return {
            cc: r.cc, mm: r.mm || (p && p.mm) || '', yy: r.yy || (p && p.yy) || '', cvv: r.cvv || (p && p.cvv) || '',
            bin, name, surname, holder: `${name} ${surname}`.trim(),
            bank, cardType, geo, inBase: Boolean(p || ws)
        };
    });
}

/** Create a Notes tab (newest first). */
function ckPushNote(title, content, source) {
    const tab = {
        id: 'tab-' + source.toLowerCase().replace(/\W+/g, '-') + '-' + Date.now(),
        title, content,
        pinned: false, tag: null,
        created: Date.now(), scrollPos: 0,
        exportSource: source,
        exportedAt: new Date().toISOString()
    };
    STATE.notesTabs = [tab, ...(STATE.notesTabs || [])];
    STATE.notesActiveTab = tab.id;
    save();
    toast(`📝 "${title}" → Notes`, 'success');
}
