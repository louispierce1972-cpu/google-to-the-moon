/* ═══════════════════════════════════════════
   BIN TESTER — Test BINs for Google
   ═══════════════════════════════════════════ */

// BIN Tester persistent state
if (!STATE._bt) {
    try {
        const saved = localStorage.getItem('ct_bin_tester');
        STATE._bt = saved ? JSON.parse(saved) : null;
    } catch { STATE._bt = null; }
}
if (!STATE._bt) {
    STATE._bt = {
        cards: [],        // All loaded cards: { id, num, mm, yy, cvv, bin, status: null }
        workCards: [],     // Cards taken to work: { id, num, mm, yy, cvv, bin, status: 'pending'|'added'|'failed'|'blocked' }
        history: [],       // History of completed batches
        view: 'load',     // 'load' | 'bins' | 'work' | 'results'
    };
}

function _btSave() {
    try {
        localStorage.setItem('ct_bin_tester', JSON.stringify(STATE._bt));
    } catch { /* quota */ }
}

function _btParseLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    const parts = trimmed.split(/[\s|:;,]+/);
    let cardNum = null, mm = '', yy = '', cvv = '';
    for (let i = 0; i < parts.length; i++) {
        const clean = parts[i].replace(/[-\.]/g, '');
        if (!cardNum && /^\d{13,19}$/.test(clean)) {
            cardNum = clean;
            if (parts[i+1] && /^\d{1,2}$/.test(parts[i+1])) mm = parts[i+1].padStart(2,'0');
            if (parts[i+2] && /^\d{2,4}$/.test(parts[i+2])) {
                yy = parts[i+2]; if (yy.length===4) yy = yy.slice(2);
            }
            if (parts[i+3] && /^\d{3,4}$/.test(parts[i+3])) cvv = parts[i+3];
            break;
        }
    }
    if (!cardNum) return null;
    const bin = cardNum.slice(0, 6);
    return { id: 'bt_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), num: cardNum, mm, yy, cvv, bin, status: null };
}

function renderBinTester() {
    const area = document.getElementById('content-area');
    const bt = STATE._bt;

    // Get BIN groups
    const binGroups = {};
    bt.cards.forEach(c => {
        if (!binGroups[c.bin]) binGroups[c.bin] = [];
        binGroups[c.bin].push(c);
    });
    const binEntries = Object.entries(binGroups).sort((a,b) => b[1].length - a[1].length);
    const totalCards = bt.cards.length;
    const totalBins = binEntries.length;

    // Work stats
    const workTotal = bt.workCards.length;
    const workAdded = bt.workCards.filter(c => c.status === 'added').length;
    const workFailed = bt.workCards.filter(c => c.status === 'failed').length;
    const workBlocked = bt.workCards.filter(c => c.status === 'blocked').length;
    const workPending = bt.workCards.filter(c => c.status === 'pending').length;

    // BIN results from history + current work
    const binResults = {};
    [...bt.history, ...bt.workCards.filter(c => c.status && c.status !== 'pending')].forEach(c => {
        if (!binResults[c.bin]) binResults[c.bin] = { added: 0, failed: 0, blocked: 0, total: 0 };
        binResults[c.bin].total++;
        if (c.status === 'added') binResults[c.bin].added++;
        if (c.status === 'failed') binResults[c.bin].failed++;
        if (c.status === 'blocked') binResults[c.bin].blocked++;
    });

    let html = `<div class="bt-page">`;

    // ── HEADER TOOLBAR ──
    html += `<div class="bt-toolbar">
        <div class="bt-toolbar-left">
            <span class="bt-title">🧪 BIN TESTER</span>
            <span class="bt-subtitle">Test BINs for Google</span>
        </div>
        <div class="bt-toolbar-right">
            <span class="bt-stat-pill"><span class="bt-stat-num">${totalCards}</span> cards</span>
            <span class="bt-stat-pill"><span class="bt-stat-num">${totalBins}</span> BINs</span>
            ${workTotal > 0 ? `<span class="bt-stat-pill bt-pill-work"><span class="bt-stat-num">${workTotal}</span> in work</span>` : ''}
            <button class="bt-btn bt-btn-reset" id="bt-reset">🗑 Reset All</button>
        </div>
    </div>`;

    // ── TAB BAR ──
    html += `<div class="bt-tab-bar">
        <button class="bt-tab ${bt.view==='load'?'active':''}" data-btview="load">📥 Load Base</button>
        <button class="bt-tab ${bt.view==='bins'?'active':''}" data-btview="bins" ${totalCards===0?'disabled':''}>📊 BINs (${totalBins})</button>
        <button class="bt-tab ${bt.view==='work'?'active':''}" data-btview="work" ${workTotal===0?'disabled':''}>⚡ Work (${workTotal})</button>
        <button class="bt-tab ${bt.view==='results'?'active':''}" data-btview="results" ${Object.keys(binResults).length===0?'disabled':''}>📈 Results</button>
    </div>`;

    // ── VIEWS ──
    if (bt.view === 'load') {
        html += _btRenderLoad(totalCards, totalBins);
    } else if (bt.view === 'bins') {
        html += _btRenderBins(binEntries, binResults);
    } else if (bt.view === 'work') {
        html += _btRenderWork(bt.workCards, workAdded, workFailed, workBlocked, workPending);
    } else if (bt.view === 'results') {
        html += _btRenderResults(binResults, binEntries);
    }

    html += `</div>`;
    area.innerHTML = html;

    // ── EVENT HANDLERS ──
    _btBindEvents(binGroups);
}

