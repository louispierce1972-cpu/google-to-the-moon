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
    trashCards: [],
    bookmarks: [],
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
        localStorage.setItem('activeNoteTab', STATE.notesActiveTab);
        localStorage.setItem('ct_notes', STATE.notes);
        localStorage.setItem('ct_trash', JSON.stringify(STATE.trash));
        localStorage.setItem('ct_countries', JSON.stringify(STATE.countries));
        localStorage.setItem('ct_settings', JSON.stringify(STATE.settings || {}));

        localStorage.setItem('ct_trash_cards', JSON.stringify(STATE.trashCards || []));
        localStorage.setItem('ct_bookmarks', JSON.stringify(STATE.bookmarks || []));
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
        // Load parserFilters
        const parserFiltersRaw = localStorage.getItem('parserFilters');
        if (parserFiltersRaw) {
            try {
                const pf = JSON.parse(parserFiltersRaw);
                PARSER_STATE.filters.bins = pf.bins || '';
                PARSER_STATE.filters.country = pf.country || '';
                PARSER_STATE.filters.bank = pf.bank || '';
                PARSER_STATE.filters.minExpiry = pf.minExpiry || '';
                PARSER_STATE.filters.activeTypes = pf.types || [];
                PARSER_STATE.filters.activeNetworks = pf.networks || [];
                PARSER_STATE.filters.filterTypes = new Set(pf.types || []);
                PARSER_STATE.filters.filterClasses = new Set(pf.classes || []);
                PARSER_STATE.filters.filterPaymentSystems = new Set(pf.networks || []);
            } catch (e) { }
        }
        // Load notesTabs
        const tabsRaw = localStorage.getItem('ct_notes_tabs');
        if (tabsRaw) {
            STATE.notesTabs = JSON.parse(tabsRaw);
            STATE.notesActiveTab = localStorage.getItem('activeNoteTab') || localStorage.getItem('ct_notes_active') || (STATE.notesTabs[0]?.id || '');
        }
        // Load bookmarks
        const bookmarksRaw = localStorage.getItem('ct_bookmarks');
        if (bookmarksRaw) STATE.bookmarks = JSON.parse(bookmarksRaw);
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

// (translated)
// When deleting card from Workspace, remove its id from doc.cardIds
function removeCardFromDocs(cardId) {
    STATE.docs.forEach(doc => {
        if (!doc.cardIds) return;
        const idx = doc.cardIds.indexOf(cardId);
        if (idx >= 0) {
            doc.cardIds.splice(idx, 1);
        }
    });
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
            // Exclude standaloneCard — only in All Cards, not Workspace
            cards = STATE.cards.filter(c => c.country === STATE.currentCountry && !c.standaloneCard);
            break;
        case 'my-card':
            cards = STATE.cards.filter(c => !c.standaloneCard);
            if (_geoFilter !== 'all') cards = cards.filter(c => c.country === _geoFilter);
            break;
        case 'favorites':
            cards = STATE.cards.filter(c => isFavorite(c) && !c.standaloneCard);
            break;
        case 'active-now':
            cards = STATE.cards.filter(c => isActiveNow(c) && !c.standaloneCard);
            break;
        case 'ready-to-work':
            cards = STATE.cards.filter(c => c.readyToWork === true && !c.standaloneCard);
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
            // Exclude standaloneCard — only in All Cards, not Workspace
            cards = STATE.cards.filter(c => c.country === STATE.currentCountry && !c.standaloneCard);
    }

    // Build usage maps for badges (Workspace indicators)
    if (!['all-cards', 'trash'].includes(STATE.currentView)) {
        const cardUsageMap = {};
        const nameUsageMap = {};
        STATE.cards.forEach(c => {
            const num = c.cardNumber.replace(/\s/g, '');
            cardUsageMap[num] = (cardUsageMap[num] || 0) + 1;
            // (translated)
            const fullName = (c.name + ' ' + c.surname).trim().toUpperCase();
            if (fullName) nameUsageMap[fullName] = (nameUsageMap[fullName] || 0) + 1;
        });
        cards.forEach(c => {
            const num = c.cardNumber.replace(/\s/g, '');
            c._cardUsage = cardUsageMap[num] || 1;
            const fullName = (c.name + ' ' + c.surname).trim().toUpperCase();
            c._nameUsage = (fullName ? nameUsageMap[fullName] : 0) || 1;
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
        cardAdd: cards.filter(c => c.cardAdd).length,
        runAds: cards.filter(c => c.runAds).length,
        verified: cards.filter(c => c.verified).length,
        docReady: cards.filter(c => c.docReady).length,
        waterBill: cards.filter(c => c.waterBill).length,
        minic: cards.filter(c => c.minic).length,
    };
}

function getMyCardStats() {
    // Exclude standaloneCard — not displayed in Workspace
    const all = STATE.cards.filter(c => !c.standaloneCard);
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
    // (translated)
    const totalV = docs.reduce((sum, d) => sum + (d.verified || 0), 0);
    const totalS = docs.reduce((sum, d) => sum + (d.suspended || 0), 0);
    // (translated)
    const waiting = docs.filter(d => (d.verified || 0) === 0 && (d.suspended || 0) === 0).length;
    return {
        total: docs.length,
        verified: totalV,
        failed: totalS,
        waiting: waiting,
    };
}

// (translated)
// (translated)
function updateDocStats() {
    const bar = document.getElementById('stats-bar');
    if (!bar) return;
    if (STATE.currentView !== 'docs' && STATE.currentView !== 'global-docs') return;
    const docs = getFilteredDocs();
    const s = getDocStats(docs);
    const statCards = bar.querySelectorAll('.stat-card');
    if (statCards.length >= 4) {
        statCards[0].querySelector('.stat-value').textContent = s.total;
        statCards[1].querySelector('.stat-value').textContent = s.verified;
        statCards[2].querySelector('.stat-value').textContent = s.failed;
        statCards[3].querySelector('.stat-value').textContent = s.waiting;
    }
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
    // Country delete button
    const delBtn = document.getElementById('tn-country-del');
    if (delBtn) delBtn.onclick = () => _confirmDeleteCountry(STATE.currentCountry);
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

    if (['notes', 'builder', 'analytics', 'checker', 'bookmarks'].includes(STATE.currentView)) {
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
        // (translated)
        const uniqueBins = new Set(cards.map(c => getBin(c.cardNumber))).size;
        // Cards only in All Cards (not Workspace)
        const standaloneCount = STATE.cards.filter(c => c.standaloneCard).length;
        const standaloneStatHtml = standaloneCount > 0
            ? `<div class="stat-card minic"><span class="stat-label">Cards Only</span><span class="stat-value">${standaloneCount}</span></div>`
            : '';
        bar.innerHTML = `
            <div class="stat-card total"><span class="stat-label">Cards</span><span class="stat-value">${cards.length}</span></div>
            <div class="stat-card card-add"><span class="stat-label">Use</span><span class="stat-value">${totalUse}</span></div>
            <div class="stat-card run-ads"><span class="stat-label">Avg</span><span class="stat-value">${avgUse}</span></div>
            <div class="stat-card top-bins"><span class="stat-label">BINs</span><span class="stat-value">${uniqueBins}</span></div>
            ${standaloneStatHtml}
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

    // (translated)
    if (STATE.currentView === 'trash') {
        const trashDeleted = (STATE.trash || []).length;
        const trashParser = (STATE.trashCards || []).length;
        const trashTotal = trashDeleted + trashParser;
        bar.innerHTML = `
            <div class="stat-card total"><span class="stat-label">Total Trash</span><span class="stat-value">${trashTotal}</span></div>
            <div class="stat-card suspended"><span class="stat-label">Deleted Cards</span><span class="stat-value">${trashDeleted}</span></div>
            <div class="stat-card run-ads"><span class="stat-label">Parser Trash</span><span class="stat-value">${trashParser}</span></div>
            <div class="stat-card active-stat check-base-card" id="check-base-open" style="cursor:pointer">
                <span class="stat-label">Check Base</span>
                <span class="stat-value" style="font-size:18px">🔍</span>
            </div>
        `;
        // (translated)
        document.getElementById('check-base-open')?.addEventListener('click', _openCheckBase);
        return;
    }

    // Cards view (country / favorites / active / trash)
    const cards = getFilteredCards();
    const s = getCardStats(cards);
    // (translated)
    const copyBtn = (filter) => `<button class="stat-copy-btn" data-copy-filter="${filter}" title="Copy cards to clipboard">📋</button>`;
    bar.innerHTML = `
        <div class="stat-card total"><span class="stat-label">Total</span><span class="stat-value">${s.total}</span>${copyBtn('total')}</div>
        <div class="stat-card card-add"><span class="stat-label">A</span><span class="stat-value">${s.cardAdd}</span>${copyBtn('cardAdd')}</div>
        <div class="stat-card run-ads"><span class="stat-label">R</span><span class="stat-value">${s.runAds}</span>${copyBtn('runAds')}</div>
        <div class="stat-card verified"><span class="stat-label">V</span><span class="stat-value">${s.verified}</span>${copyBtn('verified')}</div>
        <div class="stat-card doc-status"><span class="stat-label">D</span><span class="stat-value">${s.docReady}</span>${copyBtn('docReady')}</div>
        <div class="stat-card water-bill"><span class="stat-label">W</span><span class="stat-value">${s.waterBill}</span>${copyBtn('waterBill')}</div>
        <div class="stat-card minic"><span class="stat-label">M</span><span class="stat-value">${s.minic}</span>${copyBtn('minic')}</div>
    `;

    // (translated)
    bar.querySelectorAll('.stat-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _copyStatCards(btn.dataset.copyFilter, cards);
        });
    });
}

// ══════════════════════════════════════
// (translated)
// Format: NUMBER MM YY CVV
// ══════════════════════════════════════
function _copyStatCards(filter, cards) {
    // (translated)
    let filtered = [];
    switch (filter) {
        case 'total':
            filtered = cards;
            break;
        case 'cardAdd':
            filtered = cards.filter(c => c.cardAdd);
            break;
        case 'runAds':
            filtered = cards.filter(c => c.runAds);
            break;
        case 'verified':
            filtered = cards.filter(c => c.verified);
            break;
        case 'docReady':
            filtered = cards.filter(c => c.docReady);
            break;
        case 'waterBill':
            filtered = cards.filter(c => c.waterBill);
            break;
        case 'minic':
            filtered = cards.filter(c => c.minic);
            break;
        default:
            filtered = cards;
    }

    if (filtered.length === 0) {
        toast('No cards to copy', 'info');
        return;
    }

    // Build lines: number MM YY CVV
    const lines = filtered.map(c => {
        const num = (c.cardNumber || '').replace(/[\s\-]/g, '');
        const mm = (c.month || c.mm || '').toString().padStart(2, '0');
        const yy = (c.year || c.yy || '').toString().padStart(2, '0');
        const cvv = c.cvv || '';
        return `${num} ${mm} ${yy} ${cvv}`;
    }).join('\n');

    // (translated)
    navigator.clipboard.writeText(lines).then(() => {
        toast(`Copied ${filtered.length} cards`, 'success');
    }).catch(() => {
        // (translated)
        const ta = document.createElement('textarea');
        ta.value = lines;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast(`Copied ${filtered.length} cards`, 'success');
    });
}


// ══════════════════════════════════════
// (translated)
// (translated)
// ══════════════════════════════════════

// (translated)
let _checkBaseResults = { clean: [], trash: [] };

// (translated)
function _openCheckBase() {
    const overlay = document.getElementById('check-base-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    // Clear previous results
    const input = document.getElementById('check-base-input');
    if (input) input.value = '';
    const results = document.getElementById('check-base-results');
    if (results) { results.innerHTML = ''; results.classList.add('hidden'); }
    // (translated)
    setTimeout(() => input?.focus(), 100);
    // (translated)
    _initCheckBaseHandlers();
}

// (translated)
function _closeCheckBase() {
    const overlay = document.getElementById('check-base-overlay');
    if (overlay) overlay.classList.add('hidden');
}

// (translated)
let _checkBaseHandlersReady = false;
function _initCheckBaseHandlers() {
    if (_checkBaseHandlersReady) return;
    _checkBaseHandlersReady = true;

    document.getElementById('check-base-close')?.addEventListener('click', _closeCheckBase);
    document.getElementById('check-base-cancel')?.addEventListener('click', _closeCheckBase);
    document.getElementById('check-base-run')?.addEventListener('click', _runCheckBase);
    // (translated)
    document.getElementById('check-base-overlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'check-base-overlay') _closeCheckBase();
    });
}

// (translated)
function _extractCardNumber(line) {
    // Remove items from array
    const digits = line.replace(/[\s\-\.]/g, '').match(/\d{13,19}/);
    return digits ? digits[0] : null;
}

// (translated)
function _parseCardLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // (translated)
    // Format: NUMBER MM YY CVV
    const parts = trimmed.split(/[\s|:;]+/);

    // Find card number (13-19 digits)
    let cardNum = null;
    let mm = '';
    let yy = '';
    let cvv = '';

    for (let i = 0; i < parts.length; i++) {
        const clean = parts[i].replace(/[\-\.]/g, '');
        if (!cardNum && /^\d{13,19}$/.test(clean)) {
            cardNum = clean;
            // (translated)
            if (parts[i + 1] && /^\d{1,2}$/.test(parts[i + 1])) mm = parts[i + 1].padStart(2, '0');
            if (parts[i + 2] && /^\d{2,4}$/.test(parts[i + 2])) {
                yy = parts[i + 2];
                if (yy.length === 4) yy = yy.slice(2);
            }
            if (parts[i + 3] && /^\d{3,4}$/.test(parts[i + 3])) cvv = parts[i + 3];
            break;
        }
    }

    // (translated)
    if (!cardNum) {
        const allDigits = trimmed.replace(/\D/g, '');
        if (allDigits.length >= 13) {
            cardNum = allDigits.slice(0, 16);
        }
    }

    if (!cardNum) return null;

    return { num: cardNum, mm, yy, cvv, raw: trimmed };
}

// Main check function
function _runCheckBase() {
    const input = document.getElementById('check-base-input');
    const resultsDiv = document.getElementById('check-base-results');
    if (!input || !resultsDiv) return;

    const rawText = input.value.trim();
    if (!rawText) {
        toast('Paste cards to check', 'info');
        return;
    }

    // Parse input
    const lines = rawText.split('\n').filter(l => l.trim());
    const parsed = lines.map(_parseCardLine).filter(Boolean);

    if (parsed.length === 0) {
        toast('No valid card numbers found', 'info');
        return;
    }

    // (translated)
    // (translated)
    // (translated)
    const trashSet = new Set();

    // (translated)
    (STATE.trash || []).forEach(c => {
        const n = (c.cardNumber || '').replace(/[\s\-]/g, '');
        if (n) trashSet.add(n);
    });

    // (translated)
    (STATE.trashCards || []).forEach(n => {
        const clean = (n || '').replace(/[\s\-]/g, '');
        if (clean) trashSet.add(clean);
    });

    // (translated)
    const trashMatches = [];
    const cleanCards = [];

    parsed.forEach(card => {
        const normalized = card.num.replace(/[\s\-]/g, '');
        if (trashSet.has(normalized)) {
            trashMatches.push(card);
        } else {
            cleanCards.push(card);
        }
    });

    // Save results and render
    _checkBaseResults = { clean: cleanCards, trash: trashMatches };

    // (translated)
    const totalChecked = parsed.length;
    const foundInTrash = trashMatches.length;
    const cleanCount = cleanCards.length;

    let html = `
        <div class="cb-stats">
            <div class="cb-stat"><span class="cb-stat-label">TOTAL CHECKED</span><span class="cb-stat-value">${totalChecked}</span></div>
            <div class="cb-stat cb-stat-trash"><span class="cb-stat-label">FOUND IN TRASH</span><span class="cb-stat-value">${foundInTrash}</span></div>
            <div class="cb-stat cb-stat-clean"><span class="cb-stat-label">CLEAN</span><span class="cb-stat-value">${cleanCount}</span></div>
        </div>
    `;

    // (translated)
    html += `<div class="cb-copy-actions">
        <button class="cb-copy-btn cb-copy-clean" id="cb-copy-clean" ${cleanCount === 0 ? 'disabled' : ''}>📋 COPY CLEAN (${cleanCount})</button>
        <button class="cb-copy-btn cb-copy-trash" id="cb-copy-trash" ${foundInTrash === 0 ? 'disabled' : ''}>📋 COPY TRASH (${foundInTrash})</button>
    </div>`;

    // (translated)
    if (foundInTrash > 0) {
        html += `<div class="cb-section">
            <div class="cb-section-title cb-title-trash">🗑 TRASH MATCHES (${foundInTrash})</div>
            <div class="cb-list cb-list-trash">
                ${trashMatches.map(c => `<div class="cb-list-item">${_maskCardNum(c.num)}${c.mm ? ' ' + c.mm : ''}${c.yy ? '/' + c.yy : ''}${c.cvv ? ' ' + c.cvv : ''}</div>`).join('')}
            </div>
        </div>`;
    }

    // (translated)
    if (cleanCount > 0) {
        html += `<div class="cb-section">
            <div class="cb-section-title cb-title-clean">✅ CLEAN CARDS (${cleanCount})</div>
            <div class="cb-list cb-list-clean">
                ${cleanCards.map(c => `<div class="cb-list-item">${_maskCardNum(c.num)}${c.mm ? ' ' + c.mm : ''}${c.yy ? '/' + c.yy : ''}${c.cvv ? ' ' + c.cvv : ''}</div>`).join('')}
            </div>
        </div>`;
    }

    resultsDiv.innerHTML = html;
    resultsDiv.classList.remove('hidden');

    // (translated)
    document.getElementById('cb-copy-clean')?.addEventListener('click', () => _copyCheckBaseCards('clean'));
    document.getElementById('cb-copy-trash')?.addEventListener('click', () => _copyCheckBaseCards('trash'));

    toast(`Checked: ${totalChecked} | Trash: ${foundInTrash} | Clean: ${cleanCount}`, foundInTrash > 0 ? 'warning' : 'success');
}

// Mask card number for display
function _maskCardNum(num) {
    if (num.length < 10) return num;
    return num.slice(0, 6) + '••••' + num.slice(-4);
}

// (translated)
function _copyCheckBaseCards(type) {
    const cards = type === 'clean' ? _checkBaseResults.clean : _checkBaseResults.trash;
    if (cards.length === 0) {
        toast('No cards to copy', 'info');
        return;
    }

    // Format: NUMBER MM YY CVV
    const lines = cards.map(c => {
        const parts = [c.num];
        if (c.mm) parts.push(c.mm);
        if (c.yy) parts.push(c.yy);
        if (c.cvv) parts.push(c.cvv);
        return parts.join(' ');
    }).join('\n');

    navigator.clipboard.writeText(lines).then(() => {
        const label = type === 'clean' ? 'clean' : 'trash';
        toast(`Copied ${cards.length} ${label} cards`, 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = lines;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast(`Copied ${cards.length} cards`, 'success');
    });
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

    // Previous period cards for trend comparison (only used for overall trend if needed)
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

    // Add SCORE, RATE and sorting
    const bins = Object.values(binMap).map(b => {
        b.score = b.a + b.r;
        b.rate = b.used > 0 ? Math.round((b.a / b.used) * 100) : 0;
        
        // Generate trend data
        const numDays = _anPeriod > 0 ? _anPeriod : 30; // default 30 days for 'All'
        const counts = new Array(numDays).fill(0);
        b.cards.forEach(c => {
            const t = _anParseDate(c.date);
            if (t) {
                const daysAgo = Math.floor((now - t) / DAY);
                if (daysAgo >= 0 && daysAgo < numDays) {
                    counts[numDays - 1 - daysAgo]++;
                }
            }
        });
        b.trendData = counts;
        return b;
    }).sort((a, b) => b.score - a.score || b.used - a.used);

    const createSparkline = (data) => {
        if (!data || data.length === 0) return '';
        const w = 80, h = 30;
        const max = Math.max(...data, 1);
        const min = 0;
        const pts = data.map((val, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((val - min) / (max - min)) * (h - 4) - 2;
            return `${x},${y}`;
        }).join(' ');

        const firstHalf = data.slice(0, Math.floor(data.length / 2)).reduce((a, b) => a + b, 0);
        const secondHalf = data.slice(Math.floor(data.length / 2)).reduce((a, b) => a + b, 0);
        
        let color = '#71717A'; // gray
        let trendType = 'stable';
        if (secondHalf > firstHalf) { color = '#22C55E'; trendType = 'up'; }
        else if (secondHalf < firstHalf) { color = '#EF4444'; trendType = 'down'; }

        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="sparkline-svg ${trendType}">
            <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sparkline-path" />
        </svg>`;
    };

    const getRateHtml = (rate) => {
        let colorClass = 'rate-red', icon = '⚠️';
        if (rate >= 90) { colorClass = 'rate-green'; icon = rate === 100 ? '✔️' : '📈'; }
        else if (rate >= 80) { colorClass = 'rate-yellow'; icon = '⚡'; }
        return `<span class="rate-indicator ${colorClass}">${rate}% <span class="rate-icon">${icon}</span></span>`;
    };

    const getMedal = (idx) => {
        if (idx === 0) return '🥇';
        if (idx === 1) return '🥈';
        if (idx === 2) return '🥉';
        return '';
    };

    const avgScore = bins.length ? (bins.reduce((s, b) => s + b.score, 0) / bins.length).toFixed(1) : 0;
    const bestRate = bins.length ? Math.max(...bins.map(b => b.rate)) : 0;

    let cardsHtml = '';
    const topBins = bins.slice(0, 3);
    topBins.forEach((b, i) => {
        const binInfo = BIN_CACHE[b.bin] || {};
        const bankName = binInfo.bank || 'Unknown Bank';
        cardsHtml += `
            <div class="top-card">
                <div class="tc-header">
                    <div class="tc-medal">${getMedal(i)}</div>
                    <div class="tc-bin-info">
                        <div class="tc-bin">${b.bin}</div>
                        <div class="tc-bank">${bankName}</div>
                    </div>
                    <div class="tc-rate">${getRateHtml(b.rate)}</div>
                </div>
                <div class="tc-body">
                    <div class="tc-score">
                        <span class="tc-score-lbl">SCORE</span>
                        <span class="tc-score-val">⭐ ${b.score}</span>
                    </div>
                    <div class="tc-graph">${createSparkline(b.trendData)}</div>
                </div>
                <div class="tc-footer">
                    <div class="tc-stat"><span class="tc-stat-lbl">A</span><span class="tc-stat-val pos">${b.a}</span></div>
                    <div class="tc-stat"><span class="tc-stat-lbl">R</span><span class="tc-stat-val neg">${b.r}</span></div>
                    <div class="tc-stat"><span class="tc-stat-lbl">V</span><span class="tc-stat-val warn">${b.v}</span></div>
                    <div class="tc-stat"><span class="tc-stat-lbl">M</span><span class="tc-stat-val neu">${b.m}</span></div>
                </div>
            </div>
        `;
    });

    let rowsHtml = '';
    bins.forEach((b, i) => {
        const trClass = i < 3 ? `an-row top-row top-row-${i+1}` : 'an-row';
        rowsHtml += `<tr class="${trClass}" data-bin="${b.bin}">
                <td class="td-num">${i + 1} ${getMedal(i)}</td>
                <td class="bin-cell">${b.bin}</td>
                <td>${b.used}</td>
                <td class="score-cell"><strong>${b.score}</strong></td>
                <td style="color:var(--green)">${b.a}</td>
                <td style="color:var(--red)">${b.r}</td>
                <td style="color:var(--amber)">${b.v}</td>
                <td style="color:var(--text-dim)">${b.m}</td>
                <td>${getRateHtml(b.rate)}</td>
                <td class="trend-cell">${createSparkline(b.trendData)}</td>
            </tr>`;
    });

    area.innerHTML = `
        <div class="an-workspace fade-in">
            <div class="an-top-bar">
                <div class="an-filters">
                    <button class="an-pill ${_anPeriod === 7 ? 'active' : ''}" data-days="7">7d</button>
                    <button class="an-pill ${_anPeriod === 14 ? 'active' : ''}" data-days="14">14d</button>
                    <button class="an-pill ${_anPeriod === 30 ? 'active' : ''}" data-days="30">30d</button>
                    <button class="an-pill ${_anPeriod === 0 ? 'active' : ''}" data-days="0">ALL</button>
                </div>
                <div class="an-global-stats">
                    <div class="an-g-stat"><span class="an-gs-val">${bins.length}</span><span class="an-gs-lbl">TOTAL BINS</span></div>
                    <div class="an-g-stat"><span class="an-gs-val">${cards.length}</span><span class="an-gs-lbl">TOTAL CARDS</span></div>
                    <div class="an-g-stat"><span class="an-gs-val">${avgScore}</span><span class="an-gs-lbl">AVG SCORE</span></div>
                    <div class="an-g-stat"><span class="an-gs-val rate-green">${bestRate}%</span><span class="an-gs-lbl">BEST RATE</span></div>
                </div>
            </div>
            
            <div class="an-top-cards-wrap">
                ${cardsHtml}
            </div>

            <div class="an-table-wrapper">
                <table class="data-table an-modern-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>BIN</th>
                            <th>USED</th>
                            <th>SCORE</th>
                            <th>A</th>
                            <th>R</th>
                            <th>V</th>
                            <th>M</th>
                            <th>RATE</th>
                            <th>TREND</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        </div>
        <div id="an-modal" class="an-modal hidden"></div>
    `;

    // Stagger animation for rows
    const rows = area.querySelectorAll('.an-row');
    rows.forEach((r, i) => {
        r.style.opacity = '0';
        r.style.transform = 'translateY(10px)';
        r.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        setTimeout(() => {
            r.style.opacity = '1';
            r.style.transform = 'translateY(0)';
        }, 50 * Math.min(i, 20)); // cap delay at 20 rows
    });

    // Period button listeners
    area.querySelectorAll('.an-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            _anPeriod = parseInt(btn.dataset.days);
            // Quick fade out
            area.querySelector('.an-workspace').classList.add('fade-out');
            setTimeout(renderAnalytics, 150);
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






// ═══════════════════════════════════════════
//   CHECKER — Smart Format Utility (Proxy / BIN / Card / IP / Auto)
// ═══════════════════════════════════════════

const _CK = {
    mode: 'proxy',        // proxy | bin | card | ip | auto | glue
    proxyProto: 'socks5', // socks5 | http | https
    tabs: {
        proxy: { input: '', output: '' },
        bin:   { input: '', output: '' },
        card:  { input: '', output: '' },
        ip:    { input: '', output: '' },
        auto:  { input: '', output: '' },
        glue:  { input: '', output: '' },
    },
    // GLUE multi-step state
    glue: {
        step: 1,               // 1=cards, 2=identity, 3=result
        cardsRaw: '',          // raw text for cards step
        identityRaw: '',       // raw text for identity step
        parsedCards: [],       // [{ccn, mm, yy, cvv, network}]
        parsedIdentities: [],  // [{name,surname,address,city,state,country,zip,dob,phone,email}]
        records: [],           // final paired [{card, identity}]
        remainingCards: [],    // unpaired cards
        remainingIdentities: [], // unpaired identities
    },
    history: [],           // last 10 operations
};

/* ──────────────────────────────────────────
   SMART CARD EXTRACTOR
   ────────────────────────────────────────── */
function _ckExtractCards(text) {
    const cards = [];
    const seen = new Set();
    const lines = text.split(/\n/);

    function addCard(ccn, mm, yy, cvv) {
        if (!ccn || !mm || !yy || !cvv) return false;
        ccn = ccn.replace(/[\s\-]/g, '');
        if (ccn.length < 13 || ccn.length > 19) return false;
        const mmInt = parseInt(mm, 10);
        if (mmInt < 1 || mmInt > 12) return false;
        mm = String(mmInt).padStart(2, '0');
        if (yy.length === 4) yy = yy.slice(2);
        if (yy.length !== 2) return false;
        if (cvv.length < 3 || cvv.length > 4) return false;
        if (seen.has(ccn)) return false;
        seen.add(ccn);
        cards.push({ ccn, mm, yy, cvv, network: getCardType(ccn) });
        return true;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        // ── Strategy 1: Standard delimited (pipe/colon/slash/space/tab) ──
        const stdRe = /(\d[\d\s\-]{11,22}\d)\s*[\|:\/\\\s\t]+\s*(0?[1-9]|1[0-2])\s*[\|:\/\\\s\t]+\s*(\d{2}|\d{4})\s*[\|:\/\\\s\t]+\s*(\d{3,4})/;
        const stdM = line.match(stdRe);
        if (stdM) { addCard(stdM[1], stdM[2], stdM[3], stdM[4]); continue; }

        // ── Strategy 2: Labeled formats ──
        // Find card number first
        const ccnRe = /(\d[\d\s\-]{11,22}\d)/;
        const ccnM = line.match(ccnRe);
        if (!ccnM) continue;
        const rawCcn = ccnM[1];
        const ccn = rawCcn.replace(/[\s\-]/g, '');
        if (ccn.length < 13 || ccn.length > 19) continue;
        if (seen.has(ccn)) continue;

        let mm = null, yy = null, cvv = null;

        // Labeled Exp: MM/YY
        const expRe = /(?:exp(?:ir[yation]*)?|valid(?:ity)?|срок)\s*[:\s=]+\s*(0?[1-9]|1[0-2])\s*[\/\-\.]\s*(\d{2,4})/i;
        const expM = line.match(expRe);
        if (expM) { mm = expM[1]; yy = expM[2]; }

        // Labeled Month
        if (!mm) {
            const mmRe = /(?:month|mm|mes|месяц)\s*[:\s=]+\s*(0?[1-9]|1[0-2])\b/i;
            const mmM = line.match(mmRe);
            if (mmM) mm = mmM[1];
        }
        // Labeled Year
        if (!yy) {
            const yyRe = /(?:year|yy|yyyy|ano|год)\s*[:\s=]+\s*(\d{2,4})\b/i;
            const yyM = line.match(yyRe);
            if (yyM) yy = yyM[1];
        }
        // Labeled CVV
        const cvvRe = /(?:cvv2?|cvc2?|cid|код|security\s*code)\s*[:\s=]+\s*(\d{3,4})\b/i;
        const cvvM = line.match(cvvRe);
        if (cvvM) cvv = cvvM[1];

        // ── Strategy 3: Remaining numbers after card ──
        if (!mm || !yy || !cvv) {
            const afterIdx = line.indexOf(rawCcn) + rawCcn.length;
            const after = line.substring(afterIdx);
            // Strip labels/garbage, keep digits
            const nums = [];
            const numRe = /\b(\d{2,4})\b/g;
            let m;
            while ((m = numRe.exec(after)) !== null) {
                const n = m[1];
                if (parseInt(n) > 9999) continue;
                nums.push(n);
            }
            if (!mm && !yy && !cvv && nums.length >= 3) {
                mm = nums[0]; yy = nums[1]; cvv = nums[2];
            } else if (mm && !yy && !cvv && nums.length >= 2) {
                yy = nums[0]; cvv = nums[1];
            } else if (!mm && yy && !cvv && nums.length >= 2) {
                mm = nums[0]; cvv = nums[1];
            } else if (mm && yy && !cvv && nums.length >= 1) {
                cvv = nums[0];
            } else if (!mm && !yy && cvv && nums.length >= 2) {
                mm = nums[0]; yy = nums[1];
            }
        }

        // ── Strategy 4: Multi-line (look at next line) ──
        if ((!mm || !yy || !cvv) && i + 1 < lines.length) {
            const nextLine = lines[i + 1].trim();
            if (nextLine && !nextLine.match(/\d{13,19}/)) {
                const combined = line + ' ' + nextLine;
                const comboM = combined.match(stdRe);
                if (comboM) {
                    const comboCcn = comboM[1].replace(/[\s\-]/g, '');
                    if (comboCcn === ccn) {
                        addCard(comboM[1], comboM[2], comboM[3], comboM[4]);
                        i++;
                        continue;
                    }
                }
                // Try extracting remaining numbers from next line
                if (!mm || !yy || !cvv) {
                    const nums = [];
                    const numRe = /\b(\d{2,4})\b/g;
                    let m;
                    while ((m = numRe.exec(nextLine)) !== null) nums.push(m[1]);
                    const needed = [!mm, !yy, !cvv].filter(Boolean).length;
                    if (nums.length >= needed) {
                        let idx = 0;
                        if (!mm && idx < nums.length) mm = nums[idx++];
                        if (!yy && idx < nums.length) yy = nums[idx++];
                        if (!cvv && idx < nums.length) cvv = nums[idx++];
                        i++;
                    }
                }
            }
        }

        addCard(rawCcn, mm, yy, cvv);
    }
    return cards;
}

/* ──────────────────────────────────────────
   SMART BIN EXTRACTOR
   ────────────────────────────────────────── */
function _ckExtractBins(text) {
    const bins = new Set();
    // From full card extractions
    _ckExtractCards(text).forEach(c => bins.add(c.ccn.slice(0, 6)));
    // Also raw scan for any card-like numbers
    const rawRe = /\d[\d\s\-]{11,22}\d/g;
    let m;
    while ((m = rawRe.exec(text)) !== null) {
        const num = m[0].replace(/[\s\-]/g, '');
        if (num.length >= 13 && num.length <= 19) bins.add(num.slice(0, 6));
    }
    // Standalone 13-19 digit numbers
    const plainRe = /\b(\d{13,19})\b/g;
    while ((m = plainRe.exec(text)) !== null) {
        bins.add(m[1].slice(0, 6));
    }
    return [...bins].sort().map(b => `/bin ${b}`);
}

/* ──────────────────────────────────────────
   SMART IP EXTRACTOR (validated IPv4)
   ────────────────────────────────────────── */
function _ckExtractIPs(text) {
    const ips = new Set();
    const re = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const o = [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), parseInt(m[4])];
        if (o.every(v => v >= 0 && v <= 255)) {
            ips.add(o.join('.'));
        }
    }
    return [...ips].map(ip => `/ip ${ip}`);
}

/* ──────────────────────────────────────────
   SMART PROXY EXTRACTOR
   ────────────────────────────────────────── */
function _ckExtractProxies(text, proto) {
    const results = [];
    const seen = new Set();
    function add(str) { if (!seen.has(str)) { seen.add(str); results.push(str); } }

    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);

    for (const raw of lines) {
        // Strip HTML/JSON artifacts
        let line = raw.replace(/<[^>]*>/g, '').replace(/["'`\[\]{}(),;]/g, '').trim();
        if (!line) continue;

        // 1) Full protocol://user:pass@host:port
        const f1 = line.match(/(?:socks[45]|https?):\/\/([^:\s]+):([^@\s]+)@([^:\s]+):(\d{1,5})/i);
        if (f1 && _ckValidPort(f1[4])) {
            add(`${proto}://${f1[1]}:${f1[2]}@${f1[3]}:${f1[4]}`); continue;
        }
        // 2) protocol://host:port (no auth)
        const f2 = line.match(/(?:socks[45]|https?):\/\/([^:\s]+):(\d{1,5})/i);
        if (f2 && _ckValidPort(f2[2])) {
            add(`${proto}://${f2[1]}:${f2[2]}`); continue;
        }
        // 3) user:pass@host:port
        const f3 = line.match(/([^:\s@]+):([^@\s]+)@([^:\s]+):(\d{1,5})/);
        if (f3 && _ckValidPort(f3[4])) {
            add(`${proto}://${f3[1]}:${f3[2]}@${f3[3]}:${f3[4]}`); continue;
        }

        // Strip protocol prefix for colon-split analysis
        let stripped = line.replace(/^(socks[45]|https?):\/\//i, '');
        const parts = stripped.split(':').map(s => s.trim());

        // 4) host:port:user:pass
        if (parts.length === 4 && /^\d+$/.test(parts[1]) && _ckValidPort(parts[1])) {
            add(`${proto}://${parts[2]}:${parts[3]}@${parts[0]}:${parts[1]}`); continue;
        }
        // 5) user:pass:host:port
        if (parts.length === 4 && /^\d+$/.test(parts[3]) && _ckValidPort(parts[3])) {
            add(`${proto}://${parts[0]}:${parts[1]}@${parts[2]}:${parts[3]}`); continue;
        }
        // 6) host:port
        if (parts.length === 2 && /^\d+$/.test(parts[1]) && _ckValidPort(parts[1])) {
            add(`${proto}://${parts[0]}:${parts[1]}`); continue;
        }

        // 7) Embedded IP:PORT in messy text
        const emb = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})/);
        if (emb && _ckValidPort(emb[2])) {
            const ip = emb[1];
            const octs = ip.split('.').map(Number);
            if (octs.every(o => o >= 0 && o <= 255)) {
                // Check for auth before IP
                const before = line.substring(0, line.indexOf(emb[0]));
                const auth = before.match(/([^:\s]+):([^:\s@]+)@?\s*$/);
                if (auth) {
                    add(`${proto}://${auth[1]}:${auth[2]}@${ip}:${emb[2]}`);
                } else {
                    // Check for auth after port
                    const afterIdx = line.indexOf(emb[0]) + emb[0].length;
                    const after = line.substring(afterIdx);
                    const authAfter = after.match(/^\s*[:\s]+\s*([^:\s]+)[:\s]+([^:\s]+)/);
                    if (authAfter) {
                        add(`${proto}://${authAfter[1]}:${authAfter[2]}@${ip}:${emb[2]}`);
                    } else {
                        add(`${proto}://${ip}:${emb[2]}`);
                    }
                }
            }
        }
    }
    return results;
}

