/* Two-step witness registration. Document photos stay private. */
const $ = selector => document.querySelector(selector);
let sending = false;
let availablePlaces = null;
let submissionId = crypto.randomUUID();
let submittedName = '';
const witnessDialog = $('#witness-dialog');
$('#open-witness').addEventListener('click', () => witnessDialog.showModal());
$('#close-witness').addEventListener('click', () => witnessDialog.close());
$('#accept-invitation').addEventListener('click', () => {
  witnessDialog.close();
  $('#witness-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  showStep(1);
  $('#full-name').focus({ preventScroll: true });
});
witnessDialog.addEventListener('click', event => {
  if (event.target !== witnessDialog) return;
  const rect = witnessDialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) witnessDialog.close();
});

for (const node of document.querySelectorAll('[data-event]')) {
  const value = window.WEDDING?.[node.dataset.event];
  if (value) node.textContent = value;
}

const kinds = [
  { key: 'portrait', title: 'Your photo', hint: 'Passport-size, face clearly visible', facing: 'user' },
  { key: 'pan', title: 'PAN card', hint: 'Front of your PAN card', facing: 'environment' },
  { key: 'aadhaar_front', title: 'Aadhaar card', hint: 'Front, with your photo and details', facing: 'environment' },
];
const photos = new Map();
let processing = 0;
let stream = null;
let activeKind = null;
let facing = 'environment';
let cameraGeneration = 0;
let step = 1;
const icons = {
  photo: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="3" width="24" height="26" rx="3"/><circle cx="16" cy="12" r="4"/><path d="M9 25v-3a7 7 0 0 1 14 0v3"/></svg>',
  card: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="6" width="28" height="20" rx="3"/><circle cx="10" cy="14" r="3"/><path d="M5 23v-2a5 5 0 0 1 10 0v2m3-11h8m-8 5h8m-8 5h6"/></svg>',
  upload: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13V3m-4 4 4-4 4 4M3 12v5h14v-5"/></svg>',
  camera: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 5 1-2h6l1 2h4v12H2V5z"/><circle cx="10" cy="10" r="3"/></svg>',
};
for (const kind of kinds) {
  const card = document.createElement('div');
  card.className = 'document-card';
  card.id = `card-${kind.key}`;
  card.innerHTML = `<div class="document-preview">${kind.key === 'portrait' ? icons.photo : icons.card}</div><div class="document-title"><div><h3>${kind.title}</h3><p>${kind.hint}</p></div><span class="document-state">Required</span></div><div class="document-actions"><button type="button" data-upload="${kind.key}" aria-label="Upload ${kind.title}">${icons.upload}<span>Upload photo</span></button><button type="button" data-camera="${kind.key}" aria-label="Take ${kind.title}">${icons.camera}<span>Take photo</span></button></div><p class="field-error document-error" role="alert"></p><input hidden type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" data-file="${kind.key}"><input hidden type="file" accept="image/*" capture="${kind.facing}" data-native="${kind.key}">`;
  $('#document-cards').append(card);
  card.querySelector('[data-upload]').addEventListener('click', () => card.querySelector('[data-file]').click());
  card.querySelector('[data-camera]').addEventListener('click', () => openCamera(kind));
  for (const input of card.querySelectorAll('input')) {
    input.addEventListener('change', async () => {
      if (input.files?.[0]) await acceptPhoto(kind, input.files[0]);
      input.value = '';
    });
  }
}

async function normalisePhoto(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Please choose a photo smaller than 20 MB.');
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error('This photo cannot be read here. Use JPG, PNG or WebP, or take a new photo.'); }
  try {
    if (Math.min(bitmap.width, bitmap.height) < 160) throw new Error('This photo is too small. Please use a clearer photo.');
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .86));
    if (!blob) throw new Error('Could not prepare this photo. Try again.');
    if (blob.size > 3_000_000) blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .7));
    if (!blob || blob.size > 3_000_000) throw new Error('Photo is too large. Try a smaller image.');
    return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
  } finally { bitmap.close(); }
}

