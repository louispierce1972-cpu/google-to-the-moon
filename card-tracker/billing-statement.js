/* ═══════════════════════════════════════════════════════════════════
   BILLING STATEMENT — pure logic for the Workspace tab.
   Reads Google Ads "Billing activity report" CSV files and turns them
   into one record per (file, card). Card = network + last 4 digits
   (that is all Google Ads shows). Full card data is looked up in the
   main base by last 4 + network.
   Pure functions (bs*) never mutate their input.
   ═══════════════════════════════════════════════════════════════════ */

const BS_MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const BS_CARD_RE = /(American Express|Amex|Visa|Mastercard|Discover|JCB|UnionPay|Maestro)[^0-9]{0,40}?(\d{4})(?!\d)/i;
const BS_REF_RE = /\b([AP][0-9A-Za-z]{7,})\s*$/;

/* ───────────────────────── CSV ───────────────────────── */

/** RFC-4180-ish parser: quotes, "" escapes and newlines inside quotes. */
function bsParseCsv(text) {
    const src = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inQ) {
            if (ch === '"') {
                if (src[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
            } else cell += ch;
        } else if (ch === '"') inQ = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && src[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.some(c => c.trim() !== '')) rows.push(row);
            row = [];
        } else cell += ch;
    }
    row.push(cell);
    if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows;
}

/* ───────────────────── DATES / MONEY ───────────────────── */

