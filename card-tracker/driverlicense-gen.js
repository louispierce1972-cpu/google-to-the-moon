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

// Ensure DL state exists
function _dlEnsureState(){
    if(!_CK.generator.dl) _CK.generator.dl=_dlGetDefaults();
    return _CK.generator.dl;
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
        // Photo area
        '<div class="dl-photo-area">'+photoHTML+'</div>'+
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

    var hairOpts='';_DL_HAIR_COLORS.forEach(function(c){hairOpts+='<option value="'+c+'" '+(dl.hair===c?'selected':'')+'>'+c+'</option>';});
    var eyeOpts='';_DL_EYE_COLORS.forEach(function(c){eyeOpts+='<option value="'+c+'" '+(dl.eyes===c?'selected':'')+'>'+c+'</option>';});
    var classOpts='';_DL_CLASSES.forEach(function(c){classOpts+='<option value="'+c+'" '+(dl.dlClass===c?'selected':'')+'>'+c+'</option>';});

    var hasData=!!dl.dlNumber;

    area.innerHTML=
    '<div class="ck-container">'+
        '<div class="ck-header"><div class="ck-title"><span class="ck-icon">🪪</span><span>DRIVER LICENSE GENERATOR</span></div><div class="ck-modes">'+mh+'</div></div>'+
        '<div class="ck-proto-bar"><span class="ck-proto-label">Type:</span>'+
            '<button class="ck-proto-btn '+(gen.type==='tepco'?'active':'')+'" data-billtype="tepco">⚡ TEPCO</button>'+
            '<button class="ck-proto-btn '+(gen.type==='water'?'active':'')+'" data-billtype="water">💧 Water</button>'+
            '<button class="ck-proto-btn '+(gen.type==='creditcard'?'active':'')+'" data-billtype="creditcard">💳 Credit Card</button>'+
            '<button class="ck-proto-btn '+(gen.type==='driverlicense'?'active':'')+'" data-billtype="driverlicense">🪪 Driver License</button>'+
        '</div>'+
        // Form
        '<div class="dl-form">'+
          '<div class="dl-form-row">'+
            '<div class="dl-form-group"><label class="dl-form-label">First Name</label><input type="text" class="dl-form-input" id="dl-firstname" value="'+_dlEsc(dl.firstName)+'" placeholder="JOHN"></div>'+
            '<div class="dl-form-group"><label class="dl-form-label">Last Name</label><input type="text" class="dl-form-input" id="dl-lastname" value="'+_dlEsc(dl.lastName)+'" placeholder="WICK"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">DOB</label><input type="text" class="dl-form-input" id="dl-dob" value="'+_dlEsc(dl.dob)+'" placeholder="MM/DD/YYYY"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Sex</label><select class="dl-form-select" id="dl-sex"><option value="M" '+(dl.sex==='M'?'selected':'')+'>M</option><option value="F" '+(dl.sex==='F'?'selected':'')+'>F</option></select></div>'+
          '</div>'+
          '<div class="dl-form-row">'+
            '<div class="dl-form-group" style="flex:2"><label class="dl-form-label">Street</label><input type="text" class="dl-form-input" id="dl-street" value="'+_dlEsc(dl.street)+'" placeholder="1624 CANYON ROAD"></div>'+
            '<div class="dl-form-group"><label class="dl-form-label">City</label><input type="text" class="dl-form-input" id="dl-city" value="'+_dlEsc(dl.city)+'" placeholder="SPRING VALLEY"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">ZIP</label><input type="text" class="dl-form-input" id="dl-zip" value="'+_dlEsc(dl.zip)+'" placeholder="91977" maxlength="5"></div>'+
          '</div>'+
          '<div class="dl-form-row">'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Height</label><input type="text" class="dl-form-input" id="dl-height" value="'+_dlEsc(dl.height)+'" placeholder="5\'-10&quot;"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Weight</label><input type="text" class="dl-form-input" id="dl-weight" value="'+_dlEsc(dl.weight)+'" placeholder="170"></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Hair</label><select class="dl-form-select" id="dl-hair">'+hairOpts+'</select></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Eyes</label><select class="dl-form-select" id="dl-eyes">'+eyeOpts+'</select></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Class</label><select class="dl-form-select" id="dl-class">'+classOpts+'</select></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Rstr</label><input type="text" class="dl-form-input" id="dl-rstr" value="'+_dlEsc(dl.restrictions)+'" placeholder="NONE"></div>'+
          '</div>'+
          '<div class="dl-form-row">'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Photo</label><label class="dl-upload-btn '+(dl.photoData?'has-file':'')+'">📷 '+(dl.photoData?'✓ Photo':'Upload')+'<input type="file" id="dl-photo-input" accept=".png,.jpg,.jpeg,.webp" hidden></label></div>'+
            '<div class="dl-form-group-sm"><label class="dl-form-label">Signature</label><label class="dl-upload-btn '+(dl.signatureData?'has-file':'')+'">✍️ '+(dl.signatureData?'✓ Sig':'Upload')+'<input type="file" id="dl-sig-input" accept=".png,.jpg,.jpeg,.webp,.svg" hidden></label></div>'+
            (dl.photoData?'<div class="dl-form-group-sm" style="align-self:flex-end"><button class="dl-btn-sm" id="dl-remove-photo" style="color:#f87171">✕ Photo</button></div>':'')+
            (dl.signatureData?'<div class="dl-form-group-sm" style="align-self:flex-end"><button class="dl-btn-sm" id="dl-remove-sig" style="color:#f87171">✕ Sig</button></div>':'')+
            '<div style="flex:1"></div>'+
            '<div class="dl-actions">'+
              '<button class="dl-btn dl-btn-generate" id="dl-generate-btn">🪪 GENERATE</button>'+
              (hasData?'<button class="dl-btn dl-btn-action" id="dl-dl-front">📥 Front</button><button class="dl-btn dl-btn-action" id="dl-dl-back">📥 Back</button><button class="dl-btn dl-btn-prompt" id="dl-gen-prompt">📝 Prompt</button>':'')+
            '</div>'+
          '</div>'+
        '</div>'+
        // Preview
        '<div class="dl-preview">'+
          (hasData?
            '<div><div class="dl-card-label">FRONT</div>'+_dlRenderFront(dl)+'</div>'+
            '<div><div class="dl-card-label">BACK</div>'+_dlRenderBack(dl)+'</div>'
            :'<div style="color:#6b7280;text-align:center;padding:80px 20px;font-size:13px;width:100%">Fill in your data and click GENERATE</div>'
          )+
        '</div>'+
    '</div>';

    _dlBindEvents();
}

