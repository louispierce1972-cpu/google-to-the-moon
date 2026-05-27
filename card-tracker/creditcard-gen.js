// ═══════════════════════════════════════════════════════════════
//         CREDIT CARD IMAGE GENERATOR
// ═══════════════════════════════════════════════════════════════

var _CCG_NETWORK_LOGOS = {
    visa: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><path d="M293.2 348.7l33.4-195.8h53.3l-33.4 195.8h-53.3zm246.8-191c-10.5-4-27.1-8.3-47.7-8.3-52.6 0-89.7 26.5-89.9 64.4-.3 28.1 26.4 43.7 46.6 53.1 20.7 9.6 27.7 15.7 27.6 24.3-.1 13.1-16.5 19.1-31.8 19.1-21.3 0-32.6-3-50.1-10.2l-6.9-3.1-7.5 43.8c12.4 5.5 35.4 10.2 59.3 10.5 56 0 92.3-26.2 92.7-66.7.2-22.2-14-39.1-44.6-53.1-18.6-9-29.9-15-29.8-24.2 0-8.1 9.6-16.8 30.4-16.8 17.4-.3 29.9 3.5 39.7 7.5l4.8 2.2 7.2-42.2zm138.4-4.8h-41.2c-12.8 0-22.3 3.5-27.9 16.2l-79.2 179.4h56l11.2-29.3h68.4l6.5 29.3h49.4l-43.2-195.6zm-65.8 126.2c4.4-11.3 21.5-54.7 21.5-54.7-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.3 47.2 12.5 57.2h-44.7v-.7h0zm-384.5-126.2L177 279.6l-5.1-24.7c-8.8-28.3-36.3-59-67-74.3l47.8 168.1h56.3l83.7-195.8h-56.3v-.1h0z" fill="#1a1f71"/><path d="M131.9 152.9H46.5L46 156.7c66.7 16.2 110.8 55.3 129.1 102.3l-18.6-89.6c-3.2-12.3-12.5-16-24.6-16.5z" fill="#f9a533"/></svg>',
    mastercard: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><circle cx="312" cy="250" r="170" fill="#eb001b"/><circle cx="468" cy="250" r="170" fill="#f79e1b"/><path d="M390 120.8a169.5 169.5 0 00-78 129.2 169.5 169.5 0 0078 129.2 169.5 169.5 0 0078-129.2 169.5 169.5 0 00-78-129.2z" fill="#ff5f00"/></svg>',
    amex: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#2e77bc"/><path d="M40 221h700v58H40z" fill="#fff"/><text x="390" y="195" fill="#fff" font-family="Arial" font-size="72" font-weight="bold" text-anchor="middle">AMERICAN</text><text x="390" y="330" fill="#fff" font-family="Arial" font-size="72" font-weight="bold" text-anchor="middle">EXPRESS</text></svg>',
    jcb: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><rect x="200" y="80" width="120" height="340" rx="20" fill="#0e4c96"/><rect x="330" y="80" width="120" height="340" rx="20" fill="#e21836"/><rect x="460" y="80" width="120" height="340" rx="20" fill="#007940"/><text x="260" y="290" fill="#fff" font-family="Arial" font-size="64" font-weight="bold" text-anchor="middle">J</text><text x="390" y="290" fill="#fff" font-family="Arial" font-size="64" font-weight="bold" text-anchor="middle">C</text><text x="520" y="290" fill="#fff" font-family="Arial" font-size="64" font-weight="bold" text-anchor="middle">B</text></svg>',
    discover: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff"/><path d="M0 250h780v250H0z" fill="#f76f20"/><circle cx="390" cy="250" r="80" fill="#f76f20"/><text x="390" y="180" fill="#1a1a2e" font-family="Arial" font-size="60" font-weight="bold" text-anchor="middle">DISCOVER</text></svg>',
    unionpay: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff"/><path d="M150 60h160l-30 380H120z" fill="#e21836"/><path d="M280 60h180l-30 380H250z" fill="#00447c"/><path d="M430 60h180l-30 380H400z" fill="#007b84"/><text x="340" y="280" fill="#fff" font-family="Arial" font-size="50" font-weight="bold" text-anchor="middle">UnionPay</text></svg>'
};

var _CCG_COLOR_SCHEMES = ['black', 'gold', 'blue', 'silver', 'red', 'green'];

function _ccgEsc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _ccgFormatNumber(num) {
    var n = (num || '').replace(/\D/g, '').slice(0, 16);
    return n.replace(/(.{4})/g, '$1 ').trim();
}

