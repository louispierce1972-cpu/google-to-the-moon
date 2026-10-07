/* ═══════════════════════════════════════════════════════════════════
   CHECKER EXTRACT — one shared parser for the TRASH and VALID buttons.

   Input = "chunks" {text, ts}: one per Telegram message (ts = message date)
   or one per plain-text file (ts = file date). Rules:
     • LATEST CHECK WINS — every card gets the status of its newest check
       (by message date; same date → later line / later message wins).
     • DUPLICATES are collapsed — one record per card number; repeated
       checks only increase `checks` and are reported as duplicates.
     • A bare card list (user input) has NO status → "unknown", never trash.

   Supported checker formats:
     AFFChecker (SPLICE):  single "💳 Card: 462845••••••5547 … 🚦 Status: 🟢 APPROVED"
                           batch  "1. 🔴 552060••••••6218 | 06/26 | 🇦🇺 MASTERCARD"
                           🟢 = alive, 🔴 = dead, 🟡 (3DS / unconfirmed) and
                           🚫 (gateway / proxy error) are NOT card statuses.
                           Masked numbers are resolved from full numbers sent in
                           the same chat (expiry used to disambiguate), then from
                           the loaded base.
     Sombrero:             "Результаты проверки: CARD | Approved ✅ / … ⛔️"
                           ("— Не удалось / Неверный формат" replies are ignored)
     Generic:              ✅/💀/❌ + ALIVE/DEAD/INVALID, 🟩/🟥 blocks, CARD | keyword
   Uses app.js helpers at call time: _parseCheckerOutput, _parseBlockFormat,
   _parseClassicFormat, _lineIsTrash, _buildFullCardLookup, PARSER_STATE.
   ═══════════════════════════════════════════════════════════════════ */

/** Flatten a Telegram message `text` field (string or entity array) into plain text. */
function ckMessageText(msg) {
    if (!msg) return '';
    if (typeof msg === 'string') return msg;
    const t = msg.text;
    if (typeof t === 'string') return t;
    if (Array.isArray(t)) return t.map(p => (typeof p === 'string' ? p : (p && p.text ? String(p.text) : ''))).join('');
    return '';
}

/** Message date in ms (date_unixtime → date → fallback). */
function ckMessageTs(msg, fallback) {
    const unix = Number(msg && msg.date_unixtime);
    if (unix > 0) return unix * 1000;
    const parsed = Date.parse((msg && msg.date) || '');
    return Number.isFinite(parsed) ? parsed : fallback;
}

/** Loaded file → chunks. .json = Telegram export (chunk per message), anything else = one text chunk. */
function ckFileToChunks(fileName, raw, fileTs) {
    const ts0 = Number(fileTs) || 0;
    if (!/\.json$/i.test(fileName)) return { chunks: [{ text: String(raw || ''), ts: ts0 }], messages: 0 };
    const data = JSON.parse(raw);
    const messages = Array.isArray(data) ? data : (Array.isArray(data.messages) ? data.messages : []);
    const chunks = [];
    messages.forEach(m => {
        const text = ckMessageText(m).trim();
        if (text) chunks.push({ text, ts: ckMessageTs(m, ts0) });
    });
    return { chunks, messages: messages.length };
}

const CK_DATA_RE = /(\d{13,19})\s*[|\s\/:]\s*(0?[1-9]|1[0-2])\s*[|\s\/]\s*(20\d{2}|\d{2})\s*[|\s\/]\s*(\d{3,4})(?!\d)/;
const CK_AFF_RE = /SPLICE|AFFILIHATE|BATCH REPORT/i;
const CK_AFF_LINE_RE = /([\u{1F534}\u{1F7E2}\u{1F7E1}\u{1F6AB}])\s*(\d{6})[^\d\n]{1,12}(\d{4})(?:\s*\|\s*(\d{1,2})\/(\d{2,4}))?/u;
const CK_FORMAT_ERROR_RE = /—\s*(Не удалось|Неверный)/i;
const CK_NETWORK_RE = /\b(VISA|MASTERCARD|AMEX|AMERICAN EXPRESS|DISCOVER|JCB|UNIONPAY|DINERS)\b/i;