function _ckValidPort(p) {
    const n = parseInt(p, 10);
    return n > 0 && n <= 65535;
}

/* ──────────────────────────────────────────
   AUTO EXTRACT (runs all parsers)
   ────────────────────────────────────────── */
function _ckAutoExtract(text, proto) {
    const cards = _ckExtractCards(text);
    const bins = _ckExtractBins(text);
    const ips = _ckExtractIPs(text);
    const proxies = _ckExtractProxies(text, proto);

    const sections = [];
    if (cards.length) {
        const netStats = {};
        cards.forEach(c => { netStats[c.network || '??'] = (netStats[c.network || '??'] || 0) + 1; });
        const netStr = Object.entries(netStats).map(([k,v]) => `${k}: ${v}`).join(', ');
        sections.push(`💳 CARDS (${cards.length}) [${netStr}]\n` + cards.map(c => `${c.ccn} ${c.mm} ${c.yy} ${c.cvv}`).join('\n'));
    }
    if (bins.length) sections.push(`🔢 BINs (${bins.length})\n` + bins.join('\n'));
    if (ips.length)  sections.push(`📡 IPs (${ips.length})\n` + ips.join('\n'));
    if (proxies.length) sections.push(`🌐 PROXIES (${proxies.length})\n` + proxies.join('\n'));

    if (!sections.length) return '';
    return `═══ AUTO EXTRACT ═══\n\n` + sections.join('\n\n');
}

/* ──────────────────────────────────────────
   PROCESS (main dispatcher)
   ────────────────────────────────────────── */
function _ckProcess() {
    const tab = _CK.tabs[_CK.mode];
    const input = tab.input;
    if (!input.trim()) { tab.output = ''; return 0; }

    let result = [];
    let countLabel = '';

    switch (_CK.mode) {
        case 'proxy':
            result = _ckExtractProxies(input, _CK.proxyProto);
            countLabel = `${result.length} proxies`;
            break;
        case 'bin':
            result = _ckExtractBins(input);
            countLabel = `${result.length} unique BINs`;
            break;
        case 'card': {
            const cards = _ckExtractCards(input);
            result = cards.map(c => `${c.ccn} ${c.mm} ${c.yy} ${c.cvv}`);
            const netStats = {};
            cards.forEach(c => { netStats[c.network || '??'] = (netStats[c.network || '??'] || 0) + 1; });
            const parts = Object.entries(netStats).map(([k,v]) => `${v} ${k}`);
            countLabel = `${cards.length} cards` + (parts.length ? ` • ${parts.join(', ')}` : '');
            break;
        }
        case 'ip':
            result = _ckExtractIPs(input);
            countLabel = `${result.length} IPs`;
            break;
        case 'auto':
            tab.output = _ckAutoExtract(input, _CK.proxyProto);
            return tab.output ? 1 : 0;
    }
    tab.output = result.join('\n');

    if (result.length > 0) {
        _CK.history.unshift({
            mode: _CK.mode,
            count: result.length,
            label: countLabel,
            time: new Date().toLocaleTimeString(),
        });
        if (_CK.history.length > 10) _CK.history.pop();
    }
    return result.length;
}


/* ──────────────────────────────────────────
   GLUE — Identity Extractor
   ────────────────────────────────────────── */
