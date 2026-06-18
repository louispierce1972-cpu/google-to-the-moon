/* ═══════════════════════════════════════════
   BIN TESTER — Test BINs for Google v2
   ═══════════════════════════════════════════ */

// Persistent state
if (!STATE._bt) {
    try {
        const saved = localStorage.getItem('ct_bin_tester');
        STATE._bt = saved ? JSON.parse(saved) : null;
    } catch { STATE._bt = null; }
}
if (!STATE._bt) {
    STATE._bt = {
        cards: [],
        workCards: [],
        history: [],
        view: 'load',
    };
}

function _btSave() {
    try { localStorage.setItem('ct_bin_tester', JSON.stringify(STATE._bt)); } catch {}
}

function _btParseLine(line) {
    const t = line.trim();
    if (!t) return null;
    const parts = t.split(/[\s|:;,]+/);
    let num = null, mm = '', yy = '', cvv = '';
    for (let i = 0; i < parts.length; i++) {
        const c = parts[i].replace(/[-\.]/g, '');
        if (!num && /^\d{13,19}$/.test(c)) {
            num = c;
            if (parts[i+1] && /^\d{1,2}$/.test(parts[i+1])) mm = parts[i+1].padStart(2,'0');
            if (parts[i+2] && /^\d{2,4}$/.test(parts[i+2])) { yy = parts[i+2]; if (yy.length===4) yy=yy.slice(2); }
            if (parts[i+3] && /^\d{3,4}$/.test(parts[i+3])) cvv = parts[i+3];
            break;
        }
    }
    if (!num) return null;
    return { id: 'bt_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), num, mm, yy, cvv, bin: num.slice(0,6), status: null };
}

// Sets of nums already used
function _btUsedNums() {
    const s = new Set();
    STATE._bt.workCards.forEach(c => s.add(c.num));
    STATE._bt.history.forEach(c => s.add(c.num));
    return s;
}

function renderBinTester() {
    const area = document.getElementById('content-area');
    const bt = STATE._bt;
    const used = _btUsedNums();

    // BIN groups
    const binGroups = {};
    bt.cards.forEach(c => {
        if (!binGroups[c.bin]) binGroups[c.bin] = [];
        binGroups[c.bin].push(c);
    });
    const binEntries = Object.entries(binGroups).sort((a,b) => b[1].length - a[1].length);
    const totalCards = bt.cards.length;
    const totalBins = binEntries.length;
    const totalAvail = bt.cards.filter(c => !used.has(c.num)).length;

    // BIN results
    const binRes = {};
    bt.history.forEach(c => {
        if (!binRes[c.bin]) binRes[c.bin] = {added:0,failed:0,blocked:0,total:0};
        binRes[c.bin].total++;
        if (c.status==='added') binRes[c.bin].added++;
        if (c.status==='failed') binRes[c.bin].failed++;
        if (c.status==='blocked') binRes[c.bin].blocked++;
    });

    const wk = bt.workCards;
    const wAdded = wk.filter(c=>c.status==='added').length;
    const wFailed = wk.filter(c=>c.status==='failed').length;
    const wBlocked = wk.filter(c=>c.status==='blocked').length;
    const wPending = wk.filter(c=>c.status==='pending').length;

    let h = `<div class="bt-page">`;

    // Toolbar
    h += `<div class="bt-toolbar">
        <div class="bt-toolbar-left">
            <span class="bt-title">🧪 BIN TESTER</span>
        </div>
        <div class="bt-toolbar-right">
            <span class="bt-stat-pill"><b>${totalCards}</b> cards</span>
            <span class="bt-stat-pill"><b>${totalBins}</b> BINs</span>
            <span class="bt-stat-pill" style="color:var(--green)"><b>${totalAvail}</b> avail</span>
            ${wk.length?`<span class="bt-stat-pill bt-pill-work"><b>${wk.length}</b> in work</span>`:''}
            <button class="bt-btn bt-btn-reset" id="bt-reset">🗑 Reset</button>
        </div>
    </div>`;

    // Tabs
    h += `<div class="bt-tab-bar">
        <button class="bt-tab ${bt.view==='load'?'active':''}" data-btview="load">📥 Load</button>
        <button class="bt-tab ${bt.view==='bins'?'active':''}" data-btview="bins" ${totalCards===0?'disabled':''}>📊 BINs (${totalBins})</button>
        <button class="bt-tab ${bt.view==='work'?'active':''}" data-btview="work" ${wk.length===0?'disabled':''}>⚡ Work (${wk.length})</button>
        <button class="bt-tab ${bt.view==='results'?'active':''}" data-btview="results" ${bt.history.length===0?'disabled':''}>📈 Results (${bt.history.length})</button>
    </div>`;

    // Content
    if (bt.view === 'load') h += _btViewLoad(totalCards, totalBins, totalAvail);
    else if (bt.view === 'bins') h += _btViewBins(binEntries, binRes, used);
    else if (bt.view === 'work') h += _btViewWork(wk, wAdded, wFailed, wBlocked, wPending);
    else if (bt.view === 'results') h += _btViewResults(binRes);

    h += `</div>`;
    area.innerHTML = h;
    _btBind(binGroups, used);
}

// ── LOAD VIEW ──
function _btViewLoad(tc, tb, ta) {
    return `<div class="bt-section">
        <div class="bt-load-area">
            <div class="bt-load-icon">📥</div>
            <h3 class="bt-load-title">Load Card Base</h3>
            <p class="bt-load-desc">Paste cards or load .txt file</p>
            <textarea id="bt-input" class="bt-textarea" rows="10" placeholder="4242424242424242 12 28 123&#10;5555555555554444|03|27|456&#10;&#10;Format: NUMBER MM YY CVV"></textarea>
            <div class="bt-load-actions">
                <label class="bt-btn bt-btn-file">📁 Load .txt<input type="file" id="bt-file-input" accept=".txt" hidden></label>
                <button class="bt-btn bt-btn-primary" id="bt-load-cards">⚡ Load Cards</button>
            </div>
            ${tc > 0 ? `<div class="bt-loaded-info">✅ <b>${tc}</b> cards loaded · <b>${tb}</b> BINs · <b>${ta}</b> available<br>
                <button class="bt-btn bt-btn-sm" id="bt-go-bins" style="margin-top:8px">→ Go to BINs</button></div>` : ''}
        </div>
    </div>`;
}

// ── BINS VIEW ──
function _btViewBins(binEntries, binRes, used) {
    if (!binEntries.length) return `<div class="bt-empty">No cards. Load base first.</div>`;

    let h = `<div class="bt-section">
        <div class="bt-bins-header">
            <span class="bt-bins-title">Select BINs to take into work</span>
            <div class="bt-bins-actions">
                <button class="bt-btn bt-btn-sm" id="bt-sel-all">Select All</button>
                <button class="bt-btn bt-btn-sm" id="bt-desel-all">Deselect</button>
                <input type="number" id="bt-take-n" class="bt-take-input" value="1" min="1" max="99" title="Cards per BIN">
                <span class="bt-take-label">per BIN</span>
                <button class="bt-btn bt-btn-primary bt-btn-take" id="bt-take">⚡ Take to Work</button>
            </div>
        </div>
        <div class="bt-bins-grid">`;

    binEntries.forEach(([bin, cards]) => {
        const avail = cards.filter(c => !used.has(c.num)).length;
        const info = typeof BIN_CACHE!=='undefined' ? BIN_CACHE[bin] : null;
        const bank = info ? (info.bank||'Unknown') : '—';
        const brand = info ? (info.brand||'') : '';
        const type = info ? (info.type||'') : '';
        const country = info ? (info.country||'') : '';
        const r = binRes[bin];
        const tested = r ? r.total : 0;
        const rate = r && r.total>0 ? Math.round((r.added/r.total)*100) : null;

        let badge = '';
        if (rate !== null) {
            const cls = rate>=70?'bt-rate-good':rate>=30?'bt-rate-mid':'bt-rate-bad';
            badge = `<span class="bt-bin-rate ${cls}">${rate}%</span>`;
        }

        h += `<div class="bt-bin-card ${avail===0?'bt-bin-exhausted':''}">
            <label class="bt-bin-check-wrap">
                <input type="checkbox" class="bt-bin-cb" data-bin="${bin}" ${avail===0?'disabled':''}>
                <div class="bt-bin-info">
                    <div class="bt-bin-top">
                        <span class="bt-bin-number">${bin}</span>
                        ${badge}
                        ${brand?`<span class="bt-bin-brand">${brand}</span>`:''}
                    </div>
                    <div class="bt-bin-bank">${bank}</div>
                    <div class="bt-bin-meta">
                        ${type?`<span class="bt-bin-tag">${type}</span>`:''}
                        ${country?`<span class="bt-bin-tag">${country}</span>`:''}
                        <span class="bt-bin-count">${cards.length} total</span>
                        <span class="bt-bin-avail ${avail===0?'bt-zero':''}">${avail} avail</span>
                        ${tested>0?`<span class="bt-bin-tested">tested: ${tested}</span>`:''}
                    </div>
                </div>
            </label>
        </div>`;
    });

    h += `</div></div>`;
    return h;
}

// ── WORK VIEW — full card numbers visible ──
function _btViewWork(wk, added, failed, blocked, pending) {
    // Group by BIN
    const groups = {};
    wk.forEach((c,i) => {
        if (!groups[c.bin]) groups[c.bin] = [];
        groups[c.bin].push({...c, _i: i});
    });

    let h = `<div class="bt-section">
        <div class="bt-work-header">
            <div class="bt-work-stats">
                <span class="bt-ws">${wk.length} total</span>
                <span class="bt-ws bt-ws-pending">${pending} ⏳</span>
                <span class="bt-ws bt-ws-added">${added} ✅</span>
                <span class="bt-ws bt-ws-failed">${failed} ❌</span>
                <span class="bt-ws bt-ws-blocked">${blocked} 🚫</span>
            </div>
            <div class="bt-work-actions">
                <button class="bt-btn bt-btn-sm" id="bt-copy-work">📋 Copy All Cards</button>
                <button class="bt-btn bt-btn-sm" id="bt-copy-pending">📋 Copy Pending</button>
                <button class="bt-btn bt-btn-finish" id="bt-finish">✅ Finish Batch</button>
                <button class="bt-btn bt-btn-sm bt-btn-danger" id="bt-cancel-work">✕ Cancel</button>
            </div>
        </div>
        <div class="bt-work-hint">Click card number to copy · Set status for each card · Finish when done</div>
        <div class="bt-work-list">`;

    Object.entries(groups).forEach(([bin, cards]) => {
        const info = typeof BIN_CACHE!=='undefined' ? BIN_CACHE[bin] : null;
        const bank = info ? (info.bank||'Unknown') : '—';
        h += `<div class="bt-work-bin-group">
            <div class="bt-work-bin-header">
                <span class="bt-work-bin-num">${bin}</span>
                <span class="bt-work-bin-bank">${bank}</span>
                <span class="bt-work-bin-cnt">${cards.length} cards</span>
            </div>`;
        cards.forEach(c => {
            const full = `${c.num} ${c.mm} ${c.yy} ${c.cvv}`;
            const stCls = c.status==='added'?'bt-st-added':c.status==='failed'?'bt-st-failed':c.status==='blocked'?'bt-st-blocked':'bt-st-pending';
            h += `<div class="bt-work-row ${stCls}">
                <span class="bt-work-card-num bt-copyable" data-copy="${full}" title="Click to copy">${c.num}</span>
                <span class="bt-work-exp">${c.mm}/${c.yy}</span>
                <span class="bt-work-cvv">${c.cvv}</span>
                <div class="bt-status-btns">
                    <button class="bt-sbtn bt-sbtn-added ${c.status==='added'?'active':''}" data-idx="${c._i}" data-status="added">✅</button>
                    <button class="bt-sbtn bt-sbtn-failed ${c.status==='failed'?'active':''}" data-idx="${c._i}" data-status="failed">❌</button>
                    <button class="bt-sbtn bt-sbtn-blocked ${c.status==='blocked'?'active':''}" data-idx="${c._i}" data-status="blocked">🚫</button>
                </div>
            </div>`;
        });
        h += `</div>`;
    });

    h += `</div></div>`;
    return h;
}

// ── RESULTS VIEW ──
function _btViewResults(binRes) {
    const entries = Object.entries(binRes).sort((a,b) => {
        const ra = a[1].total>0 ? a[1].added/a[1].total : 0;
        const rb = b[1].total>0 ? b[1].added/b[1].total : 0;
        return rb - ra;
    });
    if (!entries.length) return `<div class="bt-empty">No results yet.</div>`;

    let tT=0,tA=0,tF=0,tB=0;
    entries.forEach(([,r])=>{tT+=r.total;tA+=r.added;tF+=r.failed;tB+=r.blocked;});
    const rate = tT>0 ? Math.round((tA/tT)*100) : 0;

    let h = `<div class="bt-section">
        <div class="bt-results-summary">
            <div class="bt-rs-card"><span class="bt-rs-label">Tested</span><span class="bt-rs-value">${tT}</span></div>
            <div class="bt-rs-card bt-rs-added"><span class="bt-rs-label">Added</span><span class="bt-rs-value">${tA}</span></div>
            <div class="bt-rs-card bt-rs-failed"><span class="bt-rs-label">Failed</span><span class="bt-rs-value">${tF}</span></div>
            <div class="bt-rs-card bt-rs-blocked"><span class="bt-rs-label">Blocked</span><span class="bt-rs-value">${tB}</span></div>
            <div class="bt-rs-card bt-rs-rate"><span class="bt-rs-label">Success</span><span class="bt-rs-value">${rate}%</span></div>
        </div>
        <div class="bt-results-actions">
            <button class="bt-btn bt-btn-primary" id="bt-new-batch">🔄 New Batch → BINs</button>
            <button class="bt-btn bt-btn-sm" id="bt-copy-good">📋 Copy Working BINs</button>
            <button class="bt-btn bt-btn-sm" id="bt-export-notes">📤 Export to Notes</button>
            <button class="bt-btn bt-btn-sm bt-btn-danger" id="bt-clear-hist">🗑 Clear History</button>
        </div>
        <div class="bt-results-table">
            <div class="bt-rt-header">
                <span class="bt-rt-h">BIN</span><span class="bt-rt-h">Bank</span>
                <span class="bt-rt-h">Tested</span><span class="bt-rt-h">✅</span><span class="bt-rt-h">❌</span><span class="bt-rt-h">🚫</span><span class="bt-rt-h">Rate</span>
            </div>`;

    entries.forEach(([bin, r]) => {
        const rt = r.total>0 ? Math.round((r.added/r.total)*100) : 0;
        const cls = rt>=70?'bt-rate-good':rt>=30?'bt-rate-mid':'bt-rate-bad';
        const info = typeof BIN_CACHE!=='undefined' ? BIN_CACHE[bin] : null;
        const bank = info?(info.bank||'—'):'—';
        const sb = bank.length>22?bank.slice(0,22)+'…':bank;
        h += `<div class="bt-rt-row">
            <span class="bt-rt-bin">${bin}</span><span class="bt-rt-bank">${sb}</span>
            <span class="bt-rt-val">${r.total}</span>
            <span class="bt-rt-val bt-rt-added">${r.added}</span>
            <span class="bt-rt-val bt-rt-failed">${r.failed}</span>
            <span class="bt-rt-val bt-rt-blocked">${r.blocked}</span>
            <span class="bt-rt-rate-cell">
                <div class="bt-rt-bar"><div class="bt-rt-bar-fill ${cls}" style="width:${Math.max(rt,3)}%"></div></div>
                <span class="bt-rt-pct ${cls}">${rt}%</span>
            </span>
        </div>`;
    });

    h += `</div></div>`;
    return h;
}

// ── EVENT BINDING ──
function _btBind(binGroups, used) {
    const bt = STATE._bt;

    // Tabs
    document.querySelectorAll('.bt-tab').forEach(t => {
        t.addEventListener('click', () => {
            if (t.disabled) return;
            bt.view = t.dataset.btview;
            _btSave(); renderBinTester();
        });
    });

    // Reset
    document.getElementById('bt-reset')?.addEventListener('click', () => {
        if (!confirm('Reset all BIN Tester data?')) return;
        STATE._bt = { cards:[], workCards:[], history:[], view:'load' };
        _btSave(); renderBinTester();
        toast('BIN Tester reset','success');
    });

    // Load cards
    document.getElementById('bt-load-cards')?.addEventListener('click', () => {
        const inp = document.getElementById('bt-input');
        if (!inp) return;
        const raw = inp.value.trim();
        if (!raw) { toast('Paste cards first','info'); return; }
        const existing = new Set(bt.cards.map(c=>c.num));
        let added = 0;
        raw.split('\n').forEach(line => {
            const p = _btParseLine(line);
            if (p && !existing.has(p.num)) { bt.cards.push(p); existing.add(p.num); added++; }
        });
        if (!added) { toast('No new cards found','info'); return; }
        // Lookup BINs
        new Set(bt.cards.map(c=>c.bin)).forEach(b => { if (typeof lookupBin==='function') lookupBin(b); });
        _btSave();
        toast(`Loaded ${added} cards`,'success');
        bt.view = 'bins'; _btSave(); renderBinTester();
    });

    // File input
    document.getElementById('bt-file-input')?.addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = ev => { const ta = document.getElementById('bt-input'); if (ta) ta.value = ev.target.result; toast('File loaded','success'); };
        r.readAsText(f);
    });

    // Go to bins
    document.getElementById('bt-go-bins')?.addEventListener('click', () => {
        bt.view = 'bins'; _btSave(); renderBinTester();
    });

    // Select all / deselect
    document.getElementById('bt-sel-all')?.addEventListener('click', () => {
        document.querySelectorAll('.bt-bin-cb:not(:disabled)').forEach(cb => cb.checked = true);
    });
    document.getElementById('bt-desel-all')?.addEventListener('click', () => {
        document.querySelectorAll('.bt-bin-cb').forEach(cb => cb.checked = false);
    });

    // Take to work
    document.getElementById('bt-take')?.addEventListener('click', () => {
        const checked = [...document.querySelectorAll('.bt-bin-cb:checked')].map(cb => cb.dataset.bin);
        if (!checked.length) { toast('Select BINs first','info'); return; }
        const n = parseInt(document.getElementById('bt-take-n')?.value || '1', 10);
        const usedNow = _btUsedNums();
        let taken = 0;
        checked.forEach(bin => {
            const avail = bt.cards.filter(c => c.bin===bin && !usedNow.has(c.num));
            avail.slice(0, n).forEach(card => {
                bt.workCards.push({...card, status:'pending'});
                usedNow.add(card.num);
                taken++;
            });
        });
        if (!taken) { toast('No available cards','info'); return; }
        bt.view = 'work'; _btSave();
        toast(`Took ${taken} cards to work`,'success');
        renderBinTester();
    });

    // Status buttons
    document.querySelectorAll('.bt-sbtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const i = parseInt(btn.dataset.idx);
            const st = btn.dataset.status;
            if (bt.workCards[i]) {
                // Toggle: if same status clicked, reset to pending
                bt.workCards[i].status = bt.workCards[i].status === st ? 'pending' : st;
                _btSave(); renderBinTester();
            }
        });
    });

    // Copy card numbers (click to copy individual)
    document.querySelectorAll('.bt-copyable').forEach(el => {
        el.addEventListener('click', () => {
            navigator.clipboard?.writeText(el.dataset.copy);
            el.classList.add('bt-flash');
            setTimeout(() => el.classList.remove('bt-flash'), 500);
            toast('Copied: ' + el.dataset.copy, 'success');
        });
    });

    // Copy all work cards
    document.getElementById('bt-copy-work')?.addEventListener('click', () => {
        const lines = bt.workCards.map(c => `${c.num} ${c.mm} ${c.yy} ${c.cvv}`).join('\n');
        navigator.clipboard?.writeText(lines);
        toast(`Copied ${bt.workCards.length} cards`,'success');
    });

    // Copy pending only
    document.getElementById('bt-copy-pending')?.addEventListener('click', () => {
        const pending = bt.workCards.filter(c => c.status==='pending');
        if (!pending.length) { toast('No pending cards','info'); return; }
        const lines = pending.map(c => `${c.num} ${c.mm} ${c.yy} ${c.cvv}`).join('\n');
        navigator.clipboard?.writeText(lines);
        toast(`Copied ${pending.length} pending cards`,'success');
    });

    // Finish batch
    document.getElementById('bt-finish')?.addEventListener('click', () => {
        const done = bt.workCards.filter(c => c.status !== 'pending');
        if (!done.length) { toast('Mark card statuses first','info'); return; }
        bt.history.push(...done);
        bt.workCards = bt.workCards.filter(c => c.status === 'pending');
        bt.view = bt.workCards.length > 0 ? 'work' : 'results';
        _btSave();
        toast(`Finished ${done.length} cards → history`,'success');
        renderBinTester();
    });

    // Cancel work
    document.getElementById('bt-cancel-work')?.addEventListener('click', () => {
        if (!confirm('Cancel work? Cards return to pool.')) return;
        bt.workCards = [];
        bt.view = 'bins'; _btSave(); renderBinTester();
    });

    // New batch from results
    document.getElementById('bt-new-batch')?.addEventListener('click', () => {
        bt.view = 'bins'; _btSave(); renderBinTester();
    });

    // Copy good BINs
    document.getElementById('bt-copy-good')?.addEventListener('click', () => {
        const br = {};
        bt.history.forEach(c => {
            if (!br[c.bin]) br[c.bin] = {added:0,total:0};
            br[c.bin].total++; if (c.status==='added') br[c.bin].added++;
        });
        const good = Object.entries(br).filter(([,r])=>r.total>0&&(r.added/r.total)>=0.5).map(([b])=>b);
        if (!good.length) { toast('No working BINs','info'); return; }
        navigator.clipboard?.writeText(good.join('\n'));
        toast(`Copied ${good.length} working BINs`,'success');
    });

    // Export to notes
    document.getElementById('bt-export-notes')?.addEventListener('click', () => {
        const br = {};
        bt.history.forEach(c => {
            if (!br[c.bin]) br[c.bin]={added:0,failed:0,blocked:0,total:0};
            br[c.bin].total++; if(c.status==='added')br[c.bin].added++; if(c.status==='failed')br[c.bin].failed++; if(c.status==='blocked')br[c.bin].blocked++;
        });
        const lines = ['BIN TESTER RESULTS','═'.repeat(40),''];
        Object.entries(br).sort((a,b)=>(b[1].added/b[1].total)-(a[1].added/a[1].total)).forEach(([bin,r])=>{
            const rt = Math.round((r.added/r.total)*100);
            const info = typeof BIN_CACHE!=='undefined'?BIN_CACHE[bin]:null;
            const bank = info?(info.bank||'?'):'?';
            lines.push(`${bin} | ${bank} | ${rt}% (${r.added}/${r.total}) | F:${r.failed} B:${r.blocked}`);
        });
        STATE.notesTabs.unshift({id:'tab-bt-'+Date.now(),title:'BIN Test Results',content:lines.join('\n'),pinned:false,tag:null,created:Date.now(),scrollPos:0});
        STATE.notesActiveTab=STATE.notesTabs[0].id;
        if(typeof save==='function')save();
        toast('Exported to Notes','success');
    });

    // Clear history
    document.getElementById('bt-clear-hist')?.addEventListener('click', () => {
        if (!confirm('Clear all test history?')) return;
        bt.history = []; _btSave(); renderBinTester();
        toast('History cleared','success');
    });
}
