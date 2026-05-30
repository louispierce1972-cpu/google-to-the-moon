// ═══════════════════════════════════════════
//  ZIP PROCESSOR v2
//  Upload ZIP → rename folders → add txt → download
//  Custom in-app modals (no native prompt())
// ═══════════════════════════════════════════

var _ZIP_STATE = {
    loaded: false,
    fileName: '',
    folders: [],
    zipData: null,
    _editTxtIdx: undefined,
    _modal: null  // 'paste' | 'bulktxt' | null
};

function _zipEsc(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):'';}

// ─── MODAL SYSTEM ───
function _zipShowModal(type){
    _ZIP_STATE._modal=type;
    _renderZipProcessor();
    setTimeout(function(){
        var ta=document.getElementById('zp-modal-textarea');
        if(ta)ta.focus();
    },50);
}
function _zipCloseModal(){
    _ZIP_STATE._modal=null;
    _renderZipProcessor();
}

function _zipRenderModal(){
    var m=_ZIP_STATE._modal;
    if(!m)return '';

    var total=_ZIP_STATE.folders.length;
    var title='', placeholder='', btnText='', btnId='', hint='';
    if(m==='paste'){
        title='📋 Paste Folder Names';
        placeholder='Paste names here, one per line:\n\nVICTORIA MONIQUE BARAJAS\nBRIANNE KRISTIN YEAGER\nRANDY BAUTISTA\n...';
        btnText='✅ Apply Names';
        btnId='zp-modal-apply-names';
        hint='<div class="zp-modal-hint">'+
          '<span class="zp-modal-hint-icon">📦</span>'+
          '<span>В архиве <b>'+total+'</b> папок — вставьте <b>'+total+'</b> имён, каждое на новой строке</span>'+
        '</div>'+
        '<div class="zp-modal-counter" id="zp-modal-counter">Строк: 0 / '+total+'</div>';
    } else if(m==='bulktxt'){
        title='📝 Bulk TXT Content';
        placeholder='Enter text content that will be added to ALL folders as info.txt:\n\nName: ...\nAddress: ...\nDOB: ...';
        btnText='✅ Apply to All';
        btnId='zp-modal-apply-txt';
        hint='<div class="zp-modal-hint">'+
          '<span class="zp-modal-hint-icon">📝</span>'+
          '<span>Этот текст будет добавлен как info.txt в каждую из <b>'+total+'</b> папок</span>'+
        '</div>';
    }

    return '<div class="zp-modal-overlay" id="zp-modal-overlay">'+
      '<div class="zp-modal">'+
        '<div class="zp-modal-header">'+
          '<span class="zp-modal-title">'+title+'</span>'+
          '<button class="zp-modal-close" id="zp-modal-close">✕</button>'+
        '</div>'+
        hint+
        '<textarea class="zp-modal-textarea" id="zp-modal-textarea" placeholder="'+_zipEsc(placeholder)+'"></textarea>'+
        '<div class="zp-modal-footer">'+
          '<button class="zp-modal-cancel" id="zp-modal-cancel">Cancel</button>'+
          '<button class="zp-modal-confirm" id="'+btnId+'">'+btnText+'</button>'+
        '</div>'+
      '</div>'+
    '</div>';
}

