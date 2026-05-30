// BANK STATEMENT GENERATOR v2 — Commonwealth Bank style
var _BS={country:'usa',bank:'chase',holderName:'JOHN DOE',cardNumber:'4242 4242 4242 4242',
accountNumber:'',routingNumber:'',address1:'123 Main Street',address2:'Apt 4B',
city:'New York',state:'NY',zip:'10001',dateFrom:'',dateTo:'',logoImage:null,
generated:false,transactions:[],openingBalance:0,closingBalance:0,
accountType:'Checking',dateOpened:'',jpLang:50};

var _BS_BANKS={
usa:{
chase:{name:'JPMorgan Chase Bank, N.A.',short:'Chase',sub:'Member FDIC',addr:'270 Park Avenue, New York, NY 10017',phone:'1-800-935-9935',web:'chase.com',color:'#0b3d91',currency:'$',bsbLabel:'Routing Number'},
boa:{name:'Bank of America, N.A.',short:'Bank of America',sub:'Member FDIC',addr:'100 N Tryon St, Charlotte, NC 28255',phone:'1-800-432-1000',web:'bankofamerica.com',color:'#012169',currency:'$',bsbLabel:'Routing Number'},
wells:{name:'Wells Fargo Bank, N.A.',short:'Wells Fargo',sub:'Member FDIC',addr:'420 Montgomery St, San Francisco, CA 94104',phone:'1-800-869-3557',web:'wellsfargo.com',color:'#d71e28',currency:'$',bsbLabel:'Routing Number'},
citi:{name:'Citibank, N.A.',short:'Citibank',sub:'Member FDIC',addr:'388 Greenwich St, New York, NY 10013',phone:'1-800-374-9700',web:'citibank.com',color:'#003B70',currency:'$',bsbLabel:'Routing Number'}
},
japan:{
mufg:{name:'三菱UFJ銀行','short':'MUFG Bank',sub:'MUFG Bank, Ltd.',addr:'2-7-1 Marunouchi, Chiyoda-ku, Tokyo',phone:'0120-860-777',web:'bk.mufg.jp',color:'#cc0000',currency:'¥',bsbLabel:'Branch Code'},
smbc:{name:'三井住友銀行',short:'SMBC',sub:'Sumitomo Mitsui Banking Corp.',addr:'1-1-2 Marunouchi, Chiyoda-ku, Tokyo',phone:'0120-28-6079',web:'smbc.co.jp',color:'#00a650',currency:'¥',bsbLabel:'Branch Code'},
mizuho:{name:'みずほ銀行',short:'Mizuho',sub:'Mizuho Bank, Ltd.',addr:'1-5-5 Otemachi, Chiyoda-ku, Tokyo',phone:'0120-3242-86',web:'mizuhobank.co.jp',color:'#1e3c72',currency:'¥',bsbLabel:'Branch Code'},
rakuten:{name:'楽天銀行',short:'Rakuten Bank',sub:'Rakuten Bank, Ltd.',addr:'Shinagawa Seaside Rakuten Tower, Tokyo',phone:'0120-691-036',web:'rakuten-bank.co.jp',color:'#bf0000',currency:'¥',bsbLabel:'Branch Code'}
}};

