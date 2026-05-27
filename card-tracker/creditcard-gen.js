// ═══════════════════════════════════════════
//  CREDIT CARD IMAGE GENERATOR v2
// ═══════════════════════════════════════════

var _CCG_NETWORK_LOGOS = {
    visa: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><path d="M293.2 348.7l33.4-195.8h53.3l-33.4 195.8h-53.3zm246.8-191c-10.5-4-27.1-8.3-47.7-8.3-52.6 0-89.7 26.5-89.9 64.4-.3 28.1 26.4 43.7 46.6 53.1 20.7 9.6 27.7 15.7 27.6 24.3-.1 13.1-16.5 19.1-31.8 19.1-21.3 0-32.6-3-50.1-10.2l-6.9-3.1-7.5 43.8c12.4 5.5 35.4 10.2 59.3 10.5 56 0 92.3-26.2 92.7-66.7.2-22.2-14-39.1-44.6-53.1-18.6-9-29.9-15-29.8-24.2 0-8.1 9.6-16.8 30.4-16.8 17.4-.3 29.9 3.5 39.7 7.5l4.8 2.2 7.2-42.2zm138.4-4.8h-41.2c-12.8 0-22.3 3.5-27.9 16.2l-79.2 179.4h56l11.2-29.3h68.4l6.5 29.3h49.4l-43.2-195.6zm-65.8 126.2c4.4-11.3 21.5-54.7 21.5-54.7-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.3 47.2 12.5 57.2h-44.7v-.7h0zm-384.5-126.2L177 279.6l-5.1-24.7c-8.8-28.3-36.3-59-67-74.3l47.8 168.1h56.3l83.7-195.8h-56.3v-.1h0z" fill="#1a1f71"/><path d="M131.9 152.9H46.5L46 156.7c66.7 16.2 110.8 55.3 129.1 102.3l-18.6-89.6c-3.2-12.3-12.5-16-24.6-16.5z" fill="#f9a533"/></svg>',
    mastercard: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><circle cx="312" cy="250" r="170" fill="#eb001b"/><circle cx="468" cy="250" r="170" fill="#f79e1b"/><path d="M390 120.8a169.5 169.5 0 00-78 129.2 169.5 169.5 0 0078 129.2 169.5 169.5 0 0078-129.2 169.5 169.5 0 00-78-129.2z" fill="#ff5f00"/></svg>',
    amex: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#2e77bc"/><path d="M40 221h700v58H40z" fill="#fff"/><text x="390" y="195" fill="#fff" font-family="Arial" font-size="72" font-weight="bold" text-anchor="middle">AMERICAN</text><text x="390" y="330" fill="#fff" font-family="Arial" font-size="72" font-weight="bold" text-anchor="middle">EXPRESS</text></svg>',
    jcb: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><rect x="200" y="80" width="120" height="340" rx="20" fill="#0e4c96"/><rect x="330" y="80" width="120" height="340" rx="20" fill="#e21836"/><rect x="460" y="80" width="120" height="340" rx="20" fill="#007940"/><text x="260" y="290" fill="#fff" font-family="Arial" font-size="64" font-weight="bold" text-anchor="middle">J</text><text x="390" y="290" fill="#fff" font-family="Arial" font-size="64" font-weight="bold" text-anchor="middle">C</text><text x="520" y="290" fill="#fff" font-family="Arial" font-size="64" font-weight="bold" text-anchor="middle">B</text></svg>',
    discover: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff"/><path d="M0 250h780v250H0z" fill="#f76f20"/><circle cx="390" cy="250" r="80" fill="#f76f20"/><text x="390" y="180" fill="#1a1a2e" font-family="Arial" font-size="60" font-weight="bold" text-anchor="middle">DISCOVER</text></svg>',
    unionpay: '<svg viewBox="0 0 780 500" xmlns="http://www.w3.org/2000/svg"><rect width="780" height="500" rx="40" fill="#fff"/><path d="M150 60h160l-30 380H120z" fill="#e21836"/><path d="M280 60h180l-30 380H250z" fill="#00447c"/><path d="M430 60h180l-30 380H400z" fill="#007b84"/><text x="340" y="280" fill="#fff" font-family="Arial" font-size="50" font-weight="bold" text-anchor="middle">UnionPay</text></svg>'
};