const ckMaskKey = (first6, last4) => `${first6}*${last4}`;
const ckNewer = (a, b) => a.ts > b.ts || (a.ts === b.ts && a.seq >= b.seq);

function ckEmptyRecord(cc) {
    return { cc, mm: '', yy: '', cvv: '', system: '', type: '', level: '', geo: '', status: null, ts: 0, seq: -1, checks: 0 };
}

/** "🇸🇬 SG" / "🇦🇺 MASTERCARD" → "SG" / "AU". */
function ckGeoFrom(str) {
    const flag = String(str || '').match(/([\u{1F1E6}-\u{1F1FF}])([\u{1F1E6}-\u{1F1FF}])/u);
    if (flag) return String.fromCharCode(flag[1].codePointAt(0) - 0x1F1E6 + 65, flag[2].codePointAt(0) - 0x1F1E6 + 65);
    const code = String(str || '').match(/\b([A-Z]{2})\b/);
    return code ? code[1] : '';
}

/** AFFChecker emoji → alive | dead | null (🟡 / 🚫 are not card statuses). */
function ckAffStatus(s) {
    if (/\u{1F7E2}/u.test(s)) return 'alive';
    if (/\u{1F534}/u.test(s)) return 'dead';
    return null;
}

/* ─────────────── per-message status parsers ─────────────── */

/** AFFChecker message → { full: [...], masked: [...] } in line order. */
function ckAffStatuses(text, lines) {
    const masked = [];
    const card = text.match(/Card:\s*(\d{6})[^\d\n]{1,12}(\d{4})/);
    const statusLine = text.match(/Status:\s*([^\n]*)/);
    const singleStatus = card && statusLine ? ckAffStatus(statusLine[1]) : null;
    if (singleStatus) {
        const exp = text.match(/Expiry:\s*(\d{1,2})\/(\d{2,4})/);
        const [system = '', type = '', level = ''] = ((text.match(/Scheme:\s*([^\n]*)/) || [])[1] || '').split(/\s*•\s*/);
        masked.push({
            first6: card[1], last4: card[2], status: singleStatus,
            mm: exp ? exp[1].padStart(2, '0') : '', yy: exp ? exp[2].slice(-2) : '',
            geo: ckGeoFrom((text.match(/Country:\s*([^\n]*)/) || [])[1]), system, type, level
        });
    }
    lines.forEach(line => {
        const m = line.match(CK_AFF_LINE_RE);
        const status = m ? ckAffStatus(m[1]) : null;
        if (!status) return;
        masked.push({
            first6: m[2], last4: m[3], status,
            mm: m[4] ? m[4].padStart(2, '0') : '', yy: m[5] ? m[5].slice(-2) : '',
            geo: ckGeoFrom(line), system: (line.match(CK_NETWORK_RE) || [])[1] || ''
        });
    });
    // "📋 APPROVED CARDS:" / "Tap to Copy Live Card:" list full live numbers
    const full = [];
    let inLive = false;
    lines.forEach(line => {
        if (/APPROVED CARDS|Copy Live Card/i.test(line)) { inLive = true; return; }
        const num = line.match(/(\d{13,19})/);
        if (!num) { if (/[━╰┣]/.test(line)) inLive = false; return; }
        if (inLive) full.push({ cc: num[1], status: 'alive' });
    });
    return { full, masked };
}

/** Status text after "CARD |": alive / dead / null. */
function ckPipeStatus(part) {
    if (!part || CK_FORMAT_ERROR_RE.test(part)) return null;
    if (/\u2705|\bapprov(ed|al)\b|\bALIVE\b|\bLIVE\b/iu.test(part)) return 'alive';
    if (/\u26D4/u.test(part) || (typeof _lineIsTrash === 'function' && _lineIsTrash(part))) return 'dead';
    return null;
}

