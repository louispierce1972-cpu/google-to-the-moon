// ═══════════════════════════════════════════
//  BANK STATEMENT GENERATOR v1
//  USA + Japan — A4 format, realistic transactions
// ═══════════════════════════════════════════

var _BS = {
    country: 'usa',
    bank: 'chase',
    holderName: 'JOHN DOE',
    cardNumber: '4242 4242 4242 4242',
    accountNumber: '',
    routingNumber: '',
    address1: '123 Main Street',
    address2: 'Apt 4B',
    city: 'New York',
    state: 'NY',
    zip: '10001',
    dateFrom: '',
    dateTo: '',
    logoImage: null,
    generated: false,
    transactions: [],
    openingBalance: 0,
    closingBalance: 0
};

// ─── BANK PRESETS ───
var _BS_BANKS = {
    usa: {
        chase:    { name:'JPMorgan Chase Bank, N.A.', short:'Chase', addr:'270 Park Avenue, New York, NY 10017', phone:'1-800-935-9935', web:'chase.com', color:'#0b3d91', currency:'$' },
        boa:      { name:'Bank of America, N.A.', short:'Bank of America', addr:'100 N Tryon St, Charlotte, NC 28255', phone:'1-800-432-1000', web:'bankofamerica.com', color:'#012169', currency:'$' },
        wells:    { name:'Wells Fargo Bank, N.A.', short:'Wells Fargo', addr:'420 Montgomery St, San Francisco, CA 94104', phone:'1-800-869-3557', web:'wellsfargo.com', color:'#d71e28', currency:'$' },
        citi:     { name:'Citibank, N.A.', short:'Citibank', addr:'388 Greenwich St, New York, NY 10013', phone:'1-800-374-9700', web:'citibank.com', color:'#003B70', currency:'$' }
    },
    japan: {
        mufg:     { name:'三菱UFJ銀行 (MUFG Bank, Ltd.)', short:'MUFG', addr:'2-7-1 Marunouchi, Chiyoda-ku, Tokyo 100-8388', phone:'0120-860-777', web:'bk.mufg.jp', color:'#cc0000', currency:'¥' },
        smbc:     { name:'三井住友銀行 (SMBC)', short:'SMBC', addr:'1-1-2 Marunouchi, Chiyoda-ku, Tokyo 100-0005', phone:'0120-28-6079', web:'smbc.co.jp', color:'#00a650', currency:'¥' },
        mizuho:   { name:'みずほ銀行 (Mizuho Bank, Ltd.)', short:'Mizuho', addr:'1-5-5 Otemachi, Chiyoda-ku, Tokyo 100-8176', phone:'0120-3242-86', web:'mizuhobank.co.jp', color:'#1e3c72', currency:'¥' },
        rakuten:  { name:'楽天銀行 (Rakuten Bank, Ltd.)', short:'Rakuten Bank', addr:'Shinagawa Seaside Rakuten Tower, Tokyo 140-0002', phone:'0120-691-036', web:'rakuten-bank.co.jp', color:'#bf0000', currency:'¥' }
    }
};

