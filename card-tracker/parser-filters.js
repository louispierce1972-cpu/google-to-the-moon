/* ═══════════════════════════════════════════════════════════════════
   PARSER FILTERS — pure logic + small UI for the Parser tab.
     • Include / Exclude lists for BIN, Country, Bank
       (a token may live in only one of the two lists of a field)
     • "Parse all" switch (no filters) and "No prepaid" switch
     • PERIOD: parse only messages inside a date range (by Telegram
       message date): all / today / 7d / 30d / 3m / 6m / custom
   Pure functions (pf*) never mutate their input. UI helpers read app.js
   globals (PARSER_STATE, toast) at call time.
   ═══════════════════════════════════════════════════════════════════ */

/* ────────────────────────── LIST PARSING ────────────────────────── */

function pfSplit(raw) {
    return String(raw || '').split(/[,;\n|]+/).map(s => s.trim()).filter(Boolean);
}

/** "450003, 424242 5326" → ['450003','424242','5326'] (4–6 digit prefixes). */
function pfBins(raw) {
    return String(raw || '').split(/[\s,;|]+/).map(b => b.replace(/\D/g, '').slice(0, 6)).filter(b => b.length >= 4);
}

function pfCountries(raw) {
    return String(raw || '').split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
}

function pfBanks(raw) {
    return pfSplit(raw).map(s => s.toLowerCase());
}

/* ────────────────────────── CONFLICTS ────────────────────────── */

/** Tokens present in BOTH lists. BINs overlap by prefix (4524 vs 452401); others by equality. */
function pfConflicts(include, exclude, kind) {
    const out = [];
    include.forEach(i => {
        exclude.forEach(e => {
            const hit = kind === 'bin' ? (i.startsWith(e) || e.startsWith(i)) : i === e;
            if (hit && !out.includes(i === e ? i : `${i}/${e}`)) out.push(i === e ? i : `${i}/${e}`);
        });
    });
    return out;
}

/** All conflicts of the filter config → { bin:[], country:[], bank:[], total } */
function pfAllConflicts(cfg) {
    const bin = pfConflicts(cfg.binsIn, cfg.binsEx, 'bin');
    const country = pfConflicts(cfg.countriesIn, cfg.countriesEx, 'country');
    const bank = pfConflicts(cfg.banksIn, cfg.banksEx, 'bank');
    return { bin, country, bank, total: bin.length + country.length + bank.length };
}

/* ────────────────────────── APPLY LISTS ────────────────────────── */

const PF_PREPAID_RE = /prepaid/i;

/**
 * Include / Exclude lists + optional "no prepaid".
 * Order: excludes (bin → country → bank → prepaid), then includes (bin → country → bank).
 * cfg: { binsIn, binsEx, countriesIn, countriesEx, banksIn, banksEx, excludePrepaid,
 *        geoOf(card) → 'US', typeText(card) → 'DEBIT PREPAID …' }
 * Cards with unknown geo / bank / type are never removed by an EXCLUDE rule.
 * → { cards, removed: { binEx, countryEx, bankEx, prepaid, binIn, countryIn, bankIn } }
 */
function pfApplyLists(cards, cfg) {
    const removed = { binEx: 0, countryEx: 0, bankEx: 0, prepaid: 0, binIn: 0, countryIn: 0, bankIn: 0 };
    const geoOf = cfg.geoOf || (c => String(c.detectedGeo || '').toUpperCase());
    const typeText = cfg.typeText || (c => String(c.cardType || ''));
    const geoHit = (geo, codes) => Boolean(geo) && codes.some(code => geo === code || geo.startsWith(code));
    const bankHit = (card, list) => { const b = String(card.bank || '').toLowerCase(); return Boolean(b) && list.some(x => b.includes(x)); };
    const binHit = (card, list) => list.some(p => String(card.bin || '').startsWith(p));

    const rules = [
        ['binEx', cfg.binsEx.length > 0, c => !binHit(c, cfg.binsEx)],
        ['countryEx', cfg.countriesEx.length > 0, c => !geoHit(geoOf(c), cfg.countriesEx)],
        ['bankEx', cfg.banksEx.length > 0, c => !bankHit(c, cfg.banksEx)],
        ['prepaid', Boolean(cfg.excludePrepaid), c => !PF_PREPAID_RE.test(typeText(c))],
        ['binIn', cfg.binsIn.length > 0, c => binHit(c, cfg.binsIn)],
        ['countryIn', cfg.countriesIn.length > 0, c => geoHit(geoOf(c), cfg.countriesIn)],
        ['bankIn', cfg.banksIn.length > 0, c => bankHit(c, cfg.banksIn)]
    ];
    const result = rules.reduce((list, [key, active, keep]) => {
        if (!active) return list;
        const next = list.filter(keep);
        removed[key] = list.length - next.length;
        return next;
    }, cards);
    return { cards: result, removed };
}