/** "CARD | Approved ✅", "CARD | TRAN NOT ALLOWED ⛔", "CARD |" + status on the next line. */
function ckPipeStatuses(lines) {
    const out = [];
    lines.forEach((line, i) => {
        const m = line.match(/^[^\d]{0,4}(\d{13,19})\s*\|\s*(.*)$/);
        if (!m || CK_FORMAT_ERROR_RE.test(line)) return;
        let status = ckPipeStatus(m[2].replace(/^[\d|\s\/]+/, ''));
        for (let j = i + 1; !status && j < lines.length && j <= i + 2; j++) {
            if (/^[^\d]{0,4}\d{13,19}/.test(lines[j])) break;
            status = ckPipeStatus(lines[j]);
        }
        if (status) out.push({ cc: m[1], status });
    });
    return out;
}

/** Generic checker formats (classic / block / "CARD - status" + service lines). */
function ckGenericStatuses(text) {
    const lines = text.split(/\r?\n/).filter(l => !CK_FORMAT_ERROR_RE.test(l));
    const clean = lines.join('\n');
    const toStatus = s => (s === 'alive' || s === 'valid' ? 'alive' : 'dead');
    const detailed = _parseCheckerOutput(clean).map(r => ({
        cc: r.cc, status: toStatus(r.status), system: r.system, type: r.type, level: r.level, geo: r.geo
    }));
    const classic = _parseClassicFormat(clean).map(r => ({ cc: r.cc, status: toStatus(r.status) }));
    const block = _parseBlockFormat(clean).map(r => ({ cc: r.cc, status: toStatus(r.status) }));
    return [detailed, classic, block];
}

/** Group parser outputs → Map<cc, {patch, n}>. Inside a parser the LAST line wins; the first parser that knows a card wins. */
function ckGroupStatuses(groups) {
    const out = new Map();
    groups.forEach(list => {
        const local = new Map();
        list.forEach(item => {
            const cc = String(item.cc || '').replace(/\D/g, '');
            if (cc.length < 13 || cc.length > 19) return;
            const prev = local.get(cc);
            local.set(cc, { patch: item, n: prev ? prev.n + 1 : 1 });
        });
        local.forEach((value, cc) => { if (!out.has(cc)) out.set(cc, value); });
    });
    return out;
}

/* ─────────────── masked number resolution ─────────────── */

let CK_BASE_INDEX = null;
let CK_BASE_REF = null;

function ckResetBaseIndex() { CK_BASE_INDEX = null; CK_BASE_REF = null; }

/** first6*last4 → [full numbers] from the loaded base (cached per loaded base). */
function ckBaseIndex() {
    const ref = (typeof PARSER_STATE !== 'undefined' && PARSER_STATE.rawMessages) || null;
    if (CK_BASE_INDEX && CK_BASE_REF === ref) return CK_BASE_INDEX;
    const index = new Map();
    const numbers = typeof _buildFullCardLookup === 'function' ? _buildFullCardLookup() : [];
    numbers.forEach(cc => {
        const key = ckMaskKey(cc.slice(0, 6), cc.slice(-4));
        const list = index.get(key) || [];
        if (!list.includes(cc)) index.set(key, [...list, cc]);
    });
    CK_BASE_INDEX = index;
    CK_BASE_REF = ref;
    return index;
}

/** Masked card → full number (same chat first, expiry match preferred, then loaded base). null = unknown/ambiguous. */
function ckResolveMasked(m, byMask, ts) {
    let cands = byMask.get(ckMaskKey(m.first6, m.last4)) || [];
    if (m.mm && m.yy) {
        const exact = cands.filter(e => e.mm === m.mm && e.yy === m.yy);
        if (exact.length) cands = exact;
    }
    const uniq = [...new Set(cands.map(e => e.cc))];
    if (uniq.length === 1) return uniq[0];
    if (uniq.length > 1) {
        const before = cands.filter(e => e.ts <= ts).sort((a, b) => b.ts - a.ts || b.seq - a.seq);
        return before.length ? before[0].cc : null;
    }
    const base = ckBaseIndex().get(ckMaskKey(m.first6, m.last4)) || [];
    return base.length === 1 ? base[0] : null;
}

