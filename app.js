const $=id=>document.getElementById(id);
const layouts=[1,2,4,6,8];
let pages=[newPage(6)],selected=new Set(),selectedPage=null;
let moveMode=false,undoStack=[],redoStack=[],saveCounter=0;

function newPage(layout=6){return{layout,fields:{reportTitle:'',reportTitleEdited:false,title:'',place:'',date:'',company:'',memo:''},slots:Array(layout).fill(null)}}
function clone(x){return JSON.parse(JSON.stringify(x))}
function key(pi,si){return pi+':'+si}
function safeName(s){return String(s||'写真報告書').replace(/[\\\\/:*?"<>|\\s]+/g,'_').slice(0,40)||'写真報告書'}
function hist(){undoStack.push(JSON.stringify(pages));if(undoStack.length>80)undoStack.shift();redoStack=[]}
function normalizePage(p){if(!layouts.includes(p.layout))p.layout=6;if(!p.fields)p.fields={};['reportTitle','title','place','date','company','memo'].forEach(k=>{if(typeof p.fields[k]==='undefined')p.fields[k]=''});if(typeof p.fields.reportTitleEdited==='undefined')p.fields.reportTitleEdited=false;if(!Array.isArray(p.slots))p.slots=[];while(p.slots.length<p.layout)p.slots.push(null);if(p.slots.length>p.layout)p.slots=p.slots.slice(0,p.layout)}
function normalizeAll(){if(!pages.length)pages=[newPage(6)];pages.forEach(normalizePage)}
function countPhotos(){return pages.flatMap(p=>p.slots).filter(Boolean).length}
function restore(s){pages=JSON.parse(s);selected.clear();selectedPage=null;moveMode=false;normalizeAll();render()}

window.addEventListener('load',()=>{setupButtonHints();render()});
$('hideMenuBtn').onclick=()=>{document.body.classList.add('menuHidden');$('showMenuBtn').classList.remove('hidden')};
$('showMenuBtn').onclick=()=>{document.body.classList.remove('menuHidden');$('showMenuBtn').classList.add('hidden')};

$('fileInput').addEventListener('change',async e=>{
 const files=[...e.target.files];if(!files.length)return;hist();
 for(const f of files){
  const dataUrl=await fileToDataURL(f),thumbUrl=await makeThumb(dataUrl);
  placePhoto({type:'photo',name:f.name.replace(/\.[^.]+$/,''),dataUrl,thumbUrl});
 }
 e.target.value='';render();
});

$('undoBtn').onclick=()=>{if(!undoStack.length)return alert('戻る履歴がありません');redoStack.push(JSON.stringify(pages));restore(undoStack.pop())};
$('redoBtn').onclick=()=>{if(!redoStack.length)return alert('進む履歴がありません');undoStack.push(JSON.stringify(pages));restore(redoStack.pop())};
$('moveBtn').onclick=()=>{
 if(!moveMode){
  if(!selected.size)return alert('移動する写真を先に選択してください。');
  alert('選択写真移動をONにしました。移動先の枠をタップすると、選択した写真を移動します。');
 }
 moveMode=!moveMode;render()
};
$('deleteBtn').onclick=deleteSelectedPhotos;
$('deletePageBtn').onclick=deleteSelectedPage;
$('addPageBtn').onclick=addPage;
$('jpegBtn').onclick=saveJpegAll;

function setHelp(msg){const h=$('help');if(h)h.textContent=msg}

function setupButtonHints(){
 const hints={
  addPageBtn:'新しいA4ページを追加します。追加後にページ上部で1/2/4/6/8枚を選べます。',
  moveBtn:'写真を選択してから押すと、移動先の枠を選べます。',
  deleteBtn:'選択中の写真を確認してから削除します。',
  deletePageBtn:'選択中のページを確認してから削除します。写真があるページは追加確認します。最後の1ページは削除できません。',
  jpegBtn:'全ページ・選択ページ・3,5,6のようなページ指定でJPEG保存します。iPhoneの共有画面から「画像を保存」を選ぶと写真フォルダへ保存できます。'
 };
 Object.entries(hints).forEach(([id,msg])=>{const el=$(id);if(!el)return;el.title=msg;el.addEventListener('mouseenter',()=>setHelp(msg));el.addEventListener('focus',()=>setHelp(msg));});
}
function pageLabel(targets){
 if(!targets||!targets.length)return '対象なし';
 if(targets.length===pages.length)return `全${targets.length}ページ`;
 return targets.map(i=>`ページ${i+1}`).join('、');
}
function normalizeTargetList(list){
 const nums=[...new Set(list.map(n=>Number(n)).filter(n=>Number.isInteger(n)&&n>=1&&n<=pages.length))].sort((a,b)=>a-b);
 return nums.map(n=>n-1);
}
function chooseTargets(kind){
 if(!countPhotos()){alert('写真がありません');return null}
 const selectedText=selectedPage!==null?`ページ${selectedPage+1}`:'未選択';
 const msg=`${kind}するページを選んでください\n\n全ページ：全 または A\n選択ページ：選択 または S（現在：${selectedText}）\nページ指定：3,5,6 のように入力\n\n※例：3,5,6 と入れると3ページ目、5ページ目、6ページ目だけ処理します。`;
 const input=prompt(msg,'全');
 if(input===null)return null;
 const v=String(input).trim().toLowerCase().replace(/，/g,',').replace(/、/g,',');
 if(v==='全'||v==='all'||v==='a')return pages.map((_,i)=>i);
 if(v==='選択'||v==='selected'||v==='select'||v==='s'){
  if(selectedPage===null){alert('選択ページのみの場合は、先に「ページ○選択」を押してください。');return null}
  return [selectedPage];
 }
 const targets=normalizeTargetList(v.split(/[,\s]+/));
 if(targets.length)return targets;
 alert('保存するページを正しく入力してください。例：全、選択、3,5,6');return null;
}
function confirmTargets(kind,targets,extra){
 const msg=`${kind}します。\n対象：${pageLabel(targets)}${extra?'\n'+extra:''}`;
 return confirm(msg);
}

function placePhoto(photo){
 for(const p of pages){normalizePage(p);const i=p.slots.findIndex(x=>x===null);if(i>=0){p.slots[i]=photo;return}}
 const p=newPage(pages.length?pages[pages.length-1].layout:6);p.slots[0]=photo;pages.push(p)
}

function render(){
 normalizeAll();
 $('moveBtn').textContent=moveMode?'選択写真移動ON':'選択写真移動OFF';
 $('moveBtn').classList.toggle('on',moveMode);
 const root=$('pages');root.innerHTML='';
 pages.forEach((p,pi)=>{
  const page=document.createElement('section');page.className='page';if(selectedPage===pi)page.classList.add('pageSelected');
  page.appendChild(pageHead(p,pi));page.appendChild(fields(p));
  const grid=document.createElement('div');grid.className='grid';
  const cols=p.layout===1?1:2,rows=Math.ceil(p.layout/cols);
  grid.style.gridTemplateColumns=`repeat(${cols},1fr)`;grid.style.gridTemplateRows=`repeat(${rows},1fr)`;
  for(let si=0;si<p.layout;si++){
   const item=p.slots[si]||null,k=key(pi,si),cell=document.createElement('div');cell.className=item?'slot':'slot empty';
   if(selected.has(k))cell.classList.add('selected');if(moveMode&&selected.size&&!selected.has(k))cell.classList.add('target');
   if(item){
    const name=document.createElement('input');name.className='photoName';name.value=item.name||'';name.placeholder='写真名';name.onclick=ev=>ev.stopPropagation();name.onfocus=histOnce;name.oninput=()=>{item.name=name.value};
    const wrap=document.createElement('div');wrap.className='imgWrap';const img=document.createElement('img');img.src=item.thumbUrl;wrap.appendChild(img);cell.appendChild(name);cell.appendChild(wrap);
   }
   cell.onclick=ev=>{ev.stopPropagation();tapSlot(pi,si)};grid.appendChild(cell);
  }
  page.appendChild(grid);root.appendChild(page);
 });
}

function defaultReportTitle(pi){return `写真報告書 ${pi+1}`}
function shownReportTitle(p,pi){return p.fields.reportTitleEdited?String(p.fields.reportTitle||''):defaultReportTitle(pi)}
function pageHead(p,pi){
 const d=document.createElement('div');d.className='pageHead';
 const top=document.createElement('div');top.className='pageHeadTop';
 const second=document.createElement('div');second.className='pageHeadSecond';
 const pick=document.createElement('button');pick.className='pagePick'+(selectedPage===pi?' selected':'');pick.textContent=`ページ${pi+1}選択`;pick.onclick=ev=>{ev.stopPropagation();selectedPage=selectedPage===pi?null:pi;render()};
 const title=document.createElement('input');title.className='reportTitleInput';title.value=shownReportTitle(p,pi);title.placeholder=`写真報告書 ${pi+1}`;title.onclick=ev=>ev.stopPropagation();title.onfocus=histOnce;title.oninput=()=>{p.fields.reportTitleEdited=true;p.fields.reportTitle=title.value};
 const lab=document.createElement('label');lab.textContent='枚数';
 const sel=document.createElement('select');layouts.forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n+'枚';if(p.layout===n)o.selected=true;sel.appendChild(o)});
 sel.onchange=()=>changeLayout(pi,Number(sel.value));
 top.appendChild(pick);top.appendChild(title);
 second.appendChild(lab);second.appendChild(sel);
 d.appendChild(top);d.appendChild(second);return d;
}


function fields(p){
 const box=document.createElement('div');box.className='fields';
 [['title','名称','text'],['place','場所','text'],['date','日付','date'],['company','会社名/氏名','text'],['memo','メモ','text']].forEach(([k,label,type])=>{
  const input=document.createElement('input');input.className=k==='memo'?'reportInput memo':'reportInput';input.type=type;input.placeholder=label;input.value=p.fields[k]||'';input.onfocus=histOnce;input.oninput=()=>{p.fields[k]=input.value};box.appendChild(input);
 });
 return box;
}
function histOnce(ev){if(ev.target.dataset.h==='1')return;ev.target.dataset.h='1';hist();ev.target.onblur=()=>{ev.target.dataset.h='0'}}

function changeLayout(pi,n){
 hist();const p=pages[pi],old=p.slots.slice(),keep=old.slice(0,n),overflow=old.slice(n).filter(Boolean);
 p.layout=n;p.slots=keep;while(p.slots.length<n)p.slots.push(null);overflow.forEach(x=>placePhoto(x));render();
}

function tapSlot(pi,si){
 const k=key(pi,si);
 if(moveMode&&selected.size&&!selected.has(k)){swapSelectedTo(pi,si);return}
 const item=pages[pi].slots[si];if(!item)return;
 if(selected.has(k))selected.delete(k);else selected.add(k);render();
}

function globalIndex(pi,si){let n=0;for(let p=0;p<pi;p++)n+=pages[p].layout;return n+si}
function flatItems(){const arr=[];pages.forEach(p=>{for(let si=0;si<p.layout;si++)arr.push(p.slots[si]||null)});return arr}
function applyFlat(arr){let n=0;pages.forEach(p=>{for(let si=0;si<p.layout;si++)p.slots[si]=n<arr.length?arr[n++]:null})}
function swapSelectedTo(tpi,tsi){
 hist();const arr=flatItems();
 const selectedIndexes=[...selected].map(k=>{const [pi,si]=k.split(':').map(Number);return globalIndex(pi,si)}).sort((a,b)=>a-b);
 const target=globalIndex(tpi,tsi);
 const moving=selectedIndexes.map(i=>arr[i]).filter(Boolean);
 if(!moving.length){selected.clear();moveMode=false;render();return}
 const targetIndexes=[];for(let i=0;i<moving.length;i++){if(target+i<arr.length)targetIndexes.push(target+i)}
 const targetItems=targetIndexes.map(i=>arr[i]);
 selectedIndexes.forEach((idx,i)=>{arr[idx]=i<targetItems.length?targetItems[i]:null});
 targetIndexes.forEach((idx,i)=>{arr[idx]=moving[i]});
 applyFlat(arr);selected.clear();moveMode=false;render();
}

function deleteSelectedPhotos(){
 if(!selected.size)return alert('削除する写真を選択してください');
 if(!confirm('選択した写真を削除しますか？'))return;
 hist();pages.forEach((p,pi)=>{for(let si=0;si<p.layout;si++){if(selected.has(key(pi,si)))p.slots[si]=null}});
 selected.clear();moveMode=false;render();
}
function deleteSelectedPage(){
 if(selectedPage===null)return alert('ページ選択枠をタップして削除するページを選んでください');
 if(pages.length<=1)return alert('最後の1ページは削除できません');
 const p=pages[selectedPage];
 const hasPhoto=p.slots.some(Boolean);
 const msg=hasPhoto?`このページには写真があります。ページ${selectedPage+1}を削除しますか？`:`選択中のページ${selectedPage+1}を削除しますか？`;
 if(!confirm(msg))return;
 hist();pages.splice(selectedPage,1);selectedPage=null;setHelp('選択ページを削除しました。');render();
}
function addPage(){
 if(!confirm('新しいページを追加しますか？'))return;
 hist();pages.push(newPage(6));selectedPage=pages.length-1;
 setHelp(`${pages.length}ページ目を追加しました。ページ上部の枚数から1/2/4/6/8枚に変更できます。`);
 render();
}

function firstReportBase(){
 const first=pages[0]&&shownReportTitle(pages[0],0).trim();
 return safeName(first||'写真報告書');
}
function stampYMDH(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}`}
function stampYMDHMS(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`}
async function buildJpegFiles(targets,prefix=''){
 const files=[],base=firstReportBase(),time=stampYMDH();
 for(const pi of targets){
  const img=await renderPage(pi);
  const pagePart=targets.length>1?`_ページ${pi+1}`:'';
  const name=`${prefix}${base}_${time}${pagePart}.jpg`;
  files.push({name,dataUrl:img,kind:'jpeg'});
  await idleTick();
 }
 clearRenderCanvas();
 return files;
}