var _BS_TX={
usa:{
grocery:['WALMART SUPERCENTER','TARGET STORE','KROGER','WHOLE FOODS MKT','TRADER JOES','COSTCO WHSE','SAFEWAY','ALDI','PUBLIX SUPER MKT'],
gas:['SHELL SERVICE STN','CHEVRON','EXXONMOBIL','BP AMOCO','COSTCO GAS'],
restaurant:['MCDONALDS','STARBUCKS','CHIPOTLE','CHICK-FIL-A','DOMINOS PIZZA','SUBWAY','PANERA BREAD'],
utility:['CONSOLIDATED EDISON','PACIFIC GAS ELEC','AT&T WIRELESS','T-MOBILE','VERIZON WIRELESS','COMCAST CABLE'],
sub:['NETFLIX.COM','SPOTIFY USA','AMAZON PRIME','APPLE.COM/BILL','GOOGLE *YOUTUBE','HULU'],
shop:['AMAZON.COM','BEST BUY','HOME DEPOT','LOWES','MACYS','NORDSTROM','NIKE.COM'],
transfer:['ZELLE PAYMENT','VENMO CASHOUT','PAYPAL TRANSFER','WIRE TRANSFER'],
medical:['CVS PHARMACY','WALGREENS','RITE AID'],
income:['PAYROLL DIRECT DEP','EMPLOYER DIRECT DEP','ACH CREDIT']
},
japan:{
grocery:{en:['AEON STORE','SEVEN ELEVEN','FAMILY MART','LAWSON','LIFE SUPERMARKET','SEIYU','SEIJO ISHII'],jp:['イオン','セブンイレブン','ファミリーマート','ローソン','ライフ','西友','成城石井']},
gas:{en:['ENEOS GAS STN','IDEMITSU','COSMO OIL'],jp:['ENEOS','出光','コスモ石油']},
restaurant:{en:['MCDONALDS JP','STARBUCKS JP','SUKIYA','YOSHINOYA','MATSUYA','GUSTO','SAIZERIYA'],jp:['マクドナルド','スターバックス','すき家','吉野家','松屋','ガスト','サイゼリヤ']},
utility:{en:['TOKYO ELECTRIC POWER','TOKYO GAS CO','NTT DOCOMO','SOFTBANK MOBILE','AU/KDDI','TOKYO WATERWORKS','NHK BROADCAST FEE'],jp:['東京電力','東京ガス','NTTドコモ','ソフトバンク','au/KDDI','東京都水道局','NHK受信料']},
sub:{en:['NETFLIX','SPOTIFY','AMAZON PRIME','APPLE','YOUTUBE PREMIUM'],jp:['Netflix','Spotify','Amazon Prime','Apple','YouTube Premium']},
shop:{en:['AMAZON CO JP','RAKUTEN ICHIBA','YODOBASHI CAMERA','BIC CAMERA','UNIQLO','MUJI','NITORI'],jp:['Amazon.co.jp','楽天市場','ヨドバシカメラ','ビックカメラ','ユニクロ','無印良品','ニトリ']},
transfer:{en:['BANK TRANSFER','ATM DEPOSIT','ATM WITHDRAWAL','DIRECT DEBIT','SALARY TRANSFER'],jp:['振込','ATM入金','ATM出金','口座振替','給与振込']},
medical:{en:['MATSUMOTO KIYOSHI','TSURUHA DRUG','SUGI PHARMACY'],jp:['マツモトキヨシ','ツルハドラッグ','スギ薬局']},
income:{en:['SALARY DEPOSIT','BONUS PAYMENT','INTEREST CREDIT','TRANSFER CREDIT'],jp:['給与','賞与','利息','振込入金']}
}};

function _bsB(){return _BS_BANKS[_BS.country]?.[_BS.bank]||_BS_BANKS.usa.chase;}
function _bsF(a){var b=_bsB();if(b.currency==='¥')return b.currency+Math.round(Math.abs(a)).toLocaleString();return b.currency+Math.abs(a).toFixed(2);}
function _bsD(d){var mm=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return d.getDate().toString().padStart(2,'0')+' '+mm[d.getMonth()]+' '+d.getFullYear();}
function _bsR(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function _bsRF(a,b){return Math.random()*(b-a)+a;}
function _bsP(arr){return arr[Math.floor(Math.random()*arr.length)];}
function _bsE(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):''}

function _bsPickTx(cat){
    var m=_BS_TX[_BS.country];if(!m)m=_BS_TX.usa;
    if(_BS.country==='japan'){
        var c=m[cat];if(!c)c=m.grocery;
        var useJP=Math.random()*100<_BS.jpLang;
        return useJP?_bsP(c.jp):_bsP(c.en);
    }
    var arr=m[cat];return arr?_bsP(arr):_bsP(m.grocery);
}