var _CCG_COLOR_SCHEMES = ['black','gold','blue','silver','red','green'];
var _CCG_DATE_LAYOUTS = ['A','B','C','D','E'];

function _ccgEsc(s){if(!s)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _ccgFmtNum(n){var d=(n||'').replace(/\D/g,'').slice(0,16);return d.replace(/(.{4})/g,'$1 ').trim();}

function _ccgDateHTML(exp, layout) {
    var e = _ccgEsc(exp || 'MM/YY');
    switch(layout || 'A') {
        case 'A': return '<span class="ccg-valid-label">VALID THRU</span><span class="ccg-expiry">' + e + '</span>';
        case 'B': return '<span class="ccg-date-inline"><span class="ccg-valid-label">VALID THRU</span> <span class="ccg-expiry-sm">' + e + '</span></span>';
        case 'C': return '<span class="ccg-valid-label">VALID</span><span class="ccg-date-arrow"><span class="ccg-valid-label">THRU</span> <span class="ccg-arrow">\u25B8</span> <span class="ccg-expiry">' + e + '</span></span>';
        case 'D': return '<span class="ccg-valid-label" style="font-size:6px">MONTH/YEAR</span><span class="ccg-date-expanded"><span class="ccg-valid-label">EXPIRATION: END OF</span> <span class="ccg-expiry-sm">' + e + '</span></span>';
        case 'E': return '<span class="ccg-expiry">' + e + '</span>';
        default: return '<span class="ccg-expiry">' + e + '</span>';
    }
}

function _ccgRenderFront(ccg) {
    var num = _ccgFmtNum(ccg.cardNumber);
    var holder = (ccg.holderName || 'CARDHOLDER NAME').toUpperCase();
    var net = _CCG_NETWORK_LOGOS[ccg.cardNetwork] || _CCG_NETWORK_LOGOS.visa;
    var bank = ccg.customLogo
        ? '<div class="ccg-bank-logo"><img src="'+ccg.customLogo+'" alt="Logo"></div>'
        : '<div class="ccg-bank-name">'+_ccgEsc(ccg.bankName||'')+'</div>';
    var bg = ccg.skinImage
        ? 'background-image:url('+ccg.skinImage+');background-size:cover;background-position:center;'
        : '';
    var cls = ccg.skinImage ? '' : ' ccg-bg-'+(ccg.colorScheme||'black');

    return '<div class="ccg-card'+cls+'" id="ccg-front-card" style="'+bg+'">' +
        '<div class="ccg-front">' +
            '<div class="ccg-front-top">'+bank+'</div>' +
            '<div class="ccg-chip-area"><img class="ccg-chip" src="fonts/chip.jpg" alt="Chip"></div>' +
            '<div class="ccg-card-number">'+_ccgEsc(num||'\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022')+'</div>' +
            '<div class="ccg-front-bottom">' +
                '<div class="ccg-bottom-left">' +
                    '<div class="ccg-date-block">'+_ccgDateHTML(ccg.expiry, ccg.dateLayout)+'</div>' +
                    '<span class="ccg-holder-name">'+_ccgEsc(holder)+'</span>' +
                '</div>' +
                '<div class="ccg-network-logo">'+net+'</div>' +
            '</div>' +
        '</div></div>';
}

function _ccgRenderBack(ccg) {
    var cvv = ccg.cvv || '\u2022\u2022\u2022';
    var holder = (ccg.holderName || '').toUpperCase();
    var net = _CCG_NETWORK_LOGOS[ccg.cardNetwork] || _CCG_NETWORK_LOGOS.visa;
    var bg = ccg.skinImage
        ? 'background-image:url('+ccg.skinImage+');background-size:cover;background-position:center;'
        : '';
    var cls = ccg.skinImage ? '' : ' ccg-bg-'+(ccg.colorScheme||'black');

    return '<div class="ccg-card'+cls+'" id="ccg-back-card" style="'+bg+'">' +
        '<div class="ccg-back">' +
            '<div class="ccg-magstripe"></div>' +
            '<div class="ccg-signature-area">' +
                '<div class="ccg-signature-strip"><span class="ccg-signature-text">'+_ccgEsc(holder)+'</span></div>' +
                '<div class="ccg-cvv-box">'+_ccgEsc(cvv)+'</div>' +
            '</div>' +
            '<div class="ccg-back-info">' +
                '<div class="ccg-fine-print">This card is property of the issuing bank and must be returned upon request. Use of this card is subject to the cardholder agreement. For customer service call 1-800-XXX-XXXX. Member FDIC.</div>' +
                '<div class="ccg-back-bottom"><div class="ccg-back-network">'+net+'</div></div>' +
            '</div>' +
        '</div></div>';
}

function _renderCreditCardGenerator() {
    var area = document.getElementById('content-area');
    var bar = document.getElementById('stats-bar');
    bar.style.display='none'; bar.innerHTML='';
    var gen = _CK.generator, ccg = gen.ccg;
    if (!ccg.dateLayout) ccg.dateLayout = 'A';

    var mi = {proxy:'🌐',bin:'🔢',card:'💳',ip:'📡',auto:'🔍',glue:'🔗',generator:'📄'};
    var ml = {proxy:'Proxy',bin:'BIN',card:'Card',ip:'IP',auto:'Auto',glue:'Glue',generator:'Generator'};
    var nets = [{id:'visa',l:'Visa'},{id:'mastercard',l:'MasterCard'},{id:'amex',l:'AMEX'},{id:'jcb',l:'JCB'},{id:'discover',l:'Discover'},{id:'unionpay',l:'UnionPay'}];

    var mh=''; for(var k in mi) mh+='<button class="ck-mode-btn '+(_CK.mode===k?'active':'')+'" data-mode="'+k+'"><span class="ck-mode-icon">'+mi[k]+'</span><span class="ck-mode-label">'+ml[k]+'</span></button>';
    var no=''; for(var i=0;i<nets.length;i++) no+='<option value="'+nets[i].id+'" '+(ccg.cardNetwork===nets[i].id?'selected':'')+'>'+nets[i].l+'</option>';
    var cb=''; for(var j=0;j<_CCG_COLOR_SCHEMES.length;j++){var c=_CCG_COLOR_SCHEMES[j]; cb+='<button class="ccg-color-btn ccg-color-'+c+' '+(ccg.colorScheme===c&&!ccg.skinImage?'active':'')+'" data-ccg-color="'+c+'" title="'+c+'"></button>';}
    var dl=''; var dlLabels={A:'A \u2014 Stacked',B:'B \u2014 Inline',C:'C \u2014 Arrow',D:'D \u2014 Expanded',E:'E \u2014 Minimal'};
    for(var d=0;d<_CCG_DATE_LAYOUTS.length;d++){var v=_CCG_DATE_LAYOUTS[d]; dl+='<option value="'+v+'" '+(ccg.dateLayout===v?'selected':'')+'>'+dlLabels[v]+'</option>';}

    area.innerHTML =
    '<div class="ck-container">'+
        '<div class="ck-header"><div class="ck-title"><span class="ck-icon">💳</span><span>CREDIT CARD GENERATOR</span></div><div class="ck-modes">'+mh+'</div></div>'+
        '<div class="ck-proto-bar"><span class="ck-proto-label">Type:</span>'+
            '<button class="ck-proto-btn '+(gen.type==='tepco'?'active':'')+'" data-billtype="tepco">⚡ TEPCO</button>'+
            '<button class="ck-proto-btn '+(gen.type==='water'?'active':'')+'" data-billtype="water">💧 Water</button>'+
            '<button class="ck-proto-btn '+(gen.type==='creditcard'?'active':'')+'" data-billtype="creditcard">💳 Credit Card</button>'+
        '</div>'+
        '<div class="ccg-form">'+
            '<div class="ccg-form-row">'+
                '<div class="ccg-form-group"><label class="ccg-form-label">Card Number</label><input type="text" class="ccg-form-input" id="ccg-number" maxlength="19" placeholder="4242 4242 4242 4242" value="'+_ccgEsc(ccg.cardNumber)+'"></div>'+
                '<div class="ccg-form-group-sm"><label class="ccg-form-label">Expiry</label><input type="text" class="ccg-form-input" id="ccg-expiry" maxlength="5" placeholder="MM/YY" value="'+_ccgEsc(ccg.expiry)+'"></div>'+
                '<div class="ccg-form-group-sm"><label class="ccg-form-label">CVV</label><input type="text" class="ccg-form-input" id="ccg-cvv" maxlength="4" placeholder="123" value="'+_ccgEsc(ccg.cvv)+'"></div>'+
                '<div class="ccg-form-group-md"><label class="ccg-form-label">Date Layout</label><select class="ccg-form-select" id="ccg-date-layout">'+dl+'</select></div>'+
            '</div>'+
            '<div class="ccg-form-row">'+
                '<div class="ccg-form-group"><label class="ccg-form-label">Cardholder Name</label><input type="text" class="ccg-form-input" id="ccg-holder" placeholder="JOHN DOE" value="'+_ccgEsc(ccg.holderName)+'"></div>'+
                '<div class="ccg-form-group-md"><label class="ccg-form-label">Card Network</label><select class="ccg-form-select" id="ccg-network">'+no+'</select></div>'+
            '</div>'+
            '<div class="ccg-form-row">'+
                '<div class="ccg-form-group"><label class="ccg-form-label">Bank Name</label><input type="text" class="ccg-form-input" id="ccg-bank" placeholder="PREMIUM BANK" value="'+_ccgEsc(ccg.bankName)+'"></div>'+
                '<div class="ccg-form-group-md"><label class="ccg-form-label">Bank Logo</label>'+
                    '<label class="ccg-upload-btn '+(ccg.customLogo?'has-logo':'')+'" id="ccg-upload-label">'+(ccg.customLogo?'✅ Logo':'📁 Upload Logo')+'<input type="file" id="ccg-logo-input" accept=".png,.jpg,.jpeg,.svg,.webp" hidden></label></div>'+
                (ccg.customLogo?'<div class="ccg-form-group-sm" style="align-self:flex-end"><button class="ccg-btn" id="ccg-remove-logo" style="height:32px;color:#f87171;border-color:rgba(248,113,113,0.3)">✕</button></div>':'')+
            '</div>'+
            '<div class="ccg-form-row" style="align-items:center">'+
                '<div class="ccg-form-group" style="flex:0 0 auto"><label class="ccg-form-label">Color / Skin</label><div class="ccg-colors">'+cb+
                    '<label class="ccg-color-btn ccg-color-skin '+(ccg.skinImage?'active':'')+'" title="Upload skin"><span style="font-size:14px">🖼</span><input type="file" id="ccg-skin-input" accept=".png,.jpg,.jpeg,.webp" hidden></label>'+
                    (ccg.skinImage?'<button class="ccg-color-btn" id="ccg-remove-skin" title="Remove skin" style="background:rgba(248,113,113,0.3);font-size:12px;line-height:28px;text-align:center">✕</button>':'')+
                '</div></div>'+
                '<div style="flex:1"></div>'+
                '<div class="ccg-actions">'+
                    '<button class="ccg-btn ccg-btn-download" id="ccg-dl-front">📥 Front PNG</button>'+
                    '<button class="ccg-btn ccg-btn-download" id="ccg-dl-back">📥 Back PNG</button>'+
                '</div>'+
            '</div>'+
        '</div>'+
        '<div class="ccg-preview">'+
            '<div><div class="ccg-card-label">FRONT</div>'+_ccgRenderFront(ccg)+'</div>'+
            '<div><div class="ccg-card-label">BACK</div>'+_ccgRenderBack(ccg)+'</div>'+
        '</div></div>';

    _ccgBindEvents();
}

function _ccgBindEvents() {
    var area = document.getElementById('content-area');
    var gen = _CK.generator, ccg = gen.ccg;

    area.querySelectorAll('.ck-mode-btn').forEach(function(b){b.addEventListener('click',function(){_CK.mode=b.dataset.mode;if(_CK.mode==='glue')_renderGlue();else if(_CK.mode==='generator')_renderGenerator();else renderChecker();});});
    area.querySelectorAll('[data-billtype]').forEach(function(b){b.addEventListener('click',function(){gen.type=b.dataset.billtype;gen.billData=null;_renderGenerator();});});

    function lu(){
        var fw=document.getElementById('ccg-front-card'),bw=document.getElementById('ccg-back-card');
        if(fw&&fw.parentElement)fw.parentElement.innerHTML=_ccgRenderFront(ccg);
        if(bw&&bw.parentElement)bw.parentElement.innerHTML=_ccgRenderBack(ccg);
    }

    var el;
    el=document.getElementById('ccg-number'); if(el)el.addEventListener('input',function(e){var r=e.target.value.replace(/\D/g,'').slice(0,16);e.target.value=r.replace(/(.{4})/g,'$1 ').trim();ccg.cardNumber=e.target.value;lu();});
    el=document.getElementById('ccg-expiry'); if(el)el.addEventListener('input',function(e){var v=e.target.value.replace(/[^\d\/]/g,''),d=v.replace(/\//g,'');if(d.length>=2&&v.indexOf('/')===-1)v=d.slice(0,2)+'/'+d.slice(2,4);e.target.value=v.slice(0,5);ccg.expiry=e.target.value;lu();});
    el=document.getElementById('ccg-cvv'); if(el)el.addEventListener('input',function(e){e.target.value=e.target.value.replace(/\D/g,'').slice(0,4);ccg.cvv=e.target.value;lu();});
    el=document.getElementById('ccg-holder'); if(el)el.addEventListener('input',function(e){ccg.holderName=e.target.value;lu();});
    el=document.getElementById('ccg-bank'); if(el)el.addEventListener('input',function(e){ccg.bankName=e.target.value;lu();});
    el=document.getElementById('ccg-network'); if(el)el.addEventListener('change',function(e){ccg.cardNetwork=e.target.value;lu();});
    el=document.getElementById('ccg-date-layout'); if(el)el.addEventListener('change',function(e){ccg.dateLayout=e.target.value;lu();});

    area.querySelectorAll('[data-ccg-color]').forEach(function(b){b.addEventListener('click',function(){ccg.colorScheme=b.dataset.ccgColor;ccg.skinImage=null;_renderCreditCardGenerator();});});

    el=document.getElementById('ccg-logo-input'); if(el)el.addEventListener('change',function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){ccg.customLogo=ev.target.result;_renderCreditCardGenerator();toast('Logo uploaded!','success');};r.readAsDataURL(f);});
    el=document.getElementById('ccg-remove-logo'); if(el)el.addEventListener('click',function(){ccg.customLogo=null;_renderCreditCardGenerator();});

    el=document.getElementById('ccg-skin-input'); if(el)el.addEventListener('change',function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){ccg.skinImage=ev.target.result;_renderCreditCardGenerator();toast('Skin applied!','success');};r.readAsDataURL(f);});
    el=document.getElementById('ccg-remove-skin'); if(el)el.addEventListener('click',function(){ccg.skinImage=null;_renderCreditCardGenerator();});

    el=document.getElementById('ccg-dl-front'); if(el)el.addEventListener('click',function(){_ccgDownloadPNG('ccg-front-card','CreditCard_Front_'+Date.now()+'.png');});
    el=document.getElementById('ccg-dl-back'); if(el)el.addEventListener('click',function(){_ccgDownloadPNG('ccg-back-card','CreditCard_Back_'+Date.now()+'.png');});
}

function _ccgDownloadPNG(id,fn){
    var el=document.getElementById(id);if(!el){toast('Not found','error');return;}
    if(typeof html2canvas==='undefined'){var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';s.onload=function(){_ccgCapture(el,fn);};document.head.appendChild(s);return;}
    _ccgCapture(el,fn);
}

function _ccgCapture(el,fn){
    html2canvas(el,{scale:2,backgroundColor:null,useCORS:true,allowTaint:true,logging:false}).then(function(c){
        var a=document.createElement('a');a.download=fn;a.href=c.toDataURL('image/png');a.click();toast('Downloaded: '+fn,'success');
    }).catch(function(e){console.error(e);toast('Export failed','error');});
}
