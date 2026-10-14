/* ═══════════════════════════════════════════════════════════════════
   CARD DETAILS — every field already parsed from the base, in one place.
   cdDescribe(card, binInfo) → flat view model (type / class / network are
   derived from the log's card-type text and, if present, the BIN cache).
   cdDetailRows(card, binInfo) → [{label, value}] for the expandable row.
   Pure functions, no DOM. Used by parser-results.js.
   ═══════════════════════════════════════════════════════════════════ */

const CD_TYPES = ['CREDIT', 'DEBIT', 'PREPAID', 'BUSINESS'];
// WORLD ELITE must be tested before WORLD
const CD_CLASSES = ['WORLD_ELITE', 'WORLD', 'CLASSIC', 'STANDARD', 'GOLD', 'PLATINUM', 'TITANIUM', 'SIGNATURE', 'INFINITE', 'BLACK', 'ELECTRON', 'MAESTRO'];

function cdNetworkOfCc(cc) {
    const n = String(cc || '').replace(/\D/g, '');
    if (/^4/.test(n)) return 'VISA';
    if (/^(5[1-5]|2(2[2-9][1-9]|[3-6]\d\d|7[01]\d|720))/.test(n)) return 'MASTERCARD';
    if (/^3[47]/.test(n)) return 'AMEX';
    if (/^(6011|65|64[4-9])/.test(n)) return 'DISCOVER';
    if (/^62/.test(n)) return 'UNIONPAY';
    if (/^35/.test(n)) return 'JCB';
    return '';
}

function cdGroup4(cc) {
    return String(cc || '').replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
}

function cdUpperText(...parts) {
    return parts.filter(Boolean).join(' ').toUpperCase().replace(/\s+/g, ' ');
}

function cdDescribe(card, binInfo, networkOf) {
    const c = card || {};
    const info = binInfo && !binInfo.error ? binInfo : {};
    const text = cdUpperText(info.type, c.cardType, info.level);
    const underscored = text.replace(/\s/g, '_');
    const type = CD_TYPES.find(t => text.includes(t)) || '';
    const cls = CD_CLASSES.find(k => new RegExp(`(?:^|_)${k}(?:$|_)`).test(underscored)) || '';
    const brand = String(info.brand || '').toUpperCase();
    const network = (typeof networkOf === 'function' ? networkOf(c.cc) : '') || cdNetworkOfCc(c.cc) || brand;
    return {
        fullNumber: cdGroup4(c.cc),
        cvv: c.cvv || '',
        exp: c.validity || (c.mm ? `${c.mm}/${c.yy}` : ''),
        type,
        cardClass: cls.replace('_', ' '),
        network,
        bank: c.bank || '',
        bin: c.bin || String(c.cc || '').slice(0, 6),
        geo: String(c.detectedGeo || c.countryCode || c.bankCountryCode || '').toUpperCase(),
        countryName: c.country || '',
        holder: [c.name, c.surname].filter(Boolean).join(' '),
        billing: c.billing || '',
        cardTypeRaw: c.cardType || '',
        bankCountryCode: c.bankCountryCode || '',
        msgDate: c.msgDate || ''
    };
}

function cdDetailRows(card, binInfo, networkOf) {
    const d = cdDescribe(card, binInfo, networkOf);
    return [
        { label: 'Full number', value: d.fullNumber },
        { label: 'CVV', value: d.cvv },
        { label: 'Expiry', value: d.exp },
        { label: 'Type', value: d.type },
        { label: 'Class', value: d.cardClass },
        { label: 'Network', value: d.network },
        { label: 'Card type (raw)', value: d.cardTypeRaw },
        { label: 'Bank', value: d.bank },
        { label: 'BIN', value: d.bin },
        { label: 'Country', value: [d.geo, d.countryName].filter(Boolean).join(' · ') },
        { label: 'Bank country', value: d.bankCountryCode },
        { label: 'Holder', value: d.holder },
        { label: 'Billing', value: d.billing },
        { label: 'Message date', value: d.msgDate }
    ];
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { cdDescribe, cdDetailRows, cdNetworkOfCc, cdGroup4 };
}