function _bsGen(){
    var from=new Date(_BS.dateFrom),to=new Date(_BS.dateTo);
    if(isNaN(from.getTime())||isNaN(to.getTime())){to=new Date();from=new Date();from.setDate(from.getDate()-30);}
    var days=Math.ceil((to-from)/(1000*60*60*24));
    if(days<1)days=30;if(days>60)days=60;
    var isJP=_BS.country==='japan';
    var txns=[],bal=isJP?_bsR(300000,2500000):_bsRF(2500,15000);
    _BS.openingBalance=bal;
    var card4=_BS.cardNumber.replace(/\s/g,'').slice(-4);
    // Income
    [_bsR(1,5),_bsR(15,20)].forEach(function(pd){
        var d=new Date(from);d.setDate(from.getDate()+pd);
        if(d<=to){var amt=isJP?_bsR(180000,450000):_bsRF(2200,5500);
        txns.push({date:new Date(d),desc:_bsPickTx('income'),card:null,amount:amt,type:'credit'});}
    });
    for(var day=0;day<days;day++){
        var d=new Date(from);d.setDate(from.getDate()+day);if(d>to)break;
        var n=_bsR(0,3);
        for(var t=0;t<n;t++){
            var cat,amt,r=Math.random();
            if(r<0.25){cat='grocery';amt=isJP?_bsR(500,8000):_bsRF(15,180);}
            else if(r<0.35){cat='gas';amt=isJP?_bsR(3000,7000):_bsRF(25,75);}
            else if(r<0.50){cat='restaurant';amt=isJP?_bsR(300,3000):_bsRF(5,55);}
            else if(r<0.58){cat='utility';amt=isJP?_bsR(3000,25000):_bsRF(50,250);}
            else if(r<0.65){cat='sub';amt=isJP?_bsR(500,2000):_bsRF(5,20);}
            else if(r<0.78){cat='shop';amt=isJP?_bsR(1000,30000):_bsRF(15,300);}
            else if(r<0.85){cat='transfer';amt=isJP?_bsR(5000,50000):_bsRF(50,500);}
            else{cat='medical';amt=isJP?_bsR(500,5000):_bsRF(10,80);}
            if(!isJP)amt=Math.round(amt*100)/100;
            var useCard=cat!=='transfer'&&cat!=='income'&&Math.random()>0.3;
            txns.push({date:new Date(d),desc:_bsPickTx(cat),card:useCard?card4:null,amount:amt,type:'debit'});
        }
    }
    txns.sort(function(a,b){return a.date-b.date;});
    var run=_BS.openingBalance;
    txns.forEach(function(tx){if(tx.type==='credit')run+=tx.amount;else run-=tx.amount;tx.balance=run;});
    _BS.closingBalance=run;_BS.transactions=txns;_BS.generated=true;
}

