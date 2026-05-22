/* ═══════════════════════════════════════════
   EXIF GENERATOR — Application Logic v1.0
   Standalone tool: Address → EXIF/GPS metadata
   ═══════════════════════════════════════════ */

// ── Camera Database ──
const CAMERAS = [
    { make: 'Google',    model: 'Pixel 9 Pro' },
    { make: 'Google',    model: 'Pixel 9' },
    { make: 'Google',    model: 'Pixel 8 Pro' },
    { make: 'Google',    model: 'Pixel 8a' },
    { make: 'Google',    model: 'Pixel 7 Pro' },
    { make: 'Apple',     model: 'iPhone 16 Pro Max' },
    { make: 'Apple',     model: 'iPhone 16 Pro' },
    { make: 'Apple',     model: 'iPhone 15 Pro Max' },
    { make: 'Apple',     model: 'iPhone 15 Pro' },
    { make: 'Apple',     model: 'iPhone 14 Pro' },
    { make: 'samsung',   model: 'SM-S928B' },   // Galaxy S24 Ultra
    { make: 'samsung',   model: 'SM-S926B' },   // Galaxy S24+
    { make: 'samsung',   model: 'SM-S921B' },   // Galaxy S24
    { make: 'samsung',   model: 'SM-S918B' },   // Galaxy S23 Ultra
    { make: 'Xiaomi',    model: '2311DRK48C' }, // Xiaomi 14 Pro
    { make: 'Xiaomi',    model: '23113RKC6G' }, // Xiaomi 14
    { make: 'OnePlus',   model: 'CPH2581' },    // OnePlus 12
    { make: 'HUAWEI',    model: 'ALN-AL80' },   // Mate 60 Pro
    { make: 'Sony',      model: 'XQ-DQ72' },    // Xperia 1 VI
    { make: 'Canon',     model: 'Canon EOS R6 Mark II' },
    { make: 'NIKON CORPORATION', model: 'NIKON Z6 III' },
    { make: 'SONY',      model: 'ILCE-7M4' },   // Alpha A7 IV
];

// ── IANA Timezone → UTC offset map (common zones) ──
const TZ_OFFSETS = {
    'Pacific/Midway': -11, 'Pacific/Honolulu': -10, 'America/Anchorage': -9,
    'America/Los_Angeles': -8, 'America/Denver': -7, 'America/Chicago': -6,
    'America/New_York': -5, 'America/Halifax': -4, 'America/Sao_Paulo': -3,
    'Atlantic/South_Georgia': -2, 'Atlantic/Azores': -1, 'UTC': 0,
    'Europe/London': 0, 'Europe/Paris': 1, 'Europe/Berlin': 1,
    'Europe/Helsinki': 2, 'Europe/Moscow': 3, 'Asia/Dubai': 4,
    'Asia/Karachi': 5, 'Asia/Kolkata': 5.5, 'Asia/Dhaka': 6,
    'Asia/Bangkok': 7, 'Asia/Ho_Chi_Minh': 7, 'Asia/Jakarta': 7,
    'Asia/Shanghai': 8, 'Asia/Hong_Kong': 8, 'Asia/Singapore': 8,
    'Asia/Tokyo': 9, 'Asia/Seoul': 9, 'Australia/Sydney': 10,
    'Pacific/Auckland': 12,
};

// ── State ──
let GEO = null;   // { lat, lng, country, state, city, zip, street, display }
let TZ  = null;   // { name, utcOffset, localTime }
let CAM = null;   // { make, model }
let DT  = null;   // Date object for the "photo moment"

// ── Geocoding cache ──
const CACHE = new Map();

// ═══════════════════════════════════════════
//  GEOCODING — Nominatim (OpenStreetMap)
// ═══════════════════════════════════════════