function _btRenderLoad(totalCards, totalBins) {
    return `<div class="bt-section">
        <div class="bt-load-area">
            <div class="bt-load-icon">📥</div>
            <h3 class="bt-load-title">Load Card Base</h3>
            <p class="bt-load-desc">Paste cards (one per line) or load from file</p>
            <textarea id="bt-input" class="bt-textarea" rows="10" placeholder="4242424242424242 12 28 123&#10;5555555555554444 03 27 456&#10;4111111111111111 05 26 789&#10;&#10;Format: NUMBER MM YY CVV"></textarea>
            <div class="bt-load-actions">
                <label class="bt-btn bt-btn-file">
                    📁 Load .txt
                    <input type="file" id="bt-file-input" accept=".txt" hidden>
                </label>
                <button class="bt-btn bt-btn-primary" id="bt-load-cards">⚡ Load Cards</button>
                <span id="bt-load-count" class="bt-load-count">${totalCards > 0 ? `${totalCards} cards loaded (${totalBins} BINs)` : ''}</span>
            </div>
        </div>
    </div>`;
}

function _btRenderBins(binEntries, binResults) {
    if (binEntries.length === 0) {
        return `<div class="bt-empty">No cards loaded. Go to Load Base tab first.</div>`;
    }
    let html = `<div class="bt-section">
        <div class="bt-bins-header">
            <span class="bt-bins-title">BIN Groups</span>
            <div class="bt-bins-actions">
                <button class="bt-btn bt-btn-sm" id="bt-select-all-bins">Select All</button>
                <button class="bt-btn bt-btn-sm" id="bt-deselect-all-bins">Deselect All</button>
                <input type="number" id="bt-take-count" class="bt-take-input" value="1" min="1" max="50" title="Cards per BIN to take">
                <span class="bt-take-label">per BIN</span>
                <button class="bt-btn bt-btn-primary bt-btn-take" id="bt-take-to-work">⚡ Take to Work</button>
            </div>
        </div>
        <div class="bt-bins-grid">`;

    binEntries.forEach(([bin, cards]) => {
        const cached = typeof BIN_CACHE !== 'undefined' ? BIN_CACHE[bin] : null;
        const bankName = cached ? (cached.bank || 'Unknown') : '—';
        const brand = cached ? (cached.brand || '') : '';
        const type = cached ? (cached.type || '') : '';
        const country = cached ? (cached.country || '') : '';
        const res = binResults[bin];
        const testedCount = res ? res.total : 0;
        const successRate = res && res.total > 0 ? Math.round((res.added / res.total) * 100) : null;
        
        let statusBadge = '';
        if (successRate !== null) {
            const cls = successRate >= 70 ? 'bt-rate-good' : successRate >= 30 ? 'bt-rate-mid' : 'bt-rate-bad';
            statusBadge = `<span class="bt-bin-rate ${cls}">${successRate}%</span>`;
        }

        // Count available cards (not yet in work or history)
        const workNums = new Set(STATE._bt.workCards.map(c => c.num));
        const histNums = new Set(STATE._bt.history.map(c => c.num));
        const available = cards.filter(c => !workNums.has(c.num) && !histNums.has(c.num)).length;

        html += `<div class="bt-bin-card" data-bin="${bin}">
            <label class="bt-bin-check-wrap">
                <input type="checkbox" class="bt-bin-cb" data-bin="${bin}" ${available === 0 ? 'disabled' : ''}>
                <div class="bt-bin-info">
                    <div class="bt-bin-top">
                        <span class="bt-bin-number">${bin}</span>
                        ${statusBadge}
                        ${brand ? `<span class="bt-bin-brand">${brand}</span>` : ''}
                    </div>
                    <div class="bt-bin-bank">${bankName}</div>
                    <div class="bt-bin-meta">
                        ${type ? `<span class="bt-bin-tag">${type}</span>` : ''}
                        ${country ? `<span class="bt-bin-tag">${country}</span>` : ''}
                        <span class="bt-bin-count">${cards.length} cards</span>
                        <span class="bt-bin-avail">${available} avail</span>
                        ${testedCount > 0 ? `<span class="bt-bin-tested">tested: ${testedCount}</span>` : ''}
                    </div>
                </div>
            </label>
        </div>`;
    });

    html += `</div></div>`;
    return html;
}

