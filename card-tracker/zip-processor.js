// ═══════════════════════════════════════════
//  ZIP PROCESSOR v1
//  Upload ZIP → rename folders → add txt → download
// ═══════════════════════════════════════════

var _ZIP_STATE = {
    loaded: false,
    fileName: '',
    folders: [],    // [{origName, newName, files:[], txtContent:''}]
    zipData: null
};

function _zipEsc(s){return s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):'';};

function _renderZipProcessor(){
    var area=document.getElementById('content-area');
    var bar=document.getElementById('stats-bar');
    bar.style.display='none';bar.innerHTML='';
    var gen=_CK.generator;
    var mi={proxy:'🌐',bin:'🔢',card:'💳',ip:'📡',auto:'🔍',glue:'🔗',generator:'📄'};
    var ml={proxy:'Proxy',bin:'BIN',card:'Card',ip:'IP',auto:'Auto',glue:'Glue',generator:'Generator'};
    var mh='';for(var k in mi)mh+='<button class="ck-mode-btn '+(_CK.mode===k?'active':'')+'" data-mode="'+k+'"><span class="ck-mode-icon">'+mi[k]+'</span><span class="ck-mode-label">'+ml[k]+'</span></button>';

    var folderListHTML='';
    if(_ZIP_STATE.loaded && _ZIP_STATE.folders.length){
        for(var i=0;i<_ZIP_STATE.folders.length;i++){
            var f=_ZIP_STATE.folders[i];
            folderListHTML+=
            '<div class="zp-folder-row" data-idx="'+i+'">'+
              '<span class="zp-folder-num">#'+(i+1)+'</span>'+
              '<span class="zp-folder-orig" title="'+_zipEsc(f.origName)+'">'+_zipEsc(f.origName)+'</span>'+
              '<span class="zp-arrow">→</span>'+
              '<input type="text" class="zp-folder-name-input" data-nameidx="'+i+'" value="'+_zipEsc(f.newName)+'" placeholder="New folder name">'+
              '<span class="zp-folder-files">'+f.files.length+' files</span>'+
              '<button class="zp-txt-btn" data-txtidx="'+i+'" title="Edit TXT content">📝</button>'+
            '</div>';
        }
    }

    var txtEditorHTML='';
    if(_ZIP_STATE._editTxtIdx!==undefined && _ZIP_STATE._editTxtIdx>=0){
        var ef=_ZIP_STATE.folders[_ZIP_STATE._editTxtIdx];
        if(ef){
            txtEditorHTML=
            '<div class="zp-txt-editor">'+
              '<div class="zp-txt-header">📝 TXT for: <b>'+_zipEsc(ef.newName||ef.origName)+'</b> <button class="zp-txt-close" id="zp-txt-close">✕</button></div>'+
              '<textarea class="zp-txt-area" id="zp-txt-content" placeholder="Enter text content for this folder...">'+_zipEsc(ef.txtContent||'')+'</textarea>'+
              '<button class="zp-txt-save" id="zp-txt-save">💾 Save</button>'+
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
        // Bulk rename
        (_ZIP_STATE.loaded?
        '<div class="zp-controls">'+
          '<div class="zp-bulk-row">'+
            '<button class="zp-ctrl-btn" id="zp-bulk-paste" title="Paste folder names from clipboard (one per line)">📋 Paste Names</button>'+
            '<button class="zp-ctrl-btn" id="zp-bulk-txt" title="Set same TXT content for all folders">📝 Bulk TXT</button>'+
            '<button class="zp-ctrl-btn" id="zp-clear-names" title="Reset all names to original">🔄 Reset Names</button>'+
            '<div style="flex:1"></div>'+
            '<button class="zp-ctrl-btn zp-download-btn" id="zp-download-btn">📦 Download Processed ZIP</button>'+
          '</div>'+
        '</div>'+
        '<div class="zp-folder-list" id="zp-folder-list">'+folderListHTML+'</div>'
        :'')+
        txtEditorHTML+
    '</div>';

    _zipBindEvents();
}

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
            var f=e.dataTransfer.files[0];if(f && f.name.endsWith('.zip'))_zipLoadFile(f);else toast('Please drop a .zip file','error');
        });
    }

    // Reload
    var rl=document.getElementById('zp-reload-btn');
    if(rl)rl.addEventListener('click',function(){_ZIP_STATE.loaded=false;_ZIP_STATE.folders=[];_ZIP_STATE.zipData=null;_ZIP_STATE.fileName='';_renderZipProcessor();});

    // Name inputs
    area.querySelectorAll('[data-nameidx]').forEach(function(inp){
        inp.addEventListener('input',function(){
            var idx=parseInt(inp.dataset.nameidx);
            if(_ZIP_STATE.folders[idx])_ZIP_STATE.folders[idx].newName=inp.value;
        });
    });

    // TXT edit buttons
    area.querySelectorAll('[data-txtidx]').forEach(function(b){
        b.addEventListener('click',function(){
            _ZIP_STATE._editTxtIdx=parseInt(b.dataset.txtidx);
            _renderZipProcessor();
            var ta=document.getElementById('zp-txt-content');if(ta)ta.focus();
        });
    });

    // TXT editor
    var tClose=document.getElementById('zp-txt-close');
    if(tClose)tClose.addEventListener('click',function(){_ZIP_STATE._editTxtIdx=undefined;_renderZipProcessor();});
    var tSave=document.getElementById('zp-txt-save');
    if(tSave)tSave.addEventListener('click',function(){
        var ta=document.getElementById('zp-txt-content');
        if(ta && _ZIP_STATE.folders[_ZIP_STATE._editTxtIdx]){
            _ZIP_STATE.folders[_ZIP_STATE._editTxtIdx].txtContent=ta.value;
            toast('TXT saved for folder #'+(_ZIP_STATE._editTxtIdx+1),'success');
        }
    });

    // Bulk paste names
    var bp=document.getElementById('zp-bulk-paste');
    if(bp)bp.addEventListener('click',function(){
        var input=prompt('Paste folder names (one per line):');
        if(!input)return;
        var names=input.split('\n').map(function(n){return n.trim();}).filter(function(n){return n.length>0;});
        for(var i=0;i<Math.min(names.length,_ZIP_STATE.folders.length);i++){
            _ZIP_STATE.folders[i].newName=names[i];
        }
        _renderZipProcessor();
        toast(names.length+' names applied','success');
    });

    // Bulk TXT
    var bt=document.getElementById('zp-bulk-txt');
    if(bt)bt.addEventListener('click',function(){
        var txt=prompt('Enter TXT content for ALL folders:');
        if(txt===null)return;
        _ZIP_STATE.folders.forEach(function(f){f.txtContent=txt;});
        toast('TXT set for all folders','success');
    });

    // Reset names
    var rn=document.getElementById('zp-clear-names');
    if(rn)rn.addEventListener('click',function(){
        _ZIP_STATE.folders.forEach(function(f){f.newName=f.origName;});
        _renderZipProcessor();toast('Names reset','success');
    });

    // Download
    var dl=document.getElementById('zp-download-btn');
    if(dl)dl.addEventListener('click',_zipBuildAndDownload);
}

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

            // Find top-level folders
            var folderSet={};
            zip.forEach(function(path,entry){
                var parts=path.split('/');
                if(parts.length>=2 && parts[0]){
                    if(!folderSet[parts[0]]){
                        folderSet[parts[0]]={origName:parts[0],newName:parts[0],files:[],txtContent:''};
                    }
                    if(!entry.dir && parts.length>=2){
                        folderSet[parts[0]].files.push(path);
                    }
                }
            });

            // Sort folders by name
            var folderNames=Object.keys(folderSet).sort();
            folderNames.forEach(function(n){_ZIP_STATE.folders.push(folderSet[n]);});

            _renderZipProcessor();
            toast(_ZIP_STATE.folders.length+' folders found','success');
        }).catch(function(err){
            console.error(err);
            toast('Error reading ZIP: '+err.message,'error');
        });
    };
    reader.readAsArrayBuffer(file);
}