async function geocode(address) {
    if (CACHE.has(address)) return CACHE.get(address);

    const url = 'https://nominatim.openstreetmap.org/search'
        + '?q=' + encodeURIComponent(address)
        + '&format=json&addressdetails=1&limit=1';

    const res = await fetch(url, {
        headers: { 'User-Agent': 'ExifGeneratorTool/1.0' }
    });

    if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);

    const data = await res.json();
    if (!data || data.length === 0) throw new Error('Address not found');

    const r = data[0];
    const a = r.address || {};

    const result = {
        lat:     parseFloat(r.lat),
        lng:     parseFloat(r.lon),
        country: a.country || a.country_code?.toUpperCase() || '—',
        countryCode: (a.country_code || '').toUpperCase(),
        state:   a.state || a.province || a.region || '—',
        city:    a.city || a.town || a.village || a.municipality || a.county || '—',
        zip:     a.postcode || '—',
        street:  buildStreet(a),
        display: r.display_name || address,
    };

    CACHE.set(address, result);
    return result;
}

function buildStreet(a) {
    const parts = [];
    if (a.house_number) parts.push(a.house_number);
    if (a.road) parts.push(a.road);
    if (a.neighbourhood) parts.push(a.neighbourhood);
    if (a.suburb) parts.push(a.suburb);
    return parts.join(', ') || '—';
}

// ═══════════════════════════════════════════
//  TIMEZONE — approximate from longitude
// ═══════════════════════════════════════════

function getTimezone(lat, lng, countryCode) {
    // Try to find a known timezone for the country
    const tzName = guessTimezone(lat, lng, countryCode);
    const offset = TZ_OFFSETS[tzName] ?? Math.round(lng / 15);

    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const local = new Date(utcMs + offset * 3600000);

    return {
        name: tzName,
        utcOffset: offset,
        utcOffsetStr: formatOffset(offset),
        localTime: formatTime(local),
        localDate: local,
    };
}

function guessTimezone(lat, lng, cc) {
    // Country-specific timezone logic for accuracy
    const map = {
        'US': () => {
            if (lng < -135) return 'America/Anchorage';
            if (lng < -115) return 'America/Los_Angeles';
            if (lng < -100) return 'America/Denver';
            if (lng < -85)  return 'America/Chicago';
            return 'America/New_York';
        },
        'CA': () => {
            if (lng < -120) return 'America/Los_Angeles';
            if (lng < -100) return 'America/Denver';
            if (lng < -80)  return 'America/Chicago';
            return 'America/New_York';
        },
        'JP': () => 'Asia/Tokyo',
        'KR': () => 'Asia/Seoul',
        'CN': () => 'Asia/Shanghai',
        'HK': () => 'Asia/Hong_Kong',
        'SG': () => 'Asia/Singapore',
        'TH': () => 'Asia/Bangkok',
        'VN': () => 'Asia/Ho_Chi_Minh',
        'ID': () => 'Asia/Jakarta',
        'IN': () => 'Asia/Kolkata',
        'PK': () => 'Asia/Karachi',
        'AE': () => 'Asia/Dubai',
        'RU': () => 'Europe/Moscow',
        'GB': () => 'Europe/London',
        'DE': () => 'Europe/Berlin',
        'FR': () => 'Europe/Paris',
        'AU': () => 'Australia/Sydney',
        'NZ': () => 'Pacific/Auckland',
        'BR': () => 'America/Sao_Paulo',
    };

    if (map[cc]) return map[cc]();

    // Fallback: estimate from longitude
    const rawOffset = Math.round(lng / 15);
    const match = Object.entries(TZ_OFFSETS).find(([, v]) => v === rawOffset);
    return match ? match[0] : `UTC${formatOffset(rawOffset)}`;
}

