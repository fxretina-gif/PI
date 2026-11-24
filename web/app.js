/* A simple name-only registration form. */
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

function updateSubmit() {
  $('#submit').disabled = sending || availablePlaces === 0;
  $('#submit').textContent = sending ? 'Sending…' : 'Count me in ♡';
}

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
  if (sending || availablePlaces === 0) return;
  const name = $('#full-name').value.trim().replace(/\s+/gu, ' ');
  const valid = name.length >= 2 && name.length <= 80;
  $('#name-error').textContent = valid ? '' : 'Please enter your name (2–80 characters).';
  $('#full-name').setAttribute('aria-invalid', String(!valid));
  if (!valid) { $('#full-name').focus(); return; }
  // Keep retries idempotent, and give an edited name its own request ID.
  if (submittedName && submittedName !== name) submissionId = crypto.randomUUID();
  submittedName = name;
  const error = $('#submit-error');
  error.hidden = true;
  sending = true;
  updateSubmit();
  try {
    const response = await fetch('/api/witnesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: name, submissionId }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not send your name. Please try again.');
    $('#registration').hidden = true;
    $('#success').hidden = false;
    $('#success-name').textContent = name.split(' ')[0];
    $('#reference').textContent = `Your reference: ${result.reference}`;
    $('#witness-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    await refreshAvailability();
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
    error.scrollIntoView({ block: 'nearest' });
  } finally {
    sending = false;
    updateSubmit();
  }
});
$('#back-to-form').addEventListener('click', () => window.location.reload());