function _ccgRenderFront(ccg) {
    var num = _ccgFormatNumber(ccg.cardNumber);
    var exp = ccg.expiry || 'MM/YY';
    var holder = (ccg.holderName || 'CARDHOLDER NAME').toUpperCase();
    var networkSvg = _CCG_NETWORK_LOGOS[ccg.cardNetwork] || _CCG_NETWORK_LOGOS.visa;
    var bankDisplay = ccg.customLogo
        ? '<div class="ccg-bank-logo"><img src="' + ccg.customLogo + '" alt="Bank Logo"></div>'
        : '<div class="ccg-bank-name">' + _ccgEsc(ccg.bankName || '') + '</div>';

    return '<div class="ccg-card ccg-bg-' + (ccg.colorScheme || 'black') + '" id="ccg-front-card">' +
        '<div class="ccg-front">' +
            '<div class="ccg-front-top">' + bankDisplay +
                '<img class="ccg-hologram" src="fonts/hologram.jpg" alt="">' +
            '</div>' +
            '<div class="ccg-chip-area">' +
                '<img class="ccg-chip" src="fonts/chip.jpg" alt="Chip">' +
                '<span class="ccg-nfc-icon">))))</span>' +
            '</div>' +
            '<div class="ccg-card-number">' + _ccgEsc(num || '\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022') + '</div>' +
            '<div class="ccg-front-bottom">' +
                '<div class="ccg-bottom-left">' +
                    '<span class="ccg-valid-label">VALID THRU</span>' +
                    '<span class="ccg-expiry">' + _ccgEsc(exp) + '</span>' +
                    '<span class="ccg-holder-name">' + _ccgEsc(holder) + '</span>' +
                '</div>' +
                '<div class="ccg-network-logo">' + networkSvg + '</div>' +
            '</div>' +
        '</div>' +
    '</div>';
}

function _ccgRenderBack(ccg) {
    var cvv = ccg.cvv || '\u2022\u2022\u2022';
    var holder = (ccg.holderName || '').toUpperCase();
    var networkSvg = _CCG_NETWORK_LOGOS[ccg.cardNetwork] || _CCG_NETWORK_LOGOS.visa;

    return '<div class="ccg-card ccg-bg-' + (ccg.colorScheme || 'black') + '" id="ccg-back-card">' +
        '<div class="ccg-back">' +
            '<div class="ccg-magstripe"></div>' +
            '<div class="ccg-signature-area">' +
                '<div class="ccg-signature-strip">' +
                    '<span class="ccg-signature-text">' + _ccgEsc(holder) + '</span>' +
                '</div>' +
                '<div class="ccg-cvv-box">' + _ccgEsc(cvv) + '</div>' +
            '</div>' +
            '<div class="ccg-back-info">' +
                '<div class="ccg-fine-print">' +
                    'This card is property of the issuing bank and must be returned upon request. ' +
                    'Use of this card is subject to the cardholder agreement. Unauthorized use may ' +
                    'result in prosecution. For customer service call 1-800-XXX-XXXX. Member FDIC.' +
                '</div>' +
                '<div class="ccg-back-bottom">' +
                    '<img class="ccg-back-hologram" src="fonts/hologram.jpg" alt="">' +
                    '<div class="ccg-back-network">' + networkSvg + '</div>' +
                '</div>' +
            '</div>' +
        '</div>' +
    '</div>';
}