function _ckExtractIdentities(text) {
    const results = [];

    // Pre-split by bullet characters: · (U+00B7), • (U+2022), ● (U+25CF), ◦ (U+25E6), ‣ (U+2023)
    let normalized = text.replace(/[\u00B7\u2022\u25CF\u25E6\u2023\u2219]/g, '\n');

    // Split into blocks by blank lines OR by line-starting Name/First/Full keywords
    const blocks = normalized.split(/\n\s*\n|\n(?=\s*(?:name|first|last|full|fname|lname|holder|owner)\s*[:=])/i);

    for (const block of blocks) {
        if (!block.trim()) continue;
        const id = { name:'', surname:'', address:'', city:'', state:'', country:'', zip:'', dob:'', phone:'', email:'' };
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
        let found = 0;

        for (const line of lines) {
            // Match key:value or key=value pairs
            const kv = line.match(/^([a-z\s_-]+)\s*[:=|]\s*(.+)$/i);
            if (!kv) {
                // Try inline "Name: X Surname: Y" on single line
                const inline = line.match(/Name\s*[:=]\s*(\S+)\s+Surname\s*[:=]\s*(\S+)/i);
                if (inline) {
                    id.name = inline[1].trim();
                    id.surname = inline[2].trim();
                    found += 2;
                }
                continue;
            }
            const key = kv[1].toLowerCase().replace(/[\s_-]+/g, '');
            const val = kv[2].trim();
            // Handle "Name: AKIKO  Surname: IIJIMA" in value part
            const surInVal = val.match(/^(\S+)\s+Surname\s*[:=]\s*(\S+)/i);
            if (surInVal && /^(firstname|fname|first|name|holder|owner|cardname)$/.test(key)) {
                id.name = surInVal[1];
                id.surname = surInVal[2];
                found += 2;
                continue;
            }
            if (!val) continue;

            if (/^(firstname|fname|first|name|holder|owner|cardname)$/.test(key)) { id.name = val; found++; }
            else if (/^(lastname|lname|last|surname|family)$/.test(key)) { id.surname = val; found++; }
            else if (/^(fullname|full|namefull)$/.test(key)) {
                const parts = val.split(/\s+/);
                id.name = parts[0] || '';
                id.surname = parts.slice(1).join(' ') || '';
                found++;
            }
            else if (/^(address|addr|street|streetaddress|address1|line1)$/.test(key)) { id.address = val; found++; }
            else if (/^(city|town|locality)$/.test(key)) { id.city = val; found++; }
            else if (/^(state|province|region|oblast)$/.test(key)) { id.state = val; found++; }
            else if (/^(country|nation|countrycode)$/.test(key)) { id.country = val; found++; }
            else if (/^(zip|zipcode|postal|postalcode|postcode)$/.test(key)) { id.zip = val; found++; }
            else if (/^(dob|birth|birthday|dateofbirth|birthdate)$/.test(key)) { id.dob = val; found++; }
            else if (/^(phone|tel|telephone|mobile|mob|cell)$/.test(key)) { id.phone = val; found++; }
            else if (/^(email|mail|emailaddress)$/.test(key)) { id.email = val; found++; }
        }

        // Try unstructured: first line = name surname
        if (!id.name && lines.length > 0) {
            const firstLine = lines[0];
            if (!firstLine.includes(':') && !firstLine.includes('=')) {
                const nameParts = firstLine.split(/\s+/).filter(w => /^[A-Za-zÀ-ÿ'-]+$/.test(w));
                if (nameParts.length >= 2 && nameParts.length <= 4) {
                    id.name = nameParts[0];
                    id.surname = nameParts.slice(1).join(' ');
                    found++;
                }
            }
        }

        if (found >= 1 && (id.name || id.surname)) {
            results.push({...id});
        }
    }
    return results;
}

/* GLUE — Pair cards with identities (strict 1:1, no reuse) */
function _ckGluePair() {
    const g = _CK.glue;
    const cards = g.parsedCards;
    const ids = g.parsedIdentities;
    const records = [];
    const paired = Math.min(cards.length, ids.length);

    for (let i = 0; i < paired; i++) {
        records.push({ card: {...cards[i]}, identity: {...ids[i]} });
    }

    g.records = records;
    g.remainingCards = cards.slice(paired);
    g.remainingIdentities = ids.slice(paired);
    return records;
}

/* GLUE — Format single record (clean key:value, no emoji, conditional fields) */
function _ckFormatRecord(rec, idx) {
    const lines = [`══ Record #${idx + 1} ══`];
    if (rec.identity) {
        const id = rec.identity;
        if (id.name || id.surname) lines.push(`Name: ${id.name || ''} Surname: ${id.surname || ''}`.trim());
    }
    if (rec.card) {
        lines.push(`Card: ${rec.card.ccn}|${rec.card.mm}|${rec.card.yy}|${rec.card.cvv}`);
    }
    if (rec.identity) {
        const id = rec.identity;
        const addrParts = [id.address, id.city, id.state, id.zip, id.country].filter(Boolean);
        if (addrParts.length) lines.push(`Address: ${addrParts.join(', ')}`);
        if (id.dob) lines.push(`DOB: ${id.dob}`);
        if (id.phone) lines.push(`Phone: ${id.phone}`);
        if (id.email) lines.push(`Email: ${id.email}`);
    }
    return lines.join('\n');
}

/* GLUE — Format all records + remainders */
function _ckFormatAllRecords() {
    const g = _CK.glue;
    let output = g.records.map((r, i) => _ckFormatRecord(r, i)).join('\n\n');

    // Show remaining unpaired cards
    if (g.remainingCards && g.remainingCards.length > 0) {
        output += '\n\n═══════════════════════\n';
        output += `⚠ Remaining: ${g.remainingCards.length} cards without identity\n`;
        output += g.remainingCards.map(c => `${c.ccn}|${c.mm}|${c.yy}|${c.cvv}`).join('\n');
    }

    // Show remaining unpaired identities
    if (g.remainingIdentities && g.remainingIdentities.length > 0) {
        output += '\n\n═══════════════════════\n';
        output += `⚠ Remaining: ${g.remainingIdentities.length} identities without card\n`;
        output += g.remainingIdentities.map(id => `${id.name} ${id.surname}`.trim()).join('\n');
    }

    return output;
}

/* GLUE — Reset */
function _ckGlueReset() {
    _CK.glue = { step: 1, cardsRaw: '', identityRaw: '', parsedCards: [], parsedIdentities: [], records: [], remainingCards: [], remainingIdentities: [] };
}

/* ──────────────────────────────────────────
   GLUE — Render UI
   ────────────────────────────────────────── */
function _renderGlue() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.style.display = 'none';
    bar.innerHTML = '';
    const g = _CK.glue;

    const stepLabels = ['', '1 · ADD CARDS', '2 · ADD IDENTITY', '3 · RESULT'];
    const stepIcons = ['', '💳', '👤', '🔗'];

    area.innerHTML = `
    <div class="ck-container">
        <div class="ck-header">
            <div class="ck-title">
                <span class="ck-icon">🔗</span>
                <span>GLUE</span>
                <span style="font-size:11px;color:#6b7280;font-weight:400;margin-left:4px">Склейка</span>
            </div>
            <div class="ck-modes">
                <button class="ck-mode-btn" data-mode="proxy"><span class="ck-mode-icon">🌐</span><span class="ck-mode-label">Proxy</span></button>
                <button class="ck-mode-btn" data-mode="card"><span class="ck-mode-icon">💳</span><span class="ck-mode-label">Card</span></button>
                <button class="ck-mode-btn" data-mode="auto"><span class="ck-mode-icon">🔍</span><span class="ck-mode-label">Auto</span></button>
                <button class="ck-mode-btn active" data-mode="glue"><span class="ck-mode-icon">🔗</span><span class="ck-mode-label">Glue</span></button>
            </div>
        </div>

        <!-- Step indicator -->
        <div class="glue-steps">
            ${[1,2,3].map(s => `
                <div class="glue-step ${g.step === s ? 'active' : ''} ${g.step > s ? 'done' : ''}" data-step="${s}">
                    <span class="glue-step-num">${g.step > s ? '✓' : s}</span>
                    <span class="glue-step-label">${stepLabels[s]}</span>
                </div>
                ${s < 3 ? '<div class="glue-step-line' + (g.step > s ? ' done' : '') + '"></div>' : ''}
            `).join('')}
        </div>

        ${g.step === 1 ? _renderGlueStep1() : ''}
        ${g.step === 2 ? _renderGlueStep2() : ''}
        ${g.step === 3 ? _renderGlueStep3() : ''}
    </div>`;

    _bindGlueEvents();
}

function _renderGlueStep1() {
    const g = _CK.glue;
    const count = g.parsedCards.length;
    return `
        <div class="glue-workspace">
            <div class="ck-panel">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">💳 PASTE CARDS</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count ${count > 0 ? 'ck-count-active' : ''}">${count} cards found</span>
                        <button class="ck-action-btn" id="glue-paste-1">📋 Paste</button>
                        <button class="ck-action-btn ck-btn-danger" id="glue-clear-1">✕</button>
                    </div>
                </div>
                <textarea class="ck-textarea" id="glue-input-1" placeholder="Paste cards in ANY format:\n\n4242424242424242|03|27|111\n4242424242424242:03:2027:111\nCard: 4242... Exp 03/27 CVV 111\nMixed text, logs, clipboard — all works">${g.cardsRaw}</textarea>
            </div>
            <div class="glue-bottom-bar">
                <button class="glue-btn-secondary" id="glue-reset">↺ Reset</button>
                <div class="glue-spacer"></div>
                <button class="glue-btn-primary" id="glue-next-1" ${!count ? 'disabled' : ''}>
                    Extract & Next →
                    ${count > 0 ? `<span class="glue-badge">${count}</span>` : ''}
                </button>
            </div>
        </div>`;
}

function _renderGlueStep2() {
    const g = _CK.glue;
    const count = g.parsedIdentities.length;
    return `
        <div class="glue-workspace">
            <div class="glue-info-bar">
                <span class="glue-info-icon">💳</span>
                <span>${g.parsedCards.length} cards ready</span>
            </div>
            <div class="ck-panel">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">👤 PASTE IDENTITY DATA</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count ${count > 0 ? 'ck-count-active' : ''}">${count} identities found</span>
                        <button class="ck-action-btn" id="glue-paste-2">📋 Paste</button>
                        <button class="ck-action-btn ck-btn-danger" id="glue-clear-2">✕</button>
                    </div>
                </div>
                <textarea class="ck-textarea" id="glue-input-2" placeholder="Paste identity info:\n\nName: John\nSurname: Smith\nAddress: 123 Main St\nCity: New York\nState: NY\nZip: 10001\nCountry: US\nDOB: 01/15/1990\nPhone: +1-555-123-4567\nEmail: john@example.com\n\n(Separate multiple identities with blank lines)">${g.identityRaw}</textarea>
            </div>
            <div class="glue-bottom-bar">
                <button class="glue-btn-secondary" id="glue-back-2">← Back</button>
                <div class="glue-spacer"></div>
                <button class="glue-btn-primary" id="glue-next-2" ${!count ? 'disabled' : ''}>
                    Glue & Generate →
                    ${count > 0 ? `<span class="glue-badge">${count}</span>` : ''}
                </button>
            </div>
        </div>`;
}

function _renderGlueStep3() {
    const g = _CK.glue;
    const output = _ckFormatAllRecords();
    return `
        <div class="glue-workspace">
            <div class="glue-info-bar">
                <span class="glue-info-icon">🔗</span>
                <span>${g.records.length} records paired</span>
                ${(g.remainingCards?.length || 0) > 0 ? `<span class="glue-remain-warn">⚠ ${g.remainingCards.length} cards left</span>` : ''}
                ${(g.remainingIdentities?.length || 0) > 0 ? `<span class="glue-remain-warn">⚠ ${g.remainingIdentities.length} identities left</span>` : ''}
                <span style="margin-left:auto;font-size:10px;color:#6b7280">${g.parsedCards.length} cards × ${g.parsedIdentities.length} identities</span>
            </div>
            <div class="ck-panel" style="flex:1">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">📤 GLUED OUTPUT</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count ck-count-active">${g.records.length} records</span>
                    </div>
                </div>
                <textarea class="ck-textarea ck-output-text" id="glue-output" readonly>${output}</textarea>
            </div>
            <div class="glue-export-bar">
                <button class="glue-btn-export" id="glue-copy">📋 Copy</button>
                <button class="glue-btn-export glue-btn-notes" id="glue-to-notes">📝 To Notes</button>
                <button class="glue-btn-export glue-btn-workspace" id="glue-to-workspace">📊 To Workspace</button>
                <button class="glue-btn-export glue-btn-txt" id="glue-export-txt">💾 Export .txt</button>
            </div>
            <div class="glue-bottom-bar">
                <button class="glue-btn-secondary" id="glue-back-3">← Back to Identity</button>
                <div class="glue-spacer"></div>
                <button class="glue-btn-secondary" id="glue-reset-all">↺ New Session</button>
            </div>
        </div>`;
}

function _bindGlueEvents() {
    const area = document.getElementById('content-area');
    const g = _CK.glue;

    // Mode switch
    area.querySelectorAll('.ck-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _CK.mode = btn.dataset.mode;
            if (_CK.mode === 'glue') _renderGlue();
            else renderChecker();
        });
    });

    // Step clicks (go back to completed steps)
    area.querySelectorAll('.glue-step.done').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => { g.step = parseInt(el.dataset.step); _renderGlue(); });
    });

    if (g.step === 1) {
        const inp = document.getElementById('glue-input-1');
        inp?.addEventListener('input', () => {
            g.cardsRaw = inp.value;
            g.parsedCards = _ckExtractCards(inp.value);
            const cnt = document.querySelector('.ck-count');
            if (cnt) cnt.textContent = `${g.parsedCards.length} cards found`;
            if (cnt) cnt.classList.toggle('ck-count-active', g.parsedCards.length > 0);
            const btn = document.getElementById('glue-next-1');
            if (btn) btn.disabled = g.parsedCards.length === 0;
            if (btn) {
                const badge = btn.querySelector('.glue-badge');
                if (badge) badge.textContent = g.parsedCards.length;
                else if (g.parsedCards.length > 0) btn.innerHTML = `Extract & Next → <span class="glue-badge">${g.parsedCards.length}</span>`;
            }
        });
        document.getElementById('glue-paste-1')?.addEventListener('click', async () => {
            try { const t = await navigator.clipboard.readText(); inp.value = t; inp.dispatchEvent(new Event('input')); toast('Pasted','success'); } catch { toast('Clipboard denied','error'); }
        });
        document.getElementById('glue-clear-1')?.addEventListener('click', () => { g.cardsRaw = ''; g.parsedCards = []; _renderGlue(); });
        document.getElementById('glue-next-1')?.addEventListener('click', () => {
            if (g.parsedCards.length === 0) { toast('No cards found','error'); return; }
            toast(`${g.parsedCards.length} cards extracted`, 'success');
            g.step = 2; _renderGlue();
        });
        document.getElementById('glue-reset')?.addEventListener('click', () => { _ckGlueReset(); _renderGlue(); });
    }

    if (g.step === 2) {
        const inp = document.getElementById('glue-input-2');
        inp?.addEventListener('input', () => {
            g.identityRaw = inp.value;
            g.parsedIdentities = _ckExtractIdentities(inp.value);
            const cnt = area.querySelectorAll('.ck-count')[0];
            if (cnt) { cnt.textContent = `${g.parsedIdentities.length} identities found`; cnt.classList.toggle('ck-count-active', g.parsedIdentities.length > 0); }
            const btn = document.getElementById('glue-next-2');
            if (btn) btn.disabled = g.parsedIdentities.length === 0;
        });
        document.getElementById('glue-paste-2')?.addEventListener('click', async () => {
            try { const t = await navigator.clipboard.readText(); inp.value = t; inp.dispatchEvent(new Event('input')); toast('Pasted','success'); } catch { toast('Clipboard denied','error'); }
        });
        document.getElementById('glue-clear-2')?.addEventListener('click', () => { g.identityRaw = ''; g.parsedIdentities = []; _renderGlue(); });
        document.getElementById('glue-back-2')?.addEventListener('click', () => { g.step = 1; _renderGlue(); });
        document.getElementById('glue-next-2')?.addEventListener('click', () => {
            if (g.parsedIdentities.length === 0) { toast('No identities found','error'); return; }
            _ckGluePair();
            toast(`${g.records.length} records paired`, 'success');
            g.step = 3; _renderGlue();
        });
    }

    if (g.step === 3) {
        document.getElementById('glue-copy')?.addEventListener('click', () => {
            const text = _ckFormatAllRecords();
            navigator.clipboard.writeText(text).then(() => toast('Copied!','success')).catch(() => { const t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); toast('Copied!','success'); });
        });
        document.getElementById('glue-to-notes')?.addEventListener('click', () => {
            const text = '═══ GLUE EXPORT ═══\n' + new Date().toLocaleString() + '\n\n' + _ckFormatAllRecords();
            const newTab = { id: 'tab-' + Date.now(), title: 'Glue ' + new Date().toLocaleTimeString(), content: text, pinned: false, tag: null, created: Date.now(), scrollPos: 0 };
            STATE.notesTabs.push(newTab);
            STATE.notesActiveTab = newTab.id;
            save();
            toast(`${g.records.length} records → Notes`, 'success');
        });
        document.getElementById('glue-to-workspace')?.addEventListener('click', () => {
            let added = 0;
            g.records.forEach(rec => {
                if (!rec.card) return;
                const c = rec.card; const id = rec.identity || {};
                const geo = [id.city, id.state, id.country].filter(Boolean).join(', ');
                STATE.cards.push({
                    id: genId(), name: id.name || 'UNKNOWN', surname: id.surname || '',
                    cardNumber: c.ccn, month: c.mm, year: c.yy, cvv: c.cvv,
                    country: STATE.currentCountry, cardType: c.network || getCardType(c.ccn),
                    docType: '', amount: '',
                    notes: [geo, id.address, id.zip, id.dob, id.phone, id.email].filter(Boolean).join(' | '),
                    date: todayStr(), cardAdd: false, runAds: false, verified: false, starred: false,
                    mailVerify: false, mailSubmit: false, mailNone: false, readyToWork: true
                });
                added++;
            });
            if (added) { save(); toast(`${added} cards → Workspace`, 'success'); }
            else toast('No cards to add', 'warning');
        });
        document.getElementById('glue-export-txt')?.addEventListener('click', () => {
            const text = _ckFormatAllRecords();
            const blob = new Blob([text], { type: 'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `glue-export-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(a.href);
            toast('File downloaded', 'success');
        });
        document.getElementById('glue-back-3')?.addEventListener('click', () => { g.step = 2; _renderGlue(); });
        document.getElementById('glue-reset-all')?.addEventListener('click', () => { _ckGlueReset(); _renderGlue(); toast('Session reset', 'info'); });
    }
}

function renderChecker() {
    // Route to GLUE renderer if in glue mode
    if (_CK.mode === 'glue') { _renderGlue(); return; }

    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.style.display = 'none';
    bar.innerHTML = '';

    const modeIcons = { proxy: '🌐', bin: '🔢', card: '💳', ip: '📡', auto: '🔍', glue: '🔗' };
    const modeLabels = { proxy: 'Proxy', bin: 'BIN', card: 'Card', ip: 'IP', auto: 'Auto', glue: 'Glue' };
    const modePlaceholders = {
        proxy: 'Paste any text containing proxies — they will be extracted automatically\n\nSupported formats:\n• user:pass@host:port\n• host:port:user:pass\n• user:pass:host:port\n• protocol://user:pass@host:port\n• host:port\n• IP:PORT from logs, JSON, HTML\n\nGarbage text is ignored automatically',
        bin: 'Paste any text — BINs will be extracted automatically\n\n4242424242424242|11|26|777\nCard: 5326 1023 4355 9988\nCC: 4111111111111111 Exp: 05/26 CVV: 456\nRandom log text with 5454781003037335...\n\nAll formats supported • Duplicates removed\nOutput: /bin 424242',
        card: 'Paste ANY text — cards will be extracted automatically\n\nSupported formats:\n• 4242424242424242|03|27|111\n• 4242424242424242:03:27:111\n• 4242424242424242 03 27 111\n• 4242424242424242/03/27/111\n• Card: 4242... Exp: 03/27 CVV: 111\n• CC: 4242... MM: 03 YY: 27 CVC: 111\n• Mixed text with emoji 🔥 and garbage\n\nAuto-detects network • Deduplicates • Cleans garbage',
        ip: 'Paste any text — valid IPv4 addresses will be extracted\n\nExamples:\n192.168.1.1\nProxy: 56.233.33.4:8080\n{"ip": "10.0.0.1", "port": 3000}\n<div>Server: 172.16.0.5</div>\n\nValidated (0-255 per octet) • Duplicates removed\nOutput: /ip 192.168.1.1',
        auto: 'Paste ANY chaotic text — all data types will be extracted\n\nAuto-detects:\n• 💳 Cards (all formats)\n• 🔢 BINs (unique)\n• 📡 IP addresses (validated)\n• 🌐 Proxies\n\nPerfect for Ctrl+A from websites, logs, chat exports',
    };

    const tab = _CK.tabs[_CK.mode];
    const outLines = tab.output ? tab.output.split('\n').filter(Boolean).length : 0;

    area.innerHTML = `
    <div class="ck-container">
        <div class="ck-header">
            <div class="ck-title">
                <span class="ck-icon">⚡</span>
                <span>SMART CHECKER</span>
            </div>
            <div class="ck-modes">
                ${Object.keys(modeIcons).map(m => `
                    <button class="ck-mode-btn ${_CK.mode === m ? 'active' : ''}" data-mode="${m}">
                        <span class="ck-mode-icon">${modeIcons[m]}</span>
                        <span class="ck-mode-label">${modeLabels[m]}</span>
                    </button>
                `).join('')}
            </div>
        </div>

        ${_CK.mode === 'proxy' || _CK.mode === 'auto' ? `
        <div class="ck-proto-bar">
            <span class="ck-proto-label">Protocol:</span>
            <button class="ck-proto-btn ${_CK.proxyProto === 'socks5' ? 'active' : ''}" data-proto="socks5">SOCKS5</button>
            <button class="ck-proto-btn ${_CK.proxyProto === 'http' ? 'active' : ''}" data-proto="http">HTTP</button>
            <button class="ck-proto-btn ${_CK.proxyProto === 'https' ? 'active' : ''}" data-proto="https">HTTPS</button>
        </div>
        ` : ''}

        <div class="ck-workspace">
            <div class="ck-panel ck-input-panel">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">${modeIcons[_CK.mode]} INPUT</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count" id="ck-input-count">0 lines</span>
                        <button class="ck-action-btn" id="ck-paste-btn" title="Paste from clipboard">📋 Paste</button>
                        <button class="ck-action-btn ck-btn-danger" id="ck-clear-btn" title="Clear input">✕</button>
                    </div>
                </div>
                <textarea class="ck-textarea" id="ck-input" placeholder="${modePlaceholders[_CK.mode]}">${tab.input || ''}</textarea>
            </div>

            <div class="ck-center-actions">
                <button class="ck-convert-btn" id="ck-convert-btn">
                    <span class="ck-convert-arrow">→</span>
                    <span class="ck-convert-text">${_CK.mode === 'auto' ? 'EXTRACT' : 'FORMAT'}</span>
                </button>
            </div>

            <div class="ck-panel ck-output-panel">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">📤 OUTPUT</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count ${outLines > 0 ? 'ck-count-active' : ''}" id="ck-output-count">${outLines} results</span>
                        <button class="ck-action-btn ck-btn-copy" id="ck-copy-btn" title="Copy output" ${!outLines ? 'disabled' : ''}>📋 Copy</button>
                    </div>
                </div>
                <textarea class="ck-textarea ck-output-text" id="ck-output" readonly placeholder="Formatted output will appear here...">${tab.output || ''}</textarea>
            </div>
        </div>

        ${_CK.history.length > 0 ? `
        <div class="ck-history">
            <div class="ck-history-title">Recent Operations</div>
            <div class="ck-history-items">
                ${_CK.history.map(h => `
                    <div class="ck-history-item">
                        <span class="ck-history-icon">${modeIcons[h.mode]}</span>
                        <span class="ck-history-mode">${modeLabels[h.mode]}</span>
                        <span class="ck-history-count">${h.label || h.count + ' items'}</span>
                        <span class="ck-history-time">${h.time}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

    </div>
    `;

    // ── Bind events ──

    // Mode buttons
    area.querySelectorAll('.ck-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _ckSaveInput();
            _CK.mode = btn.dataset.mode;
            renderChecker();
        });
    });

    // Protocol buttons
    area.querySelectorAll('.ck-proto-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _CK.proxyProto = btn.dataset.proto;
            _ckSaveInput();
            const t = _CK.tabs[_CK.mode];
            if (t.input.trim() && (_CK.mode === 'proxy' || _CK.mode === 'auto')) {
                _ckProcess();
            }
            renderChecker();
        });
    });

    // Input textarea
    const inputEl = document.getElementById('ck-input');
    inputEl?.addEventListener('input', () => {
        _CK.tabs[_CK.mode].input = inputEl.value;
        const lines = inputEl.value.split('\n').filter(l => l.trim()).length;
        document.getElementById('ck-input-count').textContent = `${lines} lines`;
    });

    // Paste button
    document.getElementById('ck-paste-btn')?.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            _CK.tabs[_CK.mode].input = text;
            inputEl.value = text;
            const lines = text.split('\n').filter(l => l.trim()).length;
            document.getElementById('ck-input-count').textContent = `${lines} lines`;
            toast('Pasted from clipboard', 'success');
        } catch {
            toast('Clipboard access denied', 'error');
        }
    });

    // Clear button
    document.getElementById('ck-clear-btn')?.addEventListener('click', () => {
        _CK.tabs[_CK.mode].input = '';
        _CK.tabs[_CK.mode].output = '';
        renderChecker();
    });

    // Convert button
    document.getElementById('ck-convert-btn')?.addEventListener('click', () => {
        _ckSaveInput();
        if (!_CK.tabs[_CK.mode].input.trim()) {
            toast('Paste data first', 'error');
            return;
        }
        const count = _ckProcess();
        renderChecker();
        if (count > 0) {
            toast(`Extracted ${count} items`, 'success');
        } else {
            toast('No data found for this mode', 'warning');
        }
    });

    // Copy button
    document.getElementById('ck-copy-btn')?.addEventListener('click', () => {
        const output = _CK.tabs[_CK.mode].output;
        if (!output) return;
        navigator.clipboard.writeText(output).then(() => {
            toast('Copied to clipboard!', 'success');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = output;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast('Copied to clipboard!', 'success');
        });
    });

    // Update input line count on load
    if (inputEl && tab.input) {
        const lines = tab.input.split('\n').filter(l => l.trim()).length;
        document.getElementById('ck-input-count').textContent = `${lines} lines`;
    }
}