function _bsPreview(){
    var bank=_bsB(),isJP=_BS.country==='japan';
    var fullAddr=_BS.address1+(_BS.address2?'\n'+_BS.address2:'')+'\n'+_BS.city+', '+_BS.state+' '+_BS.zip;
    var fromD=new Date(_BS.dateFrom),toD=new Date(_BS.dateTo);
    var periodStr=_bsD(fromD).split(' ').slice(1).join('/')+'-'+_bsD(toD).split(' ').slice(1).join('/');
    var card4=_BS.cardNumber.replace(/\s/g,'').slice(-4);
    var logo=_BS.logoImage?'<img src="'+_BS.logoImage+'" style="max-height:45px;max-width:200px;object-fit:contain">':'<div style="background:'+bank.color+';color:#fff;font-weight:800;font-size:18px;padding:8px 18px;border-radius:4px;letter-spacing:1px;display:inline-flex;align-items:center;gap:8px">'+_bsE(bank.short)+'</div>';
    var dateStr=_bsD(new Date());
    // Tx rows
    var rows='';
    _BS.transactions.forEach(function(tx){
        var amtS=tx.type==='credit'?_bsF(tx.amount):'-'+_bsF(tx.amount);
        var sub='';
        if(tx.card)sub+='<br><span class="bs2-sub">Card xx'+tx.card+'</span>';
        sub+='<br><span class="bs2-sub">Value Date: '+_bsD(tx.date)+'</span>';
        rows+='<tr><td class="bs2-td">'+_bsD(tx.date)+'</td><td class="bs2-td">'+_bsE(tx.desc)+sub+'</td><td class="bs2-td bs2-r">'+amtS+'</td><td class="bs2-td bs2-r">'+_bsF(tx.balance)+'</td></tr>';
    });

    return '<div class="bs2-wrap"><div class="bs2-page" id="bs-page">'+
    '<div class="bs2-top"><div class="bs2-top-l">'+logo+'<div class="bs2-bank-sub">'+_bsE(bank.name)+'<br>'+_bsE(bank.sub)+'</div></div>'+
    '<div class="bs2-top-r"><b>Account Number</b><br>'+_bsE(_BS.routingNumber)+' '+_bsE(_BS.accountNumber)+'<br><b>Page</b><br>1 of 1</div></div>'+
    '<div class="bs2-addr">'+_bsE(_BS.holderName)+'<br>'+_bsE(_BS.address1)+(_BS.address2?'<br>'+_bsE(_BS.address2):'')+'<br>'+_bsE(_BS.city)+', '+_bsE(_BS.state)+' '+_bsE(_BS.zip)+'</div>'+
    '<div class="bs2-date">'+dateStr+'</div>'+
    '<div class="bs2-greeting">Dear '+_bsE(_BS.holderName)+',</div>'+
    '<div class="bs2-intro">Here\'s your account information and a list of transactions from '+periodStr+'.</div>'+
    '<table class="bs2-info"><tr><td class="bs2-info-l">Account name</td><td class="bs2-info-v">'+_bsE(_BS.holderName)+'</td></tr>'+
    '<tr><td class="bs2-info-l">'+_bsE(bank.bsbLabel)+'</td><td class="bs2-info-v">'+_bsE(_BS.routingNumber)+'</td></tr>'+
    '<tr><td class="bs2-info-l">Account number</td><td class="bs2-info-v">'+_bsE(_BS.accountNumber)+'</td></tr>'+
    '<tr><td class="bs2-info-l">Account type</td><td class="bs2-info-v">'+_bsE(_BS.accountType)+'</td></tr>'+
    '<tr><td class="bs2-info-l">Date opened</td><td class="bs2-info-v">'+_bsE(_BS.dateOpened)+'</td></tr></table>'+
    '<table class="bs2-table"><thead><tr><th class="bs2-th">Date</th><th class="bs2-th">Transaction details</th><th class="bs2-th bs2-r">Amount</th><th class="bs2-th bs2-r">Balance</th></tr></thead><tbody>'+rows+'</tbody></table>'+
    '<div class="bs2-footer"><div class="bs2-footer-l">Created '+dateStr+'<br>While this letter is accurate at the time it\'s produced,<br>we\'re not responsible for any reliance on this information.</div><div class="bs2-footer-r">Transaction Summary v1.0</div></div>'+
    '</div></div>';
}