// ─── MAIN RENDER ───
function _renderZipProcessor(){
    var area=document.getElementById('content-area');
    var bar=document.getElementById('stats-bar');
    bar.style.display='none';bar.innerHTML='';
    var gen=_CK.generator;
    var mi={proxy:'🌐',bin:'🔢',card:'💳',ip:'📡',auto:'🔍',glue:'🔗',generator:'📄'};
    var ml={proxy:'Proxy',bin:'BIN',card:'Card',ip:'IP',auto:'Auto',glue:'Glue',generator:'Generator'};
    var mh='';for(var k in mi)mh+='<button class="ck-mode-btn '+(_CK.mode===k?'active':'')+'" data-mode="'+k+'"><span class="ck-mode-icon">'+mi[k]+'</span><span class="ck-mode-label">'+ml[k]+'</span></button>';

    // Build folder list
    var folderListHTML='';
    if(_ZIP_STATE.loaded && _ZIP_STATE.folders.length){
        for(var i=0;i<_ZIP_STATE.folders.length;i++){
            var f=_ZIP_STATE.folders[i];
            var changed=f.newName!==f.origName;
            var hasTxt=!!f.txtContent;
            folderListHTML+=
            '<div class="zp-folder-row'+(changed?' zp-changed':'')+'" data-idx="'+i+'">'+
              '<span class="zp-folder-num">#'+(i+1)+'</span>'+
              '<span class="zp-folder-orig" title="'+_zipEsc(f.origName)+'">'+_zipEsc(f.origName)+'</span>'+
              '<span class="zp-arrow">→</span>'+
              '<input type="text" class="zp-folder-name-input'+(changed?' zp-input-changed':'')+'" data-nameidx="'+i+'" value="'+_zipEsc(f.newName)+'" placeholder="New folder name">'+
              '<span class="zp-folder-files">'+f.files.length+' files</span>'+
              '<button class="zp-txt-btn'+(hasTxt?' zp-txt-has':'')+((_ZIP_STATE._editTxtIdx===i)?' zp-txt-active':'')+'" data-txtidx="'+i+'" title="'+(hasTxt?'TXT set ✓':'Add TXT')+'">📝</button>'+
            '</div>';
        }
    }

    // TXT inline editor
    var txtEditorHTML='';
    if(_ZIP_STATE._editTxtIdx!==undefined && _ZIP_STATE._editTxtIdx>=0){
        var ef=_ZIP_STATE.folders[_ZIP_STATE._editTxtIdx];
        if(ef){
            txtEditorHTML=
            '<div class="zp-txt-editor">'+
              '<div class="zp-txt-header">'+
                '<span>📝 TXT for: <b>'+_zipEsc(ef.newName||ef.origName)+'</b></span>'+
                '<div class="zp-txt-header-actions">'+
                  '<button class="zp-txt-save" id="zp-txt-save">💾 Save</button>'+
                  '<button class="zp-txt-close" id="zp-txt-close">✕</button>'+
                '</div>'+
              '</div>'+
              '<textarea class="zp-txt-area" id="zp-txt-content" placeholder="Enter text for info.txt...">'+_zipEsc(ef.txtContent||'')+'</textarea>'+
            '</div>';
        }
    }

    area.innerHTML=
    '<div class="ck-container">'+
        '<div class="ck-header"><div class="ck-title"><span class="ck-icon">📦</span><span>ZIP PROCESSOR</span></div><div class="ck-modes">'+mh+'</div></div>'+
        '<div class="ck-proto-bar"><span class="ck-proto-label">Type:</span>'+
            '<button class="ck-proto-btn '+(gen.type==='tepco'?'active':'')+'" data-billtype="tepco">⚡ TEPCO</button>'+
            '<button class="ck-proto-btn '+(gen.type==='water'?'active':'')+'" data-billtype="water">💧 Water</button>'+
            '<button class="ck-proto-btn '+(gen.type==='creditcard'?'active':'')+'" data-billtype="creditcard">💳 Credit Card</button>'+
            '<button class="ck-proto-btn '+(gen.type==='driverlicense'?'active':'')+'" data-billtype="driverlicense">🪪 Driver License</button>'+
            '<button class="ck-proto-btn '+(gen.type==='zipprocessor'?'active':'')+'" data-billtype="zipprocessor">📦 ZIP Processor</button>'+
        '</div>'+
        // Upload zone
        '<div class="zp-upload-zone" id="zp-upload-zone">'+
          (_ZIP_STATE.loaded?
            '<div class="zp-loaded-info">'+
              '<span class="zp-loaded-icon">✅</span>'+
              '<span class="zp-loaded-name">'+_zipEsc(_ZIP_STATE.fileName)+'</span>'+
              '<span class="zp-loaded-count">'+_ZIP_STATE.folders.length+' folders</span>'+
              '<button class="zp-reload-btn" id="zp-reload-btn">🔄 New ZIP</button>'+
            '</div>'
          :
            '<label class="zp-upload-label" id="zp-upload-label">'+
              '<span class="zp-upload-icon">📁</span>'+
              '<span class="zp-upload-text">Drop ZIP file here or click to upload</span>'+
              '<input type="file" id="zp-file-input" accept=".zip" hidden>'+
            '</label>'
          )+
        '</div>'+
        // Controls + folder list
        (_ZIP_STATE.loaded?
        '<div class="zp-controls">'+
          '<div class="zp-bulk-row">'+
            '<button class="zp-ctrl-btn zp-ctrl-paste" id="zp-bulk-paste">📋 Paste Names</button>'+
            '<button class="zp-ctrl-btn zp-ctrl-txt" id="zp-bulk-txt">📝 Bulk TXT</button>'+
            '<button class="zp-ctrl-btn" id="zp-clear-names">🔄 Reset</button>'+
            '<div style="flex:1"></div>'+
            '<button class="zp-ctrl-btn zp-download-btn" id="zp-download-btn">📦 Download Processed ZIP</button>'+
          '</div>'+
        '</div>'+
        '<div class="zp-folder-list" id="zp-folder-list">'+folderListHTML+'</div>'
        :'')+
        txtEditorHTML+
    '</div>'+
    _zipRenderModal();

    _zipBindEvents();
}

