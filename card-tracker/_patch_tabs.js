/**
 * Patch: Remove old Workspace, rename All Cards → Workspace
 * Add flag emoji before BIN, add Country column
 */
const fs = require('fs');
const path = require('path');

const APP_FILE = path.join(__dirname, 'app.js');
const HTML_FILE = path.join(__dirname, 'index.html');

let app = fs.readFileSync(APP_FILE, 'utf8');
let html = fs.readFileSync(HTML_FILE, 'utf8');

// ════════════════════════════════════════════════
// 1) HTML — Remove old Workspace tab, rename All Cards → Workspace
// ════════════════════════════════════════════════
html = html.replace(
    '<a class="tn-tab active" data-view="cards" href="#workspace">Workspace</a>',
    ''
);
html = html.replace(
    '<a class="tn-tab" data-view="all-cards" href="#all-cards">All Cards</a>',
    '<a class="tn-tab active" data-view="all-cards" href="#workspace">Workspace</a>'
);
console.log('✓ HTML tabs updated');

// ════════════════════════════════════════════════
// 2) APP.JS — Update title for all-cards view
// ════════════════════════════════════════════════
// Line ~6488: titleEl.textContent = 'All Cards'; → 'Workspace'
app = app.replace(
    "titleEl.textContent = 'All Cards';",
    "titleEl.textContent = 'Workspace';"
);
console.log('✓ Title updated');

// ════════════════════════════════════════════════
// 3) APP.JS — Update hash routing: all-cards maps to 'workspace' hash
// ════════════════════════════════════════════════
// 'all-cards':     'all-cards', → 'all-cards': 'workspace'
app = app.replace(
    "'all-cards':     'all-cards',",
    "'all-cards':     'workspace',"
);
// Remove old workspace → cards mapping
app = app.replace(
    "'workspace':     'cards',",
    ""
);
console.log('✓ Hash routing updated');

// ════════════════════════════════════════════════
// 4) APP.JS — Make all-cards the default view on load
// ════════════════════════════════════════════════
// When hash is empty or #workspace, navigate to all-cards
// Find the HASH_TO_VIEW mapping and update
// 'workspace' should map to 'all-cards' now
const hashViewLine = "const h = VIEW_TO_HASH[view] || 'workspace';";
if (app.includes(hashViewLine)) {
    // This is fine - it will produce #workspace for unknown views
}

// Find hashToView function or HASH_TO_VIEW mapping
// The hash routing converts hash → view via a switch or map
// Let's find the reverse mapping (hash → view)
const hashMatch = app.match(/'workspace'\s*:\s*'cards'/);
if (hashMatch) {
    // Already removed above - need to add workspace→all-cards
}

// Find the parseHash function that converts URL hash to view
const parseHashIdx = app.indexOf("function parseHash(");
if (parseHashIdx !== -1) {
    console.log('Found parseHash at index', parseHashIdx);
}

// ════════════════════════════════════════════════
// 5) APP.JS — Add flag emoji + country column to renderAllCards
// ════════════════════════════════════════════════

// 5a) In BIN header row - add isoToFlag before BIN number, add country column
app = app.replace(
    `<span class="flag">\${countryFlags}</span>
                        <span class="bin-group-bin">\${bin}</span>`,
    `<span class="bin-group-bin">\${countryFlags} \${bin}</span>`
);

// 5b) Replace the countryFlags logic to use isoToFlag SVG
app = app.replace(
    `const countryFlags = [...new Set(cards.map(c => {
            const co = STATE.countries.find(co => co.id === c.country);
            return co ? co.flag : '';
        }))].filter(Boolean).join(' ');`,
    `const countryCode = (() => {
            const cached = BIN_CACHE[bin];
            if (cached && cached.country) return cached.country.toUpperCase();
            const firstCard = cards[0];
            if (firstCard.country && firstCard.country !== 'auto') return firstCard.country.toUpperCase();
            return '';
        })();
        const countryFlags = countryCode ? isoToFlag(countryCode) : '';`
);