function _renderBankStatementGenerator(){
    var area=document.getElementById('content-area'),bar=document.getElementById('stats-bar');
    bar.style.display='none';bar.innerHTML='';
    var gen=_CK.generator;
    var mi={proxy:'🌐',bin:'🔢',card:'💳',ip:'📡',auto:'🔍',glue:'🔗',generator:'📄'};
    var ml={proxy:'Proxy',bin:'BIN',card:'Card',ip:'IP',auto:'Auto',glue:'Glue',generator:'Generator'};
    var mh='';for(var k in mi)mh+='<button class="ck-mode-btn '+(_CK.mode===k?'active':'')+'" data-mode="'+k+'"><span class="ck-mode-icon">'+mi[k]+'</span><span class="ck-mode-label">'+ml[k]+'</span></button>';
    if(!_BS.dateFrom){var df=new Date();df.setDate(df.getDate()-30);_BS.dateFrom=df.toISOString().slice(0,10);}
    if(!_BS.dateTo){_BS.dateTo=new Date().toISOString().slice(0,10);}
    if(!_BS.accountNumber)_BS.accountNumber=_bsR(10000000,99999999).toString();
    if(!_BS.routingNumber)_BS.routingNumber=_bsR(100000,999999).toString();
    if(!_BS.dateOpened){var o=new Date();o.setFullYear(o.getFullYear()-_bsR(1,5));_BS.dateOpened=_bsD(o);}
    var bOpts='';var banks=_BS_BANKS[_BS.country]||{};
    for(var bk in banks)bOpts+='<option value="'+bk+'"'+(_BS.bank===bk?' selected':'')+'>'+banks[bk].short+'</option>';
    var jpSlider=_BS.country==='japan'?'<div class="bs-fg bs-fg-sm" style="min-width:160px"><label class="bs-label">JP/EN Mix: '+_BS.jpLang+'% JP</label><input type="range" min="0" max="100" value="'+_BS.jpLang+'" id="bs-jplang" style="width:100%"></div>':'';
    area.innerHTML=
    '<div class="ck-container">'+
    '<div class="ck-header"><div class="ck-title"><span class="ck-icon">🏦</span><span>BANK STATEMENT</span></div><div class="ck-modes">'+mh+'</div></div>'+
    '<div class="ck-proto-bar"><span class="ck-proto-label">Type:</span>'+
    '<button class="ck-proto-btn '+(gen.type==='tepco'?'active':'')+'" data-billtype="tepco">⚡ TEPCO</button>'+
    '<button class="ck-proto-btn '+(gen.type==='water'?'active':'')+'" data-billtype="water">💧 Water</button>'+
    '<button class="ck-proto-btn '+(gen.type==='creditcard'?'active':'')+'" data-billtype="creditcard">💳 Credit Card</button>'+
    '<button class="ck-proto-btn '+(gen.type==='driverlicense'?'active':'')+'" data-billtype="driverlicense">🪪 Driver License</button>'+
    '<button class="ck-proto-btn '+(gen.type==='bankstatement'?'active':'')+'" data-billtype="bankstatement">🏦 Bank Statement</button>'+
    '<button class="ck-proto-btn '+(gen.type==='zipprocessor'?'active':'')+'" data-billtype="zipprocessor">📦 ZIP Processor</button></div>'+
    '<div class="bs-form">'+
    '<div class="bs-form-row"><button class="bs-country-btn'+(_BS.country==='usa'?' active':'')+'" data-bscountry="usa">🇺🇸 USA</button><button class="bs-country-btn'+(_BS.country==='japan'?' active':'')+'" data-bscountry="japan">🇯🇵 Japan</button><select class="bs-select" id="bs-bank">'+bOpts+'</select><label class="bs-logo-btn">'+(_BS.logoImage?'✅ Logo':'📁 Logo')+'<input type="file" id="bs-logo-input" accept="image/*" hidden></label>'+jpSlider+'</div>'+
    '<div class="bs-form-row"><div class="bs-fg"><label class="bs-label">Full Name</label><input class="bs-input" id="bs-name" value="'+_bsE(_BS.holderName)+'"></div><div class="bs-fg"><label class="bs-label">Card Number</label><input class="bs-input" id="bs-card" value="'+_bsE(_BS.cardNumber)+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">Account Type</label><input class="bs-input" id="bs-actype" value="'+_bsE(_BS.accountType)+'"></div></div>'+
    '<div class="bs-form-row"><div class="bs-fg"><label class="bs-label">Account #</label><input class="bs-input" id="bs-acct" value="'+_bsE(_BS.accountNumber)+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">Routing/BSB</label><input class="bs-input" id="bs-routing" value="'+_bsE(_BS.routingNumber)+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">Date Opened</label><input class="bs-input" id="bs-opened" value="'+_bsE(_BS.dateOpened)+'"></div></div>'+
    '<div class="bs-form-row"><div class="bs-fg"><label class="bs-label">Address Line 1</label><input class="bs-input" id="bs-addr1" value="'+_bsE(_BS.address1)+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">Address Line 2</label><input class="bs-input" id="bs-addr2" value="'+_bsE(_BS.address2)+'"></div></div>'+
    '<div class="bs-form-row"><div class="bs-fg"><label class="bs-label">City</label><input class="bs-input" id="bs-city" value="'+_bsE(_BS.city)+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">State</label><input class="bs-input" id="bs-state" value="'+_bsE(_BS.state)+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">ZIP</label><input class="bs-input" id="bs-zip" value="'+_bsE(_BS.zip)+'"></div></div>'+
    '<div class="bs-form-row"><div class="bs-fg bs-fg-sm"><label class="bs-label">Date From</label><input type="date" class="bs-input" id="bs-from" value="'+_BS.dateFrom+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">Date To</label><input type="date" class="bs-input" id="bs-to" value="'+_BS.dateTo+'"></div><button class="bs-gen-btn" id="bs-generate">⚡ GENERATE</button>'+(_BS.generated?'<button class="bs-pdf-btn" id="bs-dl-png">📥 Download PNG</button>':'')+'</div></div>'+
    (_BS.generated?_bsPreview():'')+'</div>';
    _bsBind();
}