/** "Aug 7, 2026" | "June 1, 2026" → "2026-08-07" (or '' if unparsable). */
function bsParseDate(s) {
    const m = String(s || '').trim().match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    if (!m) return '';
    const mon = BS_MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (!mon) return '';
    return `${m[3]}-${String(mon).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
}

/** "June 1, 2026 - August 14, 2026" → { from, to } */
function bsParsePeriod(s) {
    const parts = String(s || '').split(/\s+[-–—]\s+/);
    if (parts.length !== 2) return { from: '', to: '' };
    return { from: bsParseDate(parts[0]), to: bsParseDate(parts[1]) };
}

/** "-¥4,500" → { value: -4500, cur: '¥' }; "--" / "" → null */
function bsParseMoney(s) {
    const t = String(s || '').replace(/[\u00a0\u2000-\u200a]/g, ' ').trim();
    const m = t.match(/^(-)?\s*([¥$€£₽₴₹]|[A-Z]{3})?\s*(-)?\s*([\d,]+(?:\.\d+)?)$/);
    if (!m) return null;
    const value = Number(m[4].replace(/,/g, ''));
    if (!Number.isFinite(value)) return null;
    return { value: (m[1] || m[3]) ? -value : value, cur: m[2] || '' };
}

function bsNormNetwork(n) {
    const u = String(n || '').toUpperCase();
    if (u.startsWith('AMERICAN') || u === 'AMEX') return 'Amex';
    if (u.startsWith('MASTER')) return 'Mastercard';
    if (u === 'VISA') return 'Visa';
    if (u === 'DISCOVER') return 'Discover';
    if (u === 'JCB') return 'JCB';
    if (u.startsWith('UNION')) return 'UnionPay';
    if (u === 'MAESTRO') return 'Maestro';
    return n || '';
}

/** Card network from the PAN prefix ('' when unknown). */
function bsNetworkOfCc(cc) {
    const s = String(cc || '').replace(/\D/g, '');
    if (!s) return '';
    if (/^4/.test(s)) return 'Visa';
    if (/^3[47]/.test(s)) return 'Amex';
    if (/^(5[1-5]|2(2[2-9]\d|[3-6]\d\d|7[01]\d|720))/.test(s)) return 'Mastercard';
    if (/^35/.test(s)) return 'JCB';
    if (/^62/.test(s)) return 'UnionPay';
    if (/^(6011|65|64[4-9])/.test(s)) return 'Discover';
    return '';
}

/* ───────────────────── STATEMENT PARSING ───────────────────── */

function _bsEvent(date, desc, costs, credits) {
    const d = String(desc || '').replace(/\s+/g, ' ').trim();
    const cm = d.match(BS_CARD_RE);
    const head = d.match(/^(Monthly charge|Threshold charge|Manual payment|Automatic payment|Payment charged back)\s*(declined|cancelled|canceled)?\s*:/i);
    if (!head || !cm) return null;
    const label = head[1];
    const flag = (head[2] || '').toLowerCase();
    let kind = 'charge';
    if (/charged back/i.test(label)) kind = 'chargeback';
    else if (flag === 'declined') kind = 'declined';
    else if (flag) kind = 'cancelled';

    const forM = d.match(/\bfor\s+(-?[¥$€£₽₴₹]?[\d,]+(?:\.\d+)?)/i);
    const fromText = forM ? bsParseMoney(forM[1]) : null;
    const cr = bsParseMoney(credits), co = bsParseMoney(costs);
    let money = null;
    if (kind === 'charge') money = cr && cr.value !== 0 ? cr : fromText;
    else if (kind === 'chargeback') money = co && co.value !== 0 ? co : fromText;
    else money = fromText;

    const refM = d.match(BS_REF_RE);
    const reasonM = d.match(/\.\s+([^.]+?)\.\s+[AP][0-9A-Za-z]{7,}\s*$/);
    return {
        date, kind, label,
        network: bsNormNetwork(cm[1]), last4: cm[2],
        amount: money ? Math.abs(money.value) : 0,
        cur: money ? money.cur : '',
        reason: kind === 'declined' && reasonM ? reasonM[1].trim() : '',
        ref: refM ? refM[1] : ''
    };
}

/** Parse one Billing activity report CSV → { fileName, period, events, campaigns, taxes }. */
function bsParseStatement(text, fileName) {
    const rows = bsParseCsv(text);
    const period = bsParsePeriod((rows[1] || [])[0]);
    const hi = rows.findIndex(r => String(r[0] || '').trim() === 'Date');
    const events = [];
    const campaigns = [];
    const taxes = [];
    if (hi >= 0) {
        for (const r of rows.slice(hi + 1)) {
            const date = bsParseDate(r[0]);
            if (!date) continue;
            const type = String(r[1] || '').trim();
            if (type === 'Payments') {
                const ev = _bsEvent(date, r[2], r[4], r[5]);
                if (ev) events.push(ev);
            } else if (type === 'Campaigns') {
                const co = bsParseMoney(r[4]);
                const clicks = String(r[3] || '').match(/([\d,]+)\s*click/i);
                if (co) campaigns.push({ date, name: String(r[2] || '').trim(), cost: co.value, cur: co.cur, clicks: clicks ? Number(clicks[1].replace(/,/g, '')) : 0 });
            } else if (type === 'Taxes and fees') {
                const co = bsParseMoney(r[4]);
                if (co) taxes.push({ date, name: String(r[2] || '').trim(), cost: co.value, cur: co.cur });
            }
        }
    }
    return { fileName: fileName || '', period, events, campaigns, taxes };
}

/* ───────────────────── SUMMARY PER CARD ───────────────────── */

/** One record per (file, network, last4) with all the sums. */
function bsSummarize(statement) {
    const campaignCost = statement.campaigns.reduce((s, c) => s + c.cost, 0);
    const campaignClicks = statement.campaigns.reduce((s, c) => s + c.clicks, 0);
    const cur = (statement.campaigns[0] || statement.events[0] || {}).cur || '';
    const byKey = new Map();
    for (const ev of statement.events) {
        const key = `${ev.network}|${ev.last4}`;
        const prev = byKey.get(key) || {
            id: `${statement.fileName}#${ev.network}#${ev.last4}`,
            fileName: statement.fileName, periodFrom: statement.period.from, periodTo: statement.period.to,
            network: ev.network, last4: ev.last4, cur: ev.cur || cur,
            charged: 0, chargedCount: 0, declined: 0, declinedCount: 0,
            cancelled: 0, cancelledCount: 0, chargedBack: 0, chargedBackCount: 0,
            firstDate: ev.date, lastDate: ev.date, reasons: []
        };
        const next = { ...prev, cur: prev.cur || ev.cur, reasons: [...prev.reasons] };
        if (ev.kind === 'charge') { next.charged += ev.amount; next.chargedCount += 1; }
        else if (ev.kind === 'declined') { next.declined += ev.amount; next.declinedCount += 1; if (ev.reason && !next.reasons.includes(ev.reason)) next.reasons.push(ev.reason); }
        else if (ev.kind === 'cancelled') { next.cancelled += ev.amount; next.cancelledCount += 1; }
        else if (ev.kind === 'chargeback') { next.chargedBack += ev.amount; next.chargedBackCount += 1; }
        if (ev.date < next.firstDate) next.firstDate = ev.date;
        if (ev.date > next.lastDate) next.lastDate = ev.date;
        byKey.set(key, next);
    }
    const cardCount = byKey.size;
    return [...byKey.values()].map(r => ({ ...r, campaignCost, campaignClicks, fileCardCount: cardCount }));
}

