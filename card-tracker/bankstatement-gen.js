// BANK STATEMENT GENERATOR v3 — Japan only, bilingual (Google verification) // deploy:2026-06-15
var _BS={country:'japan',bank:'mufg',holderName:'SAYO YAMATANI',cardNumber:'3540 **** **** 1016',
accountNumber:'',routingNumber:'',address1:'2-15-4 Karasuma',address2:'Nakagyo-ku',
city:'Kyoto',state:'Kyoto',zip:'604-8152',dateFrom:'',dateTo:'',logoImage:null,
generated:false,transactions:[],openingBalance:0,closingBalance:0,
accountType:'普通預金 / Savings',dateOpened:''};

var _BS_BANKS={
japan:{
mufg:{name:'三菱UFJ銀行 / MUFG Bank, Ltd.',short:'MUFG Bank',sub:'MUFG Bank, Ltd.',addr:'2-7-1 Marunouchi, Chiyoda-ku, Tokyo',phone:'0120-860-777',web:'bk.mufg.jp',color:'#cc0000',currency:'¥',bsbLabel:'支店番号 / Branch Code'},
smbc:{name:'三井住友銀行 / SMBC',short:'SMBC',sub:'Sumitomo Mitsui Banking Corp.',addr:'1-1-2 Marunouchi, Chiyoda-ku, Tokyo',phone:'0120-28-6079',web:'smbc.co.jp',color:'#00a650',currency:'¥',bsbLabel:'支店番号 / Branch Code'},
mizuho:{name:'みずほ銀行 / Mizuho Bank',short:'Mizuho',sub:'Mizuho Bank, Ltd.',addr:'1-5-5 Otemachi, Chiyoda-ku, Tokyo',phone:'0120-3242-86',web:'mizuhobank.co.jp',color:'#1e3c72',currency:'¥',bsbLabel:'支店番号 / Branch Code'},
rakuten:{name:'楽天銀行 / Rakuten Bank',short:'Rakuten Bank',sub:'Rakuten Bank, Ltd.',addr:'Shinagawa Seaside Rakuten Tower, Tokyo',phone:'0120-691-036',web:'rakuten-bank.co.jp',color:'#bf0000',currency:'¥',bsbLabel:'支店番号 / Branch Code'},
jcb:{name:'JCBクレジット / JCB Credit',short:'JCB Credit',sub:'JCB Co., Ltd.',addr:'5-1-22 Minami-Aoyama, Minato-ku, Tokyo',phone:'0120-015-870',web:'jcb.co.jp',color:'#00308F',currency:'¥',bsbLabel:'支店番号 / Branch Code'}
}};

var _BS_TX={japan:{
grocery:['AEON イオン','SEVEN ELEVEN セブンイレブン','FAMILY MART ファミマ','LAWSON ローソン','LIFE ライフ','SEIYU 西友'],
gas:['ENEOS エネオス','IDEMITSU 出光','COSMO OIL コスモ'],
restaurant:['MCDONALDS マクドナルド','STARBUCKS スターバックス','SUKIYA すき家','YOSHINOYA 吉野家','GUSTO ガスト','SAIZERIYA サイゼリヤ'],
utility:['TOKYO ELEC 東京電力','TOKYO GAS 東京ガス','NTT DOCOMO ドコモ','SOFTBANK ソフトバンク','AU/KDDI','NHK 受信料'],
sub:['NETFLIX','SPOTIFY','AMAZON PRIME','APPLE','YOUTUBE PREMIUM'],
shop:['AMAZON.CO.JP アマゾン','RAKUTEN 楽天','YODOBASHI ヨドバシ','BIC CAMERA ビックカメラ','UNIQLO ユニクロ','MUJI 無印良品','NITORI ニトリ'],
transfer:['BANK TRANSFER 振込','ATM DEPOSIT ATM入金','ATM WITHDRAWAL ATM出金','DIRECT DEBIT 口座振替','SALARY 給与振込'],
medical:['MATSUMOTO KIYOSHI マツキヨ','TSURUHA ツルハ','SUGI PHARMACY スギ薬局'],
income:['SALARY DEPOSIT 給与','BONUS 賞与','INTEREST 利息','TRANSFER CREDIT 振込入金']
}};