function formatOffset(offset) {
    const sign = offset >= 0 ? '+' : '-';
    const abs = Math.abs(offset);
    const h = Math.floor(abs);
    const m = (abs - h) * 60;
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatTime(d) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

// ═══════════════════════════════════════════
//  COORDINATE CONVERSION — Decimal → DMS
// ═══════════════════════════════════════════

function decToDMS(decimal) {
    const abs = Math.abs(decimal);
    const deg = Math.floor(abs);
    const minFull = (abs - deg) * 60;
    const min = Math.floor(minFull);
    const sec = ((minFull - min) * 60).toFixed(4);
    return { deg, min, sec: parseFloat(sec), minDecimal: minFull.toFixed(7) };
}

function formatDMS(decimal) {
    const { deg, minDecimal } = decToDMS(decimal);
    return `${deg}° ${minDecimal}'`;
}

function formatDMSFull(decimal) {
    const { deg, min, sec } = decToDMS(decimal);
    return `${deg}° ${min}' ${sec}"`;
}

// ═══════════════════════════════════════════
//  EXIF DATE FORMAT
// ═══════════════════════════════════════════

function formatExifDate(d) {
    if (!d) return '—';
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${y}:${mo}:${dy} ${hh}:${mm}:${ss}`;
}

function formatGPSTime(d) {
    if (!d) return '—';
    // GPS time is always UTC
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

// ═══════════════════════════════════════════
//  MAIN PARSE FLOW
// ═══════════════════════════════════════════

async function parseAddress() {
    const input = document.getElementById('address-input').value.trim();
    if (!input) { toast('Paste an address first', 'warning'); return; }

    const statusBar = document.getElementById('status-bar');
    const btn = document.getElementById('btn-parse');

    // Loading state
    btn.disabled = true;
    statusBar.className = 'status-bar loading';
    statusBar.innerHTML = '<div class="spinner"></div> Geocoding address...';

    try {
        // Step 1: Geocode
        GEO = await geocode(input);

        // Step 2: Timezone
        statusBar.innerHTML = '<div class="spinner"></div> Resolving timezone...';
        TZ = getTimezone(GEO.lat, GEO.lng, GEO.countryCode);

        // Step 3: Set default camera and time
        if (!CAM) randomCamera();
        if (!DT) setCurrentTime();

        // Step 4: Render everything
        renderLocation();
        renderTimezone();
        renderCameraSelector();
        updateOutput();

        // Show all sections
        ['section-location', 'section-timezone', 'section-camera', 'section-exif', 'section-gps']
            .forEach(id => document.getElementById(id).classList.remove('hidden'));

        document.getElementById('section-address').classList.add('active');
        statusBar.className = 'status-bar success';
        statusBar.textContent = '✓ Address parsed successfully';
        toast('Address parsed — all fields generated', 'success');

    } catch (err) {
        statusBar.className = 'status-bar error';
        statusBar.textContent = '✗ ' + err.message;
        toast(err.message, 'error');
    } finally {
        btn.disabled = false;
    }
}

// ═══════════════════════════════════════════
//  RENDER FUNCTIONS
// ═══════════════════════════════════════════

function renderLocation() {
    if (!GEO) return;

    const latRef = GEO.lat >= 0 ? 'North' : 'South';
    const lngRef = GEO.lng >= 0 ? 'East' : 'West';

    document.getElementById('loc-grid').innerHTML = `
        <div class="loc-item"><span class="loc-label">Country</span><span class="loc-value">${GEO.country}</span></div>
        <div class="loc-item"><span class="loc-label">State</span><span class="loc-value">${GEO.state}</span></div>
        <div class="loc-item"><span class="loc-label">City</span><span class="loc-value">${GEO.city}</span></div>
        <div class="loc-item"><span class="loc-label">ZIP</span><span class="loc-value">${GEO.zip}</span></div>
        <div class="loc-item"><span class="loc-label">Street</span><span class="loc-value">${GEO.street}</span></div>
        <div class="loc-item"><span class="loc-label">Latitude</span><span class="loc-value highlight">${GEO.lat.toFixed(7)}</span></div>
        <div class="loc-item"><span class="loc-label">Longitude</span><span class="loc-value highlight">${GEO.lng.toFixed(7)}</span></div>
    `;

    document.getElementById('dir-badges').innerHTML = `
        <span class="dir-badge ${latRef.toLowerCase()}">${latRef}</span>
        <span class="dir-badge ${lngRef.toLowerCase()}">${lngRef}</span>
    `;
}

function renderTimezone() {
    if (!TZ) return;
    document.getElementById('tz-grid').innerHTML = `
        <div class="loc-item"><span class="loc-label">Timezone</span><span class="loc-value accent">${TZ.name}</span></div>
        <div class="loc-item"><span class="loc-label">UTC Offset</span><span class="loc-value accent">UTC ${TZ.utcOffsetStr}</span></div>
        <div class="loc-item"><span class="loc-label">Local Time</span><span class="loc-value accent">${TZ.localTime}</span></div>
    `;
}

function renderCameraSelector() {
    const sel = document.getElementById('camera-select');
    if (sel.options.length > 0) return; // Already populated

    CAMERAS.forEach((c, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${c.make} — ${c.model}`;
        sel.appendChild(opt);
    });

    // Select current camera
    if (CAM) {
        const idx = CAMERAS.findIndex(c => c.make === CAM.make && c.model === CAM.model);
        if (idx >= 0) sel.value = idx;
    }
}