// Helper: save current input textarea value to state
function _ckSaveInput() {
    const inputEl = document.getElementById('ck-input');
    if (inputEl) _CK.tabs[_CK.mode].input = inputEl.value;
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

    if (STATE.currentView === 'checker') {
        renderChecker();
        footer.style.display = 'none';
        return;
    }

    if (STATE.currentView === 'builder') {
        renderBuilder();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'analytics') {
        renderAnalytics();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'bookmarks') {
        renderBookmarks();
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
        // (translated)
        // (translated)
        const _nameTrimmed = (c.name + ' ' + c.surname).trim().toUpperCase();
        const _nameEsc = _nameTrimmed.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const nameUsageBadge = (!isAllCards && c._nameUsage && c._nameUsage > 1)
            ? `<span class="usage-badge usage-name name-drawer-trigger" data-name="${_nameEsc}" title="Name appears ${c._nameUsage} times">👤${c._nameUsage}</span>`
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
                        <button class="status-btn btn-d ${c.docReady ? 'active' : ''}" onclick="toggleStatus('${c.id}','docReady')" title="Documents">D</button>
                        <button class="status-btn btn-w ${c.waterBill ? 'active' : ''}" onclick="toggleStatus('${c.id}','waterBill')" title="Water Bill">W</button>
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

    // Name drawer triggers (use data-name to avoid apostrophe/quote issues in inline onclick)
    area.querySelectorAll('.name-drawer-trigger').forEach(badge => {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            _showNameDrawer(badge.dataset.name, badge);
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

    // Count how many times each BIN appears across all cards
    const binUsageMap = {};
    STATE.cards.forEach(c => {
        const b = getBin(c.cardNumber);
        if (b) binUsageMap[b] = (binUsageMap[b] || 0) + 1;
    });

    let rows = pageCards.map((c, idx) => {
        const bin = getBin(c.cardNumber);
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const info = getBinInfo(bin);
        const binTxt = formatBinInfoText(info);
        const useCount = c._cardUsage || 1;
        const binUseCount = binUsageMap[bin] || 1;
        const lastDate = c._lastDate || c.date || '—';
        const cardNum = c.cardNumber.replace(/\s/g, '');
        // Numbering starts at 1 for each page
        const rowNum = idx + 1;

        return `
        <tr class="ac-row ${_selectedCards.has(c.id) ? 'row-selected' : ''}" data-id="${c.id}" data-cardnum="${cardNum}">
            <td class="td-num" onclick="event.stopPropagation()"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="${c.id}" ${_selectedCards.has(c.id) ? 'checked' : ''} onchange="toggleCardSelect('${c.id}', this.checked)"></label></td>
            <td>
                <div class="card-cell">
                    <span class="card-name"><span class="flag">${flag}</span> ${maskCard(c.cardNumber)}</span>
                    ${binTxt ? `<span class="bin-info">${binTxt}</span>` : ''}
                </div>
            </td>
            <td class="bin-cell">${bin}</td>
            <td class="use-cell" style="${getUseColor(useCount)}">${useCount}x</td>
            <td class="use-cell" style="${getUseColor(binUseCount)}">${binUseCount}</td>
            <td>
                <div class="status-btns">
                    <span class="status-btn btn-a ${c.cardAdd ? 'active' : ''}">A</span>
                    <span class="status-btn btn-r ${c.runAds ? 'active' : ''}">R</span>
                    <span class="status-btn btn-v ${c.verified ? 'active' : ''}">V</span>
                </div>
            </td>
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
                    <th><label class="bulk-check"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label></th>
                    <th class="sortable" data-sort="name">Card ${sortIcon('name')}</th>
                    <th class="sortable" data-sort="bin">BIN ${sortIcon('bin')}</th>
                    <th class="sortable" data-sort="status">Use ${sortIcon('status')}</th>
                    <th>BIN Use</th>
                    <th>Status</th>
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
// All Cards drawer removed — no expand on click
window._toggleAllCardsDrawer = function () {};

// Documents drawer removed — no expand on click
window._toggleDocDrawer = function () {};

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
        return `
        <tr class="doc-row ${_selectedCards.has(d.id) ? 'row-selected' : ''}" data-id="${d.id}">
            <td class="td-num" onclick="event.stopPropagation()"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="${d.id}" ${_selectedCards.has(d.id) ? 'checked' : ''} onchange="toggleCardSelect('${d.id}', this.checked)"></label></td>
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
            <td>
                <div class="vs-counters" onclick="event.stopPropagation()">
                    <button class="doc-vs-btn vs-v${(d.verified || 0) === 0 ? ' vs-zero' : ''}" data-doc-id="${d.id}" data-vs="v" onclick="incrementDocV('${d.id}')" oncontextmenu="decrementDocV('${d.id}'); return false;"><span class="vs-label">V</span><span class="vs-num">${d.verified || 0}</span></button>
                    <button class="doc-vs-btn vs-s${(d.suspended || 0) === 0 ? ' vs-zero' : ''}" data-doc-id="${d.id}" data-vs="s" onclick="incrementDocS('${d.id}')" oncontextmenu="decrementDocS('${d.id}'); return false;"><span class="vs-label">S</span><span class="vs-num">${d.suspended || 0}</span></button>
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
                    <th><label class="bulk-check"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label></th>
                    <th class="sortable-doc" data-sort="name">Name ${docSortIcon('name')}</th>
                    <th class="sortable-doc" data-sort="notes">Notes ${docSortIcon('notes')}</th>
                    <th class="sortable-doc" data-sort="type">Type ${docSortIcon('type')}</th>
                    <th class="sortable-doc" data-sort="geo">Geo ${docSortIcon('geo')}</th>
                    <th class="sortable-doc" data-sort="use">Use ${docSortIcon('use')}</th>
                    <th class="sortable-doc" data-sort="vs">Status ${docSortIcon('vs')}</th>
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

    // Build dropdown items separately to avoid nested template literal issues
    const dropdownItemsHTML = tabs.map(t => {
        const linesCount = (t.content || '').split('\n').length;
        const isActive = t.id === STATE.notesActiveTab;
        return '<button class="nt-dropdown-item ' + (isActive ? 'active' : '') + '" data-tab="' + t.id + '">'
            + (isActive ? '✓ ' : '') + t.title + ' <span class="nt-item-lines">(' + linesCount + ' lines)</span>'
            + '</button>';
    }).join('');

    tabsHTML += `
        <div class="nt-dropdown-wrap">
            <button class="nt-dropdown-btn" id="nt-all-notes-btn">All Notes (${tabs.length}) ▾</button>
            <div class="nt-dropdown-menu hidden" id="nt-all-notes-menu">
                <div class="nt-dropdown-list">${dropdownItemsHTML}</div>
                <div class="nt-dropdown-divider"></div>
                <div class="nt-dropdown-actions">
                    <button class="nt-dropdown-action" id="nt-close-all">Close All</button>
                    <button class="nt-dropdown-action" id="nt-close-others">Close Others</button>
                </div>
            </div>
        </div>
    `;

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
        STATE.notesTabs.unshift(newTab);
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

    // Dropdown events
    const allNotesBtn = document.getElementById('nt-all-notes-btn');
    const allNotesMenu = document.getElementById('nt-all-notes-menu');
    if (allNotesBtn && allNotesMenu) {
        allNotesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            allNotesMenu.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.nt-dropdown-wrap')) {
                allNotesMenu.classList.add('hidden');
            }
        });
        allNotesMenu.querySelectorAll('.nt-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                _saveActiveTab();
                STATE.notesActiveTab = item.dataset.tab;
                save();
                renderNotes();
            });
        });
        document.getElementById('nt-close-all')?.addEventListener('click', () => {
            if (!confirm('Close all tabs?')) return;
            const newTab = { id: 'tab-' + Date.now(), title: 'Main', content: '', created: Date.now(), scrollPos: 0 };
            STATE.notesTabs = [newTab];
            STATE.notesActiveTab = newTab.id;
            save();
            renderNotes();
        });
        document.getElementById('nt-close-others')?.addEventListener('click', () => {
            const active = STATE.notesTabs.find(t => t.id === STATE.notesActiveTab);
            if (!active) return;
            if (!confirm('Close all other tabs?')) return;
            STATE.notesTabs = [active];
            save();
            renderNotes();
        });
    }
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
        case 'builder':
            flagEl.textContent = '🏗️';
            titleEl.textContent = 'Builder';
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
    const country = STATE.countries.find(c => c.id === id);
    if (!country) return;
    STATE.cards = STATE.cards.filter(c => c.country !== id);
    STATE.docs = STATE.docs.filter(d => d.country !== id);
    STATE.trash = STATE.trash.filter(c => c.country !== id);
    STATE.countries = STATE.countries.filter(c => c.id !== id);
    save();
    if (STATE.currentCountry === id) {
        const next = STATE.countries[0]?.id || 'canada';
        navigate('cards', next);
    } else {
        renderAll();
    }
    toast(`Country "${country.name}" deleted`, 'info');
};

function _confirmDeleteCountry(id) {
    const country = STATE.countries.find(c => c.id === id);
    if (!country) return;
    const cardCount = STATE.cards.filter(c => c.country === id).length;
    const docCount = STATE.docs.filter(d => d.country === id).length;

    document.getElementById('confirm-del-country')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'confirm-del-country';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal modal-sm">
            <div class="modal-header">
                <h3>Delete country?</h3>
                <button class="modal-close" id="cdc-close">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                </button>
            </div>
            <div class="modal-body" style="padding:16px 20px">
                <p style="margin:0 0 8px;font-size:13px;color:var(--text-secondary)">You are about to delete <b>${country.flag} ${country.name}</b>.</p>
                <p style="margin:0 0 8px;font-size:12px;color:var(--text-muted)">This will permanently remove <b>${cardCount}</b> cards and <b>${docCount}</b> documents inside this country.</p>
                <p style="margin:0;font-size:11px;color:var(--red)">This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" id="cdc-cancel">Cancel</button>
                <button class="btn-primary" id="cdc-delete" style="background:#EF4444;color:#fff">Delete</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    document.getElementById('cdc-close').onclick = close;
    document.getElementById('cdc-cancel').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.getElementById('cdc-delete').onclick = () => {
        close();
        deleteCountry(id);
    };
}



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
            const btnD = row.querySelector('.status-btn.btn-d');
            const btnW = row.querySelector('.status-btn.btn-w');
            const btnM = row.querySelector('.status-btn.btn-m');
            if (btnA) btnA.classList.toggle('active', card.cardAdd);
            if (btnR) btnR.classList.toggle('active', card.runAds);
            if (btnV) btnV.classList.toggle('active', card.verified);
            if (btnD) btnD.classList.toggle('active', card.docReady);
            if (btnW) btnW.classList.toggle('active', card.waterBill);
            if (btnM) btnM.classList.toggle('active', card.minic);
        }

        // Update stat counters in-place
        updateStatsInPlace();
        updateSidebarBadges();

        const labels = { cardAdd: 'Card Add', runAds: 'Run Ads', verified: 'Verified', docReady: 'Documents', waterBill: 'Water Bill', minic: 'Minic' };
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

// (translated)
function _enableDrawerScroll(drawerTr) {
    const content = drawerTr.querySelector('.drawer-content');
    if (!content) return;
    content.addEventListener('animationend', () => {
        content.classList.add('drawer-open');
    }, { once: true });
}

function _drawerStatusHtml(c) {
    return `<div class="status-btns">
        <span class="status-btn btn-a ${c.cardAdd ? 'active' : ''}">A</span>
        <span class="status-btn btn-r ${c.runAds ? 'active' : ''}">R</span>
        <span class="status-btn btn-v ${c.verified ? 'active' : ''}">V</span>
        <span class="status-btn btn-d ${c.docReady ? 'active' : ''}">D</span>
        <span class="status-btn btn-w ${c.waterBill ? 'active' : ''}">W</span>
        <span class="status-btn btn-m ${c.minic ? 'active' : ''}">M</span>
    </div>`;
}

