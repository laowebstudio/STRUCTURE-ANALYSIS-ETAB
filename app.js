(() => {
'use strict';
const $ = id => document.getElementById(id);
const canvas = $('canvas'), ctx = canvas.getContext('2d');
let dpr = Math.max(1, window.devicePixelRatio || 1);
const defaultMaterials=[{id:'MAT-CONC-25',name:'Concrete 25 MPa',type:'Concrete',E:25000000,fy:0,fc:25},{id:'MAT-STEEL-250',name:'Structural Steel Fy250',type:'Steel',E:200000000,fy:250000,fc:0}];
const defaultSections=[{id:'SEC-RC-300x500',name:'RC 300×500 mm',type:'RC Rectangular',materialId:'MAT-CONC-25',A:0.15,I:0.003125,Iy:0.001125,J:0.00204,weight:3.6,dimensions:{b:0.3,h:0.5}},{id:'SEC-RC-300x300',name:'RC 300×300 mm',type:'RC Rectangular',materialId:'MAT-CONC-25',A:0.09,I:0.000675,Iy:0.000675,J:0.00095,weight:2.16,dimensions:{b:0.3,h:0.3}},{id:'SEC-STEEL-I',name:'H300×150×8×12',type:'Steel I',materialId:'MAT-STEEL-250',A:0.005808,I:0.0000881,Iy:0.00000676,J:0.00000022,weight:0.456,dimensions:{h:0.3,bf:0.15,tw:0.008,tf:0.012}}];
const defaultLoadCases=[{id:'DL',name:'Dead Load',type:'Dead'},{id:'LL',name:'Live Load',type:'Live'}];
const defaultLoadCombinations=[
 {id:'COMB-1',name:'1.4DL',factors:{DL:1.4}},
 {id:'COMB-2',name:'1.2DL + 1.6LL',factors:{DL:1.2,LL:1.6}}
];
const state = {nodes:[],members:[],materials:JSON.parse(JSON.stringify(defaultMaterials)),sections:JSON.parse(JSON.stringify(defaultSections)),loadCases:JSON.parse(JSON.stringify(defaultLoadCases)),loadCombinations:JSON.parse(JSON.stringify(defaultLoadCombinations)),activeLoadCase:'DL',activeAnalysis:'CASE:DL', tool:'select', selected:null, memberStart:null, nextNode:1,nextMember:1, view:{scale:55,ox:120,oy:500}, dragging:null, panning:null, hover:null, results:null, resultTab:'summary', diagramScale:1, autoDiagramScale:true, showLabels:true,showLoadLabels:true,modelLoadLabels:true,resultsByAnalysis:new Map(),multiSelectedMemberIds:new Set(),boxSelect:null,building:{stories:0,bays:0,storyHeights:[],bayWidths:[],levels:[],grids:[]},layers:{members:true,nodes:true,loads:true,supports:true,labels:true},designSetup:{steelCode:'AISC 360-22',rcCode:'ACI CODE-318-25',steelMethod:'LRFD',rcMethod:'Strength Design',designCombination:'ENVELOPE'},model3d:{nodes:[],members:[],nextNode:1,nextMember:1,view:{yaw:-35,pitch:24,scale:34}}};
const LIBRARY_STORAGE_KEY='sapudom-engineering-libraries-v1';
function mergeUniqueById(...lists){const map=new Map();for(const list of lists)for(const item of (list||[]))if(item&&item.id)map.set(item.id,item);return [...map.values()];}
function readPersistentLibraries(){try{return JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY)||'{}')}catch{return {}}}
function persistLibraries(){try{localStorage.setItem(LIBRARY_STORAGE_KEY,JSON.stringify({materials:state.materials,sections:state.sections,updatedAt:new Date().toISOString()}))}catch{}}
function mergePersistentLibraries(){const saved=readPersistentLibraries();state.materials=mergeUniqueById(defaultMaterials,saved.materials,state.materials);state.sections=mergeUniqueById(defaultSections,saved.sections,state.sections);persistLibraries();}
mergePersistentLibraries();
let undoStack=[], redoStack=[];
function canonicalMemberLoadV1182(ld){
 if(!ld||typeof ld!=='object')return ld;
 const x=JSON.parse(JSON.stringify(ld));
 x.type=String(x.type||'LOAD').toUpperCase();
 x.source=String(x.source||'MANUAL').toUpperCase();
 if(x.direction!=null)x.direction=String(x.direction).toUpperCase();
 for(const k of ['w1','w2','a','b','P','M','x','r']) if(x[k]!=null&&Number.isFinite(Number(x[k]))) x[k]=Number(x[k]);
 return x;
}
function normalizeMemberLoadPersistenceV1182(model){
 const m=model||{};
 for(const mem of m.members||[]){
  mem.loads=mem.loads||{};
  for(const lc of m.loadCases||state.loadCases||[]){const id=lc.id;if(!Array.isArray(mem.loads[id]))mem.loads[id]=[];mem.loads[id]=mem.loads[id].filter(Boolean).map(canonicalMemberLoadV1182)}
  for(const [id,arr] of Object.entries(mem.loads))if(Array.isArray(arr))mem.loads[id]=arr.filter(Boolean).map(canonicalMemberLoadV1182);
 }
 return m;
}
function memberLoadPersistenceSummaryV1182(model){let total=0,manual=0,generated=0;const rows=[];for(const mem of model?.members||[])for(const [caseId,arr] of Object.entries(mem.loads||{}))for(const ld of Array.isArray(arr)?arr:[]){total++;const src=String(ld?.source||'MANUAL').toUpperCase();if(src==='MANUAL')manual++;else generated++;rows.push(`M${mem.id}|${caseId}|${String(ld?.type||'')}|${Number(ld?.w1??ld?.P??ld?.M??0)}|${Number(ld?.w2??ld?.x??0)}|${src}`)}return {total,manual,generated,fingerprint:rows.sort().join('~')}}
function cloneModel(){const model=JSON.parse(JSON.stringify({nodes:state.nodes,members:state.members,materials:state.materials,sections:state.sections,loadCases:state.loadCases,loadCombinations:state.loadCombinations,activeLoadCase:state.activeLoadCase,activeAnalysis:state.activeAnalysis,nextNode:state.nextNode,nextMember:state.nextMember,view:state.view,building:state.building,layers:state.layers,designSetup:state.designSetup,model3d:state.model3d}));return normalizeMemberLoadPersistenceV1182(model);}
function projectSnapshot(){const model=cloneModel(),sum=memberLoadPersistenceSummaryV1182(model);return {version:'1.25.2-json-load-visual-sync',projectName:$('projectName')?.value||'Untitled Frame',units:$('units')?.value||'kN - m',...model,loadPersistence:{total:sum.total,manual:sum.manual,generated:sum.generated,fingerprint:sum.fingerprint}}}
function countGeneratedInModel(model,source=null){let n=0;for(const m of model?.members||[]){for(const arr of Object.values(m.loads||{})){if(!Array.isArray(arr))continue;for(const l of arr)if(l&&(l.source||l.generatedBy)&&(source==null||l.source===source))n++}}return n}
function snapshotSummary(model){return {members:(model?.members||[]).length,selfWeight:countGeneratedInModel(model,'SELF_WEIGHT'),generated:countGeneratedInModel(model)}}
function pushHistory(){undoStack.push(cloneModel()); if(undoStack.length>100)undoStack.shift(); redoStack=[]; updateButtons();}
function refreshLayoutAfterLoad(){window.scrollTo(0,0);const center=document.querySelector('.center');if(center)center.scrollTop=0;requestAnimationFrame(()=>requestAnimationFrame(()=>{resize();render();}));}
function syncLoadedLoadPresentationV1252(forceVisible=false){
 const defaults={members:true,nodes:true,loads:true,supports:true,labels:true};
 state.layers={...defaults,...(state.layers||{})};
 // Make sure the active load case is valid before rebuilding the legacy active-load mirrors.
 if(!state.loadCases.some(c=>c.id===state.activeLoadCase))state.activeLoadCase=state.loadCases[0]?.id||'DL';
 syncActiveLoads();
 const activeMemberCount=state.members.reduce((n,m)=>n+(Array.isArray(m.loads?.[state.activeLoadCase])?m.loads[state.activeLoadCase].length:0),0);
 const activeNodeCount=state.nodes.reduce((n,node)=>{const l=node.loads?.[state.activeLoadCase]||node.load||{};return n+((Number(l.fx)||Number(l.fy)||Number(l.mz))?1:0)},0);
 if(forceVisible&&(activeMemberCount||activeNodeCount)){
  state.layers.loads=true;
  state.showLoadLabels=true;
  state.modelLoadLabels=true;
 }
 const lc=$('activeLoadCase');if(lc)lc.value=state.activeLoadCase;
 const label=$('loadLabelToggle');if(label)label.checked=state.modelLoadLabels!==false;
 return {activeMemberCount,activeNodeCount};
}
function restore(s,options={}){s=normalizeMemberLoadPersistenceV1182(JSON.parse(JSON.stringify(s||{})));state.nodes=s.nodes||[];state.members=s.members||[];state.materials=s.materials||JSON.parse(JSON.stringify(defaultMaterials));state.sections=s.sections||JSON.parse(JSON.stringify(defaultSections));mergePersistentLibraries();for(const m of state.members){m.sectionOrientation=sectionOrientationV126(m);const sec=state.sections.find(x=>x.id===m.sectionId);if(sec){const op=orientedSectionPropsV126(m,sec);m.I=op.I;m.Iy=op.Iy}}state.loadCases=s.loadCases||JSON.parse(JSON.stringify(defaultLoadCases));state.loadCombinations=s.loadCombinations||JSON.parse(JSON.stringify(defaultLoadCombinations));state.activeLoadCase=s.activeLoadCase||state.loadCases[0]?.id||'DL';state.activeAnalysis=s.activeAnalysis||('CASE:'+state.activeLoadCase);migrateLoads();migrateMemberReleases();state.nextNode=s.nextNode||1;state.nextMember=s.nextMember||1;state.view=s.view||state.view;state.building=s.building||{stories:0,bays:0,storyHeights:[],bayWidths:[],levels:[],grids:[]};state.layers={members:true,nodes:true,loads:true,supports:true,labels:true,...(s.layers||{})};state.designSetup=s.designSetup||{steelCode:'AISC 360-22',rcCode:'ACI CODE-318-25',steelMethod:'LRFD',rcMethod:'Strength Design',designCombination:'ENVELOPE'};state.model3d=s.model3d||{nodes:[],members:[],nextNode:1,nextMember:1,view:{yaw:-35,pitch:24,scale:34}};state.selected=null;state.multiSelectedMemberIds=new Set();state.boxSelect=null;state.memberStart=null;state.results=null;state.resultsByAnalysis=new Map();syncLoadedLoadPresentationV1252(!!options.forceLoadsVisible);setResultView('model',false);updateResultModeButtons();render();updateUI();renderResults();refreshLayoutAfterLoad();}
function undo(){if(!undoStack.length)return;redoStack.push(cloneModel());restore(undoStack.pop());}
function redo(){if(!redoStack.length)return;undoStack.push(cloneModel());restore(redoStack.pop());}
function updateButtons(){$('undoBtn').disabled=!undoStack.length;$('redoBtn').disabled=!redoStack.length;}
function resize(){const r=canvas.getBoundingClientRect();dpr=Math.max(1,devicePixelRatio||1);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0); if(!state.view.oy || state.view.oy>r.height+200)state.view.oy=r.height-70; render();}
const worldToScreen=(x,y)=>({x:state.view.ox+x*state.view.scale,y:state.view.oy-y*state.view.scale});
const screenToWorld=(x,y)=>({x:(x-state.view.ox)/state.view.scale,y:(state.view.oy-y)/state.view.scale});
function pointerPos(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function snap(v){const g=Math.max(.1,Number($('gridSize').value)||1);return $('snapToggle').checked?Math.round(v/g)*g:v;}
function snapPoint(p){return{x:snap(p.x),y:snap(p.y)}}
function nodeAt(sx,sy,tol=10){let best=null,bd=tol;for(const n of state.nodes){const p=worldToScreen(n.x,n.y),d=Math.hypot(p.x-sx,p.y-sy);if(d<bd){best=n;bd=d}}return best}
function distSeg(px,py,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=px-a.x,wy=py-a.y,c1=vx*wx+vy*wy;if(c1<=0)return Math.hypot(px-a.x,py-a.y);const c2=vx*vx+vy*vy;if(c2<=c1)return Math.hypot(px-b.x,py-b.y);const t=c1/c2;return Math.hypot(px-(a.x+t*vx),py-(a.y+t*vy));}
function memberAt(sx,sy,tol=7){for(let i=state.members.length-1;i>=0;i--){const m=state.members[i],ni=state.nodes.find(n=>n.id===m.i),nj=state.nodes.find(n=>n.id===m.j);if(!ni||!nj)continue;const a=worldToScreen(ni.x,ni.y),b=worldToScreen(nj.x,nj.y);if(distSeg(sx,sy,a,b)<tol)return m}return null}

function selectedMemberIds(){
 const ids=new Set(state.multiSelectedMemberIds||[]);
 if(state.selected?.type==='member')ids.add(state.selected.id);
 return [...ids].filter(id=>state.members.some(m=>m.id===id));
}
function clearMemberSelection(){state.multiSelectedMemberIds=new Set();if(state.selected?.type==='member')state.selected=null;}
function setSingleMemberSelection(id){state.multiSelectedMemberIds=new Set([id]);state.selected={type:'member',id};}
function memberOrientation(m){const a=state.nodes.find(n=>n.id===m.i),b=state.nodes.find(n=>n.id===m.j);if(!a||!b)return'other';const dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);return dx>=dy*2?'beam':dy>=dx*2?'column':'brace'}
function memberMidpoint(m){const a=state.nodes.find(n=>n.id===m.i),b=state.nodes.find(n=>n.id===m.j);return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:null}
function selectMembers(ids,append=false){if(!append)state.multiSelectedMemberIds=new Set();for(const id of ids.map(Number).filter(Number.isFinite))state.multiSelectedMemberIds.add(id);const arr=[...state.multiSelectedMemberIds];state.selected=arr.length?{type:'member',id:arr[arr.length-1]}:null;updateUI();render();}
function focusMembers(ids){
 const set=new Set((ids||[]).map(Number));
 const nodes=state.nodes.filter(n=>state.members.some(m=>set.has(m.id)&&(m.i===n.id||m.j===n.id)));
 if(!nodes.length)return;
 const r=canvas.getBoundingClientRect(),xs=nodes.map(n=>n.x),ys=nodes.map(n=>n.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),dx=Math.max(2,maxx-minx),dy=Math.max(2,maxy-miny);
 state.view.scale=Math.max(20,Math.min(120,Math.min((r.width-180)/dx,(r.height-180)/dy)));
 state.view.ox=90-minx*state.view.scale;
 state.view.oy=r.height-90+miny*state.view.scale;
 render();
}
function showStorySelection(story,ids){
 let el=document.getElementById('storySelectionNotice');
 if(!el){el=document.createElement('div');el.id='storySelectionNotice';el.className='story-selection-notice';document.querySelector('.canvas-shell')?.appendChild(el)}
 el.innerHTML=`<b>Story ${story} selected</b><span>${ids.length} Members: ${ids.map(id=>'M'+id).join(', ')}</span>`;
 el.hidden=false;
 clearTimeout(showStorySelection.timer);showStorySelection.timer=setTimeout(()=>{if(el)el.hidden=true},7000);
}
// ===== V1.26.2 Fix Section Orientation / Rotate 90° =====
function sectionOrientationV126(m){return Number(m?.sectionOrientation)===90?90:0}
function orientedSectionPropsV126(m,sec){
 const o=sectionOrientationV126(m),baseI=Number(sec?.I||m?.I||0),baseIy=Number(sec?.Iy||m?.Iy||0);
 const I=o===90?(baseIy>0?baseIy:baseI):baseI;
 const Iy=o===90?baseI:(baseIy>0?baseIy:baseI);
 const d={...(sec?.dimensions||{})};
 if(o===90){
  if(Number(d.b)>0&&Number(d.h)>0)[d.b,d.h]=[d.h,d.b];
  if(Number(d.bf)>0&&Number(d.h)>0){const oldH=d.h;d.h=d.bf;d.bf=oldH}
 }
 return{orientation:o,I,Iy,dimensions:d,A:Number(sec?.A||m?.A||0),J:Number(sec?.J||m?.J||0),rx:I>0&&Number(sec?.A||m?.A||0)>0?Math.sqrt(I/Number(sec?.A||m?.A||0)):0,ry:Iy>0&&Number(sec?.A||m?.A||0)>0?Math.sqrt(Iy/Number(sec?.A||m?.A||0)):0};
}
function applySectionOrientationV126(ids,orientation){
 const o=Number(orientation)===90?90:0,valid=[...new Set(ids)].filter(id=>state.members.some(m=>m.id===id));if(!valid.length)return 0;
 pushHistory();invalidate();for(const id of valid){const m=state.members.find(x=>x.id===id),sec=state.sections.find(x=>x.id===m.sectionId)||{};m.sectionOrientation=o;const op=orientedSectionPropsV126(m,sec);m.I=op.I;m.Iy=op.Iy}
 state.multiSelectedMemberIds=new Set(valid);state.selected={type:'member',id:valid[valid.length-1]};updateUI();render();toast(`Section Orientation ${o}° applied to ${valid.length} Member(s)`);return valid.length;
}
function applyPropertyToMembers(ids,sectionId,materialId){
 const sec=state.sections.find(x=>x.id===sectionId);
 const mat=state.materials.find(x=>x.id===materialId)||state.materials.find(x=>x.id===sec?.materialId);
 const validIds=[...new Set(ids)].filter(id=>state.members.some(m=>m.id===id));
 if(!validIds.length)return toast('ກະລຸນາເລືອກ Member');
 if(!sec||!mat)return alert('Material / Section ບໍ່ຖືກຕ້ອງ');
 if(!(Number(mat.E)>0&&Number(sec.A)>0&&Number(sec.I)>0))return alert('E, A ແລະ I ຕ້ອງຫຼາຍກວ່າ 0');
 pushHistory();invalidate();
 let changed=0;
 for(const id of validIds){
  const m=state.members.find(x=>x.id===id);if(!m)continue;
  m.sectionId=sec.id;m.materialId=mat.id;
  m.E=Number(mat.E);m.A=Number(sec.A);m.sectionOrientation=sectionOrientationV126(m);
  const op=orientedSectionPropsV126(m,sec);m.I=op.I;m.Iy=op.Iy;
  m.J=Number(sec.J||0);m.weight=Number(sec.weight||0);
  changed++;
 }
 // Keep the selection and make the right-side property panel reflect the real model values.
 state.multiSelectedMemberIds=new Set(validIds);
 state.selected={type:'member',id:validIds[validIds.length-1]};
 if($('materialSelect'))$('materialSelect').value=mat.id;
 if($('sectionSelect'))$('sectionSelect').value=sec.id;
 if($('E'))$('E').value=mat.E;if($('A'))$('A').value=sec.A;if($('I'))$('I').value=sec.I;
 updateEngineeringSelectors();
 if($('materialSelect'))$('materialSelect').value=mat.id;
 if($('sectionSelect'))$('sectionSelect').value=sec.id;
 if($('E'))$('E').value=mat.E;if($('A'))$('A').value=sec.A;if($('I'))$('I').value=sec.I;
 updateUI();render();
 toast(`Applied ${mat.name} + ${sec.name} to ${changed} Members`);
 return changed;
}
function assignmentDialog(){
 const wrap=document.createElement('div');wrap.className='eng-dialog assign-modal';wrap.innerHTML=`<div class="eng-card assign-card"><div class="section-db-head"><div><h2>Assign & Select — V1.8</h2><small>ເລືອກ Member ຫຼາຍຕົວ ແລະ Assign Material / Section ພ້ອມກັນ</small></div><button class="ml-close" id="assignClose">×</button></div><div id="assignBody"></div></div>`;document.body.appendChild(wrap);wrap.querySelector('#assignClose').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};const body=wrap.querySelector('#assignBody');
 const levels=[...new Set(state.nodes.map(n=>n.y))].sort((a,b)=>a-b);
 const renderBody=()=>{const ids=selectedMemberIds();const groups={};for(const m of state.members){const key=`${m.materialId||'-'}|${m.sectionId||'-'}`;(groups[key]??=[]).push(m.id)}body.innerHTML=`
 <div class="assign-summary"><b>Selected: ${ids.length} Members</b><span>${ids.length?ids.map(x=>'M'+x).join(', '):'—'}</span></div>
 <div class="assign-grid"><section><h3>Select Members</h3><div class="assign-actions"><button data-select="all">All</button><button data-select="beam">Beams</button><button data-select="column">Columns</button><button data-select="brace">Braces</button><button data-select="similar">Select Similar</button><button data-select="clear" class="secondary">Clear</button></div>
 <label>Story / Elevation<select id="storySelect"><option value="">Choose level…</option>${levels.map((y,i)=>`<option value="${y}">Level ${i+1}: Y=${y} m</option>`).join('')}</select></label><button id="selectStory">Select members at level</button>
 <h3>Property Groups</h3><div class="property-groups">${Object.entries(groups).map(([k,v])=>{const [mat,sec]=k.split('|');const sn=state.sections.find(x=>x.id===sec)?.name||sec;const mn=state.materials.find(x=>x.id===mat)?.name||mat;return`<button data-group="${k}"><b>${sn}</b><span>${mn}</span><small>${v.length} Members</small></button>`}).join('')||'<div class="empty">No members</div>'}</div></section>
 <section><h3>Assign Properties</h3><label>Material<select id="assignMaterial">${state.materials.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></label><label>Section<select id="assignSection">${state.sections.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></label><label>Section Orientation<select id="assignOrientation"><option value="0">0° — Default</option><option value="90">90° — Rotate Section</option></select></label><div class="assign-preview" id="assignPreview"></div><button class="primary" id="assignApply">Apply to Selected (${ids.length})</button><p class="assign-tip">Tip: Shift/Cmd + click ເພື່ອເລືອກຫຼາຍ Member. ລາກກອບພື້ນທີ່ວ່າງເພື່ອ Box Select.</p></section></div>`;
 const mat=body.querySelector('#assignMaterial'),sec=body.querySelector('#assignSection'),ori=body.querySelector('#assignOrientation'),preview=body.querySelector('#assignPreview');
 const selectedMembers=ids.map(id=>state.members.find(m=>m.id===id)).filter(Boolean);
 const common=(key)=>selectedMembers.length&&selectedMembers.every(m=>m[key]===selectedMembers[0][key])?selectedMembers[0][key]:'';
 const commonSec=common('sectionId'),commonMat=common('materialId'),commonOri=common('sectionOrientation');
 if(commonSec&&state.sections.some(x=>x.id===commonSec))sec.value=commonSec;
 if(commonMat&&state.materials.some(x=>x.id===commonMat))mat.value=commonMat;if(commonOri===90||commonOri===0)ori.value=String(commonOri);
 const updatePreview=()=>{const x=state.sections.find(q=>q.id===sec.value),mm=state.materials.find(q=>q.id===mat.value);if(x&&mm){const o=Number(ori.value)===90?90:0,I=o===90?Number(x.Iy||x.I):Number(x.I);preview.innerHTML=`<b>${mm.name} + ${x.name}</b><span>Orientation=${o}°</span><span>E=${Number(mm.E).toExponential(3)} kN/m²</span><span>A=${Number(x.A).toExponential(3)} m²</span><span>I(active)=${Number(I).toExponential(3)} m⁴</span>`}};
 sec.onchange=()=>{const x=state.sections.find(q=>q.id===sec.value);if(x&&state.materials.some(m=>m.id===x.materialId))mat.value=x.materialId;updatePreview()};mat.onchange=updatePreview;ori.onchange=updatePreview;updatePreview();
 body.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{const mode=b.dataset.select;if(mode==='clear')selectMembers([]);else if(mode==='all')selectMembers(state.members.map(m=>m.id));else if(mode==='similar'){const base=state.members.find(m=>m.id===state.selected?.id);if(!base)return toast('ເລືອກ Member ຕົວຢ່າງກ່ອນ');selectMembers(state.members.filter(m=>m.sectionId===base.sectionId&&m.materialId===base.materialId).map(m=>m.id));}else selectMembers(state.members.filter(m=>memberOrientation(m)===mode).map(m=>m.id));renderBody()});
 body.querySelector('#selectStory').onclick=()=>{const y=Number(body.querySelector('#storySelect').value);if(!Number.isFinite(y))return;const tol=.001;selectMembers(state.members.filter(m=>{const a=state.nodes.find(n=>n.id===m.i),b=state.nodes.find(n=>n.id===m.j);return a&&b&&(Math.abs(a.y-y)<tol||Math.abs(b.y-y)<tol)}).map(m=>m.id));renderBody()};
 body.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{const [matId,secId]=b.dataset.group.split('|');selectMembers(state.members.filter(m=>m.materialId===matId&&m.sectionId===secId).map(m=>m.id));renderBody()});
 body.querySelector('#assignApply').onclick=()=>{const chosen=[...selectedMemberIds()];const count=applyPropertyToMembers(chosen,sec.value,mat.value);if(count){applySectionOrientationV126(chosen,Number(ori.value));renderBody()}};
 };renderBody();
}

function releaseLabel(m){const i=m.releases?.i?.mz?'Pin':'Fixed',j=m.releases?.j?.mz?'Pin':'Fixed';return `i-End: ${i} • j-End: ${j}`}
function memberReleaseDialog(){
 const ids=selectedMemberIds();if(!ids.length)return toast('ກະລຸນາເລືອກ Member ກ່ອນ');
 const members=ids.map(id=>state.members.find(m=>m.id===id)).filter(Boolean),base=members[0];
 const wrap=document.createElement('div');wrap.className='eng-dialog';wrap.innerHTML=`<div class="eng-card release-card"><h2>Member Release & Internal Hinge</h2><p><b>${members.length}</b> Member(s): ${members.map(m=>'M'+m.id).join(', ')}</p><div class="release-grid"><section><h3>End Releases</h3><label class="check-row"><input id="relI" type="checkbox" ${base.releases?.i?.mz?'checked':''}> Release Moment Mz at i-End (Pin)</label><label class="check-row"><input id="relJ" type="checkbox" ${base.releases?.j?.mz?'checked':''}> Release Moment Mz at j-End (Pin)</label><small>Axial and shear remain connected. Moment at a released end will be approximately zero.</small><button id="applyRelease" class="primary">Apply to Selected</button><button id="clearRelease">Set Both Ends Fixed</button></section><section><h3>Internal Hinge</h3><label>Location from i-End (% of L)<input id="hingeRatio" type="number" min="1" max="99" step="1" value="50"></label><button id="addHinge">◇ Split Member + Add Hinge</button><small>Works on one selected member without member loads. The member is split into two members and both new ends at the hinge release Mz.</small></section></div><div class="eng-actions"><button id="releaseClose" class="secondary">Close</button></div></div>`;document.body.appendChild(wrap);
 const close=()=>wrap.remove();wrap.querySelector('#releaseClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
 wrap.querySelector('#applyRelease').onclick=()=>{pushHistory();invalidate();for(const m of members){m.releases=m.releases||{i:{},j:{}};m.releases.i={mz:wrap.querySelector('#relI').checked};m.releases.j={mz:wrap.querySelector('#relJ').checked}}render();updateUI();toast(`Applied releases to ${members.length} Member(s)`);close()};
 wrap.querySelector('#clearRelease').onclick=()=>{pushHistory();invalidate();for(const m of members)m.releases={i:{mz:false},j:{mz:false}};render();updateUI();toast('Set selected members to Fixed-Fixed');close()};
 wrap.querySelector('#addHinge').onclick=()=>{if(members.length!==1)return alert('Select exactly one Member for Internal Hinge');const m=members[0];if(Object.values(m.loads||{}).some(a=>Array.isArray(a)&&a.length))return alert('This member has Member Loads. Remove or reassign loads before splitting.');const ratio=Number(wrap.querySelector('#hingeRatio').value)/100;if(!(ratio>0&&ratio<1))return alert('Hinge location must be between 1% and 99%');const ni=state.nodes.find(n=>n.id===m.i),nj=state.nodes.find(n=>n.id===m.j);if(!ni||!nj)return;pushHistory();invalidate();const newNode={id:state.nextNode++,x:ni.x+(nj.x-ni.x)*ratio,y:ni.y+(nj.y-ni.y)*ratio,support:'none',internalHinge:true,loads:{}};for(const c of state.loadCases)newNode.loads[c.id]=emptyLoad();state.nodes.push(newNode);const common={E:m.E,A:m.A,I:m.I,materialId:m.materialId,sectionId:m.sectionId,loads:{}};for(const c of state.loadCases)common.loads[c.id]=[];const m1={...JSON.parse(JSON.stringify(common)),id:m.id,i:m.i,j:newNode.id,releases:{i:{mz:!!m.releases?.i?.mz},j:{mz:true}}};const m2={...JSON.parse(JSON.stringify(common)),id:state.nextMember++,i:newNode.id,j:m.j,releases:{i:{mz:true},j:{mz:!!m.releases?.j?.mz}}};state.members=state.members.filter(x=>x.id!==m.id);state.members.push(m1,m2);setSingleMemberSelection(m2.id);render();updateUI();toast(`Internal hinge added at ${(ratio*100).toFixed(0)}% of M${m.id}`);close()};
}
function setTool(t){state.tool=t;state.memberStart=null;

// V1.18 — Load Assignment & Management
function allLoadRowsV118(){
 const rows=[];
 for(const n of state.nodes) for(const c of state.loadCases){const l=n.loads?.[c.id];if(l&&(Number(l.fx)||Number(l.fy)||Number(l.mz)))rows.push({kind:'NODE',id:n.id,caseId:c.id,type:'NODE',value:`Fx ${Number(l.fx||0).toFixed(2)}, Fy ${Number(l.fy||0).toFixed(2)}, Mz ${Number(l.mz||0).toFixed(2)}`,source:'MANUAL'});}
 for(const m of state.members) for(const c of state.loadCases) for(const [i,ld] of (m.loads?.[c.id]||[]).entries())rows.push({kind:'MEMBER',id:m.id,caseId:c.id,type:ld.type||'LOAD',value:loadValueLabel(ld),source:ld.source||'MANUAL',index:i,load:ld});
 return rows;
}
function cloneLoadForMemberV118(ld,fromMember,toMember){const c=JSON.parse(JSON.stringify(ld)),L0=memberLength(fromMember)||1,L1=memberLength(toMember)||1,r=L1/L0;if(c.type==='TRAP'){c.a=Math.max(0,Number(c.a||0)*r);c.b=Math.min(L1,Number(c.b??L0)*r)}else if(c.type==='POINT'||c.type==='MOMENT'){if(Number.isFinite(Number(c.x)))c.x=Math.max(0,Math.min(L1,Number(c.x)*r));if(Number.isFinite(Number(c.r)))c.r=Math.max(0,Math.min(1,Number(c.r)))}return c}
function loadManagerV118(){
 const wrap=document.createElement('div');wrap.className='eng-dialog v118-load-manager';
 const cases=state.loadCases.map(c=>`<option value="${c.id}">${c.id} — ${c.name}</option>`).join('');
 wrap.innerHTML=`<div class="eng-card v118-card"><div class="section-db-head"><div><h2>☷ Load Assignment Manager — V1.19</h2><small>Review, filter, copy, assign and clear loads without editing Members one-by-one.</small></div><button class="ml-close" id="v118Close">×</button></div>
 <div class="v118-toolbar"><label>Case<select id="v118Case"><option value="ALL">All Cases</option>${cases}</select></label><label>Show<select id="v118Kind"><option value="ALL">All Loads</option><option value="NODE">Node Loads</option><option value="MEMBER">Member Loads</option><option value="GENERATED">Generated Loads</option><option value="MANUAL">Manual Loads</option></select></label><input id="v118Search" placeholder="Search M7, Node 3, UDL…"><button id="v118Refresh">↻ Refresh</button></div>
 <div class="v118-stats" id="v118Stats"></div><div class="v118-table-wrap"><table class="v118-table"><thead><tr><th></th><th>Object</th><th>Case</th><th>Type</th><th>Value</th><th>Source</th><th>Action</th></tr></thead><tbody id="v118Rows"></tbody></table></div>
 <div class="v118-actions-grid"><section><h3>Multi-Member Assignment</h3><p>Uses the Members selected in the model.</p><label>Load Case<select id="v118AssignCase">${cases}</select></label><label>Type<select id="v118Type"><option value="UDL">UDL</option><option value="POINT">Point Load</option><option value="MOMENT">Moment</option></select></label><label>Direction<select id="v118Dir"><option value="GLOBAL_Y">Global Y</option><option value="GLOBAL_X">Global X</option><option value="LOCAL_Y">Local Y</option></select></label><label>Magnitude<input id="v118Mag" type="number" step="any" value="-5"></label><label>Position / start ratio (0–1)<input id="v118Pos" type="number" min="0" max="1" step="0.05" value="0.5"></label><button class="primary" id="v118Apply">Apply to Selected Members</button></section>
 <section><h3>Copy / Clear</h3><p>Select one source row in the table, then select target Members in the model.</p><button id="v118Copy">Copy Selected Load → Selected Members</button><button id="v118SelectLoaded">Select Loaded Members in Filter</button><button class="danger" id="v118Clear">Clear Loads in Current Filter</button><div class="v111-note" id="v118Feedback">Manual and generated loads remain distinguishable. JSON/Cloud use the existing model load structure.</div></section></div></div>`;
 document.body.appendChild(wrap);const q=id=>wrap.querySelector('#'+id),close=()=>wrap.remove();q('v118Close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};let selectedRow=null;
 const filtered=()=>{const cf=q('v118Case').value,k=q('v118Kind').value,term=q('v118Search').value.trim().toLowerCase();return allLoadRowsV118().filter(r=>{const objectLabel=r.kind==='MEMBER'?`M${r.id}`:`Node ${r.id}`;const aliases=r.kind==='MEMBER'?`member ${r.id} m ${r.id}`:`node ${r.id} n${r.id}`;const hay=`${objectLabel} ${aliases} ${r.kind} ${r.id} ${r.caseId} ${r.type} ${r.value} ${r.source}`.toLowerCase();return (cf==='ALL'||r.caseId===cf)&&(k==='ALL'||(k==='GENERATED'?r.source!=='MANUAL':k==='MANUAL'?r.source==='MANUAL':r.kind===k))&&(!term||hay.includes(term))})};
 function refresh(){const rows=filtered(),all=allLoadRowsV118();q('v118Stats').innerHTML=`<b>${rows.length}</b> shown &nbsp; • &nbsp; <b>${all.filter(r=>r.kind==='NODE').length}</b> node loads &nbsp; • &nbsp; <b>${all.filter(r=>r.kind==='MEMBER').length}</b> member loads &nbsp; • &nbsp; <b>${all.filter(r=>r.source!=='MANUAL').length}</b> generated`;q('v118Rows').innerHTML=rows.length?rows.map((r,i)=>`<tr><td><input type="radio" name="v118pick" data-pick="${i}"></td><td>${r.kind==='MEMBER'?'M':'Node '}${r.id}</td><td>${r.caseId}</td><td>${r.type}</td><td>${r.value}</td><td>${r.source}</td><td><button data-locate="${i}">Locate</button><button class="danger" data-delete="${i}">Delete</button></td></tr>`).join(''):`<tr><td colspan="7">No loads match this filter.</td></tr>`;q('v118Clear').disabled=rows.length===0;q('v118Clear').title=rows.length?'Clear only the loads currently shown by the active filters':'Nothing to clear — adjust the filters or search';q('v118Rows').querySelectorAll('[data-pick]').forEach(x=>x.onchange=()=>selectedRow=rows[+x.dataset.pick]);q('v118Rows').querySelectorAll('[data-locate]').forEach(x=>x.onclick=()=>{const r=rows[+x.dataset.locate];close();requestAnimationFrame(()=>{if(r.kind==='NODE'){focusNodeV114(r.id)}else{setSingleMemberSelection(Number(r.id));focusMembers([Number(r.id)]);updateUI();render()}toast(`Located ${r.kind==='MEMBER'?'Member M':'Node '}${r.id}`)})});q('v118Rows').querySelectorAll('[data-delete]').forEach(x=>x.onclick=()=>{const r=rows[+x.dataset.delete];pushHistory();invalidate();if(r.kind==='NODE')Object.assign(state.nodes.find(n=>n.id===r.id).loads[r.caseId],emptyLoad());else state.members.find(m=>m.id===r.id).loads[r.caseId].splice(r.index,1);render();updateUI();refresh()})}
 ['v118Case','v118Kind'].forEach(id=>q(id).onchange=refresh);q('v118Search').oninput=refresh;q('v118Refresh').onclick=refresh;
 q('v118Apply').onclick=()=>{const ids=selectedMemberIds();if(!ids.length)return alert('Select one or more Members in the model first.');const type=q('v118Type').value,caseId=q('v118AssignCase').value,dir=q('v118Dir').value,mag=Number(q('v118Mag').value),r=Math.max(0,Math.min(1,Number(q('v118Pos').value)||0));if(!Number.isFinite(mag))return alert('Enter a valid magnitude.');pushHistory();invalidate();for(const id of ids){const m=state.members.find(x=>x.id===id),L=memberLength(m);m.loads=m.loads||{};m.loads[caseId]=m.loads[caseId]||[];let ld;if(type==='UDL')ld={type:'TRAP',w1:mag,w2:mag,a:0,b:L,direction:dir,source:'MANUAL'};if(type==='POINT')ld={type:'POINT',P:mag,x:r*L,r,direction:dir,source:'MANUAL'};if(type==='MOMENT')ld={type:'MOMENT',M:mag,x:r*L,r,direction:'LOCAL_Z',source:'MANUAL'};m.loads[caseId].push(ld)}render();updateUI();q('v118Feedback').textContent=`Applied ${type} to ${ids.length} selected Member(s).`;refresh()};
 q('v118Copy').onclick=()=>{if(!selectedRow||selectedRow.kind!=='MEMBER')return alert('Choose one Member Load row first.');const ids=selectedMemberIds().filter(id=>id!==selectedRow.id);if(!ids.length)return alert('Select one or more target Members in the model.');const src=state.members.find(m=>m.id===selectedRow.id);pushHistory();invalidate();for(const id of ids){const m=state.members.find(x=>x.id===id);m.loads=m.loads||{};m.loads[selectedRow.caseId]=m.loads[selectedRow.caseId]||[];m.loads[selectedRow.caseId].push(cloneLoadForMemberV118(selectedRow.load,src,m))}render();updateUI();q('v118Feedback').textContent=`Copied load from M${src.id} to ${ids.length} Member(s).`;refresh()};
 q('v118SelectLoaded').onclick=()=>{const ids=[...new Set(filtered().filter(r=>r.kind==='MEMBER').map(r=>r.id))];if(!ids.length)return alert('No loaded Members in this filter.');if(typeof setMultiMemberSelection==='function')setMultiMemberSelection(ids);else{state.selected={type:'members',ids}}updateUI();render();q('v118Feedback').textContent=`Selected ${ids.length} loaded Member(s).`};
 q('v118Clear').onclick=()=>{const rows=filtered();if(!rows.length){q('v118Feedback').textContent='Nothing to clear. Adjust the filters or search first.';return}if(!confirm(`Clear ${rows.length} load assignment(s) in the current filter?`))return;pushHistory();invalidate();for(const r of [...rows].reverse()){if(r.kind==='NODE')Object.assign(state.nodes.find(n=>n.id===r.id).loads[r.caseId],emptyLoad());else{const a=state.members.find(m=>m.id===r.id).loads[r.caseId];const idx=a.indexOf(r.load);if(idx>=0)a.splice(idx,1)}}render();updateUI();selectedRow=null;refresh()};refresh();
}

document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));const names={select:'ເລືອກ',pan:'ເລື່ອນ',node:'ເພີ່ມ Node',member:'ເພີ່ມ Member',support:'ກຳນົດ Support',load:'ແຮງ Node Fx/Fy/Mz',memberLoad:'ແຮງເທິງ Member'};$('modeLabel').textContent='ໂໝດ: '+names[t];canvas.style.cursor=t==='pan'?'grab':t==='select'?'default':'crosshair';render();}
function invalidate(){state.results=null;state.resultsByAnalysis.clear();setResultView('model',false);updateResultModeButtons();renderResults();$('statusText').textContent='ໂມເດວຖືກແກ້ໄຂ — ກະລຸນາວິເຄາະໃໝ່';}
function emptyLoad(){return{fx:0,fy:0,mz:0}}
function migrateLoads(){for(const n of state.nodes){if(!n.loads)n.loads={[state.activeLoadCase]:n.load||emptyLoad()};if(!n.loads[state.activeLoadCase])n.loads[state.activeLoadCase]=emptyLoad();n.load=n.loads[state.activeLoadCase]}migrateMemberLoads()}
function migrateMemberLoads(){for(const m of state.members){if(!m.loads)m.loads={};for(const c of state.loadCases)if(!Array.isArray(m.loads[c.id]))m.loads[c.id]=[]}}
function migrateMemberReleases(){for(const m of state.members){if(!m.releases)m.releases={i:{mz:false},j:{mz:false}};m.releases.i=m.releases.i||{mz:false};m.releases.j=m.releases.j||{mz:false};m.releases.i.mz=!!m.releases.i.mz;m.releases.j.mz=!!m.releases.j.mz}}
function activeMemberLoads(m){if(!m.loads)m.loads={};if(!Array.isArray(m.loads[state.activeLoadCase]))m.loads[state.activeLoadCase]=[];return m.loads[state.activeLoadCase]}
function activeNodeLoad(n){if(!n.loads)n.loads={[state.activeLoadCase]:n.load||emptyLoad()};if(!n.loads[state.activeLoadCase])n.loads[state.activeLoadCase]=emptyLoad();n.load=n.loads[state.activeLoadCase];return n.load}
function syncActiveLoads(){for(const n of state.nodes)n.load=activeNodeLoad(n)}
function updateEngineeringSelectors(){const ms=$('materialSelect'),ss=$('sectionSelect'),lc=$('activeLoadCase');if(!ms||!ss||!lc)return;const oldM=ms.value,oldS=ss.value;ms.innerHTML=state.materials.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');ss.innerHTML=state.sections.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');lc.innerHTML=state.loadCases.map(x=>`<option value="${x.id}">${x.id} — ${x.name}</option>`).join('');lc.value=state.activeLoadCase;const ar=$('analysisResultSelect');if(ar){ar.innerHTML=state.loadCases.map(x=>`<option value="CASE:${x.id}">Case: ${x.id} — ${x.name}</option>`).join('')+state.loadCombinations.map(x=>`<option value="COMB:${x.id}">Combination: ${x.name}</option>`).join('');if(![...ar.options].some(o=>o.value===state.activeAnalysis))state.activeAnalysis='CASE:'+state.activeLoadCase;ar.value=state.activeAnalysis;}if(state.materials.some(x=>x.id===oldM))ms.value=oldM;if(state.sections.some(x=>x.id===oldS))ss.value=oldS;const sec=state.sections.find(x=>x.id===ss.value)||state.sections[0];if(sec){ss.value=sec.id;ms.value=sec.materialId;applySectionInputs(sec,false)}}
function applySectionInputs(sec,show=true){if(!sec)return;const mat=state.materials.find(x=>x.id===sec.materialId);if(mat)$('E').value=mat.E;$('A').value=sec.A;$('I').value=sec.I;if(show)toast('ນຳຄ່າ Section ເຂົ້າແບບຟອມແລ້ວ')}
function engineeringDialog(kind){const wrap=document.createElement('div');wrap.className='eng-dialog';const isMat=kind==='materials';wrap.innerHTML=`<div class="eng-card"><h2>${isMat?'Material Library':'Section Library'}</h2><div id="engBody"></div><div class="eng-actions"><button class="secondary" id="engClose">ປິດ</button></div></div>`;document.body.appendChild(wrap);wrap.querySelector('#engClose').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};const body=wrap.querySelector('#engBody');const renderList=()=>{if(isMat){body.innerHTML=`<table><tr><th>ID</th><th>Name</th><th>Type</th><th>E (kN/m²)</th><th></th></tr>${state.materials.map((x,i)=>`<tr><td>${x.id}</td><td>${x.name}</td><td>${x.type}</td><td>${x.E}</td><td><button class="danger" data-del="${i}">ລຶບ</button></td></tr>`).join('')}</table><div class="eng-form"><input id="mId" placeholder="ID"><input id="mName" placeholder="Name"><select id="mType"><option>Concrete</option><option>Steel</option><option>Custom</option></select><input id="mE" type="number" placeholder="E kN/m²"></div><button id="mAdd">＋ Add Material</button><button id="mExport" class="secondary">Export Material Library</button><label class="file-label">Import Materials<input id="mImport" type="file" accept="application/json" hidden></label>`;body.querySelector('#mAdd').onclick=()=>{const id=body.querySelector('#mId').value.trim(),name=body.querySelector('#mName').value.trim(),E=Number(body.querySelector('#mE').value);if(!id||!name||!(E>0))return alert('ກະລຸນາໃສ່ ID, Name ແລະ E');if(state.materials.some(x=>x.id===id))return alert('ID ຊ້ຳ');state.materials.push({id,name,type:body.querySelector('#mType').value,E,fy:0,fc:0});persistLibraries();updateEngineeringSelectors();renderList()};body.querySelector('#mExport').onclick=()=>{const a=document.createElement('a'),blob=new Blob([JSON.stringify({version:'1.18.2-fix',materials:state.materials},null,2)],{type:'application/json'});a.href=URL.createObjectURL(blob);a.download='sapudom-material-library-v1.9.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};body.querySelector('#mImport').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result),arr=Array.isArray(d)?d:d.materials;if(!Array.isArray(arr))throw 0;state.materials=mergeUniqueById(state.materials,arr.filter(x=>x.id&&x.name&&Number(x.E)>0));persistLibraries();updateEngineeringSelectors();renderList();toast('Imported material library')}catch{alert('Invalid material library')}};r.readAsText(f)}}else{body.innerHTML=`<table><tr><th>ID</th><th>Name</th><th>Material</th><th>A</th><th>I</th><th></th></tr>${state.sections.map((x,i)=>`<tr><td>${x.id}</td><td>${x.name}</td><td>${x.materialId}</td><td>${x.A}</td><td>${x.I}</td><td><button class="danger" data-del="${i}">ລຶບ</button></td></tr>`).join('')}</table><div class="eng-form"><input id="sId" placeholder="ID"><input id="sName" placeholder="Name"><select id="sMat">${state.materials.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select><select id="sType"><option>RC Rectangular</option><option>Steel I</option><option>Custom</option></select><input id="sA" type="number" step="0.0001" placeholder="A m²"><input id="sI" type="number" step="0.000001" placeholder="I m⁴"></div><button id="sAdd">＋ Add Section</button>`;body.querySelector('#sAdd').onclick=()=>{const id=body.querySelector('#sId').value.trim(),name=body.querySelector('#sName').value.trim(),A=Number(body.querySelector('#sA').value),I=Number(body.querySelector('#sI').value);if(!id||!name||!(A>0)||!(I>0))return alert('ກະລຸນາໃສ່ ID, Name, A ແລະ I');if(state.sections.some(x=>x.id===id))return alert('ID ຊ້ຳ');state.sections.push({id,name,type:body.querySelector('#sType').value,materialId:body.querySelector('#sMat').value,A,I});persistLibraries();updateEngineeringSelectors();renderList()}}body.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const list=isMat?state.materials:state.sections;if(list.length<=1)return alert('ຕ້ອງເຫຼືອຢ່າງນ້ອຍ 1 ລາຍການ');list.splice(Number(b.dataset.del),1);persistLibraries();updateEngineeringSelectors();renderList()})};renderList()}
function loadCaseDialog(){const wrap=document.createElement('div');wrap.className='eng-dialog';wrap.innerHTML=`<div class="eng-card"><h2>Load Case Manager</h2><div id="caseBody"></div><div class="eng-actions"><button class="secondary" id="caseClose">ປິດ</button></div></div>`;document.body.appendChild(wrap);wrap.querySelector('#caseClose').onclick=()=>wrap.remove();const body=wrap.querySelector('#caseBody');const renderList=()=>{body.innerHTML=`<table><tr><th>ID</th><th>Name</th><th>Type</th><th></th></tr>${state.loadCases.map((x,i)=>`<tr><td><span class="load-case-badge">${x.id}</span></td><td>${x.name}</td><td>${x.type}</td><td><button class="danger" data-del="${i}">ລຶບ</button></td></tr>`).join('')}</table><div class="eng-form"><input id="lcId" placeholder="ID: WL"><input id="lcName" placeholder="Name"><select id="lcType"><option>Dead</option><option>Live</option><option>Wind</option><option>Earthquake</option><option>Other</option></select></div><button id="lcAdd">＋ Add Load Case</button>`;body.querySelector('#lcAdd').onclick=()=>{const id=body.querySelector('#lcId').value.trim().toUpperCase(),name=body.querySelector('#lcName').value.trim();if(!id||!name)return alert('ກະລຸນາໃສ່ ID ແລະ Name');if(state.loadCases.some(x=>x.id===id))return alert('ID ຊ້ຳ');state.loadCases.push({id,name,type:body.querySelector('#lcType').value});for(const n of state.nodes){if(!n.loads)n.loads={};n.loads[id]=emptyLoad()}for(const m of state.members){if(!m.loads)m.loads={};m.loads[id]=[]}updateEngineeringSelectors();renderList()};body.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(state.loadCases.length<=1)return alert('ຕ້ອງເຫຼືອ 1 Load Case');const i=Number(b.dataset.del),id=state.loadCases[i].id;state.loadCases.splice(i,1);for(const n of state.nodes)if(n.loads)delete n.loads[id];for(const m of state.members)if(m.loads)delete m.loads[id];if(state.activeLoadCase===id)state.activeLoadCase=state.loadCases[0].id;syncActiveLoads();updateEngineeringSelectors();invalidate();renderList()})};renderList()}
function addNode(x,y){if(state.nodes.some(n=>Math.hypot(n.x-x,n.y-y)<1e-6)){toast('ມີ Node ຢູ່ຈຸດນີ້ແລ້ວ');return null}pushHistory();invalidate();const n={id:state.nextNode++,x,y,support:'none',loads:{[state.activeLoadCase]:emptyLoad()}};n.load=n.loads[state.activeLoadCase];state.nodes.push(n);state.selected={type:'node',id:n.id};updateUI();render();return n}
function addMember(i,j){if(i===j)return;if(state.members.some(m=>(m.i===i&&m.j===j)||(m.i===j&&m.j===i))){toast('Member ນີ້ມີແລ້ວ');return}pushHistory();invalidate();const sec=state.sections.find(x=>x.id===$('sectionSelect').value);const mat=state.materials.find(x=>x.id===$('materialSelect').value);const m={id:state.nextMember++,i,j,E:+$('E').value,A:+$('A').value,I:+$('I').value,Iy:+(sec?.Iy||0),sectionOrientation:0,materialId:mat?.id||'',sectionId:sec?.id||'',releases:{i:{mz:false},j:{mz:false}}};state.members.push(m);state.selected={type:'member',id:m.id};state.memberStart=null;updateUI();render();}
function deleteSelected(){if(!state.selected&&!selectedMemberIds().length)return;pushHistory();invalidate();if(state.selected?.type==='node'){const id=state.selected.id;state.nodes=state.nodes.filter(n=>n.id!==id);state.members=state.members.filter(m=>m.i!==id&&m.j!==id)}else{const ids=new Set(selectedMemberIds());state.members=state.members.filter(m=>!ids.has(m.id))}state.selected=null;state.multiSelectedMemberIds=new Set();updateUI();render();}
function cycleSupport(n){const a=['none','fixed','pin','roller'];n.support=a[(a.indexOf(n.support)+1)%a.length]}
function onDown(e){canvas.setPointerCapture?.(e.pointerId);const p=pointerPos(e);if(e.button===1||e.button===2||state.tool==='pan'||e.code==='Space'){state.panning={x:p.x,y:p.y,ox:state.view.ox,oy:state.view.oy};return}
 const n=nodeAt(p.x,p.y),m=memberAt(p.x,p.y);
 if(state.tool==='node'){const w=snapPoint(screenToWorld(p.x,p.y));addNode(w.x,w.y);return}
 if(state.tool==='member'){if(!n){toast('ກະລຸນາຄລິກທີ່ Node');return}if(!state.memberStart){state.memberStart=n.id;state.selected={type:'node',id:n.id};toast('ເລືອກ Node ທີສອງ');render()}else addMember(state.memberStart,n.id);return}
 if(state.tool==='support'){if(!n){toast('ກະລຸນາຄລິກ Node');return}pushHistory();invalidate();cycleSupport(n);state.selected={type:'node',id:n.id};updateUI();render();return}
 if(state.tool==='load'){if(!n){toast('ກະລຸນາຄລິກ Node');return}const l=activeNodeLoad(n);const val=prompt('Node Load: Fx, Fy, Mz  (kN, kN, kN·m)\nຕົວຢ່າງ: 20,-50,10', `${l.fx||0},${l.fy||0},${l.mz||0}`);if(val!==null){const a=val.split(',').map(Number);if(a.length!==3||a.some(Number.isNaN))return alert('ຮູບແບບບໍ່ຖືກ: Fx,Fy,Mz');pushHistory();invalidate();Object.assign(l,{fx:a[0],fy:a[1],mz:a[2]});state.selected={type:'node',id:n.id};updateUI();render()}return}
 if(state.tool==='memberLoad'){if(!m){toast('ກະລຸນາຄລິກ Member');return}editMemberLoads(m);return}
 if(state.tool==='select'){if(n){state.multiSelectedMemberIds=new Set();state.selected={type:'node',id:n.id};state.dragging={id:n.id,start:cloneModel()};}else if(m){if(e.shiftKey||e.metaKey||e.ctrlKey){if(state.multiSelectedMemberIds.has(m.id))state.multiSelectedMemberIds.delete(m.id);else state.multiSelectedMemberIds.add(m.id);const arr=[...state.multiSelectedMemberIds];state.selected=arr.length?{type:'member',id:arr[arr.length-1]}:null;}else setSingleMemberSelection(m.id)}else{state.selected=null;state.multiSelectedMemberIds=new Set();state.boxSelect={x1:p.x,y1:p.y,x2:p.x,y2:p.y,append:e.shiftKey||e.metaKey||e.ctrlKey};}updateUI();render()}}
function onMove(e){const p=pointerPos(e),w=screenToWorld(p.x,p.y);$('coords').textContent=`X: ${w.x.toFixed(2)}, Y: ${w.y.toFixed(2)} m`;if(state.panning){state.view.ox=state.panning.ox+(p.x-state.panning.x);state.view.oy=state.panning.oy+(p.y-state.panning.y);render();return}if(state.dragging){const n=state.nodes.find(x=>x.id===state.dragging.id),q=snapPoint(w);n.x=q.x;n.y=q.y;state.results=null;render();updateUI();return}if(state.boxSelect){state.boxSelect.x2=p.x;state.boxSelect.y2=p.y;render(p);return}state.hover=nodeAt(p.x,p.y)?.id||null;render(p)}
function onUp(){if(state.dragging){undoStack.push(state.dragging.start);redoStack=[];state.dragging=null;updateButtons()}if(state.boxSelect){const b=state.boxSelect,minx=Math.min(b.x1,b.x2),maxx=Math.max(b.x1,b.x2),miny=Math.min(b.y1,b.y2),maxy=Math.max(b.y1,b.y2),ids=state.members.filter(m=>{const p=memberMidpoint(m);if(!p)return false;const q=worldToScreen(p.x,p.y);return q.x>=minx&&q.x<=maxx&&q.y>=miny&&q.y<=maxy}).map(m=>m.id);selectMembers(ids,b.append);state.boxSelect=null;}state.panning=null}
function onWheel(e){e.preventDefault();const p=pointerPos(e),before=screenToWorld(p.x,p.y),factor=e.deltaY<0?1.12:1/1.12;state.view.scale=Math.min(250,Math.max(15,state.view.scale*factor));state.view.ox=p.x-before.x*state.view.scale;state.view.oy=p.y+before.y*state.view.scale;render()}
function drawGrid(w,h){if(!$('gridToggle').checked)return;const g=Math.max(.1,Number($('gridSize').value)||1),step=g*state.view.scale;if(step<8)return;ctx.save();ctx.strokeStyle='#e8edf4';ctx.lineWidth=1;let x=((state.view.ox%step)+step)%step;for(;x<w;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}let y=((state.view.oy%step)+step)%step;for(;y<h;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}ctx.restore()}
function drawSupport(n,p){ctx.save();ctx.strokeStyle='#0a356d';ctx.fillStyle='#fff';ctx.lineWidth=2;if(n.support==='fixed'){ctx.beginPath();ctx.moveTo(p.x-12,p.y+8);ctx.lineTo(p.x+12,p.y+8);ctx.stroke();for(let x=-10;x<=10;x+=5){ctx.beginPath();ctx.moveTo(p.x+x,p.y+8);ctx.lineTo(p.x+x-4,p.y+14);ctx.stroke()}}else if(n.support==='pin'||n.support==='roller'){ctx.beginPath();ctx.moveTo(p.x,p.y+4);ctx.lineTo(p.x-10,p.y+18);ctx.lineTo(p.x+10,p.y+18);ctx.closePath();ctx.stroke();if(n.support==='roller'){ctx.beginPath();ctx.arc(p.x-5,p.y+22,3,0,Math.PI*2);ctx.arc(p.x+5,p.y+22,3,0,Math.PI*2);ctx.stroke()}}ctx.restore()}
function arrow(x1,y1,x2,y2,color='#e1261c'){ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();const a=Math.atan2(y2-y1,x2-x1),h=8;ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-h*Math.cos(a-.45),y2-h*Math.sin(a-.45));ctx.lineTo(x2-h*Math.cos(a+.45),y2-h*Math.sin(a+.45));ctx.closePath();ctx.fill();ctx.restore()}
function drawLoad(n,p){const l=n.load||emptyLoad();ctx.save();ctx.fillStyle='#e1261c';ctx.font='12px Arial';if(l.fy){const up=l.fy>0,tailY=p.y+(up?36:-36);arrow(p.x,tailY,p.x,p.y);ctx.fillText(`Fy ${l.fy} kN`,p.x+7,tailY)}if(l.fx){const right=l.fx>0,tailX=p.x+(right?-42:42);arrow(tailX,p.y,p.x,p.y);ctx.fillText(`Fx ${l.fx} kN`,Math.min(tailX,p.x)+2,p.y-8)}if(l.mz){ctx.strokeStyle='#e1261c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,19,l.mz>0?.3:Math.PI+.3,l.mz>0?Math.PI*1.75:Math.PI*.75,l.mz<0);ctx.stroke();ctx.fillText(`Mz ${l.mz}`,p.x+22,p.y+20)}ctx.restore()}
function memberLength(m){const a=state.nodes.find(n=>n.id===m.i),b=state.nodes.find(n=>n.id===m.j);return a&&b?Math.hypot(b.x-a.x,b.y-a.y):0}
function loadTypeLabel(ld){if(ld.type==='TRAP'&&Number(ld.w1)===Number(ld.w2))return 'UDL';if(ld.type==='TRAP')return 'Trapezoidal';if(ld.type==='POINT')return 'Point Load';if(ld.type==='MOMENT')return 'Moment';return ld.type}
function loadValueLabel(ld){if(ld.type==='TRAP')return `${ld.w1} → ${ld.w2} kN/m`;if(ld.type==='POINT')return `${ld.P} kN`;if(ld.type==='MOMENT')return `${ld.M} kN·m`;return ''}
function memberLoadDialog(m,editIndex=null){
 const L=memberLength(m),loads=activeMemberLoads(m),existing=editIndex==null?null:loads[editIndex];
 const wrap=document.createElement('div');wrap.className='member-load-modal';
 wrap.innerHTML=`<div class="member-load-card"><div class="ml-head"><div><h2>Member Load — M${m.id}</h2><small>Load Case: <b>${state.activeLoadCase}</b> • Length: ${L.toFixed(3)} m</small></div><button class="ml-close" aria-label="Close">×</button></div>
 <div class="ml-grid"><section class="ml-form"><label>Load Type<select id="mlType"><option value="UDL">Uniform Distributed Load (UDL)</option><option value="POINT">Point Load</option><option value="TRAP">Trapezoidal Load</option><option value="MOMENT">Moment Load</option></select></label><label id="mlDirectionRow">Direction<select id="mlDirection"><option value="LOCAL_Y">Local Y</option><option value="GLOBAL_Y">Global Y</option><option value="GLOBAL_X">Global X</option></select></label><div id="mlDynamic"></div><div class="ml-error" id="mlError"></div><div class="ml-preview"><b>Preview</b><div id="mlPreviewGraphic"></div></div><div class="ml-actions"><button class="secondary" id="mlCancel">Cancel</button><button class="primary" id="mlApply">${existing?'Update':'Apply'}</button></div></section>
 <section class="ml-list"><h3>Loads on M${m.id} — ${state.activeLoadCase}</h3><div class="ml-table-wrap"><table><thead><tr><th>#</th><th>Type</th><th>Direction</th><th>Value</th><th>Position</th><th></th></tr></thead><tbody id="mlRows"></tbody></table></div><button class="danger ml-clear" id="mlClear">Clear all loads</button></section></div></div>`;
 document.body.appendChild(wrap);
 const q=id=>wrap.querySelector('#'+id), close=()=>wrap.remove();wrap.querySelector('.ml-close').onclick=close;q('mlCancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
 const typeSel=q('mlType'),dirSel=q('mlDirection'),dyn=q('mlDynamic'),err=q('mlError');
 function val(id,fallback=0){const el=q(id);return el?Number(el.value):fallback}
 function renderDynamic(){const t=typeSel.value;q('mlDirectionRow').hidden=t==='MOMENT';if(t==='UDL')dyn.innerHTML=`<label>Magnitude (kN/m)<input id="mlW" type="number" step="any" value="${existing?.w1??-10}"></label><div class="ml-two"><label>Start distance (m)<input id="mlStart" type="number" min="0" step="any" value="${existing?.a??0}"></label><label>End distance (m)<input id="mlEnd" type="number" min="0" step="any" value="${existing?.b??L}"></label></div>`;else if(t==='TRAP')dyn.innerHTML=`<div class="ml-two"><label>Start load (kN/m)<input id="mlW1" type="number" step="any" value="${existing?.w1??-10}"></label><label>End load (kN/m)<input id="mlW2" type="number" step="any" value="${existing?.w2??-20}"></label></div><div class="ml-two"><label>Start distance (m)<input id="mlStart" type="number" min="0" step="any" value="${existing?.a??0}"></label><label>End distance (m)<input id="mlEnd" type="number" min="0" step="any" value="${existing?.b??L}"></label></div>`;else if(t==='POINT')dyn.innerHTML=`<label>Force (kN)<input id="mlP" type="number" step="any" value="${existing?.P??-50}"></label><label>Distance from i-end (m)<input id="mlPos" type="number" min="0" step="any" value="${existing?.x??((existing?.r??.5)*L)}"></label>`;else dyn.innerHTML=`<label>Moment (kN·m)<input id="mlM" type="number" step="any" value="${existing?.M??20}"></label><label>Distance from i-end (m)<input id="mlPos" type="number" min="0" step="any" value="${existing?.x??((existing?.r??.5)*L)}"></label>`;dyn.querySelectorAll('input').forEach(x=>x.addEventListener('input',preview));preview()}
 function draft(){const t=typeSel.value,direction=dirSel.value;if(t==='UDL')return {type:'TRAP',w1:val('mlW'),w2:val('mlW'),a:val('mlStart'),b:val('mlEnd'),direction};if(t==='TRAP')return {type:'TRAP',w1:val('mlW1'),w2:val('mlW2'),a:val('mlStart'),b:val('mlEnd'),direction};if(t==='POINT'){const x=val('mlPos');return {type:'POINT',P:val('mlP'),x,r:L?x/L:0,direction}}const x=val('mlPos');return {type:'MOMENT',M:val('mlM'),x,r:L?x/L:0,direction:'MZ'} }
 function validate(ld){if(!(L>0))return 'Member length must be greater than zero.';if(ld.type==='TRAP'){if(!Number.isFinite(ld.w1)||!Number.isFinite(ld.w2))return 'Magnitude must be a number.';if(!Number.isFinite(ld.a)||!Number.isFinite(ld.b)||ld.a<0||ld.b>L||ld.a>=ld.b)return `Start must be less than End and within 0–${L.toFixed(3)} m.`}else{const v=ld.type==='POINT'?ld.P:ld.M;if(!Number.isFinite(v))return 'Load value must be a number.';if(!Number.isFinite(ld.x)||ld.x<0||ld.x>L)return `Position must be within 0–${L.toFixed(3)} m.`}return ''}
 function preview(){const ld=draft(),g=q('mlPreviewGraphic');if(!g)return;const t=typeSel.value;if(t==='UDL'||t==='TRAP'){const arrows=Array.from({length:9},(_,i)=>`<i style="height:${18+Math.abs((ld.w1+(ld.w2-ld.w1)*i/8)||0)*.5}px">↓</i>`).join('');g.innerHTML=`<div class="preview-arrows">${arrows}</div><div class="preview-member"></div><small>${loadValueLabel(ld)} • ${ld.direction.replace('_',' ')}</small>`}else if(t==='POINT')g.innerHTML=`<div class="preview-point" style="left:${Math.max(0,Math.min(100,(ld.x/L)*100))}%">↓<span>${ld.P} kN</span></div><div class="preview-member"></div><small>${ld.direction.replace('_',' ')}</small>`;else g.innerHTML=`<div class="preview-moment" style="left:${Math.max(0,Math.min(100,(ld.x/L)*100))}%">↺<span>${ld.M} kN·m</span></div><div class="preview-member"></div>`}
 function renderRows(){q('mlRows').innerHTML=loads.length?loads.map((ld,i)=>{const pos=ld.type==='TRAP'?`${Number(ld.a??0).toFixed(2)}–${Number(ld.b??L).toFixed(2)} m`:`${Number(ld.x??((ld.r??0)*L)).toFixed(2)} m`;return `<tr class="${i===editIndex?'editing':''}"><td>${i+1}</td><td>${loadTypeLabel(ld)}</td><td>${ld.direction||'LOCAL_Y'}</td><td>${loadValueLabel(ld)}</td><td>${pos}</td><td class="ml-row-actions"><button data-edit="${i}">Edit</button><button data-copy="${i}">Duplicate</button><button class="danger" data-delete="${i}">Delete</button></td></tr>`}).join(''):`<tr><td colspan="6" class="empty">No member loads in this Load Case.</td></tr>`;q('mlRows').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{close();memberLoadDialog(m,Number(b.dataset.edit))});q('mlRows').querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{pushHistory();invalidate();loads.push(JSON.parse(JSON.stringify(loads[Number(b.dataset.copy)])));renderRows();render();updateUI();toast('Duplicate Member Load ແລ້ວ')});q('mlRows').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{pushHistory();invalidate();loads.splice(Number(b.dataset.delete),1);renderRows();render();updateUI();toast('ລຶບ Member Load ແລ້ວ')})}
 typeSel.value=existing?(existing.type==='TRAP'&&Number(existing.w1)===Number(existing.w2)?'UDL':existing.type):'UDL';dirSel.value=existing?.direction||'LOCAL_Y';typeSel.onchange=renderDynamic;dirSel.onchange=preview;
 q('mlApply').onclick=()=>{const ld=draft(),msg=validate(ld);err.textContent=msg;if(msg)return;pushHistory();invalidate();if(editIndex==null)loads.push(ld);else loads[editIndex]=ld;state.selected={type:'member',id:m.id};render();updateUI();toast(editIndex==null?'ເພີ່ມ Member Load ແລ້ວ':'ອັບເດດ Member Load ແລ້ວ');close()};
 q('mlClear').onclick=()=>{if(!loads.length||!confirm('Clear all member loads for this Load Case?'))return;pushHistory();invalidate();loads.length=0;renderRows();render();updateUI();toast('ລ້າງ Member Loads ແລ້ວ')};renderDynamic();renderRows()
}
function editMemberLoads(m){memberLoadDialog(m)}
function loadScreenDirection(ld,value,m,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy)||1,dir=ld.direction||'LOCAL_Y',sgn=value>=0?1:-1;
 if(dir==='GLOBAL_Y')return{x:0,y:-sgn};
 if(dir==='GLOBAL_X')return{x:sgn,y:0};
 // Local +Y is normal (-s,+c) in world coordinates. Screen Y is inverted.
 const ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
 return{x:nx*sgn,y:ny*sgn};
}
function drawMemberLoads(m,a,b){
 const loads=activeMemberLoads(m);if(!loads.length)return;
 const dx=b.x-a.x,dy=b.y-a.y,Lpx=Math.hypot(dx,dy);if(Lpx<1)return;
 const ux=dx/Lpx,uy=dy/Lpx,nx=-uy,ny=ux;
 const L=memberLength(m)||1;
 ctx.save();ctx.fillStyle='#e1261c';ctx.strokeStyle='#e1261c';ctx.font='11px Arial';
 for(const ld of loads){
  if(ld.type==='TRAP'){
   const aM=Math.max(0,Math.min(L,Number(ld.a??0))),bM=Math.max(aM,Math.min(L,Number(ld.b??L))),count=7;
   for(let k=0;k<count;k++){
    const rr=k/(count-1),xM=aM+(bM-aM)*rr,t=L?xM/L:0,w=Number(ld.w1||0)+(Number(ld.w2||0)-Number(ld.w1||0))*rr;
    let base={x:a.x+dx*t,y:a.y+dy*t},dir=loadScreenDirection(ld,w,m,a,b),len=Math.min(38,14+Math.abs(w)*1.2);
    // If a global load is nearly parallel to the member, offset arrows beside it so they remain visible.
    if(Math.abs(dir.x*ux+dir.y*uy)>.92){base={x:base.x+nx*10,y:base.y+ny*10}}
    arrow(base.x-dir.x*len,base.y-dir.y*len,base.x,base.y);
   }
   if(state.showLoadLabels){const midT=L?((aM+bM)/2)/L:.5,mid={x:a.x+dx*midT,y:a.y+dy*midT};ctx.fillText(`${ld.w1}→${ld.w2} kN/m • ${(ld.direction||'LOCAL_Y').replace('_',' ')}`,mid.x+nx*16,mid.y+ny*16)}
  }else if(ld.type==='POINT'){
   const xM=Number(ld.x??((Number(ld.r)||0)*L)),t=L?xM/L:0,base0={x:a.x+dx*t,y:a.y+dy*t},val=Number(ld.P)||0,dir=loadScreenDirection(ld,val,m,a,b),len=42;
   let base=base0;if(Math.abs(dir.x*ux+dir.y*uy)>.92)base={x:base.x+nx*10,y:base.y+ny*10};
   arrow(base.x-dir.x*len,base.y-dir.y*len,base.x,base.y);if(state.showLoadLabels)ctx.fillText(`${val} kN • ${(ld.direction||'LOCAL_Y').replace('_',' ')}`,base.x-dir.x*(len+8)+4,base.y-dir.y*(len+8)-4)
  }else if(ld.type==='MOMENT'){
   const xM=Number(ld.x??((Number(ld.r)||0)*L)),t=L?xM/L:0,base={x:a.x+dx*t,y:a.y+dy*t};ctx.beginPath();ctx.arc(base.x,base.y,18,0.2,5.2,ld.M<0);ctx.stroke();if(state.showLoadLabels)ctx.fillText(`${ld.M} kN·m`,base.x+20,base.y-20)
  }
 }
 ctx.restore()
}
function render(mouse){const r=canvas.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,r.width,r.height);drawGrid(r.width,r.height);
 if(state.layers?.members!==false){ctx.save();ctx.strokeStyle='#111827';ctx.lineWidth=2;for(const m of state.members){const aN=state.nodes.find(n=>n.id===m.i),bN=state.nodes.find(n=>n.id===m.j);if(!aN||!bN)continue;const a=worldToScreen(aN.x,aN.y),b=worldToScreen(bN.x,bN.y);const isSelected=selectedMemberIds().includes(m.id);ctx.strokeStyle=isSelected?'#f29b00':'#1f2937';ctx.lineWidth=isSelected?4:2;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle='#5b6472';ctx.font='11px Arial';if(state.layers?.labels!==false)ctx.fillText(`M${m.id}`,(a.x+b.x)/2+4,(a.y+b.y)/2-4);if(state.layers?.loads!==false)drawMemberLoads(m,a,b);if(m.releases?.i?.mz||m.releases?.j?.mz){ctx.save();ctx.fillStyle='#fff';ctx.strokeStyle='#7c3aed';ctx.lineWidth=2;if(m.releases?.i?.mz){ctx.beginPath();ctx.arc(a.x,a.y,6,0,Math.PI*2);ctx.fill();ctx.stroke()}if(m.releases?.j?.mz){ctx.beginPath();ctx.arc(b.x,b.y,6,0,Math.PI*2);ctx.fill();ctx.stroke()}ctx.restore()}}ctx.restore();}
 if(state.layers?.nodes!==false)for(const n of state.nodes){const p=worldToScreen(n.x,n.y);if(state.layers?.supports!==false)drawSupport(n,p);if(state.layers?.loads!==false)drawLoad(n,p);ctx.beginPath();ctx.arc(p.x,p.y,(state.selected?.type==='node'&&state.selected.id===n.id)?7:5,0,Math.PI*2);ctx.fillStyle=(state.selected?.type==='node'&&state.selected.id===n.id)?'#f29b00':(state.hover===n.id?'#44a3ff':'#0b5bd3');ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#0b4fb0';ctx.font='bold 12px Arial';if(state.layers?.labels!==false)ctx.fillText(String(n.id),p.x+8,p.y-8)}
 if(state.tool==='member'&&state.memberStart&&mouse){const n=state.nodes.find(x=>x.id===state.memberStart),a=worldToScreen(n.x,n.y);ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle='#e99a00';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(mouse.x,mouse.y);ctx.stroke();ctx.restore()}
 if(state.results&&$('viewResult').value==='deformed')drawDeformed();
 if(state.results&&['axial','shear','moment'].includes($('viewResult').value))drawForceDiagram($('viewResult').value);if(state.boxSelect){const b=state.boxSelect;ctx.save();ctx.fillStyle='rgba(37,99,235,.10)';ctx.strokeStyle='#2563eb';ctx.setLineDash([6,4]);ctx.fillRect(Math.min(b.x1,b.x2),Math.min(b.y1,b.y2),Math.abs(b.x2-b.x1),Math.abs(b.y2-b.y1));ctx.strokeRect(Math.min(b.x1,b.x2),Math.min(b.y1,b.y2),Math.abs(b.x2-b.x1),Math.abs(b.y2-b.y1));ctx.restore();}} 

function zeros(n,m){return Array.from({length:n},()=>Array(m).fill(0))}
function matMul(A,B){const r=A.length,c=B[0].length,k=B.length,R=zeros(r,c);for(let i=0;i<r;i++)for(let j=0;j<c;j++)for(let q=0;q<k;q++)R[i][j]+=A[i][q]*B[q][j];return R}
function transpose(A){return A[0].map((_,j)=>A.map(r=>r[j]))}
function matVec(A,v){return A.map(r=>r.reduce((s,x,i)=>s+x*v[i],0))}
function solveLinear(A,b){
 if(!A.length)return[];
 const scale=Math.max(1,...A.flat().map(Math.abs));
 const tol=scale*1e-12;
 A=A.map((r,i)=>[...r,b[i]]);const n=A.length;
 for(let k=0;k<n;k++){
  let p=k;for(let i=k+1;i<n;i++)if(Math.abs(A[i][k])>Math.abs(A[p][k]))p=i;
  if(Math.abs(A[p][k])<tol)throw new Error('Matrix singular: ໂຄງສ້າງບໍ່ສະຖຽນ, Support ບໍ່ພຽງພໍ ຫຼືມີ DOF ທີ່ບໍ່ເຊື່ອມຕໍ່');
  [A[k],A[p]]=[A[p],A[k]];
  for(let i=k+1;i<n;i++){const f=A[i][k]/A[k][k];if(Math.abs(f)<1e-20)continue;for(let j=k;j<=n;j++)A[i][j]-=f*A[k][j]}
 }
 const x=Array(n).fill(0);for(let i=n-1;i>=0;i--){let s=A[i][n];for(let j=i+1;j<n;j++)s-=A[i][j]*x[j];x[i]=s/A[i][i]}
 return x
}
function invertSmall(A){const n=A.length,I=zeros(n,n);for(let i=0;i<n;i++)I[i][i]=1;const M=A.map((r,i)=>[...r,...I[i]]);for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(M[i][k])>Math.abs(M[p][k]))p=i;if(Math.abs(M[p][k])<1e-14)throw new Error('Invalid member release matrix');[M[k],M[p]]=[M[p],M[k]];const d=M[k][k];for(let j=0;j<2*n;j++)M[k][j]/=d;for(let i=0;i<n;i++)if(i!==k){const f=M[i][k];for(let j=0;j<2*n;j++)M[i][j]-=f*M[k][j]}}return M.map(r=>r.slice(n))}
function applyEndReleases(k,p,released){if(!released.length)return{kEff:k.map(r=>[...r]),pEff:[...p],released,retained:[0,1,2,3,4,5]};const retained=[0,1,2,3,4,5].filter(i=>!released.includes(i)),Krr=released.map(i=>released.map(j=>k[i][j])),Krs=released.map(i=>retained.map(j=>k[i][j])),Ksr=retained.map(i=>released.map(j=>k[i][j])),Kss=retained.map(i=>retained.map(j=>k[i][j])),inv=invertSmall(Krr),corr=matMul(Ksr,matMul(inv,Krs)),ke=Kss.map((r,i)=>r.map((v,j)=>v-corr[i][j])),pr=released.map(i=>p[i]),ps=retained.map(i=>p[i]),pc=matVec(Ksr,matVec(inv,pr)),pe=ps.map((v,i)=>v-pc[i]),kEff=zeros(6,6),pEff=Array(6).fill(0);retained.forEach((ri,a)=>{pEff[ri]=pe[a];retained.forEach((rj,b)=>kEff[ri][rj]=ke[a][b])});return{kEff,pEff,released,retained,Krr,Krs,inv}}
function elementData(m){const ni=state.nodes.find(n=>n.id===m.i),nj=state.nodes.find(n=>n.id===m.j),dx=nj.x-ni.x,dy=nj.y-ni.y,L=Math.hypot(dx,dy);if(L<1e-8)throw new Error('Member ມີຄວາມຍາວເທົ່າ 0');const c=dx/L,s=dy/L,EA=m.E*m.A,EI=m.E*m.I;const kFull=[[EA/L,0,0,-EA/L,0,0],[0,12*EI/L**3,6*EI/L**2,0,-12*EI/L**3,6*EI/L**2],[0,6*EI/L**2,4*EI/L,0,-6*EI/L**2,2*EI/L],[-EA/L,0,0,EA/L,0,0],[0,-12*EI/L**3,-6*EI/L**2,0,12*EI/L**3,-6*EI/L**2],[0,6*EI/L**2,2*EI/L,0,-6*EI/L**2,4*EI/L]];const T=[[c,s,0,0,0,0],[-s,c,0,0,0,0],[0,0,1,0,0,0],[0,0,0,c,s,0],[0,0,0,-s,c,0],[0,0,0,0,0,1]],released=[];if(m.releases?.i?.mz)released.push(2);if(m.releases?.j?.mz)released.push(5);return{ni,nj,L,c,s,kFull,T,released}}
function memberEquivalentLocal(loads,L,c=1,s=0){
 const p=Array(6).fill(0), localComponents=(v,dir)=>dir==='GLOBAL_Y'?[v*s,v*c]:dir==='GLOBAL_X'?[v*c,-v*s]:[0,v];
 const addPoint=(x,ax,tr)=>{const z=Math.max(0,Math.min(1,x/L)),N1=1-z,N2=z,H1=1-3*z*z+2*z*z*z,H2=L*(z-2*z*z+z*z*z),H3=3*z*z-2*z*z*z,H4=L*(-z*z+z*z*z);p[0]+=N1*ax;p[3]+=N2*ax;p[1]+=H1*tr;p[2]+=H2*tr;p[4]+=H3*tr;p[5]+=H4*tr};
 const gauss=[[-.7745966692414834,.5555555555555556],[0,.8888888888888888],[.7745966692414834,.5555555555555556]];
 for(const ld of loads||[]){if(ld.type==='TRAP'){const a=Math.max(0,Math.min(L,Number(ld.a??0))),b=Math.max(a,Math.min(L,Number(ld.b??L))),w1=Number(ld.w1)||0,w2=Number(ld.w2)||0;if(b<=a)continue;for(const [g,wt] of gauss){const x=(a+b)/2+g*(b-a)/2,t=(x-a)/(b-a),w=w1+(w2-w1)*t,[ax,tr]=localComponents(w,ld.direction||'LOCAL_Y'),z=x/L,N1=1-z,N2=z,H1=1-3*z*z+2*z*z*z,H2=L*(z-2*z*z+z*z*z),H3=3*z*z-2*z*z*z,H4=L*(-z*z+z*z*z),J=(b-a)/2*wt;p[0]+=N1*ax*J;p[3]+=N2*ax*J;p[1]+=H1*tr*J;p[2]+=H2*tr*J;p[4]+=H3*tr*J;p[5]+=H4*tr*J}}else if(ld.type==='POINT'){const x=Number(ld.x??((Number(ld.r)||0)*L)),[ax,tr]=localComponents(Number(ld.P)||0,ld.direction||'LOCAL_Y');addPoint(x,ax,tr)}else if(ld.type==='MOMENT'){const M=Number(ld.M)||0,x=Math.max(0,Math.min(1,Number(ld.x??((Number(ld.r)||0)*L))/L));p[1]+=M*(-6*x+6*x*x)/L;p[2]+=M*(1-4*x+3*x*x);p[4]+=M*(6*x-6*x*x)/L;p[5]+=M*(-2*x+3*x*x)}}return p}
function restraints(n){if(n.support==='fixed')return[1,1,1];if(n.support==='pin')return[1,1,0];if(n.support==='roller')return[0,1,0];return[0,0,0]}

// V1.17 — load-independent global stiffness stability check.
// This mirrors the analysis stiffness assembly, including end releases and
// inactive rotational hinge DOFs, but does not need any applied loads.
function stiffnessStabilityCheckV114Fix(){
 if(!state.nodes.length||!state.members.length)return{ok:false,rank:0,free:0,deficiency:0,reason:'EMPTY_MODEL'};
 try{
  const index=new Map(state.nodes.map((n,i)=>[n.id,i]));
  const nd=state.nodes.length*3,K=zeros(nd,nd);
  for(const m of state.members){
   const e=elementData(m),ii=index.get(m.i)*3,jj=index.get(m.j)*3,dofs=[ii,ii+1,ii+2,jj,jj+1,jj+2];
   const rel=applyEndReleases(e.kFull,Array(6).fill(0),e.released);
   const kg=matMul(transpose(e.T),matMul(rel.kEff,e.T));
   for(let a=0;a<6;a++)for(let b=0;b<6;b++)K[dofs[a]][dofs[b]]+=kg[a][b];
  }
  const fixed=[];
  for(const n of state.nodes){const q=index.get(n.id)*3;restraints(n).forEach((v,i)=>{if(v)fixed.push(q+i)})}
  const inactive=[];
  for(const n of state.nodes){
   const inc=state.members.filter(m=>m.i===n.id||m.j===n.id);
   if(!inc.length)continue;
   const allReleased=inc.every(m=>m.i===n.id?!!m.releases?.i?.mz:!!m.releases?.j?.mz);
   if(allReleased){const rz=index.get(n.id)*3+2;if(!fixed.includes(rz))inactive.push(rz)}
  }
  const fixedSet=new Set(fixed),inactiveSet=new Set(inactive);
  const free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixedSet.has(i)&&!inactiveSet.has(i));
  if(!free.length)return{ok:false,rank:0,free:0,deficiency:0,reason:'NO_FREE_DOF'};
  const A=free.map(i=>free.map(j=>K[i][j]));
  let maxAbs=0;for(const r of A)for(const v of r)maxAbs=Math.max(maxAbs,Math.abs(v));
  if(!(maxAbs>0))return{ok:false,rank:0,free:free.length,deficiency:free.length,reason:'ZERO_STIFFNESS'};
  const tol=Math.max(1e-10,maxAbs*1e-10),M=A.map(r=>r.slice());
  let rank=0;
  for(let col=0,row=0;col<M.length&&row<M.length;col++){
   let piv=row;for(let r=row+1;r<M.length;r++)if(Math.abs(M[r][col])>Math.abs(M[piv][col]))piv=r;
   if(Math.abs(M[piv][col])<=tol)continue;
   [M[row],M[piv]]=[M[piv],M[row]];
   const d=M[row][col];
   for(let r=row+1;r<M.length;r++){
    const f=M[r][col]/d;if(Math.abs(f)<1e-20)continue;
    for(let c=col;c<M.length;c++)M[r][c]-=f*M[row][c];
   }
   rank++;row++;
  }
  return{ok:rank===free.length,rank,free:free.length,deficiency:free.length-rank,reason:rank===free.length?'STABLE':'RANK_DEFICIENT'};
 }catch(err){return{ok:false,rank:0,free:0,deficiency:0,reason:'CHECK_ERROR',error:String(err?.message||err)}}
}

function combinationText(c){return Object.entries(c.factors||{}).filter(([,v])=>Math.abs(Number(v)||0)>1e-12).map(([id,v])=>`${Number(v)}${id}`).join(' + ').replace(/\+ -/g,'- ')||'0'}
function loadCombinationDialog(){
 const wrap=document.createElement('div');wrap.className='eng-dialog';wrap.innerHTML=`<div class="eng-card"><h2>Load Combination Manager</h2><div id="combBody"></div><div class="eng-actions"><button class="secondary" id="combClose">ປິດ</button></div></div>`;document.body.appendChild(wrap);wrap.querySelector('#combClose').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};const body=wrap.querySelector('#combBody');
 const renderList=()=>{body.innerHTML=`<table><tr><th>ID</th><th>Name</th><th>Expression</th><th></th></tr>${state.loadCombinations.map((c,i)=>`<tr><td>${c.id}</td><td>${c.name}</td><td>${combinationText(c)}</td><td><button class="danger" data-del="${i}">ລຶບ</button></td></tr>`).join('')}</table><div class="eng-form"><input id="combId" placeholder="ID: ULS-1"><input id="combName" placeholder="Name: 1.2DL + 1.6LL"></div><div class="factor-grid">${state.loadCases.map(c=>`<label>${c.id}<input data-factor="${c.id}" type="number" step="0.1" value="0"></label>`).join('')}</div><button id="combAdd">＋ Add Combination</button>`;
  body.querySelector('#combAdd').onclick=()=>{const id=body.querySelector('#combId').value.trim().toUpperCase(),name=body.querySelector('#combName').value.trim();if(!id||!name)return alert('ກະລຸນາໃສ່ ID ແລະ Name');if(state.loadCombinations.some(x=>x.id===id))return alert('ID ຊ້ຳ');const factors={};body.querySelectorAll('[data-factor]').forEach(el=>{const v=Number(el.value)||0;if(Math.abs(v)>1e-12)factors[el.dataset.factor]=v});if(!Object.keys(factors).length)return alert('ກະລຸນາໃສ່ Factor ຢ່າງນ້ອຍ 1 Load Case');state.loadCombinations.push({id,name,factors});state.activeAnalysis='COMB:'+id;updateEngineeringSelectors();renderList();toast('ເພີ່ມ Load Combination ແລ້ວ')};
  body.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.del),id=state.loadCombinations[i].id;state.loadCombinations.splice(i,1);if(state.activeAnalysis==='COMB:'+id)state.activeAnalysis='CASE:'+state.activeLoadCase;updateEngineeringSelectors();invalidate();renderList()})
 };renderList()
}
function analysisLoads(specOverride=null){
 const spec=specOverride||state.activeAnalysis||('CASE:'+state.activeLoadCase);const [kind,id]=spec.split(':');
 if(kind==='CASE')return {label:`Load Case ${id}`,loads:new Map(state.nodes.map(n=>[n.id,n.loads?.[id]||emptyLoad()])),memberLoads:new Map(state.members.map(m=>[m.id,m.loads?.[id]||[]]))};
 const comb=state.loadCombinations.find(c=>c.id===id);if(!comb)throw new Error('ບໍ່ພົບ Load Combination');
 const loads=new Map(),memberLoads=new Map();for(const n of state.nodes){const out=emptyLoad();for(const [caseId,factor] of Object.entries(comb.factors||{})){const l=n.loads?.[caseId]||emptyLoad();out.fx+=Number(factor)*Number(l.fx||0);out.fy+=Number(factor)*Number(l.fy||0);out.mz+=Number(factor)*Number(l.mz||0)}loads.set(n.id,out)}for(const m of state.members){const arr=[];for(const [caseId,factor] of Object.entries(comb.factors||{}))for(const ld of (m.loads?.[caseId]||[])){const c={...ld};if(c.type==='TRAP'){c.w1*=Number(factor);c.w2*=Number(factor)}if(c.type==='POINT')c.P*=Number(factor);if(c.type==='MOMENT')c.M*=Number(factor);arr.push(c)}memberLoads.set(m.id,arr)}return {label:`Combination ${comb.name}`,loads,memberLoads,combination:comb}
}
function validateModel(){
 if(state.nodes.length<2||!state.members.length)throw new Error('ຕ້ອງມີ Node ແລະ Member');
 const ids=new Set(state.nodes.map(n=>n.id));
 const connected=new Set();
 for(const m of state.members){
  if(!ids.has(m.i)||!ids.has(m.j))throw new Error(`Member ${m.id} ອ້າງອີງ Node ທີ່ບໍ່ມີ`);
  if(!(Number(m.E)>0&&Number(m.A)>0&&Number(m.I)>0))throw new Error(`Member ${m.id}: E, A ແລະ I ຕ້ອງຫຼາຍກວ່າ 0`);
  connected.add(m.i);connected.add(m.j)
 }
 const loose=state.nodes.filter(n=>!connected.has(n.id));
 if(loose.length)throw new Error('ພົບ Node ທີ່ບໍ່ເຊື່ອມ Member: '+loose.map(n=>n.id).join(', '));
 if(!state.nodes.some(n=>n.support!=='none'))throw new Error('ກະລຸນາກຳນົດ Support');
}


// V1.17 — Structural Model Validation & Diagnostics
function modelDiagnostics(){
 const issues=[];const add=(severity,code,title,detail,target=null)=>issues.push({severity,code,title,detail,target});
 const nodeById=new Map(state.nodes.map(n=>[n.id,n]));
 const memberById=new Map(state.members.map(m=>[m.id,m]));
 const incident=new Map(state.nodes.map(n=>[n.id,[]]));
 for(const m of state.members){if(incident.has(m.i))incident.get(m.i).push(m);if(incident.has(m.j))incident.get(m.j).push(m)}
 if(!state.nodes.length)add('critical','NO_NODES','No nodes','The model does not contain any Nodes.');
 if(!state.members.length)add('critical','NO_MEMBERS','No members','The model does not contain any structural Members.');
 // Duplicate / near-coincident nodes.
 const dupTol=0.001;
 for(let a=0;a<state.nodes.length;a++)for(let b=a+1;b<state.nodes.length;b++){
  const n1=state.nodes[a],n2=state.nodes[b],d=Math.hypot(n1.x-n2.x,n1.y-n2.y);
  if(d<=dupTol)add('warning','DUP_NODE',`Nodes ${n1.id} and ${n2.id} are coincident`,`Distance = ${d.toExponential(2)} m (tolerance ${dupTol} m). Merge them if they represent the same joint.`,{type:'nodes',ids:[n1.id,n2.id]});
 }
 // Node connectivity.
 for(const n of state.nodes){const inc=incident.get(n.id)||[];if(!inc.length)add('warning','ORPHAN_NODE',`Node ${n.id} is disconnected`,'This Node is not connected to any Member.',{type:'node',id:n.id});}
 // Member integrity and properties.
 const pairSeen=new Map();
 for(const m of state.members){
  const ni=nodeById.get(m.i),nj=nodeById.get(m.j);
  if(!ni||!nj){add('critical','BAD_MEMBER_REF',`Member M${m.id} references a missing Node`,`i=${m.i}, j=${m.j}. The member cannot be assembled into the stiffness matrix.`,{type:'member',id:m.id});continue}
  const L=Math.hypot(nj.x-ni.x,nj.y-ni.y);
  if(L<=1e-8)add('critical','ZERO_LENGTH',`Member M${m.id} has zero length`,`Length = ${L.toExponential(2)} m.`,{type:'member',id:m.id});
  const key=[m.i,m.j].sort((x,y)=>x-y).join('-');if(pairSeen.has(key))add('warning','DUP_MEMBER',`Members M${pairSeen.get(key)} and M${m.id} overlap`,'Both members connect the same two Nodes.',{type:'members',ids:[pairSeen.get(key),m.id]});else pairSeen.set(key,m.id);
  if(!(Number(m.E)>0))add('critical','BAD_E',`Member M${m.id} has invalid E`,`E = ${m.E}. Assign a valid Material.`,{type:'member',id:m.id});
  if(!(Number(m.A)>0))add('critical','BAD_A',`Member M${m.id} has invalid A`,`A = ${m.A}. Assign a valid Section.`,{type:'member',id:m.id});
  if(!(Number(m.I)>0))add('critical','BAD_I',`Member M${m.id} has invalid I`,`I = ${m.I}. Assign a valid Section.`,{type:'member',id:m.id});
  if(!m.materialId||!state.materials.some(x=>x.id===m.materialId))add('warning','MISSING_MAT',`Member M${m.id} has no valid Material`,'The numerical E value may still exist, but the Material Library reference is missing.',{type:'member',id:m.id});
  if(!m.sectionId||!state.sections.some(x=>x.id===m.sectionId))add('warning','MISSING_SEC',`Member M${m.id} has no valid Section`,'The numerical A/I values may still exist, but the Section Library reference is missing.',{type:'member',id:m.id});
  const both=!!m.releases?.i?.mz&&!!m.releases?.j?.mz;if(both)add('info','DOUBLE_RELEASE',`Member M${m.id} is pinned at both ends`,'This is valid for some systems, but review connectivity if an unexpected mechanism occurs.',{type:'member',id:m.id});
  for(const [caseId,arr] of Object.entries(m.loads||{})){
   if(!state.loadCases.some(c=>c.id===caseId))add('warning','UNKNOWN_MEMBER_CASE',`M${m.id} has loads in unknown case “${caseId}”`,'The load case is not present in the current Load Case library.',{type:'member',id:m.id});
   for(const ld of (Array.isArray(arr)?arr:[])){
    if(!['TRAP','POINT','MOMENT'].includes(ld.type))add('warning','BAD_MEMBER_LOAD',`M${m.id} contains an unsupported Member Load`,`Type = ${String(ld.type)}.`,{type:'member',id:m.id});
    if((ld.type==='POINT'||ld.type==='MOMENT')&&!(Number(ld.r)>=0&&Number(ld.r)<=1))add('warning','LOAD_POSITION',`M${m.id} has a load outside the member`,`Relative position r = ${ld.r}; expected 0–1.`,{type:'member',id:m.id});
   }
  }
 }
 // Node load case references.
 for(const n of state.nodes)for(const caseId of Object.keys(n.loads||{}))if(!state.loadCases.some(c=>c.id===caseId))add('warning','UNKNOWN_NODE_CASE',`Node ${n.id} has load data in unknown case “${caseId}”`,'The load case is not present in the current Load Case library.',{type:'node',id:n.id});
 // Supports / restraint sufficiency and actual stiffness stability.
 const supported=state.nodes.filter(n=>n.support&&n.support!=='none');
 if(!supported.length)add('critical','NO_SUPPORT','No Supports are assigned','The global model has rigid-body DOFs and cannot be analyzed.');
 else{
  const restraintCount=supported.reduce((sum,n)=>sum+restraints(n).reduce((a,b)=>a+b,0),0);
  if(restraintCount<3)add('critical','LOW_RESTRAINT','Insufficient restrained DOFs',`Only ${restraintCount} restrained DOF(s) were found. A 2D frame must restrain the global rigid-body motions before analysis.`);
 }
 // Building-frame base check: a generated/base-line joint that lost its support
 // is reported even when the remaining supports still keep the entire frame stable.
 if(state.nodes.length&&state.members.length){
  const minY=Math.min(...state.nodes.map(n=>Number(n.y)||0)),baseTol=1e-6;
  const baseNodes=state.nodes.filter(n=>Math.abs((Number(n.y)||0)-minY)<=baseTol&&(incident.get(n.id)||[]).length);
  const baseSupported=baseNodes.filter(n=>n.support&&n.support!=='none');
  const looksLikeBuilding=(state.building?.stories||0)>0||baseNodes.length>=2;
  if(looksLikeBuilding&&baseSupported.length){
   for(const n of baseNodes.filter(n=>!n.support||n.support==='none')){
    add('warning','UNSUPPORTED_BASE_NODE',`Base Node ${n.id} has no Support`,'This base-level joint is connected to the structure but its Support is set to none. If this is intentional you may ignore the warning; otherwise restore the intended support.',{type:'node',id:n.id});
   }
  }
 }
 const stability=stiffnessStabilityCheckV114Fix();
 if(stability.reason==='NO_FREE_DOF')add('warning','NO_FREE_DOF','No free DOFs remain','All active DOFs are restrained. Review supports if this was not intended.');
 else if(!stability.ok&&stability.reason!=='EMPTY_MODEL'&&stability.reason!=='CHECK_ERROR')add('critical','UNSTABLE_STIFFNESS','Global stiffness matrix is unstable',`Rank ${stability.rank} / ${stability.free} free DOFs (deficiency ${stability.deficiency}). The model has insufficient restraints, a disconnected mechanism, or incompatible Member Releases/Hinges.`);
 else if(stability.reason==='CHECK_ERROR')add('warning','STABILITY_CHECK_ERROR','Stability check could not be completed',stability.error||'Review the model and try Analyze.');
 // Graph components: isolated structural submodels.
 const adj=new Map(state.nodes.map(n=>[n.id,new Set()]));
 for(const m of state.members)if(adj.has(m.i)&&adj.has(m.j)){adj.get(m.i).add(m.j);adj.get(m.j).add(m.i)}
 const activeNodes=state.nodes.filter(n=>(incident.get(n.id)||[]).length).map(n=>n.id),seen=new Set(),components=[];
 for(const start of activeNodes){if(seen.has(start))continue;const stack=[start],nodes=[];seen.add(start);while(stack.length){const u=stack.pop();nodes.push(u);for(const v of adj.get(u)||[])if(!seen.has(v)){seen.add(v);stack.push(v)}}components.push(nodes)}
 if(components.length>1){components.sort((a,b)=>b.length-a.length);for(let i=1;i<components.length;i++){const cset=new Set(components[i]);const mids=state.members.filter(m=>cset.has(m.i)&&cset.has(m.j)).map(m=>m.id);add('warning','DISCONNECTED_COMPONENT',`Disconnected structural component ${i+1}`,`${components[i].length} Nodes and ${mids.length} Members are disconnected from the main structural component.`,{type:'members',ids:mids});}}
 // Release / hinge nodes where every connected member end releases rotation.
 for(const n of state.nodes){const inc=incident.get(n.id)||[];if(inc.length&&inc.every(m=>m.i===n.id?!!m.releases?.i?.mz:!!m.releases?.j?.mz))add('info','HINGE_NODE',`Node ${n.id} is a rotational hinge`,`All ${inc.length} incident Member end(s) release Mz. The solver will remove the inactive rotational DOF.`,{type:'node',id:n.id});}
 // Load combinations referencing missing cases.
 for(const c of state.loadCombinations)for(const caseId of Object.keys(c.factors||{}))if(!state.loadCases.some(x=>x.id===caseId))add('critical','BAD_COMB_CASE',`Combination ${c.id} references missing Load Case “${caseId}”`,'Edit or remove the invalid factor before analyzing this combination.');
 const critical=issues.filter(x=>x.severity==='critical').length,warning=issues.filter(x=>x.severity==='warning').length,info=issues.filter(x=>x.severity==='info').length;
 return {issues,critical,warning,info,ready:critical===0,nodes:state.nodes.length,members:state.members.length,supports:supported.length};
}
function focusNodeV114(id){const n=state.nodes.find(x=>x.id===Number(id));if(!n)return;state.selected={type:'node',id:n.id};state.multiSelectedMemberIds=new Set();const r=canvas.getBoundingClientRect();state.view.ox=r.width/2-n.x*state.view.scale;state.view.oy=r.height/2+n.y*state.view.scale;updateUI();render();}
function locateDiagnosticTarget(target){if(!target)return;if(target.type==='node'){focusNodeV114(target.id);return}if(target.type==='nodes'){const ids=target.ids||[],mids=state.members.filter(m=>ids.includes(m.i)||ids.includes(m.j)).map(m=>m.id);if(mids.length){selectMembers(mids);focusMembers(mids)}else focusNodeV114(ids[0]);return}if(target.type==='member'){setSingleMemberSelection(Number(target.id));focusMembers([Number(target.id)]);updateUI();render();return}if(target.type==='members'){const ids=(target.ids||[]).filter(id=>state.members.some(m=>m.id===Number(id))).map(Number);selectMembers(ids);focusMembers(ids);return}}
function modelCheckDialog(){
 const report=modelDiagnostics();const wrap=document.createElement('div');wrap.className='model-check-dialog';
 const statusClass=report.critical?'blocked':report.warning?'caution':'ready';const statusText=report.critical?`NOT READY — ${report.critical} critical issue${report.critical===1?'':'s'} must be fixed before analysis.`:report.warning?`READY WITH CAUTION — no critical errors, but ${report.warning} warning${report.warning===1?'':'s'} should be reviewed.`:'MODEL READY FOR ANALYSIS — no critical problems or warnings detected.';
 const rows=report.issues.map((x,i)=>`<div class="model-check-issue ${x.severity}"><span class="model-check-badge">${x.severity}</span><div class="model-check-text"><b>${x.title}</b><small>${x.detail}</small></div>${x.target?`<button class="model-check-locate" data-locate="${i}">⌖ Locate</button>`:''}</div>`).join('');
 wrap.innerHTML=`<div class="model-check-card"><div class="model-check-head"><div><h2>✓ Check Model — V1.17.1 Fix</h2><p>Structural Model Validation & Diagnostics before analysis</p></div><button class="model-check-close" id="modelCheckClose">×</button></div><div class="model-check-summary"><div class="model-check-metric"><b>${report.nodes}</b><span>Nodes</span></div><div class="model-check-metric"><b>${report.members}</b><span>Members</span></div><div class="model-check-metric critical"><b>${report.critical}</b><span>Critical</span></div><div class="model-check-metric warning"><b>${report.warning}</b><span>Warnings</span></div></div><div class="model-check-status ${statusClass}">${statusText}</div><div class="model-check-list">${rows||'<div class="model-check-empty">✓ No model integrity issues detected.</div>'}</div><div class="model-check-actions"><button id="modelCheckAgain">↻ Check Again</button><button id="modelCheckAnalyze" class="primary" ${report.critical?'disabled':''}>▶ Analyze Now</button></div></div>`;
 document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('#modelCheckClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
 wrap.querySelectorAll('[data-locate]').forEach(b=>b.onclick=()=>{const issue=report.issues[Number(b.dataset.locate)];close();locateDiagnosticTarget(issue?.target);toast('Located: '+(issue?.title||'model issue'))});
 wrap.querySelector('#modelCheckAgain').onclick=()=>{close();modelCheckDialog()};wrap.querySelector('#modelCheckAnalyze').onclick=()=>{if(report.critical)return;close();analyze()};
 $('statusText').textContent=report.critical?`Model Check: ${report.critical} critical, ${report.warning} warning`:`Model Check passed • ${report.warning} warning(s)`;
}

function showCachedAnalysis(spec,notify=true){
 const cached=state.resultsByAnalysis.get(spec);
 state.results=cached||null;
 if(cached){
  updateResultModeButtons();
  setResultView('deformed',false);
  renderResults();
  $('statusText').textContent='ສະແດງຜົນທີ່ບັນທຶກໄວ້ • '+cached.analysisLabel;
  if(notify)toast('ໂຫຼດຜົນວິເຄາະເດີມແລ້ວ');
 }else{
  setResultView('model',false);updateResultModeButtons();renderResults();render();
  $('statusText').textContent='ຍັງບໍ່ໄດ້ວິເຄາະ '+($('analysisResultSelect')?.selectedOptions?.[0]?.textContent||spec);
  if(notify)toast('Case/Combination ນີ້ຍັງບໍ່ມີຜົນ — ກົດ Analyze');
 }
}

// V1.17 — reusable solver + Result Envelope / Critical Combination

// V1.26.2 Fix Fix — report maximum transverse displacement inside frame members,
// not only nodal translations. Cubic Hermite interpolation uses the solved
// local end v/theta DOFs and is sampled along each member.
function memberMaxDisplacementV1261(D,index){
 let best={value:0,abs:0,memberId:null,ratio:0,x:0,y:0};
 for(const m of state.members){
  const ni=state.nodes.find(n=>n.id===m.i),nj=state.nodes.find(n=>n.id===m.j);if(!ni||!nj)continue;
  const dx=nj.x-ni.x,dy=nj.y-ni.y,L=Math.hypot(dx,dy);if(L<=1e-12)continue;
  const c=dx/L,s=dy/L,qi=index.get(ni.id)*3,qj=index.get(nj.id)*3;
  const ugi=[D[qi],D[qi+1]],ugj=[D[qj],D[qj+1]];
  const vi=-s*ugi[0]+c*ugi[1],vj=-s*ugj[0]+c*ugj[1],ti=D[qi+2],tj=D[qj+2];
  for(let k=0;k<=100;k++){
   const r=k/100,r2=r*r,r3=r2*r;
   const N1=1-3*r2+2*r3,N2=L*(r-2*r2+r3),N3=3*r2-2*r3,N4=L*(-r2+r3);
   const v=N1*vi+N2*ti+N3*vj+N4*tj,a=Math.abs(v);
   if(a>best.abs)best={value:v,abs:a,memberId:m.id,ratio:r,x:ni.x+dx*r,y:ni.y+dy*r};
  }
 }
 // Also retain any larger solved nodal translation for general frame models.
 for(const n of state.nodes){const q=index.get(n.id)*3,mag=Math.hypot(D[q],D[q+1]);if(mag>best.abs)best={value:mag,abs:mag,memberId:null,ratio:null,x:n.x,y:n.y,nodeId:n.id}}
 return best;
}


// V1.26.2 Fix — member-specific maximum transverse displacement.
// When exactly one Member is selected, the Deformed legend reports the maximum
// interpolated displacement on that Member only instead of repeating the global
// model maximum for every selection.
function memberSpecificMaxDisplacementV1262(memberId,D,index){
 const m=state.members.find(x=>x.id===Number(memberId));
 if(!m)return null;
 const ni=state.nodes.find(n=>n.id===m.i),nj=state.nodes.find(n=>n.id===m.j);
 if(!ni||!nj)return null;
 const dx=nj.x-ni.x,dy=nj.y-ni.y,L=Math.hypot(dx,dy);if(L<=1e-12)return null;
 const c=dx/L,s=dy/L,qi=index.get(ni.id)*3,qj=index.get(nj.id)*3;
 const ugi=[D[qi],D[qi+1]],ugj=[D[qj],D[qj+1]];
 const vi=-s*ugi[0]+c*ugi[1],vj=-s*ugj[0]+c*ugj[1],ti=D[qi+2],tj=D[qj+2];
 let best={value:vi,abs:Math.abs(vi),memberId:m.id,ratio:0,x:ni.x,y:ni.y};
 for(let k=0;k<=200;k++){
  const r=k/200,r2=r*r,r3=r2*r;
  const N1=1-3*r2+2*r3,N2=L*(r-2*r2+r3),N3=3*r2-2*r3,N4=L*(-r2+r3);
  const v=N1*vi+N2*ti+N3*vj+N4*tj,a=Math.abs(v);
  if(a>best.abs)best={value:v,abs:a,memberId:m.id,ratio:r,x:ni.x+dx*r,y:ni.y+dy*r};
 }
 return best;
}

function solveAnalysisSpecV116(spec){
 validateModel();
 const loadSet=analysisLoads(spec);
 const index=new Map(state.nodes.map((n,i)=>[n.id,i]));const nd=state.nodes.length*3,K=zeros(nd,nd),F=Array(nd).fill(0),els=[];
 for(const n of state.nodes){const l=loadSet.loads.get(n.id)||emptyLoad(),q=index.get(n.id)*3;F[q]=Number(l.fx||0);F[q+1]=Number(l.fy||0);F[q+2]=Number(l.mz||0)}
 for(const m of state.members){const e=elementData(m),ii=index.get(m.i)*3,jj=index.get(m.j)*3,dofs=[ii,ii+1,ii+2,jj,jj+1,jj+2],pFull=memberEquivalentLocal(loadSet.memberLoads?.get(m.id)||[],e.L,e.c,e.s),rel=applyEndReleases(e.kFull,pFull,e.released),kg=matMul(transpose(e.T),matMul(rel.kEff,e.T)),pGlobal=matVec(transpose(e.T),rel.pEff);for(let a=0;a<6;a++){for(let b=0;b<6;b++)K[dofs[a]][dofs[b]]+=kg[a][b];F[dofs[a]]+=pGlobal[a]}els.push({...e,m,dofs,pFull,rel})}
 const fixed=[];for(const n of state.nodes){const q=index.get(n.id)*3;restraints(n).forEach((v,i)=>{if(v)fixed.push(q+i)})}
 const inactiveHingeRotations=[];for(const n of state.nodes){const incident=state.members.filter(m=>m.i===n.id||m.j===n.id);if(!incident.length)continue;const allReleased=incident.every(m=>m.i===n.id?!!m.releases?.i?.mz:!!m.releases?.j?.mz);if(allReleased){const rz=index.get(n.id)*3+2;if(!fixed.includes(rz))inactiveHingeRotations.push(rz)}}
 const inactiveSet=new Set(inactiveHingeRotations),free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.includes(i)&&!inactiveSet.has(i));if(!free.length)throw new Error('No Free DOF for analysis');
 const Kff=free.map(i=>free.map(j=>K[i][j])),Ff=free.map(i=>F[i]),uf=solveLinear(Kff,Ff),D=Array(nd).fill(0);free.forEach((d,i)=>D[d]=uf[i]);const KD=matVec(K,D),R=KD.map((x,i)=>x-F[i]);
 const memberForces=els.map(e=>{const dg=e.dofs.map(d=>D[d]),dl=matVec(e.T,dg),full=[...dl];if(e.rel.released.length){const ds=e.rel.retained.map(i=>dl[i]),rhs=e.rel.released.map(i=>e.pFull[i]).map((v,i)=>v-matVec(e.rel.Krs,ds)[i]),dr=matVec(e.rel.inv,rhs);e.rel.released.forEach((idx,i)=>full[idx]=dr[i])}const q=matVec(e.kFull,full).map((v,i)=>v-(e.pFull?.[i]||0));for(const idx of e.rel.released)q[idx]=0;return{id:e.m.id,i:e.m.i,j:e.m.j,L:e.L,c:e.c,s:e.s,local:q,releases:e.m.releases,loads:JSON.parse(JSON.stringify(loadSet.memberLoads?.get(e.m.id)||[]))}});
 const residual=free.length?Math.max(...free.map(i=>Math.abs(KD[i]-F[i]))):0;
 const applied={fx:state.nodes.reduce((s,n)=>s+F[index.get(n.id)*3],0),fy:state.nodes.reduce((s,n)=>s+F[index.get(n.id)*3+1],0),mz:state.nodes.reduce((s,n)=>s+F[index.get(n.id)*3+2],0)},reactions={fx:state.nodes.reduce((s,n)=>s+R[index.get(n.id)*3],0),fy:state.nodes.reduce((s,n)=>s+R[index.get(n.id)*3+1],0),mz:state.nodes.reduce((s,n)=>s+R[index.get(n.id)*3+2],0)};
 const maxDispInfo=memberMaxDisplacementV1261(D,index);
 return{analysisLabel:loadSet.label,analysisSpec:spec,D,R,K,F,index,memberForces,maxDisp:maxDispInfo.abs,maxDispInfo,analyzedAt:new Date().toISOString(),freeDof:free.length,fixedDof:fixed.length,inactiveHingeDof:inactiveHingeRotations.length,residual,applied,reactions};
}
function envelopeSpecsV116(){return state.loadCombinations.length?state.loadCombinations.map(c=>'COMB:'+c.id):state.loadCases.map(c=>'CASE:'+c.id)}
function buildEnvelopeV116(specs){
 const results=[];for(const spec of specs){let r=state.resultsByAnalysis.get(spec);if(!r){r=solveAnalysisSpecV116(spec);state.resultsByAnalysis.set(spec,r)}results.push(r)}
 const rows=state.members.map(m=>{const vals=[];for(const r of results){const f=r.memberForces.find(x=>x.id===m.id);if(f)vals.push({r,f})}const ext=(getter)=>{let mn=null,mx=null;for(const x of vals)for(const v of getter(x.f)){if(!mn||v<mn.v)mn={v,spec:x.r.analysisSpec,label:x.r.analysisLabel};if(!mx||v>mx.v)mx={v,spec:x.r.analysisSpec,label:x.r.analysisLabel}}return{min:mn,max:mx}};return{id:m.id,N:ext(f=>memberDiagramSamplesV117(f).map(p=>p.N)),V:ext(f=>memberDiagramSamplesV117(f).map(p=>p.V)),M:ext(f=>memberDiagramSamplesV117(f).map(p=>p.M))}});
 let disp=null;for(const r of results)for(const n of state.nodes){const q=r.index.get(n.id)*3;for(const [dof,v] of [['Ux',r.D[q]],['Uy',r.D[q+1]]])if(!disp||Math.abs(v)>Math.abs(disp.v))disp={v,node:n.id,dof,spec:r.analysisSpec,label:r.analysisLabel}}
 return{results,rows,disp};
}
function csvEnvelopeV116(env){const lines=['Member,Nmin,Nmin Analysis,Nmax,Nmax Analysis,Vmin,Vmin Analysis,Vmax,Vmax Analysis,Mmin,Mmin Analysis,Mmax,Mmax Analysis'];for(const x of env.rows)lines.push([x.id,x.N.min?.v,x.N.min?.label,x.N.max?.v,x.N.max?.label,x.V.min?.v,x.V.min?.label,x.V.max?.v,x.V.max?.label,x.M.min?.v,x.M.min?.label,x.M.max?.v,x.M.max?.label].map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(','));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'}));a.download='sapudom-v1.17-result-envelope.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function resultEnvelopeDialogV116(){
 if(!state.members.length)return alert('Create a model before Result Envelope.');if(!state.loadCombinations.length&&!state.loadCases.length)return alert('No Load Cases / Combinations found.');
 try{const specs=envelopeSpecsV116(),env=buildEnvelopeV116(specs),wrap=document.createElement('div');wrap.className='eng-dialog envelope-modal';const maxM=env.rows.reduce((a,x)=>!a||Math.max(Math.abs(x.M.min?.v||0),Math.abs(x.M.max?.v||0))>a.abs?{x,abs:Math.max(Math.abs(x.M.min?.v||0),Math.abs(x.M.max?.v||0))}:a,null);wrap.innerHTML=`<div class="eng-card envelope-card"><div class="section-db-head"><div><h2>◆ Result Envelope — V1.17.1 Fix</h2><small>${specs.length} ${state.loadCombinations.length?'Load Combination(s)':'Load Case(s)'} • Max/Min + Critical Analysis</small></div><button class="ml-close" id="envClose">×</button></div><div class="envelope-summary"><div><b>${specs.length}</b><span>Analyses</span></div><div><b>${env.disp?(Math.abs(env.disp.v)*1000).toFixed(3):'0'} mm</b><span>Max |Displacement| • ${env.disp?.label||'-'}</span></div><div><b>${maxM?maxM.abs.toFixed(2):'0'} kN·m</b><span>Max |Moment| • M${maxM?.x.id||'-'}</span></div></div><div class="envelope-table-wrap"><table class="envelope-table"><tr><th>Member</th><th>N min / max (kN)</th><th>Critical N</th><th>V min / max (kN)</th><th>Critical V</th><th>M min / max (kN·m)</th><th>Critical M</th></tr>${env.rows.map(x=>`<tr data-env-member="${x.id}"><td>M${x.id}</td><td>${fmt(x.N.min?.v||0,2)} / ${fmt(x.N.max?.v||0,2)}</td><td>${x.N.min?.label||'-'}<br>${x.N.max?.label||'-'}</td><td>${fmt(x.V.min?.v||0,2)} / ${fmt(x.V.max?.v||0,2)}</td><td>${x.V.min?.label||'-'}<br>${x.V.max?.label||'-'}</td><td>${fmt(x.M.min?.v||0,2)} / ${fmt(x.M.max?.v||0,2)}</td><td>${x.M.min?.label||'-'}<br>${x.M.max?.label||'-'}</td></tr>`).join('')}</table></div><div class="eng-actions"><button id="envCsv">⬇ Export Envelope CSV</button><button id="envClose2" class="secondary">Close</button></div></div>`;document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('#envClose').onclick=close;wrap.querySelector('#envClose2').onclick=close;wrap.querySelector('#envCsv').onclick=()=>csvEnvelopeV116(env);wrap.onclick=e=>{if(e.target===wrap)close()};wrap.querySelectorAll('[data-env-member]').forEach(tr=>tr.onclick=()=>{setSingleMemberSelection(Number(tr.dataset.envMember));updateUI();render();toast('Critical envelope member M'+tr.dataset.envMember)});toast('Result Envelope completed — '+specs.length+' analyses')
 }catch(err){console.error(err);alert('Envelope failed: '+err.message)}
}

function analyze(){try{
 validateModel();
 const loadSet=analysisLoads();
 const index=new Map(state.nodes.map((n,i)=>[n.id,i]));const nd=state.nodes.length*3,K=zeros(nd,nd),F=Array(nd).fill(0),els=[];
 for(const n of state.nodes){const l=loadSet.loads.get(n.id)||emptyLoad(),q=index.get(n.id)*3;F[q]=Number(l.fx||0);F[q+1]=Number(l.fy||0);F[q+2]=Number(l.mz||0)}
 for(const m of state.members){const e=elementData(m),ii=index.get(m.i)*3,jj=index.get(m.j)*3,dofs=[ii,ii+1,ii+2,jj,jj+1,jj+2],pFull=memberEquivalentLocal(loadSet.memberLoads?.get(m.id)||[],e.L,e.c,e.s),rel=applyEndReleases(e.kFull,pFull,e.released),kg=matMul(transpose(e.T),matMul(rel.kEff,e.T)),pGlobal=matVec(transpose(e.T),rel.pEff);for(let a=0;a<6;a++){for(let b=0;b<6;b++)K[dofs[a]][dofs[b]]+=kg[a][b];F[dofs[a]]+=pGlobal[a]}els.push({...e,m,dofs,pFull,rel})}
 const fixed=[];for(const n of state.nodes){const q=index.get(n.id)*3;restraints(n).forEach((v,i)=>{if(v)fixed.push(q+i)})}
 // A rotational DOF at a true hinge can be intentionally disconnected from all
 // element stiffnesses. Keeping that zero row in Kff makes the global matrix
 // singular even though the translations are properly connected. Remove only
 // rotations whose every incident member end has Mz released; translational
 // mechanism DOFs are never silently removed.
 const inactiveHingeRotations=[];
 for(const n of state.nodes){
  const incident=state.members.filter(m=>m.i===n.id||m.j===n.id);
  if(!incident.length)continue;
  const allReleased=incident.every(m=>m.i===n.id?!!m.releases?.i?.mz:!!m.releases?.j?.mz);
  if(allReleased){
   const rz=index.get(n.id)*3+2;
   if(!fixed.includes(rz))inactiveHingeRotations.push(rz);
  }
 }
 const inactiveSet=new Set(inactiveHingeRotations);
 const free=Array.from({length:nd},(_,i)=>i).filter(i=>!fixed.includes(i)&&!inactiveSet.has(i));
 if(!free.length)throw new Error('ບໍ່ມີ Free DOF ໃຫ້ວິເຄາະ');
 const Kff=free.map(i=>free.map(j=>K[i][j])),Ff=free.map(i=>F[i]),uf=solveLinear(Kff,Ff),D=Array(nd).fill(0);free.forEach((d,i)=>D[d]=uf[i]);
 const KD=matVec(K,D),R=KD.map((x,i)=>x-F[i]);
 const memberForces=els.map(e=>{const dg=e.dofs.map(d=>D[d]),dl=matVec(e.T,dg),full=[...dl];if(e.rel.released.length){const ds=e.rel.retained.map(i=>dl[i]),rhs=e.rel.released.map(i=>e.pFull[i]).map((v,i)=>v-matVec(e.rel.Krs,ds)[i]),dr=matVec(e.rel.inv,rhs);e.rel.released.forEach((idx,i)=>full[idx]=dr[i])}const q=matVec(e.kFull,full).map((v,i)=>v-(e.pFull?.[i]||0));for(const idx of e.rel.released)q[idx]=0;return{id:e.m.id,i:e.m.i,j:e.m.j,L:e.L,c:e.c,s:e.s,local:q,releases:e.m.releases,loads:JSON.parse(JSON.stringify(loadSet.memberLoads?.get(e.m.id)||[]))}});
 const residual=free.length?Math.max(...free.map(i=>Math.abs(KD[i]-F[i]))):0;
 const applied={fx:state.nodes.reduce((s,n)=>s+F[index.get(n.id)*3],0),fy:state.nodes.reduce((s,n)=>s+F[index.get(n.id)*3+1],0),mz:state.nodes.reduce((s,n)=>s+F[index.get(n.id)*3+2],0)};
 const reactions={fx:state.nodes.reduce((s,n)=>s+R[index.get(n.id)*3],0),fy:state.nodes.reduce((s,n)=>s+R[index.get(n.id)*3+1],0),mz:state.nodes.reduce((s,n)=>s+R[index.get(n.id)*3+2],0)};
 const maxDispInfo=memberMaxDisplacementV1261(D,index);
 state.results={analysisLabel:loadSet.label,analysisSpec:state.activeAnalysis,D,R,K,F,index,memberForces,maxDisp:maxDispInfo.abs,maxDispInfo,analyzedAt:new Date().toISOString(),freeDof:free.length,fixedDof:fixed.length,inactiveHingeDof:inactiveHingeRotations.length,residual,applied,reactions};
 state.resultsByAnalysis.set(state.activeAnalysis,state.results);
 updateResultModeButtons();setResultView('deformed',false);$('statusText').textContent='ວິເຄາະສຳເລັດ • '+loadSet.label+' • Residual '+residual.toExponential(2);renderResults();toast('ວິເຄາະສຳເລັດ — ເລືອກ N / V / M ໄດ້ແລ້ວ')
 }catch(err){console.error(err);alert(err.message);$('statusText').textContent='ວິເຄາະບໍ່ສຳເລັດ'}}
const fmt=(v,d=5)=>Math.abs(v)<1e-10?'0':Number(v).toFixed(d);
function localLoadComponentsV117(value,dir,c,s){return dir==='GLOBAL_Y'?[value*s,value*c]:dir==='GLOBAL_X'?[value*c,-value*s]:[0,value]}
function linearLoadIntegralsV117(qa,qb,a,b,x){
 if(x<=a||b<=a)return{area:0,kernel:0};const u=Math.min(x,b)-a;if(u<=0)return{area:0,kernel:0};const k=(qb-qa)/(b-a),area=qa*u+.5*k*u*u,first=.5*qa*u*u+(k/3)*u*u*u;return{area,kernel:(x-a)*area-first}
}
function memberDiagramSamplesV117(f,count=61){
 const L=Number(f.L)||1,c=Number.isFinite(f.c)?f.c:1,s=Number.isFinite(f.s)?f.s:0,loads=f.loads||[],events=[];
 for(const ld of loads){if(ld.type==='TRAP')events.push(Number(ld.a??0),Number(ld.b??L));else events.push(Number(ld.x??((Number(ld.r)||0)*L)))}
 const eps=Math.max(1e-7,L*1e-6),xs=[];for(let i=0;i<count;i++)xs.push(L*i/(count-1));for(const x0 of events)if(Number.isFinite(x0)){const x=Math.max(0,Math.min(L,x0));xs.push(x);if(x>0)xs.push(Math.max(0,x-eps));if(x<L)xs.push(Math.min(L,x+eps))}
 const xvals=[...new Set(xs.map(x=>Math.round(x*1e9)/1e9))].sort((a,b)=>a-b),Ni=f.local[0],Vi=f.local[1],Mi=f.local[2],targetN=-f.local[3],targetV=-f.local[4],targetM=-f.local[5];
 function rawAt(x){let N=Ni,V=Vi,M=Mi-Vi*x;
  for(const ld of loads){
   if(ld.type==='TRAP'){
    const a=Math.max(0,Math.min(L,Number(ld.a??0))),b=Math.max(a,Math.min(L,Number(ld.b??L))),[ax1,tr1]=localLoadComponentsV117(Number(ld.w1)||0,ld.direction||'LOCAL_Y',c,s),[ax2,tr2]=localLoadComponentsV117(Number(ld.w2)||0,ld.direction||'LOCAL_Y',c,s),ia=linearLoadIntegralsV117(ax1,ax2,a,b,x),it=linearLoadIntegralsV117(tr1,tr2,a,b,x);N+=ia.area;V+=it.area;M-=it.kernel
   }else if(ld.type==='POINT'){
    const xp=Math.max(0,Math.min(L,Number(ld.x??((Number(ld.r)||0)*L)))),[ax,tr]=localLoadComponentsV117(Number(ld.P)||0,ld.direction||'LOCAL_Y',c,s);if(x>=xp){N+=ax;V+=tr;M-=tr*(x-xp)}
   }else if(ld.type==='MOMENT'){
    const xp=Math.max(0,Math.min(L,Number(ld.x??((Number(ld.r)||0)*L))));if(x>=xp)M+=Number(ld.M)||0
   }
  }
  return{N,V,M}
 }
 const end=rawAt(L),dN=targetN-end.N,dV=targetV-end.V,dM=targetM-end.M;
 return xvals.map(x=>{const r=rawAt(x),t=L?x/L:0;return{x,N:r.N+dN*t,V:r.V+dV*t,M:r.M+dM*t}})
}
function forceStats(){const r=state.results;if(!r)return null;const values={axial:[],shear:[],moment:[]};for(const f of r.memberForces){for(const p of memberDiagramSamplesV117(f)){values.axial.push(p.N);values.shear.push(p.V);values.moment.push(p.M)}}const stat=a=>({min:Math.min(...a),max:Math.max(...a),abs:Math.max(1e-12,...a.map(Math.abs))});return{axial:stat(values.axial),shear:stat(values.shear),moment:stat(values.moment)}}
// V1.26.3 Fix — member-specific N/V/M min-max for the currently selected Member.
function memberForceStatsV1263(memberId){const r=state.results;if(!r)return null;const f=r.memberForces.find(x=>x.id===Number(memberId));if(!f)return null;const pts=memberDiagramSamplesV117(f);const stat=(key)=>{const a=pts.map(p=>p[key]);return{min:Math.min(...a),max:Math.max(...a),abs:Math.max(1e-12,...a.map(Math.abs))}};return{axial:stat('N'),shear:stat('V'),moment:stat('M')}}
function scopedForceStatsV1263(){const ids=selectedMemberIds();const selected=ids.length===1?memberForceStatsV1263(ids[0]):null;return{stats:selected||forceStats(),memberId:selected?ids[0]:null,scope:selected?`Selected Member M${ids[0]}`:'Whole Model'}}
function selectedForceHtml(){if(state.selected?.type!=='member'||!state.results)return'';const f=state.results.memberForces.find(x=>x.id===state.selected.id);if(!f)return'';const pts=memberDiagramSamplesV117(f),mnM=Math.min(...pts.map(p=>p.M)),mxM=Math.max(...pts.map(p=>p.M));return`<div class="selected-result"><b>Selected Member M${f.id}</b><span>N: ${fmt(f.local[0],3)} → ${fmt(-f.local[3],3)} kN</span><span>V: ${fmt(f.local[1],3)} → ${fmt(-f.local[4],3)} kN</span><span>M ends: ${fmt(f.local[2],3)} → ${fmt(-f.local[5],3)} kN·m</span><span>M along member: ${fmt(mnM,3)} / ${fmt(mxM,3)} kN·m</span></div>`}
function renderResults(){const box=$('resultContent');if(!state.results){box.innerHTML='<div class="empty">ຍັງບໍ່ມີຜົນວິເຄາະ</div>';return}const r=state.results,s=forceStats();if(state.resultTab==='summary'){box.innerHTML=`<div class="analysis-banner"><b>${r.analysisLabel||'Load Case'}</b></div><div class="metric-grid"><div class="metric">Max displacement<b>${fmt(r.maxDisp*1000,3)} mm</b></div><div class="metric">Axial Min / Max<b>${fmt(s.axial.min,2)} / ${fmt(s.axial.max,2)} kN</b></div><div class="metric">Shear Min / Max<b>${fmt(s.shear.min,2)} / ${fmt(s.shear.max,2)} kN</b></div><div class="metric">Moment Min / Max<b>${fmt(s.moment.min,2)} / ${fmt(s.moment.max,2)} kN·m</b></div></div>${selectedForceHtml()}<div class="equilibrium"><b>Global equilibrium check</b><span>ΣFx = ${fmt(r.applied.fx+r.reactions.fx,6)} kN</span><span>ΣFy = ${fmt(r.applied.fy+r.reactions.fy,6)} kN</span><span>Residual = ${Number(r.residual).toExponential(2)}</span></div>`;return}if(state.resultTab==='disp'){box.innerHTML='<table><tr><th>Node</th><th>Ux (mm)</th><th>Uy (mm)</th><th>Rz (rad)</th></tr>'+state.nodes.map(n=>{const q=r.index.get(n.id)*3;return`<tr><td>${n.id}</td><td>${fmt(r.D[q]*1000,4)}</td><td>${fmt(r.D[q+1]*1000,4)}</td><td>${fmt(r.D[q+2],7)}</td></tr>`}).join('')+'</table>';return}if(state.resultTab==='react'){box.innerHTML='<table><tr><th>Node</th><th>Rx (kN)</th><th>Ry (kN)</th><th>Mz (kN·m)</th></tr>'+state.nodes.filter(n=>n.support!=='none').map(n=>{const q=r.index.get(n.id)*3;return`<tr><td>${n.id}</td><td>${fmt(r.R[q],4)}</td><td>${fmt(r.R[q+1],4)}</td><td>${fmt(r.R[q+2],4)}</td></tr>`}).join('')+'</table>';return}box.innerHTML='<table><tr><th>Member</th><th>Ni</th><th>Vi</th><th>Mi</th><th>Nj</th><th>Vj</th><th>Mj</th></tr>'+r.memberForces.map(x=>`<tr data-member="${x.id}"><td>${x.id}</td>${x.local.map(v=>`<td>${fmt(v,4)}</td>`).join('')}</tr>`).join('')+'</table>';box.querySelectorAll('[data-member]').forEach(tr=>tr.onclick=()=>{setSingleMemberSelection(Number(tr.dataset.member));updateUI();render();renderResults()})}
function modelScreenBounds(){const pts=state.nodes.map(n=>worldToScreen(n.x,n.y));if(!pts.length)return{w:300,h:220};const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{w:Math.max(80,Math.max(...xs)-Math.min(...xs)),h:Math.max(80,Math.max(...ys)-Math.min(...ys))}}
function automaticDiagramScale(view){const r=canvas.getBoundingClientRect(),b=modelScreenBounds();const available=Math.max(32,Math.min(100,r.height*.18,r.width*.12,Math.max(40,Math.min(b.w,b.h)*.28)));if(view==='deformed')return Math.max(.4,Math.min(4,available/60));return Math.max(.4,Math.min(4,available/55))}
function effectiveDiagramScale(view=$('viewResult').value){return state.autoDiagramScale?automaticDiagramScale(view):state.diagramScale}
function syncScaleUI(){const input=$('diagramScale');if(!input)return;input.disabled=state.autoDiagramScale;input.value=state.autoDiagramScale?effectiveDiagramScale().toFixed(1):state.diagramScale.toFixed(1);const auto=$('autoScaleToggle');if(auto)auto.checked=state.autoDiagramScale}
function drawDeformed(){const r=state.results;if(!r)return;const auto=Math.min(200,Math.max(1,60/(Math.max(r.maxDisp,1e-12)*state.view.scale))),fac=auto*effectiveDiagramScale('deformed');ctx.save();ctx.setLineDash([7,4]);ctx.strokeStyle='#1671e8';ctx.lineWidth=2.5;for(const m of state.members){const ni=state.nodes.find(n=>n.id===m.i),nj=state.nodes.find(n=>n.id===m.j),qi=r.index.get(ni.id)*3,qj=r.index.get(nj.id)*3,a=worldToScreen(ni.x+r.D[qi]*fac,ni.y+r.D[qi+1]*fac),b=worldToScreen(nj.x+r.D[qj]*fac,nj.y+r.D[qj+1]*fac);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.setLineDash([]);ctx.fillStyle='#0759c7';ctx.font='bold 12px Arial';ctx.fillText(`Deformed scale × ${effectiveDiagramScale('deformed').toFixed(1)}`,14,22);ctx.restore()}
function diagramValues(f,type){if(type==='axial')return[f.local[0],-f.local[3]];if(type==='shear')return[f.local[1],-f.local[4]];return[f.local[2],-f.local[5]]}
function drawForceDiagram(type){
 const r=state.results;if(!r)return;const globalStats=forceStats()[type],scoped=scopedForceStatsV1263(),stats=scoped.stats[type],pixel=55*effectiveDiagramScale(type)/globalStats.abs,selected=state.selected?.type==='member'?state.selected.id:null,palette={axial:['#0b7a45','#22c55e33'],shear:['#9a3412','#f9731633'],moment:['#b4232f','#ef444433']},[stroke,fill]=palette[type];ctx.save();
 for(const f of r.memberForces){const ni=state.nodes.find(n=>n.id===f.i),nj=state.nodes.find(n=>n.id===f.j),a=worldToScreen(ni.x,ni.y),b=worldToScreen(nj.x,nj.y),dx=b.x-a.x,dy=b.y-a.y,Lpx=Math.hypot(dx,dy);if(Lpx<1e-9)continue;const nx=-dy/Lpx,ny=dx/Lpx,pts=memberDiagramSamplesV117(f),key=type==='axial'?'N':type==='shear'?'V':'M',screenPts=pts.map(p=>{const t=f.L?p.x/f.L:0,base={x:a.x+dx*t,y:a.y+dy*t},off=p[key]*pixel;return{x:base.x+nx*off,y:base.y+ny*off,base,val:p[key],xLocal:p.x}});
  ctx.strokeStyle=f.id===selected?'#f59e0b':stroke;ctx.fillStyle=f.id===selected?'#f59e0b44':fill;ctx.lineWidth=f.id===selected?3:1.6;ctx.beginPath();ctx.moveTo(a.x,a.y);for(const p of screenPts)ctx.lineTo(p.x,p.y);ctx.lineTo(b.x,b.y);ctx.closePath();ctx.fill();ctx.stroke();
  if(state.showLabels&&screenPts.length){ctx.fillStyle='#111827';ctx.font='11px Arial';const first=screenPts[0],last=screenPts.at(-1);ctx.fillText(fmt(first.val,2),first.x+4,first.y-4);ctx.fillText(fmt(last.val,2),last.x+4,last.y-4);if(type==='moment'){let ex=screenPts[0];for(const p of screenPts)if(Math.abs(p.val)>Math.abs(ex.val))ex=p;if(ex!==first&&ex!==last)ctx.fillText(fmt(ex.val,2),ex.x+4,ex.y-4)}}
 }
 ctx.fillStyle='#111827';ctx.font='bold 12px Arial';const unit=type==='moment'?'kN·m':'kN',scopeLabel=scoped.memberId?`M${scoped.memberId}`:'MODEL';ctx.fillText(`${type.toUpperCase()} ${scopeLabel}  Min ${fmt(stats.min,2)} / Max ${fmt(stats.max,2)} ${unit}`,14,22);ctx.restore()
}
function setResultView(view,notify=true){
 const allowed=['model','deformed','axial','shear','moment'];if(!allowed.includes(view))view='model';
 if(view!=='model'&&!state.results){if(notify)toast('ກົດ ວິເຄາະໂຄງສ້າງ ກ່ອນ');view='model'}
 // V1.17.1 Fix — keep the force diagrams readable: load text labels are hidden automatically in result views.
 // The user's Model-view preference is remembered and restored when returning to Model.
 if(view==='model') state.showLoadLabels=state.modelLoadLabels!==false;
 else state.showLoadLabels=false;
 const loadLabelToggle=$('loadLabelToggle');if(loadLabelToggle){loadLabelToggle.checked=state.showLoadLabels;loadLabelToggle.disabled=view!=='model';loadLabelToggle.title=view!=='model'?'V1.17.1 Fix: Load labels are hidden automatically while viewing analysis diagrams.':'Show / hide load labels';}
 $('viewResult').value=view;syncScaleUI();document.querySelectorAll('.result-mode').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
 updateDiagramLegend(view);render();
}
function updateResultModeButtons(){document.querySelectorAll('.result-mode').forEach(b=>{b.disabled=b.dataset.view!=='model'&&!state.results});$('diagramHint').textContent=state.results?'ເລືອກ Model / Deformed / N / V / M':'ກົດ Analyze ກ່ອນເບິ່ງ Diagram'}
function updateDiagramLegend(view){
 const el=$('diagramLegend');if(!state.results||view==='model'){el.hidden=true;return}el.hidden=false;
 if(view==='deformed'){
  const ids=selectedMemberIds();
  const selectedInfo=ids.length===1?memberSpecificMaxDisplacementV1262(ids[0],state.results.D,state.results.index):null;
  const d=selectedInfo||state.results.maxDispInfo;
  const maxValue=selectedInfo?selectedInfo.abs:state.results.maxDisp;
  const where=d?.memberId?`M${d.memberId} @ ${(d.ratio*100).toFixed(0)}%`:d?.nodeId?`Node ${d.nodeId}`:'—';
  const scope=selectedInfo?`Selected Member M${ids[0]}`:'Whole Model';
  el.innerHTML=`<b>Deformed Shape</b><div class="legend-row"><span>Max displacement</span><strong>${fmt(maxValue*1000,3)} mm</strong></div><div class="legend-row"><span>Location</span><strong>${where}</strong></div><div class="legend-row"><span>Scope</span><strong>${scope}</strong></div><div class="legend-row"><span>Scale</span><strong>× ${effectiveDiagramScale('deformed').toFixed(1)}</strong></div><small>V1.26.2 Fix • member-specific displacement when one Member is selected</small>`;return
 }
 const scoped=scopedForceStatsV1263(),st=scoped.stats[view],unit=view==='moment'?'kN·m':'kN',name={axial:'Axial Force (N)',shear:'Shear Force (V)',moment:'Bending Moment (M)'}[view];el.innerHTML=`<b>${name}</b><div class="legend-row legend-min"><span>Min</span><strong>${fmt(st.min,2)} ${unit}</strong></div><div class="legend-row legend-max"><span>Max</span><strong>${fmt(st.max,2)} ${unit}</strong></div><div class="legend-row"><span>Scope</span><strong>${scoped.scope}</strong></div><small>V1.26.3 Fix • member-specific result range • Scale × ${effectiveDiagramScale(view).toFixed(1)}${state.autoDiagramScale?' (Auto)':''} • Values ${state.showLabels?'ON':'OFF'}</small>`
}
function clearResults(){state.results=null;state.resultsByAnalysis.delete(state.activeAnalysis);setResultView('model',false);updateResultModeButtons();renderResults();render();$('statusText').textContent='ລ້າງຜົນແລ້ວ'}
function cloudClient(){const u=window.SAPUDOM_SUPABASE_URL,k=window.SAPUDOM_SUPABASE_ANON_KEY;if(!u||!k||!window.supabase)return null;return window.supabase.createClient(u,k)}
async function cloudDialog(){
 const sb=cloudClient();
 if(!sb){alert('Supabase ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ. ໃສ່ Project URL ແລະ Anon Key ໃນ supabase-config.js ແລະ run supabase-setup.sql');return}
 const wrap=document.createElement('div');wrap.className='cloud-dialog';
 wrap.innerHTML='<div class="cloud-card"><h2>☁ Supabase Cloud — V1.17.1 Fix</h2><div id="cloudBody">ກຳລັງໂຫຼດ...</div><button id="cloudClose">ປິດ</button></div>';
 document.body.appendChild(wrap);wrap.querySelector('#cloudClose').onclick=()=>wrap.remove();const body=wrap.querySelector('#cloudBody');
 const {data:{session}}=await sb.auth.getSession();
 if(!session){
  body.innerHTML='<input id="cloudEmail" type="email" placeholder="Email"><input id="cloudPass" type="password" placeholder="Password"><div class="cloud-actions"><button id="cloudLogin">Login</button><button id="cloudSignup">Sign up</button></div>';
  const auth=async signup=>{const email=wrap.querySelector('#cloudEmail').value,password=wrap.querySelector('#cloudPass').value;const res=signup?await sb.auth.signUp({email,password}):await sb.auth.signInWithPassword({email,password});if(res.error)alert(res.error.message);else{wrap.remove();cloudDialog()}};
  wrap.querySelector('#cloudLogin').onclick=()=>auth(false);wrap.querySelector('#cloudSignup').onclick=()=>auth(true);return
 }
 const refresh=async()=>{
  const {data,error}=await sb.from('structure_projects').select('id,name,updated_at,model').order('updated_at',{ascending:false});
  if(error){body.textContent=error.message;return}
  body.innerHTML='<div class="cloud-actions"><button id="cloudSave">Save current / Replace same name</button><button id="cloudLogout">Logout</button></div><div class="cloud-list">'+data.map(x=>{const sm=snapshotSummary(x.model||{}),when=x.updated_at?new Date(x.updated_at).toLocaleString():'';return `<div class="cloud-item"><span><b>${x.name}</b><small>${when} • ${sm.members} Members • Self Weight ${sm.selfWeight}</small></span><button data-id="${x.id}">Open</button></div>`}).join('')+'</div>';
  body.querySelector('#cloudSave').onclick=async()=>{
   const model=projectSnapshot(),sum=snapshotSummary(model),name=model.projectName||'Untitled Frame';
   const {data:existing,error:findErr}=await sb.from('structure_projects').select('id').eq('name',name).order('updated_at',{ascending:false}).limit(1);
   if(findErr){alert(findErr.message);return}
   let err;
   if(existing?.length){({error:err}=await sb.from('structure_projects').update({model,name}).eq('id',existing[0].id))}
   else{({error:err}=await sb.from('structure_projects').insert({owner_id:session.user.id,name,model}))}
   if(err)alert(err.message);else{toast(`Cloud saved: ${sum.members} Members • Self Weight ${sum.selfWeight}`);refresh()}
  };
  body.querySelector('#cloudLogout').onclick=async()=>{await sb.auth.signOut();wrap.remove()};
  body.querySelectorAll('[data-id]').forEach(b=>b.onclick=async()=>{
   const {data,error}=await sb.from('structure_projects').select('model,name,updated_at').eq('id',b.dataset.id).single();
   if(error){alert(error.message);return}
   const model=data?.model||{},before=snapshotSummary(model);pushHistory();restore(model,{forceLoadsVisible:true});$('projectName').value=model.projectName||data.name||'Cloud Project';$('units').value=model.units||'kN - m';refreshLayoutAfterLoad();wrap.remove();
   const after=snapshotSummary(projectSnapshot());
   toast(`Cloud opened: ${after.members} Members • Self Weight ${after.selfWeight}`);
   if(before.selfWeight!==after.selfWeight||before.generated!==after.generated)alert('Cloud data verification warning: generated loads changed during restore. Please use JSON backup and report this project.')
  })
 };
 refresh()
}
function updateUI(){$('nodeCount').textContent=state.nodes.length;$('memberCount').textContent=state.members.length;$('supportCount').textContent=state.nodes.filter(n=>n.support!=='none').length;$('loadCount').textContent=state.nodes.filter(n=>{const l=activeNodeLoad(n);return l.fx||l.fy||l.mz}).length+state.members.reduce((s,m)=>s+activeMemberLoads(m).length,0);let html='ຍັງບໍ່ໄດ້ເລືອກ';if(state.selected?.type==='node'){const n=state.nodes.find(x=>x.id===state.selected.id);if(n)html=`<b>Node ${n.id}</b><br>X = ${n.x.toFixed(3)} m<br>Y = ${n.y.toFixed(3)} m<br>Support: ${n.support}<br>Load Case: ${state.activeLoadCase}<br>Fx = ${activeNodeLoad(n).fx} kN<br>Fy = ${activeNodeLoad(n).fy} kN<br>Mz = ${activeNodeLoad(n).mz} kN·m`}const selectedIds=selectedMemberIds();if(selectedIds.length>1){const counts={};for(const id of selectedIds){const m=state.members.find(x=>x.id===id);if(m){const k=m.sectionId||'-';counts[k]=(counts[k]||0)+1}}html=`<b>${selectedIds.length} Members selected</b><br>${selectedIds.map(x=>'M'+x).join(', ')}<hr>${Object.entries(counts).map(([k,v])=>`${state.sections.find(s=>s.id===k)?.name||k}: ${v}`).join('<br>')}`;}else if(state.selected?.type==='member'){const m=state.members.find(x=>x.id===state.selected.id);if(m){let extra='';if(state.results){const f=state.results.memberForces.find(x=>x.id===m.id);if(f)extra=`<hr><b>Analysis</b><br>N: ${fmt(f.local[0],3)} → ${fmt(-f.local[3],3)} kN<br>V: ${fmt(f.local[1],3)} → ${fmt(-f.local[4],3)} kN<br>M: ${fmt(f.local[2],3)} → ${fmt(-f.local[5],3)} kN·m`;}html=`<b>Member ${m.id}</b><br>Node ${m.i} → ${m.j}<br>Material=${state.materials.find(x=>x.id===m.materialId)?.name||m.materialId||'-'}<br>Section=${state.sections.find(x=>x.id===m.sectionId)?.name||m.sectionId||'-'}<br>E=${m.E}<br>A=${m.A}<br>I=${m.I}<br>Section Orientation=${sectionOrientationV126(m)}°<br>Release: ${releaseLabel(m)}<br>Member Loads (${state.activeLoadCase}) = ${activeMemberLoads(m).length}${extra}`;if(state.materials.some(x=>x.id===m.materialId))$('materialSelect').value=m.materialId;if(state.sections.some(x=>x.id===m.sectionId))$('sectionSelect').value=m.sectionId;$('E').value=m.E;$('A').value=m.A;$('I').value=m.I;if($('sectionOrientationSelect'))$('sectionOrientationSelect').value=String(sectionOrientationV126(m))}}$('selectionInfo').innerHTML=html;updateButtons();const currentResultView=$('viewResult')?.value;if(['deformed','axial','shear','moment'].includes(currentResultView))updateDiagramLegend(currentResultView)}
function fit(){if(!state.nodes.length){state.view={scale:55,ox:120,oy:canvas.getBoundingClientRect().height-70};render();return}const r=canvas.getBoundingClientRect(),xs=state.nodes.map(n=>n.x),ys=state.nodes.map(n=>n.y),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),dx=Math.max(2,maxx-minx),dy=Math.max(2,maxy-miny);state.view.scale=Math.min((r.width-140)/dx,(r.height-140)/dy);state.view.scale=Math.max(20,Math.min(120,state.view.scale));state.view.ox=70-minx*state.view.scale;state.view.oy=r.height-70+miny*state.view.scale;render()}

function parsePositiveList(text,count,fallback){
 const values=String(text||'').split(',').map(x=>Number(x.trim())).filter(x=>Number.isFinite(x)&&x>0);
 if(values.length===1&&count>1)return Array(count).fill(values[0]);
 if(values.length!==count)return Array(count).fill(fallback);
 return values;
}
function buildingGeneratorDialog(){
 const wrap=document.createElement('div');wrap.className='eng-dialog building-modal';
 const b=state.building||{};
 wrap.innerHTML=`<div class="eng-card building-card"><div class="section-db-head"><div><h2>Building Generator & Story Manager — V1.10</h2><small>ສ້າງ 2D Building Frame ອັດຕະໂນມັດ ຈາກ Story ແລະ Bay</small></div><button class="ml-close" id="buildingClose">×</button></div>
 <div class="building-grid"><section><h3>Geometry</h3>
 <label>Stories<input id="bgStories" type="number" min="1" max="30" value="${b.stories||5}"></label>
 <label>Bays<input id="bgBays" type="number" min="1" max="20" value="${b.bays||3}"></label>
 <label>Story heights (m)<input id="bgStoryHeights" value="${(b.storyHeights?.length?b.storyHeights:[3.5]).join(', ')}" placeholder="3.5 or 3.5,3.5,4.0"></label>
 <label>Bay widths (m)<input id="bgBayWidths" value="${(b.bayWidths?.length?b.bayWidths:[6]).join(', ')}" placeholder="6 or 5,6,5"></label>
 <label>Base support<select id="bgSupport"><option value="fixed">Fixed</option><option value="pin">Pin</option></select></label>
 <label><input id="bgReplace" type="checkbox" checked> Replace current model</label></section>
 <section><h3>Automatic properties</h3>
 <label>Column Material<select id="bgColumnMat">${state.materials.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></label>
 <label>Column Section<select id="bgColumnSec">${state.sections.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></label>
 <label>Beam Material<select id="bgBeamMat">${state.materials.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></label>
 <label>Beam Section<select id="bgBeamSec">${state.sections.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></label>
 <div class="building-preview" id="buildingPreview"></div></section></div>
 <div class="building-actions"><button class="secondary" id="buildingCancel">Cancel</button><button id="buildingGenerate" class="primary">🏢 Generate Building</button></div>
 <div class="story-manager"><h3>Story Manager</h3><div id="storyManagerBody"></div></div></div>`;
 document.body.appendChild(wrap);
 const q=id=>wrap.querySelector('#'+id),close=()=>wrap.remove();q('buildingClose').onclick=close;q('buildingCancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
 const updatePreview=()=>{const s=Math.max(1,Number(q('bgStories').value)||1),bay=Math.max(1,Number(q('bgBays').value)||1);q('buildingPreview').innerHTML=`<b>${s}-Story / ${bay}-Bay Frame</b><span>Nodes: ${(s+1)*(bay+1)}</span><span>Columns: ${s*(bay+1)}</span><span>Beams: ${s*bay}</span><span>Total Members: ${s*(bay+1)+s*bay}</span>`};
 ['bgStories','bgBays'].forEach(id=>q(id).oninput=updatePreview);updatePreview();
 function renderStoryManager(){const levels=(state.building?.levels||[]);q('storyManagerBody').innerHTML=levels.length?`<table><tr><th>Story</th><th>Elevation (m)</th><th>Members</th><th></th></tr>${levels.slice(1).map((y,i)=>{const low=levels[i],high=y;const ids=state.members.filter(m=>{const a=state.nodes.find(n=>n.id===m.i),c=state.nodes.find(n=>n.id===m.j);return a&&c&&Math.max(a.y,c.y)<=high+1e-8&&Math.min(a.y,c.y)>=low-1e-8}).map(m=>m.id);return `<tr><td>Story ${i+1}</td><td>${y.toFixed(3)}</td><td>${ids.length}</td><td><button data-story="${i+1}">Select</button></td></tr>`}).join('')}</table>`:'<div class="empty">Generate a building to manage stories.</div>';
 q('storyManagerBody').querySelectorAll('[data-story]').forEach(btn=>btn.onclick=()=>{const story=Number(btn.dataset.story);const ids=state.members.filter(m=>m.story===story).map(m=>m.id);selectMembers(ids);updateUI();render();toast(`Selected Story ${story}: ${ids.length} members`);close()});}
 renderStoryManager();
 q('buildingGenerate').onclick=()=>{
  const stories=Math.max(1,Math.min(30,Number(q('bgStories').value)||1));
  const bays=Math.max(1,Math.min(20,Number(q('bgBays').value)||1));
  const storyHeights=parsePositiveList(q('bgStoryHeights').value,stories,3.5);
  const bayWidths=parsePositiveList(q('bgBayWidths').value,bays,6);
  const colSec=state.sections.find(x=>x.id===q('bgColumnSec').value)||state.sections[0],beamSec=state.sections.find(x=>x.id===q('bgBeamSec').value)||state.sections[0];
  const colMat=state.materials.find(x=>x.id===q('bgColumnMat').value)||state.materials[0],beamMat=state.materials.find(x=>x.id===q('bgBeamMat').value)||state.materials[0];
  if(!colSec||!beamSec||!colMat||!beamMat)return alert('Material / Section is missing.');
  if(!q('bgReplace').checked&&state.nodes.length&&!confirm('Append building to current model?'))return;
  pushHistory();invalidate();
  if(q('bgReplace').checked){state.nodes=[];state.members=[];state.nextNode=1;state.nextMember=1;}
  const x=[0],y=[0];for(const w of bayWidths)x.push(x[x.length-1]+w);for(const h of storyHeights)y.push(y[y.length-1]+h);
  const nodeId=[];
  for(let r=0;r<=stories;r++){nodeId[r]=[];for(let c=0;c<=bays;c++){const n={id:state.nextNode++,x:x[c],y:y[r],story:r,support:r===0?q('bgSupport').value:'none',loads:{}};for(const lc of state.loadCases)n.loads[lc.id]=emptyLoad();n.load=n.loads[state.activeLoadCase]||emptyLoad();state.nodes.push(n);nodeId[r][c]=n.id;}}
  const addGeneratedMember=(i,j,type,story,mat,sec)=>state.members.push({id:state.nextMember++,i,j,type,story,materialId:mat.id,sectionId:sec.id,E:Number(mat.E),A:Number(sec.A),I:Number(sec.I),Iy:Number(sec.Iy||0),J:Number(sec.J||0),weight:Number(sec.weight||0),loads:Object.fromEntries(state.loadCases.map(c=>[c.id,[]]))});
  for(let r=1;r<=stories;r++)for(let c=0;c<=bays;c++)addGeneratedMember(nodeId[r-1][c],nodeId[r][c],'column',r,colMat,colSec);
  for(let r=1;r<=stories;r++)for(let c=0;c<bays;c++)addGeneratedMember(nodeId[r][c],nodeId[r][c+1],'beam',r,beamMat,beamSec);
  state.building={stories,bays,storyHeights,bayWidths,levels:y,grids:x.map((v,i)=>({id:String.fromCharCode(65+i),x:v}))};
  state.selected=null;state.multiSelectedMemberIds=new Set();migrateLoads();updateUI();fit();render();toast(`Generated ${stories}-story ${bays}-bay building`);close();
 };
}

function buildingCenterV111(){
 const wrap=document.createElement('div');wrap.className='eng-dialog building-modal';
 state.building=state.building||{};state.building.hiddenStories=state.building.hiddenStories||[];
 const mats=state.materials.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
 const secs=state.sections.map(x=>`<option value="${x.id}">${x.name}</option>`).join('');
 const cases=state.loadCases.map(x=>`<option value="${x.id}">${x.id} — ${x.name}</option>`).join('');
 wrap.innerHTML=`<div class="eng-card building-card"><div class="section-db-head"><div><h2>Building Center — V1.17.1 Fix</h2><small>2D Grid, Story Manager, Typical Floor, Floor/Wall Loads and Building Summary</small></div><button class="ml-close" id="v11Close">×</button></div>
 <div class="v111-tabs"><button class="active" data-vtab="generate">Generate</button><button data-vtab="stories">Stories</button><button data-vtab="loads">Building Loads</button><button data-vtab="summary">Summary</button></div>
 <section class="v111-pane active" data-vpane="generate"><div class="v111-grid">
  <div class="v111-card"><h3>Grid & Stories</h3><label>Number of stories<input id="v11Stories" type="number" min="1" max="100" value="${state.building.stories||5}"></label><label>Number of bays<input id="v11Bays" type="number" min="1" max="100" value="${state.building.bays||3}"></label><label>Story heights (m)<input id="v11Heights" value="${(state.building.storyHeights?.length?state.building.storyHeights:[3.5]).join(', ')}" placeholder="3.5 or 4,3.5,3.5"></label><label>Bay widths (m)<input id="v11Widths" value="${(state.building.bayWidths?.length?state.building.bayWidths:[6]).join(', ')}" placeholder="6 or 6,6,5"></label><label>Base support<select id="v11Support"><option value="fixed">Fixed</option><option value="pin">Pin</option></select></label><label><input id="v11Replace" type="checkbox" checked style="width:auto"> Replace current geometry</label></div>
  <div class="v111-card"><h3>Automatic Properties</h3><label>Column material<select id="v11ColMat">${mats}</select></label><label>Column section<select id="v11ColSec">${secs}</select></label><label>Beam material<select id="v11BeamMat">${mats}</select></label><label>Beam section<select id="v11BeamSec">${secs}</select></label><div class="v111-preview" id="v11Preview"></div><div class="v111-actions"><button class="primary" id="v11Generate">🏢 Generate Building</button></div></div>
 </div></section>
 <section class="v111-pane" data-vpane="stories"><div class="v111-grid"><div class="v111-card"><h3>Story Manager</h3><div id="v11StoryTable"></div></div><div class="v111-card"><h3>Typical Floor</h3><label>Copy from story<select id="v11CopyFrom"></select></label><label>Copy to story<select id="v11CopyTo"></select></label><label><input id="v11CopyLoads" type="checkbox" checked style="width:auto"> Copy member loads</label><label><input id="v11CopyProps" type="checkbox" checked style="width:auto"> Copy material, section and releases</label><div class="v111-actions"><button id="v11CopyStory">Copy Story Data</button><button id="v11SelectStory">Select Target Story</button></div><div class="v111-note">Typical Floor copies engineering data between existing stories. It does not duplicate geometry because the Building Generator already creates all stories.</div></div></div></section>
 <section class="v111-pane" data-vpane="loads"><div class="v111-grid"><div class="v111-card"><h3>Floor Area Load → Beam UDL</h3><label>Story<select id="v11FloorStory"></select></label><label>Load Case<select id="v11FloorCase">${cases}</select></label><label>Area load q (kN/m²)<input id="v11AreaLoad" type="number" step="any" value="-3"></label><label>Tributary width (m)<input id="v11TribWidth" type="number" min="0" step="any" value="3"></label><div class="v111-load-result" id="v11FloorResult">Equivalent UDL = -9.000 kN/m</div><div class="v111-actions"><button id="v11ApplyFloor" class="primary">Apply to Story Beams</button><button id="v11ClearFloor">Clear Story Beam Loads</button></div></div>
 <div class="v111-card"><h3>Wall Load → Selected Beams</h3><label>Load Case<select id="v11WallCase">${cases}</select></label><label>Wall height (m)<input id="v11WallH" type="number" min="0" step="any" value="3"></label><label>Wall thickness (m)<input id="v11WallT" type="number" min="0" step="any" value="0.15"></label><label>Unit weight (kN/m³)<input id="v11WallGamma" type="number" min="0" step="any" value="18"></label><div class="v111-load-result" id="v11WallResult">Wall UDL = -8.100 kN/m</div><div class="v111-actions"><button id="v11ApplyWall" class="primary">Apply to Selected Beams</button></div><div class="v111-note">Select beams in the model before opening Building Center, or use Story Manager → Select.</div></div></div></section>
 <section class="v111-pane" data-vpane="summary"><div class="v111-summary" id="v11Summary"></div><div class="v111-card" style="margin-top:12px"><h3>Model checks</h3><div id="v11Checks"></div></div></section>
 </div>`;
 document.body.appendChild(wrap);const q=id=>wrap.querySelector('#'+id),close=()=>wrap.remove();q('v11Close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
 wrap.querySelectorAll('[data-vtab]').forEach(b=>b.onclick=()=>{wrap.querySelectorAll('[data-vtab]').forEach(x=>x.classList.toggle('active',x===b));wrap.querySelectorAll('[data-vpane]').forEach(x=>x.classList.toggle('active',x.dataset.vpane===b.dataset.vtab));refreshAll()});
 function list(text,count,def){const a=String(text).split(',').map(Number).filter(x=>x>0);if(a.length===1)return Array(count).fill(a[0]);if(a.length===count)return a;return Array(count).fill(def)}
 function storyMembers(story){return state.members.filter(m=>Number(m.story)===Number(story))}
 function storyBeams(story){return storyMembers(story).filter(m=>m.type==='beam'||Math.abs((state.nodes.find(n=>n.id===m.i)?.y||0)-(state.nodes.find(n=>n.id===m.j)?.y||0))<1e-6)}
 function selectStoryInModel(story,closeAfter=true){
  const st=Number(story);
  let members=storyMembers(st);
  if(!members.length){
   const lev=levels(),top=Number(lev[st]),bottom=Number(lev[st-1]),tol=1e-6;
   members=state.members.filter(m=>{const a=state.nodes.find(n=>n.id===m.i),b=state.nodes.find(n=>n.id===m.j);if(!a||!b)return false;const isBeam=Math.abs(a.y-b.y)<tol&&Math.abs(a.y-top)<tol;const isColumn=Math.min(a.y,b.y)>=bottom-tol&&Math.max(a.y,b.y)<=top+tol&&Math.abs(Math.max(a.y,b.y)-top)<tol;return isBeam||isColumn});
  }
  const ids=members.map(m=>Number(m.id));
  if(!ids.length){alert(`No members found for Story ${st}.`);return}
  setTool('select');
  state.selectedStory=st;
  selectMembers(ids,false);
  focusMembers(ids);
  showStorySelection(st,ids);
  $('statusText').textContent=`Story ${st}: ${ids.length} Members selected`;
  toast(`Selected Story ${st}: ${ids.length} members`);
  if(closeAfter)close();
 }
 function memberSort(ms){return ms.slice().sort((a,b)=>{const ai=state.nodes.find(n=>n.id===a.i),aj=state.nodes.find(n=>n.id===a.j),bi=state.nodes.find(n=>n.id===b.i),bj=state.nodes.find(n=>n.id===b.j);const at=a.type||'',bt=b.type||'';return at.localeCompare(bt)||Math.min(ai?.x||0,aj?.x||0)-Math.min(bi?.x||0,bj?.x||0)})}
 function levels(){return state.building.levels||[]}
 function storyOptions(){const n=state.building.stories||Math.max(0,levels().length-1);return Array.from({length:n},(_,i)=>`<option value="${i+1}">Story ${i+1}</option>`).join('')}
 function preview(){const st=Math.max(1,+q('v11Stories').value||1),ba=Math.max(1,+q('v11Bays').value||1);q('v11Preview').innerHTML=`<div><b>${st}-Story / ${ba}-Bay 2D Frame</b><br>Nodes ${(st+1)*(ba+1)} • Columns ${st*(ba+1)} • Beams ${st*ba}<br><small>Grid labels A–${String.fromCharCode(65+Math.min(25,ba))}; Story 1–${st}</small></div>`}
 function refreshStories(){const opt=storyOptions();['v11CopyFrom','v11CopyTo','v11FloorStory'].forEach(id=>q(id).innerHTML=opt);const lev=levels(),hidden=new Set(state.building.hiddenStories||[]);q('v11StoryTable').innerHTML=lev.length>1?`<table class="v111-table"><tr><th>Story</th><th>Elevation</th><th>Members</th><th>Visible</th><th></th></tr>${lev.slice(1).map((y,i)=>{const st=i+1,ids=storyMembers(st);return `<tr class="${hidden.has(st)?'story-hidden':''}"><td>Story ${st}</td><td>${Number(y).toFixed(3)} m</td><td>${ids.length}</td><td><input type="checkbox" data-vis="${st}" ${hidden.has(st)?'':'checked'}></td><td><button data-select-story="${st}">Select</button></td></tr>`}).join('')}</table>`:'<div class="empty">Generate a building first.</div>';q('v11StoryTable').querySelectorAll('[data-select-story]').forEach(b=>b.onclick=()=>selectStoryInModel(+b.dataset.selectStory,true));q('v11StoryTable').querySelectorAll('[data-vis]').forEach(c=>c.onchange=()=>{const st=+c.dataset.vis,set=new Set(state.building.hiddenStories||[]);c.checked?set.delete(st):set.add(st);state.building.hiddenStories=[...set];toast(`Story ${st} visibility saved (2D display filter planned for V2.0)`);refreshStories()})}
 function refreshLoads(){const qv=+q('v11AreaLoad').value||0,tw=+q('v11TribWidth').value||0;q('v11FloorResult').textContent=`Equivalent UDL = ${(qv*tw).toFixed(3)} kN/m`;const h=+q('v11WallH').value||0,t=+q('v11WallT').value||0,g=+q('v11WallGamma').value||0;q('v11WallResult').textContent=`Wall UDL = ${(-Math.abs(h*t*g)).toFixed(3)} kN/m`}
 function refreshSummary(){const supports=state.nodes.filter(n=>n.support&&n.support!=='none').length,memberLoads=state.members.reduce((a,m)=>a+Object.values(m.loads||{}).reduce((s,x)=>s+(Array.isArray(x)?x.length:0),0),0),nodeLoads=state.nodes.reduce((a,n)=>a+Object.values(n.loads||{}).filter(l=>l&&(l.fx||l.fy||l.mz)).length,0);const stats=[['Stories',state.building.stories||0],['Bays',state.building.bays||0],['Nodes',state.nodes.length],['Members',state.members.length],['Supports',supports],['Node Loads',nodeLoads],['Member Loads',memberLoads],['Load Cases',state.loadCases.length],['Combinations',state.loadCombinations.length],['Materials',state.materials.length],['Sections',state.sections.length],['Selected Members',selectedMemberIds().length]];q('v11Summary').innerHTML=stats.map(x=>`<div class="v111-stat"><b>${x[1]}</b>${x[0]}</div>`).join('');const orphan=state.nodes.filter(n=>!state.members.some(m=>m.i===n.id||m.j===n.id)).length,zero=state.members.filter(m=>!(m.E>0&&m.A>0&&m.I>0)).length;q('v11Checks').innerHTML=`<p>${orphan?'⚠️':'✅'} Orphan nodes: ${orphan}</p><p>${zero?'⚠️':'✅'} Members with invalid E/A/I: ${zero}</p><p>✅ JSON and Cloud store the full building object and generated loads.</p>`}
 function refreshAll(){preview();refreshStories();refreshLoads();refreshSummary()}
 ['v11Stories','v11Bays','v11Heights','v11Widths'].forEach(id=>q(id).oninput=preview);['v11AreaLoad','v11TribWidth','v11WallH','v11WallT','v11WallGamma'].forEach(id=>q(id).oninput=refreshLoads);
 q('v11Generate').onclick=()=>{const stories=Math.max(1,+q('v11Stories').value||1),bays=Math.max(1,+q('v11Bays').value||1),hs=list(q('v11Heights').value,stories,3.5),ws=list(q('v11Widths').value,bays,6),cm=state.materials.find(x=>x.id===q('v11ColMat').value)||state.materials[0],cs=state.sections.find(x=>x.id===q('v11ColSec').value)||state.sections[0],bm=state.materials.find(x=>x.id===q('v11BeamMat').value)||state.materials[0],bs=state.sections.find(x=>x.id===q('v11BeamSec').value)||state.sections[0];if(q('v11Replace').checked){pushHistory();invalidate();state.nodes=[];state.members=[];state.nextNode=1;state.nextMember=1}else{pushHistory();invalidate()}const xs=[0],ys=[0];ws.forEach(v=>xs.push(xs.at(-1)+v));hs.forEach(v=>ys.push(ys.at(-1)+v));const ids=[];for(let r=0;r<=stories;r++){ids[r]=[];for(let c=0;c<=bays;c++){const n={id:state.nextNode++,x:xs[c],y:ys[r],story:r,support:r===0?q('v11Support').value:'none',loads:{}};state.loadCases.forEach(lc=>n.loads[lc.id]=emptyLoad());n.load=n.loads[state.activeLoadCase];state.nodes.push(n);ids[r][c]=n.id}}const add=(i,j,type,story,mat,sec,bay)=>{const m={id:state.nextMember++,i,j,type,story,bay,materialId:mat.id,sectionId:sec.id,E:+mat.E,A:+sec.A,I:+sec.I,Iy:+(sec.Iy||0),sectionOrientation:0,J:+(sec.J||0),weight:+(sec.weight||0),releases:{i:{mz:false},j:{mz:false}},loads:{}};state.loadCases.forEach(lc=>m.loads[lc.id]=[]);state.members.push(m)};for(let r=1;r<=stories;r++){for(let c=0;c<=bays;c++)add(ids[r-1][c],ids[r][c],'column',r,cm,cs,c);for(let c=0;c<bays;c++)add(ids[r][c],ids[r][c+1],'beam',r,bm,bs,c)}state.building={stories,bays,storyHeights:hs,bayWidths:ws,levels:ys,grids:xs.map((x,i)=>({id:String.fromCharCode(65+i),x})),storyNames:Array.from({length:stories},(_,i)=>`Story ${i+1}`),hiddenStories:[]};state.selected=null;state.multiSelectedMemberIds=new Set();migrateLoads();updateUI();fit();render();toast(`V1.17 generated ${stories}-story / ${bays}-bay building`);refreshAll()};
 q('v11CopyStory').onclick=()=>{const from=+q('v11CopyFrom').value,to=+q('v11CopyTo').value;if(!from||!to||from===to)return alert('Choose different source and target stories.');const a=memberSort(storyMembers(from)),b=memberSort(storyMembers(to));if(!a.length||a.length!==b.length)return alert('Stories must have matching geometry.');pushHistory();invalidate();for(let i=0;i<a.length;i++){if(q('v11CopyProps').checked){for(const k of ['materialId','sectionId','E','A','I','Iy','J','weight','sectionOrientation','releases'])b[i][k]=JSON.parse(JSON.stringify(a[i][k]))}if(q('v11CopyLoads').checked)b[i].loads=JSON.parse(JSON.stringify(a[i].loads||{}))}render();updateUI();toast(`Copied Story ${from} data to Story ${to}`)};
 q('v11SelectStory').onclick=()=>selectStoryInModel(+q('v11CopyTo').value,true);
 q('v11ApplyFloor').onclick=()=>{const st=+q('v11FloorStory').value,lc=q('v11FloorCase').value,w=(+q('v11AreaLoad').value||0)*(+q('v11TribWidth').value||0),beams=storyBeams(st);if(!beams.length)return alert('No beams found on this story.');pushHistory();invalidate();for(const m of beams){m.loads=m.loads||{};m.loads[lc]=m.loads[lc]||[];m.loads[lc].push({type:'TRAP',w1:w,w2:w,a:0,b:memberLength(m),direction:'LOCAL_Y',source:'FLOOR_LOAD',story:st})}render();updateUI();toast(`Applied ${w.toFixed(3)} kN/m to ${beams.length} Story ${st} beams`);refreshSummary()};
 q('v11ClearFloor').onclick=()=>{const st=+q('v11FloorStory').value,lc=q('v11FloorCase').value,beams=storyBeams(st);pushHistory();invalidate();beams.forEach(m=>{m.loads=m.loads||{};m.loads[lc]=(m.loads[lc]||[]).filter(x=>x.source!=='FLOOR_LOAD')});render();updateUI();toast(`Cleared generated floor loads on Story ${st}`);refreshSummary()};
 q('v11ApplyWall').onclick=()=>{const ids=selectedMemberIds(),beams=state.members.filter(m=>ids.includes(m.id)&&(m.type==='beam'||Math.abs((state.nodes.find(n=>n.id===m.i)?.y||0)-(state.nodes.find(n=>n.id===m.j)?.y||0))<1e-6));if(!beams.length)return alert('Select one or more beams first.');const lc=q('v11WallCase').value,w=-Math.abs((+q('v11WallH').value||0)*(+q('v11WallT').value||0)*(+q('v11WallGamma').value||0));pushHistory();invalidate();beams.forEach(m=>{m.loads=m.loads||{};m.loads[lc]=m.loads[lc]||[];m.loads[lc].push({type:'TRAP',w1:w,w2:w,a:0,b:memberLength(m),direction:'LOCAL_Y',source:'WALL_LOAD'})});render();updateUI();toast(`Applied wall load ${w.toFixed(3)} kN/m to ${beams.length} beams`);refreshSummary()};
 refreshAll()
}

function sample(){pushHistory();invalidate();state.nodes=[{id:1,x:0,y:0,support:'fixed',load:{fx:0,fy:0,mz:0}},{id:2,x:6,y:0,support:'fixed',load:{fx:0,fy:0,mz:0}},{id:3,x:12,y:0,support:'fixed',load:{fx:0,fy:0,mz:0}},{id:4,x:0,y:4,support:'none',load:{fx:0,fy:0,mz:0}},{id:5,x:6,y:4,support:'none',load:{fx:0,fy:-20,mz:0}},{id:6,x:12,y:4,support:'none',load:{fx:0,fy:0,mz:0}},{id:7,x:0,y:8,support:'none',load:{fx:0,fy:0,mz:0}},{id:8,x:6,y:8,support:'none',load:{fx:0,fy:-30,mz:0}},{id:9,x:12,y:8,support:'none',load:{fx:0,fy:0,mz:0}}];const pairs=[[1,4],[4,7],[2,5],[5,8],[3,6],[6,9],[4,5],[5,6],[7,8],[8,9]];migrateLoads();state.members=pairs.map((p,i)=>({id:i+1,i:p[0],j:p[1],E:25000000,A:.15,I:.003125,materialId:'MAT-CONC-25',sectionId:'SEC-RC-300x500',sectionOrientation:0}));state.nextNode=10;state.nextMember=11;state.selected=null;updateUI();fit();toast('ສ້າງໂມເດວຕົວຢ່າງແລ້ວ')}
function save(){const data=projectSnapshot(),sum=memberLoadPersistenceSummaryV1182(data);const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=($('projectName').value||'sapudom-project').replace(/[^a-z0-9_-]+/gi,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(`JSON saved • Member Loads ${sum.total} • Manual ${sum.manual} • Generated ${sum.generated}`)}
function openFile(file){const fr=new FileReader();fr.onload=()=>{try{const raw=JSON.parse(fr.result),d=normalizeMemberLoadPersistenceV1182(raw?.model||raw),expected=raw?.loadPersistence||memberLoadPersistenceSummaryV1182(d);pushHistory();restore(d,{forceLoadsVisible:true});$('projectName').value=d.projectName||raw.projectName||'Opened Project';$('units').value=d.units||raw.units||'kN - m';refreshLayoutAfterLoad();const after=memberLoadPersistenceSummaryV1182(projectSnapshot());const ok=Number(expected.total??after.total)===after.total&&Number(expected.manual??after.manual)===after.manual&&Number(expected.generated??after.generated)===after.generated;toast(`JSON opened • Member Loads ${after.total} • Manual ${after.manual} • Generated ${after.generated}`);if(!ok)alert(`JSON load verification warning. Saved: total ${expected.total}, manual ${expected.manual}, generated ${expected.generated}. Restored: total ${after.total}, manual ${after.manual}, generated ${after.generated}.`)}catch(e){console.error(e);alert('ໄຟລ໌ JSON ບໍ່ຖືກຕ້ອງ')}};fr.readAsText(file)}

function csvEscape(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function exportCSV(){if(!state.results){toast('ກະລຸນາວິເຄາະກ່ອນ');return}const r=state.results,rows=[['SAPUDOM Structure Analysis V1.17'],['Project',$('projectName').value],[],['JOINT DISPLACEMENTS'],['Node','Ux_mm','Uy_mm','Rz_rad']];for(const n of state.nodes){const q=r.index.get(n.id)*3;rows.push([n.id,r.D[q]*1000,r.D[q+1]*1000,r.D[q+2]])}rows.push([],['SUPPORT REACTIONS'],['Node','Rx_kN','Ry_kN','Mz_kNm']);for(const n of state.nodes.filter(n=>n.support!=='none')){const q=r.index.get(n.id)*3;rows.push([n.id,r.R[q],r.R[q+1],r.R[q+2]])}rows.push([],['MEMBER END FORCES'],['Member','Ni_kN','Vi_kN','Mi_kNm','Nj_kN','Vj_kN','Mj_kNm']);for(const f of r.memberForces)rows.push([f.id,...f.local]);const blob=new Blob([rows.map(row=>row.map(csvEscape).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=($('projectName').value||'sapudom-results').replace(/[^a-z0-9_-]+/gi,'-')+'-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('ສົ່ງອອກ CSV ແລ້ວ')}

function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1800)}


// V1.12 Drawing & Modeling Tools
function selectedModelMembers(){return selectedMemberIds().map(id=>state.members.find(m=>m.id===id)).filter(Boolean)}
function selectedModelNodeIds(){const ids=new Set();for(const m of selectedModelMembers()){ids.add(m.i);ids.add(m.j)}if(state.selected?.type==='node')ids.add(state.selected.id);return [...ids]}
function findOrCreateNodeV112(x,y,template=null,tol=1e-7){let n=state.nodes.find(q=>Math.hypot(q.x-x,q.y-y)<=tol);if(n)return n;const loads={};for(const lc of state.loadCases)loads[lc.id]=template?.loads?.[lc.id]?JSON.parse(JSON.stringify(template.loads[lc.id])):emptyLoad();n={id:state.nextNode++,x,y,support:template?.support||'none',loads};n.load=n.loads[state.activeLoadCase]||emptyLoad();state.nodes.push(n);return n}
function cloneMemberV112(src,i,j){const m=JSON.parse(JSON.stringify(src));m.id=state.nextMember++;m.i=i;m.j=j;return m}
function finalizeModelingV112(ids=[],msg='Model updated'){invalidate();state.multiSelectedMemberIds=new Set(ids);state.selected=ids.length?{type:'member',id:ids.at(-1)}:null;updateUI();render();renderResults();toast(msg)}
function copySelectedV112(dx,dy,repeat){const ms=selectedModelMembers();if(!ms.length)return alert('Select one or more Members first.');pushHistory();const created=[];for(let k=1;k<=repeat;k++){const map=new Map();for(const oldId of selectedModelNodeIds()){const old=state.nodes.find(n=>n.id===oldId);if(old)map.set(oldId,findOrCreateNodeV112(old.x+dx*k,old.y+dy*k,{...old,support:'none'}).id)}for(const m of ms){const i=map.get(m.i),j=map.get(m.j);if(!i||!j||i===j)continue;if(state.members.some(x=>(x.i===i&&x.j===j)||(x.i===j&&x.j===i)))continue;const nm=cloneMemberV112(m,i,j);state.members.push(nm);created.push(nm.id)}}finalizeModelingV112(created,`Copied ${created.length} Members`)}
function moveSelectedV112(dx,dy){const ids=selectedModelNodeIds();if(!ids.length)return alert('Select Members or a Node first.');pushHistory();for(const id of ids){const n=state.nodes.find(x=>x.id===id);if(n){n.x+=dx;n.y+=dy}}finalizeModelingV112(selectedMemberIds(),`Moved ${ids.length} Nodes`)}
function rotateSelectedV112(angleDeg){const ids=selectedModelNodeIds();if(!ids.length)return alert('Select Members or a Node first.');const ns=ids.map(id=>state.nodes.find(n=>n.id===id)).filter(Boolean),cx=ns.reduce((a,n)=>a+n.x,0)/ns.length,cy=ns.reduce((a,n)=>a+n.y,0)/ns.length,a=angleDeg*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);pushHistory();for(const n of ns){const x=n.x-cx,y=n.y-cy;n.x=cx+x*c-y*sn;n.y=cy+x*sn+y*c}finalizeModelingV112(selectedMemberIds(),`Rotated ${angleDeg}°`)}
function mirrorSelectedV112(axis){const ids=selectedModelNodeIds();if(!ids.length)return alert('Select Members or a Node first.');const ns=ids.map(id=>state.nodes.find(n=>n.id===id)).filter(Boolean),cx=ns.reduce((a,n)=>a+n.x,0)/ns.length,cy=ns.reduce((a,n)=>a+n.y,0)/ns.length;pushHistory();for(const n of ns){if(axis==='VERTICAL')n.x=2*cx-n.x;else n.y=2*cy-n.y}finalizeModelingV112(selectedMemberIds(),`Mirrored ${axis.toLowerCase()}`)}
function divideSelectedV112(parts){const ms=selectedModelMembers();if(!ms.length)return alert('Select one or more Members first.');if(parts<2||parts>50)return alert('Parts must be 2–50.');if(ms.some(m=>Object.values(m.loads||{}).some(a=>Array.isArray(a)&&a.length)))return alert('Remove or reassign Member Loads before dividing.');pushHistory();const selected=new Set(ms.map(m=>m.id)),kept=state.members.filter(m=>!selected.has(m.id)),created=[];for(const m of ms){const a=state.nodes.find(n=>n.id===m.i),b=state.nodes.find(n=>n.id===m.j);if(!a||!b)continue;const chain=[m.i];for(let k=1;k<parts;k++)chain.push(findOrCreateNodeV112(a.x+(b.x-a.x)*k/parts,a.y+(b.y-a.y)*k/parts).id);chain.push(m.j);for(let k=0;k<parts;k++){const nm=JSON.parse(JSON.stringify(m));nm.id=(k===0?m.id:state.nextMember++);nm.i=chain[k];nm.j=chain[k+1];nm.releases={i:{mz:k===0?!!m.releases?.i?.mz:false},j:{mz:k===parts-1?!!m.releases?.j?.mz:false}};kept.push(nm);created.push(nm.id)}}state.members=kept;finalizeModelingV112(created,`Divided into ${parts} parts`)}
function mergeNodesV112(tol){if(!(tol>0))return alert('Tolerance must be greater than zero.');pushHistory();const sorted=[...state.nodes].sort((a,b)=>a.id-b.id),remap=new Map(),keep=[];for(const n of sorted){const hit=keep.find(k=>Math.hypot(k.x-n.x,k.y-n.y)<=tol);if(hit){remap.set(n.id,hit.id);if(hit.support==='none'&&n.support!=='none')hit.support=n.support}else{keep.push(n);remap.set(n.id,n.id)}}for(const m of state.members){m.i=remap.get(m.i)||m.i;m.j=remap.get(m.j)||m.j}state.nodes=keep;const unique=[],keys=new Set();for(const m of state.members){if(m.i===m.j)continue;const key=[m.i,m.j].sort((a,b)=>a-b).join('-');if(keys.has(key))continue;keys.add(key);unique.push(m)}state.members=unique;finalizeModelingV112([],`Merged nodes within ${tol} m`)}
function modelingToolsV112(){const wrap=document.createElement('div');wrap.className='eng-dialog modeling-modal';wrap.innerHTML=`<div class="eng-card modeling-card"><div class="section-db-head"><div><h2>Drawing & Modeling Tools — V1.17.1 Fix</h2><small>Transform, copy and clean the selected structural model.</small></div><button class="ml-close" id="mtClose">×</button></div><div id="mtFeedback" class="modeling-feedback"><span class="feedback-dot"></span><div><b>Ready</b><small>Choose a selection or modeling command. Your last action will appear here.</small></div></div><div class="modeling-grid">
<section><h3>Selection</h3><div class="modeling-actions selection-actions"><button data-sel="ALL">All Members</button><button data-sel="BEAM">Beams</button><button data-sel="COLUMN">Columns</button><button data-sel="BRACE">Braces</button><button data-sel="INVERT">Invert</button><button data-sel="CLEAR">Clear</button></div><div id="mtSelected" class="selection-summary"><strong>${selectedMemberIds().length}</strong><span>Members selected</span></div><h3>Linear Copy</h3><div class="modeling-inputs"><label>dx (m)<input id="mtDx" type="number" step="any" value="6"></label><label>dy (m)<input id="mtDy" type="number" step="any" value="0"></label><label>Repeat<input id="mtRepeat" type="number" min="1" max="50" value="1"></label></div><button id="mtCopy" class="primary action-button">Copy Selected</button><h3>Move / Rotate / Mirror</h3><div class="modeling-inputs"><label>Move dx<input id="mtMoveX" type="number" step="any" value="0"></label><label>Move dy<input id="mtMoveY" type="number" step="any" value="0"></label><label>Angle °<input id="mtAngle" type="number" step="any" value="90"></label></div><div class="modeling-actions"><button id="mtMove" class="action-button">Move</button><button id="mtRotate" class="action-button">Rotate</button><button id="mtMirrorV" class="action-button">Mirror Vertical</button><button id="mtMirrorH" class="action-button">Mirror Horizontal</button></div></section>
<section><h3>Divide & Clean</h3><div class="modeling-inputs modeling-inputs-two"><label>Divide parts<input id="mtParts" type="number" min="2" max="50" value="2"></label><label>Merge tolerance (m)<input id="mtTol" type="number" min="0.000001" step="0.0001" value="0.001"></label></div><div class="modeling-actions"><button id="mtDivide" class="action-button">Divide Selected</button><button id="mtMerge" class="action-button">Merge Coincident Nodes</button></div><h3>Layers</h3><div class="layer-list"><label class="layer-item"><input data-layer="members" type="checkbox" ${state.layers.members!==false?'checked':''}><span>Members</span></label><label class="layer-item"><input data-layer="nodes" type="checkbox" ${state.layers.nodes!==false?'checked':''}><span>Nodes</span></label><label class="layer-item"><input data-layer="loads" type="checkbox" ${state.layers.loads!==false?'checked':''}><span>Loads</span></label><label class="layer-item"><input data-layer="supports" type="checkbox" ${state.layers.supports!==false?'checked':''}><span>Supports</span></label><label class="layer-item"><input data-layer="labels" type="checkbox" ${state.layers.labels!==false?'checked':''}><span>Labels</span></label></div><div class="modeling-note"><b>Compatibility:</b> These tools preserve Material, Section, Releases, Load Cases and JSON/Cloud data. Divide is blocked when a selected Member contains Member Loads.</div></section></div></div>`;document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('#mtClose').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};const feedback=(title,detail='',kind='ok')=>{const el=wrap.querySelector('#mtFeedback');if(!el)return;el.className=`modeling-feedback ${kind}`;el.querySelector('b').textContent=title;el.querySelector('small').textContent=detail};const pulse=(btn)=>{if(!btn)return;btn.classList.remove('clicked');void btn.offsetWidth;btn.classList.add('clicked');setTimeout(()=>btn.classList.remove('clicked'),500)};const refresh=()=>{const n=selectedMemberIds().length;wrap.querySelector('#mtSelected').innerHTML=`<strong>${n}</strong><span>${n===1?'Member selected':'Members selected'}</span>`};const syncLayers=()=>wrap.querySelectorAll('.layer-item').forEach(l=>{const x=l.querySelector('[data-layer]');l.classList.toggle('is-on',!!x?.checked)});syncLayers();
wrap.querySelectorAll('[data-sel]').forEach(b=>b.onclick=()=>{const k=b.dataset.sel;if(k==='CLEAR')clearMemberSelection();else if(k==='INVERT'){const cur=new Set(selectedMemberIds());selectMembers(state.members.filter(m=>!cur.has(m.id)).map(m=>m.id))}else if(k==='ALL')selectMembers(state.members.map(m=>m.id));else selectMembers(state.members.filter(m=>memberOrientation(m)===k.toLowerCase()).map(m=>m.id));updateUI();render();refresh();pulse(b);wrap.querySelectorAll('[data-sel]').forEach(x=>x.classList.toggle('selected-filter',x===b&&k!=='CLEAR'&&k!=='INVERT'));const n=selectedMemberIds().length;feedback(`${b.textContent.trim()} selected`,`${n} member${n===1?'':'s'} highlighted in orange on the model.`)});
const runAction=(btn,fn,title,detail)=>{btn.onclick=()=>{pulse(btn);const before=selectedMemberIds().length;fn();refresh();feedback(title,typeof detail==='function'?detail(before):detail)}};runAction(wrap.querySelector('#mtCopy'),()=>copySelectedV112(+wrap.querySelector('#mtDx').value||0,+wrap.querySelector('#mtDy').value||0,Math.max(1,+wrap.querySelector('#mtRepeat').value||1)),'Copy command applied',()=>`${selectedMemberIds().length} copied member${selectedMemberIds().length===1?' is':'s are'} now selected.`);runAction(wrap.querySelector('#mtMove'),()=>moveSelectedV112(+wrap.querySelector('#mtMoveX').value||0,+wrap.querySelector('#mtMoveY').value||0),'Move command applied',()=>`Selection moved by dx ${+wrap.querySelector('#mtMoveX').value||0} m, dy ${+wrap.querySelector('#mtMoveY').value||0} m.`);runAction(wrap.querySelector('#mtRotate'),()=>rotateSelectedV112(+wrap.querySelector('#mtAngle').value||0),'Rotate command applied',()=>`Selection rotated ${+wrap.querySelector('#mtAngle').value||0}°.`);runAction(wrap.querySelector('#mtMirrorV'),()=>mirrorSelectedV112('VERTICAL'),'Mirror Vertical applied','Selected geometry mirrored about its vertical centerline.');runAction(wrap.querySelector('#mtMirrorH'),()=>mirrorSelectedV112('HORIZONTAL'),'Mirror Horizontal applied','Selected geometry mirrored about its horizontal centerline.');runAction(wrap.querySelector('#mtDivide'),()=>divideSelectedV112(Math.max(2,+wrap.querySelector('#mtParts').value||2)),'Divide command applied',()=>`Selected members divided into ${Math.max(2,+wrap.querySelector('#mtParts').value||2)} parts.`);runAction(wrap.querySelector('#mtMerge'),()=>mergeNodesV112(+wrap.querySelector('#mtTol').value||0.001),'Merge command applied',()=>`Coincident nodes checked with tolerance ${+wrap.querySelector('#mtTol').value||0.001} m.`);wrap.querySelectorAll('[data-layer]').forEach(x=>x.onchange=()=>{state.layers[x.dataset.layer]=x.checked;render();syncLayers();feedback(`${x.dataset.layer[0].toUpperCase()+x.dataset.layer.slice(1)} layer ${x.checked?'shown':'hidden'}`,`The canvas updated immediately.`);pulse(x.closest('.layer-item'))})}


// V1.17 — Automatic Load Generator & Load Center
function normalizeSectionKeyV116(v){return String(v??'').trim().toLowerCase().replace(/[×x]/g,'x').replace(/\s+/g,' ')}
function resolveMemberSectionV116(m){
 const key=normalizeSectionKeyV116(m?.sectionId);
 let sec=state.sections.find(x=>normalizeSectionKeyV116(x.id)===key||normalizeSectionKeyV116(x.name)===key);
 if(!sec&&Number(m?.A)>0&&Number(m?.I)>0){
  sec=state.sections.find(x=>Math.abs(Number(x.A)-Number(m.A))<=Math.max(1e-9,Math.abs(Number(m.A))*1e-6)&&Math.abs(Number(x.I)-Number(m.I))<=Math.max(1e-12,Math.abs(Number(m.I))*1e-6));
 }
 return sec||null;
}
function memberUnitWeight(m){
 // Prefer the current Section Database value. Older JSON files may store a section name
 // instead of the section ID, so resolve by ID/name and finally by matching A/I.
 const sec=resolveMemberSectionV116(m);
 let w=Number(sec?.weight);
 if(!(Number.isFinite(w)&&w>0))w=Number(m?.weight);
 // Last-resort compatibility for legacy members: derive weight/length from area and
 // material type. This keeps old projects usable without rewriting their JSON.
 if(!(Number.isFinite(w)&&w>0)){
  const A=Number(m?.A||sec?.A||0);
  const matKey=String(m?.materialId||sec?.materialId||'');
  const mat=state.materials.find(x=>x.id===matKey||x.name===matKey);
  const type=String(mat?.type||'').toLowerCase();
  const gamma=type.includes('steel')?78.5:(type.includes('concrete')?24:0);
  if(A>0&&gamma>0)w=A*gamma;
 }
 return Number.isFinite(w)&&w>0?w:0;
}
function generatedLoads(source,caseId=null){
 const out=[];
 for(const m of state.members){
  for(const [lc,arr] of Object.entries(m.loads||{}))for(const ld of (Array.isArray(arr)?arr:[])){
   if(ld?.source===source && (!caseId||lc===caseId))out.push({member:m,caseId:lc,load:ld});
  }
 }
 return out;
}
function clearGeneratedLoads(source,caseId=null,memberIds=null){
 const ids=memberIds?new Set(memberIds.map(Number)):null;let removed=0;
 for(const m of state.members){if(ids&&!ids.has(m.id))continue;for(const [lc,arr] of Object.entries(m.loads||{})){if(caseId&&lc!==caseId||!Array.isArray(arr))continue;const before=arr.length;m.loads[lc]=arr.filter(ld=>ld?.source!==source);removed+=before-m.loads[lc].length}}
 return removed;
}
function applySelfWeightV115({caseId,multiplier=1,scope='ALL',replace=true}){
 const ids=scope==='SELECTED'?new Set(selectedMemberIds()):null;
 const members=state.members.filter(m=>!ids||ids.has(m.id));
 if(!members.length)return {applied:0,skipped:0,error:'Select one or more Members first.'};
 pushHistory();invalidate();if(replace)clearGeneratedLoads('SELF_WEIGHT',caseId,[...members.map(m=>m.id)]);
 let applied=0,skipped=0;
 for(const m of members){const w=memberUnitWeight(m);const L=memberLength(m);if(!(w>0&&L>0)){skipped++;continue}m.loads=m.loads||{};m.loads[caseId]=m.loads[caseId]||[];const q=-Math.abs(w*multiplier);m.loads[caseId].push({type:'TRAP',w1:q,w2:q,a:0,b:L,direction:'GLOBAL_Y',source:'SELF_WEIGHT',multiplier,generatedBy:'V1.17'});applied++}
 render();updateUI();return {applied,skipped};
}
function ensureGravityCasesV115(){
 const defs=[['SDL','Superimposed Dead Load','Dead'],['WL','Wind Load','Wind'],['EQ','Earthquake Load','Earthquake']];let added=0;
 for(const [id,name,type] of defs){if(state.loadCases.some(x=>x.id===id))continue;state.loadCases.push({id,name,type});for(const n of state.nodes){n.loads=n.loads||{};n.loads[id]=emptyLoad()}for(const m of state.members){m.loads=m.loads||{};m.loads[id]=[]}added++}
 if(added){updateEngineeringSelectors();migrateLoads();invalidate()}return added;
}
function addCombinationPresetV115(id,name,factors){
 const existing=state.loadCombinations.find(x=>x.id===id);if(existing){existing.name=name;existing.factors={...factors};return false}state.loadCombinations.push({id,name,factors:{...factors}});return true;
}
function loadCenterV115(){
 const wrap=document.createElement('div');wrap.className='eng-dialog load-center-modal';
 const cases=state.loadCases.map(x=>`<option value="${x.id}" ${x.id==='DL'?'selected':''}>${x.id} — ${x.name}</option>`).join('');
 const swCount=generatedLoads('SELF_WEIGHT').length,floorCount=generatedLoads('FLOOR_LOAD').length,wallCount=generatedLoads('WALL_LOAD').length;
 wrap.innerHTML=`<div class="eng-card load-center-card"><div class="section-db-head"><div><h2>⬇ Load Center — V1.19</h2><small>Automatic self weight, generated-load management and combination templates.</small></div><button class="ml-close" id="lc15Close">×</button></div>
 <div class="load-center-feedback" id="lc15Feedback"><b>Ready</b><span>Generated loads are stored in JSON/Cloud with the model.</span></div>
 <div class="load-center-grid"><section class="v111-card"><h3>Self Weight Generator</h3><label>Load Case<select id="lc15SWCase">${cases}</select></label><label>Self-weight multiplier<input id="lc15SWFactor" type="number" step="any" value="1"></label><label>Scope<select id="lc15SWScope"><option value="ALL">All Members</option><option value="SELECTED">Selected Members</option></select></label><label class="check-row"><input id="lc15SWReplace" type="checkbox" checked> Replace previous generated self weight in this scope</label><div class="v111-note">Uses each Section weight (kN/m) and applies it in Global Y. No manual UDL entry is required.</div><div class="v111-actions"><button id="lc15ApplySW" class="primary">Generate Self Weight</button><button id="lc15ClearSW">Clear Self Weight</button></div></section>
 <section class="v111-card"><h3>Generated Load Summary</h3><div class="v111-summary compact"><div class="v111-stat"><b id="lc15SWCount">${swCount}</b>Self Weight</div><div class="v111-stat"><b>${floorCount}</b>Floor Loads</div><div class="v111-stat"><b>${wallCount}</b>Wall Loads</div></div><p><b>Total member weight:</b> <span id="lc15TotalWeight">0</span> kN</p><p><b>Members without section weight:</b> <span id="lc15MissingWeight">0</span></p><div class="v111-actions"><button id="lc15OpenBuilding">Open Building Loads</button><button id="lc15ClearAllGenerated" class="danger">Clear ALL Generated Loads</button></div></section>
 <section class="v111-card"><h3>Load Cases & Combination Templates</h3><p>Creates useful starting templates only. The engineer must verify factors against the governing design code/project requirements.</p><div class="v111-actions"><button id="lc15EnsureCases">Add SDL / WL / EQ Cases</button></div><div class="combo-template-list"><button data-combo-template="GRAVITY">Gravity: 1.2DL + 1.6LL</button><button data-combo-template="SERVICE">Service: 1.0DL + 1.0LL</button><button data-combo-template="SDL">Gravity + SDL: 1.2DL + 1.2SDL + 1.6LL</button></div></section>
 <section class="v111-card"><h3>Safety Checks</h3><div id="lc15Checks"></div><div class="v111-actions"><button id="lc15CheckModel">✓ Check Model</button><button id="lc15Analyze" class="primary">▶ Analyze</button></div></section></div></div>`;
 document.body.appendChild(wrap);const q=id=>wrap.querySelector('#'+id),close=()=>wrap.remove();q('lc15Close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
 function feedback(title,detail){q('lc15Feedback').innerHTML=`<b>${title}</b><span>${detail||''}</span>`}
 function refresh(){let total=0,missing=0;for(const m of state.members){const w=memberUnitWeight(m),L=memberLength(m);if(w>0&&L>0)total+=w*L;else missing++}q('lc15TotalWeight').textContent=total.toFixed(3);q('lc15MissingWeight').textContent=missing;q('lc15SWCount').textContent=generatedLoads('SELF_WEIGHT').length;const noDL=!state.loadCases.some(x=>x.id==='DL'),noWeight=missing>0;q('lc15Checks').innerHTML=`<p>${noDL?'⚠️':'✅'} Dead Load case (DL): ${noDL?'missing':'available'}</p><p>${noWeight?'⚠️':'✅'} Section weight: ${missing} member(s) missing valid weight</p><p>✅ Generated loads are tagged so they can be replaced/cleared without deleting manual loads.</p>`}
 q('lc15ApplySW').onclick=()=>{const r=applySelfWeightV115({caseId:q('lc15SWCase').value,multiplier:+q('lc15SWFactor').value||0,scope:q('lc15SWScope').value,replace:q('lc15SWReplace').checked});if(r.error)return alert(r.error);feedback('Self weight generated',`${r.applied} member(s) updated; ${r.skipped} skipped because weight/length was invalid.`);toast(`Self Weight: ${r.applied} members`);refresh()};
 q('lc15ClearSW').onclick=()=>{pushHistory();invalidate();const n=clearGeneratedLoads('SELF_WEIGHT',q('lc15SWCase').value,q('lc15SWScope').value==='SELECTED'?selectedMemberIds():null);render();updateUI();feedback('Self weight cleared',`${n} generated load(s) removed. Manual loads were preserved.`);refresh()};
 q('lc15ClearAllGenerated').onclick=()=>{if(!confirm('Clear generated Self Weight, Floor Load and Wall Load? Manual loads will stay.'))return;pushHistory();invalidate();const n=clearGeneratedLoads('SELF_WEIGHT')+clearGeneratedLoads('FLOOR_LOAD')+clearGeneratedLoads('WALL_LOAD');render();updateUI();feedback('Generated loads cleared',`${n} generated load(s) removed.`);refresh()};
 q('lc15OpenBuilding').onclick=()=>{close();buildingCenterV111()};
 q('lc15EnsureCases').onclick=()=>{pushHistory();const n=ensureGravityCasesV115();feedback('Load cases checked',n?`${n} case(s) added.`:'SDL, WL and EQ already exist.');refresh()};
 wrap.querySelectorAll('[data-combo-template]').forEach(b=>b.onclick=()=>{const k=b.dataset.comboTemplate;if(k==='GRAVITY')addCombinationPresetV115('V115-GRAV','1.2DL + 1.6LL',{DL:1.2,LL:1.6});if(k==='SERVICE')addCombinationPresetV115('V115-SERV','1.0DL + 1.0LL',{DL:1,LL:1});if(k==='SDL'){ensureGravityCasesV115();addCombinationPresetV115('V115-GRAV-SDL','1.2DL + 1.2SDL + 1.6LL',{DL:1.2,SDL:1.2,LL:1.6})}updateEngineeringSelectors();invalidate();feedback('Combination template saved',b.textContent.trim());toast('Load Combination template added')});
 q('lc15CheckModel').onclick=()=>{close();modelCheckDialogV114()};q('lc15Analyze').onclick=()=>{close();analyze()};refresh();
}



// V1.18 — Load Assignment & Management
function allLoadRowsV118(){
 const rows=[];
 for(const n of state.nodes) for(const c of state.loadCases){const l=n.loads?.[c.id];if(l&&(Number(l.fx)||Number(l.fy)||Number(l.mz)))rows.push({kind:'NODE',id:n.id,caseId:c.id,type:'NODE',value:`Fx ${Number(l.fx||0).toFixed(2)}, Fy ${Number(l.fy||0).toFixed(2)}, Mz ${Number(l.mz||0).toFixed(2)}`,source:'MANUAL'});}
 for(const m of state.members) for(const c of state.loadCases) for(const [i,ld] of (m.loads?.[c.id]||[]).entries())rows.push({kind:'MEMBER',id:m.id,caseId:c.id,type:ld.type||'LOAD',value:loadValueLabel(ld),source:ld.source||'MANUAL',index:i,load:ld});
 return rows;
}
function cloneLoadForMemberV118(ld,fromMember,toMember){const c=JSON.parse(JSON.stringify(ld)),L0=memberLength(fromMember)||1,L1=memberLength(toMember)||1,r=L1/L0;if(c.type==='TRAP'){c.a=Math.max(0,Number(c.a||0)*r);c.b=Math.min(L1,Number(c.b??L0)*r)}else if(c.type==='POINT'||c.type==='MOMENT'){if(Number.isFinite(Number(c.x)))c.x=Math.max(0,Math.min(L1,Number(c.x)*r));if(Number.isFinite(Number(c.r)))c.r=Math.max(0,Math.min(1,Number(c.r)))}return c}
function loadManagerV118(){
 const wrap=document.createElement('div');wrap.className='eng-dialog v118-load-manager';
 const cases=state.loadCases.map(c=>`<option value="${c.id}">${c.id} — ${c.name}</option>`).join('');
 wrap.innerHTML=`<div class="eng-card v118-card"><div class="section-db-head"><div><h2>☷ Load Assignment Manager — V1.19</h2><small>Review, filter, copy, assign and clear loads without editing Members one-by-one.</small></div><button class="ml-close" id="v118Close">×</button></div>
 <div class="v118-toolbar"><label>Case<select id="v118Case"><option value="ALL">All Cases</option>${cases}</select></label><label>Show<select id="v118Kind"><option value="ALL">All Loads</option><option value="NODE">Node Loads</option><option value="MEMBER">Member Loads</option><option value="GENERATED">Generated Loads</option><option value="MANUAL">Manual Loads</option></select></label><input id="v118Search" placeholder="Search M7, Node 3, UDL…"><button id="v118Refresh">↻ Refresh</button></div>
 <div class="v118-stats" id="v118Stats"></div><div class="v118-table-wrap"><table class="v118-table"><thead><tr><th></th><th>Object</th><th>Case</th><th>Type</th><th>Value</th><th>Source</th><th>Action</th></tr></thead><tbody id="v118Rows"></tbody></table></div>
 <div class="v118-actions-grid"><section><h3>Multi-Member Assignment</h3><p>Uses the Members selected in the model.</p><label>Load Case<select id="v118AssignCase">${cases}</select></label><label>Type<select id="v118Type"><option value="UDL">UDL</option><option value="POINT">Point Load</option><option value="MOMENT">Moment</option></select></label><label>Direction<select id="v118Dir"><option value="GLOBAL_Y">Global Y</option><option value="GLOBAL_X">Global X</option><option value="LOCAL_Y">Local Y</option></select></label><label>Magnitude<input id="v118Mag" type="number" step="any" value="-5"></label><label>Position / start ratio (0–1)<input id="v118Pos" type="number" min="0" max="1" step="0.05" value="0.5"></label><button class="primary" id="v118Apply">Apply to Selected Members</button></section>
 <section><h3>Copy / Clear</h3><p>Select one source row in the table, then select target Members in the model.</p><button id="v118Copy">Copy Selected Load → Selected Members</button><button id="v118SelectLoaded">Select Loaded Members in Filter</button><button class="danger" id="v118Clear">Clear Loads in Current Filter</button><div class="v111-note" id="v118Feedback">Manual and generated loads remain distinguishable. JSON/Cloud use the existing model load structure.</div></section></div></div>`;
 document.body.appendChild(wrap);const q=id=>wrap.querySelector('#'+id),close=()=>wrap.remove();q('v118Close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};let selectedRow=null;
 const filtered=()=>{const cf=q('v118Case').value,k=q('v118Kind').value,term=q('v118Search').value.trim().toLowerCase();return allLoadRowsV118().filter(r=>{const objectLabel=r.kind==='MEMBER'?`M${r.id}`:`Node ${r.id}`;const aliases=r.kind==='MEMBER'?`member ${r.id} m ${r.id}`:`node ${r.id} n${r.id}`;const hay=`${objectLabel} ${aliases} ${r.kind} ${r.id} ${r.caseId} ${r.type} ${r.value} ${r.source}`.toLowerCase();return (cf==='ALL'||r.caseId===cf)&&(k==='ALL'||(k==='GENERATED'?r.source!=='MANUAL':k==='MANUAL'?r.source==='MANUAL':r.kind===k))&&(!term||hay.includes(term))})};
 function refresh(){const rows=filtered(),all=allLoadRowsV118();q('v118Stats').innerHTML=`<b>${rows.length}</b> shown &nbsp; • &nbsp; <b>${all.filter(r=>r.kind==='NODE').length}</b> node loads &nbsp; • &nbsp; <b>${all.filter(r=>r.kind==='MEMBER').length}</b> member loads &nbsp; • &nbsp; <b>${all.filter(r=>r.source!=='MANUAL').length}</b> generated`;q('v118Rows').innerHTML=rows.length?rows.map((r,i)=>`<tr><td><input type="radio" name="v118pick" data-pick="${i}"></td><td>${r.kind==='MEMBER'?'M':'Node '}${r.id}</td><td>${r.caseId}</td><td>${r.type}</td><td>${r.value}</td><td>${r.source}</td><td><button data-locate="${i}">Locate</button><button class="danger" data-delete="${i}">Delete</button></td></tr>`).join(''):`<tr><td colspan="7">No loads match this filter.</td></tr>`;q('v118Clear').disabled=rows.length===0;q('v118Clear').title=rows.length?'Clear only the loads currently shown by the active filters':'Nothing to clear — adjust the filters or search';q('v118Rows').querySelectorAll('[data-pick]').forEach(x=>x.onchange=()=>selectedRow=rows[+x.dataset.pick]);q('v118Rows').querySelectorAll('[data-locate]').forEach(x=>x.onclick=()=>{const r=rows[+x.dataset.locate];close();requestAnimationFrame(()=>{if(r.kind==='NODE'){focusNodeV114(r.id)}else{setSingleMemberSelection(Number(r.id));focusMembers([Number(r.id)]);updateUI();render()}toast(`Located ${r.kind==='MEMBER'?'Member M':'Node '}${r.id}`)})});q('v118Rows').querySelectorAll('[data-delete]').forEach(x=>x.onclick=()=>{const r=rows[+x.dataset.delete];pushHistory();invalidate();if(r.kind==='NODE')Object.assign(state.nodes.find(n=>n.id===r.id).loads[r.caseId],emptyLoad());else state.members.find(m=>m.id===r.id).loads[r.caseId].splice(r.index,1);render();updateUI();refresh()})}
 ['v118Case','v118Kind'].forEach(id=>q(id).onchange=refresh);q('v118Search').oninput=refresh;q('v118Refresh').onclick=refresh;
 q('v118Apply').onclick=()=>{const ids=selectedMemberIds();if(!ids.length)return alert('Select one or more Members in the model first.');const type=q('v118Type').value,caseId=q('v118AssignCase').value,dir=q('v118Dir').value,mag=Number(q('v118Mag').value),r=Math.max(0,Math.min(1,Number(q('v118Pos').value)||0));if(!Number.isFinite(mag))return alert('Enter a valid magnitude.');pushHistory();invalidate();for(const id of ids){const m=state.members.find(x=>x.id===id),L=memberLength(m);m.loads=m.loads||{};m.loads[caseId]=m.loads[caseId]||[];let ld;if(type==='UDL')ld={type:'TRAP',w1:mag,w2:mag,a:0,b:L,direction:dir,source:'MANUAL'};if(type==='POINT')ld={type:'POINT',P:mag,x:r*L,r,direction:dir,source:'MANUAL'};if(type==='MOMENT')ld={type:'MOMENT',M:mag,x:r*L,r,direction:'LOCAL_Z',source:'MANUAL'};m.loads[caseId].push(ld)}render();updateUI();q('v118Feedback').textContent=`Applied ${type} to ${ids.length} selected Member(s).`;refresh()};
 q('v118Copy').onclick=()=>{if(!selectedRow||selectedRow.kind!=='MEMBER')return alert('Choose one Member Load row first.');const ids=selectedMemberIds().filter(id=>id!==selectedRow.id);if(!ids.length)return alert('Select one or more target Members in the model.');const src=state.members.find(m=>m.id===selectedRow.id);pushHistory();invalidate();for(const id of ids){const m=state.members.find(x=>x.id===id);m.loads=m.loads||{};m.loads[selectedRow.caseId]=m.loads[selectedRow.caseId]||[];m.loads[selectedRow.caseId].push(cloneLoadForMemberV118(selectedRow.load,src,m))}render();updateUI();q('v118Feedback').textContent=`Copied load from M${src.id} to ${ids.length} Member(s).`;refresh()};
 q('v118SelectLoaded').onclick=()=>{const ids=[...new Set(filtered().filter(r=>r.kind==='MEMBER').map(r=>r.id))];if(!ids.length)return alert('No loaded Members in this filter.');if(typeof setMultiMemberSelection==='function')setMultiMemberSelection(ids);else{state.selected={type:'members',ids}}updateUI();render();q('v118Feedback').textContent=`Selected ${ids.length} loaded Member(s).`};
 q('v118Clear').onclick=()=>{const rows=filtered();if(!rows.length){q('v118Feedback').textContent='Nothing to clear. Adjust the filters or search first.';return}if(!confirm(`Clear ${rows.length} load assignment(s) in the current filter?`))return;pushHistory();invalidate();for(const r of [...rows].reverse()){if(r.kind==='NODE')Object.assign(state.nodes.find(n=>n.id===r.id).loads[r.caseId],emptyLoad());else{const a=state.members.find(m=>m.id===r.id).loads[r.caseId];const idx=a.indexOf(r.load);if(idx>=0)a.splice(idx,1)}}render();updateUI();selectedRow=null;refresh()};refresh();
}

document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('deleteBtn').onclick=deleteSelected;$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('fitBtn').onclick=fit;$('zoomInBtn').onclick=()=>{state.view.scale*=1.2;render()};$('zoomOutBtn').onclick=()=>{state.view.scale/=1.2;render()};$('sampleBtn').onclick=sample;$('saveBtn').onclick=save;$('openBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>e.target.files[0]&&openFile(e.target.files[0]);$('newBtn').onclick=()=>{if(confirm('ສ້າງໂຄງການໃໝ່?')){pushHistory();invalidate();state.nodes=[];state.members=[];state.nextNode=1;state.nextMember=1;state.selected=null;updateUI();render()}};$('applyPropsBtn').onclick=()=>{const ids=selectedMemberIds();if(!ids.length){toast('ເລືອກ Member ກ່ອນ');return}applyPropertyToMembers(ids,$('sectionSelect').value,$('materialSelect').value)};if($('sectionOrientationSelect'))$('sectionOrientationSelect').onchange=e=>{const ids=selectedMemberIds();if(!ids.length)return toast('Select Member first');applySectionOrientationV126(ids,Number(e.target.value))};if($('rotateSectionBtn'))$('rotateSectionBtn').onclick=()=>{const ids=selectedMemberIds();if(!ids.length)return toast('Select Member first');const m=state.members.find(x=>x.id===ids[0]),next=sectionOrientationV126(m)===90?0:90;if($('sectionOrientationSelect'))$('sectionOrientationSelect').value=String(next);applySectionOrientationV126(ids,next)};['gridToggle','snapToggle','gridSize'].forEach(id=>$(id).addEventListener('change',render));
$('releaseBtn').onclick=memberReleaseDialog;if($('loadCenterBtn'))$('loadCenterBtn').onclick=loadCenterV115;if($('loadManagerBtn'))$('loadManagerBtn').onclick=loadManagerV118;



// V1.19 — Analysis Verification & Validation Center
function verificationCenterV119(){
 const backup={nodes:state.nodes,members:state.members,loadCases:state.loadCases,loadCombinations:state.loadCombinations,activeLoadCase:state.activeLoadCase,activeAnalysis:state.activeAnalysis,results:state.results,resultsByAnalysis:state.resultsByAnalysis};
 const E=200000000,A=.01,I=.000008;
 const pct=(a,b)=>Math.abs(b)>1e-12?Math.abs((a-b)/b)*100:Math.abs(a-b)*100;
 const run=(name,nodes,members,expected,read)=>{try{state.nodes=JSON.parse(JSON.stringify(nodes));state.members=JSON.parse(JSON.stringify(members));state.loadCases=[{id:'DL',name:'Dead Load'}];state.loadCombinations=[];state.activeLoadCase='DL';state.activeAnalysis='CASE:DL';migrateLoads();const r=solveAnalysisSpecV116('CASE:DL'),actual=read(r),errs=Object.keys(expected).map(k=>pct(actual[k],expected[k])),maxErr=Math.max(...errs);return{name,ok:maxErr<=1,expected,actual,maxErr}}catch(e){return{name,ok:false,error:e.message,expected,actual:{},maxErr:Infinity}}};
 const baseM=(L)=>({id:1,i:1,j:2,E,A,I,materialId:'MAT-STEEL',sectionId:'VERIFY'});
 const tests=[];
 tests.push(run('Axial bar — P·L/EA',[{id:1,x:0,y:0,support:'fixed',load:{fx:0,fy:0,mz:0}},{id:2,x:2,y:0,support:'none',load:{fx:100,fy:0,mz:0}}],[baseM(2)],{u_mm:.1,R_kN:100},r=>({u_mm:r.D[r.index.get(2)*3]*1000,R_kN:Math.abs(r.R[r.index.get(1)*3])})));
 tests.push(run('Cantilever — tip point load',[{id:1,x:0,y:0,support:'fixed',load:{fx:0,fy:0,mz:0}},{id:2,x:3,y:0,support:'none',load:{fx:0,fy:-10,mz:0}}],[baseM(3)],{dy_mm:56.25,M_kNm:30},r=>({dy_mm:Math.abs(r.D[r.index.get(2)*3+1])*1000,M_kNm:Math.max(...r.memberForces[0].local.map(Math.abs))})));
 let m=baseM(6);m.loads={DL:[{type:'TRAP',a:0,b:6,w1:-10,w2:-10,direction:'GLOBAL_Y',source:'MANUAL'}]};
 tests.push(run('Simply supported beam — UDL',[{id:1,x:0,y:0,support:'pin',load:{fx:0,fy:0,mz:0}},{id:2,x:6,y:0,support:'roller',load:{fx:0,fy:0,mz:0}}],[m],{R1_kN:30,R2_kN:30,Mmax_kNm:45},r=>{const f=r.memberForces[0],smp=memberDiagramSamplesV117(f);return{R1_kN:Math.abs(r.R[r.index.get(1)*3+1]),R2_kN:Math.abs(r.R[r.index.get(2)*3+1]),Mmax_kNm:Math.max(...smp.map(x=>Math.abs(x.M)))}}));
 Object.assign(state,backup);
 const current=state.results?{residual:state.results.residual,fx:(state.results.applied?.fx||0)+(state.results.reactions?.fx||0),fy:(state.results.applied?.fy||0)+(state.results.reactions?.fy||0)}:null;
 const wrap=document.createElement('div');wrap.className='eng-dialog verification-modal';
 const rows=tests.map(t=>`<tr><td>${t.ok?'✅':'❌'} ${t.name}</td><td>${t.error||Object.entries(t.expected).map(([k,v])=>`${k}: ${fmt(v,3)}`).join('<br>')}</td><td>${t.error?'-':Object.entries(t.actual).map(([k,v])=>`${k}: ${fmt(v,3)}`).join('<br>')}</td><td>${Number.isFinite(t.maxErr)?t.maxErr.toFixed(3)+'%':'FAIL'}</td></tr>`).join('');
 wrap.innerHTML=`<div class="eng-card verification-card"><div class="section-db-head"><div><h2>◎ Verification Center — V1.19</h2><small>Closed-form benchmark checks + current-model equilibrium diagnostics.</small></div><button class="ml-close" id="verifyClose">×</button></div><div class="verification-summary"><div><b>${tests.filter(x=>x.ok).length}/${tests.length}</b><span>Benchmarks passed</span></div><div><b>${tests.reduce((m,x)=>Math.max(m,Number.isFinite(x.maxErr)?x.maxErr:999),0).toFixed(3)}%</b><span>Maximum benchmark error</span></div><div><b>${current?Number(current.residual||0).toExponential(2):'—'}</b><span>Current model residual</span></div></div><div class="envelope-table-wrap"><table class="envelope-table"><tr><th>Benchmark</th><th>Reference</th><th>SAPUDOM</th><th>Error</th></tr>${rows}</table></div><div class="verification-current"><h3>Current Model Check</h3>${current?`<p>ΣFx balance: <b>${fmt(current.fx,6)} kN</b> • ΣFy balance: <b>${fmt(current.fy,6)} kN</b> • Residual: <b>${Number(current.residual||0).toExponential(3)}</b></p>`:'<p>Analyze the current model first to display equilibrium diagnostics.</p>'}<p class="modeling-note"><b>Engineering note:</b> Passing built-in benchmarks verifies the implemented linear 2D frame solver against classic closed-form cases. It does not replace independent project-specific verification or design-code checks.</p></div><div class="eng-actions"><button id="verifyClose2" class="secondary">Close</button></div></div>`;
 document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('#verifyClose').onclick=close;wrap.querySelector('#verifyClose2').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};toast('Verification Center completed');
}

// V1.17 — Collapsible Analysis Results and expanded Model Space
function syncResultsPanelUI(){
 const panel=$('resultsPanel'),btn=$('toggleResultsBtn'),status=$('resultsPanelStatus'),center=document.querySelector('.center');
 if(!panel||!btn)return;
 const collapsed=panel.classList.contains('collapsed');
 btn.textContent=collapsed?'▲ Show Analysis Results':'▼ Hide Analysis Results';
 btn.setAttribute('aria-expanded',String(!collapsed));
 if(status)status.textContent=collapsed?(state.results?'Results hidden — click to show':'Results panel hidden'):(state.results?(state.results.analysisLabel||'Analysis Results'):'Analysis Results');
 center?.classList.toggle('results-collapsed',collapsed);
}
function setResultsCollapsed(collapsed,{remember=true,feedback=true}={}){
 const panel=$('resultsPanel');if(!panel)return;
 panel.classList.toggle('collapsed',!!collapsed);
 if(remember){try{localStorage.setItem('sapudom-v113-results-collapsed',collapsed?'1':'0')}catch{}}
 syncResultsPanelUI();
 requestAnimationFrame(()=>{resize();render();});
 if(feedback)toast(collapsed?'Analysis Results hidden — model space expanded':'Analysis Results shown');
}
function toggleResultsPanel(){setResultsCollapsed(!$('resultsPanel')?.classList.contains('collapsed'))}
function toggleModelSpace(){
 document.body.classList.toggle('model-space');
 const active=document.body.classList.contains('model-space'),b=$('resultsExpandBtn');
 if(b){b.textContent=active?'⛶ Exit Model Space':'⛶ Model Space';b.setAttribute('aria-pressed',String(active))}
 if(active)$('resultsPanel')?.classList.add('collapsed');
 syncResultsPanelUI();
 requestAnimationFrame(()=>{resize();render();});
 toast(active?'Model Space enabled — side panels and results hidden':'Normal workspace restored');
}
function initResultsWorkspaceV113(){
 let collapsed=false;try{collapsed=localStorage.getItem('sapudom-v113-results-collapsed')==='1'}catch{}
 setResultsCollapsed(collapsed,{remember:false,feedback:false});
 $('toggleResultsBtn').onclick=toggleResultsPanel;
 $('resultsExpandBtn').onclick=toggleModelSpace;
 document.addEventListener('keydown',e=>{
   if((e.key==='r'||e.key==='R')&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();toggleResultsPanel()}
   if(e.key==='Escape'&&document.body.classList.contains('model-space'))toggleModelSpace();
 });
}

$('buildingBtn').onclick=buildingCenterV111;$('modelingBtn').onclick=modelingToolsV112;$('libraryBtn').onclick=()=>engineeringDialog('materials');$('manageMaterialsBtn').onclick=()=>engineeringDialog('materials');$('manageSectionsBtn').onclick=sectionDatabaseDialog;$('assignBtn').onclick=assignmentDialog;$('loadCaseBtn').onclick=loadCaseDialog;$('loadCombinationBtn').onclick=loadCombinationDialog;$('materialSelect').onchange=e=>{const mat=state.materials.find(x=>x.id===e.target.value);if(mat)$('E').value=mat.E};$('sectionSelect').onchange=e=>{const sec=state.sections.find(x=>x.id===e.target.value);if(sec){$('materialSelect').value=sec.materialId;applySectionInputs(sec)}};$('activeLoadCase').onchange=e=>{state.activeLoadCase=e.target.value;state.activeAnalysis='CASE:'+state.activeLoadCase;syncActiveLoads();updateEngineeringSelectors();updateUI();render();showCachedAnalysis(state.activeAnalysis,false);toast('Load Case: '+state.activeLoadCase)};$('analysisResultSelect').onchange=e=>{state.activeAnalysis=e.target.value;showCachedAnalysis(state.activeAnalysis,true)};
canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);canvas.addEventListener('pointerup',onUp);canvas.addEventListener('pointercancel',onUp);canvas.addEventListener('wheel',onWheel,{passive:false});canvas.addEventListener('contextmenu',e=>e.preventDefault());window.addEventListener('resize',resize);
// V1.5.2 Fix: keep the canvas drawing buffer synchronized with its flex/grid container.
const canvasShell=canvas.closest('.canvas-shell');
if(window.ResizeObserver&&canvasShell){let resizeFrame=0;const canvasObserver=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(resize)});canvasObserver.observe(canvasShell);}
window.addEventListener('load',()=>{requestAnimationFrame(()=>requestAnimationFrame(resize))});window.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName))return;const k=e.key.toLowerCase();if(k==='v')setTool('select');if(k==='h')setTool('pan');if(k==='n')setTool('node');if(k==='m')setTool('member');if(k==='l')setTool('memberLoad');if(e.key==='Delete'||e.key==='Backspace')deleteSelected();if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?redo():undo()}const views={1:'model',2:'deformed',3:'axial',4:'shear',5:'moment'};if(views[e.key])setResultView(views[e.key])});

$('checkModelBtn').onclick=modelCheckDialog;if($('verifyBtn'))$('verifyBtn').onclick=verificationCenterV119;if($('designCenterBtn'))$('designCenterBtn').onclick=designCenterV120;if($('designCenterSideBtn'))$('designCenterSideBtn').onclick=designCenterV120;if($('verifySideBtn'))$('verifySideBtn').onclick=verificationCenterV119;$('checkModelSideBtn').onclick=modelCheckDialog;$('envelopeBtn').onclick=resultEnvelopeDialogV116;$('envelopeSideBtn').onclick=resultEnvelopeDialogV116;$('analyzeBtn').onclick=analyze;$('csvBtn').onclick=exportCSV;$('clearResultsBtn').onclick=clearResults;$('cloudBtn').onclick=cloudDialog;$('viewResult').onchange=e=>setResultView(e.target.value);$('autoScaleToggle').onchange=e=>{state.autoDiagramScale=e.target.checked;syncScaleUI();updateDiagramLegend($('viewResult').value);render()};$('diagramScale').oninput=e=>{state.diagramScale=Math.max(.2,Math.min(10,Number(e.target.value)||1));updateDiagramLegend($('viewResult').value);render()};$('scaleDownBtn').onclick=()=>{state.autoDiagramScale=false;state.diagramScale=Math.max(.2,state.diagramScale-.5);syncScaleUI();updateDiagramLegend($('viewResult').value);render()};$('scaleResetBtn').onclick=()=>{state.autoDiagramScale=false;state.diagramScale=1;syncScaleUI();updateDiagramLegend($('viewResult').value);render()};$('scaleUpBtn').onclick=()=>{state.autoDiagramScale=false;state.diagramScale=Math.min(10,state.diagramScale+.5);syncScaleUI();updateDiagramLegend($('viewResult').value);render()};$('labelToggle').onchange=e=>{state.showLabels=e.target.checked;updateDiagramLegend($('viewResult').value);render()};if($('loadLabelToggle'))$('loadLabelToggle').onchange=e=>{state.showLoadLabels=e.target.checked;state.modelLoadLabels=e.target.checked;render()};document.querySelectorAll('.result-mode').forEach(b=>b.onclick=()=>setResultView(b.dataset.view));document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.resultTab=b.dataset.tab;renderResults()});


function sectionProps(type,d){
 const densitySteel=78.5,densityConcrete=24;
 let A=0,Ix=0,Iy=0,J=0;
 if(type==='RC Rectangular'||type==='Steel Rectangular'){
  const b=d.b,h=d.h; A=b*h; Ix=b*h**3/12; Iy=h*b**3/12; J=Math.min(b,h)**3*Math.max(b,h)/3;
 }else if(type==='RC Circular'||type==='Steel Solid Round'){
  const D=d.D; A=Math.PI*D**2/4; Ix=Iy=Math.PI*D**4/64; J=Math.PI*D**4/32;
 }else if(type==='Steel I'){
  const h=d.h,bf=d.bf,tw=d.tw,tf=d.tf,hw=h-2*tf; A=2*bf*tf+tw*hw; Ix=(bf*h**3-(bf-tw)*hw**3)/12; Iy=(2*tf*bf**3+hw*tw**3)/12; J=(2*bf*tf**3+hw*tw**3)/3;
 }else if(type==='Steel Box'){
  const h=d.h,b=d.b,t=d.t,hi=h-2*t,bi=b-2*t; A=b*h-bi*hi; Ix=(b*h**3-bi*hi**3)/12; Iy=(h*b**3-hi*bi**3)/12; J=2*t*(b-t)**2*(h-t)**2/((b-t)+(h-t));
 }else if(type==='Steel Pipe'){
  const D=d.D,t=d.t,di=D-2*t; A=Math.PI*(D**2-di**2)/4; Ix=Iy=Math.PI*(D**4-di**4)/64; J=Math.PI*(D**4-di**4)/32;
 }else if(type==='Steel Channel'){
  const h=d.h,bf=d.bf,tw=d.tw,tf=d.tf,hw=h-2*tf; A=2*bf*tf+tw*hw; Ix=(bf*h**3-(bf-tw)*hw**3)/12; Iy=(2*tf*bf**3+hw*tw**3)/12; J=(2*bf*tf**3+hw*tw**3)/3;
 }
 const isRC=type.startsWith('RC'); const weight=A*(isRC?densityConcrete:densitySteel);
 return {A,I:Ix,Iy,J,weight,rx:A>0?Math.sqrt(Ix/A):0,ry:A>0?Math.sqrt(Iy/A):0};
}
function sectionDimensionFields(type,vals={}){
 const f=(id,label,v,step='0.001')=>`<label>${label} (m)<input data-dim="${id}" type="number" min="0.0001" step="${step}" value="${v??''}"></label>`;
 if(type==='RC Rectangular'||type==='Steel Rectangular')return f('b','b — Width',vals.b??0.30)+f('h','h — Depth',vals.h??0.50);
 if(type==='RC Circular'||type==='Steel Solid Round')return f('D','D — Diameter',vals.D??0.40);
 if(type==='Steel I'||type==='Steel Channel')return f('h','h — Overall depth',vals.h??0.30)+f('bf','bf — Flange width',vals.bf??0.15)+f('tw','tw — Web thickness',vals.tw??0.008,'0.001')+f('tf','tf — Flange thickness',vals.tf??0.012,'0.001');
 if(type==='Steel Box')return f('h','h — Height',vals.h??0.30)+f('b','b — Width',vals.b??0.20)+f('t','t — Thickness',vals.t??0.010,'0.001');
 if(type==='Steel Pipe')return f('D','D — Outside diameter',vals.D??0.219)+f('t','t — Thickness',vals.t??0.008,'0.001');
 return '';
}
function sectionPreviewSvg(type,d){
 const common='viewBox="0 0 240 180" role="img" aria-label="Section preview"';
 if(type.includes('Circular')||type.includes('Round')||type==='Steel Pipe')return `<svg ${common}><circle cx="120" cy="90" r="58" fill="#dbeafe" stroke="#174a7c" stroke-width="8"/>${type==='Steel Pipe'?'<circle cx="120" cy="90" r="38" fill="white" stroke="#174a7c" stroke-width="3"/>':''}</svg>`;
 if(type==='Steel I')return `<svg ${common}><path d="M45 28 H195 V48 H132 V132 H195 V152 H45 V132 H108 V48 H45 Z" fill="#dbeafe" stroke="#174a7c" stroke-width="4"/></svg>`;
 if(type==='Steel Channel')return `<svg ${common}><path d="M55 28 H190 V50 H82 V130 H190 V152 H55 Z" fill="#dbeafe" stroke="#174a7c" stroke-width="4"/></svg>`;
 if(type==='Steel Box')return `<svg ${common}><rect x="48" y="28" width="144" height="124" rx="2" fill="#dbeafe" stroke="#174a7c" stroke-width="8"/><rect x="72" y="52" width="96" height="76" fill="white" stroke="#174a7c" stroke-width="3"/></svg>`;
 return `<svg ${common}><rect x="55" y="30" width="130" height="120" fill="#dbeafe" stroke="#174a7c" stroke-width="5"/></svg>`;
}
function sectionDatabaseDialog(){
 const wrap=document.createElement('div');wrap.className='eng-dialog section-db-modal';wrap.innerHTML=`<div class="eng-card section-db-card"><div class="section-db-head"><div><h2>Section Database & Properties — V1.8</h2><small>ສ້າງໜ້າຕັດກຳນົດເອງໄດ້ ເຊັ່ນ 40×40 ຫຼື 60×60 cm</small></div><button class="ml-close" id="secClose">×</button></div><div id="secBody"></div></div>`;document.body.appendChild(wrap);wrap.querySelector('#secClose').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};const body=wrap.querySelector('#secBody');
 let activeFilter='ALL',selectedSectionId=$('sectionSelect').value||'';
 const render=()=>{body.innerHTML=`<div class="section-db-layout"><section><div class="section-search"><input id="secSearch" placeholder="Search section…"><button id="secExport">Export Library</button><label class="file-label">Import<input id="secImport" type="file" accept="application/json" hidden></label></div><div class="section-filters"><button data-filter="ALL" class="active">All</button><button data-filter="RC">RC</button><button data-filter="STEEL">Steel</button></div><div class="section-list" id="sectionList"></div></section><section class="section-editor"><div class="section-preview" id="sectionPreview"></div><div class="section-preset-panel"><b>Quick RC square presets</b><div><button data-preset="0.20">20×20</button><button data-preset="0.30">30×30</button><button data-preset="0.40">40×40</button><button data-preset="0.50">50×50</button><button data-preset="0.60">60×60</button></div><small>ກົດຂະໜາດເພື່ອໃສ່ b ແລະ h ອັດຕະໂນມັດ. ຄ່າໃນຟອມໃຊ້ໜ່ວຍແມັດ.</small></div><div class="eng-form section-form"><input id="v17Id" placeholder="Section ID"><input id="v17Name" placeholder="Section name"><select id="v17Mat">${state.materials.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select><select id="v17Type"><option>RC Rectangular</option><option>RC Circular</option><option>Steel I</option><option>Steel Channel</option><option>Steel Box</option><option>Steel Pipe</option><option>Steel Rectangular</option><option>Steel Solid Round</option></select></div><div class="section-dims" id="sectionDims"></div><div class="section-props" id="sectionProps"></div><div class="eng-actions"><button id="secCalc">Calculate</button><button class="primary" id="secSave">＋ Add to Library</button></div></section></div>`;
  const list=body.querySelector('#sectionList'),search=body.querySelector('#secSearch'),type=body.querySelector('#v17Type'),dims=body.querySelector('#sectionDims'),props=body.querySelector('#sectionProps'),preview=body.querySelector('#sectionPreview');
  let last=null;
  const drawList=()=>{const q=search.value.toLowerCase();const rows=state.sections.filter(x=>{const hay=(x.name+' '+x.id+' '+x.type).toLowerCase();const okText=hay.includes(q);const okFilter=activeFilter==='ALL'||(activeFilter==='RC'?x.type.startsWith('RC'):x.type.startsWith('Steel'));return okText&&okFilter});list.innerHTML=rows.map(x=>`<button class="section-row ${x.id===selectedSectionId?'selected':''}" data-id="${x.id}"><div class="section-row-top"><b>${x.name}</b><span class="section-kind ${x.type.startsWith('RC')?'rc':'steel'}">${x.type.startsWith('RC')?'RC':'STEEL'}</span></div><span>${x.type}</span><small>A = ${Number(x.A).toExponential(3)} m²<br>Ix = ${Number(x.I).toExponential(3)} m⁴</small></button>`).join('')||'<div class="empty">No matching section</div>';list.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{selectedSectionId=b.dataset.id;drawList();const x=state.sections.find(s=>s.id===b.dataset.id);$('sectionSelect').value=x.id;$('materialSelect').value=x.materialId;applySectionInputs(x);toast('Selected '+x.name)})};
  const refreshForm=(vals={})=>{dims.innerHTML=sectionDimensionFields(type.value,vals);calc()};
  const calc=()=>{const d={};dims.querySelectorAll('[data-dim]').forEach(el=>d[el.dataset.dim]=Number(el.value));if(Object.values(d).some(v=>!(v>0))){props.innerHTML='<span class="warn">Enter valid dimensions</span>';return null}if((type.value==='Steel I'||type.value==='Steel Channel')&&2*d.tf>=d.h){props.innerHTML='<span class="warn">2tf must be less than h</span>';return null}if((type.value==='Steel Box'||type.value==='Steel Pipe')&&2*d.t>=Math.min(d.h||d.D,d.b||d.D)){props.innerHTML='<span class="warn">Thickness is too large</span>';return null}last={d,p:sectionProps(type.value,d)};preview.innerHTML=sectionPreviewSvg(type.value,d);const x=last.p;props.innerHTML=`<div><b>A</b><span>${x.A.toExponential(6)} m²</span></div><div><b>Ix</b><span>${x.I.toExponential(6)} m⁴</span></div><div><b>Iy</b><span>${x.Iy.toExponential(6)} m⁴</span></div><div><b>J</b><span>${x.J.toExponential(6)} m⁴</span></div><div><b>rx</b><span>${x.rx.toFixed(4)} m</span></div><div><b>ry</b><span>${x.ry.toFixed(4)} m</span></div><div><b>Weight</b><span>${x.weight.toFixed(3)} kN/m</span></div>`;return last};
  search.oninput=drawList;type.onchange=()=>refreshForm({});body.querySelector('#secCalc').onclick=calc;
  body.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;body.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));drawList()});
  body.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{type.value='RC Rectangular';const v=Number(b.dataset.preset);body.querySelector('#v17Name').value=`RC ${Math.round(v*1000)}×${Math.round(v*1000)} mm`;body.querySelector('#v17Id').value=`SEC-RC-${Math.round(v*1000)}X${Math.round(v*1000)}`;refreshForm({b:v,h:v})});
  body.querySelector('#secSave').onclick=()=>{const c=calc(),id=body.querySelector('#v17Id').value.trim().toUpperCase(),name=body.querySelector('#v17Name').value.trim();if(!c||!id||!name)return alert('Enter ID, name and valid dimensions');if(state.sections.some(x=>x.id===id))return alert('Section ID already exists');state.sections.push({id,name,type:type.value,materialId:body.querySelector('#v17Mat').value,A:c.p.A,I:c.p.I,Iy:c.p.Iy,J:c.p.J,weight:c.p.weight,rx:c.p.rx,ry:c.p.ry,dimensions:c.d});selectedSectionId=id;persistLibraries();updateEngineeringSelectors();drawList();toast('Added section '+name)};
  body.querySelector('#secExport').onclick=()=>{const a=document.createElement('a'),blob=new Blob([JSON.stringify({version:'1.7.1',sections:state.sections},null,2)],{type:'application/json'});a.href=URL.createObjectURL(blob);a.download='sapudom-section-library-v1.8.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  body.querySelector('#secImport').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result),arr=Array.isArray(d)?d:d.sections;if(!Array.isArray(arr))throw 0;for(const x of arr)if(x.id&&x.name&&x.A>0&&x.I>0&&!state.sections.some(s=>s.id===x.id))state.sections.push(x);persistLibraries();updateEngineeringSelectors();drawList();toast('Imported section library')}catch{alert('Invalid section library')}};r.readAsText(f)};
  drawList();refreshForm();
 };render();
}



// ===== V1.24 Steel Column + Beam-Column Design — AISC 360-22 LRFD =====
// Scope: doubly-symmetric Steel I sections for strong-axis flexure, LTB (Cb input),
// flange/web compactness screening, axial strength, and 2D axial+flexure interaction.
// Web noncompact/slender and slender flange cases are flagged WARNING rather than
// being treated as a complete AISC Chapter F implementation.
function designDemandV121(m){
 const setup=state.designSetup||{};
 let specs=[];
 if(setup.designCombination&&setup.designCombination!=='ENVELOPE') specs=['COMB:'+setup.designCombination];
 else specs=state.loadCombinations.length?state.loadCombinations.map(c=>'COMB:'+c.id):state.loadCases.map(c=>'CASE:'+c.id);
 let best={N:0,V:0,M:0,analysis:'—'};
 for(const spec of specs){
  let r=state.resultsByAnalysis instanceof Map?state.resultsByAnalysis.get(spec):null;
  if(!r){try{r=solveAnalysisSpecV116(spec);if(state.resultsByAnalysis instanceof Map)state.resultsByAnalysis.set(spec,r)}catch(e){continue}}
  const f=r?.memberForces?.find(x=>x.id===m.id);if(!f)continue;
  const samples=memberDiagramSamplesV117(f);
  const N=Math.max(...samples.map(p=>Math.abs(Number(p.N)||0)),Math.abs(f.local?.[0]||0),Math.abs(f.local?.[3]||0));
  const V=Math.max(...samples.map(p=>Math.abs(Number(p.V)||0)),Math.abs(f.local?.[1]||0),Math.abs(f.local?.[4]||0));
  const M=Math.max(...samples.map(p=>Math.abs(Number(p.M)||0)),Math.abs(f.local?.[2]||0),Math.abs(f.local?.[5]||0));
  if(N>best.N||V>best.V||M>best.M) best={N:Math.max(best.N,N),V:Math.max(best.V,V),M:Math.max(best.M,M),analysis:spec};
 }
 return best;
}
function steelFlexureV122(m,d,sec,q){
 const E=Number(m.E||state.materials.find(x=>x.id===m.materialId)?.E||200000000),Fy=Number(d.fy||250000);
 const op=orientedSectionPropsV126(m,sec),dim=op.dimensions||{},orientation=op.orientation,h=Number(dim.h||0),bf=Number(dim.bf||0),tw=Number(dim.tw||0),tf=Number(dim.tf||0);
 const Ix=Number(op.I||m.I||0),Iy=Number(op.Iy||m.Iy||0),J=Number(sec.J||0),A=Number(sec.A||m.A||0);
 if(sec.type!=='Steel I'||!(h>0&&bf>0&&tw>0&&tf>0&&Ix>0&&Iy>0&&A>0&&Fy>0&&E>0))
  return {supported:false,status:'WARNING',note:'Phase 2 flexure currently requires a Steel I section with h, bf, tw, tf, Ix and Iy.'};
 const hw=h-2*tf;if(!(hw>0))return{supported:false,status:'WARNING',note:'Invalid Steel I geometry.'};
 const Sx=Ix/(h/2);
 const Zx=2*(bf*tf*(h/2-tf/2)+(tw*hw/2)*(hw/4));
 const Mp=Fy*Zx,My07=0.7*Fy*Sx;
 const root=Math.sqrt(E/Fy),lambdaF=(bf-tw)/(2*tf),lambdaW=hw/tw;
 const lpF=0.38*root,lrF=1.0*root,lpW=3.76*root,lrW=5.70*root;
 const flangeClass=lambdaF<=lpF?'Compact':lambdaF<=lrF?'Noncompact':'Slender';
 const webClass=lambdaW<=lpW?'Compact':lambdaW<=lrW?'Noncompact':'Slender';
 const ry=Number(sec.ry||(Iy/A>0?Math.sqrt(Iy/A):0)),ho=h-tf;
 const Cw=Iy*ho*ho/4;
 const rts=(Sx>0&&Cw>0)?Math.sqrt(Math.sqrt(Iy*Cw)/Sx):0;
 const Cb=Math.max(0.1,Number(d.Cb||1));
 const LbInput=Number(d.unbracedLength||0),Lb=LbInput>0?LbInput:memberLength(m);
 const Lp=ry>0?1.76*ry*Math.sqrt(E/Fy):0;
 let Lr=0;
 if(rts>0&&Sx>0&&ho>0){const t=J/(Sx*ho);Lr=1.95*rts*E/(0.7*Fy)*Math.sqrt(t+Math.sqrt(t*t+6.76*Math.pow(0.7*Fy/E,2)))}
 let MnLTB=Mp,ltbMode='Yielding';
 if(Lb>Lp&&Lr>Lp&&Lb<=Lr){MnLTB=Cb*(Mp-(Mp-My07)*(Lb-Lp)/(Lr-Lp));MnLTB=Math.min(Mp,MnLTB);ltbMode='Inelastic LTB'}
 else if(Lb>Lr&&rts>0){const rr=Lb/rts;const Fcr=Cb*Math.PI*Math.PI*E/(rr*rr)*Math.sqrt(1+0.078*(J/(Sx*ho))*rr*rr);MnLTB=Math.min(Mp,Fcr*Sx);ltbMode='Elastic LTB'}
 let MnLocal=Mp,localMode='Compact';
 if(webClass!=='Compact')return{supported:false,status:'WARNING',note:`${webClass} web: Phase 2 does not yet implement AISC F4/F5 web-local-buckling strength.`,Sx,Zx,Mp,lambdaF,lambdaW,lpF,lrF,lpW,lrW,flangeClass,webClass,Lb,Lp,Lr,Cb,ltbMode};
 if(flangeClass==='Noncompact'){MnLocal=Mp-(Mp-My07)*(lambdaF-lpF)/(lrF-lpF);localMode='Noncompact flange local buckling'}
 if(flangeClass==='Slender')return{supported:false,status:'WARNING',note:'Slender flange: Phase 2 flags this case for a later full Chapter F slender-element implementation.',Sx,Zx,Mp,lambdaF,lambdaW,lpF,lrF,lpW,lrW,flangeClass,webClass,Lb,Lp,Lr,Cb,ltbMode};
 const Mn=Math.min(Mp,MnLTB,MnLocal),phiMn=0.90*Mn,flexRatio=phiMn>0?q.M/phiMn:Infinity;
 const governing=Mn===MnLTB&&MnLTB<Mp?ltbMode:Mn===MnLocal&&MnLocal<Mp?'Flange Local Buckling':'Yielding';
 return{supported:true,status:flexRatio<=1?'PASS':'FAIL',Sx,Zx,Mp,MnLTB,MnLocal,Mn,phiMn,flexRatio,lambdaF,lambdaW,lpF,lrF,lpW,lrW,flangeClass,webClass,Lb,Lp,Lr,Cb,ltbMode,localMode,governing,note:`Strong-axis Steel I flexure; Cb=${Cb.toFixed(2)}.`,calc:{E,Fy,h,bf,tw,tf,Ix,Iy,J,A,Sx,Zx,Mp,My07,lambdaF,lambdaW,lpF,lrF,lpW,lrW,ry,Cw,rts,Cb,Lb,Lp,Lr,MnLTB,MnLocal,Mn,phiMn}};
}
function steelDesignV122(m){
 const d=designDefaultsV120(m),q=designDemandV121(m),sec=state.sections.find(x=>x.id===m.sectionId)||{};
 if(String(d.designMaterial).toLowerCase()!=='steel')return{applicable:false,q,status:'N/A',note:'Member is not assigned as Steel'};
 const op=orientedSectionPropsV126(m,sec),A=Number(sec.A||m.A||0),I=Number(op.I||m.I||0),Iy=Number(op.Iy||m.Iy||0),E=Number(m.E||state.materials.find(x=>x.id===m.materialId)?.E||200000000);
 const Fy=Number(d.fy||250000),K=Math.max(.01,Number(d.K||1)),L=memberLength(m);
 const rx=Number(A>0&&I>0?Math.sqrt(I/A):0),ry=Number(A>0&&Iy>0?Math.sqrt(Iy/A):0);
 const rvals=[rx,ry].filter(x=>x>0),rmin=rvals.length?Math.min(...rvals):0;
 if(!(A>0&&Fy>0&&L>0&&rmin>0))return{applicable:true,q,status:'WARNING',note:'Section A/r properties are incomplete'};
 const slender=K*L/rmin,Fe=Math.PI*Math.PI*E/(slender*slender),fyFe=Fy/Fe;
 const Fcr=fyFe<=2.25?Math.pow(0.658,fyFe)*Fy:0.877*Fe;
 const phiT=0.90*Fy*A,phiC=0.90*Fcr*A,phiAxial=Math.min(phiT,phiC);
 const axialRatio=phiAxial>0?q.N/phiAxial:Infinity;
 const flex=steelFlexureV122(m,d,sec,q);
 if(!flex.supported){const status=axialRatio>1?'FAIL':'WARNING';return{applicable:true,q,status,A,L,rmin,slender,Fe,Fcr,phiT,phiC,phiAxial,axialRatio,flex,interactionRatio:null,failReason:axialRatio>1?'Axial D/C exceeds 1.0':flex.note,note:flex.note}}
 const flexRatio=flex.flexRatio;
 const slenderX=rx>0?K*L/rx:Infinity,slenderY=ry>0?K*L/ry:Infinity;
 const Fex=Number.isFinite(slenderX)?Math.PI*Math.PI*E/(slenderX*slenderX):0,Fey=Number.isFinite(slenderY)?Math.PI*Math.PI*E/(slenderY*slenderY):0;
 const governingAxis=slenderX>=slenderY?'x-x':'y-y';
 const interactionBranch=axialRatio>=0.2?'H1 high-axial branch: Pu/φPn + 8/9(Mu/φMn)':'H1 low-axial branch: Pu/(2φPn) + Mu/φMn';
 const interactionRatio=axialRatio>=0.2?axialRatio+(8/9)*flexRatio:axialRatio/2+flexRatio;
 const column={slenderX,slenderY,Fex,Fey,governingAxis,interactionBranch};
 const status=(axialRatio<=1&&flexRatio<=1&&interactionRatio<=1)?'PASS':'FAIL';
 const reasons=[];if(axialRatio>1)reasons.push('Axial D/C > 1.0');if(flexRatio>1)reasons.push('Flexural D/C > 1.0');if(interactionRatio>1)reasons.push('Axial+flexure interaction > 1.0');
 return{applicable:true,q,status,A,L,rmin,slender,Fe,Fcr,phiT,phiC,phiAxial,axialRatio,flex,flexRatio,interactionRatio,column,failReason:reasons.join(' • '),note:'AISC 360-22 V1.24: axis-aware column compression + strong-axis Steel I flexure/LTB + 2D H1 interaction.'};
}
function steelDesignV123(m){return steelDesignV122(m)}
function steelDesignV121(m){return steelDesignV123(m)}
function steelDetailV122(m){
 const r=steelDesignV122(m),d=designDefaultsV120(m),sec=state.sections.find(x=>x.id===m.sectionId)||{};
 const f=r.flex||{};const val=(x,n=3)=>Number.isFinite(Number(x))?Number(x).toFixed(n):'—';
 const wrap=document.createElement('div');wrap.className='eng-dialog';wrap.innerHTML=`<div class="eng-card steel-detail-v122"><div class="section-db-head"><div><h2>Steel / Beam-Column Design Detail — M${m.id}</h2><small>${sec.name||m.sectionId||'Section'} • ${d.memberType} • Orientation ${sectionOrientationV126(m)}° • AISC 360-22 LRFD V1.26.2 Fix</small></div><button class="ml-close">×</button></div><div class="steel-detail-grid">
 <div><b>Demand</b><span>Pu = ${val(r.q?.N,2)} kN</span><span>Mu = ${val(r.q?.M,2)} kN·m</span><span>Governing = ${r.q?.analysis||'—'}</span></div>
 <div><b>Axial / Column</b><span>φPn = ${val(r.phiAxial,2)} kN</span><span>Axial D/C = ${val(r.axialRatio)}</span><span>KL/r governing = ${val(r.slender,1)}</span><span>Axis = ${r.column?.governingAxis||'—'}</span></div>
 <div><b>Flexure</b><span>φMn = ${val(f.phiMn,2)} kN·m</span><span>Flexural D/C = ${val(r.flexRatio)}</span><span>Limit state = ${f.governing||'—'}</span></div>
 <div><b>LTB</b><span>Lb = ${val(f.Lb,3)} m</span><span>Lp = ${val(f.Lp,3)} m</span><span>Lr = ${val(f.Lr,3)} m</span><span>Cb = ${val(f.Cb,2)}</span></div>
 <div><b>Local Buckling</b><span>Flange λ = ${val(f.lambdaF,2)} • ${f.flangeClass||'—'}</span><span>Web λ = ${val(f.lambdaW,2)} • ${f.webClass||'—'}</span></div>
 <div><b>Interaction</b><span>D/C = ${val(r.interactionRatio)}</span><span class="design-status ${r.status==='PASS'?'pass':r.status==='FAIL'?'fail':''}">${r.status}</span><span>${r.failReason||r.note||''}</span></div>
 </div>
 <div class="calc-details-v123"><div class="section-db-head"><div><b>Calculation Details — Trace</b><small>Transparent strong-axis Steel I design path</small></div><button class="calc-toggle-v123">Show Calculation</button></div><div class="calc-body-v123" hidden>
 <table><tbody>
 <tr><th>Section properties</th><td>Sx = ${val(f.Sx,6)} m³ • Zx = ${val(f.Zx,6)} m³</td></tr>
 <tr><th>Plastic moment</th><td>Mp = Fy·Zx = ${val(f.Mp,2)} kN·m</td></tr>
 <tr><th>Flange compactness</th><td>λf = ${val(f.lambdaF,2)} • λpf = ${val(f.lpF,2)} • λrf = ${val(f.lrF,2)} → ${f.flangeClass||'—'}</td></tr>
 <tr><th>Web compactness</th><td>λw = ${val(f.lambdaW,2)} • λpw = ${val(f.lpW,2)} • λrw = ${val(f.lrW,2)} → ${f.webClass||'—'}</td></tr>
 <tr><th>LTB limits</th><td>Lb = ${val(f.Lb,3)} m • Lp = ${val(f.Lp,3)} m • Lr = ${val(f.Lr,3)} m • Cb = ${val(f.Cb,2)}</td></tr>
 <tr><th>LTB branch</th><td>${f.ltbMode||'—'} • Mn(LTB) = ${val(f.MnLTB,2)} kN·m</td></tr>
 <tr><th>Local buckling</th><td>${f.localMode||'—'} • Mn(local) = ${val(f.MnLocal,2)} kN·m</td></tr>
 <tr><th>Nominal / design strength</th><td>Mn = min(Mp, MnLTB, MnLocal) = ${val(f.Mn,2)} kN·m • φMn = 0.90Mn = ${val(f.phiMn,2)} kN·m</td></tr>
 <tr><th>Column slenderness</th><td>KL/rx = ${val(r.column?.slenderX,1)} • KL/ry = ${val(r.column?.slenderY,1)} • Governing axis = ${r.column?.governingAxis||'—'}</td></tr>
 <tr><th>Column compression</th><td>Fex = ${val(r.column?.Fex,1)} kN/m² • Fey = ${val(r.column?.Fey,1)} kN/m² • Fcr = ${val(r.Fcr,1)} kN/m² • φPn = ${val(r.phiAxial,2)} kN</td></tr>
 <tr><th>H1 interaction branch</th><td>${r.column?.interactionBranch||'—'} • D/C = ${val(r.interactionRatio)}</td></tr>
 <tr><th>Demand / capacity</th><td>Mu/φMn = ${val(r.flexRatio)} • Interaction = ${val(r.interactionRatio)}</td></tr>
 </tbody></table>
 </div></div>
 <div class="engineering-note">V1.23 Phase 3 adds a traceable calculation path and explicit Yielding / Inelastic LTB / Elastic LTB / Flange Local Buckling governing states for supported doubly-symmetric Steel I strong-axis cases. Unsupported slender-flange and noncompact/slender-web cases remain WARNING rather than being guessed.</div></div>`;
 document.body.appendChild(wrap);wrap.querySelector('.ml-close').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};const ct=wrap.querySelector('.calc-toggle-v123'),cb=wrap.querySelector('.calc-body-v123');if(ct&&cb)ct.onclick=()=>{cb.hidden=!cb.hidden;ct.textContent=cb.hidden?'Show Calculation':'Hide Calculation'};
}
// ===== V1.20.1 Fix Design Foundation =====
function designDefaultsV120(m){
 const mat=state.materials.find(x=>x.id===m.materialId)||{};
 return Object.assign({memberType:'Beam',designMaterial:mat.type||'Steel',fy:Number(mat.fy||250000),fu:400000,K:1,Cb:1,unbracedLength:0,fc:Number(mat.fc||25),rebarFy:420,cover:40,barDia:20,stirrupDia:10,status:'NOT_DESIGNED'},m.design||{});
}
function designDemandV120(m){
 let best={N:0,V:0,M:0,analysis:'—'};
 const pool=state.resultsByAnalysis instanceof Map?[...state.resultsByAnalysis.entries()]:[];
 if(state.results&&!pool.length)pool.push([state.activeAnalysis||'Current',state.results]);
 for(const [name,r] of pool){const f=r?.memberForces?.find(x=>x.id===m.id);if(!f)continue;const samples=memberDiagramSamplesV117(f),N=Math.max(...samples.map(p=>Math.abs(Number(p.N)||0)),Math.abs(f.local?.[0]||0),Math.abs(f.local?.[3]||0)),V=Math.max(...samples.map(p=>Math.abs(Number(p.V)||0)),Math.abs(f.local?.[1]||0),Math.abs(f.local?.[4]||0)),M=Math.max(...samples.map(p=>Math.abs(Number(p.M)||0)),Math.abs(f.local?.[2]||0),Math.abs(f.local?.[5]||0));if(M>best.M||V>best.V||N>best.N)best={N,V,M,analysis:name}}
 return best;
}

// ===== V1.25 RC Beam Design Phase 1 — ACI CODE-318-25 flexure foundation =====
// Scope: nonprestressed singly reinforced rectangular RC beams, positive/negative flexure
// checked independently with the same rectangular-section model. Phase 1 uses a
// tension-controlled target (epsilon_t >= 0.005) and does not yet include T-beams,
// doubly-reinforced beams, shear/torsion, development length, seismic detailing, or deflection.
function rcBeamDesignV125(m){
 const d=designDefaultsV120(m),q=designDemandV121(m),sec=state.sections.find(x=>x.id===m.sectionId)||{};
 const isConcrete=String(d.designMaterial||'').toLowerCase()==='concrete';
 const isBeam=String(d.memberType||'').toLowerCase()==='beam';
 if(!isConcrete||!isBeam)return{applicable:false,q,status:'N/A',note:'Assign Concrete / Beam to run RC Beam Design.'};
 const op=orientedSectionPropsV126(m,sec),dim=op.dimensions||{};const bM=Number(dim.b||0),hM=Number(dim.h||0);
 if(sec.type!=='RC Rectangular'||!(bM>0&&hM>0))return{applicable:true,q,status:'WARNING',note:'V1.25 RC Beam Phase 1 requires an RC Rectangular section with b and h dimensions.'};
 const fc=Math.max(1,Number(d.fc||25)),fy=Math.max(1,Number(d.rebarFy||420)); // MPa
 const cover=Math.max(0,Number(d.cover||40)),barDia=Math.max(6,Number(d.barDia||20)),stirrupDia=Math.max(0,Number(d.stirrupDia||10));
 const b=bM*1000,h=hM*1000,dEff=h-cover-stirrupDia-barDia/2; // mm
 if(!(dEff>0&&dEff<h))return{applicable:true,q,status:'WARNING',note:'Invalid effective depth. Check cover, stirrup diameter and bar diameter.'};
 const Mu=Math.max(0,Number(q.M||0)),MuNmm=Mu*1e6,phi=0.90;
 // phi*As*fy*(d-a/2)=Mu, a=As*fy/(0.85fc b)
 const Acoef=phi*fy*fy/(2*0.85*fc*b),Bcoef=-phi*fy*dEff,Ccoef=MuNmm;
 const disc=Bcoef*Bcoef-4*Acoef*Ccoef;
 if(disc<0)return{applicable:true,q,status:'FAIL',note:'Demand exceeds the singly reinforced rectangular-beam solution range.',b,h,dEff,fc,fy,cover,barDia,stirrupDia,Mu};
 const AsReqRaw=Mu>0?(-Bcoef-Math.sqrt(Math.max(0,disc)))/(2*Acoef):0;
 const AsMin=Math.max(0.25*Math.sqrt(fc)/fy*b*dEff,1.4/fy*b*dEff);
 const beta1=Math.max(0.65,0.85-0.05*Math.max(0,fc-28)/7);
 const cTC=dEff/(1+0.005/0.003),aTC=beta1*cTC,AsTC=0.85*fc*b*aTC/fy;
 const AsDesign=Math.max(AsReqRaw,AsMin);
 const bars=[12,16,20,25,28,32,36,40];let choice=null;
 for(const dia of bars){const area=Math.PI*dia*dia/4;for(let n=2;n<=12;n++){const As=n*area;if(As+1e-9>=AsDesign){const over=As/Math.max(1,AsDesign);const cand={dia,n,As,over};if(!choice||cand.As<choice.As)choice=cand;break}}}
 if(!choice)return{applicable:true,q,status:'FAIL',note:'Required reinforcement exceeds the Phase 1 automatic bar-selection range.',b,h,dEff,fc,fy,cover,barDia,stirrupDia,Mu,AsReqRaw,AsMin,AsDesign,AsTC};
 const AsProv=choice.As,a=AsProv*fy/(0.85*fc*b),c=a/beta1,epsT=c>0?0.003*(dEff-c)/c:Infinity;
 const MnNmm=AsProv*fy*(dEff-a/2),phiMn=phi*MnNmm/1e6,dc=phiMn>0?Mu/phiMn:Infinity;
 const tensionControlled=epsT>=0.005-1e-9,withinTC=AsDesign<=AsTC+1e-9;
 let status='PASS',note='Singly reinforced rectangular RC beam flexure — Phase 1.';
 if(!withinTC){status='FAIL';note='Required steel exceeds the Phase 1 tension-controlled singly reinforced limit; increase section or use a later doubly-reinforced design module.'}
 else if(dc>1){status='FAIL';note='Flexural demand exceeds provided design strength.'}
 else if(!tensionControlled){status='WARNING';note='Provided reinforcement is outside the Phase 1 tension-controlled target (epsilon_t < 0.005).'}
 return{applicable:true,q,status,note,b,h,dEff,fc,fy,cover,barDia,stirrupDia,Mu,phi,beta1,AsReqRaw,AsMin,AsDesign,AsTC,barChoice:choice,AsProv,a,c,epsT,Mn:MnNmm/1e6,phiMn,dc,tensionControlled,governing:q.analysis};
}
function rcBeamDetailV125(m){
 const r=rcBeamDesignV125(m),d=designDefaultsV120(m),sec=state.sections.find(x=>x.id===m.sectionId)||{};const val=(x,n=2)=>Number.isFinite(Number(x))?Number(x).toFixed(n):'—';
 const cls=r.status==='PASS'?'pass':r.status==='FAIL'?'fail':'';
 const bars=r.barChoice?`${r.barChoice.n}-D${r.barChoice.dia}`:'—';
 const wrap=document.createElement('div');wrap.className='eng-dialog';wrap.innerHTML=`<div class="eng-card steel-detail-v122"><div class="section-db-head"><div><h2>RC Beam Design Detail — M${m.id}</h2><small>${sec.name||m.sectionId||'Section'} • Orientation ${sectionOrientationV126(m)}° • ACI CODE-318-25 • V1.26.2 Fix Phase 1 Flexure</small></div><button class="ml-close">×</button></div><div class="steel-detail-grid">
 <div><b>Demand</b><span>Mu = ${val(r.Mu)} kN·m</span><span>Governing = ${r.governing||'—'}</span></div>
 <div><b>Section</b><span>b = ${val(r.b,0)} mm</span><span>h = ${val(r.h,0)} mm</span><span>d = ${val(r.dEff,1)} mm</span></div>
 <div><b>Materials</b><span>f'c = ${val(r.fc,1)} MPa</span><span>fy = ${val(r.fy,1)} MPa</span><span>β1 = ${val(r.beta1,3)}</span></div>
 <div><b>Required Steel</b><span>As(req) = ${val(r.AsReqRaw,1)} mm²</span><span>As(min) = ${val(r.AsMin,1)} mm²</span><span>As(design) = ${val(r.AsDesign,1)} mm²</span></div>
 <div><b>Provided Steel</b><span>${bars}</span><span>As(prov) = ${val(r.AsProv,1)} mm²</span><span>εt = ${val(r.epsT,5)}</span></div>
 <div><b>Strength</b><span>φMn = ${val(r.phiMn,2)} kN·m</span><span>D/C = ${val(r.dc,3)}</span><span class="design-status ${cls}">${r.status}</span></div>
 </div><div class="calc-details-v123"><div class="section-db-head"><div><b>Calculation Details — RC Beam Trace</b><small>Transparent singly reinforced rectangular beam path</small></div><button class="calc-toggle-v123">Show Calculation</button></div><div class="calc-body-v123" hidden><table><tbody>
 <tr><th>Effective depth</th><td>d = h − cover − stirrup − db/2 = ${val(r.dEff,1)} mm</td></tr>
 <tr><th>Demand</th><td>Mu = ${val(r.Mu,2)} kN·m</td></tr>
 <tr><th>Required steel</th><td>As(req) = ${val(r.AsReqRaw,1)} mm² • As(min) = ${val(r.AsMin,1)} mm² → As(design) = ${val(r.AsDesign,1)} mm²</td></tr>
 <tr><th>Tension-controlled screen</th><td>As(TC limit) = ${val(r.AsTC,1)} mm² • εt = ${val(r.epsT,5)}</td></tr>
 <tr><th>Selected bars</th><td>${bars} • As(prov) = ${val(r.AsProv,1)} mm²</td></tr>
 <tr><th>Compression block</th><td>a = ${val(r.a,2)} mm • c = ${val(r.c,2)} mm • β1 = ${val(r.beta1,3)}</td></tr>
 <tr><th>Nominal strength</th><td>Mn = As·fy(d−a/2) = ${val(r.Mn,2)} kN·m</td></tr>
 <tr><th>Design strength</th><td>φ = ${val(r.phi,2)} • φMn = ${val(r.phiMn,2)} kN·m • D/C = ${val(r.dc,3)}</td></tr>
 </tbody></table></div></div><div class="engineering-note">V1.25 Phase 1 covers singly reinforced rectangular RC beam flexure only. Shear, torsion, development/splices, serviceability, seismic detailing, T-beams, doubly reinforced sections, and full code compliance checks are reserved for later phases. ${r.note||''}</div></div>`;
 document.body.appendChild(wrap);wrap.querySelector('.ml-close').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};const ct=wrap.querySelector('.calc-toggle-v123'),cb=wrap.querySelector('.calc-body-v123');if(ct&&cb)ct.onclick=()=>{cb.hidden=!cb.hidden;ct.textContent=cb.hidden?'Show Calculation':'Hide Calculation'};
}
function designCenterV120(){
 const wrap=document.createElement('div');wrap.className='eng-dialog design-modal-v120';wrap.innerHTML=`<div class="eng-card design-card-v120"><div class="section-db-head"><div><h2>◆ Design Center — V1.26.2 Fix</h2><small>V1.26.2 Fix Section Orientation • Steel + RC Design preserved • 0° / 90° member orientation</small></div><button class="ml-close" id="d120Close">×</button></div><div id="d120Body"></div></div>`;document.body.appendChild(wrap);wrap.querySelector('#d120Close').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};const body=wrap.querySelector('#d120Body');
 const combos=['ENVELOPE',...state.loadCombinations.map(x=>x.id)];
 const render=()=>{const ids=selectedModelMembers().map(m=>m.id),rows=state.members.map(m=>{const d=designDefaultsV120(m),r=steelDesignV122(m),q=r.q||designDemandV121(m),f=r.flex||{};const ar=r.applicable&&Number.isFinite(r.axialRatio)?r.axialRatio.toFixed(3):'—',fr=r.applicable&&Number.isFinite(r.flexRatio)?r.flexRatio.toFixed(3):'—',ir=r.applicable&&Number.isFinite(r.interactionRatio)?r.interactionRatio.toFixed(3):'—',cap=r.applicable&&r.phiAxial?Number(r.phiAxial).toFixed(2):'—',mcap=f.phiMn?Number(f.phiMn).toFixed(2):'—',cls=r.status==='PASS'?'pass':r.status==='FAIL'?'fail':'';return `<tr><td><button class="design-member-link" data-detail="${m.id}">M${m.id}</button></td><td>${d.memberType}</td><td>${d.designMaterial}</td><td>${q.N.toFixed(2)}</td><td>${cap}</td><td>${ar}</td><td>${q.M.toFixed(2)}</td><td>${mcap}</td><td>${fr}</td><td>${ir}</td><td>${f.governing||'—'}</td><td>${q.analysis}</td><td><span class="design-status ${cls}">${r.status}</span></td></tr>`}).join('');body.innerHTML=`
 <div class="design-grid-v120"><section><h3>Design Standard</h3><label>Steel Code<select id="dSteelCode"><option>AISC 360-22</option></select></label><label>Steel Method<select id="dSteelMethod"><option>LRFD</option></select></label><label>RC Code<select id="dRcCode"><option>ACI CODE-318-25</option></select></label><label>RC Method<select id="dRcMethod"><option>Strength Design</option></select></label><label>Design Combination<select id="dCombo">${combos.map(x=>`<option>${x}</option>`).join('')}</select><button id="dSaveSetup" class="primary">Save Design Setup</button></section>
 <section><h3>Assign Design Properties</h3><div class="design-selected">Selected Members: <b>${ids.length?ids.map(x=>'M'+x).join(', '):'None'}</b></div><label>Member Type<select id="dType"><option>Beam</option><option>Column</option><option>Brace</option><option>Other</option></select></label><label>Design Material<select id="dMat"><option>Steel</option><option>Concrete</option></select></label><div class="design-mini-grid"><label>Fy (MPa)<input id="dFy" type="number" value="250"></label><label>Fu (MPa)<input id="dFu" type="number" value="400"></label><label>K-factor<input id="dK" type="number" step="0.1" value="1"></label><label>Lb (m) <small>0 = member length</small><input id="dLb" type="number" step="0.1" value="0"></label><label>Cb<input id="dCb" type="number" step="0.1" value="1"></label><label>f'c (MPa)<input id="dFc" type="number" value="25"></label><label>Rebar fy (MPa)<input id="dRfy" type="number" value="420"></label><label>Cover (mm)<input id="dCover" type="number" value="40"></label><label>Main bar Ø (mm)<input id="dBarDia" type="number" value="20"></label><label>Stirrup Ø (mm)<input id="dStirrupDia" type="number" value="10"></label></div><button id="dAssign" class="primary">Assign to Selected Members (${ids.length})</button><div id="dAssignStatus" class="design-assign-status">${state.designLastMessage||''}</div></section></div>
 <section class="design-results-v120"><div class="section-db-head"><div><h3>Steel / Beam-Column Design Results — V1.24</h3><small>Steel I strong-axis flexure with explicit Yielding / Inelastic LTB / Elastic LTB / Flange Local Buckling paths. Click a Member ID, then Show Calculation for the trace. Unsupported cases show WARNING.</small></div><div class="design-actions-v121"><button id="dRunSteel" class="primary">▶ Run Steel Design</button><button id="dCsv">Export Steel Design CSV</button></div></div><div class="design-table-wrap"><table><thead><tr><th>Member</th><th>Type</th><th>Material</th><th>Pu kN</th><th>φPn kN</th><th>Axial D/C</th><th>Mu kN·m</th><th>φMn kN·m</th><th>Flex D/C</th><th>Interaction</th><th>Governing</th><th>Combination</th><th>Status</th></tr></thead><tbody>${rows||'<tr><td colspan="13">No members</td></tr>'}</tbody></table></div></section>
 <section class="design-results-v120"><div class="section-db-head"><div><h3>RC Beam Design Results — V1.26.2 Fix</h3><small>ACI CODE-318-25 Phase 1 • singly reinforced rectangular beam flexure • transparent As / φMn / D/C trace</small></div><div class="design-actions-v121"><button id="dRunRc" class="primary">▶ Run RC Beam Design</button><button id="dRcCsv">Export RC Beam CSV</button></div></div><div class="design-table-wrap"><table><thead><tr><th>Member</th><th>Type</th><th>Material</th><th>Mu kN·m</th><th>As req mm²</th><th>As min mm²</th><th>Provided</th><th>As prov mm²</th><th>φMn kN·m</th><th>D/C</th><th>Combination</th><th>Status</th></tr></thead><tbody>${state.members.map(m=>{const d=designDefaultsV120(m),r=rcBeamDesignV125(m),cls=r.status==='PASS'?'pass':r.status==='FAIL'?'fail':'',bars=r.barChoice?`${r.barChoice.n}-D${r.barChoice.dia}`:'—';return `<tr><td><button class="design-member-link" data-rcdetail="${m.id}">M${m.id}</button></td><td>${d.memberType}</td><td>${d.designMaterial}</td><td>${Number(r.Mu??r.q?.M??0).toFixed(2)}</td><td>${Number.isFinite(r.AsReqRaw)?r.AsReqRaw.toFixed(1):'—'}</td><td>${Number.isFinite(r.AsMin)?r.AsMin.toFixed(1):'—'}</td><td>${bars}</td><td>${Number.isFinite(r.AsProv)?r.AsProv.toFixed(1):'—'}</td><td>${Number.isFinite(r.phiMn)?r.phiMn.toFixed(2):'—'}</td><td>${Number.isFinite(r.dc)?r.dc.toFixed(3):'—'}</td><td>${r.governing||r.q?.analysis||'—'}</td><td><span class="design-status ${cls}">${r.status}</span></td></tr>`}).join('')}</tbody></table></div></section>`;
 const ds=state.designSetup||{};body.querySelector('#dSteelCode').value=ds.steelCode||'AISC 360-22';body.querySelector('#dSteelMethod').value='LRFD';body.querySelector('#dRcCode').value=ds.rcCode||'ACI CODE-318-25';body.querySelector('#dRcMethod').value=ds.rcMethod||'Strength Design';body.querySelector('#dCombo').value=ds.designCombination||'ENVELOPE';
 const selectedForForm=selectedModelMembers();if(selectedForForm.length){const d=designDefaultsV120(selectedForForm[0]);body.querySelector('#dType').value=d.memberType||'Beam';body.querySelector('#dMat').value=d.designMaterial||'Steel';body.querySelector('#dFy').value=(Number(d.fy)||250000)/1000;body.querySelector('#dFu').value=(Number(d.fu)||400000)/1000;body.querySelector('#dK').value=Number(d.K)||1;body.querySelector('#dLb').value=Number(d.unbracedLength)||0;body.querySelector('#dCb').value=Number(d.Cb)||1;body.querySelector('#dFc').value=Number(d.fc)||25;body.querySelector('#dRfy').value=Number(d.rebarFy)||420;body.querySelector('#dCover').value=Number(d.cover)||40;body.querySelector('#dBarDia').value=Number(d.barDia)||20;body.querySelector('#dStirrupDia').value=Number(d.stirrupDia)||10}
 body.querySelector('#dSaveSetup').onclick=()=>{state.designSetup={steelCode:body.querySelector('#dSteelCode').value,steelMethod:'LRFD',rcCode:body.querySelector('#dRcCode').value,rcMethod:body.querySelector('#dRcMethod').value,designCombination:body.querySelector('#dCombo').value};toast('Design setup saved • JSON/Cloud ready')};
 body.querySelector('#dAssign').onclick=()=>{const ms=selectedModelMembers();if(!ms.length)return alert('Select one or more Members first.');const assigned={memberType:body.querySelector('#dType').value,designMaterial:body.querySelector('#dMat').value,fy:Number(body.querySelector('#dFy').value)*1000,fu:Number(body.querySelector('#dFu').value)*1000,K:Number(body.querySelector('#dK').value)||1,Cb:Number(body.querySelector('#dCb').value)||1,unbracedLength:Number(body.querySelector('#dLb').value)||0,fc:Number(body.querySelector('#dFc').value)||25,rebarFy:Number(body.querySelector('#dRfy').value)||420,cover:Number(body.querySelector('#dCover').value)||40,barDia:Number(body.querySelector('#dBarDia').value)||20,stirrupDia:Number(body.querySelector('#dStirrupDia').value)||10,status:'NOT_DESIGNED'};for(const m of ms)m.design={...assigned};state.designLastMessage=`✓ Assigned ${assigned.designMaterial} / ${assigned.memberType} to ${ms.map(m=>'M'+m.id).join(', ')}`;render();toast(state.designLastMessage)};
 body.querySelector('#dRunSteel').onclick=()=>{for(const m of state.members){const r=steelDesignV122(m);m.design={...designDefaultsV120(m),status:r.applicable?r.status:'NOT_DESIGNED',steelResult:r.applicable?{axialRatio:r.axialRatio,phiAxial:r.phiAxial,slender:r.slender,phiMn:r.flex?.phiMn,flexRatio:r.flexRatio,interactionRatio:r.interactionRatio,flangeClass:r.flex?.flangeClass,webClass:r.flex?.webClass,Lb:r.flex?.Lb,Lp:r.flex?.Lp,Lr:r.flex?.Lr,limitState:r.flex?.governing,governing:r.q?.analysis}:null}};state.designLastMessage='✓ V1.24 Steel Column + Beam-Column design complete • axis-aware compression + flexure interaction';render();toast(state.designLastMessage)};
 body.querySelector('#dRunRc').onclick=()=>{for(const m of state.members){const r=rcBeamDesignV125(m);m.design={...designDefaultsV120(m),status:r.applicable?r.status:'NOT_DESIGNED',rcBeamResult:r.applicable?{Mu:r.Mu,AsReq:r.AsReqRaw,AsMin:r.AsMin,AsDesign:r.AsDesign,AsTC:r.AsTC,AsProv:r.AsProv,barChoice:r.barChoice,phiMn:r.phiMn,dc:r.dc,epsT:r.epsT,governing:r.governing,status:r.status}:null}};state.designLastMessage='✓ V1.25 RC Beam Design Phase 1 complete • ACI CODE-318-25 flexure foundation';render();toast(state.designLastMessage)};
 body.querySelector('#dRcCsv').onclick=()=>{const out=[['Member','Type','Material','Mu_kNm','As_req_mm2','As_min_mm2','As_design_mm2','Bars','As_prov_mm2','PhiMn_kNm','DC','eps_t','Combination','Status'],...state.members.map(m=>{const d=designDefaultsV120(m),r=rcBeamDesignV125(m),bars=r.barChoice?`${r.barChoice.n}-D${r.barChoice.dia}`:'';return[m.id,d.memberType,d.designMaterial,r.Mu??'',r.AsReqRaw??'',r.AsMin??'',r.AsDesign??'',bars,r.AsProv??'',r.phiMn??'',r.dc??'',r.epsT??'',r.governing??r.q?.analysis??'',r.status]})];const blob=new Blob([out.map(r=>r.join(',')).join('\n')],{type:'text/csv'}),x=document.createElement('a');x.href=URL.createObjectURL(blob);x.download='sapudom-v1.25-rc-beam-design.csv';x.click();setTimeout(()=>URL.revokeObjectURL(x.href),500)};
 body.querySelector('#dCsv').onclick=()=>{const out=[['Member','Type','Material','Pu_kN','PhiPn_kN','Axial_DC','Mu_kNm','PhiMn_kNm','Flexure_DC','Interaction_DC','Flange_Class','Web_Class','Lb_m','Lp_m','Lr_m','Limit_State','Combination','Status'],...state.members.map(m=>{const d=designDefaultsV120(m),r=steelDesignV122(m),q=r.q||designDemandV121(m),f=r.flex||{};return [m.id,d.memberType,d.designMaterial,q.N,r.phiAxial??'',Number.isFinite(r.axialRatio)?r.axialRatio:'',q.M,f.phiMn??'',Number.isFinite(r.flexRatio)?r.flexRatio:'',Number.isFinite(r.interactionRatio)?r.interactionRatio:'',f.flangeClass??'',f.webClass??'',f.Lb??'',f.Lp??'',f.Lr??'',f.governing??'',q.analysis,r.status]})];const blob=new Blob([out.map(r=>r.join(',')).join('\n')],{type:'text/csv'}),x=document.createElement('a');x.href=URL.createObjectURL(blob);x.download='sapudom-v1.24-steel-design.csv';x.click();setTimeout(()=>URL.revokeObjectURL(x.href),500)};
 body.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{const m=state.members.find(x=>String(x.id)===String(b.dataset.detail));if(m)steelDetailV122(m)});
 body.querySelectorAll('[data-rcdetail]').forEach(b=>b.onclick=()=>{const m=state.members.find(x=>String(x.id)===String(b.dataset.rcdetail));if(m)rcBeamDetailV125(m)});
 };render();
}


// ===== V1.27 — 3D Frame Phase 1 (isolated from verified 2D engine) =====
function frame3dCenterV127(){
 state.model3d ||= {nodes:[],members:[],nextNode:1,nextMember:1,view:{yaw:-35,pitch:24,scale:34}};
 const m3=state.model3d; m3.view ||= {yaw:-35,pitch:24,scale:34};
 // V1.30.1 migration: legacy V1.30 building models may have fixedBase metadata but missing visible/persisted restraints.
 if(m3.building?.fixedBase && Array.isArray(m3.nodes) && m3.nodes.length){
   const z0=Number.isFinite(Number(m3.building.baseZ))?Number(m3.building.baseZ):Math.min(...m3.nodes.map(n=>Number(n.z)||0));
   for(const n of m3.nodes){
     if((n.source==='V1.30_BUILDING'||n.source==='V1.30.1_BUILDING') && Math.abs((Number(n.z)||0)-z0)<1e-9){
       n.restraints={ux:true,uy:true,uz:true,rx:true,ry:true,rz:true}; n.supportType3d='Fixed';
     }
   }
 }
 const wrap=document.createElement('div');wrap.className='eng-dialog';wrap.innerHTML=`<div class="eng-card frame3d-card-v127"><div class="section-db-head"><div><h2>3D Frame Center — V1.27.1 Fix • Phase 1</h2><small>Independent 3D model • X/Y/Z coordinates • 6 DOF per node • JSON persistence • 2D engine protected</small></div><button class="ml-close">×</button></div>
 <div class="frame3d-layout-v127"><section class="frame3d-view-v127"><canvas id="frame3dCanvas"></canvas><div class="frame3d-toolbar"><button id="f3Fit">Fit</button><button id="f3Left">↺</button><button id="f3Right">↻</button><button id="f3Up">↑</button><button id="f3Down">↓</button><button id="f3Sample" class="primary">Load 3D Sample</button></div><div id="f3Status" class="engineering-note"></div></section>
 <section class="frame3d-data-v127"><h3>Add 3D Node</h3><div class="design-mini-grid"><label>X (m)<input id="f3x" type="number" step="0.1" value="0"></label><label>Y (m)<input id="f3y" type="number" step="0.1" value="0"></label><label>Z (m)<input id="f3z" type="number" step="0.1" value="0"></label></div><button id="f3AddNode">＋ Add Node</button>
 <h3>Add 3D Member</h3><div class="design-mini-grid"><label>i Node<input id="f3i" type="number" min="1"></label><label>j Node<input id="f3j" type="number" min="1"></label></div><button id="f3AddMember">╱ Add Member</button>
 <h3>Node Support / Load</h3><label>Node<select id="f3NodeSelect"></select></label><div class="f3-checks"><label><input type="checkbox" data-rest="ux">Ux</label><label><input type="checkbox" data-rest="uy">Uy</label><label><input type="checkbox" data-rest="uz">Uz</label><label><input type="checkbox" data-rest="rx">Rx</label><label><input type="checkbox" data-rest="ry">Ry</label><label><input type="checkbox" data-rest="rz">Rz</label></div><div class="design-mini-grid"><label>Fx kN<input id="f3fx" type="number" value="0"></label><label>Fy kN<input id="f3fy" type="number" value="0"></label><label>Fz kN<input id="f3fz" type="number" value="0"></label><label>Mx kN·m<input id="f3mx" type="number" value="0"></label><label>My kN·m<input id="f3my" type="number" value="0"></label><label>Mz kN·m<input id="f3mz" type="number" value="0"></label></div><button id="f3ApplyNode">Apply Node Data</button><button id="f3Validate" class="primary">✓ Validate 3D Model</button><div id="f3ValidationFeedback" class="f3-validation-feedback" role="status" aria-live="polite">Validation status will appear here.</div></section></div>
 <div class="frame3d-tables-v127"><div><h3>3D Nodes</h3><div id="f3Nodes"></div></div><div><h3>3D Members</h3><div id="f3Members"></div></div></div><div class="engineering-note"><b>Phase 1 boundary:</b> 3D geometry, 6-DOF data model, restraints, nodal loads, member connectivity, viewport and Save/Open JSON are active. Full 12×12 space-frame stiffness solution and 3D force diagrams are reserved for Phase 2.</div></div>`;
 document.body.appendChild(wrap);const closeFrame3dDataV1281=()=>{wrap.remove();if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(true)};wrap.querySelector('.ml-close').onclick=closeFrame3dDataV1281;wrap.onclick=e=>{if(e.target===wrap)closeFrame3dDataV1281()};
 const c=wrap.querySelector('#frame3dCanvas'),cx=c.getContext('2d'); let drag=null;
 function proj(n,w,h){const yaw=m3.view.yaw*Math.PI/180,p=m3.view.pitch*Math.PI/180;const x=n.x*Math.cos(yaw)-n.y*Math.sin(yaw), y=n.x*Math.sin(yaw)+n.y*Math.cos(yaw), z=n.z;return {x:w/2+(x)*m3.view.scale,y:h/2-((z*Math.cos(p))-(y*Math.sin(p)))*m3.view.scale};}
 function draw(){const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=Math.max(1,r.width*d);c.height=Math.max(1,r.height*d);cx.setTransform(d,0,0,d,0,0);cx.clearRect(0,0,r.width,r.height);cx.lineWidth=1;cx.strokeStyle='#d7deea';for(let k=-8;k<=8;k++){cx.beginPath();cx.moveTo(0,r.height/2+k*25);cx.lineTo(r.width,r.height/2+k*25);cx.stroke();cx.beginPath();cx.moveTo(r.width/2+k*25,0);cx.lineTo(r.width/2+k*25,r.height);cx.stroke()}cx.lineWidth=3;cx.strokeStyle='#e18a23';for(const mm of m3.members){const a=m3.nodes.find(n=>n.id==mm.i),b=m3.nodes.find(n=>n.id==mm.j);if(!a||!b)continue;const A=proj(a,r.width,r.height),B=proj(b,r.width,r.height);cx.beginPath();cx.moveTo(A.x,A.y);cx.lineTo(B.x,B.y);cx.stroke();cx.fillStyle='#243b63';cx.fillText('M'+mm.id,(A.x+B.x)/2+5,(A.y+B.y)/2-5)}for(const n of m3.nodes){const q=proj(n,r.width,r.height);cx.fillStyle='#2457a6';cx.beginPath();cx.arc(q.x,q.y,5,0,Math.PI*2);cx.fill();cx.fillStyle='#111827';cx.fillText(String(n.id),q.x+7,q.y-7);const L=n.load||{};const forces=[['fx','FX',[1,0,0]],['fy','FY',[0,1,0]],['fz','FZ',[0,0,1]]];let row=0;for(const [key,label,axis] of forces){const val=Number(L[key])||0;if(!val)continue;const sg=Math.sign(val),world={x:n.x+axis[0]*sg,y:n.y+axis[1]*sg,z:n.z+axis[2]*sg},p1=proj(world,r.width,r.height),vx=p1.x-q.x,vy=p1.y-q.y,len=Math.hypot(vx,vy)||1,ux=vx/len,uy=vy/len,tail={x:q.x-ux*34,y:q.y-uy*34};cx.save();cx.strokeStyle='#dc2626';cx.fillStyle='#dc2626';cx.lineWidth=2.4;cx.beginPath();cx.moveTo(tail.x,tail.y);cx.lineTo(q.x,q.y);cx.stroke();const ah=8,px=-uy,py=ux;cx.beginPath();cx.moveTo(q.x,q.y);cx.lineTo(q.x-ux*ah+px*4,q.y-uy*ah+py*4);cx.lineTo(q.x-ux*ah-px*4,q.y-uy*ah-py*4);cx.closePath();cx.fill();cx.font='bold 11px Arial';cx.fillText(label+' '+val+' kN',tail.x+5,tail.y-6-row*13);cx.restore();row++}const moments=[];for(const key of ['mx','my','mz'])if(Number(L[key]))moments.push(key[0].toUpperCase()+key[1]+' '+Number(L[key])+' kN·m');if(moments.length){cx.save();cx.fillStyle='#a21caf';cx.font='bold 10px Arial';cx.fillText(moments.join(' • '),q.x+9,q.y+18);cx.restore()}}}
 function fit(){if(!m3.nodes.length){m3.view.scale=34;return draw()}const xs=m3.nodes.map(n=>n.x),ys=m3.nodes.map(n=>n.y),zs=m3.nodes.map(n=>n.z),span=Math.max(1,Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),Math.max(...zs)-Math.min(...zs));m3.view.scale=Math.max(12,Math.min(70,260/span));draw()}
 function refresh(){const ns=wrap.querySelector('#f3NodeSelect');const keep=Number(ns.value)||Number(m3.selectedNodeId)||0;ns.innerHTML=m3.nodes.map(n=>`<option value="${n.id}">N${n.id}</option>`).join('');const chosen=m3.nodes.some(n=>n.id===keep)?keep:(m3.nodes[0]?.id||0);if(chosen){ns.value=String(chosen);m3.selectedNodeId=chosen;}wrap.querySelector('#f3Nodes').innerHTML=`<table><tr><th>N</th><th>X</th><th>Y</th><th>Z</th><th>Restraints</th></tr>${m3.nodes.map(n=>`<tr><td>${n.id}</td><td>${n.x}</td><td>${n.y}</td><td>${n.z}</td><td>${Object.entries(n.restraints||{}).filter(x=>x[1]).map(x=>x[0].toUpperCase()).join(', ')||'Free'}</td></tr>`).join('')}</table>`;wrap.querySelector('#f3Members').innerHTML=`<table><tr><th>M</th><th>i</th><th>j</th><th>L (m)</th></tr>${m3.members.map(mm=>{const a=m3.nodes.find(n=>n.id==mm.i),b=m3.nodes.find(n=>n.id==mm.j),L=a&&b?Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z):0;return`<tr><td>${mm.id}</td><td>${mm.i}</td><td>${mm.j}</td><td>${L.toFixed(3)}</td></tr>`}).join('')}</table>`;wrap.querySelector('#f3Status').innerHTML=`Nodes <b>${m3.nodes.length}</b> • Members <b>${m3.members.length}</b> • DOF <b>${m3.nodes.length*6}</b> • Global K target <b>${m3.nodes.length*6}×${m3.nodes.length*6}</b>`;
  // V1.30.1 Fix — always hydrate Support/Load controls for the selected node on open/refresh.
  const current=m3.nodes.find(n=>n.id===chosen);
  if(current){
    current.restraints={ux:false,uy:false,uz:false,rx:false,ry:false,rz:false,...(current.restraints||{})};
    current.load={fx:0,fy:0,fz:0,mx:0,my:0,mz:0,...(current.load||{})};
    wrap.querySelectorAll('[data-rest]').forEach(q=>q.checked=!!current.restraints[q.dataset.rest]);
    for(const k of ['fx','fy','fz','mx','my','mz'])wrap.querySelector('#f3'+k).value=current.load[k]||0;
  }
  draw()}
 wrap.querySelector('#f3AddNode').onclick=()=>{const x=+wrap.querySelector('#f3x').value,y=+wrap.querySelector('#f3y').value,z=+wrap.querySelector('#f3z').value;if(m3.nodes.some(n=>Math.hypot(n.x-x,n.y-y,n.z-z)<1e-8))return alert('3D Node already exists at this coordinate.');m3.nodes.push({id:m3.nextNode++,x,y,z,restraints:{ux:false,uy:false,uz:false,rx:false,ry:false,rz:false},load:{fx:0,fy:0,fz:0,mx:0,my:0,mz:0}});refresh();if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(true)};
 wrap.querySelector('#f3AddMember').onclick=()=>{const i=+wrap.querySelector('#f3i').value,j=+wrap.querySelector('#f3j').value;if(i===j||!m3.nodes.some(n=>n.id===i)||!m3.nodes.some(n=>n.id===j))return alert('Choose two valid, different 3D Nodes.');if(m3.members.some(m=>(m.i===i&&m.j===j)||(m.i===j&&m.j===i)))return alert('3D Member already exists.');m3.members.push({id:m3.nextMember++,i,j,E:200000000,G:76923077,A:.01,Iy:8e-5,Iz:8e-5,J:1e-5});refresh();if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(true)};
 wrap.querySelector('#f3ApplyNode').onclick=()=>{const selectedId=+wrap.querySelector('#f3NodeSelect').value;const n=m3.nodes.find(n=>n.id===selectedId);if(!n)return;m3.selectedNodeId=selectedId;n.restraints={};wrap.querySelectorAll('[data-rest]').forEach(q=>n.restraints[q.dataset.rest]=q.checked);for(const k of ['fx','fy','fz','mx','my','mz'])n.load[k]=+wrap.querySelector('#f3'+k).value||0;refresh();wrap.querySelector('#f3NodeSelect').value=String(selectedId);wrap.querySelectorAll('[data-rest]').forEach(q=>q.checked=!!n.restraints?.[q.dataset.rest]);for(const k of ['fx','fy','fz','mx','my','mz'])wrap.querySelector('#f3'+k).value=n.load?.[k]||0;if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(false)};
 wrap.querySelector('#f3NodeSelect').onchange=e=>{const id=+e.target.value;m3.selectedNodeId=id;const n=m3.nodes.find(n=>n.id===id);if(!n)return;wrap.querySelectorAll('[data-rest]').forEach(q=>q.checked=!!n.restraints?.[q.dataset.rest]);for(const k of ['fx','fy','fz','mx','my','mz'])wrap.querySelector('#f3'+k).value=n.load?.[k]||0};
 wrap.querySelector('#f3Validate').onclick=()=>{const feedback=wrap.querySelector('#f3ValidationFeedback');const setFeedback=(type,msg)=>{if(feedback){feedback.className='f3-validation-feedback '+type;feedback.textContent=msg;}toast(msg)};const bad=m3.members.filter(mm=>!m3.nodes.some(n=>n.id===mm.i)||!m3.nodes.some(n=>n.id===mm.j));const fixed=m3.nodes.reduce((sum,n)=>sum+Object.values(n.restraints||{}).filter(Boolean).length,0);const fixedNodes=m3.nodes.filter(n=>Object.values(n.restraints||{}).some(Boolean)).length;if(!m3.nodes.length||!m3.members.length)return setFeedback('error','✕ 3D Model Invalid — add 3D Nodes and Members first.');if(bad.length)return setFeedback('error','✕ 3D Model Invalid — member connectivity: '+bad.map(x=>'M'+x.id).join(', '));if(!fixed)return setFeedback('warning','⚠ 3D Model Warning — no restrained DOF. Add supports/restraints before Analyze 3D.');setFeedback('success',`✓ 3D Model Valid — ${m3.nodes.length} Nodes • ${m3.members.length} Members • ${fixedNodes} restrained Nodes • ${fixed} restrained DOF • Ready to Analyze`)};
 wrap.querySelector('#f3Sample').onclick=()=>{m3.nodes=[{id:1,x:0,y:0,z:0},{id:2,x:5,y:0,z:0},{id:3,x:0,y:4,z:0},{id:4,x:5,y:4,z:0},{id:5,x:0,y:0,z:3},{id:6,x:5,y:0,z:3},{id:7,x:0,y:4,z:3},{id:8,x:5,y:4,z:3}].map((n,i)=>({...n,restraints:{ux:i<4,uy:i<4,uz:i<4,rx:i<4,ry:i<4,rz:i<4},load:{fx:0,fy:0,fz:i===7?-50:0,mx:0,my:0,mz:0}}));const pairs=[[1,5],[2,6],[3,7],[4,8],[5,6],[6,8],[8,7],[7,5]];m3.members=pairs.map((x,i)=>({id:i+1,i:x[0],j:x[1],E:200000000,G:76923077,A:.01,Iy:8e-5,Iz:8e-5,J:1e-5}));m3.nextNode=9;m3.nextMember=9;fit();refresh();if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(true)};
 wrap.querySelector('#f3Fit').onclick=fit;wrap.querySelector('#f3Left').onclick=()=>{m3.view.yaw-=10;draw()};wrap.querySelector('#f3Right').onclick=()=>{m3.view.yaw+=10;draw()};wrap.querySelector('#f3Up').onclick=()=>{m3.view.pitch=Math.min(80,m3.view.pitch+8);draw()};wrap.querySelector('#f3Down').onclick=()=>{m3.view.pitch=Math.max(-80,m3.view.pitch-8);draw()};
 c.onpointerdown=e=>drag={x:e.clientX,y:e.clientY,yaw:m3.view.yaw,pitch:m3.view.pitch};c.onpointermove=e=>{if(!drag)return;m3.view.yaw=drag.yaw+(e.clientX-drag.x)*.35;m3.view.pitch=Math.max(-80,Math.min(80,drag.pitch-(e.clientY-drag.y)*.25));draw()};c.onpointerup=c.onpointerleave=()=>drag=null;c.onwheel=e=>{e.preventDefault();m3.view.scale=Math.max(5,Math.min(120,m3.view.scale*(e.deltaY>0?.9:1.1)));draw()};
 refresh();setTimeout(fit,0);
}


// ===== V1.30 — Independent 3D Building Generator (model3d only; 2D state protected) =====
function building3dCenterV130(){
  state.model3d ||= {nodes:[],members:[],nextNode:1,nextMember:1,view:{yaw:-35,pitch:24,scale:34}};
  const m3=state.model3d;
  m3.building ||= {stories:3,baysX:2,baysY:2,storyHeights:'3.5,3.5,3.5',bayWidthsX:'5,5',bayWidthsY:'6,6',fixedBase:true};
  const b=m3.building;
  const wrap=document.createElement('div'); wrap.className='eng-dialog v130-building-modal';
  wrap.innerHTML=`<div class="eng-card v130-building-card"><div class="section-db-head"><div><h2>3D Building Generator — V1.30.2 Fix</h2><small>Independent 3D workspace • generates only state.model3d • 2D model is not modified</small></div><button class="ml-close">×</button></div>
  <div class="v130-building-grid">
   <section><h3>Grid X / Y</h3>
    <label>Bays X<input id="v130Bx" type="number" min="1" max="30" value="${b.baysX||2}"></label>
    <label>Bay widths X (m, comma separated)<input id="v130Wx" value="${b.bayWidthsX||'5,5'}"></label>
    <label>Bays Y<input id="v130By" type="number" min="1" max="30" value="${b.baysY||2}"></label>
    <label>Bay widths Y (m, comma separated)<input id="v130Wy" value="${b.bayWidthsY||'6,6'}"></label>
   </section>
   <section><h3>Stories</h3>
    <label>Number of stories<input id="v130Stories" type="number" min="1" max="50" value="${b.stories||3}"></label>
    <label>Story heights (m, comma separated)<input id="v130Hs" value="${b.storyHeights||'3.5,3.5,3.5'}"></label>
    <label class="v130-check"><input id="v130Fixed" type="checkbox" ${b.fixedBase!==false?'checked':''}> Fixed supports at all base nodes</label>
    <label class="v130-check"><input id="v130Replace" type="checkbox" checked> Replace current 3D geometry</label>
   </section>
   <section><h3>Column Properties</h3>
    <label>E (kN/m²)<input id="v130cE" type="number" value="25000000"></label><label>G (kN/m²)<input id="v130cG" type="number" value="10416667"></label>
    <div class="v130-mini"><label>A (m²)<input id="v130cA" type="number" step="0.001" value="0.16"></label><label>Iy (m⁴)<input id="v130cIy" type="number" step="0.000001" value="0.002133"></label><label>Iz (m⁴)<input id="v130cIz" type="number" step="0.000001" value="0.002133"></label><label>J (m⁴)<input id="v130cJ" type="number" step="0.000001" value="0.0036"></label></div>
   </section>
   <section><h3>Beam Properties</h3>
    <label>E (kN/m²)<input id="v130bE" type="number" value="25000000"></label><label>G (kN/m²)<input id="v130bG" type="number" value="10416667"></label>
    <div class="v130-mini"><label>A (m²)<input id="v130bA" type="number" step="0.001" value="0.15"></label><label>Iy (m⁴)<input id="v130bIy" type="number" step="0.000001" value="0.003125"></label><label>Iz (m⁴)<input id="v130bIz" type="number" step="0.000001" value="0.001125"></label><label>J (m⁴)<input id="v130bJ" type="number" step="0.000001" value="0.0018"></label></div>
   </section>
  </div>
  <div id="v130Preview" class="v130-building-preview"></div>
  <div class="v130-building-actions"><button id="v130Generate" class="primary">▦ Generate 3D Building</button><button id="v130Cancel">Cancel</button></div>
  <div class="engineering-note"><b>V1.30 protection:</b> this generator writes only to the independent 3D data model. Existing 2D Nodes, Members, Loads, Results, RC/Steel design and 2D Building Center are untouched.</div></div>`;
  document.body.appendChild(wrap);
  const q=id=>wrap.querySelector('#'+id);
  const parseSeries=(txt,n,name)=>{let a=String(txt||'').split(',').map(x=>Number(x.trim())).filter(x=>Number.isFinite(x)&&x>0);if(a.length===1&&n>1)a=Array(n).fill(a[0]);if(a.length!==n)throw new Error(`${name} requires ${n} positive value(s).`);return a};
  const preview=()=>{try{const bx=+q('v130Bx').value,by=+q('v130By').value,st=+q('v130Stories').value;parseSeries(q('v130Wx').value,bx,'X widths');parseSeries(q('v130Wy').value,by,'Y widths');parseSeries(q('v130Hs').value,st,'Story heights');const nodes=(bx+1)*(by+1)*(st+1);const cols=(bx+1)*(by+1)*st;const beams=st*((bx*(by+1))+(by*(bx+1)));q('v130Preview').innerHTML=`<b>${st}-Story / ${bx}×${by} Bay 3D Frame</b><span>Nodes ${nodes} • Columns ${cols} • Beams ${beams} • Members ${cols+beams} • DOF ${nodes*6}</span>`}catch(e){q('v130Preview').innerHTML=`<b>Check inputs</b><span>${e.message}</span>`}};
  ['v130Bx','v130By','v130Stories','v130Wx','v130Wy','v130Hs'].forEach(id=>q(id).addEventListener('input',preview)); preview();
  const close=()=>wrap.remove(); wrap.querySelector('.ml-close').onclick=close;q('v130Cancel').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  q('v130Generate').onclick=()=>{try{
    const bx=+q('v130Bx').value,by=+q('v130By').value,stories=+q('v130Stories').value;
    const wx=parseSeries(q('v130Wx').value,bx,'X widths'),wy=parseSeries(q('v130Wy').value,by,'Y widths'),hs=parseSeries(q('v130Hs').value,stories,'Story heights');
    if(q('v130Replace').checked){m3.nodes=[];m3.members=[];m3.nextNode=1;m3.nextMember=1}
    const xs=[0],ys=[0],zs=[0];wx.forEach(v=>xs.push(xs.at(-1)+v));wy.forEach(v=>ys.push(ys.at(-1)+v));hs.forEach(v=>zs.push(zs.at(-1)+v));
    const startNode=m3.nextNode||1,startMember=m3.nextMember||1;let nid=startNode,mid=startMember;const map=new Map();
    const fixed=q('v130Fixed').checked;
    for(let k=0;k<=stories;k++)for(let iy=0;iy<=by;iy++)for(let ix=0;ix<=bx;ix++){const id=nid++;map.set(`${ix},${iy},${k}`,id);m3.nodes.push({id,x:xs[ix],y:ys[iy],z:zs[k],restraints:{ux:fixed&&k===0,uy:fixed&&k===0,uz:fixed&&k===0,rx:fixed&&k===0,ry:fixed&&k===0,rz:fixed&&k===0},load:{fx:0,fy:0,fz:0,mx:0,my:0,mz:0},story:k,gridX:ix,gridY:iy,source:'V1.30_BUILDING'})}
    const cp={E:+q('v130cE').value,G:+q('v130cG').value,A:+q('v130cA').value,Iy:+q('v130cIy').value,Iz:+q('v130cIz').value,J:+q('v130cJ').value};
    const bp={E:+q('v130bE').value,G:+q('v130bG').value,A:+q('v130bA').value,Iy:+q('v130bIy').value,Iz:+q('v130bIz').value,J:+q('v130bJ').value};
    const add=(i,j,type,p)=>m3.members.push({id:mid++,i,j,...p,memberType:type,source:'V1.30_BUILDING'});
    for(let k=0;k<stories;k++)for(let iy=0;iy<=by;iy++)for(let ix=0;ix<=bx;ix++)add(map.get(`${ix},${iy},${k}`),map.get(`${ix},${iy},${k+1}`),'Column',cp);
    for(let k=1;k<=stories;k++){for(let iy=0;iy<=by;iy++)for(let ix=0;ix<bx;ix++)add(map.get(`${ix},${iy},${k}`),map.get(`${ix+1},${iy},${k}`),'Beam-X',bp);for(let ix=0;ix<=bx;ix++)for(let iy=0;iy<by;iy++)add(map.get(`${ix},${iy},${k}`),map.get(`${ix},${iy+1},${k}`),'Beam-Y',bp)}
    m3.nextNode=nid;m3.nextMember=mid;m3.building={stories,baysX:bx,baysY:by,storyHeights:hs.join(','),bayWidthsX:wx.join(','),bayWidthsY:wy.join(','),fixedBase:fixed,baseZ:zs[0],supportPersistenceVersion:'V1.30.1'};
    // V1.30.1 Fix — enforce/persist base restraints after generation. This touches model3d only.
    if(fixed){
      const z0=zs[0];
      for(const n of m3.nodes){
        if(n.source==='V1.30_BUILDING' && Math.abs((Number(n.z)||0)-z0)<1e-9){
          n.restraints={ux:true,uy:true,uz:true,rx:true,ry:true,rz:true};
          n.supportType3d='Fixed';
        }
      }
    }
    m3.selectedNodeId=m3.nodes.find(n=>n.source==='V1.30_BUILDING' && Math.abs((Number(n.z)||0)-zs[0])<1e-9)?.id || m3.nodes[0]?.id || null;m3.selectedMemberId=null;
    if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(true);
    close(); alert(`3D Building generated: ${m3.nodes.length} Nodes, ${m3.members.length} Members. 2D model unchanged.`)
  }catch(e){alert('3D Building Generator: '+e.message)}};
}


// ===== V1.45 — Advanced 3D Member Loads (UDL / Point / Trapezoidal / Member Moment) =====
function ensure3DLoadSystemV131(){
  const m3=state.model3d||(state.model3d={nodes:[],members:[],nextNode:1,nextMember:1,view:{yaw:-35,pitch:24,scale:34}});
  m3.loadPatterns ||= [
    {id:'DL',name:'Dead Load'},
    {id:'LL',name:'Live Load'},
    {id:'RL',name:'Roof Live Load'},
    {id:'WX',name:'Wind X'},
    {id:'WY',name:'Wind Y'}
  ];
  m3.activeLoadPattern ||= m3.loadPatterns[0]?.id||'DL';
  m3.showLoads = m3.showLoads!==false;
  for(const n of m3.nodes||[]) n.loads3d ||= {};
  for(const m of m3.members||[]) m.loads3d ||= {};
  return m3;
}
function memberStoryV131(m){
  const m3=ensure3DLoadSystemV131(),a=m3.nodes.find(n=>n.id===m.i),b=m3.nodes.find(n=>n.id===m.j);
  if(!a||!b)return 0;
  return Math.max(Number(a.story)||0,Number(b.story)||0);
}
function memberLength3DV131(m){const m3=ensure3DLoadSystemV131(),a=m3.nodes.find(n=>n.id===m.i),b=m3.nodes.find(n=>n.id===m.j);return a&&b?Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z):0}
function memberPatternLoadsV131(m,pat){m.loads3d ||= {};m.loads3d[pat] ||= [];return m.loads3d[pat]}
function loadPatternByIdV131(id){const m3=ensure3DLoadSystemV131();return m3.loadPatterns.find(x=>x.id===id)||{id,name:id}}
function clamp01V145(v){return Math.max(0,Math.min(1,Number(v)||0))}
function loadResultantV145(ld,L){
  if(ld.type==='UDL')return {force:(Number(ld.w)||0)*L,moment:0,label:`${Number(ld.w||0).toFixed(3)} kN/m`};
  if(ld.type==='POINT')return {force:Number(ld.P)||0,moment:0,label:`${Number(ld.P||0).toFixed(3)} kN @ ${(100*clamp01V145(ld.r)).toFixed(1)}%`};
  if(ld.type==='TRAP'){
    const a=clamp01V145(ld.a),b=Math.max(a,clamp01V145(ld.b)),len=(b-a)*L,w1=Number(ld.w1)||0,w2=Number(ld.w2)||0;
    return {force:(w1+w2)*len/2,moment:0,label:`${w1.toFixed(3)}→${w2.toFixed(3)} kN/m @ ${(100*a).toFixed(0)}–${(100*b).toFixed(0)}%`};
  }
  if(ld.type==='MOMENT')return {force:0,moment:Number(ld.M)||0,label:`${Number(ld.M||0).toFixed(3)} kN·m @ ${(100*clamp01V145(ld.r)).toFixed(1)}%`};
  return {force:0,moment:0,label:'—'};
}
function loadSystem3dCenterV131(){
  const m3=ensure3DLoadSystemV131();
  const wrap=document.createElement('div');wrap.className='eng-dialog v131-load-modal';
  const pats=()=>m3.loadPatterns.map(x=>`<option value="${x.id}">${x.id} — ${x.name}</option>`).join('');
  const stories=Math.max(0,Number(m3.building?.stories)||Math.max(0,...m3.nodes.map(n=>Number(n.story)||0)));
  const beamOptions=()=>m3.members.filter(m=>String(m.memberType||'').startsWith('Beam')).map(m=>`<option value="${m.id}">M${m.id} • ${m.memberType||'Beam'} • Story ${memberStoryV131(m)}</option>`).join('');
  wrap.innerHTML=`<div class="eng-card v131-load-card"><div class="section-db-head"><div><h2>3D Building Load System — V1.46</h2><small>Advanced Member Loads • UDL + Point + Trapezoidal + Member Moment • solver-linked</small></div><button class="ml-close">×</button></div>
  <div class="v131-grid"><section><h3>Load Pattern</h3><label>Active Pattern<select id="v131Pattern">${pats()}</select></label><div class="v131-inline"><input id="v131NewId" placeholder="EQX"><input id="v131NewName" placeholder="Custom load"><button id="v131AddPattern">＋ Add</button></div><label class="v131-check"><input id="v131ShowLoads" type="checkbox" ${m3.showLoads?'checked':''}> Show 3D Loads in Workspace</label></section>
  <section><h3>Member Assignment</h3><label>Story<select id="v131Story"><option value="ALL">All Stories</option>${Array.from({length:stories},(_,i)=>`<option value="${i+1}">Story ${i+1}${i+1===stories?' (Roof)':''}</option>`).join('')}</select></label><label>Target<select id="v131Target"><option value="ALL">All Beams</option><option value="Beam-X">Beam-X</option><option value="Beam-Y">Beam-Y</option><option value="SINGLE">Single Member</option></select></label><label id="v145MemberWrap" style="display:none">Member<select id="v145Member">${beamOptions()}</select></label><label>Load Type<select id="v145Type"><option value="UDL">UDL</option><option value="POINT">Point Load</option><option value="TRAP">Trapezoidal Load</option><option value="MOMENT">Member Moment</option></select></label><div id="v145Fields"></div><button id="v131Assign" class="primary">Assign Load</button><button id="v131Clear" class="danger">Clear Filtered Loads</button></section>
  <section><h3>Load Summary</h3><div id="v131Summary" class="v131-summary"></div><div class="engineering-note"><b>V1.46 scope:</b> Advanced 3D member loads are assigned inside <b>3D Loads</b> and feed the 3D frame solver through consistent equivalent nodal loads. Point/Trapezoidal forces use Global X/Y/Z direction; Member Moment uses Local 1/2/3 axis. Positions are measured from member end <b>i</b> as x/L.</div></section></div>
  <div class="v131-table-wrap"><table><thead><tr><th>Pattern</th><th>Story</th><th>Member</th><th>Type</th><th>Direction / Axis</th><th>Value / Position</th><th>Resultant</th></tr></thead><tbody id="v131Rows"></tbody></table></div></div>`;
  document.body.appendChild(wrap);
  const q=id=>wrap.querySelector('#'+id), close=()=>{wrap.remove();if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(false)};wrap.querySelector('.ml-close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
  q('v131Pattern').value=m3.activeLoadPattern;q('v131ShowLoads').onchange=e=>{m3.showLoads=!!e.target.checked;if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(false)};
  function renderFields(){
    const type=q('v145Type').value,f=q('v145Fields');
    if(type==='UDL')f.innerHTML=`<label>Direction<select id="v145Dir"><option value="GZ">Global Z</option><option value="GX">Global X</option><option value="GY">Global Y</option></select></label><label>UDL w (kN/m)<input id="v145W" type="number" step="0.1" value="-10"></label>`;
    else if(type==='POINT')f.innerHTML=`<label>Direction<select id="v145Dir"><option value="GZ">Global Z</option><option value="GX">Global X</option><option value="GY">Global Y</option></select></label><label>Point P (kN)<input id="v145P" type="number" step="0.1" value="-50"></label><label>Position x/L from i (0–1)<input id="v145R" type="number" min="0" max="1" step="0.01" value="0.85"></label>`;
    else if(type==='TRAP')f.innerHTML=`<label>Direction<select id="v145Dir"><option value="GZ">Global Z</option><option value="GX">Global X</option><option value="GY">Global Y</option></select></label><div class="v131-inline"><label>w1 (kN/m)<input id="v145W1" type="number" step="0.1" value="-5"></label><label>w2 (kN/m)<input id="v145W2" type="number" step="0.1" value="-20"></label></div><div class="v131-inline"><label>Start x/L<input id="v145A" type="number" min="0" max="1" step="0.01" value="0"></label><label>End x/L<input id="v145B" type="number" min="0" max="1" step="0.01" value="1"></label></div>`;
    else f.innerHTML=`<label>Moment Axis<select id="v145Axis"><option value="L3">Local 3 (bending M3)</option><option value="L2">Local 2 (bending M2)</option><option value="L1">Local 1 (torsion)</option></select></label><label>Moment M (kN·m)<input id="v145M" type="number" step="0.1" value="50"></label><label>Position x/L from i (0–1)<input id="v145R" type="number" min="0" max="1" step="0.01" value="0.5"></label>`;
  }
  function filteredMembers(){const st=q('v131Story').value,target=q('v131Target').value;return m3.members.filter(m=>String(m.memberType||'').startsWith('Beam')&&(st==='ALL'||memberStoryV131(m)===Number(st))&&(target==='ALL'||target==='SINGLE'||m.memberType===target)&&(target!=='SINGLE'||m.id===Number(q('v145Member').value)))}
  function refresh(){
    m3.activeLoadPattern=q('v131Pattern').value;const p=m3.activeLoadPattern,rows=[];let count=0,totalForce=0,totalMoment=0;
    for(const m of m3.members)for(const ld of (m.loads3d?.[p]||[])){const L=memberLength3DV131(m),rr=loadResultantV145(ld,L);count++;totalForce+=rr.force;totalMoment+=rr.moment;const da=ld.type==='MOMENT'?(ld.axis||'L3'):(ld.direction||'GZ');rows.push(`<tr><td>${p}</td><td>${memberStoryV131(m)}</td><td>M${m.id}</td><td>${ld.type}</td><td>${da}</td><td>${rr.label}</td><td>${ld.type==='MOMENT'?`${rr.moment.toFixed(3)} kN·m`:`${rr.force.toFixed(3)} kN`}</td></tr>`)}
    q('v131Rows').innerHTML=rows.join('')||'<tr><td colspan="7">No assigned loads in this pattern.</td></tr>';
    q('v131Summary').innerHTML=`<b>${loadPatternByIdV131(p).id} — ${loadPatternByIdV131(p).name}</b><span>${count} member loads • Σ Force resultants = ${totalForce.toFixed(3)} kN</span><span>Σ Member moments = ${totalMoment.toFixed(3)} kN·m • Selected filter: ${filteredMembers().length} beams</span>`;
    if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(false)
  }
  q('v131Pattern').onchange=refresh;q('v131Story').onchange=refresh;q('v131Target').onchange=()=>{q('v145MemberWrap').style.display=q('v131Target').value==='SINGLE'?'block':'none';refresh()};q('v145Member').onchange=refresh;q('v145Type').onchange=renderFields;
  q('v131AddPattern').onclick=()=>{const id=q('v131NewId').value.trim().toUpperCase(),name=q('v131NewName').value.trim()||id;if(!id)return alert('Enter Load Pattern ID');if(m3.loadPatterns.some(x=>x.id===id))return alert('Load Pattern already exists');m3.loadPatterns.push({id,name});q('v131Pattern').innerHTML=pats();q('v131Pattern').value=id;m3.activeLoadPattern=id;refresh()};
  q('v131Assign').onclick=()=>{
    const p=q('v131Pattern').value,type=q('v145Type').value,ms=filteredMembers();if(!ms.length)return alert('No matching 3D beams');let ld=null;
    if(type==='UDL'){const w=Number(q('v145W').value);if(!Number.isFinite(w)||w===0)return alert('Enter non-zero UDL');ld={type,direction:q('v145Dir').value,w}}
    else if(type==='POINT'){const P=Number(q('v145P').value),r=Number(q('v145R').value);if(!Number.isFinite(P)||P===0)return alert('Enter non-zero Point Load');if(!(r>=0&&r<=1))return alert('Point position x/L must be within 0–1');ld={type,direction:q('v145Dir').value,P,r}}
    else if(type==='TRAP'){const w1=Number(q('v145W1').value),w2=Number(q('v145W2').value),a=Number(q('v145A').value),b=Number(q('v145B').value);if(!Number.isFinite(w1)||!Number.isFinite(w2)||(w1===0&&w2===0))return alert('Enter trapezoidal load magnitudes');if(!(a>=0&&a< b&&b<=1))return alert('Trapezoidal range must satisfy 0 ≤ Start < End ≤ 1');ld={type,direction:q('v145Dir').value,w1,w2,a,b}}
    else {const M=Number(q('v145M').value),r=Number(q('v145R').value);if(!Number.isFinite(M)||M===0)return alert('Enter non-zero Member Moment');if(!(r>=0&&r<=1))return alert('Moment position x/L must be within 0–1');ld={type,axis:q('v145Axis').value,M,r}}
    for(const m of ms)memberPatternLoadsV131(m,p).push({...ld,source:'V1.45_ADVANCED_MEMBER_LOAD',story:memberStoryV131(m)});m3.activeLoadPattern=p;m3.results=null;invalidate3DDesignDerivedV1451('ADVANCED MEMBER LOAD ASSIGNED');refresh();toast(`V1.46 assigned ${type} to ${ms.length} 3D beam${ms.length===1?'':'s'} • RC design cache invalidated`)
  };
  q('v131Clear').onclick=()=>{const p=q('v131Pattern').value,ids=new Set(filteredMembers().map(m=>m.id));for(const m of m3.members)if(ids.has(m.id)&&m.loads3d?.[p])m.loads3d[p]=[];m3.results=null;invalidate3DDesignDerivedV1451('ADVANCED MEMBER LOADS CLEARED');refresh();toast(`V1.46 cleared filtered ${p} 3D loads • RC design cache invalidated`)};
  renderFields();refresh();
}
function elementEquivalentLoadV131(m,ni,nj,pat,T){
  const loads=m.loads3d?.[pat]||[],L=Math.hypot(nj.x-ni.x,nj.y-ni.y,nj.z-ni.z),fe=Array(12).fill(0);
  if(!loads.length||L<1e-12)return fe;const R=v128Axes(ni,nj);
  const gvec=(mag,dir)=>dir==='GX'?[mag,0,0]:dir==='GY'?[0,mag,0]:[0,0,mag];
  const toLocal=(mag,dir)=>{const gv=gvec(mag,dir);return R.map(r=>r[0]*gv[0]+r[1]*gv[1]+r[2]*gv[2])};
  const addPointForce=(r,qx,qy,qz)=>{r=clamp01V145(r);const H1=1-3*r*r+2*r*r*r,H2=L*(r-2*r*r+r*r*r),H3=3*r*r-2*r*r*r,H4=L*(-r*r+r*r*r);fe[0]+=qx*(1-r);fe[6]+=qx*r;fe[1]+=qy*H1;fe[5]+=qy*H2;fe[7]+=qy*H3;fe[11]+=qy*H4;fe[2]+=qz*H1;fe[4]+=-qz*H2;fe[8]+=qz*H3;fe[10]+=-qz*H4};
  const gauss=[[-0.8611363116,0.3478548451],[-0.3399810436,0.6521451549],[0.3399810436,0.6521451549],[0.8611363116,0.3478548451]];
  for(const ld of loads){
    if(ld.type==='UDL'){const q=toLocal(Number(ld.w)||0,ld.direction||'GZ'),qx=q[0],qy=q[1],qz=q[2];fe[0]+=qx*L/2;fe[6]+=qx*L/2;fe[1]+=qy*L/2;fe[5]+=qy*L*L/12;fe[7]+=qy*L/2;fe[11]+=-qy*L*L/12;fe[2]+=qz*L/2;fe[4]+=-qz*L*L/12;fe[8]+=qz*L/2;fe[10]+=qz*L*L/12}
    else if(ld.type==='POINT'){const q=toLocal(Number(ld.P)||0,ld.direction||'GZ');addPointForce(ld.r,q[0],q[1],q[2])}
    else if(ld.type==='TRAP'){
      const a=clamp01V145(ld.a),b=Math.max(a,clamp01V145(ld.b));if(b<=a)continue;const xa=a*L,xb=b*L,w1=Number(ld.w1)||0,w2=Number(ld.w2)||0;
      for(const [g,wt] of gauss){const x=(xa+xb)/2+g*(xb-xa)/2,r=x/L,t=(x-xa)/(xb-xa),w=w1+(w2-w1)*t,q=toLocal(w,ld.direction||'GZ'),J=(xb-xa)/2*wt;const H1=1-3*r*r+2*r*r*r,H2=L*(r-2*r*r+r*r*r),H3=3*r*r-2*r*r*r,H4=L*(-r*r+r*r*r);fe[0]+=(1-r)*q[0]*J;fe[6]+=r*q[0]*J;fe[1]+=H1*q[1]*J;fe[5]+=H2*q[1]*J;fe[7]+=H3*q[1]*J;fe[11]+=H4*q[1]*J;fe[2]+=H1*q[2]*J;fe[4]+=-H2*q[2]*J;fe[8]+=H3*q[2]*J;fe[10]+=-H4*q[2]*J}
    }else if(ld.type==='MOMENT'){
      const M=Number(ld.M)||0,r=clamp01V145(ld.r),dH1=(-6*r+6*r*r)/L,dH2=1-4*r+3*r*r,dH3=(6*r-6*r*r)/L,dH4=-2*r+3*r*r,axis=ld.axis||'L3';
      if(axis==='L1'){fe[3]+=M*(1-r);fe[9]+=M*r}
      else if(axis==='L2'){fe[2]+=-M*dH1;fe[4]+=M*dH2;fe[8]+=-M*dH3;fe[10]+=M*dH4}
      else {fe[1]+=M*dH1;fe[5]+=M*dH2;fe[7]+=M*dH3;fe[11]+=M*dH4}
    }
  }return fe;
}

// ===== V1.28 — Integrated 3D Workspace + Phase 2 numerical solver =====
let integrated3dActiveV128=false;
let integrated3dRefreshV128=null; // V1.28.1 bridge: Model Data -> main 3D workspace refresh
function v128Norm(a){const n=Math.hypot(...a);if(n<1e-12)throw new Error('Invalid 3D member orientation');return a.map(v=>v/n)}
function v128Cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function v128Axes(a,b){const ex=v128Norm([b.x-a.x,b.y-a.y,b.z-a.z]);const ref=Math.abs(ex[2])<.9?[0,0,1]:[0,1,0];const ey=v128Norm(v128Cross(ref,ex));const ez=v128Norm(v128Cross(ex,ey));return [ex,ey,ez]}
function v128T(R){const T=zeros(12,12);for(const base of [0,3,6,9])for(let i=0;i<3;i++)for(let j=0;j<3;j++)T[base+i][base+j]=R[i][j];return T}
function v128Klocal(m,L){
 const E=+m.E||200000000,G=+m.G||76923077,A=+m.A||.01,Iy=+m.Iy||8e-5,Iz=+m.Iz||8e-5,J=+m.J||1e-5,k=zeros(12,12);
 const set=(i,j,v)=>{k[i][j]+=v;if(i!==j)k[j][i]+=v};
 let a=E*A/L;set(0,0,a);set(0,6,-a);set(6,6,a);a=G*J/L;set(3,3,a);set(3,9,-a);set(9,9,a);
 a=12*E*Iz/L**3;let b=6*E*Iz/L**2,c=4*E*Iz/L,d=2*E*Iz/L;set(1,1,a);set(1,5,b);set(1,7,-a);set(1,11,b);set(5,5,c);set(5,7,-b);set(5,11,d);set(7,7,a);set(7,11,-b);set(11,11,c);
 a=12*E*Iy/L**3;b=6*E*Iy/L**2;c=4*E*Iy/L;d=2*E*Iy/L;set(2,2,a);set(2,4,-b);set(2,8,-a);set(2,10,-b);set(4,4,c);set(4,8,b);set(4,10,d);set(8,8,a);set(8,10,b);set(10,10,c);return k
}

// ===== V1.32 — 3D Global Equilibrium & Analysis Summary (read-only verification layer) =====
function equilibriumWrenchV132(nodes, vec, imap){
  const out={fx:0,fy:0,fz:0,mx:0,my:0,mz:0};
  for(const n of nodes){
    const q=imap.get(n.id)*6;
    const fx=Number(vec[q]||0),fy=Number(vec[q+1]||0),fz=Number(vec[q+2]||0);
    const mx=Number(vec[q+3]||0),my=Number(vec[q+4]||0),mz=Number(vec[q+5]||0);
    out.fx+=fx;out.fy+=fy;out.fz+=fz;
    // Total moment about global origin = nodal moment + r x F.
    out.mx+=mx + Number(n.y||0)*fz - Number(n.z||0)*fy;
    out.my+=my + Number(n.z||0)*fx - Number(n.x||0)*fz;
    out.mz+=mz + Number(n.x||0)*fy - Number(n.y||0)*fx;
  }
  return out;
}
function equilibriumCheckV132(nodes,F,RF,imap){
  const applied=equilibriumWrenchV132(nodes,F,imap),reaction=equilibriumWrenchV132(nodes,RF,imap),keys=['fx','fy','fz','mx','my','mz'];
  const residual={},checks={};let pass=true,maxRatio=0;
  for(const k of keys){
    const r=applied[k]+reaction[k];residual[k]=r;
    const scale=Math.max(1,Math.abs(applied[k]),Math.abs(reaction[k]));
    const tol=Math.max(1e-6,1e-6*scale),ratio=Math.abs(r)/tol;
    checks[k]={residual:r,tolerance:tol,pass:Math.abs(r)<=tol};
    pass=pass&&checks[k].pass;maxRatio=Math.max(maxRatio,ratio);
  }
  return {origin:{x:0,y:0,z:0},applied,reaction,residual,checks,pass,maxRatio,toleranceRule:'max(1e-6, 1e-6 × component scale)'};
}

function analysisStatusHtmlV1371(res){
  if(!res)return '';
  const eqPass=res.equilibrium?.pass!==false;const noLoad=!!res.noAppliedLoad||resultAppliedMagnitudeV1372(res)<1e-10;
  const disp=Array.isArray(res.displacements)?res.displacements:[];
  let maxT=0;
  for(const d of disp){
    const v=Math.hypot(Number(d.ux||0),Number(d.uy||0),Number(d.uz||0));
    if(Number.isFinite(v))maxT=Math.max(maxT,v);
  }
  let maxRatio=0;
  const sr=res.storyResponse;
  const rows=Array.isArray(sr)?sr:(Array.isArray(sr?.rows)?sr.rows:[]);
  for(const r of rows){
    for(const k of ['ratioX','ratioY','driftRatioX','driftRatioY']){
      const v=Math.abs(Number(r?.[k]));
      if(Number.isFinite(v))maxRatio=Math.max(maxRatio,v);
    }
  }
  const hasResponse=maxT>1e-12||maxRatio>1e-12;
  return `<div class="v1371-analysis-status" style="margin:12px 0 14px;padding:13px 14px;border:1px solid #f59e0b;border-radius:11px;background:#fffbeb">
    <div style="font-size:15px;font-weight:900;color:#78350f">Analysis Status — V1.37.1 Fix</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:9px">
      <div style="padding:9px 10px;border-radius:8px;background:${eqPass?'#f0fdf4':'#fef2f2'};border:1px solid ${eqPass?'#bbf7d0':'#fecaca'}">
        <div style="font-size:11px;font-weight:800;color:${eqPass?'#166534':'#991b1b'}">GLOBAL EQUILIBRIUM</div>
        <div style="font-size:18px;font-weight:900;color:${noLoad?'#b45309':(eqPass?'#15803d':'#b91c1c')}">${noLoad?'NO LOAD':(eqPass?'PASS ✓':'CHECK / FAIL')}</div>
        <div style="font-size:11px;color:#475569">${noLoad?'No applied load reached the solver':'Force/moment balance only'}</div>
      </div>
      <div style="padding:9px 10px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a">
        <div style="font-size:11px;font-weight:800;color:#92400e">DEFORMATION / DRIFT</div>
        <div style="font-size:18px;font-weight:900;color:#b45309">${hasResponse?'REVIEW REQUIRED':'NO RESPONSE / CHECK LOAD'}</div>
        <div style="font-size:11px;color:#475569">${hasResponse?'Serviceability must be checked separately':'If a loaded pattern was expected, verify assigned loads and active pattern.'}</div>
      </div>
      <div style="padding:9px 10px;border-radius:8px;background:#eff6ff;border:1px solid #bfdbfe">
        <div style="font-size:11px;font-weight:800;color:#1e40af">DESIGN SAFETY</div>
        <div style="font-size:18px;font-weight:900;color:#1d4ed8">NOT VERIFIED</div>
        <div style="font-size:11px;color:#475569">Requires strength/stability/code design checks</div>
      </div>
    </div>
    <div style="margin-top:8px;font-size:11px;font-weight:700;color:#9a3412">⚠ Global Equilibrium PASS is not a structural safety approval.</div>
  </div>`;
}
function equilibriumSummaryHtmlV132(eq,pattern){
  if(!eq)return '';
  const rows=[['Fx','fx','kN'],['Fy','fy','kN'],['Fz','fz','kN'],['Mx','mx','kN·m'],['My','my','kN·m'],['Mz','mz','kN·m']];
  const fmt=v=>Math.abs(v)<5e-10?'0.000000':Number(v).toFixed(6);
  return `<div class="v132-equilibrium"><div class="v132-eq-head"><div><b>3D Global Equilibrium Check</b><span>Pattern ${pattern||'—'} • moments about Global Origin (0,0,0)</span></div><strong class="${resultAppliedMagnitudeV1372({equilibrium:eq})<1e-10?'fail':(eq.pass?'pass':'fail')}">${resultAppliedMagnitudeV1372({equilibrium:eq})<1e-10?'NO LOAD':(eq.pass?'PASS':'WARNING')}</strong></div><div class="v132-eq-table-wrap"><table class="v132-eq-table"><thead><tr><th>DOF</th><th>Applied</th><th>Reaction</th><th>Residual</th><th>Status</th></tr></thead><tbody>${rows.map(([label,k,u])=>`<tr><td><b>${label}</b> <small>${u}</small></td><td>${fmt(eq.applied[k])}</td><td>${fmt(eq.reaction[k])}</td><td>${fmt(eq.residual[k])}</td><td><span class="v132-eq-pill ${eq.checks[k].pass?'pass':'fail'}">${eq.checks[k].pass?'PASS':'CHECK'}</span></td></tr>`).join('')}</tbody></table></div><div class="v132-eq-note">Residual = Applied + Reaction • tolerance: ${eq.toleranceRule}. This is a verification/reporting layer; it does not modify the 3D stiffness solver.</div></div>`;
}





// ===== V1.37.1 Fix — Analysis Results (3D constraint layer; V1.34 results protected when OFF) =====
function ensureDiaphragmsV135(){
 const m3=state.model3d||(state.model3d={nodes:[],members:[],nextNode:1,nextMember:1,view:{yaw:-35,pitch:24,scale:34}});
 m3.diaphragms ||= {enabled:false,stories:{}};
 return m3.diaphragms;
}
function diaphragmStoriesV135(m3){
 const d=ensureDiaphragmsV135();
 return new Set(Object.entries(d.stories||{}).filter(([st,v])=>v!==false&&Number(st)>0).map(([st])=>Number(st)));
}
function solveConstrained3DV135(K,F,nodes,imap,fixed,m3){
 const active=diaphragmStoriesV135(m3);
 if(!ensureDiaphragmsV135().enabled||!active.size){
   const free=[...Array(F.length).keys()].filter(i=>!fixed.has(i));
   const Kff=free.map(i=>free.map(j=>K[i][j])),Ff=free.map(i=>F[i]),uf=solveLinear(Kff,Ff),U=Array(F.length).fill(0);free.forEach((d,i)=>U[d]=uf[i]);
   return {U,mode:'NONE',activeStories:[]};
 }
 // Transformation U = C q. For each active floor: common Ux, Uy and Rz with rigid-body in-plane rotation.
 const freeSet=new Set([...Array(F.length).keys()].filter(i=>!fixed.has(i))), cols=[], colByDof=new Map(), storyCols=new Map();
 const newCol=()=>{cols.push(new Map());return cols.length-1};
 for(const st of active){
   const ns=nodes.filter(n=>Number(n.story)===st); if(ns.length<2)continue;
   const cx=ns.reduce((a,n)=>a+Number(n.x||0),0)/ns.length,cy=ns.reduce((a,n)=>a+Number(n.y||0),0)/ns.length;
   const cu=newCol(),cv=newCol(),cr=newCol();storyCols.set(st,{cu,cv,cr,cx,cy});
   for(const n of ns){const q=imap.get(n.id)*6,dx=Number(n.x||0)-cx,dy=Number(n.y||0)-cy;
     if(freeSet.has(q)){cols[cu].set(q,1);cols[cr].set(q,-dy);colByDof.set(q,true)}
     if(freeSet.has(q+1)){cols[cv].set(q+1,1);cols[cr].set(q+1,dx);colByDof.set(q+1,true)}
     if(freeSet.has(q+5)){cols[cr].set(q+5,1);colByDof.set(q+5,true)}
   }
 }
 for(const d of freeSet)if(!colByDof.has(d)){const c=newCol();cols[c].set(d,1)}
 const nr=cols.length;if(!nr)throw new Error('Rigid Diaphragm: no free DOF available.');
 const Kr=zeros(nr,nr),Fr=Array(nr).fill(0);
 for(let a=0;a<nr;a++)for(const [i,ci] of cols[a]){Fr[a]+=ci*F[i];for(let b=0;b<nr;b++){let sum=0;for(const [j,cj] of cols[b])sum+=K[i][j]*cj;Kr[a][b]+=ci*sum}}
 const qr=solveLinear(Kr,Fr),U=Array(F.length).fill(0);for(let a=0;a<nr;a++)for(const [i,c] of cols[a])U[i]+=c*qr[a];
 return {U,mode:'RIGID_XY_RZ',activeStories:[...storyCols.keys()].sort((a,b)=>a-b)};
}
function diaphragmCenterV135(){
 const m3=state.model3d,d=ensureDiaphragmsV135();
 const stories=Math.max(Number(m3?.building?.stories)||0,...(m3?.nodes||[]).map(n=>Number(n.story)||0));
 const wrap=document.createElement('div');wrap.className='eng-dialog v130-building-modal';
 wrap.innerHTML=`<div class="eng-card v130-building-card"><div class="section-db-head"><div><h2>Rigid Floor Diaphragm — V1.35</h2><small>Constrains floor in-plane Ux, Uy and Rz • 3D solver transformation method</small></div><button class="ml-close">×</button></div>
 <label class="v130-check"><input id="v135Enable" type="checkbox" ${d.enabled?'checked':''}> Enable Rigid Diaphragm constraints</label>
 <div class="v135-diaphragm-list">${Array.from({length:stories},(_,i)=>i+1).map(st=>`<label class="v130-check"><input type="checkbox" data-v135-story="${st}" ${d.stories?.[st]!==false?'checked':''}> Story ${st} — D${st}</label>`).join('')||'<div class="empty">Generate a 3D Building first.</div>'}</div>
 <div class="engineering-note"><b>Constraint:</b> each selected floor moves as a rigid plane in Global X-Y: Ux = Ux₀ − θz(y−yc), Uy = Uy₀ + θz(x−xc), Rz = θz. Uz, Rx and Ry remain independent. Turning this OFF reproduces the V1.34 solver behavior.</div>
 <div id="v135ApplyStatus" style="display:none;margin:10px 0 0;padding:10px 12px;border:1px solid #86efac;background:#f0fdf4;border-radius:10px;color:#166534;font-weight:700">✓ Diaphragm settings applied. Re-analyze 3D to use the updated constraints.</div>
 <div class="v130-building-actions"><button id="v135Apply" class="primary">Apply Diaphragm</button><button id="v135Cancel">Cancel</button></div></div>`;
 document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('.ml-close').onclick=close;wrap.querySelector('#v135Cancel').onclick=close;
 wrap.querySelector('#v135Apply').onclick=()=>{
  d.enabled=wrap.querySelector('#v135Enable').checked;
  d.stories={};
  wrap.querySelectorAll('[data-v135-story]').forEach(x=>d.stories[x.dataset.v135Story]=x.checked);
  m3.results=null;
  const active=Object.entries(d.stories).filter(([,on])=>on).map(([st])=>'D'+st);
  const btn=wrap.querySelector('#v135Apply');
  const status=wrap.querySelector('#v135ApplyStatus');
  btn.textContent='✓ Applied';
  btn.disabled=true;
  status.style.display='block';
  status.innerHTML=`✓ Diaphragm ${d.enabled?'ON':'OFF'} applied${d.enabled&&active.length?' • '+active.join(' / '):''}.<br><span style="font-weight:500">Click Analyze 3D to solve with the updated constraints.</span>`;
  const wsBtn=document.querySelector('#v135Diaphragm');
  if(wsBtn){
    wsBtn.textContent=d.enabled?`▦ Diaphragm ON (${active.length})`:'▦ Diaphragm OFF';
    wsBtn.classList.toggle('active3d',!!d.enabled);
  }
  const top=document.querySelector('#v128TopStatus');
  if(top)top.textContent=`V1.35.1 Fix • Diaphragm ${d.enabled?'ON':'OFF'}${d.enabled&&active.length?' • '+active.join('/') : ''} • Re-analyze required`;
  if(typeof integrated3dRefreshV128==='function')integrated3dRefreshV128(false);
  toast(`Diaphragm ${d.enabled?'enabled':'disabled'} • settings applied`);
  setTimeout(()=>{btn.disabled=false;btn.textContent='Apply Diaphragm'},900);
};
}
function diaphragmSummaryHtmlV135(res){const a=res?.diaphragm?.activeStories||[];return `<div class="v132-eq-note"><b>Rigid Diaphragm:</b> ${res?.diaphragm?.mode==='RIGID_XY_RZ'?`ON • Stories ${a.join(', ')} • Ux/Uy/Rz constrained`:'OFF • V1.34-compatible unconstrained floor DOFs'}</div>`}

// ===== V1.34 — Story Forces & Story Shear (post-processing only; V1.32 solver protected) =====
function storyResponseV133(m3,res){
  const byId=new Map((res.displacements||[]).map(d=>[Number(d.id),d]));
  const stories=Math.max(Number(m3.building?.stories)||0,...(m3.nodes||[]).map(n=>Number(n.story)||0));
  const hs=String(m3.building?.storyHeights||'').split(',').map(Number).filter(v=>Number.isFinite(v)&&v>0);
  const rows=[];
  for(let st=1;st<=stories;st++){
    const cur=(m3.nodes||[]).filter(n=>Number(n.story)===st), prev=(m3.nodes||[]).filter(n=>Number(n.story)===st-1);
    if(!cur.length)continue;
    const prevGrid=new Map(prev.map(n=>[`${n.gridX??''}:${n.gridY??''}`,n]));
    let ux=0,uy=0,driftX=0,driftY=0;
    let uxNodeId=null,uyNodeId=null,driftXNodeId=null,driftYNodeId=null;
    for(const n of cur){
      const d=byId.get(Number(n.id)); if(!d)continue;
      // Keep the exact node that produced each reported story value.
      // Strict '>' makes ties deterministic instead of silently jumping to a later node.
      if(uxNodeId===null || Math.abs(d.ux)>Math.abs(ux)){ux=d.ux;uxNodeId=n.id}
      if(uyNodeId===null || Math.abs(d.uy)>Math.abs(uy)){uy=d.uy;uyNodeId=n.id}
      const pn=prevGrid.get(`${n.gridX??''}:${n.gridY??''}`),pd=pn&&byId.get(Number(pn.id));
      const dx=d.ux-(pd?.ux||0),dy=d.uy-(pd?.uy||0);
      if(driftXNodeId===null || Math.abs(dx)>Math.abs(driftX)){driftX=dx;driftXNodeId=n.id}
      if(driftYNodeId===null || Math.abs(dy)>Math.abs(driftY)){driftY=dy;driftYNodeId=n.id}
    }
    const z=Math.max(...cur.map(n=>Number(n.z)||0)),z0=prev.length?Math.max(...prev.map(n=>Number(n.z)||0)):0;
    const h=(hs[st-1]||z-z0||1),rx=Math.abs(driftX)/h,ry=Math.abs(driftY)/h;
    const direction=rx>=ry?'X':'Y';
    // Story-row Locate follows the node that produced the displayed Story Displacement
    // in the governing direction, rather than a separately overwritten drift node.
    const nodeId=direction==='X'?uxNodeId:uyNodeId;
    rows.push({story:st,elevation:z,height:h,ux,uy,driftX,driftY,ratioX:rx,ratioY:ry,governingRatio:Math.max(rx,ry),direction,nodeId,uxNodeId,uyNodeId,driftXNodeId,driftYNodeId});
  }
  const governing=rows.reduce((a,b)=>!a||b.governingRatio>a.governingRatio?b:a,null);
  return {rows,governing};
}
function storyResponseHtmlV133(sr){
  if(!sr?.rows?.length)return '<div class="empty">No story data available. Generate the model with 3D Building first.</div>';
  const g=sr.governing;
  return `<div class="v133-story-summary"><div><b>Governing Story</b><strong>Story ${g.story}</strong></div><div><b>Direction</b><strong>${g.direction}</strong></div><div><b>Max Drift</b><strong>${(Math.max(Math.abs(g.driftX),Math.abs(g.driftY))*1000).toFixed(4)} mm</strong></div><div><b>Max Drift Ratio</b><strong>${g.governingRatio.toFixed(6)}</strong></div></div><div class="v133-story-note">Story displacement = maximum floor-node translation. Story drift compares matching Grid X/Y nodes with the story below. Drift Ratio = |Δstory| / story height.</div><div class="v132-eq-table-wrap"><table class="v133-story-table"><thead><tr><th>Story</th><th>Elevation m</th><th>Ux mm</th><th>Uy mm</th><th>Drift X mm</th><th>Drift Y mm</th><th>Ratio X</th><th>Ratio Y</th><th>Gov.</th></tr></thead><tbody>${sr.rows.slice().reverse().map(r=>`<tr class="v128-result-row" ${r.nodeId?`data-node-id="${r.nodeId}"`:''}><td><button class="v128-link" ${r.nodeId?`data-node-id="${r.nodeId}"`:''}>Story ${r.story}</button></td><td>${r.elevation.toFixed(3)}</td><td>${(r.ux*1000).toFixed(4)}</td><td>${(r.uy*1000).toFixed(4)}</td><td>${(r.driftX*1000).toFixed(4)}</td><td>${(r.driftY*1000).toFixed(4)}</td><td>${r.ratioX.toFixed(6)}</td><td>${r.ratioY.toFixed(6)}</td><td>${r.direction}${r===g?' ★':''}</td></tr>`).join('')}</tbody></table></div>`;
}

// ===== V1.41.1 — RC Beam Shear Design Verification =====
function normalize3DPatternIdV1372(id){return String(id||'DL').trim().toUpperCase()||'DL'}
function patternLoadAuditV1372(m3,pat){
  pat=normalize3DPatternIdV1372(pat);let nodeTerms=0,memberTerms=0,absInput=0;
  for(const n of (m3.nodes||[])){
    const x=n.loads3d?.[pat];
    if(Array.isArray(x)){for(const q of x){for(const k of ['fx','fy','fz','mx','my','mz']){const v=Number(q?.[k]||0);if(v){nodeTerms++;absInput+=Math.abs(v)}}}}
    else if(x&&typeof x==='object'){for(const k of ['fx','fy','fz','mx','my','mz']){const v=Number(x[k]||0);if(v){nodeTerms++;absInput+=Math.abs(v)}}}
  }
  for(const m of (m3.members||[]))for(const ld of (m.loads3d?.[pat]||[])){
    const L=memberLength3DV131(m);let mag=0;
    if(ld?.type==='UDL')mag=Math.abs(Number(ld.w)||0)*L;
    else if(ld?.type==='POINT')mag=Math.abs(Number(ld.P)||0);
    else if(ld?.type==='TRAP'){const a=clamp01V145(ld.a),b=Math.max(a,clamp01V145(ld.b));mag=Math.abs((Number(ld.w1)||0)+(Number(ld.w2)||0))*(b-a)*L/2}
    else if(ld?.type==='MOMENT')mag=Math.abs(Number(ld.M)||0);
    if(mag){memberTerms++;absInput+=mag}
  }
  return {pattern:pat,nodeTerms,memberTerms,totalTerms:nodeTerms+memberTerms,absInput,hasAssigned:(nodeTerms+memberTerms)>0};
}
function nodalPatternLoadV1372(n,pat){
  const out={fx:0,fy:0,fz:0,mx:0,my:0,mz:0},x=n.loads3d?.[pat];
  const add=q=>{if(!q||typeof q!=='object')return;for(const k of Object.keys(out))out[k]+=Number(q[k]||0)};
  if(Array.isArray(x))x.forEach(add);else add(x);return out;
}
function resultAppliedMagnitudeV1372(res){
  const a=res?.equilibrium?.applied;if(!a)return 0;return Math.max(...['fx','fy','fz','mx','my','mz'].map(k=>Math.abs(Number(a[k]||0))));
}
function solve3DV128(){
 // V1.46.1 GUARANTEE: this function assembles K/F from ALL 3D nodes and members.
 // UI member selection is intentionally not referenced anywhere in the solve path.
 const m3=state.model3d;if(!m3?.nodes?.length||!m3?.members?.length)throw new Error('Add 3D Nodes and Members first.');
 ensure3DLoadSystemV131();const pat=normalize3DPatternIdV1372(m3.activeLoadPattern||'DL');m3.activeLoadPattern=pat;if(!m3.loadPatterns.some(x=>normalize3DPatternIdV1372(x.id||x)===pat))m3.loadPatterns.push({id:pat,name:pat});const loadAudit=patternLoadAuditV1372(m3,pat);const nodes=[...m3.nodes].sort((a,b)=>a.id-b.id),imap=new Map(nodes.map((n,i)=>[n.id,i])),nd=nodes.length*6,K=zeros(nd,nd),F=Array(nd).fill(0),elements=[];
 for(const n of nodes){const q=imap.get(n.id)*6,l=n.load||{},lp=nodalPatternLoadV1372(n,pat);['fx','fy','fz','mx','my','mz'].forEach((key,i)=>F[q+i]=(+l[key]||0)+(+lp[key]||0))}
 for(const m of m3.members){const ni=m3.nodes.find(n=>n.id==m.i),nj=m3.nodes.find(n=>n.id==m.j);if(!ni||!nj)throw new Error('Invalid connectivity at M'+m.id);const L=Math.hypot(nj.x-ni.x,nj.y-ni.y,nj.z-ni.z);if(L<1e-9)throw new Error('Zero-length M'+m.id);const T=v128T(v128Axes(ni,nj)),kl=v128Klocal(m,L),kg=matMul(transpose(T),matMul(kl,T)),dofs=[];for(const id of [m.i,m.j]){const q=imap.get(id)*6;for(let j=0;j<6;j++)dofs.push(q+j)}for(let i=0;i<12;i++)for(let j=0;j<12;j++)K[dofs[i]][dofs[j]]+=kg[i][j];const feLocal=elementEquivalentLoadV131(m,ni,nj,pat,T),feGlobal=matVec(transpose(T),feLocal);for(let i=0;i<12;i++)F[dofs[i]]+=feGlobal[i];elements.push({m,T,kl,dofs,feLocal})}
 const fixed=new Set();for(const n of nodes){const q=imap.get(n.id)*6,r=n.restraints||{};['ux','uy','uz','rx','ry','rz'].forEach((key,i)=>{if(r[key])fixed.add(q+i)})}if(!fixed.size)throw new Error('3D model has no restrained DOF.');
 const diaphragm=solveConstrained3DV135(K,F,nodes,imap,fixed,m3),U=diaphragm.U;const RF=matVec(K,U).map((v,i)=>v-F[i]);
 const displacements=nodes.map(n=>{const q=imap.get(n.id)*6;return{id:n.id,ux:U[q],uy:U[q+1],uz:U[q+2],rx:U[q+3],ry:U[q+4],rz:U[q+5]}});
 const reactions=nodes.map(n=>{const q=imap.get(n.id)*6;return{id:n.id,fx:RF[q],fy:RF[q+1],fz:RF[q+2],mx:RF[q+3],my:RF[q+4],mz:RF[q+5]}});
 const memberForces=elements.map(e=>{const ug=e.dofs.map(d=>U[d]),ul=matVec(e.T,ug),fl=matVec(e.kl,ul).map((v,i)=>v-(e.feLocal?.[i]||0));return{id:e.m.id,i:e.m.i,j:e.m.j,local:fl}});const equilibrium=equilibriumCheckV132(nodes,F,RF,imap);m3.results={U,F,K,displacements,reactions,memberForces,loadPattern:pat,equilibrium,diaphragm,loadAudit};m3.results.noAppliedLoad=resultAppliedMagnitudeV1372(m3.results)<1e-10;m3.results.storyResponse=storyResponseV133(m3,m3.results);m3.results.storyForces=storyForcesV134(m3,m3.results,imap);return m3.results
}

function storyForcesV134(m3,res,imap){
  const rows=[];
  const stories=Math.max(Number(m3.building?.stories)||0,...(m3.nodes||[]).map(n=>Number(n.story)||0));
  for(let st=1;st<=stories;st++){
    const ns=(m3.nodes||[]).filter(n=>Number(n.story)===st);
    if(!ns.length)continue;
    let fx=0,fy=0,fz=0;
    for(const n of ns){
      const k=imap.get(Number(n.id)); if(k==null)continue;
      fx+=Number(res.F[k*6]||0); fy+=Number(res.F[k*6+1]||0); fz+=Number(res.F[k*6+2]||0);
    }
    rows.push({story:st,elevation:Math.max(...ns.map(n=>Number(n.z)||0)),fx,fy,fz,nodeIds:ns.map(n=>Number(n.id))});
  }
  let sx=0,sy=0;
  for(let i=rows.length-1;i>=0;i--){sx+=rows[i].fx;sy+=rows[i].fy;rows[i].shearX=sx;rows[i].shearY=sy}
  const governing=rows.reduce((g,r)=>{
    const ax=Math.abs(r.shearX),ay=Math.abs(r.shearY),v=Math.max(ax,ay);
    return !g||v>g.value?{story:r.story,direction:ax>=ay?'X':'Y',value:v,row:r}:g
  },null);
  return {rows,governing};
}
function storyForcesHtmlV134(sf,pat){
  if(!sf?.rows?.length)return '<div class="empty">No story force data available.</div>';
  const g=sf.governing;
  return `<div class="v133-story-summary"><div><b>Governing Story</b><strong>Story ${g.story}</strong></div><div><b>Direction</b><strong>${g.direction}</strong></div><div><b>Max Story Shear</b><strong>${g.value.toFixed(4)} kN</strong></div><div><b>Pattern</b><strong>${pat||'—'}</strong></div></div>
  <div class="v133-story-note">Story force is assembled from the same global load vector used by the 3D stiffness solver. Story Shear = cumulative lateral force at and above each story.</div>
  <table><tr><th>Story</th><th>Elevation m</th><th>Fx kN</th><th>Fy kN</th><th>Fz kN</th><th>Story Shear X kN</th><th>Story Shear Y kN</th></tr>
  ${[...sf.rows].reverse().map(r=>`<tr class="v134-story-force-row" data-story="${r.story}" data-node-id="${r.nodeIds[0]||''}"><td><button class="v128-link" data-node-id="${r.nodeIds[0]||''}">Story ${r.story}</button></td><td>${r.elevation.toFixed(3)}</td><td>${r.fx.toFixed(4)}</td><td>${r.fy.toFixed(4)}</td><td>${r.fz.toFixed(4)}</td><td>${r.shearX.toFixed(4)}</td><td>${r.shearY.toFixed(4)}</td></tr>`).join('')}</table>`;
}


function htmlEscapeV1363(v){
 return String(v??'')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#39;');
}
function ensureLoadCombosV1362(){
  const m3=ensure3DLoadSystemV131();
  if(!Array.isArray(m3.loadCombinations)||!m3.loadCombinations.length){
    m3.loadCombinations=[
      {name:'1.4DL',terms:[{pattern:'DL',factor:1.4}]},
      {name:'1.2DL+1.6LL',terms:[{pattern:'DL',factor:1.2},{pattern:'LL',factor:1.6}]},
      {name:'1.2DL+1.0LL+1.0WX',terms:[{pattern:'DL',factor:1.2},{pattern:'LL',factor:1.0},{pattern:'WX',factor:1.0}]},
      {name:'1.2DL+1.0LL+1.0WY',terms:[{pattern:'DL',factor:1.2},{pattern:'LL',factor:1.0},{pattern:'WY',factor:1.0}]}
    ];
  }
  return m3.loadCombinations;
}
function v1362Patterns(){
  const m3=ensure3DLoadSystemV131();
  const set=new Set((m3.loadPatterns||[]).map(x=>String(x.id||x)));
  ['DL','LL','RL','EQX','EQY','WX','WY'].forEach(x=>set.add(x));
  return [...set];
}
function v1362Combine(name,terms,solved){
  const m3=ensure3DLoadSystemV131(), nodes=m3.nodes||[];
  const first=Object.values(solved)[0]; if(!first)return null;
  const n=first.U.length, U=Array(n).fill(0), F=Array(n).fill(0);

  for(const t of terms){
    const r=solved[t.pattern], a=Number(t.factor)||0;
    if(!r) return null;
    for(let i=0;i<n;i++){ U[i]+=a*Number(r.U[i]||0); F[i]+=a*Number(r.F[i]||0); }
  }

  const displacements=nodes.map((node,i)=>({
    id:node.id, ux:U[i*6]||0, uy:U[i*6+1]||0, uz:U[i*6+2]||0,
    rx:U[i*6+3]||0, ry:U[i*6+4]||0, rz:U[i*6+5]||0
  }));

  const reactionMap=new Map();
  const memberMap=new Map();
  for(const t of terms){
    const r=solved[t.pattern], a=Number(t.factor)||0;
    for(const x of (r.reactions||[])){
      if(!reactionMap.has(x.id)) reactionMap.set(x.id,{id:x.id,fx:0,fy:0,fz:0,mx:0,my:0,mz:0});
      const q=reactionMap.get(x.id);
      ['fx','fy','fz','mx','my','mz'].forEach(k=>q[k]+=a*Number(x[k]||0));
    }
    for(const x of (r.memberForces||[])){
      if(!memberMap.has(x.id)) memberMap.set(x.id,{id:x.id,i:x.i,j:x.j,local:Array(12).fill(0)});
      const q=memberMap.get(x.id);
      (x.local||[]).forEach((v,i)=>q.local[i]+=a*Number(v||0));
    }
  }
  const reactions=[...reactionMap.values()].sort((a,b)=>a.id-b.id);
  const memberForces=[...memberMap.values()].sort((a,b)=>a.id-b.id);

  const imap=new Map(nodes.map((node,i)=>[node.id,i]));
  const RF=Array(n).fill(0);
  for(const r of reactions){
    const i=imap.get(r.id); if(i==null)continue;
    RF[i*6]=r.fx;RF[i*6+1]=r.fy;RF[i*6+2]=r.fz;
    RF[i*6+3]=r.mx;RF[i*6+4]=r.my;RF[i*6+5]=r.mz;
  }
  const equilibrium=equilibriumCheckV132(nodes,F,RF,imap);

  const result={U,F,displacements,reactions,memberForces,equilibrium,loadPattern:name,isCombination:true,terms:JSON.parse(JSON.stringify(terms))};
  try{
    result.storyResponse=storyResponseV133(m3,result);
    result.storyForces=storyForcesV134(m3,result,imap);
  }catch(e){console.warn('V1.36.2 combo reporting',e)}
  return result;
}
function solveComboV1362(combo){
  const m3=ensure3DLoadSystemV131();
  if(!combo||!combo.terms?.length) throw new Error('Combination has no load terms.');
  const original=m3.activeLoadPattern||'DL', solved={};
  try{
    for(const t of combo.terms){
      if(solved[t.pattern])continue;
      m3.activeLoadPattern=t.pattern;
      // Reuse exactly the same verified solver path used by V1.35.1.
      solved[t.pattern]=solve3DV128();
    }
  } finally {
    m3.activeLoadPattern=original;
  }
  const r=v1362Combine(combo.name,combo.terms,solved);
  if(!r) throw new Error('Could not solve all patterns in this combination.');
  m3.comboResults ||= {};
  m3.comboResults[combo.name]=r;
  return r;
}
function loadCombinationCenterV1362(){
  const m3=ensure3DLoadSystemV131(), combos=ensureLoadCombosV1362(), pats=v1362Patterns();
  const wrap=document.createElement('div');
  wrap.className='modalWrap v1364ComboOverlay';
  wrap.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.52);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;overflow:hidden';

  const termRow=(t,ci,ti)=>`
    <div class="v1364-term-row" style="display:grid;grid-template-columns:minmax(180px,1fr) 110px 38px;gap:10px;align-items:center;margin:8px 0">
      <select data-tpat="${ci}:${ti}" style="height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;background:#fff">
        ${pats.map(p=>`<option ${p===t.pattern?'selected':''}>${p}</option>`).join('')}
      </select>
      <input type="number" step="0.1" data-tfac="${ci}:${ti}" value="${Number(t.factor)}"
        style="height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;text-align:right">
      <button data-del-term="${ci}:${ti}" title="Remove term"
        style="height:38px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:8px;font-weight:800;cursor:pointer">×</button>
    </div>`;

  const cards=combos.map((c,ci)=>`
    <section class="v1364-combo-card" style="border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06);overflow:visible;flex:0 0 auto">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc">
        <div style="min-width:0;flex:1">
          <input data-cname="${ci}" value="${htmlEscapeV1363(c.name)}"
            style="width:100%;height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 11px;font-weight:800;font-size:14px;background:#fff">
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          <button data-solve-combo="${ci}" class="primary"
            style="height:40px;padding:0 14px;border-radius:9px;font-weight:800;cursor:pointer">▶ Analyze</button>
          <button data-del-combo="${ci}"
            style="height:40px;padding:0 12px;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:9px;font-weight:700;cursor:pointer">Delete</button>
        </div>
      </div>
      <div style="padding:14px 14px 16px;min-height:92px">
        <div style="display:grid;grid-template-columns:minmax(180px,1fr) 110px 38px;gap:10px;color:#64748b;font-size:12px;font-weight:800;margin-bottom:4px">
          <div>Load Pattern</div><div style="text-align:right">Factor</div><div></div>
        </div>
        ${c.terms.map((t,ti)=>termRow(t,ci,ti)).join('')}
        <button data-add-term="${ci}"
          style="margin-top:7px;height:36px;padding:0 12px;border:1px dashed #94a3b8;background:#f8fafc;color:#334155;border-radius:8px;font-weight:700;cursor:pointer">+ Add Term</button>
      </div>
    </section>`).join('');

  wrap.innerHTML=`
  <div class="v1364ComboModal" style="width:min(960px,96vw);max-height:90vh;background:#f8fafc;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.7)">
    <header style="flex:0 0 auto;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px 20px;background:linear-gradient(135deg,#0f2747,#173b68);color:#fff">
      <div>
        <div style="font-size:22px;font-weight:900;letter-spacing:.1px">3D Load Combinations</div>
        <div style="margin-top:4px;font-size:13px;opacity:.82">V1.42.1 • 3D RC Rebar View Controls</div>
      </div>
      <button id="v1362X" aria-label="Close"
        style="width:40px;height:40px;border:1px solid rgba(255,255,255,.35);border-radius:10px;background:rgba(255,255,255,.12);color:#fff;font-size:22px;cursor:pointer">×</button>
    </header>

    <div style="flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid #e2e8f0">
      <div style="font-size:13px;color:#475569"><b>${combos.length}</b> combinations defined</div>
      <button id="v1362Add" class="primary" style="height:38px;padding:0 14px;border-radius:9px;font-weight:800;cursor:pointer">+ New Combination</button>
    </div>

    <main id="v1364ComboScroll" style="flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:14px">
      ${cards||'<div style="padding:30px;text-align:center;color:#64748b">No load combinations defined.</div>'}
    </main>

    <div id="v1362Status" style="display:none;flex:0 0 auto;margin:0 16px 10px;padding:10px 12px;border:1px solid #86efac;background:#f0fdf4;border-radius:10px;color:#166534;font-weight:700"></div>

    <footer style="flex:0 0 auto;display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;background:#fff;border-top:1px solid #e2e8f0;box-shadow:0 -6px 16px rgba(15,23,42,.05);position:relative;z-index:2">
      <button id="v1362Close" style="height:40px;padding:0 16px;border:1px solid #cbd5e1;background:#fff;border-radius:9px;font-weight:700;cursor:pointer">Close</button>
      <button id="v1362Save" class="primary" style="height:40px;padding:0 16px;border-radius:9px;font-weight:800;cursor:pointer">Save Combinations</button>
    </footer>
  </div>`;

  document.body.appendChild(wrap);

  // lock background page scroll while modal is open; modal body scrolls independently.
  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';

  const close=()=>{
    document.body.style.overflow=oldOverflow;
    wrap.remove();
  };

  wrap.querySelector('#v1362X').onclick=close;
  wrap.querySelector('#v1362Close').onclick=close;

  // Escape key closes
  const escHandler=(e)=>{
    if(e.key==='Escape'){
      document.removeEventListener('keydown',escHandler);
      close();
    }
  };
  document.addEventListener('keydown',escHandler);

  const harvest=()=>{
    wrap.querySelectorAll('[data-cname]').forEach(x=>combos[Number(x.dataset.cname)].name=x.value.trim()||`COMBO${Number(x.dataset.cname)+1}`);
    wrap.querySelectorAll('[data-tpat]').forEach(x=>{const [ci,ti]=x.dataset.tpat.split(':').map(Number);combos[ci].terms[ti].pattern=x.value});
    wrap.querySelectorAll('[data-tfac]').forEach(x=>{const [ci,ti]=x.dataset.tfac.split(':').map(Number);combos[ci].terms[ti].factor=Number(x.value)||0});
  };

  wrap.querySelector('#v1362Save').onclick=()=>{
    harvest();
    const st=wrap.querySelector('#v1362Status');
    st.style.display='block';
    st.style.borderColor='#86efac';st.style.background='#f0fdf4';st.style.color='#166534';
    st.textContent=`✓ Saved ${combos.length} load combinations`;
    toast('3D Load Combinations saved');
  };

  wrap.querySelector('#v1362Add').onclick=()=>{
    harvest();
    combos.push({name:`COMBO${combos.length+1}`,terms:[{pattern:'DL',factor:1}]});
    close();
    loadCombinationCenterV1362();
  };

  wrap.querySelectorAll('[data-del-combo]').forEach(b=>b.onclick=()=>{
    harvest();
    combos.splice(Number(b.dataset.delCombo),1);
    close();
    loadCombinationCenterV1362();
  });

  wrap.querySelectorAll('[data-add-term]').forEach(b=>b.onclick=()=>{
    harvest();
    combos[Number(b.dataset.addTerm)].terms.push({pattern:'DL',factor:1});
    close();
    loadCombinationCenterV1362();
  });

  wrap.querySelectorAll('[data-del-term]').forEach(b=>b.onclick=()=>{
    harvest();
    const [ci,ti]=b.dataset.delTerm.split(':').map(Number);
    combos[ci].terms.splice(ti,1);
    close();
    loadCombinationCenterV1362();
  });

  wrap.querySelectorAll('[data-solve-combo]').forEach(b=>b.onclick=()=>{
    harvest();
    const ci=Number(b.dataset.solveCombo), combo=combos[ci], st=wrap.querySelector('#v1362Status');
    try{
      const r=solveComboV1362(combo);
      st.style.display='block';
      st.style.borderColor='#86efac';st.style.background='#f0fdf4';st.style.color='#166534';
      st.textContent=`✓ Solved ${combo.name}. Close this window, then click Show Analysis Results.`;
      m3.results=r;
      const status=document.querySelector('#v128SolveStatus');
      const show=document.querySelector('#v128ShowResults');
      if(status)status.textContent=`Solved Combo • ${combo.name}`;
      if(show)show.disabled=false;
      toast(`Solved 3D Combination: ${combo.name}`);
    }catch(e){
      st.style.display='block';
      st.style.borderColor='#fecaca';st.style.background='#fef2f2';st.style.color='#991b1b';
      st.textContent='✕ '+e.message;
    }
  });
}


function ensureLoadCasesV138(){
  const m3=ensure3DLoadSystemV131();
  if(!Array.isArray(m3.loadCases)||!m3.loadCases.length){
    m3.loadCases=[
      {name:'DEAD',type:'Linear Static',loads:[{pattern:'DL',scale:1.0}]},
      {name:'LIVE',type:'Linear Static',loads:[{pattern:'LL',scale:1.0}]},
      {name:'WIND-X',type:'Linear Static',loads:[{pattern:'WX',scale:1.0}]},
      {name:'WIND-Y',type:'Linear Static',loads:[{pattern:'WY',scale:1.0}]}
    ];
  }
  return m3.loadCases;
}
function solveLoadCaseV138(loadCase){
  const m3=ensure3DLoadSystemV131();
  if(!loadCase||!Array.isArray(loadCase.loads)||!loadCase.loads.length)throw new Error('Load Case has no load assignment.');
  const original=m3.activeLoadPattern||'DL', solved={};
  try{
    for(const item of loadCase.loads){
      if(solved[item.pattern])continue;
      m3.activeLoadPattern=item.pattern;
      solved[item.pattern]=solve3DV128();
    }
  }finally{m3.activeLoadPattern=original;}
  const terms=loadCase.loads.map(x=>({pattern:x.pattern,factor:Number(x.scale)||0}));
  const result=v1362Combine(loadCase.name,terms,solved);
  if(!result)throw new Error('Could not solve Load Case.');
  result.isLoadCase=true;
  result.isCombination=false;
  result.loadCaseName=loadCase.name;
  result.loadCaseType=loadCase.type||'Linear Static';
  result.resultSource='Load Case';
  result.loadPattern=loadCase.name;
  m3.loadCaseResults ||= {};
  m3.loadCaseResults[loadCase.name]=result;
  return result;
}
function loadCasesCenterV138(){
  const m3=ensure3DLoadSystemV131(), cases=ensureLoadCasesV138(), pats=v1362Patterns();
  const wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.52);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;overflow:hidden';
  const cards=cases.map((c,ci)=>`
    <section style="border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06);flex:0 0 auto">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:13px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc">
        <input data-lc-name="${ci}" value="${htmlEscapeV1363(c.name)}" style="height:40px;min-width:210px;flex:1;border:1px solid #cbd5e1;border-radius:9px;padding:0 11px;font-weight:800">
        <select data-lc-type="${ci}" style="height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 10px"><option>Linear Static</option></select>
        <button data-lc-run="${ci}" class="primary" style="height:40px;padding:0 14px;border-radius:9px;font-weight:800">▶ Analyze Case</button>
        <button data-lc-del="${ci}" style="height:40px;padding:0 12px;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:9px;font-weight:700">Delete</button>
      </div>
      <div style="padding:14px">
        <div style="display:grid;grid-template-columns:minmax(180px,1fr) 120px 38px;gap:10px;color:#64748b;font-size:12px;font-weight:800">
          <div>Load Pattern</div><div>Scale Factor</div><div></div>
        </div>
        ${(c.loads||[]).map((x,li)=>`<div style="display:grid;grid-template-columns:minmax(180px,1fr) 120px 38px;gap:10px;margin-top:8px">
          <select data-lc-pat="${ci}:${li}" style="height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px">${pats.map(p=>`<option ${p===x.pattern?'selected':''}>${p}</option>`).join('')}</select>
          <input data-lc-scale="${ci}:${li}" type="number" step="0.1" value="${Number(x.scale)}" style="height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;text-align:right">
          <button data-lc-load-del="${ci}:${li}" style="border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:8px;font-weight:800">×</button>
        </div>`).join('')}
        <button data-lc-load-add="${ci}" style="margin-top:10px;height:36px;padding:0 12px;border:1px dashed #94a3b8;background:#f8fafc;border-radius:8px;font-weight:700">+ Add Load</button>
      </div>
    </section>`).join('');
  wrap.innerHTML=`<div style="width:min(960px,96vw);max-height:90vh;background:#f8fafc;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden">
    <header style="display:flex;justify-content:space-between;gap:16px;padding:18px 20px;background:linear-gradient(135deg,#0f2747,#173b68);color:#fff">
      <div><div style="font-size:22px;font-weight:900">Define Load Cases</div><div style="font-size:13px;opacity:.82;margin-top:4px">V1.39.1 Fix • Explicit Case Factors → Combination → Results</div></div>
      <button id="v138X" style="width:40px;height:40px;border:1px solid rgba(255,255,255,.35);border-radius:10px;background:rgba(255,255,255,.12);color:#fff;font-size:22px">×</button>
    </header>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#fff;border-bottom:1px solid #e2e8f0">
      <div style="font-size:13px;color:#475569"><b>${cases.length}</b> Linear Static Load Cases</div>
      <button id="v138Add" class="primary">+ New Load Case</button>
    </div>
    <main style="flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px">${cards}</main>
    <div id="v138Status" style="display:none;margin:0 16px 10px;padding:10px;border-radius:9px;font-weight:700"></div>
    <footer style="display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;background:#fff;border-top:1px solid #e2e8f0">
      <button id="v138Close">Close</button><button id="v138Save" class="primary">Save Load Cases</button>
    </footer></div>`;
  document.body.appendChild(wrap);
  const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const close=()=>{document.body.style.overflow=oldOverflow;wrap.remove()};
  wrap.querySelector('#v138X').onclick=close;wrap.querySelector('#v138Close').onclick=close;
  const harvest=()=>{
    wrap.querySelectorAll('[data-lc-name]').forEach(x=>cases[+x.dataset.lcName].name=x.value.trim()||`CASE${+x.dataset.lcName+1}`);
    wrap.querySelectorAll('[data-lc-type]').forEach(x=>cases[+x.dataset.lcType].type=x.value);
    wrap.querySelectorAll('[data-lc-pat]').forEach(x=>{const [ci,li]=x.dataset.lcPat.split(':').map(Number);cases[ci].loads[li].pattern=x.value});
    wrap.querySelectorAll('[data-lc-scale]').forEach(x=>{const [ci,li]=x.dataset.lcScale.split(':').map(Number);cases[ci].loads[li].scale=Number(x.value)||0});
  };
  wrap.querySelector('#v138Save').onclick=()=>{harvest();const st=wrap.querySelector('#v138Status');st.style.cssText='display:block;margin:0 16px 10px;padding:10px;border:1px solid #86efac;background:#f0fdf4;color:#166534;border-radius:9px;font-weight:700';st.textContent=`✓ Saved ${cases.length} Load Cases`;toast('V1.38 Load Cases saved')};
  wrap.querySelector('#v138Add').onclick=()=>{harvest();cases.push({name:`CASE${cases.length+1}`,type:'Linear Static',loads:[{pattern:'DL',scale:1}]});close();loadCasesCenterV138()};
  wrap.querySelectorAll('[data-lc-del]').forEach(b=>b.onclick=()=>{harvest();cases.splice(+b.dataset.lcDel,1);close();loadCasesCenterV138()});
  wrap.querySelectorAll('[data-lc-load-add]').forEach(b=>b.onclick=()=>{harvest();cases[+b.dataset.lcLoadAdd].loads.push({pattern:'DL',scale:1});close();loadCasesCenterV138()});
  wrap.querySelectorAll('[data-lc-load-del]').forEach(b=>b.onclick=()=>{harvest();const [ci,li]=b.dataset.lcLoadDel.split(':').map(Number);cases[ci].loads.splice(li,1);close();loadCasesCenterV138()});
  wrap.querySelectorAll('[data-lc-run]').forEach(b=>b.onclick=()=>{
    harvest();const c=cases[+b.dataset.lcRun],st=wrap.querySelector('#v138Status');
    try{
      const r=solveLoadCaseV138(c);
      m3.results=r;
      m3.activeResultType='Load Case';
      m3.activeResultName=c.name;
      m3.activeLoadCase=c.name;

      st.style.cssText='display:block;margin:0 16px 10px;padding:10px;border:1px solid #86efac;background:#f0fdf4;color:#166534;border-radius:9px;font-weight:700';
      st.textContent=`✓ Solved Load Case: ${c.name}`;

      const ws=document.querySelector('#v128SolveStatus');
      const show=document.querySelector('#v128ShowResults');
      const modalStatus=document.querySelector('#v128ModalStatus');
      if(ws)ws.textContent=`Solved Case • ${c.name}`;
      if(show)show.disabled=false;
      if(modalStatus)modalStatus.textContent=`Solved • ${m3.nodes.length*6} DOF • Case ${c.name}`;

      // Refresh the verified V1.35/V1.37 result renderer with the newly solved case.
      // This prevents the previous DEAD result from remaining on screen after LIVE is solved.
      if(typeof integrated3dRefreshV128==='function') integrated3dRefreshV128(false);

      // If the Analysis Results modal is already open, force a fresh render now.
      const modal=document.querySelector('#v128ResultsModal');
      if(modal && !modal.hidden){
        const activeTab=modal.querySelector('[data-v128-tab].active');
        if(activeTab) activeTab.click();
      }

      toast(`Solved Load Case: ${c.name}`);
    }catch(e){
      st.style.cssText='display:block;margin:0 16px 10px;padding:10px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:9px;font-weight:700';
      st.textContent='✕ '+e.message;
    }
  });
}


function ensureLoadCombosV139(){
  const m3=ensure3DLoadSystemV131();
  const cases=ensureLoadCasesV138();

  // Migrate the old pattern-based V1.36 combinations to Load Case based combinations.
  const old=Array.isArray(m3.loadCombinations)?m3.loadCombinations:[];
  const looksOld=old.some(c=>(c.terms||[]).some(t=>t.pattern && !t.caseName));
  if(!old.length || looksOld){
    m3.loadCombinations=[
      {name:'1.4DEAD',type:'Linear Add',terms:[{caseName:'DEAD',factor:1.4}]},
      {name:'1.2DEAD+1.6LIVE',type:'Linear Add',terms:[{caseName:'DEAD',factor:1.2},{caseName:'LIVE',factor:1.6}]},
      {name:'1.2DEAD+1.0LIVE+1.0WIND-X',type:'Linear Add',terms:[{caseName:'DEAD',factor:1.2},{caseName:'LIVE',factor:1.0},{caseName:'WIND-X',factor:1.0}]},
      {name:'1.2DEAD+1.0LIVE+1.0WIND-Y',type:'Linear Add',terms:[{caseName:'DEAD',factor:1.2},{caseName:'LIVE',factor:1.0},{caseName:'WIND-Y',factor:1.0}]}
    ];
  }
  // Remove invalid dangling case names only when the case list is known.
  const names=new Set(cases.map(c=>c.name));
  for(const c of m3.loadCombinations){
    c.type ||= 'Linear Add';
    c.terms ||= [];
    for(const t of c.terms){
      t.caseName ||= t.case || t.pattern || 'DEAD';
      t.factor=Number(t.factor ?? 1);
      if(!names.has(t.caseName) && cases[0]) t.caseName=cases[0].name;
      delete t.pattern;
      delete t.case;
    }
  }
  return m3.loadCombinations;
}

function combineLoadCaseResultsV139(name,terms,solvedCases){
  const m3=ensure3DLoadSystemV131(), nodes=m3.nodes||[];
  const first=Object.values(solvedCases)[0];
  if(!first)return null;

  const n=first.U.length, U=Array(n).fill(0), F=Array(n).fill(0);

  for(const t of terms){
    const r=solvedCases[t.caseName], a=Number(t.factor)||0;
    if(!r)return null;
    for(let i=0;i<n;i++){
      U[i]+=a*Number(r.U[i]||0);
      F[i]+=a*Number(r.F[i]||0);
    }
  }

  const displacements=nodes.map((node,i)=>({
    id:node.id,
    ux:U[i*6]||0, uy:U[i*6+1]||0, uz:U[i*6+2]||0,
    rx:U[i*6+3]||0, ry:U[i*6+4]||0, rz:U[i*6+5]||0
  }));

  const reactionMap=new Map(), memberMap=new Map();
  for(const t of terms){
    const r=solvedCases[t.caseName], a=Number(t.factor)||0;

    for(const x of (r.reactions||[])){
      if(!reactionMap.has(x.id))
        reactionMap.set(x.id,{id:x.id,fx:0,fy:0,fz:0,mx:0,my:0,mz:0});
      const q=reactionMap.get(x.id);
      ['fx','fy','fz','mx','my','mz'].forEach(k=>q[k]+=a*Number(x[k]||0));
    }

    for(const x of (r.memberForces||[])){
      if(!memberMap.has(x.id))
        memberMap.set(x.id,{id:x.id,i:x.i,j:x.j,local:Array(12).fill(0)});
      const q=memberMap.get(x.id);
      (x.local||[]).forEach((v,i)=>q.local[i]+=a*Number(v||0));
    }
  }

  const reactions=[...reactionMap.values()].sort((a,b)=>a.id-b.id);
  const memberForces=[...memberMap.values()].sort((a,b)=>a.id-b.id);

  const imap=new Map(nodes.map((node,i)=>[node.id,i]));
  const RF=Array(n).fill(0);
  for(const r of reactions){
    const i=imap.get(r.id); if(i==null)continue;
    RF[i*6]=r.fx; RF[i*6+1]=r.fy; RF[i*6+2]=r.fz;
    RF[i*6+3]=r.mx; RF[i*6+4]=r.my; RF[i*6+5]=r.mz;
  }

  const equilibrium=equilibriumCheckV132(nodes,F,RF,imap);
  const result={
    U,F,displacements,reactions,memberForces,equilibrium,
    loadPattern:name,
    isCombination:true,
    isLoadCase:false,
    resultSource:'Load Combination',
    combinationName:name,
    combinationType:'Linear Add',
    terms:JSON.parse(JSON.stringify(terms))
  };

  try{
    result.storyResponse=storyResponseV133(m3,result);
    result.storyForces=storyForcesV134(m3,result,imap);
  }catch(e){
    console.warn('V1.39 combination reporting',e);
  }
  return result;
}


function standardCaseScaleWarningsV1391(cases){
  const std={DEAD:'DL',LIVE:'LL','WIND-X':'WX','WIND-Y':'WY'};
  const out=[];
  for(const c of cases){
    const p=std[c.name];
    if(!p || !Array.isArray(c.loads) || c.loads.length!==1)continue;
    const x=c.loads[0], sc=Number(x.scale ?? 1);
    if(x.pattern===p && Math.abs(sc-1)>1e-12)
      out.push(`${c.name}: ${p} × ${sc}`);
  }
  return out;
}

function flattenComboToPatternsV1391(combo,cases){
  const caseMap=new Map(cases.map(c=>[c.name,c]));
  const patternFactor=new Map(), audit=[];

  for(const t of combo.terms||[]){
    const c=caseMap.get(t.caseName);
    if(!c)throw new Error(`Load Case "${t.caseName}" was not found.`);
    const comboFactor=Number(t.factor)||0;
    if(!Array.isArray(c.loads)||!c.loads.length)
      throw new Error(`Load Case "${c.name}" has no Load Pattern assignment.`);

    const loads=[];
    for(const x of c.loads){
      const caseScale=Number(x.scale)||0;
      const effectiveFactor=comboFactor*caseScale;
      const pattern=String(x.pattern||'DL');
      patternFactor.set(pattern,(patternFactor.get(pattern)||0)+effectiveFactor);
      loads.push({pattern,caseScale,effectiveFactor});
    }
    audit.push({caseName:c.name,comboFactor,loads});
  }
  return {patternFactor,audit};
}

function solveLoadCombinationV139(combo){
  const m3=ensure3DLoadSystemV131(), cases=ensureLoadCasesV138();
  if(!combo || !Array.isArray(combo.terms) || !combo.terms.length)
    throw new Error('Load Combination has no Load Case terms.');

  // V1.39.1: flatten Case factors into effective Pattern factors first.
  // Each unique Load Pattern is solved ONCE, so nested case-result state cannot
  // contaminate a multi-case combination.
  const flat=flattenComboToPatternsV1391(combo,cases);
  const original=m3.activeLoadPattern||'DL', solvedPatterns={};

  try{
    for(const pattern of flat.patternFactor.keys()){
      m3.activeLoadPattern=pattern;
      solvedPatterns[pattern]=solve3DV128();
    }
  }finally{
    m3.activeLoadPattern=original;
  }

  const patternTerms=[...flat.patternFactor.entries()]
    .map(([pattern,factor])=>({pattern,factor}));

  const r=v1362Combine(combo.name,patternTerms,solvedPatterns);
  if(!r)throw new Error('Could not combine Load Case results.');

  r.isCombination=true;
  r.isLoadCase=false;
  r.resultSource='Load Combination';
  r.combinationName=combo.name;
  r.combinationType='Linear Add';
  r.caseTerms=JSON.parse(JSON.stringify(combo.terms));
  r.effectivePatternTerms=JSON.parse(JSON.stringify(patternTerms));
  r.caseFactorAudit=flat.audit;
  r.loadPattern=combo.name;

  m3.comboResults ||= {};
  m3.comboResults[combo.name]=r;
  return r;
}

function loadCombinationCenterV139(){
  const m3=ensure3DLoadSystemV131(), combos=ensureLoadCombosV139(), cases=ensureLoadCasesV138();
  const caseNames=cases.map(c=>c.name);
  const wrap=document.createElement('div');

  wrap.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.52);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;overflow:hidden';

  const termRow=(t,ci,ti)=>`
    <div style="display:grid;grid-template-columns:minmax(200px,1fr) 120px 38px;gap:10px;align-items:center;margin:8px 0">
      <select data-v139-case="${ci}:${ti}" style="height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;background:#fff">
        ${caseNames.map(n=>`<option ${n===t.caseName?'selected':''}>${htmlEscapeV1363(n)}</option>`).join('')}
      </select>
      <input data-v139-factor="${ci}:${ti}" type="number" step="0.1" value="${Number(t.factor)}"
        style="height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;text-align:right">
      <button data-v139-del-term="${ci}:${ti}" title="Remove term"
        style="height:38px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:8px;font-weight:800">×</button>
    </div>`;

  const cards=combos.map((c,ci)=>`
    <section style="border:1px solid #e2e8f0;border-radius:14px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06);flex:0 0 auto">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;padding:13px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc">
        <input data-v139-name="${ci}" value="${htmlEscapeV1363(c.name)}"
          style="height:40px;min-width:260px;flex:1;border:1px solid #cbd5e1;border-radius:9px;padding:0 11px;font-weight:800">
        <select data-v139-type="${ci}" style="height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 10px">
          <option>Linear Add</option>
        </select>
        <button data-v139-run="${ci}" class="primary" style="height:40px;padding:0 14px;border-radius:9px;font-weight:800">▶ Analyze Combo</button>
        <button data-v139-del="${ci}" style="height:40px;padding:0 12px;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:9px;font-weight:700">Delete</button>
      </div>
      <div style="padding:14px">
        <div style="display:grid;grid-template-columns:minmax(200px,1fr) 120px 38px;gap:10px;color:#64748b;font-size:12px;font-weight:800">
          <div>Load Case</div><div>Scale Factor</div><div></div>
        </div>
        ${(c.terms||[]).map((t,ti)=>termRow(t,ci,ti)).join('')}
        <button data-v139-add-term="${ci}" style="margin-top:10px;height:36px;padding:0 12px;border:1px dashed #94a3b8;background:#f8fafc;border-radius:8px;font-weight:700">+ Add Load Case</button>
      </div>
    </section>`).join('');

  wrap.innerHTML=`<div style="width:min(980px,96vw);max-height:90vh;background:#f8fafc;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden">
    <header style="display:flex;justify-content:space-between;gap:16px;padding:18px 20px;background:linear-gradient(135deg,#0f2747,#173b68);color:#fff">
      <div>
        <div style="font-size:22px;font-weight:900">Define Load Combinations</div>
        <div style="font-size:13px;opacity:.82;margin-top:4px">V1.39.1 Fix • Load Case Factor × Combo Factor → Results</div>
      </div>
      <button id="v139X" style="width:40px;height:40px;border:1px solid rgba(255,255,255,.35);border-radius:10px;background:rgba(255,255,255,.12);color:#fff;font-size:22px">×</button>
    </header>

    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;background:#fff;border-bottom:1px solid #e2e8f0">
      <div style="font-size:13px;color:#475569"><b>${combos.length}</b> Linear Add combinations • Combination Factor × Load Case Scale = Effective Pattern Factor</div>
      <button id="v139Add" class="primary">+ New Combination</button>
    </div>

    <main style="flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px">
      ${cards||'<div style="padding:30px;text-align:center;color:#64748b">No Load Combinations defined.</div>'}
    </main>

    ${standardCaseScaleWarningsV1391(cases).length?`<div style="margin:0 16px 10px;padding:11px 12px;border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:9px;font-size:12px;font-weight:700">⚠ Standard Load Case scale is not 1.0: ${standardCaseScaleWarningsV1391(cases).join(' • ')}<br><span style="font-weight:500">The Load Combination will correctly include this internal Case scale. Reset the Case scale to 1.0 if you want standard DEAD/LIVE/WIND cases.</span></div>`:''}
    <div id="v139Status" style="display:none;margin:0 16px 10px;padding:10px;border-radius:9px;font-weight:700"></div>

    <footer style="display:flex;justify-content:flex-end;gap:10px;padding:12px 16px;background:#fff;border-top:1px solid #e2e8f0">
      <button id="v139Close">Close</button>
      <button id="v139Save" class="primary">Save Combinations</button>
    </footer>
  </div>`;

  document.body.appendChild(wrap);

  const oldOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const close=()=>{document.body.style.overflow=oldOverflow;wrap.remove();};

  wrap.querySelector('#v139X').onclick=close;
  wrap.querySelector('#v139Close').onclick=close;

  const harvest=()=>{
    wrap.querySelectorAll('[data-v139-name]').forEach(x=>{
      combos[+x.dataset.v139Name].name=x.value.trim()||`COMBO${+x.dataset.v139Name+1}`;
    });
    wrap.querySelectorAll('[data-v139-type]').forEach(x=>{
      combos[+x.dataset.v139Type].type=x.value;
    });
    wrap.querySelectorAll('[data-v139-case]').forEach(x=>{
      const [ci,ti]=x.dataset.v139Case.split(':').map(Number);
      combos[ci].terms[ti].caseName=x.value;
    });
    wrap.querySelectorAll('[data-v139-factor]').forEach(x=>{
      const [ci,ti]=x.dataset.v139Factor.split(':').map(Number);
      combos[ci].terms[ti].factor=Number(x.value)||0;
    });
  };

  wrap.querySelector('#v139Save').onclick=()=>{
    harvest();
    const st=wrap.querySelector('#v139Status');
    st.style.cssText='display:block;margin:0 16px 10px;padding:10px;border:1px solid #86efac;background:#f0fdf4;color:#166534;border-radius:9px;font-weight:700';
    st.textContent=`✓ Saved ${combos.length} Load Combinations`;
    toast('V1.39 Load Combinations saved');
  };

  wrap.querySelector('#v139Add').onclick=()=>{
    harvest();
    combos.push({name:`COMBO${combos.length+1}`,type:'Linear Add',terms:[{caseName:caseNames[0]||'DEAD',factor:1}]});
    close(); loadCombinationCenterV139();
  };

  wrap.querySelectorAll('[data-v139-del]').forEach(b=>b.onclick=()=>{
    harvest(); combos.splice(+b.dataset.v139Del,1);
    close(); loadCombinationCenterV139();
  });

  wrap.querySelectorAll('[data-v139-add-term]').forEach(b=>b.onclick=()=>{
    harvest();
    combos[+b.dataset.v139AddTerm].terms.push({caseName:caseNames[0]||'DEAD',factor:1});
    close(); loadCombinationCenterV139();
  });

  wrap.querySelectorAll('[data-v139-del-term]').forEach(b=>b.onclick=()=>{
    harvest();
    const [ci,ti]=b.dataset.v139DelTerm.split(':').map(Number);
    combos[ci].terms.splice(ti,1);
    close(); loadCombinationCenterV139();
  });

  wrap.querySelectorAll('[data-v139-run]').forEach(b=>b.onclick=()=>{
    harvest();
    const combo=combos[+b.dataset.v139Run], st=wrap.querySelector('#v139Status');
    try{
      const r=solveLoadCombinationV139(combo);
      m3.results=r;
      m3.activeResultType='Load Combination';
      m3.activeResultName=combo.name;
      m3.activeLoadCombination=combo.name;

      st.style.cssText='display:block;margin:0 16px 10px;padding:10px;border:1px solid #86efac;background:#f0fdf4;color:#166534;border-radius:9px;font-weight:700';
      const eff=(r.effectivePatternTerms||[]).map(x=>`${x.pattern}×${Number(x.factor).toFixed(3)}`).join(' + ');
      st.textContent=`✓ Solved Load Combination: ${combo.name}${eff?' • Effective: '+eff:''}`;

      const ws=document.querySelector('#v128SolveStatus');
      const show=document.querySelector('#v128ShowResults');
      const modalStatus=document.querySelector('#v128ModalStatus');

      if(ws)ws.textContent=`Solved Combo • ${combo.name}`;
      if(show)show.disabled=false;
      if(modalStatus)modalStatus.textContent=`Solved • ${m3.nodes.length*6} DOF • Combo ${combo.name}`;

      if(typeof integrated3dRefreshV128==='function') integrated3dRefreshV128(false);

      const modal=document.querySelector('#v128ResultsModal');
      if(modal && !modal.hidden){
        const activeTab=modal.querySelector('[data-v128-tab].active');
        if(activeTab)activeTab.click();
      }

      toast(`Solved Load Combination: ${combo.name}`);
    }catch(e){
      st.style.cssText='display:block;margin:0 16px 10px;padding:10px;border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:9px;font-weight:700';
      st.textContent='✕ '+e.message;
    }
  });
}


function envelopeV140(){
 const m3=ensure3DLoadSystemV131(), combos=ensureLoadCombosV139();
 if(!combos.length)throw new Error('No Load Combinations defined.');
 const solved=combos.map(c=>({name:c.name,result:solveLoadCombinationV139(c)})), map=new Map();
 for(const x of solved)for(const f of (x.result.memberForces||[])){
  if(!map.has(f.id))map.set(f.id,{id:f.id,i:f.i,j:f.j,v:Array.from({length:12},()=>({max:-Infinity,min:Infinity,maxCombo:'',minCombo:''}))});
  (f.local||[]).forEach((n,k)=>{n=Number(n)||0;const q=map.get(f.id).v[k];if(n>q.max){q.max=n;q.maxCombo=x.name}if(n<q.min){q.min=n;q.minCombo=x.name}});
 }
 const env={combos:solved.map(x=>x.name),members:[...map.values()]};m3.envelopeV140=env;return env;
}

function envelopeCenterV140(){
 let env;try{env=envelopeV140()}catch(e){toast(e.message);return}
 const labels=['Fx','Fy','Fz','Mx','My','Mz'];
 const w=document.createElement('div');
 w.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.58);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:18px';

 const summaryRows=env.members.map(m=>{
   const all=[];
   m.v.forEach((q,k)=>{
     const end=k<6?'i':'j', comp=labels[k%6];
     const absMax=Math.abs(q.max)>=Math.abs(q.min)?{value:q.max,combo:q.maxCombo}:{value:q.min,combo:q.minCombo};
     all.push({end,comp,value:absMax.value,combo:absMax.combo});
   });
   const gov=all.reduce((a,b)=>Math.abs(b.value)>Math.abs(a.value)?b:a,all[0]);
   return `<tr data-member-row="${m.id}">
     <td><b>M${m.id}</b></td>
     <td>N${m.i} → N${m.j}</td>
     <td>${gov.comp}</td>
     <td>${gov.end}</td>
     <td style="text-align:right;font-weight:800">${gov.value.toFixed(3)}</td>
     <td><span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#e0f2fe;color:#075985;font-weight:800">${gov.combo}</span></td>
     <td><button data-v140="${m.id}" style="height:30px;padding:0 10px;border:1px solid #cbd5e1;background:#fff;border-radius:7px;font-weight:700">Details</button></td>
   </tr>`;
 }).join('');

 w.innerHTML=`<div style="width:min(1120px,96vw);max-height:92vh;background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(15,23,42,.30)">
  <header style="padding:18px 20px;background:linear-gradient(135deg,#0f2747,#173b68);color:#fff;display:flex;justify-content:space-between;gap:14px">
   <div><div style="font-size:22px;font-weight:900">Analysis Envelope / Governing Combination</div><div style="font-size:13px;opacity:.82;margin-top:4px">V1.40.1 Fix • easier envelope review • preparation for RC Beam Design</div></div>
   <button id="v140x" style="width:40px;height:40px;border:1px solid rgba(255,255,255,.35);border-radius:10px;background:rgba(255,255,255,.12);color:#fff;font-size:22px">×</button>
  </header>
  <div style="padding:11px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569">
   <b>${env.combos.length}</b> combinations: ${env.combos.join(' • ')}
  </div>
  <div style="overflow:auto;flex:1">
   <table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead style="position:sticky;top:0;background:#f8fafc;z-index:1">
     <tr><th>Member</th><th>Nodes</th><th>Gov. Force</th><th>End</th><th style="text-align:right">Value</th><th>Governing Combo</th><th></th></tr>
    </thead>
    <tbody>${summaryRows}</tbody>
   </table>
  </div>
  <footer style="padding:12px 16px;text-align:right;border-top:1px solid #e2e8f0"><button id="v140close">Close</button></footer>
 </div>`;

 document.body.appendChild(w);
 const close=()=>w.remove();
 w.querySelector('#v140x').onclick=close;
 w.querySelector('#v140close').onclick=close;

 w.querySelectorAll('[data-v140]').forEach(b=>b.onclick=()=>{
   const m=env.members.find(x=>x.id==b.dataset.v140);
   const modal=document.createElement('div');
   modal.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.50);display:flex;align-items:center;justify-content:center;padding:18px';

   const rows=[];
   const groups=[
     {name:'Axial / Shear', comps:[0,1,2]},
     {name:'Moments / Torsion', comps:[3,4,5]}
   ];
   for(const g of groups){
     rows.push(`<tr><td colspan="7" style="background:#eef2f7;font-weight:900;padding:8px 10px">${g.name}</td></tr>`);
     for(const c of g.comps){
       for(const end of ['i','j']){
         const idx=c+(end==='j'?6:0), q=m.v[idx];
         rows.push(`<tr>
           <td>${labels[c]}</td>
           <td><b>${end}</b></td>
           <td style="text-align:right">${q.min.toFixed(3)}</td>
           <td>${q.minCombo}</td>
           <td style="text-align:right">${q.max.toFixed(3)}</td>
           <td>${q.maxCombo}</td>
           <td style="text-align:center;font-weight:800">${Math.abs(q.max)>=Math.abs(q.min)?'MAX':'MIN'}</td>
         </tr>`);
       }
     }
   }

   modal.innerHTML=`<div style="width:min(900px,96vw);max-height:88vh;background:#fff;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(15,23,42,.32)">
    <header style="padding:16px 18px;background:#173b68;color:#fff;display:flex;justify-content:space-between;gap:12px">
      <div><div style="font-size:20px;font-weight:900">Member M${m.id} Envelope</div><div style="font-size:12px;opacity:.85;margin-top:3px">N${m.i} → N${m.j} • Min/Max by Load Combination</div></div>
      <button id="v140dX" style="width:38px;height:38px;border:1px solid rgba(255,255,255,.35);border-radius:9px;background:rgba(255,255,255,.12);color:#fff;font-size:20px">×</button>
    </header>
    <div style="padding:10px 14px;background:#fff7ed;border-bottom:1px solid #fed7aa;color:#9a3412;font-size:12px">
      <b>For V1.41 RC Beam Design:</b> focus on governing shear and moment rows and their controlling combinations.
    </div>
    <div style="overflow:auto;flex:1">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead style="position:sticky;top:0;background:#f8fafc"><tr>
          <th>Force</th><th>End</th><th style="text-align:right">Min</th><th>Min Combo</th>
          <th style="text-align:right">Max</th><th>Max Combo</th><th>Controls</th>
        </tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>
    <footer style="padding:12px 14px;text-align:right;border-top:1px solid #e2e8f0"><button id="v140dClose">Close</button></footer>
   </div>`;
   document.body.appendChild(modal);
   const dclose=()=>modal.remove();
   modal.querySelector('#v140dX').onclick=dclose;
   modal.querySelector('#v140dClose').onclick=dclose;
 });
}


function storeCompatV14121(store){
  store.defaults ||= {};
  if(!['auto','manual'].includes(String(store.defaults.stirrupSpacingMode||'').toLowerCase())) store.defaults.stirrupSpacingMode='auto';
  if(!['auto','manual'].includes(String(store.defaults.mainBarMode||'').toLowerCase())) store.defaults.mainBarMode='auto';
  if(!(Number(store.defaults.manualMainBars)>=2)) store.defaults.manualMainBars=5;
  if(!(Number(store.defaults.stirrupSpacing)>0)) store.defaults.stirrupSpacing=250;
  // V1.41.5 — straight tension development / anchorage / lap-splice verification inputs.
  if(!['other','top'].includes(String(store.defaults.devCastPosition||'').toLowerCase())) store.defaults.devCastPosition='other';
  if(!['uncoated','epoxy'].includes(String(store.defaults.devCoating||'').toLowerCase())) store.defaults.devCoating='uncoated';
  if(![1,0.85,0.75].includes(Number(store.defaults.devLambda))) store.defaults.devLambda=1;
  if(!(Number(store.defaults.devKtr)>=0)) store.defaults.devKtr=0;
  if(!(Number(store.defaults.anchorI)>=0)) store.defaults.anchorI=600;
  if(!(Number(store.defaults.anchorJ)>=0)) store.defaults.anchorJ=600;
  if(typeof store.defaults.spliceEnabled!=='boolean') store.defaults.spliceEnabled=false;
  if(!['A','B'].includes(String(store.defaults.spliceClass||'').toUpperCase())) store.defaults.spliceClass='B';
  if(!(Number(store.defaults.spliceProvided)>=0)) store.defaults.spliceProvided=0;
  if(!(Number(store.defaults.spliceBarsPercent)>=0)) store.defaults.spliceBarsPercent=100;
  // V1.46.1.1 — station-based automatic RC beam design defaults.
  if(!(Number(store.defaults.stationCount)>=21)) store.defaults.stationCount=41;
  store.defaults.stationCount=Math.max(21,Math.min(101,Math.round(Number(store.defaults.stationCount)||41)));
  if(typeof store.defaults.economicalZoning!=='boolean') store.defaults.economicalZoning=true;
}


// V1.41.6 — Automatic longitudinal-bar arrangement verification.
// This is a geometry/design-assist layer: it verifies bar fit, horizontal/vertical clear spacing,
// calculates the centroid of multi-layer tension steel, and returns the effective depth used by flexure.
function rcBeamRebarArrangementV1416({b,h,cover,minCover,stirrupDia,mainBarDia,aggregateSize,nBars}){
  const db=Math.max(10,Number(mainBarDia)||20),agg=Math.max(1,Number(aggregateSize)||20);
  const clearMin=Math.max(25,db,4*agg/3);
  const insideWidth=Math.max(0,Number(b)-2*(Number(cover)+Number(stirrupDia)));
  const barsPerLayer=Math.max(0,Math.floor((insideWidth+clearMin)/(db+clearMin)));
  const counts=[]; let rem=Math.max(0,Math.floor(Number(nBars)||0));
  while(rem>0&&barsPerLayer>0){const c=Math.min(barsPerLayer,rem);counts.push(c);rem-=c}
  const barFitPass=rem===0&&counts.length>0;
  const layerClear=counts.map(c=>c<=1?Infinity:(insideWidth-c*db)/(c-1));
  const actualClear=layerClear.length?Math.min(...layerClear):0;
  const clearSpacingPass=barFitPass&&layerClear.every(x=>x+1e-9>=clearMin);
  const verticalClear=clearMin;
  const firstCenter=Number(cover)+Number(stirrupDia)+db/2;
  const centers=counts.map((_,i)=>firstCenter+i*(db+verticalClear));
  const topOfSteel=centers.length?centers[centers.length-1]+db/2:Infinity;
  const insideTopLimit=Number(h)-(Number(cover)+Number(stirrupDia));
  // V1.41.6.1 FIX — explicit full-depth fit check.  This prevents a multi-layer cage
  // from being accepted unless bottom cover + stirrup + all bars/clear gaps + top
  // stirrup + top cover physically fit inside the member depth.
  const requiredVerticalDepth=counts.length?
    2*(Number(cover)+Number(stirrupDia)) + counts.length*db + Math.max(0,counts.length-1)*verticalClear:
    Infinity;
  const availableVerticalDepth=Number(h);
  const verticalFitPass=barFitPass&&topOfSteel<=insideTopLimit+1e-9&&requiredVerticalDepth<=availableVerticalDepth+1e-9;
  const coverPass=Number(cover)+1e-9>=Number(minCover);
  const total=counts.reduce((a,c)=>a+c,0);
  const yCentroid=total?counts.reduce((a,c,i)=>a+c*centers[i],0)/total:NaN;
  const dEff=Number.isFinite(yCentroid)?Number(h)-yCentroid:NaN;
  const pass=barFitPass&&clearSpacingPass&&verticalFitPass&&coverPass;
  const status=pass?'PASS':(!barFitPass?'BAR FIT FAIL':(!clearSpacingPass?'CLEAR SPACING FAIL':(!verticalFitPass?'VERTICAL FIT FAIL':(!coverPass?'COVER FAIL':'REVIEW'))));
  return {clearMin,insideWidth,barsPerLayer,counts,layers:counts.length,layerClear,actualClear,verticalClear,centers,yCentroid,dEff,requiredVerticalDepth,availableVerticalDepth,barFitPass,clearSpacingPass,verticalFitPass,coverPass,singleLayerPass:counts.length===1,pass,status};
}

function rcBeamDevelopmentV1415(cfg,detailing,nBars){
  const db=Math.max(6,Number(cfg.mainBarDia)||20),fc=Math.max(10,Number(cfg.fc)||28),fy=Math.max(200,Number(cfg.fy)||420);
  if(!nBars||!detailing?.barFitPass)return{applicable:false,status:'REVIEW',pass:false,note:'Valid longitudinal reinforcement is required before development verification.'};
  const cast=String(cfg.devCastPosition||'other').toLowerCase(), coating=String(cfg.devCoating||'uncoated').toLowerCase();
  const lambda=[1,0.85,0.75].includes(Number(cfg.devLambda))?Number(cfg.devLambda):1;
  const psiT=cast==='top'?1.3:1.0;
  const clear=Number.isFinite(detailing.actualClear)?Math.max(0,detailing.actualClear):0;
  let psiE=1.0;
  if(coating==='epoxy') psiE=(Number(cfg.cover)<3*db || clear<6*db)?1.5:1.2;
  // ACI limit: psi_t * psi_e need not exceed 1.7.
  const te=Math.min(1.7,psiT*psiE);
  const psiS=db<=19?0.8:1.0;
  const psiG=fy<=420?1.0:(fy<=550?1.15:1.30);
  // cb = smaller of center-to-surface distance or half center-to-center bar spacing.
  const centerCover=Math.max(1,Number(cfg.cover)+Number(cfg.stirrupDia)+db/2);
  const halfCenterSpacing=clear>0?(clear+db)/2:centerCover;
  const cb=Math.max(1,Math.min(centerCover,halfCenterSpacing));
  const Ktr=Math.max(0,Number(cfg.devKtr)||0);
  const confRatio=Math.min(2.5,Math.max(0.1,(cb+Ktr)/db));
  const ldRaw=(fy*te*psiS*psiG*db)/(1.1*lambda*Math.sqrt(fc)*confRatio);
  const ld=Math.ceil(Math.max(300,8*db,ldRaw)/5)*5;
  const anchorI=Math.max(0,Number(cfg.anchorI)||0),anchorJ=Math.max(0,Number(cfg.anchorJ)||0);
  const straightIPass=anchorI+1e-9>=ld,straightJPass=anchorJ+1e-9>=ld;
  // V1.41.6 — when straight development is unavailable, automatically evaluate a standard 90° hook.
  // ACI-style design-assist expression; final project detailing still requires engineer review of cover/confinement/support geometry.
  const ldhRaw=(fy*psiE*db)/(4.2*lambda*Math.sqrt(fc));
  const ldh=Math.ceil(Math.max(150,8*db,ldhRaw)/5)*5;
  const hookTail90=Math.ceil((12*db)/5)*5;
  const hookIPass=!straightIPass && anchorI+1e-9>=ldh;
  const hookJPass=!straightJPass && anchorJ+1e-9>=ldh;
  const anchorIPass=straightIPass||hookIPass,anchorJPass=straightJPass||hookJPass;
  const anchorIMethod=straightIPass?'STRAIGHT':(hookIPass?'90° HOOK':'UNRESOLVED');
  const anchorJMethod=straightJPass?'STRAIGHT':(hookJPass?'90° HOOK':'UNRESOLVED');
  const spliceEnabled=!!cfg.spliceEnabled,requestedSpliceClass=String(cfg.spliceClass||'B').toUpperCase()==='A'?'A':'B';
  const spliceBarsPercent=Math.min(100,Math.max(0,Number(cfg.spliceBarsPercent)||0));
  const asReq=Math.max(0,Number(cfg.AsReq)||0),asProv=Math.max(0,Number(cfg.AsProv)||0);
  const asRatio=asReq>1e-9?asProv/asReq:Infinity;
  // V1.41.5.1: Class A is permitted only when reinforcement provided is at least twice required
  // and no more than 50% of the total reinforcement is spliced within the required lap length.
  const classAEligible=asRatio>=2.0-1e-9 && spliceBarsPercent<=50+1e-9;
  const spliceClass=(requestedSpliceClass==='A'&&classAEligible)?'A':'B';
  const classAutoDowngraded=spliceEnabled&&requestedSpliceClass==='A'&&!classAEligible;
  const spliceFactor=spliceClass==='A'?1.0:1.3;
  const lapRequired=spliceEnabled?Math.ceil(Math.max(300,spliceFactor*ld)/5)*5:0;
  const spliceProvided=Math.max(0,Number(cfg.spliceProvided)||0);
  const lapPass=!spliceEnabled || spliceProvided+1e-9>=lapRequired;
  const pass=anchorIPass&&anchorJPass&&lapPass;
  return {applicable:true,db,psiT,psiE,psiTE:te,psiS,psiG,lambda,cb,Ktr,confRatio,ldRaw,ld,
    anchorI,anchorJ,straightIPass,straightJPass,ldhRaw,ldh,hookTail90,hookIPass,hookJPass,anchorIPass,anchorJPass,anchorIMethod,anchorJMethod,spliceEnabled,requestedSpliceClass,spliceClass,classAEligible,classAutoDowngraded,
    spliceBarsPercent,asRatio,spliceFactor,lapRequired,spliceProvided,lapPass,
    pass,status:pass?'PASS':'REVIEW / FAIL'};
}

function invalidate3DDesignDerivedV1451(reason='MODEL/LOAD CHANGE'){
  const m3=ensure3DLoadSystemV131();
  m3.envelopeV140=null;
  m3.comboResults={};
  m3.loadCaseResults={};
  m3.analysisRevisionV1451=(Number(m3.analysisRevisionV1451)||0)+1;
  m3.analysisInvalidationReasonV1451=reason;
  if(m3.rcBeamDesignV141) m3.rcBeamDesignV141.results=[];
  return m3.analysisRevisionV1451;
}
function mark3DAnalysisFreshV1451(result){
  const m3=ensure3DLoadSystemV131();
  m3.lastSolvedRevisionV1451=Number(m3.analysisRevisionV1451)||0;
  m3.lastSolvedPatternV1451=result?.loadPattern||m3.activeLoadPattern||'—';
  m3.lastSolvedAtV1451=Date.now();
  // Never retain an envelope across a new solve. RC Design must regenerate it
  // from the current member loads / load cases / load combinations.
  m3.envelopeV140=null;
  if(m3.rcBeamDesignV141) m3.rcBeamDesignV141.results=[];
}

// ===== V1.46.1.1 — Station-force recovery for automatic RC beam design =====
function scaledMemberLoadsV14611(m,patternFactors){
  const out=[];
  for(const [pat,f0] of Object.entries(patternFactors||{})){
    const factor=Number(f0)||0;if(Math.abs(factor)<1e-12)continue;
    for(const src of (m.loads3d?.[pat]||[])){
      const ld=JSON.parse(JSON.stringify(src));ld._pattern=pat;ld._factor=factor;
      if(ld.type==='UDL')ld.w=(Number(ld.w)||0)*factor;
      else if(ld.type==='POINT')ld.P=(Number(ld.P)||0)*factor;
      else if(ld.type==='TRAP'){ld.w1=(Number(ld.w1)||0)*factor;ld.w2=(Number(ld.w2)||0)*factor;}
      else if(ld.type==='MOMENT')ld.M=(Number(ld.M)||0)*factor;
      out.push(ld);
    }
  }
  return out;
}
function linearLoadIntegrals3DV14611(qa,qb,a,b,x){
  if(x<=a||b<=a)return{area:0,kernel:0};const u=Math.min(x,b)-a;if(u<=0)return{area:0,kernel:0};
  const k=(qb-qa)/(b-a),area=qa*u+.5*k*u*u,first=.5*qa*u*u+(k/3)*u*u*u;
  return{area,kernel:(x-a)*area-first};
}
function memberStationSamples3DV14611(m,f,patternFactors,count=41){
  const m3=ensure3DLoadSystemV131(),ni=m3.nodes.find(n=>n.id===m.i),nj=m3.nodes.find(n=>n.id===m.j);
  if(!ni||!nj)return[];const L=Math.max(1e-9,Math.hypot(nj.x-ni.x,nj.y-ni.y,nj.z-ni.z)),R=v128Axes(ni,nj),loads=scaledMemberLoadsV14611(m,patternFactors);
  const gvec=(mag,dir)=>dir==='GX'?[mag,0,0]:dir==='GY'?[0,mag,0]:[0,0,mag];
  const toLocal=(mag,dir)=>{const gv=gvec(mag,dir);return R.map(r=>r[0]*gv[0]+r[1]*gv[1]+r[2]*gv[2])};
  const q=f.local||Array(12).fill(0),target={N:-Number(q[6]||0),V2:-Number(q[7]||0),V3:-Number(q[8]||0),T:-Number(q[9]||0),M2:-Number(q[10]||0),M3:-Number(q[11]||0)};
  const rawAt=x=>{let N=Number(q[0]||0),V2=Number(q[1]||0),V3=Number(q[2]||0),T=Number(q[3]||0),M2=Number(q[4]||0)+V3*x,M3=Number(q[5]||0)-V2*x;
    for(const ld of loads){
      if(ld.type==='UDL'){
        const [qx,qy,qz]=toLocal(Number(ld.w)||0,ld.direction||'GZ');N+=qx*x;V2+=qy*x;V3+=qz*x;M2+=qz*x*x/2;M3-=qy*x*x/2;
      }else if(ld.type==='TRAP'){
        const a=clamp01V145(ld.a)*L,b=Math.max(a,clamp01V145(ld.b)*L);if(b<=a)continue;
        const v1=toLocal(Number(ld.w1)||0,ld.direction||'GZ'),v2=toLocal(Number(ld.w2)||0,ld.direction||'GZ');
        const ix=linearLoadIntegrals3DV14611(v1[0],v2[0],a,b,x),iy=linearLoadIntegrals3DV14611(v1[1],v2[1],a,b,x),iz=linearLoadIntegrals3DV14611(v1[2],v2[2],a,b,x);
        N+=ix.area;V2+=iy.area;V3+=iz.area;M2+=iz.kernel;M3-=iy.kernel;
      }else if(ld.type==='POINT'){
        const xp=clamp01V145(ld.r)*L;if(x+1e-10>=xp){const [qx,qy,qz]=toLocal(Number(ld.P)||0,ld.direction||'GZ');N+=qx;V2+=qy;V3+=qz;M2+=qz*(x-xp);M3-=qy*(x-xp);}
      }else if(ld.type==='MOMENT'){
        const xp=clamp01V145(ld.r)*L;if(x+1e-10>=xp){const mm=Number(ld.M)||0,ax=ld.axis||'L3';if(ax==='L1')T+=mm;else if(ax==='L2')M2+=mm;else M3+=mm;}
      }
    }return{N,V2,V3,T,M2,M3};
  };
  const end=rawAt(L),delta={};for(const k of ['N','V2','V3','T','M2','M3'])delta[k]=target[k]-end[k];
  count=Math.max(21,Math.min(101,Math.round(Number(count)||41)));const out=[];
  for(let i=0;i<count;i++){const r=i/(count-1),x=L*r,a=rawAt(x);for(const k of Object.keys(delta))a[k]+=delta[k]*r;out.push({r,x,...a});}
  return out;
}
function stationEnvelope3DV14611(m,candidates,count=41){
  const keys=['N','V2','V3','T','M2','M3'];count=Math.max(21,Math.min(101,Math.round(Number(count)||41)));
  const rows=Array.from({length:count},(_,i)=>({r:i/(count-1),x:0,...Object.fromEntries(keys.map(k=>[k,{min:Infinity,max:-Infinity,minCombo:'',maxCombo:''}]))}));
  const update=(q,v,name)=>{v=Number(v)||0;if(v<q.min){q.min=v;q.minCombo=name}if(v>q.max){q.max=v;q.maxCombo=name}};
  for(const c of candidates){const f=c.result?.memberForces?.find(x=>String(x.id)===String(m.id));if(!f)continue;const ss=memberStationSamples3DV14611(m,f,c.patternFactors,count);ss.forEach((p,i)=>{rows[i].x=p.x;for(const k of keys)update(rows[i][k],p[k],c.name)});}
  for(const row of rows)for(const k of keys){if(!Number.isFinite(row[k].min))row[k]={min:0,max:0,minCombo:'',maxCombo:''};}
  return rows;
}

function wholeModelDesignEnvelopeV146(){
  const m3=ensure3DLoadSystemV131();
  const combos=ensureLoadCombosV139();
  const cases=ensureLoadCasesV138();
  const candidates=[];

  // V1.46 — one analysis pipeline for the WHOLE 3D model.
  // Every design candidate is solved from the current model stiffness, supports,
  // diaphragm constraints, node/member loads and current load-case definitions.
  // RC Design no longer reads a Rebar Viewer cache or a member-only demand cache.
  for(const c of combos){
    const r=solveLoadCombinationV139(c);
    if(r){const flat=flattenComboToPatternsV1391(c,cases);candidates.push({name:c.name,kind:'COMBINATION',result:r,patternFactors:Object.fromEntries(flat.patternFactor)});}
  }
  // Also retain load cases as traceable candidates. This is important when the
  // project has not yet placed a case in a strength combination.
  for(const lc of cases){
    const r=solveLoadCaseV138(lc);
    if(r){const pf={};for(const x of (lc.loads||[]))pf[x.pattern]=(pf[x.pattern]||0)+(Number(x.scale)||0);candidates.push({name:`CASE:${lc.name}`,kind:'LOAD CASE',result:r,patternFactors:pf});}
  }
  // The active pattern is included only as an auditable analysis candidate; it
  // is solved by the same whole-model solver, never by a separate RC routine.
  const original=m3.activeLoadPattern||'DL';
  try{
    const r=solve3DV128();
    if(r)candidates.push({name:`PATTERN:${original}`,kind:'LOAD PATTERN',result:r,patternFactors:{[original]:1}});
  } finally { m3.activeLoadPattern=original; }

  const map=new Map();
  const update=(q,n,name)=>{n=Number(n)||0;if(n>q.max){q.max=n;q.maxCombo=name}if(n<q.min){q.min=n;q.minCombo=name}};
  for(const x of candidates){
    for(const f of (x.result?.memberForces||[])){
      if(!map.has(f.id))map.set(f.id,{id:f.id,i:f.i,j:f.j,v:Array.from({length:12},()=>({max:-Infinity,min:Infinity,maxCombo:'',minCombo:''})),sources:[]});
      const row=map.get(f.id); row.sources.push(x.name);
      (f.local||[]).forEach((n,k)=>update(row.v[k],n,x.name));
    }
  }
  const stationCount=Math.max(21,Math.min(101,Math.round(Number(m3.rcBeamDesignV141?.defaults?.stationCount)||41)));
  for(const row of map.values()){
    const mm=(m3.members||[]).find(x=>String(x.id)===String(row.id));
    row.stations=mm?stationEnvelope3DV14611(mm,candidates,stationCount):[];
    row.stationCount=row.stations.length;
  }
  const env={
    combos:candidates.map(x=>x.name),
    members:[...map.values()],
    stationCount,
    livePattern:original,
    source:'V1.46.1.1 WHOLE MODEL 3D SOLVER → CASES/COMBINATIONS → STATION ENVELOPE → RC DESIGN',
    analysisRevision:Number(m3.analysisRevisionV1451)||0,
    generatedAt:Date.now(),
    forceComponents:['P/N','V2','V3','T','M2','M3']
  };
  m3.envelopeV140=env;
  m3.wholeModelDesignEnvelopeV146={source:env.source,generatedAt:env.generatedAt,analysisRevision:env.analysisRevision,candidateCount:candidates.length,memberCount:env.members.length};
  return env;
}
// Backward-compatible entry point used by older V1.45 UI code.
function envelopeV1452Live(){ return wholeModelDesignEnvelopeV146(); }

function rcBeamDesignV141(){
  const m3=ensure3DLoadSystemV131();
  // V1.46 Whole Model integration: RC demand is regenerated from the current full 3D model.
  const env=wholeModelDesignEnvelopeV146();
  m3.rcBeamDesignV141 ||= {defaults:{b:300,h:500,cover:40,minCover:40,aggregateSize:20,stirrupDia:10,stirrupSpacingMode:'auto',stirrupSpacing:250,mainBarMode:'auto',manualMainBars:5,mainBarDia:20,topBarMode:'auto',manualTopBars:2,topBarDia:20,topSupportZoneFraction:.25,fc:28,fy:420,phiFlexure:.90,phiShear:.75,devCastPosition:'other',devCoating:'uncoated',devLambda:1,devKtr:0,anchorI:600,anchorJ:600,spliceEnabled:false,spliceClass:'B',spliceProvided:0,spliceBarsPercent:100},memberOverrides:{}};
  storeCompatV14121(m3.rcBeamDesignV141);
  const store=m3.rcBeamDesignV141;
  const getMember=id=>(m3.members||[]).find(x=>x.id===id);
  const isBeam=m=>{if(!m)return false;const ni=(m3.nodes||[]).find(n=>n.id===m.i),nj=(m3.nodes||[]).find(n=>n.id===m.j);return !!(ni&&nj&&Math.abs((+ni.z||0)-(+nj.z||0))<1e-6)};
  const absGov=q=>Math.abs(q.max)>=Math.abs(q.min)?{value:q.max,combo:q.maxCombo,control:'MAX'}:{value:q.min,combo:q.minCombo,control:'MIN'};

  const designOne=e=>{
    const cfg={...store.defaults,...(store.memberOverrides[e.id]||{})};
    const b=Math.max(100,+cfg.b||300),h=Math.max(150,+cfg.h||500),cover=Math.max(20,+cfg.cover||40);
    const stirrupDia=Math.max(6,+cfg.stirrupDia||10),mainBarDia=Math.max(10,+cfg.mainBarDia||20),topBarDia=Math.max(10,+cfg.topBarDia||mainBarDia);
    const stirrupSpacingMode=String(cfg.stirrupSpacingMode||'auto').toLowerCase()==='manual'?'manual':'auto';
    const manualStirrupSpacing=Math.max(25,+cfg.stirrupSpacing||250);
    const mainBarMode=String(cfg.mainBarMode||'auto').toLowerCase()==='manual'?'manual':'auto';
    const manualMainBars=Math.max(2,Math.floor(+cfg.manualMainBars||2));
    const topBarMode=String(cfg.topBarMode||'auto').toLowerCase()==='manual'?'manual':'auto';
    const manualTopBars=Math.max(2,Math.floor(+cfg.manualTopBars||2));
    const aggregateSize=Math.max(1,+cfg.aggregateSize||20),minCover=Math.max(0,+cfg.minCover||40);
    const fc=Math.max(10,+cfg.fc||28),fy=Math.max(200,+cfg.fy||420);
    const devCastPosition=String(cfg.devCastPosition||'other').toLowerCase()==='top'?'top':'other';
    const devCoating=String(cfg.devCoating||'uncoated').toLowerCase()==='epoxy'?'epoxy':'uncoated';
    const devLambda=[1,0.85,0.75].includes(Number(cfg.devLambda))?Number(cfg.devLambda):1;
    const devKtr=Math.max(0,+cfg.devKtr||0),anchorI=Math.max(0,+cfg.anchorI||0),anchorJ=Math.max(0,+cfg.anchorJ||0);
    const spliceEnabled=!!cfg.spliceEnabled,spliceClass=String(cfg.spliceClass||'B').toUpperCase()==='A'?'A':'B',spliceProvided=Math.max(0,+cfg.spliceProvided||0),spliceBarsPercent=Math.min(100,Math.max(0,+cfg.spliceBarsPercent||0));
    const phiF=Math.min(.95,Math.max(.5,+cfg.phiFlexure||.90)),phiV=Math.min(.95,Math.max(.5,+cfg.phiShear||.75));
    const dNominal=Math.max(50,h-cover-stirrupDia-mainBarDia/2);

    const ms=[
      {axis:'M2',end:'i',...absGov(e.v[4])},{axis:'M3',end:'i',...absGov(e.v[5])},
      {axis:'M2',end:'j',...absGov(e.v[10])},{axis:'M3',end:'j',...absGov(e.v[11])}
    ];
    const vs=[
      {axis:'V2',end:'i',...absGov(e.v[1])},{axis:'V3',end:'i',...absGov(e.v[2])},
      {axis:'V2',end:'j',...absGov(e.v[7])},{axis:'V3',end:'j',...absGov(e.v[8])}
    ];
    const govM=ms.reduce((a,b)=>Math.abs(b.value)>Math.abs(a.value)?b:a),govV=vs.reduce((a,b)=>Math.abs(b.value)>Math.abs(a.value)?b:a);
    const ns=[{axis:'P/N',end:'i',...absGov(e.v[0])},{axis:'P/N',end:'j',...absGov(e.v[6])}];
    const ts=[{axis:'T',end:'i',...absGov(e.v[3])},{axis:'T',end:'j',...absGov(e.v[9])}];
    const govN=ns.reduce((a,b)=>Math.abs(b.value)>Math.abs(a.value)?b:a),govT=ts.reduce((a,b)=>Math.abs(b.value)>Math.abs(a.value)?b:a);
    const Pu=Math.abs(govN.value),Tu=Math.abs(govT.value);let Mu=Math.abs(govM.value),Vu=Math.abs(govV.value);
    // V1.46.1.1 — design demand comes from the station envelope, not end-force interpolation.
    const stationDemand=(e.stations||[]).map(st=>{
      const mPos=Math.max(0,Number(st.M2?.max)||0,Number(st.M3?.max)||0);
      const mNeg=Math.max(0,-(Number(st.M2?.min)||0),-(Number(st.M3?.min)||0));
      const vu=Math.max(Math.abs(Number(st.V2?.min)||0),Math.abs(Number(st.V2?.max)||0),Math.abs(Number(st.V3?.min)||0),Math.abs(Number(st.V3?.max)||0));
      return {r:Number(st.r)||0,x:Number(st.x)||0,Mpos:mPos,Mneg:mNeg,Mu:Math.max(mPos,mNeg),Vu:vu,
        comboMPos:(Number(st.M2?.max)||0)>=(Number(st.M3?.max)||0)?st.M2?.maxCombo:st.M3?.maxCombo,
        comboMNeg:(-(Number(st.M2?.min)||0))>=(-(Number(st.M3?.min)||0))?st.M2?.minCombo:st.M3?.minCombo,
        comboV:Math.max(Math.abs(Number(st.V2?.min)||0),Math.abs(Number(st.V2?.max)||0))>=Math.max(Math.abs(Number(st.V3?.min)||0),Math.abs(Number(st.V3?.max)||0))?(Math.abs(Number(st.V2?.min)||0)>=Math.abs(Number(st.V2?.max)||0)?st.V2?.minCombo:st.V2?.maxCombo):(Math.abs(Number(st.V3?.min)||0)>=Math.abs(Number(st.V3?.max)||0)?st.V3?.minCombo:st.V3?.maxCombo)};
    });
    if(stationDemand.length){Mu=Math.max(...stationDemand.map(x=>x.Mu));Vu=Math.max(...stationDemand.map(x=>x.Vu));}
    const MuNmm=Mu*1e6;
    const qv=k=>e.v?.[k]||{};
    const negMomentAt=idxs=>Math.max(0,...idxs.map(k=>Math.max(0,-Number(qv(k).min||0))));
    const absShearAt=idxs=>Math.max(0,...idxs.map(k=>Math.max(Math.abs(Number(qv(k).min||0)),Math.abs(Number(qv(k).max||0)))));
    const MnegI=stationDemand.length?stationDemand[0].Mneg:negMomentAt([4,5]), MnegJ=stationDemand.length?stationDemand[stationDemand.length-1].Mneg:negMomentAt([10,11]);
    const VuI=stationDemand.length?stationDemand[0].Vu:absShearAt([1,2]), VuJ=stationDemand.length?stationDemand[stationDemand.length-1].Vu:absShearAt([7,8]);
    const memberObj=getMember(e.id), nI=(m3.nodes||[]).find(n=>n.id===memberObj?.i), nJ=(m3.nodes||[]).find(n=>n.id===memberObj?.j);
    const Lmm=(nI&&nJ)?Math.max(500,Math.hypot((+nJ.x||0)-(+nI.x||0),(+nJ.y||0)-(+nI.y||0),(+nJ.z||0)-(+nI.z||0))*1000):5000;

    const d0=dNominal;
    const MuBottom=stationDemand.length?Math.max(0,...stationDemand.map(x=>x.Mpos)):Mu;
    const MuTop=stationDemand.length?Math.max(0,...stationDemand.map(x=>x.Mneg)):Math.max(MnegI,MnegJ);
    const A=phiF*fy*fy/(2*.85*fc*b),B=-phiF*fy*d0,C=MuBottom*1e6,disc=B*B-4*A*C;
    let AsReq=0,flexureStatus='OK';
    if(MuBottom>1e-9){
      if(disc<0){AsReq=NaN;flexureStatus='SECTION TOO SMALL / REVIEW'}
      else{
        const roots=[(-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A)].filter(x=>x>0);
        AsReq=roots.length?Math.min(...roots):NaN;
        if(!Number.isFinite(AsReq))flexureStatus='REVIEW';
      }
    }

    // V1.41.4.2 Fix — Auto longitudinal reinforcement must satisfy both flexural demand and minimum steel.
    // Keep AsReq as the strength-demand value for transparent reporting, but size bars from max(AsReq, AsMin).
    const beta1=Math.max(0.65,Math.min(0.85,0.85-0.05*Math.max(0,fc-28)/7));
    const AsMin1=0.25*Math.sqrt(fc)/fy*b*d0;
    const AsMin2=1.4/fy*b*d0;
    const AsMin=Math.max(AsMin1,AsMin2);
    const AsDesign=Number.isFinite(AsReq)?Math.max(AsReq,AsMin):NaN;
    const barArea=Math.PI*mainBarDia*mainBarDia/4;
    let nBars=mainBarMode==='manual'?manualMainBars:(Number.isFinite(AsDesign)?Math.max(2,Math.ceil(AsDesign/barArea)):null);
    let arrangement=rcBeamRebarArrangementV1416({b,h,cover,minCover,stirrupDia,mainBarDia,aggregateSize,nBars});
    let d=Number.isFinite(arrangement.dEff)?Math.max(50,arrangement.dEff):d0;
    // If the centroid shift from multi-layer steel reduces capacity, add bars until strength demand is recovered.
    if(nBars){
      for(let it=0;it<20;it++){
        arrangement=rcBeamRebarArrangementV1416({b,h,cover,minCover,stirrupDia,mainBarDia,aggregateSize,nBars});
        d=Number.isFinite(arrangement.dEff)?Math.max(50,arrangement.dEff):d0;
        const as=nBars*barArea,a=as*fy/(0.85*fc*b),mn=as*fy*(d-a/2)/1e6;
        if(phiF*mn+1e-9>=MuBottom || !arrangement.pass || mainBarMode==='manual')break;
        nBars++;
      }
      arrangement=rcBeamRebarArrangementV1416({b,h,cover,minCover,stirrupDia,mainBarDia,aggregateSize,nBars});
      d=Number.isFinite(arrangement.dEff)?Math.max(50,arrangement.dEff):d0;
    }
    let AsProv=nBars?nBars*barArea:null;
    // V1.46.1.1 — station-based longitudinal reinforcement zoning.
    // Negative station moment follows the existing SAPUDOM convention for top steel;
    // positive station moment is used for bottom steel.  Automatic mode keeps at least
    // two continuous bars and adds/removes extra bars only where the station envelope requires them.
    const economicalZoning=cfg.economicalZoning!==false;
    const flexBarsForMoment=(mu,dia,mode,manualBars)=>{
      if(mode==='manual')return Math.max(2,manualBars);
      if(!(mu>1e-9))return 2;
      const area=Math.PI*dia*dia/4,dd=Math.max(50,h-cover-stirrupDia-dia/2),asMin=Math.max(0.25*Math.sqrt(fc)/fy*b*dd,1.4/fy*b*dd);
      const AA=phiF*fy*fy/(2*.85*fc*b),BB=-phiF*fy*dd,CC=mu*1e6,DD=BB*BB-4*AA*CC;
      if(DD<0)return Math.max(2,Math.ceil(asMin/area));
      const roots=[(-BB-Math.sqrt(DD))/(2*AA),(-BB+Math.sqrt(DD))/(2*AA)].filter(x=>x>0),asR=roots.length?Math.min(...roots):0;
      return Math.max(2,Math.ceil(Math.max(asR,asMin)/area));
    };
    const groupStationZones=(items,key,labelPrefix)=>{
      if(!items.length)return[];const zones=[];let cur=Number(items[0][key]),i0=0;
      const close=i1=>{const a=items[i0],b2=items[i1];zones.push({name:`${labelPrefix}-${zones.length+1}`,x0:Math.max(0,a.x*1000),x1:Math.min(Lmm,b2.x*1000),[key]:cur});};
      for(let i=1;i<items.length;i++){const v=Number(items[i][key]);if(v!==cur){close(i);i0=Math.max(0,i-1);cur=v;}}
      close(items.length-1);if(zones.length)zones[zones.length-1].x1=Lmm;return zones;
    };
    const stationRebar=stationDemand.map(x=>({...x,
      bottomBars:flexBarsForMoment(x.Mpos,mainBarDia,mainBarMode,manualMainBars),
      topBars:flexBarsForMoment(x.Mneg,topBarDia,topBarMode,manualTopBars)}));
    if(stationRebar.length && !economicalZoning){const nb=Math.max(...stationRebar.map(x=>x.bottomBars)),nt=Math.max(...stationRebar.map(x=>x.topBars));stationRebar.forEach(x=>{x.bottomBars=nb;x.topBars=nt});}
    const bottomZones=stationRebar.length?groupStationZones(stationRebar,'bottomBars','Bottom'):[{name:'Bottom-1',x0:0,x1:Lmm,bottomBars:nBars||2}];
    const topZones=stationRebar.length?groupStationZones(stationRebar,'topBars','Top'):[];
    if(stationRebar.length && mainBarMode!=='manual'){
      const stationMaxBottom=Math.max(2,...stationRebar.map(x=>x.bottomBars));
      if(stationMaxBottom>Number(nBars||0)){nBars=stationMaxBottom;arrangement=rcBeamRebarArrangementV1416({b,h,cover,minCover,stirrupDia,mainBarDia,aggregateSize,nBars});d=Number.isFinite(arrangement.dEff)?Math.max(50,arrangement.dEff):d0;}
    }
    AsProv=nBars?nBars*barArea:null;
    const topArea=Math.PI*topBarDia*topBarDia/4;
    const topNI=stationRebar.length?stationRebar[0].topBars:flexBarsForMoment(MnegI,topBarDia,topBarMode,manualTopBars);
    const topNJ=stationRebar.length?stationRebar[stationRebar.length-1].topBars:flexBarsForMoment(MnegJ,topBarDia,topBarMode,manualTopBars);
    const topNMid=stationRebar.length?stationRebar[Math.floor(stationRebar.length/2)].topBars:(topBarMode==='manual'?manualTopBars:2);
    const topNBars=Math.max(2,topNI,topNJ,topNMid,...(stationRebar.map(x=>x.topBars)));
    const topArrangementI=rcBeamRebarArrangementV1416({b,h,cover,minCover,stirrupDia,mainBarDia:topBarDia,aggregateSize,nBars:topNI});
    const topArrangementJ=rcBeamRebarArrangementV1416({b,h,cover,minCover,stirrupDia,mainBarDia:topBarDia,aggregateSize,nBars:topNJ});
    const topArrangementMid=rcBeamRebarArrangementV1416({b,h,cover,minCover,stirrupDia,mainBarDia:topBarDia,aggregateSize,nBars:topNMid});
    const topArrangementGov=rcBeamRebarArrangementV1416({b,h,cover,minCover,stirrupDia,mainBarDia:topBarDia,aggregateSize,nBars:topNBars});
    const topArrangement=[topArrangementGov,topArrangementI,topArrangementJ,topArrangementMid].sort((a,b)=>b.layers-a.layers)[0];
    const topAsProv=topNBars*topArea;
    const firstTopZone=topZones[0]||{x0:0,x1:Math.min(Lmm/2,Math.max(.25*Lmm,40*topBarDia))},lastTopZone=topZones[topZones.length-1]||{x0:Math.max(0,Lmm/2),x1:Lmm};
    const topZoneLenI=Math.max(0,firstTopZone.x1-firstTopZone.x0),topZoneLenJ=Math.max(0,lastTopZone.x1-lastTopZone.x0);
    // Full-cage fit uses the governing station cage.
    const bottomDeepestCenter=arrangement.centers?.length?arrangement.centers[arrangement.centers.length-1]:NaN;
    const topDeepestFromTop=topArrangement.centers?.length?topArrangement.centers[topArrangement.centers.length-1]:NaN;
    const bottomInnerSurface=Number.isFinite(bottomDeepestCenter)?bottomDeepestCenter+mainBarDia/2:NaN;
    const topInnerSurface=Number.isFinite(topDeepestFromTop)?h-(topDeepestFromTop+topBarDia/2):NaN;
    const cageVerticalClear=(Number.isFinite(bottomInnerSurface)&&Number.isFinite(topInnerSurface))?topInnerSurface-bottomInnerSurface:NaN;
    const cageClearMin=Math.max(25,mainBarDia,topBarDia,4*aggregateSize/3);
    const cageSeparationPass=Number.isFinite(cageVerticalClear)&&cageVerticalClear+1e-9>=cageClearMin;
    const cageFitPass=arrangement.pass&&topArrangement.pass&&cageSeparationPass;
    const cageFitStatus=!arrangement.pass?`BOTTOM ${arrangement.status}`:(!topArrangement.pass?`TOP ${topArrangement.status}`:(!cageSeparationPass?'TOP/BOTTOM CLEAR SPACING FAIL':'PASS'));

    const VcN=.17*Math.sqrt(fc)*b*d,phiVc=phiV*VcN/1000,VsReqN=Math.max(0,Vu*1000/phiV-VcN),Av=2*Math.PI*stirrupDia*stirrupDia/4;
    const roundDown25=(x)=>Math.max(75,Math.floor(Math.max(75,x)/25)*25);
    const rawSpacingForVu=(vu)=>{const req=Math.max(0,vu*1000/phiV-VcN);let sx=req>1e-9?Av*fy*d/req:300;sx=Math.min(300,d/2,sx);return roundDown25(sx);};
    const zoneSpacingForVu=(vu,xmm)=>{
      const raw=rawSpacingForVu(vu),nearSupport=xmm<=2*d+1e-9||xmm>=Lmm-2*d-1e-9,stirrupContributionRequired=(vu*1000>phiV*VcN+1e-9);
      if(nearSupport&&stirrupContributionRequired){const supportCap=roundDown25(Math.min(d/4,150));return{spacing:Math.min(raw,supportCap),rawSpacing:raw,supportCap,basis:'STATION SHEAR + SUPPORT DETAILING CAP'};}
      return{spacing:raw,rawSpacing:raw,supportCap:null,basis:'STATION SHEAR ENVELOPE'};
    };
    let stirrupZones;
    if(stirrupSpacingMode==='manual')stirrupZones=[{name:'Uniform',x0:0,x1:Lmm,Vu,spacing:manualStirrupSpacing,rawSpacing:manualStirrupSpacing,basis:'MANUAL'}];
    else if(stationDemand.length){
      const ss=stationDemand.map(x=>{const q=zoneSpacingForVu(x.Vu,x.x*1000);return{...x,...q}}),rawZones=[];let i0=0,cur=ss[0].spacing;
      const push=i1=>{const seg=ss.slice(i0,i1+1),x0=seg[0].x*1000,x1=seg[seg.length-1].x*1000;rawZones.push({name:`Shear-${rawZones.length+1}`,x0:Math.max(0,x0),x1:Math.min(Lmm,x1),Vu:Math.max(...seg.map(a=>a.Vu)),spacing:cur,rawSpacing:Math.min(...seg.map(a=>a.rawSpacing)),supportCap:seg.map(a=>a.supportCap).filter(Number.isFinite).reduce((a,b)=>Math.min(a,b),Infinity),basis:seg.some(a=>a.basis.includes('SUPPORT'))?'STATION SHEAR + SUPPORT DETAILING CAP':'STATION SHEAR ENVELOPE'});};
      for(let i=1;i<ss.length;i++){if(ss[i].spacing!==cur){push(i);i0=Math.max(0,i-1);cur=ss[i].spacing;}}push(ss.length-1);if(rawZones.length)rawZones[rawZones.length-1].x1=Lmm;
      stirrupZones=rawZones.map(z=>({...z,supportCap:Number.isFinite(z.supportCap)?z.supportCap:null}));
    }else{
      stirrupZones=[{name:'Uniform',x0:0,x1:Lmm,Vu,spacing:rawSpacingForVu(Vu),rawSpacing:rawSpacingForVu(Vu),basis:'END FORCE FALLBACK'}];
    }
    const sReq=stirrupSpacingMode==='manual'?manualStirrupSpacing:Math.min(...stirrupZones.map(z=>z.spacing));

    
    // V1.41.1 shear verification
    const Av2=Av; // 2-legged stirrup area, mm2
    const VsProvN = Av2*fy*d/sReq;
    const VnN = VcN + VsProvN;
    const phiVn = phiV*VnN/1000; // kN
    const shearDCR = phiVn>1e-9 ? Vu/phiVn : Infinity;

    // Required Av/s from Vu <= phi(Vc+Vs)
    const requiredVsN = Math.max(0, Vu*1000/phiV - VcN);
    const AvOverSReq = requiredVsN>0 ? requiredVsN/(fy*d) : 0; // mm2/mm
    const AvOverSProv = Av2/sReq;

    // ACI-style practical max spacing limits (design-assist layer).
    // General beam shear reinforcement cap: min(d/2, 600 mm).
    // When Vs demand is high, tighten to min(d/4, 300 mm).
    const highShear = requiredVsN > 4*VcN;
    const sMaxCode = Math.max(75, Math.min(highShear ? d/4 : d/2, highShear ? 300 : 600));
    const spacingPass = sReq <= sMaxCode + 1e-9;

    // Maximum nominal shear stress safeguard.
    // Vn,max ~= Vc + 0.66*sqrt(fc')*b*d (N), simplified ACI-style ceiling.
    const VsMaxN = 0.66*Math.sqrt(fc)*b*d;
    const phiVnMax = phiV*(VcN + VsMaxN)/1000;
    const maxShearPass = Vu <= phiVnMax + 1e-9;

    const shearStrengthPass = Vu <= phiVn + 1e-9;
    // V1.46.1.1 — verify the provided stirrup zone at every station, not only the minimum spacing zone.
    const stationShearChecks=stationDemand.map(pt=>{
      const xmm=pt.x*1000,z=stirrupZones.find(q=>xmm>=q.x0-1e-6&&xmm<=q.x1+1e-6)||stirrupZones[stirrupZones.length-1],sp=Math.max(25,Number(z?.spacing)||sReq);
      const vs=Av2*fy*d/sp,cap=phiV*(VcN+vs)/1000,reqVs=Math.max(0,pt.Vu*1000/phiV-VcN),high=reqVs>4*VcN,smax=Math.max(75,Math.min(high?d/4:d/2,high?300:600));
      return{x:xmm,Vu:pt.Vu,spacing:sp,phiVn:cap,pass:pt.Vu<=cap+1e-9&&sp<=smax+1e-9&&pt.Vu<=phiVnMax+1e-9,combo:pt.comboV};
    });
    const stationShearPass=!stationShearChecks.length||stationShearChecks.every(x=>x.pass);
    const shearStatus = (shearStrengthPass && spacingPass && maxShearPass && stationShearPass) ? 'PASS' : 'REVIEW / FAIL';

    // V1.41.2 flexural verification — ACI-style rectangular singly reinforced beam checks.
    // beta1 / AsMin are calculated above so Auto reinforcement selection uses the same verified minimum-steel requirement.

    let aFlex=NaN,cFlex=NaN,epsT=NaN,phiM=0.65,Mn=NaN,phiMn=NaN,flexDCR=Infinity;
    let minSteelPass=false,strengthFlexPass=false,ductilityStatus='REVIEW';

    if(Number.isFinite(AsProv)&&AsProv>0){
      aFlex=AsProv*fy/(0.85*fc*b);
      cFlex=aFlex/beta1;
      epsT=cFlex>0?0.003*(d-cFlex)/cFlex:Infinity;

      if(epsT>=0.005)phiM=0.90;
      else if(epsT<=0.002)phiM=0.65;
      else phiM=0.65+(epsT-0.002)*(0.25/0.003);

      Mn=AsProv*fy*(d-aFlex/2)/1e6;
      phiMn=phiM*Mn;
      flexDCR=phiMn>1e-9?MuBottom/phiMn:Infinity;
      minSteelPass=AsProv+1e-9>=AsMin;
      strengthFlexPass=phiMn+1e-9>=MuBottom;

      if(epsT>=0.005)ductilityStatus='PASS';
      else if(epsT>=0.004)ductilityStatus='REVIEW';
      else ductilityStatus='REVIEW / LOW STRAIN';
    }

    const flexureCodePass=Number.isFinite(AsProv)&&strengthFlexPass&&minSteelPass&&epsT>=0.005;
    const flexureCodeStatus=flexureCodePass?'PASS':
      (!Number.isFinite(AsProv)?'REVIEW / FAIL':
      (!strengthFlexPass?'STRENGTH FAIL':
      (!minSteelPass?'MIN STEEL FAIL':'DUCTILITY REVIEW')));

    // V1.46.1.1 — independent top-steel strength check for the negative station envelope.
    const dTop=Math.max(50,h-cover-stirrupDia-topBarDia/2),AsMinTop=Math.max(0.25*Math.sqrt(fc)/fy*b*dTop,1.4/fy*b*dTop),aTop=topAsProv*fy/(0.85*fc*b),cTop=aTop/beta1,epsTop=cTop>0?0.003*(dTop-cTop)/cTop:Infinity;
    const phiTop=epsTop>=0.005?0.90:(epsTop<=0.002?0.65:0.65+(epsTop-0.002)*(0.25/0.003)),MnTop=topAsProv*fy*(dTop-aTop/2)/1e6,phiMnTop=phiTop*MnTop;
    const topStrengthPass=MuTop<=1e-9||phiMnTop+1e-9>=MuTop,topMinSteelPass=MuTop<=1e-9||topAsProv+1e-9>=AsMinTop,topDuctilityPass=MuTop<=1e-9||epsTop>=0.005;
    const topFlexurePass=topStrengthPass&&topMinSteelPass&&topDuctilityPass;

    // V1.41.6 detailing verification — automatic multi-layer arrangement + centroid-aware effective depth.
    const clearMin=arrangement.clearMin;
    const insideStirrupWidth=arrangement.insideWidth;
    const barsPerLayer=arrangement.barsPerLayer;
    const layers=arrangement.layers;
    const actualClear=arrangement.actualClear;
    const barFitPass=arrangement.barFitPass;
    const clearSpacingPass=arrangement.clearSpacingPass;
    const coverPass=arrangement.coverPass;
    const singleLayerPass=arrangement.singleLayerPass;
    const detailingPass=cageFitPass;
    const detailingStatus=cageFitStatus;

    // V1.41.5 — ACI 318-25-style straight tension development / anchorage / lap splice verification.
    const development=rcBeamDevelopmentV1415({b,h,cover,stirrupDia,mainBarDia,fc,fy,devCastPosition,devCoating,devLambda,devKtr,anchorI,anchorJ,spliceEnabled,spliceClass,spliceProvided,spliceBarsPercent,AsReq,AsProv},
      {actualClear,barFitPass},nBars);
    const developmentPass=development.pass;
    const ldZone=Math.max(0,Number(development?.ld)||0),extendZones=(zs,key)=>zs.map(z=>({...z,requiredX0:z.x0,requiredX1:z.x1,x0:Number(z[key])>2?Math.max(0,z.x0-ldZone):z.x0,x1:Number(z[key])>2?Math.min(Lmm,z.x1+ldZone):z.x1,developmentExtension:Number(z[key])>2?ldZone:0}));
    const bottomDetailZones=extendZones(bottomZones,'bottomBars'),topDetailZones=extendZones(topZones,'topBars');
    const zonedBarMm=[...bottomZones.map(z=>(z.x1-z.x0)*Number(z.bottomBars||0)),...topZones.map(z=>(z.x1-z.x0)*Number(z.topBars||0))].reduce((a,b)=>a+b,0);
    const uniformBarMm=Lmm*(Number(nBars||0)+Number(topNBars||0)),savingPct=uniformBarMm>1e-9?Math.max(0,Math.min(100,(1-zonedBarMm/uniformBarMm)*100)):0;
    const economy={enabled:economicalZoning,uniformBarMm,zonedBarMm,estimatedLongitudinalSavingPct:savingPct,note:'Comparison uses required station zones before development extension; final BBS quantity must include anchorage, laps and constructability.'};
    const governingStationM=stationDemand.reduce((a,x)=>!a||x.Mu>a.Mu?x:a,null),governingStationV=stationDemand.reduce((a,x)=>!a||x.Vu>a.Vu?x:a,null);
    const overallBeamPass=flexureCodePass&&topFlexurePass&&shearStatus==='PASS'&&detailingPass&&developmentPass;
    const overallBeamStatus=overallBeamPass?'PASS':'REVIEW / NOT VERIFIED';

    return {
      id:e.id,i:e.i,j:e.j,
      cfg:{b,h,cover,stirrupDia,stirrupSpacingMode,stirrupSpacing:manualStirrupSpacing,mainBarMode,manualMainBars,topBarMode,manualTopBars,aggregateSize,minCover,mainBarDia,topBarDia,fc,fy,phiF,phiV,d,dNominal,devCastPosition,devCoating,devLambda,devKtr,anchorI,anchorJ,spliceEnabled,spliceClass,spliceProvided,spliceBarsPercent,stationCount:Number(cfg.stationCount)||41,economicalZoning},
      govM,govV,governingStationM,governingStationV,Pu,Tu,Mu,Vu,AsReq,AsDesign,nBars,AsProv,phiVc,sReq,flexureStatus,
      shear:{
        Av:Av2, VsProv:VsProvN/1000, Vn:VnN/1000, phiVn,
        DCR:shearDCR, AvOverSReq, AvOverSProv,
        sMaxCode, spacingPass, maxShearPass, phiVnMax,
        strengthPass:shearStrengthPass,stationShearPass,stationChecks:stationShearChecks,status:shearStatus
      },
      flexure:{
        beta1,AsMin,AsMin1,AsMin2,a:aFlex,c:cFlex,epsT,phiM,Mn,phiMn,DCR:flexDCR,MuBottom,
        minSteelPass,strengthPass:strengthFlexPass,ductilityStatus,status:flexureCodeStatus
      },
      topFlexure:{MuTop,AsMin:AsMinTop,AsProv:topAsProv,a:aTop,c:cTop,epsT:epsTop,phiM:phiTop,Mn:MnTop,phiMn:phiMnTop,strengthPass:topStrengthPass,minSteelPass:topMinSteelPass,ductilityPass:topDuctilityPass,pass:topFlexurePass},
      detailing:{...arrangement,clearMin,insideStirrupWidth,barsPerLayer,layers,actualClear,barFitPass,clearSpacingPass,coverPass,singleLayerPass,cageVerticalClear,cageClearMin,cageSeparationPass,cageFitPass,status:detailingStatus,pass:detailingPass},
      topRebar:{nBars:topNBars,dia:topBarDia,AsProv:topAsProv,mode:topBarMode,arrangement:topArrangement,pass:topArrangement.pass,status:topArrangement.pass?'PASS':topArrangement.status,
        zones:{i:{nBars:topNI,Mu:MnegI,length:topZoneLenI,arrangement:topArrangementI},mid:{nBars:topNMid,length:Math.max(0,Lmm-topZoneLenI-topZoneLenJ),arrangement:topArrangementMid},j:{nBars:topNJ,Mu:MnegJ,length:topZoneLenJ,arrangement:topArrangementJ}},stationZones:topDetailZones},
      stationDesign:{count:stationDemand.length,demands:stationDemand,rebar:stationRebar,bottomZones:bottomDetailZones,topZones:topDetailZones,source:'WHOLE MODEL STATION ENVELOPE'},
      economy,stirrupZones,Lmm,development,
      overall:{status:overallBeamStatus,pass:overallBeamPass}
    };
  };

  const designs=env.members.filter(e=>isBeam(getMember(e.id))).map(designOne);
  store.results=designs;
  return designs;
}



// ===== V1.41.5 — Professional RC Beam Drawing + Development / Anchorage / Lap Splice Verification =====
function rcBeamDetailingDrawingV1414(d){
  const m3=ensure3DLoadSystemV131();
  const ni=(m3.nodes||[]).find(n=>String(n.id)===String(d.i)), nj=(m3.nodes||[]).find(n=>String(n.id)===String(d.j));
  const Lm=(ni&&nj)?Math.hypot((+nj.x||0)-(+ni.x||0),(+nj.y||0)-(+ni.y||0),(+nj.z||0)-(+ni.z||0)):4;
  const L=Math.max(500,Math.round(Lm*1000));
  const nBars=d.nBars||0,dia=d.cfg.mainBarDia,sd=d.cfg.stirrupDia,ss=Math.round(d.sReq);
  const layers=Math.max(1,Number.isFinite(d.detailing.layers)?d.detailing.layers:1);
  const perLayer=Math.max(1,Math.min(d.detailing.barsPerLayer||nBars,nBars||1));
  const layerCounts=(d.detailing?.counts?.length?d.detailing.counts.slice():[]); if(!layerCounts.length){let rem=nBars; while(rem>0){const c=Math.min(perLayer,rem);layerCounts.push(c);rem-=c}}
  const layerText=layerCounts.length?layerCounts.map((c,i)=>`L${i+1}: ${c}Ø${dia}`).join('  •  '):'REVIEW';
  const topDia=Number(d.topRebar?.dia||d.cfg.topBarDia)||dia,topCounts=(d.topRebar?.arrangement?.counts||[]).slice(),topCenters=(d.topRebar?.arrangement?.centers||[]).slice();
  const topText=topCounts.length?topCounts.map((c,i)=>`T${i+1}: ${c}Ø${topDia}`).join('  •  '):'REVIEW';
  const esc=x=>String(x??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const pass=d.overall.pass, barText=nBars?`${nBars}Ø${dia}`:'SECTION REVIEW REQUIRED';
  const W=1680,H=1120, x0=90,x1=1240,y0=210,beamH=190, scale=(x1-x0)/L;
  const anchorI=d.development?.anchorI||0,anchorJ=d.development?.anchorJ||0,ld=d.development?.ld||0;
  const aiX=Math.min(x1-70,x0+Math.max(0,anchorI)*scale), ajX=Math.max(x0+70,x1-Math.max(0,anchorJ)*scale);
  const st=[]; const sz=(d.stirrupZones?.length?d.stirrupZones:[{x0:0,x1:L,spacing:ss,name:'Uniform'}]);
  sz.forEach(z=>{const a=Math.max(0,Math.min(L,z.x0)),bb=Math.max(a,Math.min(L,z.x1)),sp=Math.max(50,Number(z.spacing)||ss);for(let mm=a;mm<=bb+1;mm+=sp){let x=x0+mm*scale;st.push(`<path d="M${x} ${y0+14}V${y0+beamH-14}" class="st"/>`)}});
  function barsRow(x,y,w,count){let out='';if(count<=0)return out;for(let k=0;k<count;k++){const xx=count===1?x+w/2:x+18+k*(w-36)/(count-1);out+=`<circle cx="${xx}" cy="${y}" r="8" class="bar"/>`}return out}
  function section(cx,cy,label){
    const sw=255,sh=300,x=cx-sw/2,y=cy-sh/2;
    // V1.41.6.1 FIX — draw bar coordinates from actual section geometry instead of
    // a fixed 38 px layer pitch.  This keeps every physically fitting layer inside
    // the concrete/stirrup outline and makes a genuine vertical-fit failure visible.
    const sx=sw/Math.max(1,Number(d.cfg.b)||1), sy=sh/Math.max(1,Number(d.cfg.h)||1);
    const stirrupInset=Math.max(8,(Number(d.cfg.cover)||0)*Math.min(sx,sy));
    const ix=x+stirrupInset,iy=y+stirrupInset,iw=sw-2*stirrupInset,ih=sh-2*stirrupInset;
    let circles='';
    const physicalCenters=(d.detailing?.centers?.length?d.detailing.centers:layerCounts.map((_,i)=>(Number(d.cfg.cover)||0)+(Number(d.cfg.stirrupDia)||0)+(Number(d.cfg.mainBarDia)||0)/2+i*((Number(d.cfg.mainBarDia)||0)+(d.detailing?.verticalClear||25))));
    layerCounts.forEach((cnt,r)=>{
      const yPhys=physicalCenters[r]||0;
      const yy=y+sh-yPhys*sy;
      const db=Number(d.cfg.mainBarDia)||20;
      const edgePhys=(Number(d.cfg.cover)||0)+(Number(d.cfg.stirrupDia)||0)+db/2;
      const left=x+edgePhys*sx,right=x+sw-edgePhys*sx;
      const rowW=Math.max(0,right-left);
      circles+=barsRow(left,yy,rowW,cnt);
    });
    topCounts.forEach((cnt,r)=>{
      const c=Number(topCenters[r]||((Number(d.cfg.cover)||0)+(Number(d.cfg.stirrupDia)||0)+topDia/2+r*(topDia+25)));
      const yy=y+c*sy;
      const edgePhys=(Number(d.cfg.cover)||0)+(Number(d.cfg.stirrupDia)||0)+topDia/2;
      const left=x+edgePhys*sx,right=x+sw-edgePhys*sx;
      circles+=barsRow(left,yy,Math.max(0,right-left),cnt).replaceAll('class="bar"','class="bar topbar"');
    });
    const fitNote=d.detailing?.verticalFitPass?'':` • VERTICAL FIT FAIL (${Math.ceil(d.detailing?.requiredVerticalDepth||0)} > ${Math.round(d.cfg.h)} mm)`;
    return `<text x="${cx}" y="${y-24}" class="h2 mid">${label}</text><rect x="${x}" y="${y}" width="${sw}" height="${sh}" class="conc"/><rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="5" class="stbox"/>${circles}<text x="${cx}" y="${y+sh+30}" class="txt mid">${d.cfg.b} × ${d.cfg.h} mm</text><text x="${cx}" y="${y+sh+54}" class="note mid">${esc('Bottom '+layerText+' • Top '+topText+fitNote)}</text>`;
  }
  const lapText=d.development?.spliceEnabled?`Class ${d.development.spliceClass} • Lap ${d.development.spliceProvided}/${d.development.lapRequired} mm${d.development.classAutoDowngraded?' • Auto B':''}`:'No lap splice specified';
  const status=pass?'DESIGN VERIFIED':'ENGINEER REVIEW REQUIRED';
  const svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><style>
  .sheet{fill:#fff}.border{fill:none;stroke:#0f172a;stroke-width:2}.thin{fill:none;stroke:#64748b;stroke-width:1}.conc{fill:#fff;stroke:#111827;stroke-width:2}.support{fill:#f1f5f9;stroke:#111827;stroke-width:2}.stbox{fill:none;stroke:#111827;stroke-width:2}.rebar{stroke:#111827;stroke-width:6;fill:none}.rebar2{stroke:#111827;stroke-width:4;fill:none}.rebarDash{stroke:#64748b;stroke-width:2.5;stroke-dasharray:12 8}.st{stroke:#475569;stroke-width:1}.bar{fill:#111827}.topbar{fill:#1d4ed8}.title{font:700 24px Arial;fill:#0f172a}.h1{font:700 18px Arial;fill:#0f172a}.h2{font:700 15px Arial;fill:#0f172a}.txt{font:14px Arial;fill:#111827}.note{font:12px Arial;fill:#475569}.small{font:11px Arial;fill:#64748b}.green{fill:#166534}.red{fill:#991b1b}.mid{text-anchor:middle}.dim{stroke:#334155;stroke-width:1;marker-start:url(#arr);marker-end:url(#arr)}.leader{stroke:#334155;stroke-width:1.2;fill:none;marker-end:url(#lead)}</style>
  <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M8,0 L0,4 L8,8" fill="none" stroke="#334155"/></marker><marker id="lead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#334155"/></marker></defs>
  <rect width="${W}" height="${H}" class="sheet"/><rect x="24" y="24" width="1632" height="1072" class="border"/>
  <text x="55" y="62" class="title">SAPUDOM — RC BEAM DETAIL</text><text x="55" y="88" class="txt">M${esc(d.id)} • N${esc(d.i)} → N${esc(d.j)} • ${d.cfg.b}×${d.cfg.h} mm • Clear length ${L} mm</text>
  <text x="${(x0+x1)/2}" y="155" class="h1 mid">BEAM ELEVATION</text>
  <rect x="${x0-42}" y="${y0-22}" width="42" height="${beamH+44}" class="support"/><rect x="${x1}" y="${y0-22}" width="42" height="${beamH+44}" class="support"/>
  <rect x="${x0}" y="${y0}" width="${x1-x0}" height="${beamH}" class="conc"/>${st.join('')}
  <line x1="${x0+12}" y1="${y0+42}" x2="${x1-12}" y2="${y0+42}" style="stroke:#1d4ed8;stroke-width:4"/><line x1="${x0+12}" y1="${y0+56}" x2="${x0+12+Math.min(L,d.topRebar?.zones?.i?.length||0)*scale}" y2="${y0+56}" style="stroke:#1d4ed8;stroke-width:8"/><line x1="${x1-12-Math.min(L,d.topRebar?.zones?.j?.length||0)*scale}" y1="${y0+56}" x2="${x1-12}" y2="${y0+56}" style="stroke:#1d4ed8;stroke-width:8"/><text x="${(x0+x1)/2}" y="${y0+31}" class="h2 mid" style="fill:#1d4ed8">TOP ZONES  i:${esc(d.topRebar?.zones?.i?.nBars||0)}Ø${topDia} • mid:${esc(d.topRebar?.zones?.mid?.nBars||0)}Ø${topDia} • j:${esc(d.topRebar?.zones?.j?.nBars||0)}Ø${topDia}</text>
  <path d="M${x0+12} ${y0+beamH-38}${d.development?.anchorIMethod==='90° HOOK'?` L${x0-18} ${y0+beamH-38} L${x0-18} ${y0+beamH-38-Math.min(105,d.development.hookTail90*scale)}`:''} M${x0+12} ${y0+beamH-38} L${x1-12} ${y0+beamH-38}${d.development?.anchorJMethod==='90° HOOK'?` L${x1+18} ${y0+beamH-38} L${x1+18} ${y0+beamH-38-Math.min(105,d.development.hookTail90*scale)}`:''}" class="rebar"/><text x="${(x0+x1)/2}" y="${y0+beamH-52}" class="h2 mid">B1  ${esc(barText)} BOTTOM  •  ${esc(layerText)}</text>
  <line x1="${x0}" y1="440" x2="${x1}" y2="440" class="dim"/><line x1="${x0}" y1="420" x2="${x0}" y2="460" class="thin"/><line x1="${x1}" y1="420" x2="${x1}" y2="460" class="thin"/><text x="${(x0+x1)/2}" y="432" class="txt mid">${L} mm</text>
  <line x1="${x0}" y1="485" x2="${aiX}" y2="485" class="dim"/><text x="${(x0+aiX)/2}" y="477" class="note mid">ANCHORAGE i = ${anchorI} mm • ${d.development?.anchorIMethod||'—'} ${d.development?.anchorIPass?'✓':'✕'}  (ld=${ld}${d.development?.anchorIMethod==='90° HOOK'?`, ldh=${d.development.ldh}`:''})</text>
  <line x1="${ajX}" y1="485" x2="${x1}" y2="485" class="dim"/><text x="${(ajX+x1)/2}" y="477" class="note mid">ANCHORAGE j = ${anchorJ} mm • ${d.development?.anchorJMethod||'—'} ${d.development?.anchorJPass?'✓':'✕'}  (ld=${ld}${d.development?.anchorJMethod==='90° HOOK'?`, ldh=${d.development.ldh}`:''})</text>
  <text x="${(x0+x1)/2}" y="525" class="h2 mid">S1  STIRRUPS Ø${sd} @ ${ss} mm</text>
  ${section(265,755,'SECTION A-A')}${section(600,755,'SECTION B-B')}
  <rect x="790" y="585" width="450" height="360" class="thin"/><text x="815" y="615" class="h1">BAR / DETAIL SCHEDULE</text>
  <line x1="790" y1="635" x2="1240" y2="635" class="thin"/><text x="815" y="660" class="h2">Mark</text><text x="900" y="660" class="h2">Description</text><text x="1140" y="660" class="h2">Remark</text>
  <line x1="790" y1="672" x2="1240" y2="672" class="thin"/><text x="815" y="700" class="txt">B1</text><text x="900" y="700" class="txt">${esc(barText)} bottom longitudinal</text><text x="1140" y="700" class="txt">${layers} layer${layers>1?'s':''}</text>
  <text x="815" y="738" class="txt">S1</text><text x="900" y="738" class="txt">Ø${sd} @ ${ss} mm stirrups</text><text x="1140" y="738" class="txt">2-leg</text>
  <line x1="790" y1="758" x2="1240" y2="758" class="thin"/><text x="815" y="790" class="h2">DEVELOPMENT / LAP</text><text x="815" y="820" class="txt">ld = ${ld} mm • Hook ldh = ${d.development?.ldh||'—'} mm • i: ${d.development?.anchorIMethod||'—'} • j: ${d.development?.anchorJMethod||'—'}</text><text x="815" y="848" class="txt">${esc(lapText)}</text>
  <line x1="790" y1="872" x2="1240" y2="872" class="thin"/><text x="815" y="902" class="h2">MATERIAL / COVER</text><text x="815" y="930" class="txt">fc'=${d.cfg.fc} MPa • fy=${d.cfg.fy} MPa • cover=${d.cfg.cover} mm</text>
  <rect x="55" y="1005" width="1185" height="62" class="thin"/><text x="70" y="1030" class="h2">DRAWING NOTE</text><text x="70" y="1053" class="note">Construction-oriented sheet. Detailed calculation trace is kept in RC Beam Design Details. Top steel, seismic detailing, torsion and splice location/staggering still require engineering verification. Automatic hook solutions remain design-assist and require support-geometry review.</text>
  <rect x="1270" y="24" width="386" height="1072" class="border"/><text x="1295" y="68" class="h1">RC BEAM — M${esc(d.id)}</text><text x="1295" y="100" class="note">V1.41.6.1 FIX — VERTICAL FIT SAFETY</text><line x1="1270" y1="125" x2="1656" y2="125" class="thin"/>
  <text x="1295" y="165" class="h2">MEMBER</text><text x="1295" y="195" class="txt">N${esc(d.i)} → N${esc(d.j)}</text><text x="1295" y="225" class="txt">${d.cfg.b} × ${d.cfg.h} mm</text><text x="1295" y="255" class="txt">Length ${L} mm</text><line x1="1270" y1="285" x2="1656" y2="285" class="thin"/>
  <text x="1295" y="325" class="h2">REINFORCEMENT</text><text x="1295" y="360" class="txt">Bottom: ${esc(barText)}</text><text x="1295" y="390" class="txt">${esc(layerText)}</text><text x="1295" y="420" class="txt">Stirrup: Ø${sd}@${ss}</text><text x="1295" y="450" class="txt">Cover: ${d.cfg.cover} mm</text><line x1="1270" y1="480" x2="1656" y2="480" class="thin"/>
  <text x="1295" y="520" class="h2">QUICK CHECK</text><text x="1295" y="555" class="txt">Flexure: ${esc(d.flexure.status)}</text><text x="1295" y="585" class="txt">Shear: ${esc(d.shear.status)}</text><text x="1295" y="615" class="txt">Detailing: ${esc(d.detailing.status)}</text><text x="1295" y="645" class="txt">Dev/Lap: ${esc(d.development?.status||'REVIEW')}</text><line x1="1270" y1="675" x2="1656" y2="675" class="thin"/>
  <text x="1295" y="715" class="h2">STATUS</text><text x="1295" y="755" class="h1 ${pass?'green':'red'}">${esc(status)}</text><text x="1295" y="790" class="note">Calculation-linked drawing.</text><text x="1295" y="815" class="note">Issue for construction only after</text><text x="1295" y="840" class="note">all required checks are complete.</text><line x1="1270" y1="875" x2="1656" y2="875" class="thin"/>
  <text x="1295" y="920" class="h2">SHEET</text><text x="1295" y="955" class="txt">RC-BEAM-M${esc(d.id)}</text><text x="1295" y="985" class="txt">Scale: NTS</text><text x="1295" y="1020" class="small">SAPUDOM V1.41.6.1</text></svg>`;
  const o=document.createElement('div');o.style.cssText='position:fixed;inset:0;z-index:100004;background:#0f172aF2;padding:12px;display:flex;flex-direction:column;gap:8px';
  o.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;color:white"><div><b style="font-size:20px">RC Beam Construction Drawing — M${d.id}</b><div style="font-size:12px;opacity:.8">V1.45 • Advanced Member Loads</div></div><div style="display:flex;gap:8px"><button id="v142draw3d">3D Rebar</button><button id="v1414print">Print / Save PDF</button><button id="v1414svg">Download SVG</button><button id="v1414close">Close</button></div></div><div style="background:#dbe3ec;flex:1;overflow:auto;border-radius:6px;padding:10px"><div style="background:#fff;box-shadow:0 4px 18px #0004;min-width:1100px">${svg}</div></div>`;
  document.body.appendChild(o);o.querySelector('#v1414close').onclick=()=>o.remove();o.querySelector('#v142draw3d').onclick=()=>rcBeamRebar3DViewerV142(d);
  o.querySelector('#v1414svg').onclick=()=>{const blob=new Blob([svg],{type:'image/svg+xml'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`SAPUDOM-M${d.id}-RC-Beam-V1.41.6.1.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};
  o.querySelector('#v1414print').onclick=()=>{const pw=window.open('','_blank');if(!pw){toast('Allow pop-ups to print drawing');return}pw.document.write(`<html><head><title>RC Beam M${d.id}</title><style>@page{size:A3 landscape;margin:5mm}body{margin:0}svg{width:100%;height:auto}</style></head><body>${svg}</body></html>`);pw.document.close();setTimeout(()=>pw.print(),250)};
}



// ===== V1.42 — 3D RC Rebar Visualization Foundation =====
// Calculation-linked beam cage viewer. Phase 1 visualizes the currently verified bottom
// longitudinal reinforcement, stirrups and automatic 90° anchorage hooks from RC Beam Design.
// It is intentionally read-only: no design quantities are changed by this viewer.
function rcBeamRebar3DViewerV142(d){
  // V1.45.2: never render a stale design object. Rebuild RC demand from the live solver path
  // and replace the incoming row/detail object with the current member result.
  try{const live=rcBeamDesignV141().find(x=>String(x.id)===String(d?.id));if(live)d=live}catch(e){console.warn('V1.45.2 live rebar refresh',e)}
  const m3=ensure3DLoadSystemV131();
  const member=(m3.members||[]).find(x=>String(x.id)===String(d.id));
  const ni=member&&(m3.nodes||[]).find(n=>n.id===member.i), nj=member&&(m3.nodes||[]).find(n=>n.id===member.j);
  const L=Math.max(500,Math.round((ni&&nj?Math.hypot((nj.x-ni.x),(nj.y-ni.y),(nj.z-ni.z)):5)*1000));
  const b=Number(d.cfg.b)||300,h=Number(d.cfg.h)||500,cover=Number(d.cfg.cover)||40;
  const db=Number(d.cfg.mainBarDia)||20,tdb=Number(d.topRebar?.dia||d.cfg.topBarDia)||db,sd=Number(d.cfg.stirrupDia)||10,ss=Math.max(50,Number(d.sReq)||250);
  const counts=(d.detailing?.counts||[]).map(x=>Math.max(0,Math.floor(Number(x)||0))).filter(Boolean);
  const centers=(d.detailing?.centers||[]).map(Number);
  const topCounts=(d.topRebar?.arrangement?.counts||[]).map(x=>Math.max(0,Math.floor(Number(x)||0))).filter(Boolean);
  const topCenters=(d.topRebar?.arrangement?.centers||[]).map(Number);
  const insideW=Math.max(db,Number(d.detailing?.insideWidth)||b-2*(cover+sd));
  const topInsideW=Math.max(tdb,Number(d.topRebar?.arrangement?.insideWidth)||b-2*(cover+sd));
  const hookTail=Math.max(8*db,Number(d.development?.hookTail90)||12*db);
  const hookI=d.development?.anchorIMethod==='90° HOOK',hookJ=d.development?.anchorJMethod==='90° HOOK';

  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;z-index:100006;background:rgba(2,6,23,.94);display:flex;flex-direction:column;padding:10px;gap:8px';
  modal.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;color:#fff;gap:12px;flex-wrap:wrap"><div><b style="font-size:20px">3D RC Rebar Viewer — M${d.id}</b><div style="font-size:12px;opacity:.78">V1.46.1.1 • Whole Model → Station Envelope → Auto RC Design</div></div><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><button id="v142fit">Fit</button><button id="v142iso">Isometric</button><button id="v142side">Side</button><button id="v142top">Top</button><button id="v142endi">End-i</button><button id="v142endj">End-j</button><label style="font-size:12px"><input id="v142conc" type="checkbox" checked> Concrete</label><label style="font-size:12px"><input id="v142st" type="checkbox" checked> Stirrups</label><label style="font-size:12px"><input id="v142bars" type="checkbox" checked> Bottom bars</label><label style="font-size:12px"><input id="v143topbars" type="checkbox" checked> Top bars</label><button id="v142close">Close</button></div></div><div style="position:relative;flex:1;min-height:360px;background:#e8eef5;border-radius:8px;overflow:hidden"><canvas id="v142canvas" style="width:100%;height:100%;display:block;touch-action:none"></canvas><div id="v142info" style="position:absolute;left:12px;top:12px;background:rgba(255,255,255,.94);padding:10px 12px;border-radius:8px;box-shadow:0 2px 8px #0002;font:12px Arial;line-height:1.55;color:#0f172a;max-width:360px"></div><div style="position:absolute;right:12px;bottom:10px;background:rgba(15,23,42,.86);color:white;padding:7px 10px;border-radius:7px;font:11px Arial">Drag: Rotate • Wheel: Zoom • V1.46.1.1 station-based RC zoning viewer</div></div>`;
  document.body.appendChild(modal);
  const canvas=modal.querySelector('#v142canvas'),ctx=canvas.getContext('2d');let dpr=1;
  const view={yaw:-32,pitch:24,scale:.13,ox:0,oy:0,sectionCut:null}, flags={concrete:true,stirrups:true,bars:true,topBars:true};
  let drag=null;

  function rotated(p){
    const x=p[0]-L/2,y=p[1],z=p[2]-h/2,ya=view.yaw*Math.PI/180,pi=view.pitch*Math.PI/180;
    const x1=Math.cos(ya)*x-Math.sin(ya)*y, y1=Math.sin(ya)*x+Math.cos(ya)*y;
    const y2=Math.cos(pi)*y1-Math.sin(pi)*z, z2=Math.sin(pi)*y1+Math.cos(pi)*z;
    return [x1,y2,z2];
  }
  function proj(p){const q=rotated(p);return [view.ox+q[0]*view.scale,view.oy-q[2]*view.scale,q[1]]}
  function line(points,width=2,alpha=1){if(points.length<2)return;ctx.save();ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.beginPath();points.forEach((p,i)=>{const q=proj(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.stroke();ctx.restore()}
  function fit(){
    if(view.sectionCut){draw();return}
    const r=canvas.getBoundingClientRect(),corners=[];for(const x of [0,L])for(const y of [-b/2,b/2])for(const z of [0,h])corners.push(rotated([x,y,z]));
    const xs=corners.map(q=>q[0]),zs=corners.map(q=>q[2]),w=Math.max(1,Math.max(...xs)-Math.min(...xs)),hh=Math.max(1,Math.max(...zs)-Math.min(...zs));
    view.scale=Math.max(.03,Math.min(.5,Math.min((r.width-100)/w,(r.height-100)/hh)));view.ox=r.width/2-(Math.min(...xs)+Math.max(...xs))/2*view.scale;view.oy=r.height/2+(Math.min(...zs)+Math.max(...zs))/2*view.scale;draw();
  }
  function face(points,fill,stroke='rgba(30,41,59,.42)'){
    ctx.save();ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.beginPath();points.forEach((p,i)=>{const q=proj(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function barYPositions(n,width=insideW,dia=db){if(n<=1)return[0];const avail=Math.max(0,width-dia);return Array.from({length:n},(_,i)=>-avail/2+i*avail/(n-1))}
  function drawSectionCut(end){
    const r=canvas.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);ctx.fillStyle='#eef3f8';ctx.fillRect(0,0,r.width,r.height);
    const margin=90, aw=Math.max(1,r.width-2*margin), ah=Math.max(1,r.height-2*margin);
    const sc=Math.max(.05,Math.min(1.2,Math.min(aw/b,ah/h)));
    const cx=r.width/2, baseY=r.height/2+h*sc/2;
    const X=y=>cx+(end==='j'?-1:1)*y*sc, Y=z=>baseY-z*sc;
    // concrete section outline at midspan (true section cut; hooks intentionally excluded)
    if(flags.concrete){ctx.save();ctx.fillStyle='rgba(148,163,184,.10)';ctx.strokeStyle='rgba(71,85,105,.55)';ctx.lineWidth=1.4;ctx.fillRect(cx-b*sc/2,baseY-h*sc,b*sc,h*sc);ctx.strokeRect(cx-b*sc/2,baseY-h*sc,b*sc,h*sc);ctx.restore()}
    const y0=-b/2+cover+sd/2,y1=b/2-cover-sd/2,z0=cover+sd/2,z1=h-cover-sd/2;
    if(flags.stirrups){ctx.save();ctx.strokeStyle='#16a34a';ctx.lineWidth=Math.max(2,sd*sc*.7);ctx.strokeRect(Math.min(X(y0),X(y1)),Y(z1),Math.abs(X(y1)-X(y0)),Math.abs(Y(z0)-Y(z1)));ctx.restore()}
    if(flags.bars){ctx.save();ctx.fillStyle='#dc2626';ctx.strokeStyle='#991b1b';ctx.lineWidth=1;counts.forEach((n,li)=>{const z=Number.isFinite(centers[li])?centers[li]:(cover+sd+db/2+li*(db+Math.max(25,db)));barYPositions(n).forEach(y=>{ctx.beginPath();ctx.arc(X(y),Y(z),Math.max(4,db*sc/2),0,Math.PI*2);ctx.fill();ctx.stroke()})});ctx.restore()}
    const endZone=end==='i'?d.topRebar?.zones?.i:d.topRebar?.zones?.j, endArr=endZone?.arrangement||d.topRebar?.arrangement;
    const endTopCounts=(endArr?.counts||topCounts).map(x=>Math.max(0,Math.floor(Number(x)||0))).filter(Boolean), endTopCenters=(endArr?.centers||topCenters).map(Number), endTopInsideW=Math.max(tdb,Number(endArr?.insideWidth)||topInsideW);
    if(flags.topBars){ctx.save();ctx.fillStyle='#2563eb';ctx.strokeStyle='#1e40af';ctx.lineWidth=1;endTopCounts.forEach((n,li)=>{const c=Number.isFinite(endTopCenters[li])?endTopCenters[li]:(cover+sd+tdb/2+li*(tdb+Math.max(25,tdb)));const z=h-c;barYPositions(n,endTopInsideW,tdb).forEach(y=>{ctx.beginPath();ctx.arc(X(y),Y(z),Math.max(4,tdb*sc/2),0,Math.PI*2);ctx.fill();ctx.stroke()})});ctx.restore()}
    // V1.44 end section cuts show the support zone at the selected end (not midspan top steel).
    ctx.save();ctx.fillStyle='#0f172a';ctx.textAlign='center';ctx.font='700 14px Arial';ctx.fillText(`END-${end.toUpperCase()} • SUPPORT ZONE SECTION CUT`,cx,34);ctx.font='12px Arial';ctx.fillStyle='#475569';ctx.fillText(`${b} × ${h} mm • Bottom ${counts.map((n,i)=>`L${i+1}:${n}Ø${db}`).join(' • ')} • Top ${endTopCounts.map((n,i)=>`T${i+1}:${n}Ø${tdb}`).join(' • ')}`,cx,54);ctx.restore();
    ctx.save();ctx.fillStyle='#0f172a';ctx.font='700 13px Arial';ctx.fillText(end,Math.min(r.width-30,cx+b*sc/2+18),Math.max(24,baseY-h*sc-8));ctx.restore();
  }
  function draw(){
    if(view.sectionCut){drawSectionCut(view.sectionCut);return}
    const r=canvas.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);ctx.fillStyle='#eef3f8';ctx.fillRect(0,0,r.width,r.height);
    // floor/grid reference
    ctx.strokeStyle='rgba(100,116,139,.18)';ctx.lineWidth=1;for(let x=-1000;x<=L+1000;x+=500)line([[x,-b,0],[x,b,0]],1,.45);for(let y=-1000;y<=1000;y+=250)line([[-500,y,0],[L+500,y,0]],1,.35);
    if(flags.concrete){
      const A=[0,-b/2,0],B=[L,-b/2,0],C=[L,b/2,0],D=[0,b/2,0],E=[0,-b/2,h],F=[L,-b/2,h],G=[L,b/2,h],H=[0,b/2,h];
      const faces=[[A,B,F,E],[D,C,G,H],[E,F,G,H],[A,D,H,E],[B,C,G,F],[A,B,C,D]].map(ps=>({ps,dep:ps.reduce((a,p)=>a+rotated(p)[1],0)/4})).sort((a,b)=>a.dep-b.dep);
      faces.forEach(x=>face(x.ps,'rgba(148,163,184,.10)','rgba(71,85,105,.35)'));
    }
    if(flags.stirrups){ctx.strokeStyle='#16a34a';const y0=-b/2+cover+sd/2,y1=b/2-cover-sd/2,z0=cover+sd/2,z1=h-cover-sd/2;const zones=d.stirrupZones?.length?d.stirrupZones:[{x0:0,x1:L,spacing:ss}];zones.forEach(z=>{const a=Math.max(0,Math.min(L,z.x0)),bb=Math.max(a,Math.min(L,z.x1)),sp=Math.max(50,Number(z.spacing)||ss);for(let x=a;x<=bb+1;x+=sp){line([[x,y0,z0],[x,y1,z0],[x,y1,z1],[x,y0,z1],[x,y0,z0]],Math.max(1.2,sd*view.scale*.65),.82)}})}
    if(flags.bars){ctx.strokeStyle='#dc2626';ctx.lineCap='round';counts.forEach((n,li)=>{const z=Number.isFinite(centers[li])?centers[li]:(cover+sd+db/2+li*(db+Math.max(25,db)));barYPositions(n).forEach(y=>{const pts=[];if(hookI)pts.push([0,y,Math.min(h-cover-sd-db/2,z+hookTail)]);pts.push([0,y,z],[L,y,z]);if(hookJ)pts.push([L,y,Math.min(h-cover-sd-db/2,z+hookTail)]);line(pts,Math.max(2.2,db*view.scale*.8),.96)})})}
    if(flags.topBars){ctx.strokeStyle='#2563eb';ctx.lineCap='round';
      const drawTopZone=(zone,x0,x1)=>{const arr=zone?.arrangement||d.topRebar?.arrangement,cs=arr?.counts||[],ct=arr?.centers||[];cs.forEach((n,li)=>{const c=Number.isFinite(ct[li])?ct[li]:(cover+sd+tdb/2+li*(tdb+Math.max(25,tdb)));const z=h-c;barYPositions(n,topInsideW,tdb).forEach(y=>line([[x0,y,z],[x1,y,z]],Math.max(2.2,tdb*view.scale*.8),.96))})};
      const zi=Math.min(L/2,Number(d.topRebar?.zones?.i?.length)||0),zj=Math.min(L/2,Number(d.topRebar?.zones?.j?.length)||0);
      drawTopZone(d.topRebar?.zones?.i,0,zi); drawTopZone(d.topRebar?.zones?.mid,zi,Math.max(zi,L-zj)); drawTopZone(d.topRebar?.zones?.j,Math.max(zi,L-zj),L);
    }
    // end labels / axes
    ctx.fillStyle='#0f172a';ctx.font='700 12px Arial';const qi=proj([0,0,h+100]),qj=proj([L,0,h+100]);ctx.fillText('i',qi[0]-4,qi[1]);ctx.fillText('j',qj[0]-4,qj[1]);
  }
  function resize(){const r=canvas.getBoundingClientRect();dpr=Math.max(1,window.devicePixelRatio||1);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);fit()}
  modal.querySelector('#v142info').innerHTML=`<b>M${d.id} • ${b}×${h} mm • L=${L} mm</b><br>Bottom: <b>${d.nBars||0}Ø${db}</b> • ${counts.map((n,i)=>`L${i+1}: ${n}Ø${db}`).join(' • ')||'No valid arrangement'}<br>Top zones: <b>i ${d.topRebar?.zones?.i?.nBars||0}Ø${tdb}</b> • mid <b>${d.topRebar?.zones?.mid?.nBars||0}Ø${tdb}</b> • j <b>${d.topRebar?.zones?.j?.nBars||0}Ø${tdb}</b> • ${String(d.topRebar?.mode||'auto').toUpperCase()}<br>Stirrup zones: ${(d.stirrupZones||[]).map(z=>`${z.name} Ø${sd}@${Math.round(z.spacing)} • Vu ${Number(z.Vu||0).toFixed(1)} kN${Number.isFinite(z.supportCap)?` • cap ${Math.round(z.supportCap)} mm`:''} (${Math.round(z.x0)}-${Math.round(z.x1)} mm)`).join(' • ')||`Ø${sd}@${ss}`} • Cover ${cover} mm<br>Bottom anchorage i: <b>${d.development?.anchorIMethod||'—'}</b> • j: <b>${d.development?.anchorJMethod||'—'}</b><br>Cage fit: <b>${d.detailing?.status||'—'}</b> • Overall: <b>${d.overall?.status||'—'}</b><br>Top↔Bottom clear: <b>${Number.isFinite(d.detailing?.cageVerticalClear)?d.detailing.cageVerticalClear.toFixed(1)+' mm':'—'}</b> • Required ≥ ${Number.isFinite(d.detailing?.cageClearMin)?d.detailing.cageClearMin.toFixed(1):'—'} mm<br><span style="color:#92400e">V1.46 RC demand is rebuilt from the current WHOLE MODEL 3D solver, load cases and governing combinations whenever the Rebar Viewer opens. Support top bars remain calculation-linked to negative end-moment envelopes; zone cut-off lengths remain detailing-assist.</span>`;
  modal.querySelector('#v142close').onclick=()=>modal.remove();
  modal.querySelector('#v142fit').onclick=fit;
  function preset(yaw,pitch){view.sectionCut=null;view.yaw=yaw;view.pitch=pitch;fit()}
  modal.querySelector('#v142iso').onclick=()=>preset(-32,24);
  modal.querySelector('#v142side').onclick=()=>preset(0,0);
  modal.querySelector('#v142top').onclick=()=>preset(0,80);
  modal.querySelector('#v142endi').onclick=()=>{view.sectionCut='i';draw()};
  modal.querySelector('#v142endj').onclick=()=>{view.sectionCut='j';draw()};
  modal.querySelector('#v142conc').onchange=e=>{flags.concrete=e.target.checked;draw()};modal.querySelector('#v142st').onchange=e=>{flags.stirrups=e.target.checked;draw()};modal.querySelector('#v142bars').onchange=e=>{flags.bars=e.target.checked;draw()};modal.querySelector('#v143topbars').onchange=e=>{flags.topBars=e.target.checked;draw()};
  canvas.onpointerdown=e=>{if(view.sectionCut){view.yaw=view.sectionCut==='i'?-90:90;view.pitch=0;view.sectionCut=null;fit()}canvas.setPointerCapture?.(e.pointerId);drag={x:e.clientX,y:e.clientY,yaw:view.yaw,pitch:view.pitch}};
  canvas.onpointermove=e=>{if(!drag)return;view.yaw=drag.yaw+(e.clientX-drag.x)*.35;view.pitch=Math.max(-80,Math.min(80,drag.pitch-(e.clientY-drag.y)*.3));draw()};
  canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
  canvas.onwheel=e=>{e.preventDefault();if(view.sectionCut){draw();return}const f=Math.exp(-e.deltaY*.001);view.scale=Math.max(.02,Math.min(1.2,view.scale*f));draw()};
  const ro=window.ResizeObserver?new ResizeObserver(resize):null;ro?.observe(canvas.parentElement);setTimeout(resize,0);
}

function rcBeamDesignCenterV141(){
  const m3=ensure3DLoadSystemV131(); let designs;
  try{designs=rcBeamDesignV141()}catch(e){toast(e.message);return}
  const store=m3.rcBeamDesignV141,w=document.createElement('div');
  w.style.cssText='position:fixed;inset:0;z-index:100001;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px';

  const statusBadge=(text,type)=>{
    const t=String(text||'');
    const cls=type||(
      t==='PASS'?'pass':
      (/FAIL/.test(t)?'fail':'review')
    );
    const bg=cls==='pass'?'#dcfce7':cls==='fail'?'#fee2e2':'#ffedd5';
    const fg=cls==='pass'?'#166534':cls==='fail'?'#991b1b':'#9a3412';
    const border=cls==='pass'?'#86efac':cls==='fail'?'#fca5a5':'#fdba74';
    return `<span style="display:inline-block;white-space:nowrap;padding:3px 7px;border-radius:999px;background:${bg};color:${fg};border:1px solid ${border};font-weight:800;font-size:10.5px">${t}</span>`;
  };

  const compactDetailing=(d)=>{
    if(d.detailing.pass) return statusBadge('PASS','pass');
    if(!d.detailing.coverPass) return statusBadge('COVER','fail');
    if(!d.detailing.barFitPass) return statusBadge('BAR FIT','fail');
    if(!d.detailing.clearSpacingPass) return statusBadge('SPACING','fail');
    if(!d.detailing.pass) return statusBadge(d.detailing.status||'DETAILING','review');
    return statusBadge('REVIEW','review');
  };

  const compactOverall=(d)=>d.overall.pass?statusBadge('PASS','pass'):statusBadge('NOT VERIFIED','fail');

  const rows=()=>designs.map(d=>`<tr>
    <td><b>M${d.id}</b><div style="font-size:10px;color:#64748b">N${d.i}→N${d.j}</div></td>
    <td style="text-align:right"><b>${d.Mu.toFixed(1)}</b></td>
    <td style="text-align:right">${Number.isFinite(d.flexure.phiMn)?d.flexure.phiMn.toFixed(1):'—'}</td>
    <td style="text-align:right">${Number.isFinite(d.flexure.DCR)?d.flexure.DCR.toFixed(3):'—'}</td>
    <td>${statusBadge(d.flexure.status)}</td>
    <td style="text-align:right"><b>${d.Vu.toFixed(1)}</b></td>
    <td style="text-align:right">${d.shear.phiVn.toFixed(1)}</td>
    <td style="text-align:right">${d.shear.DCR.toFixed(3)}</td>
    <td>${statusBadge(d.shear.status)}</td>
    <td>${compactDetailing(d)}</td>
    <td>${statusBadge(d.development?.status||'REVIEW',d.development?.pass?'pass':'fail')}</td>
    <td>${compactOverall(d)}</td>
    <td><button data-v141="${d.id}" style="white-space:nowrap">Details</button></td>
  </tr>`).join('');

  w.innerHTML=`<div style="width:min(1120px,96vw);max-height:93vh;background:#fff;border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 70px #0005">
    <header style="padding:18px 20px;background:#173b68;color:#fff;display:flex;justify-content:space-between"><div>
      <div style="font-size:22px;font-weight:900">RC Beam Design — Station-Based Governing Envelope</div>
      <div style="font-size:13px;opacity:.84">V1.46.1.1 • Station-Based RC Zoning</div></div>
      <button id="v141x" style="width:40px;height:40px;color:#fff;background:#ffffff22;border:1px solid #ffffff55;border-radius:10px">×</button></header>
    <div style="padding:10px 14px;background:#ecfdf5;color:#166534;font-size:12px"><b>V1.46.1.1 Station-Based Auto Design:</b> RC Beam Design rebuilds the current WHOLE MODEL analysis, recovers P/N, V2, V3, T, M2 and M3 at stations along every beam for all active load cases/combinations, forms station envelopes, then sizes bottom/top bars and stirrup zones from those envelopes. Economical zoning keeps continuous bars and adds extra reinforcement only where demand requires it; cut-off zones are extended by the calculated development length. Torsion, seismic special-frame detailing, serviceability/crack control and final construction BBS still require separate verification.</div>
    <div style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <fieldset style="display:flex;gap:8px;align-items:end;border:1px solid #cbd5e1;border-radius:10px;padding:7px 9px">
          <legend style="padding:0 5px;color:#475569;font-weight:800">Section</legend>
          <label>b<br><input id="v141b" type="number" value="${store.defaults.b}" style="width:64px"> mm</label>
          <label>h<br><input id="v141h" type="number" value="${store.defaults.h}" style="width:64px"> mm</label>
          <label>Cover<br><input id="v141cover" type="number" value="${store.defaults.cover}" style="width:58px"> mm</label>
        </fieldset>
        <fieldset style="display:flex;gap:8px;align-items:end;border:1px solid #cbd5e1;border-radius:10px;padding:7px 9px">
          <legend style="padding:0 5px;color:#475569;font-weight:800">Material</legend>
          <label>fc'<br><input id="v141fc" type="number" value="${store.defaults.fc}" style="width:58px"> MPa</label>
          <label>fy<br><input id="v141fy" type="number" value="${store.defaults.fy}" style="width:58px"> MPa</label>
        </fieldset>
        <fieldset style="display:flex;gap:8px;align-items:end;border:1px solid #cbd5e1;border-radius:10px;padding:7px 9px">
          <legend style="padding:0 5px;color:#475569;font-weight:800">Reinforcement</legend>
          <label>Main Ø<br><input id="v141bar" type="number" value="${store.defaults.mainBarDia}" style="width:54px"></label>
          <label>Main Mode<br><select id="v141bmode"><option value="auto" ${store.defaults.mainBarMode!=='manual'?'selected':''}>Auto</option><option value="manual" ${store.defaults.mainBarMode==='manual'?'selected':''}>Manual</option></select></label>
          <label id="v141nbwrap" style="${store.defaults.mainBarMode==='manual'?'':'display:none'}">Main Bars<br><input id="v141nbars" type="number" min="2" step="1" value="${store.defaults.manualMainBars??5}" style="width:58px"> bars</label>
          <label>Top Ø<br><input id="v143topdia" type="number" value="${store.defaults.topBarDia??store.defaults.mainBarDia}" style="width:54px"></label>
          <label>Top Mode<br><select id="v143topmode"><option value="auto" ${store.defaults.topBarMode!=='manual'?'selected':''}>Auto (2 bars)</option><option value="manual" ${store.defaults.topBarMode==='manual'?'selected':''}>Manual</option></select></label>
          <label id="v143topwrap" style="${store.defaults.topBarMode==='manual'?'':'display:none'}">Top Bars<br><input id="v143topbarsinput" type="number" min="2" step="1" value="${store.defaults.manualTopBars??2}" style="width:58px"> bars</label>
          <label>Stirrup Ø<br><input id="v141st" type="number" value="${store.defaults.stirrupDia}" style="width:54px"></label>
          <label>Stirrup Mode<br><select id="v141smode"><option value="auto" ${store.defaults.stirrupSpacingMode==='auto'?'selected':''}>Auto</option><option value="manual" ${store.defaults.stirrupSpacingMode==='manual'?'selected':''}>Manual</option></select></label>
          <label>Spacing<br><input id="v141spacing" type="number" min="25" step="25" value="${store.defaults.stirrupSpacing}" style="width:60px"> mm</label>
        </fieldset>
        <details style="border:1px solid #cbd5e1;border-radius:10px;padding:7px 9px">
          <summary style="cursor:pointer;font-weight:800;color:#475569">Detailing inputs</summary>
          <div style="display:flex;gap:8px;margin-top:8px">
            <label>Min Cover<br><input id="v141mincover" type="number" value="${store.defaults.minCover??40}" style="width:58px"> mm</label>
            <label>Aggregate<br><input id="v141agg" type="number" value="${store.defaults.aggregateSize??20}" style="width:58px"> mm</label>
          </div>
        </details>
        <details style="border:1px solid #cbd5e1;border-radius:10px;padding:7px 9px;max-width:500px">
          <summary style="cursor:pointer;font-weight:800;color:#475569">Development / Anchorage / Lap</summary>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(90px,1fr));gap:8px;margin-top:8px;align-items:end">
            <label>Cast position<br><select id="v141cast"><option value="other" ${store.defaults.devCastPosition!=='top'?'selected':''}>Other</option><option value="top" ${store.defaults.devCastPosition==='top'?'selected':''}>Top bar</option></select></label>
            <label>Coating<br><select id="v141coat"><option value="uncoated" ${store.defaults.devCoating!=='epoxy'?'selected':''}>Uncoated</option><option value="epoxy" ${store.defaults.devCoating==='epoxy'?'selected':''}>Epoxy</option></select></label>
            <label>Concrete λ<br><select id="v141lambda"><option value="1" ${Number(store.defaults.devLambda)===1?'selected':''}>1.00 Normal</option><option value="0.85" ${Number(store.defaults.devLambda)===0.85?'selected':''}>0.85 Sand-LW</option><option value="0.75" ${Number(store.defaults.devLambda)===0.75?'selected':''}>0.75 All-LW</option></select></label>
            <label>Ktr<br><input id="v141ktr" type="number" min="0" value="${store.defaults.devKtr??0}" style="width:62px"> mm</label>
            <label>Anchor i<br><input id="v141ai" type="number" min="0" value="${store.defaults.anchorI??600}" style="width:72px"> mm</label>
            <label>Anchor j<br><input id="v141aj" type="number" min="0" value="${store.defaults.anchorJ??600}" style="width:72px"> mm</label>
            <label>Lap splice<br><select id="v141splice"><option value="off" ${!store.defaults.spliceEnabled?'selected':''}>None</option><option value="on" ${store.defaults.spliceEnabled?'selected':''}>Verify</option></select></label>
            <label>Requested class<br><select id="v141sclass"><option value="A" ${store.defaults.spliceClass==='A'?'selected':''}>A (auto-check)</option><option value="B" ${store.defaults.spliceClass!=='A'?'selected':''}>B</option></select></label>
            <label>Bars spliced<br><input id="v141spct" type="number" min="0" max="100" value="${store.defaults.spliceBarsPercent??100}" style="width:64px"> %</label>
            <label>Provided lap<br><input id="v141slap" type="number" min="0" value="${store.defaults.spliceProvided??0}" style="width:76px"> mm</label>
          </div>
        </details>
        <fieldset style="display:flex;gap:8px;align-items:end;border:1px solid #86efac;border-radius:10px;padding:7px 9px;background:#f0fdf4">
          <legend style="padding:0 5px;color:#166534;font-weight:800">V1.46.1.1 Auto Zoning</legend>
          <label>Stations<br><input id="v14611stations" type="number" min="21" max="101" step="10" value="${store.defaults.stationCount||41}" style="width:64px"></label>
          <label style="display:flex;gap:5px;align-items:center;height:34px"><input id="v14611economy" type="checkbox" ${store.defaults.economicalZoning!==false?'checked':''}> Economical zones</label>
        </fieldset>
        <button id="v141Apply" class="primary" style="height:36px;white-space:nowrap">Apply & Recalculate</button>
      </div>
    </div>
    <div style="padding:7px 14px;background:#eef6ff;border-bottom:1px solid #dbeafe;color:#1e3a8a;font-size:11px">
      Main table is compact. Governing combinations, detailing, and development/anchorage/lap-splice trace are available in <b>Details</b>.
    </div>
    <div style="overflow:auto;flex:1">
      <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:11.5px;min-width:930px">
        <thead style="position:sticky;top:0;background:#f8fafc;z-index:2">
          <tr>
            <th style="text-align:left">Beam</th>
            <th>Mu</th><th>φMn</th><th>Mu/φMn</th><th>Flexure</th>
            <th>Vu</th><th>φVn</th><th>Vu/φVn</th><th>Shear</th>
            <th>Detailing</th><th>Dev / Splice</th><th>Overall</th><th></th>
          </tr>
        </thead>
        <tbody id="v141tbody">${rows()}</tbody>
      </table>
    </div>
    <footer style="padding:12px 14px;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0"><div>Horizontal members detected: <b>${designs.length}</b></div><button id="v141close">Close</button></footer>
  </div>`;
  const v141style=document.createElement('style');
  v141style.textContent=`
    #v141tbody td{padding:7px 8px;border-bottom:1px solid #eef2f7;vertical-align:middle}
    #v141tbody tr:nth-child(even){background:#fbfdff}
    #v141tbody tr:hover{background:#eff6ff}
    #v141tbody td:nth-child(2),#v141tbody td:nth-child(3),#v141tbody td:nth-child(4),
    #v141tbody td:nth-child(6),#v141tbody td:nth-child(7),#v141tbody td:nth-child(8){font-variant-numeric:tabular-nums}
    #v141tbody button{padding:5px 9px;border-radius:8px}
    table thead th{padding:8px 7px;border-bottom:1px solid #cbd5e1;color:#334155;white-space:nowrap;text-align:center}
  `;
  w.appendChild(v141style);
  document.body.appendChild(w);

  const close=()=>w.remove();w.querySelector('#v141x').onclick=close;w.querySelector('#v141close').onclick=close;

  const bindDetails=()=>w.querySelectorAll('[data-v141]').forEach(b=>b.onclick=()=>{
    const d=designs.find(x=>x.id==b.dataset.v141),m=document.createElement('div');
    m.style.cssText='position:fixed;inset:0;z-index:100002;background:#0008;display:flex;align-items:center;justify-content:center;padding:18px';
    m.innerHTML=`<div style="width:min(900px,96vw);max-height:92vh;background:#fff;border-radius:16px;overflow:auto;box-shadow:0 24px 70px #0006">
      <header style="padding:16px 18px;background:#173b68;color:#fff;display:flex;justify-content:space-between"><div><b style="font-size:20px">Beam M${d.id} — RC Design Details</b><div>N${d.i}→N${d.j}</div></div><button id="v141dx">×</button></header>
      <div style="padding:14px 16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;font-size:13px">
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"><b>Section</b><br>${d.cfg.b} × ${d.cfg.h} mm<br>d=${d.cfg.d.toFixed(1)} mm</div>
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"><b>Materials</b><br>fc'=${d.cfg.fc} MPa<br>fy=${d.cfg.fy} MPa</div>
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"><b>Governing Moment Station</b><br>x/L=${d.governingStationM?d.governingStationM.r.toFixed(3):'—'} • Mu=${d.Mu.toFixed(3)} kN·m<br>${d.governingStationM?(d.governingStationM.Mpos>=d.governingStationM.Mneg?d.governingStationM.comboMPos:d.governingStationM.comboMNeg):d.govM.combo}</div>
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"><b>Governing Shear Station</b><br>x/L=${d.governingStationV?d.governingStationV.r.toFixed(3):'—'} • Vu=${d.Vu.toFixed(3)} kN<br>${d.governingStationV?.comboV||d.govV.combo}</div>
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"><b>Flexural Reinforcement</b><br>
          As req=${Number.isFinite(d.AsReq)?d.AsReq.toFixed(0):'REVIEW'} mm²<br>
          As min=${Number.isFinite(d.flexure.AsMin)?d.flexure.AsMin.toFixed(0):'—'} mm²<br>
          ${d.nBars?`${d.nBars}-Ø${d.cfg.mainBarDia} = ${d.AsProv.toFixed(0)} mm²`:'Review section'}<br>
          εt=${Number.isFinite(d.flexure.epsT)?d.flexure.epsT.toFixed(5):'—'} • φ=${d.flexure.phiM.toFixed(3)}
        </div>
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"><b>Flexural Capacity</b><br>
          Mn=${Number.isFinite(d.flexure.Mn)?d.flexure.Mn.toFixed(1):'—'} kN·m<br>
          φMn=${Number.isFinite(d.flexure.phiMn)?d.flexure.phiMn.toFixed(1):'—'} kN·m<br>
          Mu/φMn=${Number.isFinite(d.flexure.DCR)?d.flexure.DCR.toFixed(3):'—'}<br>
          β1=${d.flexure.beta1.toFixed(3)}
        </div>
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"><b>Detailing Verification</b><br>
          Inside stirrup width=${d.detailing.insideStirrupWidth.toFixed(0)} mm<br>
          Min clear spacing=${d.detailing.clearMin.toFixed(1)} mm<br>
          Capacity/layer=${d.detailing.barsPerLayer} bars • Required layers=${Number.isFinite(d.detailing.layers)?d.detailing.layers:'—'}<br>
          Actual clear≈${Number.isFinite(d.detailing.actualClear)?d.detailing.actualClear.toFixed(1):'—'} mm<br>
          Cover=${d.cfg.cover} mm ≥ minimum ${d.cfg.minCover} mm
        </div>
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff"><b>Shear Reinforcement</b><br>
          φVc = ${d.phiVc.toFixed(1)} kN<br>
          Vs(provided) = ${d.shear.VsProv.toFixed(1)} kN<br>
          φVn = ${d.shear.phiVn.toFixed(1)} kN<br>
          Vu/φVn = ${d.shear.DCR.toFixed(3)}<br>
          Use Ø${d.cfg.stirrupDia} @ ${d.sReq} mm (${d.cfg.stirrupSpacingMode==='manual'?'Manual':'Auto'})
        </div>
        <div style="padding:10px;border:1px solid #86efac;border-radius:10px;background:#f0fdf4;grid-column:1/-1"><b>V1.46.1.1 Station-Based Reinforcement Zones</b><br>
          Stations = <b>${d.stationDesign?.count||0}</b> • Economy mode = <b>${d.economy?.enabled?'ON':'OFF'}</b> • Estimated longitudinal reduction vs uniform-max = <b>${Number(d.economy?.estimatedLongitudinalSavingPct||0).toFixed(1)}%</b><br>
          Bottom: ${(d.stationDesign?.bottomZones||[]).map(z=>`${z.bottomBars}Ø${d.cfg.mainBarDia} @ ${Math.round(z.x0)}–${Math.round(z.x1)} mm${z.developmentExtension?` (ld +${Math.round(z.developmentExtension)} mm)`:''}`).join(' • ')||'—'}<br>
          Top: ${(d.stationDesign?.topZones||[]).map(z=>`${z.topBars}Ø${d.cfg.topBarDia} @ ${Math.round(z.x0)}–${Math.round(z.x1)} mm${z.developmentExtension?` (ld +${Math.round(z.developmentExtension)} mm)`:''}`).join(' • ')||'—'}<br>
          Stirrups: ${(d.stirrupZones||[]).map(z=>`Ø${d.cfg.stirrupDia}@${Math.round(z.spacing)} @ ${Math.round(z.x0)}–${Math.round(z.x1)} mm • Vu=${Number(z.Vu||0).toFixed(1)} kN`).join(' • ')||'—'}
        </div>
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;grid-column:1/-1"><b>Development / Anchorage / Lap Splice — Straight Tension Bar</b><br>
          ld = <b>${d.development?.ld??'—'} mm</b> (raw ${Number.isFinite(d.development?.ldRaw)?d.development.ldRaw.toFixed(1):'—'} mm) • (cb+Ktr)/db = ${Number.isFinite(d.development?.confRatio)?d.development.confRatio.toFixed(3):'—'}<br>
          ψt=${d.development?.psiT??'—'} • ψe=${d.development?.psiE??'—'} • ψs=${d.development?.psiS??'—'} • ψg=${d.development?.psiG??'—'} • λ=${d.development?.lambda??'—'} • cb=${Number.isFinite(d.development?.cb)?d.development.cb.toFixed(1):'—'} mm • Ktr=${d.development?.Ktr??'—'} mm<br>
          Anchorage i: ${d.development?.anchorI??'—'} mm • ${d.development?.anchorIMethod||'—'} = <b>${d.development?.anchorIPass?'PASS':'FAIL'}</b> • Anchorage j: ${d.development?.anchorJ??'—'} mm • ${d.development?.anchorJMethod||'—'} = <b>${d.development?.anchorJPass?'PASS':'FAIL'}</b> • hook ldh=${d.development?.ldh??'—'} mm<br>
          Lap splice: ${d.development?.spliceEnabled?`Class ${d.development.spliceClass}${d.development.classAutoDowngraded?' (auto from requested A)':''} • As prov/req=${Number.isFinite(d.development.asRatio)?d.development.asRatio.toFixed(2):'—'} • bars spliced=${d.development.spliceBarsPercent}% • provided ${d.development.spliceProvided} mm / required ${d.development.lapRequired} mm = <b>${d.development.lapPass?'PASS':'FAIL'}</b>`:'Not specified — N/A'}
        </div>
      </div>
      <div style="padding:10px 16px;background:#f8fafc;line-height:1.6">
        <b>Flexural verification:</b>
        Strength <b>${d.flexure.strengthPass?'PASS':'FAIL'}</b> •
        Minimum steel <b>${d.flexure.minSteelPass?'PASS':'FAIL'}</b> •
        Ductility/strain <b>${d.flexure.ductilityStatus}</b> •
        Flexure status <b style="color:${d.flexure.status==='PASS'?'#166534':'#b45309'}">${d.flexure.status}</b> • Top flexure <b>${d.topFlexure?.pass?'PASS':'FAIL'}</b><br>
        <b>Shear verification:</b>
        Strength <b>${d.shear.strengthPass?'PASS':'FAIL'}</b> •
        Spacing <b>${d.shear.spacingPass?'PASS':'FAIL'}</b> (s=${d.sReq} mm ≤ smax=${d.shear.sMaxCode.toFixed(0)} mm) •
        Max shear limit <b>${d.shear.maxShearPass?'PASS':'FAIL'}</b> • Station zones <b>${d.shear.stationShearPass?'PASS':'FAIL'}</b> •
        Shear status <b style="color:${d.shear.status==='PASS'?'#166534':'#b91c1c'}">${d.shear.status}</b><br>
        <b>Detailing verification:</b>
        Bar fit <b>${d.detailing.barFitPass?'PASS':'FAIL'}</b> •
        Clear spacing <b>${d.detailing.clearSpacingPass?'PASS':'FAIL'}</b> •
        Cover <b>${d.detailing.coverPass?'PASS':'FAIL'}</b> •
        Layers <b>${d.detailing.pass?(d.detailing.layers+' LAYER PASS'):'ARRANGEMENT FAIL'}</b> • d<sub>eff</sub>=${Number.isFinite(d.detailing.dEff)?d.detailing.dEff.toFixed(1):'—'} mm •
        Detailing status <b style="color:${d.detailing.pass?'#166534':'#b45309'}">${d.detailing.status}</b><br>
        <b>Development / Anchorage / Lap:</b> <b style="color:${d.development?.pass?'#166534':'#b91c1c'}">${d.development?.status||'REVIEW'}</b> • ld=${d.development?.ld??'—'} mm • i=${d.development?.anchorIPass?'PASS':'FAIL'} • j=${d.development?.anchorJPass?'PASS':'FAIL'} • lap=${d.development?.spliceEnabled?(d.development.lapPass?'PASS':'FAIL'):'N/A'}<br>
        <b>Overall Beam Design:</b>
        <b style="color:${d.overall.pass?'#166534':'#b91c1c'};font-size:14px">${d.overall.status}</b>
      </div>
      <footer style="padding:12px;text-align:right;display:flex;justify-content:flex-end;gap:8px"><button id="v142rebar3d">3D Rebar Viewer</button><button id="v1414drawing">RC Beam Detailing Drawing</button><button id="v141dclose">Close</button></footer></div>`;
    document.body.appendChild(m);const dc=()=>m.remove();m.querySelector('#v141dx').onclick=dc;m.querySelector('#v141dclose').onclick=dc;m.querySelector('#v142rebar3d').onclick=()=>rcBeamRebar3DViewerV142(d);m.querySelector('#v1414drawing').onclick=()=>rcBeamDetailingDrawingV1414(d);
  });
  bindDetails();

  const syncMainBarModeV14162=()=>{const manual=w.querySelector('#v141bmode').value==='manual';w.querySelector('#v141nbwrap').style.display=manual?'':'none';};
  const syncTopBarModeV143=()=>{const manual=w.querySelector('#v143topmode').value==='manual';w.querySelector('#v143topwrap').style.display=manual?'':'none';};
  w.querySelector('#v141bmode').onchange=syncMainBarModeV14162;syncMainBarModeV14162();w.querySelector('#v143topmode').onchange=syncTopBarModeV143;syncTopBarModeV143();
  w.querySelector('#v141Apply').onclick=()=>{
    Object.assign(store.defaults,{
      b:+w.querySelector('#v141b').value||300,h:+w.querySelector('#v141h').value||500,
      cover:+w.querySelector('#v141cover').value||40,
      minCover:Math.max(0,+w.querySelector('#v141mincover').value||40),aggregateSize:Math.max(1,+w.querySelector('#v141agg').value||20),
      fc:+w.querySelector('#v141fc').value||28,
      fy:+w.querySelector('#v141fy').value||420,mainBarDia:+w.querySelector('#v141bar').value||20,
      mainBarMode:w.querySelector('#v141bmode').value==='manual'?'manual':'auto',
      manualMainBars:Math.max(2,Math.floor(+w.querySelector('#v141nbars').value||2)),
      topBarDia:+w.querySelector('#v143topdia').value||20,
      topBarMode:w.querySelector('#v143topmode').value==='manual'?'manual':'auto',
      manualTopBars:Math.max(2,Math.floor(+w.querySelector('#v143topbarsinput').value||2)),
      stirrupDia:+w.querySelector('#v141st').value||10,
      stirrupSpacingMode:w.querySelector('#v141smode').value==='manual'?'manual':'auto',
      stirrupSpacing:Math.max(25,+w.querySelector('#v141spacing').value||250),
      stationCount:Math.max(21,Math.min(101,Math.round(+w.querySelector('#v14611stations').value||41))),
      economicalZoning:!!w.querySelector('#v14611economy').checked,
      devCastPosition:w.querySelector('#v141cast').value==='top'?'top':'other',
      devCoating:w.querySelector('#v141coat').value==='epoxy'?'epoxy':'uncoated',
      devLambda:Number(w.querySelector('#v141lambda').value)||1,
      devKtr:Math.max(0,+w.querySelector('#v141ktr').value||0),
      anchorI:Math.max(0,+w.querySelector('#v141ai').value||0),anchorJ:Math.max(0,+w.querySelector('#v141aj').value||0),
      spliceEnabled:w.querySelector('#v141splice').value==='on',spliceClass:w.querySelector('#v141sclass').value==='A'?'A':'B',
      spliceProvided:Math.max(0,+w.querySelector('#v141slap').value||0),
      spliceBarsPercent:Math.min(100,Math.max(0,+w.querySelector('#v141spct').value||0))
    });
    designs=rcBeamDesignV141();w.querySelector('#v141tbody').innerHTML=rows();bindDetails();toast('V1.46.1.1 recalculated • Whole Model → Station Envelope → Economical RC Zoning');
  };
}

function integrated3DWorkspaceV128(){
 if(integrated3dActiveV128){closeIntegrated3DV128();return}integrated3dActiveV128=true;document.querySelector('.workspace')?.classList.add('v130-3d-workspace');const center=document.querySelector('.center');[...center.children].forEach(x=>x.classList.add('v128-hide2d'));$('frame3dBtn').textContent='▣ 2D Frame';$('frame3dBtn').classList.add('active3d');
 const host=document.createElement('div');host.id='integrated3dV128';host.innerHTML=`<div class="v128-toolbar"><b>3D Workspace — V1.46</b><button id="v128Edit3d">3D Model Data</button><button id="v130Building3d" class="v130-building-btn">▦ 3D Building</button><button id="v131Loads3d" class="v131-load-btn">⇩ 3D Loads</button><button id="v135Diaphragm">▦ Diaphragm</button><button id="v136Combos" class="btn">Σ 3D Combos</button><button id="v140Envelope" class="btn">⌁ Envelope</button><button id="v141RCBeam" class="btn">▦ RC Beam Design</button><button id="v138LoadCases" class="btn">▤ Load Cases</button><label class="v131-active-pattern">Pattern <select id="v131ActivePattern"></select></label><button id="v128Fit">Fit</button><button id="v128L">↺</button><button id="v128R">↻</button><button id="v128U">↑</button><button id="v128D">↓</button><button id="v128Fullscreen">⛶ Fullscreen Model</button><button id="v128Analyze" class="primary">▶ Analyze 3D</button><label class="v129-diagram-control">Diagram Scale <input id="v129DiagramScale" type="number" min="0.2" max="3" step="0.1" value="1"></label><label class="v129-values-control"><input id="v129Values" type="checkbox" checked> Values</label><label class="v129-scope-control">Diagram <select id="v129DiagramScope"><option value="selected">Selected Member (Display Only)</option><option value="all">Whole Model</option></select></label><label class="v129-axis-control"><input id="v129LocalAxes" type="checkbox"> Local 1-2-3</label><span id="v128TopStatus">V1.46.1.1 • Whole Model Solve • Station-Based RC Design</span></div><div class="result-modes"><span class="result-modes-label">3D Results:</span><button class="result-mode active" data-v128-view="model">Model</button><button class="result-mode" data-v128-view="deformed">Deformed</button><button class="result-mode" data-v128-view="axial">Axial N</button><button class="result-mode" data-v128-view="v2">Shear V2</button><button class="result-mode" data-v128-view="v3">Shear V3</button><button class="result-mode" data-v128-view="t">Torsion T</button><button class="result-mode" data-v128-view="m2">Moment M2</button><button class="result-mode" data-v128-view="m3">Moment M3</button></div><div class="v128-view"><canvas id="v128Canvas"></canvas><div id="v128Legend" class="diagram-legend" hidden></div></div><div class="v128-results-launch"><div><b>3D Analysis Results</b><span id="v128SolveStatus">Not analyzed</span></div><button id="v128ShowResults" class="primary" disabled>Show Analysis Results</button></div><div id="v128LocateBar" class="v128-locatebar" hidden><span id="v128LocateText">Located target</span><button id="v128BackResults">← Back to Results</button></div><div class="statusbar"><span>Integrated 3D workspace • 2D engine protected</span><span>Drag: Rotate • Wheel: Zoom</span></div><div id="v128ResultsModal" class="v128-results-modal" hidden><div class="v128-results-dialog"><div class="v128-results-head"><div><h2>3D Analysis Results</h2><span id="v128ModalStatus">Solved</span></div><button id="v128CloseResults" class="v128-close-results">✕</button></div><div class="tabs v128-modal-tabs"><button class="tab active" data-v128-tab="summary">Summary</button><button class="tab" data-v128-tab="disp">Displacement</button><button class="tab" data-v128-tab="story">Story Response</button><button class="tab" data-v128-tab="storyforces">Story Forces</button><button class="tab" data-v128-tab="react">Reactions</button><button class="tab" data-v128-tab="forces">Member End Forces</button></div><div id="v128Out" class="result-content v128-modal-out"><div class="empty">Press Analyze 3D to solve the model.</div></div><div class="v128-results-foot">Click a Node or Member row to locate and highlight it in the 3D model.</div></div></div>`;center.appendChild(host);initIntegrated3DV128(host)
}
function closeIntegrated3DV128(){if(!integrated3dActiveV128)return;integrated3dActiveV128=false;integrated3dRefreshV128=null;document.querySelector('.workspace')?.classList.remove('v130-3d-workspace');document.querySelector('#integrated3dV128')?.remove();document.querySelectorAll('.v128-hide2d').forEach(x=>x.classList.remove('v128-hide2d'));$('frame3dBtn').textContent='◈ 3D Frame';$('frame3dBtn').classList.remove('active3d');resize();render();updateUI();renderResults()}
function initIntegrated3DV128(host){
 state.model3d ||= {nodes:[],members:[],nextNode:1,nextMember:1,view:{yaw:-35,pitch:24,scale:34}};state.model3d.view ||= {yaw:-35,pitch:24,scale:34};const m3=ensure3DLoadSystemV131(),c=host.querySelector('#v128Canvas'),cx=c.getContext('2d');let drag=null,view='model',tab='summary',focusTarget=null,diagramScale=1,showDiagramValues=true,diagramScope='selected',showLocalAxes=false,dragMoved=false;m3.view.cx??=0;m3.view.cy??=0;m3.view.cz??=0;
 function proj(n,W,H,deformed=false){let x=n.x-(m3.view.cx||0),y=n.y-(m3.view.cy||0),z=n.z-(m3.view.cz||0);if(deformed&&m3.results){const d=m3.results.displacements.find(q=>q.id===n.id);if(d){const amp=100;x+=d.ux*amp;y+=d.uy*amp;z+=d.uz*amp}}const yaw=m3.view.yaw*Math.PI/180,p=m3.view.pitch*Math.PI/180,X=x*Math.cos(yaw)-y*Math.sin(yaw),Y=x*Math.sin(yaw)+y*Math.cos(yaw);return{x:W/2+X*m3.view.scale,y:H/2-(z*Math.cos(p)-Y*Math.sin(p))*m3.view.scale}}
 function draw(){const r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=Math.max(1,r.width*d);c.height=Math.max(1,r.height*d);cx.setTransform(d,0,0,d,0,0);cx.clearRect(0,0,r.width,r.height);cx.fillStyle='#fff';cx.fillRect(0,0,r.width,r.height);cx.strokeStyle='#e3e9f1';for(let k=-12;k<=12;k++){cx.beginPath();cx.moveTo(0,r.height/2+k*25);cx.lineTo(r.width,r.height/2+k*25);cx.stroke();cx.beginPath();cx.moveTo(r.width/2+k*25,0);cx.lineTo(r.width/2+k*25,r.height);cx.stroke()}const def=view==='deformed';if(def&&m3.results){cx.save();cx.setLineDash([6,5]);cx.strokeStyle='#94a3b8';for(const mm of m3.members){const a=m3.nodes.find(n=>n.id==mm.i),b=m3.nodes.find(n=>n.id==mm.j);if(!a||!b)continue;const A=proj(a,r.width,r.height),B=proj(b,r.width,r.height);cx.beginPath();cx.moveTo(A.x,A.y);cx.lineTo(B.x,B.y);cx.stroke()}cx.restore()}cx.lineWidth=3;for(const mm of m3.members){cx.strokeStyle=(focusTarget?.type==='member'&&focusTarget.id===mm.id)?'#dc2626':(def?'#2563eb':'#d97706');cx.lineWidth=(focusTarget?.type==='member'&&focusTarget.id===mm.id)?6:3;const a=m3.nodes.find(n=>n.id==mm.i),b=m3.nodes.find(n=>n.id==mm.j);if(!a||!b)continue;const A=proj(a,r.width,r.height,def),B=proj(b,r.width,r.height,def);cx.beginPath();cx.moveTo(A.x,A.y);cx.lineTo(B.x,B.y);cx.stroke();cx.fillStyle='#334155';cx.font='11px Arial';cx.fillText('M'+mm.id,(A.x+B.x)/2+5,(A.y+B.y)/2-5)}for(const n of m3.nodes){const q=proj(n,r.width,r.height,def);const hit=focusTarget?.type==='node'&&focusTarget.id===n.id;cx.fillStyle=hit?'#dc2626':'#1d4ed8';cx.beginPath();cx.arc(q.x,q.y,hit?9:5,0,Math.PI*2);cx.fill();if(hit){cx.strokeStyle='#fff';cx.lineWidth=2;cx.stroke()}cx.fillStyle='#111827';cx.fillText(String(n.id),q.x+7,q.y-7);const L=n.load||{};const forces=[['fx','FX',[1,0,0]],['fy','FY',[0,1,0]],['fz','FZ',[0,0,1]]];let labelRow=0;for(const [key,label,axis] of forces){const val=Number(L[key])||0;if(!val)continue;const sg=Math.sign(val),world={x:n.x+axis[0]*sg,y:n.y+axis[1]*sg,z:n.z+axis[2]*sg},tip=q,dir=proj(world,r.width,r.height,def),vx=dir.x-tip.x,vy=dir.y-tip.y,len=Math.hypot(vx,vy)||1,ux=vx/len,uy=vy/len,alen=34,tail={x:tip.x-ux*alen,y:tip.y-uy*alen};cx.save();cx.strokeStyle='#dc2626';cx.fillStyle='#dc2626';cx.lineWidth=2.4;cx.beginPath();cx.moveTo(tail.x,tail.y);cx.lineTo(tip.x,tip.y);cx.stroke();const ah=8,px=-uy,py=ux;cx.beginPath();cx.moveTo(tip.x,tip.y);cx.lineTo(tip.x-ux*ah+px*4,tip.y-uy*ah+py*4);cx.lineTo(tip.x-ux*ah-px*4,tip.y-uy*ah-py*4);cx.closePath();cx.fill();cx.font='bold 11px Arial';cx.fillText(label+' '+val+' kN',tail.x+6,tail.y-6-labelRow*13);cx.restore();labelRow++}const moments=[];for(const key of ['mx','my','mz'])if(Number(L[key]))moments.push(key[0].toUpperCase()+key[1]+' '+Number(L[key])+' kN·m');if(moments.length){cx.save();cx.fillStyle='#a21caf';cx.font='bold 10.5px Arial';cx.fillText(moments.join(' • '),q.x+10,q.y+18);cx.restore()}}drawMemberLoadsV131();drawMemberLocalAxes();drawForceDiagrams();drawAxisTriad();drawLegend()}

 function drawMemberLoadsV131(){
  if(!m3.showLoads)return;const pat=m3.activeLoadPattern||'DL',r=c.getBoundingClientRect();
  const arrow=(p3,axis,sg,len=20,col='#7c3aed')=>{const P=proj(p3,r.width,r.height,false),q3={x:p3.x+axis[0]*sg,y:p3.y+axis[1]*sg,z:p3.z+axis[2]*sg},Q=proj(q3,r.width,r.height,false),vx=Q.x-P.x,vy=Q.y-P.y,ll=Math.hypot(vx,vy)||1,ux=vx/ll,uy=vy/ll,tail={x:P.x-ux*len,y:P.y-uy*len};cx.save();cx.strokeStyle=col;cx.fillStyle=col;cx.lineWidth=1.7;cx.beginPath();cx.moveTo(tail.x,tail.y);cx.lineTo(P.x,P.y);cx.stroke();cx.beginPath();cx.moveTo(P.x,P.y);cx.lineTo(P.x-ux*6-uy*3,P.y-uy*6+ux*3);cx.lineTo(P.x-ux*6+uy*3,P.y-uy*6-ux*3);cx.closePath();cx.fill();cx.restore();return P};
  for(const mm of m3.members){const loads=mm.loads3d?.[pat]||[];if(!loads.length)continue;const a=m3.nodes.find(n=>n.id===mm.i),b=m3.nodes.find(n=>n.id===mm.j);if(!a||!b)continue;const A=proj(a,r.width,r.height,false),B=proj(b,r.width,r.height,false),axes=v128Axes(a,b);
   for(const ld of loads){
    if(ld.type==='UDL'){
      const w=Number(ld.w)||0;if(!w)continue;const axis=ld.direction==='GX'?[1,0,0]:ld.direction==='GY'?[0,1,0]:[0,0,1],sg=Math.sign(w);for(const t of [.15,.32,.49,.66,.83])arrow({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},axis,sg,20);
      cx.save();cx.fillStyle='#6d28d9';cx.font='bold 10.5px Arial';cx.fillText(`${pat} UDL ${w.toFixed(2)} kN/m`,(A.x+B.x)/2+8,(A.y+B.y)/2+16);cx.restore();
    }else if(ld.type==='POINT'){
      const Pn=Number(ld.P)||0,t=clamp01V145(ld.r);if(!Pn)continue;const axis=ld.direction==='GX'?[1,0,0]:ld.direction==='GY'?[0,1,0]:[0,0,1],p3={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},P=arrow(p3,axis,Math.sign(Pn),32,'#dc2626');cx.save();cx.fillStyle='#b91c1c';cx.font='bold 10.5px Arial';cx.fillText(`${pat} P ${Pn.toFixed(2)} kN @ ${(t*100).toFixed(0)}%`,P.x+8,P.y-10);cx.restore();
    }else if(ld.type==='TRAP'){
      const a0=clamp01V145(ld.a),b0=Math.max(a0,clamp01V145(ld.b)),w1=Number(ld.w1)||0,w2=Number(ld.w2)||0;if(b0<=a0||(w1===0&&w2===0))continue;const axis=ld.direction==='GX'?[1,0,0]:ld.direction==='GY'?[0,1,0]:[0,0,1],mx=Math.max(1,Math.abs(w1),Math.abs(w2));for(let k=0;k<6;k++){const u=k/5,t=a0+(b0-a0)*u,w=w1+(w2-w1)*u;if(!w)continue;arrow({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},axis,Math.sign(w),14+18*Math.abs(w)/mx,'#0f766e')}cx.save();cx.fillStyle='#0f766e';cx.font='bold 10.5px Arial';cx.fillText(`${pat} TRAP ${w1.toFixed(1)}→${w2.toFixed(1)} kN/m`,(A.x+B.x)/2+8,(A.y+B.y)/2+30);cx.restore();
    }else if(ld.type==='MOMENT'){
      const M=Number(ld.M)||0,t=clamp01V145(ld.r);if(!M)continue;const p3={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},P=proj(p3,r.width,r.height,false);cx.save();cx.strokeStyle='#a21caf';cx.fillStyle='#a21caf';cx.lineWidth=2;cx.beginPath();cx.arc(P.x,P.y,13,Math.PI*.2,Math.PI*1.75, M<0);cx.stroke();const ang=M<0?Math.PI*.2:Math.PI*1.75,hx=P.x+13*Math.cos(ang),hy=P.y+13*Math.sin(ang);cx.beginPath();cx.moveTo(hx,hy);cx.lineTo(hx-6,hy-3);cx.lineTo(hx-2,hy+5);cx.closePath();cx.fill();cx.font='bold 10.5px Arial';cx.fillText(`${pat} ${ld.axis||'L3'} M ${M.toFixed(2)} kN·m`,P.x+18,P.y-12);cx.restore();
    }
   }
  }
 }

 function drawMemberLocalAxes(){
  if(!showLocalAxes)return;
  const r=c.getBoundingClientRect();
  const targets=(focusTarget?.type==='member')?m3.members.filter(mm=>mm.id===focusTarget.id):m3.members;
  for(const mm of targets){
   const a=m3.nodes.find(n=>n.id===mm.i),b=m3.nodes.find(n=>n.id===mm.j);if(!a||!b)continue;
   const axes=v128Axes(a,b),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2},M=proj(mid,r.width,r.height);
   const defs=[['1',axes[0],'#111827'],['2',axes[1],'#2563eb'],['3',axes[2],'#16a34a']];
   for(const [lab,ax,col] of defs){const w={x:mid.x+ax[0],y:mid.y+ax[1],z:mid.z+ax[2]},P=proj(w,r.width,r.height),vx=P.x-M.x,vy=P.y-M.y,L=Math.hypot(vx,vy)||1,ux=vx/L,uy=vy/L,ex=M.x+ux*24,ey=M.y+uy*24;cx.save();cx.strokeStyle=col;cx.fillStyle=col;cx.lineWidth=1.8;cx.beginPath();cx.moveTo(M.x,M.y);cx.lineTo(ex,ey);cx.stroke();cx.font='bold 10px Arial';cx.fillText(lab,ex+3,ey+3);cx.restore()}
  }
 }
 function nearestMemberAt(px,py){
  const r=c.getBoundingClientRect();let best=null,bestD=14;
  for(const mm of m3.members){const a=m3.nodes.find(n=>n.id===mm.i),b=m3.nodes.find(n=>n.id===mm.j);if(!a||!b)continue;const A=proj(a,r.width,r.height,view==='deformed'),B=proj(b,r.width,r.height,view==='deformed');const vx=B.x-A.x,vy=B.y-A.y,l2=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((px-A.x)*vx+(py-A.y)*vy)/l2)),qx=A.x+t*vx,qy=A.y+t*vy,d=Math.hypot(px-qx,py-qy);if(d<bestD){bestD=d;best=mm}}
  return best;
 }
 function localUDLComponentsV1311(mm,a,b){
  const pat=m3.activeLoadPattern||'DL',loads=mm.loads3d?.[pat]||[],R=v128Axes(a,b),out={qx:0,qy:0,qz:0};
  for(const ld of loads){if(ld.type!=='UDL')continue;const w=Number(ld.w)||0;if(!w)continue;const gv=ld.direction==='GX'?[w,0,0]:ld.direction==='GY'?[0,w,0]:[0,0,w],qq=R.map(rr=>rr[0]*gv[0]+rr[1]*gv[1]+rr[2]*gv[2]);out.qx+=qq[0];out.qy+=qq[1];out.qz+=qq[2]}
  return out;
 }
 function diagramSamplesV1311(f,mm,a,b,q){
  const L=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)||1,vi=Number(f.local[q[0]])||0,vj=-(Number(f.local[q[1]])||0),loads=localUDLComponentsV1311(mm,a,b),N=(view==='m2'||view==='m3')?31:11,s=[];
  for(let k=0;k<N;k++){const t=k/(N-1),x=t*L;let val=vi+(vj-vi)*t;
   // V1.31.1: exact quadratic shape for a constant UDL while preserving solved member-end values.
   // Local qy bends about local-3; local qz bends about local-2 with the opposite sign convention.
   if(view==='m3')val+=(loads.qy*L*L/2)*t*(1-t);
   else if(view==='m2')val+=(-loads.qz*L*L/2)*t*(1-t);
   s.push({t,x,val});
  }
  return s;
 }
 function drawForceDiagrams(){
  if(!m3.results||view==='model'||view==='deformed')return;
  const map={axial:[0,6,'#0f766e','kN','ey'],v2:[1,7,'#2563eb','kN','ez'],v3:[2,8,'#7c3aed','kN','ey'],t:[3,9,'#a21caf','kN·m','ey'],m2:[4,10,'#dc2626','kN·m','ez'],m3:[5,11,'#ea580c','kN·m','ey']},q=map[view];if(!q)return;
  // V1.46.1: selection is a DISPLAY FILTER ONLY. The solver result is always the
  // complete Whole Model solution. Keep diagram scaling referenced to the Whole Model
  // so selecting M32 cannot look like a separate/re-normalized member analysis.
  const allForceRows=m3.results.memberForces||[];
  const forceRows=(diagramScope==='selected'&&focusTarget?.type==='member')?allForceRows.filter(f=>f.id===focusTarget.id):allForceRows;
  let maxAbs=1e-9;
  for(const f of allForceRows){const mm=m3.members.find(x=>x.id===f.id),a=mm&&m3.nodes.find(n=>n.id===mm.i),b=mm&&m3.nodes.find(n=>n.id===mm.j);if(!a||!b)continue;const samples=diagramSamplesV1311(f,mm,a,b,q);for(const sm of samples)maxAbs=Math.max(maxAbs,Math.abs(sm.val))}
  const sampleCache=[];
  for(const f of forceRows){const mm=m3.members.find(x=>x.id===f.id),a=mm&&m3.nodes.find(n=>n.id===mm.i),b=mm&&m3.nodes.find(n=>n.id===mm.j);if(!a||!b)continue;sampleCache.push({f,mm,a,b,samples:diagramSamplesV1311(f,mm,a,b,q)})}
  const r=c.getBoundingClientRect(),amp=52*Math.max(.2,Math.min(3,Number(diagramScale)||1));
  for(const row of sampleCache){
   const {f,mm,a,b,samples}=row,axes=v128Axes(a,b),axis=q[4]==='ez'?axes[2]:axes[1],basePts=[],curvePts=[];
   for(const sm of samples){const w={x:a.x+(b.x-a.x)*sm.t,y:a.y+(b.y-a.y)*sm.t,z:a.z+(b.z-a.z)*sm.t},B0=proj(w,r.width,r.height),wa={x:w.x+axis[0],y:w.y+axis[1],z:w.z+axis[2]},BA=proj(wa,r.width,r.height),vx=BA.x-B0.x,vy=BA.y-B0.y,ll=Math.hypot(vx,vy)||1,nx=vx/ll,ny=vy/ll,off=amp*sm.val/maxAbs;basePts.push(B0);curvePts.push({x:B0.x+nx*off,y:B0.y+ny*off,val:sm.val,t:sm.t})}
   cx.save();cx.fillStyle=q[2]+'28';cx.strokeStyle=q[2];cx.lineWidth=(focusTarget?.type==='member'&&focusTarget.id===f.id)?4:2;
   cx.beginPath();cx.moveTo(basePts[0].x,basePts[0].y);for(const p of curvePts)cx.lineTo(p.x,p.y);for(let k=basePts.length-1;k>=0;k--)cx.lineTo(basePts[k].x,basePts[k].y);cx.closePath();cx.fill();
   cx.beginPath();cx.moveTo(curvePts[0].x,curvePts[0].y);for(let k=1;k<curvePts.length;k++)cx.lineTo(curvePts[k].x,curvePts[k].y);cx.stroke();
   cx.setLineDash([3,3]);cx.lineWidth=1;for(const k of [0,basePts.length-1]){cx.beginPath();cx.moveTo(basePts[k].x,basePts[k].y);cx.lineTo(curvePts[k].x,curvePts[k].y);cx.stroke()}cx.setLineDash([]);
   if(showDiagramValues){cx.fillStyle=q[2];cx.font='bold 10.5px Arial';if(view==='m2'||view==='m3'){let mn=curvePts[0],mx=curvePts[0];for(const p of curvePts){if(p.val<mn.val)mn=p;if(p.val>mx.val)mx=p}const labels=Math.abs(mx.val-mn.val)<1e-9?[mx]:[mn,mx];for(const p of labels)cx.fillText(p.val.toFixed(2),p.x+4,p.y-4)}else{const p0=curvePts[0],p1=curvePts[curvePts.length-1];cx.fillText(p0.val.toFixed(2),p0.x+4,p0.y-4);cx.fillText(p1.val.toFixed(2),p1.x+4,p1.y-4)}}cx.restore();
  }
 }
 function drawAxisTriad(){const r=c.getBoundingClientRect(),o={x:58,y:r.height-54},base={x:0,y:0,z:0},axes=[['X',{x:1,y:0,z:0},'#dc2626'],['Y',{x:0,y:1,z:0},'#16a34a'],['Z',{x:0,y:0,z:1},'#2563eb']];const p0=proj(base,120,120);for(const [name,w,col] of axes){const p1=proj(w,120,120),vx=p1.x-p0.x,vy=p1.y-p0.y,l=Math.hypot(vx,vy)||1,ux=vx/l,uy=vy/l,ex=o.x+ux*28,ey=o.y+uy*28;cx.save();cx.strokeStyle=col;cx.fillStyle=col;cx.lineWidth=2;cx.beginPath();cx.moveTo(o.x,o.y);cx.lineTo(ex,ey);cx.stroke();cx.font='bold 11px Arial';cx.fillText(name,ex+3,ey+3);cx.restore()}}
 function drawLegend(){
  const leg=host.querySelector('#v128Legend');
  if(!m3.results||view==='model'||view==='deformed'){leg.hidden=true;return}
  const map={axial:[0,6,'Axial N','kN'],v2:[1,7,'Shear V2','kN'],v3:[2,8,'Shear V3','kN'],t:[3,9,'Torsion T','kN·m'],m2:[4,10,'Moment M2','kN·m'],m3:[5,11,'Moment M3','kN·m']},q=map[view];
  const allRows=m3.results.memberForces||[];
  const selectedId=(diagramScope==='selected'&&focusTarget?.type==='member')?focusTarget.id:null;
  const rows=selectedId!=null?allRows.filter(f=>f.id===selectedId):allRows;
  const vals=[],wholeVals=[];
  const collect=(src,out)=>{for(const f of src){const mm=m3.members.find(x=>x.id===f.id),a=mm&&m3.nodes.find(n=>n.id===mm.i),b=mm&&m3.nodes.find(n=>n.id===mm.j);if(a&&b)out.push(...diagramSamplesV1311(f,mm,a,b,q).map(s=>s.val))}};
  collect(rows,vals); collect(allRows,wholeVals);
  if(!vals.length)vals.push(0); if(!wholeVals.length)wholeVals.push(0);
  const display=selectedId!=null?'Selected Member M'+selectedId:'Whole Model';
  leg.hidden=false;
  leg.innerHTML='<b>'+q[2]+'</b>'+
   '<div class="legend-row"><span>Analysis Source</span><strong>WHOLE MODEL SOLUTION</strong></div>'+
   '<div class="legend-row"><span>Display Filter</span><strong>'+display+'</strong></div>'+
   '<div class="legend-row"><span>Displayed Min</span><strong>'+Math.min(...vals).toFixed(3)+' '+q[3]+'</strong></div>'+
   '<div class="legend-row"><span>Displayed Max</span><strong>'+Math.max(...vals).toFixed(3)+' '+q[3]+'</strong></div>'+
   '<div class="legend-row"><span>Whole Model Scale Max</span><strong>'+Math.max(...wholeVals.map(v=>Math.abs(v))).toFixed(3)+' '+q[3]+'</strong></div>'+
   '<small>V1.46.1 • Selected Member only hides other diagrams; it never re-solves or isolates the member. Forces include stiffness/load redistribution from every member in the solved model.</small>'
 }

 function fit(){if(!m3.nodes.length){m3.view.scale=34;m3.view.cx=m3.view.cy=m3.view.cz=0;draw();return}const xs=m3.nodes.map(n=>n.x),ys=m3.nodes.map(n=>n.y),zs=m3.nodes.map(n=>n.z);m3.view.cx=(Math.min(...xs)+Math.max(...xs))/2;m3.view.cy=(Math.min(...ys)+Math.max(...ys))/2;m3.view.cz=(Math.min(...zs)+Math.max(...zs))/2;const span=Math.max(1,Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),Math.max(...zs)-Math.min(...zs));m3.view.scale=Math.max(12,Math.min(75,300/span));draw()}
 integrated3dRefreshV128=(doFit=false)=>{if(doFit)fit();else draw();renderTab()};
 function renderTab(){const out=host.querySelector('#v128Out'),res=m3.results;if(!res){out.innerHTML='<div class="empty">Press Analyze 3D to solve the model.</div>';return}if(tab==='summary'){const max=Math.max(...res.displacements.map(d=>Math.hypot(d.ux,d.uy,d.uz)));out.innerHTML='<div class="v128-summary"><div><b>Nodes</b><strong>'+m3.nodes.length+'</strong></div><div><b>Members</b><strong>'+m3.members.length+'</strong></div><div><b>Total DOF</b><strong>'+(m3.nodes.length*6)+'</strong></div><div><b>Max Translation</b><strong>'+(max*1000).toFixed(4)+' mm</strong></div></div>'+analysisStatusHtmlV1371(res)+equilibriumSummaryHtmlV132(res.equilibrium,res.loadPattern)+diaphragmSummaryHtmlV135(res);return}if(tab==='story'){out.innerHTML=storyResponseHtmlV133(res.storyResponse||storyResponseV133(m3,res));return}if(tab==='storyforces'){out.innerHTML=storyForcesHtmlV134(res.storyForces,res.loadPattern);return}if(tab==='disp'){out.innerHTML='<table><tr><th>Node</th><th>Ux mm</th><th>Uy mm</th><th>Uz mm</th><th>Rx</th><th>Ry</th><th>Rz</th></tr>'+res.displacements.map(d=>'<tr class="v128-result-row" data-node-id="'+d.id+'"><td><button class="v128-link" data-node-id="'+d.id+'">N'+d.id+'</button></td><td>'+(d.ux*1000).toFixed(5)+'</td><td>'+(d.uy*1000).toFixed(5)+'</td><td>'+(d.uz*1000).toFixed(5)+'</td><td>'+d.rx.toExponential(3)+'</td><td>'+d.ry.toExponential(3)+'</td><td>'+d.rz.toExponential(3)+'</td></tr>').join('')+'</table>';return}if(tab==='react'){out.innerHTML='<table><tr><th>Node</th><th>Fx</th><th>Fy</th><th>Fz</th><th>Mx</th><th>My</th><th>Mz</th></tr>'+res.reactions.map(d=>'<tr class="v128-result-row" data-node-id="'+d.id+'"><td><button class="v128-link" data-node-id="'+d.id+'">N'+d.id+'</button></td><td>'+d.fx.toFixed(4)+'</td><td>'+d.fy.toFixed(4)+'</td><td>'+d.fz.toFixed(4)+'</td><td>'+d.mx.toFixed(4)+'</td><td>'+d.my.toFixed(4)+'</td><td>'+d.mz.toFixed(4)+'</td></tr>').join('')+'</table>';return}out.innerHTML='<table><tr><th>M</th><th>N i</th><th>V2 i</th><th>V3 i</th><th>T i</th><th>M2 i</th><th>M3 i</th><th>N j</th><th>V2 j</th><th>V3 j</th><th>T j</th><th>M2 j</th><th>M3 j</th></tr>'+res.memberForces.map(f=>'<tr class="v128-result-row" data-member-id="'+f.id+'"><td><button class="v128-link" data-member-id="'+f.id+'">M'+f.id+'</button></td>'+f.local.map(v=>'<td>'+v.toFixed(3)+'</td>').join('')+'</tr>').join('')+'</table>'}
 function bindResultRows(){host.querySelectorAll('[data-node-id]').forEach(el=>el.onclick=()=>locateResult('node',Number(el.dataset.nodeId)));host.querySelectorAll('[data-member-id]').forEach(el=>el.onclick=()=>locateResult('member',Number(el.dataset.memberId)))}
 function showResults(){
  const res=m3.results;
  if(!res)return;
  host.querySelector('#v128ResultsModal').hidden=false;
  const source=res.isLoadCase?'Case':(res.isCombination?'Combo':'Pattern');
  host.querySelector('#v128ModalStatus').textContent=(res.noAppliedLoad?'Solved • NO LOAD • ':'Solved • ')+(m3.nodes.length*6)+' DOF • '+source+' '+res.loadPattern;
  renderTab();
  setTimeout(bindResultRows,0);
}
 function hideResults(){host.querySelector('#v128ResultsModal').hidden=true}
 function locateResult(type,id){focusTarget={type,id};if(type==='member'){diagramScope='selected';const sc=host.querySelector('#v129DiagramScope');if(sc)sc.value='selected'}if(type==='node'){const n=m3.nodes.find(x=>x.id===id);if(n){m3.view.cx=n.x;m3.view.cy=n.y;m3.view.cz=n.z;m3.view.scale=Math.max(m3.view.scale,65)}}else{const mm=m3.members.find(x=>x.id===id),a=mm&&m3.nodes.find(n=>n.id===mm.i),b=mm&&m3.nodes.find(n=>n.id===mm.j);if(a&&b){m3.view.cx=(a.x+b.x)/2;m3.view.cy=(a.y+b.y)/2;m3.view.cz=(a.z+b.z)/2;const L=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)||1;m3.view.scale=Math.max(35,Math.min(110,240/L))}}hideResults();host.querySelector('#v128LocateText').textContent=(type==='node'?'Node N'+id+' located':'Member M'+id+' display filter • Whole Model solution');host.querySelector('#v128LocateBar').hidden=false;draw()}
 function analyze(){try{const res=solve3DV128();mark3DAnalysisFreshV1451(res);m3.activeResultType='Pattern';m3.activeResultName=res.loadPattern;const audit=res.loadAudit||patternLoadAuditV1372(m3,res.loadPattern);host.querySelector('#v128SolveStatus').textContent=(res.noAppliedLoad?'Solved • NO LOAD • ':'Solved • ')+(m3.nodes.length*6)+' DOF • '+res.loadPattern;host.querySelector('#v128ShowResults').disabled=false;host.querySelector('#v128ModalStatus').textContent=(res.noAppliedLoad?'Solved • NO LOAD • ':'Solved • ')+(m3.nodes.length*6)+' DOF • '+res.loadPattern;focusTarget=m3.members.length?{type:'member',id:m3.members[0].id}:null;diagramScope='selected';host.querySelector('#v129DiagramScope').value='selected';if(focusTarget){host.querySelector('#v128LocateText').textContent='Member M'+focusTarget.id+' selected for diagram';host.querySelector('#v128LocateBar').hidden=false}else host.querySelector('#v128LocateBar').hidden=true;renderTab();draw();toast('V1.46.1 solved Whole Model • member selection changes display only')}catch(e){alert(e.message)}}
 host.querySelector('#v128Edit3d').onclick=frame3dCenterV127;host.querySelector('#v130Building3d').onclick=building3dCenterV130;host.querySelector('#v131Loads3d').onclick=loadSystem3dCenterV131;host.querySelector('#v135Diaphragm').onclick=diaphragmCenterV135;host.querySelector('#v136Combos').onclick=loadCombinationCenterV139;host.querySelector('#v140Envelope').onclick=envelopeCenterV140;host.querySelector('#v141RCBeam').onclick=rcBeamDesignCenterV141;host.querySelector('#v138LoadCases').onclick=loadCasesCenterV138;
const d135=ensureDiaphragmsV135(),a135=Object.values(d135.stories||{}).filter(Boolean).length;
host.querySelector('#v135Diaphragm').textContent=d135.enabled?`▦ Diaphragm ON (${a135})`:'▦ Diaphragm OFF';
host.querySelector('#v135Diaphragm').classList.toggle('active3d',!!d135.enabled);
const patSel=host.querySelector('#v131ActivePattern');const syncPatterns=()=>{patSel.innerHTML=m3.loadPatterns.map(x=>`<option value="${x.id}">${x.id}</option>`).join('');patSel.value=m3.activeLoadPattern||m3.loadPatterns[0]?.id||'DL'};syncPatterns();patSel.onchange=e=>{m3.activeLoadPattern=e.target.value;m3.results=null;invalidate3DDesignDerivedV1451('ACTIVE LOAD PATTERN CHANGED');host.querySelector('#v128SolveStatus').textContent='Not analyzed • '+m3.activeLoadPattern;host.querySelector('#v128ShowResults').disabled=true;draw()};host.querySelector('#v129DiagramScale').oninput=e=>{diagramScale=Number(e.target.value)||1;draw()};host.querySelector('#v129Values').onchange=e=>{showDiagramValues=!!e.target.checked;draw()};host.querySelector('#v129DiagramScope').onchange=e=>{diagramScope=e.target.value;draw()};host.querySelector('#v129LocalAxes').onchange=e=>{showLocalAxes=!!e.target.checked;draw()};host.querySelector('#v128Fit').onclick=fit;host.querySelector('#v128L').onclick=()=>{m3.view.yaw-=10;draw()};host.querySelector('#v128R').onclick=()=>{m3.view.yaw+=10;draw()};host.querySelector('#v128U').onclick=()=>{m3.view.pitch=Math.min(80,m3.view.pitch+8);draw()};host.querySelector('#v128D').onclick=()=>{m3.view.pitch=Math.max(-80,m3.view.pitch-8);draw()};host.querySelector('#v128Fullscreen').onclick=()=>{const on=host.classList.toggle('v128-fullscreen-model');host.querySelector('#v128Fullscreen').textContent=on?'✕ Exit Fullscreen':'⛶ Fullscreen Model';setTimeout(()=>{draw();if(on)fit()},30)};host.querySelector('#v128Analyze').onclick=analyze;host.querySelector('#v128ShowResults').onclick=showResults;host.querySelector('#v128CloseResults').onclick=hideResults;host.querySelector('#v128BackResults').onclick=showResults;host.querySelector('#v128ResultsModal').onclick=e=>{if(e.target===host.querySelector('#v128ResultsModal'))hideResults()};host.querySelectorAll('[data-v128-view]').forEach(b=>b.onclick=()=>{view=b.dataset.v128View;host.querySelectorAll('[data-v128-view]').forEach(x=>x.classList.toggle('active',x===b));draw()});host.querySelectorAll('[data-v128-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.v128Tab;host.querySelectorAll('[data-v128-tab]').forEach(x=>x.classList.toggle('active',x===b));renderTab();setTimeout(bindResultRows,0)});c.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,yaw:m3.view.yaw,pitch:m3.view.pitch};dragMoved=false};c.onpointermove=e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4)dragMoved=true;m3.view.yaw=drag.yaw+(e.clientX-drag.x)*.35;m3.view.pitch=Math.max(-80,Math.min(80,drag.pitch-(e.clientY-drag.y)*.25));draw()};c.onpointerup=e=>{if(drag&&!dragMoved){const rr=c.getBoundingClientRect(),mm=nearestMemberAt(e.clientX-rr.left,e.clientY-rr.top);if(mm){focusTarget={type:'member',id:mm.id};diagramScope='selected';host.querySelector('#v129DiagramScope').value='selected';host.querySelector('#v128LocateText').textContent='Member M'+mm.id+' display filter • Whole Model solution';host.querySelector('#v128LocateBar').hidden=false;draw()}}drag=null};c.onpointerleave=()=>drag=null;c.onwheel=e=>{e.preventDefault();m3.view.scale=Math.max(5,Math.min(130,m3.view.scale*(e.deltaY>0?.9:1.1)));draw()};draw();setTimeout(fit,0)
}

$('frame3dBtn').onclick=integrated3DWorkspaceV128;

updateEngineeringSelectors();migrateLoads();resize();updateUI();renderResults();updateResultModeButtons();setResultView('model',false);setTool('select');syncScaleUI();initResultsWorkspaceV113();toast('V1.41.6.1 — Rebar Vertical Fit Safety + Drawing Scale Fix');
})();