/* ─────────────── main entry ─────────────── */

/** Card data (MM YY CVV) from every line; newest wins. Also builds the masked lookup. */
function ckCollectData(ordered) {
    const data = new Map();
    const byMask = new Map();
    ordered.forEach(c => c.lines.forEach(line => {
        const d = line.match(CK_DATA_RE);
        if (!d) return;
        const entry = { cc: d[1], mm: d[2].padStart(2, '0'), yy: d[3].slice(-2), cvv: d[4], ts: c.ts, seq: c.seq };
        const prev = data.get(entry.cc);
        if (!prev || ckNewer(entry, prev)) data.set(entry.cc, entry);
        const key = ckMaskKey(entry.cc.slice(0, 6), entry.cc.slice(-4));
        byMask.set(key, [...(byMask.get(key) || []), entry]);
    }));
    return { data, byMask };
}

/** Statuses of one message/chunk → Map<cc, {patch, n}> + unresolved masked count. */
function ckChunkStatuses(chunk, byMask) {
    const isAff = CK_AFF_RE.test(chunk.text) || CK_AFF_LINE_RE.test(chunk.text);
    if (!isAff) return { grouped: ckGroupStatuses([ckPipeStatuses(chunk.lines), ...ckGenericStatuses(chunk.text)]), unmatched: 0 };
    const { full, masked } = ckAffStatuses(chunk.text, chunk.lines);
    let unmatched = 0;
    const resolved = [];
    masked.forEach(m => {
        const cc = ckResolveMasked(m, byMask, chunk.ts);
        if (cc) resolved.push({ ...m, cc }); else unmatched++;
    });
    return { grouped: ckGroupStatuses([resolved, full]), unmatched };
}

/** Apply one status observation to a record → NEW record (latest date wins). */
function ckApply(prev, patch, n, ts, seq) {
    const newer = prev.status === null || ckNewer({ ts, seq }, prev);
    const next = { ...prev, checks: prev.checks + n };
    if (newer) Object.assign(next, { status: patch.status === 'alive' ? 'valid' : 'trash', ts, seq });
    ['system', 'type', 'level', 'geo'].forEach(k => {
        if (patch[k] && (newer || !next[k])) next[k] = String(patch[k]).trim();
    });
    return next;
}

/**
 * chunks [{text, ts}] → { records: Map<cc, record>, maskedUnmatched, stats: {checks, duplicates} }.
 * record.status: 'valid' | 'trash' | null (no status).
 */
function ckExtractChunks(chunks) {
    const ordered = (chunks || []).map((c, i) => {
        const text = String((c && c.text) || '');
        return { text, ts: Number(c && c.ts) || 0, seq: i, lines: text.split(/\r?\n/).map(l => l.trim()).filter(Boolean) };
    });
    const { data, byMask } = ckCollectData(ordered);
    const records = new Map();
    let maskedUnmatched = 0;
    let checks = 0;

    ordered.forEach(chunk => {
        const { grouped, unmatched } = ckChunkStatuses(chunk, byMask);
        maskedUnmatched += unmatched;
        grouped.forEach(({ patch, n }, cc) => {
            checks += n;
            records.set(cc, ckApply(records.get(cc) || ckEmptyRecord(cc), patch, n, chunk.ts, chunk.seq));
        });
    });

    data.forEach((d, cc) => {
        const rec = records.get(cc) || ckEmptyRecord(cc);
        records.set(cc, { ...rec, mm: d.mm, yy: d.yy, cvv: d.cvv });
    });
    const withStatus = [...records.values()].filter(r => r.status).length;
    return { records, maskedUnmatched, stats: { checks, duplicates: Math.max(0, checks - withStatus) } };
}

/** Backwards-compatible: plain text → same result as one chunk. */
function ckExtract(text) {
    return ckExtractChunks([{ text, ts: 0 }]);
}

/** 'trash' | 'valid' | 'unknown' */
function ckStatus(rec) {
    return (rec && rec.status) || 'unknown';
}