window._showCardDrawer = function (cardNum, el) {
    const existing = document.querySelector('.expand-drawer');
    if (existing) {
        const wasForSame = existing.dataset.key === 'card:' + cardNum;
        existing.remove();
        if (wasForSame) return;
    }

    // Filter: strict match by card number
    const matches = STATE.cards.filter(c => c.cardNumber.replace(/[\s\-]/g, '') === cardNum);
    if (matches.length <= 1) return;

    // Card is the same — show different NAMES prominently
    const rowsHtml = matches.map(c => {
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const fullName = (c.name + ' ' + c.surname).trim().toUpperCase() || '—';
        return `<div class="drawer-row">
            <span class="drawer-flag">${flag}</span>
            <span class="drawer-name">${fullName}</span>
            <span class="drawer-card">${maskCard(c.cardNumber)}</span>
            <span class="drawer-status">${_drawerStatusHtml(c)}</span>
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
            <div class="drawer-top-bar">
                <div class="drawer-header">📇 ${matches.length} records with card <span style="font-family:monospace;opacity:0.7">${maskCard(cardNum)}</span></div>
                <button class="drawer-close-btn" onclick="this.closest('.expand-drawer').remove()">✕</button>
            </div>
            ${rowsHtml}
        </div>
    </td>`;
    tr.after(drawerTr);
    _enableDrawerScroll(drawerTr);
};

window._showNameDrawer = function (fullName, el) {
    const existing = document.querySelector('.expand-drawer');
    if (existing) {
        const wasForSame = existing.dataset.key === 'name:' + fullName;
        existing.remove();
        if (wasForSame) return;
    }

    // Normalization: trim() removes extra spaces (e.g. if surname = '')
    const normalizedName = fullName.trim().toUpperCase();
    const matches = STATE.cards.filter(c =>
        (c.name + ' ' + c.surname).trim().toUpperCase() === normalizedName
    );
    if (matches.length <= 1) return;

    // Name is the same — show different CARDS prominently
    const rowsHtml = matches.map(c => {
        const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';
        const bin = getBin(c.cardNumber);
        const binInfo = getBinInfo(bin);
        const binTxt = formatBinInfoText(binInfo);
        return `<div class="drawer-row">
            <span class="drawer-flag">${flag}</span>
            <span class="drawer-card drawer-card-primary">${maskCard(c.cardNumber)}</span>
            <span class="drawer-name drawer-name-dim">${binTxt || bin}</span>
            <span class="drawer-status">${_drawerStatusHtml(c)}</span>
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
            <div class="drawer-top-bar">
                <div class="drawer-header">👤 ${matches.length} cards for <span style="color:var(--accent);font-weight:600">${normalizedName}</span></div>
                <button class="drawer-close-btn" onclick="this.closest('.expand-drawer').remove()">✕</button>
            </div>
            ${rowsHtml}
        </div>
    </td>`;
    tr.after(drawerTr);
    _enableDrawerScroll(drawerTr);
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
    // (translated)
    ids.forEach(id => removeCardFromDocs(id));
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
            // (translated)
            removeCardFromDocs(card.id);
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

    // (translated)
    if (STATE.currentView === 'docs' || STATE.currentView === 'global-docs') {
        updateDocStats();
        return;
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
        if (statCards.length >= 7) {
            statCards[0].querySelector('.stat-value').textContent = s.total;
            statCards[1].querySelector('.stat-value').textContent = s.cardAdd;
            statCards[2].querySelector('.stat-value').textContent = s.runAds;
            statCards[3].querySelector('.stat-value').textContent = s.verified;
            statCards[4].querySelector('.stat-value').textContent = s.docReady;
            statCards[5].querySelector('.stat-value').textContent = s.waterBill;
            statCards[6].querySelector('.stat-value').textContent = s.minic;
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
// (translated)
// (translated)
function updateDocStatsBar() {
    updateDocStats();
}

window.incrementDocV = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.verified = (doc.verified || 0) + 1;
    save();
    const el = document.querySelector(`.doc-vs-btn[data-doc-id="${docId}"][data-vs="v"] .vs-num`);
    if (el) el.textContent = doc.verified;
    updateDocStatsBar();
};

window.incrementDocS = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.suspended = (doc.suspended || 0) + 1;
    save();
    const el = document.querySelector(`.doc-vs-btn[data-doc-id="${docId}"][data-vs="s"] .vs-num`);
    if (el) el.textContent = doc.suspended;
    updateDocStatsBar();
};

window.decrementDocV = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.verified = Math.max(0, (doc.verified || 0) - 1);
    save();
    const el = document.querySelector(`.doc-vs-btn[data-doc-id="${docId}"][data-vs="v"] .vs-num`);
    if (el) el.textContent = doc.verified;
    updateDocStatsBar();
};

window.decrementDocS = function (docId) {
    const doc = STATE.docs.find(d => d.id === docId);
    if (!doc) return;
    doc.suspended = Math.max(0, (doc.suspended || 0) - 1);
    save();
    const el = document.querySelector(`.doc-vs-btn[data-doc-id="${docId}"][data-vs="s"] .vs-num`);
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

            // (translated)
            // (translated)
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
                cardIds: [],   // (translated)
                use: 0,        // (translated)
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
    // (translated)
    if (STATE.currentView === 'docs' || STATE.currentView === 'global-docs') {
        openDocModal();
    // (translated)
    } else if (STATE.currentView === 'all-cards') {
        openAddCardOnlyModal();
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

// (translated)
function openAddCardOnlyModal() {
    // (translated)
    document.getElementById('ac-only-modal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ac-only-modal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal modal-sm">
            <div class="modal-header">
                <h3>ADD CARD — ALL CARDS ONLY</h3>
                <p class="modal-subtitle">This card will be added to All Cards only. Workspace and Documents are not affected.</p>
                <button class="modal-close" id="ac-only-close">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="form-row">
                    <div class="form-group full-width">
                        <label>Country</label>
                        <select id="ac-only-country" class="form-select">
                            ${STATE.countries.map(c => `<option value="${c.id}" ${c.id === STATE.currentCountry ? 'selected' : ''}>${c.flag} ${c.name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group full-width card-number-group">
                        <label>Card Number *</label>
                        <input type="text" id="ac-only-card" placeholder="0000 0000 0000 0000" maxlength="19" autocomplete="off">
                        <span id="ac-only-badge" class="card-type-badge"></span>
                    </div>
                </div>
                <div class="form-row three-col">
                    <div class="form-group">
                        <label>Month *</label>
                        <input type="text" id="ac-only-month" placeholder="MM" maxlength="2">
                    </div>
                    <div class="form-group">
                        <label>Year *</label>
                        <input type="text" id="ac-only-year" placeholder="YY" maxlength="2">
                    </div>
                    <div class="form-group">
                        <label>CVV *</label>
                        <input type="password" id="ac-only-cvv" placeholder="•••" maxlength="4">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group full-width">
                        <label>Notes</label>
                        <input type="text" id="ac-only-notes" placeholder="Notes (optional)...">
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" id="ac-only-cancel">Cancel</button>
                <button class="btn-primary" id="ac-only-save">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
                    Add to All Cards
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    document.getElementById('ac-only-close').onclick = close;
    document.getElementById('ac-only-cancel').onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // (translated)
    document.getElementById('ac-only-card').addEventListener('input', function () {
        this.value = formatCardInput(this.value);
        document.getElementById('ac-only-badge').textContent = getCardType(this.value);
    });

    // Close on Escape
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    // Save
    document.getElementById('ac-only-save').onclick = () => {
        const cardNum = document.getElementById('ac-only-card').value.replace(/\s/g, '');
        const month   = document.getElementById('ac-only-month').value.trim();
        const year    = document.getElementById('ac-only-year').value.trim();
        const cvv     = document.getElementById('ac-only-cvv').value.trim();
        const country = document.getElementById('ac-only-country').value;
        const notes   = document.getElementById('ac-only-notes').value.trim();

        if (cardNum.length < 13 || !month || !year || !cvv) {
            toast('Fill in all required fields', 'error');
            return;
        }

        // (translated)
        const exists = STATE.cards.some(c => c.cardNumber.replace(/[\s\-]/g, '') === cardNum);
        if (exists) {
            toast('This card already exists', 'warning');
            return;
        }

        // (translated)
        const card = {
            id: genId(),
            name: '', surname: '',
            cardNumber: cardNum,
            month, year, cvv,
            cardType: getCardType(cardNum),
            amount: 0, notes,
            country,
            standaloneCard: true,   // Flag: All Cards only
            cardAdd: false, runAds: false, verified: false,
            suspended: false, starred: false,
            date: todayStr(),
        };

        STATE.cards.unshift(card);
        save();
        close();
        renderAll();
        toast('Card added to All Cards', 'success');
    };

    // (translated)
    setTimeout(() => document.getElementById('ac-only-card')?.focus(), 80);
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
            STATE.notesTabs.unshift(newTab);
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
                STATE.notesTabs.unshift(importedTab);
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
    // (translated)
    testMode: false,
    // (translated)
    filters: { bins: '', country: '', bank: '', minExpiry: '', activeTypes: [], activeNetworks: [], filterTypes: new Set(), filterClasses: new Set(), filterPaymentSystems: new Set() }
};

// (translated)
function _loadBinRotationIndex() {
    try {
        const raw = localStorage.getItem('binRotationIndex');
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function _saveBinRotationIndex(index) {
    try {
        localStorage.setItem('binRotationIndex', JSON.stringify(index));
    } catch { /* ignore */ }
}

/**
 * (translated)
 * (translated)
 * @param {Array} cards - filtered card list
 * (translated)
 * @returns {Array} - array of cards, one per unique BIN
 */
function _applyTestMode(cards, advance) {
    // (translated)
    const binMap = {};
    cards.forEach(c => {
        const bin = (c.bin || (c.cc || '').replace(/[\s\-]/g, '').slice(0, 6));
        if (!binMap[bin]) binMap[bin] = [];
        binMap[bin].push(c);
    });

    // (translated)
    const rotationIndex = _loadBinRotationIndex();

    // (translated)
    const result = [];
    Object.entries(binMap).forEach(([bin, binCards]) => {
        let idx = rotationIndex[bin] || 0;
        // (translated)
        if (idx >= binCards.length) idx = 0;
        result.push(binCards[idx]);
        // (translated)
        if (advance) {
            rotationIndex[bin] = (idx + 1) % binCards.length;
        }
    });

    // Save results and render
    if (advance) {
        _saveBinRotationIndex(rotationIndex);
    }

    return result;
}

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
            <!-- Filtering system -->
            <div class="parser-filter-levels" id="parser-filter-levels">
                <!-- Level 1 — Card Type -->
                <div class="parser-filter-level">
                    <span class="parser-filter-level-label">TYPE</span>
                    <div class="parser-filter-level-btns">
                        ${['CREDIT','DEBIT','PREPAID','BUSINESS'].map(t =>
                            `<button class="parser-level-btn${PARSER_STATE.filters.filterTypes.has(t) ? ' active' : ''}" data-filter-type="${t}">${t}</button>`
                        ).join('')}
                    </div>
                </div>
                <!-- Level 2 — Card Class -->
                <div class="parser-filter-level">
                    <span class="parser-filter-level-label">CLASS</span>
                    <div class="parser-filter-level-btns">
                        ${['CLASSIC','STANDARD','GOLD','PLATINUM','TITANIUM','SIGNATURE','WORLD','WORLD_ELITE','INFINITE','BLACK','ELECTRON','MAESTRO'].map(t =>
                            `<button class="parser-level-btn${PARSER_STATE.filters.filterClasses.has(t) ? ' active' : ''}" data-filter-class="${t}">${t.replace('_',' ')}</button>`
                        ).join('')}
                    </div>
                </div>
                <!-- Level 3 — Payment Network -->
                <div class="parser-filter-level">
                    <span class="parser-filter-level-label">NETWORK</span>
                    <div class="parser-filter-level-btns">
                        ${['VISA','MASTERCARD','AMEX','DISCOVER','UNIONPAY'].map(t =>
                            `<button class="parser-level-btn${PARSER_STATE.filters.filterPaymentSystems.has(t) ? ' active' : ''}" data-filter-network="${t}">${t}</button>`
                        ).join('')}
                    </div>
                </div>
                <!-- Filter actions (Reset and TEST MODE) -->
                <div class="parser-filter-actions-row">
                    <button class="parser-filter-reset-btn" id="parser-filter-reset" title="Reset all filters">⟲ Reset</button>
                    <!-- TEST MODE: unique BIN rotation testing -->
                    <button class="parser-test-mode-btn${PARSER_STATE.testMode ? ' active' : ''}" id="parser-test-mode" title="Test Mode: one card per unique BIN with rotation">🧪 TEST MODE</button>
                </div>
        </div>

        <!-- ACTION BAR -->
        <div class="pz-actions">
            <button class="pz-btn pz-btn-primary" id="parser-parse-btn" ${hasBase ? '' : 'disabled'}>⚡ PARSE & CLEAN</button>
            <button class="pz-btn pz-btn-dim" id="parser-clear-btn">CLEAR</button>
            <button class="pz-btn pz-btn-trash" id="parser-trash-btn">🗑 TRASH (${(STATE.trashCards || []).length})</button>
            <button class="pz-btn pz-btn-valid" id="parser-valid-btn">✅ VALID CARDS</button>
            <button class="pz-btn pz-btn-today" id="parser-today-btn">📅 TODAY CARDS</button>
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
            <span class="ps-item ps-test" id="ps-test-mode" style="display:none">🧪 Test: <strong id="ps-test-cards">0</strong> cards (<strong id="ps-test-bins">0</strong> BINs)</span>
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
        // (translated)
        PARSER_STATE.testMode = false;
        localStorage.removeItem('ct_parser_base');
        renderParser();
        toast('Parser cleared', 'info');
    });

    // ── TRASH BUTTON ──
    document.getElementById('parser-trash-btn')?.addEventListener('click', () => {
        const overlay = document.getElementById('trash-cards-overlay');
        if (overlay) overlay.classList.remove('hidden');
    });

    // ── VALID CARDS BUTTON ──
    document.getElementById('parser-valid-btn')?.addEventListener('click', () => {
        const overlay = document.getElementById('valid-cards-overlay');
        if (overlay) overlay.classList.remove('hidden');
    });

    // (translated)
    document.getElementById('parser-today-btn')?.addEventListener('click', () => {
        _openTodayCardsModal();
    });
    // (translated)
    document.querySelectorAll('.parser-level-btn[data-filter-type]').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.filterType;
            // (translated)
            if (PARSER_STATE.filters.filterTypes.has(val)) {
                PARSER_STATE.filters.filterTypes.delete(val);
                btn.classList.remove('active');
            } else {
                PARSER_STATE.filters.filterTypes.add(val);
                btn.classList.add('active');
            }
            _saveParserFilters();
        });
    });
    document.querySelectorAll('.parser-level-btn[data-filter-class]').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.filterClass;
            if (PARSER_STATE.filters.filterClasses.has(val)) {
                PARSER_STATE.filters.filterClasses.delete(val);
                btn.classList.remove('active');
            } else {
                PARSER_STATE.filters.filterClasses.add(val);
                btn.classList.add('active');
            }
            _saveParserFilters();
        });
    });
    document.querySelectorAll('.parser-level-btn[data-filter-network]').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.filterNetwork;
            if (PARSER_STATE.filters.filterPaymentSystems.has(val)) {
                PARSER_STATE.filters.filterPaymentSystems.delete(val);
                btn.classList.remove('active');
            } else {
                PARSER_STATE.filters.filterPaymentSystems.add(val);
                btn.classList.add('active');
            }
            _saveParserFilters();
        });
    });
    // (translated)
    document.getElementById('parser-filter-reset')?.addEventListener('click', () => {
        PARSER_STATE.filters.filterTypes.clear();
        PARSER_STATE.filters.filterClasses.clear();
        PARSER_STATE.filters.filterPaymentSystems.clear();
        document.querySelectorAll('.parser-level-btn').forEach(b => b.classList.remove('active'));
        // (translated)
        PARSER_STATE.testMode = false;
        const tmBtn = document.getElementById('parser-test-mode');
        if (tmBtn) tmBtn.classList.remove('active');
        _saveParserFilters();
        toast('Filters reset', 'info');
    });
    
    // Save filters on text field input
    ['parser-bins', 'parser-country', 'parser-bank', 'parser-min-expiry'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', _saveParserFilters);
    });

    // (translated)
    document.getElementById('parser-test-mode')?.addEventListener('click', () => {
        PARSER_STATE.testMode = !PARSER_STATE.testMode;
        const btn = document.getElementById('parser-test-mode');
        if (btn) btn.classList.toggle('active', PARSER_STATE.testMode);

        if (PARSER_STATE.testMode && PARSER_STATE.collected.length > 0) {
            // On each click advance rotation (advance=true)
            _applyTestMode(PARSER_STATE.collected, true);
            toast('🧪 TEST MODE: BIN rotation updated', 'info');
        } else if (!PARSER_STATE.testMode) {
            toast('TEST MODE disabled', 'info');
        }

        // Re-render results with TEST MODE applied
        if (PARSER_STATE.collected.length > 0) {
            renderParserResults();
        }
    });

    _initTrashCardModal();
    _initTrashTabs();        // (translated)
    _initTodayCardsModal(); // (translated)
    _initValidCardsModal();

    // (translated)
    if (VALID_STATE.cards.length > 0) {
        renderValidCardsResults();
    } else if (hasParsed) {
        renderParserResults();
    }
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
    // Dedup internal duplicates
    const seen = new Set();
    const beforeDedup = cards.length;
    cards = cards.filter(c => {
        const cc = (c.cc || '').replace(/[\s\-]/g, '');
        if (seen.has(cc)) return false;
        seen.add(cc);
        return true;
    });
    const dupRemoved = beforeDedup - cards.length;

    if (PARSER_STATE._pipelineStats) {
        PARSER_STATE._pipelineStats.compareRemoved = compareRemoved;
        PARSER_STATE._pipelineStats.workspaceRemoved = workspaceRemoved;
        PARSER_STATE._pipelineStats.dupRemoved = dupRemoved;
    }

    PARSER_STATE.collected = cards;
    PARSER_STATE.selected = new Set(cards.map((_, i) => i));
    _rebuildBinGroups();
}

function _initTrashCardModal() {
    const overlay = document.getElementById('trash-cards-overlay');
    if (!overlay) return;

    const textarea = document.getElementById('trash-cards-textarea');
    const detectedEl = document.getElementById('trash-cards-detected');
    const closeBtn = document.getElementById('trash-cards-close');
    const cancelBtn = document.getElementById('trash-cards-cancel');
    const saveBtn = document.getElementById('trash-cards-save');
    const fileInput = document.getElementById('trash-cards-file');

    const closeModal = () => overlay.classList.add('hidden');
    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    const updateDetected = () => {
        const result = _extractTrashCards(textarea.value);
        detectedEl.textContent = result.hasMarkers
            ? `💀 ${result.deadCards.length} DEAD/INVALID · ✅ ${result.aliveCount} ALIVE`
            : `${result.deadCards.length} cards detected`;
    };
    textarea?.addEventListener('input', updateDetected);

    if (fileInput) {
        fileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                textarea.value = (textarea.value ? textarea.value + '\n' : '') + ev.target.result;
                updateDetected();
                toast(`Loaded ${file.name}`, 'success');
            };
            reader.readAsText(file);
            fileInput.value = ''
        });
    }

    // (translated)
    // (translated)
    const miniParserInput = document.getElementById('trash-mini-parser-file');
    if (miniParserInput) {
        miniParserInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    // Extract message text from Telegram JSON
                    const messages = Array.isArray(data) ? data : (data.messages || []);
                    if (messages.length === 0) {
                        toast(`${file.name}: no messages found in file`, 'warning');
                        return;
                    }
                    const msgLines = [];
                    messages.forEach(msg => {
                        if (!msg) return;
                        let text = '';
                        if (typeof msg.text === 'string') { text = msg.text; }
                        else if (Array.isArray(msg.text)) {
                            text = msg.text.map(t => (typeof t === 'string' ? t : (t.text || ''))).join('');
                        }
                        if (text.trim()) msgLines.push(text.trim());
                    });
                    if (msgLines.length === 0) {
                        toast(`${file.name}: no text found in messages`, 'warning');
                        return;
                    }
                    const combinedText = msgLines.join('\n');
                    // Run multiformat parser
                    const parsed = _parseMultiFormat(combinedText);
                    const fmtLabel = parsed.format;
                    if (parsed.totalParsed === 0) {
                        detectedEl.textContent = `Format: ${fmtLabel} · Nothing recognized (${messages.length} messages)`;
                        toast(`${file.name}: checker format not recognized`, 'warning');
                        return;
                    }
                    // Deduplicate against existing trash list
                    const existingSet = new Set((STATE.trashCards || []).map(n => n.replace(/\s/g, '')));
                    let added = 0, dupes = 0;
                    parsed.trashCards.forEach(cc => {
                        if (!existingSet.has(cc)) {
                            STATE.trashCards.push(cc);
                            existingSet.add(cc);
                            added++;
                        } else { dupes++; }
                    });
                    if (added > 0) {
                        save();
                        const trashBtn = document.getElementById('parser-trash-btn');
                        if (trashBtn) trashBtn.textContent = `🗑 TRASH (${STATE.trashCards.length})`;
                        // Restart pipeline to account for new trash cards
                        if (PARSER_STATE.rawMessages.length > 0) runParse();
                    }
                    // Show summary
                    let summary = `Format: ${fmtLabel} · Total: ${parsed.totalParsed} · Trash: +${added} · Valid skipped: ${parsed.validCount}`;
                    if (dupes > 0) summary += ` · Dupes: ${dupes}`;
                    detectedEl.textContent = summary;
                    if (added > 0) toast(`${file.name}: +${added} trash (${fmtLabel}) · valid: ${parsed.validCount} skipped`, 'success');
                    else if (dupes > 0) toast(`${file.name}: all cards already in trash (${dupes} dupes)`, 'info');
                    else toast(`${file.name}: no trash cards found (${parsed.validCount} valid skipped)`, 'info');
                } catch (err) {
                    toast(`${file.name}: error — ${err.message}`, 'error');
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
        STATE.notesTabs.unshift(newTab);
        STATE.notesActiveTab = newTab.id;
        save();
        closeModal();
        // Switch to Notes tab
        document.querySelector('[data-view="notes"]')?.click();
        toast(`Trash list (${cards.length} cards) opened in Notes`, 'success');
    });
}

// ═══════════════════════════════════════════════════════════════════
// (translated)
// (translated)
// ═══════════════════════════════════════════════════════════════════

/* (translated) */
const CML_STATE = {
    cleanCards:   [], // (translated)
    trashMatches: [], // (translated)
    stats: null       // { checked, foundTrash, clean, dupes }
};

/**
 * (translated)
 * (translated)
 */
function _initTrashTabs() {
    const overlay = document.getElementById('trash-cards-overlay');
    if (!overlay) return;

    const tabs    = overlay.querySelectorAll('.trash-tab');
    const panels  = overlay.querySelectorAll('.trash-tab-panel');
    const subtitle = document.getElementById('trash-modal-subtitle');
    const subtitles = {
        add:   'Paste checker output — collects 💀 DEAD and ❌ INVALID cards',
        check: 'Check your card list against the saved trash database'
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            // Active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            // (translated)
            panels.forEach(p => {
                const id = p.id.replace('trash-tab-', '');
                p.classList.toggle('hidden', id !== target);
            });
            // (translated)
            if (subtitle) subtitle.textContent = subtitles[target] || '';
        });
    });

    // (translated)
    _initCheckMyList();
}

/**
 * (translated)
 * (translated)
 */
function _initCheckMyList() {
    const textarea     = document.getElementById('cml-textarea');
    const checkBtn     = document.getElementById('cml-check-btn');
    const clearBtn     = document.getElementById('cml-clear-btn');
    const closeBtn     = document.getElementById('cml-close-btn');
    const inputCount   = document.getElementById('cml-input-count');
    const statsEl      = document.getElementById('cml-stats');
    const resultsEl    = document.getElementById('cml-results');
    const trashListEl  = document.getElementById('cml-trash-list');
    const cleanListEl  = document.getElementById('cml-clean-list');
    const copyTrashBtn = document.getElementById('cml-copy-trash');
    const copyCleanBtn = document.getElementById('cml-copy-clean');
    const exportNotes  = document.getElementById('cml-export-notes');
    const overlay      = document.getElementById('trash-cards-overlay');

    if (!textarea || !checkBtn) return;

    // (translated)
    closeBtn?.addEventListener('click', () => overlay?.classList.add('hidden'));

    // (translated)
    textarea.addEventListener('input', () => {
        const lines = textarea.value.split('\n').filter(l => l.trim().match(/\d{13,19}/));
        if (inputCount) inputCount.textContent = lines.length > 0 ? `${lines.length} lines detected` : '';
    });

    // (translated)
    clearBtn?.addEventListener('click', () => {
        textarea.value = '';
        if (inputCount) inputCount.textContent = '';
        statsEl.style.display  = 'none';
        resultsEl.style.display = 'none';
        CML_STATE.cleanCards   = [];
        CML_STATE.trashMatches = [];
        CML_STATE.stats        = null;
    });

    // (translated)
    checkBtn.addEventListener('click', () => {
        const raw = textarea.value;
        if (!raw.trim()) { toast('Paste your cards first', 'warning'); return; }

        // (translated)
        const trashSet = new Set((STATE.trashCards || []).map(n => n.replace(/[\s\-]/g, '')));

        const seenCC = new Set();
        let dupes = 0;
        const clean   = [];
        const matched = [];

        // (translated)
        const inputLines = raw.split(/\r?\n/);
        inputLines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const m = trimmed.match(/(\d{13,19})/);
            if (!m) return;
            const cardNumber = m[1];

            // (translated)
            if (seenCC.has(cardNumber)) { dupes++; return; }
            seenCC.add(cardNumber);

            // (translated)
            const obj = { cardNumber, originalLine: trimmed };
            if (trashSet.has(cardNumber)) {
                matched.push(obj);
            } else {
                clean.push(obj);
            }
        });

        // Save results and render
        CML_STATE.cleanCards   = clean;
        CML_STATE.trashMatches = matched;
        CML_STATE.stats = {
            checked:    seenCC.size,
            foundTrash: matched.length,
            clean:      clean.length,
            dupes
        };

        // (translated)
        _renderCMLStats();
        _renderCMLLists();

        toast(`Check complete: ${clean.length} clean, ${matched.length} trash`, 'success');
    });

    // COPY TRASH MATCHES
    copyTrashBtn?.addEventListener('click', () => {
        const text = CML_STATE.trashMatches.map(c => c.originalLine).join('\n');
        if (!text) { toast('No trash matches to copy', 'info'); return; }
        navigator.clipboard?.writeText(text);
        toast(`Copied ${CML_STATE.trashMatches.length} trash matches`, 'success');
    });

    // COPY CLEAN
    copyCleanBtn?.addEventListener('click', () => {
        const text = CML_STATE.cleanCards.map(c => c.originalLine).join('\n');
        if (!text) { toast('No clean cards to copy', 'info'); return; }
        navigator.clipboard?.writeText(text);
        toast(`Copied ${CML_STATE.cleanCards.length} clean cards`, 'success');
    });

    // EXPORT CLEAN TO NOTES
    exportNotes?.addEventListener('click', () => {
        const cards = CML_STATE.cleanCards;
        if (!cards.length) { toast('No clean cards to export', 'info'); return; }
        const block = cards.map(c => c.originalLine).join('\n');
        const title = `CLEAN FROM TRASH CHECK — ${cards.length}`;
        const newTab = {
            id: 'tab-cml-' + Date.now(),
            title,
            content: block,
            pinned: false,
            tag: null,
            created: Date.now(),
            scrollPos: 0
        };
        STATE.notesTabs.unshift(newTab);
        STATE.notesActiveTab = newTab.id;
        save();
        // (translated)
        document.querySelector('[data-view="notes"]')?.click();
        toast(`Exported ${cards.length} clean cards to Notes`, 'success');
    });
}

/* (translated) */
function _renderCMLStats() {
    const s = CML_STATE.stats;
    if (!s) return;
    const statsEl = document.getElementById('cml-stats');
    if (!statsEl) return;
    statsEl.style.display = 'flex';
    statsEl.innerHTML = `
        <div class="cml-stat-item">
            <span class="cml-stat-val val-total">${s.checked}</span>
            <span class="cml-stat-lbl">Checked</span>
        </div>
        <div class="cml-stat-item">
            <span class="cml-stat-val val-trash">${s.foundTrash}</span>
            <span class="cml-stat-lbl">Found in Trash</span>
        </div>
        <div class="cml-stat-item">
            <span class="cml-stat-val val-clean">${s.clean}</span>
            <span class="cml-stat-lbl">Clean</span>
        </div>
        ${s.dupes > 0 ? `<div class="cml-stat-item">
            <span class="cml-stat-val val-dupes">${s.dupes}</span>
            <span class="cml-stat-lbl">Dupes skipped</span>
        </div>` : ''}
    `;
}

/* (translated) */
function _renderCMLLists() {
    const resultsEl   = document.getElementById('cml-results');
    const trashListEl = document.getElementById('cml-trash-list');
    const cleanListEl = document.getElementById('cml-clean-list');
    if (!resultsEl) return;

    resultsEl.style.display = 'grid';

    // (translated)
    if (trashListEl) {
        trashListEl.innerHTML = CML_STATE.trashMatches.length > 0
            ? CML_STATE.trashMatches.map(c => `<div>${c.originalLine}</div>`).join('')
            : '<div style="opacity:0.4;font-style:italic">— none —</div>';
    }

    // (translated)
    if (cleanListEl) {
        cleanListEl.innerHTML = CML_STATE.cleanCards.length > 0
            ? CML_STATE.cleanCards.map(c => `<div>${c.originalLine}</div>`).join('')
            : '<div style="opacity:0.4;font-style:italic">— none —</div>';
    }
}

/**
 * (translated)
 * (translated)
 * (translated)
 * (translated)
 * status: 'alive' | 'dead' | 'invalid'
 */
function _parseCheckerOutput(text) {
    const lines = text.split(/\r?\n/);
    const results = [];

    // Extract card number
    function extractCC(line) {
        const pipeM = line.match(/(\d{13,19})\|/);
        if (pipeM) return pipeM[1];
        const m = line.match(/(\d{13,19})/);
        return m ? m[1] : null;
    }

    // Extract card number
    function extractExpCvv(str) {
        const m = str.match(/\b(0[1-9]|1[0-2])\s+(\d{2})\s+(\d{3,4})\b/);
        if (m) return { mm: m[1], yy: m[2], cvv: m[3] };
        const m2 = str.match(/\b(0[1-9]|1[0-2])\/(\d{2})\s+(\d{3,4})\b/);
        if (m2) return { mm: m2[1], yy: m2[2], cvv: m2[3] };
        const m3 = str.match(/\|(\d{2})\|(\d{2})\|(\d{3,4})/);
        if (m3) return { mm: m3[1], yy: m3[2], cvv: m3[3] };
        return { mm: '', yy: '', cvv: '' };
    }

    // (translated)
    function getStatus(line) {
        if (/(?:✅|ALIVE|Approved|APPROVED)/i.test(line)) return 'alive';
        if (/(?:💀|DEAD|Declined|DECLINED)/i.test(line)) return 'dead';
        if (/(?:❌|INVALID|Invalid)/i.test(line)) return 'invalid';
        return null;
    }

    // (translated)
    // (translated)
    const cardIndices = [];
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (getStatus(t) !== null && extractCC(t) !== null) {
            cardIndices.push(i);
        }
    }

    // (translated)
    // (translated)
    cardIndices.forEach((cardIdx, ci) => {
        const line = lines[cardIdx].trim();
        const status = getStatus(line);
        const cc = extractCC(line);
        if (!cc || !status) return;

        const withoutCC = line.replace(cc, ' ');
        const { mm, yy, cvv } = extractExpCvv(withoutCC);
        const key = `${cc}|${mm}|${yy}|${cvv}`;

        // (translated)
        const nextCardIdx = (cardIndices[ci + 1] !== undefined) ? cardIndices[ci + 1] : lines.length;
        const scanEnd = Math.min(nextCardIdx, cardIdx + 15);

        let system = '', type = '', level = '', geo = '';
        for (let j = cardIdx + 1; j < scanEnd; j++) {
            const svc = lines[j].trim();
            if (!svc) continue;
            // (translated)
            const geoM = svc.match(/(?:Код\s*страны|Geo|Country|Region)\s*[-–:]\s*(\S+)/i);
            if (geoM) { geo = geoM[1].toUpperCase(); continue; }
            // (translated)
            const sysM = svc.match(/(?:Система|System|Network|Brand|Payment\s*system)\s*[-–:]\s*(\S+)/i);
            if (sysM) { system = sysM[1].trim(); continue; }
            // (translated)
            const typeM = svc.match(/(?:Тип|Type|Card\s*type)\s*[-–:]\s*(\S+)/i);
            if (typeM) { type = typeM[1].trim(); continue; }
            // (translated)
            const levelM = svc.match(/(?:Уровень|Level|Tier|Class|Subtype)\s*[-–:]\s*(\S+)/i);
            if (levelM) { level = levelM[1].trim(); continue; }
        }

        results.push({ cc, mm, yy, cvv, status, system, type, level, geo, key });
    });

    return results;
}

/**
 * (translated)
 * (translated)
 * (translated)
 */
// ═══════════════════════════════════════════════════════════════════
// (translated)
// (translated)
// ═══════════════════════════════════════════════════════════════════

/* (translated) */
const _TRASH_KEYWORDS = [
    'DEAD','INVALID','DECLINED','DO NOT HONOR','DO NOT TRY AGAIN',
    'FRAUD','SUSPECTED FRAUD','CLOSED CARD','PROCESSOR DECLINED',
    'CARD ISSUER DECLINED','CALL ISSUER','INSUFFICIENT FUNDS',
    'NOT HONOR','INSUFFICIENT_FUNDS'
];

/* (translated) */
function _lineIsTrash(line) {
    const upper = line.toUpperCase();
    for (const kw of _TRASH_KEYWORDS) {
        if (upper.includes(kw)) return true;
    }
    return /\u{1F480}|\u274C|\u26D4|\u{1F7E5}/u.test(line); // 💀❌⛔🟥
}

/* (translated) */
function _extractCC(line) {
    // (translated)
    const pm = line.match(/(\d{13,19})\|/);
    if (pm) return pm[1];
    // (translated)
    const m = line.match(/\b(\d{13,19})\b/);
    if (m) return m[1];
    // (translated)
    const m2 = line.replace(/[\s\u00A0]/g, ' ').match(/(\d{13,19})/);
    return m2 ? m2[1] : null;
}

/**
 * (translated)
 * (translated)
 */
function _detectCheckerFormat(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0).slice(0, 100);
    let classic = 0, pipe = 0, block = 0;
    for (const l of lines) {
        if (/^[\u2705\u{1F480}\u274C]/u.test(l) && /\b(ALIVE|DEAD|INVALID)\b/i.test(l)) classic++;
        if (/^\d{13,19}\s*\|/.test(l)) pipe++;
        if (/\u{1F7E9}{2,}|\u{1F7E5}{2,}/u.test(l)) block++;
    }
    const found = [classic > 0 && 'classic', pipe > 0 && 'pipe', block > 0 && 'block'].filter(Boolean);
    if (found.length === 0) return 'unknown';
    if (found.length === 1) return found[0];
    return 'mixed';
}

/**
 * (translated)
 */
function _parseClassicFormat(text) {
    const results = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const hasEmoji = /^[\u2705\u{1F480}\u274C]/u.test(line);
        const hasWord  = /\b(ALIVE|DEAD|INVALID)\b/i.test(line);
        if (!hasEmoji && !hasWord) continue;
        const cc = _extractCC(line);
        if (!cc) continue;
        const isTrash = /^[\u{1F480}\u274C]/u.test(line) || /\b(DEAD|INVALID)\b/i.test(line);
        results.push({ cc, status: isTrash ? 'trash' : 'valid' });
    }
    return results;
}

/**
 * (translated)
 * (translated)
 */
function _parsePipeFormat(text) {
    const results = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        if (!/^\d{13,19}\s*\|/.test(line)) continue;
        const cc = _extractCC(line);
        if (!cc) continue;
        const after = line.replace(/^\d+\s*\|/, '').trim();
        results.push({ cc, status: _lineIsTrash(after) || _lineIsTrash(line) ? 'trash' : 'valid' });
    }
    return results;
}

/**
 * (translated)
 * (translated)
 */
function _parseBlockFormat(text) {
    const results = [];
    const lines = text.split(/\r?\n/);
    let blockTrash = null;
    let cardFound = false;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (/\u{1F7E5}{2,}/u.test(line)) { blockTrash = true;  cardFound = false; continue; }
        if (/\u{1F7E9}{2,}/u.test(line)) { blockTrash = false; cardFound = false; continue; }
        if (blockTrash !== null && !cardFound) {
            const cc = _extractCC(line);
            if (cc) { results.push({ cc, status: blockTrash ? 'trash' : 'valid' }); cardFound = true; }
        }
    }
    return results;
}

/**
 * (translated)
 * (translated)
 * (translated)
 */
function _parseMultiFormat(text) {
    const format = _detectCheckerFormat(text);
    let all = [];
    if (format === 'classic' || format === 'mixed' || format === 'unknown') all = all.concat(_parseClassicFormat(text));
    if (format === 'pipe'    || format === 'mixed') all = all.concat(_parsePipeFormat(text));
    if (format === 'block'   || format === 'mixed') all = all.concat(_parseBlockFormat(text));

    // (translated)
    const statusMap = new Map();
    for (const r of all) {
        const cc = r.cc.replace(/[\s\-]/g, '');
        if (!cc) continue;
        if (!statusMap.has(cc) || r.status === 'trash') statusMap.set(cc, r.status);
    }

    const trashCards = [];
    let validCount = 0;
    statusMap.forEach((st, cc) => { if (st === 'trash') trashCards.push(cc); else validCount++; });

    return { format, trashCards, validCount, totalParsed: statusMap.size };
}

function _extractTrashCards(text) {
    // (translated)
    const multi = _parseMultiFormat(text);
    const deadCards = multi.trashCards;
    const aliveCount = multi.validCount;
    const hasMarkers = multi.totalParsed > 0;

    // (translated)
    if (!hasMarkers) {
        const seen = new Set();
        const legacy = [];
        text.split(/\r?\n/).forEach(line => {
            const m = line.trim().match(/\b(\d{13,19})\b/);
            if (m && !seen.has(m[1])) { legacy.push(m[1]); seen.add(m[1]); }
        });
        return { deadCards: legacy, aliveCount: 0, hasMarkers: false };
    }

    return { deadCards, aliveCount, hasMarkers };
}

// ═══════════════════════════════════════════════════════════════════
// (translated)
// ═══════════════════════════════════════════════════════════════════

// (translated)
const VALID_STATE = {
    cards: [],           // (translated)
    selectedRows: new Set(), // (translated)
    selectedCountries: new Set(), // (translated)
    stats: { totalValid: 0, totalTrash: 0, totalUnique: 0, skippedDupes: 0 }
};

/**
 * (translated)
 */
function _initValidCardsModal() {
    const overlay = document.getElementById('valid-cards-overlay');
    if (!overlay) return;

    const textarea = document.getElementById('valid-cards-textarea');
    const detectedEl = document.getElementById('valid-cards-detected');
    const closeBtn = document.getElementById('valid-cards-close');
    const cancelBtn = document.getElementById('valid-cards-cancel');
    const processBtn = document.getElementById('valid-cards-process');
    const fileInput = document.getElementById('valid-cards-file');

    const close = () => overlay.classList.add('hidden');
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // (translated)
    const updateDetected = () => {
        const parsed = _parseCheckerOutput(textarea.value);
        const alive = parsed.filter(c => c.status === 'alive').length;
        const bad = parsed.filter(c => c.status === 'dead' || c.status === 'invalid').length;
        detectedEl.textContent = parsed.length > 0
            ? `✅ ${alive} ALIVE · 💀/❌ ${bad} DEAD/INVALID`
            : '0 cards detected';
    };
    textarea?.addEventListener('input', updateDetected);

    // (translated)
    fileInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            textarea.value = (textarea.value ? textarea.value + '\n' : '') + ev.target.result;
            updateDetected();
            toast(`Loaded ${file.name}`, 'success');
        };
        reader.readAsText(file);
        fileInput.value = '';
    });

    // (translated)
    // (translated)
    const miniParserInput = document.getElementById('valid-mini-parser-file');
    if (miniParserInput) {
        miniParserInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    // Support Telegram format: { messages: [...] } or array of messages
                    const messages = Array.isArray(data) ? data : (data.messages || []);

                    if (messages.length === 0) {
                        toast(`${file.name}: no messages found in file`, 'warning');
                        return;
                    }

                    // Extract text from all messages
                    // Telegram stores text in text field (string or entity array)
                    const lines = [];
                    messages.forEach(msg => {
                        if (!msg) return;
                        let text = '';
                        if (typeof msg.text === 'string') {
                            text = msg.text;
                        } else if (Array.isArray(msg.text)) {
                            // Telegram entities — take only text parts
                            text = msg.text.map(t => (typeof t === 'string' ? t : (t.text || ''))).join('');
                        } else if (typeof msg === 'string') {
                            text = msg;
                        }
                        if (text.trim()) lines.push(text.trim());
                    });

                    if (lines.length === 0) {
                        toast(`${file.name}: no text found in messages`, 'warning');
                        return;
                    }

                    const combinedText = lines.join('\n');

                    // Preliminary check — are there any cards with markers
                    const preview = _parseCheckerOutput(combinedText);
                    const aliveCount = preview.filter(c => c.status === 'alive').length;
                    const badCount = preview.filter(c => c.status === 'dead' || c.status === 'invalid').length;

                    if (preview.length === 0) {
                        toast(`${file.name}: no cards with ALIVE/DEAD/INVALID markers found`, 'warning');
                        return;
                    }

                    // Process immediately — skip textarea, run directly
                    close();
                    _processValidCards(combinedText);
                    toast(`${file.name}: ✅ ${aliveCount} ALIVE · 💀/❌ ${badCount} DEAD/INVALID — ${messages.length} messages`, 'success');

                } catch (err) {
                    toast(`${file.name}: invalid JSON — ${err.message}`, 'error');
                }
            };
            reader.readAsText(file);
            miniParserInput.value = '';
        });
    }

    // (translated)
    processBtn?.addEventListener('click', () => {
        _processValidCards(textarea.value);
        close();
    });
}

/**
 * (translated)
 * (translated)
 * (translated)
 */
function _processValidCards(text) {
    const parsed = _parseCheckerOutput(text);

    // (translated)
    const badKeys = new Set();
    // (translated)
    const badNums = new Set();
    parsed.forEach(c => {
        if (c.status === 'dead' || c.status === 'invalid') {
            badKeys.add(c.key);
            badNums.add(c.cc);
        }
    });

    // (translated)
    const allAlive = parsed.filter(c => c.status === 'alive');
    const allBad = parsed.filter(c => c.status === 'dead' || c.status === 'invalid');
    const totalUnique = new Set(parsed.map(c => c.key)).size;
    const skippedDupes = parsed.length - totalUnique;

    // (translated)
    const seenKeys = new Set();
    const validCards = [];
    allAlive.forEach(c => {
        // (translated)
        if (badNums.has(c.cc)) return;
        // (translated)
        if (seenKeys.has(c.key)) return;
        seenKeys.add(c.key);
        validCards.push(c);
    });

    // (translated)
    VALID_STATE.cards = validCards;
    VALID_STATE.selectedRows = new Set(validCards.map((_, i) => i)); // (translated)
    VALID_STATE.selectedCountries = new Set(); // (translated)
    VALID_STATE.stats = {
        totalValid: validCards.length,
        totalTrash: allBad.length,
        totalUnique,
        skippedDupes
    };

    // (translated)
    navigate('new-cards');
    toast(`✅ Valid: ${validCards.length} · 💀 Trash: ${allBad.length}`, 'success');
    renderValidCardsResults();
}

/**
 * (translated)
 */
function renderValidCardsResults() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.innerHTML = '';

    const { cards, stats, selectedCountries, selectedRows } = VALID_STATE;

    // (translated)
    const countryMap = {};
    cards.forEach(c => {
        const geo = c.geo || 'UNKNOWN';
        if (!countryMap[geo]) countryMap[geo] = [];
        countryMap[geo].push(c);
    });
    const sortedCountries = Object.entries(countryMap).sort((a, b) => b[1].length - a[1].length);

    // (translated)
    const activeCodes = selectedCountries.size > 0 ? selectedCountries : null;
    const displayCards = activeCodes
        ? cards.filter((c, i) => activeCodes.has(c.geo || 'UNKNOWN'))
        : cards;

    // (translated)
    const rows = displayCards.map((c, di) => {
        const globalIdx = cards.indexOf(c);
        const checked = selectedRows.has(globalIdx);
        const masked = c.cc.replace(/(\d{4})(\d+)(\d{4})/, '$1 •••• $3');
        const exp = c.mm && c.yy ? `${c.mm}/${c.yy}` : '—';
        return `<tr class="valid-row ${checked ? 'selected' : ''}" data-idx="${globalIdx}">
            <td><input type="checkbox" class="valid-check" data-idx="${globalIdx}" ${checked ? 'checked' : ''}></td>
            <td class="vc-card">${masked}</td>
            <td>${exp}</td>
            <td>${c.cvv || '—'}</td>
            <td style="font-size:10px;color:#818cf8">${c.system || '—'}</td>
            <td style="font-size:10px;color:#60a5fa">${c.type || '—'}</td>
            <td style="font-size:10px;color:#a78bfa">${c.level || '—'}</td>
            <td><span class="vc-geo">${c.geo || 'UNKNOWN'}</span></td>
            <td><span class="vc-status-alive">ALIVE</span></td>
        </tr>`;
    }).join('');

    // (translated)
    const countryChips = sortedCountries.map(([code, cds]) => {
        const active = selectedCountries.has(code);
        return `<button class="vc-country-chip ${active ? 'active' : ''}" data-country="${code}">
            ${code} <span class="vc-chip-cnt">${cds.length}</span>
        </button>`;
    }).join('');

    // (translated)
    const getTabTitle = () => {
        if (selectedCountries.size === 0) return 'VALID — ALL';
        return 'VALID — ' + [...selectedCountries].join(', ');
    };

    // (translated)
    const getExportList = () => {
        // (translated)
        const manualSelected = displayCards.filter(c => selectedRows.has(cards.indexOf(c)));
        // (translated)
        if (selectedCountries.size > 0 && manualSelected.length === displayCards.length) {
            return displayCards;
        }
        return manualSelected;
    };

    area.innerHTML = `
    <div class="vc-container">
        <!-- (comment) -->
        <div class="vc-header">
            <button class="pz-btn pz-btn-dim vc-back-btn" id="vc-back">← Back to Parser</button>
            <h2 class="vc-title">✅ Valid Cards Results</h2>
        </div>

        <!-- (comment) -->
        <div class="vc-stats-row">
            <div class="vc-stat-card vc-stat-green">
                <span class="vc-stat-val">${stats.totalValid}</span>
                <span class="vc-stat-lbl">TOTAL VALID</span>
            </div>
            <div class="vc-stat-card vc-stat-red">
                <span class="vc-stat-val">${stats.totalTrash}</span>
                <span class="vc-stat-lbl">TOTAL TRASH</span>
            </div>
            <div class="vc-stat-card vc-stat-blue">
                <span class="vc-stat-val">${stats.totalUnique}</span>
                <span class="vc-stat-lbl">TOTAL UNIQUE</span>
            </div>
            <div class="vc-stat-card vc-stat-dim">
                <span class="vc-stat-val">${stats.skippedDupes}</span>
                <span class="vc-stat-lbl">SKIPPED DUPES</span>
            </div>
        </div>

        <!-- (comment) -->
        <div class="vc-countries-block">
            <div class="vc-countries-header">
                <span class="vc-section-label">📍 GEO FILTER</span>
                <button class="pz-btn pz-btn-dim vc-ctrl-btn" id="vc-select-all-geo">SELECT ALL</button>
                <button class="pz-btn pz-btn-dim vc-ctrl-btn" id="vc-clear-geo">CLEAR</button>
            </div>
            <div class="vc-countries-chips" id="vc-countries-chips">
                ${countryChips}
            </div>
        </div>

        <!-- (comment) -->
        <div class="vc-export-bar">
            <button class="pz-btn pz-btn-primary vc-export-btn" id="vc-export-all">📝 EXPORT ALL TO NOTES</button>
            <button class="pz-btn pz-btn-dim vc-export-btn" id="vc-export-selected">📝 EXPORT SELECTED TO NOTES</button>
            <button class="pz-btn pz-btn-dim vc-export-btn" id="vc-copy-all">📋 COPY ALL</button>
            <button class="pz-btn pz-btn-dim vc-export-btn" id="vc-copy-selected">📋 COPY SELECTED</button>
        </div>

        <!-- (comment) -->
        <div class="vc-table-wrap">
            <table class="data-table parser-table vc-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="vc-select-all-rows" ${selectedRows.size === displayCards.length && displayCards.length > 0 ? 'checked' : ''}></th>
                        <th>CARD</th><th>EXP</th><th>CVV</th>
                        <th>SYSTEM</th><th>TYPE</th><th>LEVEL</th>
                        <th>GEO</th><th>STATUS</th>
                    </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="9" style="text-align:center;color:#6b7280;padding:24px">No valid cards found</td></tr>'}</tbody>
            </table>
        </div>
    </div>`;

    // ── Events ──

    document.getElementById('vc-back')?.addEventListener('click', () => {
        VALID_STATE.cards = [];
        navigate('new-cards');
    });

    // (translated)
    document.querySelectorAll('.vc-country-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.dataset.country;
            if (VALID_STATE.selectedCountries.has(code)) {
                VALID_STATE.selectedCountries.delete(code);
            } else {
                VALID_STATE.selectedCountries.add(code);
            }
            renderValidCardsResults();
        });
    });

    document.getElementById('vc-select-all-geo')?.addEventListener('click', () => {
        sortedCountries.forEach(([code]) => VALID_STATE.selectedCountries.add(code));
        renderValidCardsResults();
    });

    document.getElementById('vc-clear-geo')?.addEventListener('click', () => {
        VALID_STATE.selectedCountries.clear();
        renderValidCardsResults();
    });

    // (translated)
    document.getElementById('vc-select-all-rows')?.addEventListener('change', e => {
        if (e.target.checked) {
            displayCards.forEach(c => VALID_STATE.selectedRows.add(cards.indexOf(c)));
        } else {
            displayCards.forEach(c => VALID_STATE.selectedRows.delete(cards.indexOf(c)));
        }
        renderValidCardsResults();
    });

    // (translated)
    document.querySelectorAll('.valid-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const idx = parseInt(cb.dataset.idx);
            if (cb.checked) VALID_STATE.selectedRows.add(idx);
            else VALID_STATE.selectedRows.delete(idx);
        });
    });

    // Helper function: build card list for export
    const buildExportLines = (list) => list.map(c => `${c.cc} ${(c.mm||'').padStart(2,'0')} ${c.yy||''} ${c.cvv||'000'}`).join('\n');

    // Helper function: create Notes tab
    const exportToNotes = (list, title) => {
        if (list.length === 0) { toast('No cards to export', 'warning'); return; }
        const block = buildExportLines(list);
        const newTab = {
            id: 'tab-valid-' + Date.now(),
            title,
            content: block,
            pinned: false, tag: null,
            created: Date.now(), scrollPos: 0
        };
        STATE.notesTabs.unshift(newTab);
        STATE.notesActiveTab = newTab.id;
        save();
        toast(`${list.length} cards → "${title}"`, 'success');
    };

    // EXPORT ALL TO NOTES
    document.getElementById('vc-export-all')?.addEventListener('click', () => {
        exportToNotes(displayCards, getTabTitle());
    });

    // EXPORT SELECTED TO NOTES
    document.getElementById('vc-export-selected')?.addEventListener('click', () => {
        const list = getExportList();
        const selCodes = selectedCountries.size > 0 ? [...selectedCountries].join(', ') : 'ALL';
        const hasManual = list.length < displayCards.length;
        const title = hasManual ? `VALID — ${list.length} selected` : `VALID — ${selCodes}`;
        exportToNotes(list, title);
    });

    // COPY ALL
    document.getElementById('vc-copy-all')?.addEventListener('click', () => {
        const text = buildExportLines(displayCards);
        navigator.clipboard?.writeText(text);
        toast(`📋 ${displayCards.length} cards copied`, 'success');
    });

    // COPY SELECTED
    document.getElementById('vc-copy-selected')?.addEventListener('click', () => {
        const list = getExportList();
        const text = buildExportLines(list);
        navigator.clipboard?.writeText(text);
        toast(`📋 ${list.length} cards copied`, 'success');
    });
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

    // (translated)
    const filterTypes = PARSER_STATE.filters.filterTypes;
    const filterClasses = PARSER_STATE.filters.filterClasses;
    const filterPaymentSystems = PARSER_STATE.filters.filterPaymentSystems;
    // (translated)
    const activeTypes = filterTypes.size > 0 ? [...filterTypes].map(t => t.toLowerCase()) : [];
    const activeNetworks = filterPaymentSystems.size > 0 ? [...filterPaymentSystems] : [];
    PARSER_STATE.filters = { bins: binRaw, country: countryEl ? countryEl.value.trim() : '', bank: bankEl ? bankEl.value.trim() : '', minExpiry: minExpRaw, activeTypes, activeNetworks, filterTypes, filterClasses, filterPaymentSystems };

    let allCards = extractCardsFromMessages(PARSER_STATE.rawMessages);
    allCards = allCards.map(c => ({ ...c, detectedGeo: detectGeo(c.billing, c.country, c.countryCode, c.bankCountryCode) }));

    // (translated)
    if (binFilters.length > 0) allCards = allCards.filter(c => binFilters.some(bf => c.bin.startsWith(bf)));
    // (translated)
    if (countryFilter) {
        const codes = countryFilter.split(/[\s,;]+/).map(s => s.toUpperCase().trim()).filter(Boolean);
        allCards = allCards.filter(c => {
            const geo = (c.detectedGeo || '').toUpperCase();
            const geoFromName = detectGeo('', c.country || '', c.countryCode || '', c.bankCountryCode || '');
            const resolvedGeo = geo || geoFromName.toUpperCase();
            return codes.some(code => resolvedGeo === code || resolvedGeo.startsWith(code));
        });
    }
    // (translated)
    if (bankFilter) allCards = allCards.filter(c => (c.bank || '').toLowerCase().includes(bankFilter));

    // (translated)
    if (minExpRaw) {
        const expMatch = minExpRaw.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
        if (expMatch) {
            const minVal = parseInt(expMatch[2]) * 100 + parseInt(expMatch[1]);
            allCards = allCards.filter(c => {
                const cmm = parseInt(c.mm) || 0;
                const cyy = parseInt(c.yy) || 0;
                if (!cmm || !cyy) return true; // (translated)
                return (cyy * 100 + cmm) >= minVal;
            });
        }
    }

    // (translated)
    if (filterTypes.size > 0) {
        allCards = allCards.filter(c => {
            const info = BIN_CACHE[c.bin];
            const ct = (info?.type || c.cardType || '').toUpperCase();
            // Validate card data
            return [...filterTypes].some(ft => ct.includes(ft));
        });
    }
    // (translated)
    if (filterClasses.size > 0) {
        allCards = allCards.filter(c => {
            const info = BIN_CACHE[c.bin];
            const level = (info?.level || '').toUpperCase().replace(/\s+/g, '_');
            // Validate card data
            return [...filterClasses].some(fc => level.includes(fc) || level === fc);
        });
    }
    // (translated)
    if (filterPaymentSystems.size > 0) {
        allCards = allCards.filter(c => {
            const network = getCardType(c.cc || '');
            const brand = (BIN_CACHE[c.bin]?.brand || '').toUpperCase();
            // Validate card data
            return [...filterPaymentSystems].some(fps => network === fps || brand.includes(fps));
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

// ──── REBUILD BIN GROUPS ────
// (translated)
function _rebuildBinGroups() {
    const binMap = {};
    PARSER_STATE.collected.forEach(c => {
        if (!binMap[c.bin]) binMap[c.bin] = [];
        binMap[c.bin].push(c);
    });
    PARSER_STATE.binGroups = Object.entries(binMap)
        .map(([bin, cards]) => ({ bin, count: cards.length, cards }))
        .sort((a, b) => b.count - a.count);
}

// ──── UPDATE STATS BAR ────
// (translated)
function _updateStatsBar() {
    const stats = PARSER_STATE._pipelineStats;
    const bar = document.getElementById('parser-stats-bar');
    if (!bar) return;
    if (stats) {
        bar.style.display = '';
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('ps-total',     stats.totalRaw        || 0);
        set('ps-trash',     stats.trashRemoved    || 0);
        set('ps-compared',  stats.compareRemoved  || 0);
        set('ps-workspace', stats.workspaceRemoved || 0);
        set('ps-dupes',     stats.dupRemoved      || 0);
        set('ps-net',       PARSER_STATE.collected.length);
        // TEST MODE
        const testEl = document.getElementById('ps-test-mode');
        if (PARSER_STATE.testMode && typeof _applyTestMode === 'function') {
            const testCards = _applyTestMode(PARSER_STATE.collected, false);
            if (testEl) testEl.style.display = '';
            set('ps-test-cards', testCards.length);
            set('ps-test-bins',  new Set(testCards.map(c => c.bin)).size);
        } else {
            if (testEl) testEl.style.display = 'none';
        }
    }
}

// ──── IMPORT TO NOTES (checker format) ────
function _buildExportTabTitle() {
    const filters = PARSER_STATE.filters || {};
    const parts = [];
    // (translated)
    if (filters.filterTypes && filters.filterTypes.size > 0) {
        parts.push([...filters.filterTypes].join('+'));
    } else if (filters.activeTypes && filters.activeTypes.length > 0) {
        const typeNames = { credit: 'Credit Card', debit: 'Debit Card', prepaid: 'Prepaid' };
        parts.push(filters.activeTypes.map(t => typeNames[t] || t).join(', '));
    }
    // (translated)
    if (filters.filterClasses && filters.filterClasses.size > 0) {
        parts.push([...filters.filterClasses].map(c => c.replace('_', ' ')).join('+'));
    }
    // (translated)
    if (filters.filterPaymentSystems && filters.filterPaymentSystems.size > 0) {
        parts.push([...filters.filterPaymentSystems].join('+'));
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
    // (translated)
    const prefix = PARSER_STATE.testMode ? '🧪 TEST — ' : '';
    return prefix + parts.join(' — ');
}

function importToProject() {
    let list = PARSER_STATE.collected;
    if (list.length === 0) { toast('No cards to import', 'warning'); return; }

    // (translated)
    if (PARSER_STATE.testMode) {
        list = _applyTestMode(list, false);
    }

    const lines = [];
    // (translated)
    if (PARSER_STATE.testMode) {
        list.forEach(c => {
            const cc = (c.cc || '').replace(/\s/g, '');
            const mm = (c.mm || '').padStart(2, '0');
            const yy = c.yy || '';
            const cvv = c.cvv || '000';
            lines.push(`${cc} ${mm} ${yy} ${cvv}`);
        });
    } else {
        PARSER_STATE.selected.forEach(idx => {
            const c = PARSER_STATE.collected[idx];
            if (!c) return;
            const cc = (c.cc || '').replace(/\s/g, '');
            const mm = (c.mm || '').padStart(2, '0');
            const yy = c.yy || '';
            const cvv = c.cvv || '000';
            lines.push(`${cc} ${mm} ${yy} ${cvv}`);
        });
    }

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
    STATE.notesTabs.unshift(newTab);
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

    // (translated)
    let testModeActive = PARSER_STATE.testMode;
    let testModeCards = 0;
    let testModeBins = 0;
    if (testModeActive) {
        // (translated)
        displayList = _applyTestMode(displayList, false);
        testModeCards = displayList.length;
        // Count results
        const uniqueBins = new Set(displayList.map(c => c.bin));
        testModeBins = uniqueBins.size;
    }

    // (translated)
    const testStatEl = document.getElementById('ps-test-mode');
    if (testStatEl) {
        testStatEl.style.display = testModeActive ? 'inline' : 'none';
        const cardsEl = document.getElementById('ps-test-cards');
        const binsEl = document.getElementById('ps-test-bins');
        if (cardsEl) cardsEl.textContent = testModeCards;
        if (binsEl) binsEl.textContent = testModeBins;
    }

    // Sort
    const sortBy = PARSER_STATE.sortBy || 'index';
    const binCounts = {};
    displayList.forEach(c => { binCounts[c.bin] = (binCounts[c.bin] || 0) + 1; });
    let sortedDisplay = [...displayList];
    if (sortBy === 'bin-desc') sortedDisplay.sort((a, b) => (binCounts[b.bin] || 0) - (binCounts[a.bin] || 0));
    else if (sortBy === 'bin-asc') sortedDisplay.sort((a, b) => (binCounts[a.bin] || 0) - (binCounts[b.bin] || 0));

    // (translated)
    const displayCount = displayList.length;
    const summaryHtml = `<div class="parser-summary">
        <span class="ps-item">Clean: <strong>${list.length}</strong></span>
        ${testModeActive ? `<span class="ps-item" style="color:#60a5fa">🧪 Test Mode: <strong>${testModeCards}</strong> cards (<strong>${testModeBins}</strong> BINs)</span>` : ''}
    </div>`;

    // (translated)
    const importHtml = `<div class="parser-action-bar">
        <button class="pz-btn pz-btn-import" id="parser-import-btn">📝 EXPORT TO NOTES (${displayCount})</button>
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

function _saveParserFilters() {
    const filters = {
        bins: document.getElementById('parser-bins')?.value || '',
        country: document.getElementById('parser-country')?.value || '',
        bank: document.getElementById('parser-bank')?.value || '',
        minExpiry: document.getElementById('parser-min-expiry')?.value || '',
        types: [...(PARSER_STATE.filters.filterTypes || [])],
        classes: [...(PARSER_STATE.filters.filterClasses || [])],
        networks: [...(PARSER_STATE.filters.filterPaymentSystems || [])]
    };
    localStorage.setItem('parserFilters', JSON.stringify(filters));
}

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


// ═══════════════════════════════════════════════════════════════
// (translated)
// (translated)
// (translated)
// ═══════════════════════════════════════════════════════════════

/** Today Cards mini-parser state */
const TC = {
    cards:     [],   // parsed cards
    dateLabel: '',   // date label for report header
    rawText:   '',   // last pasted text
};

/** Open Today Cards modal */
function _openTodayCardsModal() {
    const ov = document.getElementById('today-cards-overlay');
    if (!ov) return;
    ov.classList.remove('hidden');
    // (translated)
    const dp = document.getElementById('tc-date');
    if (dp && !dp.value) {
        dp.value = new Date().toISOString().slice(0,10);
    }
    _tcUpdateDetected();
}

/* (translated) */
function _tcUpdateDetected() {
    const ta = document.getElementById('tc-textarea');
    const badge = document.getElementById('tc-detected');
    if (!ta || !badge) return;
    const matches = (ta.value.match(/\b\d{13,19}\b/g) || []);
    badge.textContent = matches.length + ' cards detected';
}

/**
 * (translated)
 * (translated)
 */
function _initTodayCardsModal() {
    const overlay  = document.getElementById('today-cards-overlay');
    if (!overlay) return;

    const ta        = document.getElementById('tc-textarea');
    const fileInput = document.getElementById('tc-file');
    const parseBtn  = document.getElementById('tc-parse-btn');
    const clearBtn  = document.getElementById('tc-clear-btn');
    const closeBtn  = document.getElementById('tc-close-btn');
    const cancelBtn = document.getElementById('tc-cancel-btn');

    // (translated)
    const closeModal = () => overlay.classList.add('hidden');
    closeBtn?.addEventListener('click',  closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    // (translated)
    ta?.addEventListener('input', _tcUpdateDetected);

    // CLEAR
    clearBtn?.addEventListener('click', () => {
        if (ta) ta.value = '';
        document.getElementById('tc-detected').textContent = '0 cards detected';
        document.getElementById('tc-results').style.display = 'none';
        TC.cards = [];
    });

    // (translated)
    fileInput?.addEventListener('change', e => {
        const f = e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const content = ev.target.result;
            try {
                // (translated)
                const obj = JSON.parse(content);
                const msgs = Array.isArray(obj) ? obj
                           : (Array.isArray(obj.messages) ? obj.messages : []);
                // (translated)
                const text = msgs.map(m => {
                    if (typeof m.text === 'string') return m.text;
                    if (Array.isArray(m.text)) return m.text.map(t => typeof t === 'string' ? t : (t.text||'')).join('');
                    return '';
                }).join('\n');
                if (ta) ta.value = text;
                // (translated)
                const firstDate = msgs.find(m => m.date)?.date;
                if (firstDate) {
                    const dp = document.getElementById('tc-date');
                    if (dp && !dp.value) dp.value = firstDate.slice(0,10);
                }
            } catch {
                // (translated)
                if (ta) ta.value = content;
            }
            _tcUpdateDetected();
            fileInput.value = '';
        };
        reader.readAsText(f);
    });

    // PARSE
    parseBtn?.addEventListener('click', _tcRunParse);
}

/* (translated) */
function _tcRunParse() {
    const ta = document.getElementById('tc-textarea');
    const dp = document.getElementById('tc-date');
    const text = ta?.value || '';

    if (!text.trim()) {
        toast('Paste checker results or load a file first', 'warning');
        return;
    }

    // (translated)
    const dateVal = dp?.value || '';
    if (dateVal) {
        TC.dateLabel = new Date(dateVal + 'T12:00:00').toLocaleDateString('en-US',
            { day: 'numeric', month: 'short', year: 'numeric' });
    } else {
        TC.dateLabel = new Date().toLocaleDateString('en-US',
            { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // Extract card number
    // (translated)
    // (translated)
    const parsed = _parseCheckerOutput(text);
    let cards = [];

    if (parsed.length > 0) {
        // (translated)
        cards = parsed.map(p => ({
            cc:       p.cc,
            mm:       p.mm,
            yy:       p.yy,
            cvv:      p.cvv,
            status:   p.status,
            bin:      p.cc.slice(0,6),
            cardType: p.level || p.type || '',
            bank:     p.bank || '',
            country:  p.geo  || '',
            detectedGeo: p.geo || '',
            msgDate:  null,
        }));
    } else {
        // (translated)
        const seen = new Set();
        text.split(/\r?\n/).forEach(line => {
            const m = line.match(/\b(\d{13,19})\b/);
            if (!m) return;
            const cc = m[1];
            if (seen.has(cc)) return;
            seen.add(cc);
            // (translated)
            const rest = line.replace(cc, '');
            const dates = rest.match(/\b(0[1-9]|1[0-2])\s+(\d{2})\s+(\d{3,4})\b/);
            cards.push({
                cc, bin: cc.slice(0,6),
                mm: dates?.[1] || '',
                yy: dates?.[2] || '',
                cvv: dates?.[3] || '',
                status: 'unknown',
                cardType: '', bank: '', country: '', detectedGeo: '', msgDate: null,
            });
        });
    }

    TC.cards = cards;
    TC.rawText = text;

    if (cards.length === 0) {
        toast('No cards found in the pasted text', 'warning');
        return;
    }

    _tcRenderResults(cards);
    toast(`Parsed: ${cards.length} cards`, 'success');
}

/* (translated) */
function _tcStats(cards) {
    const total = cards.length;
    const geoMap = {}, typeMap = {}, levelMap = {}, sysMap = {}, bankMap = {}, statusMap = {};

    cards.forEach(c => {
        const geo    = (c.detectedGeo || c.country || 'Other').toUpperCase().slice(0,2) || 'Other';
        const rawType = (c.cardType || '').toUpperCase();
        const type   = rawType.includes('CREDIT')  ? 'CREDIT'
                     : rawType.includes('DEBIT')   ? 'DEBIT'
                     : rawType.includes('PREPAID') ? 'PREPAID'
                     : rawType.includes('BUSINESS')? 'BUSINESS'
                     : 'UNKNOWN';
        const level  = rawType.replace(/CREDIT|DEBIT|PREPAID|BUSINESS/g,'').trim() || 'STANDARD';
        const sys    = (typeof getCardType === 'function' ? getCardType(c.cc||'') : '') || 'OTHER';
        const bank   = c.bank || 'Unknown';
        const status = c.status || 'unknown';

        geoMap[geo]     = (geoMap[geo]     || 0) + 1;
        typeMap[type]   = (typeMap[type]   || 0) + 1;
        levelMap[level] = (levelMap[level] || 0) + 1;
        sysMap[sys]     = (sysMap[sys]     || 0) + 1;
        bankMap[bank]   = (bankMap[bank]   || 0) + 1;
        statusMap[status]=(statusMap[status]||0)+ 1;
    });

    return { total, geoMap, typeMap, levelMap, sysMap, bankMap, statusMap };
}

/* (translated) */
function _tcGeoName(code) {
    const M = {CA:'Canada',US:'United States',AU:'Australia',GB:'United Kingdom',
        DE:'Germany',FR:'France',NL:'Netherlands',NO:'Norway',SE:'Sweden',
        DK:'Denmark',FI:'Finland',CH:'Switzerland',AT:'Austria',IT:'Italy',
        ES:'Spain',PL:'Poland',CZ:'Czechia',PT:'Portugal',BE:'Belgium',
        NZ:'New Zealand',SG:'Singapore',JP:'Japan',KR:'South Korea',
        IE:'Ireland',IL:'Israel',BR:'Brazil',MX:'Mexico',ZA:'South Africa',
        IN:'India',AE:'UAE',TR:'Turkey',UA:'Ukraine',RU:'Russia'};
    return M[code] || code;
}

/* (translated) */
function _tcFlag(code) {
    if (!code || code.length !== 2) return '🌐';
    return String.fromCodePoint(...[...code.toUpperCase()].map(c=>0x1F1E0+c.charCodeAt(0)-65));
}

/* (translated) */
function _tcTextReport(s) {
    const pct = n => (n/s.total*100).toFixed(1)+'%';
    const sep = '━'.repeat(27);
    let out = `📊 DAILY REPORT — ${TC.dateLabel}\n${sep}\n`;
    out += `💳 Total Cards: ${s.total}\n`;

    // (translated)
    const alive = s.statusMap['alive'] || 0;
    const dead  = s.statusMap['dead']  || 0;
    const inv   = s.statusMap['invalid']||0;
    if (alive||dead||inv) out += `✅ Alive: ${alive}  💀 Dead: ${dead}  ❌ Invalid: ${inv}\n`;

    out += `\n🌍 BY COUNTRY:\n`;
    Object.entries(s.geoMap).sort((a,b)=>b[1]-a[1]).slice(0,8).forEach(([code,n])=>{
        out += `${_tcFlag(code)} ${_tcGeoName(code)} — ${n} (${pct(n)})\n`;
    });

    out += `\n💳 BY TYPE:\n`;
    Object.entries(s.typeMap).sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>{
        out += `${k} — ${n} (${pct(n)})\n`;
    });

    out += `\n💰 BY SYSTEM:\n`;
    Object.entries(s.sysMap).sort((a,b)=>b[1]-a[1]).forEach(([k,n])=>{
        out += `${k} — ${n} (${pct(n)})\n`;
    });

    out += `\n🏆 BY LEVEL:\n`;
    Object.entries(s.levelMap).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([k,n])=>{
        out += `${k} — ${n} (${pct(n)})\n`;
    });
    out += sep;
    return out;
}

/* (translated) */
function _tcRenderResults(cards) {
    const el = document.getElementById('tc-results');
    if (!el) return;
    el.style.display = 'block';

    const s = _tcStats(cards);
    const pct = n => (n/s.total*100).toFixed(1);

    // (translated)
    const bar = (p,col) => {
        const w = Math.round(+p/100*16);
        return `<span class="tcr-bar" style="--w:${w};--c:${col}"></span>`;
    };

    // (translated)
    const mkRows = (map,col) => Object.entries(map).sort((a,b)=>b[1]-a[1])
        .map(([k,n])=>`<div class="tcr-row">
            <span class="tcr-lbl">${k}</span>
            ${bar(pct(n),col)}
            <span class="tcr-n">${n}</span>
            <span class="tcr-pct">${pct(n)}%</span>
        </div>`).join('');

    // (translated)
    const geoEntries = Object.entries(s.geoMap).sort((a,b)=>b[1]-a[1]);
    const geoRows = geoEntries.slice(0,10).map(([code,n])=>`<div class="tcr-row">
        <span class="tcr-flag">${_tcFlag(code)}</span>
        <span class="tcr-lbl">${_tcGeoName(code)}</span>
        ${bar(pct(n),'#818cf8')}
        <span class="tcr-n">${n}</span>
        <span class="tcr-pct">${pct(n)}%</span>
    </div>`).join('');

    // (translated)
    const rows = cards.map((c,i)=>{
        const cc = c.cc||'';
        const masked = cc.length>=10 ? cc.slice(0,6)+'••••'+cc.slice(-4) : cc;
        const statusBadge = c.status==='alive'?'<span class="tcr-alive">✅</span>'
            : c.status==='dead'?'<span class="tcr-dead">💀</span>'
            : c.status==='invalid'?'<span class="tcr-inv">❌</span>':'';
        return `<tr>
            <td><input type="checkbox" class="tc-row-cb" data-idx="${i}"></td>
            <td>${statusBadge}</td>
            <td class="tcr-card">${masked}</td>
            <td>${c.mm||''}/${c.yy||''}</td>
            <td>${c.cvv||''}</td>
            <td>${c.bin||''}</td>
            <td>${c.detectedGeo||c.country||''}</td>
            <td class="tcr-bank">${c.bank||''}</td>
            <td>${c.cardType||''}</td>
        </tr>`;
    }).join('');

    el.innerHTML = `
    <!-- (comment) -->
    <div class="tcr-actions">
        <button class="pz-btn pz-btn-dim" id="tc-copy-report">📊 COPY REPORT</button>
        <button class="pz-btn pz-btn-dim" id="tc-export-all">📤 EXPORT ALL TO NOTES</button>
        <button class="pz-btn pz-btn-dim" id="tc-export-sel">📋 EXPORT SELECTED TO NOTES</button>
        <button class="pz-btn pz-btn-dim" id="tc-copy-all">📋 COPY ALL</button>
    </div>

    <!-- (comment) -->
    <div class="tcr-summary">
        <div class="tcr-total"><span class="tcr-total-n">${s.total}</span><span class="tcr-total-lbl">TOTAL CARDS</span></div>
        ${s.statusMap['alive']?`<div class="tcr-chip tcr-alive-chip">✅ Alive: ${s.statusMap['alive']}</div>`:''}
        ${s.statusMap['dead'] ?`<div class="tcr-chip tcr-dead-chip">💀 Dead: ${s.statusMap['dead']}</div>` :''}
        ${s.statusMap['invalid']?`<div class="tcr-chip tcr-inv-chip">❌ Invalid: ${s.statusMap['invalid']}</div>`:''}
    </div>

    <!-- (comment) -->
    <div class="tcr-grid">
        <div class="tcr-section">
            <div class="tcr-section-title">🌍 BY COUNTRY</div>${geoRows}
        </div>
        <div class="tcr-section">
            <div class="tcr-section-title">💳 BY TYPE</div>${mkRows(s.typeMap,'#34d399')}
            <div class="tcr-section-title" style="margin-top:12px">💰 BY SYSTEM</div>${mkRows(s.sysMap,'#60a5fa')}
            <div class="tcr-section-title" style="margin-top:12px">🏆 BY LEVEL</div>${mkRows(s.levelMap,'#fbbf24')}
            <div class="tcr-section-title" style="margin-top:12px">🏦 TOP BANKS</div>
            ${Object.entries(s.bankMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,n],i)=>
                `<div class="tcr-row"><span class="tcr-rank">${i+1}</span><span class="tcr-lbl">${k}</span><span class="tcr-n">${n}</span><span class="tcr-pct">${pct(n)}%</span></div>`
            ).join('')}
        </div>
    </div>

    <!-- (comment) -->
    <div class="tcr-table-section">
        <div class="tcr-section-title">
            📋 ALL CARDS
            <label style="margin-left:auto;font-size:11px;cursor:pointer;font-weight:400">
                <input type="checkbox" id="tc-select-all"> SELECT ALL
            </label>
        </div>
        <div class="tcr-table-wrap">
            <table class="tcr-table">
                <thead><tr><th></th><th>ST</th><th>CARD</th><th>EXP</th><th>CVV</th><th>BIN</th><th>GEO</th><th>BANK</th><th>TYPE</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    </div>`;

    // SELECT ALL
    document.getElementById('tc-select-all')?.addEventListener('change', e=>{
        document.querySelectorAll('.tc-row-cb').forEach(cb=>cb.checked=e.target.checked);
    });

    // COPY REPORT
    document.getElementById('tc-copy-report')?.addEventListener('click', ()=>{
        navigator.clipboard?.writeText(_tcTextReport(s));
        toast('Report copied to clipboard', 'success');
    });

    // EXPORT ALL TO NOTES
    document.getElementById('tc-export-all')?.addEventListener('click', ()=>{
        const lines = TC.cards.map(c=>`${(c.cc||'').replace(/\s/g,'')} ${c.mm||''} ${c.yy||''} ${c.cvv||'000'}`);
        const title = `REPORT ${TC.dateLabel} — ${lines.length} cards`;
        STATE.notesTabs.unshift({id:'tab-tc-'+Date.now(),title,content:lines.join('\n'),pinned:false,tag:null,created:Date.now(),scrollPos:0});
        STATE.notesActiveTab = STATE.notesTabs[0].id;
        save();
        document.querySelector('[data-view="notes"]')?.click();
        document.getElementById('today-cards-overlay')?.classList.add('hidden');
        toast(`Exported ${lines.length} cards to Notes`, 'success');
    });

    // EXPORT SELECTED TO NOTES
    document.getElementById('tc-export-sel')?.addEventListener('click', ()=>{
        const sel = [...document.querySelectorAll('.tc-row-cb:checked')].map(cb=>{
            const c = TC.cards[+cb.dataset.idx];
            return c ? `${(c.cc||'').replace(/\s/g,'')} ${c.mm||''} ${c.yy||''} ${c.cvv||'000'}` : '';
        }).filter(Boolean);
        if (!sel.length) { toast('No rows selected', 'warning'); return; }
        const title = `SELECTED ${TC.dateLabel} — ${sel.length} cards`;
        STATE.notesTabs.unshift({id:'tab-tcs-'+Date.now(),title,content:sel.join('\n'),pinned:false,tag:null,created:Date.now(),scrollPos:0});
        STATE.notesActiveTab = STATE.notesTabs[0].id;
        save();
        document.querySelector('[data-view="notes"]')?.click();
        document.getElementById('today-cards-overlay')?.classList.add('hidden');
        toast(`Exported ${sel.length} selected cards to Notes`, 'success');
    });

    // COPY ALL
    document.getElementById('tc-copy-all')?.addEventListener('click', ()=>{
        const txt = TC.cards.map(c=>`${(c.cc||'').replace(/\s/g,'')} ${c.mm||''} ${c.yy||''} ${c.cvv||'000'}`).join('\n');
        navigator.clipboard?.writeText(txt);
        toast(`Copied ${TC.cards.length} cards`, 'success');
    });
}


// ══════════════════════════════════════
//        BOOKMARKS MODULE
// ══════════════════════════════════════

let _bkSearchQuery = '';
let _bkFilterTag = 'all';
let _bkEditingId = null;

function _bkGetFiltered() {
    let items = [...(STATE.bookmarks || [])];
    if (_bkFilterTag && _bkFilterTag !== 'all') {
        items = items.filter(b => (b.tag || '').toLowerCase() === _bkFilterTag.toLowerCase());
    }
    if (_bkSearchQuery && _bkSearchQuery.length >= 2) {
        const q = _bkSearchQuery.toLowerCase();
        items = items.filter(b =>
            (b.title || '').toLowerCase().includes(q) ||
            (b.url || '').toLowerCase().includes(q) ||
            (b.description || '').toLowerCase().includes(q) ||
            (b.tag || '').toLowerCase().includes(q) ||
            (b.notes || '').toLowerCase().includes(q)
        );
    }
    items.sort((a, b) => (b.created || 0) - (a.created || 0));
    return items;
}

function _bkGetAllTags() {
    const tags = new Set();
    (STATE.bookmarks || []).forEach(b => {
        if (b.tag && b.tag.trim()) tags.add(b.tag.trim());
    });
    return [...tags].sort((a, b) => a.localeCompare(b));
}

function _bkFormatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(2);
    return `${dd}.${mm}.${yy}`;
}

function _bkEsc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBookmarks() {
    const area = document.getElementById('content-area');
    const items = _bkGetFiltered();
    const allTags = _bkGetAllTags();
    const isEditing = _bkEditingId !== null;
    const editItem = isEditing ? (STATE.bookmarks || []).find(b => b.id === _bkEditingId) : null;

    let tagsBarHTML = `<button class="bk-tag-btn ${_bkFilterTag === 'all' ? 'active' : ''}" data-bk-tag="all">ALL</button>`;
    allTags.forEach(t => {
        tagsBarHTML += `<button class="bk-tag-btn ${_bkFilterTag === t ? 'active' : ''}" data-bk-tag="${t}">${t}</button>`;
    });

    let cardsHTML = '';
    if (items.length === 0) {
        cardsHTML = `<div class="bk-empty">No bookmarks found</div>`;
    } else {
        items.forEach(b => {
            const truncUrl = (b.url || '').length > 60 ? b.url.slice(0, 57) + '...' : (b.url || '');
            cardsHTML += `
            <div class="bk-card" data-bk-id="${b.id}">
                <div class="bk-card-top">
                    <div class="bk-card-info">
                        <span class="bk-card-title">${_bkEsc(b.title || 'Untitled')}</span>
                        <a class="bk-card-url" href="${_bkEsc(b.url || '#')}" target="_blank" rel="noopener" title="${_bkEsc(b.url || '')}">${_bkEsc(truncUrl)}</a>
                    </div>
                    <div class="bk-card-meta">
                        ${b.tag ? `<span class="bk-card-tag">${_bkEsc(b.tag)}</span>` : ''}
                        <span class="bk-card-date">${_bkFormatDate(b.created)}</span>
                    </div>
                </div>
                ${b.description ? `<div class="bk-card-desc">${_bkEsc(b.description)}</div>` : ''}
                ${b.notes ? `<div class="bk-card-notes">${_bkEsc(b.notes)}</div>` : ''}
                <div class="bk-card-actions">
                    <button class="bk-act-btn bk-act-open" data-bk-action="open" data-bk-id="${b.id}">Open</button>
                    <button class="bk-act-btn bk-act-copy" data-bk-action="copy-url" data-bk-id="${b.id}">Copy URL</button>
                    <button class="bk-act-btn bk-act-copy-all" data-bk-action="copy-all" data-bk-id="${b.id}">Copy All</button>
                    <button class="bk-act-btn bk-act-edit" data-bk-action="edit" data-bk-id="${b.id}">Edit</button>
                    <button class="bk-act-btn bk-act-del" data-bk-action="delete" data-bk-id="${b.id}">Delete</button>
                </div>
            </div>`;
        });
    }

    const formTitle = isEditing ? 'EDIT BOOKMARK' : 'ADD BOOKMARK';
    const formBtn = isEditing ? 'Save Changes' : 'Add Bookmark';
    const fTitle = editItem ? editItem.title : '';
    const fUrl = editItem ? editItem.url : '';
    const fDesc = editItem ? editItem.description : '';
    const fTag = editItem ? editItem.tag : '';
    const fNotes = editItem ? editItem.notes : '';
    const showForm = isEditing;

    area.innerHTML = `
    <div class="bk-container">
        <div class="bk-header">
            <div class="bk-header-left">
                <span class="bk-title">BOOKMARKS</span>
                <span class="bk-count">${items.length} / ${(STATE.bookmarks || []).length}</span>
            </div>
            <div class="bk-header-right">
                <input type="text" class="bk-search" id="bk-search" placeholder="Search bookmarks..." value="${_bkEsc(_bkSearchQuery)}" autocomplete="off">
                <button class="bk-add-toggle" id="bk-add-toggle">${isEditing ? 'Cancel' : '+ Add'}</button>
            </div>
        </div>

        <div class="bk-form-panel ${showForm ? '' : 'hidden'}" id="bk-form-panel">
            <div class="bk-form-title">${formTitle}</div>
            <div class="bk-form-row">
                <div class="bk-form-group">
                    <label>Title *</label>
                    <input type="text" id="bk-f-title" placeholder="Bookmark name" value="${_bkEsc(fTitle)}">
                </div>
                <div class="bk-form-group">
                    <label>URL *</label>
                    <input type="text" id="bk-f-url" placeholder="https://..." value="${_bkEsc(fUrl)}">
                </div>
            </div>
            <div class="bk-form-row">
                <div class="bk-form-group">
                    <label>Description</label>
                    <input type="text" id="bk-f-desc" placeholder="Short description" value="${_bkEsc(fDesc)}">
                </div>
                <div class="bk-form-group bk-form-group-sm">
                    <label>Category / Tag</label>
                    <input type="text" id="bk-f-tag" placeholder="e.g. tools" value="${_bkEsc(fTag)}" list="bk-tag-list">
                    <datalist id="bk-tag-list">${allTags.map(t => '<option value="' + _bkEsc(t) + '">').join('')}</datalist>
                </div>
            </div>
            <div class="bk-form-row">
                <div class="bk-form-group bk-form-group-full">
                    <label>Notes</label>
                    <textarea id="bk-f-notes" rows="2" placeholder="Additional notes...">${_bkEsc(fNotes)}</textarea>
                </div>
            </div>
            <div class="bk-form-actions">
                <button class="bk-form-cancel" id="bk-form-cancel">Cancel</button>
                <button class="bk-form-save" id="bk-form-save">${formBtn}</button>
            </div>
        </div>

        <div class="bk-tags-bar" id="bk-tags-bar">${tagsBarHTML}</div>

        <div class="bk-list" id="bk-list">${cardsHTML}</div>
    </div>`;

    _bkBindEvents();
}

function _bkBindEvents() {
    const searchEl = document.getElementById('bk-search');
    if (searchEl) {
        searchEl.addEventListener('input', () => {
            _bkSearchQuery = searchEl.value;
            _bkRebuildList();
        });
    }

    const toggleBtn = document.getElementById('bk-add-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (_bkEditingId !== null) {
                _bkEditingId = null;
                renderBookmarks();
                return;
            }
            const panel = document.getElementById('bk-form-panel');
            if (panel) {
                panel.classList.toggle('hidden');
                if (!panel.classList.contains('hidden')) {
                    document.getElementById('bk-f-title')?.focus();
                    toggleBtn.textContent = 'Cancel';
                } else {
                    toggleBtn.textContent = '+ Add';
                }
            }
        });
    }

    document.getElementById('bk-form-cancel')?.addEventListener('click', () => {
        _bkEditingId = null;
        const panel = document.getElementById('bk-form-panel');
        if (panel) panel.classList.add('hidden');
        const tb = document.getElementById('bk-add-toggle');
        if (tb) tb.textContent = '+ Add';
    });

    document.getElementById('bk-form-save')?.addEventListener('click', () => {
        const title = document.getElementById('bk-f-title')?.value.trim();
        const url = document.getElementById('bk-f-url')?.value.trim();
        const desc = document.getElementById('bk-f-desc')?.value.trim();
        const tag = document.getElementById('bk-f-tag')?.value.trim();
        const notes = document.getElementById('bk-f-notes')?.value.trim();

        if (!title) { toast('Title is required', 'error'); return; }
        if (!url) { toast('URL is required', 'error'); return; }

        if (_bkEditingId) {
            const bk = STATE.bookmarks.find(b => b.id === _bkEditingId);
            if (bk) {
                bk.title = title;
                bk.url = url;
                bk.description = desc;
                bk.tag = tag;
                bk.notes = notes;
                bk.updated = Date.now();
            }
            _bkEditingId = null;
            toast('Bookmark updated', 'success');
        } else {
            STATE.bookmarks.push({
                id: genId(),
                title,
                url,
                description: desc,
                tag,
                notes,
                created: Date.now(),
                updated: Date.now()
            });
            toast('Bookmark added', 'success');
        }
        save();
        renderBookmarks();
    });

    document.querySelectorAll('[data-bk-tag]').forEach(btn => {
        btn.addEventListener('click', () => {
            _bkFilterTag = btn.dataset.bkTag;
            _bkRebuildList();
            document.querySelectorAll('[data-bk-tag]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    _bkBindCardActions();
}

function _bkBindCardActions() {
    document.querySelectorAll('[data-bk-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.dataset.bkAction;
            const id = btn.dataset.bkId;
            const bk = STATE.bookmarks.find(b => b.id === id);
            if (!bk) return;

            switch (action) {
                case 'open':
                    window.open(bk.url, '_blank', 'noopener');
                    break;
                case 'copy-url':
                    navigator.clipboard?.writeText(bk.url || '');
                    toast('URL copied', 'success');
                    break;
                case 'copy-all': {
                    const parts = [bk.title || '', bk.url || ''];
                    if (bk.description) parts.push(bk.description);
                    if (bk.tag) parts.push('Tag: ' + bk.tag);
                    if (bk.notes) parts.push('Notes: ' + bk.notes);
                    navigator.clipboard?.writeText(parts.join('\n'));
                    toast('Copied to clipboard', 'success');
                    break;
                }
                case 'edit':
                    _bkEditingId = id;
                    renderBookmarks();
                    const panel = document.getElementById('bk-form-panel');
                    if (panel) panel.classList.remove('hidden');
                    document.getElementById('bk-f-title')?.focus();
                    break;
                case 'delete':
                    STATE.bookmarks = STATE.bookmarks.filter(b => b.id !== id);
                    save();
                    toast('Bookmark deleted', 'info');
                    _bkRebuildList();
                    _bkRebuildTagsBar();
                    break;
            }
        });
    });
}

function _bkRebuildList() {
    const listEl = document.getElementById('bk-list');
    if (!listEl) return;
    const items = _bkGetFiltered();
    const countEl = document.querySelector('.bk-count');
    if (countEl) countEl.textContent = `${items.length} / ${(STATE.bookmarks || []).length}`;

    if (items.length === 0) {
        listEl.innerHTML = `<div class="bk-empty">No bookmarks found</div>`;
        return;
    }

    listEl.innerHTML = items.map(b => {
        const truncUrl = (b.url || '').length > 60 ? b.url.slice(0, 57) + '...' : (b.url || '');
        return `
        <div class="bk-card" data-bk-id="${b.id}">
            <div class="bk-card-top">
                <div class="bk-card-info">
                    <span class="bk-card-title">${_bkEsc(b.title || 'Untitled')}</span>
                    <a class="bk-card-url" href="${_bkEsc(b.url || '#')}" target="_blank" rel="noopener" title="${_bkEsc(b.url || '')}">${_bkEsc(truncUrl)}</a>
                </div>
                <div class="bk-card-meta">
                    ${b.tag ? `<span class="bk-card-tag">${_bkEsc(b.tag)}</span>` : ''}
                    <span class="bk-card-date">${_bkFormatDate(b.created)}</span>
                </div>
            </div>
            ${b.description ? `<div class="bk-card-desc">${_bkEsc(b.description)}</div>` : ''}
            ${b.notes ? `<div class="bk-card-notes">${_bkEsc(b.notes)}</div>` : ''}
            <div class="bk-card-actions">
                <button class="bk-act-btn bk-act-open" data-bk-action="open" data-bk-id="${b.id}">Open</button>
                <button class="bk-act-btn bk-act-copy" data-bk-action="copy-url" data-bk-id="${b.id}">Copy URL</button>
                <button class="bk-act-btn bk-act-copy-all" data-bk-action="copy-all" data-bk-id="${b.id}">Copy All</button>
                <button class="bk-act-btn bk-act-edit" data-bk-action="edit" data-bk-id="${b.id}">Edit</button>
                <button class="bk-act-btn bk-act-del" data-bk-action="delete" data-bk-id="${b.id}">Delete</button>
            </div>
        </div>`;
    }).join('');

    _bkBindCardActions();
}

function _bkRebuildTagsBar() {
    const tagsBar = document.getElementById('bk-tags-bar');
    if (!tagsBar) return;
    const allTags = _bkGetAllTags();
    let html = `<button class="bk-tag-btn ${_bkFilterTag === 'all' ? 'active' : ''}" data-bk-tag="all">ALL</button>`;
    allTags.forEach(t => {
        html += `<button class="bk-tag-btn ${_bkFilterTag === t ? 'active' : ''}" data-bk-tag="${t}">${t}</button>`;
    });
    tagsBar.innerHTML = html;
    if (_bkFilterTag !== 'all' && !allTags.includes(_bkFilterTag)) {
        _bkFilterTag = 'all';
    }
    document.querySelectorAll('[data-bk-tag]').forEach(btn => {
        btn.addEventListener('click', () => {
            _bkFilterTag = btn.dataset.bkTag;
            _bkRebuildList();
            document.querySelectorAll('[data-bk-tag]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
}
