/* ═══════════════════════════════════════════
   CARD TRACKER — Application Logic
   ═══════════════════════════════════════════ */

// ──── STATE ────
const STATE = {
    user: null,
    currentView: 'cards',
    currentCountry: 'canada',
    countries: [
        { id: 'canada', name: 'Canada', flag: '🇨🇦' },
        { id: 'usa', name: 'United States', flag: '🇺🇸' }
    ],
    cards: [],
    docs: [],
    notes: '',
    notesTabs: [],
    notesActiveTab: '',
    trash: [],
    search: '',
    page: 1,
    perPage: 100,
    editingCardId: null,
    contextCardId: null,
    sortField: 'date',
    sortDir: 'desc',
    docSortField: 'date',
    docSortDir: 'desc',
    notesFontSize: 14,
    notesLastSaved: null,
    settings: {},
    merchants: [],
    merchantBins: [],
    merchantView: 'list',
    merchantDetailId: null,
    trashCards: [],
};


const CREDENTIALS = { username: 'admin', password: 'google2026' };

// ──── BIN CACHE (RustBin API) ────
let BIN_CACHE = {};

function loadBinCache() {
    try {
        const raw = localStorage.getItem('ct_bin_cache');
        if (raw) BIN_CACHE = JSON.parse(raw);
    } catch { BIN_CACHE = {}; }
}

function saveBinCache() {
    try {
        localStorage.setItem('ct_bin_cache', JSON.stringify(BIN_CACHE));
    } catch { /* quota exceeded — ignore */ }
}

function getBinInfo(bin) {
    return BIN_CACHE[bin] || null;
}

async function lookupBin(bin) {
    if (!bin || bin.length < 6) return null;
    const key = bin.slice(0, 6);
    // Return from cache
    if (BIN_CACHE[key]) return BIN_CACHE[key];

    const apiUrl = `https://rustbin.site/api/?bin=${key}`;

    // Strategy 1: Direct fetch (works when served from http server)
    try {
        const resp = await fetch(apiUrl);
        if (resp.status === 404) {
            BIN_CACHE[key] = { bin: key, brand: '', type: '', level: '', bank: '', country: '', error: true };
            saveBinCache();
            return BIN_CACHE[key];
        }
        if (resp.ok) {
            const data = await resp.json();
            return _cacheBinData(key, data);
        }
    } catch { /* CORS blocked — try proxies */ }

    // Strategy 2: allorigins.win proxy (wraps response)
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`;
        const resp = await fetch(proxyUrl);
        if (resp.ok) {
            const wrapper = await resp.json();
            if (wrapper.contents) {
                const data = JSON.parse(wrapper.contents);
                return _cacheBinData(key, data);
            }
        }
    } catch { /* try next */ }

    // Strategy 3: corsproxy.io
    try {
        const resp = await fetch(`https://corsproxy.io/?${encodeURIComponent(apiUrl)}`);
        if (resp.ok) {
            const data = await resp.json();
            return _cacheBinData(key, data);
        }
    } catch { /* try next */ }

    // Strategy 4: api.codetabs.com
    try {
        const resp = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(apiUrl)}`);
        if (resp.ok) {
            const data = await resp.json();
            return _cacheBinData(key, data);
        }
    } catch { /* all proxies failed */ }

    return null;
}

function _cacheBinData(key, data) {
    BIN_CACHE[key] = {
        bin: data.bin || key,
        brand: data.brand || '',
        type: data.type || '',
        level: data.level || '',
        bank: data.bank || '',
        country: data.country || '',
        phone: data.phone || '',
        url: data.url || '',
    };
    saveBinCache();
    return BIN_CACHE[key];
}

function formatBinInfoText(info) {
    if (!info || info.error) return '';
    const parts = [];
    if (info.brand) parts.push(info.brand);
    if (info.type) parts.push(info.type);
    if (info.bank) parts.push(info.bank);
    return parts.join(' • ');
}

// ──── COUNTRY DATABASE (ISO 3166-1 alpha-2) ────
function isoToFlag(code) {
    return code.toUpperCase().replace(/./g, ch => String.fromCodePoint(0x1F1E6 - 65 + ch.charCodeAt(0)));
}

const COUNTRY_DB = {
    AB: 'Abkhazia', AD: 'Andorra', AE: 'United Arab Emirates', AF: 'Afghanistan', AG: 'Antigua and Barbuda',
    AI: 'Anguilla', AL: 'Albania', AM: 'Armenia', AO: 'Angola', AQ: 'Antarctica', AR: 'Argentina',
    AS: 'American Samoa', AT: 'Austria', AU: 'Australia', AW: 'Aruba', AX: 'Åland Islands', AZ: 'Azerbaijan',
    BA: 'Bosnia and Herzegovina', BB: 'Barbados', BD: 'Bangladesh', BE: 'Belgium', BF: 'Burkina Faso',
    BG: 'Bulgaria', BH: 'Bahrain', BI: 'Burundi', BJ: 'Benin', BL: 'Saint Barthélemy', BM: 'Bermuda',
    BN: 'Brunei', BO: 'Bolivia', BQ: 'Bonaire', BR: 'Brazil', BS: 'Bahamas', BT: 'Bhutan', BV: 'Bouvet Island',
    BW: 'Botswana', BY: 'Belarus', BZ: 'Belize', CA: 'Canada', CC: 'Cocos Islands', CD: 'Congo DR',
    CF: 'Central African Republic', CG: 'Congo', CH: 'Switzerland', CI: "Côte d'Ivoire", CK: 'Cook Islands',
    CL: 'Chile', CM: 'Cameroon', CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CU: 'Cuba', CV: 'Cape Verde',
    CW: 'Curaçao', CX: 'Christmas Island', CY: 'Cyprus', CZ: 'Czech Republic', DE: 'Germany', DJ: 'Djibouti',
    DK: 'Denmark', DM: 'Dominica', DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador', EE: 'Estonia',
    EG: 'Egypt', EH: 'Western Sahara', ER: 'Eritrea', ES: 'Spain', ET: 'Ethiopia', FI: 'Finland', FJ: 'Fiji',
    FK: 'Falkland Islands', FM: 'Micronesia', FO: 'Faroe Islands', FR: 'France', GA: 'Gabon', GB: 'United Kingdom',
    GD: 'Grenada', GE: 'Georgia', GF: 'French Guiana', GG: 'Guernsey', GH: 'Ghana', GI: 'Gibraltar',
    GL: 'Greenland', GM: 'Gambia', GN: 'Guinea', GP: 'Guadeloupe', GQ: 'Equatorial Guinea', GR: 'Greece',
    GS: 'South Georgia', GT: 'Guatemala', GU: 'Guam', GW: 'Guinea-Bissau', GY: 'Guyana', HK: 'Hong Kong',
    HM: 'Heard Island', HN: 'Honduras', HR: 'Croatia', HT: 'Haiti', HU: 'Hungary', ID: 'Indonesia',
    IE: 'Ireland', IL: 'Israel', IM: 'Isle of Man', IN: 'India', IO: 'British Indian Ocean Territory',
    IQ: 'Iraq', IR: 'Iran', IS: 'Iceland', IT: 'Italy', JE: 'Jersey', JM: 'Jamaica', JO: 'Jordan', JP: 'Japan',
    KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia', KI: 'Kiribati', KM: 'Comoros', KN: 'Saint Kitts and Nevis',
    KP: 'North Korea', KR: 'South Korea', KW: 'Kuwait', KY: 'Cayman Islands', KZ: 'Kazakhstan',
    LA: 'Laos', LB: 'Lebanon', LC: 'Saint Lucia', LI: 'Liechtenstein', LK: 'Sri Lanka', LR: 'Liberia',
    LS: 'Lesotho', LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia', LY: 'Libya', MA: 'Morocco', MC: 'Monaco',
    MD: 'Moldova', ME: 'Montenegro', MF: 'Saint Martin', MG: 'Madagascar', MH: 'Marshall Islands',
    MK: 'North Macedonia', ML: 'Mali', MM: 'Myanmar', MN: 'Mongolia', MO: 'Macao', MP: 'Northern Mariana Islands',
    MQ: 'Martinique', MR: 'Mauritania', MS: 'Montserrat', MT: 'Malta', MU: 'Mauritius', MV: 'Maldives',
    MW: 'Malawi', MX: 'Mexico', MY: 'Malaysia', MZ: 'Mozambique', NA: 'Namibia', NC: 'New Caledonia',
    NE: 'Niger', NF: 'Norfolk Island', NG: 'Nigeria', NI: 'Nicaragua', NL: 'Netherlands', NO: 'Norway',
    NP: 'Nepal', NR: 'Nauru', NU: 'Niue', NZ: 'New Zealand', OM: 'Oman', OS: 'South Ossetia', PA: 'Panama',
    PE: 'Peru', PF: 'French Polynesia', PG: 'Papua New Guinea', PH: 'Philippines', PK: 'Pakistan',
    PL: 'Poland', PM: 'Saint Pierre and Miquelon', PN: 'Pitcairn', PR: 'Puerto Rico',
    PS: 'Palestine', PT: 'Portugal', PW: 'Palau', PY: 'Paraguay', QA: 'Qatar', RE: 'Réunion', RO: 'Romania',
    RS: 'Serbia', RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia', SB: 'Solomon Islands', SC: 'Seychelles',
    SD: 'Sudan', SE: 'Sweden', SG: 'Singapore', SH: 'Saint Helena', SI: 'Slovenia', SJ: 'Svalbard',
    SK: 'Slovakia', SL: 'Sierra Leone', SM: 'San Marino', SN: 'Senegal', SO: 'Somalia', SR: 'Suriname',
    SS: 'South Sudan', ST: 'São Tomé and Príncipe', SV: 'El Salvador', SX: 'Sint Maarten',
    SY: 'Syria', SZ: 'Eswatini', TC: 'Turks and Caicos', TD: 'Chad', TF: 'French Southern Territories',
    TG: 'Togo', TH: 'Thailand', TJ: 'Tajikistan', TK: 'Tokelau', TL: 'Timor-Leste', TM: 'Turkmenistan',
    TN: 'Tunisia', TO: 'Tonga', TR: 'Turkey', TT: 'Trinidad and Tobago', TV: 'Tuvalu', TW: 'Taiwan',
    TZ: 'Tanzania', UA: 'Ukraine', UG: 'Uganda', UM: 'US Minor Outlying Islands', US: 'United States',
    UY: 'Uruguay', UZ: 'Uzbekistan', VA: 'Vatican City', VC: 'Saint Vincent and the Grenadines',
    VE: 'Venezuela', VG: 'British Virgin Islands', VI: 'US Virgin Islands', VN: 'Vietnam', VU: 'Vanuatu',
    WF: 'Wallis and Futuna', WS: 'Samoa', YE: 'Yemen', YT: 'Mayotte', ZA: 'South Africa', ZM: 'Zambia',
    ZW: 'Zimbabwe'
};

// ──── HELPERS ────
function genId() {
    try { return crypto.randomUUID(); }
    catch { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
}

function getCardType(num) {
    const n = num.replace(/[\s\-]/g, '');
    if (!n) return '';
    // AMEX: 34, 37
    if (/^3[47]/.test(n)) return 'AMEX';
    // VISA Electron: 4026, 417500, 4508, 4844, 4913, 4917
    if (/^(4026|417500|4508|4844|4913|4917)/.test(n)) return 'ELECTRON';
    // VISA: starts with 4
    if (/^4/.test(n)) return 'VISA';
    // MASTERCARD: 51-55, 2221-2720
    if (/^5[1-5]/.test(n) || /^(222[1-9]|22[3-9]\d|2[3-6]\d{2}|27[01]\d|2720)/.test(n)) return 'MASTERCARD';
    // MAESTRO: 5018, 5020, 5038, 5612, 5893, 6304, 6759, 6761, 6762, 6763
    if (/^(5018|5020|5038|5612|5893|6304|6759|676[1-3])/.test(n)) return 'MAESTRO';
    // DISCOVER: 6011, 622126-622925, 644-649, 65
    if (/^(6011|64[4-9]|65|622)/.test(n)) return 'DISCOVER';
    // JCB: 3528-3589
    if (/^35(2[89]|[3-8]\d)/.test(n)) return 'JCB';
    // DINERS: 300-305, 36, 38
    if (/^(30[0-5]|36|38)/.test(n)) return 'DINERS';
    // UNIONPAY: 62
    if (/^62/.test(n)) return 'UNIONPAY';
    // MIR: 2200-2204
    if (/^220[0-4]/.test(n)) return 'MIR';
    return '';
}

function getBin(num) { return num.replace(/\s/g, '').slice(0, 6); }

function maskCard(num) {
    const n = num.replace(/\s/g, '');
    if (n.length < 8) return n;
    return n.slice(0, 6) + ' •••• ' + n.slice(-4);
}

function formatCardInput(val) {
    const n = val.replace(/\D/g, '').slice(0, 16);
    return n.replace(/(.{4})/g, '$1 ').trim();
}

function todayStr() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
}

function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.classList.add('toast-exit'); setTimeout(() => el.remove(), 300); }, 3000);
}

function save() {
    try {
        localStorage.setItem('ct_cards', JSON.stringify(STATE.cards));
        localStorage.setItem('ct_docs', JSON.stringify(STATE.docs));
        localStorage.setItem('ct_notes_tabs', JSON.stringify(STATE.notesTabs));
        localStorage.setItem('ct_notes_active', STATE.notesActiveTab);
        localStorage.setItem('ct_notes', STATE.notes);
        localStorage.setItem('ct_trash', JSON.stringify(STATE.trash));
        localStorage.setItem('ct_countries', JSON.stringify(STATE.countries));
        localStorage.setItem('ct_settings', JSON.stringify(STATE.settings || {}));
        localStorage.setItem('ct_merchants', JSON.stringify(STATE.merchants));
        localStorage.setItem('ct_merchant_bins', JSON.stringify(STATE.merchantBins));
        localStorage.setItem('ct_trash_cards', JSON.stringify(STATE.trashCards || []));
        saveBinCache();
    } catch (e) {
        console.error('Save error:', e);
        toast('Storage error — data may not persist', 'error');
    }
}

function load() {
    try {
        STATE.cards = JSON.parse(localStorage.getItem('ct_cards') || '[]');
        STATE.docs = JSON.parse(localStorage.getItem('ct_docs') || '[]');
        STATE.notes = localStorage.getItem('ct_notes') || '';
        STATE.trash = JSON.parse(localStorage.getItem('ct_trash') || '[]');
        const saved = localStorage.getItem('ct_countries');
        if (saved) STATE.countries = JSON.parse(saved);
        const settings = localStorage.getItem('ct_settings');
        if (settings) STATE.settings = JSON.parse(settings);
        const merchRaw = localStorage.getItem('ct_merchants');
        if (merchRaw) STATE.merchants = JSON.parse(merchRaw);
        const merchBinsRaw = localStorage.getItem('ct_merchant_bins');
        if (merchBinsRaw) STATE.merchantBins = JSON.parse(merchBinsRaw);
        // Load trashCards
        const trashCardsRaw = localStorage.getItem('ct_trash_cards');
        if (trashCardsRaw) STATE.trashCards = JSON.parse(trashCardsRaw);
        // Load parser base
        const parserBaseRaw = localStorage.getItem('ct_parser_base');
        if (parserBaseRaw) {
            try {
                const pb = JSON.parse(parserBaseRaw);
                PARSER_STATE.collected = pb.collected || [];
                PARSER_STATE.file = pb.file || '';
            } catch (e) { }
        }
        // Load notesTabs
        const tabsRaw = localStorage.getItem('ct_notes_tabs');
        if (tabsRaw) {
            STATE.notesTabs = JSON.parse(tabsRaw);
            STATE.notesActiveTab = localStorage.getItem('ct_notes_active') || (STATE.notesTabs[0]?.id || '');
        }
    } catch (e) {
        console.error('Load error:', e);
    }
    loadBinCache();
    ensureDataIntegrity();
    migrateNotesToTabs();
}

function migrateNotesToTabs() {
    if (STATE.notesTabs.length === 0) {
        const firstTab = {
            id: 'tab-' + Date.now(),
            title: 'Main',
            content: STATE.notes || '',
            pinned: false,
            tag: null,
            created: Date.now(),
            scrollPos: 0
        };
        STATE.notesTabs = [firstTab];
        STATE.notesActiveTab = firstTab.id;
    }
}

// Ensure every record has a unique ID and required fields
function ensureDataIntegrity() {
    const seenIds = new Set();
    function fixId(item) {
        if (!item.id || seenIds.has(item.id)) item.id = genId();
        seenIds.add(item.id);
        return item;
    }
    STATE.cards = STATE.cards.map(fixId);
    STATE.docs = STATE.docs.map(fixId);
    STATE.trash = STATE.trash.map(fixId);

    // ── Migration: link existing cards ↔ docs ──
    // Ensure every doc has cardIds array
    STATE.docs.forEach(d => { if (!d.cardIds) d.cardIds = []; });
    // Link cards that have name+surname to matching docs
    STATE.cards.forEach(card => {
        if (card.docId) return; // already linked
        const fullName = `${card.name || ''} ${card.surname || ''}`.trim().toUpperCase();
        if (!fullName || fullName === 'UNKNOWN') return;
        const doc = STATE.docs.find(d => d.fullName === fullName && d.country === card.country);
        if (doc) {
            card.docId = doc.id;
            if (!doc.cardIds.includes(card.id)) doc.cardIds.push(card.id);
        }
    });
}

// ──── AUTO DOC CREATION (with card↔doc linking) ────
function ensureDoc(card) {
    const fullName = `${card.name} ${card.surname}`.trim().toUpperCase();
    if (!fullName || fullName === 'UNKNOWN') return;
    const existing = STATE.docs.find(d => d.fullName === fullName && d.country === card.country);
    if (existing) {
        existing.use = (existing.use || 0) + 1;
        if (!existing.cardIds) existing.cardIds = [];
        if (!existing.cardIds.includes(card.id)) existing.cardIds.push(card.id);
        card.docId = existing.id;
    } else {
        const docId = genId();
        STATE.docs.push({
            id: docId,
            fullName,
            name: card.name,
            surname: card.surname,
            country: card.country,
            type: '-',
            use: 1,
            cardIds: [card.id],
            verified: 0,
            suspended: 0,
            status: 'waiting',
            date: todayStr(),
            notes: ''
        });
        card.docId = docId;
    }
}

// ──── FAVORITES LOGIC ────
// Card goes to favorites when both cardAdd AND runAds are true
function isFavorite(card) { return card.cardAdd && card.runAds; }

// ──── ACTIVE NOW LOGIC ────
// Card is in Active Now when star is toggled on
function isActiveNow(card) { return !!card.starred; }

// ──── GEO FILTER (My Card / Global Docs) ────
let _geoFilter = 'all'; // 'all' or country id

// ──── MULTI-SELECT ────
let _selectedCards = new Set();

// ──── BIN COUNT ────
function binCount(bin, countryFilter) {
    return STATE.cards.filter(c => getBin(c.cardNumber) === bin && (!countryFilter || c.country === countryFilter)).length;
}

// ──── FILTERED CARDS ────
function sortCards(cards, field, dir) {
    const mult = dir === 'asc' ? 1 : -1;

    // Pre-build BIN count map from the full cards array for efficient sort
    let binCountMap = null;
    if (field === 'bin') {
        binCountMap = {};
        cards.forEach(c => {
            const b = getBin(c.cardNumber);
            binCountMap[b] = (binCountMap[b] || 0) + 1;
        });
    }

    return [...cards].sort((a, b) => {
        let va, vb;
        switch (field) {
            case 'name':
                va = `${a.name} ${a.surname}`.toLowerCase();
                vb = `${b.name} ${b.surname}`.toLowerCase();
                return mult * va.localeCompare(vb);
            case 'notes':
                va = (a.notes || '').toLowerCase(); vb = (b.notes || '').toLowerCase();
                return mult * va.localeCompare(vb);
            case 'bin': {
                const binA = getBin(a.cardNumber);
                const binB = getBin(b.cardNumber);
                const countA = binCountMap[binA] || 0;
                const countB = binCountMap[binB] || 0;
                // Primary: sort by count (numeric)
                if (countA !== countB) return mult * (countA - countB);
                // Tiebreaker: sort by BIN value (numeric)
                return mult * (parseInt(binA, 10) - parseInt(binB, 10));
            }
            case 'type':
                va = (a.docType || '').toLowerCase(); vb = (b.docType || '').toLowerCase();
                return mult * va.localeCompare(vb);
            case 'amount':
                va = parseFloat(a.amount) || 0; vb = parseFloat(b.amount) || 0;
                return mult * (va - vb);
            case 'status':
                va = (a.verified ? 8 : 0) + (a.minic ? 4 : 0) + (a.runAds ? 2 : 0) + (a.cardAdd ? 1 : 0);
                vb = (b.verified ? 8 : 0) + (b.minic ? 4 : 0) + (b.runAds ? 2 : 0) + (b.cardAdd ? 1 : 0);
                return mult * (va - vb);
            case 'mail':
                va = (a.mailVerify ? 2 : 0) + (a.mailSubmit ? 1 : 0);
                vb = (b.mailVerify ? 2 : 0) + (b.mailSubmit ? 1 : 0);
                return mult * (va - vb);
            case 'date':
                va = a.date || ''; vb = b.date || '';
                // DD.MM.YY → sortable
                const pa = va.split('.'); const pb = vb.split('.');
                const da = pa.length === 3 ? `${pa[2]}-${pa[1]}-${pa[0]}` : va;
                const db = pb.length === 3 ? `${pb[2]}-${pb[1]}-${pb[0]}` : vb;
                return mult * da.localeCompare(db);
            default:
                return 0;
        }
    });
}

function getFilteredCards() {
    let cards = [];
    switch (STATE.currentView) {
        case 'cards':
            cards = STATE.cards.filter(c => c.country === STATE.currentCountry);
            break;
        case 'my-card':
            cards = [...STATE.cards];
            if (_geoFilter !== 'all') cards = cards.filter(c => c.country === _geoFilter);
            break;
        case 'favorites':
            cards = STATE.cards.filter(c => isFavorite(c));
            break;
        case 'active-now':
            cards = STATE.cards.filter(c => isActiveNow(c));
            break;
        case 'ready-to-work':
            cards = STATE.cards.filter(c => c.readyToWork === true);
            break;
        case 'all-cards': {
            // Group by card number — show aggregate view
            const cardGroups = {};
            STATE.cards.forEach(c => {
                const num = c.cardNumber.replace(/\s/g, '');
                if (!cardGroups[num]) cardGroups[num] = [];
                cardGroups[num].push(c);
            });
            cards = Object.values(cardGroups).map(group => {
                const first = { ...group[0] };
                first._cardUsage = group.length;
                const uniqueNames = new Set(group.map(c => (c.name + ' ' + c.surname).toUpperCase()));
                first._nameCount = uniqueNames.size;
                first._groupCards = group;
                // Find latest date
                first._lastDate = group.reduce((latest, c) => {
                    if (!c.date) return latest;
                    const p = c.date.split('.');
                    const d = p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : c.date;
                    return d > latest ? d : latest;
                }, '');
                // Convert back to DD.MM.YY for display
                if (first._lastDate && first._lastDate.includes('-')) {
                    const pp = first._lastDate.split('-');
                    first._lastDate = `${pp[2]}.${pp[1]}.${pp[0]}`;
                }
                return first;
            });
            break;
        }
        case 'trash':
            cards = [...STATE.trash];
            break;
        default:
            cards = STATE.cards.filter(c => c.country === STATE.currentCountry);
    }

    // Build usage maps for badges (Workspace indicators)
    if (!['all-cards', 'trash'].includes(STATE.currentView)) {
        const cardUsageMap = {};
        const nameUsageMap = {};
        STATE.cards.forEach(c => {
            const num = c.cardNumber.replace(/\s/g, '');
            cardUsageMap[num] = (cardUsageMap[num] || 0) + 1;
            const fullName = (c.name + ' ' + c.surname).toUpperCase();
            nameUsageMap[fullName] = (nameUsageMap[fullName] || 0) + 1;
        });
        cards.forEach(c => {
            const num = c.cardNumber.replace(/\s/g, '');
            c._cardUsage = cardUsageMap[num] || 1;
            c._nameUsage = nameUsageMap[(c.name + ' ' + c.surname).toUpperCase()] || 1;
        });
    }

    if (STATE.search.length >= 2) {
        const s = STATE.search.toLowerCase();
        cards = cards.filter(c =>
            (c.name + ' ' + c.surname).toLowerCase().includes(s) ||
            c.cardNumber.includes(s) ||
            getBin(c.cardNumber).includes(s) ||
            (c.notes || '').toLowerCase().includes(s) ||
            (c.mailVerify && 'v-cc'.includes(s)) ||
            (c.mailSubmit && 's-doc'.includes(s))
        );
    }
    // Apply sorting
    if (STATE.sortField) {
        cards = sortCards(cards, STATE.sortField, STATE.sortDir);
    }
    return cards;
}

function getFilteredDocs() {
    let docs;
    if (STATE.currentView === 'global-docs') {
        docs = [...STATE.docs];
        if (_geoFilter !== 'all') docs = docs.filter(d => d.country === _geoFilter);
    } else {
        docs = STATE.docs.filter(d => d.country === STATE.currentCountry);
    }
    if (STATE.search.length >= 2) {
        const s = STATE.search.toLowerCase();
        docs = docs.filter(d => d.fullName.toLowerCase().includes(s) || (d.notes || '').toLowerCase().includes(s));
    }

    // Apply doc sorting
    if (STATE.docSortField) {
        const mult = STATE.docSortDir === 'asc' ? 1 : -1;
        docs = [...docs].sort((a, b) => {
            if (STATE.docSortField === 'name') {
                return mult * (a.fullName || '').localeCompare(b.fullName || '');
            }
            if (STATE.docSortField === 'notes') {
                return mult * (a.notes || '').localeCompare(b.notes || '');
            }
            if (STATE.docSortField === 'type') {
                return mult * (a.type || '').localeCompare(b.type || '');
            }
            if (STATE.docSortField === 'geo') {
                return mult * (a.country || '').localeCompare(b.country || '');
            }
            if (STATE.docSortField === 'use') {
                return mult * ((a.use || 0) - (b.use || 0));
            }
            if (STATE.docSortField === 'vs') {
                return mult * ((a.verified || 0) + (a.suspended || 0) - ((b.verified || 0) + (b.suspended || 0)));
            }
            if (STATE.docSortField === 'date') {
                const pa = (a.date || '').split('.'); const pb = (b.date || '').split('.');
                const da = pa.length === 3 ? `${pa[2]}-${pa[1]}-${pa[0]}` : a.date || '';
                const db = pb.length === 3 ? `${pb[2]}-${pb[1]}-${pb[0]}` : b.date || '';
                return mult * da.localeCompare(db);
            }
            return 0;
        });
    }
    return docs;
}

// ──── STATS ────
function getCardStats(cards) {
    return {
        total: cards.length,
        verified: cards.filter(c => c.verified).length,
        suspended: cards.filter(c => c.suspended).length,
        cardAdd: cards.filter(c => c.cardAdd).length,
        runAds: cards.filter(c => c.runAds).length,
        minic: cards.filter(c => c.minic).length,
        active: cards.filter(c => c.starred).length,
    };
}

function getMyCardStats() {
    const all = STATE.cards;
    const bins = {};
    all.forEach(c => {
        const b = getBin(c.cardNumber);
        bins[b] = (bins[b] || 0) + 1;
    });
    const topBins = Object.keys(bins).length;
    return {
        totalCards: all.length,
        cardAdd: all.filter(c => c.cardAdd).length,
        runAds: all.filter(c => c.runAds).length,
        verify: all.filter(c => c.verified).length,
        minic: all.filter(c => c.minic).length,
        topCards: all.filter(c => c.cardAdd && c.runAds).length,
        topBins,
    };
}

function getDocStats(docs) {
    const totalV = docs.reduce((sum, d) => sum + (d.verified || 0), 0);
    const totalS = docs.reduce((sum, d) => sum + (d.suspended || 0), 0);
    const waiting = docs.filter(d => (d.verified || 0) === 0 && (d.suspended || 0) === 0).length;
    return {
        total: docs.length,
        verified: totalV,
        failed: totalS,
        waiting: waiting,
    };
}

// ══════════════════════════════════════
//          COUNT COLOR HELPER
// ══════════════════════════════════════
function getCountColor(count) {
    if (count >= 20) return 'count-red';
    if (count >= 15) return 'count-orange';
    if (count >= 10) return 'count-yellow';
    if (count >= 5) return 'count-green';
    return '';
}

// ══════════════════════════════════════
//          RENDERING
// ══════════════════════════════════════

function renderSidebar() { renderTopNav(); }

function renderTopNav() {
    const sel = document.getElementById('tn-country');
    if (sel) {
        const prev = sel.value;
        sel.innerHTML = STATE.countries.map(c => {
            const cnt = STATE.cards.filter(card => card.country === c.id).length;
            return `<option value="${c.id}">${c.flag} ${c.name} (${cnt})</option>`;
        }).join('');
        sel.value = STATE.currentCountry || (STATE.countries[0]?.id || '');
        if (!prev) sel.value = STATE.currentCountry;
    }
    document.querySelectorAll('.tn-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === STATE.currentView);
    });
    const badge = document.getElementById('badge-trash');
    if (badge) badge.textContent = STATE.trash.length || '';
}

// Top nav tab clicks
document.querySelectorAll('.tn-tab').forEach(tab => {
    tab.addEventListener('click', () => navigate(tab.dataset.view));
});

// Country dropdown
document.getElementById('tn-country')?.addEventListener('change', function () {
    navigate('cards', this.value);
});

// Settings dropdown
document.getElementById('tn-settings-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('tn-settings-dropdown')?.classList.toggle('hidden');
});
document.addEventListener('click', () => {
    document.getElementById('tn-settings-dropdown')?.classList.add('hidden');
});

// ──── TOP BINS ────
let _topBinsMode = 'count'; // 'count' or 'amount'

function updateTopBinsGeo() {
    const sel = document.getElementById('top-bins-geo');
    if (!sel) return;
    const current = sel.value;
    const geos = new Set();
    STATE.cards.forEach(c => { if (c.country) geos.add(c.country); });

    let html = '<option value="all">ALL</option>';
    STATE.countries.forEach(c => {
        if (geos.has(c.id)) {
            const code = c.id === 'canada' ? 'CA' : c.id === 'usa' ? 'US' : c.id.slice(0, 2).toUpperCase();
            html += `<option value="${c.id}">${code}</option>`;
        }
    });
    sel.innerHTML = html;
    // Restore previous selection if still valid
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

function renderTopBins() {
    const container = document.getElementById('top-bins-list');
    if (!container) return;

    const geo = document.getElementById('top-bins-geo')?.value || 'all';
    let cards = STATE.cards;
    if (geo !== 'all') cards = cards.filter(c => c.country === geo);

    if (cards.length === 0) {
        container.innerHTML = '<div class="top-bins-empty">No data</div>';
        return;
    }

    // Group by BIN (first 6 digits)
    const bins = {};
    cards.forEach(c => {
        const num = (c.cardNumber || '').replace(/[\s\-]/g, '');
        if (num.length < 6) return;
        const bin = num.slice(0, 6);

        if (!bins[bin]) bins[bin] = { count: 0, amount: 0 };
        bins[bin].count++;
        const amt = parseFloat(c.amount);
        if (!isNaN(amt)) bins[bin].amount += amt;
    });

    // Sort by mode — TOP 10
    const sorted = Object.entries(bins)
        .sort((a, b) => b[1][_topBinsMode] - a[1][_topBinsMode])
        .slice(0, 10);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="top-bins-empty">No BINs found</div>';
        return;
    }

    const maxVal = sorted[0][1][_topBinsMode] || 1;

    container.innerHTML = sorted.map(([bin, data]) => {
        const val = _topBinsMode === 'count' ? data.count : `$${data.amount.toLocaleString()}`;
        const pct = Math.round((data[_topBinsMode] / maxVal) * 100);
        // Look up bank name from BIN_CACHE
        const cached = BIN_CACHE[bin];
        const bankName = cached ? (cached.bank || cached.issuer || 'Unknown Bank') : 'Unknown Bank';
        const shortBank = bankName.length > 18 ? bankName.slice(0, 18) + '…' : bankName;
        return `<div class="top-bins-row">
            <div class="top-bins-bar" style="width:${pct}%"></div>
            <div class="top-bins-info">
                <span class="top-bins-bin">${bin}</span>
                <span class="top-bins-bank">${shortBank}</span>
            </div>
            <span class="top-bins-val">${val}</span>
        </div>`;
    }).join('');
}

// TOP BINS event handlers
document.getElementById('top-bins-geo')?.addEventListener('change', renderTopBins);

document.querySelectorAll('.top-bins-mode').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.top-bins-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _topBinsMode = btn.dataset.mode;
        renderTopBins();
    });
});

function renderStats() {
    const bar = document.getElementById('stats-bar');

    if (['notes', 'generator', 'builder', 'merchants', 'analytics', 'tasks', 'prompts'].includes(STATE.currentView)) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'grid';

    if (STATE.currentView === 'docs' || STATE.currentView === 'global-docs') {
        const docs = getFilteredDocs();
        const s = getDocStats(docs);
        bar.innerHTML = `
            <div class="stat-card total"><span class="stat-label">Total</span><span class="stat-value">${s.total}</span></div>
            <div class="stat-card verified"><span class="stat-label">Verified</span><span class="stat-value">${s.verified}</span></div>
            <div class="stat-card failed"><span class="stat-label">Failed</span><span class="stat-value">${s.failed}</span></div>
            <div class="stat-card waiting"><span class="stat-label">Waiting</span><span class="stat-value">${s.waiting}</span></div>
        `;
        return;
    }

    if (STATE.currentView === 'all-cards') {
        const cards = getFilteredCards();
        const totalUse = cards.reduce((s, c) => s + (c._cardUsage || 1), 0);
        const avgUse = cards.length > 0 ? (totalUse / cards.length).toFixed(1) : '0';
        bar.innerHTML = `
            <div class="stat-card total"><span class="stat-label">Unique Cards</span><span class="stat-value">${cards.length}</span></div>
            <div class="stat-card card-add"><span class="stat-label">Total Use</span><span class="stat-value">${totalUse}</span></div>
            <div class="stat-card run-ads"><span class="stat-label">Avg Use</span><span class="stat-value">${avgUse}</span></div>
        `;
        return;
    }

    if (STATE.currentView === 'my-card') {
        const s = getMyCardStats();
        bar.innerHTML = `
            <div class="stat-card total"><span class="stat-label">Total Cards</span><span class="stat-value">${s.totalCards}</span></div>
            <div class="stat-card card-add"><span class="stat-label">Card Add</span><span class="stat-value">${s.cardAdd}</span></div>
            <div class="stat-card run-ads"><span class="stat-label">Run Ads</span><span class="stat-value">${s.runAds}</span></div>
            <div class="stat-card verified"><span class="stat-label">Verify</span><span class="stat-value">${s.verify}</span></div>
            <div class="stat-card minic"><span class="stat-label">Minic</span><span class="stat-value">${s.minic}</span></div>
            <div class="stat-card top-cards"><span class="stat-label">Top Cards</span><span class="stat-value">${s.topCards}</span></div>
            <div class="stat-card top-bins"><span class="stat-label">Top BINs</span><span class="stat-value">${s.topBins}</span></div>
        `;
        return;
    }

    // Cards view (country / favorites / active / trash)
    const cards = getFilteredCards();
    const s = getCardStats(cards);
    bar.innerHTML = `
        <div class="stat-card total"><span class="stat-label">Total</span><span class="stat-value">${s.total}</span></div>
        <div class="stat-card verified"><span class="stat-label">Verified</span><span class="stat-value">${s.verified}</span></div>
        <div class="stat-card suspended"><span class="stat-label">Suspended</span><span class="stat-value">${s.suspended}</span></div>
        <div class="stat-card card-add"><span class="stat-label">Card Add</span><span class="stat-value">${s.cardAdd}</span></div>
        <div class="stat-card run-ads"><span class="stat-label">Run Ads</span><span class="stat-value">${s.runAds}</span></div>
        <div class="stat-card active-stat"><span class="stat-label">Active</span><span class="stat-value">${s.active}</span></div>
    `;
}


// ═══════════════════════════════════════════
//  ANALYTICS MODULE — BIN Performance
// ═══════════════════════════════════════════

let _anPeriod = 0; // 0 = all, 7/14/30 = days

// Parse DD.MM.YY string to timestamp
function _anParseDate(dateStr) {
    if (!dateStr) return 0;
    if (typeof dateStr === 'number') return dateStr;
    const parts = dateStr.split('.');
    if (parts.length !== 3) return 0;
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = 2000 + parseInt(parts[2]);
    return new Date(year, month, day).getTime();
}

function renderAnalytics() {
    const area = document.getElementById('content-area');
    const now = Date.now();
    const DAY = 86400000;

    // Get all cards (current country)
    const allCards = STATE.cards.filter(c => c.country === STATE.currentCountry);

    // Period filter
    const periodMs = _anPeriod > 0 ? _anPeriod * DAY : 0;
    const cards = periodMs > 0
        ? allCards.filter(c => { const t = _anParseDate(c.date); return t && (now - t) <= periodMs; })
        : allCards;

    // Previous period cards for trend comparison
    const prevCards = periodMs > 0
        ? allCards.filter(c => { const t = _anParseDate(c.date); return t && (now - t) > periodMs && (now - t) <= periodMs * 2; })
        : [];

    // Build BIN stats
    const binMap = {};
    cards.forEach(c => {
        const bin = getBin(c.cardNumber);
        if (!bin || bin.length < 6) return;
        if (!binMap[bin]) binMap[bin] = { bin, used: 0, a: 0, r: 0, v: 0, m: 0, cards: [] };
        binMap[bin].used++;
        if (c.cardAdd) binMap[bin].a++;
        if (c.runAds) binMap[bin].r++;
        if (c.verified) binMap[bin].v++;
        if (c.minic) binMap[bin].m++;
        binMap[bin].cards.push(c);
    });

    // Previous period BIN stats for trend
    const prevBinMap = {};
    prevCards.forEach(c => {
        const bin = getBin(c.cardNumber);
        if (!bin || bin.length < 6) return;
        if (!prevBinMap[bin]) prevBinMap[bin] = { used: 0, a: 0 };
        prevBinMap[bin].used++;
        if (c.cardAdd) prevBinMap[bin].a++;
    });

    // Sort by USED desc
    const bins = Object.values(binMap).sort((a, b) => b.used - a.used);

    // Build grid rows
    let rowsHtml = '';
    if (bins.length === 0) {
        rowsHtml = '<div class="an-empty">No data for this period</div>';
    } else {
        bins.forEach(b => {
            const rate = b.used > 0 ? Math.round((b.a / b.used) * 100) : 0;

            // Trend calculation
            let trendHtml = '<span class="an-trend an-trend-na">——</span>';
            if (_anPeriod > 0 && prevBinMap[b.bin]) {
                const prevRate = prevBinMap[b.bin].used > 0
                    ? Math.round((prevBinMap[b.bin].a / prevBinMap[b.bin].used) * 100) : 0;
                const delta = rate - prevRate;
                if (delta > 0) {
                    trendHtml = `<span class="an-trend an-trend-up">▲ +${delta}%</span>`;
                } else if (delta < 0) {
                    trendHtml = `<span class="an-trend an-trend-down">▼ ${delta}%</span>`;
                } else {
                    trendHtml = '<span class="an-trend an-trend-na">── 0%</span>';
                }
            }

            // Rate color class
            let rateClass = 'an-rate-bad';
            if (rate >= 60) rateClass = 'an-rate-good';
            else if (rate >= 30) rateClass = 'an-rate-mid';

            rowsHtml += `<div class="an-row" data-bin="${b.bin}">
                    <span class="an-cell an-cell-bin">${b.bin}</span>
                    <span class="an-cell an-cell-num">${b.used}</span>
                    <span class="an-cell an-cell-a">${b.a}</span>
                    <span class="an-cell an-cell-r">${b.r}</span>
                    <span class="an-cell an-cell-v">${b.v}</span>
                    <span class="an-cell an-cell-m">${b.m}</span>
                    <span class="an-cell ${rateClass}">${rate}%</span>
                    <span class="an-cell">${trendHtml}</span>
                </div>`;
        });
    }

    area.innerHTML = `
            <div class="an-workspace">
                <div class="an-period-bar">
                    <button class="an-period-btn ${_anPeriod === 7 ? 'active' : ''}" data-days="7">7d</button>
                    <button class="an-period-btn ${_anPeriod === 14 ? 'active' : ''}" data-days="14">14d</button>
                    <button class="an-period-btn ${_anPeriod === 30 ? 'active' : ''}" data-days="30">30d</button>
                    <button class="an-period-btn ${_anPeriod === 0 ? 'active' : ''}" data-days="0">All</button>
                    <span class="an-summary">${bins.length} BINs · ${cards.length} cards</span>
                </div>
                <div class="an-grid-wrap">
                    <div class="an-grid-header">
                        <span class="an-cell an-cell-bin">BIN</span>
                        <span class="an-cell an-cell-num">USED</span>
                        <span class="an-cell an-cell-a">A</span>
                        <span class="an-cell an-cell-r">R</span>
                        <span class="an-cell an-cell-v">V</span>
                        <span class="an-cell an-cell-m">M</span>
                        <span class="an-cell">RATE</span>
                        <span class="an-cell">TREND</span>
                    </div>
                    <div class="an-grid-body">${rowsHtml}</div>
                </div>
            </div>
            <div id="an-modal" class="an-modal hidden"></div>
        `;

    // Period button listeners
    area.querySelectorAll('.an-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _anPeriod = parseInt(btn.dataset.days);
            renderAnalytics();
        });
    });

    // Row click → detail modal
    area.querySelectorAll('.an-row').forEach(row => {
        row.addEventListener('click', () => {
            _anShowDetail(row.dataset.bin, binMap[row.dataset.bin], prevBinMap[row.dataset.bin]);
        });
    });
}

function _anShowDetail(bin, data, prevData) {
    const modal = document.getElementById('an-modal');
    if (!modal || !data) return;

    const rate = data.used > 0 ? Math.round((data.a / data.used) * 100) : 0;

    // Trend
    let trendStr = '——';
    if (_anPeriod > 0 && prevData) {
        const prevRate = prevData.used > 0 ? Math.round((prevData.a / prevData.used) * 100) : 0;
        const delta = rate - prevRate;
        if (delta > 0) trendStr = `▲ +${delta}%`;
        else if (delta < 0) trendStr = `▼ ${delta}%`;
        else trendStr = '── 0%';
    }

    // Rate color
    let rateClass = 'an-rate-bad';
    if (rate >= 60) rateClass = 'an-rate-good';
    else if (rate >= 30) rateClass = 'an-rate-mid';

    // Mini timeline — last 10 entries by date
    const sorted = [...data.cards].sort((a, b) => (_anParseDate(b.date) || 0) - (_anParseDate(a.date) || 0)).slice(0, 10);
    let timelineHtml = '';
    sorted.forEach(c => {
        const d = c.date || '—';
        let statusTag = '';
        if (c.cardAdd) statusTag += '<span class="an-tag an-tag-a">A</span>';
        if (c.runAds) statusTag += '<span class="an-tag an-tag-r">R</span>';
        if (c.verified) statusTag += '<span class="an-tag an-tag-v">V</span>';
        if (c.minic) statusTag += '<span class="an-tag an-tag-m">M</span>';
        if (!c.cardAdd && !c.runAds && !c.verified && !c.minic) statusTag = '<span class="an-tag an-tag-none">—</span>';
        timelineHtml += `<div class="an-tl-row"><span class="an-tl-date">${d}</span>${statusTag}</div>`;
    });

    // BIN info from cache
    const binInfo = BIN_CACHE[bin];
    let binMeta = '';
    if (binInfo) {
        binMeta = `<div class="an-detail-meta">${binInfo.scheme || ''} · ${binInfo.type || ''} · ${binInfo.bank || ''}</div>`;
    }

    modal.innerHTML = `
            <div class="an-detail">
                <div class="an-detail-header">
                    <span class="an-detail-bin">${bin}</span>
                    <button class="an-detail-close" id="an-close">✕</button>
                </div>
                ${binMeta}
                <div class="an-detail-stats">
                    <div class="an-detail-stat">
                        <span class="an-detail-label">USED</span>
                        <span class="an-detail-value">${data.used}</span>
                    </div>
                    <div class="an-detail-stat">
                        <span class="an-detail-label">A</span>
                        <span class="an-detail-value an-cell-a">${data.a}</span>
                    </div>
                    <div class="an-detail-stat">
                        <span class="an-detail-label">R</span>
                        <span class="an-detail-value an-cell-r">${data.r}</span>
                    </div>
                    <div class="an-detail-stat">
                        <span class="an-detail-label">V</span>
                        <span class="an-detail-value an-cell-v">${data.v}</span>
                    </div>
                    <div class="an-detail-stat">
                        <span class="an-detail-label">RATE</span>
                        <span class="an-detail-value ${rateClass}">${rate}%</span>
                    </div>
                    <div class="an-detail-stat">
                        <span class="an-detail-label">TREND</span>
                        <span class="an-detail-value">${trendStr}</span>
                    </div>
                </div>
                <div class="an-detail-tl-title">LAST ${sorted.length} ENTRIES</div>
                <div class="an-detail-tl">${timelineHtml}</div>
            </div>
        `;

    modal.classList.remove('hidden');

    document.getElementById('an-close').addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // Escape to close
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.classList.add('hidden');
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}



window.renderMerchants = renderMerchants;

// ── Log results storage (persistent across re-renders) ──
if (!STATE._logResults) STATE._logResults = [];

function renderMerchants() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    if (bar) bar.innerHTML = '';

    STATE.merchants.forEach(m => { if (!m.links) m.links = []; if (!m.tags) m.tags = []; });

    // ═══ COL 1: Merchant list ═══
    let listHtml = '';
    STATE.merchants.forEach(m => {
        const bins = STATE.merchantBins.filter(b => b.merchant_id === m.id);
        const uniqueBins = [...new Set(bins.map(b => b.bin))].length;
        const totalCnt = bins.reduce((s, b) => s + (b.cnt || 1), 0);
        listHtml += `<div class="fc-item" data-id="${m.id}">
            <span class="fc-item-name">${m.name}</span>
            <span class="fc-item-meta">${uniqueBins}·${totalCnt}</span>
        </div>`;
    });
    if (!STATE.merchants.length) listHtml = '<div class="fc-empty">No merchants</div>';

    // ═══ COL 3: BIN RESULTS (persistent from searches) ═══
    let col3Head = '<span class="fc-col-title">BIN RESULTS</span>';
    if (STATE._logResults.length > 0) {
        col3Head += `<button class="fc-ctx-btn fc-ctx-del" id="fc-clear-results" title="Clear all results" style="margin-left:auto">Clear All</button>`;
    }
    let col3Content = '';
    if (STATE._logResults.length > 0) {
        STATE._logResults.forEach((res, idx) => {
            col3Content += `<div class="fc-log-result-block" data-idx="${idx}">
                <div class="fc-log-result-head">
                    <span class="fc-log-result-label">Log #${idx + 1} — BIN: ${res.bins.join(', ')}</span>
                    <button class="fc-log-result-del" data-idx="${idx}" title="Remove this result">✕</button>
                </div>
                ${res.binHtml}
            </div>`;
        });
    } else {
        col3Content = '<div class="fc-empty">Search results will appear here</div>';
    }

    // ═══ COL 4: PARSED DATA (persistent from searches) ═══
    let col4Content = '';
    if (STATE._logResults.length > 0) {
        STATE._logResults.forEach((res, idx) => {
            if (res.parsedHtml) {
                col4Content += `<div class="fc-log-parsed-block" data-idx="${idx}">
                    <div class="fc-log-result-head">
                        <span class="fc-log-result-label">Log #${idx + 1}</span>
                        <button class="fc-log-parsed-del" data-idx="${idx}" title="Remove">✕</button>
                    </div>
                    ${res.parsedHtml}
                </div>`;
            }
        });
    }
    if (!col4Content) col4Content = '<div class="fc-empty">Parsed data will appear here</div>';

    // ═══ POPUP MODAL ═══
    const popupHtml = `
    <div class="mf-modal-overlay hidden" id="mf-modal">
        <div class="mf-modal">
            <div class="mf-modal-head">
                <span class="mf-modal-title" id="mf-modal-title">Add</span>
                <button class="mf-icon-btn mf-modal-close" id="mf-modal-close">✕</button>
            </div>
            <div class="mf-modal-body" id="mf-modal-body"></div>
        </div>
    </div>`;

    // ═══ RENDER: 4-COLUMN FINDER ═══
    area.innerHTML = `
    <div class="fc-finder">
        <div class="fc-col fc-col-merchants">
            <div class="fc-col-head">
                <span class="fc-col-title">MERCHANTS</span>
                <button class="fc-btn-plus" id="fc-add-merch">+</button>
            </div>
            <div id="fc-add-form" class="fc-add-form hidden">
                <input type="text" id="fc-merch-name" class="fc-input" placeholder="Name..." autocomplete="off">
                <button class="fc-btn-ok" id="fc-merch-save">OK</button>
            </div>
            <div class="fc-scroll" id="fc-list">${listHtml}</div>
        </div>
        <div class="fc-col fc-col-log fc-col-log-split">
            <div class="fc-col-head"><span class="fc-col-title">LOG ANALYSIS</span></div>
            <div class="fc-log-split-container">
                <!-- LEFT: Log Parser -->
                <div class="fc-log-left">
                    <textarea id="fc-textarea" class="fc-textarea" placeholder="Paste log here, then click SEARCH..."></textarea>
                    <button class="fc-btn-search" id="fc-search-btn">SEARCH</button>
                </div>
                <!-- RIGHT: Parsed Data + Billing Generator -->
                <div class="fc-log-right">
                    <!-- Card info from parsed log (top) -->
                    <div class="fc-card-info" id="fc-card-info">
                        <div class="fc-card-row mf-copy-field" data-copy="" id="ci-card"><span class="fc-card-label">💳</span> <span class="fc-card-val">—</span></div>
                        <div class="fc-card-row mf-copy-field" data-copy="" id="ci-exp"><span class="fc-card-label">📅</span> <span class="fc-card-val">—</span></div>
                        <div class="fc-card-row mf-copy-field" data-copy="" id="ci-cvv"><span class="fc-card-label">🔐</span> <span class="fc-card-val">—</span></div>
                        <div class="fc-card-row" id="ci-bininfo" style="font-size:11px;opacity:0.6;padding-top:2px"><span class="fc-card-val" style="font-size:11px">—</span></div>
                    </div>
                    <div class="fc-divider"></div>
                    <!-- Billing info (from log or generated) -->
                    <div class="fc-billing-info" id="fc-billing-info">
                        <div class="fc-billing-row mf-copy-field" data-copy="" id="bi-name"><span class="fc-billing-lbl">Name:</span> <span class="fc-billing-val fc-billing-name">—</span></div>
                        <div class="fc-billing-row mf-copy-field" data-copy="" id="bi-address"><span class="fc-billing-lbl">Address:</span> <span class="fc-billing-val">—</span></div>
                        <div class="fc-billing-row mf-copy-field" data-copy="" id="bi-city"><span class="fc-billing-lbl">City:</span> <span class="fc-billing-val">—</span></div>
                        <div class="fc-billing-row mf-copy-field" data-copy="" id="bi-zip"><span class="fc-billing-lbl">ZIP:</span> <span class="fc-billing-val">—</span></div>
                        <div class="fc-billing-row mf-copy-field" data-copy="" id="bi-phone"><span class="fc-billing-lbl">Phone:</span> <span class="fc-billing-val">—</span></div>
                    </div>
                    <div class="fc-divider"></div>
                    <!-- Country selector + Generate (bottom) -->
                    <div class="fc-country-select">
                        <select id="fc-country" class="fc-select">
                            <option value="US">🇺🇸 US</option>
                            <option value="UK">🇬🇧 UK</option>
                            <option value="CA">🇨🇦 CA</option>
                            <option value="AU">🇦🇺 AU</option>
                        </select>
                        <button class="fc-btn-generate" id="fc-generate-btn" title="Generate random billing info for selected country">GENERATE BILLING</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="fc-col fc-col-results" id="fc-col-results">
            <div class="fc-col-head fc-col-head-ctx">${col3Head}</div>
            <div class="fc-scroll" id="fc-results">${col3Content}</div>
        </div>
    </div>
    ${popupHtml}`;

    // ═══ EVENTS ═══

    // Add merchant
    document.getElementById('fc-add-merch').addEventListener('click', () => {
        const form = document.getElementById('fc-add-form');
        form.classList.toggle('hidden');
        if (!form.classList.contains('hidden')) { document.getElementById('fc-merch-name').value = ''; document.getElementById('fc-merch-name').focus(); }
    });
    document.getElementById('fc-merch-save').addEventListener('click', _mtSaveMerchant);
    document.getElementById('fc-merch-name').addEventListener('keydown', e => {
        if (e.key === 'Enter') _mtSaveMerchant();
        if (e.key === 'Escape') document.getElementById('fc-add-form').classList.add('hidden');
    });

    // Single click = highlight, Double click = open merchant popup form
    document.querySelectorAll('.fc-item').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.fc-item').forEach(x => x.classList.remove('fc-item-active'));
            el.classList.add('fc-item-active');
        });
        el.addEventListener('dblclick', () => {
            _openMerchantPopup(el.dataset.id);
        });
    });

    // ── Log results: delete individual ──
    document.querySelectorAll('.fc-log-result-del, .fc-log-parsed-del').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            STATE._logResults.splice(idx, 1);
            renderMerchants();
        });
    });

    // ── Clear All results ──
    document.getElementById('fc-clear-results')?.addEventListener('click', () => {
        STATE._logResults = [];
        renderMerchants();
        toast('Results cleared', 'info');
    });

    // ── Link BIN to merchant buttons (from search results) ──
    document.querySelectorAll('.fc-link-to-merch').forEach(btn => {
        btn.addEventListener('click', () => {
            const bin = btn.dataset.bin;
            const merchId = btn.dataset.merchId;
            const m = STATE.merchants.find(x => x.id === merchId);
            if (!bin || !merchId || !m) return;
            _addBinToMerchant(bin, '', merchId, '');
            toast(`BIN ${bin} linked to "${m.name}"`, 'success');
            renderMerchants();
        });
    });

    // ── Wire up copy-on-click in Col 4 ──
    document.querySelectorAll('.mf-copy-field').forEach(el => {
        el.addEventListener('click', () => {
            const val = el.dataset.copy;
            if (!val) return;
            navigator.clipboard.writeText(val).then(() => {
                toast('Copied: ' + val, 'success');
                el.classList.add('mf-copied');
                setTimeout(() => el.classList.remove('mf-copied'), 800);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = val; document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
                toast('Copied: ' + val, 'success');
            });
        });
    });

    // ── Wire up link copy buttons in Col 3 ──
    document.querySelectorAll('.fc-link-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const url = btn.dataset.url;
            navigator.clipboard.writeText(url).then(() => {
                toast('Copied: ' + url, 'success');
                btn.textContent = '✓';
                setTimeout(() => btn.textContent = '📋', 800);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = url; document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
                toast('Copied: ' + url, 'success');
            });
        });
    });

    // Search (only on button click or Ctrl+Enter)
    document.getElementById('fc-search-btn').addEventListener('click', _mtSearch);
    document.getElementById('fc-textarea').addEventListener('keydown', e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); _mtSearch(); }
    });

    // Generate Random Billing Info (only replaces billing, keeps card info)
    document.getElementById('fc-generate-btn')?.addEventListener('click', _generateRandomBilling);

    // Modal close
    document.getElementById('mf-modal-close')?.addEventListener('click', _mfCloseModal);
    document.getElementById('mf-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'mf-modal') _mfCloseModal();
    });

    // ═══ RESTORE parsed fields after render ═══
    if (STATE._lastParsedFields) {
        _updateParsedInfo(STATE._lastParsedFields);
    }
}

// ═══ MERCHANT POPUP FORM (dblclick) ═══
function _openMerchantPopup(merchantId) {
    const m = STATE.merchants.find(x => x.id === merchantId);
    if (!m) return;
    if (!m.links) m.links = [];
    if (!m.tags) m.tags = [];

    const mBins = STATE.merchantBins.filter(b => b.merchant_id === m.id);
    const uBins = [...new Set(mBins.map(b => b.bin))].length;

    // Tags HTML
    const tagsHtml = m.tags.map((t, i) =>
        `<span class="fc-tag">${t} <button class="fc-tag-x mfp-tag-del" data-idx="${i}">✕</button></span>`
    ).join('') || '<span class="fc-muted">No tags</span>';

    // Links HTML
    let linksHtml = '';
    m.links.forEach((l, i) => {
        linksHtml += `<div class="fc-data-row">
            <a href="${l.url}" target="_blank" rel="noopener" class="fc-link-tag">${l.label || l.url}</a>
            <div class="fc-row-actions" style="opacity:1">
                <button class="fc-row-btn mfp-link-edit" data-idx="${i}" title="Edit">✏️</button>
                <button class="fc-row-btn mfp-link-del" data-idx="${i}" title="Delete">✕</button>
            </div>
        </div>`;
    });
    if (!linksHtml) linksHtml = '<span class="fc-muted">No links</span>';

    // BINs HTML — compact table
    let binsHtml = '';
    if (mBins.length > 0) {
        const byBin = {};
        mBins.forEach(b => { if (!byBin[b.bin]) byBin[b.bin] = []; byBin[b.bin].push(b); });
        binsHtml = `<div class="mfp-bin-table">
            <div class="mfp-bin-row mfp-bin-header">
                <span class="mfp-bin-col-bin">BIN</span>
                <span class="mfp-bin-col-amt">Amount</span>
                <span class="mfp-bin-col-cur">Cur</span>
                <span class="mfp-bin-col-cnt">Cnt</span>
                <span class="mfp-bin-col-act"></span>
            </div>`;
        Object.entries(byBin).forEach(([bin, entries]) => {
            const amt = entries[0].amount || '—';
            const cur = entries[0].currency || '—';
            const cnt = entries.reduce((sum, e) => sum + (e.cnt || 1), 0);
            binsHtml += `<div class="mfp-bin-row">
                <span class="mfp-bin-col-bin mfp-bin-val">${bin}</span>
                <span class="mfp-bin-col-amt mfp-amt-val">${amt}</span>
                <span class="mfp-bin-col-cur">${cur}</span>
                <span class="mfp-bin-col-cnt">${cnt}x</span>
                <span class="mfp-bin-col-act"><button class="fc-row-btn mfp-bin-del" data-bin-id="${entries[0].id}" title="Delete">✕</button></span>
            </div>`;
        });
        binsHtml += `</div>`;
    } else {
        binsHtml = '<span class="fc-muted">No BINs</span>';
    }

    const bodyHtml = `
        <div class="mfp-merch-form">
            <!-- TAGS -->
            <div class="fc-card-section">
                <div class="fc-card-section-head">
                    <span class="fc-card-section-title">🏷️ TAGS</span>
                    <button class="fc-card-add-btn" id="mfp-add-tag">+ Tag</button>
                </div>
                <div id="mfp-tag-form" class="fc-inline-form hidden">
                    <input type="text" id="mfp-tag-input" class="mf-input mf-input-sm" placeholder="Tag..." autocomplete="off">
                    <button class="mf-btn-ok" id="mfp-tag-save">OK</button>
                </div>
                <div class="fc-tags-list" id="mfp-tags">${tagsHtml}</div>
            </div>
            <!-- LINKS -->
            <div class="fc-card-section">
                <div class="fc-card-section-head">
                    <span class="fc-card-section-title">🔗 LINKS</span>
                    <button class="fc-card-add-btn" id="mfp-add-link">+ Link</button>
                </div>
                <div id="mfp-link-form" class="fc-inline-form hidden">
                    <input type="text" id="mfp-link-label" class="mf-input mf-input-sm" placeholder="Label" autocomplete="off">
                    <input type="text" id="mfp-link-url" class="mf-input" placeholder="https://..." autocomplete="off">
                    <button class="mf-btn-ok" id="mfp-link-save">OK</button>
                </div>
                <div id="mfp-links">${linksHtml}</div>
            </div>
            <!-- BINs -->
            <div class="fc-card-section">
                <div class="fc-card-section-head">
                    <span class="fc-card-section-title">💳 BINs <span class="fc-muted">(${uBins} unique · ${mBins.length} total)</span></span>
                    <button class="fc-card-add-btn" id="mfp-add-bin">+ BIN</button>
                </div>
                <div id="mfp-bin-form" class="fc-inline-form hidden">
                    <input type="text" id="mfp-bin-input" class="mf-input mf-input-sm" placeholder="BIN (6)" maxlength="6" autocomplete="off">
                    <input type="text" id="mfp-bin-amount" class="mf-input mf-input-sm" placeholder="Amount" autocomplete="off">
                    <input type="text" id="mfp-bin-currency" class="mf-input" style="max-width:50px" placeholder="EUR" maxlength="3" autocomplete="off">
                    <button class="mf-btn-ok" id="mfp-bin-save">OK</button>
                </div>
                <div id="mfp-bin-bulk-form" class="fc-inline-form hidden">
                    <textarea id="mfp-bin-bulk" class="mf-modal-textarea" rows="3" placeholder="412650 - 1,269.00 EUR&#10;450553, 424242"></textarea>
                    <button class="mf-btn-ok mf-btn-wide" id="mfp-bin-bulk-save">+ Add All</button>
                </div>
                <div id="mfp-bins">${binsHtml}</div>
            </div>
            <!-- Actions -->
            <div style="display:flex;gap:6px;margin-top:8px">
                <button class="fc-ctx-btn fc-ctx-edit" id="mfp-rename" style="flex:1">✏️ Rename</button>
                <button class="fc-ctx-btn fc-ctx-del" id="mfp-delete" style="flex:1">🗑️ Delete</button>
            </div>
        </div>`;

    _mfOpenModal(m.name, bodyHtml);

    // ── Wire events inside popup ──
    // Tag add
    document.getElementById('mfp-add-tag')?.addEventListener('click', () => {
        document.getElementById('mfp-tag-form').classList.toggle('hidden');
        document.getElementById('mfp-tag-input').focus();
    });
    document.getElementById('mfp-tag-save')?.addEventListener('click', () => {
        const tag = document.getElementById('mfp-tag-input').value.trim();
        if (!tag) return;
        m.tags = m.tags || [];
        if (!m.tags.includes(tag)) { m.tags.push(tag); save(); }
        _mfCloseModal(); _openMerchantPopup(merchantId);
        toast(`Tag "${tag}" added`, 'success');
    });
    document.getElementById('mfp-tag-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('mfp-tag-save').click();
    });
    document.querySelectorAll('.mfp-tag-del').forEach(btn => {
        btn.addEventListener('click', () => {
            m.tags.splice(parseInt(btn.dataset.idx), 1);
            save(); _mfCloseModal(); _openMerchantPopup(merchantId);
        });
    });

    // Link add
    document.getElementById('mfp-add-link')?.addEventListener('click', () => {
        document.getElementById('mfp-link-form').classList.toggle('hidden');
        document.getElementById('mfp-link-label').focus();
    });
    document.getElementById('mfp-link-save')?.addEventListener('click', () => {
        const label = document.getElementById('mfp-link-label').value.trim();
        const url = document.getElementById('mfp-link-url').value.trim();
        if (!url) { toast('Enter URL', 'warning'); return; }
        m.links.push({ label: label || url, url: url.startsWith('http') ? url : 'https://' + url });
        save(); toast('Link added', 'success');
        _mfCloseModal(); _openMerchantPopup(merchantId);
    });
    document.getElementById('mfp-link-url')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('mfp-link-save').click();
    });
    document.querySelectorAll('.mfp-link-del').forEach(btn => {
        btn.addEventListener('click', () => {
            m.links.splice(parseInt(btn.dataset.idx), 1);
            save(); toast('Link removed', 'info');
            _mfCloseModal(); _openMerchantPopup(merchantId);
        });
    });
    document.querySelectorAll('.mfp-link-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const link = m.links[idx];
            if (!link) return;
            const row = btn.closest('.fc-data-row');
            row.innerHTML = `
                <input type="text" id="mfp-el-label" class="mf-input mf-input-sm" value="${link.label || ''}" placeholder="Label" autocomplete="off" style="max-width:100px">
                <input type="text" id="mfp-el-url" class="mf-input" value="${link.url || ''}" placeholder="https://..." autocomplete="off">
                <button class="mf-btn-ok" id="mfp-el-save">Save</button>`;
            document.getElementById('mfp-el-label').focus();
            document.getElementById('mfp-el-save').addEventListener('click', () => {
                const nl = document.getElementById('mfp-el-label').value.trim();
                const nu = document.getElementById('mfp-el-url').value.trim();
                if (!nu) { toast('Enter URL', 'warning'); return; }
                m.links[idx] = { label: nl || nu, url: nu.startsWith('http') ? nu : 'https://' + nu };
                save(); toast('Link updated', 'success');
                _mfCloseModal(); _openMerchantPopup(merchantId);
            });
        });
    });

    // BIN add
    document.getElementById('mfp-add-bin')?.addEventListener('click', () => {
        const form = document.getElementById('mfp-bin-form');
        const bulkForm = document.getElementById('mfp-bin-bulk-form');
        const isOpen = !form.classList.contains('hidden');
        form.classList.toggle('hidden');
        bulkForm.classList.toggle('hidden');
        if (!isOpen) document.getElementById('mfp-bin-input').focus();
    });
    document.getElementById('mfp-bin-save')?.addEventListener('click', () => {
        const bin = document.getElementById('mfp-bin-input').value.replace(/\D/g, '').slice(0, 6);
        const amount = document.getElementById('mfp-bin-amount').value.trim();
        const currency = (document.getElementById('mfp-bin-currency')?.value || '').trim().toUpperCase();
        if (bin.length < 4) { toast('BIN must be 4-6 digits', 'warning'); return; }
        _addBinToMerchant(bin.padEnd(6, '0'), amount, m.id, currency);
        toast('BIN added', 'success');
        _mfCloseModal(); _openMerchantPopup(merchantId);
    });
    document.getElementById('mfp-bin-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('mfp-bin-save').click();
    });
    document.getElementById('mfp-bin-bulk-save')?.addEventListener('click', () => {
        const raw = document.getElementById('mfp-bin-bulk').value.trim();
        if (!raw) { toast('Paste BIN data', 'warning'); return; }
        const lines = raw.split(/\n/).map(l => l.trim()).filter(l => l);
        const parsed = [];
        lines.forEach(line => {
            // Format: 412650 - 1,269.00 EUR  or  412650 - 949,00 USD  or  412650
            const richMatch = line.match(/^(\d{4,6})\s*[-–—]\s*([\d.,\s]+?)\s+([A-Za-z]{3})\s*$/);
            if (richMatch) {
                parsed.push({ bin: richMatch[1].padEnd(6, '0'), amount: richMatch[2].trim(), currency: richMatch[3].toUpperCase() });
                return;
            }
            // Format: 412650 - 1,269.00  (no currency)
            const amtMatch = line.match(/^(\d{4,6})\s*[-–—]\s*([\d.,]+)\s*$/);
            if (amtMatch) {
                parsed.push({ bin: amtMatch[1].padEnd(6, '0'), amount: amtMatch[2].trim(), currency: '' });
                return;
            }
            // Plain BIN(s)
            const digits = line.match(/\d{4,}/g);
            if (digits) digits.forEach(d => parsed.push({ bin: d.slice(0, 6).padEnd(6, '0'), amount: '', currency: '' }));
        });
        if (!parsed.length) { toast('No valid BINs found', 'warning'); return; }
        parsed.forEach(p => _addBinToMerchant(p.bin, p.amount, m.id, p.currency));
        save(); toast(`${parsed.length} BINs processed`, 'success');
        _mfCloseModal(); _openMerchantPopup(merchantId);
    });
    document.querySelectorAll('.mfp-bin-del').forEach(btn => {
        btn.addEventListener('click', () => {
            STATE.merchantBins = STATE.merchantBins.filter(b => b.id !== btn.dataset.binId);
            save(); toast('BIN removed', 'info');
            _mfCloseModal(); _openMerchantPopup(merchantId);
        });
    });

    // Rename
    document.getElementById('mfp-rename')?.addEventListener('click', () => {
        const oldName = m.name;
        const nameInput = prompt('Rename merchant:', oldName);
        if (nameInput && nameInput.trim() && nameInput.trim() !== oldName) {
            m.name = nameInput.trim(); save();
            toast(`Renamed to "${m.name}"`, 'success');
            _mfCloseModal(); renderMerchants();
        }
    });

    // Delete
    document.getElementById('mfp-delete')?.addEventListener('click', () => {
        _mfCloseModal();
        _mtDeleteMerchant(m.id);
    });
}

// ── Modal helpers ──
function _mfOpenModal(title, bodyHtml) {
    const modal = document.getElementById('mf-modal');
    document.getElementById('mf-modal-title').textContent = title;
    document.getElementById('mf-modal-body').innerHTML = bodyHtml;
    modal.classList.remove('hidden');
}
function _mfCloseModal() {
    document.getElementById('mf-modal')?.classList.add('hidden');
}

// ══════════ CRUD HELPERS ══════════

function _mtSaveMerchant() {
    const inp = document.getElementById('fc-merch-name');
    const name = inp.value.trim();
    if (!name) { toast('Enter merchant name', 'warning'); return; }
    STATE.merchants.push({ id: 'merch-' + Date.now(), name: name, links: [] });
    save();
    toast(`Merchant "${name}" added`, 'success');
    renderMerchants();
}

function _mtEditMerchant(id) {
    const m = STATE.merchants.find(x => x.id === id);
    if (!m) return;
    const row = document.querySelector(`.mt-merch-row[data-id="${id}"]`);
    if (!row) return;
    const nameEl = row.querySelector('.mt-merch-name');
    const oldName = m.name;
    nameEl.innerHTML = `<input type="text" class="mt-input mt-inline-edit" value="${oldName}" data-id="${id}">`;
    const input = nameEl.querySelector('input');
    input.focus();
    input.select();

    const finish = (save_it) => {
        if (save_it) {
            const newName = input.value.trim();
            if (newName && newName !== oldName) {
                m.name = newName;
                save();
                toast(`Renamed to "${newName}"`, 'success');
            }
        }
        renderMerchants();
    };

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
}

function _mtDeleteMerchant(id) {
    const m = STATE.merchants.find(x => x.id === id);
    if (!m) return;
    const binCount = STATE.merchantBins.filter(b => b.merchant_id === id).length;
    if (!confirm(`Delete "${m.name}" and its ${binCount} BINs?`)) return;
    STATE.merchants = STATE.merchants.filter(x => x.id !== id);
    STATE.merchantBins = STATE.merchantBins.filter(b => b.merchant_id !== id);
    save();
    toast(`Merchant "${m.name}" deleted`, 'info');
    renderMerchants();
}

function _addBinToMerchant(bin, amount, merchantId, currency) {
    // Check if this BIN already exists for this merchant
    const existing = STATE.merchantBins.find(b => b.bin === bin && b.merchant_id === merchantId);
    if (existing) {
        existing.cnt = (existing.cnt || 1) + 1;
        if (amount) existing.amount = amount;
        if (currency) existing.currency = currency;
        save();
        return;
    }
    const bank = BIN_CACHE[bin] ? (BIN_CACHE[bin].bank || '') : '';
    STATE.merchantBins.push({
        id: 'mbin-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        bin: bin,
        amount: amount || '',
        currency: currency || '',
        cnt: 1,
        merchant_id: merchantId,
        bank: bank,
        date: Date.now()
    });
    save();
}

// ── Parse amount from various formats ──
// Handles: 1,269.00 | 1.269,00 | 2637,99 | 3,436.99 | 1.898,00
function _parseAmount(str) {
    if (!str) return 0;
    str = str.trim();
    // Detect format: if last separator is comma and has 1-2 digits after → European (comma = decimal)
    // If last separator is dot and has 1-2 digits after → US (dot = decimal)
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    if (lastComma > lastDot) {
        // Comma is the decimal separator (European): 1.269,00
        const clean = str.replace(/\./g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    } else if (lastDot > lastComma) {
        // Dot is the decimal separator (US): 1,269.00
        const clean = str.replace(/,/g, '');
        return parseFloat(clean) || 0;
    } else {
        // No separator or same position
        const clean = str.replace(/[^\d.]/g, '');
        return parseFloat(clean) || 0;
    }
}

// ══════════ ENHANCED SEARCH ══════════

// ══════════ LOG FIELD PARSER ══════════
function _parseLogFields(text) {
    const f = {};
    const lines = text.split(/\n/);

    // ── CC Number ──
    const ccPat = [
        /(?:CC|Card|Card\s*Number|Card\s*#|CC\s*#|PAN|New Card)\s*[:\[\(]?\s*([0-9\s\-]{13,25})/i,
        /\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{2,4})\b/
    ];
    for (const p of ccPat) {
        const m = text.match(p);
        if (m) { f.cc = m[1].replace(/[\s\-]/g, ''); break; }
    }
    if (!f.cc) {
        const plain = text.match(/\b(\d{13,19})\b/);
        if (plain) f.cc = plain[1];
    }

    // ── Validity / Expiry ──
    const valPat = [
        /(?:Validity|Expiry|Exp|Exp\.?\s*Date|Valid\s*Thru)[:\s]*(\d{1,2})\s*[\/\|\-]\s*(\d{2,4})/i,
        /(?:Validity|Expiry|Exp)[:\s]*(\d{2})(\d{2})/i
    ];
    for (const p of valPat) {
        const m = text.match(p);
        if (m) { f.expMonth = m[1].padStart(2, '0'); f.expYear = m[2].length === 4 ? m[2].slice(-2) : m[2]; break; }
    }
    // fallback: CC line with date parts — "4242424242424242|12|26|874"
    if (!f.expMonth && f.cc) {
        const pipePat = text.match(new RegExp(f.cc.replace(/(.)/g, '$1[\\s\\-]?').slice(0, -5) + '[\\|\\s]+?(\\d{1,2})[\\|\\s]+?(\\d{2,4})'));
        if (pipePat) { f.expMonth = pipePat[1].padStart(2, '0'); f.expYear = pipePat[2].length === 4 ? pipePat[2].slice(-2) : pipePat[2]; }
    }

    // ── CVV ──
    const cvvM = text.match(/(?:CVV|CVC|CVV2|CVC2|Security\s*Code)[:\s]*(\d{3,4})/i);
    if (cvvM) f.cvv = cvvM[1];
    // fallback from pipe format: CC|MM|YY|CVV
    if (!f.cvv && f.cc) {
        const pipeAll = text.match(/\d{13,19}\s*[\|]\s*\d{1,2}\s*[\|]\s*\d{2,4}\s*[\|]\s*(\d{3,4})/);
        if (pipeAll) f.cvv = pipeAll[1];
    }

    // ── Holder / Name ──
    const holderM = text.match(/(?:Holder|Cardholder|Name|Full\s*Name|Card\s*Holder)[:\s]*(.+)/i);
    if (holderM) f.holder = holderM[1].trim().replace(/\s+/g, ' ');

    // ── Email ──
    const emailM = text.match(/(?:Email|E-mail|Mail)[:\s]*([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)
        || text.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    if (emailM) f.email = emailM[1];

    // ── Phone ──
    const phoneM = text.match(/(?:Phone|Tel|Mobile|Cell)[:\s]*([\+]?[\d\s\-\(\)]{7,20})/i);
    if (phoneM) f.phone = phoneM[1].trim();

    // ── Address / Billing ──
    const addrM = text.match(/(?:Billing|Address|Street|Addr)[:\s]*(.+)/i);
    if (addrM) f.address = addrM[1].trim();

    // ── ZIP ──
    const zipM = text.match(/(?:ZIP|Zip\s*Code|Postal|Post\s*Code)[:\s]*(\d{3,10})/i);
    if (zipM) f.zip = zipM[1];

    // ── Price / Amount ──
    const priceM = text.match(/(?:Price|Amount|Total|Sum|Charge)[:\s]*[\$€£]?\s*([\d.,]+)/i);
    if (priceM) f.price = priceM[1];

    // ── Bank ──
    const bankM = text.match(/(?:Bank|Issuer)[:\s]*(.+)/i);
    if (bankM) f.bank = bankM[1].trim();

    // ── Card Type ──
    const typeM = text.match(/(?:Card\s*Type|Type)[:\s]*(.+)/i);
    if (typeM) f.cardType = typeM[1].trim();

    // ── IP ──
    const ipM = text.match(/(?:IP|IP\s*Address)[:\s]*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i);
    if (ipM) f.ip = ipM[1];

    // ── User Agent ──
    const uaM = text.match(/(?:User[\s\-]?Agent|UA)[:\s]*(.+)/i);
    if (uaM) f.userAgent = uaM[1].trim();

    // BIN
    if (f.cc && f.cc.length >= 6) f.bin = f.cc.slice(0, 6);

    return f;
}

// ══════════ SEARCH / LOG ANALYSIS ══════════
function _mtSearch() {
    const textarea = document.getElementById('fc-textarea');
    const text = textarea.value.trim();

    if (!text) { toast('Paste card data first', 'warning'); return; }

    // ── Parse log fields ──
    const fields = _parseLogFields(text);

    // Extract ALL amounts from log
    const allAmounts = [];
    const amountPatterns = [
        /(?:Price|Amount|Total|Sum|Charge)[:\s]*\$?\s*([\d.,]+)/gi,
        /\$([\d.,]+)/g
    ];
    for (const pat of amountPatterns) {
        let m;
        while ((m = pat.exec(text)) !== null) {
            const val = _parseAmount(m[1]);
            if (val > 0 && !allAmounts.includes(val.toString())) allAmounts.push(val.toString());
        }
    }

    // ── BIN extraction ──
    let bins = [];
    if (fields.bin) bins.push(fields.bin);

    const ccPatterns = [
        /(?:CC|Card|Card\s*Number|Card\s*#|CC\s*#|PAN)[:\s]+([0-9\s\-]{13,25})/gi,
        /(?:CC|Card)[:\s]*(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{2,4})/gi,
    ];
    for (const pat of ccPatterns) {
        let match;
        while ((match = pat.exec(text)) !== null) {
            const cardNum = match[1].replace(/[\s\-]/g, '');
            if (cardNum.length >= 13 && cardNum.length <= 19 && /^\d+$/.test(cardNum)) {
                bins.push(cardNum.slice(0, 6));
            }
        }
    }
    if (bins.length === 0) {
        const cardMatches = text.match(/\b\d{13,19}\b/g) || [];
        cardMatches.forEach(c => bins.push(c.slice(0, 6)));
    }
    bins = [...new Set(bins)];

    if (bins.length === 0) {
        toast('No valid card numbers found', 'warning');
        return;
    }

    // ═══ Build PARSED DATA HTML ═══
    let parsedHtml = '';
    const hasFields = fields.cc || fields.holder || fields.email || fields.phone || fields.address || fields.zip;
    if (hasFields) {
        const copyAttr = (val) => val ? `class="mf-copy-field" data-copy="${val.replace(/"/g, '&quot;')}" title="Click to copy"` : '';

        if (fields.cc) {
            const fullCC = fields.cc + (fields.expMonth ? ' ' + fields.expMonth + '/' + (fields.expYear || '') : '') + (fields.cvv ? ' ' + fields.cvv : '');
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">💳</span><span ${copyAttr(fullCC)} class="mf-copy-field mf-field-cc">${fields.cc}</span></div>`;
        }
        if (fields.expMonth) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">📅</span><span ${copyAttr(fields.expMonth + '/' + (fields.expYear || ''))}>${fields.expMonth}/${fields.expYear || '??'}</span></div>`;
        }
        if (fields.cvv) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">🔒</span><span ${copyAttr(fields.cvv)}>${fields.cvv}</span></div>`;
        }
        if (fields.holder) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">👤</span><span ${copyAttr(fields.holder)}>${fields.holder}</span></div>`;
        }
        if (fields.email) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">📧</span><span ${copyAttr(fields.email)}>${fields.email}</span></div>`;
        }
        if (fields.phone) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">📱</span><span ${copyAttr(fields.phone)}>${fields.phone}</span></div>`;
        }
        if (fields.address) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">🏠</span><span ${copyAttr(fields.address)}>${fields.address}</span></div>`;
        }
        if (fields.zip) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">📮</span><span ${copyAttr(fields.zip)}>${fields.zip}</span></div>`;
        }
        if (fields.bank) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">🏦</span><span ${copyAttr(fields.bank)}>${fields.bank}</span></div>`;
        }
        if (fields.cardType) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">💎</span><span ${copyAttr(fields.cardType)}>${fields.cardType}</span></div>`;
        }
        if (fields.ip) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">🌐</span><span ${copyAttr(fields.ip)}>${fields.ip}</span></div>`;
        }
        if (fields.userAgent) {
            parsedHtml += `<div class="mf-field"><span class="mf-field-icon">🖥</span><span ${copyAttr(fields.userAgent)} style="font-size:10px">${fields.userAgent.slice(0, 60)}${fields.userAgent.length > 60 ? '…' : ''}</span></div>`;
        }
    }

    // ═══ Build BIN RESULTS HTML ═══
    let binHtml = '';
    bins.forEach(bin => {
        const matches = STATE.merchantBins.filter(b => b.bin === bin);
        const bankInfo = BIN_CACHE[bin] ? BIN_CACHE[bin] : null;

        // BIN label with bank/type/country from cache
        let binLabel = `BIN: <strong>${bin}</strong>`;
        const network = getCardType(bin + '0000000000');
        if (network) binLabel += ` <span class="fc-bin-network" style="color:#8b5cf6;font-size:11px">${network}</span>`;
        if (bankInfo && !bankInfo.error) {
            const parts = [];
            if (bankInfo.type) parts.push(bankInfo.type);
            if (bankInfo.bank) parts.push(bankInfo.bank);
            if (bankInfo.country) parts.push(bankInfo.country);
            if (parts.length > 0) binLabel += ` <span style="color:#666;font-size:11px">· ${parts.join(' · ')}</span>`;
        }

        binHtml += `<div class="mt-result-block">`;
        binHtml += `<div class="mt-result-bin">${binLabel}</div>`;

        // Group by merchant
        const byMerchant = {};
        matches.forEach(b => {
            const mId = b.merchant_id;
            if (!byMerchant[mId]) byMerchant[mId] = { entries: [], name: '' };
            byMerchant[mId].entries.push(b);
            const m = STATE.merchants.find(x => x.id === mId);
            if (m) byMerchant[mId].name = m.name;
        });

        if (Object.keys(byMerchant).length > 0) {
            Object.entries(byMerchant).forEach(([mId, data]) => {
                const m = STATE.merchants.find(x => x.id === mId);
                const links = m && m.links ? m.links : [];

                binHtml += `<div class="mt-result-merchant-block">`;
                binHtml += `<div class="mt-result-row"><span class="mt-col-merchant">${data.name}</span> — <strong>${data.entries.length}</strong> transactions</div>`;

                binHtml += `<div class="fc-tx-list">`;
                data.entries.forEach(entry => {
                    const amt = entry.amount || '—';
                    const cur = entry.currency || '';
                    binHtml += `<div class="fc-tx-item">`;
                    binHtml += `<span class="fc-tx-amt">${amt}</span>`;
                    if (cur) binHtml += `<span class="fc-tx-cur">${cur}</span>`;
                    binHtml += `</div>`;
                });
                binHtml += `</div>`;

                if (links.length > 0) {
                    binHtml += `<div class="fc-links-row">`;
                    links.forEach(l => {
                        binHtml += `<span class="fc-link-group">`;
                        binHtml += `<a href="${l.url}" target="_blank" rel="noopener" class="fc-link-tag">${l.label || l.url}</a>`;
                        binHtml += `<button class="fc-link-copy" data-url="${l.url.replace(/"/g, '&quot;')}" title="Copy link">📋</button>`;
                        binHtml += `</span>`;
                    });
                    binHtml += `</div>`;
                }
                binHtml += `</div>`;
            });
        } else {
            // "Link to merchant" buttons for each merchant
            let linkBtns = '';
            if (STATE.merchants.length > 0) {
                linkBtns = `<div class="fc-link-merchant-row" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">`;
                STATE.merchants.forEach(m => {
                    linkBtns += `<button class="fc-link-to-merch" data-bin="${bin}" data-merch-id="${m.id}" style="font-size:11px;padding:3px 8px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#8b5cf6;cursor:pointer" title="Link BIN ${bin} to ${m.name}">+ ${m.name}</button>`;
                });
                linkBtns += `</div>`;
            }
            binHtml += `<div class="mt-no-data" style="color:#666;opacity:0.8">Not linked to any merchant</div>${linkBtns}`;
        }

        binHtml += `</div>`;
    });

    // ═══ SAVE to persistent array ═══
    STATE._logResults.push({
        bins: bins,
        binHtml: binHtml,
        parsedHtml: parsedHtml,
        timestamp: Date.now()
    });

    // Clear textarea after successful search to prevent duplicates
    textarea.value = '';

    // ═══ Auto-lookup BIN info from RustBin API ═══
    bins.forEach(bin => { if (!BIN_CACHE[bin]) lookupBin(bin); });

    // ═══ SAVE parsed fields to STATE for persistence ═══
    STATE._lastParsedFields = fields;

    // Re-render to show results (will restore parsed fields)
    renderMerchants();
    toast(`Found ${bins.length} BIN(s)`, 'success');
}

// ═══ UPDATE PARSED INFO (right panel) ═══
function _updateParsedInfo(fields) {
    // Update card info
    const setCardField = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        const valSpan = el.querySelector('.fc-card-val');
        if (valSpan) valSpan.textContent = val || '—';
        el.dataset.copy = val || '';
    };

    const cc = fields.cc || '';
    const exp = (fields.expMonth && fields.expYear) ? `${fields.expMonth}/${fields.expYear}` : (fields.expMonth || '');

    setCardField('ci-card', cc);
    setCardField('ci-exp', exp);
    setCardField('ci-cvv', fields.cvv || '');

    // Show card type/network + BIN info
    const binInfoEl = document.getElementById('ci-bininfo');
    if (binInfoEl && cc) {
        const network = getCardType(cc);
        const bin6 = cc.slice(0, 6);
        const cached = BIN_CACHE[bin6];
        let infoStr = network || '';
        if (cached && !cached.error) {
            if (cached.type) infoStr += (infoStr ? ' · ' : '') + cached.type;
            if (cached.bank) infoStr += (infoStr ? ' · ' : '') + cached.bank;
            if (cached.country) infoStr += (infoStr ? ' · ' : '') + cached.country;
        }
        const valSpan = binInfoEl.querySelector('.fc-card-val');
        if (valSpan) valSpan.textContent = infoStr || '—';
    }

    // Update billing info from log (if available)
    const setBillingField = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        const valSpan = el.querySelector('.fc-billing-val');
        if (valSpan) valSpan.textContent = val || '—';
        el.dataset.copy = val || '';
    };

    // Fill billing from parsed log data
    const fullName = fields.holder || '—';
    const address = fields.address || '—';
    const city = fields.city || '—';
    const zip = fields.zip || '—';
    const phone = fields.phone || '—';

    setBillingField('bi-name', fullName);
    setBillingField('bi-address', address);
    setBillingField('bi-city', city);
    setBillingField('bi-zip', zip);
    setBillingField('bi-phone', phone);
}

// ═══ RANDOM BILLING GENERATOR (Multi-country) ═══
const BILLING_DATA = {
    US: {
        firstNames: ['James', 'Michael', 'Robert', 'David', 'William', 'John', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Lisa'],
        lastNames: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White'],
        streets: ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine St', 'Elm St', 'Washington Ave', 'Park Blvd', 'Lake Dr', 'Hill Rd'],
        cities: [
            { city: 'New York', state: 'NY', zip: '10001' },
            { city: 'Los Angeles', state: 'CA', zip: '90001' },
            { city: 'Chicago', state: 'IL', zip: '60601' },
            { city: 'Houston', state: 'TX', zip: '77001' },
            { city: 'Phoenix', state: 'AZ', zip: '85001' },
            { city: 'Miami', state: 'FL', zip: '33101' },
            { city: 'Seattle', state: 'WA', zip: '98101' },
            { city: 'Denver', state: 'CO', zip: '80201' },
            { city: 'Boston', state: 'MA', zip: '02101' },
            { city: 'Las Vegas', state: 'NV', zip: '89101' }
        ],
        phoneFormat: (r) => `+1-${r(200, 999)}-${r(200, 999)}-${r(1000, 9999)}`
    },
    UK: {
        firstNames: ['Oliver', 'George', 'Harry', 'Jack', 'Jacob', 'Noah', 'Charlie', 'Olivia', 'Amelia', 'Emily', 'Isla', 'Ava', 'Sophie', 'Grace', 'Mia'],
        lastNames: ['Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies', 'Evans', 'Wilson', 'Thomas', 'Roberts', 'Johnson', 'Lewis', 'Walker', 'Robinson', 'Wood'],
        streets: ['High Street', 'Station Road', 'Church Lane', 'Mill Road', 'Park Avenue', 'Victoria Road', 'Manor Way', 'Kings Road', 'Queens Drive', 'London Road'],
        cities: [
            { city: 'London', state: 'England', zip: 'SW1A' },
            { city: 'Manchester', state: 'England', zip: 'M1' },
            { city: 'Birmingham', state: 'England', zip: 'B1' },
            { city: 'Leeds', state: 'England', zip: 'LS1' },
            { city: 'Liverpool', state: 'England', zip: 'L1' },
            { city: 'Edinburgh', state: 'Scotland', zip: 'EH1' },
            { city: 'Glasgow', state: 'Scotland', zip: 'G1' },
            { city: 'Bristol', state: 'England', zip: 'BS1' }
        ],
        phoneFormat: (r) => `+44 ${r(7000, 7999)} ${r(100000, 999999)}`
    },
    CA: {
        firstNames: ['Liam', 'Noah', 'William', 'James', 'Oliver', 'Emma', 'Olivia', 'Charlotte', 'Amelia', 'Sophia', 'Benjamin', 'Lucas', 'Henry', 'Alexander', 'Mason'],
        lastNames: ['Smith', 'Brown', 'Tremblay', 'Martin', 'Roy', 'Wilson', 'Macdonald', 'Gagnon', 'Johnson', 'Taylor', 'Campbell', 'Anderson', 'Lee', 'Jones', 'Williams'],
        streets: ['Maple Street', 'Oak Avenue', 'Cedar Drive', 'Pine Road', 'Birch Lane', 'Willow Way', 'Spruce Street', 'Elm Avenue', 'Aspen Drive', 'Poplar Road'],
        cities: [
            { city: 'Toronto', state: 'ON', zip: 'M5H' },
            { city: 'Montreal', state: 'QC', zip: 'H2Y' },
            { city: 'Vancouver', state: 'BC', zip: 'V6C' },
            { city: 'Calgary', state: 'AB', zip: 'T2P' },
            { city: 'Edmonton', state: 'AB', zip: 'T5J' },
            { city: 'Ottawa', state: 'ON', zip: 'K1P' },
            { city: 'Winnipeg', state: 'MB', zip: 'R3C' }
        ],
        phoneFormat: (r) => `+1-${r(200, 999)}-${r(200, 999)}-${r(1000, 9999)}`
    },
    AU: {
        firstNames: ['Oliver', 'Noah', 'Jack', 'William', 'Leo', 'Charlotte', 'Olivia', 'Amelia', 'Isla', 'Mia', 'Lucas', 'Henry', 'Ethan', 'James', 'Alexander'],
        lastNames: ['Smith', 'Jones', 'Williams', 'Brown', 'Wilson', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez'],
        streets: ['High Street', 'George Street', 'William Street', 'Queen Street', 'King Street', 'Beach Road', 'Park Avenue', 'Church Street', 'Victoria Street', 'Albert Road'],
        cities: [
            { city: 'Sydney', state: 'NSW', zip: '2000' },
            { city: 'Melbourne', state: 'VIC', zip: '3000' },
            { city: 'Brisbane', state: 'QLD', zip: '4000' },
            { city: 'Perth', state: 'WA', zip: '6000' },
            { city: 'Adelaide', state: 'SA', zip: '5000' },
            { city: 'Gold Coast', state: 'QLD', zip: '4217' },
            { city: 'Canberra', state: 'ACT', zip: '2600' }
        ],
        phoneFormat: (r) => `+61 4${r(00, 99)} ${r(100, 999)} ${r(100, 999)}`
    }
};

// Store current billing for copy all
let _currentBilling = null;

function _generateRandomBilling() {
    const country = document.getElementById('fc-country')?.value || 'US';
    const data = BILLING_DATA[country];

    const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const firstName = rand(data.firstNames);
    const lastName = rand(data.lastNames);
    const fullName = `${firstName} ${lastName}`;
    const streetNum = randNum(1, 999);
    const street = rand(data.streets);
    const address = `${streetNum} ${street}`;
    const loc = rand(data.cities);
    const zip = loc.zip + (country === 'UK' ? ` ${randNum(1, 9)}${String.fromCharCode(65 + randNum(0, 25))}${String.fromCharCode(65 + randNum(0, 25))}` : randNum(10, 99).toString());
    const phone = data.phoneFormat(randNum);
    const cityState = `${loc.city}, ${loc.state}`;

    // Store for copy all
    _currentBilling = { fullName, address, cityState, zip, phone, country };

    // Update billing info fields
    const setField = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        const valSpan = el.querySelector('.fc-billing-val');
        if (valSpan) valSpan.textContent = val || '—';
        el.dataset.copy = val || '';
    };

    setField('bi-name', fullName);
    setField('bi-address', address);
    setField('bi-city', cityState);
    setField('bi-zip', zip);
    setField('bi-phone', phone);

    toast(`Generated ${country} billing`, 'success');
}

// ═══ COPY ALL BILLING ═══
// ══════════ QUICK SEARCH ══════════

function _mtQuickSearch(query) {
    const resultsDiv = document.getElementById('mt-results');
    if (!resultsDiv) return;
    const q = query.toUpperCase();
    const qDigits = query.replace(/\D/g, '');

    let html = '';
    let found = false;

    // Search by BIN
    if (qDigits.length >= 4) {
        const binPrefix = qDigits.slice(0, 6);
        const matches = STATE.merchantBins.filter(b => b.bin.startsWith(binPrefix));

        if (matches.length > 0) {
            found = true;
            const byBin = {};
            matches.forEach(b => {
                if (!byBin[b.bin]) byBin[b.bin] = [];
                byBin[b.bin].push(b);
            });

            Object.entries(byBin).forEach(([bin, entries]) => {
                const bankInfo = BIN_CACHE[bin];
                const bankName = bankInfo ? (bankInfo.bank || '—') : (entries[0].bank || '—');
                html += `<div class="mt-result-block">`;
                html += `<div class="mt-result-bin">BIN: <strong>${bin}</strong>`;
                if (bankName !== '—') html += ` <span class="mt-result-bank">🏦 ${bankName}</span>`;
                html += `</div>`;

                const byMerch = {};
                entries.forEach(e => {
                    if (!byMerch[e.merchant_id]) byMerch[e.merchant_id] = [];
                    byMerch[e.merchant_id].push(e);
                });
                Object.entries(byMerch).forEach(([mId, es]) => {
                    const m = STATE.merchants.find(x => x.id === mId);
                    const last = es[es.length - 1];
                    html += `<div class="mt-result-row"><span class="mt-col-merchant">${m ? m.name : 'Unknown'}</span> — Used: <strong>${es.length}</strong>`;
                    if (last.amount) html += ` — Last: <span class="mt-col-amount">$${last.amount}</span>`;
                    html += `</div>`;
                    if (m && m.links && m.links.length > 0) {
                        html += `<div class="mt-result-links">${m.links.map(l => `<a href="${l.url}" target="_blank" class="mt-link-badge-sm">[${l.label}]</a>`).join('')}</div>`;
                    }
                });
                html += `</div>`;
            });
        }
    }

    // Search by merchant name
    STATE.merchants.forEach(m => {
        if (m.name.toUpperCase().includes(q)) {
            found = true;
            const bins = STATE.merchantBins.filter(b => b.merchant_id === m.id);
            const uniqueBins = [...new Set(bins.map(b => b.bin))];
            html += `<div class="mt-result-block">`;
            html += `<div class="mt-result-bin"><span class="mt-col-merchant">${m.name}</span> — ${uniqueBins.length} BINs · ${bins.length} uses</div>`;
            uniqueBins.slice(0, 10).forEach(bin => {
                const count = bins.filter(b => b.bin === bin).length;
                const last = bins.filter(b => b.bin === bin).pop();
                const bankInfo = BIN_CACHE[bin];
                const bankName = bankInfo ? (bankInfo.bank || '') : '';
                html += `<div class="mt-result-row">BIN: <strong>${bin}</strong>${bankName ? ' · 🏦 ' + bankName : ''} — ${count}x${last && last.amount ? ' · $' + last.amount : ''}</div>`;
            });
            if (m.links && m.links.length > 0) {
                html += `<div class="mt-result-links">${m.links.map(l => `<a href="${l.url}" target="_blank" class="mt-link-badge-sm">[${l.label}]</a>`).join('')}</div>`;
            }
            html += `</div>`;
        }
    });

    if (!found) {
        html = `<div class="mt-no-data">No results for "${query}"</div>`;
    }

    resultsDiv.innerHTML = html;
}

// Legacy compat
window.openMerchant = function () { };
window.deleteMerchant = function (id) { _mtDeleteMerchant(id); };
window.deleteMerchBin = function (id) {
    STATE.merchantBins = STATE.merchantBins.filter(b => b.id !== id);
    save();
};

// ═══════════════════════════════════════════
//        TASKS — WEEKLY PLANNER + HABITS
// ═══════════════════════════════════════════

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function _getWeekKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + (offset || 0) * 7);
    return `${d.getFullYear()}-W${String(Math.ceil(((d - new Date(d.getFullYear(),0,1)) / 86400000 + 1) / 7)).padStart(2,'0')}`;
}

function _getWeekStart(offset) {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + (offset || 0) * 7);
    return d;
}

function _formatDate(d) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function _loadTasksData() {
    try {
        return JSON.parse(localStorage.getItem('ct_tasks_data') || '{}');
    } catch { return {}; }
}

function _saveTasksData(data) {
    localStorage.setItem('ct_tasks_data', JSON.stringify(data));
}

if (!STATE._tasksWeekOffset) STATE._tasksWeekOffset = 0;
if (!STATE._tasksCategory) STATE._tasksCategory = 'all';

const CAT_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#ec4899','#8b5cf6','#14b8a6','#f97316','#84cc16'];

function renderTasks() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    if (bar) bar.innerHTML = '';

    const offset = STATE._tasksWeekOffset || 0;
    const weekKey = _getWeekKey(offset);
    const weekStart = _getWeekStart(offset);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
    const data = _loadTasksData();

    if (!data[weekKey]) data[weekKey] = { tasks: {}, habits: [] };
    const week = data[weekKey];
    if (!week.tasks) week.tasks = {};
    if (!week.habits) week.habits = [];

    // Ensure global habits list
    if (!data._habits) data._habits = [];
    if (!data._categories) {
        data._categories = [{ id: 'cat-default', name: 'General', color: '#6366f1' }];
        _saveTasksData(data);
    }

    // Sync habits from global list to this week
    data._habits.forEach(h => {
        if (!week.habits.find(wh => wh.id === h.id)) {
            week.habits.push({ id: h.id, name: h.name, days: [false,false,false,false,false,false,false] });
        }
    });
    // Update names from global
    week.habits.forEach(wh => {
        const g = data._habits.find(h => h.id === wh.id);
        if (g) wh.name = g.name;
    });
    // Remove deleted
    week.habits = week.habits.filter(wh => data._habits.some(h => h.id === wh.id));

    // ── Progress calc ──
    let totalTasks = 0, doneTasks = 0;
    DAYS.forEach((_, di) => {
        const dayTasks = week.tasks[di] || [];
        totalTasks += dayTasks.length;
        doneTasks += dayTasks.filter(t => t.done).length;
    });
    const taskPct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

    let totalHabitCells = week.habits.length * 7;
    let doneHabitCells = 0;
    week.habits.forEach(h => { doneHabitCells += (h.days || []).filter(Boolean).length; });
    const habitPct = totalHabitCells ? Math.round((doneHabitCells / totalHabitCells) * 100) : 0;

    const overallPct = (totalTasks + totalHabitCells) ? Math.round(((doneTasks + doneHabitCells) / (totalTasks + totalHabitCells)) * 100) : 0;

    // ── Week day dates ──
    const dayDates = DAYS.map((_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
    });
    const today = new Date();
    const todayIdx = today.getDay();
    const isCurrentWeek = offset === 0;

    // ── Categories ──
    const cats = data._categories || [];
    const activeCat = STATE._tasksCategory || 'all';
    const catBarHtml = `<div class="tw-cat-bar">
        <button class="tw-cat-btn${activeCat === 'all' ? ' tw-cat-active' : ''}" data-cat="all"><span class="tw-cat-dot" style="background:#64748b"></span>All</button>
        ${cats.map(c => `<button class="tw-cat-btn${activeCat === c.id ? ' tw-cat-active' : ''}" data-cat="${c.id}" style="--cat-color:${c.color}"><span class="tw-cat-dot" style="background:${c.color}"></span>${c.name}<span class="tw-cat-del-x" data-cat-id="${c.id}">✕</span></button>`).join('')}
        <button class="tw-cat-add-btn" id="tw-add-cat">＋ Category</button>
    </div>`;

    // ── Build HTML ──
    let daysHtml = '';
    DAYS.forEach((dayName, di) => {
        const allDayTasks = week.tasks[di] || [];
        const filteredTasks = activeCat === 'all'
            ? allDayTasks.map((t, origIdx) => ({ t, origIdx }))
            : allDayTasks.map((t, origIdx) => ({ t, origIdx })).filter(({ t }) => t.categoryId === activeCat);
        const dayDate = dayDates[di];
        const isToday = isCurrentWeek && di === todayIdx;
        const dayDone = allDayTasks.filter(t => t.done).length;
        const dayTotal = allDayTasks.length;
        const short = dayName.slice(0, 3).toUpperCase();
        const dateStr = `${dayDate.getDate()}`;

        let tasksListHtml = '';
        filteredTasks.forEach(({ t, origIdx }) => {
            const taskCat = cats.find(c => c.id === t.categoryId);
            const dotColor = taskCat ? taskCat.color : 'rgba(255,255,255,0.12)';
            tasksListHtml += `<div class="tw-task ${t.done ? 'tw-task-done' : ''}" data-day="${di}" data-idx="${origIdx}">
                <label class="tw-check-wrap"><input type="checkbox" class="tw-check" ${t.done ? 'checked' : ''} data-day="${di}" data-idx="${origIdx}"><span class="tw-checkmark"></span></label>
                <span class="tw-task-cat-dot" style="background:${dotColor}" title="${taskCat ? taskCat.name : 'No category'}"></span>
                <span class="tw-task-text">${t.text}</span>
                <button class="tw-task-del" data-day="${di}" data-idx="${origIdx}" title="Delete">✕</button>
            </div>`;
        });

        daysHtml += `<div class="tw-day-col ${isToday ? 'tw-today' : ''}">
            <div class="tw-day-head">
                <span class="tw-day-name">${short}</span>
                <span class="tw-day-date">${dateStr}</span>
                ${dayTotal ? `<span class="tw-day-count">${dayDone}/${dayTotal}</span>` : ''}
            </div>
            <div class="tw-tasks-list" data-day="${di}">${tasksListHtml}</div>
            <div class="tw-add-task">
                <input type="text" class="tw-add-input" data-day="${di}" placeholder="+ Add task..." autocomplete="off">
            </div>
        </div>`;
    });

    // ── Habits table ──
    let habitsHtml = '';
    week.habits.forEach((h, hi) => {
        const doneCount = (h.days || []).filter(Boolean).length;
        const pct = Math.round((doneCount / 7) * 100);
        let cellsHtml = '';
        DAYS.forEach((_, di) => {
            const checked = h.days && h.days[di];
            cellsHtml += `<div class="tw-habit-cell ${checked ? 'tw-habit-done' : ''}" data-habit="${hi}" data-day="${di}"></div>`;
        });
        habitsHtml += `<div class="tw-habit-row">
            <div class="tw-habit-name-wrap">
                <span class="tw-habit-name">${h.name}</span>
                <button class="tw-habit-del" data-habit-id="${h.id}" title="Delete habit">✕</button>
            </div>
            <div class="tw-habit-cells">${cellsHtml}</div>
            <div class="tw-habit-pct ${pct === 100 ? 'tw-pct-full' : ''}">${pct}%</div>
        </div>`;
    });

    // Day headers for habit table
    let habitDayHeaders = '';
    DAYS.forEach((d, di) => {
        const isT = isCurrentWeek && di === todayIdx;
        habitDayHeaders += `<div class="tw-habit-day-head ${isT ? 'tw-habit-today' : ''}">${d.slice(0,2)}</div>`;
    });

    area.innerHTML = `
    <div class="tw-container">
        <!-- HEADER -->
        <div class="tw-header">
            <div class="tw-nav">
                <button class="tw-nav-btn" id="tw-prev" title="Previous week">◀</button>
                <div class="tw-week-info">
                    <span class="tw-week-range">${_formatDate(weekStart)} — ${_formatDate(weekEnd)}</span>
                    ${isCurrentWeek ? '<span class="tw-current-badge">This Week</span>' : ''}
                </div>
                <button class="tw-nav-btn" id="tw-next" title="Next week">▶</button>
            </div>
            <div class="tw-progress-bar-wrap">
                <div class="tw-progress-stats">
                    <span class="tw-stat-item">📋 Tasks <strong>${taskPct}%</strong></span>
                    <span class="tw-stat-item">🔁 Habits <strong>${habitPct}%</strong></span>
                    <span class="tw-stat-item tw-stat-overall">Overall <strong>${overallPct}%</strong></span>
                </div>
                <div class="tw-progress-track"><div class="tw-progress-fill" style="width:${overallPct}%"></div></div>
            </div>
        </div>

        ${catBarHtml}
        <!-- WEEKLY GRID -->
        <div class="tw-week-grid">${daysHtml}</div>

        <!-- HABITS -->
        <div class="tw-habits-section">
            <div class="tw-habits-head">
                <span class="tw-habits-title">🔁 HABIT TRACKER</span>
                <button class="tw-add-habit-btn" id="tw-add-habit">+ Habit</button>
            </div>
            <div class="tw-habits-table">
                <div class="tw-habit-row tw-habit-header-row">
                    <div class="tw-habit-name-wrap"><span class="tw-habit-name" style="font-size:10px;color:#64748b">HABIT</span></div>
                    <div class="tw-habit-cells">${habitDayHeaders}</div>
                    <div class="tw-habit-pct" style="font-size:9px;color:#64748b">%</div>
                </div>
                ${habitsHtml || '<div class="tw-habits-empty">No habits yet — click + Habit to add</div>'}
            </div>
        </div>
    </div>`;

    // ── EVENTS ──

    // Week navigation
    document.getElementById('tw-prev')?.addEventListener('click', () => { STATE._tasksWeekOffset = (STATE._tasksWeekOffset || 0) - 1; renderTasks(); });
    document.getElementById('tw-next')?.addEventListener('click', () => { STATE._tasksWeekOffset = (STATE._tasksWeekOffset || 0) + 1; renderTasks(); });

    // Category filter buttons
    document.querySelectorAll('.tw-cat-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            if (e.target.classList.contains('tw-cat-del-x')) return;
            STATE._tasksCategory = btn.dataset.cat;
            renderTasks();
        });
    });

    // Delete category (x on badge)
    document.querySelectorAll('.tw-cat-del-x').forEach(x => {
        x.addEventListener('click', e => {
            e.stopPropagation();
            const cid = x.dataset.catId;
            const d = _loadTasksData();
            d._categories = (d._categories || []).filter(c => c.id !== cid);
            _saveTasksData(d);
            if (STATE._tasksCategory === cid) STATE._tasksCategory = 'all';
            renderTasks();
            toast('Category removed', 'info');
        });
    });

    // Add new category
    document.getElementById('tw-add-cat')?.addEventListener('click', () => {
        const overlay = document.getElementById('mini-modal-overlay');
        const titleEl = document.getElementById('mini-modal-title');
        const labelEl = document.getElementById('mini-modal-label');
        const inputEl = document.getElementById('mini-modal-input');
        const saveBtn = document.getElementById('mini-modal-save');
        const cancelBtn = document.getElementById('mini-modal-cancel');
        const closeBtn = document.getElementById('mini-modal-close');
        if (!overlay) return;
        titleEl.textContent = 'New Category';
        labelEl.textContent = 'Category name';
        inputEl.placeholder = 'OnlyFans, Google, Design...';
        inputEl.value = '';
        overlay.classList.remove('hidden');
        setTimeout(() => inputEl.focus(), 50);
        const save = () => {
            const name = inputEl.value.trim();
            if (!name) return;
            const d = _loadTasksData();
            if (!d._categories) d._categories = [];
            const color = CAT_COLORS[d._categories.length % CAT_COLORS.length];
            const id = 'cat-' + Date.now();
            d._categories.push({ id, name, color });
            _saveTasksData(d);
            overlay.classList.add('hidden');
            cleanup();
            renderTasks();
            toast(`Category "${name}" added`, 'success');
        };
        const cancel = () => { overlay.classList.add('hidden'); cleanup(); };
        const cleanup = () => { saveBtn.onclick = null; cancelBtn.onclick = null; closeBtn.onclick = null; };
        saveBtn.onclick = save;
        cancelBtn.onclick = cancel;
        closeBtn.onclick = cancel;
        inputEl.onkeydown = e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); };
    });

    // Add task (Enter key)
    document.querySelectorAll('.tw-add-input').forEach(inp => {
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                const txt = inp.value.trim();
                if (!txt) return;
                const di = parseInt(inp.dataset.day);
                const d = _loadTasksData();
                if (!d[weekKey]) d[weekKey] = { tasks: {}, habits: [] };
                if (!d[weekKey].tasks[di]) d[weekKey].tasks[di] = [];
                const defaultCatId = activeCat === 'all' ? (d._categories?.[0]?.id || 'cat-default') : activeCat;
                d[weekKey].tasks[di].push({ text: txt, done: false, id: 't-' + Date.now(), categoryId: defaultCatId });
                _saveTasksData(d);
                renderTasks();
                // Focus same day's input after re-render
                setTimeout(() => { document.querySelector(`.tw-add-input[data-day="${di}"]`)?.focus(); }, 50);
            }
        });
    });

    // Toggle task done
    document.querySelectorAll('.tw-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const di = parseInt(cb.dataset.day);
            const ti = parseInt(cb.dataset.idx);
            const d = _loadTasksData();
            if (d[weekKey]?.tasks[di]?.[ti] !== undefined) {
                d[weekKey].tasks[di][ti].done = cb.checked;
                _saveTasksData(d);
                renderTasks();
            }
        });
    });

    // Delete task
    document.querySelectorAll('.tw-task-del').forEach(btn => {
        btn.addEventListener('click', () => {
            const di = parseInt(btn.dataset.day);
            const ti = parseInt(btn.dataset.idx);
            const d = _loadTasksData();
            if (d[weekKey]?.tasks[di]) {
                d[weekKey].tasks[di].splice(ti, 1);
                _saveTasksData(d);
                renderTasks();
            }
        });
    });

    // Habit cell toggle
    document.querySelectorAll('.tw-habit-cell').forEach(cell => {
        cell.addEventListener('click', () => {
            const hi = parseInt(cell.dataset.habit);
            const di = parseInt(cell.dataset.day);
            const d = _loadTasksData();
            if (d[weekKey]?.habits[hi]) {
                if (!d[weekKey].habits[hi].days) d[weekKey].habits[hi].days = [false,false,false,false,false,false,false];
                d[weekKey].habits[hi].days[di] = !d[weekKey].habits[hi].days[di];
                _saveTasksData(d);
                renderTasks();
            }
        });
    });

    // Add habit
    document.getElementById('tw-add-habit')?.addEventListener('click', () => {
        const name = prompt('Habit name:');
        if (!name || !name.trim()) return;
        const d = _loadTasksData();
        if (!d._habits) d._habits = [];
        const id = 'hab-' + Date.now();
        d._habits.push({ id, name: name.trim() });
        // Add to current week too
        if (!d[weekKey]) d[weekKey] = { tasks: {}, habits: [] };
        d[weekKey].habits.push({ id, name: name.trim(), days: [false,false,false,false,false,false,false] });
        _saveTasksData(d);
        renderTasks();
        toast(`Habit "${name.trim()}" added`, 'success');
    });

    // Delete habit
    document.querySelectorAll('.tw-habit-del').forEach(btn => {
        btn.addEventListener('click', () => {
            const hid = btn.dataset.habitId;
            if (!confirm('Delete this habit from all weeks?')) return;
            const d = _loadTasksData();
            d._habits = (d._habits || []).filter(h => h.id !== hid);
            // Remove from all weeks
            Object.keys(d).forEach(k => {
                if (k.startsWith('20') && d[k].habits) {
                    d[k].habits = d[k].habits.filter(h => h.id !== hid);
                }
            });
            _saveTasksData(d);
            renderTasks();
            toast('Habit deleted', 'info');
        });
    });

    // Focus today if current week
    if (isCurrentWeek) {
        const todayCol = document.querySelector('.tw-today');
        if (todayCol) todayCol.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
}

// ═══════════════════════════════════════════
//   PROMPTS — Prompt Manager
// ═══════════════════════════════════════════

const PROMPT_CAT_COLORS = ['#6366f1','#ec4899','#22c55e','#f59e0b','#06b6d4','#8b5cf6','#ef4444','#14b8a6','#f97316','#84cc16'];
if (!STATE._promptsCat) STATE._promptsCat = 'all';
if (!STATE._promptSearch) STATE._promptSearch = '';

function _loadPromptsData() {
    try { return JSON.parse(localStorage.getItem('ct_prompts_data') || '{"categories":[],"prompts":[]}'); }
    catch { return { categories: [], prompts: [] }; }
}
function _savePromptsData(d) { localStorage.setItem('ct_prompts_data', JSON.stringify(d)); }

function _openPromptModal(prompt, categories, onSave) {
    document.getElementById('pr-dyn-modal')?.remove();
    const catOptions = categories.map(c =>
        `<option value="${c.id}" ${prompt && prompt.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`
    ).join('');
    const modal = document.createElement('div');
    modal.id = 'pr-dyn-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal pr-modal-box">
            <div class="modal-header">
                <h3>${prompt ? 'EDIT PROMPT' : 'ADD PROMPT'}</h3>
                <p class="modal-subtitle">${prompt ? 'Update your saved prompt' : 'Save a new prompt for quick access'}</p>
                <button class="modal-close" id="pr-mc"><svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg></button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <div class="form-group" style="flex:2">
                        <label>Title *</label>
                        <input type="text" id="pr-m-title" placeholder="e.g. Caption template for OnlyFans" value="${prompt ? prompt.title : ''}">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Category</label>
                        <select id="pr-m-cat" class="form-select">
                            <option value="">— No category —</option>
                            ${catOptions}
                        </select>
                    </div>
                </div>
                <div class="form-group full-width">
                    <label>Prompt text *</label>
                    <textarea id="pr-m-text" class="pr-modal-textarea" placeholder="Paste your prompt here...">${prompt ? prompt.text : ''}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" id="pr-mc2">Cancel</button>
                <button class="btn-primary" id="pr-ms">${prompt ? 'Save Changes' : 'Save Prompt'}</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    document.getElementById('pr-mc').onclick = close;
    document.getElementById('pr-mc2').onclick = close;
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.getElementById('pr-ms').onclick = () => {
        const title = document.getElementById('pr-m-title').value.trim();
        const text = document.getElementById('pr-m-text').value.trim();
        const catId = document.getElementById('pr-m-cat').value || null;
        if (!title || !text) { toast('Title and prompt text are required', 'error'); return; }
        close(); onSave(title, text, catId);
    };
    setTimeout(() => document.getElementById('pr-m-title')?.focus(), 50);
}

function renderPrompts() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    if (bar) bar.innerHTML = '';

    const d = _loadPromptsData();
    if (!d.categories) d.categories = [];
    if (!d.prompts) d.prompts = [];

    const activeCat = STATE._promptsCat || 'all';
    const search = (STATE._promptSearch || '').toLowerCase();

    let shown = d.prompts;
    if (activeCat !== 'all') shown = shown.filter(p => p.categoryId === activeCat);
    if (search) shown = shown.filter(p =>
        p.title.toLowerCase().includes(search) || p.text.toLowerCase().includes(search));

    const catSideHtml = `
    <div class="pr-sidebar">
        <button class="pr-cat-item${activeCat === 'all' ? ' pr-cat-active' : ''}" data-cat="all">
            <span class="pr-cat-icon">&#9635;</span><span class="pr-cat-label">All prompts</span>
            <span class="pr-cat-count">${d.prompts.length}</span>
        </button>
        ${d.categories.map(c => {
            const cnt = d.prompts.filter(p => p.categoryId === c.id).length;
            return `<button class="pr-cat-item${activeCat === c.id ? ' pr-cat-active' : ''}" data-cat="${c.id}" style="--pc:${c.color}">
                <span class="pr-cat-dot" style="background:${c.color}"></span>
                <span class="pr-cat-label">${c.name}</span>
                <span class="pr-cat-count">${cnt}</span>
                <span class="pr-cat-del" data-cid="${c.id}">✕</span>
            </button>`;
        }).join('')}
        <button class="pr-cat-add" id="pr-add-cat">＋ Category</button>
    </div>`;

    const cardsHtml = shown.length === 0
        ? `<div class="pr-empty">
            <div class="pr-empty-icon">&#128172;</div>
            <p class="pr-empty-title">${search || activeCat !== 'all' ? 'No prompts found' : 'No prompts yet'}</p>
            <p class="pr-empty-sub">${search || activeCat !== 'all' ? 'Try a different filter or category' : 'Click \u201c+ Add Prompt\u201d to save your first prompt'}</p>
          </div>`
        : shown.map(p => {
            const cat = d.categories.find(c => c.id === p.categoryId);
            const preview = p.text.length > 140 ? p.text.slice(0, 140) + '\u2026' : p.text;
            const catBadge = cat ? `<span class="pr-card-cat" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${cat.name}</span>` : '';
            return `<div class="pr-card" data-id="${p.id}">
                <div class="pr-card-head">
                    <span class="pr-card-title">${p.title}</span>
                    ${catBadge}
                </div>
                <div class="pr-card-body">${preview}</div>
                <div class="pr-card-foot">
                    <button class="pr-copy-btn" data-id="${p.id}">&#128203; Copy</button>
                    <div class="pr-card-actions">
                        <button class="pr-edit-btn" data-id="${p.id}" title="Edit">&#9998;</button>
                        <button class="pr-del-btn" data-id="${p.id}" title="Delete">&#128465;</button>
                    </div>
                </div>
            </div>`;
        }).join('');

    area.innerHTML = `<div class="pr-container">
        <div class="pr-topbar">
            <div class="pr-topbar-left">
                <span class="pr-title">&#128172; PROMPTS</span>
                <span class="pr-sub">${d.prompts.length} saved prompt${d.prompts.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="pr-topbar-right">
                <input type="text" class="pr-search" id="pr-search-input" placeholder="&#128269; Search prompts..." value="${STATE._promptSearch || ''}">
                <button class="pr-add-btn" id="pr-add-prompt">&#xff0b; Add Prompt</button>
            </div>
        </div>
        <div class="pr-layout">
            ${catSideHtml}
            <div class="pr-cards" id="pr-cards">${cardsHtml}</div>
        </div>
    </div>`;

    // ── Events ──
    document.getElementById('pr-search-input')?.addEventListener('input', e => {
        STATE._promptSearch = e.target.value; renderPrompts();
    });

    document.querySelectorAll('.pr-cat-item').forEach(btn => {
        btn.addEventListener('click', e => {
            if (e.target.classList.contains('pr-cat-del')) return;
            STATE._promptsCat = btn.dataset.cat; renderPrompts();
        });
    });

    document.querySelectorAll('.pr-cat-del').forEach(x => {
        x.addEventListener('click', e => {
            e.stopPropagation();
            const cid = x.dataset.cid;
            const data = _loadPromptsData();
            data.categories = data.categories.filter(c => c.id !== cid);
            data.prompts.forEach(p => { if (p.categoryId === cid) p.categoryId = null; });
            _savePromptsData(data);
            if (STATE._promptsCat === cid) STATE._promptsCat = 'all';
            renderPrompts(); toast('Category removed', 'info');
        });
    });

    document.getElementById('pr-add-cat')?.addEventListener('click', () => {
        const overlay = document.getElementById('mini-modal-overlay');
        const titleEl = document.getElementById('mini-modal-title');
        const labelEl = document.getElementById('mini-modal-label');
        const inputEl = document.getElementById('mini-modal-input');
        const saveBtn = document.getElementById('mini-modal-save');
        const cancelBtn = document.getElementById('mini-modal-cancel');
        const closeBtn = document.getElementById('mini-modal-close');
        if (!overlay) return;
        titleEl.textContent = 'New Category'; labelEl.textContent = 'Category name';
        inputEl.placeholder = 'OnlyFans, Google, Design...'; inputEl.value = '';
        overlay.classList.remove('hidden'); setTimeout(() => inputEl.focus(), 50);
        const save = () => {
            const name = inputEl.value.trim(); if (!name) return;
            const data = _loadPromptsData();
            const color = PROMPT_CAT_COLORS[data.categories.length % PROMPT_CAT_COLORS.length];
            data.categories.push({ id: 'pc-' + Date.now(), name, color });
            _savePromptsData(data); overlay.classList.add('hidden'); cleanup();
            renderPrompts(); toast(`Category "${name}" added`, 'success');
        };
        const cancel = () => { overlay.classList.add('hidden'); cleanup(); };
        const cleanup = () => { saveBtn.onclick = null; cancelBtn.onclick = null; closeBtn.onclick = null; };
        saveBtn.onclick = save; cancelBtn.onclick = cancel; closeBtn.onclick = cancel;
        inputEl.onkeydown = e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); };
    });

    document.querySelectorAll('.pr-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = d.prompts.find(x => x.id === btn.dataset.id);
            if (!p) return;
            navigator.clipboard.writeText(p.text).then(() => {
                btn.textContent = '\u2705 Copied!';
                setTimeout(() => { btn.textContent = '\ud83d\udccb Copy'; }, 1800);
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = p.text; document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); ta.remove();
                btn.textContent = '\u2705 Copied!';
                setTimeout(() => { btn.textContent = '\ud83d\udccb Copy'; }, 1800);
            });
        });
    });

    document.querySelectorAll('.pr-del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const data = _loadPromptsData();
            data.prompts = data.prompts.filter(p => p.id !== btn.dataset.id);
            _savePromptsData(data); renderPrompts(); toast('Prompt deleted', 'info');
        });
    });

    document.querySelectorAll('.pr-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const data = _loadPromptsData();
            const p = data.prompts.find(x => x.id === btn.dataset.id);
            if (!p) return;
            _openPromptModal(p, data.categories, (title, text, catId) => {
                p.title = title; p.text = text; p.categoryId = catId;
                _savePromptsData(data); renderPrompts(); toast('Prompt updated', 'success');
            });
        });
    });

    document.getElementById('pr-add-prompt')?.addEventListener('click', () => {
        const data = _loadPromptsData();
        _openPromptModal(null, data.categories, (title, text, catId) => {
            data.prompts.push({ id: 'p-' + Date.now(), title, text, categoryId: catId, created: new Date().toLocaleDateString() });
            _savePromptsData(data); renderPrompts(); toast('Prompt saved!', 'success');
        });
    });
}

function renderContent() {
    const area = document.getElementById('content-area');
    const footer = document.getElementById('table-footer');

    if (STATE.currentView === 'notes') {
        renderNotes();
        footer.style.display = 'none';
        return;
    }

    if (STATE.currentView === 'new-cards') {
        renderParser();
        footer.style.display = 'none';
        return;
    }

    if (STATE.currentView === 'generator') {
        renderGenerator();
        footer.style.display = 'none';
        return;
    }

    if (STATE.currentView === 'builder') {
        renderBuilder();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'merchants') {
        renderMerchants();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'analytics') {
        renderAnalytics();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'tasks') {
        renderTasks();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'prompts') {
        renderPrompts();
        footer.style.display = 'none';
        return;
    }
    footer.style.display = 'flex';

    if (STATE.currentView === 'docs' || STATE.currentView === 'global-docs') {
        renderDocs();
        return;
    }

    // ═══════ ALL CARDS — Dedicated Aggregate View ═══════
    if (STATE.currentView === 'all-cards') {
        renderAllCards();
        return;
    }

    // Render cards table
    const cards = getFilteredCards();
    const start = (STATE.page - 1) * STATE.perPage;
    const pageCards = cards.slice(start, start + STATE.perPage);
    const totalPages = Math.max(1, Math.ceil(cards.length / STATE.perPage));

    if (cards.length === 0) {
        area.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
                </div>
                <p class="empty-title">No cards found</p>
                <p class="empty-text">Click "+ ADD" to add your first card</p>
            </div>
        `;
        renderFooter(0, 1, 1);
        return;
    }

    const isTrash = STATE.currentView === 'trash';
    const showName = STATE.currentView !== 'my-card' || true;
    const countryForBin = ['cards'].includes(STATE.currentView) ? STATE.currentCountry : null;

    let rows = pageCards.map((c, i) => {
        const idx = start + i + 1;
        const bin = getBin(c.cardNumber);
        const bc = binCount(bin, countryForBin);
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const binBadge = bc > 1 ? `<span class="name-count-badge ${getCountColor(bc)}">(${bc})</span>` : '';
        const binColorClass = getCountColor(bc);

        // Usage badges
        const isAllCards = STATE.currentView === 'all-cards';
        const cardUsageBadge = (c._cardUsage && c._cardUsage > 1)
            ? `<span class="usage-badge usage-card" onclick="event.stopPropagation(); _showCardDrawer('${c.cardNumber.replace(/\s/g, '')}', this)" title="Card used ${c._cardUsage} times">📇${c._cardUsage}</span>`
            : '';
        const nameUsageBadge = (!isAllCards && c._nameUsage && c._nameUsage > 1)
            ? `<span class="usage-badge usage-name" onclick="event.stopPropagation(); _showNameDrawer('${(c.name + ' ' + c.surname).toUpperCase().replace(/'/g, "\\'")}', this)" title="Name appears ${c._nameUsage} times">👤${c._nameUsage}</span>`
            : '';
        const allCardsNamesBadge = (isAllCards && c._nameCount && c._nameCount > 1)
            ? `<span class="usage-badge usage-names" title="${c._nameCount} unique names">👤${c._nameCount}</span>`
            : '';

        const getMailBadge = (card) => {
            if (card.mailNone) return '';
            if (card.mailVerify || card.mailSubmit) {
                let texts = [];
                if (card.mailVerify) texts.push('CC');
                if (card.mailSubmit) texts.push('DOC');
                return `<span class="mail-badge" title="Mail Status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M4 7l6.2 4.6c1.1.8 2.5.8 3.6 0L20 7"/><rect x="3" y="5" width="18" height="14" rx="2"/></svg>${texts.join(' / ')}</span>`;
            }
            return '';
        };

        return `
        <tr data-id="${c.id}" class="${_selectedCards.has(c.id) ? 'row-selected' : ''}">
            <td class="td-num"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="${c.id}" ${_selectedCards.has(c.id) ? 'checked' : ''} onchange="toggleCardSelect('${c.id}', this.checked)"></label></td>
            <td>
                <div class="card-cell">
                    <span class="card-name">
                        ${!isTrash ? `<button class="star-btn ${c.starred ? 'active' : ''}" onclick="toggleStar('${c.id}')" title="Active Now">★</button>` : ''}
                        <span class="flag">${flag}</span>
                        ${c.name.toUpperCase()} ${c.surname.toUpperCase()} ${binBadge} ${nameUsageBadge} ${allCardsNamesBadge}
                    </span>
                    <span class="card-number">${maskCard(c.cardNumber)} ${cardUsageBadge}</span>
                    ${(() => { const info = getBinInfo(getBin(c.cardNumber)); const txt = formatBinInfoText(info); return txt ? `<span class="bin-info">${txt}</span>` : `<span class="bin-info" data-bin="${getBin(c.cardNumber)}"></span>`; })()}
                </div>
            </td>
            <td class="note-indicator"><span class="editable-note" onclick="openInlineNote('${c.id}', this)">${c.notes || '<span class="note-placeholder">+ note</span>'}</span></td>
            <td class="bin-cell">${bin}</td>
            <td><span class="doc-type-badge ${c.docType ? c.docType.toLowerCase() : 'none'}" onclick="cycleCardType('${c.id}')" title="Click to change">${c.docType || '—'}</span></td>
            <td class="amt-cell"><span class="editable-amt" onclick="openInlineAmount('${c.id}', this)">${c.amount ? Number(c.amount).toLocaleString() : '-'}</span></td>
            <td class="mail-cell">
                <div class="mail-tags">
                    <button class="status-btn btn-vcc ${c.mailVerify ? 'active' : ''}" onclick="toggleMailTag('${c.id}','mailVerify')" title="Card Check">CC</button>
                    <button class="status-btn btn-sdoc ${c.mailSubmit ? 'active' : ''}" onclick="toggleMailTag('${c.id}','mailSubmit')" title="Document">DOC</button>
                </div>
            </td>
            <td>
                ${isTrash ? `
                    <button class="btn-secondary btn-restore" onclick="restoreCard('${c.id}')">Restore</button>
                ` : `
                    <div class="status-btns">
                        <button class="status-btn btn-a ${c.cardAdd ? 'active' : ''}" onclick="toggleStatus('${c.id}','cardAdd')" title="Card Add">A</button>
                        <button class="status-btn btn-r ${c.runAds ? 'active' : ''}" onclick="toggleStatus('${c.id}','runAds')" title="Run Ads">R</button>
                        <button class="status-btn btn-v ${c.verified ? 'active' : ''}" onclick="toggleStatus('${c.id}','verified')" title="Verify">V</button>
                        <button class="status-btn btn-m ${c.minic ? 'active' : ''}" onclick="toggleStatus('${c.id}','minic')" title="Minic">M</button>
                    </div>
                `}
            </td>
            <td class="date-cell">${c.date}</td>
            <td>
                ${isTrash ? `
                    <button class="more-btn" onclick="permanentDelete('${c.id}')" title="Delete forever">✕</button>
                ` : `
                    <button class="more-btn" onclick="openContextMenu(event, '${c.id}')">⋯</button>
                `}
            </td>
        </tr>`;
    }).join('');

    const sortIcon = (field) => {
        if (STATE.sortField !== field) return '↕';
        return STATE.sortDir === 'asc' ? '↑' : '↓';
    };

    area.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th><label class="bulk-check"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label></th>
                    <th class="sortable" data-sort="name">Card ${sortIcon('name')}</th>
                    <th class="sortable" data-sort="notes">Notes ${sortIcon('notes')}</th>
                    <th class="sortable" data-sort="bin">BIN ${sortIcon('bin')}</th>
                    <th class="sortable" data-sort="type">Type ${sortIcon('type')}</th>
                    <th class="sortable" data-sort="amount">Amt ${sortIcon('amount')}</th>
                    <th class="sortable" data-sort="mail">Mail ${sortIcon('mail')}</th>
                    <th class="sortable" data-sort="status">Status ${sortIcon('status')}</th>
                    <th class="sortable" data-sort="date">Date ${sortIcon('date')}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    // Attach sort handlers
    area.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', (e) => {
            if (e.target.classList.contains('col-resize-handle')) return; // don't sort on resize
            const field = th.dataset.sort;
            if (STATE.sortField === field) {
                STATE.sortDir = STATE.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                STATE.sortField = field;
                STATE.sortDir = 'asc';
            }
            renderContent();
        });
    });

    // Column resize
    initColumnResize(area.querySelector('.data-table'), 'workspace');

    renderFooter(cards.length, STATE.page, totalPages);

    // Async BIN lookup for uncached rows
    const uncachedEls = area.querySelectorAll('.bin-info[data-bin]');
    if (uncachedEls.length > 0) {
        const uniqueBins = [...new Set(Array.from(uncachedEls).map(el => el.dataset.bin))];
        uniqueBins.forEach((bin, i) => {
            // Stagger requests to respect API rate limit (25/min)
            setTimeout(() => {
                lookupBin(bin).then(info => {
                    if (!info) return;
                    const txt = formatBinInfoText(info);
                    document.querySelectorAll(`.bin-info[data-bin="${bin}"]`).forEach(el => {
                        if (txt) {
                            el.textContent = txt;
                            el.removeAttribute('data-bin');
                        }
                    });
                });
            }, i * 200); // 200ms delay between each unique BIN request
        });
    }
}

// ═══════ ALL CARDS — Aggregate Render ═══════
function renderAllCards() {
    const area = document.getElementById('content-area');
    const cards = getFilteredCards(); // already grouped by cardNumber
    const totalUse = cards.reduce((s, c) => s + (c._cardUsage || 1), 0);
    const avgUse = cards.length > 0 ? (totalUse / cards.length).toFixed(1) : '0';

    if (cards.length === 0) {
        area.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fill-rule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clip-rule="evenodd"/></svg>
                </div>
                <p class="empty-title">No cards found</p>
            </div>
        `;
        renderFooter(0, 1, 1);
        return;
    }

    const start = (STATE.page - 1) * STATE.perPage;
    const pageCards = cards.slice(start, start + STATE.perPage);
    const totalPages = Math.max(1, Math.ceil(cards.length / STATE.perPage));

    const getUseColor = (use) => {
        if (use <= 1) return '';
        if (use <= 3) return 'color: var(--green)';
        if (use <= 6) return 'color: var(--amber)';
        return 'color: var(--red)';
    };

    let rows = pageCards.map(c => {
        const bin = getBin(c.cardNumber);
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const info = getBinInfo(bin);
        const binTxt = formatBinInfoText(info);
        const useCount = c._cardUsage || 1;
        const names = c._nameCount || 1;
        const lastDate = c._lastDate || c.date || '—';
        const cardNum = c.cardNumber.replace(/\s/g, '');

        return `
        <tr class="ac-row" data-cardnum="${cardNum}" onclick="_toggleAllCardsDrawer('${cardNum}', this)">
            <td>
                <div class="card-cell">
                    <span class="card-name"><span class="flag">${flag}</span> ${maskCard(c.cardNumber)}</span>
                    ${binTxt ? `<span class="bin-info">${binTxt}</span>` : ''}
                </div>
            </td>
            <td class="bin-cell">${bin}</td>
            <td class="use-cell" style="${getUseColor(useCount)}">${useCount}x</td>
            <td class="ac-names-cell">${names}</td>
            <td class="date-cell">${lastDate}</td>
        </tr>`;
    }).join('');

    const sortIcon = (field) => {
        if (STATE.sortField !== field) return '↕';
        return STATE.sortDir === 'asc' ? '↑' : '↓';
    };

    area.innerHTML = `
        <table class="data-table ac-table">
            <thead>
                <tr>
                    <th class="sortable" data-sort="name">Card ${sortIcon('name')}</th>
                    <th class="sortable" data-sort="bin">BIN ${sortIcon('bin')}</th>
                    <th class="sortable" data-sort="status">Use ${sortIcon('status')}</th>
                    <th>Names</th>
                    <th class="sortable" data-sort="date">Last ${sortIcon('date')}</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    // Attach sort handlers
    area.querySelectorAll('.sortable').forEach(th => {
        th.addEventListener('click', (e) => {
            if (e.target.classList.contains('col-resize-handle')) return;
            const field = th.dataset.sort;
            if (STATE.sortField === field) {
                STATE.sortDir = STATE.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                STATE.sortField = field;
                STATE.sortDir = 'asc';
            }
            renderContent();
        });
    });

    initColumnResize(area.querySelector('.data-table'), 'allcards');
    renderFooter(cards.length, STATE.page, totalPages);
}

// All Cards detail drawer toggle
window._toggleAllCardsDrawer = function (cardNum, rowEl) {
    const existing = document.querySelector('.expand-drawer');
    if (existing) {
        const wasForSame = existing.dataset.key === 'ac:' + cardNum;
        existing.remove();
        if (wasForSame) return;
    }

    const matches = STATE.cards.filter(c => c.cardNumber.replace(/\s/g, '') === cardNum);
    if (matches.length === 0) return;

    const rowsHtml = matches.map(c => {
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const statuses = [c.cardAdd && 'A', c.runAds && 'R', c.verified && 'V', c.minic && 'M'].filter(Boolean).join(' ') || '—';
        return `<div class="drawer-row">
            <span class="drawer-flag">${flag}</span>
            <span class="drawer-name">${c.name.toUpperCase()} ${c.surname.toUpperCase()}</span>
            <span class="drawer-card">${maskCard(c.cardNumber)}</span>
            <span class="drawer-status">${statuses}</span>
            <span class="drawer-date">${c.date || '—'}</span>
        </div>`;
    }).join('');

    const colCount = rowEl.children.length;
    const drawerTr = document.createElement('tr');
    drawerTr.className = 'expand-drawer';
    drawerTr.dataset.key = 'ac:' + cardNum;
    drawerTr.innerHTML = `<td colspan="${colCount}">
        <div class="drawer-content">
            <div class="drawer-header">📇 ${matches.length} records with this card</div>
            ${rowsHtml}
        </div>
    </td>`;
    rowEl.after(drawerTr);
};

// Documents detail drawer toggle
window._toggleDocDrawer = function (docId, rowEl) {
    const existing = document.querySelector('.expand-drawer');
    if (existing) {
        const wasForSame = existing.dataset.key === 'doc:' + docId;
        existing.remove();
        if (wasForSame) return;
    }

    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc || !doc.cardIds || doc.cardIds.length === 0) return;

    const linkedCards = doc.cardIds.map(cid => STATE.cards.find(c => c.id === cid)).filter(Boolean);
    if (linkedCards.length === 0) return;

    const rowsHtml = linkedCards.map(c => {
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const statuses = [c.cardAdd && 'A', c.runAds && 'R', c.verified && 'V', c.minic && 'M'].filter(Boolean).join(' ') || '—';
        return `<div class="drawer-row">
            <span class="drawer-flag">${flag}</span>
            <span class="drawer-card">${maskCard(c.cardNumber)}</span>
            <span class="drawer-name">${c.name.toUpperCase()} ${c.surname.toUpperCase()}</span>
            <span class="drawer-status">${statuses}</span>
            <span class="drawer-date">${c.date || '—'}</span>
        </div>`;
    }).join('');

    const colCount = rowEl.children.length;
    const drawerTr = document.createElement('tr');
    drawerTr.className = 'expand-drawer';
    drawerTr.dataset.key = 'doc:' + docId;
    drawerTr.innerHTML = `<td colspan="${colCount}">
        <div class="drawer-content">
            <div class="drawer-header">👤 ${linkedCards.length} cards linked to ${doc.fullName}</div>
            ${rowsHtml}
        </div>
    </td>`;
    rowEl.after(drawerTr);
};

function renderDocs() {
    const area = document.getElementById('content-area');
    const docs = getFilteredDocs();

    if (docs.length === 0) {
        area.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
                </div>
                <p class="empty-title">No documents yet</p>
                <p class="empty-text">Documents are created automatically when you add cards</p>
            </div>
        `;
        renderFooter(0, 1, 1);
        return;
    }

    const country = STATE.countries.find(c => c.id === STATE.currentCountry);
    const flag = country?.flag || '';
    const geoCode = STATE.currentCountry === 'canada' ? 'CA' : STATE.currentCountry === 'usa' ? 'US' : STATE.currentCountry.slice(0, 2).toUpperCase();

    const getUseColor = (use) => {
        if (!use) return '';
        if (use <= 3) return 'color: var(--green)';
        if (use <= 6) return 'color: var(--amber)';
        return 'color: var(--red)';
    };

    let rows = docs.map((d, i) => {
        const newBadge = d.docStatus === 'new'
            ? `<span class="doc-status-new" onclick="event.stopPropagation(); _docClearNew('${d.id}')">NEW</span>`
            : '';
        const cardsCount = (d.cardIds || []).length;
        return `
        <tr class="doc-row" onclick="_toggleDocDrawer('${d.id}', this)">
            <td class="td-num">${i + 1}</td>
            <td>
                <div class="card-cell">
                    <span class="card-name">
                        <span class="flag">${flag}</span>
                        ${d.fullName}
                        ${newBadge}
                    </span>
                </div>
            </td>
            <td class="note-indicator" onclick="event.stopPropagation()"><span class="editable-note" onclick="openDocNote('${d.id}', this)">${d.notes || '<span class="note-placeholder">+ note</span>'}</span></td>
            <td class="doc-type" onclick="event.stopPropagation()"><span class="doc-type-badge clickable-type ${(d.type || '').toLowerCase()}" onclick="cycleDocType('${d.id}')" title="Click to change type">${d.type && d.type !== '-' ? d.type : '-'}</span></td>
            <td><span class="geo-badge">${geoCode}</span></td>
            <td class="use-cell" style="${getUseColor(d.use || 0)}">${d.use || 0}x</td>
            <td class="ac-names-cell">${cardsCount}</td>
            <td>
                <div class="status-btns vs-counters" onclick="event.stopPropagation()">
                    <span class="vs-counter" data-doc-id="${d.id}" data-vs="v" onclick="incrementDocV('${d.id}')" oncontextmenu="decrementDocV('${d.id}'); return false;">${d.verified || 0}</span>
                    <span class="vs-separator">|</span>
                    <span class="vs-counter" data-doc-id="${d.id}" data-vs="s" onclick="incrementDocS('${d.id}')" oncontextmenu="decrementDocS('${d.id}'); return false;">${d.suspended || 0}</span>
                </div>
            </td>
            <td class="date-cell">${d.date}</td>
            <td onclick="event.stopPropagation()"><button class="more-btn" onclick="openDocMenu(event, '${d.id}')">⋯</button></td>
        </tr>
    `}).join('');

    const docSortIcon = (field) => {
        if (STATE.docSortField !== field) return '↕';
        return STATE.docSortDir === 'asc' ? '↑' : '↓';
    };

    area.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th class="sortable-doc" data-sort="name">Name ${docSortIcon('name')}</th>
                    <th class="sortable-doc" data-sort="notes">Notes ${docSortIcon('notes')}</th>
                    <th class="sortable-doc" data-sort="type">Type ${docSortIcon('type')}</th>
                    <th class="sortable-doc" data-sort="geo">Geo ${docSortIcon('geo')}</th>
                    <th class="sortable-doc" data-sort="use">Use ${docSortIcon('use')}</th>
                    <th>Cards</th>
                    <th class="sortable-doc" data-sort="vs">V / S ${docSortIcon('vs')}</th>
                    <th class="sortable-doc" data-sort="date">Date ${docSortIcon('date')}</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    // Attach doc sort handlers
    area.querySelectorAll('.sortable-doc').forEach(th => {
        th.addEventListener('click', (e) => {
            if (e.target.classList.contains('col-resize-handle')) return;
            const field = th.dataset.sort;
            if (STATE.docSortField === field) {
                STATE.docSortDir = STATE.docSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                STATE.docSortField = field;
                STATE.docSortDir = 'asc';
            }
            renderContent();
        });
    });

    initColumnResize(area.querySelector('.data-table'), 'documents');
    renderFooter(docs.length, 1, 1);
}

function _getActiveNoteTab() {
    return STATE.notesTabs.find(t => t.id === STATE.notesActiveTab) || STATE.notesTabs[0];
}

function _saveActiveTab() {
    const textarea = document.getElementById('notes-textarea');
    if (!textarea) return;
    const tab = _getActiveNoteTab();
    if (tab) {
        tab.content = textarea.value;
        tab.scrollPos = textarea.scrollTop;
    }
    STATE.notes = textarea.value;
    STATE.notesLastSaved = Date.now();
    save();
}

function _saveAllTabs() {
    const textarea = document.getElementById('notes-textarea');
    if (textarea) {
        const tab = _getActiveNoteTab();
        if (tab) {
            tab.content = textarea.value;
            tab.scrollPos = textarea.scrollTop;
        }
        STATE.notes = textarea.value;
    }
    STATE.notesLastSaved = Date.now();
    save();
    toast('All tabs saved', 'success');
}

function _buildLineNumsHTML(count, pinnedLines) {
    const pinSet = new Set(pinnedLines || []);
    let html = '';
    for (let i = 1; i <= count; i++) {
        const isPinned = pinSet.has(i);
        html += `<div class="nl-row${isPinned ? ' nl-pinned' : ''}" data-line="${i}"><span class="nl-pin">${isPinned ? '📌' : ''}</span><span class="nl-num">${i}</span></div>`;
    }
    return html;
}

function _rebuildLineNums(textarea) {
    const nums = (textarea.value || '').split('\n').length;
    const tab = _getActiveNoteTab();
    const container = document.getElementById('notes-line-nums');
    if (!container) return;
    container.innerHTML = _buildLineNumsHTML(nums, tab?.pinnedLines);
    _wireLinePinClicks(container);
}

function _wireLinePinClicks(container) {
    container.querySelectorAll('.nl-row').forEach(row => {
        row.addEventListener('click', () => {
            const lineNum = parseInt(row.dataset.line);
            const tab = _getActiveNoteTab();
            if (!tab) return;
            if (!tab.pinnedLines) tab.pinnedLines = [];
            const idx = tab.pinnedLines.indexOf(lineNum);
            if (idx >= 0) {
                tab.pinnedLines.splice(idx, 1);
                row.classList.remove('nl-pinned');
                row.querySelector('.nl-pin').textContent = '';
            } else {
                tab.pinnedLines.push(lineNum);
                row.classList.add('nl-pinned');
                row.querySelector('.nl-pin').textContent = '📌';
            }
            save();
        });
    });
}

function renderNotes() {
    const area = document.getElementById('content-area');
    const activeTab = _getActiveNoteTab();
    if (!activeTab) return;
    if (!activeTab.pinnedLines) activeTab.pinnedLines = [];

    const tabs = [...STATE.notesTabs];
    const content = activeTab.content || '';
    const lines = content.split('\n');
    const lineCount = lines.length || 1;
    const lineNumsHTML = _buildLineNumsHTML(lineCount, activeTab.pinnedLines);

    let tabsHTML = tabs.map(t => {
        const isActive = t.id === STATE.notesActiveTab;
        return `<button class="nt-tab ${isActive ? 'active' : ''}" data-tab="${t.id}">
            <span class="nt-tab-title" data-tab="${t.id}">${t.title}</span>
            ${tabs.length > 1 ? `<span class="nt-tab-close" data-tab="${t.id}">×</span>` : ''}
        </button>`;
    }).join('');
    tabsHTML += `<button class="nt-new-tab" id="nt-new-tab">+</button>`;

    area.innerHTML = `
        <div class="notes-container">
            <div class="nt-tab-bar">
                <div class="nt-tabs-scroll">${tabsHTML}</div>
                <div class="nt-toolbar-right">
                    <button class="nt-tool-btn" id="notes-clear-btn" title="Clear current tab">CLEAR</button>
                    <button class="nt-tool-btn" id="notes-save-btn">SAVE</button>
                </div>
            </div>
            <div class="notes-editor-wrap">
                <div class="notes-line-numbers" id="notes-line-nums">${lineNumsHTML}</div>
                <textarea class="notes-editor" id="notes-textarea" style="font-size:${STATE.notesFontSize}px" placeholder="Write notes...">${content}</textarea>
            </div>
            <div class="notes-status-bar">
                <span class="notes-saved-info">${lineCount} lines</span>
            </div>
        </div>
    `;

    // Wire pin clicks on line numbers
    _wireLinePinClicks(document.getElementById('notes-line-nums'));

    const textarea = document.getElementById('notes-textarea');
    let _notesSaveTimer = null;
    textarea.addEventListener('input', () => {
        _rebuildLineNums(textarea);
        const si = document.querySelector('.notes-saved-info');
        if (si) si.textContent = 'Editing...';
        clearTimeout(_notesSaveTimer);
        _notesSaveTimer = setTimeout(() => {
            _saveActiveTab();
            const nums = (textarea.value || '').split('\n').length;
            if (si) si.textContent = nums + ' lines';
        }, 600);
    });
    textarea.addEventListener('scroll', () => {
        document.getElementById('notes-line-nums').scrollTop = textarea.scrollTop;
    });
    if (activeTab.scrollPos) {
        textarea.scrollTop = activeTab.scrollPos;
        document.getElementById('notes-line-nums').scrollTop = activeTab.scrollPos;
    }

    // Tab switching
    area.querySelectorAll('.nt-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('nt-tab-close')) return;
            _saveActiveTab();
            STATE.notesActiveTab = btn.dataset.tab;
            save();
            renderNotes();
        });
    });

    // Tab close
    area.querySelectorAll('.nt-tab-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabId = btn.dataset.tab;
            if (STATE.notesTabs.length <= 1) return;
            const tab = STATE.notesTabs.find(t => t.id === tabId);
            if (tab && tab.content && tab.content.trim()) {
                if (!confirm(`Close "${tab.title}"?`)) return;
            }
            STATE.notesTabs = STATE.notesTabs.filter(t => t.id !== tabId);
            if (STATE.notesActiveTab === tabId) {
                STATE.notesActiveTab = STATE.notesTabs[0]?.id || '';
            }
            save();
            renderNotes();
        });
    });

    // Tab rename — inline edit on click
    area.querySelectorAll('.nt-tab-title').forEach(span => {
        span.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const tabId = span.dataset.tab;
            const tab = STATE.notesTabs.find(t => t.id === tabId);
            if (!tab) return;
            span.contentEditable = 'true';
            span.focus();
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(span);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            const finish = () => {
                span.contentEditable = 'false';
                const newName = span.textContent.trim();
                if (newName && newName !== tab.title) {
                    tab.title = newName;
                    save();
                }
                span.textContent = tab.title; // reset if empty
            };
            span.addEventListener('blur', finish, { once: true });
            span.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); span.blur(); }
                if (ev.key === 'Escape') { span.textContent = tab.title; span.blur(); }
            });
        });
    });

    // New tab
    document.getElementById('nt-new-tab')?.addEventListener('click', () => {
        _saveActiveTab();
        const newTab = {
            id: 'tab-' + Date.now(),
            title: 'Tab ' + (STATE.notesTabs.length + 1),
            content: '',
            pinned: false,
            tag: null,
            created: Date.now(),
            scrollPos: 0
        };
        STATE.notesTabs.push(newTab);
        STATE.notesActiveTab = newTab.id;
        save();
        renderNotes();
    });

    // Toolbar
    document.getElementById('notes-save-btn')?.addEventListener('click', _saveAllTabs);

    // Clear current tab
    document.getElementById('notes-clear-btn')?.addEventListener('click', () => {
        const tab = _getActiveNoteTab();
        if (!tab) return;
        if (tab.content && tab.content.trim() && !confirm(`Clear "${tab.title}"?`)) return;
        tab.content = '';
        STATE.notes = '';
        save();
        renderNotes();
        toast('Tab cleared', 'info');
    });

    // Highlight selected text
    document.getElementById('notes-highlight-btn')?.addEventListener('click', () => {
        const ta = document.getElementById('notes-textarea');
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        if (start === end) { toast('Select text first', 'warning'); return; }
        const text = ta.value;
        const selected = text.slice(start, end);
        // Toggle: if already wrapped, unwrap
        if (text.slice(start - 1, start) === '«' && text.slice(end, end + 1) === '»') {
            ta.value = text.slice(0, start - 1) + selected + text.slice(end + 1);
            ta.selectionStart = start - 1;
            ta.selectionEnd = end - 1;
        } else {
            ta.value = text.slice(0, start) + '«' + selected + '»' + text.slice(end);
            ta.selectionStart = start;
            ta.selectionEnd = end + 2;
        }
        ta.dispatchEvent(new Event('input'));
        ta.focus();
    });

    // Paste image from clipboard
    document.getElementById('notes-textarea')?.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = () => {
                    const ta = document.getElementById('notes-textarea');
                    const pos = ta.selectionStart;
                    const marker = `\n[IMG:${reader.result}]\n`;
                    ta.value = ta.value.slice(0, pos) + marker + ta.value.slice(pos);
                    ta.selectionStart = ta.selectionEnd = pos + marker.length;
                    ta.dispatchEvent(new Event('input'));
                    toast('Image pasted', 'success');
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    });
}

function renderFooter(count, page, totalPages) {
    document.getElementById('records-count').textContent = `${count} records · Page ${page} of ${totalPages}`;
    document.getElementById('page-info').textContent = `Page ${page} of ${totalPages}`;
    document.getElementById('prev-page').disabled = page <= 1;
    document.getElementById('next-page').disabled = page >= totalPages;
}

function renderPageTitle() {
    const flagEl = document.getElementById('page-flag');
    const titleEl = document.getElementById('page-title-text');
    if (!flagEl || !titleEl) { /* No page title elements — using top nav tabs */
        const showAdd = ['cards', 'my-card', 'ready-to-work', 'all-cards', 'docs', 'global-docs'].includes(STATE.currentView);
        const addBtn = document.getElementById('add-card-btn');
        if (addBtn) addBtn.style.display = showAdd ? 'flex' : 'none';
        renderGeoFilterBar();
        return;
    }

    const country = STATE.countries.find(c => c.id === STATE.currentCountry);

    switch (STATE.currentView) {
        case 'cards':
            flagEl.textContent = country?.flag || '';
            titleEl.textContent = `${country?.name || ''} — Workspace`;
            break;
        case 'docs':
            flagEl.textContent = country?.flag || '';
            titleEl.textContent = `${country?.name || ''} — Documents`;
            break;
        case 'my-card':
            flagEl.textContent = '💳';
            titleEl.textContent = 'My Card';
            break;
        case 'favorites':
            flagEl.textContent = '❤️';
            titleEl.textContent = 'Favorites';
            break;
        case 'active-now':
            flagEl.textContent = '⚡';
            titleEl.textContent = 'Active Now';
            break;
        case 'notes':
            flagEl.textContent = '📝';
            titleEl.textContent = 'Notes';
            break;
        case 'new-cards':
            flagEl.textContent = '🔍';
            titleEl.textContent = 'Parser';
            break;
        case 'generator':
            flagEl.textContent = '⚙️';
            titleEl.textContent = 'Generator';
            break;
        case 'builder':
            flagEl.textContent = '🏗️';
            titleEl.textContent = 'Builder';
            break;
        case 'merchants':
            flagEl.textContent = '🏪';
            titleEl.textContent = STATE.merchantView === 'detail' ? 'Merchant Detail' : 'Merchants';
            break;
        case 'ready-to-work':
            flagEl.textContent = '✅';
            titleEl.textContent = 'Ready to Work';
            break;
        case 'all-cards':
            flagEl.textContent = '📦';
            titleEl.textContent = 'All Cards';
            break;
        case 'global-docs':
            flagEl.textContent = '📄';
            titleEl.textContent = 'Documents — Global';
            break;
        case 'trash':
            flagEl.textContent = '🗑️';
            titleEl.textContent = 'Trash';
            break;
    }

    // Show/hide buttons
    const showAdd = ['cards', 'my-card', 'ready-to-work', 'all-cards'].includes(STATE.currentView);

    document.getElementById('add-card-btn').style.display = showAdd ? 'flex' : 'none';

    if (STATE.currentView === 'docs' || STATE.currentView === 'global-docs') {
        document.getElementById('add-card-btn').style.display = 'flex';
        document.getElementById('add-btn-text').textContent = 'ADD DOC';
    } else {
        document.getElementById('add-btn-text').textContent = 'ADD';
    }

    // GEO filter bar for My Card and Global Docs
    renderGeoFilterBar();
}

function renderGeoFilterBar() {
    let bar = document.getElementById('geo-filter-bar');
    if (!['my-card', 'global-docs'].includes(STATE.currentView)) {
        if (bar) bar.remove();
        return;
    }

    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'geo-filter-bar';
        bar.className = 'geo-filter-bar';
        const parent = document.querySelector('.top-bar-left') || document.getElementById('stats-bar');
        if (!parent) return;
        parent.appendChild(bar);
    }

    const geos = new Set();
    const source = STATE.currentView === 'global-docs' ? STATE.docs : STATE.cards;
    source.forEach(item => { if (item.country) geos.add(item.country); });

    let html = `<button class="geo-btn ${_geoFilter === 'all' ? 'active' : ''}" onclick="setGeoFilter('all')">ALL</button>`;
    STATE.countries.forEach(c => {
        if (geos.has(c.id)) {
            const code = c.id === 'canada' ? 'CA' : c.id === 'usa' ? 'US' : c.id.slice(0, 2).toUpperCase();
            html += `<button class="geo-btn ${_geoFilter === c.id ? 'active' : ''}" onclick="setGeoFilter('${c.id}')">${code}</button>`;
        }
    });
    bar.innerHTML = html;
}

window.setGeoFilter = function (geo) {
    _geoFilter = geo;
    STATE.page = 1;
    renderAll();
};

function renderAll() {
    renderSidebar();
    renderPageTitle();
    renderStats();
    renderContent();
}

// ──── NAVIGATION ────
function navigate(view, country) {
    // Auto-save active notes tab before leaving notes view
    if (STATE.currentView === 'notes') {
        const textarea = document.getElementById('notes-textarea');
        if (textarea) {
            const tab = STATE.notesTabs.find(t => t.id === STATE.notesActiveTab);
            if (tab) {
                tab.content = textarea.value;
                tab.scrollPos = textarea.scrollTop;
            }
            STATE.notes = textarea.value;
            STATE.notesLastSaved = Date.now();
            save();
        }
    }
    STATE.currentView = view;
    if (country) STATE.currentCountry = country;
    STATE.page = 1;
    STATE.search = '';
    document.getElementById('search-input').value = '';
    renderAll();
}

window.expandCountry = function (id) {
    // Just navigate to cards
    navigate('cards', id);
};

window.deleteCountry = function (id) {
    if (['canada', 'usa'].includes(id)) return; // Cannot delete default countries
    const country = STATE.countries.find(c => c.id === id);
    if (!country) return;
    if (!confirm(`Delete "${country.name}" and all its cards/docs?`)) return;
    STATE.cards = STATE.cards.filter(c => c.country !== id);
    STATE.docs = STATE.docs.filter(d => d.country !== id);
    STATE.countries = STATE.countries.filter(c => c.id !== id);
    save();
    if (STATE.currentCountry === id) navigate('cards', 'canada');
    else renderAll();
    toast(`Country "${country.name}" deleted`, 'info');
};



// ──── CARD ACTIONS ────
window.toggleStar = function (id) {
    const card = STATE.cards.find(c => c.id === id);
    if (card) {
        card.starred = !card.starred;
        save();

        // Targeted DOM update
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const starBtn = row.querySelector('.star-btn');
            if (starBtn) starBtn.classList.toggle('active', card.starred);
        }

        updateStatsInPlace();
        updateSidebarBadges();
        toast(card.starred ? '⭐ Added to Active Now' : 'Removed from Active Now', 'success');
    }
};

// ──── MAIL TAG TOGGLE ────
window.toggleMailTag = function (id, field) {
    const card = STATE.cards.find(c => c.id === id);
    if (!card) return;
    card[field] = !card[field];
    // If enabling a mail status, disable mailNone
    if (card[field]) card.mailNone = false;
    // If both are off, keep as-is (user can set mailNone from edit modal)
    save();
    renderContent();
    const label = field === 'mailVerify' ? 'CC' : 'DOC';
    toast(card[field] ? `✉ ${label}: ON` : `${label}: OFF`, 'success');
};

// ──── TYPE TOGGLE (PP ↔ DL) ────
window.cycleCardType = function (id) {
    const card = STATE.cards.find(c => c.id === id);
    if (!card) return;
    const types = ['PP', 'DL', ''];
    const current = types.indexOf(card.docType || '');
    card.docType = types[(current + 1) % types.length];
    save();
    renderAll();
    toast(`Type: ${card.docType || 'None'}`, 'info');
};

window.cycleDocTypeInline = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    const types = ['PP', 'DL', '-'];
    const current = types.indexOf(doc.type || '-');
    doc.type = types[(current + 1) % types.length];
    save();
    renderAll();
    toast(`Type: ${doc.type}`, 'info');
};

window.toggleStatus = function (id, field) {
    const card = STATE.cards.find(c => c.id === id);
    if (card) {
        card[field] = !card[field];

        // V/R mutual exclusion: V and R cannot be active at the same time
        if (field === 'verified' && card.verified) {
            card.runAds = false;
        } else if (field === 'runAds' && card.runAds) {
            card.verified = false;
        }

        save();

        // Targeted DOM update: toggle button classes without re-render
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            const btnA = row.querySelector('.status-btn.btn-a');
            const btnR = row.querySelector('.status-btn.btn-r');
            const btnV = row.querySelector('.status-btn.btn-v');
            const btnM = row.querySelector('.status-btn.btn-m');
            if (btnA) btnA.classList.toggle('active', card.cardAdd);
            if (btnR) btnR.classList.toggle('active', card.runAds);
            if (btnV) btnV.classList.toggle('active', card.verified);
            if (btnM) btnM.classList.toggle('active', card.minic);
        }

        // Update stat counters in-place
        updateStatsInPlace();
        updateSidebarBadges();

        const labels = { cardAdd: 'Card Add', runAds: 'Run Ads', verified: 'Verified', minic: 'Minic' };
        toast(`${labels[field]}: ${card[field] ? 'ON' : 'OFF'}`, card[field] ? 'success' : 'info');
    }
};

window.restoreCard = function (id) {
    const idx = STATE.trash.findIndex(c => c.id === id);
    if (idx >= 0) {
        const card = STATE.trash.splice(idx, 1)[0];
        STATE.cards.push(card);
        save();
        renderAll();
        toast('Card restored', 'success');
    }
};

window.permanentDelete = function (id) {
    STATE.trash = STATE.trash.filter(c => c.id !== id);
    save();
    renderAll();
    toast('Permanently deleted', 'info');
};

// ═══════ EXPAND DRAWERS ═══════

window._showCardDrawer = function (cardNum, el) {
    // Close existing drawer
    const existing = document.querySelector('.expand-drawer');
    if (existing) {
        const wasForSame = existing.dataset.key === 'card:' + cardNum;
        existing.remove();
        if (wasForSame) return;
    }

    const matches = STATE.cards.filter(c => c.cardNumber.replace(/\s/g, '') === cardNum);
    if (matches.length <= 1) return;

    const rowsHtml = matches.map(c => {
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const statuses = [c.cardAdd && 'A', c.runAds && 'R', c.verified && 'V', c.minic && 'M'].filter(Boolean).join(' ') || '—';
        return `<div class="drawer-row">
            <span class="drawer-flag">${flag}</span>
            <span class="drawer-name">${c.name.toUpperCase()} ${c.surname.toUpperCase()}</span>
            <span class="drawer-card">${maskCard(c.cardNumber)}</span>
            <span class="drawer-status">${statuses}</span>
            <span class="drawer-date">${c.date || '—'}</span>
        </div>`;
    }).join('');

    const tr = el.closest('tr');
    if (!tr) return;
    const colCount = tr.children.length;
    const drawerTr = document.createElement('tr');
    drawerTr.className = 'expand-drawer';
    drawerTr.dataset.key = 'card:' + cardNum;
    drawerTr.innerHTML = `<td colspan="${colCount}">
        <div class="drawer-content">
            <div class="drawer-header">📇 ${matches.length} records with this card</div>
            ${rowsHtml}
        </div>
    </td>`;
    tr.after(drawerTr);
};

window._showNameDrawer = function (fullName, el) {
    const existing = document.querySelector('.expand-drawer');
    if (existing) {
        const wasForSame = existing.dataset.key === 'name:' + fullName;
        existing.remove();
        if (wasForSame) return;
    }

    const matches = STATE.cards.filter(c => (c.name + ' ' + c.surname).toUpperCase() === fullName);
    if (matches.length <= 1) return;

    const rowsHtml = matches.map(c => {
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const statuses = [c.cardAdd && 'A', c.runAds && 'R', c.verified && 'V', c.minic && 'M'].filter(Boolean).join(' ') || '—';
        return `<div class="drawer-row">
            <span class="drawer-flag">${flag}</span>
            <span class="drawer-name">${c.name.toUpperCase()} ${c.surname.toUpperCase()}</span>
            <span class="drawer-card">${maskCard(c.cardNumber)}</span>
            <span class="drawer-status">${statuses}</span>
            <span class="drawer-date">${c.date || '—'}</span>
        </div>`;
    }).join('');

    const tr = el.closest('tr');
    if (!tr) return;
    const colCount = tr.children.length;
    const drawerTr = document.createElement('tr');
    drawerTr.className = 'expand-drawer';
    drawerTr.dataset.key = 'name:' + fullName;
    drawerTr.innerHTML = `<td colspan="${colCount}">
        <div class="drawer-content">
            <div class="drawer-header">👤 ${matches.length} records with this name</div>
            ${rowsHtml}
        </div>
    </td>`;
    tr.after(drawerTr);
};

// ──── MULTI-SELECT ACTIONS ────

function toggleCardSelect(id, checked) {
    if (checked) _selectedCards.add(id);
    else _selectedCards.delete(id);
    // Update row highlight
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (row) row.classList.toggle('row-selected', checked);
    // Update select-all checkbox state
    const allCb = document.getElementById('select-all-cb');
    if (allCb) {
        const allCbs = document.querySelectorAll('.row-select-cb');
        allCb.checked = allCbs.length > 0 && _selectedCards.size >= allCbs.length;
    }
    updateBulkBar();
}

function toggleSelectAll(checked) {
    document.querySelectorAll('.row-select-cb').forEach(cb => {
        const id = cb.dataset.cardId;
        cb.checked = checked;
        if (checked) _selectedCards.add(id);
        else _selectedCards.delete(id);
        const row = cb.closest('tr');
        if (row) row.classList.toggle('row-selected', checked);
    });
    updateBulkBar();
}

function updateBulkBar() {
    let bar = document.getElementById('bulk-action-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'bulk-action-bar';
        bar.className = 'bulk-action-bar hidden';
        bar.innerHTML = `
            <span class="bulk-count"></span>
            <button class="bulk-btn bulk-copy" onclick="bulkCopyCards()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
                Copy All
            </button>
            <button class="bulk-btn bulk-delete" onclick="bulkDeleteCards()">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
                Delete
            </button>
            <button class="bulk-btn bulk-clear" onclick="clearSelection()">✕</button>
        `;
        document.body.appendChild(bar);
    }
    const count = _selectedCards.size;
    if (count > 0) {
        bar.classList.remove('hidden');
        bar.querySelector('.bulk-count').textContent = `${count} selected`;
    } else {
        bar.classList.add('hidden');
    }
}

function formatCardForCopy(card) {
    const bin = getBin(card.cardNumber);
    const binInfo = getBinInfo(bin);
    const bank = binInfo?.bank || '';
    const cType = binInfo?.type || card.cardType || '';
    const mm = card.month || card.mm || '';
    const yy = card.year || card.yy || '';
    const cvv = card.cvv || '';
    const lines = [`${card.cardNumber} ${mm} ${yy} ${cvv}`];
    if (card.name || card.surname) lines.push(`${card.name || ''} ${card.surname || ''}`.trim());
    if (bank || cType) lines.push(`${bank} ${cType}`.trim());
    return lines.join('\n');
}

function bulkCopyCards() {
    const cards = STATE.cards.filter(c => _selectedCards.has(c.id));
    if (cards.length === 0) return;
    const text = cards.map(c => formatCardForCopy(c)).join('\n\n');
    navigator.clipboard?.writeText(text);
    toast(`${cards.length} cards copied`, 'success');
    clearSelection();
}

function bulkDeleteCards() {
    const ids = [..._selectedCards];
    const cards = STATE.cards.filter(c => ids.includes(c.id));
    if (cards.length === 0) return;
    STATE.trash.push(...cards);
    STATE.cards = STATE.cards.filter(c => !ids.includes(c.id));
    save();
    clearSelection();
    renderAll();
    toast(`${cards.length} cards moved to trash`, 'info');
}

function clearSelection() {
    _selectedCards.clear();
    document.querySelectorAll('.row-select-cb').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.row-selected').forEach(r => r.classList.remove('row-selected'));
    const allCb = document.getElementById('select-all-cb');
    if (allCb) allCb.checked = false;
    updateBulkBar();
}

// ──── CONTEXT MENU ────
const CARD_MENU_HTML = `
    <button class="ctx-item" data-action="copy">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
        Copy
    </button>
    <button class="ctx-item" data-action="edit">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
        Edit
    </button>
    <button class="ctx-item" data-action="clone">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z"/><path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z"/></svg>
        Clone
    </button>
    <div class="ctx-divider"></div>
    <button class="ctx-item danger" data-action="delete">
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        Delete
    </button>
`;

function handleCardMenuAction(action) {
    const card = STATE.cards.find(c => c.id === STATE.contextCardId);
    if (!card) return;
    switch (action) {
        case 'copy': {
            const text = formatCardForCopy(card);
            navigator.clipboard?.writeText(text);
            toast('Copied to clipboard', 'success');
            break;
        }
        case 'edit':
            openEditModal(card);
            break;
        case 'clone': {
            const clone = { ...card, id: genId(), date: todayStr() };
            STATE.cards.push(clone);
            ensureDoc(clone);
            save();
            renderAll();
            toast('Card cloned', 'success');
            break;
        }
        case 'delete':
            STATE.cards = STATE.cards.filter(c => c.id !== card.id);
            STATE.trash.push({ ...card, deletedAt: todayStr() });
            save();
            renderAll();
            toast('Moved to trash', 'info');
            break;
    }
}

window.openContextMenu = function (e, id) {
    e.stopPropagation();
    STATE.contextCardId = id;
    const menu = document.getElementById('context-menu');
    menu.innerHTML = CARD_MENU_HTML;
    menu.classList.remove('hidden');
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    menu.querySelectorAll('.ctx-item').forEach(btn => {
        btn.addEventListener('click', () => {
            handleCardMenuAction(btn.dataset.action);
            menu.classList.add('hidden');
        }, { once: true });
    });
};

window.openDocMenu = function (e, id) {
    e.stopPropagation();
    STATE.contextDocId = id;
    const menu = document.getElementById('context-menu');
    // Show doc-specific menu
    menu.innerHTML = `
        <button class="ctx-item" data-action="edit-doc">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
            Edit Notes
        </button>
        <button class="ctx-item" data-action="change-doc-type">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
            Change Type
        </button>
        <div class="ctx-divider"></div>
        <button class="ctx-item danger" data-action="delete-doc">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            Delete
        </button>
    `;
    menu.classList.remove('hidden');
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    // Attach doc menu handlers
    menu.querySelectorAll('.ctx-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            const doc = STATE.docs.find(d => d.id === STATE.contextDocId);
            if (!doc) return;
            menu.classList.add('hidden');
            switch (action) {
                case 'edit-doc': {
                    showMiniModal('Edit Note', doc.fullName, doc.notes || '', 'Add note...', (val) => {
                        doc.notes = val.trim();
                        save();
                        renderAll();
                        toast('Doc note updated', 'success');
                    });
                    break;
                }
                case 'change-doc-type': {
                    showMiniModal('Change Type', doc.fullName, doc.type || '', 'DL / PP', (val) => {
                        doc.type = val.toUpperCase().trim() || '-';
                        save();
                        renderAll();
                        toast('Doc type updated', 'success');
                    });
                    break;
                }
                case 'delete-doc': {
                    showMiniModal('Delete Document', 'Type DELETE to confirm removal of ' + doc.fullName, '', 'DELETE', (val) => {
                        if (val.toUpperCase() === 'DELETE') {
                            STATE.docs = STATE.docs.filter(d => d.id !== doc.id);
                            save();
                            renderAll();
                            toast('Document deleted', 'info');
                        } else {
                            toast('Deletion cancelled', 'error');
                        }
                    });
                    break;
                }
            }
        }, { once: true });
    });
};

// Context menu close is now handled by the dropdown close handler below

// ──── MINI-MODAL UTILITY ────
// Replaces all prompt() calls with a themed dark modal
function showMiniModal(title, label, currentValue, placeholder, callback) {
    const overlay = document.getElementById('mini-modal-overlay');
    const input = document.getElementById('mini-modal-input');
    const titleEl = document.getElementById('mini-modal-title');
    const labelEl = document.getElementById('mini-modal-label');
    const saveBtn = document.getElementById('mini-modal-save');
    const cancelBtn = document.getElementById('mini-modal-cancel');
    const closeBtn = document.getElementById('mini-modal-close');

    titleEl.textContent = title;
    labelEl.textContent = label;
    input.value = currentValue || '';
    input.placeholder = placeholder || '';
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');

    // Focus input after animation
    setTimeout(() => input.focus(), 100);

    function cleanup() {
        overlay.classList.add('hidden');
        document.body.classList.remove('modal-open');
        saveBtn.removeEventListener('click', onSave);
        cancelBtn.removeEventListener('click', onCancel);
        closeBtn.removeEventListener('click', onCancel);
        input.removeEventListener('keydown', onKeydown);
        overlay.removeEventListener('click', onOverlayClick);
    }

    function onSave() {
        const val = input.value;
        cleanup();
        callback(val);
    }

    function onCancel() {
        cleanup();
    }

    function onKeydown(e) {
        if (e.key === 'Enter') { e.preventDefault(); onSave(); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }

    function onOverlayClick(e) {
        if (e.target === overlay) onCancel();
    }

    saveBtn.addEventListener('click', onSave);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    input.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', onOverlayClick);
}

// ──── NOTE & AMOUNT EDITING (inline) ────
window.openInlineNote = function (cardId, el) {
    const card = STATE.cards.find(c => c.id === cardId);
    if (!card) return;
    if (el.querySelector('input')) return;

    const originalHTML = el.innerHTML;

    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = card.notes || '';
    input.placeholder = 'Add note...';

    // Replace content
    el.innerHTML = '';
    el.appendChild(input);
    input.focus();

    let saved = false;
    const saveNote = () => {
        if (saved) return;
        saved = true;
        card.notes = input.value.trim();
        save();
        // Targeted DOM restore without re-render
        el.innerHTML = card.notes || '<span class="note-placeholder">+ note</span>';
    };

    const cancelNote = () => {
        if (saved) return;
        saved = true;
        el.innerHTML = originalHTML;
    };

    input.addEventListener('blur', saveNote);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveNote(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelNote(); input.blur(); }
    });
};

window.openDocNote = function (docId, el) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    if (el.querySelector('input')) return;

    const originalHTML = el.innerHTML;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = doc.notes || '';
    input.placeholder = 'Add note...';

    el.innerHTML = '';
    el.appendChild(input);
    input.focus();

    let saved = false;
    const saveNote = () => {
        if (saved) return;
        saved = true;
        doc.notes = input.value.trim();
        save();
        el.innerHTML = doc.notes || '<span class="note-placeholder">+ note</span>';
    };

    const cancelNote = () => {
        if (saved) return;
        saved = true;
        el.innerHTML = originalHTML;
    };

    input.addEventListener('blur', saveNote);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveNote(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelNote(); input.blur(); }
    });
};

window.openInlineAmount = function (cardId, el) {
    const card = STATE.cards.find(c => c.id === cardId);
    if (!card) return;
    if (el.querySelector('input')) return;

    const originalHTML = el.innerHTML;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = card.amount || '';
    input.placeholder = 'Amount';

    el.innerHTML = '';
    el.appendChild(input);
    input.focus();
    input.select();

    let saved = false;
    const saveAmount = () => {
        if (saved) return;
        saved = true;
        const val = input.value.trim();
        card.amount = val ? val : null;
        save();
        el.innerHTML = card.amount ? Number(card.amount).toLocaleString() : '-';
    };

    const cancelAmount = () => {
        if (saved) return;
        saved = true;
        el.innerHTML = originalHTML;
    };

    input.addEventListener('blur', saveAmount);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveAmount(); input.blur(); }
        else if (e.key === 'Escape') { e.preventDefault(); cancelAmount(); input.blur(); }
    });
};


// ──── TARGETED UI UPDATES (no re-render) ────
function updateStatsInPlace() {
    const bar = document.getElementById('stats-bar');
    if (!bar) return;

    if (STATE.currentView === 'docs') {
        const docs = getFilteredDocs();
        const s = getDocStats(docs);
        const statCards = bar.querySelectorAll('.stat-card');
        if (statCards.length >= 4) {
            statCards[0].querySelector('.stat-value').textContent = s.total;
            statCards[1].querySelector('.stat-value').textContent = s.verified;
            statCards[2].querySelector('.stat-value').textContent = s.failed;
            statCards[3].querySelector('.stat-value').textContent = s.waiting;
        }
    } else if (STATE.currentView === 'my-card') {
        const s = getMyCardStats();
        const statCards = bar.querySelectorAll('.stat-card');
        if (statCards.length >= 6) {
            statCards[0].querySelector('.stat-value').textContent = s.totalCards;
            statCards[1].querySelector('.stat-value').textContent = s.cardAdd;
            statCards[2].querySelector('.stat-value').textContent = s.runAds;
            statCards[3].querySelector('.stat-value').textContent = s.verify;
            statCards[4].querySelector('.stat-value').textContent = s.topCards;
            statCards[5].querySelector('.stat-value').textContent = s.topBins;
        }
    } else if (['cards', 'favorites', 'active-now', 'trash'].includes(STATE.currentView)) {
        const cards = getFilteredCards();
        const s = getCardStats(cards);
        const statCards = bar.querySelectorAll('.stat-card');
        if (statCards.length >= 6) {
            statCards[0].querySelector('.stat-value').textContent = s.total;
            statCards[1].querySelector('.stat-value').textContent = s.verified;
            statCards[2].querySelector('.stat-value').textContent = s.suspended;
            statCards[3].querySelector('.stat-value').textContent = s.cardAdd;
            statCards[4].querySelector('.stat-value').textContent = s.runAds;
            statCards[5].querySelector('.stat-value').textContent = s.active;
        }
    }
}

function updateSidebarBadges() {
    const allCardsBadge = document.getElementById('badge-all-cards');
    const favBadge = document.getElementById('badge-favorites');
    const activeBadge = document.getElementById('badge-active');
    const trashBadge = document.getElementById('badge-trash');
    if (allCardsBadge) allCardsBadge.textContent = STATE.cards.length;
    if (favBadge) favBadge.textContent = STATE.cards.filter(c => isFavorite(c)).length;
    if (activeBadge) activeBadge.textContent = STATE.cards.filter(c => isActiveNow(c)).length;
    if (trashBadge) trashBadge.textContent = STATE.trash.length;

    // Update country card counts
    document.querySelectorAll('.country-item').forEach(item => {
        const countryId = item.dataset.country;
        if (countryId) {
            const countryCards = STATE.cards.filter(c => c.country === countryId);
            const countryDocs = STATE.docs.filter(d => d.country === countryId);
            const countEl = item.querySelector('.country-count');
            if (countEl) countEl.textContent = countryCards.length + countryDocs.length;
        }
    });

    // Update nav badges for cards/docs under each country
    document.querySelectorAll('.country-sub .nav-item').forEach(navItem => {
        const badge = navItem.querySelector('.nav-badge');
        if (!badge) return;
        const onclick = navItem.getAttribute('onclick') || '';
        const match = onclick.match(/navigate\('(\w+)',\s*'([^']+)'\)/);
        if (match) {
            const [, view, countryId] = match;
            if (view === 'cards') {
                badge.textContent = STATE.cards.filter(c => c.country === countryId).length;
            } else if (view === 'docs') {
                badge.textContent = STATE.docs.filter(d => d.country === countryId).length;
            }
        }
    });
}

// ──── DOC V/S COUNTERS ────
function updateDocStatsBar() {
    updateStatsInPlace();
}

window.incrementDocV = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.verified = (doc.verified || 0) + 1;
    save();
    const el = document.querySelector(`.vs-counter[data-doc-id="${docId}"][data-vs="v"]`);
    if (el) el.textContent = doc.verified;
    updateDocStatsBar();
};

window.incrementDocS = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.suspended = (doc.suspended || 0) + 1;
    save();
    const el = document.querySelector(`.vs-counter[data-doc-id="${docId}"][data-vs="s"]`);
    if (el) el.textContent = doc.suspended;
    updateDocStatsBar();
};

window.decrementDocV = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.verified = Math.max(0, (doc.verified || 0) - 1);
    save();
    const el = document.querySelector(`.vs-counter[data-doc-id="${docId}"][data-vs="v"]`);
    if (el) el.textContent = doc.verified;
    updateDocStatsBar();
};

window.decrementDocS = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.suspended = Math.max(0, (doc.suspended || 0) - 1);
    save();
    const el = document.querySelector(`.vs-counter[data-doc-id="${docId}"][data-vs="s"]`);
    if (el) el.textContent = doc.suspended;
    updateDocStatsBar();
};

// ──── DOC PREVIEW LIGHTBOX ────
window._docShowPreview = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc || !doc.preview) return;
    const overlay = document.createElement('div');
    overlay.className = 'doc-lightbox';
    overlay.innerHTML = `<img src="${doc.preview}" class="doc-lightbox-img"><button class="doc-lightbox-close">✕</button>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.classList.contains('doc-lightbox-close')) overlay.remove(); });
    document.body.appendChild(overlay);
};

// ──── DOC CLEAR NEW STATUS ────
window._docClearNew = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.docStatus = '';
    save();
    const badge = document.querySelector(`.doc-status-new[onclick*="${docId}"]`);
    if (badge) badge.remove();
};

// ──── DOC TYPE CYCLE ────
window.cycleDocType = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    const types = ['-', 'PP', 'DL'];
    const current = doc.type || '-';
    const idx = types.indexOf(current);
    doc.type = types[(idx + 1) % types.length];
    save();
    // DOM-only update — no full re-render
    const el = document.querySelector(`.clickable-type[onclick*="'${docId}'"]`);
    if (el) {
        el.textContent = doc.type && doc.type !== '-' ? doc.type : '-';
        el.className = `doc-type-badge clickable-type ${(doc.type || '').toLowerCase()}`;
    }
};

// ──── DOC MODAL ────
let _docParseTimer = null;

function openDocModal() {
    const overlay = document.getElementById('add-doc-overlay');
    overlay.classList.remove('hidden');

    // Populate country dropdown
    const countrySelect = document.getElementById('doc-list-country');
    countrySelect.innerHTML = STATE.countries.map(c =>
        `<option value="${c.id}" ${c.id === STATE.currentCountry ? 'selected' : ''}>${c.flag} ${c.name}</option>`
    ).join('');

    // Reset fields
    document.getElementById('doc-list-type').value = 'PP';
    document.getElementById('doc-list-notes').value = '';
    document.getElementById('doc-list-textarea').value = '';
    document.getElementById('doc-list-parsed-count').textContent = '0 documents detected';
    document.getElementById('doc-list-parsed-count').classList.remove('has-cards');
    document.getElementById('doc-list-preview').innerHTML = '';
    document.getElementById('doc-save-btn-text').textContent = 'Add Documents';
    const imgInput = document.getElementById('doc-list-preview-img');
    if (imgInput) imgInput.value = '';

    setTimeout(() => document.getElementById('doc-list-textarea').focus(), 100);
}

function closeDocModal() {
    document.getElementById('add-doc-overlay').classList.add('hidden');
}

// Doc modal close btn
document.getElementById('doc-modal-close').addEventListener('click', closeDocModal);
document.getElementById('doc-modal-cancel').addEventListener('click', closeDocModal);
document.getElementById('add-doc-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'add-doc-overlay') closeDocModal();
});

// Doc list textarea — live parsing with debounce
document.getElementById('doc-list-textarea').addEventListener('input', function () {
    clearTimeout(_docParseTimer);
    _docParseTimer = setTimeout(() => {
        const lines = this.value.split('\n').filter(l => l.trim());
        const count = lines.length;
        const countEl = document.getElementById('doc-list-parsed-count');
        countEl.textContent = `${count} document${count !== 1 ? 's' : ''} detected`;
        countEl.classList.toggle('has-cards', count > 0);
        document.getElementById('doc-save-btn-text').textContent = count > 0 ? `Add ${count} Documents` : 'Add Documents';

        // Preview first 5
        const previewEl = document.getElementById('doc-list-preview');
        if (count === 0) { previewEl.innerHTML = ''; return; }
        const preview = lines.slice(0, 5).map(l => {
            const name = l.trim().toUpperCase();
            return `<div class="list-preview-row">${name}</div>`;
        }).join('');
        const more = count > 5 ? `<div class="list-preview-more">...and ${count - 5} more</div>` : '';
        previewEl.innerHTML = preview + more;
    }, 300);
});

// Doc modal save — bulk import
document.getElementById('doc-modal-save').addEventListener('click', () => {
    const textarea = document.getElementById('doc-list-textarea');
    const lines = textarea.value.split('\n').filter(l => l.trim());

    if (lines.length === 0) {
        toast('Paste at least one name', 'error');
        return;
    }

    const country = document.getElementById('doc-list-country').value;
    const docType = document.getElementById('doc-list-type').value;
    const sharedNotes = document.getElementById('doc-list-notes').value.trim();

    // Read preview image if provided
    const imgInput = document.getElementById('doc-list-preview-img');
    const imgFile = imgInput && imgInput.files && imgInput.files[0];

    function _doAddDocs(previewBase64) {
        const dateStr = todayStr();
        let added = 0;

        lines.forEach(line => {
            const fullName = line.trim().toUpperCase();
            if (!fullName) return;

            // Check for duplicate by fullName + country
            if (STATE.docs.find(d => d.fullName === fullName && d.country === country)) return;

            const parts = fullName.split(/\s+/);
            const name = parts[0] || '';
            const surname = parts.slice(1).join(' ') || '';

            STATE.docs.push({
                id: genId(),
                fullName,
                name,
                surname,
                type: docType,
                notes: sharedNotes,
                verified: 0,
                suspended: 0,
                docStatus: 'new',
                preview: previewBase64 || '',
                use: 1,
                country,
                date: dateStr,
            });
            added++;
        });

        if (added > 0) {
            save();
            renderAll();
            closeDocModal();
            toast(`${added} documents added (NEW)`, 'success');
        } else {
            toast('All names already exist (duplicates)', 'info');
        }
    }

    if (imgFile) {
        const reader = new FileReader();
        reader.onload = (e) => _doAddDocs(e.target.result);
        reader.readAsDataURL(imgFile);
    } else {
        _doAddDocs('');
    }
});

// ──── SIDEBAR TOGGLE (Mobile) ────
document.getElementById('toggle-sidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ──── ADD CARD MODAL ────
const modalOverlay = document.getElementById('modal-overlay');
const editOverlay = document.getElementById('edit-modal-overlay');

document.getElementById('add-card-btn').addEventListener('click', () => {
    if (STATE.currentView === 'docs') {
        openDocModal();
    } else {
        openAddModal();
    }
});

// Mail Checkboxes Mutually Exclusive Logic
document.getElementById('form-mail-none').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('form-mail-verify').checked = false;
        document.getElementById('form-mail-submit').checked = false;
    }
});
const uncheckMailNone = () => {
    document.getElementById('form-mail-none').checked = false;
};
document.getElementById('form-mail-verify').addEventListener('change', uncheckMailNone);
document.getElementById('form-mail-submit').addEventListener('change', uncheckMailNone);

function openAddModal() {
    resetForm();
    populateCountrySelects();
    modalOverlay.classList.remove('hidden');
}

function resetForm() {
    document.getElementById('form-name').value = '';
    document.getElementById('form-surname').value = '';
    document.getElementById('form-card').value = '';
    document.getElementById('form-month').value = '';
    document.getElementById('form-year').value = '';
    document.getElementById('form-cvv').value = '';
    document.getElementById('form-amount').value = '';
    document.getElementById('form-notes').value = '';
    document.getElementById('form-status-add').checked = false;
    document.getElementById('form-status-ads').checked = false;
    document.getElementById('form-status-verify').checked = false;
    document.getElementById('form-mail-verify').checked = false;
    document.getElementById('form-mail-submit').checked = false;
    document.getElementById('form-mail-none').checked = false;
    document.getElementById('card-type-badge').textContent = '';
    // Clear BIN info form element if present
    const binFormEl = document.getElementById('card-type-badge')?.parentElement?.querySelector('.bin-info-form');
    if (binFormEl) binFormEl.remove();
    document.getElementById('list-textarea').value = '';
    document.getElementById('list-parsed-count').textContent = '0 cards detected';
    // Reset to form tab (scoped to card modal only)
    const cardModal = document.getElementById('add-card-modal');
    cardModal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    cardModal.querySelector('.modal-tab[data-tab="form"]').classList.add('active');
    document.getElementById('form-tab').classList.add('active');
    document.getElementById('list-tab').classList.remove('active');
    document.getElementById('save-btn-text').textContent = 'Add Card';
}

function populateCountrySelects() {
    const formSel = document.getElementById('form-country');
    const listSel = document.getElementById('list-country');
    const opts = STATE.countries.map(c => `<option value="${c.id}" ${c.id === STATE.currentCountry ? 'selected' : ''}>${c.flag} ${c.name}</option>`).join('');
    formSel.innerHTML = opts;
    listSel.innerHTML = opts;

    // Populate doc select — static document types only
    const docSel = document.getElementById('form-doc');
    docSel.innerHTML = '<option value="">Select...</option><option value="PP">PP (Passport)</option><option value="DL">DL (Driver License)</option>';
}

// Modal tabs (scoped to card modal only)
const cardModalEl = document.getElementById('add-card-modal');
cardModalEl.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        cardModalEl.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        cardModalEl.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-tab').classList.add('active');

        const isForm = tab.dataset.tab === 'form';
        document.getElementById('save-btn-text').textContent = isForm ? 'Add Card' : 'Add Cards';
    });
});

// Card number formatting + BIN lookup
document.getElementById('form-card').addEventListener('input', function () {
    this.value = formatCardInput(this.value);
    const type = getCardType(this.value);
    document.getElementById('card-type-badge').textContent = type;
    // BIN lookup when 6+ digits typed
    const digits = this.value.replace(/\s/g, '');
    if (digits.length >= 6) {
        const bin = digits.slice(0, 6);
        const cached = getBinInfo(bin);
        if (cached) {
            showFormBinInfo(cached, 'card-type-badge');
        } else {
            lookupBin(bin).then(info => {
                if (info) showFormBinInfo(info, 'card-type-badge');
            });
        }
    }
});

function showFormBinInfo(info, badgeId) {
    const badge = document.getElementById(badgeId);
    if (!badge || !info || info.error) return;
    const parts = [];
    if (info.brand) parts.push(info.brand);
    if (info.type) parts.push(info.type);
    badge.textContent = parts.join(' • ');
    // Show bank name below
    let bankEl = badge.parentElement.querySelector('.bin-info-form');
    if (!bankEl) {
        bankEl = document.createElement('span');
        bankEl.className = 'bin-info-form';
        badge.parentElement.appendChild(bankEl);
    }
    const bankParts = [];
    if (info.bank) bankParts.push(info.bank);
    if (info.country) bankParts.push(info.country);
    bankEl.textContent = bankParts.join(' • ');
}

document.getElementById('edit-card')?.addEventListener('input', function () {
    this.value = formatCardInput(this.value);
    const type = getCardType(this.value);
    document.getElementById('edit-card-type-badge').textContent = type;
    const digits = this.value.replace(/\s/g, '');
    if (digits.length >= 6) {
        const bin = digits.slice(0, 6);
        const cached = getBinInfo(bin);
        if (cached) {
            showFormBinInfo(cached, 'edit-card-type-badge');
        } else {
            lookupBin(bin).then(info => {
                if (info) showFormBinInfo(info, 'edit-card-type-badge');
            });
        }
    }
});

// ──── SMART LIST PARSER ────
let _listParseTimer = null;
let _listParsedCards = [];

function smartParseCards(text) {
    const lines = text.split('\n');
    const cards = [];
    const seen = new Set();
    const noiseWords = new Set(['cvv', 'exp', 'cc', 'card', 'visa', 'mastercard', 'amex', 'discover', 'jcb', 'bin', 'the', 'and', 'or', 'of']);

    for (const rawLine of lines) {
        let line = rawLine.trim();
        if (!line) continue;

        // Normalize pipe/semicolon separators to spaces
        const normalized = line.replace(/[|;]/g, ' ');

        // ── Step 1: Extract card number ──
        let cardMatch = normalized.match(/\b(\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{3,4})\b/);
        if (!cardMatch) {
            cardMatch = normalized.match(/\b(\d{13,19})\b/);
        }
        if (!cardMatch) continue;

        const cardNum = cardMatch[1].replace(/[\s\-]/g, '');
        if (cardNum.length < 13 || cardNum.length > 19) continue;
        if (seen.has(cardNum)) continue;
        seen.add(cardNum);

        // Everything after card number
        let rest = normalized.replace(cardMatch[0], ' ').trim();

        // ── Step 2: Extract expiry + CVV ──
        let mm = '', yy = '', cvv = '';

        // Try format: MM/YY CVV  (slash/dot/dash separated)
        const expSlash = rest.match(/\b(0[1-9]|1[0-2])\s*[\/\.\-]\s*(\d{2})\b/);
        if (expSlash) {
            mm = expSlash[1];
            yy = expSlash[2];
            rest = rest.replace(expSlash[0], ' ').trim();
            // Next 3-4 digit number = CVV
            const cvvM = rest.match(/\b(\d{3,4})\b/);
            if (cvvM) {
                cvv = cvvM[1];
                rest = rest.replace(cvvM[0], ' ').trim();
            }
        } else {
            // Try format: MM YY CVV  (space-separated, sequential)
            const seqMatch = rest.match(/\b(0[1-9]|1[0-2])\s+(\d{2})\s+(\d{3,4})\b/);
            if (seqMatch) {
                mm = seqMatch[1];
                yy = seqMatch[2];
                cvv = seqMatch[3];
                rest = rest.replace(seqMatch[0], ' ').trim();
            } else {
                // Fallback: grab any 3-4 digit as CVV
                const nums = rest.match(/\b(\d{3,4})\b/g);
                if (nums) {
                    for (const n of nums) {
                        if (n !== cardNum.slice(-4)) {
                            cvv = n;
                            rest = rest.replace(new RegExp('\\b' + n + '\\b'), ' ');
                            break;
                        }
                    }
                }
            }
        }

        // ── Step 3: Extract names from remaining text ──
        let name = '', surname = '';
        const nameText = rest.replace(/\d+/g, ' ').replace(/[^a-zA-Zа-яА-ЯёЁ\s]/g, ' ').trim();
        const nameWords = nameText.split(/\s+/).filter(w => w.length >= 2 && !noiseWords.has(w.toLowerCase()));
        if (nameWords.length >= 1) {
            name = nameWords[0].charAt(0).toUpperCase() + nameWords[0].slice(1).toLowerCase();
        }
        if (nameWords.length >= 2) {
            surname = nameWords.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }

        cards.push({ cardNum, mm, yy, cvv, name, surname });
    }

    return cards;
}

function renderListPreview(cards) {
    const el = document.getElementById('list-preview');
    if (!el) return;
    if (cards.length === 0) {
        el.innerHTML = '';
        return;
    }

    const withName = cards.filter(c => c.name).length;

    const preview = cards.slice(0, 8).map(c => {
        const masked = c.cardNum.replace(/(\d{4})(\d+)(\d{4})/, '$1 •••• $3');
        const exp = c.mm && c.yy ? `${c.mm}/${c.yy}` : '——';
        const cvv = c.cvv || '———';
        const holder = c.name ? `<span class="list-holder">${c.name} ${c.surname || ''}</span>` : '';
        return `<div class="list-preview-row">${masked} <span class="list-sep">|</span> ${exp} <span class="list-sep">|</span> ${cvv} ${holder}</div>`;
    }).join('');

    const more = cards.length > 8 ? `<div class="list-preview-more">...and ${cards.length - 8} more</div>` : '';
    const stats = `<div class="list-stats-badge">✔️ ${cards.length} cards · ${withName} docs · ${withName} links</div>`;
    el.innerHTML = stats + preview + more;
}

document.getElementById('list-textarea').addEventListener('input', function () {
    clearTimeout(_listParseTimer);
    _listParseTimer = setTimeout(() => {
        _listParsedCards = smartParseCards(this.value);
        const count = _listParsedCards.length;
        const countEl = document.getElementById('list-parsed-count');
        countEl.textContent = `${count} card${count !== 1 ? 's' : ''} detected`;
        countEl.classList.toggle('has-cards', count > 0);
        document.getElementById('save-btn-text').textContent = count > 0 ? `Add ${count} Cards` : 'Add Cards';
        renderListPreview(_listParsedCards);
    }, 300);
});

// Save modal
document.getElementById('modal-save').addEventListener('click', () => {
    const isForm = document.querySelector('.modal-tab[data-tab="form"]').classList.contains('active');

    if (isForm) {
        const name = document.getElementById('form-name').value.trim();
        const surname = document.getElementById('form-surname').value.trim();
        const cardNum = document.getElementById('form-card').value.replace(/\s/g, '');
        const month = document.getElementById('form-month').value.trim();
        const year = document.getElementById('form-year').value.trim();
        const cvv = document.getElementById('form-cvv').value.trim();

        if (!name || !surname || cardNum.length < 13 || !month || !year || !cvv) {
            toast('Please fill all required fields', 'error');
            return;
        }

        const card = {
            id: genId(),
            name, surname,
            cardNumber: cardNum,
            month, year, cvv,
            cardType: getCardType(cardNum),
            docType: null,
            amount: document.getElementById('form-amount').value || 0,
            notes: document.getElementById('form-notes').value,
            country: document.getElementById('form-country').value,
            cardAdd: document.getElementById('form-status-add').checked,
            runAds: document.getElementById('form-status-ads').checked,
            verified: document.getElementById('form-status-verify').checked,
            mailVerify: document.getElementById('form-mail-verify').checked,
            mailSubmit: document.getElementById('form-mail-submit').checked,
            mailNone: document.getElementById('form-mail-none').checked,
            suspended: false,
            starred: false,
            date: todayStr(),
        };

        STATE.cards.unshift(card);
        ensureDoc(card);
        save();
        modalOverlay.classList.add('hidden');
        STATE.sortField = null;
        STATE.sortDir = 'desc';
        STATE.page = 1;
        renderAll();
        // Highlight new row
        const newRow = document.querySelector(`tr[data-id="${card.id}"]`);
        if (newRow) newRow.classList.add('row-new');
        toast('Card added successfully', 'success');
    } else {
        // Smart list mode
        if (_listParsedCards.length === 0) {
            toast('No valid cards found in text', 'error');
            return;
        }
        const country = document.getElementById('list-country').value;
        const statusAdd = document.getElementById('list-status-add').checked;
        const statusAds = document.getElementById('list-status-ads').checked;
        const statusVerify = document.getElementById('list-status-verify').checked;

        let added = 0;
        const existingNumbers = new Set(STATE.cards.map(c => c.cardNumber.replace(/\s/g, '')));

        _listParsedCards.forEach(p => {
            if (existingNumbers.has(p.cardNum)) return; // skip duplicates

            const card = {
                id: genId(),
                name: p.name || '', surname: p.surname || '',
                cardNumber: p.cardNum,
                month: p.mm, year: p.yy, cvv: p.cvv,
                cardType: getCardType(p.cardNum),
                amount: 0, notes: '', country,
                cardAdd: statusAdd,
                runAds: statusAds,
                verified: statusVerify,
                suspended: false, starred: false,
                date: todayStr(),
            };
            STATE.cards.unshift(card);
            ensureDoc(card);
            existingNumbers.add(p.cardNum);
            added++;
        });

        if (added > 0) {
            save();
            modalOverlay.classList.add('hidden');
            STATE.sortField = null;
            STATE.sortDir = 'desc';
            STATE.page = 1;
            renderAll();
            // Highlight new rows
            document.querySelectorAll('.data-table tbody tr').forEach((tr, i) => {
                if (i < added) tr.classList.add('row-new');
            });
            toast(`${added} cards added`, 'success');
        } else {
            toast('All cards already exist (duplicates)', 'info');
        }

        // Reset
        _listParsedCards = [];
        document.getElementById('list-textarea').value = '';
        document.getElementById('list-parsed-count').textContent = '0 cards detected';
        document.getElementById('list-preview').innerHTML = '';
    }
});

// Close modals
document.getElementById('modal-close').addEventListener('click', () => modalOverlay.classList.add('hidden'));
document.getElementById('modal-cancel').addEventListener('click', () => modalOverlay.classList.add('hidden'));
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.add('hidden'); });

// ──── EDIT MODAL ────

// Edit Form Mail Exclusivity
document.getElementById('edit-mail-none').addEventListener('change', (e) => {
    if (e.target.checked) {
        document.getElementById('edit-mail-verify').checked = false;
        document.getElementById('edit-mail-submit').checked = false;
    }
});
const uncheckEditMailNone = () => {
    document.getElementById('edit-mail-none').checked = false;
};
document.getElementById('edit-mail-verify').addEventListener('change', uncheckEditMailNone);
document.getElementById('edit-mail-submit').addEventListener('change', uncheckEditMailNone);

function openEditModal(card) {
    document.getElementById('edit-id').value = card.id;
    document.getElementById('edit-name').value = card.name;
    document.getElementById('edit-surname').value = card.surname;
    document.getElementById('edit-card').value = formatCardInput(card.cardNumber);
    document.getElementById('edit-card-type-badge').textContent = getCardType(card.cardNumber);
    document.getElementById('edit-month').value = card.month;
    document.getElementById('edit-year').value = card.year;
    document.getElementById('edit-cvv').value = card.cvv;
    document.getElementById('edit-amount').value = card.amount;
    document.getElementById('edit-notes').value = card.notes || '';
    document.getElementById('edit-mail-verify').checked = card.mailVerify || false;
    document.getElementById('edit-mail-submit').checked = card.mailSubmit || false;
    document.getElementById('edit-mail-none').checked = card.mailNone || false;
    // Populate country dropdown
    const editCountrySel = document.getElementById('edit-country');
    editCountrySel.innerHTML = STATE.countries.map(c =>
        `<option value="${c.id}" ${c.id === card.country ? 'selected' : ''}>${c.flag} ${c.name}</option>`
    ).join('');
    // Clear old BIN info form element in edit modal
    const editBinEl = document.getElementById('edit-card-type-badge')?.parentElement?.querySelector('.bin-info-form');
    if (editBinEl) editBinEl.remove();
    // Show BIN info for existing card
    const digits = card.cardNumber.replace(/\s/g, '');
    if (digits.length >= 6) {
        const bin = digits.slice(0, 6);
        const cached = getBinInfo(bin);
        if (cached) {
            showFormBinInfo(cached, 'edit-card-type-badge');
        } else {
            lookupBin(bin).then(info => {
                if (info) showFormBinInfo(info, 'edit-card-type-badge');
            });
        }
    }
    editOverlay.classList.remove('hidden');
}

document.getElementById('edit-save').addEventListener('click', () => {
    const id = document.getElementById('edit-id').value;
    const card = STATE.cards.find(c => c.id === id);
    if (card) {
        const oldCountry = card.country;
        card.name = document.getElementById('edit-name').value.trim();
        card.surname = document.getElementById('edit-surname').value.trim();
        card.cardNumber = document.getElementById('edit-card').value.replace(/\s/g, '');
        card.cardType = getCardType(card.cardNumber);
        card.month = document.getElementById('edit-month').value;
        card.year = document.getElementById('edit-year').value;
        card.cvv = document.getElementById('edit-cvv').value;
        card.amount = document.getElementById('edit-amount').value;
        card.notes = document.getElementById('edit-notes').value;
        card.country = document.getElementById('edit-country').value;
        card.mailVerify = document.getElementById('edit-mail-verify').checked;
        card.mailSubmit = document.getElementById('edit-mail-submit').checked;
        card.mailNone = document.getElementById('edit-mail-none').checked;

        // If country changed, re-link doc in new country
        if (card.country !== oldCountry) {
            // Remove card from old doc's cardIds
            if (card.docId) {
                const oldDoc = STATE.docs.find(d => d.id === card.docId);
                if (oldDoc && oldDoc.cardIds) {
                    oldDoc.cardIds = oldDoc.cardIds.filter(cid => cid !== card.id);
                    oldDoc.use = Math.max(0, (oldDoc.use || 1) - 1);
                }
                card.docId = null;
            }
            // Re-link to doc in new country
            ensureDoc(card);
        }

        save();
        editOverlay.classList.add('hidden');
        renderAll();
        const moved = card.country !== oldCountry;
        toast(moved ? `Card moved to ${card.country} & updated` : 'Card updated', 'success');
    }
});

document.getElementById('edit-modal-close').addEventListener('click', () => editOverlay.classList.add('hidden'));
document.getElementById('edit-cancel').addEventListener('click', () => editOverlay.classList.add('hidden'));
editOverlay.addEventListener('click', (e) => { if (e.target === editOverlay) editOverlay.classList.add('hidden'); });

// ──── GLOBAL SEARCH ────
const globalSearchResults = document.getElementById('global-search-results');
let searchTimeout = null;

function performGlobalSearch(query) {
    if (!query || query.length < 2) {
        globalSearchResults.classList.add('hidden');
        // Still filter current view for backward compat
        STATE.search = query;
        STATE.page = 1;
        renderStats();
        renderContent();
        return;
    }

    const s = query.toLowerCase();
    STATE.search = query;
    STATE.page = 1;

    // Search ALL cards across all countries
    const matchedCards = STATE.cards.filter(c =>
        (c.name + ' ' + c.surname).toLowerCase().includes(s) ||
        c.cardNumber.replace(/\s/g, '').includes(s.replace(/\s/g, '')) ||
        getBin(c.cardNumber).includes(s) ||
        (c.notes || '').toLowerCase().includes(s)
    );

    // Search ALL docs across all countries
    const matchedDocs = STATE.docs.filter(d =>
        (d.fullName || '').toLowerCase().includes(s) ||
        (d.notes || '').toLowerCase().includes(s) ||
        (d.type || '').toLowerCase().includes(s)
    );

    // Search trash
    const matchedTrash = STATE.trash.filter(c =>
        (c.name + ' ' + c.surname).toLowerCase().includes(s) ||
        c.cardNumber.replace(/\s/g, '').includes(s.replace(/\s/g, '')) ||
        (c.notes || '').toLowerCase().includes(s)
    );

    if (matchedCards.length === 0 && matchedDocs.length === 0 && matchedTrash.length === 0) {
        globalSearchResults.innerHTML = '<div class="search-no-results">No results found for "' + query + '"</div>';
        globalSearchResults.classList.remove('hidden');
        renderStats();
        renderContent();
        return;
    }

    let html = '';

    // Group cards by country
    if (matchedCards.length > 0) {
        html += '<div class="search-group-title">💳 Cards (' + matchedCards.length + ')</div>';
        const shown = matchedCards.slice(0, 15);
        shown.forEach(c => {
            const country = STATE.countries.find(co => co.id === c.country);
            const flag = country?.flag || '🏳';
            const countryName = country?.name || c.country;
            html += `
                <button class="search-result-item" onclick="globalSearchNavigate('cards', '${c.country}', '${s}')">
                    <span class="search-result-flag">${flag}</span>
                    <div class="search-result-info">
                        <span class="search-result-name">${c.name} ${c.surname}</span>
                        <span class="search-result-detail">${maskCard(c.cardNumber)}${c.notes ? ' · ' + c.notes : ''}</span>
                    </div>
                    <span class="search-result-location cards">${countryName}</span>
                </button>
            `;
        });
        if (matchedCards.length > 15) {
            html += '<div class="search-no-results" style="padding:6px 14px;font-size:11px;">+ ' + (matchedCards.length - 15) + ' more cards</div>';
        }
    }

    // Docs
    if (matchedDocs.length > 0) {
        if (matchedCards.length > 0) html += '<div class="search-divider"></div>';
        html += '<div class="search-group-title">📄 Documents (' + matchedDocs.length + ')</div>';
        const shown = matchedDocs.slice(0, 10);
        shown.forEach(d => {
            const country = STATE.countries.find(co => co.id === d.country);
            const flag = country?.flag || '🏳';
            const countryName = country?.name || d.country;
            html += `
                <button class="search-result-item" onclick="globalSearchNavigate('docs', '${d.country}', '${s}')">
                    <span class="search-result-flag">${flag}</span>
                    <div class="search-result-info">
                        <span class="search-result-name">${d.fullName}</span>
                        <span class="search-result-detail">${d.type || '-'} · V:${d.verified || 0} S:${d.suspended || 0}${d.notes ? ' · ' + d.notes : ''}</span>
                    </div>
                    <span class="search-result-location docs">Docs · ${countryName}</span>
                </button>
            `;
        });
        if (matchedDocs.length > 10) {
            html += '<div class="search-no-results" style="padding:6px 14px;font-size:11px;">+ ' + (matchedDocs.length - 10) + ' more docs</div>';
        }
    }

    // Trash
    if (matchedTrash.length > 0) {
        if (matchedCards.length > 0 || matchedDocs.length > 0) html += '<div class="search-divider"></div>';
        html += '<div class="search-group-title">🗑️ Trash (' + matchedTrash.length + ')</div>';
        const shown = matchedTrash.slice(0, 5);
        shown.forEach(c => {
            const country = STATE.countries.find(co => co.id === c.country);
            const flag = country?.flag || '🏳';
            html += `
                <button class="search-result-item" onclick="globalSearchNavigate('trash', null, '${s}')">
                    <span class="search-result-flag">${flag}</span>
                    <div class="search-result-info">
                        <span class="search-result-name">${c.name} ${c.surname}</span>
                        <span class="search-result-detail">${maskCard(c.cardNumber)}</span>
                    </div>
                    <span class="search-result-location trash">Trash</span>
                </button>
            `;
        });
    }

    globalSearchResults.innerHTML = html;
    globalSearchResults.classList.remove('hidden');

    // Also render current view with search filter
    renderStats();
    renderContent();
}

window.globalSearchNavigate = function (view, country, searchTerm) {
    // Navigate to the correct view/country, clear search to show all
    STATE.currentView = view;
    if (country) STATE.currentCountry = country;
    STATE.page = 1;
    STATE.search = '';
    globalSearchResults.classList.add('hidden');
    document.getElementById('search-input').value = '';
    renderAll();

    // Scroll to matching record and highlight it
    setTimeout(() => {
        const term = (searchTerm || '').toLowerCase();
        if (!term) return;
        const rows = document.querySelectorAll('.table-row');
        for (const row of rows) {
            if (row.textContent.toLowerCase().includes(term)) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('search-highlight');
                setTimeout(() => row.classList.remove('search-highlight'), 2500);
                break;
            }
        }
    }, 150);
};

document.getElementById('search-input').addEventListener('input', function () {
    clearTimeout(searchTimeout);
    const query = this.value.trim();
    searchTimeout = setTimeout(() => performGlobalSearch(query), 150);
});

// Enter → navigate to first search result
document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const firstResult = globalSearchResults.querySelector('.search-result-item');
        if (firstResult) firstResult.click();
    }
});

// Close search results when clicking outside
document.addEventListener('click', function (e) {
    const searchBox = document.getElementById('global-search-box');
    if (!searchBox.contains(e.target)) {
        globalSearchResults.classList.add('hidden');
    }
});

// Re-show results on focus if there's a query
document.getElementById('search-input').addEventListener('focus', function () {
    if (this.value.trim().length >= 2) {
        performGlobalSearch(this.value.trim());
    }
});

// ──── PAGINATION ────
document.getElementById('prev-page').addEventListener('click', () => {
    if (STATE.page > 1) { STATE.page--; renderContent(); }
});
document.getElementById('next-page').addEventListener('click', () => {
    const cards = getFilteredCards();
    const totalPages = Math.ceil(cards.length / STATE.perPage);
    if (STATE.page < totalPages) { STATE.page++; renderContent(); }
});

// ──── NOTES ────
window.saveNotes = function () {
    STATE.notes = document.getElementById('notes-textarea')?.value || '';
    save();
    toast('Notes saved', 'success');
};

window.exportNotes = function () {
    const blob = new Blob([STATE.notes], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'card-tracker-notes.txt';
    a.click();
    toast('Notes exported', 'success');
};

window.importNotes = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                STATE.notes = ev.target.result;
                save();
                renderContent();
                toast('Notes imported', 'success');
            };
            reader.readAsText(file);
        }
    };
    input.click();
};

// ──── IMPORT / EXPORT ────
// Pending backup data for the import modal
let pendingBackup = null;
const backupOverlay = document.getElementById('backup-import-overlay');

function mapGeoToCountry(geo) {
    if (!geo) return 'canada';
    const g = geo.toUpperCase().trim();
    if (g === 'USA' || g === 'UNITED STATES' || g === 'US') return 'usa';
    return 'canada';
}

function formatDateFromISO(iso) {
    if (!iso) return todayStr();
    // Already in DD.MM.YY format — preserve as-is
    if (/^\d{2}\.\d{2}\.\d{2}$/.test(iso)) return iso;
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return todayStr();
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
    } catch { return todayStr(); }
}

function convertOldCard(c) {
    return {
        id: c.id || genId(),
        name: (c.name || '').trim(),
        surname: (c.surname || '').trim(),
        cardNumber: (c.card_number || c.cardNumber || '').replace(/\s/g, ''),
        month: c.card_exp_month || c.month || '',
        year: c.card_exp_year || c.year || '',
        cvv: c.card_cvv || c.cvv || '',
        cardType: getCardType((c.card_number || c.cardNumber || '').replace(/\s/g, '')),
        docType: c.doc_type || c.docType || null,
        amount: c.amount || 0,
        notes: c.comment || c.notes || '',
        country: mapGeoToCountry(c.geo || c.country),
        cardAdd: !!(c.card_add ?? c.cardAdd),
        runAds: !!(c.run_ads ?? c.runAds),
        verified: !!(c.verify_card ?? c.verified),
        suspended: false,
        starred: !!(c.is_active ?? c.starred),
        date: formatDateFromISO(c.created_at || c.date),
        verifStatus: c.verif_status || 'waiting',
    };
}

function convertOldDoc(d) {
    return {
        id: d.id || genId(),
        fullName: `${(d.name || '').trim()} ${(d.surname || '').trim()}`.trim().toUpperCase(),
        name: (d.name || '').trim(),
        surname: (d.surname || '').trim(),
        country: mapGeoToCountry(d.geo || d.country),
        type: d.doc_type || d.type || '-',
        use: d.use_count || d.use || 1,
        verified: 0,
        suspended: 0,
        status: d.status || 'waiting',
        date: formatDateFromISO(d.created_at || d.date),
        notes: d.comment || d.notes || '',
    };
}

// ─── FULL BACKUP EXPORT ───
function exportFullBackup() {
    const backup = {
        version: '2.0',
        exported_at: new Date().toISOString(),
        cards: STATE.cards,
        docs: STATE.docs,
        trash: STATE.trash || [],
        trashCards: STATE.trashCards || [],
        notes: STATE.notes || '',
        notesTabs: STATE.notesTabs || [],
        notesActiveTab: STATE.notesActiveTab || '',
        notesFontSize: STATE.notesFontSize || 13,
        merchants: JSON.parse(localStorage.getItem('ct_merchants') || '[]'),
        merchantBins: JSON.parse(localStorage.getItem('ct_merchant_bins') || '[]'),
        countries: STATE.countries,
        density: STATE.density || 'default',
        perPage: STATE.perPage || 50
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `card-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Full backup exported', 'success');
}

function openBackupFileDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                pendingBackup = data;
                showBackupImportModal(data, file.name);
            } catch {
                toast('Invalid JSON file', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function showBackupImportModal(data, filename) {
    const isV2 = data.version === '2.0';
    // v2: separate cards/docs/trash arrays; v1: cards include deleted, mydocuments
    const cards = data.cards || [];
    const activeCards = isV2 ? cards : cards.filter(c => !(c.is_deleted ?? false));
    const docs = isV2 ? (data.docs || []) : (data.mydocuments || data.docs || []);
    const activeDocs = isV2 ? docs : docs.filter(d => !(d.is_deleted ?? false));
    const trashCount = isV2 ? (data.trash || []).length : cards.filter(c => c.is_deleted).length;
    const hasNotes = !!(data.notes && (data.notes.content || typeof data.notes === 'string'));
    const exportDate = data.exported_at || data.exportedAt || data.backupAt || '';
    const version = data.version || '—';

    let dateStr = '';
    if (exportDate) {
        try {
            const d = new Date(exportDate);
            dateStr = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-US');
        } catch { dateStr = exportDate; }
    }

    document.getElementById('backup-meta').innerHTML = `Exported: ${dateStr || 'Unknown'}  | Version: ${version}`;
    document.getElementById('backup-stats').innerHTML = `
        <div class="backup-stat-card cards"><div class="stat-num">${activeCards.length}</div><div class="stat-name">CARDS</div></div>
        <div class="backup-stat-card docs"><div class="stat-num">${activeDocs.length}</div><div class="stat-name">DOCUMENTS</div></div>
        <div class="backup-stat-card mycards"><div class="stat-num">${trashCount}</div><div class="stat-name">TRASH</div></div>
        <div class="backup-stat-card notes"><div class="stat-num">${hasNotes ? 1 : 0}</div><div class="stat-name">NOTES</div></div>
    `;
    backupOverlay.classList.remove('hidden');
}

// Pre-scanned import data for step-2 resolution
let _importScan = null;

function executeBackupImport(mode) {
    if (!pendingBackup) return;
    const data = pendingBackup;

    if (mode === 'replace') {
        // REPLACE ALL — clear everything, import all
        STATE.cards = [];
        STATE.docs = [];
        STATE.trash = [];
        STATE.notes = '';
        STATE.notesTabs = [];
        importAllRecords(data);
        migrateNotesToTabs();
        finishImport();
        return;
    }

    // MERGE mode — pre-scan for duplicates
    const scan = preScanImport(data);
    _importScan = scan;

    if (scan.dupCards.length === 0 && scan.dupDocs.length === 0) {
        // No duplicates — import directly
        importNewOnly(scan);
        finishImport();
        return;
    }

    // Show step-2 duplicate resolution
    document.getElementById('backup-step1').classList.add('hidden');
    document.getElementById('backup-step2').classList.remove('hidden');

    const totalDups = scan.dupCards.length + scan.dupDocs.length;
    document.getElementById('dup-summary').innerHTML = `
        <div class="dup-icon">⚠️</div>
        <div class="dup-text">
            <strong>${totalDups} duplicate${totalDups !== 1 ? 's' : ''} found</strong>
            <span class="dup-detail">
                ${scan.dupCards.length ? scan.dupCards.length + ' card' + (scan.dupCards.length !== 1 ? 's' : '') : ''}
                ${scan.dupCards.length && scan.dupDocs.length ? ' + ' : ''}
                ${scan.dupDocs.length ? scan.dupDocs.length + ' doc' + (scan.dupDocs.length !== 1 ? 's' : '') : ''}
                already exist • ${scan.newCards.length + scan.newDocs.length} new records will be added
            </span>
        </div>
    `;
}

function preScanImport(data) {
    const isV2 = data.version === '2.0';
    const rawCards = data.cards || [];
    const rawDocs = isV2 ? (data.docs || []) : (data.mydocuments || data.docs || []);

    const newCards = [];
    const dupCards = []; // { incoming, existing }
    const newDocs = [];
    const dupDocs = [];

    rawCards.forEach(c => {
        const isDeleted = !isV2 && (c.is_deleted === 1 || c.is_deleted === true);
        if (isDeleted) return;
        const converted = isV2 ? { ...c, id: c.id || genId() } : convertOldCard(c);
        const existing = STATE.cards.find(e => e.cardNumber === converted.cardNumber);
        if (existing) {
            dupCards.push({ incoming: converted, existing });
        } else {
            newCards.push(converted);
        }
    });

    rawDocs.forEach(d => {
        const isDeleted = !isV2 && (d.is_deleted === 1 || d.is_deleted === true);
        if (isDeleted) return;
        const converted = isV2 ? { ...d, id: d.id || genId() } : convertOldDoc(d);
        const existing = STATE.docs.find(e => e.fullName === converted.fullName && e.country === converted.country);
        if (existing) {
            dupDocs.push({ incoming: converted, existing });
        } else {
            newDocs.push(converted);
        }
    });

    return { data, isV2, newCards, dupCards, newDocs, dupDocs };
}

function importNewOnly(scan) {
    scan.newCards.forEach(c => { c.id = genId(); STATE.cards.push(c); });
    scan.newDocs.forEach(d => { d.id = genId(); STATE.docs.push(d); });
    importExtras(scan.data);
    const msg = `Added: ${scan.newCards.length} cards, ${scan.newDocs.length} docs` +
        (scan.dupCards.length + scan.dupDocs.length > 0 ? ` (${scan.dupCards.length + scan.dupDocs.length} duplicates skipped)` : '');
    toast(msg, 'success');
}

function importWithReplace(scan) {
    // Add new records
    scan.newCards.forEach(c => { c.id = genId(); STATE.cards.push(c); });
    scan.newDocs.forEach(d => { d.id = genId(); STATE.docs.push(d); });

    // Replace existing with imported data
    let replaced = 0;
    scan.dupCards.forEach(({ incoming, existing }) => {
        Object.assign(existing, incoming, { id: existing.id });
        replaced++;
    });
    scan.dupDocs.forEach(({ incoming, existing }) => {
        Object.assign(existing, incoming, { id: existing.id });
        replaced++;
    });

    importExtras(scan.data);
    toast(`Added: ${scan.newCards.length + scan.newDocs.length} new, replaced: ${replaced} existing`, 'success');
}

function importWithDuplicates(scan) {
    // Add new records
    scan.newCards.forEach(c => { c.id = genId(); STATE.cards.push(c); });
    scan.newDocs.forEach(d => { d.id = genId(); STATE.docs.push(d); });

    // Also add duplicates as new records with new IDs
    let dupAdded = 0;
    scan.dupCards.forEach(({ incoming }) => {
        incoming.id = genId();
        incoming.isDuplicate = true;
        STATE.cards.push(incoming);
        dupAdded++;
    });
    scan.dupDocs.forEach(({ incoming }) => {
        incoming.id = genId();
        incoming.isDuplicate = true;
        STATE.docs.push(incoming);
        dupAdded++;
    });

    importExtras(scan.data);
    toast(`Added: ${scan.newCards.length + scan.newDocs.length} new + ${dupAdded} duplicates`, 'success');
}

function importAllRecords(data) {
    const isV2 = data.version === '2.0';
    const rawCards = data.cards || [];
    rawCards.forEach(c => {
        const isDeleted = !isV2 && (c.is_deleted === 1 || c.is_deleted === true);
        const converted = isV2 ? { ...c, id: c.id || genId() } : convertOldCard(c);
        if (isDeleted) {
            STATE.trash.push(converted);
        } else {
            STATE.cards.push(converted);
        }
    });

    if (isV2 && data.trash && Array.isArray(data.trash)) {
        data.trash.forEach(c => {
            STATE.trash.push({ ...c, id: c.id || genId() });
        });
    }

    const rawDocs = isV2 ? (data.docs || []) : (data.mydocuments || data.docs || []);
    rawDocs.forEach(d => {
        const isDeleted = !isV2 && (d.is_deleted === 1 || d.is_deleted === true);
        if (isDeleted) return;
        STATE.docs.push(isV2 ? { ...d, id: d.id || genId() } : convertOldDoc(d));
    });

    importExtras(data);
    toast(`Imported: ${STATE.cards.length} cards, ${STATE.docs.length} docs`, 'success');
}

function importExtras(data) {
    // Countries
    if (data.countries && Array.isArray(data.countries)) {
        data.countries.forEach(c => {
            if (!STATE.countries.find(e => e.id === c.id)) STATE.countries.push(c);
        });
    }
    // Notes — import notesTabs if available, otherwise convert legacy notes string
    if (data.notesTabs && Array.isArray(data.notesTabs) && data.notesTabs.length > 0) {
        data.notesTabs.forEach(tab => {
            const newTab = {
                ...tab,
                id: 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
            };
            STATE.notesTabs.push(newTab);
        });
        STATE.notesActiveTab = STATE.notesTabs[0]?.id || '';
        STATE.notes = STATE.notesTabs[0]?.content || '';
    } else if (data.notes) {
        const noteContent = typeof data.notes === 'string' ? data.notes : (data.notes.content || '');
        if (noteContent) {
            STATE.notes = STATE.notes ? STATE.notes + '\n\n--- Imported ---\n' + noteContent : noteContent;
            // Also add as a tab if notesTabs is empty
            if (STATE.notesTabs.length === 0) {
                const importedTab = {
                    id: 'tab-imported-' + Date.now(),
                    title: 'Imported',
                    content: noteContent,
                    created: Date.now(),
                    scrollPos: 0
                };
                STATE.notesTabs.push(importedTab);
                STATE.notesActiveTab = importedTab.id;
            } else {
                // Append to first tab
                const firstTab = STATE.notesTabs[0];
                firstTab.content = (firstTab.content || '') + '\n\n--- Imported ---\n' + noteContent;
            }
        }
    }
    // BIN cache
    if (data.binCache && typeof data.binCache === 'object') {
        Object.assign(BIN_CACHE, data.binCache);
    }
    // TrashCards
    if (data.trashCards && Array.isArray(data.trashCards)) {
        const existing = new Set((STATE.trashCards || []).map(n => n.replace(/\s/g, '')));
        data.trashCards.forEach(n => {
            if (!existing.has(n.replace(/\s/g, ''))) {
                STATE.trashCards.push(n);
                existing.add(n.replace(/\s/g, ''));
            }
        });
    }
    // Merchants
    if (data.merchants && Array.isArray(data.merchants)) {
        localStorage.setItem('ct_merchants', JSON.stringify(data.merchants));
    }
    if (data.merchantBins && Array.isArray(data.merchantBins)) {
        localStorage.setItem('ct_merchant_bins', JSON.stringify(data.merchantBins));
    }
}

function finishImport() {
    ensureDataIntegrity();
    save();
    backupOverlay.classList.add('hidden');
    pendingBackup = null;
    _importScan = null;
    // Reset step visibility
    document.getElementById('backup-step1').classList.remove('hidden');
    document.getElementById('backup-step2').classList.add('hidden');
    renderAll();
}

function closeBackupModal() {
    backupOverlay.classList.add('hidden');
    pendingBackup = null;
    _importScan = null;
    document.getElementById('backup-step1').classList.remove('hidden');
    document.getElementById('backup-step2').classList.add('hidden');
}

// Import button (sidebar)
document.getElementById('restore-backup-btn').addEventListener('click', openBackupFileDialog);

// Backup import modal buttons — Step 1
document.getElementById('backup-replace').addEventListener('click', () => executeBackupImport('replace'));
document.getElementById('backup-merge').addEventListener('click', () => executeBackupImport('merge'));

// Step 2 — duplicate resolution
document.getElementById('dup-skip').addEventListener('click', () => {
    if (!_importScan) return;
    importNewOnly(_importScan);
    finishImport();
});
document.getElementById('dup-replace').addEventListener('click', () => {
    if (!_importScan) return;
    importWithReplace(_importScan);
    finishImport();
});
document.getElementById('dup-add').addEventListener('click', () => {
    if (!_importScan) return;
    importWithDuplicates(_importScan);
    finishImport();
});

// Close handlers
document.getElementById('backup-import-close').addEventListener('click', closeBackupModal);
document.getElementById('backup-import-cancel').addEventListener('click', closeBackupModal);
backupOverlay.addEventListener('click', (e) => { if (e.target === backupOverlay) closeBackupModal(); });

document.getElementById('backup-btn').addEventListener('click', () => {
    const data = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        exported_at: new Date().toISOString(),
        totalCards: STATE.cards.length,
        totalDocs: STATE.docs.length,
        totalTrash: STATE.trash.length,
        cards: STATE.cards,
        docs: STATE.docs,
        trash: STATE.trash,
        trashCards: STATE.trashCards || [],
        notesTabs: STATE.notesTabs,
        notesActiveTab: STATE.notesActiveTab || '',
        notesFontSize: STATE.notesFontSize || 13,
        notes: { id: 'main', content: STATE.notesTabs[0]?.content || STATE.notes },
        countries: STATE.countries,
        merchants: JSON.parse(localStorage.getItem('ct_merchants') || '[]'),
        merchantBins: JSON.parse(localStorage.getItem('ct_merchant_bins') || '[]'),
        settings: STATE.settings || {},
        binCache: BIN_CACHE,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `card-tracker-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Full backup: ${STATE.cards.length} cards, ${STATE.docs.length} docs, ${(STATE.trashCards || []).length} trash`, 'success');
});




// ──── ADD COUNTRY (custom modal) ────
const addCountryOverlay = document.getElementById('add-country-overlay');
const countryCodeInput = document.getElementById('new-country-code');
const countryPreview = document.getElementById('country-preview');
const countryPreviewFlag = document.getElementById('country-preview-flag');
const countryPreviewName = document.getElementById('country-preview-name');

document.getElementById('add-country-btn').addEventListener('click', () => {
    countryCodeInput.value = '';
    countryPreview.classList.add('hidden');
    addCountryOverlay.classList.remove('hidden');
    setTimeout(() => countryCodeInput.focus(), 100);
});

function closeAddCountry() {
    addCountryOverlay.classList.add('hidden');
}

// Live preview when typing ISO code
countryCodeInput.addEventListener('input', () => {
    const code = countryCodeInput.value.trim().toUpperCase();
    if (code.length === 2 && COUNTRY_DB[code]) {
        countryPreviewFlag.textContent = isoToFlag(code);
        countryPreviewName.textContent = COUNTRY_DB[code];
        countryPreview.classList.remove('hidden');
    } else {
        countryPreview.classList.add('hidden');
    }
});

document.getElementById('add-country-close').addEventListener('click', closeAddCountry);
document.getElementById('add-country-cancel').addEventListener('click', closeAddCountry);
addCountryOverlay.addEventListener('click', (e) => { if (e.target === addCountryOverlay) closeAddCountry(); });

document.getElementById('add-country-confirm').addEventListener('click', () => {
    const code = countryCodeInput.value.trim().toUpperCase();
    if (!code || code.length !== 2) { toast('Enter a 2-letter country code', 'error'); return; }
    if (!COUNTRY_DB[code]) { toast('Unknown country code', 'error'); return; }
    const id = code.toLowerCase();
    if (STATE.countries.find(c => c.id === id)) {
        toast('Country already exists', 'error');
        return;
    }
    const flag = isoToFlag(code);
    const name = COUNTRY_DB[code];
    STATE.countries.push({ id, name, flag });
    save();
    closeAddCountry();
    renderAll();
    toast(`${flag} ${name} added`, 'success');
});

countryCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('add-country-confirm').click();
});

// ──── TRASH VIEW ────


// ──── LOGOUT ────
document.getElementById('logout-btn').addEventListener('click', () => {
    STATE.user = null;
    localStorage.removeItem('ct_session');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
});

// ──── LOGIN ────
function doLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if (!user || !pass) return;

    if (user === CREDENTIALS.username && pass === CREDENTIALS.password) {
        STATE.user = user;
        localStorage.setItem('ct_session', JSON.stringify({ user, ts: Date.now() }));
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        load();
        navigate('cards', 'canada');
        toast('Welcome back, Admin!', 'success');
    } else {
        document.getElementById('login-error').textContent = 'Invalid username or password';
        setTimeout(() => document.getElementById('login-error').textContent = '', 3000);
    }
}

// Handle form submit (Enter key)
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    doLogin();
});

// Handle button click directly (fallback for when form submit doesn't fire)
document.querySelector('.btn-login').addEventListener('click', (e) => {
    e.preventDefault();
    doLogin();
});

// ──── AUTO-LOGIN (session persistence) ────
(function autoLogin() {
    try {
        const session = JSON.parse(localStorage.getItem('ct_session'));
        if (session && session.user) {
            STATE.user = session.user;
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            load();
            navigate('cards', 'canada');
        }
    } catch (e) { /* no valid session */ }
})();

// ──── KEYBOARD SHORTCUTS ────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modalOverlay.classList.add('hidden');
        editOverlay.classList.add('hidden');
        document.getElementById('context-menu').classList.add('hidden');
        backupOverlay.classList.add('hidden');
        pendingBackup = null;
        document.getElementById('checker-overlay').classList.add('hidden');
        document.getElementById('add-country-overlay').classList.add('hidden');
        document.getElementById('delete-project-overlay').classList.add('hidden');
        document.getElementById('global-search-results').classList.add('hidden');
        document.body.style.overflow = '';
    }
});

// ──── INIT ────
load();

// ──── NOTES FUNCTIONS ────
function saveNotesAction() {
    const textarea = document.getElementById('notes-textarea');
    if (textarea) STATE.notes = textarea.value;
    STATE.notesLastSaved = Date.now();
    save();
    const info = document.querySelector('.notes-saved-info');
    if (info) info.textContent = 'Saved ' + new Date().toLocaleTimeString();
    toast('Notes saved', 'success');
}

function exportNotesAction() {
    const text = STATE.notes || '';
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `notes-${todayStr()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Notes exported', 'success');
}

function importNotesAction() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            STATE.notes = ev.target.result;
            save();
            renderNotes();
            toast('Notes imported', 'success');
        };
        reader.readAsText(file);
    };
    input.click();
}

function changeNotesFontSize(delta) {
    STATE.notesFontSize = Math.max(10, Math.min(24, STATE.notesFontSize + delta));
    const textarea = document.getElementById('notes-textarea');
    if (textarea) textarea.style.fontSize = STATE.notesFontSize + 'px';
    const display = document.getElementById('notes-font-size-display');
    if (display) display.textContent = STATE.notesFontSize;
}

// ──── CHECKER ────
// Checker implementation is in the IIFE below (line ~4300+)
// openChecker is exposed via window.openChecker from that IIFE

// ──── DROPDOWN MENUS ────
function closeAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('open'));
}

document.addEventListener('click', () => {
    closeAllDropdowns();
    document.getElementById('context-menu').classList.add('hidden');
});

// ──── DELETE PROJECT (custom modal) ────
const deleteProjectOverlay = document.getElementById('delete-project-overlay');
const deleteConfirmInput = document.getElementById('delete-confirm-input');
const deleteConfirmBtn = document.getElementById('delete-project-confirm');

document.getElementById('delete-project-btn').addEventListener('click', () => {
    deleteConfirmInput.value = '';
    deleteConfirmBtn.disabled = true;
    deleteProjectOverlay.classList.remove('hidden');
    setTimeout(() => deleteConfirmInput.focus(), 100);
});

function closeDeleteProject() {
    deleteProjectOverlay.classList.add('hidden');
}

document.getElementById('delete-project-close').addEventListener('click', closeDeleteProject);
document.getElementById('delete-project-cancel').addEventListener('click', closeDeleteProject);
deleteProjectOverlay.addEventListener('click', (e) => { if (e.target === deleteProjectOverlay) closeDeleteProject(); });

deleteConfirmInput.addEventListener('input', () => {
    deleteConfirmBtn.disabled = deleteConfirmInput.value.trim() !== 'DELETE';
});

deleteConfirmBtn.addEventListener('click', () => {
    if (deleteConfirmInput.value.trim() !== 'DELETE') return;
    STATE.cards = [];
    STATE.docs = [];
    STATE.notes = '';
    STATE.trash = [];
    save();
    closeDeleteProject();
    renderAll();
    toast('Project deleted', 'info');
});

// ══════════════════════════════════════════════════
// ──── PARSER MODULE ────
// ══════════════════════════════════════════════════

let PARSER_STATE = {
    rawMessages: [],
    mainFiles: [],    // [{name, size, messages}]
    compareFile: null, // {name, size, cardCount, _binLast4Set}
    file: null,
    collected: [],     // final cards after all steps
    _cleanCollected: [], // cards after trash+compare (before workspace+dedup)
    binGroups: [],
    selected: new Set(),
    binFilter: null,
    sortBy: 'index',
    statusFilter: 'ALL',
    _compareSet: null,
    _pipelineStats: null, // {totalRaw, trashRemoved, compareRemoved, workspaceRemoved, dupRemoved}
    filters: { bins: '', country: '', bank: '', minExpiry: '', activeTypes: [], activeNetworks: [], filterType: null, filterClass: null, filterPaymentSystem: null }
};

// ──── HELPERS ────

function getProjectBinCounts() {
    const counts = {};
    STATE.cards.forEach(c => {
        const num = (c.cardNumber || '').replace(/[\s\-]/g, '');
        if (num.length >= 6) {
            const b = num.slice(0, 6);
            counts[b] = (counts[b] || 0) + 1;
        }
    });
    return counts;
}

function formatCardBin(cc) {
    if (cc.length < 10) return cc;
    const bin6 = cc.slice(0, 6);
    const last4 = cc.slice(-4);
    return `${bin6} •••• ${last4}`;
}

function detectGeo(billing, country, countryCode, bankCountryCode) {
    const knownCodes = ['CA', 'US', 'AU', 'AE', 'UK', 'GB', 'IL', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI', 'NZ', 'SG', 'JP', 'KR', 'IN', 'BR', 'MX', 'ZA', 'IE', 'IT', 'ES', 'CH', 'AT', 'BE', 'PT', 'RU', 'CN', 'HK', 'TW', 'TH', 'PH', 'MY', 'ID', 'VN', 'PK', 'SA', 'QA', 'KW', 'EG', 'NG', 'KE', 'CL', 'CO', 'PE', 'AR', 'RO', 'BG', 'HR', 'CZ', 'PL', 'HU', 'LT', 'LV', 'EE', 'GR', 'CY', 'TR'];
    const nameToCode = {
        'canada': 'CA', 'united states': 'US', 'usa': 'US', 'australia': 'AU',
        'united arab emirates': 'AE', 'uae': 'AE', 'united kingdom': 'GB', 'uk': 'GB',
        'great britain': 'GB', 'israel': 'IL', 'germany': 'DE', 'france': 'FR',
        'netherlands': 'NL', 'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK',
        'finland': 'FI', 'new zealand': 'NZ', 'singapore': 'SG', 'japan': 'JP',
        'south korea': 'KR', 'korea': 'KR', 'india': 'IN', 'brazil': 'BR',
        'mexico': 'MX', 'south africa': 'ZA', 'ireland': 'IE', 'italy': 'IT',
        'spain': 'ES', 'switzerland': 'CH', 'austria': 'AT', 'belgium': 'BE',
        'portugal': 'PT', 'russia': 'RU', 'china': 'CN', 'hong kong': 'HK',
        'taiwan': 'TW', 'thailand': 'TH', 'philippines': 'PH', 'malaysia': 'MY',
        'indonesia': 'ID', 'vietnam': 'VN', 'pakistan': 'PK',
        'saudi arabia': 'SA', 'qatar': 'QA', 'kuwait': 'KW', 'egypt': 'EG',
        'nigeria': 'NG', 'kenya': 'KE', 'romania': 'RO', 'poland': 'PL',
        'czech republic': 'CZ', 'czechia': 'CZ', 'greece': 'GR', 'turkey': 'TR', 'turkiye': 'TR'
    };
    const _isCode = (s) => { const u = (s || '').trim().toUpperCase(); return u.length === 2 && knownCodes.includes(u) ? u : null; };

    // Priority 1: explicit 🏷 Country Code: CA
    const cc1 = _isCode(countryCode);
    if (cc1) return cc1;

    // Priority 2: [CA] from bank field
    const cc2 = _isCode(bankCountryCode);
    if (cc2) return cc2;

    // Priority 3: billing first element (🏷 Billing: CA, AB, CALGARY...)
    if (billing) {
        const first = billing.split(',')[0]?.trim();
        const cc3 = _isCode(first);
        if (cc3) return cc3;
    }

    // Priority 4: 🌍 Country: Canada (name → code mapping)
    if (country) {
        const cc4 = _isCode(country);
        if (cc4) return cc4;
        const mapped = nameToCode[country.trim().toLowerCase()];
        if (mapped) return mapped;
    }

    // Priority 5: scan all billing parts for any known code
    if (billing) {
        const parts = billing.split(',').map(p => p.trim());
        for (const p of parts) {
            const cc5 = _isCode(p);
            if (cc5) return cc5;
        }
    }

    return '';
}

function flattenText(textArray) {
    if (typeof textArray === 'string') return textArray;
    if (!Array.isArray(textArray)) return '';
    return textArray.map(item => typeof item === 'string' ? item : (item && item.text ? String(item.text) : '')).join('');
}

// ──── UNIVERSAL CARD NUMBER EXTRACTOR (for exclude) ────
// Extracts card numbers from ANY format including:
// - "4242424242424242 09 26 245" (CC MM YY CVV)
// - "4242-4242-4242-4242" (dashed)
// - emoji format "💳 CC: 4242 4242 4242 4242"
// - JSON fields: card_number, cardNumber, cc, pan, number, etc.
function extractAllCardNumbersFromJSON(data) {
    const seen = new Set();

    function isLuhnValid(num) {
        let sum = 0, alt = false;
        for (let i = num.length - 1; i >= 0; i--) {
            let n = parseInt(num[i], 10);
            if (alt) { n *= 2; if (n > 9) n -= 9; }
            sum += n;
            alt = !alt;
        }
        return sum % 10 === 0;
    }

    function addIfCard(str) {
        if (!str) return;
        const cleaned = String(str).replace(/[\s\-\.]/g, '');
        if (/^\d{13,19}$/.test(cleaned) && isLuhnValid(cleaned)) {
            seen.add(cleaned);
        }
    }

    // Extract card numbers from a text string
    function extractFromText(text) {
        if (!text || typeof text !== 'string') return;

        // Pattern 1: Pipe-separated (e.g. "4537800314042786|01|29|874" or "4537800314042786|01|29|874 Eric")
        const piped = text.match(/(?:^|\s)(\d{13,19})\|/gm);
        if (piped) piped.forEach(m => {
            const num = m.trim().split('|')[0];
            addIfCard(num);
        });

        // Pattern 2: Standalone 13-19 digit card numbers ("4242424242424242 09 26 245")
        const standalone = text.match(/(?<!\d)\d{13,19}(?!\d)/g);
        if (standalone) standalone.forEach(m => addIfCard(m));

        // Pattern 3: Card numbers with dashes (e.g. "4242-4242-4242-4242")
        const dashed = text.match(/\d{4}[\-]\d{4}[\-]\d{4}[\-]\d{3,4}/g);
        if (dashed) dashed.forEach(m => addIfCard(m));

        // Pattern 4: Card numbers with spaces in emoji format (e.g. "CC: 4242 4242 4242 4242")
        const emojiMatch = text.match(/💳\s*CC:\s*([\d ]+)/g);
        if (emojiMatch) {
            emojiMatch.forEach(m => {
                const num = m.replace(/💳\s*CC:\s*/, '').trim();
                addIfCard(num);
            });
        }
    }

    // Recursively scan any JSON structure
    function scanValue(val) {
        if (val === null || val === undefined) return;
        if (typeof val === 'number') {
            addIfCard(String(val));
            return;
        }
        if (typeof val === 'string') {
            addIfCard(val);
            extractFromText(val);
            return;
        }
        if (Array.isArray(val)) {
            val.forEach(item => scanValue(item));
            return;
        }
        if (typeof val === 'object') {
            // Check known card-number field names
            const cardFields = ['cc', 'card_number', 'cardNumber', 'card', 'number', 'pan', 'card_no', 'cardNo', 'card_num', 'cardNum', 'credit_card', 'creditCard'];
            for (const key of cardFields) {
                if (val[key] !== undefined) addIfCard(String(val[key]));
            }
            // Scan text fields (Telegram JSON messages)
            if (val.text !== undefined) {
                const txt = flattenText(val.text);
                if (txt) extractFromText(txt);
            }
            // Recurse into child properties
            for (const key of Object.keys(val)) {
                if (typeof val[key] === 'object' && val[key] !== null) scanValue(val[key]);
            }
        }
    }

    scanValue(data);
    return seen;
}

function extractCardsFromMessages(messages) {
    // Block-splitting limits scope, so /s is safe (no backtracking across megabytes)
    const pattern = /💳\s*CC:\s*([\d ]+).*?📅\s*Validity:\s*(\d{2})\s*\/\s*(\d{2,4}).*?🔐\s*CVV:\s*(\d{3,4})/gs;
    const holderP = /👶\s*Holder:\s*(.+)/i;
    const bankP = /🏦\s*Bank:\s*(.+)/i;
    const typeP = /📊\s*(?:Card Type|Card):\s*(.+)/i;
    const billingP = /🏷\s*Billing:\s*(.+)/i;
    const countryP = /🌍\s*Country:\s*(.+)/i;
    const countryCodeP = /🏷\s*Country\s*Code:\s*([A-Za-z]{2})/i;
    const bankCodeP = /\[([A-Z]{2})\]/;

    // BUG #7 FIX: Split each message into per-card blocks
    // so holder/bank/etc are matched within the correct card section
    const cardBlockSplitter = /(?=💳\s*CC:)/;

    const cards = [];
    for (const msg of messages) {
        const fullText = flattenText(msg.text);
        if (!fullText) continue;
        const msgDate = msg.date || '';

        // Split message into blocks, each starting with 💳 CC:
        const blocks = fullText.split(cardBlockSplitter).filter(b => b.includes('💳'));

        for (const block of blocks) {
            pattern.lastIndex = 0;
            const m = pattern.exec(block);
            if (!m) continue;

            const ccRaw = m[1].replace(/\s/g, '');
            let mm = m[2];
            let yy = m[3];
            const cvv = m[4];
            if (yy.length === 4) yy = yy.slice(2);

            // BUG #7 FIX: Match within THIS card block, not the whole message
            const holderM = block.match(holderP);
            const bankM = block.match(bankP);
            const typeM = block.match(typeP);
            const billingM = block.match(billingP);
            const countryM = block.match(countryP);
            const countryCodeM = block.match(countryCodeP);

            const holder = holderM ? holderM[1].trim() : '';
            const nameParts = holder.split(/\s+/);
            const name = nameParts[0] || '';
            const surname = nameParts.slice(1).join(' ') || '';

            const bankRaw = bankM ? bankM[1].trim() : '';
            const bankCodeM2 = bankRaw.match(bankCodeP);
            const bankCountryCode = bankCodeM2 ? bankCodeM2[1] : '';
            const bank = bankRaw.replace(/\s*\[[A-Z]{2}\]/, '').replace(/[\u{1F1E0}-\u{1F1FF}]{2}/gu, '').trim();

            const cardType = typeM ? typeM[1].trim() : '';
            const billing = billingM ? billingM[1].trim() : '';
            const countryName = countryM ? countryM[1].trim() : '';
            const countryCode = countryCodeM ? countryCodeM[1].trim() : '';

            cards.push({
                cc: ccRaw,
                mm, yy, cvv,
                name, surname,
                bank, cardType,
                country: countryName, billing,
                countryCode, bankCountryCode,
                msgDate,
                validity: `${mm}/${yy}`,
                bin: ccRaw.substring(0, 6)
            });
        }
    }
    return cards;
}

// ──── RENDER GENERATOR ────

// ═══════════════════════════════════════════
//        DOCUMENT GENERATOR (ID Forge Clone)
// ═══════════════════════════════════════════

const GEN_DOCS = [
    { id: 'ca-dl', country: 'US', cat: 'DRIVER LICENSE', name: 'California', icon: '🚗', active: true },
    { id: 'us-pp', country: 'US', cat: 'PASSPORT', name: 'US Passport', icon: '📘', active: false },
    { id: 'on-dl', country: 'CA', cat: 'DRIVER LICENSE', name: 'Ontario', icon: '🚗', active: true },
    { id: 'bc-dl', country: 'CA', cat: 'DRIVER LICENSE', name: 'British Columbia', icon: '🚗', active: true },
    { id: 'ca-pp', country: 'CA', cat: 'PASSPORT', name: 'Canadian Passport', icon: '📘', active: true },
    { id: 'rogers', country: 'CA', cat: 'UTILITY BILLS', name: 'Rogers Bill', icon: '📄', active: true },
    { id: 'au-nsw', country: 'AU', cat: 'DRIVER LICENSE', name: 'New South Wales', icon: '🚗', active: false },
    { id: 'au-vic', country: 'AU', cat: 'DRIVER LICENSE', name: 'Victoria', icon: '🚗', active: false },
    { id: 'au-pp', country: 'AU', cat: 'PASSPORT', name: 'Australian Passport', icon: '📘', active: false },
    { id: 'de-dl', country: 'DE', cat: 'DRIVER LICENSE', name: 'Germany DL', icon: '🚗', active: false },
];

const GEN_COUNTRIES = [
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
];

let _genState = { docId: 'ca-dl', sex: 'M', result: null };

/* ── Helpers ── */
const _rInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const _rPick = arr => arr[_rInt(0, arr.length - 1)];
const _pad2 = n => String(n).padStart(2, '0');
const _rDigits = n => Array.from({ length: n }, () => _rInt(0, 9)).join('');
const _rLetter = () => String.fromCharCode(65 + _rInt(0, 25));
const _rLetters = n => Array.from({ length: n }, () => _rLetter()).join('');

const _MALE_FIRST = ['JAMES', 'JOHN', 'ROBERT', 'MICHAEL', 'WILLIAM', 'DAVID', 'RICHARD', 'JOSEPH', 'THOMAS', 'CHARLES', 'DANIEL', 'MATTHEW', 'ANTHONY', 'MARK', 'STEVEN', 'PAUL', 'ANDREW', 'JOSHUA', 'KENNETH', 'KEVIN'];
const _FEMALE_FIRST = ['MARY', 'PATRICIA', 'JENNIFER', 'LINDA', 'BARBARA', 'ELIZABETH', 'SUSAN', 'JESSICA', 'SARAH', 'KAREN', 'LISA', 'NANCY', 'BETTY', 'MARGARET', 'SANDRA', 'ASHLEY', 'DOROTHY', 'KIMBERLY', 'EMILY', 'DONNA'];
const _LAST_NAMES = ['SMITH', 'JOHNSON', 'WILLIAMS', 'BROWN', 'JONES', 'GARCIA', 'MILLER', 'DAVIS', 'RODRIGUEZ', 'MARTINEZ', 'HERNANDEZ', 'LOPEZ', 'GONZALEZ', 'WILSON', 'ANDERSON', 'THOMAS', 'TAYLOR', 'MOORE', 'JACKSON', 'MARTIN', 'LEE', 'PEREZ', 'THOMPSON', 'WHITE', 'HARRIS', 'SANCHEZ', 'CLARK', 'RAMIREZ', 'LEWIS', 'ROBINSON'];
const _HAIR = ['BRN', 'BLK', 'BLN', 'RED', 'GRY', 'WHT', 'SDY', 'AUB'];
const _EYES = ['BRN', 'BLU', 'GRN', 'HZL', 'GRY', 'BLK'];
const _CA_CITIES = [{ c: 'LOS ANGELES', z: '900' }, { c: 'SAN FRANCISCO', z: '941' }, { c: 'SAN DIEGO', z: '921' }, { c: 'SAN JOSE', z: '951' }, { c: 'SACRAMENTO', z: '958' }, { c: 'FRESNO', z: '937' }, { c: 'LONG BEACH', z: '908' }, { c: 'OAKLAND', z: '946' }, { c: 'BAKERSFIELD', z: '933' }, { c: 'ANAHEIM', z: '928' }];
const _CA_STREETS = ['MAIN ST', 'OAK AVE', 'ELM ST', 'MAPLE DR', 'CEDAR LN', 'PINE RD', 'WALNUT ST', 'BROADWAY', 'SUNSET BLVD', 'PACIFIC AVE', 'MISSION ST', 'MARKET ST', 'VALENCIA ST', 'FOLSOM ST', 'GEARY BLVD'];
const _ON_CITIES = [{ c: 'TORONTO', p: 'M' }, { c: 'OTTAWA', p: 'K' }, { c: 'MISSISSAUGA', p: 'L' }, { c: 'BRAMPTON', p: 'L' }, { c: 'HAMILTON', p: 'L' }, { c: 'LONDON', p: 'N' }, { c: 'MARKHAM', p: 'L' }, { c: 'VAUGHAN', p: 'L' }, { c: 'KITCHENER', p: 'N' }, { c: 'WINDSOR', p: 'N' }];
const _BC_CITIES = [{ c: 'VANCOUVER', p: 'V' }, { c: 'SURREY', p: 'V' }, { c: 'BURNABY', p: 'V' }, { c: 'RICHMOND', p: 'V' }, { c: 'KELOWNA', p: 'V' }, { c: 'VICTORIA', p: 'V' }, { c: 'NANAIMO', p: 'V' }, { c: 'KAMLOOPS', p: 'V' }];
const _MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const _MONTHS_FR = ['JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE'];
const _MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function _genDOB(sex) {
    const age = _rInt(30, 50);
    const y = new Date().getFullYear() - age;
    const m = _rInt(1, 12), d = _rInt(1, 28);
    return { y, m, d };
}
function _genName(sex) {
    const fn = sex === 'F' ? _rPick(_FEMALE_FIRST) : _rPick(_MALE_FIRST);
    const ln = _rPick(_LAST_NAMES);
    return { fn, ln };
}
function _parseTemplate(text) {
    const t = {};
    if (!text) return t;
    const lines = text.split('\n');
    for (const line of lines) {
        const l = line.replace(/^[^\w]*/, '').trim();
        if (/^holder:/i.test(l)) t.holder = l.replace(/^holder:\s*/i, '').trim();
        if (/^billing:/i.test(l)) t.billing = l.replace(/^billing:\s*/i, '').trim();
        if (/^zip:/i.test(l)) t.zip = l.replace(/^zip:\s*/i, '').trim();
    }
    return t;
}

/* ═══ CALIFORNIA DL ═══ */
function generateCaliforniaDL(sex, tpl) {
    const { fn, ln } = tpl.holder ? (() => { const p = tpl.holder.split(/\s+/); return { fn: p[0]?.toUpperCase() || 'JOHN', ln: p.slice(1).join(' ').toUpperCase() || 'DOE' }; })() : _genName(sex);
    const dob = _genDOB(sex);
    const expY = new Date().getFullYear() + _rInt(2, 5);
    const issY = new Date().getFullYear() - _rInt(0, 3);
    const dlNum = _rLetter() + _rDigits(7);
    const city = _rPick(_CA_CITIES);
    const addr = `${_rInt(100, 9999)} ${_rPick(_CA_STREETS)}`;
    const hgt = sex === 'F' ? `${_rPick(['5'])}' - ${_pad2(_rInt(0, 8))}"` : `${_rPick(['5', '6'])}' - ${_pad2(_rInt(0, 11))}"`;
    const wgt = sex === 'F' ? `${_rInt(110, 160)} lb` : `${_rInt(150, 220)} lb`;
    const serial = `${_pad2(dob.m)}${_pad2(dob.d)}${String(dob.y).slice(2)}`;

    return {
        title: 'California Driver License',
        sections: [{
            name: 'FRONT', copyLabel: 'Copy Front',
            fields: [
                { label: 'DL', value: dlNum },
                { label: 'EXP', value: `${_pad2(dob.m)}/${_pad2(dob.d)}/${expY}` },
                { label: 'LN', value: ln },
                { label: 'FN', value: fn },
                { label: 'CLASS', value: 'C' },
                { label: 'DOB', value: `${_pad2(dob.m)}/${_pad2(dob.d)}/${dob.y}` },
                { label: 'DOB (NO SLASH)', value: `${_pad2(dob.m)}${_pad2(dob.d)}${dob.y}` },
                { label: 'SERIAL (VERT)', value: serial },
                { label: 'SEX', value: sex },
                { label: 'HAIR', value: _rPick(_HAIR) },
                { label: 'EYES', value: _rPick(_EYES) },
                { label: 'HGT', value: hgt },
                { label: 'WGT', value: wgt },
                { label: 'ADDRESS', value: `${addr}, ${city.c}, CA ${city.z}${_rDigits(2)}` },
                { label: 'ISS', value: `${_pad2(_rInt(1, 12))}/${_pad2(_rInt(1, 28))}/${issY}` },
                { label: 'DD', value: `${_pad2(dob.m)}/${_pad2(dob.d)}/${dob.y}${_rDigits(4)}${_rLetters(2)}/${_rLetters(2)}/${_rDigits(4)}` },
            ]
        }, {
            name: 'BACK', copyLabel: 'Copy Back',
            fields: [
                { label: 'SERIAL', value: serial },
                { label: 'REV', value: `Rev ${_pad2(_rInt(1, 12))}/${_pad2(_rInt(1, 28))}/${new Date().getFullYear() - _rInt(1, 3)}` },
                { label: 'INVENTORY', value: `${_rDigits(5)}${_rLetters(2)}${dlNum}${_rDigits(5)}` },
            ]
        }]
    };
}

/* ═══ ONTARIO DL ═══ */
function generateOntarioDL(sex, tpl) {
    const { fn, ln } = tpl.holder ? (() => { const p = tpl.holder.split(/\s+/); return { fn: p[0]?.toUpperCase() || 'JOHN', ln: p.slice(1).join(' ').toUpperCase() || 'DOE' }; })() : _genName(sex);
    const dob = _genDOB(sex);
    const city = _rPick(_ON_CITIES);
    const dlNum = `${ln[0]}${_rDigits(4)}-${_rDigits(5)}-${_rDigits(5)}`;
    const issDate = `${new Date().getFullYear() - _rInt(0, 2)}/${_pad2(_rInt(1, 12))}/${_pad2(_rInt(1, 28))}`;
    const expDate = `${new Date().getFullYear() + _rInt(2, 5)}/${_pad2(dob.m)}/${_pad2(dob.d)}`;
    const postal = `${city.p}${_rInt(1, 9)}${_rLetter()} ${_rInt(1, 9)}${_rLetter()}${_rInt(1, 9)}`;

    return {
        title: 'Ontario Driver\'s Licence',
        sections: [{
            name: 'NAME / NOM', copyLabel: 'Copy All',
            fields: [
                { label: '1. FIRST NAME', value: fn },
                { label: '2. LAST NAME', value: ln },
                { label: 'MIDDLE NAME', value: _rPick(_MALE_FIRST.concat(_FEMALE_FIRST)).slice(0, 1) + '.' },
            ]
        }, {
            name: 'ADDRESS / ADRESSE',
            fields: [
                { label: 'ADDRESS', value: `${_rInt(100, 9999)} ${_rPick(_CA_STREETS)}` },
                { label: 'CITY', value: city.c },
                { label: 'PROVINCE', value: 'ON' },
                { label: 'POSTAL CODE', value: postal },
            ]
        }, {
            name: 'DOCUMENT / NUMÉRO',
            fields: [
                { label: '4D. DL NUMBER', value: dlNum },
                { label: '4A. ISS / DÉL', value: issDate },
                { label: '4B. EXP', value: expDate },
                { label: '5. DD / REF', value: `DB${_rDigits(7)}` },
                { label: '12. REST / COND', value: `*${_rDigits(7)}*` },
            ]
        }, {
            name: 'PERSONAL',
            fields: [
                { label: '15. SEX', value: sex },
                { label: '9. CLASS', value: 'G' },
                { label: '16. HEIGHT', value: `${_rInt(155, 195)} cm` },
                { label: '3. DOB', value: `${dob.y}/${_pad2(dob.m)}/${_pad2(dob.d)}` },
            ]
        }]
    };
}

/* ═══ BC DL ═══ */
function generateBCDL(sex, tpl) {
    const { fn, ln } = tpl.holder ? (() => { const p = tpl.holder.split(/\s+/); return { fn: p[0]?.toUpperCase() || 'JOHN', ln: p.slice(1).join(' ').toUpperCase() || 'DOE' }; })() : _genName(sex);
    const dob = _genDOB(sex);
    const city = _rPick(_BC_CITIES);
    const dlNum = _rDigits(7);
    const postal = `${city.p}${_rInt(1, 9)}${_rLetter()} ${_rInt(1, 9)}${_rLetter()}${_rInt(1, 9)}`;

    return {
        title: 'British Columbia Driver\'s Licence',
        sections: [{
            name: 'FRONT',
            fields: [
                { label: 'FULL NAME', value: `${ln}, ${fn}` },
                { label: 'ADDRESS', value: `${_rInt(100, 9999)} ${_rPick(_CA_STREETS)}` },
                { label: 'CITY', value: `${city.c}, BC` },
                { label: 'POSTAL CODE', value: postal },
                { label: 'DL NUMBER', value: dlNum },
                { label: 'ISS', value: `${new Date().getFullYear() - _rInt(0, 3)}-${_rPick(_MONTHS_SHORT)}-${_pad2(_rInt(1, 28))}` },
                { label: 'EXP', value: `${new Date().getFullYear() + _rInt(2, 5)}-${_rPick(_MONTHS_SHORT)}-${_pad2(dob.d)}` },
                { label: 'DOB', value: `${dob.y}-${_rPick(_MONTHS_SHORT)}-${_pad2(dob.d)}` },
                { label: 'SEX', value: sex },
                { label: 'HAIR', value: _rPick(_HAIR) },
                { label: 'EYES', value: _rPick(_EYES) },
                { label: 'HEIGHT', value: `${_rInt(155, 195)} cm` },
                { label: 'WEIGHT', value: `${(_rInt(550, 950) / 10).toFixed(1)} kg` },
            ]
        }, {
            name: 'BACK SIDE',
            fields: [
                { label: 'RESTRICTIONS', value: sex === 'F' ? 'MUST DISPLAY "N" SIGN' : '47 0 BAC; MUST DISPLAY "N" SIGN' },
                { label: 'HEALTH NUMBER', value: `${_rDigits(4)} ${_rDigits(3)} ${_rDigits(3)}` },
                { label: 'BARCODE', value: `${_rLetter()}${_rDigits(7)}` },
            ]
        }]
    };
}

/* ═══ CANADIAN PASSPORT ═══ */
function generateCanadianPassport(sex, tpl) {
    const { fn, ln } = tpl.holder ? (() => { const p = tpl.holder.split(/\s+/); return { fn: p[0]?.toUpperCase() || 'JOHN', ln: p.slice(1).join(' ').toUpperCase() || 'DOE' }; })() : _genName(sex);
    const dob = _genDOB(sex);
    const ppNum = _rLetters(2) + _rDigits(6);
    const expY = new Date().getFullYear() + _rInt(5, 10);
    const issY = expY - 10;
    const mrzSurname = ln.replace(/[^A-Z]/g, '');
    const mrzGiven = fn.replace(/[^A-Z]/g, '');
    const line1 = `P<CAN${mrzSurname}<<${mrzGiven}${'<'.repeat(Math.max(0, 44 - 5 - mrzSurname.length - 2 - mrzGiven.length))}`.slice(0, 44);
    const dobStr = `${String(dob.y).slice(2)}${_pad2(dob.m)}${_pad2(dob.d)}`;
    const expStr = `${String(expY).slice(2)}${_pad2(dob.m)}${_pad2(dob.d)}`;
    const cd = n => String(n % 10);
    const line2 = `${ppNum}<${cd(_rInt(0, 9))}CAN${dobStr}${cd(_rInt(0, 9))}${sex}${expStr}${cd(_rInt(0, 9))}${'<'.repeat(14)}${cd(_rInt(0, 9))}`.slice(0, 44);

    const provinces = ['ONTARIO', 'BRITISH COLUMBIA', 'QUEBEC', 'ALBERTA', 'NOVA SCOTIA'];

    return {
        title: 'Canadian Passport',
        sections: [{
            name: 'DOCUMENT INFO',
            fields: [
                { label: 'TYPE', value: 'P' },
                { label: 'COUNTRY', value: 'CAN' },
                { label: 'PASSPORT NO.', value: ppNum },
                { label: 'SURNAME', value: ln },
                { label: 'GIVEN NAMES', value: fn },
                { label: 'NATIONALITY', value: 'CANADIAN / CANADIENNE' },
                { label: 'DOB', value: `${_pad2(dob.d)} ${_MONTHS_EN[dob.m - 1].toUpperCase()} /${_MONTHS_FR[dob.m - 1]} ${String(dob.y).slice(2)}` },
                { label: 'SEX', value: sex },
                { label: 'PLACE OF BIRTH', value: _rPick(provinces) },
                { label: 'DATE OF ISSUE', value: `${_pad2(_rInt(1, 28))} ${_MONTHS_EN[_rInt(0, 11)].toUpperCase()} ${String(issY).slice(2)}` },
                { label: 'DATE OF EXPIRY', value: `${_pad2(_rInt(1, 28))} ${_MONTHS_EN[_rInt(0, 11)].toUpperCase()} ${String(expY).slice(2)}` },
                { label: 'AUTHORITY', value: _rPick(provinces) },
            ]
        }, {
            name: 'PERFO / SERIAL',
            fields: [
                { label: 'SERIAL 1', value: ppNum },
                { label: 'SERIAL 2', value: `${_rLetters(3)}${_rDigits(5)}` },
            ]
        }, {
            name: 'MRZ (MACHINE READABLE ZONE)',
            fields: [
                { label: 'LINE 1', value: line1 },
                { label: 'LINE 2', value: line2 },
            ]
        }]
    };
}

/* ═══ ROGERS BILL ═══ */
function generateRogersBill(sex, tpl) {
    const holder = tpl.holder || `${_rPick(_MALE_FIRST)} ${_rPick(_LAST_NAMES)}`;
    const billing = tpl.billing || 'CA, ON, Toronto, 5 Bay Street';
    const zip = tpl.zip || `M${_rInt(1, 9)}${_rLetter()} ${_rInt(1, 9)}${_rLetter()}${_rInt(1, 9)}`;
    const total = (_rInt(8000, 25000) / 100).toFixed(2);
    const pastDue = (_rInt(0, 3000) / 100).toFixed(2);
    const saved = (_rInt(200, 1500) / 100).toFixed(2);
    const payDate = new Date(Date.now() + _rInt(10, 30) * 86400000);
    const billDate = new Date(Date.now() - _rInt(1, 5) * 86400000);

    return {
        title: 'Rogers Bill',
        sections: [{
            name: 'GREETING',
            fields: [
                { label: 'HELLO', value: holder },
            ]
        }, {
            name: 'TOTAL DUE',
            fields: [
                { label: '$ TOTAL DUE', value: `$${total}` },
                { label: 'PAST DUE BALANCE', value: `$${pastDue}` },
                { label: 'PAY $ BY DATE', value: `$${total}` },
                { label: 'REQUIRED PAYMENT DATE', value: `${_pad2(payDate.getDate())} ${_MONTHS_EN[payDate.getMonth()]}, ${payDate.getFullYear()}` },
                { label: 'YOU SAVED $', value: `$${saved}` },
            ]
        }, {
            name: 'SUMMARY',
            fields: [
                { label: 'BALANCE FORWARD', value: `$${pastDue}` },
                { label: 'BUNDLED SERVICES', value: `$${(_rInt(5000, 15000) / 100).toFixed(2)}` },
                { label: 'TOTAL (INCL HST)', value: `$${total}` },
            ]
        }, {
            name: 'BOTTOM SECTION',
            fields: [
                { label: 'POSTAL LINE', value: `##POSTAL${zip.replace(/\s/g, '')} ${_rDigits(23)};C;QCC;${_rDigits(9)};${_rDigits(3)}` },
                { label: 'ACCOUNT NUMBER', value: _rDigits(9) },
                { label: 'BILL DATE', value: `${_MONTHS_EN[billDate.getMonth()].toUpperCase()} ${_pad2(billDate.getDate())}, ${billDate.getFullYear()}` },
                { label: 'BARCODE', value: _rDigits(30) },
            ]
        }]
    };
}

/* ═══ DISPATCH ═══ */
function generateDocument(docId, sex, templateText) {
    const tpl = _parseTemplate(templateText);
    switch (docId) {
        case 'ca-dl': return generateCaliforniaDL(sex, tpl);
        case 'on-dl': return generateOntarioDL(sex, tpl);
        case 'bc-dl': return generateBCDL(sex, tpl);
        case 'ca-pp': return generateCanadianPassport(sex, tpl);
        case 'rogers': return generateRogersBill(sex, tpl);
        default: return null;
    }
}

/* ═══ RENDER ═══ */
function renderGenerator() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.style.display = 'none';

    // Build sidebar tree
    let sidebarHTML = '';
    GEN_COUNTRIES.forEach(country => {
        const docs = GEN_DOCS.filter(d => d.country === country.code);
        if (!docs.length) return;
        const cats = [...new Set(docs.map(d => d.cat))];
        let childrenHTML = '';
        cats.forEach(cat => {
            const catIcon = cat === 'DRIVER LICENSE' ? '🚗' : cat === 'PASSPORT' ? '📘' : '⚡';
            childrenHTML += `<div class="gen-cat">${catIcon} ${cat}</div>`;
            docs.filter(d => d.cat === cat).forEach(d => {
                const active = d.id === _genState.docId;
                const badge = d.active ? '<span class="gen-badge-active">✓</span>' : '<span class="gen-badge-locked">🔒</span>';
                childrenHTML += `<button class="gen-doc-item ${active ? 'active' : ''} ${d.active ? '' : 'locked'}" data-doc="${d.id}" ${d.active ? '' : 'disabled'}>${d.name} ${badge}</button>`;
            });
        });
        sidebarHTML += `
            <div class="gen-country-group">
                <div class="gen-country-header"><span class="gen-country-flag">${country.flag}</span> ${country.name}</div>
                ${childrenHTML}
            </div>`;
    });

    const doc = GEN_DOCS.find(d => d.id === _genState.docId);
    const showSexToggle = doc && doc.cat === 'DRIVER LICENSE' || doc?.id === 'ca-pp';
    const showTemplate = doc?.cat !== 'UTILITY BILLS';

    // Config panel
    let configHTML = `<h2 class="gen-title">${doc?.icon || ''} ${doc?.name || 'Select'} ${doc?.active ? '<span class="gen-active-badge">Active</span>' : ''}</h2><hr class="gen-hr">`;

    if (showSexToggle) {
        configHTML += `
            <div class="gen-sex-row">
                <span class="gen-label">Sex:</span>
                <button class="gen-sex-btn ${_genState.sex === 'M' ? 'active' : ''}" data-sex="M">👤 Male (30-50)</button>
                <button class="gen-sex-btn ${_genState.sex === 'F' ? 'active' : ''}" data-sex="F">👤 Female (30-50)</button>
            </div>`;
    }

    if (showTemplate) {
        configHTML += `
            <div class="gen-template-box">
                <div class="gen-template-header">
                    <span>◎ TEMPLATE (OPTIONAL):</span>
                </div>
                <textarea class="gen-template-input" id="gen-template" placeholder="👶 Holder: John Doe\n🏷 Billing: US, CA, Los Angeles, 123 Main St\n📦 ZIP: 90001"></textarea>
            </div>`;
    } else {
        configHTML += `
            <div class="gen-template-box">
                <div class="gen-template-header">
                    <span>👤 HOLDER + ADDRESS (OPTIONAL):</span>
                    <button class="gen-copy-tpl-btn" id="gen-copy-tpl">📋 Copy Template</button>
                </div>
                <textarea class="gen-template-input" id="gen-template" placeholder="👶 Holder: Nicole Ellen Ross\n🏷 Billing: CA, ON, Toronto, 5 Bay Street\n📦 ZIP: M2K 6C2"></textarea>
            </div>`;
    }

    configHTML += `<button class="gen-generate-btn" id="gen-generate-btn">🔄 Generate</button>`;

    // Output
    let outputHTML = '';
    if (_genState.result) {
        _genState.result.sections.forEach((sec, si) => {
            outputHTML += `<div class="gen-section">
                <div class="gen-section-header">
                    <span class="gen-section-title">${sec.name}</span>
                    <button class="gen-copy-section-btn" data-si="${si}">${sec.copyLabel || 'Copy'}</button>
                </div>`;
            sec.fields.forEach((f, fi) => {
                outputHTML += `
                    <div class="gen-field-row">
                        <span class="gen-field-label">${f.label}</span>
                        <span class="gen-field-value">${f.value}</span>
                        <div class="gen-field-actions">
                            <button class="gen-regen-btn" data-si="${si}" data-fi="${fi}" title="Regenerate">🔄</button>
                            <button class="gen-copy-btn" data-val="${f.value.replace(/"/g, '&quot;')}" title="Copy">📋</button>
                        </div>
                    </div>`;
            });
            outputHTML += '</div>';
        });
        outputHTML += `<button class="gen-copy-all-btn" id="gen-copy-all">📋 Copy All</button>`;
    }

    area.innerHTML = `
        <div class="gen-container">
            <div class="gen-sidebar">${sidebarHTML}</div>
            <div class="gen-main">
                <div class="gen-config">${configHTML}</div>
                <div class="gen-output">${outputHTML}</div>
            </div>
        </div>`;

    // ── Event bindings ──
    area.querySelectorAll('.gen-doc-item').forEach(btn => {
        btn.addEventListener('click', () => {
            _genState.docId = btn.dataset.doc;
            _genState.result = null;
            renderGenerator();
        });
    });
    area.querySelectorAll('.gen-sex-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _genState.sex = btn.dataset.sex;
            renderGenerator();
        });
    });
    document.getElementById('gen-generate-btn')?.addEventListener('click', () => {
        const tplText = document.getElementById('gen-template')?.value || '';
        _genState.result = generateDocument(_genState.docId, _genState.sex, tplText);
        renderGenerator();
    });
    document.getElementById('gen-copy-tpl')?.addEventListener('click', () => {
        const tpl = `👶 Holder: John Doe\n🏷 Billing: CA, ON, Toronto, 5 Bay Street\n📦 ZIP: M2K 6C2`;
        navigator.clipboard?.writeText(tpl);
        toast('Template copied', 'success');
    });
    area.querySelectorAll('.gen-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            navigator.clipboard?.writeText(btn.dataset.val);
            toast('Copied', 'success');
        });
    });
    area.querySelectorAll('.gen-copy-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const si = parseInt(btn.dataset.si);
            const sec = _genState.result?.sections[si];
            if (sec) {
                const text = sec.fields.map(f => `${f.label}: ${f.value}`).join('\n');
                navigator.clipboard?.writeText(text);
                toast(`${sec.name} copied`, 'success');
            }
        });
    });
    document.getElementById('gen-copy-all')?.addEventListener('click', () => {
        if (_genState.result) {
            const text = _genState.result.sections.map(s => `── ${s.name} ──\n` + s.fields.map(f => `${f.label}: ${f.value}`).join('\n')).join('\n\n');
            navigator.clipboard?.writeText(text);
            toast('All copied', 'success');
        }
    });
    area.querySelectorAll('.gen-regen-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tplText = document.getElementById('gen-template')?.value || '';
            _genState.result = generateDocument(_genState.docId, _genState.sex, tplText);
            renderGenerator();
        });
    });
}

// ──── RENDER BUILDER ────

function renderBuilder() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.innerHTML = '';

    area.innerHTML = `
    <div class="tool-stub-container">
        <div class="tool-stub-icon">🏗️</div>
        <h2 class="tool-stub-title">Builder</h2>
        <p class="tool-stub-desc">Tag combination builder — Agoda + BIN + Amount + Comment</p>
        <div class="tool-stub-features">
            <div class="tool-stub-feature">
                <span class="tool-stub-dot" style="background:#818CF8"></span>
                <span>Build tag combinations</span>
            </div>
            <div class="tool-stub-feature">
                <span class="tool-stub-dot" style="background:#22C55E"></span>
                <span>Save presets</span>
            </div>
            <div class="tool-stub-feature">
                <span class="tool-stub-dot" style="background:#F59E0B"></span>
                <span>Export ready combinations</span>
            </div>
        </div>
    </div>`;
}

// ──── RENDER PARSER ────

function renderParser() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.innerHTML = '';

    const hasBase = PARSER_STATE.rawMessages.length > 0;
    const hasParsed = PARSER_STATE.collected.length > 0;
    const totalMessages = PARSER_STATE.rawMessages.length;

    // Build file chips HTML for loaded bases
    const baseChipsHtml = PARSER_STATE.mainFiles.map((f, i) =>
        `<span class="pz-file-chip">📁 ${f.name} <span class="pz-chip-count">${f.messages.length}</span><button class="pz-chip-remove" data-base-idx="${i}" title="Remove">×</button></span>`
    ).join('');

    // Compare file chip (Stage 2)
    const compareChipHtml = PARSER_STATE.compareFile
        ? `<span class="pz-file-chip pz-file-chip-compare">🔍 ${PARSER_STATE.compareFile.name} <span class="pz-chip-count">${PARSER_STATE.compareFile.cardCount || 0} cards</span><button class="pz-chip-remove" id="pz-compare-remove" title="Remove">×</button></span>`
        : '';

    area.innerHTML = `
    <div class="parser-container">
        <!-- STAGE 1: LOAD BASE FILES -->
        <div class="pz-stage">
            <div class="pz-stage-header">
                <span class="pz-stage-num">1</span>
                <span class="pz-stage-title">LOAD & PARSE</span>
            </div>
            <div class="pz-upload-single">
                <div class="pz-drop-zone" id="pz-base-drop">
                    <input type="file" id="pz-base-input" accept=".json" multiple hidden>
                    <span class="pz-drop-text">${PARSER_STATE.mainFiles.length === 0 ? 'Drop result.json or click' : 'Drop another file or click +'}</span>
                    <span class="pz-drop-hint">Telegram JSON · 100% local</span>
                </div>
                <button class="pz-add-mini" id="pz-add-base" title="Add another base file">+</button>
            </div>
            <div class="pz-chips" id="pz-base-chips">${baseChipsHtml}</div>
            ${totalMessages > 0 ? `<div class="pz-msg-count">${totalMessages.toLocaleString()} messages loaded</div>` : ''}
        </div>

        <!-- FILTERS (collapsible, compact) -->
        <div class="parser-filters ${hasBase ? '' : 'pz-disabled'}">
            <div class="parser-filter-row">
                <div class="parser-filter-group parser-filter-bins">
                    <label>BINs <span class="parser-filter-hint">(comma separated)</span></label>
                    <textarea id="parser-bins" rows="1" placeholder="450003, 424242, 532610...">${PARSER_STATE.filters.bins || ''}</textarea>
                </div>
                <div class="parser-filter-group">
                    <label>Country</label>
                    <input type="text" id="parser-country" placeholder="CA, US, GB..." value="${PARSER_STATE.filters.country || ''}">
                </div>
                <div class="parser-filter-group">
                    <label>Bank</label>
                    <input type="text" id="parser-bank" placeholder="Bank name..." value="${PARSER_STATE.filters.bank || ''}">
                </div>
                <div class="parser-filter-group">
                    <label>Min Expiry</label>
                    <input type="text" id="parser-min-expiry" placeholder="MM/YY" maxlength="5" value="${PARSER_STATE.filters.minExpiry || ''}">
                </div>
            </div>
            <!-- Многоуровневая система фильтрации карт -->
            <div class="parser-filter-levels" id="parser-filter-levels">
                <!-- Уровень 1 — Тип карты -->
                <div class="parser-filter-level">
                    <span class="parser-filter-level-label">ТИП</span>
                    <div class="parser-filter-level-btns">
                        ${['CREDIT','DEBIT','PREPAID','CHARGE','BUSINESS','GIFT'].map(t =>
                            `<button class="parser-level-btn${PARSER_STATE.filters.filterType === t ? ' active' : ''}" data-filter-type="${t}">${t}</button>`
                        ).join('')}
                    </div>
                </div>
                <!-- Уровень 2 — Класс карты -->
                <div class="parser-filter-level">
                    <span class="parser-filter-level-label">КЛАСС</span>
                    <div class="parser-filter-level-btns">
                        ${['CLASSIC','STANDARD','GOLD','PLATINUM','TITANIUM','SIGNATURE','WORLD','WORLD_ELITE','INFINITE','BLACK','ELECTRON','MAESTRO'].map(t =>
                            `<button class="parser-level-btn${PARSER_STATE.filters.filterClass === t ? ' active' : ''}" data-filter-class="${t}">${t.replace('_',' ')}</button>`
                        ).join('')}
                    </div>
                </div>
                <!-- Уровень 3 — Платёжная система -->
                <div class="parser-filter-level">
                    <span class="parser-filter-level-label">СИСТЕМА</span>
                    <div class="parser-filter-level-btns">
                        ${['VISA','MASTERCARD','AMEX','DISCOVER','UNIONPAY','MIR'].map(t =>
                            `<button class="parser-level-btn${PARSER_STATE.filters.filterPaymentSystem === t ? ' active' : ''}" data-filter-network="${t}">${t}</button>`
                        ).join('')}
                    </div>
                </div>
                <!-- Кнопка сброса всех фильтров -->
                <button class="parser-filter-reset-btn" id="parser-filter-reset" title="Сбросить все фильтры">⟲ СБРОС</button>
            </div>
        </div>

        <!-- ACTION BAR -->
        <div class="pz-actions">
            <button class="pz-btn pz-btn-primary" id="parser-parse-btn" ${hasBase ? '' : 'disabled'}>⚡ PARSE & CLEAN</button>
            <button class="pz-btn pz-btn-dim" id="parser-clear-btn">CLEAR</button>
            <button class="pz-btn pz-btn-trash" id="parser-trash-btn">🗑 TRASH (${(STATE.trashCards || []).length})</button>
            <span class="parser-status" id="parser-status"></span>
        </div>

        <!-- STATS BAR (shown after parse) -->
        <div class="parser-stats-bar" id="parser-stats-bar" style="${hasParsed ? '' : 'display:none'}">
            <span class="ps-item">Parsed: <strong id="ps-total">0</strong></span>
            <span class="ps-item ps-trash">Trash: <strong id="ps-trash">0</strong></span>
            <span class="ps-item ps-compare">Old Base: <strong id="ps-compared">0</strong></span>
            <span class="ps-item ps-workspace">Workspace: <strong id="ps-workspace">0</strong></span>
            <span class="ps-item ps-dup">Dupes: <strong id="ps-dupes">0</strong></span>
            <span class="ps-item ps-net">→ Clean: <strong id="ps-net">0</strong></span>
        </div>

        <!-- STAGE 2: COMPARE (shown after parse) -->
        ${hasParsed ? `
        <div class="pz-stage pz-stage-2">
            <div class="pz-stage-header">
                <span class="pz-stage-num">2</span>
                <span class="pz-stage-title">COMPARE WITH OLD BASE</span>
                <span class="pz-stage-hint">Load your old database to remove already known cards</span>
            </div>
            <div class="pz-upload-single pz-upload-compare">
                <div class="pz-drop-zone pz-drop-compare" id="pz-compare-drop">
                    <input type="file" id="pz-compare-input" accept=".json" hidden>
                    <span class="pz-drop-text">${PARSER_STATE.compareFile ? '✅ ' + PARSER_STATE.compareFile.name : 'Drop old base for comparison'}</span>
                    <span class="pz-drop-hint">Removes matching cards from clean base</span>
                </div>
            </div>
            ${compareChipHtml ? `<div class="pz-chips">${compareChipHtml}</div>` : ''}
        </div>` : ''}

        <!-- RESULTS -->
        <div class="parser-results" id="parser-results"></div>
    </div>`;

    // ── BASE FILE UPLOAD ──
    const baseDrop = document.getElementById('pz-base-drop');
    const baseInput = document.getElementById('pz-base-input');
    const addBaseBtn = document.getElementById('pz-add-base');

    baseDrop.addEventListener('click', () => baseInput.click());
    baseDrop.addEventListener('dragover', (e) => { e.preventDefault(); baseDrop.classList.add('drag-over'); });
    baseDrop.addEventListener('dragleave', () => baseDrop.classList.remove('drag-over'));
    baseDrop.addEventListener('drop', (e) => { e.preventDefault(); baseDrop.classList.remove('drag-over'); if (e.dataTransfer.files.length) _loadBaseFile(e.dataTransfer.files[0]); });
    baseInput.addEventListener('change', () => { if (baseInput.files[0]) _loadBaseFile(baseInput.files[0]); });
    addBaseBtn.addEventListener('click', (e) => { e.stopPropagation(); baseInput.click(); });

    // Remove base file chips
    document.querySelectorAll('.pz-chip-remove[data-base-idx]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.baseIdx);
            PARSER_STATE.mainFiles.splice(idx, 1);
            _mergeBaseMessages();
            renderParser();
            toast('Base file removed', 'info');
        });
    });

    // ── COMPARE FILE UPLOAD (Stage 2) ──
    const compareDrop = document.getElementById('pz-compare-drop');
    const compareInput = document.getElementById('pz-compare-input');
    if (compareDrop && compareInput) {
        compareDrop.addEventListener('click', () => compareInput.click());
        compareDrop.addEventListener('dragover', (e) => { e.preventDefault(); compareDrop.classList.add('drag-over'); });
        compareDrop.addEventListener('dragleave', () => compareDrop.classList.remove('drag-over'));
        compareDrop.addEventListener('drop', (e) => { e.preventDefault(); compareDrop.classList.remove('drag-over'); if (e.dataTransfer.files.length) _loadCompareFile(e.dataTransfer.files[0]); });
        compareInput.addEventListener('change', () => { if (compareInput.files[0]) _loadCompareFile(compareInput.files[0]); });
    }

    // Remove compare chip
    document.getElementById('pz-compare-remove')?.addEventListener('click', (e) => {
        e.stopPropagation();
        _removeCompare();
    });

    // ── PARSE & CLEAN / CLEAR ──
    document.getElementById('parser-parse-btn').addEventListener('click', runParse);
    document.getElementById('parser-clear-btn').addEventListener('click', () => {
        PARSER_STATE.rawMessages = [];
        PARSER_STATE.mainFiles = [];
        PARSER_STATE.compareFile = null;
        PARSER_STATE.collected = [];
        PARSER_STATE._cleanCollected = [];
        PARSER_STATE.binGroups = [];
        PARSER_STATE.selected = new Set();
        PARSER_STATE.file = '';
        PARSER_STATE.binFilter = null;
        PARSER_STATE.sortBy = 'index';
        PARSER_STATE.statusFilter = 'ALL';
        PARSER_STATE._compareSet = null;
        PARSER_STATE._pipelineStats = null;
        localStorage.removeItem('ct_parser_base');
        renderParser();
        toast('Parser cleared', 'info');
    });

    // ── TRASH BUTTON ──
    document.getElementById('parser-trash-btn')?.addEventListener('click', () => {
        const overlay = document.getElementById('trash-cards-overlay');
        if (overlay) overlay.classList.remove('hidden');
    });

    // Многоуровневые фильтры: один выбор на уровень (переключение)
    document.querySelectorAll('.parser-level-btn[data-filter-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            const isActive = btn.classList.contains('active');
            document.querySelectorAll('.parser-level-btn[data-filter-type]').forEach(b => b.classList.remove('active'));
            if (!isActive) btn.classList.add('active');
            PARSER_STATE.filters.filterType = isActive ? null : btn.dataset.filterType;
        });
    });
    document.querySelectorAll('.parser-level-btn[data-filter-class]').forEach(btn => {
        btn.addEventListener('click', () => {
            const isActive = btn.classList.contains('active');
            document.querySelectorAll('.parser-level-btn[data-filter-class]').forEach(b => b.classList.remove('active'));
            if (!isActive) btn.classList.add('active');
            PARSER_STATE.filters.filterClass = isActive ? null : btn.dataset.filterClass;
        });
    });
    document.querySelectorAll('.parser-level-btn[data-filter-network]').forEach(btn => {
        btn.addEventListener('click', () => {
            const isActive = btn.classList.contains('active');
            document.querySelectorAll('.parser-level-btn[data-filter-network]').forEach(b => b.classList.remove('active'));
            if (!isActive) btn.classList.add('active');
            PARSER_STATE.filters.filterPaymentSystem = isActive ? null : btn.dataset.filterNetwork;
        });
    });
    // Кнопка сброса всех трёх уровней фильтров
    document.getElementById('parser-filter-reset')?.addEventListener('click', () => {
        PARSER_STATE.filters.filterType = null;
        PARSER_STATE.filters.filterClass = null;
        PARSER_STATE.filters.filterPaymentSystem = null;
        document.querySelectorAll('.parser-level-btn').forEach(b => b.classList.remove('active'));
        toast('Фильтры сброшены', 'info');
    });

    _initTrashCardModal();

    if (hasParsed) renderParserResults();
}

// ──── LOAD BASE FILE (supports multiple) ────
function _loadBaseFile(file) {
    if (!file) return;
    const status = document.getElementById('parser-status');
    if (status) status.textContent = '⏳ Reading...';

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const messages = Array.isArray(data) ? data : (data.messages || []);

            PARSER_STATE.mainFiles.push({
                name: file.name,
                size: file.size,
                messages: messages
            });
            PARSER_STATE.file = file.name;
            _mergeBaseMessages();

            toast(`Base loaded: ${file.name} (${messages.length.toLocaleString()} messages)`, 'success');
            renderParser();
        } catch (err) {
            if (status) status.textContent = '❌ Invalid JSON';
            toast('Error: invalid JSON file', 'error');
        }
    };
    reader.onerror = () => { if (status) status.textContent = '❌ Read error'; };
    reader.readAsText(file);
}

// Merge all base file messages into rawMessages
function _mergeBaseMessages() {
    // BUG #4 FIX: push instead of concat-in-loop to avoid O(n²)
    const all = [];
    PARSER_STATE.mainFiles.forEach(f => {
        for (let i = 0; i < f.messages.length; i++) all.push(f.messages[i]);
    });
    PARSER_STATE.rawMessages = all;
}

// ──── LOAD COMPARE FILE (Stage 2) ────
function _loadCompareFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const compareNumbers = extractAllCardNumbersFromJSON(data);

            PARSER_STATE.compareFile = {
                name: file.name,
                size: file.size,
                cardCount: compareNumbers.size
            };
            PARSER_STATE._compareSet = compareNumbers;

            // Apply compare to clean collected
            if (PARSER_STATE._cleanCollected.length > 0) {
                _applyCompare();
            } else {
                toast(`Compare base loaded: ${compareNumbers.size} card numbers`, 'success');
                renderParser();
            }
        } catch (err) {
            toast('Invalid compare file: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}

function _removeCompare() {
    PARSER_STATE.compareFile = null;
    PARSER_STATE._compareSet = null;
    // Re-run workspace+dedup from clean state
    if (PARSER_STATE._cleanCollected.length > 0) {
        if (PARSER_STATE._pipelineStats) PARSER_STATE._pipelineStats.compareRemoved = 0;
        _rerunFromClean();
    }
    renderParser();
    toast('Compare base removed', 'info');
}

function _applyCompare() {
    if (!PARSER_STATE._compareSet || PARSER_STATE._cleanCollected.length === 0) return;
    // Re-run full post-trash pipeline from clean state
    _rerunFromClean();
    _updateStatsBar();
    const removed = PARSER_STATE._pipelineStats ? PARSER_STATE._pipelineStats.compareRemoved : 0;
    toast(`Compared: ${removed} matches removed (${PARSER_STATE.collected.length} remaining)`, 'success');
    renderParser();
}

// Re-run pipeline from _cleanCollected (after trash): Compare → Workspace → Dedup
function _rerunFromClean() {
    let cards = [...PARSER_STATE._cleanCollected];
    // Compare
    let compareRemoved = 0;
    if (PARSER_STATE._compareSet && PARSER_STATE._compareSet.size > 0) {
        const before = cards.length;
        cards = cards.filter(c => !PARSER_STATE._compareSet.has((c.cc || '').replace(/[\s\-]/g, '')));
        compareRemoved = before - cards.length;
    }
    // Workspace exclusion — unified normalization (spaces + dashes)
    const existingNumbers = new Set(STATE.cards.map(c => c.cardNumber.replace(/[\s\-]/g, '')));
    const beforeWs = cards.length;
    cards = cards.filter(c => !existingNumbers.has((c.cc || '').replace(/[\s\-]/g, '')));
    const workspaceRemoved = beforeWs - cards.length;
    // Dedup — unified normalization
    const seen = new Set();
    const beforeDedup = cards.length;
    cards = cards.filter(c => { const cc = (c.cc || '').replace(/[\s\-]/g, ''); if (seen.has(cc)) return false; seen.add(cc); return true; });
    const dupRemoved = beforeDedup - cards.length;
    // BUG #6 FIX: Create _pipelineStats if null to prevent silent stat loss
    if (!PARSER_STATE._pipelineStats) {
        PARSER_STATE._pipelineStats = { totalRaw: PARSER_STATE._cleanCollected.length, trashRemoved: 0, compareRemoved: 0, workspaceRemoved: 0, dupRemoved: 0 };
    }
    PARSER_STATE._pipelineStats.compareRemoved = compareRemoved;
    PARSER_STATE._pipelineStats.workspaceRemoved = workspaceRemoved;
    PARSER_STATE._pipelineStats.dupRemoved = dupRemoved;
    PARSER_STATE.collected = cards;
    _rebuildBinGroups();
}

function _rebuildBinGroups() {
    const binMap = {};
    PARSER_STATE.collected.forEach(c => {
        if (!binMap[c.bin]) binMap[c.bin] = [];
        binMap[c.bin].push(c);
    });
    PARSER_STATE.binGroups = Object.entries(binMap)
        .map(([bin, cards]) => ({ bin, count: cards.length, cards }))
        .sort((a, b) => b.count - a.count);
    PARSER_STATE.selected = new Set(PARSER_STATE.collected.map((_, i) => i));
}

function _updateStatsBar() {
    const stats = PARSER_STATE._pipelineStats;
    if (!stats) return;
    const bar = document.getElementById('parser-stats-bar');
    if (bar) bar.style.display = 'flex';
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('ps-total', stats.totalRaw);
    el('ps-trash', stats.trashRemoved);
    el('ps-compared', stats.compareRemoved || 0);
    el('ps-workspace', stats.workspaceRemoved || 0);
    el('ps-dupes', stats.dupRemoved);
    el('ps-net', PARSER_STATE.collected.length);
}

// ──── TRASH CARD MODAL ────
function _initTrashCardModal() {
    const overlay = document.getElementById('trash-cards-overlay');
    const textarea = document.getElementById('trash-cards-textarea');
    const closeBtn = document.getElementById('trash-cards-close');
    const cancelBtn = document.getElementById('trash-cards-cancel');
    const saveBtn = document.getElementById('trash-cards-save');
    const detectedEl = document.getElementById('trash-cards-detected');

    if (!overlay || !textarea) return;

    const closeModal = () => { overlay.classList.add('hidden'); };
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    // Auto-detect on input (show DEAD / ALIVE / raw counts)
    const updateDetected = () => {
        const result = _extractTrashCards(textarea.value);
        if (result.hasMarkers) {
            detectedEl.textContent = `💀 ${result.deadCards.length} DEAD  ·  ✅ ${result.aliveCount} ALIVE ignored`;
        } else {
            detectedEl.textContent = `${result.deadCards.length} cards detected`;
        }
    };
    textarea.addEventListener('input', updateDetected);

    // TXT file upload (raw — appends text to textarea)
    const fileInput = document.getElementById('trash-cards-file');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                textarea.value = (textarea.value ? textarea.value + '\n' : '') + text;
                updateDetected();
                toast(`Loaded ${file.name}`, 'success');
            };
            reader.readAsText(file);
            fileInput.value = '';
        });
    }

    // 💀 Mini Parser — reads JSON like main parser, extracts cards → adds to trash
    const miniParserInput = document.getElementById('trash-mini-parser-file');
    if (miniParserInput) {
        miniParserInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    const cardNumbers = extractAllCardNumbersFromJSON(data); // returns Set

                    if (cardNumbers.size === 0) {
                        toast(`${file.name}: no cards found in JSON`, 'warning');
                        return;
                    }

                    const existingSet = new Set((STATE.trashCards || []).map(n => n.replace(/\s/g, '')));
                    let added = 0, dupes = 0;
                    cardNumbers.forEach(cc => {
                        if (!existingSet.has(cc)) {
                            STATE.trashCards.push(cc);
                            existingSet.add(cc);
                            added++;
                        } else {
                            dupes++;
                        }
                    });

                    save();

                    let msg = `${file.name}: +${added} trash cards`;
                    if (dupes > 0) msg += `, ${dupes} dupes skipped`;
                    msg += ` (${STATE.trashCards.length} total)`;
                    toast(msg, 'success');

                    // Update trash button count
                    const trashBtn = document.getElementById('parser-trash-btn');
                    if (trashBtn) trashBtn.textContent = `🗑 TRASH (${STATE.trashCards.length})`;

                    // Update detected display
                    detectedEl.textContent = `💀 +${added} from ${file.name} (${cardNumbers.size} parsed)`;
                } catch (err) {
                    toast(`${file.name}: invalid JSON — ${err.message}`, 'error');
                }
            };
            reader.readAsText(file);
            miniParserInput.value = '';
        });
    }

    // Save — APPEND only DEAD cards to existing trash, keep unique
    saveBtn?.addEventListener('click', () => {
        const result = _extractTrashCards(textarea.value);
        const deadCards = result.deadCards;
        if (deadCards.length === 0) {
            if (result.aliveCount > 0) {
                toast(`${result.aliveCount} ALIVE cards ignored — no DEAD cards to add`, 'info');
            } else {
                toast('No card numbers detected', 'warning');
            }
            return;
        }

        const existingSet = new Set((STATE.trashCards || []).map(n => n.replace(/\s/g, '')));
        let added = 0, dupes = 0;
        deadCards.forEach(n => {
            if (!existingSet.has(n)) {
                STATE.trashCards.push(n);
                existingSet.add(n);
                added++;
            } else {
                dupes++;
            }
        });

        save();
        closeModal();

        // Build detailed toast message
        let msg = `+${added} trash cards`;
        if (dupes > 0) msg += `, ${dupes} dupes skipped`;
        if (result.aliveCount > 0) msg += `, ${result.aliveCount} ALIVE ignored`;
        msg += ` (${STATE.trashCards.length} total)`;
        toast(msg, 'success');

        // Update trash button count
        const trashBtn = document.getElementById('parser-trash-btn');
        if (trashBtn) trashBtn.textContent = `🗑 TRASH (${STATE.trashCards.length})`;

        // BUG #5 FIX: Re-run pipeline after trash addition (not just re-render)
        if (PARSER_STATE.rawMessages.length > 0) {
            runParse();
        }
    });

    // 🗑 Clear All trash
    document.getElementById('trash-clear-all')?.addEventListener('click', () => {
        const count = (STATE.trashCards || []).length;
        if (count === 0) { toast('Trash is already empty', 'info'); return; }
        if (!confirm(`Clear all ${count} trash cards?`)) return;
        STATE.trashCards = [];
        save();
        toast(`Trash cleared (${count} cards removed)`, 'success');
        const trashBtn = document.getElementById('parser-trash-btn');
        if (trashBtn) trashBtn.textContent = `🗑 TRASH (0)`;
        detectedEl.textContent = '0 cards detected';
    });

    // 📋 Show List — open trash cards in new Notes tab
    document.getElementById('trash-show-list')?.addEventListener('click', () => {
        const cards = STATE.trashCards || [];
        if (cards.length === 0) { toast('Trash is empty', 'info'); return; }
        const block = cards.join('\n');
        const newTab = {
            id: 'tab-trash-' + Date.now(),
            title: 'Trash List (' + cards.length + ')',
            content: block,
            pinned: false,
            tag: null,
            created: Date.now(),
            scrollPos: 0
        };
        STATE.notesTabs.push(newTab);
        STATE.notesActiveTab = newTab.id;
        save();
        closeModal();
        // Switch to Notes tab
        document.querySelector('[data-view="notes"]')?.click();
        toast(`Trash list (${cards.length} cards) opened in Notes`, 'success');
    });
}

/**
 * Smart trash card extractor.
 * Parses checker output format: looks for DEAD/💀 and ALIVE/✅ markers.
 * If markers found: returns only DEAD card numbers.
 * If no markers: falls back to raw card number extraction (legacy behavior).
 */
function _extractTrashCards(text) {
    const lines = text.split(/\n/);
    const deadCards = [];
    let aliveCount = 0;
    let hasMarkers = false;
    const seen = new Set();

    // Extract card number from a line (supports multiple formats)
    function extractCC(line) {
        // Pipe format: 4537800314042786|01|29|874
        const pipeM = line.match(/(\d{13,19})\|/);
        if (pipeM) return pipeM[1];
        // Standalone digits: 4520880022987380 08 27 308
        const standalone = line.match(/(?:^|\s)(\d{13,19})(?:\s|$)/);
        if (standalone) return standalone[1];
        // Digits with spaces/dashes: 4242 4242 4242 4242
        const spaced = line.match(/(\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{3,4})/);
        if (spaced) return spaced[1].replace(/[\s\-]/g, '');
        // Fallback: any 13-19 digit sequence
        const fallback = line.match(/(\d{13,19})/);
        return fallback ? fallback[1] : null;
    }

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check for DEAD/ALIVE markers
        const isDead = /(?:💀|DEAD|dead|Dead|Declined|declined|DECLINED)/i.test(trimmed);
        const isAlive = /(?:✅|ALIVE|alive|Alive|Approved|approved|APPROVED)/i.test(trimmed);

        if (isDead || isAlive) {
            hasMarkers = true;
            const cc = extractCC(trimmed);
            if (cc && cc.length >= 13 && cc.length <= 19) {
                if (isDead && !seen.has(cc)) {
                    deadCards.push(cc);
                    seen.add(cc);
                }
                if (isAlive) aliveCount++;
            }
        }
    }

    // Fallback: if no DEAD/ALIVE markers found, extract all card numbers (legacy)
    if (!hasMarkers) {
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const cc = extractCC(trimmed);
            if (cc && cc.length >= 13 && cc.length <= 19 && !seen.has(cc)) {
                deadCards.push(cc);
                seen.add(cc);
            }
        }
    }

    return { deadCards, aliveCount, hasMarkers };
}

// _retagParserCards removed — workspace cards are now excluded in pipeline, no tagging needed

// Keep legacy alias
function loadParserFile(file) { _loadBaseFile(file); }

// ──── PARSE & CLEAN (unified) ────
function runParse() {
    if (!PARSER_STATE.rawMessages.length) return;
    const status = document.getElementById('parser-status');
    if (status) status.textContent = '⏳ Parsing...';

    // Read filters
    const binsEl = document.getElementById('parser-bins');
    const binRaw = binsEl ? binsEl.value.trim() : '';
    const binFilters = binRaw ? binRaw.split(/[\s,;|]+/).map(b => b.replace(/\D/g, '').slice(0, 6)).filter(b => b.length >= 4) : [];
    const countryEl = document.getElementById('parser-country');
    const countryFilter = countryEl ? countryEl.value.trim().toUpperCase() : '';
    const bankEl = document.getElementById('parser-bank');
    const bankFilter = bankEl ? bankEl.value.trim().toLowerCase() : '';
    const minExpEl = document.getElementById('parser-min-expiry');
    const minExpRaw = minExpEl ? minExpEl.value.trim() : '';

    // Чтение новых многоуровневых фильтров из состояния
    const filterType = PARSER_STATE.filters.filterType;
    const filterClass = PARSER_STATE.filters.filterClass;
    const filterPaymentSystem = PARSER_STATE.filters.filterPaymentSystem;
    // Совместимость: преобразуем в старый формат
    const activeTypes = filterType ? [filterType.toLowerCase()] : [];
    const activeNetworks = filterPaymentSystem ? [filterPaymentSystem] : [];
    PARSER_STATE.filters = { bins: binRaw, country: countryEl ? countryEl.value.trim() : '', bank: bankEl ? bankEl.value.trim() : '', minExpiry: minExpRaw, activeTypes, activeNetworks, filterType, filterClass, filterPaymentSystem };

    let allCards = extractCardsFromMessages(PARSER_STATE.rawMessages);
    allCards = allCards.map(c => ({ ...c, detectedGeo: detectGeo(c.billing, c.country, c.countryCode, c.bankCountryCode) }));

    // Apply filters
    if (binFilters.length > 0) allCards = allCards.filter(c => binFilters.some(bf => c.bin.startsWith(bf)));
    if (countryFilter) {
        const codes = countryFilter.split(/[\s,;]+/).map(s => s.toUpperCase().trim()).filter(Boolean);
        allCards = allCards.filter(c => {
            const geo = (c.detectedGeo || '').toUpperCase();
            // Also try name-to-code mapping as fallback
            const geoFromName = detectGeo('', c.country || '', c.countryCode || '', c.bankCountryCode || '');
            const resolvedGeo = geo || geoFromName.toUpperCase();
            return codes.some(code => resolvedGeo === code || resolvedGeo.startsWith(code));
        });
    }
    if (bankFilter) allCards = allCards.filter(c => (c.bank || '').toLowerCase().includes(bankFilter));

    // Min Expiry filter (MM/YY → keep cards >= this date)
    if (minExpRaw) {
        const expMatch = minExpRaw.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
        if (expMatch) {
            const minVal = parseInt(expMatch[2]) * 100 + parseInt(expMatch[1]);
            allCards = allCards.filter(c => {
                const cmm = parseInt(c.mm) || 0;
                const cyy = parseInt(c.yy) || 0;
                if (!cmm || !cyy) return true; // keep cards with no expiry data
                return (cyy * 100 + cmm) >= minVal;
            });
        }
    }

    // Многоуровневая фильтрация: Уровень 1 — Тип карты (CREDIT, DEBIT и т.д.)
    if (filterType) {
        allCards = allCards.filter(c => {
            const info = BIN_CACHE[c.bin];
            const ct = (info?.type || c.cardType || '').toUpperCase();
            return ct.includes(filterType);
        });
    }
    // Многоуровневая фильтрация: Уровень 2 — Класс карты (GOLD, PLATINUM и т.д.)
    if (filterClass) {
        allCards = allCards.filter(c => {
            const info = BIN_CACHE[c.bin];
            const level = (info?.level || '').toUpperCase().replace(/\s+/g, '_');
            return level.includes(filterClass) || level === filterClass;
        });
    }
    // Многоуровневая фильтрация: Уровень 3 — Платёжная система (VISA, MASTERCARD и т.д.)
    if (filterPaymentSystem) {
        allCards = allCards.filter(c => {
            const network = getCardType(c.cc || '');
            const brand = (BIN_CACHE[c.bin]?.brand || '').toUpperCase();
            return network === filterPaymentSystem || brand.includes(filterPaymentSystem);
        });
    }

    PARSER_STATE.binFilter = binFilters.length > 0 ? new Set(binFilters) : null;
    _processPipeline(allCards, status);
}

// ──── PIPELINE: Filters → Trash → OldBase → Workspace → Dedup ────
function _processPipeline(allCards, status) {
    const totalRaw = allCards.length;

    // Step 1: Remove TRASH cards
    // Unified normalization: remove spaces AND dashes for all comparisons
    const trashSet = new Set((STATE.trashCards || []).map(n => n.replace(/[\s\-]/g, '')));
    let trashRemoved = 0;
    if (trashSet.size > 0) {
        const before = allCards.length;
        allCards = allCards.filter(c => !trashSet.has((c.cc || '').replace(/[\s\-]/g, '')));
        trashRemoved = before - allCards.length;
    }

    // BUG #1 FIX: Save clean state AFTER trash but BEFORE compare
    // This allows _rerunFromClean() to correctly re-apply compare from scratch
    PARSER_STATE._cleanCollected = [...allCards];

    // Step 2: Remove Old Base / Compare matches
    let compareRemoved = 0;
    if (PARSER_STATE._compareSet && PARSER_STATE._compareSet.size > 0) {
        const beforeCompare = allCards.length;
        allCards = allCards.filter(c => !PARSER_STATE._compareSet.has((c.cc || '').replace(/[\s\-]/g, '')));
        compareRemoved = beforeCompare - allCards.length;
    }

    // Step 3: Remove Workspace / Project cards
    const existingNumbers = new Set(STATE.cards.map(c => c.cardNumber.replace(/[\s\-]/g, '')));
    const beforeWs = allCards.length;
    allCards = allCards.filter(c => !existingNumbers.has((c.cc || '').replace(/[\s\-]/g, '')));
    const workspaceRemoved = beforeWs - allCards.length;

    // Step 4: Remove internal duplicates
    const seen = new Set();
    const beforeDedup = allCards.length;
    allCards = allCards.filter(c => { const cc = (c.cc || '').replace(/[\s\-]/g, ''); if (seen.has(cc)) return false; seen.add(cc); return true; });
    const dupRemoved = beforeDedup - allCards.length;

    // Save stats
    PARSER_STATE._pipelineStats = { totalRaw, trashRemoved, compareRemoved, workspaceRemoved, dupRemoved };

    // Finish
    PARSER_STATE.collected = allCards;
    _rebuildBinGroups();

    if (status) status.textContent = `✅ ${allCards.length} cards ready`;
    toast(`Parsed: ${totalRaw} → clean: ${allCards.length} (trash: ${trashRemoved}, old base: ${compareRemoved}, workspace: ${workspaceRemoved}, dupes: ${dupRemoved})`, 'success');
    renderParser();
}

// ──── IMPORT TO NOTES (checker format) ────
function _buildExportTabTitle() {
    const filters = PARSER_STATE.filters || {};
    const parts = [];
    // Тип карты (новая система фильтрации)
    if (filters.filterType) {
        parts.push(filters.filterType);
    } else if (filters.activeTypes && filters.activeTypes.length > 0) {
        const typeNames = { credit: 'Credit Card', debit: 'Debit Card', prepaid: 'Prepaid' };
        parts.push(filters.activeTypes.map(t => typeNames[t] || t).join(', '));
    }
    // Класс карты
    if (filters.filterClass) {
        parts.push(filters.filterClass.replace('_', ' '));
    }
    // Платёжная система
    if (filters.filterPaymentSystem) {
        parts.push(filters.filterPaymentSystem);
    } else if (filters.activeNetworks && filters.activeNetworks.length > 0) {
        parts.push(filters.activeNetworks.join(', '));
    }
    // Country / GEO
    if (filters.country) {
        parts.push(filters.country.toUpperCase());
    }
    // BIN filter
    if (filters.bins) {
        const binList = filters.bins.split(/[\s,;|]+/).filter(Boolean).slice(0, 3);
        if (binList.length > 0) parts.push('BIN ' + binList.join(','));
    }
    // Bank filter
    if (filters.bank) {
        parts.push(filters.bank);
    }
    if (parts.length === 0) return 'Export ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return parts.join(' — ');
}

function importToProject() {
    const list = PARSER_STATE.collected;
    if (list.length === 0) { toast('No cards to import', 'warning'); return; }

    const lines = [];
    PARSER_STATE.selected.forEach(idx => {
        const c = list[idx];
        if (!c) return;
        const cc = (c.cc || '').replace(/\s/g, '');
        const mm = (c.mm || '').padStart(2, '0');
        const yy = c.yy || '';
        const cvv = c.cvv || '000';
        lines.push(`${cc} ${mm} ${yy} ${cvv}`);
    });

    if (lines.length === 0) { toast('No cards selected for import', 'warning'); return; }

    const block = lines.join('\n');
    // Build descriptive tab title from active filters
    const tabTitle = _buildExportTabTitle();
    // Always create a new Notes tab
    const newTab = {
        id: 'tab-parser-' + Date.now(),
        title: tabTitle,
        content: block,
        pinned: false,
        tag: null,
        created: Date.now(),
        scrollPos: 0
    };
    STATE.notesTabs.push(newTab);
    STATE.notesActiveTab = newTab.id;
    STATE.notes = (STATE.notes || '') + '\n' + block + '\n';
    STATE.notesLastSaved = Date.now();
    save();
    toast(`${lines.length} cards exported → "${tabTitle}"`, 'success');
}

// ──── RENDER RESULTS ────

function renderParserResults(geoFilter) {
    const el = document.getElementById('parser-results');
    if (!el) return;

    let list = PARSER_STATE.collected;
    if (list.length === 0) { el.innerHTML = '<div class="empty-state"><p>No cards found</p></div>'; return; }

    // Update stats bar
    _updateStatsBar();

    // GEO — use only the resolved ISO-2 code (detectedGeo)
    // c.country is a raw text name like "Canada" and must NOT be used directly as a code
    const geoMap = {};
    list.forEach(c => {
        const geo = (c.detectedGeo || '').toUpperCase();
        if (geo) geoMap[geo] = (geoMap[geo] || 0) + 1;
    });
    const geoList = Object.entries(geoMap).sort((a, b) => b[1] - a[1]);
    const countryFlags = { US: '🇺🇸', CA: '🇨🇦', GB: '🇬🇧', DE: '🇩🇪', FR: '🇫🇷', AE: '🇦🇪', AU: '🇦🇺', IT: '🇮🇹', ES: '🇪🇸', NL: '🇳🇱', BR: '🇧🇷', MX: '🇲🇽', JP: '🇯🇵', KR: '🇰🇷', IN: '🇮🇳', SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', CH: '🇨🇭', AT: '🇦🇹', BE: '🇧🇪', IE: '🇮🇪', PT: '🇵🇹', IL: '🇮🇱', SG: '🇸🇬', NZ: '🇳🇿', ZA: '🇿🇦', TR: '🇹🇷' };
    const countryNames = { US: 'United States', CA: 'Canada', GB: 'United Kingdom', DE: 'Germany', FR: 'France', AE: 'UAE', AU: 'Australia', IT: 'Italy', ES: 'Spain', NL: 'Netherlands', BR: 'Brazil', MX: 'Mexico', JP: 'Japan', KR: 'South Korea', IN: 'India', SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', CH: 'Switzerland', AT: 'Austria', BE: 'Belgium', IE: 'Ireland', PT: 'Portugal', IL: 'Israel', SG: 'Singapore', NZ: 'New Zealand', ZA: 'South Africa', TR: 'Turkey' };

    // Apply GEO filter — only match against detectedGeo (ISO-2 code)
    const activeGeo = geoFilter || '';
    let displayList = activeGeo ? list.filter(c => (c.detectedGeo || '').toUpperCase() === activeGeo) : list;

    // Sort
    const sortBy = PARSER_STATE.sortBy || 'index';
    const binCounts = {};
    displayList.forEach(c => { binCounts[c.bin] = (binCounts[c.bin] || 0) + 1; });
    let sortedDisplay = [...displayList];
    if (sortBy === 'bin-desc') sortedDisplay.sort((a, b) => (binCounts[b.bin] || 0) - (binCounts[a.bin] || 0));
    else if (sortBy === 'bin-asc') sortedDisplay.sort((a, b) => (binCounts[a.bin] || 0) - (binCounts[b.bin] || 0));

    // Summary
    const summaryHtml = `<div class="parser-summary">
        <span class="ps-item">Clean: <strong>${list.length}</strong></span>
    </div>`;

    // Import button
    const importHtml = `<div class="parser-action-bar">
        <button class="pz-btn pz-btn-import" id="parser-import-btn">📝 EXPORT TO NOTES (${list.length})</button>
    </div>`;

    // GEO dropdown
    const geoHtml = `<div class="parser-geo-filter"><label>GEO</label>
        <select id="parser-geo-select"><option value="">ALL (${list.length})</option>
        ${geoList.map(([code, cnt]) => `<option value="${code}" ${code === activeGeo ? 'selected' : ''}>${countryFlags[code] || '🏳️'} ${countryNames[code] || code} (${cnt})</option>`).join('')}
        </select></div>`;

    // BIN analytics (compact)
    const binAnalytics = {};
    displayList.forEach(c => { if (!binAnalytics[c.bin]) binAnalytics[c.bin] = { count: 0, bank: c.bank || '' }; binAnalytics[c.bin].count++; });
    const sortedBins = Object.entries(binAnalytics).map(([bin, d]) => ({ bin, count: d.count, bank: d.bank })).sort((a, b) => b.count - a.count);
    const binRows = sortedBins.slice(0, 30).map(b => `<div class="parser-bin-row"><span class="parser-bin-val">${b.bin}</span><span class="parser-bin-bank">${b.bank.length > 20 ? b.bank.slice(0, 20) + '…' : (b.bank || '—')}</span><span class="parser-bin-cnt">${b.count}</span></div>`).join('');

    // Table rows
    const binSortIcon = sortBy === 'bin-desc' ? '↓' : sortBy === 'bin-asc' ? '↑' : '↕';
    const rows = sortedDisplay.map(c => {
        const globalIdx = PARSER_STATE.collected.indexOf(c);
        // Use only the resolved ISO-2 code for GEO display
        const geoCode = (c.detectedGeo || '').toUpperCase();
        const geoFlag = countryFlags[geoCode] || '';
        const geoDisplay = geoCode ? `${geoFlag} ${geoCode}` : '—';
        const bankDisplay = c.bank ? (c.bank.length > 25 ? c.bank.slice(0, 25) + '…' : c.bank) : '—';
        return `<tr>
            <td class="pc-chk"><input type="checkbox" ${PARSER_STATE.selected.has(globalIdx) ? 'checked' : ''} data-idx="${globalIdx}" class="parser-check"></td>
            <td class="pc-holder">${c.name.toUpperCase()} ${c.surname.toUpperCase()}</td>
            <td class="pc-card">${formatCardBin(c.cc)}</td>
            <td class="pc-bank" title="${c.bank || ''}" style="font-size:10px;color:#9ca3af;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${bankDisplay}</td>
            <td class="pc-exp">${c.validity}</td>
            <td class="pc-bin">${c.bin}</td>
            <td class="pc-geo">${geoDisplay}</td>
        </tr>`;
    }).join('');

    el.innerHTML = `${summaryHtml}${importHtml}
        <div class="parser-toolbar">${geoHtml}
            <label class="parser-checkbox"><input type="checkbox" id="parser-select-all" ${PARSER_STATE.selected.size === displayList.length ? 'checked' : ''}> Select All (${PARSER_STATE.selected.size})</label>
        </div>
        <div class="parser-bin-analytics"><div class="parser-bin-analytics-header"><span>📊 BIN Analytics (${sortedBins.length})</span></div>
            <div class="parser-bin-analytics-grid"><div class="parser-bin-row parser-bin-header-row"><span class="parser-bin-val">BIN</span><span class="parser-bin-bank">BANK</span><span class="parser-bin-cnt">COUNT</span></div>${binRows}</div>
        </div>
        <div class="parser-table-wrap"><table class="data-table parser-table">
            <colgroup><col style="width:28px"><col style="width:16%"><col style="width:15%"><col style="width:16%"><col style="width:48px"><col style="width:10%"><col style="width:42px"></colgroup>
            <thead><tr><th></th><th>NAME</th><th>CARD</th><th>BANK</th><th>EXP</th><th class="parser-sort-th" id="parser-sort-bin" title="Sort by BIN">BIN ${binSortIcon}</th><th>GEO</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;

    // Events
    el.querySelectorAll('.parser-check').forEach(cb => {
        cb.addEventListener('change', () => { const idx = parseInt(cb.dataset.idx); if (cb.checked) PARSER_STATE.selected.add(idx); else PARSER_STATE.selected.delete(idx); });
    });

    document.getElementById('parser-select-all')?.addEventListener('change', (e) => {
        if (e.target.checked) sortedDisplay.forEach(c => PARSER_STATE.selected.add(PARSER_STATE.collected.indexOf(c)));
        else sortedDisplay.forEach(c => PARSER_STATE.selected.delete(PARSER_STATE.collected.indexOf(c)));
        el.querySelectorAll('.parser-check').forEach(cb => cb.checked = e.target.checked);
    });



    document.getElementById('parser-import-btn')?.addEventListener('click', importToProject);
    document.getElementById('parser-geo-select')?.addEventListener('change', (e) => renderParserResults(e.target.value));
    document.getElementById('parser-sort-bin')?.addEventListener('click', () => {
        PARSER_STATE.sortBy = PARSER_STATE.sortBy === 'bin-desc' ? 'bin-asc' : 'bin-desc';
        renderParserResults(activeGeo);
    });
}

function populateDateDropdowns() {
    const curYear = new Date().getFullYear();
    const minYear = 2026;
    const maxYear = curYear + 5;
    ['df', 'dt'].forEach(prefix => {
        const ySel = document.getElementById(`parser-${prefix}-year`);
        const mSel = document.getElementById(`parser-${prefix}-month`);
        if (!ySel || !mSel) return;
        for (let y = minYear; y <= maxYear; y++) {
            ySel.innerHTML += `<option value="${y}">${y}</option>`;
        }
        for (let m = 1; m <= 12; m++) {
            mSel.innerHTML += `<option value="${String(m).padStart(2, '0')}">${String(m).padStart(2, '0')}</option>`;
        }
    });
}

function getExpFromDropdowns(prefix) {
    const y = document.getElementById(`parser-${prefix}-year`)?.value;
    const m = document.getElementById(`parser-${prefix}-month`)?.value;
    if (!y) return 0;
    return parseInt(y) * 100 + parseInt(m || '01');
}

// ──── ADD TO READY TO WORK ────

function addCollectedToCards() {
    const targetCountry = document.getElementById('parser-target-country')?.value || STATE.currentCountry;
    const autoReplace = document.getElementById('parser-auto-replace')?.checked || false;
    const detectGeoFlag = true;
    const list = PARSER_STATE.collected;
    let added = 0, replaced = 0;
    const addedIndices = new Set();

    const existingNumbers = new Map();
    STATE.cards.forEach(c => { existingNumbers.set(c.cardNumber.replace(/\s/g, ''), c); });

    PARSER_STATE.selected.forEach(idx => {
        const c = list[idx];
        if (!c) return;
        const existing = existingNumbers.get(c.cc);

        if (existing) {
            if (autoReplace) {
                existing.cardNumber = c.cc;
                if (c.cvv) existing.cvv = c.cvv;
                if (c.name) existing.name = c.name;
                if (c.surname) existing.surname = c.surname;
                replaced++;
            }
            addedIndices.add(idx);
            return;
        }

        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getFullYear()).slice(2)}`;
        const geo = detectGeoFlag ? (c.detectedGeo || targetCountry) : targetCountry;

        STATE.cards.push({
            id: crypto.randomUUID(),
            name: c.name || 'UNKNOWN',
            surname: c.surname || '',
            cardNumber: c.cc,
            month: c.mm || '',
            year: c.yy || '',
            cvv: c.cvv || '',
            country: geo,
            cardType: c.cardType || getCardType(c.cc),
            docType: '',
            amount: '',
            notes: '',
            date: dateStr,
            cardAdd: false,
            runAds: false,
            verified: false,
            starred: false,
            mailVerify: false,
            mailSubmit: false,
            mailNone: false,
            readyToWork: true
        });
        existingNumbers.set(c.cc, STATE.cards[STATE.cards.length - 1]);
        ensureDoc(STATE.cards[STATE.cards.length - 1]);
        addedIndices.add(idx);
        added++;
    });

    if (added > 0 || replaced > 0) {
        // Remove processed cards from parser results
        PARSER_STATE.collected = PARSER_STATE.collected.filter((_, i) => !addedIndices.has(i));
        // Rebuild bin groups
        const binMap = {};
        PARSER_STATE.collected.forEach(c => { if (!binMap[c.bin]) binMap[c.bin] = []; binMap[c.bin].push(c); });
        PARSER_STATE.binGroups = Object.entries(binMap)
            .map(([bin, cards]) => ({ bin, count: cards.length, cards }))
            .sort((a, b) => b.count - a.count);
        PARSER_STATE.selected = new Set(PARSER_STATE.collected.map((_, i) => i));

        save();
        renderSidebar();
        let msg = `✅ ${added} cards → Ready to Work`;
        if (replaced > 0) msg += `, ${replaced} updated`;
        toast(msg, 'success');
        renderParserResults();
    } else {
        toast('No new cards to add (all duplicates)', 'info');
    }
}
// ──── VIEW DENSITY SYSTEM ────
(function initDensity() {
    const app = document.querySelector('.app');
    const saved = localStorage.getItem('ct_density') || 'default';
    applyDensity(saved);

    document.getElementById('density-switcher').addEventListener('click', (e) => {
        const btn = e.target.closest('.density-btn');
        if (!btn) return;
        const density = btn.dataset.density;
        applyDensity(density);
        localStorage.setItem('ct_density', density);
    });

    function applyDensity(density) {
        app.classList.remove('density-compact', 'density-comfortable');
        if (density === 'compact') app.classList.add('density-compact');
        if (density === 'comfortable') app.classList.add('density-comfortable');

        document.querySelectorAll('.density-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.density === density);
        });
    }

    /* ═══════════════════════════════════════════
       NOTES HELPER FUNCTIONS
       ═══════════════════════════════════════════ */
    function saveNotesAction() {
        const textarea = document.getElementById('notes-textarea');
        if (!textarea) return;
        STATE.notes = textarea.value;
        STATE.notesLastSaved = new Date().toISOString();
        save();
        toast('Notes saved', 'success');
        const savedInfo = document.querySelector('.notes-saved-info');
        if (savedInfo) savedInfo.textContent = 'Saved ' + new Date().toLocaleTimeString();
    }

    function changeNotesFontSize(delta) {
        STATE.notesFontSize = Math.max(10, Math.min(24, (STATE.notesFontSize || 14) + delta));
        const textarea = document.getElementById('notes-textarea');
        if (textarea) textarea.style.fontSize = STATE.notesFontSize + 'px';
        const display = document.getElementById('notes-font-size-display');
        if (display) display.textContent = STATE.notesFontSize;
        save();
    }

    function importNotesAction() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.csv,.text';
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const textarea = document.getElementById('notes-textarea');
                if (textarea) {
                    textarea.value += (textarea.value ? '\n' : '') + ev.target.result;
                    textarea.dispatchEvent(new Event('input'));
                }
                toast('Imported: ' + file.name, 'success');
            };
            reader.readAsText(file);
        });
        input.click();
    }

    function exportNotesAction() {
        const textarea = document.getElementById('notes-textarea');
        if (!textarea || !textarea.value.trim()) {
            toast('Notes are empty', 'error');
            return;
        }
        const blob = new Blob([textarea.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'notes_' + new Date().toISOString().slice(0, 10) + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        toast('Notes exported', 'success');
    }

    /* ═══════════════════════════════════════════
       FORMAT SELECTION (ADD TO NOTES from Parser)
       ═══════════════════════════════════════════ */
    function addCollectedToNotes(cards) {
        if (!cards || !cards.length) {
            toast('No cards to add', 'error');
            return;
        }
        // Show format selection modal
        const overlay = document.getElementById('format-modal-overlay');
        overlay.classList.remove('hidden');

        const closeModal = () => overlay.classList.add('hidden');
        document.getElementById('format-modal-close').onclick = closeModal;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); }, { once: true });

        overlay.querySelectorAll('.format-option-btn').forEach(btn => {
            btn.onclick = () => {
                const format = btn.dataset.format;
                let lines = [];

                cards.forEach(c => {
                    const num = (c.number || c.cardNumber || '').replace(/\s/g, '');
                    const expM = (c.expMonth || c.exp_month || '').toString().padStart(2, '0');
                    const expY = (c.expYear || c.exp_year || '').toString().slice(-2);
                    const cvv = c.cvv || c.cvc || '';
                    const holder = c.holder || c.name || '';
                    const bank = c.bank || '';
                    const type = c.type || c.cardType || '';

                    if (format === 'full') {
                        lines.push(`💳 CC: ${num}`);
                        lines.push(`📅 Validity: ${expM}/${expY}`);
                        lines.push(`🔐 CVV: ${cvv}`);
                        lines.push(`👶 Holder: ${holder}`);
                        lines.push(`🏦 Bank: ${bank}`);
                        lines.push(`📊 Card Type: ${type}`);
                        lines.push('');
                    } else if (format === 'checker') {
                        lines.push(`${num} ${expM} ${expY} ${cvv}`);
                    } else if (format === 'raw') {
                        lines.push(`${num}|${expM}|${expY}|${cvv}`);
                    }
                });

                // Append to active notes tab
                const activeTab = _getActiveNoteTab();
                if (activeTab) {
                    activeTab.content = (activeTab.content || '') + (activeTab.content ? '\n' : '') + lines.join('\n');
                }
                STATE.notes = (STATE.notes || '') + (STATE.notes ? '\n' : '') + lines.join('\n');
                STATE.notesLastSaved = Date.now();
                save();
                closeModal();
                toast(`Added ${cards.length} cards to Notes (${format})`, 'success');
            };
        });
    }

    /* ═══════════════════════════════════════════
       VIPER CHECKER API INTEGRATION
       ═══════════════════════════════════════════ */
    const PROXY_BASE = 'http://localhost:3777';

    async function viperRequest(path, method = 'GET', body = null) {
        const token = document.getElementById('checker-token')?.value || localStorage.getItem('viper_token') || '';
        if (!token) throw new Error('No API token set');
        const opts = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(PROXY_BASE + path, opts);
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.Error || `HTTP ${res.status}`);
        }
        return data;
    }

    // Normalize any card line to CCN|MM|YY|CVV format
    function normalizeCardLine(line) {
        const cleaned = line.trim();
        if (!cleaned) return null;
        // Match: 13-19 digit card, then month (1-12), then year (2 or 4 digit), then CVV (3-4 digit)
        // Separators can be any non-alphanumeric char(s)
        const m = cleaned.match(/(\d[\d\s\-]{11,22}\d)\D+(0?[1-9]|1[012])\D+(\d{2}|\d{4})\D+(\d{3,4})/);
        if (!m) return null;
        const ccn = m[1].replace(/[\s\-]/g, '');
        if (ccn.length < 13 || ccn.length > 19) return null;
        const mm = m[2].padStart(2, '0');
        let yy = m[3];
        if (yy.length === 4) yy = yy.slice(2); // 2029 → 29
        const cvv = m[4];
        return `${ccn}|${mm}|${yy}|${cvv}`;
    }

    function openChecker() {
        const overlay = document.getElementById('checker-overlay');
        overlay.classList.remove('hidden');

        // Restore saved token
        const savedToken = localStorage.getItem('viper_token') || '';
        const tokenInput = document.getElementById('checker-token');
        if (savedToken && tokenInput) tokenInput.value = savedToken;

        // Auto-load selected cards (or all current workspace cards)
        const inputArea = document.getElementById('checker-input');
        if (inputArea && !inputArea.value.trim()) {
            const cards = getFilteredCards();
            const checkerLines = cards
                .filter(c => c.cardNumber && (c.month || c.mm) && c.cvv)
                .map(c => {
                    const mm = (c.month || c.mm || '').padStart(2, '0');
                    const yy = c.year || c.yy || '';
                    return `${c.cardNumber}|${mm}|${yy}|${c.cvv}`;
                });
            if (checkerLines.length) {
                inputArea.value = checkerLines.join('\n');
                updateCheckerInputCount();
            }
        }

        // Bind events
        document.getElementById('checker-close').onclick = closeChecker;
        overlay.onclick = (e) => { if (e.target === overlay) closeChecker(); };
        document.getElementById('checker-balance-btn').onclick = fetchBalance;
        document.getElementById('checker-load-methods').onclick = loadCheckMethods;
        document.getElementById('checker-check-btn').onclick = checkCards;
        document.getElementById('checker-copy-results').onclick = copyResults;
        if (inputArea) inputArea.oninput = updateCheckerInputCount;

        // Save token on change
        if (tokenInput) tokenInput.oninput = () => {
            localStorage.setItem('viper_token', tokenInput.value);
        };
    }

    function closeChecker() {
        document.getElementById('checker-overlay').classList.add('hidden');
    }

    function updateCheckerInputCount() {
        const input = document.getElementById('checker-input');
        const count = document.getElementById('checker-input-count');
        if (!input || !count) return;
        const lines = input.value.trim().split('\n').filter(l => l.trim());
        const valid = lines.filter(l => normalizeCardLine(l)).length;
        count.textContent = valid + '/' + lines.length + ' valid';
        count.style.color = valid === lines.length ? '#22C55E' : '#F59E0B';
    }

    async function fetchBalance() {
        const display = document.getElementById('checker-balance-display');
        try {
            display.textContent = '...';
            display.style.color = '#A1A1AA';
            const data = await viperRequest('/profile/balance', 'POST');
            display.textContent = '💰 ' + data.balance + ' checks';
            display.style.color = '#22C55E';
        } catch (e) {
            display.textContent = '❌ ' + e.message;
            display.style.color = '#EF4444';
        }
    }

    async function loadCheckMethods() {
        const select = document.getElementById('checker-method');
        try {
            const data = await viperRequest('/check/available', 'GET');
            select.innerHTML = '';
            (data.result || []).forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.code;
                opt.textContent = m.code + ' — ' + m.description;
                select.appendChild(opt);
            });
            toast('Loaded ' + (data.result || []).length + ' methods', 'success');
        } catch (e) {
            toast('Failed to load methods: ' + e.message, 'error');
        }
    }

    async function checkCards() {
        const input = document.getElementById('checker-input');
        const output = document.getElementById('checker-output');
        const status = document.getElementById('checker-status');
        const checkBtn = document.getElementById('checker-check-btn');

        const rawLines = (input?.value || '').trim().split('\n').filter(l => l.trim());
        if (!rawLines.length) {
            toast('No cards to check', 'error');
            return;
        }

        // Normalize ALL lines to CCN|MM|YY|CVV
        const normalized = [];
        const invalid = [];
        rawLines.forEach(line => {
            const n = normalizeCardLine(line);
            if (n) normalized.push(n);
            else invalid.push(line.trim());
        });

        if (!normalized.length) {
            toast('No valid cards found. Format: CCN MM YY CVV', 'error');
            return;
        }

        const method = document.getElementById('checker-method')?.value || 'AUTH';

        // Update UI
        status.textContent = 'CHECKING...';
        status.className = 'checker-status-badge checking';
        checkBtn.disabled = true;
        output.textContent = `Sending ${normalized.length} cards to Viper API...`;
        if (invalid.length) {
            output.textContent += `\n⚠️ ${invalid.length} line(s) skipped (invalid format)`;
        }

        try {
            // Send check v2
            const checkData = await viperRequest('/check/v2', 'POST', {
                data: normalized,
                check_type: method
            });

            const purchaseId = checkData.purchase_id;

            // Show invalid items immediately (cards that API rejected)
            let results = [];
            if (checkData.invalid_items && checkData.invalid_items.length) {
                results = [...checkData.invalid_items];
                output.textContent = formatCheckerResults(results) + '\n\n⏳ Polling for remaining results...';
            } else if (purchaseId) {
                output.textContent = '⏳ Waiting for results (purchase: ' + purchaseId + ')...';
            }

            if (!purchaseId) {
                // No purchase ID — results should be immediate (v1 fallback or error)
                status.textContent = 'DONE';
                status.className = 'checker-status-badge done';
                checkBtn.disabled = false;
                if (results.length) output.textContent = formatCheckerResults(results);
                return;
            }

            // Poll for results
            let attempts = 0;
            const maxAttempts = 60; // 5 min max
            const pollInterval = 5000; // 5 sec

            const poll = async () => {
                attempts++;
                try {
                    const pollData = await viperRequest('/check/poll/' + purchaseId, 'GET');

                    // Replace results (not accumulate) — poll returns full result set
                    if (pollData.result && pollData.result.length) {
                        results = [...(checkData.invalid_items || []), ...pollData.result];
                    }

                    if (pollData.status === 'confirmed' || attempts >= maxAttempts) {
                        // Done
                        status.textContent = 'DONE';
                        status.className = 'checker-status-badge done';
                        checkBtn.disabled = false;
                        output.textContent = formatCheckerResults(results);
                        if (attempts >= maxAttempts && pollData.status !== 'confirmed') {
                            output.textContent += '\n\n⚠️ Timed out waiting for some results';
                        }
                        return;
                    }

                    // Still pending
                    output.textContent = formatCheckerResults(results) + '\n\n⏳ Polling... (' + attempts + '/' + maxAttempts + ')';
                    setTimeout(poll, pollInterval);
                } catch (e) {
                    status.textContent = 'ERROR';
                    status.className = 'checker-status-badge error';
                    checkBtn.disabled = false;
                    output.textContent += '\n\n❌ Poll error: ' + e.message;
                }
            };

            setTimeout(poll, pollInterval);

        } catch (e) {
            status.textContent = 'ERROR';
            status.className = 'checker-status-badge error';
            checkBtn.disabled = false;
            output.textContent = '❌ Error: ' + e.message;
        }
    }

    function formatCheckerResults(results) {
        if (!results.length) return 'No results yet...';

        const alive = results.filter(r => (r.status || '').toUpperCase() === 'ALIVE').length;
        const dead = results.filter(r => (r.status || '').toUpperCase() === 'DEAD').length;
        const other = results.length - alive - dead;

        let header = `═══ Results: ${results.length} total | ✅ ${alive} ALIVE | 💀 ${dead} DEAD`;
        if (other) header += ` | ⚠️ ${other} other`;
        header += ' ═══\n\n';

        return header + results.map(r => {
            const isAlive = (r.status || '').toUpperCase() === 'ALIVE';
            const isDead = (r.status || '').toUpperCase() === 'DEAD';
            const icon = isAlive ? '✅' : isDead ? '💀' : '⚠️';
            const statusText = (r.status || 'UNKNOWN').toUpperCase();

            let line = `${icon} ${r.card} — ${statusText}`;
            const details = [];
            if (r.details) details.push(r.details);
            if (r.brand) details.push(r.brand);
            if (r.type) details.push(r.type);
            if (r.level) details.push(r.level);
            if (r.country) details.push(r.country);

            if (details.length) {
                line += ' [' + details.join(' • ') + ']';
            }
            return line;
        }).join('\n');
    }

    function copyResults() {
        const output = document.getElementById('checker-output');
        if (!output) return;
        navigator.clipboard.writeText(output.textContent).then(() => {
            toast('Results copied', 'success');
        }).catch(() => {
            const range = document.createRange();
            range.selectNodeContents(output);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('copy');
            sel.removeAllRanges();
            toast('Results copied', 'success');
        });
    }


    // Expose openChecker globally for parser
    window.openChecker = openChecker;

})();

// ═══════ COLUMN RESIZE UTILITY ═══════
function initColumnResize(table, storageKey) {
    if (!table) return;
    const ths = table.querySelectorAll('thead th');
    if (ths.length === 0) return;

    const key = 'ct_colwidths_' + (storageKey || 'default');

    // Restore saved widths
    try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved && Array.isArray(saved)) {
            ths.forEach((th, i) => {
                if (saved[i]) th.style.width = saved[i] + 'px';
            });
        }
    } catch { }

    // Add resize handles
    ths.forEach((th, i) => {
        if (th.querySelector('.col-resize-handle')) return; // already has one
        const handle = document.createElement('div');
        handle.className = 'col-resize-handle';

        let startX, startWidth;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startX = e.pageX;
            startWidth = th.offsetWidth;
            handle.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            const onMove = (ev) => {
                const diff = ev.pageX - startX;
                const newWidth = Math.max(60, startWidth + diff);
                th.style.width = newWidth + 'px';
            };

            const onUp = () => {
                handle.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);

                // Save widths
                const widths = Array.from(ths).map(t => t.offsetWidth);
                localStorage.setItem(key, JSON.stringify(widths));
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        th.appendChild(handle);
    });
}