function _renderCreditCardGenerator() {
    var area = document.getElementById('content-area');
    var bar = document.getElementById('stats-bar');
    bar.style.display = 'none';
    bar.innerHTML = '';
    var gen = _CK.generator;
    var ccg = gen.ccg;

    var modeIcons = { proxy: '🌐', bin: '🔢', card: '💳', ip: '📡', auto: '🔍', glue: '🔗', generator: '📄' };
    var modeLabels = { proxy: 'Proxy', bin: 'BIN', card: 'Card', ip: 'IP', auto: 'Auto', glue: 'Glue', generator: 'Generator' };
    var networks = [
        { id: 'visa', label: 'Visa' },
        { id: 'mastercard', label: 'MasterCard' },
        { id: 'amex', label: 'AMEX' },
        { id: 'jcb', label: 'JCB' },
        { id: 'discover', label: 'Discover' },
        { id: 'unionpay', label: 'UnionPay' }
    ];

    var modesHtml = '';
    var keys = Object.keys(modeIcons);
    for (var i = 0; i < keys.length; i++) {
        var m = keys[i];
        modesHtml += '<button class="ck-mode-btn ' + (_CK.mode === m ? 'active' : '') + '" data-mode="' + m + '">' +
            '<span class="ck-mode-icon">' + modeIcons[m] + '</span>' +
            '<span class="ck-mode-label">' + modeLabels[m] + '</span></button>';
    }

    var networkOpts = '';
    for (var j = 0; j < networks.length; j++) {
        networkOpts += '<option value="' + networks[j].id + '" ' + (ccg.cardNetwork === networks[j].id ? 'selected' : '') + '>' + networks[j].label + '</option>';
    }

    var colorBtns = '';
    for (var k = 0; k < _CCG_COLOR_SCHEMES.length; k++) {
        var c = _CCG_COLOR_SCHEMES[k];
        colorBtns += '<button class="ccg-color-btn ccg-color-' + c + ' ' + (ccg.colorScheme === c ? 'active' : '') + '" data-ccg-color="' + c + '" title="' + c + '"></button>';
    }

    area.innerHTML =
    '<div class="ck-container">' +
        '<div class="ck-header">' +
            '<div class="ck-title"><span class="ck-icon">💳</span><span>CREDIT CARD GENERATOR</span></div>' +
            '<div class="ck-modes">' + modesHtml + '</div>' +
        '</div>' +
        '<div class="ck-proto-bar">' +
            '<span class="ck-proto-label">Type:</span>' +
            '<button class="ck-proto-btn ' + (gen.type === 'tepco' ? 'active' : '') + '" data-billtype="tepco">⚡ TEPCO Electricity</button>' +
            '<button class="ck-proto-btn ' + (gen.type === 'water' ? 'active' : '') + '" data-billtype="water">💧 Water Bill</button>' +
            '<button class="ck-proto-btn ' + (gen.type === 'creditcard' ? 'active' : '') + '" data-billtype="creditcard">💳 Credit Card</button>' +
        '</div>' +
        '<div class="ccg-form">' +
            '<div class="ccg-form-row">' +
                '<div class="ccg-form-group"><label class="ccg-form-label">Card Number</label>' +
                    '<input type="text" class="ccg-form-input" id="ccg-number" maxlength="19" placeholder="4242 4242 4242 4242" value="' + _ccgEsc(ccg.cardNumber) + '"></div>' +
                '<div class="ccg-form-group-sm"><label class="ccg-form-label">Expiry</label>' +
                    '<input type="text" class="ccg-form-input" id="ccg-expiry" maxlength="5" placeholder="MM/YY" value="' + _ccgEsc(ccg.expiry) + '"></div>' +
                '<div class="ccg-form-group-sm"><label class="ccg-form-label">CVV</label>' +
                    '<input type="text" class="ccg-form-input" id="ccg-cvv" maxlength="4" placeholder="123" value="' + _ccgEsc(ccg.cvv) + '"></div>' +
            '</div>' +
            '<div class="ccg-form-row">' +
                '<div class="ccg-form-group"><label class="ccg-form-label">Cardholder Name</label>' +
                    '<input type="text" class="ccg-form-input" id="ccg-holder" placeholder="JOHN DOE" value="' + _ccgEsc(ccg.holderName) + '"></div>' +
                '<div class="ccg-form-group-md"><label class="ccg-form-label">Card Network</label>' +
                    '<select class="ccg-form-select" id="ccg-network">' + networkOpts + '</select></div>' +
            '</div>' +
            '<div class="ccg-form-row">' +
                '<div class="ccg-form-group"><label class="ccg-form-label">Bank Name</label>' +
                    '<input type="text" class="ccg-form-input" id="ccg-bank" placeholder="PREMIUM BANK" value="' + _ccgEsc(ccg.bankName) + '"></div>' +
                '<div class="ccg-form-group-md"><label class="ccg-form-label">Bank Logo</label>' +
                    '<label class="ccg-upload-btn ' + (ccg.customLogo ? 'has-logo' : '') + '" id="ccg-upload-label">' +
                    (ccg.customLogo ? '✅ Logo loaded' : '📁 Upload Logo') +
                    '<input type="file" id="ccg-logo-input" accept=".png,.jpg,.jpeg,.svg,.webp" hidden></label></div>' +
                (ccg.customLogo ? '<div class="ccg-form-group-sm" style="align-self:flex-end"><button class="ccg-btn" id="ccg-remove-logo" style="height:32px;color:#f87171;border-color:rgba(248,113,113,0.3)">✕ Remove</button></div>' : '') +
            '</div>' +
            '<div class="ccg-form-row" style="align-items:center">' +
                '<div class="ccg-form-group" style="flex:0 0 auto"><label class="ccg-form-label">Color Scheme</label>' +
                    '<div class="ccg-colors">' + colorBtns + '</div></div>' +
                '<div style="flex:1"></div>' +
                '<div class="ccg-actions">' +
                    '<button class="ccg-btn ccg-btn-download" id="ccg-dl-front">📥 Front PNG</button>' +
                    '<button class="ccg-btn ccg-btn-download" id="ccg-dl-back">📥 Back PNG</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="ccg-preview">' +
            '<div><div class="ccg-card-label">FRONT</div>' + _ccgRenderFront(ccg) + '</div>' +
            '<div><div class="ccg-card-label">BACK</div>' + _ccgRenderBack(ccg) + '</div>' +
        '</div>' +
    '</div>';

    _ccgBindEvents();
}