function _btRenderWork(workCards, added, failed, blocked, pending) {
    let html = `<div class="bt-section">
        <div class="bt-work-header">
            <div class="bt-work-stats">
                <span class="bt-ws bt-ws-total">${workCards.length} total</span>
                <span class="bt-ws bt-ws-pending">${pending} pending</span>
                <span class="bt-ws bt-ws-added">${added} added</span>
                <span class="bt-ws bt-ws-failed">${failed} failed</span>
                <span class="bt-ws bt-ws-blocked">${blocked} blocked</span>
            </div>
            <div class="bt-work-actions">
                <button class="bt-btn bt-btn-sm" id="bt-copy-work">📋 Copy Cards</button>
                <button class="bt-btn bt-btn-sm bt-btn-finish" id="bt-finish-work" ${pending > 0 ? '' : ''}>✅ Finish Batch</button>
                <button class="bt-btn bt-btn-sm bt-btn-danger" id="bt-cancel-work">✕ Cancel</button>
            </div>
        </div>
        <div class="bt-work-list">`;

    // Group work cards by BIN
    const workBins = {};
    workCards.forEach((c, idx) => {
        if (!workBins[c.bin]) workBins[c.bin] = [];
        workBins[c.bin].push({ ...c, _idx: idx });
    });

    Object.entries(workBins).forEach(([bin, cards]) => {
        const cached = typeof BIN_CACHE !== 'undefined' ? BIN_CACHE[bin] : null;
        const bankName = cached ? (cached.bank || 'Unknown') : '—';
        html += `<div class="bt-work-bin-group">
            <div class="bt-work-bin-header">
                <span class="bt-work-bin-num">${bin}</span>
                <span class="bt-work-bin-bank">${bankName}</span>
                <span class="bt-work-bin-cnt">${cards.length} cards</span>
            </div>`;
        
        cards.forEach(c => {
            const masked = c.num.slice(0,6) + '••••' + c.num.slice(-4);
            const statusCls = c.status === 'added' ? 'bt-st-added' : c.status === 'failed' ? 'bt-st-failed' : c.status === 'blocked' ? 'bt-st-blocked' : 'bt-st-pending';
            html += `<div class="bt-work-row ${statusCls}" data-idx="${c._idx}">
                <span class="bt-work-card-num">${masked}</span>
                <span class="bt-work-exp">${c.mm}/${c.yy}</span>
                <div class="bt-status-btns">
                    <button class="bt-sbtn bt-sbtn-added ${c.status==='added'?'active':''}" data-idx="${c._idx}" data-status="added" title="Added to Google">✅</button>
                    <button class="bt-sbtn bt-sbtn-failed ${c.status==='failed'?'active':''}" data-idx="${c._idx}" data-status="failed" title="Not added">❌</button>
                    <button class="bt-sbtn bt-sbtn-blocked ${c.status==='blocked'?'active':''}" data-idx="${c._idx}" data-status="blocked" title="Card blocked">🚫</button>
                    <button class="bt-sbtn bt-sbtn-pending ${c.status==='pending'?'active':''}" data-idx="${c._idx}" data-status="pending" title="Reset to pending">⏳</button>
                </div>
            </div>`;
        });
        html += `</div>`;
    });

    html += `</div></div>`;
    return html;
}

