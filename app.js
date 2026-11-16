const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "calendrier_pwa_v1";
let state = null;
let editingId = null;
let toastTimer;

const fmt = (date) => new Intl.DateTimeFormat("fr-FR",{day:"2-digit",month:"long",year:"numeric"}).format(date);
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const fromKey = (key) => { const [y,m,d]=key.split("-").map(Number); return new Date(y,m-1,d,12); };
const addDays = (date,n) => { const d=new Date(date); d.setDate(d.getDate()+n); return d; };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function showToast(message){const t=$("toast");t.textContent=message;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2400);}
function saveLocal(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function validState(data){return data && data.version===1 && /^\d{4}-\d{2}-\d{2}$/.test(data.startDate) && Array.isArray(data.events) && data.events.every(e=>e.id&&e.date&&e.title);}
function showCalendar(){
  $("startScreen").hidden=true;$("calendarScreen").hidden=false;$("toolbar").hidden=false;$("addEventBtn").hidden=false;
  const start=fromKey(state.startDate), end=addDays(start,293);
  $("calendarTitle").textContent="Votre calendrier";
  $("calendarRange").textContent=`Du ${fmt(start)} au ${fmt(end)} · 42 semaines`;
  const weekdayNames=[];
  for(let i=0;i<7;i++) weekdayNames.push(new Intl.DateTimeFormat("fr-FR",{weekday:"short"}).format(addDays(start,i)).replace(".",""));
  $("weekdayRow").innerHTML=weekdayNames.map(x=>`<div>${escapeHtml(x)}</div>`).join("")+"<div></div>";
  const eventMap={};state.events.forEach(e=>(eventMap[e.date]??=[]).push(e));
  const weeks=$("weeks");weeks.innerHTML="";
  for(let w=0;w<42;w++){
    const row=document.createElement("div");row.className="week-row";
    for(let d=0;d<7;d++){
      const date=addDays(start,w*7+d), key=dateKey(date), events=eventMap[key]||[], milestone=(w*7+d)===280;
      const cell=document.createElement(events.length?"button":"div");
      cell.className="day-cell"+(events.length?" has-event":"")+(milestone?" milestone":"");
      if(events.length){cell.type="button";cell.addEventListener("click",()=>openView(key));}
      cell.innerHTML=`<span class="date-num">${date.getDate()}</span><span class="month">${new Intl.DateTimeFormat("fr-FR",{month:"short"}).format(date).replace(".","")}</span>${events.length?`<span class="event-title">${escapeHtml(events.map(e=>e.title).join(" · "))}</span>`:""}`;
      cell.setAttribute("aria-label",`${fmt(date)}${events.length?`: ${events.map(e=>e.title).join(", ")}`:""}`);
      row.appendChild(cell);
    }
    const number=document.createElement("div");number.className="week-number";number.textContent=`S${w+1}`;row.appendChild(number);weeks.appendChild(row);
  }
}
function openStart(){state=null;$("calendarScreen").hidden=true;$("toolbar").hidden=true;$("addEventBtn").hidden=true;$("startScreen").hidden=false;}
function beginCalendar(date){state={version:1,startDate:date,events:[]};saveLocal();showCalendar();}
function openEvent(dateKeyValue="",event=null){
  editingId=event?event.id:null;$("eventDialogTitle").textContent=event?"Modifier l'événement":"Ajouter un événement";
  $("eventDate").min=state.startDate;$("eventDate").max=dateKey(addDays(fromKey(state.startDate),293));
  $("eventDate").value=event?event.date:(dateKeyValue||state.startDate);
  $("eventTitle").value=event?event.title:"";$("eventDescription").value=event?event.description||"":"";
  $("eventDialog").showModal();$("eventTitle").focus();
}
function openView(key){
  const date=fromKey(key), events=state.events.filter(e=>e.date===key);
  $("viewDate").textContent=fmt(date);
  $("viewEvents").innerHTML=events.map(e=>`<article class="event-card"><h3>${escapeHtml(e.title)}</h3><p>${escapeHtml(e.description||"Aucun détail complémentaire.")}</p><div class="event-actions"><button class="button secondary" data-edit="${escapeHtml(e.id)}">Modifier</button><button class="button danger-outline" data-delete="${escapeHtml(e.id)}">Supprimer</button></div></article>`).join("");
  $("viewEvents").querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>{const e=state.events.find(x=>x.id===b.dataset.edit);$("viewDialog").close();openEvent("",e);}));
  $("viewEvents").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.delete; if(confirm("Supprimer cet événement ?")){state.events=state.events.filter(e=>e.id!==id);saveLocal();$("viewDialog").close();showCalendar();showToast("Événement supprimé");}}));
  $("viewDialog").showModal();
}
function exportBackup(){
  const payload={...state,exportedAt:new Date().toISOString(),app:"Calendrier"};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`Calendrier-${state.startDate}.json`;a.click();URL.revokeObjectURL(url);showToast("Sauvegarde téléchargée");
}
function importBackup(file){
  if(!file)return;const reader=new FileReader();
  reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!validState(data))throw new Error("format");state={version:1,startDate:data.startDate,events:data.events.map(e=>({id:String(e.id),date:e.date,title:String(e.title),description:String(e.description||"")}))};saveLocal();showCalendar();showToast("Sauvegarde restaurée");}
    catch(e){alert("Ce fichier ne semble pas être une sauvegarde Calendrier valide.");}};
  reader.readAsText(file);
}
$("startForm").addEventListener("submit",e=>{e.preventDefault();if($("startDate").value)beginCalendar($("startDate").value);});
$("importStartBtn").addEventListener("click",()=>$("importStartFile").click());
$("importStartFile").addEventListener("change",e=>{importBackup(e.target.files[0]);e.target.value="";});
$("exportBtn").addEventListener("click",exportBackup);
$("resetBtn").addEventListener("click",()=>$("confirmDialog").showModal());
$("confirmReset").addEventListener("click",()=>{localStorage.removeItem(STORAGE_KEY);state=null;$("confirmDialog").close();openStart();showToast("Données supprimées");});
$("addEventBtn").addEventListener("click",()=>openEvent());
$("cancelEvent").addEventListener("click",()=>$("eventDialog").close());
$("eventForm").addEventListener("submit",e=>{e.preventDefault();const date=$("eventDate").value,title=$("eventTitle").value.trim(),description=$("eventDescription").value.trim();if(!date||!title)return;
  if(editingId){const item=state.events.find(x=>x.id===editingId);Object.assign(item,{date,title,description});}
  else state.events.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),date,title,description});
  state.events.sort((a,b)=>a.date.localeCompare(b.date));saveLocal();$("eventDialog").close();showCalendar();showToast(editingId?"Événement modifié":"Événement ajouté");editingId=null;
});
document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>$(b.dataset.close).close()));
const stored=localStorage.getItem(STORAGE_KEY);
if(stored){try{const parsed=JSON.parse(stored);if(validState(parsed)){state={version:1,startDate:parsed.startDate,events:parsed.events};showCalendar();}else openStart();}catch(e){openStart();}}else openStart();
if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