function _dlBindEvents(){
    var area=document.getElementById('content-area');
    var gen=_CK.generator,dl=_dlEnsureState();

    area.querySelectorAll('.ck-mode-btn').forEach(function(b){b.addEventListener('click',function(){_CK.mode=b.dataset.mode;if(_CK.mode==='glue')_renderGlue();else if(_CK.mode==='generator')_renderGenerator();else renderChecker();});});
    area.querySelectorAll('[data-billtype]').forEach(function(b){b.addEventListener('click',function(){gen.type=b.dataset.billtype;gen.billData=null;_renderGenerator();});});

    // Generate
    var el;
    el=document.getElementById('dl-generate-btn');if(el)el.addEventListener('click',function(){
        dl.firstName=(document.getElementById('dl-firstname').value||'').toUpperCase();
        dl.lastName=(document.getElementById('dl-lastname').value||'').toUpperCase();
        dl.dob=document.getElementById('dl-dob').value||'';
        dl.sex=document.getElementById('dl-sex').value||'M';
        dl.street=(document.getElementById('dl-street').value||'').toUpperCase();
        dl.city=(document.getElementById('dl-city').value||'').toUpperCase();
        dl.zip=document.getElementById('dl-zip').value||'';
        dl.height=document.getElementById('dl-height').value||'';
        dl.weight=document.getElementById('dl-weight').value||'';
        dl.hair=document.getElementById('dl-hair').value||'BLK';
        dl.eyes=document.getElementById('dl-eyes').value||'BLK';
        dl.dlClass=document.getElementById('dl-class').value||'C';
        dl.restrictions=(document.getElementById('dl-rstr').value||'NONE').toUpperCase();
        if(!dl.firstName||!dl.lastName){toast('Enter First and Last name','error');return;}
        if(!dl.dob||dl.dob.split('/').length!==3){toast('Enter DOB as MM/DD/YYYY','error');return;}
        _dlGenerateAll();
        _renderDriverLicenseGenerator();
        toast('Driver License generated!','success');
    });

    // Photo upload
    el=document.getElementById('dl-photo-input');if(el)el.addEventListener('change',function(e){
        var f=e.target.files[0];if(!f)return;
        var r=new FileReader();r.onload=function(ev){dl.photoData=ev.target.result;_renderDriverLicenseGenerator();toast('Photo uploaded!','success');};r.readAsDataURL(f);
    });
    el=document.getElementById('dl-sig-input');if(el)el.addEventListener('change',function(e){
        var f=e.target.files[0];if(!f)return;
        var r=new FileReader();r.onload=function(ev){dl.signatureData=ev.target.result;_renderDriverLicenseGenerator();toast('Signature uploaded!','success');};r.readAsDataURL(f);
    });
    el=document.getElementById('dl-remove-photo');if(el)el.addEventListener('click',function(){dl.photoData=null;_renderDriverLicenseGenerator();});
    el=document.getElementById('dl-remove-sig');if(el)el.addEventListener('click',function(){dl.signatureData=null;_renderDriverLicenseGenerator();});

    // Downloads
    el=document.getElementById('dl-dl-front');if(el)el.addEventListener('click',function(){_dlDownloadPNG('dl-front-card','CA_DL_Front_'+Date.now()+'.png');});
    el=document.getElementById('dl-dl-back');if(el)el.addEventListener('click',function(){_dlDownloadPNG('dl-back-card','CA_DL_Back_'+Date.now()+'.png');});

    // Prompt generator
    el=document.getElementById('dl-gen-prompt');if(el)el.addEventListener('click',function(){
        var prompt=_dlBuildPrompt(dl);
        navigator.clipboard.writeText(prompt).then(function(){toast('Prompt copied to clipboard!','success');}).catch(function(){
            var ta=document.createElement('textarea');ta.value=prompt;ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);toast('Prompt copied!','success');
        });
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
    return 'Photorealistic California Driver License, front side, exact official CA DMV design.\n'+
        'Golden "California" script header at top left, "USA" in small caps, "DRIVER LICENSE" title.\n'+
        'California golden bear emblem top right.\n'+
        'Class: '+dl.dlClass+', Endorsements: NONE, Restrictions: '+dl.restrictions+'.\n'+
        'DL Number: '+dl.dlNumber+' (red text), EXP: '+dl.expiration+' (red text).\n'+
        'Name: LN '+dl.lastName+', FN '+dl.firstName+'.\n'+
        'Address: '+dl.street+', '+dl.city+', '+dl.state+' '+dl.zip+'.\n'+
        'DOB: '+dl.dob+' (red text).\n'+
        'Sex: '+dl.sex+', HGT: '+dl.height+', Hair: '+dl.hair+', WGT: '+dl.weight+' lb, Eyes: '+dl.eyes+'.\n'+
        'DD: '+dl.dd+', ISS: '+dl.issueDate+'.\n'+
        'Left side: portrait photo with blue-tinted background, shadow falling on card.\n'+
        'Small ghost image of the portrait overlaid semi-transparent on the right.\n'+
        'Bottom left: cursive signature.\n'+
        'Background: California golden-hour gradient, subtle mountain silhouette,\n'+
        'holographic overlay patterns, fine-line guilloche security patterns,\n'+
        'state seal watermark. Professional government document quality.\n'+
        'High resolution, sharp text, authentic DMV formatting.';
}