function _btRenderResults(binResults, binEntries) {
    const entries = Object.entries(binResults).sort((a,b) => {
        const rateA = a[1].total > 0 ? a[1].added / a[1].total : 0;
        const rateB = b[1].total > 0 ? b[1].added / b[1].total : 0;
        return rateB - rateA;
    });

    if (entries.length === 0) {
        return `<div class="bt-empty">No results yet. Take cards to work and mark their statuses.</div>`;
    }

    // Overall stats
    let totalTested = 0, totalAdded = 0, totalFailed = 0, totalBlocked = 0;
    entries.forEach(([, r]) => { totalTested += r.total; totalAdded += r.added; totalFailed += r.failed; totalBlocked += r.blocked; });
    const overallRate = totalTested > 0 ? Math.round((totalAdded / totalTested) * 100) : 0;

    let html = `<div class="bt-section">
        <div class="bt-results-summary">
            <div class="bt-rs-card"><span class="bt-rs-label">Tested</span><span class="bt-rs-value">${totalTested}</span></div>
            <div class="bt-rs-card bt-rs-added"><span class="bt-rs-label">Added</span><span class="bt-rs-value">${totalAdded}</span></div>
            <div class="bt-rs-card bt-rs-failed"><span class="bt-rs-label">Failed</span><span class="bt-rs-value">${totalFailed}</span></div>
            <div class="bt-rs-card bt-rs-blocked"><span class="bt-rs-label">Blocked</span><span class="bt-rs-value">${totalBlocked}</span></div>
            <div class="bt-rs-card bt-rs-rate"><span class="bt-rs-label">Success</span><span class="bt-rs-value">${overallRate}%</span></div>
        </div>
        <div class="bt-results-actions">
            <button class="bt-btn bt-btn-sm" id="bt-copy-good-bins">📋 Copy Working BINs</button>
            <button class="bt-btn bt-btn-sm" id="bt-export-results">📤 Export to Notes</button>
            <button class="bt-btn bt-btn-sm bt-btn-danger" id="bt-clear-history">🗑 Clear History</button>
        </div>
        <div class="bt-results-table">
            <div class="bt-rt-header">
                <span class="bt-rt-h">BIN</span>
                <span class="bt-rt-h">Bank</span>
                <span class="bt-rt-h">Tested</span>
                <span class="bt-rt-h">Added</span>
                <span class="bt-rt-h">Failed</span>
                <span class="bt-rt-h">Blocked</span>
                <span class="bt-rt-h">Rate</span>
            </div>`;

    entries.forEach(([bin, r]) => {
        const rate = r.total > 0 ? Math.round((r.added / r.total) * 100) : 0;
        const cls = rate >= 70 ? 'bt-rate-good' : rate >= 30 ? 'bt-rate-mid' : 'bt-rate-bad';
        const cached = typeof BIN_CACHE !== 'undefined' ? BIN_CACHE[bin] : null;
        const bank = cached ? (cached.bank || '—') : '—';
        const shortBank = bank.length > 22 ? bank.slice(0,22) + '…' : bank;
        const barW = Math.max(rate, 3);
        html += `<div class="bt-rt-row">
            <span class="bt-rt-bin">${bin}</span>
            <span class="bt-rt-bank">${shortBank}</span>
            <span class="bt-rt-val">${r.total}</span>
            <span class="bt-rt-val bt-rt-added">${r.added}</span>
            <span class="bt-rt-val bt-rt-failed">${r.failed}</span>
            <span class="bt-rt-val bt-rt-blocked">${r.blocked}</span>
            <span class="bt-rt-rate-cell">
                <div class="bt-rt-bar"><div class="bt-rt-bar-fill ${cls}" style="width:${barW}%"></div></div>
                <span class="bt-rt-pct ${cls}">${rate}%</span>
            </span>
        </div>`;
    });

    html += `</div></div>`;
    return html;
}