// ─── MERCHANT DATA ───
var _BS_MERCHANTS = {
    usa: {
        grocery: ['WALMART SUPERCENTER','TARGET STORE','KROGER','WHOLE FOODS MKT','TRADER JOES','COSTCO WHSE','SAFEWAY','ALDI','PUBLIX SUPER MKT','HEB GROCERY'],
        gas: ['SHELL SERVICE STN','CHEVRON','EXXONMOBIL','BP AMOCO','COSTCO GAS','SUNOCO','MARATHON PETRO'],
        restaurant: ['MCDONALDS','STARBUCKS','CHIPOTLE','CHICK-FIL-A','DOMINOS PIZZA','SUBWAY','PANERA BREAD','OLIVE GARDEN','APPLEBEES'],
        utility: ['CONSOLIDATED EDISON','PACIFIC GAS ELEC','DUKE ENERGY','AT&T WIRELESS','T-MOBILE','VERIZON WIRELESS','COMCAST CABLE','SPECTRUM'],
        subscription: ['NETFLIX.COM','SPOTIFY USA','AMAZON PRIME','APPLE.COM/BILL','GOOGLE *YOUTUBE','HULU','DISNEY PLUS','HBO MAX'],
        shopping: ['AMAZON.COM','BEST BUY','HOME DEPOT','LOWES','MACYS','NORDSTROM','NIKE.COM','APPLE STORE'],
        transfer: ['ZELLE PAYMENT','VENMO CASHOUT','PAYPAL TRANSFER','WIRE TRANSFER','ACH DEPOSIT','DIRECT DEPOSIT'],
        medical: ['CVS PHARMACY','WALGREENS','RITE AID','QUEST DIAGNOSTICS'],
        income: ['PAYROLL DIRECT DEP','EMPLOYER DIRECT DEP','ACH CREDIT','INTEREST PAYMENT']
    },
    japan: {
        grocery: ['イオン','セブンイレブン','ファミリーマート','ローソン','まいばすけっと','ライフ','西友','成城石井','サミット'],
        gas: ['ENEOS','出光','コスモ石油','昭和シェル'],
        restaurant: ['マクドナルド','スターバックス','すき家','吉野家','松屋','ガスト','サイゼリヤ','ココイチ'],
        utility: ['東京電力','東京ガス','NTTドコモ','ソフトバンク','au/KDDI','東京都水道局','NHK受信料'],
        subscription: ['Netflix','Spotify','Amazon Prime','Apple','YouTube Premium','楽天モバイル'],
        shopping: ['Amazon.co.jp','楽天市場','ヨドバシカメラ','ビックカメラ','ユニクロ','無印良品','ニトリ'],
        transfer: ['振込','ATM入金','ATM出金','口座振替','給与振込'],
        medical: ['マツモトキヨシ','ツルハドラッグ','スギ薬局'],
        income: ['給与','賞与','利息','振込入金']
    }
};

function _bsGetBank(){
    return _BS_BANKS[_BS.country]?.[_BS.bank] || _BS_BANKS.usa.chase;
}

function _bsFmt(amount){
    var bank=_bsGetBank();
    if(bank.currency==='¥') return bank.currency+Math.round(amount).toLocaleString();
    return bank.currency+Math.abs(amount).toFixed(2);
}