/** Merge records of several statements; a file loaded twice replaces the old copy. */
function bsMergeRecords(existing, incoming) {
    const names = new Set(incoming.map(r => r.fileName));
    return [...existing.filter(r => !names.has(r.fileName)), ...incoming];
}

/* ───────────────────── MATCH WITH THE BASE ───────────────────── */

/** last4 → cards[] (unique by number, newest message first). */
function bsBuildIndex(baseCards) {
    const best = new Map();
    for (const c of baseCards || []) {
        const cc = String(c.cc || '').replace(/\D/g, '');
        if (cc.length < 12) continue;
        const prev = best.get(cc);
        if (!prev || String(c.msgDate || '') > String(prev.msgDate || '')) best.set(cc, { ...c, cc });
    }
    const index = new Map();
    for (const c of best.values()) {
        const l4 = c.cc.slice(-4);
        index.set(l4, [...(index.get(l4) || []), c]);
    }
    for (const [k, list] of index) {
        index.set(k, [...list].sort((a, b) => String(b.msgDate || '').localeCompare(String(a.msgDate || ''))));
    }
    return index;
}

function bsCandidates(rec, index) {
    const list = (index && index.get(rec.last4)) || [];
    return list.filter(c => {
        const n = bsNetworkOfCc(c.cc);
        return !n || !rec.network || n === rec.network;
    });
}

/**
 * Row for the Workspace table.
 * status: 'matched' (1 candidate or user choice) | 'choose' (several) | 'missing'
 */
function bsBuildRow(rec, index, selections) {
    const candidates = bsCandidates(rec, index);
    const picked = selections && selections[rec.id];
    let chosen = picked ? candidates.find(c => c.cc === picked) || null : null;
    if (!chosen && candidates.length === 1) chosen = candidates[0];
    const status = chosen ? 'matched' : candidates.length > 1 ? 'choose' : 'missing';
    return { ...rec, candidates, chosen, status };
}

function bsBuildRows(records, index, selections) {
    return records.map(r => bsBuildRow(r, index, selections));
}

/* ───────────────────── TOTALS / EXPORT ───────────────────── */

function bsTotals(rows) {
    const out = { files: new Set(rows.map(r => r.fileName)).size, cards: rows.length, matched: 0, choose: 0, missing: 0, charged: {}, declined: {}, chargedBack: {}, campaign: {} };
    const seenFiles = new Set();
    for (const r of rows) {
        out[r.status] += 1;
        const c = r.cur || '';
        out.charged[c] = (out.charged[c] || 0) + r.charged;
        out.declined[c] = (out.declined[c] || 0) + r.declined;
        out.chargedBack[c] = (out.chargedBack[c] || 0) + r.chargedBack;
        if (!seenFiles.has(r.fileName)) {
            seenFiles.add(r.fileName);
            out.campaign[c] = (out.campaign[c] || 0) + r.campaignCost;
        }
    }
    return out;
}

function bsCsvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const BS_EXPORT_COLS = [
    ['Card', r => r.chosen ? r.chosen.cc : ''], ['Exp', r => r.chosen ? `${r.chosen.mm}/${r.chosen.yy}` : ''],
    ['CVV', r => r.chosen ? r.chosen.cvv : ''], ['BIN', r => r.chosen ? r.chosen.cc.slice(0, 6) : ''],
    ['Country', r => r.chosen ? (r.chosen.country || r.chosen.countryCode || '') : ''],
    ['Bank', r => r.chosen ? r.chosen.bank : ''], ['Type', r => r.chosen ? r.chosen.cardType : ''],
    ['Network', r => r.network], ['Last4', r => r.last4],
    ['Charged', r => r.charged], ['Declined', r => r.declined], ['Declined n', r => r.declinedCount],
    ['Charged back', r => r.chargedBack], ['Cancelled', r => r.cancelled],
    ['Campaign cost', r => r.campaignCost], ['Currency', r => r.cur],
    ['Period from', r => r.periodFrom], ['Period to', r => r.periodTo], ['File', r => r.fileName],
    ['Status', r => r.status]
];

function bsToCsv(rows) {
    const head = BS_EXPORT_COLS.map(c => bsCsvCell(c[0])).join(',');
    const body = rows.map(r => BS_EXPORT_COLS.map(c => bsCsvCell(c[1](r))).join(','));
    return [head, ...body].join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        bsParseCsv, bsParseDate, bsParsePeriod, bsParseMoney, bsNormNetwork, bsNetworkOfCc,
        bsParseStatement, bsSummarize, bsMergeRecords, bsBuildIndex, bsCandidates,
        bsBuildRow, bsBuildRows, bsTotals, bsToCsv
    };
}