function randomCamera() {
    const idx = Math.floor(Math.random() * CAMERAS.length);
    CAM = { ...CAMERAS[idx] };
    const sel = document.getElementById('camera-select');
    if (sel.options.length > 0) sel.value = idx;
    updateOutput();
}

function setCurrentTime() {
    DT = new Date();
    const input = document.getElementById('datetime-input');
    // Format for datetime-local input
    const y = DT.getFullYear();
    const mo = String(DT.getMonth() + 1).padStart(2, '0');
    const d = String(DT.getDate()).padStart(2, '0');
    const hh = String(DT.getHours()).padStart(2, '0');
    const mm = String(DT.getMinutes()).padStart(2, '0');
    const ss = String(DT.getSeconds()).padStart(2, '0');
    input.value = `${y}-${mo}-${d}T${hh}:${mm}:${ss}`;
    updateOutput();
}

// ═══════════════════════════════════════════
//  OUTPUT RENDERING
// ═══════════════════════════════════════════

function updateOutput() {
    // Read camera selection
    const selIdx = document.getElementById('camera-select').value;
    if (selIdx !== undefined && CAMERAS[selIdx]) {
        CAM = { ...CAMERAS[selIdx] };
    }

    // Read datetime
    const dtVal = document.getElementById('datetime-input').value;
    if (dtVal) DT = new Date(dtVal);

    renderExifTable();
    renderGPSTable();
}

function renderExifTable() {
    if (!CAM || !DT) return;

    const exifDate = formatExifDate(DT);
    const fields = [
        ['Camera Manufacturer', CAM.make],
        ['Camera Model',        CAM.model],
        ['Date Time',           exifDate],
        ['Date Time Original',  exifDate],
        ['Date Time Digitized', exifDate],
    ];

    document.getElementById('exif-table').innerHTML = fields.map(([name, value], i) => `
        <tr>
            <td class="field-name">${name}</td>
            <td class="field-value">
                <input class="edit-field" id="exif-${i}" value="${escapeHtml(value)}"
                       onfocus="this.select()">
            </td>
        </tr>
    `).join('');
}

function renderGPSTable() {
    if (!GEO || !DT) return;

    const latRef  = GEO.lat >= 0 ? 'North latitude' : 'South latitude';
    const lngRef  = GEO.lng >= 0 ? 'East longitude' : 'West longitude';
    const latDMS  = formatDMS(GEO.lat);
    const lngDMS  = formatDMS(Math.abs(GEO.lng));
    const gpsTime = formatGPSTime(DT);

    const fields = [
        ['LatitudeRef',  latRef],
        ['Latitude',     latDMS],
        ['LongitudeRef', lngRef],
        ['Longitude',    lngDMS],
        ['GPS Time',     gpsTime],
    ];

    document.getElementById('gps-table').innerHTML = fields.map(([name, value], i) => `
        <tr>
            <td class="field-name">${name}</td>
            <td class="field-value">
                <input class="edit-field" id="gps-${i}" value="${escapeHtml(value)}"
                       onfocus="this.select()">
            </td>
        </tr>
    `).join('');
}

