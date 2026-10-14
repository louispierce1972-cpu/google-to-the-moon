/* ═══════════════════════════════════════════════════════════════════
   BILLING TABLE — compact results table shared by Find Billings and
   the Workspace tab: Date · BIN · Country · Bank · Charged · Status,
   details in an expandable row, date range filter, sort by date / sum.
   Rows = bsMatchRecord() rows (card in .chosen) or Workspace snapshots
   (card in .card). View state is owned by the caller (immutable updates).
   ═══════════════════════════════════════════════════════════════════ */

function btDefaultView() {
    return { from: '', to: '', sortKey: 'date', sortDir: 'desc', status: 'all', search: '', expanded: new Set(), checked: new Set(), alts: new Set() };
}

function btEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function btCard(r) {
    return r.chosen || r.card || null;
}

function btMoney(n, cur) {
    if (!n) return '<span class="bt-dim">—</span>';
    return btEsc(cur || '') + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function btDate(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : '—';
}

function btCountry(code) {
    if (!code) return '<span class="bt-dim">—</span>';
    const flag = typeof prFlag === 'function' ? prFlag(code) : '';
    const name = typeof geoName === 'function' ? geoName(code) : code;
    return `${flag} <b>${btEsc(code)}</b> <span class="bt-cname">${btEsc(name)}</span>`;
}

/** Range filter → status / search filter → sort. Never mutates rows. */
function btPrepare(rows, view) {
    const q = view.search.trim().toLowerCase();
    const ranged = rows.map(r => bsApplyRange(r, view.from, view.to)).filter(Boolean);
    const filtered = ranged.filter(r => {
        if (view.status === 'notwork' ? r.inWork || r.status === 'missing' : view.status !== 'all' && r.status !== view.status) return false;
        if (!q) return true;
        const c = btCard(r) || {};
        return [r.last4, r.network, r.fileName, c.cc, c.bank, c.geo, c.country].join(' ').toLowerCase().includes(q);
    });
    return bsSortRows(filtered, view.sortKey, view.sortDir);
}

function btTotals(rows) {
    const sumBy = key => rows.reduce((m, r) => ({ ...m, [r.cur || '']: (m[r.cur || ''] || 0) + (r[key] || 0) }), {});
    const fmt = map => Object.entries(map).filter(([, v]) => v).map(([c, v]) => `${c}${Math.round(v).toLocaleString('en-US')}`).join(' + ') || '—';
    return {
        cards: rows.length,
        matched: rows.filter(r => r.status === 'matched').length,
        choose: rows.filter(r => r.status === 'choose').length,
        missing: rows.filter(r => r.status === 'missing').length,
        notWork: rows.filter(r => r.status !== 'missing' && !r.inWork).length,
        charged: fmt(sumBy('charged')),
        declined: fmt(sumBy('declined'))
    };
}

function btStatsHtml(rows) {
    const T = btTotals(rows);
    return `<div class="bt-stats">
        <div class="bt-stat"><em>Cards</em><b>${T.cards}</b></div>
        <div class="bt-stat ok"><em>Found</em><b>${T.matched}</b></div>
        <div class="bt-stat pick"><em>Choose</em><b>${T.choose}</b></div>
        <div class="bt-stat miss"><em>Not found</em><b>${T.missing}</b></div>
        <div class="bt-stat warn" title="Found only in the main base, not in Compare with old base"><em>Not in work base</em><b>${T.notWork}</b></div>
        <div class="bt-stat ok"><em>Charged</em><b>${T.charged}</b></div>
        <div class="bt-stat miss"><em>Declined</em><b>${T.declined}</b></div>
    </div>`;
}

function btToolbarHtml(view) {
    const opt = (v, t) => `<option value="${v}" ${view.status === v ? 'selected' : ''}>${t}</option>`;
    return `<div class="bt-toolbar">
        <label class="bt-date-lbl">From <input type="date" class="bt-input" data-bt="from" value="${btEsc(view.from)}"></label>
        <label class="bt-date-lbl">To <input type="date" class="bt-input" data-bt="to" value="${btEsc(view.to)}"></label>
        ${view.from || view.to ? '<button class="bt-link" data-bt-act="range-clear">all dates</button>' : ''}
        <select class="bt-input" data-bt="status">${opt('all', 'All statuses')}${opt('matched', 'Found')}${opt('choose', 'Choose')}${opt('missing', 'Not found')}${opt('notwork', 'Not in work base')}</select>
        <input class="bt-input bt-search" data-bt="search" placeholder="Search: last4, number, bank, country…" value="${btEsc(view.search)}">
    </div>`;
}

function btShort(iso) {
    const m = String(iso || '').match(/^\d{4}-(\d{2})-(\d{2})$/);
    return m ? `${m[2]}.${m[1]}` : '';
}

/** One option of a candidate list: BIN…last4 · bank · geo · added dd.mm (±N d from the operation). */
function btCandLabel(c) {
    const added = c.added ? ` · added ${btShort(c.added)}${c.distanceDays != null ? ` (${c.distanceDays} d)` : ''}` : ' · no date';
    return `${c.bin}…${c.cc.slice(-4)} · ${c.bank || '?'} · ${c.geo || '?'}${added}${c.inWork ? '' : ' · main'}`;
}

function btAltsHtml(r, view) {
    const n = r.alternates || 0;
    if (!n) return '';
    if (!Array.isArray(r.candidates)) {
        return `<span class="bt-alt static" title="Several cards had these last 4 digits; the one added closest to the operation date was picked">⚠ ${n} alternate${n > 1 ? 's' : ''}</span>`;
    }
    const open = view.alts && view.alts.has(r.id);
    const badge = `<button class="bt-alt ${r.autoPicked ? 'auto' : 'manual'} ${open ? 'open' : ''}" data-bt-alt="${btEsc(r.id)}" title="${r.autoPicked ? 'Auto-picked by the nearest date to the operation — click to review the other candidates' : 'Picked manually — click to see the other candidates'}">⚠ ${n} alternate${n > 1 ? 's' : ''}</button>`;
    if (!open) return badge;
    const chosenCc = r.chosen && r.chosen.cc;
    const opts = [`<option value="">↺ auto (nearest date)</option>`].concat(r.candidates.map(c =>
        `<option value="${btEsc(c.cc)}" ${c.cc === chosenCc ? 'selected' : ''}>${btEsc(btCandLabel(c))}${c.cc === chosenCc ? '  ✓' : ''}</option>`));
    return `${badge}<select class="bt-input bt-pick bt-alt-list" data-bt-pick="${btEsc(r.id)}">${opts.join('')}</select>`;
}

function btStatusHtml(r, view) {
    if (r.status === 'choose' && Array.isArray(r.candidates)) {
        const opts = ['<option value="">— choose (' + r.candidates.length + ') —</option>'].concat(r.candidates.map(c =>
            `<option value="${btEsc(c.cc)}">${btEsc(btCandLabel(c))}</option>`));
        return `<select class="bt-input bt-pick" data-bt-pick="${btEsc(r.id)}">${opts.join('')}</select>`;
    }
    if (r.status === 'choose') return '<span class="bt-st pick">choose</span>';
    if (r.status === 'missing') return '<span class="bt-st miss">not found</span>';
    return `<span class="bt-st ok">✓ found</span>${r.inWork ? '' : '<span class="bt-tag" title="Not in Compare with old base — matched in the main base only">main base only</span>'}${btAltsHtml(r, view || btDefaultView())}`;
}

function btDetailsHtml(r) {
    const c = btCard(r);
    const ev = bsEventsOf(r).filter(e => e.kind !== 'cancelled');
    const evRows = ev.map(e => `<span class="bt-ev ${e.kind}">${btDate(e.date)} · ${btEsc(e.kind)} · ${btMoney(e.amount, r.cur)}${e.reason ? ` · ${btEsc(e.reason)}` : ''}</span>`).join('');
    const copy = c && c.mm ? `${c.cc} ${c.mm} ${c.yy} ${c.cvv}` : c ? c.cc : '';
    const cell = (label, value) => `<div class="bt-d"><em>${label}</em><span>${value}</span></div>`;
    return `<div class="bt-details">
        ${cell('Statement card', `<b>${btEsc(r.network)}</b> •••• ${btEsc(r.last4)}`)}
        ${cell('Full number', c ? `<span class="bt-copy" data-bt-copy="${btEsc(copy)}" title="Copy: number mm yy cvv">${btEsc(c.cc)} 📋</span>` : '—')}
        ${cell('Exp / CVV', c && c.mm ? `${btEsc(c.mm)}/${btEsc(c.yy)} · ${btEsc(c.cvv)}` : '—')}
        ${cell('Holder', c && c.holder ? btEsc(c.holder) : '—')}
        ${cell('Added to base', c && c.added ? `${btDate(c.added)}${c.distanceDays != null ? ` (${c.distanceDays} d from the operation)` : ''}` : '—')}
        ${cell('Type', c && c.cardType ? btEsc(c.cardType) : '—')}
        ${cell('File', btEsc(r.fileName))}
        ${cell('Period', `${btDate(r.periodFrom)} – ${btDate(r.periodTo)}`)}
        ${cell('Declined', `${btMoney(r.declined, r.cur)}${r.declinedCount ? ` (${r.declinedCount}×)` : ''}`)}
        ${cell('Chargebacks', `${btMoney(r.chargedBack, r.cur)}${r.chargedBackCount ? ` (${r.chargedBackCount}×)` : ''}`)}
        ${cell('Campaigns', `${btMoney(r.campaignCost, r.cur)}${r.fileCardCount > 1 ? ' (whole file)' : ''}`)}
        ${c && !c.inMain && c.inWork ? cell('Note', 'In work base, but not in the main base — BIN only') : ''}
        ${evRows ? `<div class="bt-evs">${evRows}</div>` : ''}
    </div>`;
}

function btRowHtml(r, view, selectable) {
    const c = btCard(r);
    const open = view.expanded.has(r.id);
    const chk = selectable ? `<td class="bt-chk"><input type="checkbox" data-bt-check="${btEsc(r.id)}" ${view.checked.has(r.id) ? 'checked' : ''}></td>` : '';
    return `<tr class="bt-row bt-${r.status} ${open ? 'open' : ''}" data-bt-row="${btEsc(r.id)}">
        ${chk}
        <td class="bt-date">${btDate(r.date)}</td>
        <td class="bt-bin">${c ? btEsc(c.bin) : '<span class="bt-dim">—</span>'}</td>
        <td class="bt-country">${btCountry(c && c.geo)}</td>
        <td class="bt-bank" title="${btEsc(c ? c.bank : '')}">${c && c.bank ? btEsc(c.bank) : '<span class="bt-dim">—</span>'}</td>
        <td class="bt-money">${btMoney(r.charged, r.cur)}${r.chargedCount > 1 ? `<small>${r.chargedCount}×</small>` : ''}</td>
        <td class="bt-status">${btStatusHtml(r, view)}</td>
        <td class="bt-caret">${open ? '▾' : '▸'}</td>
    </tr>${open ? `<tr class="bt-drow"><td colspan="${selectable ? 8 : 7}">${btDetailsHtml(r)}</td></tr>` : ''}`;
}

function btTableHtml(rows, view, selectable) {
    const arrow = key => (view.sortKey === key ? (view.sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕');
    const allOn = rows.length > 0 && rows.every(r => view.checked.has(r.id));
    return `<div class="bt-wrap"><table class="bt-table"><thead><tr>
        ${selectable ? `<th class="bt-chk"><input type="checkbox" data-bt-all ${allOn ? 'checked' : ''} title="Select all shown"></th>` : ''}
        <th class="bt-sort" data-bt-sort="date">Date${arrow('date')}</th><th>BIN</th><th>Country</th><th>Bank</th>
        <th class="bt-sort" data-bt-sort="charged">Charged${arrow('charged')}</th><th>Status</th><th></th>
    </tr></thead><tbody>${rows.map(r => btRowHtml(r, view, selectable)).join('')
        || `<tr><td colspan="8" class="bt-dim bt-center">Nothing matches the filter</td></tr>`}</tbody></table></div>`;
}

/**
 * Event wiring. handlers: { setView(patch), pick(id, cc) }.
 * rows = the prepared (visible) rows.
 */
function btBind(root, view, rows, handlers) {
    root.querySelectorAll('[data-bt]').forEach(el => {
        const key = el.dataset.bt;
        const ev = key === 'search' ? 'input' : 'change';
        el.addEventListener(ev, () => {
            if (key !== 'search') return handlers.setView({ [key]: el.value });
            const pos = el.selectionStart;
            handlers.setView({ search: el.value });
            const again = document.querySelector('[data-bt="search"]');
            if (again) { again.focus(); again.setSelectionRange(pos, pos); }
        });
    });
    root.querySelector('[data-bt-act="range-clear"]')?.addEventListener('click', () => handlers.setView({ from: '', to: '' }));
    root.querySelectorAll('[data-bt-sort]').forEach(th => th.addEventListener('click', () => {
        const key = th.dataset.btSort;
        const dir = view.sortKey === key && view.sortDir === 'desc' ? 'asc' : 'desc';
        handlers.setView({ sortKey: key, sortDir: dir });
    }));
    root.querySelector('[data-bt-all]')?.addEventListener('change', e => {
        const next = new Set(view.checked);
        rows.forEach(r => (e.target.checked ? next.add(r.id) : next.delete(r.id)));
        handlers.setView({ checked: next });
    });
    root.querySelectorAll('[data-bt-check]').forEach(cb => cb.addEventListener('change', () => {
        const next = new Set(view.checked);
        if (cb.checked) next.add(cb.dataset.btCheck); else next.delete(cb.dataset.btCheck);
        handlers.setView({ checked: next });
    }));
    root.querySelectorAll('[data-bt-pick]').forEach(s => s.addEventListener('change', () => handlers.pick(s.dataset.btPick, s.value)));
    root.querySelectorAll('[data-bt-alt]').forEach(b => b.addEventListener('click', e => {
        e.stopPropagation();
        const next = new Set(view.alts || []);
        const id = b.dataset.btAlt;
        if (next.has(id)) next.delete(id); else next.add(id);
        handlers.setView({ alts: next });
    }));
    root.querySelectorAll('[data-bt-copy]').forEach(el => el.addEventListener('click', e => {
        e.stopPropagation();
        if (!navigator.clipboard) return toast('Clipboard is not available', 'error');
        navigator.clipboard.writeText(el.dataset.btCopy).then(() => toast('Copied: ' + el.dataset.btCopy, 'success'));
    }));
    root.querySelectorAll('[data-bt-row]').forEach(tr => tr.addEventListener('click', e => {
        if (e.target.closest('input, select, button, .bt-copy')) return;
        const next = new Set(view.expanded);
        const id = tr.dataset.btRow;
        if (next.has(id)) next.delete(id); else next.add(id);
        handlers.setView({ expanded: next });
    }));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { btDefaultView, btPrepare, btTotals };
}