function _bsB(){return _BS_BANKS.japan[_BS.bank]||_BS_BANKS.japan.mufg;}
function _bsF(a){return '¥'+Math.round(Math.abs(a)).toLocaleString();}
function _bsD(d){var mm=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return d.getDate().toString().padStart(2,'0')+' '+mm[d.getMonth()]+' '+d.getFullYear();}
function _bsR(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
function _bsP(arr){return arr[Math.floor(Math.random()*arr.length)];}
function _bsE(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):'';}

function _bsGen(){
    var from=new Date(_BS.dateFrom),to=new Date(_BS.dateTo);
    if(isNaN(from.getTime())||isNaN(to.getTime())){to=new Date();from=new Date();from.setDate(from.getDate()-30);}
    var days=Math.ceil((to-from)/(1000*60*60*24));
    if(days<1)days=30;if(days>60)days=60;
    var txns=[],bal=_bsR(150000,2000000);
    _BS.openingBalance=bal;
    var card4=_BS.cardNumber.replace(/\s/g,'').slice(-4);
    // Income 1-2 times per month
    [_bsR(1,5),_bsR(15,20)].forEach(function(pd){
        var d=new Date(from);d.setDate(from.getDate()+pd);
        if(d<=to){var amt=_bsR(150000,280000);
        txns.push({date:new Date(d),desc:_bsP(_BS_TX.japan.income),card:null,amount:amt,type:'credit'});}
    });
    for(var day=0;day<days;day++){
        var d=new Date(from);d.setDate(from.getDate()+day);if(d>to)break;
        var n=_bsR(1,3);
        for(var t=0;t<n;t++){
            var cat,amt,r=Math.random();
            if(r<0.25){cat='grocery';amt=_bsR(300,5000);}
            else if(r<0.35){cat='gas';amt=_bsR(2000,5000);}
            else if(r<0.50){cat='restaurant';amt=_bsR(200,2500);}
            else if(r<0.58){cat='utility';amt=_bsR(2000,15000);}
            else if(r<0.65){cat='sub';amt=_bsR(500,1500);}
            else if(r<0.78){cat='shop';amt=_bsR(800,15000);}
            else if(r<0.85){cat='transfer';amt=_bsR(3000,25000);}
            else{cat='medical';amt=_bsR(400,4000);}
            var useCard=cat!=='transfer'&&cat!=='income'&&Math.random()>0.3;
            txns.push({date:new Date(d),desc:_bsP(_BS_TX.japan[cat]),card:useCard?card4:null,amount:amt,type:'debit'});
        }
    }
    txns.sort(function(a,b){return a.date-b.date;});
    var run=_BS.openingBalance;
    txns.forEach(function(tx){if(tx.type==='credit')run+=tx.amount;else run-=tx.amount;tx.balance=run;});
    _BS.closingBalance=run;_BS.transactions=txns;_BS.generated=true;
}