// ═══════════════════════════════════════════
//  COPY FUNCTIONS
// ═══════════════════════════════════════════

function collectFields() {
    const fields = {};
    // Collect EXIF fields
    const exifNames = ['Camera Manufacturer', 'Camera Model', 'Date Time', 'Date Time Original', 'Date Time Digitized'];
    exifNames.forEach((name, i) => {
        const el = document.getElementById(`exif-${i}`);
        if (el) fields[name] = el.value;
    });
    // Collect GPS fields
    const gpsNames = ['LatitudeRef', 'Latitude', 'LongitudeRef', 'Longitude', 'GPS Time'];
    gpsNames.forEach((name, i) => {
        const el = document.getElementById(`gps-${i}`);
        if (el) fields[name] = el.value;
    });
    return fields;
}

function copyAll() {
    const f = collectFields();
    const lines = [
        '═══ EXIF ═══',
        `Camera Manufacturer: ${f['Camera Manufacturer']}`,
        `Camera Model:        ${f['Camera Model']}`,
        `Date Time:           ${f['Date Time']}`,
        `Date Time Original:  ${f['Date Time Original']}`,
        `Date Time Digitized: ${f['Date Time Digitized']}`,
        '',
        '═══ GPS ═══',
        `LatitudeRef:  ${f['LatitudeRef']}`,
        `Latitude:     ${f['Latitude']}`,
        `LongitudeRef: ${f['LongitudeRef']}`,
        `Longitude:    ${f['Longitude']}`,
        `GPS Time:     ${f['GPS Time']}`,
    ];

    if (GEO) {
        lines.push('', '═══ LOCATION ═══');
        lines.push(`Country:  ${GEO.country}`);
        lines.push(`State:    ${GEO.state}`);
        lines.push(`City:     ${GEO.city}`);
        lines.push(`ZIP:      ${GEO.zip}`);
        lines.push(`Street:   ${GEO.street}`);
        lines.push(`Lat/Lng:  ${GEO.lat.toFixed(7)}, ${GEO.lng.toFixed(7)}`);
    }

    navigator.clipboard.writeText(lines.join('\n'))
        .then(() => toast('Copied to clipboard', 'success'))
        .catch(() => toast('Copy failed', 'error'));
}

function copyForTool() {
    const f = collectFields();
    // Format compatible with ExifTool command line
    const lines = [
        `-Make="${f['Camera Manufacturer']}"`,
        `-Model="${f['Camera Model']}"`,
        `-DateTimeOriginal="${f['Date Time Original']}"`,
        `-CreateDate="${f['Date Time Digitized']}"`,
        `-ModifyDate="${f['Date Time']}"`,
        `-GPSLatitudeRef="${f['LatitudeRef'] === 'North latitude' ? 'N' : 'S'}"`,
        `-GPSLatitude="${f['Latitude']}"`,
        `-GPSLongitudeRef="${f['LongitudeRef'] === 'East longitude' ? 'E' : 'W'}"`,
        `-GPSLongitude="${f['Longitude']}"`,
        `-GPSTimeStamp="${f['GPS Time']}"`,
    ];

    navigator.clipboard.writeText('exiftool ' + lines.join(' '))
        .then(() => toast('ExifTool command copied', 'success'))
        .catch(() => toast('Copy failed', 'error'));
}

// ═══════════════════════════════════════════
//  RESET
// ═══════════════════════════════════════════

function resetAll() {
    GEO = null;
    TZ = null;
    CAM = null;
    DT = null;

    document.getElementById('address-input').value = '';
    document.getElementById('status-bar').className = 'status-bar';
    document.getElementById('status-bar').textContent = '';
    document.getElementById('section-address').classList.remove('active');

    ['section-location', 'section-timezone', 'section-camera', 'section-exif', 'section-gps']
        .forEach(id => document.getElementById(id).classList.add('hidden'));

    toast('All fields reset', 'warning');
}

// ═══════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2500);
}

// ── Enter key to parse ──
document.getElementById('address-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') parseAddress();
});