// ─── EVENT BINDING ───
function _zipBindEvents(){
    var area=document.getElementById('content-area');
    var gen=_CK.generator;

    area.querySelectorAll('.ck-mode-btn').forEach(function(b){b.addEventListener('click',function(){_CK.mode=b.dataset.mode;if(_CK.mode==='glue')_renderGlue();else if(_CK.mode==='generator')_renderGenerator();else renderChecker();});});
    area.querySelectorAll('[data-billtype]').forEach(function(b){b.addEventListener('click',function(){gen.type=b.dataset.billtype;gen.billData=null;_renderGenerator();});});

    // File upload
    var inp=document.getElementById('zp-file-input');
    if(inp)inp.addEventListener('change',function(e){var f=e.target.files[0];if(f)_zipLoadFile(f);});

    // Drag & drop
    var zone=document.getElementById('zp-upload-zone');
    if(zone && !_ZIP_STATE.loaded){
        zone.addEventListener('dragover',function(e){e.preventDefault();zone.classList.add('zp-dragover');});
        zone.addEventListener('dragleave',function(e){e.preventDefault();zone.classList.remove('zp-dragover');});
        zone.addEventListener('drop',function(e){e.preventDefault();zone.classList.remove('zp-dragover');
            var f=e.dataTransfer.files[0];if(f && f.name.endsWith('.zip'))_zipLoadFile(f);else toast('Drop a .zip file','error');
        });
    }

    // Reload
    var rl=document.getElementById('zp-reload-btn');
    if(rl)rl.addEventListener('click',function(){_ZIP_STATE={loaded:false,fileName:'',folders:[],zipData:null,_editTxtIdx:undefined,_modal:null};_renderZipProcessor();});

    // Name inputs — live update
    area.querySelectorAll('[data-nameidx]').forEach(function(inp){
        inp.addEventListener('input',function(){
            var idx=parseInt(inp.dataset.nameidx);
            if(_ZIP_STATE.folders[idx]){
                _ZIP_STATE.folders[idx].newName=inp.value;
                var changed=inp.value!==_ZIP_STATE.folders[idx].origName;
                inp.classList.toggle('zp-input-changed',changed);
                inp.closest('.zp-folder-row').classList.toggle('zp-changed',changed);
            }
        });
    });

    // TXT edit buttons
    area.querySelectorAll('[data-txtidx]').forEach(function(b){
        b.addEventListener('click',function(){
            var idx=parseInt(b.dataset.txtidx);
            _ZIP_STATE._editTxtIdx=(_ZIP_STATE._editTxtIdx===idx)?undefined:idx;
            _renderZipProcessor();
            var ta=document.getElementById('zp-txt-content');if(ta)ta.focus();
        });
    });

    // TXT editor save/close
    var tClose=document.getElementById('zp-txt-close');
    if(tClose)tClose.addEventListener('click',function(){_ZIP_STATE._editTxtIdx=undefined;_renderZipProcessor();});
    var tSave=document.getElementById('zp-txt-save');
    if(tSave)tSave.addEventListener('click',function(){
        var ta=document.getElementById('zp-txt-content');
        if(ta && _ZIP_STATE.folders[_ZIP_STATE._editTxtIdx]){
            _ZIP_STATE.folders[_ZIP_STATE._editTxtIdx].txtContent=ta.value;
            toast('TXT saved ✓','success');
            _renderZipProcessor();
        }
    });

    // ─── MODAL BUTTONS ───
    // Open modals
    var bp=document.getElementById('zp-bulk-paste');
    if(bp)bp.addEventListener('click',function(){_zipShowModal('paste');});
    var bt=document.getElementById('zp-bulk-txt');
    if(bt)bt.addEventListener('click',function(){_zipShowModal('bulktxt');});

    // Close modal
    var mc=document.getElementById('zp-modal-close');
    if(mc)mc.addEventListener('click',_zipCloseModal);
    var mcancel=document.getElementById('zp-modal-cancel');
    if(mcancel)mcancel.addEventListener('click',_zipCloseModal);
    var overlay=document.getElementById('zp-modal-overlay');
    if(overlay)overlay.addEventListener('click',function(e){if(e.target===overlay)_zipCloseModal();});

    // Live line counter for Paste Names modal
    var modalTa=document.getElementById('zp-modal-textarea');
    var counterEl=document.getElementById('zp-modal-counter');
    if(modalTa && counterEl && _ZIP_STATE._modal==='paste'){
        var _updateCounter=function(){
            var lines=modalTa.value.split('\n').filter(function(l){return l.trim().length>0;});
            var total=_ZIP_STATE.folders.length;
            var count=lines.length;
            counterEl.textContent='Строк: '+count+' / '+total;
            counterEl.className='zp-modal-counter'+(count===total?' zp-counter-match':count>total?' zp-counter-over':' zp-counter-under');
        };
        modalTa.addEventListener('input',_updateCounter);
        modalTa.addEventListener('paste',function(){setTimeout(_updateCounter,50);});
        _updateCounter();
    }

    // Apply names from modal
    var applyNames=document.getElementById('zp-modal-apply-names');
    if(applyNames)applyNames.addEventListener('click',function(){
        var ta=document.getElementById('zp-modal-textarea');
        if(!ta||!ta.value.trim())return;
        var names=ta.value.split('\n').map(function(n){return n.trim();}).filter(function(n){return n.length>0;});
        for(var i=0;i<Math.min(names.length,_ZIP_STATE.folders.length);i++){
            _ZIP_STATE.folders[i].newName=names[i];
        }
        _ZIP_STATE._modal=null;
        _renderZipProcessor();
        toast(names.length+' names applied ✓','success');
    });

    // Apply bulk TXT from modal
    var applyTxt=document.getElementById('zp-modal-apply-txt');
    if(applyTxt)applyTxt.addEventListener('click',function(){
        var ta=document.getElementById('zp-modal-textarea');
        if(!ta)return;
        _ZIP_STATE.folders.forEach(function(f){f.txtContent=ta.value;});
        _ZIP_STATE._modal=null;
        _renderZipProcessor();
        toast('TXT set for all '+_ZIP_STATE.folders.length+' folders ✓','success');
    });

    // Reset names
    var rn=document.getElementById('zp-clear-names');
    if(rn)rn.addEventListener('click',function(){
        _ZIP_STATE.folders.forEach(function(f){f.newName=f.origName;});
        _renderZipProcessor();toast('Names reset ✓','success');
    });

    // Download
    var dl=document.getElementById('zp-download-btn');
    if(dl)dl.addEventListener('click',_zipBuildAndDownload);
}

