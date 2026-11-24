const $ = selector => document.querySelector(selector);
let requests = [];
let currentFilter = 'pending';
let busy = false;
let csrf = '';
function node(tag, className, text) {
  const element = document.createElement(tag); if(className) element.className = className;
  if(text !== undefined) element.textContent = text; return element;
}
async function load() {
  $('#admin-error').hidden = true;
  try {
    const response = await fetch('/api/admin/requests', { cache:'no-store' });
    const data = await response.json();
    if(!response.ok) throw new Error(data.error);
    requests = data.requests;
    $('#admin-summary').textContent = `${data.availability.booked} ${data.availability.booked === 1 ? 'witness' : 'witnesses'} booked · ${data.availability.open} open · ${requests.filter(r => r.status === 'pending').length} to review`;
    render();
  } catch(error) { $('#admin-error').textContent = error.message; $('#admin-error').hidden = false; }
}
function render() {
  const list = $('#admin-list'); list.replaceChildren();
  const filtered = requests.filter(request => request.status === currentFilter);
  if(!filtered.length) {
    const empty = node('div','empty-state');
    empty.append(node('h2',null,currentFilter === 'pending' ? 'A little quiet, for now.' : 'No submissions here yet.'),node('p',null,currentFilter === 'pending' ? 'New witness submissions will appear here for your review.' : 'Use the tabs above to review other submissions.'));
    list.append(empty); return;
  }
  for(const item of filtered) {
    const card = node('article','admin-card');
    const header = node('div','admin-card-head'); const details = node('div');
    details.append(node('h2',null,item.full_name));
    if (item.phone) {
      const phone = node('a',null,`+91 ${item.phone}`); phone.href = `tel:+91${item.phone}`;
      const info = node('p'); info.append(phone,document.createTextNode(item.relationship ? ` · ${item.relationship}` : ''));
      details.append(info);
    }
    details.append(node('p',null,`Received ${new Date(item.created_at).toLocaleString('en-IN', { dateStyle:'medium',timeStyle:'short' })}`));
    header.append(details,node('span',`admin-badge ${item.status}`,item.status === 'verified' ? `Witness ${item.slot} · Booked` : item.status === 'pending' ? 'Needs review' : 'Declined'));
    card.append(header);
    if (item.has_documents) {
    const images = node('div','admin-images');
    const titles = {portrait:'Witness photo',pan:'PAN card',aadhaar_front:'Aadhaar front',aadhaar_back:'Aadhaar back'};
    const documentKinds = item.documents || ['portrait','aadhaar_front','aadhaar_back'];
    for(const kind of documentKinds) {
      const title = titles[kind];
      const link = node('a'); link.href = `/api/admin/document/${item.id}/${kind}`; link.target='_blank'; link.rel='noopener';
      const image = node('img'); image.src=link.href; image.alt=title; image.loading='lazy';
      link.append(image,node('span',null,title)); images.append(link);
    }
    card.append(images);
    }
    const checks = {};
    if(item.status === 'pending') {
      const checklist = node('div','review-checks');
      const requiredChecks = item.has_documents
        ? [['photosChecked','All uploaded photos are clear'],['identityChecked','Name and all ID documents checked'],['attendanceChecked','Attendance and witness side confirmed (2 per side)']]
        : [['identityChecked','Name confirmed'],['attendanceChecked','Attendance and witness side confirmed (2 per side)']];
      for(const [key,label] of requiredChecks) {
        const input=node('input');input.type='checkbox';input.id=`${item.id}-${key}`; checks[key]=input;
        const wrapper=node('label');wrapper.append(input,document.createTextNode(label));checklist.append(wrapper);
      }
      card.append(checklist);
    }
    const actions = node('div','admin-actions');
    if(item.status === 'pending') {
      const approve = node('button','button primary','Verify & book place');approve.type='button';approve.disabled=true;
      for(const checkbox of Object.values(checks)) checkbox.addEventListener('change',()=>approve.disabled=!Object.values(checks).every(input=>input.checked));
      approve.addEventListener('click',()=>review(item,'verify',Object.fromEntries(Object.entries(checks).map(([key,input])=>[key,input.checked]))));
      actions.append(approve);
    }
    if(item.status !== 'rejected') {
      const reject = node('button','button secondary',item.status === 'verified' ? 'Release place' : 'Decline');reject.type='button';
      reject.addEventListener('click',()=> { if(confirm(item.status === 'verified' ? 'Release this witness place? The public count will update.' : 'Decline this submission?')) review(item,'reject'); });
      actions.append(reject);
    }
    const remove = node('button','text-button','Delete submission');remove.type='button';
    remove.addEventListener('click',()=> { if(confirm(item.has_documents ? 'Permanently delete this submission and its uploaded photos?' : 'Permanently delete this submission?')) review(item,'delete'); });
    actions.append(remove);card.append(actions);list.append(card);
  }
}
async function review(item, action, extra = {}) {
  if(busy) return;busy=true;
  for(const button of document.querySelectorAll('.admin-actions button')) button.disabled=true;
  try {
    const response = await fetch(`/api/admin/requests/${item.id}`, { method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({action,...extra}) });
    const data=await response.json();if(!response.ok) throw new Error(data.error);
    await load();
  } catch(error) { $('#admin-error').textContent=error.message;$('#admin-error').hidden=false;render(); }
  finally {busy=false;}
}
for(const tab of document.querySelectorAll('[data-filter]')) tab.addEventListener('click',()=> {
  currentFilter=tab.dataset.filter;
  for(const other of document.querySelectorAll('[data-filter]')) {other.classList.toggle('active',other===tab);other.setAttribute('aria-pressed',String(other===tab));}
  render();
});
$('#refresh').addEventListener('click',load);
async function session() {
  try {
    const response=await fetch('/api/admin/session',{cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.error);
    csrf=data.csrf;
    $('#login-panel').hidden=data.authenticated;
    $('#review-panel').hidden=!data.authenticated;
    if(data.authenticated)await load();
  } catch(error) {$('#login-panel').hidden=false;$('#login-error').textContent=error.message;}
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();$('#login-error').textContent='';$('#login-button').disabled=true;
  try {
    const response=await fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({password:$('#admin-password').value})});
    const data=await response.json();if(!response.ok)throw new Error(data.error);
    csrf=data.csrf;$('#admin-password').value='';$('#login-panel').hidden=true;$('#review-panel').hidden=false;await load();
  } catch(error){$('#login-error').textContent=error.message;}
  finally{$('#login-button').disabled=false;}
});
$('#logout').addEventListener('click',async()=>{
  await fetch('/api/admin/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}});requests=[];$('#admin-list').replaceChildren();await session();
});
session();