async function acceptPhoto(kind, file) {
  const card = $(`#card-${kind.key}`);
  const error = card.querySelector('.document-error');
  error.textContent = ''; processing++; updateSubmit();
  card.querySelector('.document-state').textContent = 'Preparing…';
  try {
    const image = await normalisePhoto(file);
    const old = photos.get(kind.key);
    if (old) URL.revokeObjectURL(old.url);
    const url = URL.createObjectURL(image);
    photos.set(kind.key, { file: image, url });
    const preview = document.createElement('img');
    preview.src = url; preview.alt = `${kind.title} preview`;
    card.querySelector('.document-preview').replaceChildren(preview);
    card.classList.add('ready');
    card.querySelector('.document-state').textContent = '✓ Ready';
    card.querySelector('[data-upload] span').textContent = 'Replace';
  } catch (e) {
    error.textContent = e.message;
    card.querySelector('.document-state').textContent = photos.has(kind.key) ? '✓ Ready' : 'Required';
  } finally { processing--; updateSubmit(); }
}

function updateSubmit() {
  const complete = photos.size === kinds.length;
  $('#continue').disabled = availablePlaces === 0 || sending;
  $('#photo-count').textContent = `${photos.size} / ${kinds.length} ready`;
  $('#submit').disabled = !complete || !$('#consent').checked || !!processing || sending || availablePlaces === 0;
  $('#submit-count').textContent = sending ? 'Please wait…' : processing ? 'Preparing photos…' : complete ? 'All 3 photos ready' : 'Add all 3 photos';
}
$('#consent').addEventListener('change', updateSubmit);

function validName() {
  const name = $('#full-name').value.trim().replace(/\s+/gu, ' ');
  const valid = name.length >= 2 && name.length <= 80;
  $('#name-error').textContent = valid ? '' : 'Please enter your name (2–80 characters).';
  $('#full-name').setAttribute('aria-invalid', String(!valid));
  if (!valid) $('#full-name').focus();
  return valid ? name : null;
}
function showStep(next) {
  if (next === 2 && !validName()) return;
  step = next;
  $('#details-fields').hidden = next !== 1;
  $('#document-fields').hidden = next !== 2;
  $('#step-name').className = next === 1 ? 'step current' : 'step done';
  $('#step-documents').className = next === 2 ? 'step current' : 'step';
  for (const [id, active] of [['#step-name', next === 1], ['#step-documents', next === 2]]) {
    if (active) $(id).setAttribute('aria-current', 'step'); else $(id).removeAttribute('aria-current');
  }
  if (next === 2) {
    $('#step-documents').disabled = false;
    $('#document-name').textContent = validName();
  }
  $('#form-description').textContent = next === 1 ? 'Start with your name, then add your document photos.' : 'Three clear photos, and you’re ready for organiser review.';
}
$('#continue').addEventListener('click', () => showStep(2));
$('#step-name').addEventListener('click', () => showStep(1));
$('#step-documents').addEventListener('click', () => showStep(2));
$('#edit-name').addEventListener('click', () => { showStep(1); $('#full-name').focus(); });
$('#registration-form').addEventListener('keydown', event => {
  if (event.key === 'Enter' && step === 1) {
    event.preventDefault();
    if (!sending && availablePlaces !== 0) showStep(2);
  }
});

async function refreshAvailability() {
  try {
    const response = await fetch('/api/availability', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    availablePlaces = result.open;
    $('#availability').innerHTML = `<span><strong>${result.booked}</strong> ${result.booked === 1 ? 'witness' : 'witnesses'} booked</span><span class="divider" aria-hidden="true"></span><span><strong>${result.open}</strong> open</span>`;
    $('#slots').replaceChildren(...result.slots.map(slot => {
      const element = document.createElement('div');
      element.className = `slot${slot.booked ? ' booked' : ''}`;
      element.setAttribute('aria-label', `Witness ${slot.number}: ${slot.booked ? 'booked' : 'open'}`);
      element.innerHTML = `<svg class="person" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="10" r="5"/><path d="M6 29v-4a10 10 0 0 1 20 0v4"/>${slot.booked ? '<path d="m21 12 3 3 6-7"/>' : ''}</svg><span>Witness ${slot.number}</span><small>${slot.booked ? '✓ Booked' : 'Open place'}</small>`;
      return element;
    }));
    $('#full-notice').hidden = result.open !== 0;
    updateSubmit();
  } catch {
    $('#availability').textContent = 'Live availability unavailable. Please refresh.';
  }
}
refreshAvailability();
setInterval(() => { if (!document.hidden) refreshAvailability(); }, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAvailability(); });