/* ────────────────────────── DATES / PERIOD ────────────────────────── */

/** 'YYYY-MM-DD' of a Telegram message ('' when it has no date). */
function pfDay(msg) {
    const d = msg && msg.date;
    return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : '';
}

/** First / last message day of the base + counts. */
function pfBaseRange(messages) {
    let min = '', max = '', dated = 0;
    for (let i = 0; i < messages.length; i++) {
        const day = pfDay(messages[i]);
        if (!day) continue;
        dated++;
        if (!min || day < min) min = day;
        if (!max || day > max) max = day;
    }
    return { min, max, total: messages.length, dated };
}

function pfToUtc(day) {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
}

function pfFromUtc(ms) {
    return new Date(ms).toISOString().slice(0, 10);
}

function pfAddDays(day, n) {
    return pfFromUtc(pfToUtc(day) + n * 86400000);
}

/** Same day-of-month N months earlier (clamped: 31 May − 3m → 29/28 Feb style). */
function pfAddMonths(day, n) {
    const [y, m, d] = day.split('-').map(Number);
    const target = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    return pfFromUtc(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last)));
}

/** Local calendar day of "now" as YYYY-MM-DD. */
function pfToday(now) {
    const t = now || new Date();
    const p = n => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

/**
 * Quick periods. Relative ones end on the LAST day of the base (so an old export still works);
 * "today" is the computer's today.  → { from, to } ('' / '' = whole base)
 */
function pfPreset(key, range, today) {
    const end = range.max;
    switch (key) {
        case 'today': return { from: today, to: today };
        case '7d': return { from: pfAddDays(end, -6), to: end };
        case '30d': return { from: pfAddDays(end, -29), to: end };
        case '3m': return { from: pfAddMonths(end, -3), to: end };
        case '6m': return { from: pfAddMonths(end, -6), to: end };
        default: return { from: '', to: '' };
    }
}

function pfInPeriodDay(day, from, to) {
    if (!day) return false;
    return (!from || day >= from) && (!to || day <= to);
}

/** Messages inside [from, to] (inclusive). No bounds → the same array. */
function pfFilterByPeriod(messages, from, to) {
    if (!from && !to) return messages;
    return messages.filter(m => pfInPeriodDay(pfDay(m), from, to));
}

function pfCountInPeriod(messages, from, to) {
    if (!from && !to) return messages.length;
    let n = 0;
    for (let i = 0; i < messages.length; i++) if (pfInPeriodDay(pfDay(messages[i]), from, to)) n++;
    return n;
}

/** "2026-07-07" → "07.07.2026" */
function pfFmt(day) {
    return day ? day.split('-').reverse().join('.') : '';
}

/* ────────────────────────── UI: PERIOD BLOCK ────────────────────────── */

const PF_PRESETS = [
    ['all', 'Вся база'], ['today', 'Сегодня'], ['7d', '7 дней'], ['30d', '30 дней'], ['3m', '3 месяца'], ['6m', '6 месяцев']
];

/** Renders the PERIOD block (own container → typed filter values are never lost). */
function pfRenderPeriod() {
    const box = document.getElementById('pz-period');
    if (!box) return;
    const msgs = PARSER_STATE.rawMessages || [];
    if (!msgs.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';
    const range = PARSER_STATE._baseRange || (PARSER_STATE._baseRange = pfBaseRange(msgs));
    const period = PARSER_STATE.period;
    const inPeriod = pfCountInPeriod(msgs, period.from, period.to);
    const presetBtns = PF_PRESETS.map(([key, label]) =>
        `<button type="button" class="pf-preset${period.preset === key ? ' active' : ''}" data-pf-preset="${key}">${label}</button>`).join('');
    const info = range.min
        ? `База: <b>${pfFmt(range.min)}</b> → <b>${pfFmt(range.max)}</b>`
        : 'В базе нет дат сообщений';
    const note = period.from || period.to ? `${pfFmt(period.from) || '…'} → ${pfFmt(period.to) || '…'}` : 'вся база';
    box.innerHTML = `
        <div class="pz-stage-header">
            <span class="pz-stage-num">📅</span>
            <span class="pz-stage-title">PERIOD</span>
            <span class="pz-stage-hint">${info}</span>
        </div>
        <div class="pf-period-row">
            <div class="pf-presets">${presetBtns}</div>
            <label class="pf-date">С <input type="date" id="pf-from" value="${period.from}" min="${range.min}" max="${range.max}"></label>
            <label class="pf-date">По <input type="date" id="pf-to" value="${period.to}" min="${range.min}" max="${range.max}"></label>
            <span class="pf-period-count${inPeriod === 0 ? ' pf-zero' : ''}">${note}: <b>${inPeriod.toLocaleString()}</b> из ${msgs.length.toLocaleString()} сообщ.</span>
        </div>`;

    box.querySelectorAll('[data-pf-preset]').forEach(btn => btn.addEventListener('click', () => {
        const key = btn.dataset.pfPreset;
        const r = pfPreset(key, range, pfToday());
        PARSER_STATE.period = { preset: key, from: r.from, to: r.to };
        pfRenderPeriod();
    }));
    const onDate = () => {
        const from = document.getElementById('pf-from').value;
        const to = document.getElementById('pf-to').value;
        const ordered = from && to && from > to ? { from: to, to: from } : { from, to };
        PARSER_STATE.period = { preset: ordered.from || ordered.to ? 'custom' : 'all', ...ordered };
        pfRenderPeriod();
    };
    box.querySelector('#pf-from').addEventListener('change', onDate);
    box.querySelector('#pf-to').addEventListener('change', onDate);
}

/* ────────────────────────── UI: FILTER CONFIG ────────────────────────── */

/** Reads the filter inputs into a config object (also used by runParse). */
function pfReadConfig() {
    const val = id => (document.getElementById(id)?.value || '').trim();
    return {
        binsIn: pfBins(val('parser-bins')), binsEx: pfBins(val('parser-bins-ex')),
        countriesIn: pfCountries(val('parser-country')), countriesEx: pfCountries(val('parser-country-ex')),
        banksIn: pfBanks(val('parser-bank')), banksEx: pfBanks(val('parser-exclude-banks')),
        excludePrepaid: Boolean(PARSER_STATE.filters.excludePrepaid),
        parseAll: Boolean(PARSER_STATE.filters.parseAll)
    };
}

/** Red hint under a field when the same token sits in Include and Exclude. */
function pfRefreshConflicts() {
    const cfg = pfReadConfig();
    const c = pfAllConflicts(cfg);
    [['bin', 'pf-conflict-bin'], ['country', 'pf-conflict-country'], ['bank', 'pf-conflict-bank']].forEach(([kind, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = c[kind].length ? `⚠ одновременно в Include и Exclude: ${c[kind].join(', ')}` : '';
        el.style.display = c[kind].length ? '' : 'none';
    });
    return c;
}

/** Sets the Parse-all / No-prepaid state and refreshes the look of the filter block. */
function pfSetFlag(key, value) {
    PARSER_STATE.filters = { ...PARSER_STATE.filters, [key]: Boolean(value) };
    document.querySelector('.parser-filters')?.classList.toggle('pf-off', Boolean(PARSER_STATE.filters.parseAll));
    document.getElementById('parser-no-prepaid')?.classList.toggle('active', Boolean(PARSER_STATE.filters.excludePrepaid));
}

/** Wires PERIOD, Parse-all, No-prepaid and the live conflict hints (called from renderParser). */
function pfBindFilterUi() {
    pfRenderPeriod();
    pfRefreshConflicts();
    document.getElementById('parser-parse-all')?.addEventListener('change', e => {
        pfSetFlag('parseAll', e.target.checked);
        _saveParserFilters();
        toast(e.target.checked ? 'Парсить всё: фильтры отключены' : 'Фильтры включены', 'info');
    });
    document.getElementById('parser-no-prepaid')?.addEventListener('click', () => {
        pfSetFlag('excludePrepaid', !PARSER_STATE.filters.excludePrepaid);
        _saveParserFilters();
    });
    ['parser-bins', 'parser-bins-ex', 'parser-country', 'parser-country-ex', 'parser-bank', 'parser-exclude-banks'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', pfRefreshConflicts);
    });
}

if (typeof module !== 'undefined') {
    module.exports = {
        pfSplit, pfBins, pfCountries, pfBanks, pfConflicts, pfAllConflicts, pfApplyLists,
        pfDay, pfBaseRange, pfAddDays, pfAddMonths, pfPreset, pfFilterByPeriod, pfCountInPeriod, pfToday, pfFmt
    };
}