async function saveJpegAll(){
 const targets=chooseTargets('JPEG保存');
 if(!targets)return;
 if(!confirmTargets('JPEG保存',targets,'指定したページをまとめて1回の保存画面で開きます。'))return;
 setHelp(`JPEG保存準備中：${pageLabel(targets)}`);
 const files=await buildJpegFiles(targets);
 const ok=await saveFiles(files,'JPEG保存');
 if(ok)setHelp(`共有画面を開きました：${pageLabel(targets)}。iPhoneでは「画像を保存」を選ぶと写真フォルダへ保存できます。`);
}
async function renderPages(){const arr=[];for(let i=0;i<pages.length;i++)arr.push(await renderPage(i));return arr}
async function renderPage(pi){
 const c=$('canvas'),ctx=c.getContext('2d');c.width=2480;c.height=3508;
 ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
 const p=pages[pi];drawHeader(ctx,p,pi);
 const margin=140,top=430,gap=70,cols=p.layout===1?1:2,rows=Math.ceil(p.layout/cols);
 const cw=(c.width-margin*2-gap*(cols-1))/cols,ch=(c.height-top-margin-gap*(rows-1))/rows;
 for(let i=0;i<p.layout;i++){
  const col=i%cols,row=Math.floor(i/cols),x=margin+col*(cw+gap),y=top+row*(ch+gap);
  ctx.strokeStyle='#ddd';ctx.lineWidth=2;ctx.strokeRect(x,y,cw,ch);
  const item=p.slots[i];if(item){
   ctx.fillStyle='#000';ctx.font='30px sans-serif';ctx.fillText(item.name||'',x+12,y+38);
   const img=await loadImage(item.dataUrl);drawContain(ctx,img,x+12,y+54,cw-24,ch-66);
  }
 }
 return c.toDataURL('image/jpeg',0.96);
}
function drawHeader(ctx,p,pi){
 ctx.fillStyle='#000';ctx.strokeStyle='#000';
 const reportTitle=shownReportTitle(p,pi).trim();
 if(reportTitle){ctx.font='bold 42px sans-serif';ctx.fillText(reportTitle,140,110)}
 ctx.font='28px sans-serif';
 headerLine(ctx,'名称',p.fields.title,140,180,980);headerLine(ctx,'場所',p.fields.place,1300,180,960);headerLine(ctx,'日付',p.fields.date,140,250,980);headerLine(ctx,'会社名/氏名',p.fields.company,1300,250,960);headerLine(ctx,'メモ',p.fields.memo,140,325,2120);
}
function headerLine(ctx,label,value,x,y,w){value=String(value||'').trim();if(!value)return;ctx.font='bold 28px sans-serif';ctx.fillText(label+'：',x,y);ctx.beginPath();ctx.moveTo(x,y+18);ctx.lineTo(x+w,y+18);ctx.stroke();ctx.font='28px sans-serif';ctx.fillText(value,x+190,y)}

