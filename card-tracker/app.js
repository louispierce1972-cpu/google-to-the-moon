/* ═══════════════════════════════════════════
   CARD TRACKER — Application Logic
   ═══════════════════════════════════════════ */

// ──── STATE ────
const STATE = {
    user: null,
    currentView: 'all-cards',
    countries: [],
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
    binNotes: {},
    minicBins: [],
    minicTags: [],
    minicTagFilter: 'all',
    minicActiveTab: 'main',
    minicTabs: [{id:'main',name:'Main'}],
    docRecords: [],
    promptsTabs: [],
    promptsActiveTab: '',
    binDbMerchants: [],

};




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

// ──── AUTO-RESOLVE COUNTRY FROM BIN ────
// Looks up BIN for cards with country='auto' or empty country
// and sets the 2-letter ISO country code from BIN API response
async function autoResolveCardCountry(card) {
    if (card.country && card.country !== 'auto') return; // already resolved
    const bin = getBin(card.cardNumber);
    if (!bin || bin.length < 6) return;
    const info = await lookupBin(bin);
    if (info && info.country) {
        // BIN API returns 2-letter ISO code (e.g. "CA", "US", "GB")
        card.country = info.country.toUpperCase();
        save();
    }
}

// Batch resolve countries for all 'auto' cards
async function autoResolveAllCountries() {
    const autoCards = STATE.cards.filter(c => !c.country || c.country === 'auto');
    if (autoCards.length === 0) return;
    let resolved = 0;
    for (const card of autoCards) {
        const bin = getBin(card.cardNumber);
        if (!bin || bin.length < 6) continue;
        const info = await lookupBin(bin);
        if (info && info.country) {
            card.country = info.country.toUpperCase();
            resolved++;
        }
    }
    if (resolved > 0) {
        save();
        renderAll();
    }
}

// ──── COUNTRY DATABASE (ISO 3166-1 alpha-2) ────
function isoToFlag(code) {
    if (!code || code.length < 2) return '';
    const c = code.toUpperCase().substring(0, 2);
    return '<img src="https://cdn.jsdelivr.net/npm/country-flag-emoji-json@2.0.0/dist/images/' + c + '.svg" width="16" height="12" alt="' + c + '" class="cx-flag-img">';
}

// Normalize 3-letter ISO country codes to 2-letter
const _ISO3_TO_ISO2 = {
    'CAN':'CA','USA':'US','JPN':'JP','GBR':'GB','AUS':'AU','DEU':'DE','FRA':'FR',
    'ITA':'IT','ESP':'ES','BRA':'BR','MEX':'MX','IND':'IN','CHN':'CN','RUS':'RU',
    'KOR':'KR','NLD':'NL','BEL':'BE','CHE':'CH','AUT':'AT','SWE':'SE','NOR':'NO',
    'DNK':'DK','FIN':'FI','POL':'PL','PRT':'PT','IRL':'IE','NZL':'NZ','SGP':'SG',
    'HKG':'HK','TWN':'TW','THA':'TH','MYS':'MY','IDN':'ID','PHL':'PH','VNM':'VN',
    'ARE':'AE','SAU':'SA','QAT':'QA','KWT':'KW','BHR':'BH','OMN':'OM','ISR':'IL',
    'TUR':'TR','ZAF':'ZA','EGY':'EG','NGA':'NG','KEN':'KE','GHA':'GH','COL':'CO',
    'ARG':'AR','CHL':'CL','PER':'PE','URY':'UY','CRI':'CR','PAN':'PA','DOM':'DO',
    'CYM':'KY','BMU':'BM','BHS':'BS','TTO':'TT','JAM':'JM','CUB':'CU','PRY':'PY',
    'ECU':'EC','VEN':'VE','BOL':'BO','GTM':'GT','HND':'HN','SLV':'SV','NIC':'NI',
    'ROU':'RO','HUN':'HU','CZE':'CZ','SVK':'SK','BGR':'BG','HRV':'HR','SRB':'RS',
    'UKR':'UA','BLR':'BY','LTU':'LT','LVA':'LV','EST':'EE','GRC':'GR','CYP':'CY',
    'LUX':'LU','MLT':'MT','ISL':'IS','GEO':'GE','ARM':'AM','AZE':'AZ','KAZ':'KZ',
    'UZB':'UZ','PAK':'PK','BGD':'BD','LKA':'LK','NPL':'NP','MMR':'MM','KHM':'KH',
    'LAO':'LA','MNG':'MN','MAC':'MO','BRN':'BN','MDV':'MV'
};
function normalizeCC(code) {
    if (!code) return '';
    const upper = code.toUpperCase().trim();
    return _ISO3_TO_ISO2[upper] || upper.substring(0, 2);
}


// Card brand detection by first digit (IIN/BIN prefix rules)
function _brandByDigit(cardNum) {
    if (!cardNum) return '';
    const d = String(cardNum).replace(/\s/g, '')[0];
    if (d === '4') return 'VISA';
    if (d === '5') return 'MASTERCARD';
    if (d === '3') {
        const d2 = String(cardNum).replace(/\s/g, '').substring(0, 2);
        if (d2 === '34' || d2 === '37') return 'AMEX';
        if (d2 === '35') return 'JCB';
        if (d2 === '36' || d2 === '38') return 'DINERS';
        return 'AMEX';
    }
    if (d === '6') return 'DISCOVER';
    if (d === '2') return 'MASTERCARD';
    if (d === '9') return 'UNIONPAY';
    if (d === '1') return 'UATP';
    return '';
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
        localStorage.setItem('ct_bin_notes', JSON.stringify(STATE.binNotes || {}));
        localStorage.setItem('ct_minic_bins', JSON.stringify(STATE.minicBins || []));
        localStorage.setItem('ct_minic_tags', JSON.stringify(STATE.minicTags || []));
        localStorage.setItem('ct_minic_tabs', JSON.stringify(STATE.minicTabs || [{id:'main',name:'Main'}]));
        localStorage.setItem('ct_doc_records', JSON.stringify(STATE.docRecords || []));
        localStorage.setItem('ct_prompts_tabs', JSON.stringify(STATE.promptsTabs || []));
        localStorage.setItem('ct_prompts_active', STATE.promptsActiveTab || '');
        localStorage.setItem('ct_bin_db_merchants', JSON.stringify(STATE.binDbMerchants || []));

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
        const docRecordsRaw = localStorage.getItem('ct_doc_records');
        if (docRecordsRaw) STATE.docRecords = JSON.parse(docRecordsRaw);
        const minicBinsRaw = localStorage.getItem('ct_minic_bins');
        if (minicBinsRaw) STATE.minicBins = JSON.parse(minicBinsRaw);
        const minicTagsRaw = localStorage.getItem('ct_minic_tags');
        if (minicTagsRaw) STATE.minicTags = JSON.parse(minicTagsRaw);
        const minicTabsRaw = localStorage.getItem('ct_minic_tabs');
        if (minicTabsRaw) STATE.minicTabs = JSON.parse(minicTabsRaw);
        const binNotesRaw = localStorage.getItem('ct_bin_notes');
        if (binNotesRaw) STATE.binNotes = JSON.parse(binNotesRaw);
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
                PARSER_STATE.filters.excludeBanks = pf.excludeBanks || '';
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
        // Load promptsTabs
        const promptsTabsRaw = localStorage.getItem('ct_prompts_tabs');
        if (promptsTabsRaw) {
            STATE.promptsTabs = JSON.parse(promptsTabsRaw);
            STATE.promptsActiveTab = localStorage.getItem('ct_prompts_active') || (STATE.promptsTabs[0]?.id || '');
        }
        // Load binDbMerchants
        const binDbRaw = localStorage.getItem('ct_bin_db_merchants');
        if (binDbRaw) STATE.binDbMerchants = JSON.parse(binDbRaw);

    } catch (e) {
        console.error('Load error:', e);
    }
    loadBinCache();
    ensureDataIntegrity();
    migrateNotesToTabs();
    migratePromptsToTabs();
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

function migratePromptsToTabs() {
    if (STATE.promptsTabs.length === 0) {
        const firstTab = {
            id: 'ptab-' + Date.now(),
            title: 'My Prompts',
            content: '',
            pinned: false,
            created: Date.now()
        };
        STATE.promptsTabs = [firstTab];
        STATE.promptsActiveTab = firstTab.id;
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

    // ── Migration: convert old country IDs to ISO 2-letter codes ──
    const OLD_COUNTRY_MAP = { 'canada': 'CA', 'usa': 'US' };
    function migrateCountryCode(item) {
        if (item.country && OLD_COUNTRY_MAP[item.country]) {
            item.country = OLD_COUNTRY_MAP[item.country];
        }
    }
    STATE.cards.forEach(migrateCountryCode);
    STATE.docs.forEach(migrateCountryCode);
    STATE.trash.forEach(migrateCountryCode);

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
        case 'all-cards':
            // Unified workspace — show all cards (no country filter)
            cards = STATE.cards.filter(c => !c.standaloneCard);
            if (_geoFilter !== 'all') cards = cards.filter(c => c.country === _geoFilter);
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
            // Unified workspace — show all cards (no country filter)
            cards = STATE.cards.filter(c => !c.standaloneCard);
            if (_geoFilter !== 'all') cards = cards.filter(c => c.country === _geoFilter);
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
    // Unified workspace — show all docs, optional geo filter
    docs = [...STATE.docs];
    if (_geoFilter !== 'all') docs = docs.filter(d => d.country === _geoFilter);
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
    document.querySelectorAll('.tn-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === STATE.currentView);
    });
    const badge = document.getElementById('badge-trash');
    if (badge) badge.textContent = STATE.trash.length || '';
}

// Top nav tab clicks (anchor tags — prevent default to avoid double hash update)
document.querySelectorAll('.tn-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(tab.dataset.view);
    });
});

// Country dropdown removed — unified workspace

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
    // Collect unique country codes from cards
    const geoMap = {};
    STATE.cards.forEach(c => {
        const code = c.country || '';
        if (!code || code === 'auto') return;
        const upper = code.toUpperCase();
        if (!geoMap[upper]) {
            const flag = COUNTRY_DB[upper] ? isoToFlag(upper) : '';
            geoMap[upper] = { code: code, label: upper, flag };
        }
    });

    let html = '<option value="all">ALL</option>';
    Object.values(geoMap).forEach(g => {
        html += `<option value="${g.code}">${g.flag} ${g.label}</option>`;
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

    if (['notes', 'builder', 'analytics', 'checker', 'google-format', 'domain', 'bin-tester', 'all-cards', 'minic-bins', 'global-docs', 'docs', 'generator-view'].includes(STATE.currentView)) {
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
        const totalCards = STATE.cards.length;
        const uniqueBins = new Set(STATE.cards.map(c => getBin(c.cardNumber))).size;
        // Cards only in All Cards (not Workspace)
        const standaloneCount = STATE.cards.filter(c => c.standaloneCard).length;
        const standaloneStatHtml = standaloneCount > 0
            ? `<div class="stat-card minic"><span class="stat-label">Cards Only</span><span class="stat-value">${standaloneCount}</span></div>`
            : '';
        bar.innerHTML = `
            <div class="stat-card total"><span class="stat-label">Cards</span><span class="stat-value">${totalCards}</span></div>
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
    // Compact inline stats bar with colored dots
    const copyBtn = (filter) => `<button class="stat-copy-btn" data-copy-filter="${filter}" title="Copy">📋</button>`;
    bar.innerHTML = `
        <div class="cstat-row">
            <span class="cstat-item cstat-total">TOTAL <b>${s.total}</b> ${copyBtn('total')}</span>
            <span class="cstat-sep">·</span>
            <span class="cstat-item cstat-a"><span class="cstat-dot" style="background:#22C55E"></span> A <b>${s.cardAdd}</b> ${copyBtn('cardAdd')}</span>
            <span class="cstat-sep">·</span>
            <span class="cstat-item cstat-r"><span class="cstat-dot" style="background:#F59E0B"></span> R <b>${s.runAds}</b> ${copyBtn('runAds')}</span>
            <span class="cstat-sep">·</span>
            <span class="cstat-item cstat-v"><span class="cstat-dot" style="background:#22C55E"></span> V <b>${s.verified}</b> ${copyBtn('verified')}</span>
            <span class="cstat-sep">·</span>
            <span class="cstat-item cstat-d"><span class="cstat-dot" style="background:#A855F7"></span> D <b>${s.docReady}</b> ${copyBtn('docReady')}</span>
            <span class="cstat-sep">·</span>
            <span class="cstat-item cstat-w"><span class="cstat-dot" style="background:#06B6D4"></span> W <b>${s.waterBill}</b> ${copyBtn('waterBill')}</span>
            <span class="cstat-sep">·</span>
            <span class="cstat-item cstat-m"><span class="cstat-dot" style="background:#38BDF8"></span> M <b>${s.minic}</b> ${copyBtn('minic')}</span>
        </div>
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
    const allCards = [...STATE.cards];

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
    mode: 'proxy',        // proxy | bin | card | ip | auto | glue | cc-glue | generator
    proxyProto: 'socks5', // socks5 | http | https
    tabs: {
        proxy: { input: '', output: '' },
        bin:   { input: '', output: '', binGroups: {}, selectedBins: new Set(), binCards: [] },
        card:  { input: '', output: '' },
        ip:    { input: '', output: '' },
        auto:  { input: '', output: '' },
        glue:  { input: '', output: '' },
        'cc-glue': { input: '', output: '' },
        generator: { input: '', output: '' },
    },
    // GLUE multi-step state
    glue: {
        step: 1,               // 1=cards, 2=identity, 3=result
        cardsRaw: '',
        identityRaw: '',
        parsedCards: [],
        parsedIdentities: [],
        records: [],
        remainingCards: [],
        remainingIdentities: [],
        format: 'numbered',    // numbered | plain | compact
    },
    // CC-GLUE state (card splitting by BIN)
    ccGlue: {
        step: 1,                // 1=paste cards, 2=BIN overview, 3=generate
        cardsRaw: '',
        parsedCards: [],         // [{ccn, mm, yy, cvv, bin, network}]
        binGroups: {},           // { binPrefix: [card, card, ...] }
        selectedBins: new Set(), // which bins are selected for generation
        batchSize: 5,            // how many cards per batch
        batchIndex: {},          // { binPrefix: currentIndex } — round-robin tracker
        generatedBatches: [],    // history of generated batches
        currentBatch: [],        // latest generated batch
        usedBase: [],            // array of CC numbers from JSON base (previously used)
        usedBaseFileName: '',    // name of loaded JSON file
        usedBaseCount: 0,        // how many cards in the base
        dedupeEnabled: true,     // whether to remove cards found in usedBase
        dedupeStats: { total: 0, removed: 0, clean: 0, dupes: 0 },
    },
    // GENERATOR state
    generator: {
        type: 'tepco',         // tepco | water | creditcard | bankstatement | cleanname
        name: '',
        postalCode: '',
        streetAddress: '',
        city: '',
        prefecture: 'Tokyo',
        waterCountry: 'US',
        waterState: 'NY',
        font: 'Noto Sans',
        billData: null,
        // Credit Card Generator state
        ccg: {
            cardNumber: '4242 4242 4242 4242',
            expiry: '12/28',
            cvv: '123',
            holderName: 'JOHN DOE',
            cardNetwork: 'visa',
            bankName: 'PREMIUM BANK',
            customLogo: null,
            colorScheme: 'black',
            dateLayout: 'A',
            skinImage: null,
        },
    },
    history: [],           // last 10 operations
};

/* ──────────────────────────────────────────
   SMART CARD EXTRACTOR
   ────────────────────────────────────────── */
function _ckExtractCards(text) {
    const cards = [];
    const seen = new Set();

    // ── Pre-normalize exotic formats into pipe-delimited lines ──
    // JSON objects: {"cc":"4242...","exp_month":"03","exp_year":"27","cvv":"111"}
    text = text.replace(/\{[^}]*?"(?:cc|card|card_number|number|pan|cardnumber|card_no)"[^}]*?\}/gi, function(block) {
        const cc = block.match(/(?:cc|card|card_number|number|pan|cardnumber|card_no)"\s*:\s*"?(\d[\d\s\-]{11,22}\d)"?/i);
        const mm = block.match(/(?:exp_?month|month|mm|exp_mm)"\s*:\s*"?(\d{1,2})"?/i);
        const yy = block.match(/(?:exp_?year|year|yy|yyyy|exp_yy|exp_yyyy)"\s*:\s*"?(\d{2,4})"?/i);
        const cv = block.match(/(?:cvv|cvc|cvv2|cvc2|cid|security_code|sec)"\s*:\s*"?(\d{3,4})"?/i);
        // Combined exp: "exp":"03/27" or "expiry":"0327"
        const expC = block.match(/(?:exp|expiry|expiration|valid)"\s*:\s*"?(0?[1-9]|1[0-2])\/?(\d{2,4})"?/i);
        const m = mm ? mm[1] : (expC ? expC[1] : null);
        const y = yy ? yy[1] : (expC ? expC[2] : null);
        if (cc && m && y && cv) return '\n' + cc[1].replace(/[\s\-]/g,'') + '|' + m + '|' + y + '|' + cv[1] + '\n';
        return block;
    });

    // Query strings: cc=4242...&month=03&year=27&cvv=111 / card[number]=...&card[exp_month]=...
    text = text.replace(/(?:cc|card(?:\[number\])?|number|pan)=(\d[\d\s\-]{11,22}\d)[&;].*?(?:month|exp_?month|card\[exp_?month\]|mm)=(\d{1,2})[&;].*?(?:year|exp_?year|card\[exp_?year\]|yy)=(\d{2,4})[&;].*?(?:cvv|cvc|cvv2|card\[cvc\]|security_code)=(\d{3,4})/gi, function(_, c, m, y, v) {
        return '\n' + c.replace(/[\s\-]/g,'') + '|' + m + '|' + y + '|' + v + '\n';
    });

    // HTML entities and tags
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#?\w+;/g, ' ');
    text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:div|p|tr|li)>/gi, '\n').replace(/<[^>]+>/g, ' ');

    // URL-encoded: %7C = |, %2F = /, etc
    if (text.includes('%')) { try { text = decodeURIComponent(text); } catch(_) {} }

    // Semicolon and tilde delimiters → pipe
    text = text.replace(/(\d{13,19})\s*[;~]\s*(\d{1,2})\s*[;~]\s*(\d{2,4})\s*[;~]\s*(\d{3,4})/g, '$1|$2|$3|$4');

    // Combined MMYY after card: 4242...|0327|111 → 4242...|03|27|111
    text = text.replace(/(\d{13,19})\s*([|:;])\s*(0[1-9]|1[0-2])(2[4-9]|3[0-9])\s*\2\s*(\d{3,4})/g, '$1|$3|$4|$5');

    // Checker output status suffixes: ...|LIVE|..., ...|DEAD, ...|APPROVED, CCN|MM|YYYY|CVV|STATUS
    text = text.replace(/\|\s*(?:LIVE|DEAD|APPROVED|DECLINED|INVALID|ERROR|DIE|CHARGED|UNKNOWN|CCN|Valid|Invalid|Success|Failed|Active|Blocked|Hold)[^\n]*/gi, '');

    // With holder name: CCN|MM|YY|CVV|Name → strip name
    text = text.replace(/(\d{3,4})\|[A-Za-z][A-Za-z\s]+$/gm, '$1');

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

        // ── Strategy 0: 3-line card format (number / date / cvv on separate lines) ──
        // Detects: line1=card number only, line2=MM/YY(YY) only, line3=CVV only
        const trimmed = line.trim().replace(/[\s\-]/g, '');
        if (/^\d{13,19}$/.test(trimmed) && i + 2 < lines.length) {
            const line2 = lines[i + 1].trim();
            const line3 = lines[i + 2].trim();
            const dateMatch = line2.match(/^(0?[1-9]|1[0-2])\s*[\/\-\.]\s*(\d{2,4})$/);
            const cvvMatch = line3.match(/^(\d{3,4})$/);
            if (dateMatch && cvvMatch) {
                if (addCard(trimmed, dateMatch[1], dateMatch[2], cvvMatch[1])) {
                    i += 2; // skip date and cvv lines
                    continue;
                }
            }
        }

        // ── Strategy 0b: Multi-line labeled format (emoji/text prefixed) ──
        // Handles formats like:
        // 💳 CC: 5217 2930 1979 5094
        // 📅 Validity: 01/29
        // 🔐 CVV: 295
        const ccnInLine = line.match(/(\d[\d\s\-]{11,22}\d)/);
        if (ccnInLine) {
            const potCcn = ccnInLine[1].replace(/[\s\-]/g, '');
            if (potCcn.length >= 13 && potCcn.length <= 19 && !seen.has(potCcn)) {
                let lMM = null, lYY = null, lCVV = null;
                let lastConsumed = i;
                const searchEnd = Math.min(i + 5, lines.length);
                for (let j = i + 1; j < searchEnd; j++) {
                    const nl = lines[j].trim();
                    if (!nl) continue;
                    // Stop if we hit another card number
                    const nlClean = nl.replace(/[\s\-]/g, '');
                    if (/\d{13,19}/.test(nlClean.replace(/[^\d]/g, '')) && nl.match(/(\d[\d\s\-]{11,22}\d)/)) {
                        // Check it's actually a card number, not just digits in a label
                        const possibleCard = nl.match(/(\d[\d\s\-]{11,22}\d)/);
                        if (possibleCard && possibleCard[1].replace(/[\s\-]/g, '').length >= 13) break;
                    }
                    // Date: "📅 Validity: 01/29", "Exp: 01/29", "Date: 01/2029", "valid thru 01/29"
                    if (!lMM || !lYY) {
                        const dateM = nl.match(/(?:validity|valid(?:\s*thru|\s*through|\s*until|\s*to)?|exp(?:ir\w*)?|date|срок|fecha|vencimiento|дата|до|validade|gültig|scadenza|有効期限|유효기간)[\s:=]*\s*(0?[1-9]|1[0-2])\s*[\/\-\.]\s*(\d{2,4})/i);
                        if (dateM) { lMM = dateM[1]; lYY = dateM[2]; lastConsumed = j; continue; }
                        // Also try bare date on its own line: "01/29", "03-2027"
                        if (!lMM || !lYY) {
                            const bareDateM = nl.match(/^\s*(0?[1-9]|1[0-2])\s*[\/\-\.]\s*(\d{2,4})\s*$/);
                            if (bareDateM) { lMM = bareDateM[1]; lYY = bareDateM[2]; lastConsumed = j; continue; }
                        }
                    }
                    // CVV: "🔐 CVV: 295", "CVC: 123", "Security Code: 456"
                    if (!lCVV) {
                        const cvvM = nl.match(/(?:cvv2?|cvc2?|cid|код|security\s*code|sec\.?\s*code|cvn|ccv|card\s*code|verification|código|codice|コード|セキュリティ|رمز)[\s:=]*\s*(\d{3,4})\b/i);
                        if (cvvM) { lCVV = cvvM[1]; lastConsumed = j; continue; }
                        // Also try bare CVV on its own line: "295", "1234"
                        if (!lCVV) {
                            const bareCvvM = nl.match(/^\s*(\d{3,4})\s*$/);
                            if (bareCvvM) { lCVV = bareCvvM[1]; lastConsumed = j; continue; }
                        }
                    }
                    if (lMM && lYY && lCVV) break;
                }
                if (lMM && lYY && lCVV) {
                    if (addCard(potCcn, lMM, lYY, lCVV)) {
                        i = lastConsumed;
                        continue;
                    }
                }
            }
        }

        // ── Strategy 1: Standard delimited (pipe/colon/slash/space/tab) ──
        const stdRe = /(\d[\d\s\-]{11,22}\d)\s*[\|:\/\\\s\t]+\s*(0?[1-9]|1[0-2])\s*[\|:\/\\\s\t]+\s*(\d{2}|\d{4})\s*[\|:\/\\\s\t]+\s*(\d{3,4})/;
        const stdM = line.match(stdRe);
        if (stdM) { addCard(stdM[1], stdM[2], stdM[3], stdM[4]); continue; }

        // ── Strategy 1b: Comma / semicolon / equals / tilde delimited ──
        // 4242424242424242,03,27,111 or 4242...;03;27;111 or 4242...=03=27=111
        const csvRe = /(\d[\d\s\-]{11,22}\d)\s*[,;=~]+\s*(0?[1-9]|1[0-2])\s*[,;=~]+\s*(\d{2}|\d{4})\s*[,;=~]+\s*(\d{3,4})/;
        const csvM = line.match(csvRe);
        if (csvM) { addCard(csvM[1], csvM[2], csvM[3], csvM[4]); continue; }

        // ── Strategy 1c: Combined date MMYY — CCN|MMYY|CVV ──
        // 4242424242424242|0327|111 → MM=03, YY=27
        const mmyyRe = /(\d[\d\s\-]{11,22}\d)\s*[\|:\/\\,;~\s]+\s*(0[1-9]|1[0-2])(2[4-9]|3[0-9])\s*[\|:\/\\,;~\s]+\s*(\d{3,4})/;
        const mmyyM = line.match(mmyyRe);
        if (mmyyM) { addCard(mmyyM[1], mmyyM[2], mmyyM[3], mmyyM[4]); continue; }

        // ── Strategy 1d: Date as MM/YY then CVV — CCN EXP CVV inline ──
        // 4242424242424242 03/27 111
        const expInlineRe = /(\d[\d\s\-]{11,22}\d)\s+(?:exp(?:iry)?[:=\s]*)?(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})\s+(\d{3,4})/i;
        const expInM = line.match(expInlineRe);
        if (expInM) { addCard(expInM[1], expInM[2], expInM[3], expInM[4]); continue; }

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

        // Labeled Exp: MM/YY — covers EN/RU/JP/ES/PT/FR/DE/IT labels
        const expRe = /(?:exp(?:ir\w*)?|valid(?:ity|\s*thru|\s*through|\s*until|\s*till|\s*to)?|vencimiento|vence|validade|date\s*d[e']?\s*expiration|gültig|scadenza|有効期限|유효기간|تاريخ\s*الانتهاء|срок|дата|до)\s*[:\s=]+\s*(0?[1-9]|1[0-2])\s*[\/\-\.]\s*(\d{2,4})/i;
        const expM = line.match(expRe);
        if (expM) { mm = expM[1]; yy = expM[2]; }

        // Labeled Month
        if (!mm) {
            const mmRe = /(?:month|exp_?month|card_month|mm|mes|mois|monat|mese|月|월|месяц|شهر)\s*[:\s=]+\s*(0?[1-9]|1[0-2])\b/i;
            const mmM = line.match(mmRe);
            if (mmM) mm = mmM[1];
        }
        // Labeled Year
        if (!yy) {
            const yyRe = /(?:year|exp_?year|card_year|yy|yyyy|ano|année|jahr|anno|年|년|год|سنة)\s*[:\s=]+\s*(\d{2,4})\b/i;
            const yyM = line.match(yyRe);
            if (yyM) yy = yyM[1];
        }
        // Labeled CVV — covers all known labels
        const cvvRe = /(?:cvv2?|cvc2?|cid|cvn|ccv|sec(?:urity)?\s*(?:code|num(?:ber)?)|verification\s*(?:code|value|num)|card\s*code|código|codice|コード|セキュリティ|код|رمز)\s*[:\s=]+\s*(\d{3,4})\b/i;
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

    // ── Phase 1: Normalize input ──
    // Replace common delimiters, tabs, multiple spaces with single space for scanning
    // But keep newlines for context
    const normalized = text
        .replace(/\r\n/g, '\n')
        .replace(/\t/g, ' ');

    // ── Phase 2: Extract card numbers from ALL possible formats ──

    // 2a) Cards with spaces/dashes inside: "4076 1300 0481 5409" or "4076-1300-0481-5409"
    const spacedRe = /\b(\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{1,4})\b/g;
    let m;
    while ((m = spacedRe.exec(normalized)) !== null) {
        const num = m[1].replace(/[\s\-]/g, '');
        if (num.length >= 13 && num.length <= 19) bins.add(num.slice(0, 6));
    }

    // 2b) Plain 13-19 digit numbers (no separators) — most common format
    const plainRe = /(?<!\d)(\d{13,19})(?!\d)/g;
    while ((m = plainRe.exec(normalized)) !== null) {
        bins.add(m[1].slice(0, 6));
    }

    // 2c) Numbers with any separator pattern (spaces, dashes, dots) between digit groups
    // Catches: "4076130004815409", "4076 130004815409", "40761300 0481 5409" etc.
    const flexRe = /(?<!\d)(\d[\d\s\-\.]{11,25}\d)(?!\d)/g;
    while ((m = flexRe.exec(normalized)) !== null) {
        const num = m[1].replace(/[\s\-\.]/g, '');
        if (num.length >= 13 && num.length <= 19 && /^\d+$/.test(num)) {
            bins.add(num.slice(0, 6));
        }
    }

    // 2d) Also extract from full card lines via _ckExtractCards for completeness
    try {
        _ckExtractCards(text).forEach(c => bins.add(c.ccn.slice(0, 6)));
    } catch (e) { /* ignore errors */ }

    // 2e) Scan for 6+ digit sequences that START like valid card BINs (3,4,5,6)
    // This catches partial card numbers or BINs written standalone
    const binOnlyRe = /(?<!\d)([3-6]\d{5,7})(?!\d)/g;
    while ((m = binOnlyRe.exec(normalized)) !== null) {
        const num = m[1];
        // Only add if it looks like a real BIN (6 digits) and not already caught as full card
        if (num.length >= 6) {
            const bin6 = num.slice(0, 6);
            // Verify it starts with valid card prefix
            if (/^(3[0-9]|4[0-9]|5[0-5]|6[0-9])/.test(bin6)) {
                bins.add(bin6);
            }
        }
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
        case 'bin': {
            result = _ckExtractBins(input);
            // Also parse full cards and group by BIN for export
            const binCards = _ckExtractCards(input);
            const binGroups = {};
            binCards.forEach(c => {
                const bin6 = c.ccn.slice(0, 6);
                if (!binGroups[bin6]) binGroups[bin6] = [];
                binGroups[bin6].push(c);
            });
            tab.binGroups = binGroups;
            tab.binCards = binCards;
            // Preserve selected bins that still exist, reset others
            const validBins = new Set(Object.keys(binGroups));
            tab.selectedBins = new Set([...tab.selectedBins].filter(b => validBins.has(b)));
            const netStats2 = {};
            binCards.forEach(c => { netStats2[c.network || '??'] = (netStats2[c.network || '??'] || 0) + 1; });
            const parts2 = Object.entries(netStats2).map(([k,v]) => `${v} ${k}`);
            countLabel = `${result.length} unique BINs` + (parts2.length ? ` • ${binCards.length} cards • ${parts2.join(', ')}` : '');
            break;
        }
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

/* GLUE — Format single record */
function _ckFormatRecord(rec, idx, fmt) {
    const lines = [];
    const id = rec.identity || {};
    const c = rec.card;
    const nameStr = [id.name, id.surname].filter(Boolean).join(' ');
    const addrParts = [id.address, id.city, id.state, id.zip, id.country].filter(Boolean);

    if (fmt === 'numbered') {
        // Format: numbered block
        lines.push(`══ #${idx + 1} ══`);
        if (nameStr) lines.push(`Name: ${id.name || ''} | Surname: ${id.surname || ''}`);
        if (c) lines.push(`Card: ${c.ccn}|${c.mm}|${c.yy}|${c.cvv}`);
        if (addrParts.length) lines.push(`Address: ${addrParts.join(', ')}`);
        if (id.dob) lines.push(`DOB: ${id.dob}`);
        if (id.phone) lines.push(`Phone: ${id.phone}`);
        if (id.email) lines.push(`Email: ${id.email}`);
    } else if (fmt === 'plain') {
        // Format: simple list without numbers
        if (nameStr) lines.push(`Name: ${id.name || ''} | Surname: ${id.surname || ''}`);
        if (c) lines.push(`Card: ${c.ccn}|${c.mm}|${c.yy}|${c.cvv}`);
        if (addrParts.length) lines.push(`Address: ${addrParts.join(', ')}`);
        if (id.dob) lines.push(`DOB: ${id.dob}`);
        if (id.phone) lines.push(`Phone: ${id.phone}`);
        if (id.email) lines.push(`Email: ${id.email}`);
    } else {
        // compact: single line
        const parts = [];
        if (nameStr) parts.push(`${id.name || ''}|${id.surname || ''}`);
        if (c) parts.push(`${c.ccn}|${c.mm}|${c.yy}|${c.cvv}`);
        if (addrParts.length) parts.push(addrParts.join(','));
        if (id.dob) parts.push(id.dob);
        lines.push(parts.join(' | '));
    }
    return lines.join('\n');
}

/* GLUE — Format all records + remainders */
function _ckFormatAllRecords() {
    const g = _CK.glue;
    const fmt = g.format || 'numbered';
    const sep = fmt === 'compact' ? '\n' : '\n\n';
    let output = g.records.map((r, i) => _ckFormatRecord(r, i, fmt)).join(sep);

    if (g.remainingCards && g.remainingCards.length > 0) {
        output += '\n\n═══════════════════════\n';
        output += `⚠ Remaining: ${g.remainingCards.length} cards without identity\n`;
        output += g.remainingCards.map(c => `${c.ccn}|${c.mm}|${c.yy}|${c.cvv}`).join('\n');
    }
    if (g.remainingIdentities && g.remainingIdentities.length > 0) {
        output += '\n\n═══════════════════════\n';
        output += `⚠ Remaining: ${g.remainingIdentities.length} identities without card\n`;
        output += g.remainingIdentities.map(id => `${id.name} ${id.surname}`.trim()).join('\n');
    }
    return output;
}

/* GLUE — Reset */
function _ckGlueReset() {
    _CK.glue = { step: 1, cardsRaw: '', identityRaw: '', parsedCards: [], parsedIdentities: [], records: [], remainingCards: [], remainingIdentities: [], format: 'numbered' };
}

/* ══════════════════════════════════════════════════
   CC-GLUE — Split cards by BIN & generate mixed lists
   ══════════════════════════════════════════════════ */

function _ccGlueReset() {
    _CK.ccGlue = {
        step: 1, cardsRaw: '', parsedCards: [], binGroups: {},
        selectedBins: new Set(), batchSize: 5, batchIndex: {},
        generatedBatches: [], currentBatch: [],
        usedBase: _CK.ccGlue?.usedBase || [],
        usedBaseFileName: _CK.ccGlue?.usedBaseFileName || '',
        usedBaseCount: _CK.ccGlue?.usedBaseCount || 0,
        dedupeEnabled: true,
        dedupeStats: { total: 0, removed: 0, clean: 0, dupes: 0 },
    };
}

/* Load used-base from localStorage on init */
function _ccGlueLoadBase() {
    try {
        const raw = localStorage.getItem('ct_ccglue_base');
        if (raw) {
            const d = JSON.parse(raw);
            _CK.ccGlue.usedBase = d.cards || [];
            _CK.ccGlue.usedBaseFileName = d.fileName || '';
            _CK.ccGlue.usedBaseCount = _CK.ccGlue.usedBase.length;
        }
    } catch { /* ignore */ }
}

function _ccGlueSaveBase() {
    try {
        localStorage.setItem('ct_ccglue_base', JSON.stringify({
            cards: _CK.ccGlue.usedBase,
            fileName: _CK.ccGlue.usedBaseFileName,
        }));
    } catch { /* quota */ }
}

/* Parse JSON from Telegram export — extract all CC numbers */
function _ccGlueParseJSON(data) {
    const messages = Array.isArray(data) ? data : (data.messages || []);
    const ccSet = new Set();
    messages.forEach(msg => {
        if (!msg) return;
        let text = '';
        if (typeof msg.text === 'string') text = msg.text;
        else if (Array.isArray(msg.text)) text = msg.text.map(t => typeof t === 'string' ? t : (t.text || '')).join('');
        else if (typeof msg === 'string') text = msg;
        // Extract all 13-19 digit numbers
        const matches = text.match(/\b\d{13,19}\b/g);
        if (matches) matches.forEach(n => ccSet.add(n));
    });
    return [...ccSet];
}

/* Parse pasted card list, dedupe against usedBase + remove duplicates */
function _ccGlueParseCards(text) {
    const cards = _ckExtractCards(text); // reuse existing extractor
    const g = _CK.ccGlue;
    const baseSet = new Set(g.usedBase.map(n => n.replace(/[\s\-]/g, '')));
    const total = cards.length;
    let removed = 0;
    let dupes = 0;
    const seen = new Set();
    const clean = [];
    cards.forEach(c => {
        const num = c.ccn.replace(/[\s\-]/g, '');
        // Skip duplicates
        if (seen.has(num)) { dupes++; return; }
        seen.add(num);
        // Skip if in used base
        if (g.dedupeEnabled && baseSet.has(num)) { removed++; return; }
        clean.push(c);
    });
    g.dedupeStats = { total, removed, clean: clean.length, dupes };
    return clean;
}

/* Group cards by BIN (first 6 digits) */
function _ccGlueGroupByBin(cards) {
    const groups = {};
    cards.forEach(c => {
        const bin = c.ccn.replace(/[\s\-]/g, '').slice(0, 6);
        if (!groups[bin]) groups[bin] = [];
        groups[bin].push(c);
    });
    return groups;
}

/* Generate a batch — REMOVES cards from pool */
function _ccGlueGenerate() {
    const g = _CK.ccGlue;
    let bins = [...g.selectedBins].filter(b => g.binGroups[b] && g.binGroups[b].length > 0);
    if (bins.length === 0) { toast('No cards left in selected BINs', 'error'); return []; }
    const batch = [];
    const size = Math.min(g.batchSize, 100);
    let robin = 0;
    let safety = 0;
    while (batch.length < size && bins.length > 0 && safety < size + bins.length) {
        safety++;
        const bin = bins[robin % bins.length];
        const pool = g.binGroups[bin];
        if (!pool || pool.length === 0) {
            g.selectedBins.delete(bin);
            bins = bins.filter(b => b !== bin);
            if (bins.length === 0) break;
            continue;
        }
        const card = pool.splice(0, 1)[0]; // REMOVE from pool
        batch.push({ ...card, _bin: bin });
        robin++;
    }
    g.currentBatch = batch;
    g.generatedBatches.push([...batch]);
    return batch;
}

/* Subtract loaded JSON base from current bin pools — mini-parser */
function _ccGlueSubtractBase() {
    const g = _CK.ccGlue;
    if (g.usedBase.length === 0) return { found: 0, before: 0 };
    const baseSet = new Set(g.usedBase.map(n => n.replace(/[\s\-]/g, '')));
    let found = 0;
    let before = 0;
    for (const bin of Object.keys(g.binGroups)) {
        const pool = g.binGroups[bin];
        before += pool.length;
        const cleaned = pool.filter(c => {
            const num = c.ccn.replace(/[\s\-]/g, '');
            if (baseSet.has(num)) { found++; return false; }
            return true;
        });
        g.binGroups[bin] = cleaned;
    }
    // Also dedupe within pools
    for (const bin of Object.keys(g.binGroups)) {
        const seen = new Set();
        g.binGroups[bin] = g.binGroups[bin].filter(c => {
            const num = c.ccn.replace(/[\s\-]/g, '');
            if (seen.has(num)) return false;
            seen.add(num);
            return true;
        });
    }
    // Remove empty bins from selection
    for (const bin of [...g.selectedBins]) {
        if (!g.binGroups[bin] || g.binGroups[bin].length === 0) {
            g.selectedBins.delete(bin);
        }
    }
    return { found, before };
}

/* Format batch for output */
function _ccGlueFormatBatch(batch) {
    return batch.map(c => `${c.ccn}|${c.mm}|${c.yy}|${c.cvv}`).join('\n');
}

/* ── CC-GLUE Render ── */
function _renderCCGlue() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.style.display = 'none'; bar.innerHTML = '';
    const g = _CK.ccGlue;

    const stepLabels = ['', '1 · PASTE CARDS', '2 · BIN OVERVIEW', '3 · GENERATE'];
    const stepIcons = ['', '💳', '📊', '🃏'];
    const modeIcons = { proxy:'🌐', bin:'🔢', card:'💳', ip:'📡', auto:'🔍', glue:'🔗', 'cc-glue':'🃏', generator:'📄' };
    const modeLabels = { proxy:'Proxy', bin:'BIN', card:'Card', ip:'IP', auto:'Auto', glue:'Glue', 'cc-glue':'CC Glue', generator:'Generator' };

    area.innerHTML = `
    <div class="ck-container">
        <div class="ck-header">
            <div class="ck-title">
                <span class="ck-icon">🃏</span>
                <span>CC GLUE</span>
                <span style="font-size:11px;color:#6b7280;font-weight:400;margin-left:4px">Склейка по BIN</span>
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
        <div class="glue-steps">
            ${[1,2,3].map(s => `
                <div class="glue-step ${g.step === s ? 'active' : ''} ${g.step > s ? 'done' : ''}" data-step="${s}">
                    <span class="glue-step-num">${g.step > s ? '✓' : s}</span>
                    <span class="glue-step-label">${stepLabels[s]}</span>
                </div>
                ${s < 3 ? '<div class="glue-step-line' + (g.step > s ? ' done' : '') + '"></div>' : ''}
            `).join('')}
        </div>
        ${g.step === 1 ? _renderCCGlueStep1() : ''}
        ${g.step === 2 ? _renderCCGlueStep2() : ''}
        ${g.step === 3 ? _renderCCGlueStep3() : ''}
    </div>`;
    _bindCCGlueEvents();
}

function _renderCCGlueStep1() {
    const g = _CK.ccGlue;
    const count = g.parsedCards.length;
    const ds = g.dedupeStats;
    return `
        <div class="glue-workspace">
            <div class="ccg-base-bar">
                <div class="ccg-base-info">
                    <span class="ccg-base-icon">📂</span>
                    <span class="ccg-base-label">Used Base:</span>
                    <span class="ccg-base-count ${g.usedBaseCount > 0 ? 'ccg-base-loaded' : ''}">${g.usedBaseCount > 0 ? `${g.usedBaseCount} cards (${g.usedBaseFileName})` : 'Not loaded'}</span>
                </div>
                <div class="ccg-base-actions">
                    <label class="ck-action-btn ck-btn-copy" style="cursor:pointer">
                        📁 Load JSON
                        <input type="file" id="ccg-load-json" accept=".json" hidden>
                    </label>
                    ${g.usedBaseCount > 0 ? '<button class="ck-action-btn ck-btn-danger" id="ccg-clear-base">✕ Clear</button>' : ''}
                    <label style="display:flex;align-items:center;gap:4px;font-size:10px;color:#94a3b8;cursor:pointer">
                        <input type="checkbox" id="ccg-dedupe-toggle" ${g.dedupeEnabled ? 'checked' : ''} style="accent-color:#818cf8">
                        Dedupe
                    </label>
                </div>
            </div>
            ${(ds.removed > 0 || ds.dupes > 0) ? `<div class="ccg-dedupe-alert">⚠ ${ds.removed > 0 ? `<b>${ds.removed}</b> in base — removed. ` : ''}${ds.dupes > 0 ? `<b>${ds.dupes}</b> duplicates removed. ` : ''}Clean: <b>${ds.clean}</b> of ${ds.total}</div>` : ''}
            <div class="ck-panel">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">💳 PASTE CARDS</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count ${count > 0 ? 'ck-count-active' : ''}">${count} cards found</span>
                        <button class="ck-action-btn" id="ccg-paste-1">📋 Paste</button>
                        <button class="ck-action-btn ck-btn-danger" id="ccg-clear-1">✕</button>
                    </div>
                </div>
                <textarea class="ck-textarea" id="ccg-input-1" placeholder="Paste cards in ANY format:\n\n4242424242424242|03|27|111\n5326102343559988|05|28|222\n2712850012345678 09 27 333\n\nAll formats supported • Duplicates removed\nCards from Used Base will be excluded">${g.cardsRaw}</textarea>
            </div>
            <div class="glue-bottom-bar">
                <button class="glue-btn-secondary" id="ccg-reset">↺ Reset</button>
                <div class="glue-spacer"></div>
                <button class="glue-btn-primary" id="ccg-next-1" ${!count ? 'disabled' : ''}>
                    Split by BIN →
                    ${count > 0 ? `<span class="glue-badge">${count}</span>` : ''}
                </button>
            </div>
        </div>`;
}

function _renderCCGlueStep2() {
    const g = _CK.ccGlue;
    const bins = Object.keys(g.binGroups).sort((a,b) => g.binGroups[b].length - g.binGroups[a].length);
    const totalRemaining = bins.reduce((s, b) => s + (g.binGroups[b]?.length || 0), 0);
    const selectedCount = g.selectedBins.size;
    const selectedCards = [...g.selectedBins].reduce((s, b) => s + (g.binGroups[b]?.length || 0), 0);
    const output = g.currentBatch.length > 0 ? _ccGlueFormatBatch(g.currentBatch) : '';
    const generated = g.generatedBatches.length;
    const baseCount = g.usedBaseCount;

    return `
        <div class="glue-workspace">
            <div class="ccg-base-bar">
                <div class="ccg-base-info">
                    <span class="ccg-base-icon">📂</span>
                    <span class="ccg-base-label">JSON Base:</span>
                    <span class="ccg-base-count ${baseCount > 0 ? 'ccg-base-loaded' : ''}">${baseCount > 0 ? `${baseCount} cards (${g.usedBaseFileName})` : 'Not loaded'}</span>
                    ${g.lastSubtract ? `<span style="color:#fbbf24;font-size:10px;margin-left:8px">⚠ ${g.lastSubtract.found} found & removed</span>` : ''}
                </div>
                <div class="ccg-base-actions">
                    <label class="ck-action-btn ck-btn-copy" style="cursor:pointer">
                        📁 Load JSON
                        <input type="file" id="ccg-load-json-2" accept=".json" hidden>
                    </label>
                    ${baseCount > 0 ? `<button class="ck-action-btn" id="ccg-subtract" style="color:#fbbf24;border-color:rgba(251,191,36,.3)">🔍 Subtract</button>` : ''}
                    ${baseCount > 0 ? '<button class="ck-action-btn ck-btn-danger" id="ccg-clear-base-2">✕</button>' : ''}
                </div>
            </div>
            <div class="glue-info-bar">
                <span class="glue-info-icon">💳</span>
                <span>${totalRemaining} cards left · ${bins.length} BINs</span>
                <span style="margin-left:auto;font-size:10px;color:#6b7280">Selected: ${selectedCount} BINs (${selectedCards} cards) · Batches: ${generated}</span>
            </div>
            <div class="ccg-bin-controls">
                <button class="ck-action-btn ck-btn-copy" id="ccg-select-all">✓ All</button>
                <button class="ck-action-btn" id="ccg-deselect-all">✕ None</button>
                <div style="flex:1"></div>
                <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:#94a3b8">
                    Batch:
                    <input type="number" id="ccg-batch-size" value="${g.batchSize}" min="1" max="100" style="width:50px;height:26px;padding:2px 6px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#e5e7eb;outline:none;text-align:center;font-family:inherit">
                </label>
                <button class="glue-btn-primary" id="ccg-generate" style="padding:6px 16px;font-size:11px" ${selectedCount === 0 ? 'disabled' : ''}>
                    ⚡ Generate
                    <span class="glue-badge">${g.batchSize}</span>
                </button>
            </div>
            <div class="ccg-bin-grid">
                ${bins.map(bin => {
                    const cards = g.binGroups[bin];
                    const cnt = cards?.length || 0;
                    const net = cards[0]?.network || getCardType(cards[0]?.ccn || '');
                    const sel = g.selectedBins.has(bin);
                    const empty = cnt === 0;
                    return `
                    <div class="ccg-bin-card ${sel ? 'selected' : ''} ${empty ? 'ccg-bin-empty' : ''}" data-bin="${bin}">
                        <div class="ccg-bin-check">
                            <input type="checkbox" ${sel ? 'checked' : ''} ${empty ? 'disabled' : ''} data-bincheck="${bin}" style="accent-color:#818cf8">
                        </div>
                        <div class="ccg-bin-num">${bin}</div>
                        <div class="ccg-bin-net">${net || '—'}</div>
                        <div class="ccg-bin-cnt ${empty ? 'ccg-cnt-zero' : ''}">${cnt}</div>
                    </div>`;
                }).join('')}
            </div>
            ${output ? `
            <div class="ck-panel" style="max-height:200px">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">📤 BATCH #${generated}</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count ck-count-active">${g.currentBatch.length} cards</span>
                        <button class="ck-action-btn ck-btn-copy" id="ccg-copy-batch">📋 Copy</button>
                        <button class="ck-action-btn" id="ccg-to-notes">📝 Notes</button>
                        <button class="ck-action-btn" id="ccg-export-txt">💾 .txt</button>
                    </div>
                </div>
                <textarea class="ck-textarea ck-output-text" id="ccg-output" readonly style="min-height:60px;max-height:140px">${output}</textarea>
            </div>
            <div class="ccg-batch-bins">
                ${g.currentBatch.map(c => `<span class="ccg-batch-bin-tag">${c._bin} · ${c.ccn.replace(/[\s-]/g,'').slice(-4)}</span>`).join('')}
            </div>` : ''}
            <div class="glue-bottom-bar">
                <button class="glue-btn-secondary" id="ccg-back-2">← Back</button>
                <div class="glue-spacer"></div>
                <button class="glue-btn-secondary" id="ccg-reset-all">↺ New Session</button>
            </div>
        </div>`;
}

function _renderCCGlueStep3() { return _renderCCGlueStep2(); }

function _bindCCGlueEvents() {
    const area = document.getElementById('content-area');
    const g = _CK.ccGlue;

    // Mode switch
    area.querySelectorAll('.ck-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _CK.mode = btn.dataset.mode;
            _updateSubHashSilent();
            if (_CK.mode === 'glue') _renderGlue();
            else if (_CK.mode === 'cc-glue') _renderCCGlue();
            else if (_CK.mode === 'generator') _renderGenerator();
            else renderChecker();
        });
    });

    // Step clicks
    area.querySelectorAll('.glue-step.done').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => { g.step = parseInt(el.dataset.step); _renderCCGlue(); });
    });

    // ── STEP 1 ──
    if (g.step === 1) {
        const inp = document.getElementById('ccg-input-1');
        inp?.addEventListener('input', () => {
            g.cardsRaw = inp.value;
            g.parsedCards = _ccGlueParseCards(inp.value);
            const cnt = area.querySelector('.ck-count');
            if (cnt) { cnt.textContent = `${g.parsedCards.length} cards found`; cnt.classList.toggle('ck-count-active', g.parsedCards.length > 0); }
            const btn = document.getElementById('ccg-next-1');
            if (btn) { btn.disabled = g.parsedCards.length === 0; }
        });
        document.getElementById('ccg-paste-1')?.addEventListener('click', async () => {
            try { const t = await navigator.clipboard.readText(); inp.value = t; inp.dispatchEvent(new Event('input')); toast('Pasted','success'); } catch { toast('Clipboard denied','error'); }
        });
        document.getElementById('ccg-clear-1')?.addEventListener('click', () => { g.cardsRaw = ''; g.parsedCards = []; g.dedupeStats = {total:0,removed:0,clean:0}; _renderCCGlue(); });
        document.getElementById('ccg-next-1')?.addEventListener('click', () => {
            if (g.parsedCards.length === 0) { toast('No cards found','error'); return; }
            g.binGroups = _ccGlueGroupByBin(g.parsedCards);
            g.selectedBins = new Set(Object.keys(g.binGroups));
            g.batchIndex = {};
            toast(`${g.parsedCards.length} cards → ${Object.keys(g.binGroups).length} BINs`, 'success');
            g.step = 2; _renderCCGlue();
        });
        document.getElementById('ccg-reset')?.addEventListener('click', () => { _ccGlueReset(); _renderCCGlue(); });

        // JSON base load
        document.getElementById('ccg-load-json')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    const cards = _ccGlueParseJSON(data);
                    g.usedBase = cards;
                    g.usedBaseFileName = file.name;
                    g.usedBaseCount = cards.length;
                    _ccGlueSaveBase();
                    // Re-parse to apply dedupe
                    if (g.cardsRaw) {
                        g.parsedCards = _ccGlueParseCards(g.cardsRaw);
                    }
                    toast(`Loaded ${cards.length} cards from ${file.name}`, 'success');
                    _renderCCGlue();
                } catch (err) { toast(`Invalid JSON: ${err.message}`, 'error'); }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
        document.getElementById('ccg-clear-base')?.addEventListener('click', () => {
            g.usedBase = []; g.usedBaseFileName = ''; g.usedBaseCount = 0;
            _ccGlueSaveBase();
            if (g.cardsRaw) g.parsedCards = _ccGlueParseCards(g.cardsRaw);
            toast('Base cleared', 'info');
            _renderCCGlue();
        });
        document.getElementById('ccg-dedupe-toggle')?.addEventListener('change', e => {
            g.dedupeEnabled = e.target.checked;
            if (g.cardsRaw) { g.parsedCards = _ccGlueParseCards(g.cardsRaw); _renderCCGlue(); }
        });
    }

    // ── STEP 2 ──
    if (g.step === 2) {
        area.querySelectorAll('.ccg-bin-card').forEach(card => {
            card.addEventListener('click', e => {
                if (e.target.type === 'checkbox') return;
                const bin = card.dataset.bin;
                if (g.selectedBins.has(bin)) g.selectedBins.delete(bin); else g.selectedBins.add(bin);
                _renderCCGlue();
            });
        });
        area.querySelectorAll('[data-bincheck]').forEach(cb => {
            cb.addEventListener('change', () => {
                const bin = cb.dataset.bincheck;
                if (cb.checked) g.selectedBins.add(bin); else g.selectedBins.delete(bin);
                _renderCCGlue();
            });
        });
        document.getElementById('ccg-select-all')?.addEventListener('click', () => {
            g.selectedBins = new Set(Object.keys(g.binGroups).filter(b => g.binGroups[b]?.length > 0));
            _renderCCGlue();
        });
        document.getElementById('ccg-deselect-all')?.addEventListener('click', () => {
            g.selectedBins.clear(); _renderCCGlue();
        });
        document.getElementById('ccg-batch-size')?.addEventListener('input', e => {
            g.batchSize = Math.max(1, Math.min(100, parseInt(e.target.value) || 5));
        });
        document.getElementById('ccg-back-2')?.addEventListener('click', () => { g.step = 1; _renderCCGlue(); });
        document.getElementById('ccg-reset-all')?.addEventListener('click', () => { _ccGlueReset(); _renderCCGlue(); toast('Session reset', 'info'); });
        // Mini-parser: Load JSON base on Step 2
        document.getElementById('ccg-load-json-2')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    const cards = _ccGlueParseJSON(data);
                    g.usedBase = cards;
                    g.usedBaseFileName = file.name;
                    g.usedBaseCount = cards.length;
                    g.lastSubtract = null;
                    _ccGlueSaveBase();
                    toast(`Loaded ${cards.length} cards from ${file.name}`, 'success');
                    _renderCCGlue();
                } catch (err) { toast(`Invalid JSON: ${err.message}`, 'error'); }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
        // Mini-parser: Subtract base from pools
        document.getElementById('ccg-subtract')?.addEventListener('click', () => {
            const result = _ccGlueSubtractBase();
            g.lastSubtract = result;
            toast(`Found ${result.found} cards in base — removed. ${result.before - result.found} remain`, result.found > 0 ? 'success' : 'info');
            _renderCCGlue();
        });
        // Mini-parser: Clear base
        document.getElementById('ccg-clear-base-2')?.addEventListener('click', () => {
            g.usedBase = []; g.usedBaseFileName = ''; g.usedBaseCount = 0; g.lastSubtract = null;
            _ccGlueSaveBase();
            toast('Base cleared', 'info');
            _renderCCGlue();
        });
        // Generate + export (on same screen)
        document.getElementById('ccg-generate')?.addEventListener('click', () => {
            _ccGlueGenerate();
            _renderCCGlue();
            if (g.currentBatch.length > 0) toast(`Generated ${g.currentBatch.length} cards`, 'success');
        });
        document.getElementById('ccg-copy-batch')?.addEventListener('click', () => {
            const text = _ccGlueFormatBatch(g.currentBatch);
            navigator.clipboard.writeText(text).then(() => toast('Copied!','success')).catch(() => { const t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); toast('Copied!','success'); });
        });
        document.getElementById('ccg-to-notes')?.addEventListener('click', () => {
            const text = '═══ CC GLUE BATCH ═══\n' + new Date().toLocaleString() + '\n\n' + _ccGlueFormatBatch(g.currentBatch);
            const newTab = { id: 'tab-' + Date.now(), title: 'CC Glue ' + new Date().toLocaleTimeString(), content: text, pinned: false, tag: null, created: Date.now(), scrollPos: 0, exportSource: 'CC Glue', exportedAt: new Date().toISOString() };
            STATE.notesTabs.push(newTab); STATE.notesActiveTab = newTab.id; save();
            toast(`${g.currentBatch.length} cards → Notes`, 'success');
        });
        document.getElementById('ccg-export-txt')?.addEventListener('click', () => {
            const text = _ccGlueFormatBatch(g.currentBatch);
            const blob = new Blob([text], { type: 'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `cc-glue-batch-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(a.href);
            toast('File downloaded', 'success');
        });
    }
}

// Load base on startup
try { _ccGlueLoadBase(); } catch {}

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
                <button class="ck-mode-btn" data-mode="bin"><span class="ck-mode-icon">🔢</span><span class="ck-mode-label">BIN</span></button>
                <button class="ck-mode-btn" data-mode="card"><span class="ck-mode-icon">💳</span><span class="ck-mode-label">Card</span></button>
                <button class="ck-mode-btn" data-mode="ip"><span class="ck-mode-icon">📡</span><span class="ck-mode-label">IP</span></button>
                <button class="ck-mode-btn" data-mode="auto"><span class="ck-mode-icon">🔍</span><span class="ck-mode-label">Auto</span></button>
                <button class="ck-mode-btn active" data-mode="glue"><span class="ck-mode-icon">🔗</span><span class="ck-mode-label">Glue</span></button>
                <button class="ck-mode-btn" data-mode="cc-glue"><span class="ck-mode-icon">🃏</span><span class="ck-mode-label">CC Glue</span></button>
                <button class="ck-mode-btn" data-mode="generator"><span class="ck-mode-icon">📄</span><span class="ck-mode-label">Generator</span></button>
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
    const fmt = g.format || 'numbered';
    return `
        <div class="glue-workspace">
            <div class="glue-info-bar">
                <span class="glue-info-icon">🔗</span>
                <span>${g.records.length} records paired</span>
                ${(g.remainingCards?.length || 0) > 0 ? `<span class="glue-remain-warn">⚠ ${g.remainingCards.length} cards left</span>` : ''}
                ${(g.remainingIdentities?.length || 0) > 0 ? `<span class="glue-remain-warn">⚠ ${g.remainingIdentities.length} identities left</span>` : ''}
                <span style="margin-left:auto;font-size:10px;color:#6b7280">${g.parsedCards.length} cards × ${g.parsedIdentities.length} identities</span>
            </div>
            <div class="glue-format-bar">
                <span class="glue-format-label">Format:</span>
                <button class="ck-proto-btn ${fmt === 'numbered' ? 'active' : ''}" data-fmt="numbered">Numbered</button>
                <button class="ck-proto-btn ${fmt === 'plain' ? 'active' : ''}" data-fmt="plain">Plain</button>
                <button class="ck-proto-btn ${fmt === 'compact' ? 'active' : ''}" data-fmt="compact">Compact</button>
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
            _updateSubHashSilent();
            if (_CK.mode === 'glue') _renderGlue();
            else if (_CK.mode === 'cc-glue') _renderCCGlue();
            else if (_CK.mode === 'generator') _renderGenerator();
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
        // Format switcher
        area.querySelectorAll('.glue-format-bar .ck-proto-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                g.format = btn.dataset.fmt;
                _renderGlue();
            });
        });
        document.getElementById('glue-copy')?.addEventListener('click', () => {
            const text = _ckFormatAllRecords();
            navigator.clipboard.writeText(text).then(() => toast('Copied!','success')).catch(() => { const t=document.createElement('textarea'); t.value=text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); toast('Copied!','success'); });
        });
        document.getElementById('glue-to-notes')?.addEventListener('click', () => {
            const text = '═══ GLUE EXPORT ═══\n' + new Date().toLocaleString() + '\n\n' + _ckFormatAllRecords();
            const newTab = { id: 'tab-' + Date.now(), title: 'Glue ' + new Date().toLocaleTimeString(), content: text, pinned: false, tag: null, created: Date.now(), scrollPos: 0, exportSource: 'Glue', exportedAt: new Date().toISOString() };
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
                    country: 'auto', cardType: c.network || getCardType(c.ccn),
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

// ═══════════════════════════════════════════
//   GENERATOR — TEPCO Electricity Bill
// ═══════════════════════════════════════════

function _genRand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function _genFmtYen(n) { var s = String(Math.round(Number(n))); var r = ''; for (var i = s.length - 1, c = 0; i >= 0; i--, c++) { if (c > 0 && c % 3 === 0) r = ' ' + r; r = s[i] + r; } return '￥' + r; }

function _generateTEPCOData(gen) {
    const now = new Date();
    // Dates: meter reading → statement (20-25 days later) → due (30 days after statement)
    const meterDay = _genRand(1, 10);
    const meterDate = new Date(now.getFullYear(), now.getMonth() - 1, meterDay);
    const stmtDate = new Date(meterDate.getFullYear(), meterDate.getMonth(), meterDay + _genRand(20, 25));
    const dueDate = new Date(stmtDate.getFullYear(), stmtDate.getMonth() + 1, stmtDate.getDate());
    const chargeDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() - _genRand(1, 5));
    const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).toString().slice(-2)}`;
    const acct = String(_genRand(10000000, 99999999));
    const inv = String(_genRand(100, 999));
    // Real TEPCO usage: 1-2 person household 150-350 kWh
    const usage = _genRand(15000, 35000) / 100;
    // Real TEPCO rates (2025, tax included)
    const baseCharge = 935;
    const tier1 = Math.min(usage, 120) * 29.80;
    const tier2 = Math.max(0, Math.min(usage - 120, 180)) * 36.40;
    const tier3 = Math.max(0, usage - 300) * 40.49;
    const energyCharge = Math.round(tier1 + tier2 + tier3);
    const renewSurcharge = Math.round(usage * 4.18);
    const fuelAdj = Math.round(usage * (_genRand(-300, 300) / 100));
    const subtotal = baseCharge + energyCharge + renewSurcharge + fuelAdj;
    const tax = Math.round(subtotal * 0.10);
    const currentCharges = subtotal + tax;
    const prevBal = _genRand(0, 1) === 0 ? 0 : _genRand(3000, 9000);
    const totalDue = currentCharges;
    const totalDueAfter = totalDue + Math.round(totalDue * 0.03);
    const fullAddr = `${gen.streetAddress.toUpperCase()},\n${gen.city.toUpperCase()}, ${gen.prefecture.toUpperCase()} ${gen.postalCode}`;
    // Bars: 12 months, last = current usage, all proportional
    const usageInt = Math.round(usage);
    const bars = [];
    for (let i = 0; i < 11; i++) bars.push(_genRand(Math.max(50, usageInt - 80), usageInt + 60));
    bars.push(usageInt);
    // Y-axis max: round up to nearest 100 above highest bar
    const yMax = Math.ceil(Math.max(...bars) / 100) * 100;
    return {
        name: gen.name.toUpperCase(), address: fullAddr, acct, inv,
        stmtDate: fmt(stmtDate), dueDate: fmt(dueDate), meterDate: fmt(meterDate),
        chargeDueDate: fmt(chargeDueDate),
        usage: usage.toFixed(2),
        baseCharge, energyCharge, renewSurcharge, fuelAdj, tax, currentCharges,
        prevBal, totalPayment: prevBal, totalDue, totalDueAfter, bars, yMax
    };
}

function _renderTEPCOBillHTML(d, font) {
    const yMax = d.yMax || 500;
    const docFont = font || 'Noto Sans';
    const barsHtml = d.bars.map(v => {
        const h = Math.max(4, Math.round((v / yMax) * 90));
        return '<div style="width:14px;background:#333;border-radius:1px 1px 0 0;height:' + h + 'px"></div>';
    }).join('');
    return `
<div id="tepco-bill-render" style="width:760px;padding:36px 40px;background:#fff;color:#222;font-family:'${docFont}',sans-serif;font-size:13px;line-height:1.5;box-sizing:border-box">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px">
    <div style="font-size:52px;font-weight:900;color:#c62828;letter-spacing:6px;font-family:Arial Black,Arial,sans-serif">TEPCO</div>
    <div style="text-align:right;font-size:13px">
      <div style="display:flex;justify-content:flex-end;align-items:center;gap:16px;margin-bottom:4px">
        <span>Total amount due</span>
        <span style="border:1.5px solid #888;padding:4px 14px;font-weight:700;font-size:15px">${_genFmtYen(d.totalDue)}</span>
      </div>
      <div>Amount due pay after due date<span style="margin-left:20px;font-weight:600">${_genFmtYen(d.totalDueAfter)}</span></div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
    <div>
      <div style="margin-bottom:2px"><b>Account #:</b> ${d.acct} &nbsp;&nbsp;&nbsp; <b>Invoice:</b> ${d.inv}</div>
      <div><b>Name:</b> ${d.name}</div>
      <div><b>Address:</b> ${d.address.replace(/\n/g,'<br>')}</div>
    </div>
    <div style="text-align:right;max-width:260px">
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">DO NOT PAY</div>
      <div style="font-size:12px;color:#555">The amount due will be charged to your credit card 1 day after your due date</div>
    </div>
  </div>
  <hr style="border:none;border-top:3px solid #c62828;margin:14px 0">
  <div style="display:flex;gap:30px;margin-bottom:16px">
    <div style="width:230px;flex-shrink:0">
      <div style="font-size:34px;font-weight:900;color:#c62828;letter-spacing:4px;margin-bottom:8px;font-family:Arial Black,Arial,sans-serif">TEPCO</div>
      <div style="font-size:11px;color:#555;line-height:1.6">
        Tel.: +81-(0)3-6373-1111<br>
        Working hours MON-FRI 8 am to<br>6 pm and 10 am to 5 pm ST<br>
        For more information about<br>residential electric service please<br>visit: <b>www.tepco.co.jp</b>
      </div>
    </div>
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div>
          <div><b>Statement Date:</b> ${d.stmtDate}</div>
          <div><b>Customer name:</b> ${d.name}</div>
          <div><b>Account number:</b> ${d.acct}</div>
          <div><b>Invoice number:</b> ${d.inv}</div>
        </div>
        <div style="text-align:right">
          <div><b>Due Date:</b> ${d.dueDate}</div>
          <div><b>Total payment:</b> ${_genFmtYen(d.totalPayment)}</div>
        </div>
      </div>
      <div style="font-weight:700;font-size:14px;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:3px">Account Summary</div>
      <div style="display:flex;justify-content:space-between"><span>Previous Balance:</span><span>${_genFmtYen(d.prevBal)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Payment Amount – Thank you</span><span>${_genFmtYen(d.prevBal)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700"><span>Balance forward</span><span>￥0.00</span></div>
      <div style="height:10px"></div>
      <div style="display:flex;justify-content:space-between"><span>Base Charge (30A)</span><span>${_genFmtYen(d.baseCharge)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Energy Charges (${d.usage} kWh)</span><span>${_genFmtYen(d.energyCharge)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Renewable Energy Surcharge</span><span>${_genFmtYen(d.renewSurcharge)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Fuel Cost Adjustment</span><span>${d.fuelAdj >= 0 ? _genFmtYen(d.fuelAdj) : '-' + _genFmtYen(Math.abs(d.fuelAdj))}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Consumption Tax (10%)</span><span>${_genFmtYen(d.tax)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;margin-top:4px"><span>Current Charges due by: ${d.chargeDueDate}</span><span>${_genFmtYen(d.currentCharges)}</span></div>
    </div>
  </div>
  <hr style="border:none;border-top:1px solid #ccc;margin:12px 0">
  <div style="font-weight:700;font-size:14px;margin-bottom:4px">Account Details</div>
  <div style="background:#c62828;color:#fff;padding:3px 10px;display:inline-block;font-size:11px;font-weight:600;margin-bottom:8px">Usage (kWh)</div>
  <div style="display:flex;gap:24px;align-items:flex-end">
    <div>
      <div style="display:flex;align-items:flex-end;position:relative;height:100px;border-bottom:1px solid #999;padding:0 4px">
        <span style="position:absolute;left:-30px;top:0;font-size:9px;color:#666">${d.yMax}</span>
        <span style="position:absolute;left:-30px;top:25px;font-size:9px;color:#666">${Math.round(d.yMax*0.75)}</span>
        <span style="position:absolute;left:-30px;top:50px;font-size:9px;color:#666">${Math.round(d.yMax*0.5)}</span>
        <span style="position:absolute;left:-30px;top:75px;font-size:9px;color:#666">${Math.round(d.yMax*0.25)}</span>
        <span style="position:absolute;left:-14px;bottom:-14px;font-size:9px;color:#666">0</span>
        <div style="display:flex;align-items:flex-end;gap:3px;margin-left:10px">${barsHtml}</div>
      </div>
    </div>
    <table style="border-collapse:collapse;font-size:11px;flex:1">
      <tr style="background:#c62828;color:#fff">
        <th style="padding:4px 8px;text-align:left">Meter Reading</th><th style="padding:4px 8px">Usage</th>
        <th style="padding:4px 8px">Type</th><th style="padding:4px 8px">Date</th>
        <th style="padding:4px 8px">Account #</th><th style="padding:4px 8px">Invoice #</th>
      </tr>
      <tr>
        <td style="padding:4px 8px;border:1px solid #ccc">Standard</td>
        <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${d.usage}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">Ordinary</td>
        <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${d.meterDate}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${d.acct}</td>
        <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${d.inv}</td>
      </tr>
    </table>
  </div>
  <div style="font-size:10px;color:#777;margin-top:10px">The amount of usage energy you can see on the top of the statement or visit to our branch.</div>
</div>`;
}

// ═══════════════════════════════════════════
//   US WATER BILL — Provider Data & Generator (50 states)
// ═══════════════════════════════════════════
const US_WATER_PROVIDERS = {
    'AL': { name:'Birmingham Water Works', co:'Birmingham Water Works Board', phone:'(205) 244-4000', web:'bwwb.org', color:'#0066a1', avgBill:[25,45] },
    'AK': { name:'Anchorage Water', co:'Anchorage Water & Wastewater Utility', phone:'(907) 564-2700', web:'awwu.biz', color:'#005b96', avgBill:[40,80] },
    'AZ': { name:'Phoenix Water Services', co:'City of Phoenix Water Services Dept', phone:'(602) 262-6251', web:'phoenix.gov/water', color:'#b7312c', avgBill:[30,65] },
    'AR': { name:'Central Arkansas Water', co:'Central Arkansas Water', phone:'(501) 377-1200', web:'carkw.com', color:'#1a5276', avgBill:[22,42] },
    'CA': { name:'Cal Water', co:'California Water Service', phone:'(408) 367-8200', web:'calwater.com', color:'#0072bc', avgBill:[55,110] },
    'CO': { name:'Denver Water', co:'Denver Water', phone:'(303) 893-2444', web:'denverwater.org', color:'#004990', avgBill:[30,60] },
    'CT': { name:'Aquarion Water', co:'Aquarion Water Company of CT', phone:'(800) 732-9678', web:'aquarionwater.com', color:'#007dba', avgBill:[50,90] },
    'DE': { name:'Artesian Water', co:'Artesian Water Company', phone:'(302) 453-6900', web:'artesianwater.com', color:'#1b5e20', avgBill:[35,65] },
    'FL': { name:'Miami-Dade Water', co:'Miami-Dade Water and Sewer Dept', phone:'(305) 665-7471', web:'miamidade.gov/water', color:'#00838f', avgBill:[28,58] },
    'GA': { name:'Atlanta Watershed', co:'Atlanta Dept of Watershed Management', phone:'(404) 546-0311', web:'atlantawatershed.org', color:'#1565c0', avgBill:[25,55] },
    'HI': { name:'Honolulu BWS', co:'Board of Water Supply', phone:'(808) 748-5000', web:'boardofwatersupply.com', color:'#0277bd', avgBill:[35,70] },
    'ID': { name:'Boise Water', co:'United Water Idaho', phone:'(208) 362-7304', web:'unitedwater.com', color:'#2e7d32', avgBill:[25,50] },
    'IL': { name:'Illinois American Water', co:'Illinois American Water Co.', phone:'(800) 422-2782', web:'amwater.com/ilaw', color:'#01579b', avgBill:[22,50] },
    'IN': { name:'Indiana American Water', co:'Indiana American Water', phone:'(800) 492-8373', web:'amwater.com/inaw', color:'#01579b', avgBill:[25,55] },
    'IA': { name:'Iowa American Water', co:'Iowa American Water', phone:'(563) 386-4501', web:'amwater.com/iaaw', color:'#01579b', avgBill:[26,52] },
    'KS': { name:'WaterOne', co:'WaterOne of Johnson County', phone:'(913) 895-5500', web:'waterone.org', color:'#0d47a1', avgBill:[24,50] },
    'KY': { name:'Kentucky American Water', co:'Kentucky American Water', phone:'(800) 678-6301', web:'amwater.com/kyaw', color:'#01579b', avgBill:[28,56] },
    'LA': { name:'Sewerage & Water Board', co:'Sewerage & Water Board of New Orleans', phone:'(504) 529-2837', web:'swbno.org', color:'#1a237e', avgBill:[18,40] },
    'ME': { name:'Portland Water District', co:'Portland Water District', phone:'(207) 761-8310', web:'pwd.org', color:'#006064', avgBill:[20,45] },
    'MD': { name:'Maryland American Water', co:'Maryland American Water', phone:'(800) 934-1502', web:'amwater.com/mdaw', color:'#01579b', avgBill:[30,60] },
    'MA': { name:'Boston Water & Sewer', co:'Boston Water and Sewer Commission', phone:'(617) 989-7000', web:'bwsc.org', color:'#0d47a1', avgBill:[30,65] },
    'MI': { name:'Great Lakes Water', co:'Great Lakes Water Authority', phone:'(313) 964-9580', web:'glwater.org', color:'#1565c0', avgBill:[25,55] },
    'MN': { name:'Minneapolis Water', co:'Minneapolis Water Treatment & Distribution', phone:'(612) 673-5600', web:'minneapolismn.gov/water', color:'#0d47a1', avgBill:[24,52] },
    'MS': { name:'Jackson Water', co:'City of Jackson Water/Sewer Utilities', phone:'(601) 960-2723', web:'jacksonms.gov', color:'#283593', avgBill:[20,42] },
    'MO': { name:'Missouri American Water', co:'Missouri American Water', phone:'(866) 430-0820', web:'amwater.com/moaw', color:'#01579b', avgBill:[24,52] },
    'MT': { name:'Mountain Water', co:'Mountain Water Company', phone:'(406) 721-5570', web:'mountainwater.com', color:'#1b5e20', avgBill:[28,55] },
    'NE': { name:'Metropolitan Utilities', co:'Metropolitan Utilities District', phone:'(402) 554-6666', web:'mudomaha.com', color:'#004d40', avgBill:[20,44] },
    'NV': { name:'Las Vegas Valley Water', co:'Las Vegas Valley Water District', phone:'(702) 870-4194', web:'lvvwd.com', color:'#0277bd', avgBill:[22,50] },
    'NH': { name:'Manchester Water Works', co:'Manchester Water Works', phone:'(603) 624-6482', web:'manchesternh.gov', color:'#1a5276', avgBill:[24,50] },
    'NJ': { name:'NJ American Water', co:'New Jersey American Water', phone:'(800) 652-6987', web:'amwater.com/njaw', color:'#01579b', avgBill:[30,65] },
    'NM': { name:'Albuquerque Water', co:'Albuquerque Bernalillo County Water Utility', phone:'(505) 842-3400', web:'abcwua.org', color:'#bf360c', avgBill:[28,58] },
    'NY': { name:'NYC Water Board', co:'New York City Water Board', phone:'(718) 595-7000', web:'nyc.gov/dep', color:'#1565c0', avgBill:[25,55] },
    'NC': { name:'Charlotte Water', co:'Charlotte Water', phone:'(704) 336-3432', web:'charlottewater.org', color:'#00695c', avgBill:[18,42] },
    'ND': { name:'Bismarck Water', co:'City of Bismarck Water Department', phone:'(701) 355-1500', web:'bismarcknd.gov', color:'#0d47a1', avgBill:[26,52] },
    'OH': { name:'Aqua Ohio', co:'Aqua Ohio Inc.', phone:'(877) 987-2782', web:'aquawater.com', color:'#00838f', avgBill:[24,50] },
    'OK': { name:'OKC Utilities', co:'Oklahoma City Utilities', phone:'(405) 297-2833', web:'okc.gov/utilities', color:'#b71c1c', avgBill:[30,60] },
    'OR': { name:'Portland Water Bureau', co:'Portland Water Bureau', phone:'(503) 823-7770', web:'portland.gov/water', color:'#1b5e20', avgBill:[55,100] },
    'PA': { name:'Philadelphia Water', co:'Philadelphia Water Department', phone:'(215) 685-6300', web:'phila.gov/water', color:'#0d47a1', avgBill:[28,60] },
    'RI': { name:'Providence Water', co:'Providence Water Supply Board', phone:'(401) 521-6300', web:'provwater.com', color:'#1a237e', avgBill:[28,55] },
    'SC': { name:'Charleston Water', co:'Charleston Water System', phone:'(843) 727-6800', web:'charlestonwater.com', color:'#00695c', avgBill:[28,58] },
    'SD': { name:'Sioux Falls Water', co:'City of Sioux Falls Water Division', phone:'(605) 367-8601', web:'siouxfalls.org', color:'#0d47a1', avgBill:[22,46] },
    'TN': { name:'Tennessee American Water', co:'Tennessee American Water', phone:'(866) 736-6420', web:'amwater.com/tnaw', color:'#01579b', avgBill:[26,55] },
    'TX': { name:'Dallas Water Utilities', co:'Dallas Water Utilities', phone:'(214) 651-1441', web:'dallascityhall.com', color:'#1565c0', avgBill:[28,62] },
    'UT': { name:'SLC Public Utilities', co:'Salt Lake City Public Utilities', phone:'(801) 483-6900', web:'slc.gov/utilities', color:'#283593', avgBill:[24,52] },
    'VT': { name:'Burlington Water', co:'Burlington Dept of Public Works', phone:'(802) 863-4501', web:'burlingtonvt.gov/dpw', color:'#2e7d32', avgBill:[15,35] },
    'VA': { name:'Virginia American Water', co:'Virginia American Water', phone:'(800) 452-6863', web:'amwater.com/vaaw', color:'#01579b', avgBill:[30,60] },
    'WA': { name:'Seattle Public Utilities', co:'Seattle Public Utilities', phone:'(206) 684-3000', web:'seattle.gov/utilities', color:'#004d40', avgBill:[55,100] },
    'WV': { name:'WV American Water', co:'West Virginia American Water', phone:'(800) 685-8660', web:'amwater.com/wvaw', color:'#01579b', avgBill:[65,120] },
    'WI': { name:'Milwaukee Water Works', co:'Milwaukee Water Works', phone:'(414) 286-2830', web:'milwaukee.gov/water', color:'#0d47a1', avgBill:[15,38] },
    'WY': { name:'Cheyenne Water', co:'Cheyenne Board of Public Utilities', phone:'(307) 637-6460', web:'cheyennebopu.org', color:'#33691e', avgBill:[24,50] },
    'DC': { name:'DC Water', co:'District of Columbia Water and Sewer Authority', phone:'(202) 354-3600', web:'dcwater.com', color:'#0d47a1', avgBill:[35,70] }
};
const US_STATES_LIST = Object.keys(US_WATER_PROVIDERS).sort();
const US_STATE_NAMES = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC'};

// ═══════════════════════════════════════════
//   CANADA WATER BILL — Provider Data (13 provinces/territories)
// ═══════════════════════════════════════════
const CA_WATER_PROVIDERS = {
    'ON': { name:'Toronto Water', co:'City of Toronto Water', phone:'(416) 338-8888', web:'toronto.ca/water', color:'#1565c0', avgBill:[45,95], currency:'C$', cities:['Toronto','Ottawa','Mississauga','Brampton','Hamilton','London','Markham','Vaughan','Kitchener','Windsor','Richmond Hill','Oakville','Burlington','Oshawa','Barrie','St. Catharines','Cambridge','Guelph','Kingston','Thunder Bay'] },
    'QC': { name:'Ville de Montréal Eau', co:'Service de l\'eau de Montréal', phone:'(514) 872-3030', web:'montreal.ca/eau', color:'#0d47a1', avgBill:[35,75], currency:'C$', cities:['Montréal','Québec City','Laval','Gatineau','Longueuil','Sherbrooke','Lévis','Saguenay','Trois-Rivières','Terrebonne','Saint-Jean-sur-Richelieu','Repentigny','Brossard','Drummondville','Saint-Jérôme'] },
    'BC': { name:'Metro Vancouver Water', co:'Metro Vancouver Water Services', phone:'(604) 432-6200', web:'metrovancouver.org', color:'#00695c', avgBill:[40,85], currency:'C$', cities:['Vancouver','Surrey','Burnaby','Richmond','Coquitlam','Langley','Delta','North Vancouver','Abbotsford','Kelowna','Kamloops','Nanaimo','Victoria','Chilliwack','Prince George'] },
    'AB': { name:'EPCOR Water', co:'EPCOR Water Services Inc.', phone:'(780) 412-4500', web:'epcor.com', color:'#bf360c', avgBill:[50,100], currency:'C$', cities:['Calgary','Edmonton','Red Deer','Lethbridge','St. Albert','Medicine Hat','Grande Prairie','Airdrie','Spruce Grove','Leduc','Fort McMurray','Cochrane','Okotoks','Camrose','Lloydminster'] },
    'MB': { name:'City of Winnipeg Water', co:'City of Winnipeg Water and Waste Dept', phone:'(204) 986-7550', web:'winnipeg.ca/waterandwaste', color:'#283593', avgBill:[35,70], currency:'C$', cities:['Winnipeg','Brandon','Steinbach','Thompson','Portage la Prairie','Selkirk','Winkler','Morden','Dauphin','The Pas'] },
    'SK': { name:'SaskWater', co:'Saskatchewan Water Corporation', phone:'(306) 694-3098', web:'saskwater.com', color:'#1b5e20', avgBill:[40,80], currency:'C$', cities:['Saskatoon','Regina','Prince Albert','Moose Jaw','Swift Current','Yorkton','North Battleford','Estevan','Weyburn','Lloydminster'] },
    'NS': { name:'Halifax Water', co:'Halifax Regional Water Commission', phone:'(902) 420-9287', web:'halifaxwater.ca', color:'#004d40', avgBill:[35,75], currency:'C$', cities:['Halifax','Dartmouth','Sydney','Truro','New Glasgow','Glace Bay','Kentville','Amherst','Bridgewater','Yarmouth'] },
    'NB': { name:'Saint John Water', co:'Saint John Water', phone:'(506) 658-4455', web:'saintjohn.ca/water', color:'#0277bd', avgBill:[30,65], currency:'C$', cities:['Saint John','Moncton','Fredericton','Dieppe','Miramichi','Edmundston','Bathurst','Campbellton','Oromocto','Grand Falls'] },
    'NL': { name:'St. John\'s Water', co:'City of St. John\'s Water Dept', phone:'(709) 576-8199', web:'stjohns.ca', color:'#1a237e', avgBill:[30,60], currency:'C$', cities:['St. John\'s','Mount Pearl','Corner Brook','Conception Bay South','Paradise','Grand Falls-Windsor','Gander','Happy Valley-Goose Bay','Labrador City','Stephenville'] },
    'PE': { name:'Charlottetown Water', co:'City of Charlottetown Water Utility', phone:'(902) 566-5548', web:'charlottetown.ca', color:'#2e7d32', avgBill:[25,55], currency:'C$', cities:['Charlottetown','Summerside','Stratford','Cornwall','Montague','Kensington','Souris','Alberton','Georgetown','Tignish'] },
    'NT': { name:'Yellowknife Water', co:'City of Yellowknife Public Works', phone:'(867) 920-5600', web:'yellowknife.ca', color:'#33691e', avgBill:[55,110], currency:'C$', cities:['Yellowknife','Hay River','Inuvik','Fort Smith','Behchoko','Norman Wells'] },
    'YT': { name:'Whitehorse Water', co:'City of Whitehorse Water Ops', phone:'(867) 668-8330', web:'whitehorse.ca', color:'#006064', avgBill:[40,80], currency:'C$', cities:['Whitehorse','Dawson City','Watson Lake','Haines Junction','Carmacks','Mayo'] },
    'NU': { name:'Iqaluit Water', co:'City of Iqaluit Water Services', phone:'(867) 979-5600', web:'iqaluit.ca', color:'#4a148c', avgBill:[60,130], currency:'C$', cities:['Iqaluit','Rankin Inlet','Arviat','Baker Lake','Cambridge Bay','Igloolik'] }
};
const CA_PROVINCES_LIST = Object.keys(CA_WATER_PROVIDERS).sort();
const CA_PROVINCE_NAMES = {ON:'Ontario',QC:'Quebec',BC:'British Columbia',AB:'Alberta',MB:'Manitoba',SK:'Saskatchewan',NS:'Nova Scotia',NB:'New Brunswick',NL:'Newfoundland and Labrador',PE:'Prince Edward Island',NT:'Northwest Territories',YT:'Yukon',NU:'Nunavut'};

function _generateWaterBillData(gen) {
    const country = gen.waterCountry || 'US';
    const st = gen.waterState || (country === 'CA' ? 'ON' : 'NY');
    const isCA = country === 'CA';
    const providerMap = isCA ? CA_WATER_PROVIDERS : US_WATER_PROVIDERS;
    const nameMap = isCA ? CA_PROVINCE_NAMES : US_STATE_NAMES;
    const prov = providerMap[st];
    if (!prov) return null;
    const currSym = isCA ? 'C$' : '$';
    const now = new Date();
    const billDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - _genRand(1,10));
    const dueDate = new Date(billDate.getFullYear(), billDate.getMonth(), billDate.getDate() + _genRand(18,25));
    const fmtD = d => { const mo=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']; return `${String(d.getDate()).padStart(2,'0')} ${mo[d.getMonth()]}, ${d.getFullYear()}`; };
    const fmtPay = d => { const mo=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']; return `${mo[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}, ${d.getFullYear()}`; };
    const acct = `${_genRand(1,9)}-${String(_genRand(1000,9999))}-${String(_genRand(1000,9999))}`;
    const billNo = String(_genRand(100000000,999999999));
    // Generate realistic bill amounts
    const totalBill = Math.round((_genRand(prov.avgBill[0]*100, prov.avgBill[1]*100))/100 * 100)/100;
    const waterSvc = Math.round(totalBill * _genRand(65,80)/100 * 100)/100;
    const sewerSvc = Math.round((totalBill - waterSvc) * 100)/100;
    const prevBal = _genRand(0,1) === 0 ? Math.round(totalBill * _genRand(85,115)/100 * 100)/100 : 0;
    const paidAmt = prevBal > 0 ? Math.round(prevBal * _genRand(90,100)/100 * 100)/100 : 0;
    const adj = prevBal > 0 ? -Math.round((prevBal - paidAmt) * 100)/100 : 0;
    const balFwd = 0;
    const pastDue = prevBal > 0 ? Math.round((prevBal - paidAmt + adj) * 100)/100 : 0;
    const savedAmt = Math.round(_genRand(1500,5500)/100 * 100)/100;
    // Tax: Canada uses GST/HST per province; US uses state-specific
    let taxPct;
    if (isCA) {
        const caHST = {ON:0.13,NB:0.15,NS:0.15,NL:0.15,PE:0.15,QC:0.14975,BC:0.12,AB:0.05,SK:0.11,MB:0.12,NT:0.05,YT:0.05,NU:0.05};
        taxPct = caHST[st] || 0.05;
    } else {
        taxPct = _genRand(0, st==='WA'? 1025 : st==='AZ'?230 : st==='IL'?700 : st==='AL'?400 : 0) / 10000;
    }
    const taxAmt = Math.round(totalBill * taxPct * 100)/100;
    const totalToPay = Math.round((totalBill + taxAmt) * 100)/100;
    const fullAddr = `${gen.streetAddress.toUpperCase()}\n${gen.city.toUpperCase()}, ${st} ${gen.postalCode}`;
    const poBox = `PO Box ${_genRand(1000,9999)}`;
    const poCity = isCA
        ? ['Toronto, ON M5H 2N2','Vancouver, BC V6B 3K9','Montreal, QC H2Y 1C6','Calgary, AB T2P 3M3','Ottawa, ON K1A 0B1','Winnipeg, MB R3C 4T3'][_genRand(0,5)]
        : ['Camden, NJ 08101','Trenton, NJ 08650','Atlanta, GA 30348','Dallas, TX 75284','Chicago, IL 60677','Denver, CO 80271'][_genRand(0,5)];
    const postalCode = `##POSTAL${String(_genRand(10000,99999))} ${String(_genRand(100000000,999999999))}`;
    return {
        provider: prov, state: st, stateName: nameMap[st] || st,
        country: country, currSym: currSym,
        name: gen.name.toUpperCase(), address: fullAddr,
        acct, billNo, billDate: fmtD(billDate), dueDate: fmtPay(dueDate),
        waterSvc, sewerSvc, totalBill, taxAmt, taxPct,
        prevBal, paidAmt, adj, balFwd, pastDue, totalToPay,
        savedAmt, poBox, poCity, postalCode
    };
}

function _renderWaterBillHTML(d, font) {
    const f = font || 'Noto Sans';
    const p = d.provider;
    const c = p.color;
    const fm = n => (d.currSym || '$') + Number(n).toFixed(2);
    const provName = p.name.toUpperCase();
    const footerFontSize = provName.length > 30 ? 11 : provName.length > 24 ? 12 : 14;

    return `
<div id="water-bill-render" style="width:794px;min-height:1123px;background:#fff;font-family:'${f}',Arial,sans-serif;color:#222;font-size:13px;line-height:1.5;box-sizing:border-box;padding-bottom:30px">
  <!-- TOP HEADER -->
  <div style="padding:22px 36px 0">
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:12px">
      <div style="width:28px;height:28px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg></div>
      <div style="font-size:15px;font-weight:900;color:${c};letter-spacing:0.5px">${provName}</div>
    </div>
    <div style="display:flex;border:1.5px solid ${c};border-radius:3px;overflow:hidden;background:#fff">
      <div style="flex:1;padding:7px 14px;border-right:1px solid ${c}"><div style="font-size:9px;color:${c};margin-bottom:1px;letter-spacing:0.3px">Account number</div><div style="font-weight:700;font-size:13px;color:#111">${d.acct}</div></div>
      <div style="flex:1;padding:7px 14px;border-right:1px solid ${c}"><div style="font-size:9px;color:${c};margin-bottom:1px;letter-spacing:0.3px">Bill number</div><div style="font-weight:700;font-size:13px;color:#111">${d.billNo}</div></div>
      <div style="flex:1;padding:7px 14px;border-right:1px solid ${c}"><div style="font-size:9px;color:${c};margin-bottom:1px;letter-spacing:0.3px">Bill date</div><div style="font-weight:700;font-size:13px;color:#111">${d.billDate}</div></div>
      <div style="flex:0.55;padding:7px 14px"><div style="font-size:9px;color:${c};margin-bottom:1px;letter-spacing:0.3px">Page</div><div style="font-weight:700;font-size:13px;color:#111">1 of 1</div></div>
    </div>
  </div>

  <!-- GREETING -->
  <div style="padding:24px 36px 14px;font-size:14px">Hello <b>${d.name}</b>, this page gives you a quick summary of your bill.</div>

  <!-- MAIN TWO-COLUMN BODY -->
  <div style="display:flex;padding:8px 36px 0;gap:44px">
    <!-- LEFT COLUMN -->
    <div style="flex:1;min-width:0">
      <div style="font-size:26px;font-weight:300;color:#333;margin-bottom:18px">What is the total due?</div>
      <div style="background:#f4f4f4;padding:14px 18px;margin-bottom:6px">
        <div style="font-size:38px;font-weight:700;color:#111;line-height:1.1">${fm(d.totalToPay)}</div>
      </div>
      ${d.pastDue > 0 ? `<div style="display:flex;gap:10px;align-items:flex-start;margin:12px 0;padding-left:2px"><span style="color:${c};font-size:18px;font-weight:900;line-height:1.3">→</span><div style="font-size:13px;line-height:1.6"><b>Please pay past due balance of<br>${fm(d.pastDue)} immediately</b><br>Then please pay ${fm(d.totalToPay)}&nbsp; by the<br>required payment date of <b>${d.dueDate}</b></div></div>` : `<div style="font-size:13px;color:#444;margin:10px 0;line-height:1.7">Please pay <b>${fm(d.totalToPay)}</b> by the<br>required payment date of <b>${d.dueDate}</b></div>`}
      <div style="font-size:11px;color:#999;margin-top:14px">See page 1 for ways to pay</div>
      <!-- SAVINGS BANNER -->
      <div style="background:#2e7d32;color:#fff;border-radius:6px;padding:12px 16px;margin-top:22px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🏷️</span>
        <span style="font-size:15px;font-weight:600">You saved ${fm(d.savedAmt)} on this bill</span>
      </div>
    </div>

    <!-- RIGHT COLUMN -->
    <div style="flex:1.15;min-width:0">
      <div style="font-size:26px;font-weight:300;color:#333;margin-bottom:18px">What makes up my total?</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td colspan="2" style="font-weight:700;padding:8px 0 6px;border-bottom:2px solid ${c}"><span>Account summary</span><span style="float:right">${d.currSym || '$'}</span></td></tr>
        <tr><td style="padding:7px 0;border-bottom:1px solid #e0e0e0">Balance from last bill</td><td style="text-align:right;padding:7px 0;border-bottom:1px solid #e0e0e0">${d.prevBal.toFixed(2)}</td></tr>
        <tr><td style="padding:7px 0;border-bottom:1px solid #e0e0e0">Your payments - thank you</td><td style="text-align:right;padding:7px 0;border-bottom:1px solid #e0e0e0">${d.paidAmt > 0 ? '-' + d.paidAmt.toFixed(2) : '0.00'}</td></tr>
        ${d.adj !== 0 ? `<tr><td style="padding:7px 0;border-bottom:1px solid #e0e0e0">Adjustments</td><td style="text-align:right;padding:7px 0;border-bottom:1px solid #e0e0e0">${d.adj.toFixed(2)}</td></tr>` : ''}
        <tr><td style="padding:8px 0;font-weight:700">Balance brought forward</td><td style="text-align:right;padding:8px 0;font-weight:700">${d.balFwd.toFixed(2)}</td></tr>
        <tr><td colspan="2" style="font-weight:700;padding:10px 0 6px;border-bottom:2px solid ${c}"><span>This bill</span><span style="float:right">${d.currSym || '$'}</span></td></tr>
        <tr><td style="padding:7px 0 7px 14px;border-bottom:1px solid #e0e0e0"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#0288d1;margin-right:8px;vertical-align:middle"></span>Water Services</td><td style="text-align:right;padding:7px 0;border-bottom:1px solid #e0e0e0">${d.waterSvc.toFixed(2)}</td></tr>
        <tr><td style="padding:7px 0 7px 14px;border-bottom:1px solid #e0e0e0"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#78909c;margin-right:8px;vertical-align:middle"></span>Sewer Services</td><td style="text-align:right;padding:7px 0;border-bottom:1px solid #e0e0e0">${d.sewerSvc.toFixed(2)}</td></tr>
        ${d.taxAmt > 0 ? `<tr><td style="padding:5px 0 5px 18px;font-size:11px;color:#666;border-bottom:1px solid #e0e0e0">Total (Includes ${fm(d.taxAmt)} ${d.country === 'CA' ? 'HST/GST' : 'tax'})</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #e0e0e0">${d.totalBill.toFixed(2)}</td></tr>` : `<tr><td style="padding:5px 0 5px 18px;font-size:11px;color:#666;border-bottom:1px solid #e0e0e0">Total</td><td style="text-align:right;padding:5px 0;border-bottom:1px solid #e0e0e0">${d.totalBill.toFixed(2)}</td></tr>`}
        <tr><td style="padding:10px 12px;font-weight:700;font-size:15px;background:${c};color:#fff;border-radius:4px 0 0 4px">Total to pay</td><td style="text-align:right;padding:10px 12px;font-weight:700;font-size:15px;background:${c};color:#fff;border-radius:0 4px 4px 0">${fm(d.totalToPay)}</td></tr>
      </table>
      <div style="font-size:11px;color:#555;margin-top:14px;line-height:1.6">Any payments we received and processed after ${d.dueDate}<br>will show on your next bill.</div>
      <div style="font-size:11px;color:#555;margin-top:8px;line-height:1.6">Chat with us! For other ways to reach ${p.name},<br>visit <b style="color:${c};text-decoration:underline">${p.web}</b></div>
      <div style="font-size:11px;color:#999;margin-top:5px">See page 2 for other ways to contact us ›</div>
    </div>
  </div>

  <!-- FOOTER SEPARATOR -->
  <hr style="border:none;border-top:1px dashed #bbb;margin:34px 36px 20px">

  <!-- PAYMENT STUB -->
  <div style="padding:0 36px 24px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;max-width:320px">
        <div style="width:24px;height:24px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg></div>
        <span style="font-size:${footerFontSize}px;font-weight:900;color:${c};letter-spacing:0.3px;line-height:1.2">${provName}</span>
      </div>
      <table style="border-collapse:collapse;font-size:12px;min-width:320px">
        <tr><td style="padding:3px 18px 3px 0;color:#444;text-align:left;white-space:nowrap">Your account number:</td><td style="padding:3px 0;font-weight:700;text-align:right">${d.acct}</td></tr>
        <tr><td style="padding:3px 18px 3px 0;color:#444;text-align:left;white-space:nowrap">Total amount due:</td><td style="padding:3px 0;font-weight:700;text-align:right">${fm(d.totalToPay)}</td></tr>
        <tr><td style="padding:3px 18px 3px 0;color:#444;text-align:left;white-space:nowrap">Required Payment Date:</td><td style="padding:3px 0;font-weight:700;text-align:right">${d.dueDate}</td></tr>
        <tr><td colspan="2" style="padding:0;border-bottom:1.5px solid #333;height:6px"></td></tr>
        <tr><td style="padding:5px 18px 3px 0;font-weight:800;font-size:13px;text-align:left;white-space:nowrap">TOTAL:</td><td style="padding:5px 0 3px;font-weight:800;font-size:14px;text-align:right">${fm(d.totalToPay)}</td></tr>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:12px">
      <div style="flex:1">
        <div style="font-size:10px;color:#333;margin-bottom:6px">${d.postalCode}</div>
        <div style="font-size:11px;font-weight:700;margin-bottom:4px">IMPORTANT</div>
        <div style="font-size:10px;color:#555;line-height:1.6;margin-bottom:0;max-width:420px">Payment due upon receipt. Payment must be received on or before the Required Payment Date to avoid a Late Payment Charge. Please make the ${d.country === 'CA' ? 'cheque' : 'check'} payable to ${p.name} (9 digit account number) and write your account number on the front of the ${d.country === 'CA' ? 'cheque' : 'check'}. Return this stub with your payment.</div>
      </div>
      <div style="flex-shrink:0;margin-left:20px;text-align:left">
        <div style="font-size:11px;color:#444;margin-bottom:6px">Amount of your payment:</div>
        <div style="border:1.5px solid #333;padding:8px 14px;min-width:120px;font-size:14px;font-weight:600;color:#222">${fm(d.totalToPay)}</div>
      </div>
    </div>
    <div style="text-align:center;font-size:11px;color:#888;margin:18px 0 14px">########</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="font-size:11px;line-height:1.7">
        <div style="font-weight:700">${p.name}</div>
        <div>${d.poBox}</div>
        <div>${d.poCity}</div>
      </div>
      <div style="font-size:11px;line-height:1.7">
        <div style="font-weight:700">${d.name}</div>
        <div style="white-space:pre-line">${d.address}</div>
      </div>
    </div>

  </div>
</div>`;
}

// ═══════════════════════════════════════════
//   CLEAN NAME — Multi-format Card+Name Parser
// ═══════════════════════════════════════════

/**
 * Parse messy card+name input into clean records.
 * Handles: numbered lists, Name:/Surname: blocks, inline name-card, etc.
 * Returns: [{ card, mm, yy, cvv, name }]
 */
function _parseCleanNameRecords(rawText) {
    const results = [];
    const lines = rawText.split('\n').map(l => l.trim());

    // ── helpers ──
    function extractExpCvv(str) {
        let m;
        // MM/YYCVV  (no space: 04/27476 → 04, 27, 476)
        m = str.match(/(\d{2})\s*[\/\-]\s*(\d{2})(\d{3,4})\s*$/);
        if (m) return { mm: m[1], yy: m[2], cvv: m[3] };
        // MM/YY CVV
        m = str.match(/(\d{2})\s*[\/\-]\s*(\d{2})\s+(\d{3,4})/);
        if (m) return { mm: m[1], yy: m[2], cvv: m[3] };
        // MM YY CVV
        m = str.match(/(\d{2})\s+(\d{2})\s+(\d{3,4})/);
        if (m) return { mm: m[1], yy: m[2], cvv: m[3] };
        // MMYYCVV (7-8 contiguous digits)
        m = str.match(/(\d{2})(\d{2})(\d{3,4})\s*$/);
        if (m && parseInt(m[1]) >= 1 && parseInt(m[1]) <= 12) return { mm: m[1], yy: m[2], cvv: m[3] };
        return null;
    }

    function titleCase(name) {
        return name.trim().replace(/\s+/g, ' ')
            .split(' ')
            .map(w => {
                if (/^(Jr|Jr\.|Sr|Sr\.|II|III|IV|W\.|W)$/i.test(w)) {
                    return w.charAt(0).toUpperCase() + w.slice(1);
                }
                return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            })
            .join(' ');
    }

    /**
     * Find a card number in a string.
     * Strategy:
     *   1) Try contiguous 13-19 digit block first (e.g. 5191230183255208)
     *   2) Try spaced groups like "5221 0082 7036 3919" (4x4 with spaces)
     * Returns { num, endIdx } where endIdx is position after the card in the original string
     */
    function findCard(str) {
        // Strategy 1: Contiguous digits (13-19)
        const contig = str.match(/(\d{13,19})/);
        if (contig) {
            return { num: contig[1], endIdx: contig.index + contig[0].length };
        }
        // Strategy 2: Spaced card number like "5221 0082 7036 3919"
        // Match exactly 4 groups of 4 digits separated by spaces
        const spaced = str.match(/(\d{4}\s+\d{4}\s+\d{4}\s+\d{4})(?!\d)/);
        if (spaced) {
            const clean = spaced[1].replace(/\s+/g, '');
            if (clean.length >= 13 && clean.length <= 19) {
                return { num: clean, endIdx: spaced.index + spaced[0].length };
            }
        }
        // Strategy 3: Shorter spaced (3 groups)
        const spaced3 = str.match(/(\d{4}\s+\d{4}\s+\d{4,5})/);
        if (spaced3) {
            const clean = spaced3[1].replace(/\s+/g, '');
            if (clean.length >= 13 && clean.length <= 19) {
                return { num: clean, endIdx: spaced3.index + spaced3[0].length };
            }
        }
        return null;
    }

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (!line) { i++; continue; }

        // ── Pattern A: Numbered list "N. Name - CardNumber ExpCvv" ──
        const numberedRe = /^\d+[\.\)]\s*(.+?)\s*[-–—]\s*(.+)$/;
        const nm = line.match(numberedRe);
        if (nm) {
            const namePart = nm[1].trim();
            const cardPart = nm[2].trim();
            const card = findCard(cardPart);
            if (card) {
                const afterCard = cardPart.substring(card.endIdx).trim();
                const ec = extractExpCvv(afterCard);
                if (ec) {
                    results.push({ card: card.num, mm: ec.mm, yy: ec.yy, cvv: ec.cvv, name: titleCase(namePart) });
                    i++; continue;
                }
            }
        }

        // ── Pattern B: Non-numbered inline "Name - CardNumber ExpCvv" ──
        const inlineRe = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s\.\-']+?)\s*[-–—]\s*(.+)$/;
        const im = line.match(inlineRe);
        if (im && !nm) {
            const namePart = im[1].trim();
            const cardPart = im[2].trim();
            const card = findCard(cardPart);
            if (card) {
                const afterCard = cardPart.substring(card.endIdx).trim();
                const ec = extractExpCvv(afterCard);
                if (ec) {
                    results.push({ card: card.num, mm: ec.mm, yy: ec.yy, cvv: ec.cvv, name: titleCase(namePart) });
                    i++; continue;
                }
            }
        }

        // ── Pattern C: Card line + Name:/Surname: on next lines ──
        const card = findCard(line);
        if (card) {
            const afterCard = line.substring(card.endIdx).trim();
            const ec = extractExpCvv(afterCard);
            if (ec) {
                // Look ahead for Name:/Surname: lines
                let firstName = '', lastName = '';
                let j = i + 1;
                const maxLook = Math.min(j + 5, lines.length);
                while (j < maxLook) {
                    const nl = lines[j];
                    if (!nl) { j++; continue; }
                    const mnm = nl.match(/^name\s*:\s*(.+)/i);
                    const msn = nl.match(/^surname\s*:\s*(.+)/i);
                    if (mnm) { firstName = mnm[1].trim(); j++; continue; }
                    if (msn) { lastName = msn[1].trim(); j++; continue; }
                    break;
                }
                const fullName = [firstName, lastName].filter(Boolean).join(' ');
                results.push({ card: card.num, mm: ec.mm, yy: ec.yy, cvv: ec.cvv, name: fullName ? titleCase(fullName) : '' });
                i = (firstName || lastName) ? j : i + 1;
                continue;
            }
        }
        i++;
    }
    return results;
}

function _renderCleanNameTool() {
    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.style.display = 'none';
    bar.innerHTML = '';
    const gen = _CK.generator;

    const modeIcons = { proxy: '🌐', bin: '🔢', card: '💳', ip: '📡', auto: '🔍', glue: '🔗', 'cc-glue': '🃏', generator: '📄' };
    const modeLabels = { proxy: 'Proxy', bin: 'BIN', card: 'Card', ip: 'IP', auto: 'Auto', glue: 'Glue', 'cc-glue': 'CC Glue', generator: 'Generator' };

    // Retrieve previous state
    const savedInput = _CK._cleanNameInput || '';
    const savedOutput = _CK._cleanNameOutput || '';
    const savedCount = savedOutput ? savedOutput.split('\n').filter(Boolean).length / 2 : 0;

    area.innerHTML = `
    <div class="ck-container">
        <div class="ck-header">
            <div class="ck-title">
                <span class="ck-icon">🧹</span>
                <span>CLEAN NAME</span>
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

        <div class="ck-proto-bar">
            <span class="ck-proto-label">Type:</span>
            <button class="ck-proto-btn" data-billtype="tepco">⚡ TEPCO Electricity</button>
            <button class="ck-proto-btn" data-billtype="water">💧 Water Bill</button>
            <button class="ck-proto-btn" data-billtype="creditcard">💳 Credit Card</button>
            <button class="ck-proto-btn" data-billtype="driverlicense">🪪 Driver License</button>
            <button class="ck-proto-btn" data-billtype="zipprocessor">📦 ZIP Processor</button>
            <button class="ck-proto-btn" data-billtype="bankstatement">🏦 Bank Statement</button>
            <button class="ck-proto-btn active" data-billtype="cleanname">🧹 Clean Name</button>
        </div>

        <div class="ck-workspace">
            <div class="ck-panel ck-input-panel">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">📥 RAW INPUT</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count" id="cn-input-count">0 lines</span>
                        <button class="ck-action-btn" id="cn-paste-btn" title="Paste from clipboard">📋 Paste</button>
                        <button class="ck-action-btn ck-btn-danger" id="cn-clear-btn" title="Clear">✕</button>
                    </div>
                </div>
                <textarea class="ck-textarea" id="cn-input" placeholder="Paste any messy card + name list here...

Supported formats:

• 5191230183255208 09 27 692
  Name: Travis Allen
  Surname: Jakeway

• 1. Gilbey Bonachea Cabrera- 4520340098766655 10 30 563
  2. Stuart Saward-4538264078002024 09 28 908

• 5221 0082 7036 3919 09/29 279
  Name: Jerry W. Jr
  Surname: Lamm

• Marc Joseph Lauria-5446 1475 6544 8990 04/27476

All formats auto-detected • Output: clean card + cardholder name">${savedInput}</textarea>
            </div>

            <div class="ck-center-actions">
                <button class="ck-convert-btn" id="cn-convert-btn">
                    <span class="ck-convert-arrow">→</span>
                    <span class="ck-convert-text">CLEAN</span>
                </button>
            </div>

            <div class="ck-panel ck-output-panel">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">📤 CLEAN OUTPUT</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count ${savedCount > 0 ? 'ck-count-active' : ''}" id="cn-output-count">${savedCount} cards</span>
                        <button class="ck-action-btn ck-btn-copy" id="cn-copy-btn" title="Copy output" ${!savedOutput ? 'disabled' : ''}>📋 Copy</button>
                    </div>
                </div>
                <textarea class="ck-textarea ck-output-text" id="cn-output" readonly placeholder="Clean output will appear here...

Format:
5524890025769266 04 29 499
Yanthuan Almenares

Each card = 2 lines (card data + cardholder name)">${savedOutput}</textarea>
            </div>
        </div>
    </div>`;

    // ── Bind events ──

    // Mode buttons
    area.querySelectorAll('.ck-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            _CK.mode = btn.dataset.mode;
            _updateSubHashSilent();
            if (_CK.mode === 'glue') _renderGlue();
            else if (_CK.mode === 'cc-glue') _renderCCGlue();
            else if (_CK.mode === 'generator') _renderGenerator();
            else renderChecker();
        });
    });

    // Bill type buttons (generator sub-types)
    area.querySelectorAll('[data-billtype]').forEach(btn => {
        btn.addEventListener('click', () => {
            gen.type = btn.dataset.billtype;
            gen.billData = null;
            _updateSubHashSilent();
            _renderGenerator();
        });
    });

    // Input counting
    const inputEl = document.getElementById('cn-input');
    const updateInputCount = () => {
        const c = (inputEl.value || '').split('\n').filter(l => l.trim()).length;
        document.getElementById('cn-input-count').textContent = `${c} lines`;
    };
    inputEl?.addEventListener('input', updateInputCount);
    updateInputCount();

    // Paste
    document.getElementById('cn-paste-btn')?.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            inputEl.value = text;
            _CK._cleanNameInput = text;
            updateInputCount();
            toast('Pasted from clipboard', 'success');
        } catch { toast('Clipboard access denied', 'error'); }
    });

    // Clear
    document.getElementById('cn-clear-btn')?.addEventListener('click', () => {
        inputEl.value = '';
        document.getElementById('cn-output').value = '';
        _CK._cleanNameInput = '';
        _CK._cleanNameOutput = '';
        document.getElementById('cn-input-count').textContent = '0 lines';
        document.getElementById('cn-output-count').textContent = '0 cards';
        document.getElementById('cn-output-count').classList.remove('ck-count-active');
        document.getElementById('cn-copy-btn').disabled = true;
    });

    // CLEAN button — the main action
    document.getElementById('cn-convert-btn')?.addEventListener('click', () => {
        const raw = inputEl.value.trim();
        if (!raw) { toast('Paste card data first', 'warning'); return; }

        const records = _parseCleanNameRecords(raw);
        if (records.length === 0) { toast('No cards found in input', 'error'); return; }

        // Build output: card line + name line, separated by blank line between records
        const outputLines = records.map(r => {
            const cardLine = `${r.card} ${r.mm} ${r.yy} ${r.cvv}`;
            const nameLine = r.name || 'UNKNOWN';
            return `${cardLine}\n${nameLine}`;
        }).join('\n\n');

        document.getElementById('cn-output').value = outputLines;
        _CK._cleanNameInput = raw;
        _CK._cleanNameOutput = outputLines;

        const countEl = document.getElementById('cn-output-count');
        countEl.textContent = `${records.length} cards`;
        countEl.classList.add('ck-count-active');
        document.getElementById('cn-copy-btn').disabled = false;

        toast(`${records.length} cards cleaned!`, 'success');
    });

    // Copy
    document.getElementById('cn-copy-btn')?.addEventListener('click', () => {
        const text = document.getElementById('cn-output').value;
        if (!text) { toast('Nothing to copy', 'warning'); return; }
        navigator.clipboard.writeText(text).then(() => {
            const c = text.split('\n').filter(l => l.trim()).length;
            toast(`Copied ${Math.floor(c / 2)} cards!`, 'success');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast('Copied!', 'success');
        });
    });
}

function _renderGenerator() {
    // Route to Credit Card generator
    if (_CK.generator.type === 'creditcard') { _renderCreditCardGenerator(); return; }
    // Route to Driver License generator
    if (_CK.generator.type === 'driverlicense') { _renderDriverLicenseGenerator(); return; }
    // Route to ZIP Processor
    if (_CK.generator.type === 'zipprocessor') { _renderZipProcessor(); return; }
    // Route to Bank Statement generator
    if (_CK.generator.type === 'bankstatement') { _renderBankStatementGenerator(); return; }
    // Route to Clean Name formatter
    if (_CK.generator.type === 'cleanname') { _renderCleanNameTool(); return; }

    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.style.display = 'none';
    bar.innerHTML = '';
    const gen = _CK.generator;
    const prefectures = ['Tokyo','Osaka','Kanagawa','Saitama','Chiba','Aichi','Hokkaido','Fukuoka','Hyogo','Kyoto','Shizuoka','Hiroshima','Miyagi','Niigata','Nagano'];

    area.innerHTML = `
    <div class="ck-container">

        <div class="ck-proto-bar">
            <span class="ck-proto-label">Type:</span>
            <button class="ck-proto-btn ${gen.type === 'tepco' ? 'active' : ''}" data-billtype="tepco">⚡ TEPCO Electricity</button>
            <button class="ck-proto-btn ${gen.type === 'water' ? 'active' : ''}" data-billtype="water">💧 Water Bill</button>
            <button class="ck-proto-btn ${gen.type === 'creditcard' ? 'active' : ''}" data-billtype="creditcard">💳 Credit Card</button>
            <button class="ck-proto-btn ${gen.type === 'driverlicense' ? 'active' : ''}" data-billtype="driverlicense">🪪 Driver License</button>
            <button class="ck-proto-btn ${gen.type === 'zipprocessor' ? 'active' : ''}" data-billtype="zipprocessor">📦 ZIP Processor</button>
            <button class="ck-proto-btn ${gen.type === 'bankstatement' ? 'active' : ''}" data-billtype="bankstatement">🏦 Bank Statement</button>
            <button class="ck-proto-btn ${gen.type === 'cleanname' ? 'active' : ''}" data-billtype="cleanname">🧹 Clean Name</button>
        </div>

        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;padding:6px 10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:6px">
            <input type="text" id="gen-name" placeholder="Name" value="${gen.name}" style="flex:1;min-width:120px;height:28px;padding:2px 8px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#e5e7eb;outline:none;font-family:inherit">
            <input type="text" id="gen-postal" placeholder="${gen.type==='water'?(gen.waterCountry==='CA'?'Postal Code':'ZIP Code'):'Postal'}" value="${gen.postalCode}" style="width:80px;height:28px;padding:2px 8px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#e5e7eb;outline:none;font-family:inherit">
            <input type="text" id="gen-street" placeholder="Street Address" value="${gen.streetAddress}" style="flex:1.5;min-width:150px;height:28px;padding:2px 8px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#e5e7eb;outline:none;font-family:inherit">
            <input type="text" id="gen-city" placeholder="City" value="${gen.city}" style="width:100px;height:28px;padding:2px 8px;font-size:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#e5e7eb;outline:none;font-family:inherit">
            ${gen.type === 'water' ? `
            <button class="ck-proto-btn ${gen.waterCountry === 'US' ? 'active' : ''}" data-wcountry="US" style="height:28px;padding:2px 10px;font-size:11px">🇺🇸 USA</button>
            <button class="ck-proto-btn ${gen.waterCountry === 'CA' ? 'active' : ''}" data-wcountry="CA" style="height:28px;padding:2px 10px;font-size:11px">🇨🇦 Canada</button>
            <select id="gen-state" style="width:220px;height:28px;padding:2px 4px;font-size:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#e5e7eb;outline:none;font-family:inherit">
                ${gen.waterCountry === 'CA'
                    ? CA_PROVINCES_LIST.map(s => `<option value="${s}" ${gen.waterState === s ? 'selected' : ''}>${s} (${CA_PROVINCE_NAMES[s]}) — ${CA_WATER_PROVIDERS[s].name}</option>`).join('')
                    : US_STATES_LIST.map(s => `<option value="${s}" ${gen.waterState === s ? 'selected' : ''}>${s} (${US_STATE_NAMES[s]}) — ${US_WATER_PROVIDERS[s].name}</option>`).join('')}
            </select>` : `
            <select id="gen-pref" style="width:80px;height:28px;padding:2px 4px;font-size:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#e5e7eb;outline:none;font-family:inherit">
                ${prefectures.map(p => `<option value="${p}" ${gen.prefecture === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>`}
            <select id="gen-font" style="width:110px;height:28px;padding:2px 4px;font-size:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:#e5e7eb;outline:none;font-family:inherit" title="Document Font">
                ${['Noto Sans','Open Sans','Roboto','Lato','Inter'].map(f => `<option value="${f}" ${gen.font === f ? 'selected' : ''} style="font-family:${f}">${f}</option>`).join('')}
            </select>
            <button class="ck-convert-btn" id="gen-btn" style="padding:4px 16px;height:28px;white-space:nowrap;font-size:11px">${gen.type==='water'?'💧':'⚡'} GENERATE</button>
            ${gen.billData ? `<button class="ck-action-btn ck-btn-copy" id="gen-regen" style="padding:4px 10px;height:28px;font-size:11px">🔄</button><button class="ck-action-btn ck-btn-copy" id="gen-dl-png" style="padding:4px 10px;height:28px;font-size:11px">📥 PNG</button><button class="ck-action-btn ck-btn-copy" id="gen-dl-pdf" style="padding:4px 10px;height:28px;font-size:11px">📄 PDF</button>` : ''}
        </div>

        <div id="gen-preview" style="margin-top:12px;overflow:auto;background:#d1d5db;border-radius:8px;display:flex;justify-content:center;padding:20px;min-height:200px">
            ${gen.billData ? (gen.type === 'water' ? _renderWaterBillHTML(gen.billData, gen.font) : _renderTEPCOBillHTML(gen.billData, gen.font)) :
            '<div style="color:#6b7280;text-align:center;padding:80px 20px;font-size:13px">Fill in your data and click GENERATE</div>'}
        </div>
    </div>`;

    // Bind events
    area.querySelectorAll('[data-billtype]').forEach(btn => {
        btn.addEventListener('click', () => { gen.type = btn.dataset.billtype; gen.billData = null; _updateSubHashSilent(); _renderGenerator(); });
    });
    // Water country toggle (USA / Canada)
    area.querySelectorAll('[data-wcountry]').forEach(btn => {
        btn.addEventListener('click', () => {
            const newCountry = btn.dataset.wcountry;
            if (gen.waterCountry !== newCountry) {
                gen.waterCountry = newCountry;
                gen.waterState = newCountry === 'CA' ? 'ON' : 'NY';
                gen.billData = null;
                _renderGenerator();
            }
        });
    });
    document.getElementById('gen-btn')?.addEventListener('click', () => {
        gen.name = document.getElementById('gen-name')?.value || '';
        gen.postalCode = document.getElementById('gen-postal')?.value || '';
        gen.streetAddress = document.getElementById('gen-street')?.value || '';
        gen.city = document.getElementById('gen-city')?.value || '';
        gen.prefecture = document.getElementById('gen-pref')?.value || gen.prefecture || 'Tokyo';
        gen.waterState = document.getElementById('gen-state')?.value || gen.waterState || 'NY';
        if (!gen.name.trim() || !gen.streetAddress.trim()) { toast('Enter at least Name and Address', 'error'); return; }
        if (gen.type === 'tepco') { gen.billData = _generateTEPCOData(gen); }
        else if (gen.type === 'water') { gen.billData = _generateWaterBillData(gen); }
        _renderGenerator();
        toast('Bill generated!', 'success');
    });
    document.getElementById('gen-regen')?.addEventListener('click', () => {
        if (gen.type === 'tepco') gen.billData = _generateTEPCOData(gen);
        else if (gen.type === 'water') gen.billData = _generateWaterBillData(gen);
        _renderGenerator();
        toast('New bill generated', 'success');
    });
    document.getElementById('gen-dl-png')?.addEventListener('click', () => {
        const elId = gen.type === 'water' ? 'water-bill-render' : 'tepco-bill-render';
        const el = document.getElementById(elId);
        if (!el || typeof html2canvas === 'undefined') { toast('Export not available', 'error'); return; }
        const tmp = document.createElement('div');
        tmp.style.cssText = 'position:absolute;left:-9999px;top:0;z-index:-1;background:#fff;overflow:visible;width:auto;height:auto;';
        tmp.innerHTML = el.outerHTML;
        document.body.appendChild(tmp);
        const clone = tmp.firstElementChild;
        clone.style.overflow = 'visible';
        html2canvas(clone, { scale: 2, backgroundColor: '#ffffff', useCORS: true, width: clone.scrollWidth, height: clone.scrollHeight, windowWidth: clone.scrollWidth + 100 }).then(canvas => {
            document.body.removeChild(tmp);
            const link = document.createElement('a');
            const prefix = gen.type === 'water' ? 'WaterBill' : 'TEPCO';
            link.download = `${prefix}_${gen.name.replace(/\s+/g,'_')}_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast('PNG downloaded!', 'success');
        }).catch(e => { try { document.body.removeChild(tmp); } catch(x){} console.error(e); toast('Export failed', 'error'); });
    });
    document.getElementById('gen-dl-pdf')?.addEventListener('click', () => {
        const elId = gen.type === 'water' ? 'water-bill-render' : 'tepco-bill-render';
        const el = document.getElementById(elId);
        if (!el || typeof html2canvas === 'undefined' || !window.jspdf) { toast('PDF export not available', 'error'); return; }
        const tmp = document.createElement('div');
        tmp.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;background:#fff;';
        tmp.innerHTML = el.outerHTML;
        document.body.appendChild(tmp);
        const clone = tmp.firstElementChild;
        html2canvas(clone, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then(canvas => {
            document.body.removeChild(tmp);
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
            const pW = pdf.internal.pageSize.getWidth();
            const pH = pdf.internal.pageSize.getHeight();
            const imgW = pW - 20;
            const imgH = (canvas.height * imgW) / canvas.width;
            const yOff = Math.max(10, (pH - imgH) / 2);
            pdf.addImage(imgData, 'PNG', 10, yOff, imgW, Math.min(imgH, pH - 20));
            const prefix = gen.type === 'water' ? 'WaterBill' : 'TEPCO';
            pdf.save(`${prefix}_${gen.name.replace(/\s+/g,'_')}_${Date.now()}.pdf`);
            toast('PDF downloaded!', 'success');
        }).catch(e => { document.body.removeChild(tmp); console.error(e); toast('PDF export failed', 'error'); });
    });
    // Save inputs on change
    ['gen-name','gen-postal','gen-street','gen-city'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', e => {
            const key = {
                'gen-name': 'name', 'gen-postal': 'postalCode',
                'gen-street': 'streetAddress', 'gen-city': 'city'
            }[id];
            if (key) gen[key] = e.target.value;
        });
    });
    document.getElementById('gen-pref')?.addEventListener('change', e => { gen.prefecture = e.target.value; });
    document.getElementById('gen-state')?.addEventListener('change', e => { gen.waterState = e.target.value; });
    document.getElementById('gen-font')?.addEventListener('change', e => {
        gen.font = e.target.value;
        const preview = document.getElementById('gen-preview');
        if (preview && gen.billData) {
            preview.innerHTML = gen.type === 'water' ? _renderWaterBillHTML(gen.billData, gen.font) : _renderTEPCOBillHTML(gen.billData, gen.font);
        }
    });
}

function renderChecker() {
    // Redirect old modes to valid defaults
    if (['glue', 'cc-glue', 'generator', 'ip', 'auto'].includes(_CK.mode)) { _CK.mode = 'proxy'; }

    const area = document.getElementById('content-area');
    const bar = document.getElementById('stats-bar');
    bar.style.display = 'none';
    bar.innerHTML = '';

    const modeIcons = { proxy: '🌐', bin: '🔢', card: '💳' };
    const modeLabels = { proxy: 'Proxy', bin: 'BIN', card: 'Card' };
    const modePlaceholders = {
        proxy: 'Paste any text containing proxies — they will be extracted automatically\n\nSupported formats:\n• user:pass@host:port\n• host:port:user:pass\n• user:pass:host:port\n• protocol://user:pass@host:port\n• host:port\n• IP:PORT from logs, JSON, HTML\n\nGarbage text is ignored automatically',
        bin: 'Paste any text — BINs will be extracted automatically\n\n4242424242424242|11|26|777\nCard: 5326 1023 4355 9988\nCC: 4111111111111111 Exp: 05/26 CVV: 456\nRandom log text with 5454781003037335...\n\nAll formats supported • Duplicates removed\nOutput: /bin 424242',
        card: 'Paste ANY text — cards will be extracted automatically\n\nSupported formats:\n• 4242424242424242|03|27|111   (pipe)\n• 4242424242424242:03:27:111   (colon)\n• 4242424242424242 03 27 111   (space)\n• 4242424242424242,03,27,111   (CSV)\n• 4242424242424242;03;27;111   (semicolon)\n• 4242424242424242~03~27~111   (tilde)\n• 4242424242424242|0327|111    (MMYY combined)\n• 4242424242424242 03/27 111   (date inline)\n• 4242...|03|2027|111|LIVE     (checker output)\n• {"cc":"4242...","mm":"03"...} (JSON)\n• cc=4242...&month=03&year=27   (query string)\n• Card: 4242... Exp: 03/27 CVV: 111\n• 💳 CC: 4242...  📅 Exp: 03/27  🔐 CVV: 111\n• Multi-line blocks (number/date/cvv)\n• HTML, URL-encoded, mixed garbage\n\n40+ formats • Auto-detect network • Deduplicates',
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

        ${_CK.mode === 'bin' && Object.keys(tab.binGroups || {}).length > 0 ? (() => {
            // ── BIN MODE: 3-panel layout ──
            const bg = tab.binGroups;
            const sel = tab.selectedBins;
            const sortedBins = Object.keys(bg).sort();
            const totalSelected = sortedBins.filter(b => sel.has(b)).reduce((s, b) => s + bg[b].length, 0);
            const allSelected = sortedBins.length > 0 && sortedBins.every(b => sel.has(b));
            // Build export cards text
            let exportLines = [];
            sortedBins.filter(b => sel.has(b)).forEach(bin => {
                bg[bin].forEach(c => exportLines.push(`${c.ccn}|${c.mm}|${c.yy}|${c.cvv}`));
            });
            const exportText = exportLines.join('\n');
            return `
        <div class="ck-workspace ck-bin-workspace">
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

            <div class="ck-panel ck-bin-panel">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">🔢 BINs <span class="ck-count ck-count-active">${sortedBins.length}</span></span>
                    <div class="ck-panel-actions">
                        <button class="ck-action-btn ck-bin-toggle-all" id="ck-bin-toggle-all" title="${allSelected ? 'Deselect All' : 'Select All'}">${allSelected ? '☐ None' : '☑ All'}</button>
                        <button class="ck-action-btn ck-btn-copy" id="ck-copy-btn" title="Copy BINs" ${!outLines ? 'disabled' : ''}>📋</button>
                    </div>
                </div>
                <div class="ck-bin-list" id="ck-bin-chips">
                    ${sortedBins.map(bin => {
                        const cards = bg[bin];
                        const isSelected = sel.has(bin);
                        const network = cards[0]?.network || '??';
                        const netIcon = network === 'VISA' ? '💙' : network === 'MASTERCARD' ? '🧡' : network === 'AMEX' ? '💜' : network === 'JCB' ? '💚' : '⬜';
                        // Check BIN cache for instant info
                        const cached = BIN_CACHE[bin];
                        const flag = cached && cached.country ? isoToFlag(cached.country) : '';
                        const bankText = cached && !cached.error ? [cached.brand, cached.type, cached.level].filter(Boolean).join(' ') : '';
                        const bankName = cached && !cached.error && cached.bank ? cached.bank : '';
                        const countryName = cached && !cached.error && cached.country ? (COUNTRY_DB[cached.country.toUpperCase()] || cached.country) : '';
                        return `<div class="ck-bin-row ${isSelected ? 'selected' : ''}" data-bin="${bin}" title="${network} • ${cards.length} cards">
                            <span class="ck-bin-row-icon">${netIcon}</span>
                            <span class="ck-bin-row-num">${bin}</span>
                            <span class="ck-bin-row-count">×${cards.length}</span>
                            <span class="ck-bin-row-info" id="bin-info-${bin}">${cached ? (flag ? flag + ' ' : '') + (bankText ? '<span class=\"ck-bin-row-type\">' + bankText + '</span>' : '') + (bankName ? ' <span class=\"ck-bin-row-bank\">' + bankName + '</span>' : '') : '<span class=\"ck-bin-row-loading\">⏳</span>'}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <div class="ck-panel ck-output-panel ck-export-panel">
                <div class="ck-panel-header">
                    <span class="ck-panel-title">📤 EXPORT</span>
                    <div class="ck-panel-actions">
                        <span class="ck-count ${totalSelected > 0 ? 'ck-count-active' : ''}" id="ck-output-count">${totalSelected} cards</span>
                        <button class="ck-action-btn ck-btn-copy" id="ck-export-copy" title="Copy selected cards" ${!totalSelected ? 'disabled' : ''}>📋 Copy</button>
                    </div>
                </div>
                <textarea class="ck-textarea ck-output-text" id="ck-output" readonly placeholder="Select BINs to export cards...">${exportText}</textarea>
            </div>
        </div>`;
        })() : `
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
        </div>`}

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
            _updateSubHashSilent();
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
        if (_CK.mode === 'bin') {
            _CK.tabs.bin.binGroups = {};
            _CK.tabs.bin.selectedBins = new Set();
            _CK.tabs.bin.binCards = [];
        }
        renderChecker();
    });

    // ── BIN Mode: row selection, toggle-all, export, BIN lookup ──
    if (_CK.mode === 'bin') {
        // Helper: update BIN UI in-place without full re-render (preserves scroll)
        function _ckUpdateBinUI() {
            const tab = _CK.tabs.bin;
            const bg = tab.binGroups;
            const sel = tab.selectedBins;
            const sortedBins = Object.keys(bg).sort();

            // Update row selected classes
            area.querySelectorAll('.ck-bin-row').forEach(row => {
                row.classList.toggle('selected', sel.has(row.dataset.bin));
            });

            // Rebuild export text
            let exportLines = [];
            sortedBins.filter(b => sel.has(b)).forEach(bin => {
                bg[bin].forEach(c => exportLines.push(`${c.ccn}|${c.mm}|${c.yy}|${c.cvv}`));
            });
            const totalSelected = sortedBins.filter(b => sel.has(b)).reduce((s, b) => s + bg[b].length, 0);
            const exportText = exportLines.join('\n');

            // Update export textarea
            const outputEl = document.getElementById('ck-output');
            if (outputEl) outputEl.value = exportText;

            // Update export count
            const countEl = document.getElementById('ck-output-count');
            if (countEl) {
                countEl.textContent = `${totalSelected} cards`;
                countEl.classList.toggle('ck-count-active', totalSelected > 0);
            }

            // Update export copy button disabled state
            const copyBtn = document.getElementById('ck-export-copy');
            if (copyBtn) copyBtn.disabled = !totalSelected;

            // Update Toggle All button
            const allSelected = sortedBins.length > 0 && sortedBins.every(b => sel.has(b));
            const toggleBtn = document.getElementById('ck-bin-toggle-all');
            if (toggleBtn) {
                toggleBtn.textContent = allSelected ? '☐ None' : '☑ All';
                toggleBtn.title = allSelected ? 'Deselect All' : 'Select All';
            }
        }

        // BIN row click — toggle selection (in-place, no scroll jump)
        area.querySelectorAll('.ck-bin-row').forEach(chip => {
            chip.addEventListener('click', () => {
                const bin = chip.dataset.bin;
                const sel = _CK.tabs.bin.selectedBins;
                if (sel.has(bin)) sel.delete(bin);
                else sel.add(bin);
                _ckUpdateBinUI();
            });
            // Right-click → copy /bin format
            chip.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const bin = chip.dataset.bin;
                const binText = `/bin ${bin}`;
                // Remove any existing bin context menu
                document.querySelectorAll('.ck-bin-ctx').forEach(el => el.remove());
                // Create mini context menu
                const ctx = document.createElement('div');
                ctx.className = 'ck-bin-ctx';
                ctx.innerHTML = `<button class="ck-bin-ctx-item">📋 Copy <span style="color:#a78bfa;font-family:var(--font-mono,'JetBrains Mono',monospace)">${binText}</span></button>`;
                ctx.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
                ctx.style.top = Math.min(e.clientY, window.innerHeight - 40) + 'px';
                document.body.appendChild(ctx);
                // Click item → copy & close
                ctx.querySelector('.ck-bin-ctx-item').addEventListener('click', () => {
                    navigator.clipboard.writeText(binText).then(() => {
                        toast(`Copied: ${binText}`, 'success');
                    }).catch(() => {
                        const ta = document.createElement('textarea');
                        ta.value = binText;
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                        toast(`Copied: ${binText}`, 'success');
                    });
                    ctx.remove();
                });
                // Dismiss on click outside
                const dismiss = (ev) => {
                    if (!ctx.contains(ev.target)) { ctx.remove(); document.removeEventListener('click', dismiss); }
                };
                setTimeout(() => document.addEventListener('click', dismiss), 10);
            });
        });

        // Toggle All / None (in-place update)
        document.getElementById('ck-bin-toggle-all')?.addEventListener('click', () => {
            const tab = _CK.tabs.bin;
            const sortedBins = Object.keys(tab.binGroups);
            const allSelected = sortedBins.length > 0 && sortedBins.every(b => tab.selectedBins.has(b));
            if (allSelected) {
                tab.selectedBins = new Set();
            } else {
                tab.selectedBins = new Set(sortedBins);
            }
            _ckUpdateBinUI();
        });

        // Export copy button
        document.getElementById('ck-export-copy')?.addEventListener('click', () => {
            const outputEl = document.getElementById('ck-output');
            const text = outputEl?.value;
            if (!text) { toast('Select BINs first', 'warning'); return; }
            navigator.clipboard.writeText(text).then(() => {
                const count = text.split('\n').filter(l => l.trim()).length;
                toast(`${count} cards copied!`, 'success');
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                toast('Cards copied!', 'success');
            });
        });

        // ── Async BIN Lookup: fetch info for uncached BINs ──
        area.querySelectorAll('.ck-bin-row').forEach(row => {
            const bin = row.dataset.bin;
            if (!BIN_CACHE[bin]) {
                lookupBin(bin).then(info => {
                    const infoEl = document.getElementById(`bin-info-${bin}`);
                    if (!infoEl) return;
                    if (!info || info.error) {
                        infoEl.innerHTML = '<span class="ck-bin-row-na">—</span>';
                        return;
                    }
                    const flag = info.country ? isoToFlag(info.country) : '';
                    const typeStr = [info.brand, info.type, info.level].filter(Boolean).join(' ');
                    const bankStr = info.bank || '';
                    let html = '';
                    if (flag) html += flag + ' ';
                    if (typeStr) html += `<span class="ck-bin-row-type">${typeStr}</span>`;
                    if (bankStr) html += ` <span class="ck-bin-row-bank">${bankStr}</span>`;
                    infoEl.innerHTML = html || '<span class="ck-bin-row-na">—</span>';
                    infoEl.classList.add('ck-bin-row-loaded');
                }).catch(() => {
                    const infoEl = document.getElementById(`bin-info-${bin}`);
                    if (infoEl) infoEl.innerHTML = '<span class="ck-bin-row-na">—</span>';
                });
            }
        });
    }

    // Convert button (not shown in BIN mode when bins are displayed)
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


// ──── DOMAIN MODULE — Japan Profile Generator ────
function renderDomain() {
    const area = document.getElementById('content-area');

    // ── DATA POOLS (Hokkaido only — real addresses & ZIP codes) ──
    const FIRST_NAMES = [
        'AKITO','HARUTO','REN','YUTO','SORA','KAITO','HIROSHI','TAKESHI','RYOTA','KENJI',
        'DAIKI','NAOKI','SHOTA','YUKI','KENTA','MASARU','TOSHIRO','SHIN','KAZUYA','NOBORU',
        'AKIRA','MAKOTO','SATOSHI','YUSEI','HAYATO','RIKU','MINATO','SOUTA','ASAHI','HINATA',
        'TAIGA','YAMATO','ITSUKI','AOI','HARU','KAI','SHINJI','TSUBASA','KOKI','REI'
    ];
    const LAST_NAMES = [
        'TANAKA','SUZUKI','TAKAHASHI','WATANABE','SATO','ITO','YAMAMOTO','NAKAMURA','KOBAYASHI','KATO',
        'YOSHIDA','YAMADA','SASAKI','YAMAGUCHI','MATSUMOTO','INOUE','KIMURA','SHIMIZU','HAYASHI','SAITO',
        'SAGURO','OKAZAKI','UEDA','FUJITA','OGAWA','HASEGAWA','MURAKAMI','KONDOH','ISHIKAWA','MAEDA',
        'OKADA','NISHIMURA','MORITA','ENDO','AOKI','IKEDA','SAKAMOTO','HASHIMOTO','NOGUCHI','KAWAMURA'
    ];
    const BIZ_FIRST = [
        'Hokkai','Yukimura','Sapporo','Otaru','Kamui','Tokachi','Shiretoko','Niseko','Furano','Asahiyama',
        'Kitami','Rumoi','Kushiro','Taisetsu','Sorachi','Ishikari','Hidaka','Kamikawa','Iburi','Oshima'
    ];
    const BIZ_SECOND = [
        'Digital','Works','Web','Creative','Studio','Office','Solutions','Tech','Labs','Media',
        'Nexus','Systems','Cloud','Logic','Hub','Bridge','Link','Net','Point','Core'
    ];
    const BIZ_SUFFIX = ['JP','Japan','Co','Inc',''];

    // Real Hokkaido addresses: street + city/ward + ZIP code (all verified)
    const HOKKAIDO_ADDRESSES = [
        // Sapporo — Chuo-ku
        { street: 'Kita 1-jo Nishi 2-chome',     city: 'Chuo-ku, Sapporo-shi', zip: '060-0001' },
        { street: 'Kita 2-jo Nishi 3-chome',     city: 'Chuo-ku, Sapporo-shi', zip: '060-0002' },
        { street: 'Kita 3-jo Nishi 4-chome',     city: 'Chuo-ku, Sapporo-shi', zip: '060-0003' },
        { street: 'Kita 4-jo Nishi 5-chome',     city: 'Chuo-ku, Sapporo-shi', zip: '060-0004' },
        { street: 'Kita 5-jo Nishi 2-chome 5',   city: 'Chuo-ku, Sapporo-shi', zip: '060-0005' },
        { street: 'Odori Nishi 3-chome 6',        city: 'Chuo-ku, Sapporo-shi', zip: '060-0042' },
        { street: 'Odori Nishi 4-chome 1',        city: 'Chuo-ku, Sapporo-shi', zip: '060-0042' },
        { street: 'Minami 1-jo Nishi 5-chome',   city: 'Chuo-ku, Sapporo-shi', zip: '060-0061' },
        { street: 'Minami 1-jo Nishi 6-chome 20-1', city: 'Chuo-ku, Sapporo-shi', zip: '060-0061' },
        { street: 'Minami 2-jo Nishi 3-chome',   city: 'Chuo-ku, Sapporo-shi', zip: '060-0062' },
        { street: 'Minami 3-jo Nishi 4-chome',   city: 'Chuo-ku, Sapporo-shi', zip: '060-0063' },
        { street: 'Minami 4-jo Nishi 4-chome 1',  city: 'Chuo-ku, Sapporo-shi', zip: '060-0064' },
        // Sapporo — Kita-ku
        { street: 'Kita 7-jo Nishi 2-chome',     city: 'Kita-ku, Sapporo-shi', zip: '060-0807' },
        { street: 'Kita 8-jo Nishi 3-chome 28',  city: 'Kita-ku, Sapporo-shi', zip: '060-0808' },
        { street: 'Kita 9-jo Nishi 4-chome',     city: 'Kita-ku, Sapporo-shi', zip: '060-0809' },
        { street: 'Kita 10-jo Nishi 3-chome',    city: 'Kita-ku, Sapporo-shi', zip: '001-0010' },
        { street: 'Kita 12-jo Nishi 4-chome 1-1', city: 'Kita-ku, Sapporo-shi', zip: '001-0012' },
        { street: 'Shinoro 2-jo 5-chome',         city: 'Kita-ku, Sapporo-shi', zip: '002-8021' },
        // Sapporo — Toyohira-ku
        { street: 'Tsukisamu Higashi 1-jo 9-chome', city: 'Toyohira-ku, Sapporo-shi', zip: '062-0051' },
        { street: 'Hiragishi 3-jo 5-chome 1-27', city: 'Toyohira-ku, Sapporo-shi', zip: '062-0933' },
        // Sapporo — Shiroishi-ku
        { street: 'Nango-dori 1-chome Kita 4-1',  city: 'Shiroishi-ku, Sapporo-shi', zip: '003-0023' },
        { street: 'Hondori 14-chome Kita 1-3',    city: 'Shiroishi-ku, Sapporo-shi', zip: '003-0027' },
        // Sapporo — Nishi-ku
        { street: 'Kotoni 2-jo 1-chome',          city: 'Nishi-ku, Sapporo-shi', zip: '063-0812' },
        { street: 'Hassamu 6-jo 2-chome',         city: 'Nishi-ku, Sapporo-shi', zip: '063-0826' },
        // Asahikawa
        { street: 'Miyashita-dori 7-chome',       city: 'Asahikawa-shi', zip: '070-0030' },
        { street: '1-jo-dori 8-chome',            city: 'Asahikawa-shi', zip: '070-0031' },
        { street: '3-jo-dori 6-chome',            city: 'Asahikawa-shi', zip: '070-0033' },
        // Hakodate
        { street: 'Wakamatsu-cho 33-6',           city: 'Hakodate-shi', zip: '040-0063' },
        { street: 'Suehiro-cho 14-12',            city: 'Hakodate-shi', zip: '040-0053' },
        { street: 'Motomachi 12-18',              city: 'Hakodate-shi', zip: '040-0054' },
        // Otaru
        { street: 'Ironai 1-chome 1-1',           city: 'Otaru-shi', zip: '047-0031' },
        { street: 'Inaho 2-chome 22-1',           city: 'Otaru-shi', zip: '047-0032' },
        // Obihiro
        { street: 'Nishi 2-jo Minami 12-chome',  city: 'Obihiro-shi', zip: '080-0012' },
        { street: 'Odori Minami 7-chome 15',      city: 'Obihiro-shi', zip: '080-0010' },
        // Kushiro
        { street: 'Kita-Odori 1-chome 2',         city: 'Kushiro-shi', zip: '085-0015' },
        { street: 'Saiwai-cho 9-chome 1',         city: 'Kushiro-shi', zip: '085-0017' },
    ];

    // Real Sapporo buildings / landmarks
    const BUILDINGS = [
        'Sapporo Ekimae-dori Building','JR Tower Office Sapporo','Sapporo Factory',
        'Hokkaido Keizai Center','Sapporo Grand Hotel Annex','Odori Bus Center Building',
        'Sapporo Tokyu Building','Norubesa Building','Tanuki-koji 2F',
        'Hokkaido Building','Sapporo Stellar Place','APIA Shopping Mall',
        'Pole Town Underground','Sapporo TV Tower Side','Akarenga Terrace',
        'Sapporo ESTA Building','Daimaru Sapporo Building','Mitsui Garden Hotel',
        'Cross Hotel Sapporo Annex','Sapporo Central Building'
    ];

    const DOM_PREFIXES = [
        'hokkaidovault','sapporofield','kamuilogic','tokachinet','otaruworks','nisekohub',
        'furanolabs','asahicloud','kushirotech','hidakalink','sorachicore','ishikarinova',
        'shiretokobright','taisetsuzn','iburigate','oshimacraft','rumoimark','kitaminet',
        'hokkaiworks','yukibridge'
    ];
    const DOM_SUFFIXES = ['21','337','4082','59','1706','803','247','55','9021','612','78','3301'];

    function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function rndNum(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    function genProfile() {
        const bizFirst = rnd(BIZ_FIRST);
        const bizSecond = rnd(BIZ_SECOND);
        const bizSuffix = rnd(BIZ_SUFFIX);
        const bizName = [bizFirst, bizSecond, bizSuffix].filter(Boolean).join(' ');

        // Domain: just name, no extension
        const domainName = rnd(DOM_PREFIXES) + rnd(DOM_SUFFIXES);

        // Pick a real address (street + city + zip all match)
        const addr = rnd(HOKKAIDO_ADDRESSES);
        const building = rnd(BUILDINGS);
        // Phone: Sapporo area code 011
        const phone = `11${rndNum(1000000,9999999)}`;
        const firstName = rnd(FIRST_NAMES);
        const lastName = rnd(LAST_NAMES);

        return {
            bizName, domain: domainName,
            street: addr.street, building: building,
            city: addr.city, pref: 'Hokkaido', postal: addr.zip,
            phone, firstName, lastName,
            username: 'admin',
            password: 'ASwsx23$#$23x'
        };
    }

    function genNames() {
        const names = [];
        const used = new Set();
        while (names.length < 9) {
            const f = rnd(FIRST_NAMES);
            const l = rnd(LAST_NAMES);
            const key = f + ' ' + l;
            if (!used.has(key)) { used.add(key); names.push({ first: f, last: l }); }
        }
        return names;
    }

    // Init state
    if (!STATE._domProfile) STATE._domProfile = genProfile();
    if (!STATE._domNames) STATE._domNames = genNames();
    if (typeof STATE._domCleanerInput === 'undefined') STATE._domCleanerInput = '';
    if (typeof STATE._domCleanerOutput === 'undefined') STATE._domCleanerOutput = '';

    const p = STATE._domProfile;
    const names = STATE._domNames;

    function row(label, value) {
        return `<div class="dom-row">
            <span class="dom-label">${label}</span>
            <span class="dom-value" data-copy="${value.replace(/"/g, '&quot;')}">${value}</span>
        </div>`;
    }

    area.innerHTML = `
        <div class="dom-page">
            <!-- COLUMN 1: Profile Generator -->
            <div class="dom-col dom-col-profile">
                <div class="dom-toolbar">
                    <button class="dom-btn dom-btn-gen" id="dom-generate">⚡ Generate</button>
                    <button class="dom-btn dom-btn-pref" disabled style="opacity:.6;cursor:default">🏔️ Hokkaido</button>
                    <button class="dom-btn dom-btn-copy" id="dom-copy-all">📋 Copy All</button>
                </div>
                <div class="dom-block">
                    ${row('Business Name', p.bizName)}
                    ${row('Domain', p.domain)}
                    <div class="dom-divider"></div>
                    ${row('Street Address', p.street)}
                    ${row('Street Address Line 2', p.building)}
                    ${row('City', p.city)}
                    ${row('Prefecture', p.pref)}
                    ${row('Postal Code', p.postal)}
                    ${row('Phone', p.phone)}
                    <div class="dom-divider"></div>
                    ${row('First Name', p.firstName)}
                    ${row('Last Name', p.lastName)}
                    <div class="dom-divider"></div>
                    ${row('Username', p.username)}
                    ${row('Password', p.password)}
                    ${row('Confirm Password', p.password)}
                </div>
            </div>

            <!-- COLUMN 2: Names Generator -->
            <div class="dom-col dom-col-names">
                <div class="dom-names-header">
                    <span class="dom-names-title">Names</span>
                    <button class="dom-btn dom-btn-regen" id="dom-regen-names">↻ Regen</button>
                </div>
                <div class="dom-names-list">
                    ${names.map((n, i) => `<div class="dom-name-row">
                        <span class="dom-name-idx">${i + 1}.</span>
                        <span class="dom-name-part" data-copy="${n.first}">${n.first}</span>
                        <span class="dom-name-part" data-copy="${n.last}">${n.last}</span>
                    </div>`).join('')}
                </div>
            </div>

            <!-- COLUMN 3: Workspace Cleaner -->
            <div class="dom-col dom-col-cleaner">
                <div class="dom-names-header">
                    <span class="dom-names-title">Workspace Cleaner</span>
                    <button class="dom-btn dom-btn-gen" id="dom-clean-btn">⚡ Clean</button>
                </div>
                <textarea id="dom-cleaner-input" class="dom-cleaner-ta" placeholder="Paste Google Workspace output here...">${STATE._domCleanerInput.replace(/</g,'&lt;')}</textarea>
                <div class="dom-cleaner-out-wrap">
                    <div class="dom-cleaner-out" id="dom-cleaner-output">${STATE._domCleanerOutput ? STATE._domCleanerOutput : '<span class="dom-cleaner-ph">login:password lines appear here</span>'}</div>
                    <button class="dom-btn dom-btn-copy dom-cleaner-copy-btn" id="dom-copy-clean" style="${STATE._domCleanerOutput ? '' : 'display:none'}">📋 Copy</button>
                </div>
            </div>
        </div>
    `;

    // ── Copy helpers ──
    function flashCopy(el) {
        el.classList.add('dom-copied');
        setTimeout(() => el.classList.remove('dom-copied'), 600);
    }

    // Profile values — click to copy
    area.querySelectorAll('.dom-value').forEach(el => {
        el.addEventListener('click', () => {
            navigator.clipboard.writeText(el.dataset.copy);
            flashCopy(el);
            toast('Copied: ' + (el.dataset.copy.length > 40 ? el.dataset.copy.slice(0,40)+'…' : el.dataset.copy), 'success');
        });
    });

    // Names — each part copies separately
    area.querySelectorAll('.dom-name-part').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(el.dataset.copy);
            flashCopy(el);
            toast('Copied: ' + el.dataset.copy, 'success');
        });
    });

    // ── Generate ──
    document.getElementById('dom-generate').onclick = () => {
        STATE._domProfile = genProfile();
        STATE._domNames = genNames();
        renderDomain();
    };

    // ── Regenerate Names ──
    document.getElementById('dom-regen-names').onclick = () => {
        STATE._domNames = genNames();
        renderDomain();
    };

    // ── Copy All ──
    document.getElementById('dom-copy-all').onclick = () => {
        const all = [
            `Business Name: ${p.bizName}`,
            `Domain: ${p.domain}`,
            `Street Address: ${p.street}`,
            `Street Address Line 2: ${p.building}`,
            `City: ${p.city}`,
            `Prefecture: ${p.pref}`,
            `Postal Code: ${p.postal}`,
            `Phone: ${p.phone}`,
            `First Name: ${p.firstName}`,
            `Last Name: ${p.lastName}`,
            `Username: ${p.username}`,
            `Password: ${p.password}`,
        ].join('\n');
        navigator.clipboard.writeText(all);
        toast('All fields copied', 'success');
    };

    // ── Cleaner: persist input ──
    const cleanerInput = document.getElementById('dom-cleaner-input');
    cleanerInput.addEventListener('input', () => {
        STATE._domCleanerInput = cleanerInput.value;
    });

    // ── Cleaner: parse Google Workspace output ──
    document.getElementById('dom-clean-btn').onclick = () => {
        const raw = cleanerInput.value.trim();
        if (!raw) { toast('Paste Workspace text first', 'info'); return; }

        const lines = raw.split('\n').map(l => l.trim());
        const accounts = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            // Look for "Username" label
            if (/^username$/i.test(line)) {
                const login = (lines[i + 1] || '').trim();
                // Find next "Password" label
                let passLine = '';
                for (let j = i + 2; j < Math.min(i + 5, lines.length); j++) {
                    if (/^password$/i.test(lines[j])) {
                        passLine = (lines[j + 1] || '').trim();
                        i = j + 2;
                        break;
                    }
                }
                if (login && passLine) {
                    accounts.push({ login, password: passLine });
                } else {
                    i++;
                }
            } else {
                i++;
            }
        }

        if (accounts.length === 0) {
            toast('No accounts found', 'error');
            return;
        }

        // Build numbered output
        const outHtml = accounts.map((a, idx) => {
            return `<div class="dom-clean-line" data-copy="${a.login}\n${a.password}"><span class="dom-clean-idx">${idx + 1}.</span><span class="dom-clean-login">${a.login}</span><br><span class="dom-clean-idx"></span><span class="dom-clean-pass">${a.password}</span></div>`;
        }).join('');

        const outEl = document.getElementById('dom-cleaner-output');
        outEl.innerHTML = outHtml;

        // Build plain text for copy-all
        STATE._domCleanerParsed = accounts.map((a, idx) => `${idx + 1}. ${a.login}\n   ${a.password}`).join('\n');
        STATE._domCleanerOutput = outHtml;

        document.getElementById('dom-copy-clean').style.display = '';

        // Click on each line copies that account
        outEl.querySelectorAll('.dom-clean-line').forEach(el => {
            el.addEventListener('click', () => {
                navigator.clipboard.writeText(el.dataset.copy);
                flashCopy(el);
                toast('Copied account', 'success');
            });
        });

        toast(`${accounts.length} accounts parsed`, 'success');
    };

    // ── Cleaner: copy all parsed ──
    document.getElementById('dom-copy-clean').onclick = () => {
        if (STATE._domCleanerParsed) {
            navigator.clipboard.writeText(STATE._domCleanerParsed);
            toast('All accounts copied', 'success');
        }
    };

    // Re-bind click handlers on existing output if present
    const outEl = document.getElementById('dom-cleaner-output');
    outEl.querySelectorAll('.dom-clean-line').forEach(el => {
        el.addEventListener('click', () => {
            navigator.clipboard.writeText(el.dataset.copy);
            flashCopy(el);
            toast('Copied account', 'success');
        });
    });
}

// ──── GOOGLE FORMAT MODULE ────
function renderGoogleFormat() {
    const area = document.getElementById('content-area');
    
    // Initialize state to persist across tab switches
    if (typeof STATE.gfInput === 'undefined') STATE.gfInput = '';
    if (typeof STATE.gfOutput === 'undefined') STATE.gfOutput = '';

    area.innerHTML = `
        <div class="gf-container" style="padding: 30px; max-width: 900px; margin: 0 auto; color: var(--text-primary); height: 100%; display: flex; flex-direction: column;">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
                <div style="display: flex; align-items: center; gap: 12px; min-width: 250px;">
                    <div style="background: rgba(255,255,255,0.1); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                    </div>
                    <div>
                        <h2 style="margin: 0; font-weight: 600; font-size: 18px; letter-spacing: 0.5px;">GOOGLE FORMAT</h2>
                        <p style="margin: 4px 0 0; font-size: 12px; color: var(--text-secondary);">Auto-extracts account details, 2FA, phone, and cards into structured output.</p>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                        <label style="font-size: 12px; font-weight: 500; color: var(--text-secondary); white-space: nowrap; width: 110px;">Default Password:</label>
                        <input type="text" id="gf-default-pass" style="width: 140px; font-family: 'JetBrains Mono', monospace; font-size: 13px; padding: 4px 8px; height: 28px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;" placeholder="Optional">
                        <button id="gf-btn-save-pass" style="padding:4px 10px;height:28px;font-size:12px;font-weight:600;background:#fff;color:#111;border:1px solid #ccc;border-radius:4px;cursor:pointer;">Save</button>
                        <button id="gf-btn-clear-pass" style="padding:4px 10px;height:28px;font-size:12px;font-weight:600;background:#fff;color:#111;border:1px solid #ccc;border-radius:4px;cursor:pointer;">Clear</button>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);">
                        <label style="font-size: 12px; font-weight: 500; color: var(--text-secondary); white-space: nowrap; width: 110px;">Octo Prefix:</label>
                        <input type="text" id="gf-octo-prefix" style="width: 140px; font-family: 'JetBrains Mono', monospace; font-size: 13px; padding: 4px 8px; height: 28px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px;" placeholder="e.g. Japan">
                        <button id="gf-btn-save-prefix" style="padding:4px 10px;height:28px;font-size:12px;font-weight:600;background:#fff;color:#111;border:1px solid #ccc;border-radius:4px;cursor:pointer;">Save Prefix</button>
                        <button id="gf-btn-clear-prefix" style="padding:4px 10px;height:28px;font-size:12px;font-weight:600;background:#fff;color:#111;border:1px solid #ccc;border-radius:4px;cursor:pointer;">Clear Prefix</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 24px; flex: 1; min-height: 0;">
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 500; color: var(--text-secondary); letter-spacing: 0.5px;">INPUT RAW DATA</label>
                    <textarea id="gf-input" class="list-textarea" style="flex: 1; resize: none; font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.5;" placeholder="Paste chaotic text here..."></textarea>
                    <div style="margin-top: 12px; display: flex; gap: 8px;">
                        <button id="gf-btn-paste" style="flex:1;padding:8px 14px;font-size:12px;font-weight:600;background:#fff;color:#111;border:1px solid #ccc;border-radius:5px;cursor:pointer;">📋 Paste</button>
                        <button id="gf-btn-parse" style="flex:1;padding:8px 14px;font-size:12px;font-weight:600;background:#fff;color:#111;border:1px solid #ccc;border-radius:5px;cursor:pointer;">⚡ Parse</button>
                        <button id="gf-btn-clear" style="flex:1;padding:8px 14px;font-size:12px;font-weight:600;background:#fff;color:#111;border:1px solid #ccc;border-radius:5px;cursor:pointer;">🗑 Clear</button>
                    </div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <label style="display: block; margin-bottom: 8px; font-size: 12px; font-weight: 500; color: var(--text-secondary); letter-spacing: 0.5px;">PARSED OUTPUT</label>
                    <textarea id="gf-output" class="list-textarea" style="flex: 1; resize: none; background: rgba(0,0,0,0.2); font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.5; color: var(--text-primary); border-color: rgba(255,255,255,0.05);" readonly placeholder="2fa: qrce lqft...&#10;login: babybisdd@gmail.com:pass&#10;name: First Last&#10;card: 5210120018069220 09/27 314&#10;octo: Prefix - First Last - 123456....7890"></textarea>
                    <div style="margin-top: 12px;">
                        <button id="gf-btn-copy" style="width:100%;padding:8px 14px;font-size:12px;font-weight:600;background:#fff;color:#111;border:1px solid #ccc;border-radius:5px;cursor:pointer;">📋 Copy Result</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('gf-input').value = STATE.gfInput;
    document.getElementById('gf-output').value = STATE.gfOutput;

    document.getElementById('gf-btn-paste').onclick = async () => {
        try {
            const text = await navigator.clipboard.readText();
            const input = document.getElementById('gf-input');
            input.value = text;
            STATE.gfInput = text;
            _parseGoogleFormat(text, true);
            toast('Pasted from clipboard', 'info');
        } catch(e) {
            toast('Failed to read clipboard', 'error');
        }
    };

    // Default password logic
    const defPassInput = document.getElementById('gf-default-pass');
    defPassInput.value = localStorage.getItem('gf_default_password') || '';
    document.getElementById('gf-btn-save-pass').onclick = () => {
        localStorage.setItem('gf_default_password', defPassInput.value);
        toast('Default password saved', 'success');
        _parseGoogleFormat(document.getElementById('gf-input').value, false);
    };
    document.getElementById('gf-btn-clear-pass').onclick = () => {
        defPassInput.value = '';
        localStorage.removeItem('gf_default_password');
        toast('Default password cleared', 'info');
        _parseGoogleFormat(document.getElementById('gf-input').value, false);
    };

    // Octo Prefix logic
    const octoPrefixInput = document.getElementById('gf-octo-prefix');
    octoPrefixInput.value = localStorage.getItem('googleFormat_octoPrefix') || '';
    document.getElementById('gf-btn-save-prefix').onclick = () => {
        const val = octoPrefixInput.value.trim();
        localStorage.setItem('googleFormat_octoPrefix', val);
        if (val) {
            if (!localStorage.getItem('googleFormat_octoPrefixCounter')) {
                localStorage.setItem('googleFormat_octoPrefixCounter', '1');
            }
        }
        toast('Octo Prefix saved', 'success');
        _parseGoogleFormat(document.getElementById('gf-input').value, false);
    };
    document.getElementById('gf-btn-clear-prefix').onclick = () => {
        octoPrefixInput.value = '';
        localStorage.removeItem('googleFormat_octoPrefix');
        localStorage.setItem('googleFormat_octoPrefixCounter', '1');
        toast('Octo Prefix cleared', 'info');
        _parseGoogleFormat(document.getElementById('gf-input').value, false);
    };

    document.getElementById('gf-btn-parse').onclick = () => {
        _parseGoogleFormat(document.getElementById('gf-input').value, true);
    };

    document.getElementById('gf-input').addEventListener('input', (e) => {
        STATE.gfInput = e.target.value;
        _parseGoogleFormat(e.target.value, false);
    });

    document.getElementById('gf-btn-clear').onclick = () => {
        document.getElementById('gf-input').value = '';
        document.getElementById('gf-output').value = '';
        STATE.gfInput = '';
        STATE.gfOutput = '';
    };

    document.getElementById('gf-btn-copy').onclick = () => {
        const out = document.getElementById('gf-output');
        if (!out.value) return;
        out.select();
        document.execCommand('copy');
        toast('Copied to clipboard!', 'success');
    };
}

function _parseGoogleFormat(text, isExplicitParse = false) {
    if (!text || !text.trim()) {
        document.getElementById('gf-output').value = '';
        STATE.gfOutput = '';
        return;
    }

    // Clean helper: strip junk symbols but keep essential punctuation
    const clean = s => s.replace(/[\u200B\u200C\u200D\uFEFF]/g, '').replace(/^[\s:=\-–—>]+/, '').replace(/[\s:=\-–—>]+$/, '').trim();

    let email = '';
    let password = '';
    let twoFA = '';
    let fullName = '';
    let ccn = '';
    let exp = '';
    let cvv = '';

    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

    // PASS 1: Try labeled key:value format first (most reliable)
    for (const line of lines) {
        const kv = line.match(/^([a-zA-Z0-9_ ]+?)\s*[:=]\s*(.+)$/); 
        if (!kv) continue;
        const key = kv[1].toLowerCase().trim();
        const val = clean(kv[2]);

        if (/^(2fa|two.?fa|totp|authenticator|backup|secret|seed)$/i.test(key)) {
            twoFA = val;
        } else if (/^(login|email|e-mail|mail|account|user)$/i.test(key)) {
            // May contain email:pass
            const parts = val.split(':');
            if (parts.length >= 2 && parts[0].includes('@')) {
                email = parts[0].trim();
                password = parts.slice(1).join(':').trim();
            } else {
                email = val.split(/[\s|]+/)[0];
            }
        } else if (/^(pass|password|pwd)$/i.test(key)) {
            password = val;
        } else if (/^(name|full.?name|first.?name|имя)$/i.test(key)) {
            fullName = val;
        } else if (/^(last.?name|surname|фамилия)$/i.test(key)) {
            fullName = fullName ? fullName + ' ' + val : val;
        } else if (/^(card|cc|payment|карта)$/i.test(key)) {
            // Parse card line: 5210120018069220 09/27 314
            const cardParts = val.replace(/[\-|]/g, ' ').split(/\s+/);
            for (const p of cardParts) {
                const digits = p.replace(/\D/g, '');
                if (!ccn && digits.length >= 13 && digits.length <= 19) ccn = digits;
                else if (!exp && /^(0[1-9]|1[0-2])[\/\-]?(\d{2,4})$/.test(p)) {
                    const em = p.match(/^(0[1-9]|1[0-2])[\/\-]?(\d{2,4})$/);
                    if (em) exp = em[1] + '/' + em[2].slice(-2);
                } else if (!cvv && digits.length >= 3 && digits.length <= 4 && !ccn?.includes(digits)) cvv = digits;
            }
        }
    }

    // PASS 2: Fallback heuristics for unlabeled data
    if (!email) {
        const emailMatch = text.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})(?:[\s:|]+([^\s\n]+))?/);
        if (emailMatch) {
            email = emailMatch[1];
            if (!password && emailMatch[2]) password = emailMatch[2];
        }
    }

    if (!twoFA) {
        // 8 groups of 4 chars separated by spaces
        const fa8 = text.match(/\b([a-z0-9]{4}(?:\s[a-z0-9]{4}){7})\b/i);
        if (fa8) { twoFA = fa8[1]; }
        else {
            // Base32 key (16 or 32 chars)
            const fa32 = text.match(/\b([A-Z2-7]{16}|[A-Z2-7]{32})\b/);
            if (fa32) twoFA = fa32[1];
        }
    }

    if (!fullName) {
        // Try labeled patterns
        const nameMatch = text.match(/(?:First\s*Name|Name)\s*[:=]\s*(.+?)(?=[\n|]|$)/i);
        const surnameMatch = text.match(/(?:Last\s*Name|Surname)\s*[:=]\s*(.+?)(?=[\n|]|$)/i);
        if (nameMatch) fullName = clean(nameMatch[1]);
        if (surnameMatch) fullName = (fullName ? fullName + ' ' : '') + clean(surnameMatch[1]);
    }
    if (!fullName) {
        // Heuristic: line that looks like a name (2-3 words, letters only)
        for (const l of lines) {
            if (/^[A-Z][a-z]+\s[A-Z][a-z]+(\s[A-Z][a-z]+)?$/.test(l) || /^[A-Z]+\s[A-Z]+(\s[A-Z]+)?$/.test(l)) {
                if (!/card|visa|master|discover|amex|jcb|email|login|pass/i.test(l) && !l.includes('@')) {
                    fullName = l;
                    break;
                }
            }
        }
    }
    // Clean name: remove junk chars
    fullName = fullName.replace(/[^a-zA-Z\s\-']/g, '').replace(/\s+/g, ' ').trim();

    if (!ccn) {
        const ccnMatch = text.match(/\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{1,7})\b/);
        if (ccnMatch) {
            ccn = ccnMatch[1].replace(/[\s\-]/g, '');
            const expMatch = text.match(/\b(0[1-9]|1[0-2])[\/\-](\d{2}|\d{4})\b/);
            if (expMatch) exp = `${expMatch[1]}/${expMatch[2].slice(-2)}`;
            const cardLine = text.split('\n').find(l => l.replace(/[\s\-]/g, '').includes(ccn));
            if (cardLine) {
                const nums = cardLine.match(/\b\d{3,4}\b/g);
                if (nums) {
                    for (const m of nums) {
                        if (m !== expMatch?.[1] && m !== expMatch?.[2] && m.length >= 3 && m.length <= 4) { cvv = m; break; }
                    }
                }
            }
        }
    }

    // Default password fallback
    if (email && !password) {
        const defaultPass = localStorage.getItem('gf_default_password');
        if (defaultPass) password = defaultPass;
    }

    // Assembly — clean output
    const outLines = [];
    if (twoFA) outLines.push(`2fa: ${twoFA}`);
    if (email) outLines.push(`login: ${email}${password ? ':' + password : ''}`);
    if (fullName) outLines.push(`name: ${fullName.toUpperCase()}`);
    if (ccn) {
        const cardStr = [ccn, exp, cvv].filter(Boolean).join(' ');
        outLines.push(`card: ${cardStr}`);
    }
    
    if (ccn) {
        const octoName = fullName ? fullName.toUpperCase() : 'UNKNOWN';
        const octoCard = ccn.length >= 10 ? `${ccn.slice(0,6)}....${ccn.slice(-4)}` : ccn;
        
        let prefixLabel = '';
        const savedPrefix = localStorage.getItem('googleFormat_octoPrefix');
        if (savedPrefix) {
            let counter = parseInt(localStorage.getItem('googleFormat_octoPrefixCounter') || '1', 10);
            let countDisplay = counter > 1 ? ` ${counter}` : '';
            prefixLabel = `${savedPrefix}${countDisplay} - `;
            if (isExplicitParse) {
                counter++;
                localStorage.setItem('googleFormat_octoPrefixCounter', counter.toString());
            }
        }
        outLines.push(`octo: ${prefixLabel}${octoName} - ${octoCard}`);
    }

    const finalOutput = outLines.join('\n');
    document.getElementById('gf-output').value = finalOutput;
    STATE.gfOutput = finalOutput;
}


function renderContent() {
    const area = document.getElementById('content-area');
    const footer = document.getElementById('table-footer');

    if (STATE.currentView === 'notes') {
        renderNotes();
        footer.style.display = 'none';
        return;
    }

    if (STATE.currentView === 'prompts') {
        renderPrompts();
        footer.style.display = 'none';
        return;
    }

    if (STATE.currentView === 'bin-db-view') {
        renderBinDatabase();
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
    if (STATE.currentView === 'google-format') {
        renderGoogleFormat();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'domain') {
        renderDomain();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'bin-tester') {
        renderBinTester();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'minic-bins') {
        renderMinicBins();
        footer.style.display = 'none';
        return;
    }
    if (STATE.currentView === 'generator-view') {
        _CK.mode = 'generator';
        _renderGenerator();
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

    // Brand icon helper — falls back to first-digit detection
    const _brandIcon = (brand, cardNum) => {
        let b = (brand || '').toUpperCase();
        if (!b && cardNum) b = _brandByDigit(cardNum);
        if (!b) return '';
        if (b.includes('VISA')) return '<span class="cx-brand cx-visa">VISA</span>';
        if (b.includes('MASTER')) return '<span class="cx-brand cx-mc">MC</span>';
        if (b.includes('AMEX') || b.includes('AMERICAN')) return '<span class="cx-brand cx-amex">AMEX</span>';
        if (b.includes('DISCOVER')) return '<span class="cx-brand cx-disc">DISC</span>';
        if (b.includes('JCB')) return '<span class="cx-brand cx-jcb">JCB</span>';
        if (b.includes('UNION') || b.includes('UPI')) return '<span class="cx-brand cx-upi">UPI</span>';
        if (b.includes('DINERS')) return '<span class="cx-brand cx-din">DIN</span>';
        if (b.includes('UATP')) return '<span class="cx-brand cx-uatp">UATP</span>';
        return '<span class="cx-brand">' + b.substring(0,4) + '</span>';
    };

    // Helper: render single card row
    function _renderCardRow(c, rowNum, cflag, isTrashV) {
        const cbin = getBin(c.cardNumber);
        const rnH = rowNum != null ? '<span class="cx-row-num">' + rowNum + '</span>' : '';
        const starH = !isTrashV ? '<button class="star-btn ' + (c.starred ? 'active' : '') + '" onclick="toggleStar(\'' + c.id + '\')" title="Fav">\u2605</button>' : '';
        const noteText = c.notes ? c.notes.substring(0, 15) : '+ note';
        const noteCls = c.notes ? 'cx-note-has' : 'cx-note-empty';
        const ccBtn = '<button class="cx-mail-btn ' + (c.mailVerify ? 'active' : '') + '" onclick="toggleMailTag(\'' + c.id + '\',\'mailVerify\')">CC</button>';
        const docBtn = '<button class="cx-mail-btn ' + (c.mailSubmit ? 'active' : '') + '" onclick="toggleMailTag(\'' + c.id + '\',\'mailSubmit\')">DOC</button>';
        const stH = isTrashV
            ? '<button class="btn-secondary btn-restore" onclick="restoreCard(\'' + c.id + '\')">Restore</button>'
            : '<div class="cx-dots">'
                + '<span class="cx-dot cx-dot-a ' + (c.cardAdd ? 'on' : '') + '" onclick="toggleStatus(\'' + c.id + '\',\'cardAdd\')">A</span>'
                + '<span class="cx-dot cx-dot-r ' + (c.runAds ? 'on' : '') + '" onclick="toggleStatus(\'' + c.id + '\',\'runAds\')">R</span>'
                + '<span class="cx-dot cx-dot-v ' + (c.verified ? 'on' : '') + '" onclick="toggleStatus(\'' + c.id + '\',\'verified\')">V</span>'
                + '<span class="cx-dot cx-dot-d ' + (c.docReady ? 'on' : '') + '" onclick="toggleStatus(\'' + c.id + '\',\'docReady\')">D</span>'
                + '<span class="cx-dot cx-dot-w ' + (c.waterBill ? 'on' : '') + '" onclick="toggleStatus(\'' + c.id + '\',\'waterBill\')">W</span>'
                + '<span class="cx-dot cx-dot-m ' + (c.minic ? 'on' : '') + '" onclick="toggleStatus(\'' + c.id + '\',\'minic\')">M</span>'
                + '</div>';
        return '<tr data-id="' + c.id + '" class="cx-row ' + (rowNum != null ? 'cx-child-row' : '') + ' ' + (_selectedCards.has(c.id) ? 'row-selected' : '') + '">'
            + '<td class="cx-chk"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="' + c.id + '" ' + (_selectedCards.has(c.id) ? 'checked' : '') + ' onchange="toggleCardSelect(\'' + c.id + '\', this.checked)"></label></td>'
            + '<td class="cx-cbt-cell">' + rnH + ' ' + cflag + ' <span class="cx-bin-num">' + cbin + '</span><span class="cx-mask">\u2022\u2022\u2022\u2022' + maskCard(c.cardNumber).slice(-4) + '</span> ' + starH + ' ' + _brandIcon('', c.cardNumber) + '</td>'
            + '<td class="cx-grp-bin">' + cbin + '</td>'
            + '<td class="cx-amt">' + (c.amount ? Number(c.amount).toLocaleString() : '\u2014') + '</td>'
            + '<td class="cx-note-cell">' + ccBtn + ' ' + docBtn + '</td>'
            + '<td class="cx-status">' + stH + '</td>'
            + '<td class="cx-date">' + c.date + '</td>'
            + '<td class="cx-menu"><button class="more-btn" onclick="openContextMenu(event, \'' + c.id + '\')" title="Menu">\u22ee</button></td>'
            + '</tr>';
    }

    // BIN group state
    if (!window._wsExpandedBins) window._wsExpandedBins = new Set();
    window._wsToggleBin = function(binKey) {
        if (window._wsExpandedBins.has(binKey)) window._wsExpandedBins.delete(binKey);
        else window._wsExpandedBins.add(binKey);
        renderContent();
    };

    // Group cards by BIN
    const binGroups = new Map();
    pageCards.forEach(c => {
        const b = getBin(c.cardNumber);
        if (!binGroups.has(b)) binGroups.set(b, []);
        binGroups.get(b).push(c);
    });

    const sortIcon = (field) => {
        if (STATE.sortField !== field) return '\u2195';
        return STATE.sortDir === 'asc' ? '\u2191' : '\u2193';
    };

    let rows = '';
    for (const [gbin, grp] of binGroups) {
        const isExp = window._wsExpandedBins.has(gbin);
        const cc = BIN_CACHE[gbin];
        const bName = cc && cc.bank ? cc.bank.toUpperCase() : '';
        const brName = cc && cc.brand ? cc.brand.toUpperCase() : '';
        const tName = cc && cc.type ? cc.type.toUpperCase() : '';
        const brHtml = _brandIcon(brName, fc.cardNumber);
        const fc = grp[0];
        const gflag = fc.country && fc.country !== 'auto' && COUNTRY_DB[fc.country.toUpperCase()] ? isoToFlag(fc.country.toUpperCase()) : '';

        if (grp.length > 1) {
            rows += '<tr class="cx-bin-header ' + (isExp ? 'expanded' : '') + '" onclick="window._wsToggleBin(\'' + gbin + '\')">'
                + '<td class="cx-chk"><label class="bulk-check"><input type="checkbox" onclick="event.stopPropagation()"></label></td>'
                + '<td class="cx-group-info">'
                + '<span class="cx-expand-icon">' + (isExp ? '\u25bc' : '\u25b6') + '</span> '
                + gflag + ' <span class="cx-bin-id">' + gbin + '</span> '
                + '<span class="cx-bank-name">' + bName + '</span> '
                + brHtml
                + ' <span class="cx-group-count">' + grp.length + '</span>'
                + '</td>'
                + '<td class="cx-grp-bin">' + gbin + '</td>'
                + '<td>\u2014</td>'
                + '<td>CC  DOC</td>'
                + '<td>' + tName + '</td>'
                + '<td class="cx-date">' + fc.date + '</td>'
                + '<td class="cx-menu"><button class="more-btn" onclick="event.stopPropagation(); openContextMenu(event, \'' + fc.id + '\')">\u22ee</button></td>'
                + '</tr>';
            if (isExp) {
                grp.forEach((c, gi) => {
                    const cf = c.country && c.country !== 'auto' && COUNTRY_DB[c.country.toUpperCase()] ? isoToFlag(c.country.toUpperCase()) : '';
                    rows += _renderCardRow(c, gi + 1, cf, isTrash);
                });
            }
        } else {
            rows += _renderCardRow(grp[0], null, gflag, isTrash);
        }
    }

    const hintHtml = '<div class="cx-hint">\ud83d\udca1 \u041a\u043b\u0438\u043a \u043f\u043e \u0441\u0442\u0440\u043e\u043a\u0435 BIN \u2014 \u0440\u0430\u0441\u043a\u0440\u044b\u0432\u0430\u0435\u0442 \u0432\u0441\u0435 \u043a\u0430\u0440\u0442\u044b \u044d\u0442\u043e\u0433\u043e \u0431\u0438\u043d\u0430. \u041a\u0430\u0440\u0442\u0430 > \u0411\u0430\u043d\u043a > \u0422\u0438\u043f \u0442\u0435\u043f\u0435\u0440\u044c \u0432 \u043e\u0434\u043d\u043e\u043c \u0431\u043b\u043e\u043a\u0435.</div>';

    area.innerHTML = hintHtml
        + '<table class="data-table"><thead><tr>'
        + '<th class="cx-th-chk"><label class="bulk-check"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label></th>'
        + '<th class="sortable cx-th-cbt" data-sort="bin">CARD \u00b7 BANK \u00b7 TYPE ' + sortIcon('bin') + '</th>'
        + '<th class="sortable cx-th-bin" data-sort="bin">BIN ' + sortIcon('bin') + '</th>'
        + '<th class="sortable cx-th-amt" data-sort="amount">AMT ' + sortIcon('amount') + '</th>'
        + '<th class="sortable cx-th-mail" data-sort="mail">MAIL ' + sortIcon('mail') + '</th>'
        + '<th class="sortable cx-th-status" data-sort="status">STATUS ' + sortIcon('status') + '</th>'
        + '<th class="sortable cx-th-date" data-sort="date">DATE ' + sortIcon('date') + '</th>'
        + '<th class="cx-th-menu"></th>'
        + '</tr></thead><tbody>' + rows + '</tbody></table>';

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

// ═══════ ALL CARDS — BIN-Grouped Accordion View ═══════
// Track which BIN groups are expanded
let _expandedBins = new Set();

// Global brand icon helper
function _brandIconGlobal(brand, cardNum) {
    let b = (brand || '').toUpperCase();
    if (!b && cardNum) b = _brandByDigit(cardNum);
    if (!b) return '';
    if (b.includes('VISA')) return '<span class="cx-brand cx-visa">VISA</span>';
    if (b.includes('MASTER')) return '<span class="cx-brand cx-mc">MC</span>';
    if (b.includes('AMEX') || b.includes('AMERICAN')) return '<span class="cx-brand cx-amex">AMEX</span>';
    if (b.includes('DISCOVER')) return '<span class="cx-brand cx-disc">DISC</span>';
    if (b.includes('JCB')) return '<span class="cx-brand cx-jcb">JCB</span>';
    if (b.includes('UNION') || b.includes('UPI')) return '<span class="cx-brand cx-upi">UPI</span>';
    if (b.includes('DINERS')) return '<span class="cx-brand cx-din">DIN</span>';
    return '<span class="cx-brand">' + b.substring(0,4) + '</span>';
}

function renderAllCards() {
    const area = document.getElementById('content-area');
    let allCards = [...STATE.cards];

    if (STATE.search.length >= 2) {
        const s = STATE.search.toLowerCase();
        allCards = allCards.filter(c =>
            (c.name + ' ' + c.surname).toLowerCase().includes(s) ||
            c.cardNumber.includes(s) || getBin(c.cardNumber).includes(s) ||
            (c.notes || '').toLowerCase().includes(s) ||
            ((BIN_CACHE[getBin(c.cardNumber)]?.bank) || '').toLowerCase().includes(s)
        );
    }

    // Duplicate count map
    const dupMap = {};
    STATE.cards.forEach(c => {
        const num = c.cardNumber.replace(/\s/g, '');
        dupMap[num] = (dupMap[num] || 0) + 1;
    });

    // Country tabs
    const countryMap = {};
    allCards.forEach(c => {
        const bin = getBin(c.cardNumber);
        const cached = BIN_CACHE[bin] || {};
        let cc = normalizeCC(cached.country || c.country);
        if (cc && cc !== 'AU' + 'TO') { countryMap[cc] = (countryMap[cc]||0) + 1; }
    });
    const countrySorted = Object.entries(countryMap).sort((a, b) => b[1] - a[1]);

    const countryFilter = STATE._bvCountry || 'ALL';
    let filteredCards = allCards;
    if (countryFilter !== 'ALL') {
        filteredCards = allCards.filter(c => {
            const bin = getBin(c.cardNumber);
            const cached = BIN_CACHE[bin] || {};
            return normalizeCC(cached.country || c.country) === countryFilter;
        });
    }

    const stFilter = STATE._bvStatusFilter || '';
    if (stFilter) {
        const fieldMap = {A:'cardAdd', R:'runAds', V:'verified', M:'minic', D:'declined'};
        const field = fieldMap[stFilter];
        if (field) filteredCards = filteredCards.filter(c => c[field]);
    }

    if (filteredCards.length === 0 && allCards.length === 0) {
        area.innerHTML = `
            <div class="bv-bar">
                <span class="bv-pill">CARDS <b>0</b></span>
                <span class="bv-pill">BINS <b>0</b></span>
                <button class="bv-ib" onclick="_bvOpenImport()">+ Import</button>
            </div>
            <div id="bv-import-panel" class="bv-ip" style="display:none">
                <textarea id="bv-import-text" class="bv-ita" placeholder="Paste cards...\n4537007340059012|02/26|307" rows="5"></textarea>
                <div class="bv-ia"><span id="bv-import-count" class="bv-ic">0 detected</span><button class="bv-ig" onclick="_bvDoImport()">IMPORT</button><button class="bv-icl" onclick="document.getElementById('bv-import-panel').style.display='none'">Cancel</button></div>
            </div>
            <div class="empty-state"><p class="empty-title">No cards yet</p><p style="color:#3a3e52;font-size:12px">Click + Import to add cards</p></div>`;
        // Import text auto-detect
        const it = document.getElementById('bv-import-text');
        if (it) it.addEventListener('input', () => { document.getElementById('bv-import-count').textContent = smartParseCards(it.value).length + ' detected'; });
        // Ensure edit modal exists
        if (!document.getElementById('bv-edit-modal')) {
            const m = document.createElement('div');
            m.id = 'bv-edit-modal'; m.className = 'bv-edit-overlay'; m.style.display = 'none';
            document.body.appendChild(m);
            m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
        }
        renderFooter(0, 1, 1); return;
    }

    const gA = filteredCards.filter(c => c.cardAdd).length;
    const gR = filteredCards.filter(c => c.runAds).length;
    const gV = filteredCards.filter(c => c.verified).length;
    const gM = filteredCards.filter(c => c.minic).length;
    const gD = filteredCards.filter(c => c.declined).length;

    const binGroups = {};
    filteredCards.forEach(c => { const bin = getBin(c.cardNumber); if (!binGroups[bin]) binGroups[bin] = []; binGroups[bin].push(c); });

    const sortMode = STATE._bvSort || 'count';
    let sortedBins = Object.entries(binGroups);
    if (sortMode === 'date') {
        sortedBins.sort((a, b) => {
            const gm = (cards) => { let m=''; cards.forEach(c => { if(!c.date) return; const p=c.date.split('.'); const d=p.length===3?`${p[2]}-${p[1]}-${p[0]}`:c.date; if(d>m) m=d; }); return m; };
            return gm(b[1]) > gm(a[1]) ? 1 : gm(b[1]) < gm(a[1]) ? -1 : b[1].length - a[1].length;
        });
    } else {
        sortedBins.sort((a, b) => b[1].length !== a[1].length ? b[1].length - a[1].length : a[0].localeCompare(b[0]));
    }

    const totalBins = sortedBins.length;
    const totalCards = filteredCards.length;
    const totalAll = allCards.length;
    const start = (STATE.page - 1) * STATE.perPage;
    const pageBins = sortedBins.slice(start, start + STATE.perPage);
    const totalPages = Math.max(1, Math.ceil(totalBins / STATE.perPage));

    const fmtCard = (n) => (n||'').replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim();
    const cntClr = (n) => n > 15 ? '#ef4444' : n > 10 ? '#f97316' : n > 5 ? '#eab308' : '#38bdf8';

    const binSt = (cards) => {
        const a=cards.filter(c=>c.cardAdd).length, r=cards.filter(c=>c.runAds).length,
              v=cards.filter(c=>c.verified).length, m=cards.filter(c=>c.minic).length,
              d=cards.filter(c=>c.declined).length;
        let h = '';
        if (a) h += `<span class="bv-s bv-sa">${a>1?a:''}A</span>`;
        if (r) h += `<span class="bv-s bv-sr">${r>1?r:''}R</span>`;
        if (v) h += `<span class="bv-s bv-sv">${v>1?v:''}V</span>`;
        if (m) h += `<span class="bv-s bv-sm">${m>1?m:''}M</span>`;
        if (d) h += `<span class="bv-s bv-sd">${d>1?d:''}D</span>`;
        return h;
    };

    const cardSt = (c) => {
        return `<span class="bv-s bv-sa ${c.cardAdd?'':'bv-off'}" onclick="event.stopPropagation();_bvToggle('${c.id}','cardAdd')">A</span>`
             + `<span class="bv-s bv-sr ${c.runAds?'':'bv-off'}" onclick="event.stopPropagation();_bvToggle('${c.id}','runAds')">R</span>`
             + `<span class="bv-s bv-sv ${c.verified?'':'bv-off'}" onclick="event.stopPropagation();_bvToggle('${c.id}','verified')">V</span>`
             + `<span class="bv-s bv-sm ${c.minic?'':'bv-off'}" onclick="event.stopPropagation();_bvToggle('${c.id}','minic')">M</span>`
             + `<span class="bv-s bv-sd ${c.declined?'':'bv-off'}" onclick="event.stopPropagation();_bvToggle('${c.id}','declined')">D</span>`;
    };

    let rows = '';
    pageBins.forEach(([bin, cards]) => {
        const exp = _expandedBins.has(bin);
        const cnt = cards.length;
        const c0 = cards[0];
        const cached = BIN_CACHE[bin] || {};
        const bank = cached.bank || '';
        const brand = _brandIconGlobal(cached.brand, c0.cardNumber);
        let cc = normalizeCC(cached.country || c0.country);
        if (cc === 'AU' + 'TO') cc = '';
        const flag = cc ? isoToFlag(cc) : '';

        let lastD = '';
        cards.forEach(c => { if(!c.date) return; const p=c.date.split('.'); const d=p.length===3?`${p[2]}-${p[1]}-${p[0]}`:c.date; if(d>lastD) lastD=d; });
        if (lastD && lastD.includes('-')) { const p=lastD.split('-'); lastD=`${p[2]}.${p[1]}.${p[0]}`; }

        const binNote = (STATE.binNotes && STATE.binNotes[bin]) || '';

        rows += `<tr class="bv-bin-row ${exp?'bv-expanded':''}" data-bin="${bin}" onclick="_toggleBinGroup('${bin}')">
            <td class="bv-ec"><span class="bv-arrow">${exp?'\u25be':'\u25b8'}</span></td>
            <td class="bv-mc">
                <div class="bv-bi">${flag}<span class="bv-bn">${bin}</span>${brand}<span class="bv-cc" style="color:${cntClr(cnt)}">${cnt} cards</span></div>
                ${bank ? `<div class="bv-bk">${bank}</div>` : ''}
            </td>
            <td class="bv-sc">${binSt(cards)}</td>
            <td class="bv-nc" onclick="event.stopPropagation()"><input class="bv-ni" type="text" value="${(binNote).replace(/"/g,'&quot;')}" placeholder="\u2014" onchange="_saveBinNote('${bin}',this.value)" onclick="event.stopPropagation()"></td>
            <td class="bv-dc">${lastD||'\u2014'}</td>
        </tr>`;

        if (exp) {
            cards.forEach(c => {
                const cN = c.notes || '';
                const ex = (c.month&&c.year)?`${c.month}/${c.year}`:'';
                const cv = c.cvv||'';
                const fc = `${fmtCard(c.cardNumber)}${ex?' '+ex:''}${cv?' '+cv:''}`;
                // Duplicate badge
                const dupCnt = dupMap[c.cardNumber.replace(/\s/g, '')] || 1;
                const dupBadge = dupCnt > 1 ? `<span class="bv-dup">dbl ${dupCnt}</span>` : '';
                const amtVal = c.amount ? `<span class="bv-amt">$${c.amount}</span>` : '';

                rows += `<tr class="bv-cr" data-id="${c.id}" oncontextmenu="event.preventDefault();_bvCardCtx(event,'${c.id}')">
                    <td class="bv-ec"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="${c.id}" ${_selectedCards.has(c.id)?'checked':''} onchange="toggleCardSelect('${c.id}',this.checked)" onclick="event.stopPropagation()"></label></td>
                    <td class="bv-mc bv-cm"><span class="bv-cn">${fc}</span>${dupBadge}${amtVal}</td>
                    <td class="bv-sc">${cardSt(c)}</td>
                    <td class="bv-nc"><input class="bv-ni bv-nic" type="text" value="${(cN).replace(/"/g,'&quot;')}" placeholder="" onchange="_saveCardNote('${c.id}',this.value)"></td>
                    <td class="bv-dc">${c.date||'\u2014'}</td>
                </tr>`;
            });
        }
    });

    let ctHtml = `<span class="bv-ct ${countryFilter==='ALL'?'bv-cta':''}" onclick="_bvFilterCountry('ALL')">ALL <b>${totalAll}</b></span>`;
    countrySorted.forEach(([cc, n]) => { ctHtml += `<span class="bv-ct ${countryFilter===cc?'bv-cta':''}" onclick="_bvFilterCountry('${cc}')">${isoToFlag(cc)} ${cc} <b>${n}</b></span>`; });

    const sf = STATE._bvStatusFilter || '';
    const stPill = (code, cls, count) => `<span class="bv-pill bv-st-pill ${sf===code?'bv-st-filt':''}" onclick="_bvFilterStatus('${code}')" oncontextmenu="event.preventDefault();_bvStatusCtx(event,'${code}')"><span class="bv-s ${cls}">${code}</span> <b>${count}</b></span>`;

    const selCount = _selectedCards.size;
    const bulkHtml = selCount > 0 ? `
        <div class="bv-bulk">
            <span class="bv-bulk-cnt">${selCount} selected</span>
            <button class="bv-bulk-btn bv-sa" onclick="_bvBulkStatus('cardAdd')">+A</button>
            <button class="bv-bulk-btn bv-sr" onclick="_bvBulkStatus('runAds')">+R</button>
            <button class="bv-bulk-btn bv-sv" onclick="_bvBulkStatus('verified')">+V</button>
            <button class="bv-bulk-btn bv-sm" onclick="_bvBulkStatus('minic')">+M</button>
            <button class="bv-bulk-btn bv-sd" onclick="_bvBulkStatus('declined')">+D</button>
            <button class="bv-bulk-clr" onclick="_bvBulkClear()">Clear All</button>
        </div>` : '';

    area.innerHTML = `
        <div class="bv-bar">
            ${stPill('A','bv-sa',gA)}
            ${stPill('R','bv-sr',gR)}
            ${stPill('V','bv-sv',gV)}
            ${stPill('M','bv-sm',gM)}
            ${stPill('D','bv-sd',gD)}
            <span class="bv-pill">CARDS <b>${totalCards}</b></span>
            <span class="bv-pill">BINS <b>${totalBins}</b></span>
            <button class="bv-clr-all" onclick="_bvClearAll()" title="Clear ALL statuses">&#x2715; Reset</button>
            <div class="bv-srt">
                <button class="bv-sb ${sortMode==='count'?'bv-sba':''}" onclick="_bvSetSort('count')">COUNT</button>
                <button class="bv-sb ${sortMode==='date'?'bv-sba':''}" onclick="_bvSetSort('date')">DATE</button>
            </div>
            <button class="bv-ib" onclick="_bvOpenImport()">+ Import</button>
        </div>
        <div class="bv-cts">${ctHtml}</div>
        ${bulkHtml}
        <div id="bv-import-panel" class="bv-ip" style="display:none">
            <textarea id="bv-import-text" class="bv-ita" placeholder="Paste cards...\n4537007340059012|02/26|307" rows="5"></textarea>
            <div class="bv-ia"><span id="bv-import-count" class="bv-ic">0 detected</span><button class="bv-ig" onclick="_bvDoImport()">IMPORT</button><button class="bv-icl" onclick="document.getElementById('bv-import-panel').style.display='none'">Cancel</button></div>
        </div>
        <table class="data-table bv-t">
            <thead><tr><th style="width:24px"></th><th>CARD / BIN GROUP</th><th>STATUS</th><th>NOTE</th><th>LAST</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;

    // Ensure context menu container
    if (!document.getElementById('bv-ctx-menu')) {
        const ctx = document.createElement('div');
        ctx.id = 'bv-ctx-menu'; ctx.className = 'bv-ctx'; ctx.style.display = 'none';
        document.body.appendChild(ctx);
        document.addEventListener('click', () => ctx.style.display = 'none');
    }

    // Edit modal container
    if (!document.getElementById('bv-edit-modal')) {
        const m = document.createElement('div');
        m.id = 'bv-edit-modal'; m.className = 'bv-edit-overlay'; m.style.display = 'none';
        document.body.appendChild(m);
        m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
    }

    const it = document.getElementById('bv-import-text');
    if (it) it.addEventListener('input', () => { document.getElementById('bv-import-count').textContent = smartParseCards(it.value).length + ' detected'; });
    renderFooter(totalBins, STATE.page, totalPages);
}

// Right-click on card row — Edit / Clone / Delete
window._bvCardCtx = function(e, id) {
    const ctx = document.getElementById('bv-ctx-menu');
    ctx.innerHTML = `
        <div class="bv-ctx-item" onclick="_bvEditCard('${id}')">&#9998; Edit</div>
        <div class="bv-ctx-item" onclick="_bvCloneCard('${id}')">&#10697; Clone</div>
        <div class="bv-ctx-item bv-ctx-danger" onclick="_bvDeleteCard('${id}')">&#x2715; Delete</div>
    `;
    ctx.style.display = 'block';
    ctx.style.left = Math.min(e.clientX, window.innerWidth - 160) + 'px';
    ctx.style.top = Math.min(e.clientY, window.innerHeight - 120) + 'px';
};

// Edit card modal (no browser confirm)
window._bvEditCard = function(id) {
    document.getElementById('bv-ctx-menu').style.display = 'none';
    const card = STATE.cards.find(c => c.id === id);
    if (!card) return;

    const modal = document.getElementById('bv-edit-modal');
    modal.innerHTML = `
        <div class="bv-edit-box">
            <div class="bv-edit-title">Edit Card</div>
            <label class="bv-edit-lbl">Card Number</label>
            <input id="bv-edit-num" class="bv-edit-inp" type="text" value="${card.cardNumber}">
            <label class="bv-edit-lbl">Exp (MM/YY)</label>
            <div class="bv-edit-row">
                <input id="bv-edit-mm" class="bv-edit-inp bv-edit-sm" type="text" value="${card.month||''}" placeholder="MM" maxlength="2">
                <span class="bv-edit-sep">/</span>
                <input id="bv-edit-yy" class="bv-edit-inp bv-edit-sm" type="text" value="${card.year||''}" placeholder="YY" maxlength="2">
            </div>
            <label class="bv-edit-lbl">CVV</label>
            <input id="bv-edit-cvv" class="bv-edit-inp bv-edit-sm" type="text" value="${card.cvv||''}" maxlength="4">
            <label class="bv-edit-lbl">Amount ($)</label>
            <input id="bv-edit-amount" class="bv-edit-inp bv-edit-sm" type="text" value="${card.amount||''}">
            <label class="bv-edit-lbl">Note</label>
            <input id="bv-edit-note" class="bv-edit-inp" type="text" value="${(card.notes||'').replace(/"/g,'&quot;')}">
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="_bvSaveEdit('${id}')">Save</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Cancel</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    document.getElementById('bv-edit-num').focus();
};

// Save edited card
window._bvSaveEdit = function(id) {
    const card = STATE.cards.find(c => c.id === id);
    if (!card) return;
    const num = document.getElementById('bv-edit-num').value.replace(/\s/g, '');
    if (num.length < 13) { toast('Card number too short', 'error'); return; }
    card.cardNumber = num;
    card.month = document.getElementById('bv-edit-mm').value;
    card.year = document.getElementById('bv-edit-yy').value;
    card.cvv = document.getElementById('bv-edit-cvv').value;
    card.amount = document.getElementById('bv-edit-amount').value;
    card.notes = document.getElementById('bv-edit-note').value;
    card.cardType = getCardType(num);
    save();
    document.getElementById('bv-edit-modal').style.display = 'none';
    renderAllCards();
    toast('Card updated', 'success');
};

// Delete card — custom in-app confirm (NO browser dialog)
window._bvDeleteCard = function(id) {
    document.getElementById('bv-ctx-menu').style.display = 'none';
    const card = STATE.cards.find(c => c.id === id);
    if (!card) return;
    _bvShowConfirm('Delete this card?', () => {
        STATE.trash.push(card);
        STATE.cards = STATE.cards.filter(c => c.id !== id);
        save(); renderAll();
        toast('Card moved to trash', 'success');
    });
};

// Clone card
window._bvCloneCard = function(id) {
    document.getElementById('bv-ctx-menu').style.display = 'none';
    const card = STATE.cards.find(c => c.id === id);
    if (!card) return;
    const clone = JSON.parse(JSON.stringify(card));
    clone.id = genId();
    clone.date = todayStr();
    clone.notes = (clone.notes || '') + ' (clone)';
    STATE.cards.unshift(clone);
    save(); renderAllCards();
    toast('Card cloned', 'success');
};

// Custom in-app confirm dialog (replaces browser confirm)
window._bvShowConfirm = function(msg, onYes) {
    const modal = document.getElementById('bv-edit-modal');
    modal.innerHTML = `
        <div class="bv-edit-box bv-confirm-box">
            <div class="bv-confirm-msg">${msg}</div>
            <div class="bv-edit-btns">
                <button class="bv-edit-save bv-confirm-yes" id="bv-confirm-yes">Yes</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Cancel</button>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
    document.getElementById('bv-confirm-yes').onclick = () => { modal.style.display = 'none'; onYes(); };
};

// Clear ALL statuses — custom confirm (no browser dialog)
window._bvClearAll = function() {
    _bvShowConfirm('Clear ALL statuses for all cards?', () => {
        STATE.cards.forEach(c => { c.cardAdd = false; c.runAds = false; c.verified = false; c.minic = false; c.declined = false; });
        save(); renderAllCards();
        toast('All statuses cleared', 'success');
    });
};


// ═══════════════════════════════════════════
// MINIC BINS — Google payment BIN tracker (with custom tags)
// ═══════════════════════════════════════════

function renderMinicBins() {
    const area = document.getElementById('content-area');
    const allBins = STATE.minicBins || [];
    const tags = STATE.minicTags || [];
    const filter = STATE.minicTagFilter || 'all';
    const activeTab = STATE.minicActiveTab || 'main';
    const tabs = STATE.minicTabs || [{id:'main',name:'Main'}];

    // Filter by active tab
    let tabBins = allBins.filter(b => (b.tab || 'main') === activeTab);

    // Then filter by tag
    let filtered = tabBins;
    if (filter === 'pending') filtered = tabBins.filter(b => !b.tag);
    else if (filter !== 'all') filtered = tabBins.filter(b => b.tag === filter);

    // Stats
    const total = tabBins.length;
    const pending = tabBins.filter(b => !b.tag).length;
    const tagCounts = {};
    tags.forEach(t => { tagCounts[t.id] = tabBins.filter(b => b.tag === t.id).length; });

    // ── Tab bar (like Notes) ──
    let tabsHtml = '';
    tabs.forEach(t => {
        const isActive = t.id === activeTab;
        const cnt = allBins.filter(b => (b.tab || 'main') === t.id).length;
        const closable = t.id !== 'main';
        tabsHtml += '<div class="mc-tab '+(isActive?'mc-tab-active':'')+'" onclick="_mcSwitchTab(\''+t.id+'\')">'
            + '<span class="mc-tab-name">'+t.name+'</span>'
            + ' <span class="mc-tab-cnt">'+cnt+'</span>'
            + (closable ? ' <span class="mc-tab-close" onclick="event.stopPropagation();_mcCloseTab(\''+t.id+'\')">✕</span>' : '')
            + '</div>';
    });
    tabsHtml += '<div class="mc-tab mc-tab-add" onclick="_mcAddTab()">+</div>';

    // Move to Main button (show only on non-main tabs)
    const moveBtn = activeTab !== 'main'
        ? '<button class="bv-ib mc-move-btn" onclick="_mcMoveToMain()" style="color:#60a5fa;border-color:rgba(96,165,250,.25)">📥 Move to Main</button>'
        : '';

    // Tag filter pills
    let filterHtml = '<span class="bv-pill mc-filter-pill '+(filter==='all'?'mc-pill-active':'')+'" onclick="_mcFilter(\'all\')">ALL <b>'+total+'</b></span>';
    filterHtml += '<span class="bv-pill mc-filter-pill '+(filter==='pending'?'mc-pill-active':'')+'" onclick="_mcFilter(\'pending\')">PENDING <b>'+pending+'</b></span>';
    tags.forEach(t => {
        const cnt = tagCounts[t.id] || 0;
        const active = filter === t.id ? 'mc-pill-active' : '';
        filterHtml += '<span class="bv-pill mc-filter-pill '+active+'" style="border-color:'+(t.color||'#666')+'" onclick="_mcFilter(\''+t.id+'\')">'
            + '<span class="mc-tag-dot" style="background:'+(t.color||'#666')+'"></span> '+t.name+' <b>'+cnt+'</b></span>';
    });
    filterHtml += '<button class="bv-ib mc-new-tag-btn" onclick="_mcNewTagModal()">+ New Tag</button>';

    let rowsHtml = '';
    filtered.forEach((b) => {
        const realIdx = allBins.indexOf(b);
        const cached = BIN_CACHE[b.bin] || {};
        const bank = cached.bank || '';
        const brand = cached.brand || _brandByDigit(b.bin) || '';
        let cc = normalizeCC(cached.country || '');
        const flag = cc ? isoToFlag(cc) : '';
        const brandHtml = brand ? _brandIconGlobal(brand, b.bin + '0000000000') : '';

        const tag = tags.find(t => t.id === b.tag);
        const tagHtml = tag
            ? '<span class="mc-tag-badge" style="background:'+tag.color+'">'+tag.name+'</span>'
            : '<span class="mc-tag-badge mc-tag-pending">PENDING</span>';

        rowsHtml += '<tr class="mc-row" data-idx="'+realIdx+'" data-id="mc-'+realIdx+'" oncontextmenu="event.preventDefault();_mcCtx(event,'+realIdx+')">'
            + '<td class="mc-chk" onclick="event.stopPropagation()"><label class="bulk-check"><input type="checkbox" class="row-select-cb" data-card-id="mc-'+realIdx+'" onchange="toggleCardSelect(this.dataset.cardId,this.checked)"></label></td>'
            + '<td class="mc-idx">'+(realIdx+1)+'</td>'
            + '<td class="mc-bin">'+flag+' <span class="bv-bn">'+b.bin+'</span> '+brandHtml+'</td>'
            + '<td class="mc-bank">'+bank+'</td>'
            + '<td class="mc-status"><span class="mc-tag-click" onclick="_mcTagMenu(event,'+realIdx+')">'+tagHtml+' \u25BE</span></td>'
            + '<td class="mc-amt">'+(b.amount ? '$'+b.amount : '\u2014')+'</td>'
            + '<td class="mc-note"><input class="bv-ni" type="text" value="'+((b.note||'').replace(/"/g,'&quot;'))+'" placeholder="\u2014" onchange="_mcNote('+realIdx+',this.value)"></td>'
            + '<td class="mc-date">'+(b.date || '\u2014')+'</td>'
            + '</tr>';
    });

    area.innerHTML = `
        <div class="mc-tab-bar">${tabsHtml}</div>
        <div class="bv-bar mc-tag-bar">${filterHtml}</div>
        <div class="bv-bar">
            <button class="bv-ib" onclick="_mcOpenAdd()">+ Add BINs</button>
            ${moveBtn}
        </div>
        <div id="mc-add-panel" class="bv-ip" style="display:none">
            <textarea id="mc-add-text" class="bv-ita" placeholder="Paste BINs (one per line)...\n453700\n516075\n452001" rows="4"></textarea>
            <div class="bv-ia">
                <span id="mc-add-count" class="bv-ic">0 BINs</span>
                <button class="bv-ig" onclick="_mcDoAdd()">ADD</button>
                <button class="bv-icl" onclick="document.getElementById('mc-add-panel').style.display='none'">Cancel</button>
            </div>
        </div>
        <table class="data-table bv-t mc-table">
            <thead><tr>
                <th style="width:24px"><label class="bulk-check"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label></th><th style="width:30px">#</th>
                <th>BIN</th>
                <th>BANK</th>
                <th>TAG</th>
                <th>AMOUNT</th>
                <th>NOTE</th>
                <th>DATE</th>
            </tr></thead>
            <tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#3a3e52;padding:30px">No BINs in this tab</td></tr>'}</tbody>
        </table>`;

    // Ensure overlays exist
    if (!document.getElementById('mc-tag-dropdown')) {
        const dd = document.createElement('div');
        dd.id = 'mc-tag-dropdown'; dd.className = 'mc-tag-dd'; dd.style.display = 'none';
        document.body.appendChild(dd);
        document.addEventListener('click', () => { dd.style.display = 'none'; });
    }
    if (!document.getElementById('bv-edit-modal')) {
        const m = document.createElement('div');
        m.id = 'bv-edit-modal'; m.className = 'bv-edit-overlay'; m.style.display = 'none';
        document.body.appendChild(m);
    }
    if (!document.getElementById('bv-ctx-menu')) {
        const ctx = document.createElement('div');
        ctx.id = 'bv-ctx-menu'; ctx.className = 'bv-ctx'; ctx.style.display = 'none';
        document.body.appendChild(ctx);
        document.addEventListener('click', () => ctx.style.display = 'none');
    }

    const ta = document.getElementById('mc-add-text');
    if (ta) ta.addEventListener('input', () => {
        const lines = ta.value.split('\n').map(l => l.trim().replace(/\D/g, '')).filter(l => l.length >= 6);
        document.getElementById('mc-add-count').textContent = lines.length + ' BINs';
    });

    renderFooter(filtered.length, 1, 1);
}


// ── Tag filter ──
// ── Tab management ──
window._mcSwitchTab = function(tabId) {
    STATE.minicActiveTab = tabId;
    STATE.minicTagFilter = 'all';
    renderMinicBins();
};

window._mcAddTab = function() {
    const modal = document.getElementById('bv-edit-modal');
    modal.innerHTML = `
        <div class="bv-edit-box">
            <div class="bv-edit-title">New Tab</div>
            <label class="bv-edit-lbl">Tab Name</label>
            <input id="mc-new-tab-name" class="bv-edit-inp" type="text" placeholder="e.g. Draft, Session 1..." maxlength="20">
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="_mcSaveNewTab()">Create</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Cancel</button>
            </div>
        </div>`;
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('mc-new-tab-name').focus(), 50);
};

window._mcSaveNewTab = function() {
    const name = document.getElementById('mc-new-tab-name').value.trim();
    if (!name) { toast('Enter a tab name', 'error'); return; }
    const id = 'mctab_' + Date.now();
    STATE.minicTabs.push({ id, name });
    STATE.minicActiveTab = id;
    save();
    document.getElementById('bv-edit-modal').style.display = 'none';
    renderMinicBins();
    toast('Tab "' + name + '" created', 'success');
};

window._mcCloseTab = function(tabId) {
    if (tabId === 'main') return;
    const tabBins = (STATE.minicBins || []).filter(b => (b.tab || 'main') === tabId);
    const msg = tabBins.length > 0
        ? 'Delete tab with ' + tabBins.length + ' BINs? BINs will be removed.'
        : 'Delete this empty tab?';
    _bvShowConfirm(msg, () => {
        STATE.minicBins = STATE.minicBins.filter(b => (b.tab || 'main') !== tabId);
        STATE.minicTabs = STATE.minicTabs.filter(t => t.id !== tabId);
        if (STATE.minicActiveTab === tabId) STATE.minicActiveTab = 'main';
        save(); renderMinicBins();
        toast('Tab deleted', 'success');
    });
};

window._mcMoveToMain = function() {
    const activeTab = STATE.minicActiveTab;
    if (activeTab === 'main') return;
    const tabBins = STATE.minicBins.filter(b => (b.tab || 'main') === activeTab);
    if (tabBins.length === 0) { toast('No BINs to move', 'warning'); return; }
    // Check selected — if some selected, move only those
    const selected = [...document.querySelectorAll('.row-select-cb:checked')].map(cb => parseInt(cb.dataset.cardId.replace('mc-', '')));
    const toMove = selected.length > 0
        ? STATE.minicBins.filter((b, i) => selected.includes(i) && (b.tab || 'main') === activeTab)
        : tabBins;
    const existingMain = new Set(STATE.minicBins.filter(b => (b.tab || 'main') === 'main').map(b => b.bin));
    let moved = 0, dupes = 0;
    toMove.forEach(b => {
        if (existingMain.has(b.bin)) { dupes++; }
        else { b.tab = 'main'; existingMain.add(b.bin); moved++; }
    });
    save(); renderMinicBins();
    toast(moved + ' BINs moved to Main' + (dupes > 0 ? ' (' + dupes + ' duplicates skipped)' : ''), 'success');
};

window._mcFilter = function(f) {
    STATE.minicTagFilter = f;
    renderMinicBins();
};

// ── Tag dropdown on click ──
window._mcTagMenu = function(e, idx) {
    e.stopPropagation();
    const dd = document.getElementById('mc-tag-dropdown');
    const tags = STATE.minicTags || [];
    let html = '<div class="mc-dd-item mc-dd-pending" onclick="_mcSetTag('+idx+',null)">PENDING</div>';
    tags.forEach(t => {
        html += '<div class="mc-dd-item" onclick="_mcSetTag('+idx+',\''+t.id+'\')">'
            + '<span class="mc-tag-dot" style="background:'+t.color+'"></span> '+t.name+'</div>';
    });
    html += '<div class="mc-dd-sep"></div><div class="mc-dd-item mc-dd-new" onclick="_mcNewTagModal()">+ New Tag</div>';
    dd.innerHTML = html;
    dd.style.display = 'block';
    dd.style.left = Math.min(e.clientX, window.innerWidth - 160) + 'px';
    dd.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
};

// ── Assign tag ──
window._mcSetTag = function(idx, tagId) {
    const b = STATE.minicBins[idx];
    if (!b) return;
    b.tag = tagId;
    document.getElementById('mc-tag-dropdown').style.display = 'none';
    save(); renderMinicBins();
};

// ── New tag modal ──
window._mcNewTagModal = function() {
    document.getElementById('mc-tag-dropdown').style.display = 'none';
    const modal = document.getElementById('bv-edit-modal');
    const colors = ['#22c55e','#ef4444','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316','#64748b'];
    let colorsHtml = '';
    colors.forEach(c => {
        colorsHtml += '<span class="mc-color-opt" data-color="'+c+'" style="background:'+c+'" onclick="_mcPickColor(this)"></span>';
    });
    modal.innerHTML = `
        <div class="bv-edit-box">
            <div class="bv-edit-title">Create New Tag</div>
            <label class="bv-edit-lbl">Tag Name</label>
            <input id="mc-tag-name" class="bv-edit-inp" type="text" placeholder="e.g. 3DS, Dead, Live, No Mini..." maxlength="20">
            <label class="bv-edit-lbl">Color</label>
            <div class="mc-color-row" id="mc-color-row">${colorsHtml}</div>
            <input id="mc-tag-color" type="hidden" value="${colors[0]}">
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="_mcSaveNewTag()">Create</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Cancel</button>
            </div>
        </div>`;
    modal.style.display = 'flex';
    // Pre-select first color
    setTimeout(() => {
        const first = document.querySelector('.mc-color-opt');
        if (first) first.classList.add('mc-color-sel');
        document.getElementById('mc-tag-name').focus();
    }, 50);
};

window._mcPickColor = function(el) {
    document.querySelectorAll('.mc-color-opt').forEach(e => e.classList.remove('mc-color-sel'));
    el.classList.add('mc-color-sel');
    document.getElementById('mc-tag-color').value = el.dataset.color;
};

window._mcSaveNewTag = function() {
    const name = document.getElementById('mc-tag-name').value.trim();
    if (!name) { toast('Enter a tag name', 'error'); return; }
    const color = document.getElementById('mc-tag-color').value || '#64748b';
    const id = 'tag_' + Date.now();
    if (!STATE.minicTags) STATE.minicTags = [];
    STATE.minicTags.push({ id, name, color });
    save();
    document.getElementById('bv-edit-modal').style.display = 'none';
    renderMinicBins();
    toast('Tag "'+name+'" created', 'success');
};

// ── Open add panel ──
window._mcOpenAdd = function() {
    const p = document.getElementById('mc-add-panel');
    if (p) { p.style.display = p.style.display === 'none' ? 'block' : 'none'; if (p.style.display === 'block') document.getElementById('mc-add-text').focus(); }
};

// ── Add BINs ──
window._mcDoAdd = function() {
    const text = document.getElementById('mc-add-text').value;
    const lines = text.split('\n').map(l => l.trim().replace(/\D/g, '').substring(0, 6)).filter(l => l.length >= 6);
    if (lines.length === 0) { toast('No valid BINs found', 'error'); return; }
    const existing = new Set((STATE.minicBins || []).map(b => b.bin));
    let added = 0;
    lines.forEach(bin => {
        if (existing.has(bin)) return;
        STATE.minicBins.push({ bin, tag: null, amount: '', note: '', date: todayStr(), tab: STATE.minicActiveTab || 'main' });
        existing.add(bin); added++;
    });
    save();
    document.getElementById('mc-add-text').value = '';
    document.getElementById('mc-add-panel').style.display = 'none';
    renderMinicBins();
    toast(added+' BINs added ('+(lines.length - added)+' duplicates skipped)', 'success');
    lines.forEach(bin => { if (!BIN_CACHE[bin]) lookupBin(bin).then(() => renderMinicBins()); });
};

// ── Note ──
window._mcNote = function(idx, val) {
    const b = STATE.minicBins[idx];
    if (b) { b.note = val; save(); }
};

// ── Context menu ──
window._mcCtx = function(e, idx) {
    const ctx = document.getElementById('bv-ctx-menu');
    ctx.innerHTML = '<div class="bv-ctx-item" onclick="_mcEdit('+idx+')">&#9998; Edit Amount</div>'
        + '<div class="bv-ctx-item bv-ctx-danger" onclick="_mcDelete('+idx+')">&#x2715; Delete</div>';
    ctx.style.display = 'block';
    ctx.style.left = Math.min(e.clientX, window.innerWidth - 160) + 'px';
    ctx.style.top = Math.min(e.clientY, window.innerHeight - 80) + 'px';
};

// ── Edit amount ──
window._mcEdit = function(idx) {
    document.getElementById('bv-ctx-menu').style.display = 'none';
    const b = STATE.minicBins[idx];
    if (!b) return;
    const modal = document.getElementById('bv-edit-modal');
    modal.innerHTML = `
        <div class="bv-edit-box">
            <div class="bv-edit-title">Edit BIN ${b.bin}</div>
            <label class="bv-edit-lbl">Amount ($)</label>
            <input id="mc-edit-amt" class="bv-edit-inp bv-edit-sm" type="text" value="${b.amount || ''}">
            <label class="bv-edit-lbl">Note</label>
            <input id="mc-edit-note" class="bv-edit-inp" type="text" value="${(b.note||'').replace(/"/g,'&quot;')}">
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="_mcSaveEdit(${idx})">Save</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Cancel</button>
            </div>
        </div>`;
    modal.style.display = 'flex';
    document.getElementById('mc-edit-amt').focus();
};

window._mcSaveEdit = function(idx) {
    const b = STATE.minicBins[idx];
    if (!b) return;
    b.amount = document.getElementById('mc-edit-amt').value;
    b.note = document.getElementById('mc-edit-note').value;
    save();
    document.getElementById('bv-edit-modal').style.display = 'none';
    renderMinicBins();
    toast('BIN updated', 'success');
};

// ── Delete ──
window._mcDelete = function(idx) {
    document.getElementById('bv-ctx-menu').style.display = 'none';
    _bvShowConfirm('Delete this BIN?', () => {
        STATE.minicBins.splice(idx, 1);
        save(); renderMinicBins();
        toast('BIN deleted', 'success');
    });
};

// ── Export from Parser to Mini ──
window._parserExportToMini = function() {
    const db = _loadBinDb();
    const allBins = [];
    Object.entries(db).forEach(([bank, data]) => {
        if (Array.isArray(data)) {
            data.forEach(item => {
                const bin = typeof item === 'string' ? item : (item.bin || '');
                if (bin && bin.length >= 6) allBins.push(bin.substring(0, 6));
            });
        }
    });
    if (allBins.length === 0) { toast('BIN database is empty', 'warning'); return; }

    // Create a new draft tab with today's date
    const tabId = 'mctab_' + Date.now();
    const tabName = 'Parse ' + todayStr();
    if (!STATE.minicTabs) STATE.minicTabs = [{id:'main',name:'Main'}];
    STATE.minicTabs.push({ id: tabId, name: tabName });

    const existing = new Set((STATE.minicBins || []).map(b => b.bin + '|' + (b.tab || 'main')));
    let added = 0;
    allBins.forEach(bin => {
        const key = bin + '|' + tabId;
        if (existing.has(key)) return;
        STATE.minicBins.push({ bin, tag: null, amount: '', note: '', date: todayStr(), tab: tabId });
        existing.add(key); added++;
    });

    STATE.minicActiveTab = tabId;
    save();
    toast(added + ' BINs exported to "' + tabName + '"', 'success');
    allBins.forEach(bin => { if (!BIN_CACHE[bin]) lookupBin(bin).catch(() => {}); });
};


// ── Minic — legacy status compat ──
window._mcSetStatus = function(idx, status) {
    const b = STATE.minicBins[idx];
    if (!b) return;
    b.status = b.status === status ? 'pending' : status;
    save(); renderMinicBins();
};


// ── Notes: inline rename tab ──
window._ntStartRename = function(tabId) {
    const tab = STATE.notesTabs.find(t => t.id === tabId);
    if (!tab) return;
    const modal = document.getElementById('bv-edit-modal');
    if (!modal) return;
    modal.innerHTML = `
        <div class="bv-edit-box">
            <div class="bv-edit-title">Rename Tab</div>
            <label class="bv-edit-lbl">Tab Name</label>
            <input id="nt-rename-input" class="bv-edit-inp" type="text" value="${tab.title.replace(/"/g,'&quot;')}" maxlength="50">
            <div class="bv-edit-btns">
                <button class="bv-edit-save" onclick="_ntDoRename('${tabId}')">Save</button>
                <button class="bv-edit-cancel" onclick="document.getElementById('bv-edit-modal').style.display='none'">Cancel</button>
            </div>
        </div>`;
    modal.style.display = 'flex';
    const inp = document.getElementById('nt-rename-input');
    inp.focus();
    inp.select();
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') _ntDoRename(tabId); });
};


window._ntTogglePin = function(tabId) {
    const tab = STATE.notesTabs.find(t => t.id === tabId);
    if (tab) { tab.pinned = !tab.pinned; save(); renderNotes(); }
};

window._ntDeleteTab = function(tabId) {
    if (STATE.notesTabs.length <= 1) { toast('Cannot delete last tab','error'); return; }
    _bvShowConfirm('Delete this tab?', () => {
        STATE.notesTabs = STATE.notesTabs.filter(t => t.id !== tabId);
        if (STATE.notesActiveTab === tabId) STATE.notesActiveTab = STATE.notesTabs[0]?.id || '';
        save(); renderNotes();
        toast('Tab deleted','success');
    });
};
window._ntDoRename = function(tabId) {
    const tab = STATE.notesTabs.find(t => t.id === tabId);
    if (!tab) return;
    const val = document.getElementById('nt-rename-input').value.trim();
    if (!val) { toast('Name cannot be empty', 'error'); return; }
    tab.title = val;
    save();
    document.getElementById('bv-edit-modal').style.display = 'none';
    renderNotes();
    toast('Tab renamed', 'success');
};
// Country filter
window._bvFilterCountry = function(cc) {
    STATE._bvCountry = cc;
    STATE.page = 1;
    renderAllCards();
};
// Sort toggle
window._bvSetSort = function(mode) {
    STATE._bvSort = mode;
    STATE.page = 1;
    renderAllCards();
};

// Open import panel
window._bvOpenImport = function() {
    const panel = document.getElementById('bv-import-panel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') {
            document.getElementById('bv-import-text').focus();
        }
    }
};

// Do bulk import from workspace
window._bvDoImport = function() {
    const text = document.getElementById('bv-import-text').value;
    if (!text.trim()) { toast('Paste a card list first', 'info'); return; }

    const parsed = smartParseCards(text);
    if (parsed.length === 0) { toast('No valid cards found', 'error'); return; }

    const existingNumbers = new Set(STATE.cards.map(c => c.cardNumber.replace(/\s/g, '')));
    let added = 0;

    parsed.forEach(p => {
        if (existingNumbers.has(p.cardNum)) return;
        const card = {
            id: genId(),
            name: p.name || '', surname: p.surname || '',
            cardNumber: p.cardNum,
            month: p.mm, year: p.yy, cvv: p.cvv,
            cardType: getCardType(p.cardNum),
            amount: 0, notes: '', country: 'auto',
            cardAdd: false, runAds: false, verified: false,
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
        STATE.page = 1;
        renderAll();
        toast(`${added} cards imported (${parsed.length - added} duplicates skipped)`, 'success');
        autoResolveAllCountries();
    } else {
        toast('All cards already exist', 'info');
    }

    document.getElementById('bv-import-text').value = '';
    document.getElementById('bv-import-panel').style.display = 'none';
};
// Save BIN-level note
window._saveBinNote = function(bin, val) {
    if (!STATE.binNotes) STATE.binNotes = {};
    STATE.binNotes[bin] = val;
    save();
};

// Save card-level note
window._saveCardNote = function(id, val) {
    const card = STATE.cards.find(c => c.id === id);
    if (card) { card.notes = val; save(); }
};
// Toggle BIN group expand/collapse
window._toggleBinGroup = function(bin) {
    if (_expandedBins.has(bin)) {
        _expandedBins.delete(bin);
    } else {
        _expandedBins.add(bin);
    }
    renderAllCards();
    renderStats();
};

// All Cards detail drawer toggle
// All Cards drawer removed — no expand on click
window._toggleAllCardsDrawer = function () {};

// Documents drawer removed — no expand on click
window._toggleDocDrawer = function () {};

function renderDocs() {
    const area = document.getElementById('content-area');
    const recs = STATE.docRecords || [];

    const verified = recs.filter(r => r.status === 'verified').length;
    const suspended = recs.filter(r => r.status === 'suspended').length;
    const total = recs.length;

    let cardsHtml = '';
    recs.forEach((r, i) => {
        const stV = r.status === 'verified' ? '' : 'bv-off';
        const stS = r.status === 'suspended' ? '' : 'bv-off';
        const genAddr = r.genAddress || '';

        cardsHtml += `
        <div class="dc-card ${_selectedCards.has(r.id) ? 'dc-selected' : ''}" data-idx="${i}" data-id="${r.id}" onclick="_uniRowClick(event,'${r.id}','docs')">
            <div class="dc-main">
                <input type="checkbox" class="row-select-cb" data-card-id="${r.id}" ${_selectedCards.has(r.id) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleCardSelect('${r.id}',this.checked)"><div class="dc-info">
                    <div class="dc-name">${r.name} ${r.surname}</div>
                    <div class="dc-addr">${r.address}</div>
                    ${genAddr ? `<div class="dc-gen-addr"><span class="dc-gen-tag">ALT</span> ${genAddr} <span class="dc-copy-mini" onclick="_dcCopyText('${genAddr.replace(/'/g,"\\'")}')">&#x2398;</span></div>` : ''}
                    <div class="dc-dob">DOB: ${r.dob}</div>
                </div>
                <div class="dc-actions">
                    <span class="bv-s bv-sa ${stV}" onclick="_dcSetStatus(${i},'verified')" title="Doc Verified">V</span>
                    <span class="bv-s bv-sd ${stS}" onclick="_dcSetStatus(${i},'suspended')" title="Suspended">S</span>
                    <button class="dc-btn" onclick="_dcCopy(${i})" title="Copy">Copy</button>
                    <button class="dc-btn" onclick="_dcToNotes(${i})" title="Send to Notes">Notes</button>
                    <button class="dc-btn dc-btn-gen" onclick="_dcGenAddr(${i})" title="Generate Alt Address">Gen Addr</button>
                    <button class="dc-btn dc-btn-del" onclick="_dcDelete(${i})" title="Delete">&#x2715;</button>
                </div>
            </div>
        </div>`;
    });

    area.innerHTML = `
        <div class="bv-bar">
            <span class="bv-pill"><span class="bv-s bv-sa">V</span> Verified <b>${verified}</b></span>
            <span class="bv-pill"><span class="bv-s bv-sd">S</span> Suspended <b>${suspended}</b></span>
            <span class="bv-pill">TOTAL <b>${total}</b></span>
            <label class="bulk-check" style="margin-left:auto"><input type="checkbox" id="select-all-cb" onchange="toggleSelectAll(this.checked)"></label><button class="dc-btn" onclick="_dcCopyAll()">Copy All</button>
            <button class="bv-ib" onclick="_dcOpenImport()">+ Import</button>
        </div>
        <div id="dc-import-panel" class="bv-ip" style="display:none">
            <textarea id="dc-import-text" class="bv-ita" placeholder="Paste docs...\n1.\nName: ALEJANDRO\nSurname: CAVALIERE\nAddress: 123 Main St, City, FL 12345\nDOB: 01.08.1977" rows="6"></textarea>
            <div class="bv-ia">
                <span id="dc-import-count" class="bv-ic">0 detected</span>
                <button class="bv-ig" onclick="_dcDoImport()">IMPORT</button>
                <button class="bv-icl" onclick="document.getElementById('dc-import-panel').style.display='none'">Cancel</button>
            </div>
        </div>
        <div class="dc-list">${cardsHtml || '<div class="dc-empty">No documents yet. Click + Import to add.</div>'}</div>`;

    const ta = document.getElementById('dc-import-text');
    if (ta) ta.addEventListener('input', () => {
        document.getElementById('dc-import-count').textContent = _dcParse(ta.value).length + ' detected';
    });

    // Ensure edit modal
    if (!document.getElementById('bv-edit-modal')) {
        const m = document.createElement('div');
        m.id = 'bv-edit-modal'; m.className = 'bv-edit-overlay'; m.style.display = 'none';
        document.body.appendChild(m);
        m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
    }

    renderFooter(total, 1, 1);
}

// ── Documents parser ──
function _dcParse(text) {
    const records = [];
    const blocks = text.split(/(?:^|\n)\s*\d+\.\s*\n/);
    blocks.forEach(block => {
        if (!block.trim()) return;
        const nameM = block.match(/Name\s*:\s*(.+)/i);
        const surnM = block.match(/Surname\s*:\s*(.+)/i);
        const addrM = block.match(/Address\s*:\s*(.+)/i);
        const dobM = block.match(/DOB\s*:\s*(.+)/i);
        if (nameM || surnM) {
            records.push({
                name: (nameM ? nameM[1].trim() : ''),
                surname: (surnM ? surnM[1].trim() : ''),
                address: (addrM ? addrM[1].trim() : ''),
                dob: (dobM ? dobM[1].trim() : ''),
            });
        }
    });
    return records;
}

// ── Documents actions ──
window._dcOpenImport = function() {
    const p = document.getElementById('dc-import-panel');
    if (p) { p.style.display = p.style.display === 'none' ? 'block' : 'none'; if (p.style.display === 'block') document.getElementById('dc-import-text').focus(); }
};

window._dcDoImport = function() {
    const text = document.getElementById('dc-import-text').value;
    const parsed = _dcParse(text);
    if (parsed.length === 0) { toast('No records detected', 'error'); return; }
    parsed.forEach(r => {
        STATE.docRecords.push({
            id: genId(), name: r.name, surname: r.surname,
            address: r.address, dob: r.dob,
            status: '', genAddress: '', date: todayStr()
        });
    });
    save();
    document.getElementById('dc-import-text').value = '';
    document.getElementById('dc-import-panel').style.display = 'none';
    renderDocs();
    toast(`${parsed.length} records imported`, 'success');
};

window._dcSetStatus = function(idx, status) {
    const r = STATE.docRecords[idx];
    if (!r) return;
    r.status = r.status === status ? '' : status;
    save(); renderDocs();
};

window._dcCopy = function(idx) {
    const r = STATE.docRecords[idx];
    if (!r) return;
    const text = `Name: ${r.name}\nSurname: ${r.surname}\nAddress: ${r.address}\nDOB: ${r.dob}${r.genAddress ? '\nAlt Address: ' + r.genAddress : ''}`;
    navigator.clipboard.writeText(text);
    toast('Copied', 'success');
};

window._dcCopyText = function(text) {
    navigator.clipboard.writeText(text);
    toast('Address copied', 'success');
};

window._dcCopyAll = function() {
    const text = STATE.docRecords.map((r, i) => `${i+1}.\nName: ${r.name}\nSurname: ${r.surname}\nAddress: ${r.address}\nDOB: ${r.dob}${r.genAddress ? '\nAlt Address: ' + r.genAddress : ''}`).join('\n\n');
    navigator.clipboard.writeText(text);
    toast(`${STATE.docRecords.length} records copied`, 'success');
};

window._dcToNotes = function(idx) {
    const r = STATE.docRecords[idx];
    if (!r) return;
    const content = `Name: ${r.name}\nSurname: ${r.surname}\nAddress: ${r.address}\nDOB: ${r.dob}${r.genAddress ? '\nAlt Address: ' + r.genAddress : ''}`;
    const newTab = {
        id: 'tab-' + Date.now(),
        title: `${r.name} ${r.surname}`,
        content: content.replace(/\n/g, '<br>'),
        pinned: false, tag: null,
        created: Date.now(), scrollPos: 0,
        exportSource: 'Documents'
    };
    STATE.notesTabs.unshift(newTab);
    STATE.notesActiveTab = newTab.id;
    save();
    toast('Sent to Notes', 'success');
};

window._dcGenAddr = function(idx) {
    const r = STATE.docRecords[idx];
    if (!r || !r.address) return;
    const m = r.address.match(/^(\d+)\s+(.+)/);
    if (!m) { toast('Cannot parse address number', 'error'); return; }
    const origNum = parseInt(m[1]);
    const delta = Math.floor(Math.random() * 11) + 5;
    const dir = Math.random() > 0.5 ? 1 : -1;
    const newNum = Math.max(1, origNum + delta * dir);
    r.genAddress = newNum + ' ' + m[2];
    save(); renderDocs();
    toast('Alt address generated', 'success');
};

window._dcDelete = function(idx) {
    _bvShowConfirm('Delete this record?', () => {
        STATE.docRecords.splice(idx, 1);
        save(); renderDocs();
        toast('Record deleted', 'success');
    });
};


function _getActiveNoteTab() {
    return STATE.notesTabs.find(t => t.id === STATE.notesActiveTab) || STATE.notesTabs[0];
}

// Get plain text content from the rich-text editor div
function _getEditorText(editor) {
    if (!editor) return '';
    // innerText correctly maps the visual line structure of contenteditable
    // (handles <div>, <br>, <p> all properly as the browser renders them)
    return editor.innerText || '';
}

function _saveActiveTab() {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;
    const tab = _getActiveNoteTab();
    if (tab) {
        tab.content = editor.innerHTML; // store HTML to preserve colors
        tab.scrollPos = editor.scrollTop;
    }
    STATE.notes = editor.innerHTML;
    STATE.notesLastSaved = Date.now();
    save();
}

function _saveAllTabs() {
    const editor = document.getElementById('notes-editor');
    if (editor) {
        const tab = _getActiveNoteTab();
        if (tab) {
            tab.content = editor.innerHTML;
            tab.scrollPos = editor.scrollTop;
        }
        STATE.notes = editor.innerHTML;
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
        html += `<div class="nl-row${isPinned ? ' nl-pinned' : ''}" data-line="${i}"><span class="nl-pin">${isPinned ? '\u{1F4CC}' : ''}</span><span class="nl-num">${i}</span></div>`;
    }
    return html;
}

// Shift pinned line numbers when lines are added/removed at a given position
function _shiftPinnedLines(tab, editLine, delta) {
    if (!tab || !tab.pinnedLines || !tab.pinnedLines.length || delta === 0) return;
    const newPinned = [];
    for (const pin of tab.pinnedLines) {
        if (pin < editLine) {
            newPinned.push(pin);
        } else {
            const shifted = pin + delta;
            if (shifted >= 1) newPinned.push(shifted);
        }
    }
    tab.pinnedLines = newPinned;
}

function _rebuildLineNums(editorOrCount) {
    const tab = _getActiveNoteTab();
    const container = document.getElementById('notes-line-nums');
    if (!container) return;
    let nums;
    if (typeof editorOrCount === 'number') {
        nums = editorOrCount;
    } else {
        // It's a DOM element (editor div) — use innerText line count
        const text = _getEditorText(editorOrCount);
        const splitLines = (text || '').split('\n');
        // innerText may append a trailing '\n' on some browsers — trim it
        if (splitLines.length > 1 && splitLines[splitLines.length - 1] === '') splitLines.pop();
        nums = splitLines.length || 1;
    }
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

    // Auto-cleanup
    if (STATE.notesTabs.length > 1) {
        const _normC = (html) => {
            if (!html) return '';
            return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>\s*<div/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
        };
        const now = Date.now();
        const nonEmpty = STATE.notesTabs.filter(t =>
            _normC(t.content) || t.id === STATE.notesActiveTab || (t.created && (now - t.created) < 60000)
        );
        if (nonEmpty.length > 0 && nonEmpty.length < STATE.notesTabs.length) {
            STATE.notesTabs = nonEmpty;
        }
        // Remove exact content duplicates (keep newest)
        const seen = new Map();
        const unique = [];
        // Sort by created DESC so newest comes first
        const sorted = [...STATE.notesTabs].sort((a, b) => (b.created || 0) - (a.created || 0));
        for (const tab of sorted) {
            const norm = _normC(tab.content);
            if (!norm || !seen.has(norm)) {
                if (norm) seen.set(norm, true);
                unique.push(tab);
            }
        }
        if (unique.length < STATE.notesTabs.length) {
            STATE.notesTabs = unique;
            if (!STATE.notesTabs.find(t => t.id === STATE.notesActiveTab)) {
                STATE.notesActiveTab = STATE.notesTabs[0]?.id || '';
            }
            save();
        }
    }
    const activeTab = _getActiveNoteTab();
    if (!activeTab) return;
    if (!activeTab.pinnedLines) activeTab.pinnedLines = [];

    const tabs = [...STATE.notesTabs];
    // content is HTML (may contain color spans), count lines from plain text
    const content = activeTab.content || '';
    const plainText = (() => {
        // Quick strip for line counting — don't render to DOM here
        let t = content.replace(/<br\s*\/?>/gi, '\n').replace(/<\/div><div/gi, '\n').replace(/<\/p><p/gi, '\n');
        return t.replace(/<[^>]+>/g, '');
    })();
    const lineCount = plainText.split('\n').length || 1;
    const lineNumsHTML = _buildLineNumsHTML(lineCount, activeTab.pinnedLines);

    // Sort: pinned tabs first
    const sortedTabs = [...tabs].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    // Tab bar
    let tabsHTML = sortedTabs.map(t => {
        const isActive = t.id === STATE.notesActiveTab;
        const pinIcon = t.pinned ? '<span class="nt-pin-icon">📌</span>' : '';
        return `<button class="nt-tab ${isActive ? 'active' : ''} ${t.pinned ? 'nt-pinned' : ''}" data-tab="${t.id}" ondblclick="_ntStartRename('${t.id}')">
            ${pinIcon}<span class="nt-tab-title" data-tab="${t.id}">${t.title}</span><span class="nt-tab-edit" onclick="event.stopPropagation();_ntStartRename('${t.id}')" title="Rename">✏️</span>
            ${tabs.length > 1 ? `<span class="nt-tab-close" data-tab="${t.id}">×</span>` : ''}
        </button>`;
    }).join('');
    tabsHTML += `<button class="nt-new-tab" id="nt-new-tab" title="New tab">+</button>`;

    const _countCards = (content) => {
        if (!content) return 0;
        const plain = content.replace(/<br\s*\/?>/gi, '\n').replace(/<\/div><div/gi, '\n').replace(/<[^>]+>/g, '');
        return (plain.match(/\d{13,19}/g) || []).length;
    };

    // ── Sidebar item list (full, for the drawer) ──
    const sidebarItemsHTML = tabs.map(t => {
        const isActive = t.id === STATE.notesActiveTab;
        const cardCount = _countCards(t.content);
        const srcBadge = t.exportSource ? `<span class="nt-meta-source" title="From ${t.exportSource}">${t.exportSource}</span>` : '';
        return `<div class="nt-sidebar-item ${isActive ? 'active' : ''}" data-tab="${t.id}">
            <span class="nt-sidebar-item-title" data-tab="${t.id}">${t.title}</span>
            <span class="nt-sidebar-item-meta">${srcBadge}${cardCount > 0 ? `<span class="nt-meta-cards">💳${cardCount}</span>` : ''}</span>
            <div class="nt-sidebar-actions"><button class="nt-sidebar-act-btn" onclick="event.stopPropagation();_ntStartRename('${t.id}')" title="Rename">✏️</button><button class="nt-sidebar-act-btn ${t.pinned ? 'active' : ''}" onclick="event.stopPropagation();_ntTogglePin('${t.id}')" title="${t.pinned ? 'Unpin' : 'Pin'}">${t.pinned ? '📌' : '📍'}</button>${tabs.length > 1 ? `<button class="nt-sidebar-act-btn nt-sidebar-act-del" onclick="event.stopPropagation();_ntDeleteTab('${t.id}')" title="Delete">🗑️</button>` : ''}</div>
        </div>`;
    }).join('');

    area.innerHTML = `
        <!-- Sidebar overlay (backdrop) -->
        <div class="nt-sidebar-overlay" id="nt-sidebar-overlay"></div>

        <!-- Sidebar drawer -->
        <div class="nt-sidebar" id="nt-sidebar">
            <div class="nt-sidebar-header">
                <span class="nt-sidebar-title">📝 All Tabs (${tabs.length})</span>
                <button class="nt-sidebar-close" id="nt-sidebar-close">×</button>
            </div>
            <div class="nt-sidebar-new">
                <button class="nt-sidebar-new-btn" id="nt-sidebar-new-btn">+ New Tab</button>
            </div>
            <div class="nt-sidebar-list" id="nt-sidebar-list">${sidebarItemsHTML}</div>
        </div>

        <div class="notes-container">
            <div class="nt-tab-bar">
                <div class="nt-tabs-scroll">
                    <!-- Sidebar toggle -->
                    <button class="nt-sidebar-toggle" id="nt-sidebar-open" title="All tabs">☰ Tabs</button>
                    ${tabsHTML}
                </div>
                <div class="nt-toolbar-right">
                    <button class="nt-tool-btn" id="notes-pin-btn" title="Pin/Unpin tab">📌 PIN</button>
                    <button class="nt-tool-btn" id="notes-rename-btn" title="Rename tab">RENAME</button>
                    <button class="nt-tool-btn" id="notes-clear-btn" title="Clear current tab">CLEAR</button>
                    <button class="nt-tool-btn" id="notes-save-btn">SAVE</button>
                </div>
            </div>
            <div class="notes-editor-wrap">
                <div class="notes-line-numbers" id="notes-line-nums">${lineNumsHTML}</div>
                <div class="notes-editor" id="notes-editor" contenteditable="true" spellcheck="false" style="font-size:${STATE.notesFontSize}px" data-placeholder="Write notes..."></div>
            </div>
            <div class="notes-status-bar">
                <span class="notes-saved-info">${lineCount} lines</span>
            </div>
        </div>
    `; 

    const sidebar = document.getElementById('nt-sidebar');
    const overlay = document.getElementById('nt-sidebar-overlay');
    const openSidebar = () => { sidebar.classList.add('open'); overlay.classList.add('open'); };
    const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };

    document.getElementById('nt-sidebar-open')?.addEventListener('click', openSidebar);
    document.getElementById('nt-sidebar-close')?.addEventListener('click', closeSidebar);
    overlay?.addEventListener('click', closeSidebar);

    // ── Sidebar: switch tab ──
    document.querySelectorAll('.nt-sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('nt-sidebar-item-close')) return;
            _saveActiveTab();
            STATE.notesActiveTab = item.dataset.tab;
            save();
            closeSidebar();
            renderNotes();
        });
    });

    // ── Sidebar: close tab ──
    document.querySelectorAll('.nt-sidebar-item-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabId = btn.dataset.tab;
            if (STATE.notesTabs.length <= 1) return;
            STATE.notesTabs = STATE.notesTabs.filter(t => t.id !== tabId);
            if (STATE.notesActiveTab === tabId) STATE.notesActiveTab = STATE.notesTabs[0]?.id || '';
            save();
            closeSidebar();
            renderNotes();
        });
    });

    // ── Sidebar: new tab ──
    const _createNewTab = () => {
        const newTab = {
            id: 'tab-' + Date.now(),
            title: 'Tab ' + (STATE.notesTabs.length + 1),
            content: '', pinned: false, tag: null,
            created: Date.now(), scrollPos: 0
        };
        STATE.notesTabs.unshift(newTab);
        STATE.notesActiveTab = newTab.id;
        save();
        closeSidebar();
        renderNotes();
    };
    document.getElementById('nt-sidebar-new-btn')?.addEventListener('click', _createNewTab);

    // ── Sidebar: pin tab ──
    document.querySelectorAll('.nt-sidebar-pin').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabId = btn.dataset.tab;
            const tab = STATE.notesTabs.find(t => t.id === tabId);
            if (tab) { tab.pinned = !tab.pinned; save(); renderNotes(); }
        });
    });

    // ── Pin button in toolbar ──
    document.getElementById('notes-pin-btn')?.addEventListener('click', () => {
        const tab = _getActiveNoteTab();
        if (tab) { tab.pinned = !tab.pinned; save(); renderNotes(); }
    });

    // ── Rename button in toolbar ──
    document.getElementById('notes-rename-btn')?.addEventListener('click', () => {
        _ntStartRename(STATE.notesActiveTab);
    });

    // ── Double-click tab title to rename ──
    area.querySelectorAll('.nt-tab-title').forEach(el => {
        el.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            _ntStartRename(el.dataset.tab);
        });
    });

    // ── Set initial content into editor AFTER HTML is in DOM ──
    const editor = document.getElementById('notes-editor');
    if (editor) {
        editor.innerHTML = content; // Set HTML content (preserves colored spans)
        if (!content) editor.innerHTML = ''; // empty state shows placeholder via CSS
    }

    // ── Wire pin clicks on line numbers ──
    _wireLinePinClicks(document.getElementById('notes-line-nums'));

    // ── Unified right-click context menu (colors + split + sort) ──
    const NOTE_COLORS = [
        { label: 'Red',    color: '#ef4444' },
        { label: 'Orange', color: '#f97316' },
        { label: 'Yellow', color: '#eab308' },
        { label: 'Green',  color: '#22c55e' },
        { label: 'Blue',   color: '#3b82f6' },
        { label: 'Purple', color: '#a855f7' },
        { label: 'Cyan',   color: '#06b6d4' },
        { label: 'Pink',   color: '#ec4899' },
        { label: 'White',  color: '#f1f5f9' },
    ];

    function _removeNotesCtxMenu() {
        const old = document.getElementById('notes-ctx-menu');
        if (old) old.remove();
    }

    if (editor) {
        editor.addEventListener('contextmenu', (e) => {
            const sel = window.getSelection();
            const selText = sel ? sel.toString() : '';
            if (!selText) return; // no selection -> browser default
            e.preventDefault();
            _removeNotesCtxMenu();

            const menu = document.createElement('div');
            menu.id = 'notes-ctx-menu';
            menu.className = 'notes-ctx-menu';

            // ── Section 1: Color swatches ──
            const colorHeader = document.createElement('div');
            colorHeader.className = 'nctx-header';
            colorHeader.textContent = 'COLOR';
            menu.appendChild(colorHeader);

            const swatches = document.createElement('div');
            swatches.className = 'nctx-swatches';
            NOTE_COLORS.forEach(({ label, color }) => {
                const sw = document.createElement('button');
                sw.className = 'nctx-swatch';
                sw.title = label;
                sw.style.background = color;
                sw.addEventListener('mousedown', (ev) => {
                    ev.preventDefault();
                    editor.focus();
                    document.execCommand('styleWithCSS', false, true);
                    document.execCommand('foreColor', false, color);
                    _removeNotesCtxMenu();
                    editor.dispatchEvent(new Event('input'));
                });
                swatches.appendChild(sw);
            });
            menu.appendChild(swatches);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'nctx-remove';
            removeBtn.textContent = '\u2715 Remove color';
            removeBtn.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                editor.focus();
                document.execCommand('styleWithCSS', false, true);
                document.execCommand('foreColor', false, '');
                const selNow = window.getSelection();
                if (selNow && selNow.rangeCount) {
                    const range = selNow.getRangeAt(0);
                    const fragment = range.extractContents();
                    fragment.querySelectorAll('[style*="color"]').forEach(el => {
                        el.style.removeProperty('color');
                        if (!el.style.cssText.trim()) el.replaceWith(...el.childNodes);
                    });
                    range.insertNode(fragment);
                }
                _removeNotesCtxMenu();
                editor.dispatchEvent(new Event('input'));
            });
            menu.appendChild(removeBtn);

            // ── Section 2: Split ──
            const div1 = document.createElement('div');
            div1.className = 'nctx-divider';
            menu.appendChild(div1);

            const splitHeader = document.createElement('div');
            splitHeader.className = 'nctx-header';
            splitHeader.textContent = 'SPLIT EVERY';
            menu.appendChild(splitHeader);

            const splitRow = document.createElement('div');
            splitRow.className = 'nctx-split-row';
            [10, 15, 20, 30, 50].forEach(n => {
                const btn = document.createElement('button');
                btn.className = 'nctx-split-btn';
                btn.textContent = n;
                btn.addEventListener('mousedown', (ev) => {
                    ev.preventDefault();
                    _removeNotesCtxMenu();
                    const html = editor.innerHTML;
                    const parts = html.split(/(<br\s*\/?>|<\/div><div[^>]*>|\n)/gi);
                    let lineIdx = 0;
                    const result = [];
                    for (let i = 0; i < parts.length; i++) {
                        result.push(parts[i]);
                        if (!parts[i].match(/^(<br\s*\/?>|<\/div><div[^>]*>|\n)$/i)) {
                            lineIdx++;
                            if (lineIdx % n === 0 && i < parts.length - 1) result.push('<br><br>');
                        }
                    }
                    editor.innerHTML = result.join('');
                    _saveActiveTab();
                    const tab = _getActiveNoteTab();
                    if (tab) tab.content = editor.innerHTML;
                    save();
                    renderNotes();
                    toast('Split every ' + n + ' lines', 'success');
                });
                splitRow.appendChild(btn);
            });
            menu.appendChild(splitRow);

            // ── Section 3: Sort Valid ──
            const div2 = document.createElement('div');
            div2.className = 'nctx-divider';
            menu.appendChild(div2);

            const sortBtn = document.createElement('button');
            sortBtn.className = 'nctx-action-btn nctx-sort-valid';
            sortBtn.textContent = '\u2714 Sort Valid Cards';
            sortBtn.addEventListener('mousedown', (ev) => {
                ev.preventDefault();
                _removeNotesCtxMenu();
                // Open sort modal
                let modal = document.getElementById('nt-sort-modal');
                if (modal) modal.remove();
                modal = document.createElement('div');
                modal.id = 'nt-sort-modal';
                modal.className = 'nt-sort-modal-overlay';
                modal.innerHTML =
                    '<div class="nt-sort-modal">' +
                    '  <div class="nt-sort-modal-header">Sort Valid Cards</div>' +
                    '  <p class="nt-sort-modal-desc">Paste checker results (Approved / ALIVE = valid):</p>' +
                    '  <textarea id="nt-sort-input" class="nt-sort-input" rows="10" placeholder="4847835121393811 | Approved\n3752490102710 - ALIVE"></textarea>' +
                    '  <div class="nt-sort-modal-actions">' +
                    '    <button id="nt-sort-cancel" class="nt-sort-btn nt-sort-cancel">Cancel</button>' +
                    '    <button id="nt-sort-apply" class="nt-sort-btn nt-sort-apply">Sort & Color</button>' +
                    '  </div></div>';
                document.body.appendChild(modal);
                document.getElementById('nt-sort-cancel').onclick = () => modal.remove();
                modal.addEventListener('click', (ev2) => { if (ev2.target === modal) modal.remove(); });
                document.getElementById('nt-sort-apply').onclick = () => {
                    const raw = document.getElementById('nt-sort-input').value;
                    if (!raw.trim()) { modal.remove(); return; }
                    const cardStatus = new Map();
                    raw.split('\n').forEach(line => {
                        const nums = line.match(/\d{13,19}/g);
                        if (!nums) return;
                        const lower = line.toLowerCase();
                        const isValid = lower.includes('approved') || lower.includes('alive') ||
                            lower.includes('live') || lower.includes('charged') ||
                            lower.includes('valid') || lower.includes('success') ||
                            lower.includes('active') || lower.includes('cvv match') ||
                            lower.includes('ccn live') || lower.includes('✅') ||
                            line.includes('\u2705');
                        cardStatus.set(nums[0], isValid);
                    });
                    if (cardStatus.size === 0) { toast('No card numbers found', 'error'); return; }
                    let lineEls = editor.innerHTML.replace(/<div>/gi, '\n<div>').replace(/<br\s*\/?>/gi, '\n').split('\n').filter(l => l.trim());
                    const valid = [], dead = [], unknown = [];
                    lineEls.forEach(lh => {
                        const plain = lh.replace(/<[^>]+>/g, '');
                        const nums = plain.match(/\d{13,19}/g);
                        if (!nums) { unknown.push(lh); return; }
                        if (cardStatus.has(nums[0])) {
                            const ok = cardStatus.get(nums[0]);
                            const s = lh.replace(/<\/?div[^>]*>/gi, '');
                            const c = '<span style="color:' + (ok ? '#4ade80' : '#f87171') + '">' + s + '</span>';
                            (ok ? valid : dead).push(c);
                        } else unknown.push(lh);
                    });
                    editor.innerHTML = [...valid, ...unknown, ...dead].join('<br>');
                    _saveActiveTab();
                    const tab = _getActiveNoteTab();
                    if (tab) tab.content = editor.innerHTML;
                    save(); modal.remove(); renderNotes();
                    toast('Sorted: ' + valid.length + ' valid, ' + dead.length + ' dead, ' + unknown.length + ' unchecked', 'success');
                };
            });
            menu.appendChild(sortBtn);

            // Position menu
            document.body.appendChild(menu);
            const mw = menu.offsetWidth, mh = menu.offsetHeight;
            let x = e.clientX, y = e.clientY;
            if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
            if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;
            menu.style.left = x + 'px';
            menu.style.top  = y + 'px';

            const _closeMenu = (ev) => {
                if (!menu.contains(ev.target)) {
                    _removeNotesCtxMenu();
                    document.removeEventListener('mousedown', _closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('mousedown', _closeMenu), 0);
        });
    }

    let _notesSaveTimer = null;
    // Initialize from actual rendered text (not the pre-parsed estimate)
    let _prevLineCount = editor ? (_getEditorText(editor).split('\n').filter((_, i, a) => !(i === a.length - 1 && _ === '')).length || 1) : lineCount;
    let _prevCursorLine = 1;
    let _prevCursorCol = 0;

    // Helper: get cursor line + col from a contenteditable div using Selection API
    function _getEditorCursorPos() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) return { line: 1, col: 0 };
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.setStart(editor, 0);
        preRange.setEnd(range.startContainer, range.startOffset);
        const textBefore = preRange.toString();
        const lines = textBefore.split('\n');
        return { line: lines.length, col: lines[lines.length - 1].length };
    }

    if (editor) {
        editor.addEventListener('keydown', () => {
            // Capture BEFORE state for pin shifting
            const text = _getEditorText(editor);
            const kLines = text.split('\n');
            if (kLines.length > 1 && kLines[kLines.length - 1] === '') kLines.pop();
            _prevLineCount = kLines.length || 1;
            const pos = _getEditorCursorPos();
            _prevCursorLine = pos.line;
            _prevCursorCol = pos.col;
        });

        editor.addEventListener('input', () => {
            const newText = _getEditorText(editor);
            const iLines = newText.split('\n');
            if (iLines.length > 1 && iLines[iLines.length - 1] === '') iLines.pop();
            const newLineCount = iLines.length || 1;
            const delta = newLineCount - _prevLineCount;
            if (delta !== 0) {
                const tab = _getActiveNoteTab();
                // If cursor was at col 0 (start of line) and Enter was pressed,
                // the current line and everything on it shifts down.
                let editLine;
                if (delta > 0) {
                    editLine = _prevCursorCol === 0 ? _prevCursorLine : _prevCursorLine + 1;
                } else {
                    editLine = _prevCursorLine;
                }
                _shiftPinnedLines(tab, editLine, delta);
            }
            _prevLineCount = newLineCount;
            _rebuildLineNums(editor);
            const si = document.querySelector('.notes-saved-info');
            if (si) si.textContent = 'Editing...';
            clearTimeout(_notesSaveTimer);
            _notesSaveTimer = setTimeout(() => {
                _saveActiveTab();
                if (si) si.textContent = newLineCount + ' lines';
            }, 600);
        });

        editor.addEventListener('scroll', () => {
            const lineNums = document.getElementById('notes-line-nums');
            if (lineNums) lineNums.scrollTop = editor.scrollTop;
        });

        if (activeTab.scrollPos) {
            editor.scrollTop = activeTab.scrollPos;
            const lineNums = document.getElementById('notes-line-nums');
            if (lineNums) lineNums.scrollTop = activeTab.scrollPos;
        }

    }

    // ── Tab bar: switch tab ──
    area.querySelectorAll('.nt-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('nt-tab-close')) return;
            _saveActiveTab();
            STATE.notesActiveTab = btn.dataset.tab;
            save();
            renderNotes();
        });
    });

    // ── Tab bar: close tab ──
    area.querySelectorAll('.nt-tab-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tabId = btn.dataset.tab;
            if (STATE.notesTabs.length <= 1) return;
            STATE.notesTabs = STATE.notesTabs.filter(t => t.id !== tabId);
            if (STATE.notesActiveTab === tabId) STATE.notesActiveTab = STATE.notesTabs[0]?.id || '';
            save();
            renderNotes();
        });
    });

    // ── Tab rename on double-click ──
    area.querySelectorAll('.nt-tab-title').forEach(span => {
        span.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const tabId = span.dataset.tab;
            const tab = STATE.notesTabs.find(t => t.id === tabId);
            if (!tab) return;
            span.contentEditable = 'true';
            span.focus();
            const range = document.createRange();
            range.selectNodeContents(span);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            const finish = () => {
                span.contentEditable = 'false';
                const newName = span.textContent.trim();
                if (newName && newName !== tab.title) { tab.title = newName; save(); }
                span.textContent = tab.title;
            };
            span.addEventListener('blur', finish, { once: true });
            span.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); span.blur(); }
                if (ev.key === 'Escape') { span.textContent = tab.title; span.blur(); }
            });
        });
    });

    // ── New tab (+ button in tab bar) ──
    document.getElementById('nt-new-tab')?.addEventListener('click', _createNewTab);

    // ── Toolbar ──
    document.getElementById('notes-save-btn')?.addEventListener('click', _saveAllTabs);
    document.getElementById('notes-clear-btn')?.addEventListener('click', () => {
        const tab = _getActiveNoteTab();
        if (!tab) return;
        tab.content = '';
        STATE.notes = '';
        save();
        renderNotes();
        toast('Tab cleared', 'info');
    });

    // ── Highlight selected text (bold wrap) ──
    document.getElementById('notes-highlight-btn')?.addEventListener('click', () => {
        const ed = document.getElementById('notes-editor');
        if (!ed) return;
        const sel = window.getSelection();
        if (!sel || !sel.toString()) { toast('Select text first', 'warning'); return; }
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('bold', false, null);
        ed.dispatchEvent(new Event('input'));
        ed.focus();
    });

    // ── Image paste into contenteditable editor ──
    document.getElementById('notes-editor')?.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = () => {
                    const ed = document.getElementById('notes-editor');
                    if (!ed) return;
                    const img = document.createElement('img');
                    img.src = reader.result;
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '4px';
                    img.style.margin = '4px 0';
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(img);
                        range.setStartAfter(img);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else {
                        ed.appendChild(img);
                    }
                    ed.dispatchEvent(new Event('input'));
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
        const showAdd = ['all-cards', 'my-card', 'ready-to-work', 'docs', 'global-docs'].includes(STATE.currentView);
        const addBtn = document.getElementById('add-card-btn');
        if (addBtn) addBtn.style.display = showAdd ? 'flex' : 'none';
        renderGeoFilterBar();
        return;
    }

    switch (STATE.currentView) {
        case 'all-cards':
            flagEl.textContent = '💳';
            titleEl.textContent = 'Workspace';
            break;
        case 'docs':
            flagEl.textContent = '📄';
            titleEl.textContent = 'Documents';
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
        case 'prompts':
            flagEl.textContent = '💡';
            titleEl.textContent = 'Prompts';
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
            titleEl.textContent = 'Workspace';
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
    const showAdd = ['cards', 'my-card', 'ready-to-work', 'all-cards', 'minic-bins', 'global-docs', 'docs', 'generator-view'].includes(STATE.currentView);

    const addCardBtn = document.getElementById('add-card-btn');
    if (addCardBtn) addCardBtn.style.display = showAdd ? 'flex' : 'none';

    if (STATE.currentView === 'docs' || STATE.currentView === 'global-docs') {
        if (addCardBtn) addCardBtn.style.display = 'flex';
        const addTxt = document.getElementById('add-btn-text');
        if (addTxt) addTxt.textContent = 'ADD DOC';
    } else {
        const addTxt2 = document.getElementById('add-btn-text');
        if (addTxt2) addTxt2.textContent = 'ADD';
    }

    // GEO filter bar for My Card and Global Docs
    renderGeoFilterBar();
}

function renderGeoFilterBar() {
    let bar = document.getElementById('geo-filter-bar');
    // Show geo filter on workspace & docs views for country filtering
    if (!['cards', 'my-card', 'global-docs'].includes(STATE.currentView)) {
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

    // Collect unique countries from cards/docs using BIN-detected country codes
    const geos = new Map(); // code → { flag, name, count }
    const source = ['global-docs'].includes(STATE.currentView) ? STATE.docs : STATE.cards;
    source.forEach(item => {
        const code = item.country || '';
        if (!code) return;
        if (!geos.has(code)) {
            // Resolve flag from BIN cache or COUNTRY_DB
            const upper = code.toUpperCase();
            const dbName = COUNTRY_DB[upper];
            const flag = dbName ? isoToFlag(upper) : '';
            const name = dbName || code;
            geos.set(code, { flag, name, label: upper, count: 0 });
        }
        geos.get(code).count++;
    });

    const totalCards = source.length;
    let html = `<button class="geo-btn ${_geoFilter === 'all' ? 'active' : ''}" onclick="setGeoFilter('all')">ALL (${totalCards})</button>`;
    // Sort by count descending
    const sorted = [...geos.entries()].sort((a, b) => b[1].count - a[1].count);
    sorted.forEach(([code, info]) => {
        html += `<button class="geo-btn ${_geoFilter === code ? 'active' : ''}" onclick="setGeoFilter('${code}')">${info.flag || info.label} ${info.label} (${info.count})</button>`;
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
// ──── HASH ROUTING (with sub-routes) ────
// Maps friendly hash names ↔ internal view names
const HASH_TO_VIEW = {
    'workspace':     'all-cards',
    'documents':     'global-docs',
    'parser':        'new-cards',
    'checker':       'checker',
    'notes':         'notes',
    'analytics':     'analytics',
    'trash':         'trash',
    'google-format': 'google-format',
    'domain':        'domain',
    'bin-tester':    'bin-tester',
    'minic':         'minic-bins',
    'generator':     'generator-view',
    'prompts':       'prompts',
    'bin-database':  'bin-db-view',
};
const VIEW_TO_HASH = Object.fromEntries(
    Object.entries(HASH_TO_VIEW).map(([k, v]) => [v, k])
);

// Valid checker sub-modes that map to _CK.mode
const CHECKER_SUBMODES = ['proxy', 'bin', 'card'];
// Valid generator sub-types that map to _CK.generator.type
const GENERATOR_SUBTYPES = ['tepco', 'water', 'creditcard', 'driverlicense', 'zipprocessor', 'bankstatement', 'cleanname'];

/**
 * Parse hash into { view, subMode, subType }.
 * Supports 3-level deep links:
 *   #checker                          → { view: 'checker', subMode: null,        subType: null }
 *   #checker/proxy                    → { view: 'checker', subMode: 'proxy',     subType: null }
 *   #checker/generator                → { view: 'checker', subMode: 'generator', subType: null }
 *   #checker/generator/creditcard     → { view: 'checker', subMode: 'generator', subType: 'creditcard' }
 *   #workspace                        → { view: 'all-cards', subMode: null,       subType: null }
 */
function _parseHash() {
    const raw = (window.location.hash || '').replace(/^#/, '').replace(/\?.*$/, '').toLowerCase();
    if (!raw) return { view: null, subMode: null, subType: null };

    const parts = raw.split('/');
    const baseHash = parts[0];
    const sub = parts[1] || null;
    const subType = parts[2] || null;

    const view = HASH_TO_VIEW[baseHash] || null;
    return { view, subMode: sub, subType: subType };
}

function _getViewFromHash() {
    return _parseHash().view;
}

/**
 * Build full hash for current view + checker/generator sub-mode.
 * Format: #checker/generator/creditcard (3-level for generators)
 *         #checker/proxy               (2-level for checker modes)
 */
function _buildHash(view) {
    const h = VIEW_TO_HASH[view] || 'workspace';

    // For checker view, append sub-mode
    if (view === 'checker') {
        const mode = _CK.mode || 'proxy';
        if (mode === 'generator') {
            // 3-level: #checker/generator/creditcard
            const genType = _CK.generator.type || 'tepco';
            return h + '/generator/' + genType;
        }
        // 2-level: #checker/proxy, #checker/glue, etc.
        return h + '/' + mode;
    }
    return h;
}

function _setHashSilent(view) {
    const h = _buildHash(view);
    // Avoid triggering hashchange listener
    window._hashNav = true;
    window.location.hash = '#' + h;
    setTimeout(() => { window._hashNav = false; }, 50);
}

/**
 * Update only the sub-hash without triggering a full navigation.
 * Called when switching checker modes or generator types.
 */
function _updateSubHashSilent() {
    if (STATE.currentView !== 'checker') return;
    const h = _buildHash('checker');
    window._hashNav = true;
    window.location.hash = '#' + h;
    setTimeout(() => { window._hashNav = false; }, 50);
}

/**
 * Apply sub-mode from hash to _CK state.
 * Supports both 2-level (#checker/proxy) and 3-level (#checker/generator/creditcard).
 */
function _applyCheckerSubMode(subMode, subType) {
    if (!subMode) return;

    // 3-level: #checker/generator/creditcard
    if (subMode === 'generator') {
        _CK.mode = 'generator';
        if (subType && GENERATOR_SUBTYPES.includes(subType)) {
            _CK.generator.type = subType;
        }
        return;
    }

    // 2-level: #checker/proxy, #checker/glue, etc.
    if (CHECKER_SUBMODES.includes(subMode)) {
        _CK.mode = subMode;
        return;
    }

    // Legacy fallback: 2-level #checker/creditcard → treat as generator sub-type
    if (GENERATOR_SUBTYPES.includes(subMode)) {
        _CK.mode = 'generator';
        _CK.generator.type = subMode;
        return;
    }
}

// Listen for browser back/forward navigation
window.addEventListener('hashchange', () => {
    if (window._hashNav) return; // skip our own updates
    const { view, subMode, subType } = _parseHash();
    if (!view) return;

    if (view === 'checker' && STATE.currentView === 'checker') {
        // Same view, but sub-mode may have changed (browser back/forward within checker)
        const prevMode = _CK.mode;
        const prevGenType = _CK.generator.type;
        _applyCheckerSubMode(subMode, subType);
        if (_CK.mode !== prevMode || _CK.generator.type !== prevGenType) {
            renderChecker();
        }
        return;
    }

    if (view !== STATE.currentView) {
        if (view === 'checker' && subMode) {
            _applyCheckerSubMode(subMode, subType);
        }
        navigate(view);
    }
});

function navigate(view) {
    // Auto-save active notes tab before leaving notes view
    if (STATE.currentView === 'notes') {
        const editor = document.getElementById('notes-editor');
        if (editor) {
            const tab = STATE.notesTabs.find(t => t.id === STATE.notesActiveTab);
            if (tab) {
                tab.content = editor.innerHTML;
                tab.scrollPos = editor.scrollTop;
            }
            STATE.notes = editor.innerHTML;
            STATE.notesLastSaved = Date.now();
            save();
        }
    }
    // Auto-save active prompts tab before leaving prompts view
    if (STATE.currentView === 'prompts') {
        _saveActivePromptTab();
        save();
    }
    STATE.currentView = view;
    STATE.page = 1;
    STATE.search = '';
    document.getElementById('search-input').value = '';
    // Update URL hash so this view has a direct link
    _setHashSilent(view);
    renderAll();
}

window.expandCountry = function (id) {
    // Set geo filter and navigate to workspace
    _geoFilter = id;
    navigate('all-cards');
};

window.deleteCountry = function (id) {
    // Remove all cards/docs with this country code
    STATE.cards = STATE.cards.filter(c => c.country !== id);
    STATE.docs = STATE.docs.filter(d => d.country !== id);
    STATE.trash = STATE.trash.filter(c => c.country !== id);
    STATE.countries = STATE.countries.filter(c => c.id !== id);
    save();
    renderAll();
    toast(`Country "${id}" cards deleted`, 'info');
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

        // Targeted DOM update: toggle button/dot classes without re-render
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            // Support both old (.status-btn) and new compact (.cx-dot) layouts
            const fields = {
                cardAdd: ['.status-btn.btn-a', '.cx-dot-a'],
                runAds:  ['.status-btn.btn-r', '.cx-dot-r'],
                verified:['.status-btn.btn-v', '.cx-dot-v'],
                docReady:['.status-btn.btn-d', '.cx-dot-d'],
                waterBill:['.status-btn.btn-w', '.cx-dot-w'],
                minic:   ['.status-btn.btn-m', '.cx-dot-m'],
            };
            for (const [f, selectors] of Object.entries(fields)) {
                for (const sel of selectors) {
                    const el = row.querySelector(sel);
                    if (el) {
                        el.classList.toggle('active', card[f]);
                        el.classList.toggle('on', card[f]);
                    }
                }
            }
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
    var bar = document.getElementById('bulk-action-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'bulk-action-bar';
        bar.setAttribute('style',
            'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
            'align-items:center;gap:10px;padding:8px 16px;' +
            'background:rgba(15,17,25,0.96);border:1px solid rgba(96,165,250,0.3);' +
            'border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.6);' +
            'backdrop-filter:blur(12px);z-index:9999;' +
            'font-family:var(--font-mono,monospace);display:none;opacity:1;animation:none !important;'
        );
        bar.innerHTML =
            '<span id="bulk-count-text" style="font-size:11px;font-weight:700;color:#60a5fa;white-space:nowrap;margin-right:4px"></span>' +
            '<button onclick="bulkCopyCards()" style="font-size:10px;padding:4px 10px;border:1px solid rgba(255,255,255,0.12);border-radius:4px;background:rgba(255,255,255,0.05);color:#c4c8d8;cursor:pointer;font-family:inherit">📋 Copy</button>' +
            '<button onclick="bulkDeleteCards()" style="font-size:10px;padding:4px 10px;border:1px solid rgba(239,68,68,0.25);border-radius:4px;background:rgba(239,68,68,0.06);color:#ef4444;cursor:pointer;font-family:inherit">🗑 Delete</button>' +
            '<button onclick="bulkSendToNotes()" style="font-size:10px;padding:4px 10px;border:1px solid rgba(245,158,11,0.25);border-radius:4px;background:rgba(245,158,11,0.06);color:#f59e0b;cursor:pointer;font-family:inherit">📝 Notes</button>' +
            '<button onclick="clearSelection()" style="font-size:12px;padding:2px 8px;border:none;background:none;color:#636780;cursor:pointer">✕</button>';
        document.body.appendChild(bar);
    }
    var count = _selectedCards.size;
    if (count > 0) {
        bar.setAttribute('style',
            bar.getAttribute('style').replace('display:none','display:flex')
        );
        document.getElementById('bulk-count-text').textContent = count + ' selected';
    } else {
        bar.setAttribute('style',
            bar.getAttribute('style').replace('display:flex','display:none')
        );
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
    const view = STATE.currentView;
    if (view === 'minic-bins') {
        const bins = (STATE.minicBins||[]).filter((b,i) => _selectedCards.has('mc-'+i));
        if (bins.length === 0) { toast('Nothing selected','warning'); return; }
        const text = bins.map(b => b.bin + (b.note ? ' — '+b.note : '')).join('\n');
        navigator.clipboard?.writeText(text);
        toast(`${bins.length} BINs copied`, 'success');
        clearSelection(); return;
    }
    if (view === 'global-docs' || view === 'docs') {
        const recs = (STATE.docRecords||[]).filter(r => _selectedCards.has(r.id));
        if (recs.length === 0) { toast('Nothing selected','warning'); return; }
        const text = recs.map(r => r.name+' '+r.surname+'\n'+r.address+'\n'+r.dob).join('\n\n');
        navigator.clipboard?.writeText(text);
        toast(`${recs.length} documents copied`, 'success');
        clearSelection(); return;
    }
    const cards = STATE.cards.filter(c => _selectedCards.has(c.id));
    if (cards.length === 0) return;
    const text = cards.map(c => formatCardForCopy(c)).join('\n\n');
    navigator.clipboard?.writeText(text);
    toast(`${cards.length} cards copied`, 'success');
    clearSelection();
}

function bulkDeleteCards() {
    const view = STATE.currentView;
    if (view === 'minic-bins') {
        const ids = [..._selectedCards];
        const indices = ids.map(id => parseInt(id.replace('mc-',''))).filter(i => !isNaN(i)).sort((a,b) => b-a);
        if (indices.length === 0) { toast('Nothing selected','warning'); return; }
        _bvShowConfirm('Delete ' + indices.length + ' BINs?', () => {
            indices.forEach(i => STATE.minicBins.splice(i, 1));
            save(); clearSelection(); renderMinicBins();
            toast(indices.length + ' BINs deleted', 'info');
        }); return;
    }
    if (view === 'global-docs' || view === 'docs') {
        const ids = [..._selectedCards];
        const recs = (STATE.docRecords||[]).filter(r => ids.includes(r.id));
        if (recs.length === 0) { toast('Nothing selected','warning'); return; }
        _bvShowConfirm('Delete ' + recs.length + ' documents?', () => {
            STATE.docRecords = (STATE.docRecords||[]).filter(r => !ids.includes(r.id));
            save(); clearSelection(); renderContent();
            toast(recs.length + ' documents deleted', 'info');
        }); return;
    }
    const ids = [..._selectedCards];
    const cards = STATE.cards.filter(c => ids.includes(c.id));
    if (cards.length === 0) return;
    ids.forEach(id => removeCardFromDocs(id));
    STATE.trash.push(...cards);
    STATE.cards = STATE.cards.filter(c => !ids.includes(c.id));
    save();
    clearSelection();
    renderAll();
    toast(`${cards.length} cards moved to trash`, 'info');
}


// ── Unified row click with Shift/Ctrl support ──
let _lastClickedId = null;
window._uniRowClick = function(event, id, section) {
    // Don't select if clicking buttons/inputs/labels
    if (event.target.closest('button, input, select, label, .bv-s, .dc-btn, .dc-copy-mini, .bv-ni')) return;
    
    const getAllIds = () => {
        if (section === 'docs') return (STATE.docRecords||[]).map(r => r.id);
        if (section === 'minic') return (STATE.minicBins||[]).map((b,i) => b.id || 'mc-'+i);
        return [];
    };
    
    if (event.shiftKey && _lastClickedId) {
        const ids = getAllIds();
        const startIdx = ids.indexOf(_lastClickedId);
        const endIdx = ids.indexOf(id);
        if (startIdx >= 0 && endIdx >= 0) {
            const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
            for (let i = from; i <= to; i++) _selectedCards.add(ids[i]);
        }
    } else if (event.ctrlKey || event.metaKey) {
        if (_selectedCards.has(id)) _selectedCards.delete(id);
        else _selectedCards.add(id);
    } else {
        _selectedCards.clear();
        _selectedCards.add(id);
    }
    _lastClickedId = id;
    
    // Update checkboxes + highlights
    document.querySelectorAll('.row-select-cb').forEach(cb => { cb.checked = _selectedCards.has(cb.dataset.cardId); });
    document.querySelectorAll('[data-id]').forEach(el => {
        if (el.dataset.id) el.classList.toggle('row-selected', _selectedCards.has(el.dataset.id));
        if (el.dataset.id) el.classList.toggle('dc-selected', _selectedCards.has(el.dataset.id));
    });
    updateBulkBar();
};

function bulkSendToNotes() {
    const view = STATE.currentView;
    let text = '';
    if (view === 'global-docs' || view === 'docs') {
        const recs = (STATE.docRecords||[]).filter(r => _selectedCards.has(r.id));
        text = recs.map(r => 'Name: '+r.name+'\nSurname: '+r.surname+'\nAddress: '+r.address+'\nDOB: '+r.dob).join('\n\n');
    } else if (view === 'minic-bins') {
        const bins = (STATE.minicBins||[]).filter((b,i) => _selectedCards.has(b.id||'mc-'+i));
        text = bins.map(b => b.bin + (b.note ? ' — '+b.note : '')).join('\n');
    } else {
        const cards = STATE.cards.filter(c => _selectedCards.has(c.id));
        text = cards.map(c => formatCardForCopy(c)).join('\n\n');
    }
    if (!text) { toast('Nothing selected','error'); return; }
    const newTab = {
        id: 'tab-' + Date.now(), title: 'Selection ' + new Date().toLocaleTimeString(),
        content: text.replace(/\n/g, '<br>'), pinned: false, tag: null,
        created: Date.now(), scrollPos: 0, exportSource: 'Selection'
    };
    STATE.notesTabs.unshift(newTab);
    STATE.notesActiveTab = newTab.id;
    save();
    clearSelection();
    toast('Sent to Notes','success');
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
    } else if (['all-cards', 'favorites', 'active-now', 'trash'].includes(STATE.currentView)) {
        const cards = getFilteredCards();
        const s = getCardStats(cards);
        // Support old stat-card layout
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
        // Support new compact cstat layout
        const cRow = bar.querySelector('.cstat-row');
        if (cRow) {
            const t = cRow.querySelector('.cstat-total');
            if (t) t.firstChild.textContent = s.total + ' ';
            const u = (cls, val) => { const el = cRow.querySelector(cls + ' b'); if (el) el.textContent = val; };
            u('.cstat-a', s.cardAdd); u('.cstat-r', s.runAds); u('.cstat-v', s.verified);
            u('.cstat-d', s.docReady); u('.cstat-w', s.waterBill); u('.cstat-m', s.minic);
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
            if (view === 'all-cards') {
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

    // Country auto-detected from BIN
    const countrySelect = document.getElementById('doc-list-country');
    countrySelect.value = 'auto';

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

const _addCardBtnEl = document.getElementById('add-card-btn');
if (_addCardBtnEl) _addCardBtnEl.addEventListener('click', () => {
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
                <input type="hidden" id="ac-only-country" value="auto">
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
        const country = 'auto'; // BIN auto-detects
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
        // Auto-detect country from BIN
        autoResolveCardCountry(card).then(() => renderAll());
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
    // Country selects removed — BIN auto-detects country
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
            country: 'auto',  // will be resolved from BIN lookup
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
        // Auto-detect country from BIN
        autoResolveCardCountry(card).then(() => renderAll());
    } else {
        // Smart list mode
        if (_listParsedCards.length === 0) {
            toast('No valid cards found in text', 'error');
            return;
        }
        const country = 'auto';  // will be resolved from BIN lookup
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
            // Auto-resolve countries for newly added cards
            autoResolveAllCountries();
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
    // Country is auto-detected from BIN, just store current value
    const editCountrySel = document.getElementById('edit-country');
    editCountrySel.value = card.country || 'auto';
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
                <button class="search-result-item" onclick="globalSearchNavigate('all-cards', '${c.country}', '${s}')">
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
    // Country filter removed — unified workspace
    STATE.currentView = view;
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
    const editor = document.getElementById('notes-editor');
    if (editor) STATE.notes = editor.innerHTML;
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
        promptsTabs: STATE.promptsTabs || [],
        promptsActiveTab: STATE.promptsActiveTab || '',
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
    // Prompts
    if (data.promptsTabs && Array.isArray(data.promptsTabs) && data.promptsTabs.length > 0) {
        data.promptsTabs.forEach(tab => {
            const newTab = {
                ...tab,
                id: 'ptab-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
            };
            STATE.promptsTabs.unshift(newTab);
        });
        STATE.promptsActiveTab = STATE.promptsTabs[0]?.id || '';
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





// ──── ADD COUNTRY (removed — BIN auto-detects) ────
// Country modal elements removed from HTML. No-op.


// ──── TRASH VIEW ────


// ──── DIRECT INITIALIZATION (no login) ────
// Phase 1: Immediately init state (needed by code that runs at parse time)
STATE.user = 'admin';
load();

// Phase 2: Defer navigation to window.onload — guarantees ALL external scripts
// (creditcard-gen.js, driverlicense-gen.js, bankstatement-gen.js, zip-processor.js)
// are fully parsed before we try to render via deep links.
// Without this, #checker/generator/creditcard shows a black screen because
// _renderCreditCardGenerator() doesn't exist yet when app.js parses.
window.addEventListener('load', function _initNavigation() {
    const { view: hashView, subMode, subType } = _parseHash();
    if (hashView === 'checker' && subMode) {
        _applyCheckerSubMode(subMode, subType);
    }
    navigate(hashView || 'all-cards');
    // Auto-resolve countries for any 'auto' cards
    autoResolveAllCountries();
});


// ──── KEYBOARD SHORTCUTS ────
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        modalOverlay.classList.add('hidden');
        editOverlay.classList.add('hidden');
        document.getElementById('context-menu').classList.add('hidden');
        backupOverlay.classList.add('hidden');
        pendingBackup = null;
        document.getElementById('checker-overlay').classList.add('hidden');
        document.getElementById('delete-project-overlay').classList.add('hidden');
        document.getElementById('global-search-results').classList.add('hidden');
        document.body.style.overflow = '';
    }
});

// ──── INIT (load already called in initApp above) ────

// ──── CROSS-TAB NOTES SYNC ────
// When another browser tab saves notes to localStorage, pick up the changes
// so tabs, renames, and content stay in sync across all open instances.
window.addEventListener('storage', (e) => {
    if (e.key !== 'ct_notes_tabs' && e.key !== 'activeNoteTab') return;

    try {
        if (e.key === 'ct_notes_tabs' && e.newValue) {
            const incomingTabs = JSON.parse(e.newValue);
            if (!Array.isArray(incomingTabs) || incomingTabs.length === 0) return;

            // If user is currently editing (notes-editor exists and has focus),
            // preserve the in-memory content of the active tab before overwriting
            const editor = document.getElementById('notes-editor');
            const activeId = STATE.notesActiveTab;
            let localEditContent = null;

            if (editor && document.activeElement === editor) {
                localEditContent = editor.innerHTML;
            }

            // Replace state with incoming tabs
            STATE.notesTabs = incomingTabs;

            // Restore local unsaved edits for the active tab if user was editing
            if (localEditContent !== null && activeId) {
                const myTab = STATE.notesTabs.find(t => t.id === activeId);
                if (myTab) {
                    myTab.content = localEditContent;
                }
            }

            // If the active tab no longer exists (was deleted in other tab), switch
            if (!STATE.notesTabs.find(t => t.id === STATE.notesActiveTab)) {
                STATE.notesActiveTab = STATE.notesTabs[0]?.id || '';
            }

            // Re-render if currently on Notes view
            if (STATE.currentView === 'notes') {
                renderNotes();
            }
        }

        if (e.key === 'activeNoteTab' && e.newValue) {
            // Only update the stored active tab reference, don't switch the view
            // (each browser tab can have its own active note tab)
        }
    } catch (err) {
        console.warn('Notes cross-tab sync error:', err);
    }
});

// ──── NOTES FUNCTIONS ────
function saveNotesAction() {
    const editor = document.getElementById('notes-editor');
    if (editor) STATE.notes = editor.innerHTML;
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
    const editor = document.getElementById('notes-editor');
    if (editor) editor.style.fontSize = STATE.notesFontSize + 'px';
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
    filters: { bins: '', country: '', bank: '', excludeBanks: '', minExpiry: '', activeTypes: [], activeNetworks: [], filterTypes: new Set(), filterClasses: new Set(), filterPaymentSystems: new Set() }
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
                    <label>BINs <span class="parser-filter-hint">(comma separated)</span>
                        <button class="pz-list-bins-btn" id="pz-list-bins-btn" type="button" title="Paste BIN list (one per line)">📋 LIST</button>
                        <span class="pz-bins-badge" id="pz-bins-badge" style="display:none"></span>
                    </label>
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
                <div class="parser-filter-group parser-filter-exclude-banks">
                    <label>Exclude Banks
                        <button class="pz-list-bins-btn" id="pz-exclude-banks-btn" type="button" title="Manage excluded banks list">🚫 LIST</button>
                        <span class="pz-bins-badge pz-exclude-badge" id="pz-exclude-badge" style="display:none"></span>
                    </label>
                    <input type="text" id="parser-exclude-banks" placeholder="Royal, ADCB, Toronto..." value="${PARSER_STATE.filters.excludeBanks || ''}">
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
                        ${['VISA','MASTERCARD','AMEX','DISCOVER','UNIONPAY','JCB'].map(t =>
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
            <button class="pz-btn pz-btn-primary" id="parser-parse-btn" ${hasBase ? '' : 'disabled'} title="Extract cards from loaded file, apply filters, remove trash/workspace/duplicates">
                ⚡ PARSE &amp; CLEAN
                <span class="pz-btn-hint">extract → filter → dedupe</span>
            </button>
            <button class="pz-btn pz-btn-dim" id="parser-clear-btn" title="Clear all loaded files and results">✕ CLEAR</button>
            <button class="pz-btn pz-btn-trash" id="parser-trash-btn" title="Manage dead/invalid card blacklist">🗑 TRASH (${(STATE.trashCards || []).length})</button>
            <button class="pz-btn pz-btn-valid" id="parser-valid-btn" title="View cards verified as ALIVE by checker">✅ VALID CARDS</button>
            <button class="pz-btn pz-btn-today" id="parser-today-btn" title="Show cards from today's messages">📅 TODAY CARDS</button>
            <button class="pz-btn pz-btn-subtract" id="parser-subtract-btn" title="Subtract a JSON base from your card list — removes already known cards">⊖ BASE SUBTRACT</button>
            <span class="parser-status" id="parser-status"></span>
        </div>

        <!-- STATS BAR (shown after parse) -->
        <div class="parser-stats-bar" id="parser-stats-bar" style="${hasParsed ? '' : 'display:none'}">
            <span class="ps-item">Parsed: <strong id="ps-total">0</strong></span>
            <span class="ps-item ps-trash">Trash: <strong id="ps-trash">0</strong></span>
            <span class="ps-item ps-compare">Old Base: <strong id="ps-compared">0</strong></span>
            <span class="ps-item ps-workspace">Workspace: <strong id="ps-workspace">0</strong></span>
            <span class="ps-item ps-dup">Dupes: <strong id="ps-dupes">0</strong></span>
            <span class="ps-item ps-exclude" id="ps-exclude-wrap" style="display:none">🚫Banks: <strong id="ps-exclude">0</strong></span>
            <span class="ps-item ps-net">→ Clean: <strong id="ps-net">0</strong></span>
            <span class="ps-item ps-test" id="ps-test-mode" style="display:none">🧪 Test: <strong id="ps-test-cards">0</strong> cards (<strong id="ps-test-bins">0</strong> BINs)</span>
        </div>

        <!-- STAGE 2: COMPARE — всегда видим, загрузка старой базы до парсинга -->
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
        </div>



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

    // ── LIST BINS popup ──
    document.getElementById('pz-list-bins-btn')?.addEventListener('click', () => {
        _openBinListPopup();
    });
    // Update BIN badge on load
    _updateBinsBadge();

    // ── EXCLUDE BANKS popup ──
    document.getElementById('pz-exclude-banks-btn')?.addEventListener('click', () => {
        _openExcludeBanksPopup();
    });
    document.getElementById('parser-exclude-banks')?.addEventListener('input', () => {
        _updateExcludeBadge();
        _saveParserFilters();
    });
    _updateExcludeBadge();

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
    _initBaseSubtractModal();

    // Base subtract button
    document.getElementById('parser-subtract-btn')?.addEventListener('click', () => {
        const overlay = document.getElementById('base-subtract-overlay');
        if (overlay) overlay.classList.remove('hidden');
    });

    // (translated)
    if (VALID_STATE.cards.length > 0) {
        renderValidCardsResults();
    } else if (hasParsed) {
        renderParserResults();
    }
}
// ──── LIST BINS — popup для вставки BIN списком (столбиком) ────

/** Обновляет бейдж кол-ва BIN рядом с кнопкой LIST */
function _updateBinsBadge() {
    const badge = document.getElementById('pz-bins-badge');
    const binsEl = document.getElementById('parser-bins');
    if (!badge || !binsEl) return;
    const bins = binsEl.value.trim()
        .split(/[\s,;|]+/)
        .map(b => b.replace(/\D/g, '').slice(0, 6))
        .filter(b => b.length >= 4);
    if (bins.length > 0) {
        badge.textContent = bins.length;
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

/** Открывает popup для вставки BIN столбиком */
function _openBinListPopup() {
    // Если уже открыт — закрыть
    const existing = document.getElementById('pz-bin-list-overlay');
    if (existing) { existing.remove(); return; }

    // Прочитать текущие BINs из поля и показать столбиком
    const binsEl = document.getElementById('parser-bins');
    const currentBins = binsEl ? binsEl.value.trim()
        .split(/[\s,;|]+/)
        .map(b => b.replace(/\D/g, '').slice(0, 6))
        .filter(b => b.length >= 4) : [];

    const overlay = document.createElement('div');
    overlay.id = 'pz-bin-list-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal" style="width:420px;max-width:90vw">
            <div class="modal-header">
                <div>
                    <h3>📋 LIST BINS</h3>
                    <p class="modal-subtitle">Вставь список BIN — каждый на новой строке</p>
                </div>
                <button class="modal-close" id="pz-bl-close">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <textarea id="pz-bl-textarea" class="list-textarea" rows="14"
                    placeholder="Вставь BIN-ы столбиком:&#10;&#10;450003&#10;424242&#10;532610&#10;471539&#10;...&#10;&#10;Поддерживает 4-6 цифр">${currentBins.join('\n')}</textarea>
                <div class="list-info" style="display:flex;align-items:center;gap:10px;margin-top:8px">
                    <span id="pz-bl-count" class="list-count-badge">${currentBins.length} BINs</span>
                    <span style="font-size:11px;color:var(--text-muted)">Дубликаты удаляются автоматически</span>
                </div>
            </div>
            <div class="modal-footer" style="display:flex;gap:8px">
                <button class="btn-cancel" id="pz-bl-cancel">Cancel</button>
                <button class="pz-btn pz-btn-dim" id="pz-bl-clear" style="font-size:11px;padding:5px 12px">🗑 CLEAR ALL</button>
                <span style="flex:1"></span>
                <button class="pz-btn pz-btn-primary" id="pz-bl-apply">✅ APPLY</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    const ta = document.getElementById('pz-bl-textarea');
    const countEl = document.getElementById('pz-bl-count');

    // Счётчик при вводе
    const updateCount = () => {
        const bins = ta.value.trim().split(/[\s,;|]+/)
            .map(b => b.replace(/\D/g, '').slice(0, 6))
            .filter(b => b.length >= 4);
        const unique = [...new Set(bins)];
        countEl.textContent = `${unique.length} BINs`;
    };
    ta.addEventListener('input', updateCount);

    // Закрытие
    const close = () => overlay.remove();
    document.getElementById('pz-bl-close').addEventListener('click', close);
    document.getElementById('pz-bl-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // CLEAR ALL
    document.getElementById('pz-bl-clear').addEventListener('click', () => {
        ta.value = '';
        updateCount();
        // Также очистить основное поле
        if (binsEl) binsEl.value = '';
        _updateBinsBadge();
        _saveParserFilters();
        toast('BIN list cleared', 'info');
    });

    // APPLY
    document.getElementById('pz-bl-apply').addEventListener('click', () => {
        const bins = ta.value.trim().split(/[\s,;|]+/)
            .map(b => b.replace(/\D/g, '').slice(0, 6))
            .filter(b => b.length >= 4);
        const unique = [...new Set(bins)];

        if (binsEl) {
            binsEl.value = unique.join(', ');
        }
        _updateBinsBadge();
        _saveParserFilters();
        close();
        toast(`${unique.length} BINs loaded into filter`, 'success');
    });

    // Фокус на textarea
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
}

// ──── EXCLUDE BANKS BADGE ────
function _updateExcludeBadge() {
    const badge = document.getElementById('pz-exclude-badge');
    if (!badge) return;
    const el = document.getElementById('parser-exclude-banks');
    const val = el ? el.value.trim() : '';
    const count = val ? val.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).length : 0;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

// ──── EXCLUDE BANKS POPUP ────
function _openExcludeBanksPopup() {
    // Если уже открыт — закрыть
    const existing = document.getElementById('pz-exclude-banks-overlay');
    if (existing) { existing.remove(); return; }

    // Прочитать текущий список
    const excludeEl = document.getElementById('parser-exclude-banks');
    const currentBanks = excludeEl ? excludeEl.value.trim()
        .split(/[,;\n]+/)
        .map(b => b.trim())
        .filter(Boolean) : [];

    const overlay = document.createElement('div');
    overlay.id = 'pz-exclude-banks-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal" style="width:460px;max-width:90vw">
            <div class="modal-header">
                <div>
                    <h3>🚫 EXCLUDE BANKS</h3>
                    <p class="modal-subtitle">Банки из этого списка будут исключены из парсинга (частичное совпадение)</p>
                </div>
                <button class="modal-close" id="pz-eb-close">
                    <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
                </button>
            </div>
            <div class="modal-body">
                <textarea id="pz-eb-textarea" class="list-textarea" rows="14"
                    placeholder="Введи названия банков — каждый на новой строке:&#10;&#10;Royal Bank&#10;ADCB&#10;Toronto-Dominion&#10;National Bank&#10;...&#10;&#10;Частичное совпадение: 'Royal' исключит все банки с 'Royal' в названии">${currentBanks.join('\n')}</textarea>
                <div class="list-info" style="display:flex;align-items:center;gap:10px;margin-top:8px">
                    <span id="pz-eb-count" class="list-count-badge" style="background:var(--danger,#e74c3c);color:#fff">${currentBanks.length} banks</span>
                    <span style="font-size:11px;color:var(--text-muted)">Дубликаты удаляются автоматически</span>
                </div>
            </div>
            <div class="modal-footer" style="display:flex;gap:8px">
                <button class="btn-cancel" id="pz-eb-cancel">Cancel</button>
                <button class="pz-btn pz-btn-dim" id="pz-eb-clear" style="font-size:11px;padding:5px 12px">🗑 CLEAR ALL</button>
                <span style="flex:1"></span>
                <button class="pz-btn pz-btn-primary" id="pz-eb-apply">✅ APPLY</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    const ta = document.getElementById('pz-eb-textarea');
    const countEl = document.getElementById('pz-eb-count');

    // Счётчик при вводе
    const updateCount = () => {
        const banks = ta.value.trim().split(/[\n]+/)
            .map(b => b.trim())
            .filter(Boolean);
        const unique = [...new Set(banks.map(b => b.toLowerCase()))];
        countEl.textContent = `${unique.length} banks`;
    };
    ta.addEventListener('input', updateCount);

    // Закрытие
    const close = () => overlay.remove();
    document.getElementById('pz-eb-close').addEventListener('click', close);
    document.getElementById('pz-eb-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // CLEAR ALL
    document.getElementById('pz-eb-clear').addEventListener('click', () => {
        ta.value = '';
        updateCount();
        if (excludeEl) excludeEl.value = '';
        _updateExcludeBadge();
        _saveParserFilters();
        toast('Exclude banks list cleared', 'info');
    });

    // APPLY
    document.getElementById('pz-eb-apply').addEventListener('click', () => {
        const banks = ta.value.trim().split(/[\n]+/)
            .map(b => b.trim())
            .filter(Boolean);
        const unique = [...new Set(banks)];

        if (excludeEl) {
            excludeEl.value = unique.join(', ');
        }
        _updateExcludeBadge();
        _saveParserFilters();
        close();
        toast(`${unique.length} banks added to exclude list`, 'success');
    });

    // Фокус на textarea
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
}

// ──── BIN DATABASE HELPERS ────
function _loadBinDb() {
    try {
        const raw = localStorage.getItem('ct_bin_database');
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function _saveBinDb(db) {
    localStorage.setItem('ct_bin_database', JSON.stringify(db));
}

function _updateBinDbBadge() {
    const badge = document.getElementById('pz-bindb-badge');
    if (!badge) return;
    const db = _loadBinDb();
    const totalBins = Object.values(db).reduce((s, arr) => s + _getBinsFromEntry(arr).length, 0);
    if (totalBins > 0) {
        badge.textContent = totalBins;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

// Test/fake card BINs to skip
const _TEST_BINS = new Set(['424242','411111','400000','555555','510510','378282','371449','601111','300569','305693','361234','543210','123456','000000','999999']);
function _isTestBin(bin) {
    if (_TEST_BINS.has(bin)) return true;
    // All same digits (111111, 222222, etc)
    if (/^(\d)\1{5}$/.test(bin)) return true;
    return false;
}

// Find bank name for BIN from existing DB
function _findBankInDb(db, bin) {
    for (const [bank, data] of Object.entries(db)) {
        if (Array.isArray(data)) {
            for (const item of data) {
                const b = typeof item === 'string' ? item : (item.bin || '');
                if (b === bin) return bank;
            }
        }
    }
    return null;
}

// Add BIN to DB under a bank name, with optional country
function _addBinToDb(db, bank, bin, country) {
    if (!bank || !bin) return false;
    if (!db[bank]) db[bank] = [];
    // Check if already exists
    const exists = db[bank].some(item => {
        const b = typeof item === 'string' ? item : (item.bin || '');
        return b === bin;
    });
    if (exists) return false;
    db[bank].push(country ? { bin, country } : bin);
    return true;
}

// Get flat list of BINs from a bank entry (handles mixed string/object format)
function _getBinsFromEntry(data) {
    if (!Array.isArray(data)) return [];
    return data.map(item => typeof item === 'string' ? item : (item.bin || ''));
}

async function _binDbLoadFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const messages = Array.isArray(data) ? data : (data.messages || []);
            if (messages.length === 0) { toast(`${file.name}: no messages found`, 'warning'); return; }

            const db = _loadBinDb();
            let added = 0, dupes = 0, skipped = 0, resolved = 0;

            // Extract cards using existing parser
            const cards = extractCardsFromMessages(messages);
            
            // Collect unknown BINs for batch lookup
            const unknownBins = [];

            for (const c of cards) {
                const bin = (c.bin || (c.cc || '').substring(0, 6));
                if (!bin || bin.length < 4) continue;
                
                // Skip test cards
                if (_isTestBin(bin)) { skipped++; continue; }

                let bank = c.bank || '';
                const country = c.bankCountryCode || c.countryCode || '';
                const isUnknown = !bank || /^unknown/i.test(bank);

                if (isUnknown) {
                    // Try to find in existing DB first
                    const existingBank = _findBankInDb(db, bin);
                    if (existingBank) {
                        bank = existingBank;
                        resolved++;
                    } else {
                        // Try BIN_CACHE
                        const cached = BIN_CACHE[bin];
                        if (cached && cached.bank && !cached.error) {
                            bank = cached.bank;
                            resolved++;
                        } else {
                            unknownBins.push({ bin, country, card: c });
                            continue; // will process after API lookups
                        }
                    }
                }

                if (bank && !(/^unknown/i.test(bank))) {
                    if (_addBinToDb(db, bank, bin, country)) { added++; }
                    else { dupes++; }
                }
            }

            // Batch lookup unknown BINs via API (max 20 at a time to avoid overload)
            const uniqueUnknown = [...new Map(unknownBins.map(u => [u.bin, u])).values()];
            const lookupBatch = uniqueUnknown.slice(0, 30);
            
            if (lookupBatch.length > 0) {
                toast(`Looking up ${lookupBatch.length} unknown BINs...`, 'info');
                for (const u of lookupBatch) {
                    try {
                        const info = await lookupBin(u.bin);
                        if (info && info.bank && !info.error) {
                            const ctry = info.country || u.country || '';
                            if (_addBinToDb(db, info.bank, u.bin, ctry)) { added++; resolved++; }
                            else { dupes++; }
                        }
                    } catch { /* skip failed lookups */ }
                }
            }

            _saveBinDb(db);
            _renderBinDb();
            _updateBinDbBadge();
            let msg = `${file.name}: +${added} BINs`;
            if (dupes > 0) msg += `, ${dupes} dupes`;
            if (resolved > 0) msg += `, ${resolved} resolved`;
            if (skipped > 0) msg += `, ${skipped} test skipped`;
            msg += ` (${cards.length} cards scanned)`;
            toast(msg, 'success');
        } catch (err) {
            toast(`${file.name}: error — ${err.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

function _renderBinDb() {
    const container = document.getElementById('pz-bindb-table');
    const statsEl = document.getElementById('pz-bindb-stats');
    if (!container) return;

    const db = _loadBinDb();
    const banks = Object.entries(db).sort((a, b) => _getBinsFromEntry(b[1]).length - _getBinsFromEntry(a[1]).length);
    const totalBins = banks.reduce((s, [, arr]) => s + _getBinsFromEntry(arr).length, 0);

    if (statsEl) {
        statsEl.textContent = totalBins > 0
            ? `${totalBins} BINs · ${banks.length} banks`
            : 'Empty — load JSON files or use FROM PARSED';
    }

    if (banks.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px;font-size:12px">No BINs collected yet</div>';
        return;
    }

    let html = '<table style="width:100%;border-collapse:collapse;font-size:11px">';
    html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.1)"><th style="text-align:left;padding:4px 8px;color:var(--text-muted)">Bank</th><th style="text-align:center;padding:4px 8px;color:var(--text-muted);width:40px">🌍</th><th style="text-align:center;padding:4px 8px;color:var(--text-muted);width:50px">BINs</th><th style="text-align:left;padding:4px 8px;color:var(--text-muted)">BIN List</th><th style="width:30px"></th></tr></thead>';
    html += '<tbody>';

    banks.forEach(([bank, data]) => {
        const binList = _getBinsFromEntry(data);
        const binsStr = binList.sort().join(', ');
        // Try to get country from first entry with country
        let country = '';
        if (Array.isArray(data)) {
            for (const item of data) {
                if (typeof item === 'object' && item.country) { country = item.country; break; }
            }
        }
        const safeBank = bank.replace(/"/g, '&quot;');
        html += `<tr style="border-bottom:1px solid rgba(255,255,255,.04)">`;
        html += `<td style="padding:5px 8px;color:#e2e8f0;font-weight:600;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${safeBank}">${bank}</td>`;
        html += `<td style="padding:5px 8px;text-align:center;font-size:10px;color:var(--text-dim)">${country || '-'}</td>`;
        html += `<td style="padding:5px 8px;text-align:center"><span style="background:rgba(34,197,94,.15);color:#22c55e;padding:1px 6px;border-radius:8px;font-weight:700;font-size:10px">${binList.length}</span></td>`;
        html += `<td style="padding:5px 8px;color:var(--text-muted);font-family:var(--ff-mono);font-size:10px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${binsStr}">${binsStr}</td>`;
        html += `<td style="padding:5px 4px"><button class="bindb-del" data-bank="${safeBank}" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:12px;padding:2px" title="Delete bank">✕</button></td>`;
        html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;

    // Delete bank buttons
    container.querySelectorAll('.bindb-del').forEach(btn => {
        btn.addEventListener('click', () => {
            const bank = btn.dataset.bank;
            const db = _loadBinDb();
            delete db[bank];
            _saveBinDb(db);
            _renderBinDb();
            _updateBinDbBadge();
            toast(`Removed "${bank}" from BIN database`, 'info');
        });
    });
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
                    const existingSet = new Set((STATE.trashCards || []).map(n => n.replace(/[\s\-]/g, '')));
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

        const existingSet = new Set((STATE.trashCards || []).map(n => n.replace(/[\s\-]/g, '')));
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
            scrollPos: 0,
            exportSource: 'Trash',
            exportedAt: new Date().toISOString()
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
            scrollPos: 0,
            exportSource: 'Trash Check',
            exportedAt: new Date().toISOString()
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

// ═══════════════════════════════════════════════════════════════════
// BASE SUBTRACT — вычитание одной базы из другой
// ═══════════════════════════════════════════════════════════════════

let _bsBaseSet = null; // Set<string> — нормализованные номера из JSON-файла
let _bsBaseFileName = '';
let _bsBaseCardCount = 0;

function _initBaseSubtractModal() {
    const overlay = document.getElementById('base-subtract-overlay');
    if (!overlay) return;

    const closeBtn    = overlay.querySelector('.bs-close');
    const dropZone    = document.getElementById('bs-drop-zone');
    const fileInput   = document.getElementById('bs-file-input');
    const baseInfo    = document.getElementById('bs-base-info');
    const textarea    = document.getElementById('bs-textarea');
    const extractBtn  = document.getElementById('bs-extract-btn');
    const clearBtn    = document.getElementById('bs-clear-btn');
    const statsEl     = document.getElementById('bs-stats');
    const resultBox   = document.getElementById('bs-result-box');
    const resultArea  = document.getElementById('bs-result-area');
    const copyBtn     = document.getElementById('bs-copy-btn');

    const closeModal = () => overlay.classList.add('hidden');
    closeBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    // ── Drag & Drop / Click for JSON base ──
    dropZone?.addEventListener('click', () => fileInput?.click());
    dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('bs-drag-over'); });
    dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('bs-drag-over'));
    dropZone?.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('bs-drag-over');
        const file = e.dataTransfer.files[0];
        if (file) _bsLoadFile(file, baseInfo, dropZone);
    });
    fileInput?.addEventListener('change', () => {
        if (fileInput.files[0]) _bsLoadFile(fileInput.files[0], baseInfo, dropZone);
    });

    // ── Extract & Subtract ──
    extractBtn?.addEventListener('click', () => {
        const raw = textarea?.value || '';
        if (!raw.trim()) { toast('Paste your card list first', 'warning'); return; }
        if (!_bsBaseSet || _bsBaseSet.size === 0) { toast('Load a JSON base file first', 'warning'); return; }

        // Extract all card numbers from pasted text
        const lines = raw.split(/\r?\n/);
        const extracted = []; // {line, cc}
        const seen = new Set();

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            // Try pipe format first, then standalone number
            const m = trimmed.match(/(\d{13,19})/);
            if (!m) return;
            const cc = m[1];
            if (seen.has(cc)) return;
            seen.add(cc);
            extracted.push({ line: trimmed, cc });
        });

        if (extracted.length === 0) { toast('No card numbers found in pasted text', 'error'); return; }

        // Subtract base
        const clean   = extracted.filter(c => !_bsBaseSet.has(c.cc));
        const removed = extracted.filter(c =>  _bsBaseSet.has(c.cc));

        // Show stats
        if (statsEl) {
            statsEl.style.display = 'flex';
            statsEl.innerHTML = `
                <div class="bs-stat"><span class="bs-stat-val">${extracted.length}</span><span class="bs-stat-lbl">Total input</span></div>
                <div class="bs-stat bs-stat-removed"><span class="bs-stat-val">${removed.length}</span><span class="bs-stat-lbl">Removed (in base)</span></div>
                <div class="bs-stat bs-stat-clean"><span class="bs-stat-val">${clean.length}</span><span class="bs-stat-lbl">Clean result</span></div>
            `;
        }

        // Show result
        const resultText = clean.map(c => c.line).join('\n');
        if (resultArea) resultArea.value = resultText;
        if (resultBox)  resultBox.style.display = 'block';
        if (copyBtn)    copyBtn.dataset.text = resultText;

        toast(`Done: ${removed.length} removed, ${clean.length} clean cards left`, removed.length > 0 ? 'success' : 'info');
    });

    // ── Copy result ──
    copyBtn?.addEventListener('click', () => {
        const text = resultArea?.value || '';
        if (!text) { toast('Nothing to copy', 'info'); return; }
        navigator.clipboard?.writeText(text).then(() => toast(`Copied ${text.split('\n').filter(Boolean).length} cards`, 'success'));
    });

    // ── Clear ──
    clearBtn?.addEventListener('click', () => {
        _bsBaseSet = null;
        _bsBaseFileName = '';
        _bsBaseCardCount = 0;
        if (textarea)  textarea.value = '';
        if (resultArea) resultArea.value = '';
        if (statsEl)   { statsEl.style.display = 'none'; statsEl.innerHTML = ''; }
        if (resultBox) resultBox.style.display = 'none';
        if (baseInfo)  { baseInfo.textContent = 'No base loaded'; baseInfo.className = 'bs-base-info'; }
        if (dropZone)  dropZone.querySelector('.bs-drop-text') && (dropZone.querySelector('.bs-drop-text').textContent = 'Drop JSON base or click');
        toast('Cleared', 'info');
    });
}

function _bsLoadFile(file, baseInfoEl, dropZone) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            const numbers = extractAllCardNumbersFromJSON(data);
            _bsBaseSet = numbers;
            _bsBaseFileName = file.name;
            _bsBaseCardCount = numbers.size;

            if (baseInfoEl) {
                baseInfoEl.textContent = `✅ ${file.name} — ${numbers.size.toLocaleString()} card numbers loaded`;
                baseInfoEl.className = 'bs-base-info bs-base-info-ok';
            }
            const dropText = dropZone?.querySelector('.bs-drop-text');
            if (dropText) dropText.textContent = `✅ ${file.name}`;
            toast(`Base loaded: ${numbers.size.toLocaleString()} card numbers`, 'success');
        } catch (err) {
            if (baseInfoEl) { baseInfoEl.textContent = '❌ Invalid JSON file'; baseInfoEl.className = 'bs-base-info bs-base-info-err'; }
            toast('Invalid JSON file', 'error');
        }
    };
    reader.readAsText(file);
}


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
        if (/(?:\u2705|ALIVE|Approved|APPROVED)/iu.test(line)) return 'alive';
        if (/(?:\u{1F480}|DEAD|Declined|DECLINED)/iu.test(line)) return 'dead';
        if (/(?:\u274C|INVALID|Invalid)/iu.test(line)) return 'invalid';
        // ⛔ format from Russian checker (Результаты проверки)
        if (/\u26D4/u.test(line)) return 'dead';
        // Lines with only CARD | and trash text but no emoji
        if (/TRAN NOT ALLOWED|INV ACCT NUM|DO NOT TRY AGAIN|CANCELLED|NOT ALLOWED|NOPERMISSION|Card Issuer Declined/i.test(line)) return 'dead';
        return null;
    }

    // (translated)
    // (translated)
    const cardIndices = [];
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t) continue;
        const cc = extractCC(t);
        if (!cc) continue;
        let status = getStatus(t);
        // Look-ahead for results format: CARD | (status on next line)
        if (status === null && /\d{13,19}\s*\|/.test(t)) {
            for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
                const nextLine = lines[j].trim();
                if (!nextLine) continue;
                if (/^\d{13,19}/.test(nextLine)) break; // next card, stop
                const nextStatus = getStatus(nextLine);
                if (nextStatus !== null) {
                    // Temporarily inject the status marker into the line for later processing
                    lines[i] = t + ' ' + nextLine;
                    status = nextStatus;
                    break;
                }
            }
        }
        if (status !== null) {
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
    'NOT HONOR','INSUFFICIENT_FUNDS',
    // Russian checker bot keywords
    'TRAN NOT ALLOWED','INV ACCT NUM','CANCELLED','NOT ALLOWED',
    'NOPERMISSION','CARD ISSUER DECLINED CVV','TRANSACTION NOT ALLOWED'
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
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0).slice(0, 300);
    let classic = 0, pipe = 0, block = 0, results = 0;
    for (const l of lines) {
        if (/^[\u2705\u{1F480}\u274C]/u.test(l) && /\b(ALIVE|DEAD|INVALID)\b/i.test(l)) classic++;
        if (/^\d{13,19}\s*\|/.test(l)) pipe++;
        if (/\u{1F7E9}{2,}|\u{1F7E5}{2,}/u.test(l)) block++;
        // "Результаты проверки" format: CARD | Approved ✅ or CARD | ⛔ or header line
        if (/^\d{13,19}\s*\|.*[\u2705\u26D4]/u.test(l) || /^Результаты\s+проверки/i.test(l)) results++;
        // Also detect CARD | error_text (no emoji but known trash keywords on same line)
        if (/^\d{13,19}\s*\|.*(?:TRAN NOT ALLOWED|INV ACCT NUM|Cancelled|DO NOT TRY|Card Issuer|NOT ALLOWED)/i.test(l)) results++;
    }
    // results + pipe overlap: results is more specific, always include it
    if (results > 0 && classic === 0 && block === 0) return 'results';
    const found = [classic > 0 && 'classic', pipe > 0 && !results && 'pipe', block > 0 && 'block', results > 0 && 'results'].filter(Boolean);
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
 * Parse "Результаты проверки" format from Russian checker bot.
 * Handles single-line and multi-line patterns:
 *   CARD | Approved ✅         → valid
 *   CARD | TRAN NOT ALLOWED ⛔ → trash
 *   CARD | ⛔                  → trash
 *   CARD |                      → look at next line for ⛔/✅
 */
function _parseResultsFormat(text) {
    const results = [];
    const lines = text.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Skip header
        if (/^Результаты\s+проверки/i.test(line)) continue;

        // Match: CARD_NUMBER | ...
        const m = line.match(/^(\d{13,19})\s*\|\s*(.*)/);
        if (!m) continue;

        const cc = m[1];
        let statusPart = m[2].trim();

        // If statusPart is empty or has no emoji, check next line(s)
        if (!statusPart || (!/[\u2705\u26D4]/u.test(statusPart) && !_lineIsTrash(statusPart))) {
            for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
                const nextLine = lines[j].trim();
                if (!nextLine) continue;
                // If next line starts with a card number → new entry, stop
                if (/^\d{13,19}/.test(nextLine)) break;
                // If next line has status indicators, use it
                if (/[\u2705\u26D4]/u.test(nextLine) || _lineIsTrash(nextLine)) {
                    statusPart = nextLine;
                    break;
                }
            }
        }

        // Determine status: ✅ or Approved = valid, everything else = trash
        if (/\u2705/u.test(statusPart) || /\bapproved\b/i.test(statusPart)) {
            results.push({ cc, status: 'valid' });
        } else {
            results.push({ cc, status: 'trash' });
        }
    }

    return results;
}

/**
 * Multi-format parser — detects and runs all matching format parsers
 */
function _parseMultiFormat(text) {
    const format = _detectCheckerFormat(text);
    let all = [];
    if (format === 'classic' || format === 'mixed' || format === 'unknown') all = all.concat(_parseClassicFormat(text));
    if (format === 'pipe'    || format === 'mixed') all = all.concat(_parsePipeFormat(text));
    if (format === 'block'   || format === 'mixed') all = all.concat(_parseBlockFormat(text));
    if (format === 'results' || format === 'mixed') all = all.concat(_parseResultsFormat(text));

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
            <button class="pz-btn pz-btn-dim vc-export-btn" id="vc-export-minic" style="color:#22c55e;border-color:rgba(34,197,94,.25)">🚀 EXPORT TO MINIC</button>
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
            created: Date.now(), scrollPos: 0,
            exportSource: 'Valid Cards',
            exportedAt: new Date().toISOString()
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

    // EXPORT TO MINIC
    document.getElementById('vc-export-minic')?.addEventListener('click', () => {
        const cards = displayCards;
        if (cards.length === 0) { toast('No cards to export', 'warning'); return; }
        const binSet = new Set();
        cards.forEach(c => {
            const bin = (c.bin || (c.cc || '').substring(0, 6));
            if (bin && bin.length >= 6) binSet.add(bin.substring(0, 6));
        });
        if (binSet.size === 0) { toast('No BINs found', 'warning'); return; }
        const tabId = 'mctab_' + Date.now();
        const selCodes = selectedCountries.size > 0 ? [...selectedCountries].join(', ') : 'ALL';
        const tabName = 'Parse ' + selCodes + ' ' + todayStr();
        if (!STATE.minicTabs) STATE.minicTabs = [{id:'main',name:'Main'}];
        STATE.minicTabs.push({ id: tabId, name: tabName });
        const existing = new Set((STATE.minicBins || []).map(b => b.bin + '|' + (b.tab || 'main')));
        let added = 0;
        binSet.forEach(bin => {
            const key = bin + '|' + tabId;
            if (existing.has(key)) return;
            STATE.minicBins.push({ bin, tag: null, amount: '', note: '', date: todayStr(), tab: tabId });
            existing.add(key); added++;
        });
        STATE.minicActiveTab = tabId;
        save();
        toast(added + ' BINs \u2192 "' + tabName + '"', 'success');
        binSet.forEach(bin => { if (!BIN_CACHE[bin]) lookupBin(bin).catch(() => {}); });
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
    const excludeBanksElSave = document.getElementById('parser-exclude-banks');
    PARSER_STATE.filters = { bins: binRaw, country: countryEl ? countryEl.value.trim() : '', bank: bankEl ? bankEl.value.trim() : '', excludeBanks: excludeBanksElSave ? excludeBanksElSave.value.trim() : '', minExpiry: minExpRaw, activeTypes, activeNetworks, filterTypes, filterClasses, filterPaymentSystems };

    let allCards = extractCardsFromMessages(PARSER_STATE.rawMessages);
    allCards = allCards.map(c => ({ ...c, detectedGeo: detectGeo(c.billing, c.country, c.countryCode, c.bankCountryCode) }));

    // ── BIN-based bank auto-fill ──
    // Build BIN → bank map from cards that DO have bank names
    const binBankMap = {};
    allCards.forEach(c => {
        const bin = c.bin || (c.cc || '').substring(0, 6);
        const bank = c.bank || '';
        if (bin && bank && !/^unknown/i.test(bank)) {
            if (!binBankMap[bin]) binBankMap[bin] = {};
            binBankMap[bin][bank] = (binBankMap[bin][bank] || 0) + 1;
        }
    });
    // For each BIN, pick the most frequent bank name
    const binBestBank = {};
    for (const [bin, banks] of Object.entries(binBankMap)) {
        let best = '', bestCount = 0;
        for (const [bank, count] of Object.entries(banks)) {
            if (count > bestCount) { best = bank; bestCount = count; }
        }
        if (best) binBestBank[bin] = best;
    }
    // Fill in missing banks + enrich from BIN_CACHE and BIN Database
    const binDb = typeof _loadBinDb === 'function' ? _loadBinDb() : {};
    allCards = allCards.map(c => {
        const bin = c.bin || (c.cc || '').substring(0, 6);
        let bank = c.bank || '';
        let cardType = c.cardType || '';
        const isUnknown = !bank || /^unknown/i.test(bank);
        if (isUnknown && bin) {
            // Priority 1: other cards in same parse batch
            if (binBestBank[bin]) { bank = binBestBank[bin]; }
            // Priority 2: BIN_CACHE (from API lookups)
            else if (BIN_CACHE[bin] && BIN_CACHE[bin].bank && !BIN_CACHE[bin].error) { bank = BIN_CACHE[bin].bank; }
            // Priority 3: BIN Database (localStorage)
            else {
                const dbBank = typeof _findBankInDb === 'function' ? _findBankInDb(binDb, bin) : null;
                if (dbBank) bank = dbBank;
            }
        }
        // Enrich cardType from BIN_CACHE if missing
        if (!cardType && BIN_CACHE[bin]) {
            const cached = BIN_CACHE[bin];
            const parts = [];
            if (cached.level) parts.push(cached.level);
            if (cached.type) parts.push(cached.type);
            if (cached.brand) parts.push(cached.brand);
            if (parts.length > 0) cardType = parts.join(' ');
        }
        return bank !== c.bank || cardType !== c.cardType ? { ...c, bank, cardType } : c;
    });

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
    // Exclude banks filter
    const excludeBanksEl = document.getElementById('parser-exclude-banks');
    const excludeBanksRaw = excludeBanksEl ? excludeBanksEl.value.trim() : '';
    let excludeBanksRemoved = 0;
    if (excludeBanksRaw) {
        const excludeList = excludeBanksRaw.split(/[,;\n]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        if (excludeList.length > 0) {
            const beforeExclude = allCards.length;
            allCards = allCards.filter(c => {
                const bankName = (c.bank || '').toLowerCase();
                if (!bankName) return true; // keep cards without bank info
                return !excludeList.some(ex => bankName.includes(ex));
            });
            excludeBanksRemoved = beforeExclude - allCards.length;
        }
    }

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

    // TYPE filter: ALL selected types must be present in the card's type info
    // e.g. CREDIT + BUSINESS → only cards that have BOTH "CREDIT" AND "BUSINESS"
    if (filterTypes.size > 0) {
        allCards = allCards.filter(c => {
            const info = BIN_CACHE[c.bin];
            // Combine all type info: BIN_CACHE type + log cardType
            const ctParts = [];
            if (info?.type) ctParts.push(info.type.toUpperCase());
            if (c.cardType) ctParts.push(c.cardType.toUpperCase());
            if (info?.level) ctParts.push(info.level.toUpperCase());
            const ct = ctParts.join(' ');
            // ALL selected types must match (AND logic)
            return [...filterTypes].every(ft => ct.includes(ft));
        });
    }
    // CLASS filter: precise word-boundary match
    // WORLD matches only WORLD, not WORLD_ELITE
    if (filterClasses.size > 0) {
        allCards = allCards.filter(c => {
            const info = BIN_CACHE[c.bin];
            // Combine level from cache + cardType from log
            const levelParts = [];
            if (info?.level) levelParts.push(info.level.toUpperCase().replace(/\s+/g, '_'));
            if (c.cardType) levelParts.push(c.cardType.toUpperCase().replace(/\s+/g, '_'));
            const level = levelParts.join(' ');
            // ALL selected classes must match with exact word matching
            return [...filterClasses].every(fc => {
                // Exact match or word boundary: WORLD should not match WORLD_ELITE
                const regex = new RegExp('(?:^|[\\s_])' + fc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[\\s_]|$)', 'i');
                return regex.test(level) || level === fc;
            });
        });
    }
    // NETWORK filter: exact network match
    if (filterPaymentSystems.size > 0) {
        allCards = allCards.filter(c => {
            const network = getCardType(c.cc || '');
            const brand = (BIN_CACHE[c.bin]?.brand || '').toUpperCase();
            return [...filterPaymentSystems].some(fps => network === fps || brand === fps);
        });
    }

    PARSER_STATE.binFilter = binFilters.length > 0 ? new Set(binFilters) : null;
    _processPipeline(allCards, status, excludeBanksRemoved);
}

// ──── PIPELINE: Filters → Trash → OldBase → Workspace → Dedup ────
function _processPipeline(allCards, status, excludeBanksRemoved) {
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
    PARSER_STATE._pipelineStats = { totalRaw, trashRemoved, compareRemoved, workspaceRemoved, dupRemoved, excludeBanksRemoved: excludeBanksRemoved || 0 };

    // Finish
    PARSER_STATE.collected = allCards;
    _rebuildBinGroups();

    if (status) status.textContent = `✅ ${allCards.length} cards ready`;
    let toastMsg = `Parsed: ${totalRaw} → clean: ${allCards.length} (trash: ${trashRemoved}, old base: ${compareRemoved}, workspace: ${workspaceRemoved}, dupes: ${dupRemoved}`;
    if (excludeBanksRemoved) toastMsg += `, 🚫banks: ${excludeBanksRemoved}`;
    toastMsg += ')';
    toast(toastMsg, 'success');
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
        // Exclude banks counter
        const exWrap = document.getElementById('ps-exclude-wrap');
        if (exWrap) {
            if (stats.excludeBanksRemoved > 0) {
                exWrap.style.display = '';
                set('ps-exclude', stats.excludeBanksRemoved);
            } else {
                exWrap.style.display = 'none';
            }
        }
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
    // Exclude banks indicator
    if (filters.excludeBanks) {
        const excCount = filters.excludeBanks.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).length;
        if (excCount > 0) parts.push(`🚫${excCount} banks`);
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
        scrollPos: 0,
        exportSource: 'Parser',
        exportedAt: new Date().toISOString()
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
    if (list.length === 0) { el.innerHTML = '<div class="pres-empty">No cards found after all filters</div>'; return; }

    _updateStatsBar();

    // ── GEO map ──
    const geoMap = {};
    list.forEach(c => {
        const geo = (c.detectedGeo || '').toUpperCase();
        if (geo) geoMap[geo] = (geoMap[geo] || 0) + 1;
    });
    const geoList = Object.entries(geoMap).sort((a, b) => b[1] - a[1]);
    const countryFlags = { US:'🇺🇸',CA:'🇨🇦',GB:'🇬🇧',DE:'🇩🇪',FR:'🇫🇷',AE:'🇦🇪',AU:'🇦🇺',IT:'🇮🇹',ES:'🇪🇸',NL:'🇳🇱',BR:'🇧🇷',MX:'🇲🇽',JP:'🇯🇵',KR:'🇰🇷',IN:'🇮🇳',SE:'🇸🇪',NO:'🇳🇴',DK:'🇩🇰',FI:'🇫🇮',CH:'🇨🇭',AT:'🇦🇹',BE:'🇧🇪',IE:'🇮🇪',PT:'🇵🇹',IL:'🇮🇱',SG:'🇸🇬',NZ:'🇳🇿',ZA:'🇿🇦',TR:'🇹🇷' };
    const countryNames = { US:'United States',CA:'Canada',GB:'United Kingdom',DE:'Germany',FR:'France',AE:'UAE',AU:'Australia',IT:'Italy',ES:'Spain',NL:'Netherlands',BR:'Brazil',MX:'Mexico',JP:'Japan',KR:'South Korea',IN:'India',SE:'Sweden',NO:'Norway',DK:'Denmark',FI:'Finland',CH:'Switzerland',AT:'Austria',BE:'Belgium',IE:'Ireland',PT:'Portugal',IL:'Israel',SG:'Singapore',NZ:'New Zealand',ZA:'South Africa',TR:'Turkey' };

    const activeGeo = geoFilter || '';
    let displayList = activeGeo ? list.filter(c => (c.detectedGeo || '').toUpperCase() === activeGeo) : list;

    // Test mode
    let testModeActive = PARSER_STATE.testMode;
    let testModeCards = 0, testModeBins = 0;
    if (testModeActive) {
        displayList = _applyTestMode(displayList, false);
        testModeCards = displayList.length;
        testModeBins = new Set(displayList.map(c => c.bin)).size;
    }
    const testEl = document.getElementById('ps-test-mode');
    if (testEl) {
        testEl.style.display = testModeActive ? 'inline' : 'none';
        const cardsEl2 = document.getElementById('ps-test-cards');
        const binsEl2 = document.getElementById('ps-test-bins');
        if (cardsEl2) cardsEl2.textContent = testModeCards;
        if (binsEl2) binsEl2.textContent = testModeBins;
    }

    // Sort
    const sortBy = PARSER_STATE.sortBy || 'index';
    const binCounts = {};
    displayList.forEach(c => { binCounts[c.bin] = (binCounts[c.bin] || 0) + 1; });
    let sortedDisplay = [...displayList];
    if (sortBy === 'bin-desc') sortedDisplay.sort((a, b) => (binCounts[b.bin]||0) - (binCounts[a.bin]||0));
    else if (sortBy === 'bin-asc') sortedDisplay.sort((a, b) => (binCounts[a.bin]||0) - (binCounts[b.bin]||0));

    const displayCount = displayList.length;

    // ── GEO chips ──
    const geoChips = `
        <button class="pres-geo-chip ${!activeGeo ? 'active' : ''}" data-geo="">ALL <span>${list.length}</span></button>
        ${geoList.map(([code, cnt]) =>
            `<button class="pres-geo-chip ${code === activeGeo ? 'active' : ''}" data-geo="${code}">
                ${countryFlags[code] || '🏳'} ${code} <span>${cnt}</span>
            </button>`
        ).join('')}`;

    // ── BIN analytics cards ──
    const binAnalytics = {};
    displayList.forEach(c => {
        if (!binAnalytics[c.bin]) binAnalytics[c.bin] = { count: 0, bank: c.bank || '' };
        binAnalytics[c.bin].count++;
    });
    const sortedBins = Object.entries(binAnalytics)
        .map(([bin, d]) => ({ bin, count: d.count, bank: d.bank }))
        .sort((a, b) => b.count - a.count);

    const binCards = sortedBins.map(b => {
        const bankShort = b.bank.length > 22 ? b.bank.slice(0, 22) + '…' : (b.bank || '—');
        return `<div class="pres-bin-card" data-bin="${b.bin}">
            <div class="pres-bin-top">
                <span class="pres-bin-num">${b.bin}</span>
                <span class="pres-bin-count">${b.count}</span>
            </div>
            <div class="pres-bin-bank">${bankShort}</div>
            <div class="pres-bin-actions">
                <button class="pres-bin-export-btn" data-bin="${b.bin}" title="Export this BIN to Notes">📝</button>
                <button class="pres-bin-copy-btn" data-bin="${b.bin}" title="Copy this BIN cards">📋</button>
            </div>
        </div>`;
    }).join('');

    // ── Table rows ──
    const binSortIcon = sortBy === 'bin-desc' ? '↓' : sortBy === 'bin-asc' ? '↑' : '↕';
    const rows = sortedDisplay.map(c => {
        const globalIdx = PARSER_STATE.collected.indexOf(c);
        const geoCode = (c.detectedGeo || '').toUpperCase();
        const geoFlag = countryFlags[geoCode] || '';
        const geoDisplay = geoCode ? `${geoFlag} ${geoCode}` : '—';
        const bankDisplay = c.bank ? (c.bank.length > 22 ? c.bank.slice(0, 22) + '…' : c.bank) : '—';
        const cardFmt = formatCardBin(c.cc);
        return `<tr>
            <td class="pc-chk"><input type="checkbox" ${PARSER_STATE.selected.has(globalIdx) ? 'checked' : ''} data-idx="${globalIdx}" class="parser-check"></td>
            <td class="pc-holder">${c.name.toUpperCase()} ${c.surname.toUpperCase()}</td>
            <td class="pc-card">${cardFmt}</td>
            <td class="pc-bank" title="${c.bank || ''}">${bankDisplay}</td>
            <td class="pc-exp">${c.validity}</td>
            <td class="pc-bin">${c.bin}</td>
            <td class="pc-geo">${geoDisplay}</td>
        </tr>`;
    }).join('');

    el.innerHTML = `
    <div class="pres-wrap">

        <!-- Top bar: summary + export -->
        <div class="pres-topbar">
            <div class="pres-topbar-left">
                <span class="pres-total-badge">${displayCount} cards</span>
                ${testModeActive ? `<span class="pres-test-badge">🧪 TEST: ${testModeCards} / ${testModeBins} BINs</span>` : ''}
            </div>
            <div class="pres-topbar-right">
                <label class="pres-selall-label">
                    <input type="checkbox" id="parser-select-all" ${PARSER_STATE.selected.size === displayList.length && displayList.length > 0 ? 'checked' : ''}>
                    Select all
                </label>
                <button class="pres-btn pres-btn-export" id="parser-import-btn">📝 Export to Notes (${displayCount})</button>
            </div>
        </div>

        <!-- GEO filter chips -->
        ${geoList.length > 0 ? `<div class="pres-geo-row" id="pres-geo-chips">${geoChips}</div>` : ''}

        <!-- BIN grid -->
        ${sortedBins.length > 0 ? `
        <div class="pres-bins-section">
            <div class="pres-section-label">BINs (${sortedBins.length}) — click 📝/📋 to export a single BIN</div>
            <div class="pres-bins-grid">${binCards}</div>
        </div>` : ''}

        <!-- Cards table -->
        <div class="pres-table-wrap">
            <table class="pres-table">
                <colgroup>
                    <col style="width:28px">
                    <col style="width:15%">
                    <col style="width:16%">
                    <col style="width:18%">
                    <col style="width:52px">
                    <col style="width:72px">
                    <col style="width:52px">
                </colgroup>
                <thead>
                    <tr>
                        <th></th>
                        <th>NAME</th>
                        <th>CARD</th>
                        <th>BANK</th>
                        <th>EXP</th>
                        <th class="pres-sort-th" id="parser-sort-bin">BIN ${binSortIcon}</th>
                        <th>GEO</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>

    </div>`;

    // ── Events ──

    // Checkboxes
    el.querySelectorAll('.parser-check').forEach(cb => {
        cb.addEventListener('change', () => {
            const idx = parseInt(cb.dataset.idx);
            if (cb.checked) PARSER_STATE.selected.add(idx);
            else PARSER_STATE.selected.delete(idx);
        });
    });

    document.getElementById('parser-select-all')?.addEventListener('change', (e) => {
        if (e.target.checked) sortedDisplay.forEach(c => PARSER_STATE.selected.add(PARSER_STATE.collected.indexOf(c)));
        else sortedDisplay.forEach(c => PARSER_STATE.selected.delete(PARSER_STATE.collected.indexOf(c)));
        el.querySelectorAll('.parser-check').forEach(cb => cb.checked = e.target.checked);
    });

    // Export all
    document.getElementById('parser-import-btn')?.addEventListener('click', importToProject);

    // Sort by BIN
    document.getElementById('parser-sort-bin')?.addEventListener('click', () => {
        PARSER_STATE.sortBy = PARSER_STATE.sortBy === 'bin-desc' ? 'bin-asc' : 'bin-desc';
        renderParserResults(activeGeo);
    });

    // GEO chips
    el.querySelectorAll('.pres-geo-chip').forEach(chip => {
        chip.addEventListener('click', () => renderParserResults(chip.dataset.geo));
    });

    // ── Per-BIN export/copy ──
    const buildBinLines = (binVal) => {
        return displayList
            .filter(c => c.bin === binVal)
            .map(c => `${(c.cc||'').replace(/\s/g,'')} ${(c.mm||'').padStart(2,'0')} ${c.yy||''} ${c.cvv||'000'}`)
            .join('\n');
    };

    el.querySelectorAll('.pres-bin-export-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const binVal = btn.dataset.bin;
            const binCards2 = displayList.filter(c => c.bin === binVal);
            if (!binCards2.length) { toast('No cards for this BIN', 'info'); return; }
            const block = buildBinLines(binVal);
            const newTab = {
                id: 'tab-bin-' + Date.now(),
                title: `BIN ${binVal} (${binCards2.length})`,
                content: block,
                pinned: false, tag: null,
                created: Date.now(), scrollPos: 0,
                exportSource: 'Parser BIN',
                exportedAt: new Date().toISOString()
            };
            STATE.notesTabs.unshift(newTab);
            STATE.notesActiveTab = newTab.id;
            save();
            toast(`BIN ${binVal}: ${binCards2.length} cards → Notes`, 'success');
        });
    });

    el.querySelectorAll('.pres-bin-copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const binVal = btn.dataset.bin;
            const text = buildBinLines(binVal);
            const cnt = displayList.filter(c => c.bin === binVal).length;
            navigator.clipboard?.writeText(text).then(() => toast(`BIN ${binVal}: ${cnt} cards copied`, 'success'));
        });
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
    const targetCountry = document.getElementById('parser-target-country')?.value || 'auto';
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
        const editor = document.getElementById('notes-editor');
        if (!editor) return;
        STATE.notes = editor.innerHTML;
        STATE.notesLastSaved = new Date().toISOString();
        save();
        toast('Notes saved', 'success');
        const savedInfo = document.querySelector('.notes-saved-info');
        if (savedInfo) savedInfo.textContent = 'Saved ' + new Date().toLocaleTimeString();
    }

    function changeNotesFontSize(delta) {
        STATE.notesFontSize = Math.max(10, Math.min(24, (STATE.notesFontSize || 14) + delta));
        const editor = document.getElementById('notes-editor');
        if (editor) editor.style.fontSize = STATE.notesFontSize + 'px';
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
                const editor = document.getElementById('notes-editor');
                if (editor) {
                    // Append text as a new paragraph
                    const text = ev.target.result;
                    const p = document.createElement('div');
                    p.textContent = text;
                    editor.appendChild(p);
                    editor.dispatchEvent(new Event('input'));
                }
                toast('Imported: ' + file.name, 'success');
            };
            reader.readAsText(file);
        });
        input.click();
    }

    function exportNotesAction() {
        const editor = document.getElementById('notes-editor');
        const text = editor ? _getEditorText(editor) : (STATE.notes || '');
        if (!text.trim()) {
            toast('Notes are empty', 'error');
            return;
        }
        const blob = new Blob([text], { type: 'text/plain' });
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
        excludeBanks: document.getElementById('parser-exclude-banks')?.value || '',
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

// ═══════════════════════════════════════════
//    BIN DATABASE TAB — Merchant BIN Manager
// ═══════════════════════════════════════════

let _binDbActiveMerchant = null;

function _binDbExtract6(raw) {
    // Extract first 6 digits from any card/bin input
    const digits = String(raw).replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(0, Math.min(6, digits.length)) : '';
}

function _binDbFormatBin(bin6) {
    // Format: "5288 89" (4+2 with space) or "528" if short
    if (bin6.length <= 4) return bin6;
    return bin6.slice(0, 4) + ' ' + bin6.slice(4);
}

function _binDbFormatAmount(amount) {
    // Format amount with commas: 1,215.90 or 3,900.00
    const num = parseFloat(amount);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _binDbGenerateOutput() {
    // Generate the full output text for all merchants
    const merchants = STATE.binDbMerchants || [];
    if (merchants.length === 0) return '';

    const blocks = merchants.map(m => {
        let block = `Merchant: ${m.name}\n`;
        if (m.screenshotCount) {
            block += `Total screenshots: ${m.screenshotCount}\n`;
            block += '========================================\n';
        }
        block += '\n';
        (m.bins || []).forEach(b => {
            const formatted = _binDbFormatBin(b.bin);
            const amount = _binDbFormatAmount(b.amount);
            const currency = b.currency || 'USD';
            block += `BIN: ${formatted} - ${amount} ${currency}\n`;
        });
        return block;
    });

    return blocks.join('\n');
}

function _binDbCopyAll() {
    const text = _binDbGenerateOutput();
    if (!text) { toast('Nothing to copy', 'error'); return; }
    navigator.clipboard?.writeText(text.trim()).then(() => {
        toast('Bin Database copied!', 'success');
    });
}

function _binDbCopyMerchant(merchantId) {
    const m = STATE.binDbMerchants.find(x => x.id === merchantId);
    if (!m) return;

    let block = `Merchant: ${m.name}\n`;
    if (m.screenshotCount) {
        block += `Total screenshots: ${m.screenshotCount}\n`;
        block += '========================================\n';
    }
    block += '\n';
    (m.bins || []).forEach(b => {
        const formatted = _binDbFormatBin(b.bin);
        const amount = _binDbFormatAmount(b.amount);
        const currency = b.currency || 'USD';
        block += `BIN: ${formatted} - ${amount} ${currency}\n`;
    });

    navigator.clipboard?.writeText(block.trim()).then(() => {
        toast(`Copied ${m.name} (${m.bins.length} BINs)`, 'success');
    });
}

function _binDbAddMerchant() {
    const name = prompt('Merchant name:');
    if (!name || !name.trim()) return;
    const merchant = {
        id: 'bm-' + Date.now(),
        name: name.trim(),
        screenshotCount: 0,
        defaultCurrency: 'USD',
        bins: []
    };
    STATE.binDbMerchants.push(merchant);
    _binDbActiveMerchant = merchant.id;
    save();
    renderBinDatabase();
}

function _binDbDeleteMerchant(merchantId) {
    const m = STATE.binDbMerchants.find(x => x.id === merchantId);
    if (!m) return;
    if (m.bins.length > 0 && !confirm(`Delete merchant "${m.name}" with ${m.bins.length} BINs?`)) return;
    STATE.binDbMerchants = STATE.binDbMerchants.filter(x => x.id !== merchantId);
    if (_binDbActiveMerchant === merchantId) {
        _binDbActiveMerchant = STATE.binDbMerchants[0]?.id || null;
    }
    save();
    renderBinDatabase();
}

function _binDbRenameMerchant(merchantId) {
    const m = STATE.binDbMerchants.find(x => x.id === merchantId);
    if (!m) return;
    const name = prompt('Rename merchant:', m.name);
    if (!name || !name.trim()) return;
    m.name = name.trim();
    save();
    renderBinDatabase();
}

function _binDbSetCurrency(merchantId, currency) {
    const m = STATE.binDbMerchants.find(x => x.id === merchantId);
    if (!m) return;
    m.defaultCurrency = currency;
    // Update all bins in this merchant to the new currency
    m.bins.forEach(b => { b.currency = currency; });
    save();
    renderBinDatabase();
}

function _binDbSetScreenshots(merchantId) {
    const m = STATE.binDbMerchants.find(x => x.id === merchantId);
    if (!m) return;
    const val = prompt('Total screenshots:', m.screenshotCount || '');
    if (val === null) return;
    m.screenshotCount = parseInt(val) || 0;
    save();
    renderBinDatabase();
}

function _binDbAddBin(merchantId) {
    const m = STATE.binDbMerchants.find(x => x.id === merchantId);
    if (!m) return;

    const binInput = document.getElementById('bdb-bin-input-' + merchantId);
    const amtInput = document.getElementById('bdb-amt-input-' + merchantId);
    if (!binInput || !amtInput) return;

    const rawBin = binInput.value.trim();
    const rawAmt = amtInput.value.trim();

    if (!rawBin) { toast('Enter a BIN number', 'error'); return; }

    const bin6 = _binDbExtract6(rawBin);
    if (!bin6 || bin6.length < 4) { toast('BIN must be at least 4 digits', 'error'); return; }

    const amount = parseFloat(rawAmt.replace(/,/g, '')) || 0;

    m.bins.push({
        id: 'bb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        bin: bin6,
        amount: amount,
        currency: m.defaultCurrency || 'USD'
    });

    binInput.value = '';
    amtInput.value = '';
    binInput.focus();
    save();
    renderBinDatabase();
}

function _binDbRemoveBin(merchantId, binId) {
    const m = STATE.binDbMerchants.find(x => x.id === merchantId);
    if (!m) return;
    m.bins = m.bins.filter(b => b.id !== binId);
    save();
    renderBinDatabase();
}

function _binDbClearBins(merchantId) {
    const m = STATE.binDbMerchants.find(x => x.id === merchantId);
    if (!m) return;
    if (m.bins.length === 0) return;
    if (!confirm(`Clear all ${m.bins.length} BINs from "${m.name}"?`)) return;
    m.bins = [];
    save();
    renderBinDatabase();
}

function _binDbBulkAdd(merchantId) {
    const m = STATE.binDbMerchants.find(x => x.id === merchantId);
    if (!m) return;

    const textarea = document.getElementById('bdb-bulk-textarea-' + merchantId);
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) { toast('Paste BIN data first', 'error'); return; }

    const lines = text.split('\n').filter(l => l.trim());
    let added = 0;

    for (const line of lines) {
        const trimmed = line.trim();

        // Try format: "BIN: 5288 89 - 14.47 USD"
        const matchFull = trimmed.match(/^BIN:\s*(\d[\d\s]*)\s*-\s*([\d,\.]+)\s*(\w+)?/i);
        if (matchFull) {
            const bin6 = _binDbExtract6(matchFull[1]);
            const amount = parseFloat(matchFull[2].replace(/,/g, '')) || 0;
            const currency = matchFull[3] || m.defaultCurrency || 'USD';
            if (bin6 && bin6.length >= 4) {
                m.bins.push({
                    id: 'bb-' + Date.now() + '-' + (added++) + Math.random().toString(36).slice(2, 6),
                    bin: bin6, amount, currency
                });
                continue;
            }
        }

        // Try format: "528889 - 14.47" or "528889 14.47"
        const matchSimple = trimmed.match(/^(\d[\d\s]*)\s*[-—]\s*([\d,\.]+)\s*(\w+)?/);
        if (matchSimple) {
            const bin6 = _binDbExtract6(matchSimple[1]);
            const amount = parseFloat(matchSimple[2].replace(/,/g, '')) || 0;
            const currency = matchSimple[3] || m.defaultCurrency || 'USD';
            if (bin6 && bin6.length >= 4) {
                m.bins.push({
                    id: 'bb-' + Date.now() + '-' + (added++) + Math.random().toString(36).slice(2, 6),
                    bin: bin6, amount, currency
                });
                continue;
            }
        }

        // Try format: just digits and amount separated by whitespace
        const matchParts = trimmed.match(/^(\d[\d\s]{3,})\s+([\d,\.]+)\s*(\w*)/);
        if (matchParts) {
            const bin6 = _binDbExtract6(matchParts[1]);
            const amount = parseFloat(matchParts[2].replace(/,/g, '')) || 0;
            const currency = matchParts[3] || m.defaultCurrency || 'USD';
            if (bin6 && bin6.length >= 4) {
                m.bins.push({
                    id: 'bb-' + Date.now() + '-' + (added++) + Math.random().toString(36).slice(2, 6),
                    bin: bin6, amount, currency
                });
            }
        }
    }

    if (added > 0) {
        textarea.value = '';
        save();
        renderBinDatabase();
        toast(`Added ${added} BINs to ${m.name}`, 'success');
    } else {
        toast('No valid BIN entries found', 'error');
    }
}

function renderBinDatabase() {
    const area = document.getElementById('content-area');
    const merchants = STATE.binDbMerchants || [];

    // Auto-select first merchant if none selected
    if (!_binDbActiveMerchant && merchants.length > 0) {
        _binDbActiveMerchant = merchants[0].id;
    }

    const activeMerchant = merchants.find(m => m.id === _binDbActiveMerchant);

    // Merchant sidebar items
    const merchantListHTML = merchants.map(m => {
        const isActive = m.id === _binDbActiveMerchant;
        const binCount = m.bins?.length || 0;
        const totalAmt = (m.bins || []).reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
        return `<div class="bdb-merchant-item ${isActive ? 'active' : ''}" data-mid="${m.id}">
            <div class="bdb-merchant-info">
                <span class="bdb-merchant-name">${m.name}</span>
                <span class="bdb-merchant-meta">${binCount} BINs${totalAmt > 0 ? ' · ' + _binDbFormatAmount(totalAmt) + ' ' + (m.defaultCurrency || 'USD') : ''}</span>
            </div>
            <div class="bdb-merchant-actions">
                <button class="bdb-act-btn" onclick="event.stopPropagation();_binDbRenameMerchant('${m.id}')" title="Rename">✏️</button>
                <button class="bdb-act-btn bdb-act-del" onclick="event.stopPropagation();_binDbDeleteMerchant('${m.id}')" title="Delete">🗑️</button>
            </div>
        </div>`;
    }).join('');

    // BIN list for active merchant
    let binListHTML = '';
    let merchantHeaderHTML = '';
    let addFormHTML = '';

    if (activeMerchant) {
        const bins = activeMerchant.bins || [];
        const totalAmt = bins.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

        merchantHeaderHTML = `
            <div class="bdb-merchant-header">
                <div class="bdb-merchant-title-row">
                    <h2 class="bdb-merchant-h2">${activeMerchant.name}</h2>
                    <span class="bdb-count-badge">${bins.length} BINs</span>
                    <span class="bdb-total-badge">${_binDbFormatAmount(totalAmt)} ${activeMerchant.defaultCurrency || 'USD'}</span>
                </div>
                <div class="bdb-merchant-controls">
                    <label class="bdb-currency-label">Currency:
                        <select class="bdb-currency-select" id="bdb-currency-${activeMerchant.id}">
                            <option value="USD" ${activeMerchant.defaultCurrency === 'USD' ? 'selected' : ''}>USD</option>
                            <option value="EUR" ${activeMerchant.defaultCurrency === 'EUR' ? 'selected' : ''}>EUR</option>
                            <option value="GBP" ${activeMerchant.defaultCurrency === 'GBP' ? 'selected' : ''}>GBP</option>
                            <option value="JPY" ${activeMerchant.defaultCurrency === 'JPY' ? 'selected' : ''}>JPY</option>
                            <option value="CAD" ${activeMerchant.defaultCurrency === 'CAD' ? 'selected' : ''}>CAD</option>
                            <option value="AUD" ${activeMerchant.defaultCurrency === 'AUD' ? 'selected' : ''}>AUD</option>
                            <option value="LEI" ${activeMerchant.defaultCurrency === 'LEI' ? 'selected' : ''}>LEI</option>
                            <option value="RON" ${activeMerchant.defaultCurrency === 'RON' ? 'selected' : ''}>RON</option>
                            <option value="RUB" ${activeMerchant.defaultCurrency === 'RUB' ? 'selected' : ''}>RUB</option>
                            <option value="UAH" ${activeMerchant.defaultCurrency === 'UAH' ? 'selected' : ''}>UAH</option>
                            <option value="PLN" ${activeMerchant.defaultCurrency === 'PLN' ? 'selected' : ''}>PLN</option>
                            <option value="CZK" ${activeMerchant.defaultCurrency === 'CZK' ? 'selected' : ''}>CZK</option>
                            <option value="BRL" ${activeMerchant.defaultCurrency === 'BRL' ? 'selected' : ''}>BRL</option>
                            <option value="MXN" ${activeMerchant.defaultCurrency === 'MXN' ? 'selected' : ''}>MXN</option>
                            <option value="INR" ${activeMerchant.defaultCurrency === 'INR' ? 'selected' : ''}>INR</option>
                        </select>
                    </label>
                    <button class="bdb-tool-btn" onclick="_binDbSetScreenshots('${activeMerchant.id}')" title="Set screenshot count">📷 Screenshots: ${activeMerchant.screenshotCount || 0}</button>
                    <button class="bdb-tool-btn bdb-copy-btn" onclick="_binDbCopyMerchant('${activeMerchant.id}')">📋 Copy Merchant</button>
                    <button class="bdb-tool-btn bdb-clear-btn" onclick="_binDbClearBins('${activeMerchant.id}')">🗑 Clear All BINs</button>
                </div>
            </div>
        `;

        // Add form (single BIN)
        addFormHTML = `
            <div class="bdb-add-form">
                <div class="bdb-add-row">
                    <input type="text" id="bdb-bin-input-${activeMerchant.id}" class="bdb-input bdb-bin-field" placeholder="BIN (e.g. 528889 or 5288 89)" maxlength="20">
                    <input type="text" id="bdb-amt-input-${activeMerchant.id}" class="bdb-input bdb-amt-field" placeholder="Amount (e.g. 14.47)" maxlength="15">
                    <button class="bdb-add-btn" id="bdb-add-single-${activeMerchant.id}">+ Add BIN</button>
                </div>
                <div class="bdb-bulk-toggle">
                    <button class="bdb-toggle-bulk" id="bdb-toggle-bulk-${activeMerchant.id}">📥 Bulk Add</button>
                </div>
                <div class="bdb-bulk-area hidden" id="bdb-bulk-area-${activeMerchant.id}">
                    <textarea id="bdb-bulk-textarea-${activeMerchant.id}" class="bdb-bulk-textarea" rows="5" placeholder="Paste BINs — one per line.\n\nSupported formats:\nBIN: 5288 89 - 14.47 USD\n528889 - 14.47\n5288 89 14.47 USD"></textarea>
                    <button class="bdb-bulk-parse-btn" id="bdb-bulk-parse-${activeMerchant.id}">⚡ Parse & Add</button>
                </div>
            </div>
        `;

        // BIN list table
        if (bins.length > 0) {
            const rows = bins.map((b, idx) => {
                const formatted = _binDbFormatBin(b.bin);
                const amount = _binDbFormatAmount(b.amount);
                return `<tr class="bdb-bin-row" data-bid="${b.id}">
                    <td class="bdb-col-idx">${idx + 1}</td>
                    <td class="bdb-col-bin"><span class="bdb-bin-chip">${formatted}</span></td>
                    <td class="bdb-col-amount">${amount}</td>
                    <td class="bdb-col-currency">${b.currency || 'USD'}</td>
                    <td class="bdb-col-actions"><button class="bdb-rm-btn" data-mid="${activeMerchant.id}" data-bid="${b.id}" title="Remove">×</button></td>
                </tr>`;
            }).join('');

            binListHTML = `
                <div class="bdb-bin-list-wrap">
                    <table class="bdb-bin-table">
                        <thead><tr>
                            <th class="bdb-th-idx">#</th>
                            <th class="bdb-th-bin">BIN</th>
                            <th class="bdb-th-amount">Amount</th>
                            <th class="bdb-th-currency">Currency</th>
                            <th class="bdb-th-actions"></th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        } else {
            binListHTML = `<div class="bdb-empty-bins">
                <div class="bdb-empty-icon">📭</div>
                <p>No BINs added yet</p>
                <p class="bdb-empty-hint">Add BINs using the form above or paste in bulk</p>
            </div>`;
        }
    } else {
        merchantHeaderHTML = `<div class="bdb-empty-state">
            <div class="bdb-empty-icon-lg">🏦</div>
            <h3>No Merchant Selected</h3>
            <p>Create a merchant to start adding BINs</p>
            <button class="bdb-create-first-btn" id="bdb-create-first">+ Create Merchant</button>
        </div>`;
    }

    // Preview output
    const previewText = _binDbGenerateOutput();
    const previewHTML = previewText ? `
        <div class="bdb-preview-section">
            <div class="bdb-preview-header">
                <span class="bdb-preview-title">📋 Output Preview</span>
                <button class="bdb-copy-all-btn" id="bdb-copy-all-btn">📋 Copy All</button>
            </div>
            <pre class="bdb-preview-text">${previewText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </div>
    ` : '';

    area.innerHTML = `
        <div class="bdb-container">
            <div class="bdb-sidebar">
                <div class="bdb-sidebar-header">
                    <span class="bdb-sidebar-title">🏦 Merchants</span>
                    <button class="bdb-new-merchant-btn" id="bdb-new-merchant">+</button>
                </div>
                <div class="bdb-merchant-list" id="bdb-merchant-list">${merchantListHTML}</div>
                ${previewHTML}
            </div>
            <div class="bdb-main">
                ${merchantHeaderHTML}
                ${addFormHTML}
                ${binListHTML}
            </div>
        </div>
    `;

    // ── Event wiring ──

    // New merchant
    document.getElementById('bdb-new-merchant')?.addEventListener('click', _binDbAddMerchant);
    document.getElementById('bdb-create-first')?.addEventListener('click', _binDbAddMerchant);

    // Copy all
    document.getElementById('bdb-copy-all-btn')?.addEventListener('click', _binDbCopyAll);

    // Merchant click (switch)
    document.querySelectorAll('.bdb-merchant-item').forEach(item => {
        item.addEventListener('click', () => {
            _binDbActiveMerchant = item.dataset.mid;
            renderBinDatabase();
        });
    });

    if (activeMerchant) {
        const mid = activeMerchant.id;

        // Currency select
        const currSel = document.getElementById('bdb-currency-' + mid);
        currSel?.addEventListener('change', () => {
            _binDbSetCurrency(mid, currSel.value);
        });

        // Add single BIN
        document.getElementById('bdb-add-single-' + mid)?.addEventListener('click', () => _binDbAddBin(mid));

        // Enter key on inputs
        const binInput = document.getElementById('bdb-bin-input-' + mid);
        const amtInput = document.getElementById('bdb-amt-input-' + mid);
        [binInput, amtInput].forEach(inp => {
            inp?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); _binDbAddBin(mid); }
            });
        });

        // Toggle bulk area
        document.getElementById('bdb-toggle-bulk-' + mid)?.addEventListener('click', () => {
            const bulkArea = document.getElementById('bdb-bulk-area-' + mid);
            if (bulkArea) bulkArea.classList.toggle('hidden');
        });

        // Bulk parse
        document.getElementById('bdb-bulk-parse-' + mid)?.addEventListener('click', () => _binDbBulkAdd(mid));

        // Remove BIN buttons
        document.querySelectorAll('.bdb-rm-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                _binDbRemoveBin(btn.dataset.mid, btn.dataset.bid);
            });
        });
    }
}

// ═══════════════════════════════════════════
//    PROMPTS TAB — Prompt Storage & Manager
// ═══════════════════════════════════════════

function _getActivePromptTab() {
    return STATE.promptsTabs.find(t => t.id === STATE.promptsActiveTab) || STATE.promptsTabs[0];
}

function _saveActivePromptTab() {
    const editor = document.getElementById('prompts-editor');
    if (!editor) return;
    const tab = _getActivePromptTab();
    if (tab) {
        tab.content = editor.innerHTML;
        tab.scrollPos = editor.scrollTop;
    }
}

function _ptStartRename(tabId) {
    const tab = STATE.promptsTabs.find(t => t.id === tabId);
    if (!tab) return;
    const titleEl = document.querySelector(`.pt-tab-title[data-tab="${tabId}"], .pt-sidebar-item-title[data-tab="${tabId}"]`);
    if (!titleEl) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = tab.title;
    input.className = 'pt-rename-input';
    input.style.cssText = 'width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(234,179,8,0.5);border-radius:3px;color:#fff;font-size:11px;padding:2px 6px;outline:none;';

    const finishRename = () => {
        const newTitle = input.value.trim() || tab.title;
        tab.title = newTitle;
        save();
        renderPrompts();
    };

    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finishRename(); }
        if (e.key === 'Escape') { input.value = tab.title; finishRename(); }
    });

    titleEl.replaceWith(input);
    input.focus();
    input.select();
}

function _ptTogglePin(tabId) {
    const tab = STATE.promptsTabs.find(t => t.id === tabId);
    if (tab) { tab.pinned = !tab.pinned; save(); renderPrompts(); }
}

function _ptDeleteTab(tabId) {
    const tab = STATE.promptsTabs.find(t => t.id === tabId);
    if (!tab) return;
    if (STATE.promptsTabs.length <= 1) { toast('Cannot delete last tab','error'); return; }
    if (tab.content && tab.content.replace(/<[^>]+>/g,'').trim()) {
        if (!confirm(`Delete prompt "${tab.title}"?`)) return;
    }
    STATE.promptsTabs = STATE.promptsTabs.filter(t => t.id !== tabId);
    if (STATE.promptsActiveTab === tabId) STATE.promptsActiveTab = STATE.promptsTabs[0]?.id || '';
    save();
    renderPrompts();
}

function renderPrompts() {
    const area = document.getElementById('content-area');
    const activeTab = _getActivePromptTab();
    if (!activeTab) return;

    const tabs = [...STATE.promptsTabs];
    const content = activeTab.content || '';

    // Count prompts (non-empty lines)
    const plainText = content.replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>\s*<div/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ');
    const lineCount = plainText.split('\n').filter(l => l.trim()).length || 0;

    // Sort: pinned tabs first
    const sortedTabs = [...tabs].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    // Tab bar
    let tabsHTML = sortedTabs.map(t => {
        const isActive = t.id === STATE.promptsActiveTab;
        const pinIcon = t.pinned ? '<span class="pt-pin-icon">📌</span>' : '';
        return `<button class="pt-tab ${isActive ? 'active' : ''} ${t.pinned ? 'pt-pinned' : ''}" data-tab="${t.id}" ondblclick="_ptStartRename('${t.id}')">
            ${pinIcon}<span class="pt-tab-title" data-tab="${t.id}">${t.title}</span><span class="pt-tab-edit" onclick="event.stopPropagation();_ptStartRename('${t.id}')" title="Rename">✏️</span>
            ${tabs.length > 1 ? `<span class="pt-tab-close" data-tab="${t.id}">×</span>` : ''}
        </button>`;
    }).join('');
    tabsHTML += `<button class="pt-new-tab" id="pt-new-tab" title="New prompt tab">+</button>`;

    // Sidebar item list
    const sidebarItemsHTML = tabs.map(t => {
        const isActive = t.id === STATE.promptsActiveTab;
        const plainContent = (t.content || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/div>\s*<div/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ');
        const promptCount = plainContent.split('\n').filter(l => l.trim()).length;
        return `<div class="pt-sidebar-item ${isActive ? 'active' : ''}" data-tab="${t.id}">
            <span class="pt-sidebar-item-title" data-tab="${t.id}">${t.title}</span>
            <span class="pt-sidebar-item-meta">${promptCount > 0 ? `<span class="pt-meta-count">💡${promptCount}</span>` : ''}</span>
            <div class="pt-sidebar-actions">
                <button class="pt-sidebar-act-btn" onclick="event.stopPropagation();_ptStartRename('${t.id}')" title="Rename">✏️</button>
                <button class="pt-sidebar-act-btn ${t.pinned ? 'active' : ''}" onclick="event.stopPropagation();_ptTogglePin('${t.id}')" title="${t.pinned ? 'Unpin' : 'Pin'}">${t.pinned ? '📌' : '📍'}</button>
                ${tabs.length > 1 ? `<button class="pt-sidebar-act-btn pt-sidebar-act-del" onclick="event.stopPropagation();_ptDeleteTab('${t.id}')" title="Delete">🗑️</button>` : ''}
            </div>
        </div>`;
    }).join('');

    area.innerHTML = `
        <!-- Sidebar overlay (backdrop) -->
        <div class="pt-sidebar-overlay" id="pt-sidebar-overlay"></div>

        <!-- Sidebar drawer -->
        <div class="pt-sidebar" id="pt-sidebar">
            <div class="pt-sidebar-header">
                <span class="pt-sidebar-title">💡 All Prompts (${tabs.length})</span>
                <button class="pt-sidebar-close" id="pt-sidebar-close">×</button>
            </div>
            <div class="pt-sidebar-new">
                <button class="pt-sidebar-new-btn" id="pt-sidebar-new-btn">+ New Prompt</button>
            </div>
            <div class="pt-sidebar-list" id="pt-sidebar-list">${sidebarItemsHTML}</div>
        </div>

        <div class="prompts-container">
            <div class="pt-tab-bar">
                <div class="pt-tabs-scroll">
                    <!-- Sidebar toggle -->
                    <button class="pt-sidebar-toggle" id="pt-sidebar-open" title="All prompts">☰ Prompts</button>
                    ${tabsHTML}
                </div>
                <div class="pt-toolbar-right">
                    <button class="pt-tool-btn" id="pt-copy-all-btn" title="Copy all content">📋 COPY ALL</button>
                    <button class="pt-tool-btn" id="pt-pin-btn" title="Pin/Unpin tab">📌 PIN</button>
                    <button class="pt-tool-btn" id="pt-rename-btn" title="Rename tab">RENAME</button>
                    <button class="pt-tool-btn" id="pt-clear-btn" title="Clear current tab">CLEAR</button>
                    <button class="pt-tool-btn" id="pt-save-btn">SAVE</button>
                </div>
            </div>
            <div class="prompts-editor-wrap">
                <div class="prompts-editor" id="prompts-editor" contenteditable="true" spellcheck="false" data-placeholder="Write your prompts here... Each line is a separate prompt."></div>
            </div>
            <div class="prompts-status-bar">
                <span class="prompts-saved-info">${lineCount} prompt${lineCount !== 1 ? 's' : ''}</span>
                <span class="prompts-tab-name">${activeTab.title}</span>
            </div>
        </div>
    `;

    // ── Sidebar logic ──
    const sidebar = document.getElementById('pt-sidebar');
    const overlay = document.getElementById('pt-sidebar-overlay');
    const openSidebar = () => { sidebar.classList.add('open'); overlay.classList.add('open'); };
    const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };

    document.getElementById('pt-sidebar-open')?.addEventListener('click', openSidebar);
    document.getElementById('pt-sidebar-close')?.addEventListener('click', closeSidebar);
    overlay?.addEventListener('click', closeSidebar);

    // ── Sidebar: switch tab ──
    document.querySelectorAll('.pt-sidebar-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('pt-sidebar-act-btn')) return;
            _saveActivePromptTab();
            STATE.promptsActiveTab = item.dataset.tab;
            save();
            closeSidebar();
            renderPrompts();
        });
    });

    // ── Sidebar: new tab ──
    const _createNewPromptTab = () => {
        _saveActivePromptTab();
        const newTab = {
            id: 'ptab-' + Date.now(),
            title: 'Prompt ' + (STATE.promptsTabs.length + 1),
            content: '', pinned: false,
            created: Date.now(), scrollPos: 0
        };
        STATE.promptsTabs.unshift(newTab);
        STATE.promptsActiveTab = newTab.id;
        save();
        closeSidebar();
        renderPrompts();
    };
    document.getElementById('pt-sidebar-new-btn')?.addEventListener('click', _createNewPromptTab);

    // ── Tab bar: click tab ──
    document.querySelectorAll('.pt-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            _saveActivePromptTab();
            STATE.promptsActiveTab = btn.dataset.tab;
            save();
            renderPrompts();
        });
    });

    // ── Tab bar: close tab ──
    document.querySelectorAll('.pt-tab-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            _ptDeleteTab(btn.dataset.tab);
        });
    });

    // ── Tab bar: new tab ──
    document.getElementById('pt-new-tab')?.addEventListener('click', _createNewPromptTab);

    // ── Toolbar: Pin ──
    document.getElementById('pt-pin-btn')?.addEventListener('click', () => {
        const tab = _getActivePromptTab();
        if (tab) { tab.pinned = !tab.pinned; save(); renderPrompts(); }
    });

    // ── Toolbar: Rename ──
    document.getElementById('pt-rename-btn')?.addEventListener('click', () => {
        _ptStartRename(STATE.promptsActiveTab);
    });

    // ── Toolbar: Clear ──
    document.getElementById('pt-clear-btn')?.addEventListener('click', () => {
        const tab = _getActivePromptTab();
        if (tab && tab.content) {
            if (confirm('Clear all content from this prompt tab?')) {
                tab.content = '';
                save();
                renderPrompts();
            }
        }
    });

    // ── Toolbar: Save ──
    document.getElementById('pt-save-btn')?.addEventListener('click', () => {
        _saveActivePromptTab();
        save();
        toast('Prompts saved', 'success');
    });

    // ── Toolbar: Copy All ──
    document.getElementById('pt-copy-all-btn')?.addEventListener('click', () => {
        const editor = document.getElementById('prompts-editor');
        if (!editor) return;
        const text = editor.innerText || editor.textContent || '';
        navigator.clipboard?.writeText(text).then(() => {
            toast('All content copied', 'success');
        });
    });

    // ── Editor setup ──
    const editor = document.getElementById('prompts-editor');
    if (editor) {
        editor.innerHTML = content;
        if (activeTab.scrollPos) editor.scrollTop = activeTab.scrollPos;

        // Auto-save on input
        let _ptSaveTimer = null;
        editor.addEventListener('input', () => {
            clearTimeout(_ptSaveTimer);
            _ptSaveTimer = setTimeout(() => {
                _saveActivePromptTab();
                save();
                // Update line count in status bar
                const plain = editor.innerText || '';
                const count = plain.split('\n').filter(l => l.trim()).length;
                const info = document.querySelector('.prompts-saved-info');
                if (info) info.textContent = `${count} prompt${count !== 1 ? 's' : ''}`;
            }, 800);
        });

        // Ctrl+S shortcut
        editor.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                _saveActivePromptTab();
                save();
                toast('Prompts saved', 'success');
            }
        });
    }
}

// Auto-save prompts when navigating away
const _origNavigate = navigate;
// Patch navigate to save prompts before switching views (already handled for notes in navigate())
(function() {
    const _baseNavigate = navigate;
    window._promptsNavigatePatched = true;
})();
// The navigate function already saves notes; we add prompts saving in the navigate function override
// Instead, let's hook into the existing navigate pattern via the renderContent dispatcher

// Save prompts on any view change
document.addEventListener('visibilitychange', () => {
    if (document.hidden && STATE.currentView === 'prompts') {
        _saveActivePromptTab();
        save();
    }
});
window.addEventListener('beforeunload', () => {
    if (STATE.currentView === 'prompts') {
        _saveActivePromptTab();
        save();
    }
});
