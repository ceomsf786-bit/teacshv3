// ---------------- Constants ----------------
const HOURS = Array.from({length:24},(_,i)=>i);
const STORAGE_KEY = 'studylog_v1';
const SHEET_WEBAPP_URL = 'YOUR_WEBAPP_URL_HERE'; // replace with your Apps Script Web App URL

// ---------------- Utilities ----------------
function fmtDate(d){return d.toISOString().slice(0,10);}
function labelHour(h){
  const is12 = (h%12===0)?12:h%12;
  const ampm = h<12? 'AM':'PM';
  return `${is12} ${ampm}`;
}
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

// ---------------- Load / Save ----------------
let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

function loadDay(dateStr){
  if(!data[dateStr]) data[dateStr] = Array(24).fill('');
  return data[dateStr];
}

function saveLocal(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ---------------- Sync to Google Sheets ----------------
function syncToSheet(){
  fetch(SHEET_WEBAPP_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  })
  .then(r => r.text())
  .then(t => console.log('Google Sheets sync:', t))
  .catch(e => console.error('Google Sheets sync failed:', e));
}

// ---------------- Week Handling ----------------
let weekStart = getWeekStart(new Date());

function getWeekStart(d){
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = dt.getDay(); // 0 Sun .. 6 Sat
  const diff = (day===0)? -6 : (1 - day);
  dt.setDate(dt.getDate()+diff);
  return dt;
}

function renderWeek(){
  const dayCells = Array.from({length:7},(_,i)=>{
    const dd = new Date(weekStart);
    dd.setDate(dd.getDate()+i);
    return {date:dd,label: dd.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}),iso: fmtDate(dd)};
  });

  document.getElementById('weekInfo').textContent = `${dayCells[0].label} — ${dayCells[6].label}`;
  for(let i=0;i<7;i++){
    const th = document.getElementById('day'+i);
    th.textContent = dayCells[i].label;
    th.dataset.iso = dayCells[i].iso;
  }

  // Build table rows
  const tbody = document.getElementById('tableBody'); tbody.innerHTML = '';
  for(const h of HOURS){
    const tr = document.createElement('tr');
    const th = document.createElement('td'); th.className='hour'; th.textContent = labelHour(h); tr.appendChild(th);
    for(let d=0; d<7; d++){
      const td = document.createElement('td'); td.className='cell';
      const iso = document.getElementById('day'+d).dataset.iso;
      td.dataset.hour = h; td.dataset.date = iso;
      const dayArr = loadDay(iso);
      const txt = dayArr[h] || '';
      if(!txt) td.classList.add('empty');
      td.innerHTML = `<div>${escapeHtml(txt).replace(/\n/g,'<br>')}</div>`;
      const todayIso = fmtDate(new Date());
      if(iso === todayIso) td.classList.add('today');
      td.onclick = ()=> editCell(td);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// ---------------- Cell Editing ----------------
function editCell(td){
  const dateStr = td.dataset.date;
  const h = Number(td.dataset.hour);
  const existing = loadDay(dateStr)[h];
  const newVal = prompt(`Enter study activity for ${dateStr} — ${labelHour(h)}:`, existing);
  if(newVal===null) return;
  loadDay(dateStr)[h] = newVal.trim();
  saveLocal();
  renderWeek();
  syncToSheet();
}

// ---------------- Controls ----------------
document.getElementById('prevWeek').onclick = ()=>{ weekStart.setDate(weekStart.getDate()-7); renderWeek(); };
document.getElementById('nextWeek').onclick = ()=>{ weekStart.setDate(weekStart.getDate()+7); renderWeek(); };
document.getElementById('todayWeek').onclick = ()=>{ weekStart = getWeekStart(new Date()); renderWeek(); };

document.getElementById('clearWeek').onclick = ()=>{
  if(!confirm('Clear all entries for this week?')) return;
  for(let i=0;i<7;i++){ const iso=document.getElementById('day'+i).dataset.iso; delete data[iso]; }
  saveLocal(); renderWeek(); syncToSheet();
};

document.getElementById('exportCsv').onclick = ()=>{
  let rows=[['Date','Hour','Entry']];
  for(let d=0;d<7;d++){
    const iso = document.getElementById('day'+d).dataset.iso;
    const arr = loadDay(iso);
    for(let h=0;h<24;h++) rows.push([iso,labelHour(h),arr[h]||'']);
  }
  const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`studylog_${document.getElementById('day0').dataset.iso}_to_${document.getElementById('day6').dataset.iso}.csv`;
  a.click();
};

// ---------------- Initial Render ----------------
renderWeek();