function _btBindEvents(binGroups) {
    const bt = STATE._bt;

    // Tab switching
    document.querySelectorAll('.bt-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.disabled) return;
            bt.view = tab.dataset.btview;
            _btSave();
            renderBinTester();
        });
    });

    // Reset
    document.getElementById('bt-reset')?.addEventListener('click', () => {
        if (!confirm('Reset all BIN Tester data?')) return;
        STATE._bt = { cards: [], workCards: [], history: [], view: 'load' };
        _btSave();
        renderBinTester();
        toast('BIN Tester reset', 'success');
    });

    // Load cards
    document.getElementById('bt-load-cards')?.addEventListener('click', () => {
        const input = document.getElementById('bt-input');
        if (!input) return;
        const raw = input.value.trim();
        if (!raw) { toast('Paste cards first', 'info'); return; }
        const lines = raw.split('\n');
        let added = 0;
        const existingNums = new Set(bt.cards.map(c => c.num));
        lines.forEach(line => {
            const parsed = _btParseLine(line);
            if (parsed && !existingNums.has(parsed.num)) {
                bt.cards.push(parsed);
                existingNums.add(parsed.num);
                added++;
            }
        });
        if (added === 0) { toast('No new cards found', 'info'); return; }
        // Lookup BINs
        const uniqueBins = new Set(bt.cards.map(c => c.bin));
        uniqueBins.forEach(bin => { if (typeof lookupBin === 'function') lookupBin(bin); });
        _btSave();
        toast(`Loaded ${added} cards`, 'success');
        bt.view = 'bins';
        renderBinTester();
    });

    // File input
    document.getElementById('bt-file-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const ta = document.getElementById('bt-input');
            if (ta) ta.value = ev.target.result;
            toast(`File loaded: ${file.name}`, 'success');
        };
        reader.readAsText(file);
    });

    // Select all / deselect bins
    document.getElementById('bt-select-all-bins')?.addEventListener('click', () => {
        document.querySelectorAll('.bt-bin-cb:not(:disabled)').forEach(cb => cb.checked = true);
    });
    document.getElementById('bt-deselect-all-bins')?.addEventListener('click', () => {
        document.querySelectorAll('.bt-bin-cb').forEach(cb => cb.checked = false);
    });

    // Take to work
    document.getElementById('bt-take-to-work')?.addEventListener('click', () => {
        const checked = [...document.querySelectorAll('.bt-bin-cb:checked')].map(cb => cb.dataset.bin);
        if (checked.length === 0) { toast('Select BINs first', 'info'); return; }
        const countPerBin = parseInt(document.getElementById('bt-take-count')?.value || '1', 10);
        const workNums = new Set(bt.workCards.map(c => c.num));
        const histNums = new Set(bt.history.map(c => c.num));
        let taken = 0;
        checked.forEach(bin => {
            const available = bt.cards.filter(c => c.bin === bin && !workNums.has(c.num) && !histNums.has(c.num));
            const toTake = available.slice(0, countPerBin);
            toTake.forEach(card => {
                bt.workCards.push({ ...card, status: 'pending' });
                workNums.add(card.num);
                taken++;
            });
        });
        if (taken === 0) { toast('No available cards in selected BINs', 'info'); return; }
        bt.view = 'work';
        _btSave();
        toast(`Took ${taken} cards to work`, 'success');
        renderBinTester();
    });

    // Status buttons
    document.querySelectorAll('.bt-sbtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const status = btn.dataset.status;
            if (bt.workCards[idx]) {
                bt.workCards[idx].status = status;
                _btSave();
                renderBinTester();
            }
        });
    });

    // Copy work cards
    document.getElementById('bt-copy-work')?.addEventListener('click', () => {
        const lines = bt.workCards.map(c => `${c.num} ${c.mm} ${c.yy} ${c.cvv}`).join('\n');
        navigator.clipboard?.writeText(lines);
        toast(`Copied ${bt.workCards.length} cards`, 'success');
    });

    // Finish batch
    document.getElementById('bt-finish-work')?.addEventListener('click', () => {
        const done = bt.workCards.filter(c => c.status !== 'pending');
        if (done.length === 0) { toast('Mark card statuses first', 'info'); return; }
        bt.history.push(...done);
        bt.workCards = bt.workCards.filter(c => c.status === 'pending');
        if (bt.workCards.length === 0) bt.view = 'results';
        _btSave();
        toast(`Finished ${done.length} cards, moved to history`, 'success');
        renderBinTester();
    });

    // Cancel work
    document.getElementById('bt-cancel-work')?.addEventListener('click', () => {
        if (!confirm('Cancel current work batch?')) return;
        bt.workCards = [];
        bt.view = 'bins';
        _btSave();
        renderBinTester();
    });

    // Copy good BINs
    document.getElementById('bt-copy-good-bins')?.addEventListener('click', () => {
        const binResults = {};
        [...bt.history].forEach(c => {
            if (!binResults[c.bin]) binResults[c.bin] = { added: 0, total: 0 };
            binResults[c.bin].total++;
            if (c.status === 'added') binResults[c.bin].added++;
        });
        const good = Object.entries(binResults).filter(([,r]) => r.total > 0 && (r.added / r.total) >= 0.5).map(([bin]) => bin);
        if (good.length === 0) { toast('No working BINs found', 'info'); return; }
        navigator.clipboard?.writeText(good.join('\n'));
        toast(`Copied ${good.length} working BINs`, 'success');
    });

    // Export results to notes
    document.getElementById('bt-export-results')?.addEventListener('click', () => {
        const binResults = {};
        [...bt.history].forEach(c => {
            if (!binResults[c.bin]) binResults[c.bin] = { added: 0, failed: 0, blocked: 0, total: 0 };
            binResults[c.bin].total++;
            if (c.status === 'added') binResults[c.bin].added++;
            if (c.status === 'failed') binResults[c.bin].failed++;
            if (c.status === 'blocked') binResults[c.bin].blocked++;
        });
        const lines = ['BIN TESTER RESULTS', '═'.repeat(40), ''];
        Object.entries(binResults).sort((a,b) => (b[1].added/b[1].total) - (a[1].added/a[1].total)).forEach(([bin, r]) => {
            const rate = Math.round((r.added / r.total) * 100);
            const cached = typeof BIN_CACHE !== 'undefined' ? BIN_CACHE[bin] : null;
            const bank = cached ? (cached.bank || '?') : '?';
            lines.push(`${bin} | ${bank} | ${rate}% (${r.added}/${r.total}) | F:${r.failed} B:${r.blocked}`);
        });
        const content = lines.join('\n');
        STATE.notesTabs.unshift({ id: 'tab-bt-'+Date.now(), title: 'BIN Test Results', content, pinned: false, tag: null, created: Date.now(), scrollPos: 0 });
        STATE.notesActiveTab = STATE.notesTabs[0].id;
        if (typeof save === 'function') save();
        toast('Results exported to Notes', 'success');
    });

    // Clear history
    document.getElementById('bt-clear-history')?.addEventListener('click', () => {
        if (!confirm('Clear all test history?')) return;
        bt.history = [];
        _btSave();
        renderBinTester();
        toast('History cleared', 'success');
    });
}