// 5c) Add Country column header
app = app.replace(
    `<th>Card / BIN Group</th>
                    <th>BIN</th>`,
    `<th>Card / BIN Group</th>
                    <th>Country</th>
                    <th>BIN</th>`
);

// 5d) Add country cell to BIN header row (after card cell td, before bin-cell)
app = app.replace(
    `</td>
            <td class="bin-cell">\${bin}</td>
            <td class="use-cell" style="\${getUseColor(cardCount)}">\${cardCount}</td>
            <td class="use-cell" style="\${getUseColor(cardCount)}">\${cardCount}</td>`,
    `</td>
            <td class="country-cell">\${countryCode || '—'}</td>
            <td class="bin-cell">\${bin}</td>
            <td class="use-cell" style="\${getUseColor(cardCount)}">\${cardCount}</td>
            <td class="use-cell" style="\${getUseColor(cardCount)}">\${cardCount}</td>`
);

// 5e) Add country cell to child rows
app = app.replace(
    `</div>
                    </td>
                    <td class="bin-cell">\${bin}</td>
                    <td class="use-cell">1x</td>`,
    `</div>
                    </td>
                    <td class="country-cell">\${(c.country && c.country !== 'auto') ? c.country.toUpperCase() : (BIN_CACHE[bin]?.country?.toUpperCase() || '—')}</td>
                    <td class="bin-cell">\${bin}</td>
                    <td class="use-cell">1x</td>`
);

// 5f) Also update child row flag to use isoToFlag SVG
app = app.replace(
    "const flag = STATE.countries.find(co => co.id === c.country)?.flag || '';",
    `const _cCode = (c.country && c.country !== 'auto') ? c.country.toUpperCase() : (BIN_CACHE[bin]?.country?.toUpperCase() || '');
                const flag = _cCode ? isoToFlag(_cCode) : '';`
);

// 5g) Add brand badge to BIN info line
app = app.replace(
    "${binTxt ? `<span class=\"bin-info\">${binTxt}</span>` : ''}",
    "${binTxt ? `<span class=\"bin-info\">${binTxt}</span>` : ''} ${_brandIcon(BIN_CACHE[bin]?.brand, cards[0].cardNumber)}"
);

console.log('✓ Flag emoji + Country column added to renderAllCards');

// ════════════════════════════════════════════════
// 6) APP.JS — Ensure navigate defaults to all-cards
// ════════════════════════════════════════════════
// Make sure the default view is 'all-cards' when hash is empty or 'workspace'
// Find where hash 'workspace' maps to view 'cards' and change to 'all-cards'
// This is in the parseHash or hashToView logic

// Look for the hash-to-view switch
const lines = app.split('\n');
for (let i = 0; i < lines.length; i++) {
    // Find lines that map 'workspace' hash to 'cards' view
    if (lines[i].includes("'workspace'") && lines[i].includes("'cards'") && !lines[i].includes('//')) {
        lines[i] = lines[i].replace("'cards'", "'all-cards'");
        console.log('✓ Fixed workspace→all-cards mapping at line', i);
    }
}
app = lines.join('\n');

// Also fix the default view in STATE initialization
app = app.replace(
    /currentView:\s*'cards'/,
    "currentView: 'all-cards'"
);
console.log('✓ Default view changed to all-cards');

// Write files
fs.writeFileSync(APP_FILE, app, 'utf8');
fs.writeFileSync(HTML_FILE, html, 'utf8');
console.log('✓ Files saved');

// Verify syntax
const { execSync } = require('child_process');
try {
    execSync('node --check "' + APP_FILE + '"', { stdio: 'pipe' });
    console.log('✓ SYNTAX OK');
} catch (e) {
    console.error('✗ SYNTAX ERROR:', e.stderr.toString().substring(0, 500));
    process.exit(1);
}
