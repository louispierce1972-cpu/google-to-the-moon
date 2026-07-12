// ═══════════════════════════════════════════
//  CALIFORNIA DRIVER LICENSE GENERATOR v1
// ═══════════════════════════════════════════

var _DL_HAIR_COLORS = ['BLK','BRN','BLN','RED','GRY','WHI','SDY','BAL'];
var _DL_EYE_COLORS = ['BLK','BRN','BLU','GRN','GRY','HZL'];
var _DL_CLASSES = ['C','A','B','M'];

function _dlEsc(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):'';}

function _dlRand(min,max){return Math.floor(Math.random()*(max-min+1))+min;}
function _dlRandLetter(){return String.fromCharCode(65+_dlRand(0,25));}
function _dlRandDigits(n){var s='';for(var i=0;i<n;i++)s+=_dlRand(0,9);return s;}

function _dlGenerateNumber(){
    return _dlRandLetter()+_dlRandDigits(7);
}

function _dlCalculateExpiration(dob,issueDate){
    if(!dob)return '';
    var p=dob.split('/');if(p.length!==3)return '';
    var mm=p[0],dd=p[1];
    var iss=issueDate?new Date(issueDate):new Date();
    var expYear=iss.getFullYear()+5;
    return mm+'/'+dd+'/'+expYear;
}

function _dlGenerateDD(issueDate){
    var d=issueDate?new Date(issueDate):new Date();
    var mm=String(d.getMonth()+1).padStart(2,'0');
    var dd=String(d.getDate()).padStart(2,'0');
    var yyyy=d.getFullYear();
    var rrr=_dlRandDigits(3);
    var ee=_dlRand(0,1)?_dlRandDigits(2):_dlRandLetter()+_dlRandLetter();
    var gl=_dlRandLetter();var gg=gl+gl;
    var re=_dlRandLetter()+_dlRandLetter();
    var expYr=String(yyyy+5).slice(-2);
    return mm+'/'+dd+'/'+yyyy+rrr+ee+'/'+gg+re+'/'+expYr;
}

function _dlGenerateInventory(dlNum,issueDate){
    var d=issueDate?new Date(issueDate):new Date();
    var yy=String(d.getFullYear()).slice(-2);
    var xxx=_dlRandDigits(3);
    var a=_dlRandLetter();
    var num=(dlNum||'M0000000').replace(/[^0-9]/g,'').padStart(8,'0');
    var xx=_dlRandDigits(2);
    return yy+xxx+a+num+xx+'01';
}