function _zipBuildAndDownload(){
    if(typeof JSZip==='undefined'){toast('JSZip not loaded','error');return;}
    if(!_ZIP_STATE.folders.length){toast('No folders to process','error');return;}

    toast('Building ZIP...','info');
    var newZip=new JSZip();
    var promises=[];

    _ZIP_STATE.folders.forEach(function(folder,fi){
        var newFolderName=folder.newName||folder.origName;
        // Copy all files from original folder to new folder name
        folder.files.forEach(function(origPath){
            var parts=origPath.split('/');
            parts[0]=newFolderName;
            var newPath=parts.join('/');
            var entry=_ZIP_STATE.zipData.file(origPath);
            if(entry){
                promises.push(
                    entry.async('uint8array').then(function(data){
                        newZip.file(newPath,data);
                    })
                );
            }
        });

        // Add TXT file if content exists
        if(folder.txtContent){
            newZip.file(newFolderName+'/info.txt',folder.txtContent);
        }
    });

    Promise.all(promises).then(function(){
        return newZip.generateAsync({type:'blob'});
    }).then(function(blob){
        var a=document.createElement('a');
        a.download='processed_'+_ZIP_STATE.fileName;
        a.href=URL.createObjectURL(blob);
        a.click();
        toast('ZIP downloaded!','success');
    }).catch(function(err){
        console.error(err);
        toast('Error building ZIP: '+err.message,'error');
    });
}