function _bsBind(){
    var area=document.getElementById('content-area'),gen=_CK.generator;
    area.querySelectorAll('.ck-mode-btn').forEach(function(b){b.addEventListener('click',function(){_CK.mode=b.dataset.mode;if(_CK.mode==='glue')_renderGlue();else if(_CK.mode==='generator')_renderGenerator();else renderChecker();});});
    area.querySelectorAll('[data-billtype]').forEach(function(b){b.addEventListener('click',function(){gen.type=b.dataset.billtype;gen.billData=null;_renderGenerator();});});
    area.querySelectorAll('[data-bscountry]').forEach(function(b){b.addEventListener('click',function(){_BS.country=b.dataset.bscountry;var bks=Object.keys(_BS_BANKS[_BS.country]||{});_BS.bank=bks[0]||'chase';_BS.generated=false;_renderBankStatementGenerator();});});
    var bs=document.getElementById('bs-bank');if(bs)bs.addEventListener('change',function(){_BS.bank=this.value;_BS.generated=false;_renderBankStatementGenerator();});
    var li=document.getElementById('bs-logo-input');if(li)li.addEventListener('change',function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){_BS.logoImage=ev.target.result;_renderBankStatementGenerator();};r.readAsDataURL(f);});
    var jp=document.getElementById('bs-jplang');if(jp)jp.addEventListener('input',function(){_BS.jpLang=parseInt(this.value);this.parentElement.querySelector('.bs-label').textContent='JP/EN Mix: '+_BS.jpLang+'% JP';});
    var flds={'bs-name':'holderName','bs-card':'cardNumber','bs-acct':'accountNumber','bs-routing':'routingNumber','bs-addr1':'address1','bs-addr2':'address2','bs-city':'city','bs-state':'state','bs-zip':'zip','bs-from':'dateFrom','bs-to':'dateTo','bs-actype':'accountType','bs-opened':'dateOpened'};
    for(var id in flds)(function(i,k){var el=document.getElementById(i);if(el)el.addEventListener('input',function(){_BS[k]=this.value;});})(id,flds[id]);
    var gb=document.getElementById('bs-generate');if(gb)gb.addEventListener('click',function(){for(var i in flds){var el=document.getElementById(i);if(el)_BS[flds[i]]=el.value;}_bsGen();_renderBankStatementGenerator();toast(_BS.transactions.length+' transactions ✓','success');});
    var dl=document.getElementById('bs-dl-png');if(dl)dl.addEventListener('click',function(){
        var pg=document.getElementById('bs-page');if(!pg)return;toast('Rendering PNG...','info');
        html2canvas(pg,{scale:2,useCORS:true,backgroundColor:'#ffffff'}).then(function(c){var a=document.createElement('a');a.download='BankStatement_'+_BS.holderName.replace(/\s+/g,'_')+'.png';a.href=c.toDataURL('image/png');a.click();toast('PNG downloaded ✓','success');}).catch(function(e){toast('Error: '+e.message,'error');});
    });
}