function drawContain(ctx,img,x,y,w,h){const r=img.naturalWidth/img.naturalHeight,fr=w/h;let dw,dh;if(r>fr){dw=w;dh=w/r}else{dh=h;dw=h*r}ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh)}

function clearRenderCanvas(){const c=$('canvas');if(!c)return;const ctx=c.getContext('2d');if(ctx)ctx.clearRect(0,0,c.width,c.height);c.width=1;c.height=1}
function idleTick(){return new Promise(r=>setTimeout(r,0))}
function fileMime(kind){return kind==='pdf'?'application/pdf':'image/jpeg'}
function fileFolder(kind){return kind==='pdf'?'A4Report_PDF/':'A4Report_JPEG/'}
function base64Of(dataUrl){return dataUrl&&dataUrl.includes(',')?dataUrl.split(',')[1]:dataUrl}
async function saveFiles(files,label){
 files=(files||[]).filter(f=>f&&f.kind==='jpeg');
 if(!files.length)return false;
 try{
  const shareFiles=[];
  for(const file of files){
   const blob=dataUrlToBlob(file.dataUrl,'image/jpeg');
   shareFiles.push(new File([blob],file.name,{type:'image/jpeg'}));
  }
  if(navigator.canShare&&navigator.canShare({files:shareFiles})&&navigator.share){
   await navigator.share({title:label,text:'共有画面で「画像を保存」を選ぶと写真フォルダへ保存できます。',files:shareFiles});
   return true;
  }
  // iOS/Safari以外の予備：1枚ずつ画像を開く
  for(const file of files)openImageForSaving(file.name,file.dataUrl);
  alert('共有保存に対応していないため、画像を開きました。長押しして写真に保存してください。');
  return true;
 }catch(e){
  console.error(e);
  const raw=(e&&e.message?String(e.message):'');
  const canceled=/cancel|cancelled|canceled|dismiss|abort|中止|キャンセル/i.test(raw);
  const msg=canceled
   ? `${label}をキャンセルしました。保存は中止しました。`
   : `${label}の共有画面を開けませんでした。Safariで開いてもう一度実行してください。`;
  setHelp(msg);
  alert(msg+(canceled?'':`\n${raw||'原因不明'}`));
  return false;
 }
}