/** Merge two record maps into a NEW map: newest status wins, checks add up, data is filled. */
function ckMerge(a, b) {
    const out = new Map(a);
    b.forEach((rec, cc) => {
        const prev = out.get(cc);
        if (!prev) { out.set(cc, rec); return; }
        const recNewer = rec.status && (!prev.status || ckNewer(rec, prev));
        const winner = recNewer ? rec : prev;
        const loser = recNewer ? prev : rec;
        const next = { ...winner, checks: prev.checks + rec.checks };
        ['mm', 'yy', 'cvv', 'system', 'type', 'level', 'geo'].forEach(k => { if (!next[k] && loser[k]) next[k] = loser[k]; });
        out.set(cc, next);
    });
    return out;
}

/** Counts for summaries. */
function ckCounts(records) {
    let trash = 0, valid = 0, unknown = 0;
    records.forEach(r => {
        const s = ckStatus(r);
        if (s === 'trash') trash++; else if (s === 'valid') valid++; else unknown++;
    });
    return { trash, valid, unknown, total: records.size };
}

/**
 * What the TRASH button will do (latest date wins against the trash date too):
 *   add     — newest check is dead and card is not in trash yet
 *   restore — card is in trash but a NEWER check says alive (undated trash = oldest)
 *   dates   — cc → ts to store for added / re-confirmed trash cards
 */
function ckTrashPlan(records, trashList, trashDates) {
    const inTrash = new Set((trashList || []).map(n => String(n).replace(/\D/g, '')));
    const dates = trashDates || {};
    const add = [];
    const restore = [];
    const newDates = {};
    let already = 0;
    records.forEach(r => {
        const trashTs = Number(dates[r.cc]) || 0;
        if (r.status === 'trash') {
            if (!inTrash.has(r.cc)) { add.push(r.cc); newDates[r.cc] = r.ts; return; }
            already++;
            if (r.ts > trashTs) newDates[r.cc] = r.ts;
        } else if (r.status === 'valid' && inTrash.has(r.cc) && trashTs < r.ts) {
            restore.push(r.cc);
        }
    });
    return { add, restore, already, dates: newDates };
}

/** Valid right now = newest check alive AND not trashed after that check. */
function ckIsValidNow(rec, trashSet, trashDates) {
    if (!rec || rec.status !== 'valid') return false;
    if (!trashSet.has(rec.cc)) return true;
    return (Number((trashDates || {})[rec.cc]) || 0) <= rec.ts;
}

/**
 * Export line formats for Notes / clipboard.
 *   checker: 4147202626727323 08 28 020
 *   pipe:    4147202626727323|08|28|020
 *   full:    4147202626727323 08 28 020 | JOHN DOE | VISA CREDIT | BANK | US
 */
const CK_FORMATS = {
    checker: { label: 'Чекер: CC MM YY CVV', line: c => `${c.cc} ${c.mm || '00'} ${c.yy || '00'} ${c.cvv || '000'}` },
    pipe: { label: 'Pipe: CC|MM|YY|CVV', line: c => `${c.cc}|${c.mm || '00'}|${c.yy || '00'}|${c.cvv || '000'}` },
    full: {
        label: 'Полный: + имя · тип · банк · страна',
        line: c => `${c.cc} ${c.mm || '00'} ${c.yy || '00'} ${c.cvv || '000'} | ${c.holder || '-'} | ${c.cardType || '-'} | ${c.bank || '-'} | ${c.geo || '-'}`
    }
};

function ckFormatLines(cards, formatKey) {
    const fmt = CK_FORMATS[formatKey] || CK_FORMATS.checker;
    return cards.map(fmt.line).join('\n');
}

if (typeof module !== 'undefined') {
    module.exports = {
        ckMessageText, ckMessageTs, ckFileToChunks, ckExtractChunks, ckExtract, ckStatus, ckMerge, ckCounts,
        ckTrashPlan, ckIsValidNow, ckResetBaseIndex, ckFormatLines, CK_FORMATS
    };
}