// ─── ZIP LOADING ───
function _zipLoadFile(file){
    if(typeof JSZip==='undefined'){toast('JSZip not loaded','error');return;}
    toast('Loading ZIP...','info');
    var reader=new FileReader();
    reader.onload=function(e){
        JSZip.loadAsync(e.target.result).then(function(zip){
            _ZIP_STATE.zipData=zip;
            _ZIP_STATE.fileName=file.name;
            _ZIP_STATE.loaded=true;
            _ZIP_STATE.folders=[];
            _ZIP_STATE._editTxtIdx=undefined;
            _ZIP_STATE._modal=null;

            var folderSet={};
            var folderOrder=[];
            zip.forEach(function(path,entry){
                var parts=path.split('/');
                if(parts.length>=2 && parts[0]){
                    if(!folderSet[parts[0]]){
                        folderSet[parts[0]]={origName:parts[0],newName:parts[0],files:[],txtContent:''};
                        folderOrder.push(parts[0]);
                    }
                    if(!entry.dir && parts.length>=2){
                        folderSet[parts[0]].files.push(path);
                    }
                }
            });

            // Sort naturally: 1, 2, 3, ..., 10, 11 (not 1, 10, 11, 2, 3...)
            folderOrder.sort(function(a,b){return a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});});
            folderOrder.forEach(function(n){_ZIP_STATE.folders.push(folderSet[n]);});
            _renderZipProcessor();
            toast(_ZIP_STATE.folders.length+' folders loaded ✓','success');
        }).catch(function(err){
            console.error(err);toast('Error: '+err.message,'error');
        });
    };
    reader.readAsArrayBuffer(file);
}

// ─── ZIP BUILD & DOWNLOAD ───
function _zipBuildAndDownload(){
    if(typeof JSZip==='undefined'){toast('JSZip not loaded','error');return;}
    if(!_ZIP_STATE.folders.length){toast('No folders','error');return;}

    toast('Building ZIP...','info');
    var newZip=new JSZip();
    var promises=[];

    _ZIP_STATE.folders.forEach(function(folder){
        var newName=folder.newName||folder.origName;
        folder.files.forEach(function(origPath){
            var parts=origPath.split('/');
            parts[0]=newName;
            var newPath=parts.join('/');
            var entry=_ZIP_STATE.zipData.file(origPath);
            if(entry){
                promises.push(entry.async('uint8array').then(function(data){newZip.file(newPath,data);}));
            }
        });
        if(folder.txtContent){
            newZip.file(newName+'/info.txt',folder.txtContent);
        }
    });

    Promise.all(promises).then(function(){
        return newZip.generateAsync({type:'blob'});
    }).then(function(blob){
        var a=document.createElement('a');
        a.download='processed_'+_ZIP_STATE.fileName;
        a.href=URL.createObjectURL(blob);
        a.click();
        toast('ZIP downloaded! ✓','success');
    }).catch(function(err){
        console.error(err);toast('Error: '+err.message,'error');
    });
}