function _ccgBindEvents() {
    var area = document.getElementById('content-area');
    var gen = _CK.generator;
    var ccg = gen.ccg;

    // Mode switch
    area.querySelectorAll('.ck-mode-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            _CK.mode = btn.dataset.mode;
            if (_CK.mode === 'glue') _renderGlue();
            else if (_CK.mode === 'generator') _renderGenerator();
            else renderChecker();
        });
    });

    // Bill type switch
    area.querySelectorAll('[data-billtype]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            gen.type = btn.dataset.billtype;
            gen.billData = null;
            _renderGenerator();
        });
    });

    // Live preview
    function liveUpdate() {
        var fw = document.getElementById('ccg-front-card');
        var bw = document.getElementById('ccg-back-card');
        if (fw && fw.parentElement) fw.parentElement.innerHTML = _ccgRenderFront(ccg);
        if (bw && bw.parentElement) bw.parentElement.innerHTML = _ccgRenderBack(ccg);
    }

    // Card number
    var numEl = document.getElementById('ccg-number');
    if (numEl) numEl.addEventListener('input', function(e) {
        var raw = e.target.value.replace(/\D/g, '').slice(0, 16);
        e.target.value = raw.replace(/(.{4})/g, '$1 ').trim();
        ccg.cardNumber = e.target.value;
        liveUpdate();
    });

    // Expiry
    var expEl = document.getElementById('ccg-expiry');
    if (expEl) expEl.addEventListener('input', function(e) {
        var v = e.target.value.replace(/[^\d\/]/g, '');
        var d = v.replace(/\//g, '');
        if (d.length >= 2 && v.indexOf('/') === -1) v = d.slice(0, 2) + '/' + d.slice(2, 4);
        e.target.value = v.slice(0, 5);
        ccg.expiry = e.target.value;
        liveUpdate();
    });

    // CVV
    var cvvEl = document.getElementById('ccg-cvv');
    if (cvvEl) cvvEl.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        ccg.cvv = e.target.value;
        liveUpdate();
    });

    // Holder
    var holderEl = document.getElementById('ccg-holder');
    if (holderEl) holderEl.addEventListener('input', function(e) {
        ccg.holderName = e.target.value;
        liveUpdate();
    });

    // Bank name
    var bankEl = document.getElementById('ccg-bank');
    if (bankEl) bankEl.addEventListener('input', function(e) {
        ccg.bankName = e.target.value;
        liveUpdate();
    });

    // Network
    var netEl = document.getElementById('ccg-network');
    if (netEl) netEl.addEventListener('change', function(e) {
        ccg.cardNetwork = e.target.value;
        liveUpdate();
    });

    // Color scheme
    area.querySelectorAll('[data-ccg-color]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            ccg.colorScheme = btn.dataset.ccgColor;
            area.querySelectorAll('[data-ccg-color]').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            liveUpdate();
        });
    });

    // Logo upload
    var logoInput = document.getElementById('ccg-logo-input');
    if (logoInput) logoInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast('Logo too large (max 2MB)', 'error'); return; }
        var reader = new FileReader();
        reader.onload = function(ev) {
            ccg.customLogo = ev.target.result;
            _renderCreditCardGenerator();
            toast('Logo uploaded!', 'success');
        };
        reader.readAsDataURL(file);
    });

    // Remove logo
    var rmLogo = document.getElementById('ccg-remove-logo');
    if (rmLogo) rmLogo.addEventListener('click', function() {
        ccg.customLogo = null;
        _renderCreditCardGenerator();
    });

    // PNG downloads
    var dlF = document.getElementById('ccg-dl-front');
    if (dlF) dlF.addEventListener('click', function() {
        _ccgDownloadPNG('ccg-front-card', 'CreditCard_Front_' + Date.now() + '.png');
    });
    var dlB = document.getElementById('ccg-dl-back');
    if (dlB) dlB.addEventListener('click', function() {
        _ccgDownloadPNG('ccg-back-card', 'CreditCard_Back_' + Date.now() + '.png');
    });
}

function _ccgDownloadPNG(elementId, filename) {
    var el = document.getElementById(elementId);
    if (!el) { toast('Card not found', 'error'); return; }
    if (typeof html2canvas === 'undefined') {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = function() { _ccgCapture(el, filename); };
        s.onerror = function() { toast('Failed to load html2canvas', 'error'); };
        document.head.appendChild(s);
        return;
    }
    _ccgCapture(el, filename);
}

function _ccgCapture(el, filename) {
    html2canvas(el, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
        allowTaint: true,
        logging: false
    }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
        toast('Downloaded: ' + filename, 'success');
    }).catch(function(err) {
        console.error('PNG export error:', err);
        toast('PNG export failed', 'error');
    });
}