function dataUrlToBlob(dataUrl,mime){
 const base64=base64Of(dataUrl);
 const byteCharacters=atob(base64);
 const byteNumbers=new Array(byteCharacters.length);
 for(let i=0;i<byteCharacters.length;i++)byteNumbers[i]=byteCharacters.charCodeAt(i);
 return new Blob([new Uint8Array(byteNumbers)],{type:mime});
}
function openImageForSaving(name,dataUrl){
 const w=window.open('','_blank');
 if(!w){downloadDataUrl(name,dataUrl,'image/jpeg');return}
 w.document.write('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+name+'</title><body style="margin:0;background:#eee;text-align:center"><p>画像を長押しして保存してください</p><img style="max-width:100%;height:auto" src="'+dataUrl+'"></body>');
 w.document.close();
}

function downloadDataUrl(name,dataUrl,mime){
 const base64=base64Of(dataUrl);
 const byteCharacters=atob(base64);
 const byteNumbers=new Array(byteCharacters.length);
 for(let i=0;i<byteCharacters.length;i++)byteNumbers[i]=byteCharacters.charCodeAt(i);
 const blob=new Blob([new Uint8Array(byteNumbers)],{type:mime});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();
 setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);
}

function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');saveCounter++;return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}_${saveCounter}`}
function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
async function makeThumb(src){const img=await loadImage(src),c=document.createElement('canvas'),m=700,s=Math.min(1,m/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*s));c.height=Math.max(1,Math.round(img.naturalHeight*s));c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',0.75)}
render();