function _dlFormatDOBNum(dob){
    if(!dob)return '';
    return dob.replace(/\//g,'');
}

function _dlGetDefaults(){
    return {
        firstName:'JOHN',lastName:'WICK',
        dob:'09/02/1964',
        street:'1624 CANYON ROAD',city:'SPRING VALLEY',state:'CA',zip:'91977',
        sex:'M',height:'6\'-03"',weight:'170',hair:'BLK',eyes:'BLK',
        dlClass:'C',restrictions:'NONE',endorsements:'NONE',
        issueDate:'',dlNumber:'',dd:'',inventoryNum:'',expiration:'',
        photoData:null,signatureData:null,
        revDate:'08/29/2017'
    };
}

function _dlEnsureState(){
    if(!_CK.generator.dl) _CK.generator.dl=_dlGetDefaults();
    var s=_CK.generator.dl;
    if(!s.batch) s.batch=[];
    if(s.selectedIdx===undefined) s.selectedIdx=-1;
    if(!s.batchCount) s.batchCount=5;
    if(!s.batchSex) s.batchSex='random';
    if(!s.batchAgeMin) s.batchAgeMin=21;
    if(!s.batchAgeMax) s.batchAgeMax=35;
    return s;
}

function _dlGenerateAll(){
    var dl=_dlEnsureState();
    if(!dl.issueDate){
        var now=new Date();
        var m=String(now.getMonth()+1).padStart(2,'0');
        var d=String(now.getDate()).padStart(2,'0');
        dl.issueDate=m+'/'+d+'/'+now.getFullYear();
    }
    dl.dlNumber=_dlGenerateNumber();
    dl.dd=_dlGenerateDD(dl.issueDate);
    dl.expiration=_dlCalculateExpiration(dl.dob,dl.issueDate);
    dl.inventoryNum=_dlGenerateInventory(dl.dlNumber,dl.issueDate);
}

function _dlGenerateCard(sex,ageMin,ageMax){
    var card=_dlRandomPerson(sex,ageMin,ageMax);
    var now=new Date();
    var m=String(now.getMonth()+1).padStart(2,'0');
    var d=String(now.getDate()).padStart(2,'0');
    card.issueDate=m+'/'+d+'/'+now.getFullYear();
    card.dlNumber=_dlGenerateNumber();
    card.dd=_dlGenerateDD(card.issueDate);
    card.expiration=_dlCalculateExpiration(card.dob,card.issueDate);
    card.inventoryNum=_dlGenerateInventory(card.dlNumber,card.issueDate);
    return card;
}

function _dlGenerateBatch(){
    var dl=_dlEnsureState();
    dl.batch=[];
    var n=Math.max(1,Math.min(50,dl.batchCount||5));
    for(var i=0;i<n;i++) dl.batch.push(_dlGenerateCard(dl.batchSex,dl.batchAgeMin,dl.batchAgeMax));
    dl.selectedIdx=0;
}

function _dlRenderFront(dl){
    var photoHTML=dl.photoData
        ?'<img src="'+dl.photoData+'" style="width:100%;height:100%;object-fit:cover;">'
        :'<div style="width:100%;height:100%;background:linear-gradient(135deg,#4a90d9,#357abd);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.5);font-size:11px;">NO PHOTO</div>';
    var ghostHTML=dl.photoData
        ?'<img src="'+dl.photoData+'" style="width:100%;height:100%;object-fit:cover;opacity:.18;filter:grayscale(50%);">'
        :'';
    var sigHTML=dl.signatureData
        ?'<img src="'+dl.signatureData+'" style="max-width:100%;max-height:100%;object-fit:contain;filter:contrast(1.5);">'
        :'<div style="font-family:\'Brush Script MT\',cursive;font-size:16px;color:#1a1a6e;opacity:.7;">Signature</div>';
    var dobNum=_dlFormatDOBNum(dl.dob);

    return '<div class="dl-card dl-front-card" id="dl-front-card">'+
      '<div class="dl-bg-layer"></div>'+
      '<div class="dl-content-front">'+
        // Header
        '<div class="dl-header">'+
          '<div class="dl-california">California</div>'+
          '<div class="dl-usa-label">USA</div>'+
          '<div class="dl-title-text">DRIVER LICENSE</div>'+
          '<div class="dl-bear">🐻</div>'+
        '</div>'+
        // Photo area with DOB overlay
        '<div class="dl-photo-area">'+photoHTML+'<div class="dl-photo-dob-overlay">'+_dlEsc(dobNum)+'</div></div>'+
        // Ghost photo
        '<div class="dl-ghost-area">'+ghostHTML+'</div>'+
        // Fields
        '<div class="dl-field dl-f-dlnum"><span class="dl-label">DL</span> <span class="dl-val-red">'+_dlEsc(dl.dlNumber)+'</span></div>'+
        '<div class="dl-field dl-f-exp"><span class="dl-label">EXP</span> <span class="dl-val-red">'+_dlEsc(dl.expiration)+'</span></div>'+
        '<div class="dl-field dl-f-class"><span class="dl-label">CLASS</span> <span class="dl-val">'+_dlEsc(dl.dlClass)+'</span></div>'+
        '<div class="dl-field dl-f-end"><span class="dl-label">END</span> <span class="dl-val">NONE</span></div>'+
        '<div class="dl-field dl-f-ln"><span class="dl-label">LN</span> <span class="dl-val-name">'+_dlEsc(dl.lastName)+'</span></div>'+
        '<div class="dl-field dl-f-fn"><span class="dl-label">FN</span> <span class="dl-val-name">'+_dlEsc(dl.firstName)+'</span></div>'+
        '<div class="dl-field dl-f-addr"><span class="dl-val-sm">'+_dlEsc(dl.street)+'</span><br><span class="dl-val-sm">'+_dlEsc(dl.city)+', '+_dlEsc(dl.state)+' '+_dlEsc(dl.zip)+'</span></div>'+
        '<div class="dl-field dl-f-dob"><span class="dl-label">DOB</span> <span class="dl-val-red">'+_dlEsc(dl.dob)+'</span></div>'+
        '<div class="dl-field dl-f-rstr"><span class="dl-label">RSTR</span> <span class="dl-val">'+_dlEsc(dl.restrictions)+'</span></div>'+
        '<div class="dl-field dl-f-dobnum"><span class="dl-val-dob-num">'+_dlEsc(dobNum)+'</span></div>'+
        // Bottom row
        '<div class="dl-bottom-row">'+
          '<div class="dl-bottom-item"><span class="dl-label">SEX</span> <span class="dl-val">'+_dlEsc(dl.sex)+'</span></div>'+
          '<div class="dl-bottom-item"><span class="dl-label">HAIR</span> <span class="dl-val">'+_dlEsc(dl.hair)+'</span></div>'+
          '<div class="dl-bottom-item"><span class="dl-label">EYES</span> <span class="dl-val">'+_dlEsc(dl.eyes)+'</span></div>'+
          '<div class="dl-bottom-item"><span class="dl-label">HGT</span> <span class="dl-val">'+_dlEsc(dl.height)+'</span></div>'+
          '<div class="dl-bottom-item"><span class="dl-label">WGT</span> <span class="dl-val">'+_dlEsc(dl.weight)+' lb</span></div>'+
        '</div>'+
        '<div class="dl-field dl-f-dd"><span class="dl-label">DD</span> <span class="dl-val-sm">'+_dlEsc(dl.dd)+'</span></div>'+
        '<div class="dl-field dl-f-iss"><span class="dl-label">ISS</span> <span class="dl-val-sm">'+_dlEsc(dl.issueDate)+'</span></div>'+
        // Signature
        '<div class="dl-signature-area">'+sigHTML+'</div>'+
      '</div>'+
    '</div>';
}

function _dlRenderBack(dl){
    var sigHTML=dl.signatureData
        ?'<img src="'+dl.signatureData+'" style="max-width:80px;max-height:30px;object-fit:contain;filter:contrast(1.2) opacity(.7);">'
        :'<div style="font-family:\'Brush Script MT\',cursive;font-size:12px;color:#333;opacity:.5;">Official</div>';

    // Generate barcode visual grid
    var barcodeGrid='';
    for(var r=0;r<22;r++){
        var row='<div class="dl-bc-row">';
        for(var c=0;c<13;c++){
            var fill=Math.random()>0.4?'dl-bc-black':'dl-bc-white';
            row+='<div class="dl-bc-cell '+fill+'"></div>';
        }
        row+='</div>';
        barcodeGrid+=row;
    }

    // 1D barcode
    var barcode1d='';
    for(var i=0;i<60;i++){
        var w=Math.random()>0.6?2:1;
        var black=Math.random()>0.3;
        barcode1d+='<div style="width:'+w+'px;height:36px;background:'+(black?'#000':'#fff')+'"></div>';
    }

    return '<div class="dl-card dl-back-card" id="dl-back-card">'+
      '<div class="dl-back-content">'+
        '<div class="dl-back-top">'+
          '<div class="dl-back-class-info">'+
            '<div><b>CLASS:</b> C - Veh w/GVWR ≤26000, No M/C</div>'+
            '<div><b>ENDORSEMENTS:</b> '+_dlEsc(dl.endorsements)+'</div>'+
            '<div><b>RESTRICTIONS:</b> '+_dlEsc(dl.restrictions)+'</div>'+
          '</div>'+
          '<div class="dl-back-barcode1d">'+barcode1d+'</div>'+
        '</div>'+
        '<div class="dl-back-middle">'+
          '<div class="dl-back-2dbarcode">'+barcodeGrid+'</div>'+
          '<div class="dl-back-right-info">'+
            '<div class="dl-back-disclaimer">This card is not acceptable for official federal purposes. This license is issued only as a license to driver a motor vehicle. It does not establish eligibility for employment, voter registration, or public benefits.</div>'+
            '<div class="dl-back-rev">Rev '+_dlEsc(dl.revDate)+'</div>'+
            '<div class="dl-back-inv">'+_dlEsc(dl.inventoryNum)+'</div>'+
            '<div class="dl-back-sig">'+sigHTML+'</div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
}

function _renderDriverLicenseGenerator(){
    var area=document.getElementById('content-area');
    var bar=document.getElementById('stats-bar');
    bar.style.display='none';bar.innerHTML='';
    var gen=_CK.generator,dl=_dlEnsureState();

    var mi={proxy:'🌐',bin:'🔢',card:'💳',ip:'📡',auto:'🔍',glue:'🔗',generator:'📄'};
    var ml={proxy:'Proxy',bin:'BIN',card:'Card',ip:'IP',auto:'Auto',glue:'Glue',generator:'Generator'};
    var mh='';for(var k in mi)mh+='<button class="ck-mode-btn '+(_CK.mode===k?'active':'')+'" data-mode="'+k+'"><span class="ck-mode-icon">'+mi[k]+'</span><span class="ck-mode-label">'+ml[k]+'</span></button>';

    var sel=(dl.batch.length && dl.selectedIdx>=0 && dl.selectedIdx<dl.batch.length)?dl.batch[dl.selectedIdx]:dl;

    var hairOpts='';_DL_HAIR_COLORS.forEach(function(c){hairOpts+='<option value="'+c+'" '+(sel.hair===c?'selected':'')+'>'+c+'</option>';});
    var eyeOpts='';_DL_EYE_COLORS.forEach(function(c){eyeOpts+='<option value="'+c+'" '+(sel.eyes===c?'selected':'')+'>'+c+'</option>';});
    var classOpts='';_DL_CLASSES.forEach(function(c){classOpts+='<option value="'+c+'" '+(sel.dlClass===c?'selected':'')+'>'+c+'</option>';});

    var hasData=!!sel.dlNumber;

    area.innerHTML=
    '<div class="ck-container">'+
        '<div class="ck-header"><div class="ck-title"><span class="ck-icon">🪪</span><span>DRIVER LICENSE GENERATOR</span></div><div class="ck-modes">'+mh+'</div></div>'+
        '<div class="ck-proto-bar"><span class="ck-proto-label">Type:</span>'+
            '<button class="ck-proto-btn '+(gen.type==='tepco'?'active':'')+'" data-billtype="tepco">⚡ TEPCO</button>'+
            '<button class="ck-proto-btn '+(gen.type==='water'?'active':'')+'" data-billtype="water">💧 Water</button>'+
            '<button class="ck-proto-btn '+(gen.type==='creditcard'?'active':'')+'" data-billtype="creditcard">💳 Credit Card</button>'+
            '<button class="ck-proto-btn '+(gen.type==='driverlicense'?'active':'')+'" data-billtype="driverlicense">🪪 Driver License</button>'+
            '<button class="ck-proto-btn '+(gen.type==='zipprocessor'?'active':'')+'" data-billtype="zipprocessor">📦 ZIP Processor</button>'+
        '</div>'+
        // Batch controls
        '<div class="dl-batch-bar">'+
          '<div class="dl-batch-group"><span class="dl-batch-label">Count</span><input type="number" class="dl-batch-input" id="dl-batch-count" value="'+dl.batchCount+'" min="1" max="50"></div>'+
          '<div class="dl-batch-group"><span class="dl-batch-label">Sex</span><select class="dl-batch-select" id="dl-batch-sex"><option value="random" '+(dl.batchSex==='random'?'selected':'')+'>Random</option><option value="m" '+(dl.batchSex==='m'?'selected':'')+'>Male</option><option value="f" '+(dl.batchSex==='f'?'selected':'')+'>Female</option></select></div>'+
          '<div class="dl-batch-group"><span class="dl-batch-label">Age Min</span><input type="number" class="dl-batch-input" id="dl-batch-amin" value="'+dl.batchAgeMin+'" min="16" max="80"></div>'+
          '<div class="dl-batch-group"><span class="dl-batch-label">Age Max</span><input type="number" class="dl-batch-input" id="dl-batch-amax" value="'+dl.batchAgeMax+'" min="16" max="80"></div>'+
          '<button class="dl-batch-btn dl-batch-gen" id="dl-batch-gen-btn">🎲 GENERATE BATCH</button>'+
          (dl.batch.length>1?'<button class="dl-batch-btn dl-batch-zip" id="dl-batch-zip-btn">📦 ZIP All ('+dl.batch.length+')</button>':'')+
        '</div>'+
        // Card list
        (dl.batch.length?'<div class="dl-card-list" id="dl-card-list">'+_dlRenderCardList(dl)+'</div>':'')+
        // Edit form for selected card
        '<div class="dl-form">'+
          '<div class="dl-form-row">'+
            '<div class="dl-form-group"><label class="dl-form-label">First Name</label><input type="text" class="dl-form-input" id="dl-firstname" value="'+_dlEsc(sel.firstName)+'" placeholder="JOHN"></div>'+
            '<div class="dl-form-group"><label class="dl-form-label">Last Name</label><input type="text" class="dl-form-input" id="dl-lastname" value="'+_dlEsc(sel.lastName)+'" placeholder="WICK"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">DOB</label><input type="text" class="dl-form-input" id="dl-dob" value="'+_dlEsc(sel.dob)+'" placeholder="MM/DD/YYYY"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Sex</label><select class="dl-form-select" id="dl-sex"><option value="M" '+(sel.sex==='M'?'selected':'')+'>M</option><option value="F" '+(sel.sex==='F'?'selected':'')+'>F</option></select></div>'+
          '</div>'+
          '<div class="dl-form-row">'+
            '<div class="dl-form-group" style="flex:2"><label class="dl-form-label">Street</label><input type="text" class="dl-form-input" id="dl-street" value="'+_dlEsc(sel.street)+'" placeholder="1624 CANYON ROAD"></div>'+
            '<div class="dl-form-group"><label class="dl-form-label">City</label><input type="text" class="dl-form-input" id="dl-city" value="'+_dlEsc(sel.city)+'" placeholder="SPRING VALLEY"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">ZIP</label><input type="text" class="dl-form-input" id="dl-zip" value="'+_dlEsc(sel.zip)+'" placeholder="91977" maxlength="5"></div>'+
          '</div>'+
          '<div class="dl-form-row">'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Height</label><input type="text" class="dl-form-input" id="dl-height" value="'+_dlEsc(sel.height)+'" placeholder="5\'-10&quot;"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Weight</label><input type="text" class="dl-form-input" id="dl-weight" value="'+_dlEsc(sel.weight)+'" placeholder="170"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Hair</label><select class="dl-form-select" id="dl-hair">'+hairOpts+'</select></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Eyes</label><select class="dl-form-select" id="dl-eyes">'+eyeOpts+'</select></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Class</label><select class="dl-form-select" id="dl-class">'+classOpts+'</select></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Rstr</label><input type="text" class="dl-form-input" id="dl-rstr" value="'+_dlEsc(sel.restrictions)+'" placeholder="NONE"></div>'+
          '</div>'+
          '<div class="dl-form-row">'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Photo</label><label class="dl-upload-btn '+(sel.photoData?'has-file':'')+'">📷 '+(sel.photoData?'✓':'Up')+'<input type="file" id="dl-photo-input" accept=".png,.jpg,.jpeg,.webp" hidden></label></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Sig</label><label class="dl-upload-btn '+(sel.signatureData?'has-file':'')+'">✍️ '+(sel.signatureData?'✓':'Up')+'<input type="file" id="dl-sig-input" accept=".png,.jpg,.jpeg,.webp,.svg" hidden></label></div>'+
            '<div style="flex:1"></div>'+
            '<div class="dl-actions">'+
              '<button class="dl-btn dl-btn-generate" id="dl-apply-btn">✅ APPLY</button>'+
              (hasData?'<button class="dl-btn dl-btn-action" id="dl-dl-front">📥 Front</button><button class="dl-btn dl-btn-action" id="dl-dl-back">📥 Back</button><button class="dl-btn dl-btn-prompt" id="dl-gen-prompt">📝 Prompt</button>':'')+
            '</div>'+
          '</div>'+
        '</div>'+
        // Preview
        '<div class="dl-preview">'+
          (hasData?
            '<div><div class="dl-card-label">FRONT</div>'+_dlRenderFront(sel)+'</div>'+
            '<div><div class="dl-card-label">BACK</div>'+_dlRenderBack(sel)+'</div>'
            :'<div style="color:#6b7280;text-align:center;padding:80px 20px;font-size:13px;width:100%">Set parameters and click GENERATE BATCH</div>'
          )+
        '</div>'+
    '</div>';

    _dlBindEvents();
}

function _dlRenderCardList(dl){
    var h='';
    for(var i=0;i<dl.batch.length;i++){
        var c=dl.batch[i];var a=i===dl.selectedIdx?'active':'';
        h+='<div class="dl-card-row '+a+'" data-idx="'+i+'">'+
          '<span class="dl-card-row-num">#'+(i+1)+'</span>'+
          '<span class="dl-card-row-name">'+_dlEsc(c.firstName)+' '+_dlEsc(c.lastName)+'</span>'+
          '<span class="dl-card-row-dl">'+_dlEsc(c.dlNumber)+'</span>'+
          '<span class="dl-card-row-dob">'+_dlEsc(c.dob)+'</span>'+
          '<span class="dl-card-row-sex">'+_dlEsc(c.sex)+'</span>'+
          '<span class="dl-card-row-actions">'+
            '<button class="dl-row-btn dl-row-btn-prompt" data-pidx="'+i+'" title="Copy Prompt">📋</button>'+
            '<button class="dl-row-btn" data-fidx="'+i+'" title="Download Front">📥F</button>'+
            '<button class="dl-row-btn" data-bidx="'+i+'" title="Download Back">📥B</button>'+
          '</span></div>';
    }
    return h;
}

function _dlCopyPromptForCard(card){
    var p=_dlBuildPrompt(card);
    navigator.clipboard.writeText(p).then(function(){toast('Prompt copied!','success');}).catch(function(){
        var ta=document.createElement('textarea');ta.value=p;ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('Prompt copied!','success');
    });
}

function _dlDownloadCardPNG(card,side,cb){
    var tmp=document.createElement('div');
    tmp.style.cssText='position:absolute;left:-9999px;top:0;z-index:-1;background:#fff;overflow:visible;';
    tmp.innerHTML=side==='front'?_dlRenderFront(card):_dlRenderBack(card);
    document.body.appendChild(tmp);
    var el=tmp.firstElementChild;
    html2canvas(el,{scale:3,backgroundColor:'#ffffff',useCORS:true,allowTaint:true,logging:false}).then(function(c){
        document.body.removeChild(tmp);
        if(cb) cb(c);
        else{var a=document.createElement('a');a.download='CA_DL_'+side+'_'+card.dlNumber+'.png';a.href=c.toDataURL('image/png');a.click();toast('Downloaded!','success');}
    }).catch(function(e){try{document.body.removeChild(tmp);}catch(x){}console.error(e);if(!cb)toast('Export failed','error');});
}

function _dlBindEvents(){
    var area=document.getElementById('content-area');
    var gen=_CK.generator,dl=_dlEnsureState();
    var sel=(dl.batch.length&&dl.selectedIdx>=0&&dl.selectedIdx<dl.batch.length)?dl.batch[dl.selectedIdx]:dl;

    area.querySelectorAll('.ck-mode-btn').forEach(function(b){b.addEventListener('click',function(){_CK.mode=b.dataset.mode;_updateSubHashSilent();if(_CK.mode==='glue')_renderGlue();else if(_CK.mode==='generator')_renderGenerator();else renderChecker();});});
    area.querySelectorAll('[data-billtype]').forEach(function(b){b.addEventListener('click',function(){gen.type=b.dataset.billtype;gen.billData=null;_updateSubHashSilent();_renderGenerator();});});

    // Batch generate
    var el;
    el=document.getElementById('dl-batch-gen-btn');if(el)el.addEventListener('click',function(){
        dl.batchCount=parseInt(document.getElementById('dl-batch-count').value)||5;
        dl.batchSex=document.getElementById('dl-batch-sex').value||'random';
        dl.batchAgeMin=parseInt(document.getElementById('dl-batch-amin').value)||21;
        dl.batchAgeMax=parseInt(document.getElementById('dl-batch-amax').value)||35;
        if(dl.batchAgeMin>dl.batchAgeMax){var t=dl.batchAgeMin;dl.batchAgeMin=dl.batchAgeMax;dl.batchAgeMax=t;}
        _dlGenerateBatch();
        _renderDriverLicenseGenerator();
        toast(dl.batch.length+' licenses generated!','success');
    });

    // Card row click - select
    area.querySelectorAll('.dl-card-row').forEach(function(r){
        r.addEventListener('click',function(e){
            if(e.target.closest('button'))return;
            dl.selectedIdx=parseInt(r.dataset.idx);
            _renderDriverLicenseGenerator();
        });
    });

    // Per-card prompt buttons
    area.querySelectorAll('[data-pidx]').forEach(function(b){b.addEventListener('click',function(e){
        e.stopPropagation();var card=dl.batch[parseInt(b.dataset.pidx)];if(card)_dlCopyPromptForCard(card);
    });});

    // Per-card front download
    area.querySelectorAll('[data-fidx]').forEach(function(b){b.addEventListener('click',function(e){
        e.stopPropagation();var card=dl.batch[parseInt(b.dataset.fidx)];if(card)_dlDownloadCardPNG(card,'front');
    });});

    // Per-card back download
    area.querySelectorAll('[data-bidx]').forEach(function(b){b.addEventListener('click',function(e){
        e.stopPropagation();var card=dl.batch[parseInt(b.dataset.bidx)];if(card)_dlDownloadCardPNG(card,'back');
    });});

    // Apply edits to selected card
    el=document.getElementById('dl-apply-btn');if(el)el.addEventListener('click',function(){
        sel.firstName=(document.getElementById('dl-firstname').value||'').toUpperCase();
        sel.lastName=(document.getElementById('dl-lastname').value||'').toUpperCase();
        sel.dob=document.getElementById('dl-dob').value||'';
        sel.sex=document.getElementById('dl-sex').value||'M';
        sel.street=(document.getElementById('dl-street').value||'').toUpperCase();
        sel.city=(document.getElementById('dl-city').value||'').toUpperCase();
        sel.zip=document.getElementById('dl-zip').value||'';
        sel.height=document.getElementById('dl-height').value||'';
        sel.weight=document.getElementById('dl-weight').value||'';
        sel.hair=document.getElementById('dl-hair').value||'BLK';
        sel.eyes=document.getElementById('dl-eyes').value||'BLK';
        sel.dlClass=document.getElementById('dl-class').value||'C';
        sel.restrictions=(document.getElementById('dl-rstr').value||'NONE').toUpperCase();
        if(!sel.dlNumber){
            if(!sel.dob||sel.dob.split('/').length!==3){toast('Enter DOB as MM/DD/YYYY','error');return;}
            var now=new Date();sel.issueDate=String(now.getMonth()+1).padStart(2,'0')+'/'+String(now.getDate()).padStart(2,'0')+'/'+now.getFullYear();
            sel.dlNumber=_dlGenerateNumber();sel.dd=_dlGenerateDD(sel.issueDate);
            sel.expiration=_dlCalculateExpiration(sel.dob,sel.issueDate);
            sel.inventoryNum=_dlGenerateInventory(sel.dlNumber,sel.issueDate);
        }
        sel.expiration=_dlCalculateExpiration(sel.dob,sel.issueDate);
        _renderDriverLicenseGenerator();
        toast('Card updated!','success');
    });

    // Photo/sig upload
    el=document.getElementById('dl-photo-input');if(el)el.addEventListener('change',function(e){
        var f=e.target.files[0];if(!f)return;
        var r=new FileReader();r.onload=function(ev){sel.photoData=ev.target.result;_renderDriverLicenseGenerator();toast('Photo uploaded!','success');};r.readAsDataURL(f);
    });
    el=document.getElementById('dl-sig-input');if(el)el.addEventListener('change',function(e){
        var f=e.target.files[0];if(!f)return;
        var r=new FileReader();r.onload=function(ev){sel.signatureData=ev.target.result;_renderDriverLicenseGenerator();toast('Sig uploaded!','success');};r.readAsDataURL(f);
    });

    // Preview downloads
    el=document.getElementById('dl-dl-front');if(el)el.addEventListener('click',function(){_dlDownloadCardPNG(sel,'front');});
    el=document.getElementById('dl-dl-back');if(el)el.addEventListener('click',function(){_dlDownloadCardPNG(sel,'back');});
    el=document.getElementById('dl-gen-prompt');if(el)el.addEventListener('click',function(){_dlCopyPromptForCard(sel);});

    // ZIP all
    el=document.getElementById('dl-batch-zip-btn');if(el)el.addEventListener('click',function(){
        if(typeof JSZip==='undefined'){toast('JSZip not loaded','error');return;}
        var zip=new JSZip();var done=0;var total=dl.batch.length*2;
        toast('Generating ZIP... 0/'+total,'info');
        dl.batch.forEach(function(card,i){
            _dlDownloadCardPNG(card,'front',function(cf){
                zip.file('DL_'+(i+1)+'_'+card.dlNumber+'_front.png',cf.toDataURL('image/png').split(',')[1],{base64:true});
                done++;if(done===total)_dlFinalizeZip(zip);else toast('ZIP: '+done+'/'+total,'info');
            });
            _dlDownloadCardPNG(card,'back',function(cb){
                zip.file('DL_'+(i+1)+'_'+card.dlNumber+'_back.png',cb.toDataURL('image/png').split(',')[1],{base64:true});
                done++;if(done===total)_dlFinalizeZip(zip);else toast('ZIP: '+done+'/'+total,'info');
            });
        });
    });
}

function _dlFinalizeZip(zip){
    zip.generateAsync({type:'blob'}).then(function(b){
        var a=document.createElement('a');a.download='CA_DL_Batch_'+Date.now()+'.zip';a.href=URL.createObjectURL(b);a.click();
        toast('ZIP downloaded!','success');
    });
}

function _dlDownloadPNG(id,fn){
    var el=document.getElementById(id);if(!el){toast('Not found','error');return;}
    if(typeof html2canvas==='undefined'){toast('html2canvas not loaded','error');return;}
    var tmp=document.createElement('div');
    tmp.style.cssText='position:absolute;left:-9999px;top:0;z-index:-1;background:#fff;overflow:visible;';
    tmp.innerHTML=el.outerHTML;
    document.body.appendChild(tmp);
    var clone=tmp.firstElementChild;
    html2canvas(clone,{scale:3,backgroundColor:'#ffffff',useCORS:true,allowTaint:true,logging:false}).then(function(c){
        document.body.removeChild(tmp);
        var a=document.createElement('a');a.download=fn;a.href=c.toDataURL('image/png');a.click();
        toast('Downloaded: '+fn,'success');
    }).catch(function(e){try{document.body.removeChild(tmp);}catch(x){}console.error(e);toast('Export failed','error');});
}

function _dlBuildPrompt(dl){
    var dobNum=_dlFormatDOBNum(dl.dob);
    return 'Using the provided reference image as the exact base template, replace ONLY the text fields with the following new data. Keep everything else identical — same layout, same background, same holographic overlays, same textures, same fonts, same colors, same positioning, same security patterns, same photo style.\n\n'+
        'REPLACE THESE FIELDS ONLY:\n'+
        'DL: '+dl.dlNumber+'\n'+
        'EXP: '+dl.expiration+'\n'+
        'LN: '+dl.lastName+'\n'+
        'FN: '+dl.firstName+'\n'+
        'Address line 1: '+dl.street+'\n'+
        'Address line 2: '+dl.city+', '+dl.state+' '+dl.zip+'\n'+
        'DOB: '+dl.dob+'\n'+
        'RSTR: '+dl.restrictions+'\n'+
        'DOB number (right side): '+dobNum+'\n'+
        'SEX: '+dl.sex+' | HAIR: '+dl.hair+' | EYES: '+dl.eyes+'\n'+
        'HGT: '+dl.height+' | WGT: '+dl.weight+' lb\n'+
        'DD: '+dl.dd+'\n'+
        'ISS: '+dl.issueDate+'\n'+
        'CLASS: '+dl.dlClass+' | END: NONE\n\n'+
        'CRITICAL RULES:\n'+
        '- The reference image is the ground truth for design, do NOT alter the visual style\n'+
        '- Keep the exact same photo, signature, ghost image from the reference\n'+
        '- Preserve all holographic elements, state seal, bear emblem, background gradient\n'+
        '- Red text fields (DL number, EXP, DOB) must stay red, same font weight\n'+
        '- Black text fields must stay black, same font and size as reference\n'+
        '- Do not move, resize, or reposition any element\n'+
        '- Output must be indistinguishable from the reference except for the changed text values';
}
