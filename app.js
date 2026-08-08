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
const state = {nodes:[],members:[],materials:JSON.parse(JSON.stringify(defaultMaterials)),sections:JSON.parse(JSON.stringify(defaultSections)),loadCases:JSON.parse(JSON.stringify(defaultLoadCases)),loadCombinations:JSON.parse(JSON.stringify(defaultLoadCombinations)),activeLoadCase:'DL',activeAnalysis:'CASE:DL', tool:'select', selected:null, memberStart:null, nextNode:1,nextMember:1, view:{scale:55,ox:120,oy:500}, dragging:null, panning:null, hover:null, results:null, resultTab:'summary', diagramScale:1, autoDiagramScale:true, showLabels:true,showLoadLabels:true,modelLoadLabels:true,resultsByAnalysis:new Map(),multiSelectedMemberIds:new Set(),boxSelect:null,building:{stories:0,bays:0,storyHeights:[],bayWidths:[],levels:[],grids:[]},layers:{members:true,nodes:true,loads:true,supports:true,labels:true}};
const LIBRARY_STORAGE_KEY='sapudom-engineering-libraries-v1';
function mergeUniqueById(...lists){const map=new Map();for(const list of lists)for(const item of (list||[]))if(item&&item.id)map.set(item.id,item);return [...map.values()];}
function readPersistentLibraries(){try{return JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY)||'{}')}catch{return {}}}
function persistLibraries(){try{localStorage.setItem(LIBRARY_STORAGE_KEY,JSON.stringify({materials:state.materials,sections:state.sections,updatedAt:new Date().toISOString()}))}catch{}}
function mergePersistentLibraries(){const saved=readPersistentLibraries();state.materials=mergeUniqueById(defaultMaterials,saved.materials,state.materials);state.sections=mergeUniqueById(defaultSections,saved.sections,state.sections);persistLibraries();}
mergePersistentLibraries();
let undoStack=[], redoStack=[];
function cloneModel(){return JSON.parse(JSON.stringify({nodes:state.nodes,members:state.members,materials:state.materials,sections:state.sections,loadCases:state.loadCases,loadCombinations:state.loadCombinations,activeLoadCase:state.activeLoadCase,activeAnalysis:state.activeAnalysis,nextNode:state.nextNode,nextMember:state.nextMember,view:state.view,building:state.building,layers:state.layers}));}
function projectSnapshot(){return {version:'1.16.1-fix',projectName:$('projectName')?.value||'Untitled Frame',units:$('units')?.value||'kN - m',...cloneModel()}}
function countGeneratedInModel(model,source=null){let n=0;for(const m of model?.members||[]){for(const arr of Object.values(m.loads||{})){if(!Array.isArray(arr))continue;for(const l of arr)if(l&&(l.source||l.generatedBy)&&(source==null||l.source===source))n++}}return n}
function snapshotSummary(model){return {members:(model?.members||[]).length,selfWeight:countGeneratedInModel(model,'SELF_WEIGHT'),generated:countGeneratedInModel(model)}}
function pushHistory(){undoStack.push(cloneModel()); if(undoStack.length>100)undoStack.shift(); redoStack=[]; updateButtons();}
function refreshLayoutAfterLoad(){window.scrollTo(0,0);const center=document.querySelector('.center');if(center)center.scrollTop=0;requestAnimationFrame(()=>requestAnimationFrame(()=>{resize();render();}));}
function restore(s){state.nodes=s.nodes||[];state.members=s.members||[];state.materials=s.materials||JSON.parse(JSON.stringify(defaultMaterials));state.sections=s.sections||JSON.parse(JSON.stringify(defaultSections));mergePersistentLibraries();state.loadCases=s.loadCases||JSON.parse(JSON.stringify(defaultLoadCases));state.loadCombinations=s.loadCombinations||JSON.parse(JSON.stringify(defaultLoadCombinations));state.activeLoadCase=s.activeLoadCase||state.loadCases[0]?.id||'DL';state.activeAnalysis=s.activeAnalysis||('CASE:'+state.activeLoadCase);migrateLoads();migrateMemberReleases();state.nextNode=s.nextNode||1;state.nextMember=s.nextMember||1;state.view=s.view||state.view;state.building=s.building||{stories:0,bays:0,storyHeights:[],bayWidths:[],levels:[],grids:[]};state.layers=s.layers||{members:true,nodes:true,loads:true,supports:true,labels:true};state.selected=null;state.multiSelectedMemberIds=new Set();state.boxSelect=null;state.memberStart=null;state.results=null;state.resultsByAnalysis=new Map();setResultView('model',false);updateResultModeButtons();render();updateUI();renderResults();refreshLayoutAfterLoad();}
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
  m.E=Number(mat.E);m.A=Number(sec.A);m.I=Number(sec.I);
  m.Iy=Number(sec.Iy||0);m.J=Number(sec.J||0);m.weight=Number(sec.weight||0);
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
 <section><h3>Assign Properties</h3><label>Material<select id="assignMaterial">${state.materials.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></label><label>Section<select id="assignSection">${state.sections.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select></label><div class="assign-preview" id="assignPreview"></div><button class="primary" id="assignApply">Apply to Selected (${ids.length})</button><p class="assign-tip">Tip: Shift/Cmd + click ເພື່ອເລືອກຫຼາຍ Member. ລາກກອບພື້ນທີ່ວ່າງເພື່ອ Box Select.</p></section></div>`;
 const mat=body.querySelector('#assignMaterial'),sec=body.querySelector('#assignSection'),preview=body.querySelector('#assignPreview');
 const selectedMembers=ids.map(id=>state.members.find(m=>m.id===id)).filter(Boolean);
 const common=(key)=>selectedMembers.length&&selectedMembers.every(m=>m[key]===selectedMembers[0][key])?selectedMembers[0][key]:'';
 const commonSec=common('sectionId'),commonMat=common('materialId');
 if(commonSec&&state.sections.some(x=>x.id===commonSec))sec.value=commonSec;
 if(commonMat&&state.materials.some(x=>x.id===commonMat))mat.value=commonMat;
 const updatePreview=()=>{const x=state.sections.find(q=>q.id===sec.value),m=state.materials.find(q=>q.id===mat.value);if(x&&m)preview.innerHTML=`<b>${m.name} + ${x.name}</b><span>E=${Number(m.E).toExponential(3)} kN/m²</span><span>A=${Number(x.A).toExponential(3)} m²</span><span>I=${Number(x.I).toExponential(3)} m⁴</span>`};
 sec.onchange=()=>{const x=state.sections.find(q=>q.id===sec.value);if(x&&state.materials.some(m=>m.id===x.materialId))mat.value=x.materialId;updatePreview()};mat.onchange=updatePreview;updatePreview();
 body.querySelectorAll('[data-select]').forEach(b=>b.onclick=()=>{const mode=b.dataset.select;if(mode==='clear')selectMembers([]);else if(mode==='all')selectMembers(state.members.map(m=>m.id));else if(mode==='similar'){const base=state.members.find(m=>m.id===state.selected?.id);if(!base)return toast('ເລືອກ Member ຕົວຢ່າງກ່ອນ');selectMembers(state.members.filter(m=>m.sectionId===base.sectionId&&m.materialId===base.materialId).map(m=>m.id));}else selectMembers(state.members.filter(m=>memberOrientation(m)===mode).map(m=>m.id));renderBody()});
 body.querySelector('#selectStory').onclick=()=>{const y=Number(body.querySelector('#storySelect').value);if(!Number.isFinite(y))return;const tol=.001;selectMembers(state.members.filter(m=>{const a=state.nodes.find(n=>n.id===m.i),b=state.nodes.find(n=>n.id===m.j);return a&&b&&(Math.abs(a.y-y)<tol||Math.abs(b.y-y)<tol)}).map(m=>m.id));renderBody()};
 body.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{const [matId,secId]=b.dataset.group.split('|');selectMembers(state.members.filter(m=>m.materialId===matId&&m.sectionId===secId).map(m=>m.id));renderBody()});
 body.querySelector('#assignApply').onclick=()=>{const count=applyPropertyToMembers(selectedMemberIds(),sec.value,mat.value);if(count)renderBody()};
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
 wrap.innerHTML=`<div class="eng-card v118-card"><div class="section-db-head"><div><h2>☷ Load Assignment Manager — V1.18 Fix</h2><small>Review, filter, copy, assign and clear loads without editing Members one-by-one.</small></div><button class="ml-close" id="v118Close">×</button></div>
 <div class="v118-toolbar"><label>Case<select id="v118Case"><option value="ALL">All Cases</option>${cases}</select></label><label>Show<select id="v118Kind"><option value="ALL">All Loads</option><option value="NODE">Node Loads</option><option value="MEMBER">Member Loads</option><option value="GENERATED">Generated Loads</option><option value="MANUAL">Manual Loads</option></select></label><input id="v118Search" placeholder="Search M7, Node 3, UDL…"><button id="v118Refresh">↻ Refresh</button></div>
 <div class="v118-stats" id="v118Stats"></div><div class="v118-table-wrap"><table class="v118-table"><thead><tr><th></th><th>Object</th><th>Case</th><th>Type</th><th>Value</th><th>Source</th><th>Action</th></tr></thead><tbody id="v118Rows"></tbody></table></div>
 <div class="v118-actions-grid"><section><h3>Multi-Member Assignment</h3><p>Uses the Members selected in the model.</p><label>Load Case<select id="v118AssignCase">${cases}</select></label><label>Type<select id="v118Type"><option value="UDL">UDL</option><option value="POINT">Point Load</option><option value="MOMENT">Moment</option></select></label><label>Direction<select id="v118Dir"><option value="GLOBAL_Y">Global Y</option><option value="GLOBAL_X">Global X</option><option value="LOCAL_Y">Local Y</option></select></label><label>Magnitude<input id="v118Mag" type="number" step="any" value="-5"></label><label>Position / start ratio (0–1)<input id="v118Pos" type="number" min="0" max="1" step="0.05" value="0.5"></label><button class="primary" id="v118Apply">Apply to Selected Members</button></section>
 <section><h3>Copy / Clear</h3><p>Select one source row in the table, then select target Members in the model.</p><button id="v118Copy">Copy Selected Load → Selected Members</button><button id="v118SelectLoaded">Select Loaded Members in Filter</button><button class="danger" id="v118Clear">Clear Loads in Current Filter</button><div class="v111-note" id="v118Feedback">Manual and generated loads remain distinguishable. JSON/Cloud use the existing model load structure.</div></section></div></div>`;
 document.body.appendChild(wrap);const q=id=>wrap.querySelector('#'+id),close=()=>wrap.remove();q('v118Close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};let selectedRow=null;
 const filtered=()=>{const cf=q('v118Case').value,k=q('v118Kind').value,term=q('v118Search').value.trim().toLowerCase();return allLoadRowsV118().filter(r=>(cf==='ALL'||r.caseId===cf)&&(k==='ALL'||(k==='GENERATED'?r.source!=='MANUAL':k==='MANUAL'?r.source==='MANUAL':r.kind===k))&&(!term||`${r.kind} ${r.id} ${r.caseId} ${r.type} ${r.value} ${r.source}`.toLowerCase().includes(term)))};
 function refresh(){const rows=filtered(),all=allLoadRowsV118();q('v118Stats').innerHTML=`<b>${rows.length}</b> shown &nbsp; • &nbsp; <b>${all.filter(r=>r.kind==='NODE').length}</b> node loads &nbsp; • &nbsp; <b>${all.filter(r=>r.kind==='MEMBER').length}</b> member loads &nbsp; • &nbsp; <b>${all.filter(r=>r.source!=='MANUAL').length}</b> generated`;q('v118Rows').innerHTML=rows.length?rows.map((r,i)=>`<tr><td><input type="radio" name="v118pick" data-pick="${i}"></td><td>${r.kind==='MEMBER'?'M':'Node '}${r.id}</td><td>${r.caseId}</td><td>${r.type}</td><td>${r.value}</td><td>${r.source}</td><td><button data-locate="${i}">Locate</button><button class="danger" data-delete="${i}">Delete</button></td></tr>`).join(''):`<tr><td colspan="7">No loads match this filter.</td></tr>`;q('v118Rows').querySelectorAll('[data-pick]').forEach(x=>x.onchange=()=>selectedRow=rows[+x.dataset.pick]);q('v118Rows').querySelectorAll('[data-locate]').forEach(x=>x.onclick=()=>{const r=rows[+x.dataset.locate];close();requestAnimationFrame(()=>{if(r.kind==='NODE'){focusNodeV114(r.id)}else{setSingleMemberSelection(Number(r.id));focusMembers([Number(r.id)]);updateUI();render()}toast(`Located ${r.kind==='MEMBER'?'Member M':'Node '}${r.id}`)})});q('v118Rows').querySelectorAll('[data-delete]').forEach(x=>x.onclick=()=>{const r=rows[+x.dataset.delete];pushHistory();invalidate();if(r.kind==='NODE')Object.assign(state.nodes.find(n=>n.id===r.id).loads[r.caseId],emptyLoad());else state.members.find(m=>m.id===r.id).loads[r.caseId].splice(r.index,1);render();updateUI();refresh()})}
 ['v118Case','v118Kind'].forEach(id=>q(id).onchange=refresh);q('v118Search').oninput=refresh;q('v118Refresh').onclick=refresh;
 q('v118Apply').onclick=()=>{const ids=selectedMemberIds();if(!ids.length)return alert('Select one or more Members in the model first.');const type=q('v118Type').value,caseId=q('v118AssignCase').value,dir=q('v118Dir').value,mag=Number(q('v118Mag').value),r=Math.max(0,Math.min(1,Number(q('v118Pos').value)||0));if(!Number.isFinite(mag))return alert('Enter a valid magnitude.');pushHistory();invalidate();for(const id of ids){const m=state.members.find(x=>x.id===id),L=memberLength(m);m.loads=m.loads||{};m.loads[caseId]=m.loads[caseId]||[];let ld;if(type==='UDL')ld={type:'TRAP',w1:mag,w2:mag,a:0,b:L,direction:dir,source:'MANUAL'};if(type==='POINT')ld={type:'POINT',P:mag,x:r*L,r,direction:dir,source:'MANUAL'};if(type==='MOMENT')ld={type:'MOMENT',M:mag,x:r*L,r,direction:'LOCAL_Z',source:'MANUAL'};m.loads[caseId].push(ld)}render();updateUI();q('v118Feedback').textContent=`Applied ${type} to ${ids.length} selected Member(s).`;refresh()};
 q('v118Copy').onclick=()=>{if(!selectedRow||selectedRow.kind!=='MEMBER')return alert('Choose one Member Load row first.');const ids=selectedMemberIds().filter(id=>id!==selectedRow.id);if(!ids.length)return alert('Select one or more target Members in the model.');const src=state.members.find(m=>m.id===selectedRow.id);pushHistory();invalidate();for(const id of ids){const m=state.members.find(x=>x.id===id);m.loads=m.loads||{};m.loads[selectedRow.caseId]=m.loads[selectedRow.caseId]||[];m.loads[selectedRow.caseId].push(cloneLoadForMemberV118(selectedRow.load,src,m))}render();updateUI();q('v118Feedback').textContent=`Copied load from M${src.id} to ${ids.length} Member(s).`;refresh()};
 q('v118SelectLoaded').onclick=()=>{const ids=[...new Set(filtered().filter(r=>r.kind==='MEMBER').map(r=>r.id))];if(!ids.length)return alert('No loaded Members in this filter.');if(typeof setMultiMemberSelection==='function')setMultiMemberSelection(ids);else{state.selected={type:'members',ids}}updateUI();render();q('v118Feedback').textContent=`Selected ${ids.length} loaded Member(s).`};
 q('v118Clear').onclick=()=>{const rows=filtered();if(!rows.length||!confirm(`Clear ${rows.length} load assignment(s) in the current filter?`))return;pushHistory();invalidate();for(const r of [...rows].reverse()){if(r.kind==='NODE')Object.assign(state.nodes.find(n=>n.id===r.id).loads[r.caseId],emptyLoad());else{const a=state.members.find(m=>m.id===r.id).loads[r.caseId];const idx=a.indexOf(r.load);if(idx>=0)a.splice(idx,1)}}render();updateUI();selectedRow=null;refresh()};refresh();
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
function engineeringDialog(kind){const wrap=document.createElement('div');wrap.className='eng-dialog';const isMat=kind==='materials';wrap.innerHTML=`<div class="eng-card"><h2>${isMat?'Material Library':'Section Library'}</h2><div id="engBody"></div><div class="eng-actions"><button class="secondary" id="engClose">ປິດ</button></div></div>`;document.body.appendChild(wrap);wrap.querySelector('#engClose').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};const body=wrap.querySelector('#engBody');const renderList=()=>{if(isMat){body.innerHTML=`<table><tr><th>ID</th><th>Name</th><th>Type</th><th>E (kN/m²)</th><th></th></tr>${state.materials.map((x,i)=>`<tr><td>${x.id}</td><td>${x.name}</td><td>${x.type}</td><td>${x.E}</td><td><button class="danger" data-del="${i}">ລຶບ</button></td></tr>`).join('')}</table><div class="eng-form"><input id="mId" placeholder="ID"><input id="mName" placeholder="Name"><select id="mType"><option>Concrete</option><option>Steel</option><option>Custom</option></select><input id="mE" type="number" placeholder="E kN/m²"></div><button id="mAdd">＋ Add Material</button><button id="mExport" class="secondary">Export Material Library</button><label class="file-label">Import Materials<input id="mImport" type="file" accept="application/json" hidden></label>`;body.querySelector('#mAdd').onclick=()=>{const id=body.querySelector('#mId').value.trim(),name=body.querySelector('#mName').value.trim(),E=Number(body.querySelector('#mE').value);if(!id||!name||!(E>0))return alert('ກະລຸນາໃສ່ ID, Name ແລະ E');if(state.materials.some(x=>x.id===id))return alert('ID ຊ້ຳ');state.materials.push({id,name,type:body.querySelector('#mType').value,E,fy:0,fc:0});persistLibraries();updateEngineeringSelectors();renderList()};body.querySelector('#mExport').onclick=()=>{const a=document.createElement('a'),blob=new Blob([JSON.stringify({version:'1.16.1-fix',materials:state.materials},null,2)],{type:'application/json'});a.href=URL.createObjectURL(blob);a.download='sapudom-material-library-v1.9.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};body.querySelector('#mImport').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result),arr=Array.isArray(d)?d:d.materials;if(!Array.isArray(arr))throw 0;state.materials=mergeUniqueById(state.materials,arr.filter(x=>x.id&&x.name&&Number(x.E)>0));persistLibraries();updateEngineeringSelectors();renderList();toast('Imported material library')}catch{alert('Invalid material library')}};r.readAsText(f)}}else{body.innerHTML=`<table><tr><th>ID</th><th>Name</th><th>Material</th><th>A</th><th>I</th><th></th></tr>${state.sections.map((x,i)=>`<tr><td>${x.id}</td><td>${x.name}</td><td>${x.materialId}</td><td>${x.A}</td><td>${x.I}</td><td><button class="danger" data-del="${i}">ລຶບ</button></td></tr>`).join('')}</table><div class="eng-form"><input id="sId" placeholder="ID"><input id="sName" placeholder="Name"><select id="sMat">${state.materials.map(x=>`<option value="${x.id}">${x.name}</option>`).join('')}</select><select id="sType"><option>RC Rectangular</option><option>Steel I</option><option>Custom</option></select><input id="sA" type="number" step="0.0001" placeholder="A m²"><input id="sI" type="number" step="0.000001" placeholder="I m⁴"></div><button id="sAdd">＋ Add Section</button>`;body.querySelector('#sAdd').onclick=()=>{const id=body.querySelector('#sId').value.trim(),name=body.querySelector('#sName').value.trim(),A=Number(body.querySelector('#sA').value),I=Number(body.querySelector('#sI').value);if(!id||!name||!(A>0)||!(I>0))return alert('ກະລຸນາໃສ່ ID, Name, A ແລະ I');if(state.sections.some(x=>x.id===id))return alert('ID ຊ້ຳ');state.sections.push({id,name,type:body.querySelector('#sType').value,materialId:body.querySelector('#sMat').value,A,I});persistLibraries();updateEngineeringSelectors();renderList()}}body.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const list=isMat?state.materials:state.sections;if(list.length<=1)return alert('ຕ້ອງເຫຼືອຢ່າງນ້ອຍ 1 ລາຍການ');list.splice(Number(b.dataset.del),1);persistLibraries();updateEngineeringSelectors();renderList()})};renderList()}
function loadCaseDialog(){const wrap=document.createElement('div');wrap.className='eng-dialog';wrap.innerHTML=`<div class="eng-card"><h2>Load Case Manager</h2><div id="caseBody"></div><div class="eng-actions"><button class="secondary" id="caseClose">ປິດ</button></div></div>`;document.body.appendChild(wrap);wrap.querySelector('#caseClose').onclick=()=>wrap.remove();const body=wrap.querySelector('#caseBody');const renderList=()=>{body.innerHTML=`<table><tr><th>ID</th><th>Name</th><th>Type</th><th></th></tr>${state.loadCases.map((x,i)=>`<tr><td><span class="load-case-badge">${x.id}</span></td><td>${x.name}</td><td>${x.type}</td><td><button class="danger" data-del="${i}">ລຶບ</button></td></tr>`).join('')}</table><div class="eng-form"><input id="lcId" placeholder="ID: WL"><input id="lcName" placeholder="Name"><select id="lcType"><option>Dead</option><option>Live</option><option>Wind</option><option>Earthquake</option><option>Other</option></select></div><button id="lcAdd">＋ Add Load Case</button>`;body.querySelector('#lcAdd').onclick=()=>{const id=body.querySelector('#lcId').value.trim().toUpperCase(),name=body.querySelector('#lcName').value.trim();if(!id||!name)return alert('ກະລຸນາໃສ່ ID ແລະ Name');if(state.loadCases.some(x=>x.id===id))return alert('ID ຊ້ຳ');state.loadCases.push({id,name,type:body.querySelector('#lcType').value});for(const n of state.nodes){if(!n.loads)n.loads={};n.loads[id]=emptyLoad()}for(const m of state.members){if(!m.loads)m.loads={};m.loads[id]=[]}updateEngineeringSelectors();renderList()};body.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{if(state.loadCases.length<=1)return alert('ຕ້ອງເຫຼືອ 1 Load Case');const i=Number(b.dataset.del),id=state.loadCases[i].id;state.loadCases.splice(i,1);for(const n of state.nodes)if(n.loads)delete n.loads[id];for(const m of state.members)if(m.loads)delete m.loads[id];if(state.activeLoadCase===id)state.activeLoadCase=state.loadCases[0].id;syncActiveLoads();updateEngineeringSelectors();invalidate();renderList()})};renderList()}
function addNode(x,y){if(state.nodes.some(n=>Math.hypot(n.x-x,n.y-y)<1e-6)){toast('ມີ Node ຢູ່ຈຸດນີ້ແລ້ວ');return null}pushHistory();invalidate();const n={id:state.nextNode++,x,y,support:'none',loads:{[state.activeLoadCase]:emptyLoad()}};n.load=n.loads[state.activeLoadCase];state.nodes.push(n);state.selected={type:'node',id:n.id};updateUI();render();return n}
function addMember(i,j){if(i===j)return;if(state.members.some(m=>(m.i===i&&m.j===j)||(m.i===j&&m.j===i))){toast('Member ນີ້ມີແລ້ວ');return}pushHistory();invalidate();const sec=state.sections.find(x=>x.id===$('sectionSelect').value);const mat=state.materials.find(x=>x.id===$('materialSelect').value);const m={id:state.nextMember++,i,j,E:+$('E').value,A:+$('A').value,I:+$('I').value,materialId:mat?.id||'',sectionId:sec?.id||'',releases:{i:{mz:false},j:{mz:false}}};state.members.push(m);state.selected={type:'member',id:m.id};state.memberStart=null;updateUI();render();}
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
 return{analysisLabel:loadSet.label,analysisSpec:spec,D,R,K,F,index,memberForces,maxDisp:Math.max(...D.map(Math.abs)),analyzedAt:new Date().toISOString(),freeDof:free.length,fixedDof:fixed.length,inactiveHingeDof:inactiveHingeRotations.length,residual,applied,reactions};
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
 state.results={analysisLabel:loadSet.label,analysisSpec:state.activeAnalysis,D,R,K,F,index,memberForces,maxDisp:Math.max(...D.map(Math.abs)),analyzedAt:new Date().toISOString(),freeDof:free.length,fixedDof:fixed.length,inactiveHingeDof:inactiveHingeRotations.length,residual,applied,reactions};
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
function selectedForceHtml(){if(state.selected?.type!=='member'||!state.results)return'';const f=state.results.memberForces.find(x=>x.id===state.selected.id);if(!f)return'';const pts=memberDiagramSamplesV117(f),mnM=Math.min(...pts.map(p=>p.M)),mxM=Math.max(...pts.map(p=>p.M));return`<div class="selected-result"><b>Selected Member M${f.id}</b><span>N: ${fmt(f.local[0],3)} → ${fmt(-f.local[3],3)} kN</span><span>V: ${fmt(f.local[1],3)} → ${fmt(-f.local[4],3)} kN</span><span>M ends: ${fmt(f.local[2],3)} → ${fmt(-f.local[5],3)} kN·m</span><span>M along member: ${fmt(mnM,3)} / ${fmt(mxM,3)} kN·m</span></div>`}
function renderResults(){const box=$('resultContent');if(!state.results){box.innerHTML='<div class="empty">ຍັງບໍ່ມີຜົນວິເຄາະ</div>';return}const r=state.results,s=forceStats();if(state.resultTab==='summary'){box.innerHTML=`<div class="analysis-banner"><b>${r.analysisLabel||'Load Case'}</b></div><div class="metric-grid"><div class="metric">Max displacement<b>${fmt(r.maxDisp*1000,3)} mm</b></div><div class="metric">Axial Min / Max<b>${fmt(s.axial.min,2)} / ${fmt(s.axial.max,2)} kN</b></div><div class="metric">Shear Min / Max<b>${fmt(s.shear.min,2)} / ${fmt(s.shear.max,2)} kN</b></div><div class="metric">Moment Min / Max<b>${fmt(s.moment.min,2)} / ${fmt(s.moment.max,2)} kN·m</b></div></div>${selectedForceHtml()}<div class="equilibrium"><b>Global equilibrium check</b><span>ΣFx = ${fmt(r.applied.fx+r.reactions.fx,6)} kN</span><span>ΣFy = ${fmt(r.applied.fy+r.reactions.fy,6)} kN</span><span>Residual = ${Number(r.residual).toExponential(2)}</span></div>`;return}if(state.resultTab==='disp'){box.innerHTML='<table><tr><th>Node</th><th>Ux (mm)</th><th>Uy (mm)</th><th>Rz (rad)</th></tr>'+state.nodes.map(n=>{const q=r.index.get(n.id)*3;return`<tr><td>${n.id}</td><td>${fmt(r.D[q]*1000,4)}</td><td>${fmt(r.D[q+1]*1000,4)}</td><td>${fmt(r.D[q+2],7)}</td></tr>`}).join('')+'</table>';return}if(state.resultTab==='react'){box.innerHTML='<table><tr><th>Node</th><th>Rx (kN)</th><th>Ry (kN)</th><th>Mz (kN·m)</th></tr>'+state.nodes.filter(n=>n.support!=='none').map(n=>{const q=r.index.get(n.id)*3;return`<tr><td>${n.id}</td><td>${fmt(r.R[q],4)}</td><td>${fmt(r.R[q+1],4)}</td><td>${fmt(r.R[q+2],4)}</td></tr>`}).join('')+'</table>';return}box.innerHTML='<table><tr><th>Member</th><th>Ni</th><th>Vi</th><th>Mi</th><th>Nj</th><th>Vj</th><th>Mj</th></tr>'+r.memberForces.map(x=>`<tr data-member="${x.id}"><td>${x.id}</td>${x.local.map(v=>`<td>${fmt(v,4)}</td>`).join('')}</tr>`).join('')+'</table>';box.querySelectorAll('[data-member]').forEach(tr=>tr.onclick=()=>{setSingleMemberSelection(Number(tr.dataset.member));updateUI();render();renderResults()})}
function modelScreenBounds(){const pts=state.nodes.map(n=>worldToScreen(n.x,n.y));if(!pts.length)return{w:300,h:220};const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{w:Math.max(80,Math.max(...xs)-Math.min(...xs)),h:Math.max(80,Math.max(...ys)-Math.min(...ys))}}
function automaticDiagramScale(view){const r=canvas.getBoundingClientRect(),b=modelScreenBounds();const available=Math.max(32,Math.min(100,r.height*.18,r.width*.12,Math.max(40,Math.min(b.w,b.h)*.28)));if(view==='deformed')return Math.max(.4,Math.min(4,available/60));return Math.max(.4,Math.min(4,available/55))}
function effectiveDiagramScale(view=$('viewResult').value){return state.autoDiagramScale?automaticDiagramScale(view):state.diagramScale}
function syncScaleUI(){const input=$('diagramScale');if(!input)return;input.disabled=state.autoDiagramScale;input.value=state.autoDiagramScale?effectiveDiagramScale().toFixed(1):state.diagramScale.toFixed(1);const auto=$('autoScaleToggle');if(auto)auto.checked=state.autoDiagramScale}
function drawDeformed(){const r=state.results;if(!r)return;const auto=Math.min(200,Math.max(1,60/(Math.max(r.maxDisp,1e-12)*state.view.scale))),fac=auto*effectiveDiagramScale('deformed');ctx.save();ctx.setLineDash([7,4]);ctx.strokeStyle='#1671e8';ctx.lineWidth=2.5;for(const m of state.members){const ni=state.nodes.find(n=>n.id===m.i),nj=state.nodes.find(n=>n.id===m.j),qi=r.index.get(ni.id)*3,qj=r.index.get(nj.id)*3,a=worldToScreen(ni.x+r.D[qi]*fac,ni.y+r.D[qi+1]*fac),b=worldToScreen(nj.x+r.D[qj]*fac,nj.y+r.D[qj+1]*fac);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.setLineDash([]);ctx.fillStyle='#0759c7';ctx.font='bold 12px Arial';ctx.fillText(`Deformed scale × ${effectiveDiagramScale('deformed').toFixed(1)}`,14,22);ctx.restore()}
function diagramValues(f,type){if(type==='axial')return[f.local[0],-f.local[3]];if(type==='shear')return[f.local[1],-f.local[4]];return[f.local[2],-f.local[5]]}
function drawForceDiagram(type){
 const r=state.results;if(!r)return;const stats=forceStats()[type],pixel=55*effectiveDiagramScale(type)/stats.abs,selected=state.selected?.type==='member'?state.selected.id:null,palette={axial:['#0b7a45','#22c55e33'],shear:['#9a3412','#f9731633'],moment:['#b4232f','#ef444433']},[stroke,fill]=palette[type];ctx.save();
 for(const f of r.memberForces){const ni=state.nodes.find(n=>n.id===f.i),nj=state.nodes.find(n=>n.id===f.j),a=worldToScreen(ni.x,ni.y),b=worldToScreen(nj.x,nj.y),dx=b.x-a.x,dy=b.y-a.y,Lpx=Math.hypot(dx,dy);if(Lpx<1e-9)continue;const nx=-dy/Lpx,ny=dx/Lpx,pts=memberDiagramSamplesV117(f),key=type==='axial'?'N':type==='shear'?'V':'M',screenPts=pts.map(p=>{const t=f.L?p.x/f.L:0,base={x:a.x+dx*t,y:a.y+dy*t},off=p[key]*pixel;return{x:base.x+nx*off,y:base.y+ny*off,base,val:p[key],xLocal:p.x}});
  ctx.strokeStyle=f.id===selected?'#f59e0b':stroke;ctx.fillStyle=f.id===selected?'#f59e0b44':fill;ctx.lineWidth=f.id===selected?3:1.6;ctx.beginPath();ctx.moveTo(a.x,a.y);for(const p of screenPts)ctx.lineTo(p.x,p.y);ctx.lineTo(b.x,b.y);ctx.closePath();ctx.fill();ctx.stroke();
  if(state.showLabels&&screenPts.length){ctx.fillStyle='#111827';ctx.font='11px Arial';const first=screenPts[0],last=screenPts.at(-1);ctx.fillText(fmt(first.val,2),first.x+4,first.y-4);ctx.fillText(fmt(last.val,2),last.x+4,last.y-4);if(type==='moment'){let ex=screenPts[0];for(const p of screenPts)if(Math.abs(p.val)>Math.abs(ex.val))ex=p;if(ex!==first&&ex!==last)ctx.fillText(fmt(ex.val,2),ex.x+4,ex.y-4)}}
 }
 ctx.fillStyle='#111827';ctx.font='bold 12px Arial';const unit=type==='moment'?'kN·m':'kN';ctx.fillText(`${type.toUpperCase()}  Min ${fmt(stats.min,2)} / Max ${fmt(stats.max,2)} ${unit}`,14,22);ctx.restore()
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
function updateDiagramLegend(view){const el=$('diagramLegend');if(!state.results||view==='model'){el.hidden=true;return}el.hidden=false;if(view==='deformed'){el.innerHTML=`<b>Deformed Shape</b><div class="legend-row"><span>Scale</span><strong>× ${effectiveDiagramScale('deformed').toFixed(1)}</strong></div><small>ເສັ້ນປະສີຟ້າ = ຮູບຮ່າງຫຼັງເສຍຮູບ</small>`;return}const st=forceStats()[view],unit=view==='moment'?'kN·m':'kN',name={axial:'Axial Force (N)',shear:'Shear Force (V)',moment:'Bending Moment (M)'}[view];el.innerHTML=`<b>${name}</b><div class="legend-row legend-min"><span>Min</span><strong>${fmt(st.min,2)} ${unit}</strong></div><div class="legend-row legend-max"><span>Max</span><strong>${fmt(st.max,2)} ${unit}</strong></div><small>Scale × ${effectiveDiagramScale(view).toFixed(1)}${state.autoDiagramScale?' (Auto)':''} • Values ${state.showLabels?'ON':'OFF'}</small>`}
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
   const model=data?.model||{},before=snapshotSummary(model);pushHistory();restore(model);$('projectName').value=model.projectName||data.name||'Cloud Project';$('units').value=model.units||'kN - m';refreshLayoutAfterLoad();wrap.remove();
   const after=snapshotSummary(projectSnapshot());
   toast(`Cloud opened: ${after.members} Members • Self Weight ${after.selfWeight}`);
   if(before.selfWeight!==after.selfWeight||before.generated!==after.generated)alert('Cloud data verification warning: generated loads changed during restore. Please use JSON backup and report this project.')
  })
 };
 refresh()
}
function updateUI(){$('nodeCount').textContent=state.nodes.length;$('memberCount').textContent=state.members.length;$('supportCount').textContent=state.nodes.filter(n=>n.support!=='none').length;$('loadCount').textContent=state.nodes.filter(n=>{const l=activeNodeLoad(n);return l.fx||l.fy||l.mz}).length+state.members.reduce((s,m)=>s+activeMemberLoads(m).length,0);let html='ຍັງບໍ່ໄດ້ເລືອກ';if(state.selected?.type==='node'){const n=state.nodes.find(x=>x.id===state.selected.id);if(n)html=`<b>Node ${n.id}</b><br>X = ${n.x.toFixed(3)} m<br>Y = ${n.y.toFixed(3)} m<br>Support: ${n.support}<br>Load Case: ${state.activeLoadCase}<br>Fx = ${activeNodeLoad(n).fx} kN<br>Fy = ${activeNodeLoad(n).fy} kN<br>Mz = ${activeNodeLoad(n).mz} kN·m`}const selectedIds=selectedMemberIds();if(selectedIds.length>1){const counts={};for(const id of selectedIds){const m=state.members.find(x=>x.id===id);if(m){const k=m.sectionId||'-';counts[k]=(counts[k]||0)+1}}html=`<b>${selectedIds.length} Members selected</b><br>${selectedIds.map(x=>'M'+x).join(', ')}<hr>${Object.entries(counts).map(([k,v])=>`${state.sections.find(s=>s.id===k)?.name||k}: ${v}`).join('<br>')}`;}else if(state.selected?.type==='member'){const m=state.members.find(x=>x.id===state.selected.id);if(m){let extra='';if(state.results){const f=state.results.memberForces.find(x=>x.id===m.id);if(f)extra=`<hr><b>Analysis</b><br>N: ${fmt(f.local[0],3)} → ${fmt(-f.local[3],3)} kN<br>V: ${fmt(f.local[1],3)} → ${fmt(-f.local[4],3)} kN<br>M: ${fmt(f.local[2],3)} → ${fmt(-f.local[5],3)} kN·m`;}html=`<b>Member ${m.id}</b><br>Node ${m.i} → ${m.j}<br>Material=${state.materials.find(x=>x.id===m.materialId)?.name||m.materialId||'-'}<br>Section=${state.sections.find(x=>x.id===m.sectionId)?.name||m.sectionId||'-'}<br>E=${m.E}<br>A=${m.A}<br>I=${m.I}<br>Release: ${releaseLabel(m)}<br>Member Loads (${state.activeLoadCase}) = ${activeMemberLoads(m).length}${extra}`;if(state.materials.some(x=>x.id===m.materialId))$('materialSelect').value=m.materialId;if(state.sections.some(x=>x.id===m.sectionId))$('sectionSelect').value=m.sectionId;$('E').value=m.E;$('A').value=m.A;$('I').value=m.I}}$('selectionInfo').innerHTML=html;updateButtons()}
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
 q('v11Generate').onclick=()=>{const stories=Math.max(1,+q('v11Stories').value||1),bays=Math.max(1,+q('v11Bays').value||1),hs=list(q('v11Heights').value,stories,3.5),ws=list(q('v11Widths').value,bays,6),cm=state.materials.find(x=>x.id===q('v11ColMat').value)||state.materials[0],cs=state.sections.find(x=>x.id===q('v11ColSec').value)||state.sections[0],bm=state.materials.find(x=>x.id===q('v11BeamMat').value)||state.materials[0],bs=state.sections.find(x=>x.id===q('v11BeamSec').value)||state.sections[0];if(q('v11Replace').checked){pushHistory();invalidate();state.nodes=[];state.members=[];state.nextNode=1;state.nextMember=1}else{pushHistory();invalidate()}const xs=[0],ys=[0];ws.forEach(v=>xs.push(xs.at(-1)+v));hs.forEach(v=>ys.push(ys.at(-1)+v));const ids=[];for(let r=0;r<=stories;r++){ids[r]=[];for(let c=0;c<=bays;c++){const n={id:state.nextNode++,x:xs[c],y:ys[r],story:r,support:r===0?q('v11Support').value:'none',loads:{}};state.loadCases.forEach(lc=>n.loads[lc.id]=emptyLoad());n.load=n.loads[state.activeLoadCase];state.nodes.push(n);ids[r][c]=n.id}}const add=(i,j,type,story,mat,sec,bay)=>{const m={id:state.nextMember++,i,j,type,story,bay,materialId:mat.id,sectionId:sec.id,E:+mat.E,A:+sec.A,I:+sec.I,Iy:+(sec.Iy||0),J:+(sec.J||0),weight:+(sec.weight||0),releases:{i:{mz:false},j:{mz:false}},loads:{}};state.loadCases.forEach(lc=>m.loads[lc.id]=[]);state.members.push(m)};for(let r=1;r<=stories;r++){for(let c=0;c<=bays;c++)add(ids[r-1][c],ids[r][c],'column',r,cm,cs,c);for(let c=0;c<bays;c++)add(ids[r][c],ids[r][c+1],'beam',r,bm,bs,c)}state.building={stories,bays,storyHeights:hs,bayWidths:ws,levels:ys,grids:xs.map((x,i)=>({id:String.fromCharCode(65+i),x})),storyNames:Array.from({length:stories},(_,i)=>`Story ${i+1}`),hiddenStories:[]};state.selected=null;state.multiSelectedMemberIds=new Set();migrateLoads();updateUI();fit();render();toast(`V1.17 generated ${stories}-story / ${bays}-bay building`);refreshAll()};
 q('v11CopyStory').onclick=()=>{const from=+q('v11CopyFrom').value,to=+q('v11CopyTo').value;if(!from||!to||from===to)return alert('Choose different source and target stories.');const a=memberSort(storyMembers(from)),b=memberSort(storyMembers(to));if(!a.length||a.length!==b.length)return alert('Stories must have matching geometry.');pushHistory();invalidate();for(let i=0;i<a.length;i++){if(q('v11CopyProps').checked){for(const k of ['materialId','sectionId','E','A','I','Iy','J','weight','releases'])b[i][k]=JSON.parse(JSON.stringify(a[i][k]))}if(q('v11CopyLoads').checked)b[i].loads=JSON.parse(JSON.stringify(a[i].loads||{}))}render();updateUI();toast(`Copied Story ${from} data to Story ${to}`)};
 q('v11SelectStory').onclick=()=>selectStoryInModel(+q('v11CopyTo').value,true);
 q('v11ApplyFloor').onclick=()=>{const st=+q('v11FloorStory').value,lc=q('v11FloorCase').value,w=(+q('v11AreaLoad').value||0)*(+q('v11TribWidth').value||0),beams=storyBeams(st);if(!beams.length)return alert('No beams found on this story.');pushHistory();invalidate();for(const m of beams){m.loads=m.loads||{};m.loads[lc]=m.loads[lc]||[];m.loads[lc].push({type:'TRAP',w1:w,w2:w,a:0,b:memberLength(m),direction:'LOCAL_Y',source:'FLOOR_LOAD',story:st})}render();updateUI();toast(`Applied ${w.toFixed(3)} kN/m to ${beams.length} Story ${st} beams`);refreshSummary()};
 q('v11ClearFloor').onclick=()=>{const st=+q('v11FloorStory').value,lc=q('v11FloorCase').value,beams=storyBeams(st);pushHistory();invalidate();beams.forEach(m=>{m.loads=m.loads||{};m.loads[lc]=(m.loads[lc]||[]).filter(x=>x.source!=='FLOOR_LOAD')});render();updateUI();toast(`Cleared generated floor loads on Story ${st}`);refreshSummary()};
 q('v11ApplyWall').onclick=()=>{const ids=selectedMemberIds(),beams=state.members.filter(m=>ids.includes(m.id)&&(m.type==='beam'||Math.abs((state.nodes.find(n=>n.id===m.i)?.y||0)-(state.nodes.find(n=>n.id===m.j)?.y||0))<1e-6));if(!beams.length)return alert('Select one or more beams first.');const lc=q('v11WallCase').value,w=-Math.abs((+q('v11WallH').value||0)*(+q('v11WallT').value||0)*(+q('v11WallGamma').value||0));pushHistory();invalidate();beams.forEach(m=>{m.loads=m.loads||{};m.loads[lc]=m.loads[lc]||[];m.loads[lc].push({type:'TRAP',w1:w,w2:w,a:0,b:memberLength(m),direction:'LOCAL_Y',source:'WALL_LOAD'})});render();updateUI();toast(`Applied wall load ${w.toFixed(3)} kN/m to ${beams.length} beams`);refreshSummary()};
 refreshAll()
}

function sample(){pushHistory();invalidate();state.nodes=[{id:1,x:0,y:0,support:'fixed',load:{fx:0,fy:0,mz:0}},{id:2,x:6,y:0,support:'fixed',load:{fx:0,fy:0,mz:0}},{id:3,x:12,y:0,support:'fixed',load:{fx:0,fy:0,mz:0}},{id:4,x:0,y:4,support:'none',load:{fx:0,fy:0,mz:0}},{id:5,x:6,y:4,support:'none',load:{fx:0,fy:-20,mz:0}},{id:6,x:12,y:4,support:'none',load:{fx:0,fy:0,mz:0}},{id:7,x:0,y:8,support:'none',load:{fx:0,fy:0,mz:0}},{id:8,x:6,y:8,support:'none',load:{fx:0,fy:-30,mz:0}},{id:9,x:12,y:8,support:'none',load:{fx:0,fy:0,mz:0}}];const pairs=[[1,4],[4,7],[2,5],[5,8],[3,6],[6,9],[4,5],[5,6],[7,8],[8,9]];migrateLoads();state.members=pairs.map((p,i)=>({id:i+1,i:p[0],j:p[1],E:25000000,A:.15,I:.003125,materialId:'MAT-CONC-25',sectionId:'SEC-RC-300x500'}));state.nextNode=10;state.nextMember=11;state.selected=null;updateUI();fit();toast('ສ້າງໂມເດວຕົວຢ່າງແລ້ວ')}
function save(){const data=projectSnapshot();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=($('projectName').value||'sapudom-project').replace(/[^a-z0-9_-]+/gi,'-')+'.json';a.click();URL.revokeObjectURL(a.href);toast('ບັນທຶກໄຟລ໌ແລ້ວ')}
function openFile(file){const fr=new FileReader();fr.onload=()=>{try{const d=JSON.parse(fr.result);pushHistory();restore(d);$('projectName').value=d.projectName||'Opened Project';$('units').value=d.units||'kN - m';refreshLayoutAfterLoad();toast('ເປີດໂຄງການແລ້ວ')}catch{alert('ໄຟລ໌ JSON ບໍ່ຖືກຕ້ອງ')}};fr.readAsText(file)}

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
 wrap.innerHTML=`<div class="eng-card load-center-card"><div class="section-db-head"><div><h2>⬇ Load Center — V1.18 Fix</h2><small>Automatic self weight, generated-load management and combination templates.</small></div><button class="ml-close" id="lc15Close">×</button></div>
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
 wrap.innerHTML=`<div class="eng-card v118-card"><div class="section-db-head"><div><h2>☷ Load Assignment Manager — V1.18 Fix</h2><small>Review, filter, copy, assign and clear loads without editing Members one-by-one.</small></div><button class="ml-close" id="v118Close">×</button></div>
 <div class="v118-toolbar"><label>Case<select id="v118Case"><option value="ALL">All Cases</option>${cases}</select></label><label>Show<select id="v118Kind"><option value="ALL">All Loads</option><option value="NODE">Node Loads</option><option value="MEMBER">Member Loads</option><option value="GENERATED">Generated Loads</option><option value="MANUAL">Manual Loads</option></select></label><input id="v118Search" placeholder="Search M7, Node 3, UDL…"><button id="v118Refresh">↻ Refresh</button></div>
 <div class="v118-stats" id="v118Stats"></div><div class="v118-table-wrap"><table class="v118-table"><thead><tr><th></th><th>Object</th><th>Case</th><th>Type</th><th>Value</th><th>Source</th><th>Action</th></tr></thead><tbody id="v118Rows"></tbody></table></div>
 <div class="v118-actions-grid"><section><h3>Multi-Member Assignment</h3><p>Uses the Members selected in the model.</p><label>Load Case<select id="v118AssignCase">${cases}</select></label><label>Type<select id="v118Type"><option value="UDL">UDL</option><option value="POINT">Point Load</option><option value="MOMENT">Moment</option></select></label><label>Direction<select id="v118Dir"><option value="GLOBAL_Y">Global Y</option><option value="GLOBAL_X">Global X</option><option value="LOCAL_Y">Local Y</option></select></label><label>Magnitude<input id="v118Mag" type="number" step="any" value="-5"></label><label>Position / start ratio (0–1)<input id="v118Pos" type="number" min="0" max="1" step="0.05" value="0.5"></label><button class="primary" id="v118Apply">Apply to Selected Members</button></section>
 <section><h3>Copy / Clear</h3><p>Select one source row in the table, then select target Members in the model.</p><button id="v118Copy">Copy Selected Load → Selected Members</button><button id="v118SelectLoaded">Select Loaded Members in Filter</button><button class="danger" id="v118Clear">Clear Loads in Current Filter</button><div class="v111-note" id="v118Feedback">Manual and generated loads remain distinguishable. JSON/Cloud use the existing model load structure.</div></section></div></div>`;
 document.body.appendChild(wrap);const q=id=>wrap.querySelector('#'+id),close=()=>wrap.remove();q('v118Close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};let selectedRow=null;
 const filtered=()=>{const cf=q('v118Case').value,k=q('v118Kind').value,term=q('v118Search').value.trim().toLowerCase();return allLoadRowsV118().filter(r=>(cf==='ALL'||r.caseId===cf)&&(k==='ALL'||(k==='GENERATED'?r.source!=='MANUAL':k==='MANUAL'?r.source==='MANUAL':r.kind===k))&&(!term||`${r.kind} ${r.id} ${r.caseId} ${r.type} ${r.value} ${r.source}`.toLowerCase().includes(term)))};
 function refresh(){const rows=filtered(),all=allLoadRowsV118();q('v118Stats').innerHTML=`<b>${rows.length}</b> shown &nbsp; • &nbsp; <b>${all.filter(r=>r.kind==='NODE').length}</b> node loads &nbsp; • &nbsp; <b>${all.filter(r=>r.kind==='MEMBER').length}</b> member loads &nbsp; • &nbsp; <b>${all.filter(r=>r.source!=='MANUAL').length}</b> generated`;q('v118Rows').innerHTML=rows.length?rows.map((r,i)=>`<tr><td><input type="radio" name="v118pick" data-pick="${i}"></td><td>${r.kind==='MEMBER'?'M':'Node '}${r.id}</td><td>${r.caseId}</td><td>${r.type}</td><td>${r.value}</td><td>${r.source}</td><td><button data-locate="${i}">Locate</button><button class="danger" data-delete="${i}">Delete</button></td></tr>`).join(''):`<tr><td colspan="7">No loads match this filter.</td></tr>`;q('v118Rows').querySelectorAll('[data-pick]').forEach(x=>x.onchange=()=>selectedRow=rows[+x.dataset.pick]);q('v118Rows').querySelectorAll('[data-locate]').forEach(x=>x.onclick=()=>{const r=rows[+x.dataset.locate];close();requestAnimationFrame(()=>{if(r.kind==='NODE'){focusNodeV114(r.id)}else{setSingleMemberSelection(Number(r.id));focusMembers([Number(r.id)]);updateUI();render()}toast(`Located ${r.kind==='MEMBER'?'Member M':'Node '}${r.id}`)})});q('v118Rows').querySelectorAll('[data-delete]').forEach(x=>x.onclick=()=>{const r=rows[+x.dataset.delete];pushHistory();invalidate();if(r.kind==='NODE')Object.assign(state.nodes.find(n=>n.id===r.id).loads[r.caseId],emptyLoad());else state.members.find(m=>m.id===r.id).loads[r.caseId].splice(r.index,1);render();updateUI();refresh()})}
 ['v118Case','v118Kind'].forEach(id=>q(id).onchange=refresh);q('v118Search').oninput=refresh;q('v118Refresh').onclick=refresh;
 q('v118Apply').onclick=()=>{const ids=selectedMemberIds();if(!ids.length)return alert('Select one or more Members in the model first.');const type=q('v118Type').value,caseId=q('v118AssignCase').value,dir=q('v118Dir').value,mag=Number(q('v118Mag').value),r=Math.max(0,Math.min(1,Number(q('v118Pos').value)||0));if(!Number.isFinite(mag))return alert('Enter a valid magnitude.');pushHistory();invalidate();for(const id of ids){const m=state.members.find(x=>x.id===id),L=memberLength(m);m.loads=m.loads||{};m.loads[caseId]=m.loads[caseId]||[];let ld;if(type==='UDL')ld={type:'TRAP',w1:mag,w2:mag,a:0,b:L,direction:dir,source:'MANUAL'};if(type==='POINT')ld={type:'POINT',P:mag,x:r*L,r,direction:dir,source:'MANUAL'};if(type==='MOMENT')ld={type:'MOMENT',M:mag,x:r*L,r,direction:'LOCAL_Z',source:'MANUAL'};m.loads[caseId].push(ld)}render();updateUI();q('v118Feedback').textContent=`Applied ${type} to ${ids.length} selected Member(s).`;refresh()};
 q('v118Copy').onclick=()=>{if(!selectedRow||selectedRow.kind!=='MEMBER')return alert('Choose one Member Load row first.');const ids=selectedMemberIds().filter(id=>id!==selectedRow.id);if(!ids.length)return alert('Select one or more target Members in the model.');const src=state.members.find(m=>m.id===selectedRow.id);pushHistory();invalidate();for(const id of ids){const m=state.members.find(x=>x.id===id);m.loads=m.loads||{};m.loads[selectedRow.caseId]=m.loads[selectedRow.caseId]||[];m.loads[selectedRow.caseId].push(cloneLoadForMemberV118(selectedRow.load,src,m))}render();updateUI();q('v118Feedback').textContent=`Copied load from M${src.id} to ${ids.length} Member(s).`;refresh()};
 q('v118SelectLoaded').onclick=()=>{const ids=[...new Set(filtered().filter(r=>r.kind==='MEMBER').map(r=>r.id))];if(!ids.length)return alert('No loaded Members in this filter.');if(typeof setMultiMemberSelection==='function')setMultiMemberSelection(ids);else{state.selected={type:'members',ids}}updateUI();render();q('v118Feedback').textContent=`Selected ${ids.length} loaded Member(s).`};
 q('v118Clear').onclick=()=>{const rows=filtered();if(!rows.length||!confirm(`Clear ${rows.length} load assignment(s) in the current filter?`))return;pushHistory();invalidate();for(const r of [...rows].reverse()){if(r.kind==='NODE')Object.assign(state.nodes.find(n=>n.id===r.id).loads[r.caseId],emptyLoad());else{const a=state.members.find(m=>m.id===r.id).loads[r.caseId];const idx=a.indexOf(r.load);if(idx>=0)a.splice(idx,1)}}render();updateUI();selectedRow=null;refresh()};refresh();
}

document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('deleteBtn').onclick=deleteSelected;$('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('fitBtn').onclick=fit;$('zoomInBtn').onclick=()=>{state.view.scale*=1.2;render()};$('zoomOutBtn').onclick=()=>{state.view.scale/=1.2;render()};$('sampleBtn').onclick=sample;$('saveBtn').onclick=save;$('openBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>e.target.files[0]&&openFile(e.target.files[0]);$('newBtn').onclick=()=>{if(confirm('ສ້າງໂຄງການໃໝ່?')){pushHistory();invalidate();state.nodes=[];state.members=[];state.nextNode=1;state.nextMember=1;state.selected=null;updateUI();render()}};$('applyPropsBtn').onclick=()=>{const ids=selectedMemberIds();if(!ids.length){toast('ເລືອກ Member ກ່ອນ');return}applyPropertyToMembers(ids,$('sectionSelect').value,$('materialSelect').value)};['gridToggle','snapToggle','gridSize'].forEach(id=>$(id).addEventListener('change',render));
$('releaseBtn').onclick=memberReleaseDialog;if($('loadCenterBtn'))$('loadCenterBtn').onclick=loadCenterV115;if($('loadManagerBtn'))$('loadManagerBtn').onclick=loadManagerV118;


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

$('checkModelBtn').onclick=modelCheckDialog;$('checkModelSideBtn').onclick=modelCheckDialog;$('envelopeBtn').onclick=resultEnvelopeDialogV116;$('envelopeSideBtn').onclick=resultEnvelopeDialogV116;$('analyzeBtn').onclick=analyze;$('csvBtn').onclick=exportCSV;$('clearResultsBtn').onclick=clearResults;$('cloudBtn').onclick=cloudDialog;$('viewResult').onchange=e=>setResultView(e.target.value);$('autoScaleToggle').onchange=e=>{state.autoDiagramScale=e.target.checked;syncScaleUI();updateDiagramLegend($('viewResult').value);render()};$('diagramScale').oninput=e=>{state.diagramScale=Math.max(.2,Math.min(10,Number(e.target.value)||1));updateDiagramLegend($('viewResult').value);render()};$('scaleDownBtn').onclick=()=>{state.autoDiagramScale=false;state.diagramScale=Math.max(.2,state.diagramScale-.5);syncScaleUI();updateDiagramLegend($('viewResult').value);render()};$('scaleResetBtn').onclick=()=>{state.autoDiagramScale=false;state.diagramScale=1;syncScaleUI();updateDiagramLegend($('viewResult').value);render()};$('scaleUpBtn').onclick=()=>{state.autoDiagramScale=false;state.diagramScale=Math.min(10,state.diagramScale+.5);syncScaleUI();updateDiagramLegend($('viewResult').value);render()};$('labelToggle').onchange=e=>{state.showLabels=e.target.checked;updateDiagramLegend($('viewResult').value);render()};if($('loadLabelToggle'))$('loadLabelToggle').onchange=e=>{state.showLoadLabels=e.target.checked;state.modelLoadLabels=e.target.checked;render()};document.querySelectorAll('.result-mode').forEach(b=>b.onclick=()=>setResultView(b.dataset.view));document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.resultTab=b.dataset.tab;renderResults()});


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

updateEngineeringSelectors();migrateLoads();resize();updateUI();renderResults();updateResultModeButtons();setResultView('model',false);setTool('select');syncScaleUI();initResultsWorkspaceV113();toast('V1.17.1 Fix — clean result diagrams ready');
})();