$('#registration-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (sending || processing || availablePlaces === 0) return;
  if (step === 1) { showStep(2); return; }
  const name = validName();
  if (!name) { showStep(1); return; }
  if (photos.size !== kinds.length || !$('#consent').checked) return;
  if (submittedName && submittedName !== name) submissionId = crypto.randomUUID();
  submittedName = name;
  const error = $('#submit-error'); error.hidden = true;
  const data = new FormData();
  data.append('fullName', name);
  data.append('submissionId', submissionId);
  data.append('consent', 'yes');
  for (const kind of kinds) data.append(kind.key, photos.get(kind.key).file, `${kind.key}.jpg`);
  sending = true; updateSubmit();
  try {
    const response = await fetch('/api/witnesses', { method: 'POST', body: data });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not send your photos. Please try again.');
    $('#registration').hidden = true;
    $('#success').hidden = false;
    $('#success-name').textContent = name.split(' ')[0];
    $('#reference').textContent = `Your reference: ${result.reference}`;
    for (const photo of photos.values()) URL.revokeObjectURL(photo.url);
    $('#witness-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    await refreshAvailability();
  } catch (e) {
    error.textContent = e.message; error.hidden = false;
    error.scrollIntoView({ block: 'nearest' });
  } finally { sending = false; updateSubmit(); }
});
$('#back-to-form').addEventListener('click', () => window.location.reload());

function stopCamera() {
  cameraGeneration++;
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null; $('#camera-video').srcObject = null;
}
async function startCamera() {
  stopCamera(); const generation = cameraGeneration;
  $('#camera-error').textContent = ''; $('#capture-photo').disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera preview is unavailable. Use your phone camera or upload a photo.');
    const next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
    if (generation !== cameraGeneration || !$('#camera-dialog').open) { next.getTracks().forEach(track => track.stop()); return; }
    stream = next; $('#camera-video').srcObject = next;
    await $('#camera-video').play();
    $('#capture-photo').disabled = false;
  } catch (e) {
    if (generation !== cameraGeneration) return;
    $('#camera-error').textContent = e.name === 'NotAllowedError' ? 'Camera access is off. Allow it in your browser, use your phone camera, or upload a photo.' : e.message;
  }
}
function openCamera(kind) {
  activeKind = kind; facing = kind.facing;
  $('#camera-title').textContent = kind.title;
  $('#camera-hint').textContent = kind.key === 'portrait' ? 'Face the camera. Use a plain background and good light.' : 'Fit all four corners of the card inside the frame. Keep its details clear.';
  $('.camera-view').classList.toggle('portrait', kind.key === 'portrait');
  $('#camera-dialog').showModal(); startCamera();
}
$('#close-camera').addEventListener('click', () => $('#camera-dialog').close());
$('#camera-dialog').addEventListener('close', stopCamera);
$('#flip-camera').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); });
$('#native-camera').addEventListener('click', () => {
  const input = $(`[data-native="${activeKind.key}"]`); $('#camera-dialog').close(); input.click();
});
$('#capture-photo').addEventListener('click', async () => {
  const video = $('#camera-video');
  if (!video.videoWidth || !activeKind) return;
  const kind = activeKind; const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .92));
  if (!blob) { $('#camera-error').textContent = 'Capture failed. Please try again.'; return; }
  $('#camera-dialog').close(); await acceptPhoto(kind, new File([blob], 'camera.jpg', { type: 'image/jpeg' }));
});
window.addEventListener('pagehide', stopCamera);