function _bsPreview(){
    var bank=_bsB(),S='style',dateStr=_bsD(new Date());
    var fromD=new Date(_BS.dateFrom),toD=new Date(_BS.dateTo);
    var card4=_BS.cardNumber.replace(/\s/g,'').slice(-4);
    var logo=_BS.logoImage?'<img src="'+_BS.logoImage+'" '+S+'="max-height:38px;max-width:160px;object-fit:contain">':'<div '+S+'="display:inline-flex;align-items:center;gap:6px"><div '+S+'="width:32px;height:32px;background:'+bank.color+';border-radius:3px"></div><div '+S+'="font-size:18px;font-weight:700;color:'+bank.color+'">'+_bsE(bank.short)+'</div></div>';
    var rows='',idx=0;
    _BS.transactions.forEach(function(tx){
        var amtS=tx.type==='credit'?_bsF(tx.amount):'-'+_bsF(tx.amount);
        var amtColor=tx.type==='credit'?'color:#16a34a;':'color:#222;';
        var bg=idx%2?'background:#fafafa;':'';
        var det=_bsE(tx.desc);
        if(tx.card)det+=' <span '+S+'="color:#888;font-size:9px">(xx'+tx.card+')</span>';
        rows+='<tr '+S+'="'+bg+'"><td '+S+'="padding:5px 10px;border-bottom:1px solid #eee;font-size:10px;white-space:nowrap;vertical-align:middle;color:#555">'+_bsD(tx.date)+'</td><td '+S+'="padding:5px 10px;border-bottom:1px solid #eee;font-size:10px;vertical-align:middle">'+det+'</td><td '+S+'="padding:5px 10px;border-bottom:1px solid #eee;font-size:10px;text-align:right;white-space:nowrap;vertical-align:middle;'+amtColor+'">'+amtS+'</td><td '+S+'="padding:5px 10px;border-bottom:1px solid #eee;font-size:10px;text-align:right;white-space:nowrap;vertical-align:middle;font-weight:500">'+_bsF(tx.balance)+'</td></tr>';idx++;});
    var tIn=0,tOut=0;_BS.transactions.forEach(function(tx){if(tx.type==='credit')tIn+=tx.amount;else tOut+=tx.amount;});
    var addrLine='〒'+_bsE(_BS.zip)+' '+_bsE(_BS.state)+' '+_bsE(_BS.city)+' '+_bsE(_BS.address1)+(_BS.address2?' '+_bsE(_BS.address2):'');
    var P='<div class="bs2-wrap"><div id="bs-page" '+S+'="width:794px;min-height:1123px;background:#fff;padding:0;font-family:\'Hiragino Kaku Gothic Pro\',\'Meiryo\',Arial,sans-serif;color:#222;box-shadow:0 4px 24px rgba(0,0,0,.35);box-sizing:border-box">';
    P+='<div '+S+'="height:3px;background:'+bank.color+'"></div>';
    P+='<div '+S+'="padding:20px 36px 14px;display:flex;justify-content:space-between;align-items:flex-start">';
    P+='<div>'+logo+'<div '+S+'="font-size:8px;color:#999;margin-top:3px;line-height:1.3">'+_bsE(bank.name)+'<br>'+_bsE(bank.addr)+'<br>Tel: '+_bsE(bank.phone)+'</div></div>';
    P+='<div '+S+'="text-align:right;border:1px solid #ddd;padding:8px 14px;border-radius:2px;min-width:170px;background:#fafafa"><div '+S+'="font-size:8px;color:#888;letter-spacing:.8px;margin-bottom:1px">口座番号 / Account No.</div><div '+S+'="font-size:13px;font-weight:700;letter-spacing:1px;margin-bottom:4px">'+_bsE(_BS.routingNumber)+' '+_bsE(_BS.accountNumber)+'</div><div '+S+'="font-size:8px;color:#888;letter-spacing:.8px">Page 1 of 1</div></div></div>';
    P+='<div '+S+'="height:1px;background:#e0e0e0;margin:0 36px"></div>';
    P+='<div '+S+'="padding:14px 36px 10px;display:flex;gap:24px">';
    P+='<div '+S+'="flex:1"><div '+S+'="font-size:12px;font-weight:700;margin-bottom:3px">'+_bsE(_BS.holderName)+'</div><div '+S+'="font-size:10px;color:#444;line-height:1.5">'+addrLine+'</div><div '+S+'="font-size:9px;color:#888;margin-top:6px">'+dateStr+'</div></div>';
    P+='<div '+S+'="min-width:260px;background:#f7f7f7;border:1px solid #e5e5e5;border-radius:3px;padding:10px 14px"><table '+S+'="border-collapse:collapse;width:100%">';
    P+='<tr><td '+S+'="font-size:9px;font-weight:600;padding:2px 12px 2px 0;color:#555">口座名義 / Account Name</td><td '+S+'="font-size:9px;padding:2px 0">'+_bsE(_BS.holderName)+'</td></tr>';
    P+='<tr><td '+S+'="font-size:9px;font-weight:600;padding:2px 12px 2px 0;color:#555">'+_bsE(bank.bsbLabel)+'</td><td '+S+'="font-size:9px;padding:2px 0">'+_bsE(_BS.routingNumber)+'</td></tr>';
    P+='<tr><td '+S+'="font-size:9px;font-weight:600;padding:2px 12px 2px 0;color:#555">口座番号 / Account No.</td><td '+S+'="font-size:9px;padding:2px 0">'+_bsE(_BS.accountNumber)+'</td></tr>';
    P+='<tr><td '+S+'="font-size:9px;font-weight:600;padding:2px 12px 2px 0;color:#555">口座種別 / Account Type</td><td '+S+'="font-size:9px;padding:2px 0">'+_bsE(_BS.accountType)+'</td></tr>';
    P+='<tr><td '+S+'="font-size:9px;font-weight:600;padding:2px 12px 2px 0;color:#555">開設日 / Date Opened</td><td '+S+'="font-size:9px;padding:2px 0">'+_bsE(_BS.dateOpened)+'</td></tr>';
    P+='</table></div></div>';
    P+='<div '+S+'="padding:0 36px 8px;font-size:9px;color:#666">取引明細期間 / Statement Period: '+_bsD(fromD)+' — '+_bsD(toD)+'</div>';
    P+='<div '+S+'="display:flex;margin:0 36px 6px;border-radius:3px;overflow:hidden;border:1px solid #e0e0e0">';
    P+='<div '+S+'="flex:1;background:#f8f9fa;padding:7px 10px;text-align:center;border-right:1px solid #e0e0e0"><div '+S+'="font-size:7px;text-transform:uppercase;letter-spacing:.6px;color:#888;margin-bottom:1px">前回残高 / Opening</div><div '+S+'="font-size:13px;font-weight:700">'+_bsF(_BS.openingBalance)+'</div></div>';
    P+='<div '+S+'="flex:1;background:#f0faf0;padding:7px 10px;text-align:center;border-right:1px solid #e0e0e0"><div '+S+'="font-size:7px;text-transform:uppercase;letter-spacing:.6px;color:#888;margin-bottom:1px">入金合計 / Credits</div><div '+S+'="font-size:13px;font-weight:700;color:#16a34a">+'+_bsF(tIn)+'</div></div>';
    P+='<div '+S+'="flex:1;background:#fef5f5;padding:7px 10px;text-align:center;border-right:1px solid #e0e0e0"><div '+S+'="font-size:7px;text-transform:uppercase;letter-spacing:.6px;color:#888;margin-bottom:1px">出金合計 / Debits</div><div '+S+'="font-size:13px;font-weight:700;color:#dc2626">-'+_bsF(tOut)+'</div></div>';
    P+='<div '+S+'="flex:1;background:'+bank.color+';padding:7px 10px;text-align:center"><div '+S+'="font-size:7px;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.7);margin-bottom:1px">現在残高 / Balance</div><div '+S+'="font-size:13px;font-weight:700;color:#fff">'+_bsF(_BS.closingBalance)+'</div></div></div>';
    P+='<div '+S+'="padding:0 36px"><table '+S+'="width:100%;border-collapse:collapse"><thead><tr><th '+S+'="background:'+bank.color+';color:#fff;font-weight:600;font-size:9px;padding:6px 10px;text-align:left">日付 / Date</th><th '+S+'="background:'+bank.color+';color:#fff;font-weight:600;font-size:9px;padding:6px 10px;text-align:left">取引内容 / Details</th><th '+S+'="background:'+bank.color+';color:#fff;font-weight:600;font-size:9px;padding:6px 10px;text-align:right">金額 / Amount</th><th '+S+'="background:'+bank.color+';color:#fff;font-weight:600;font-size:9px;padding:6px 10px;text-align:right">残高 / Balance</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    P+='<div '+S+'="margin:16px 36px 0;padding-top:10px;border-top:1px solid #ddd;display:flex;justify-content:space-between;align-items:flex-end"><div '+S+'="font-size:7px;color:#aaa;line-height:1.4">発行日 / Issue Date: '+dateStr+'<br>本明細書は発行時点の情報に基づいて作成されています。<br>This statement is accurate at the time of issue.<br>'+_bsE(bank.name)+' — '+_bsE(bank.web)+'</div><div '+S+'="font-size:8px;color:#bbb">'+_bsE(bank.short)+' Statement</div></div>';
    P+='</div></div></div>';
    return P;
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
    if(!_BS.dateOpened){var o=new Date();o.setFullYear(o.getFullYear()-1);_BS.dateOpened=_bsD(o);}
    var bOpts='';var banks=_BS_BANKS.japan;
    for(var bk in banks)bOpts+='<option value="'+bk+'"'+(_BS.bank===bk?' selected':'')+'>'+banks[bk].short+'</option>';
    area.innerHTML=
    '<div class="ck-container">'+
    '<div class="ck-header"><div class="ck-title"><span class="ck-icon">🏦</span><span>BANK STATEMENT</span></div><div class="ck-modes">'+mh+'</div></div>'+
    '<div class="ck-proto-bar"><span class="ck-proto-label">Type:</span>'+
    '<button class="ck-proto-btn '+(gen.type==='tepco'?'active':'')+'" data-billtype="tepco">⚡ TEPCO Electricity</button>'+
    '<button class="ck-proto-btn '+(gen.type==='water'?'active':'')+'" data-billtype="water">💧 Water Bill</button>'+
    '<button class="ck-proto-btn '+(gen.type==='creditcard'?'active':'')+'" data-billtype="creditcard">💳 Credit Card</button>'+
    '<button class="ck-proto-btn '+(gen.type==='driverlicense'?'active':'')+'" data-billtype="driverlicense">🪪 Driver License</button>'+
    '<button class="ck-proto-btn '+(gen.type==='zipprocessor'?'active':'')+'" data-billtype="zipprocessor">📦 ZIP Processor</button>'+
    '<button class="ck-proto-btn '+(gen.type==='bankstatement'?'active':'')+'" data-billtype="bankstatement">🏦 Bank Statement</button></div>'+
    '<div class="bs-form">'+
    '<div class="bs-form-row"><button class="bs-country-btn active" disabled>🇯🇵 Japan</button><select class="bs-select" id="bs-bank">'+bOpts+'</select><label class="bs-logo-btn">'+(_BS.logoImage?'✅ Logo':'📁 Logo')+'<input type="file" id="bs-logo-input" accept="image/*" hidden></label></div>'+
    '<div class="bs-form-row"><div class="bs-fg"><label class="bs-label">Full Name</label><input class="bs-input" id="bs-name" value="'+_bsE(_BS.holderName)+'"></div><div class="bs-fg"><label class="bs-label">Card Number</label><input class="bs-input" id="bs-card" value="'+_bsE(_BS.cardNumber)+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">Account Type</label><input class="bs-input" id="bs-actype" value="'+_bsE(_BS.accountType)+'"></div></div>'+
    '<div class="bs-form-row"><div class="bs-fg"><label class="bs-label">Account #</label><input class="bs-input" id="bs-acct" value="'+_bsE(_BS.accountNumber)+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">Branch Code</label><input class="bs-input" id="bs-routing" value="'+_bsE(_BS.routingNumber)+'"></div><div class="bs-fg bs-fg-sm"><label class="bs-label">Date Opened</label><input class="bs-input" id="bs-opened" value="'+_bsE(_BS.dateOpened)+'"></div></div>'+
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
    var bs=document.getElementById('bs-bank');if(bs)bs.addEventListener('change',function(){_BS.bank=this.value;_BS.generated=false;_renderBankStatementGenerator();});
    var li=document.getElementById('bs-logo-input');if(li)li.addEventListener('change',function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){_BS.logoImage=ev.target.result;_renderBankStatementGenerator();};r.readAsDataURL(f);});
    var flds={'bs-name':'holderName','bs-card':'cardNumber','bs-acct':'accountNumber','bs-routing':'routingNumber','bs-addr1':'address1','bs-addr2':'address2','bs-city':'city','bs-state':'state','bs-zip':'zip','bs-from':'dateFrom','bs-to':'dateTo','bs-actype':'accountType','bs-opened':'dateOpened'};
    for(var id in flds)(function(i,k){var el=document.getElementById(i);if(el)el.addEventListener('input',function(){_BS[k]=this.value;});})(id,flds[id]);
    var gb=document.getElementById('bs-generate');if(gb)gb.addEventListener('click',function(){for(var i in flds){var el=document.getElementById(i);if(el)_BS[flds[i]]=el.value;}_bsGen();_renderBankStatementGenerator();toast(_BS.transactions.length+' transactions ✓','success');});
    var dl=document.getElementById('bs-dl-png');if(dl)dl.addEventListener('click',function(){
        var pg=document.getElementById('bs-page');if(!pg)return;toast('Rendering PNG...','info');
        html2canvas(pg,{scale:2,useCORS:true,backgroundColor:'#ffffff'}).then(function(c){var a=document.createElement('a');a.download='BankStatement_'+_BS.holderName.replace(/\s+/g,'_')+'.png';a.href=c.toDataURL('image/png');a.click();toast('PNG downloaded ✓','success');}).catch(function(e){toast('Error: '+e.message,'error');});
    });
}