function _bsDateStr(d){
    if(_BS.country==='japan'){
        return d.getFullYear()+'/'+(d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0');
    }
    return (d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0')+'/'+d.getFullYear();
}

function _bsRand(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
function _bsRandF(min,max){return Math.random()*(max-min)+min;}
function _bsPick(arr){return arr[Math.floor(Math.random()*arr.length)];}

function _bsGenerateTransactions(){
    var from=new Date(_BS.dateFrom);
    var to=new Date(_BS.dateTo);
    if(isNaN(from.getTime())||isNaN(to.getTime())){
        to=new Date(); from=new Date(); from.setDate(from.getDate()-30);
    }
    var days=Math.ceil((to-from)/(1000*60*60*24));
    if(days<1) days=30;
    if(days>60) days=60;

    var m=_BS_MERCHANTS[_BS.country]||_BS_MERCHANTS.usa;
    var isJP=_BS.country==='japan';
    var txns=[];
    var bal=isJP?_bsRand(300000,2500000):_bsRandF(2500,15000);
    _BS.openingBalance=bal;

    // Income 1-2 times
    var paydays=[_bsRand(1,5),_bsRand(15,20)];
    paydays.forEach(function(pd){
        var d=new Date(from); d.setDate(from.getDate()+pd);
        if(d<=to){
            var amt=isJP?_bsRand(180000,450000):_bsRandF(2200,5500);
            txns.push({date:new Date(d),desc:_bsPick(m.income),amount:amt,type:'credit'});
        }
    });

    // Generate daily spending
    for(var day=0;day<days;day++){
        var d=new Date(from); d.setDate(from.getDate()+day);
        if(d>to) break;
        var txCount=_bsRand(0,3);
        for(var t=0;t<txCount;t++){
            var cat,amt,desc;
            var r=Math.random();
            if(r<0.25){cat='grocery';amt=isJP?_bsRand(500,8000):_bsRandF(15,180);}
            else if(r<0.35){cat='gas';amt=isJP?_bsRand(3000,7000):_bsRandF(25,75);}
            else if(r<0.50){cat='restaurant';amt=isJP?_bsRand(300,3000):_bsRandF(5,55);}
            else if(r<0.58){cat='utility';amt=isJP?_bsRand(3000,25000):_bsRandF(50,250);}
            else if(r<0.65){cat='subscription';amt=isJP?_bsRand(500,2000):_bsRandF(5,20);}
            else if(r<0.78){cat='shopping';amt=isJP?_bsRand(1000,30000):_bsRandF(15,300);}
            else if(r<0.85){cat='transfer';amt=isJP?_bsRand(5000,50000):_bsRandF(50,500);}
            else{cat='medical';amt=isJP?_bsRand(500,5000):_bsRandF(10,80);}
            desc=_bsPick(m[cat]||m.grocery);
            if(!isJP) amt=Math.round(amt*100)/100;
            txns.push({date:new Date(d),desc:desc,amount:amt,type:'debit'});
        }
    }

    // Sort by date
    txns.sort(function(a,b){return a.date-b.date;});

    // Calculate running balance
    var running=_BS.openingBalance;
    txns.forEach(function(tx){
        if(tx.type==='credit') running+=tx.amount;
        else running-=tx.amount;
        tx.balance=running;
    });
    _BS.closingBalance=running;
    _BS.transactions=txns;
    _BS.generated=true;
}

// ─── RENDER ───
function _renderBankStatementGenerator(){
    var area=document.getElementById('content-area');
    var bar=document.getElementById('stats-bar');
    bar.style.display='none';bar.innerHTML='';
    var gen=_CK.generator;
    var mi={proxy:'🌐',bin:'🔢',card:'💳',ip:'📡',auto:'🔍',glue:'🔗',generator:'📄'};
    var ml={proxy:'Proxy',bin:'BIN',card:'Card',ip:'IP',auto:'Auto',glue:'Glue',generator:'Generator'};
    var mh='';for(var k in mi)mh+='<button class="ck-mode-btn '+(_CK.mode===k?'active':'')+'" data-mode="'+k+'"><span class="ck-mode-icon">'+mi[k]+'</span><span class="ck-mode-label">'+ml[k]+'</span></button>';

    // Default dates
    if(!_BS.dateFrom){var df=new Date();df.setDate(df.getDate()-30);_BS.dateFrom=df.toISOString().slice(0,10);}
    if(!_BS.dateTo){_BS.dateTo=new Date().toISOString().slice(0,10);}
    if(!_BS.accountNumber) _BS.accountNumber=_bsRand(100000000,999999999).toString();
    if(!_BS.routingNumber) _BS.routingNumber=_bsRand(100000000,299999999).toString();

    var bankOpts='';
    var banks=_BS_BANKS[_BS.country]||{};
    for(var bk in banks) bankOpts+='<option value="'+bk+'"'+(_BS.bank===bk?' selected':'')+'>'+banks[bk].short+'</option>';

    var countryBtns='<button class="bs-country-btn'+(_BS.country==='usa'?' active':'')+'" data-bscountry="usa">🇺🇸 USA</button>'+
        '<button class="bs-country-btn'+(_BS.country==='japan'?' active':'')+'" data-bscountry="japan">🇯🇵 Japan</button>';

    area.innerHTML=
    '<div class="ck-container">'+
        '<div class="ck-header"><div class="ck-title"><span class="ck-icon">🏦</span><span>BANK STATEMENT</span></div><div class="ck-modes">'+mh+'</div></div>'+
        '<div class="ck-proto-bar"><span class="ck-proto-label">Type:</span>'+
            '<button class="ck-proto-btn '+(gen.type==='tepco'?'active':'')+'" data-billtype="tepco">⚡ TEPCO</button>'+
            '<button class="ck-proto-btn '+(gen.type==='water'?'active':'')+'" data-billtype="water">💧 Water</button>'+
            '<button class="ck-proto-btn '+(gen.type==='creditcard'?'active':'')+'" data-billtype="creditcard">💳 Credit Card</button>'+
            '<button class="ck-proto-btn '+(gen.type==='driverlicense'?'active':'')+'" data-billtype="driverlicense">🪪 Driver License</button>'+
            '<button class="ck-proto-btn '+(gen.type==='bankstatement'?'active':'')+'" data-billtype="bankstatement">🏦 Bank Statement</button>'+
            '<button class="ck-proto-btn '+(gen.type==='zipprocessor'?'active':'')+'" data-billtype="zipprocessor">📦 ZIP Processor</button>'+
        '</div>'+
        // Form
        '<div class="bs-form">'+
            '<div class="bs-form-row">'+countryBtns+'<select class="bs-select" id="bs-bank">'+bankOpts+'</select>'+
            '<label class="bs-logo-btn" id="bs-logo-label">'+(_BS.logoImage?'✅ Logo':'📁 Logo')+'<input type="file" id="bs-logo-input" accept="image/*" hidden></label></div>'+
            '<div class="bs-form-row">'+
                '<div class="bs-fg"><label class="bs-label">Full Name</label><input class="bs-input" id="bs-name" value="'+_bsEsc(_BS.holderName)+'" placeholder="JOHN DOE"></div>'+
                '<div class="bs-fg"><label class="bs-label">Card Number</label><input class="bs-input" id="bs-card" value="'+_bsEsc(_BS.cardNumber)+'" placeholder="4242 4242 4242 4242"></div>'+
            '</div>'+
            '<div class="bs-form-row">'+
                '<div class="bs-fg"><label class="bs-label">Account #</label><input class="bs-input" id="bs-acct" value="'+_bsEsc(_BS.accountNumber)+'"></div>'+
                '<div class="bs-fg bs-fg-sm"><label class="bs-label">Routing #</label><input class="bs-input" id="bs-routing" value="'+_bsEsc(_BS.routingNumber)+'"></div>'+
            '</div>'+
            '<div class="bs-form-row">'+
                '<div class="bs-fg"><label class="bs-label">Address Line 1</label><input class="bs-input" id="bs-addr1" value="'+_bsEsc(_BS.address1)+'" placeholder="123 Main St"></div>'+
                '<div class="bs-fg bs-fg-sm"><label class="bs-label">Address Line 2</label><input class="bs-input" id="bs-addr2" value="'+_bsEsc(_BS.address2)+'" placeholder="Apt 4B"></div>'+
            '</div>'+
            '<div class="bs-form-row">'+
                '<div class="bs-fg"><label class="bs-label">City</label><input class="bs-input" id="bs-city" value="'+_bsEsc(_BS.city)+'"></div>'+
                '<div class="bs-fg bs-fg-sm"><label class="bs-label">State</label><input class="bs-input" id="bs-state" value="'+_bsEsc(_BS.state)+'"></div>'+
                '<div class="bs-fg bs-fg-sm"><label class="bs-label">ZIP</label><input class="bs-input" id="bs-zip" value="'+_bsEsc(_BS.zip)+'"></div>'+
            '</div>'+
            '<div class="bs-form-row">'+
                '<div class="bs-fg bs-fg-sm"><label class="bs-label">Date From</label><input type="date" class="bs-input" id="bs-from" value="'+_BS.dateFrom+'"></div>'+
                '<div class="bs-fg bs-fg-sm"><label class="bs-label">Date To</label><input type="date" class="bs-input" id="bs-to" value="'+_BS.dateTo+'"></div>'+
                '<button class="bs-gen-btn" id="bs-generate">⚡ GENERATE STATEMENT</button>'+
                (_BS.generated?'<button class="bs-pdf-btn" id="bs-download-pdf">📄 Download PDF</button>':'')+
            '</div>'+
        '</div>'+
        // Preview
        (_BS.generated?_bsRenderPreview():'')+
    '</div>';

    _bsBindEvents();
}

function _bsEsc(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):''}

function _bsRenderPreview(){
    var bank=_bsGetBank();
    var cur=bank.currency;
    var isJP=_BS.country==='japan';
    var fullAddr=_BS.address1+(_BS.address2?', '+_BS.address2:'')+', '+_BS.city+', '+_BS.state+' '+_BS.zip;
    var maskedCard='****  ****  ****  '+_BS.cardNumber.replace(/\s/g,'').slice(-4);
    var fromD=new Date(_BS.dateFrom); var toD=new Date(_BS.dateTo);
    var periodStr=_bsDateStr(fromD)+' — '+_bsDateStr(toD);

    // Logo
    var logoHtml=_BS.logoImage?'<img src="'+_BS.logoImage+'" class="bs-logo-img">':'<div class="bs-logo-placeholder" style="background:'+bank.color+'">'+bank.short+'</div>';

    // Transaction rows
    var txRows='';
    _BS.transactions.forEach(function(tx){
        var amtStr=tx.type==='credit'?'+'+_bsFmt(tx.amount):'-'+_bsFmt(tx.amount);
        var cls=tx.type==='credit'?'bs-tx-credit':'bs-tx-debit';
        txRows+='<tr><td class="bs-td">'+_bsDateStr(tx.date)+'</td><td class="bs-td">'+_bsEsc(tx.desc)+'</td><td class="bs-td bs-td-r '+cls+'">'+amtStr+'</td><td class="bs-td bs-td-r">'+_bsFmt(tx.balance)+'</td></tr>';
    });

    // Summary
    var totalCredits=0,totalDebits=0;
    _BS.transactions.forEach(function(tx){if(tx.type==='credit')totalCredits+=tx.amount;else totalDebits+=tx.amount;});

    return '<div class="bs-preview-wrap"><div class="bs-page" id="bs-page">'+
        // Header
        '<div class="bs-header">'+
            '<div class="bs-header-left">'+logoHtml+'</div>'+
            '<div class="bs-header-right"><div class="bs-bank-name">'+_bsEsc(bank.name)+'</div><div class="bs-bank-addr">'+_bsEsc(bank.addr)+'</div><div class="bs-bank-contact">'+bank.phone+' | '+bank.web+'</div></div>'+
        '</div>'+
        '<div class="bs-divider"></div>'+
        // Account Info — TOP (name + card + address)
        '<div class="bs-info-grid">'+
            '<div class="bs-info-col"><div class="bs-info-label">Account Holder</div><div class="bs-info-val bs-info-name">'+_bsEsc(_BS.holderName)+'</div><div class="bs-info-val">'+_bsEsc(fullAddr)+'</div></div>'+
            '<div class="bs-info-col"><div class="bs-info-label">Account Number</div><div class="bs-info-val">'+_bsEsc(_BS.accountNumber)+'</div>'+
            '<div class="bs-info-label" style="margin-top:4px">Card Number</div><div class="bs-info-val">'+maskedCard+'</div></div>'+
            '<div class="bs-info-col"><div class="bs-info-label">Statement Period</div><div class="bs-info-val">'+periodStr+'</div>'+
            '<div class="bs-info-label" style="margin-top:4px">Page</div><div class="bs-info-val">1 of 1</div></div>'+
        '</div>'+
        '<div class="bs-divider"></div>'+
        // Summary
        '<div class="bs-summary">'+
            '<div class="bs-sum-item"><div class="bs-sum-label">Opening Balance</div><div class="bs-sum-val">'+_bsFmt(_BS.openingBalance)+'</div></div>'+
            '<div class="bs-sum-item"><div class="bs-sum-label">Total Credits</div><div class="bs-sum-val bs-tx-credit">+'+_bsFmt(totalCredits)+'</div></div>'+
            '<div class="bs-sum-item"><div class="bs-sum-label">Total Debits</div><div class="bs-sum-val bs-tx-debit">-'+_bsFmt(totalDebits)+'</div></div>'+
            '<div class="bs-sum-item bs-sum-closing"><div class="bs-sum-label">Closing Balance</div><div class="bs-sum-val">'+_bsFmt(_BS.closingBalance)+'</div></div>'+
        '</div>'+
        '<div class="bs-divider"></div>'+
        // Transaction table
        '<div class="bs-section-title">TRANSACTION DETAILS</div>'+
        '<table class="bs-table"><thead><tr><th class="bs-th">Date</th><th class="bs-th">Description</th><th class="bs-th bs-th-r">Amount</th><th class="bs-th bs-th-r">Balance</th></tr></thead><tbody>'+txRows+'</tbody></table>'+
        '<div class="bs-divider" style="margin-top:12px"></div>'+
        // Footer — BOTTOM (name + card + address again)
        '<div class="bs-footer">'+
            '<div class="bs-footer-left"><div class="bs-info-label">Account Holder</div><div class="bs-info-val bs-info-name">'+_bsEsc(_BS.holderName)+'</div><div class="bs-info-val" style="font-size:9px">'+_bsEsc(fullAddr)+'</div></div>'+
            '<div class="bs-footer-center"><div class="bs-info-label">Card</div><div class="bs-info-val">'+maskedCard+'</div></div>'+
            '<div class="bs-footer-right"><div class="bs-info-val" style="font-size:8px;color:#888">This statement is a summary of your account activity. Please review and report any discrepancies within 60 days.</div><div class="bs-info-val" style="font-size:8px;color:#aaa;margin-top:4px">'+_bsEsc(bank.name)+' | Member FDIC</div></div>'+
        '</div>'+
    '</div></div>';
}

// ─── EVENTS ───
function _bsBindEvents(){
    var area=document.getElementById('content-area');
    var gen=_CK.generator;

    area.querySelectorAll('.ck-mode-btn').forEach(function(b){b.addEventListener('click',function(){_CK.mode=b.dataset.mode;if(_CK.mode==='glue')_renderGlue();else if(_CK.mode==='generator')_renderGenerator();else renderChecker();});});
    area.querySelectorAll('[data-billtype]').forEach(function(b){b.addEventListener('click',function(){gen.type=b.dataset.billtype;gen.billData=null;_renderGenerator();});});

    // Country buttons
    area.querySelectorAll('[data-bscountry]').forEach(function(b){b.addEventListener('click',function(){
        _BS.country=b.dataset.bscountry;
        var banks=Object.keys(_BS_BANKS[_BS.country]||{});
        _BS.bank=banks[0]||'chase';
        _BS.generated=false;
        _renderBankStatementGenerator();
    });});

    // Bank select
    var bankSel=document.getElementById('bs-bank');
    if(bankSel) bankSel.addEventListener('change',function(){_BS.bank=this.value;_BS.generated=false;_renderBankStatementGenerator();});

    // Logo upload
    var logoInp=document.getElementById('bs-logo-input');
    if(logoInp) logoInp.addEventListener('change',function(e){
        var f=e.target.files[0]; if(!f)return;
        var r=new FileReader();
        r.onload=function(ev){_BS.logoImage=ev.target.result;_renderBankStatementGenerator();};
        r.readAsDataURL(f);
    });

    // Form inputs
    var fields={
        'bs-name':'holderName','bs-card':'cardNumber','bs-acct':'accountNumber','bs-routing':'routingNumber',
        'bs-addr1':'address1','bs-addr2':'address2','bs-city':'city','bs-state':'state','bs-zip':'zip',
        'bs-from':'dateFrom','bs-to':'dateTo'
    };
    for(var id in fields){
        (function(fid,key){
            var el=document.getElementById(fid);
            if(el) el.addEventListener('input',function(){_BS[key]=this.value;});
        })(id,fields[id]);
    }

    // Generate
    var genBtn=document.getElementById('bs-generate');
    if(genBtn) genBtn.addEventListener('click',function(){
        // Read all fields
        for(var id in fields){var el=document.getElementById(id);if(el)_BS[fields[id]]=el.value;}
        _bsGenerateTransactions();
        _renderBankStatementGenerator();
        toast(_BS.transactions.length+' transactions generated ✓','success');
    });

    // PDF download
    var pdfBtn=document.getElementById('bs-download-pdf');
    if(pdfBtn) pdfBtn.addEventListener('click',_bsDownloadPDF);
}

// ─── PDF EXPORT ───
function _bsDownloadPDF(){
    var page=document.getElementById('bs-page');
    if(!page){toast('Generate first','error');return;}
    toast('Generating PDF...','info');
    html2canvas(page,{scale:2,useCORS:true,backgroundColor:'#ffffff'}).then(function(canvas){
        var imgData=canvas.toDataURL('image/png');
        var JPDF=window.jspdf&&window.jspdf.jsPDF?window.jspdf.jsPDF:(window.jsPDF||null);
        if(!JPDF){toast('jsPDF library not loaded','error');return;}
        var pdf=new JPDF({orientation:'portrait',unit:'mm',format:'a4'});
        var w=210,h=canvas.height*w/canvas.width;
        if(h>297){h=297;w=canvas.width*h/canvas.height;}
        pdf.addImage(imgData,'PNG',0,0,w,h);
        pdf.save('bank_statement_'+_BS.holderName.replace(/\s+/g,'_')+'.pdf');
        toast('PDF downloaded ✓','success');
    }).catch(function(e){console.error(e);toast('PDF error: '+e.message,'error');});
}
