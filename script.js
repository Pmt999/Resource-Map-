/* Persist session across refresh + all previous features intact */

/* ===== Data stores (persisted in localStorage) ===== */
let helpers = JSON.parse(localStorage.getItem('helpers') || '[]');
let registeredHelpers = JSON.parse(localStorage.getItem('registeredHelpers') || '[]');
let pickupRequests = JSON.parse(localStorage.getItem('pickupRequests') || '[]');
let pickupHistory = JSON.parse(localStorage.getItem('pickupHistory') || '[]');
let notifications = JSON.parse(localStorage.getItem('notifications') || '[]');

/* Restore current user & last section if present */
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{"name":"","role":""}');
let activeSection = localStorage.getItem('activeSection') || 'map';

let userLocation = { lat: 51.5209, lng: -0.0550 };
let map = null;
let markers = [];

/* ===== Elements ===== */
const welcomeContainer = document.getElementById('welcomeContainer');
const appContainer = document.getElementById('appContainer');
const logoutBtn = document.getElementById('logoutBtn');

const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const showRegisterBtn = document.getElementById('showRegisterBtn');
const showLoginBtn = document.getElementById('showLoginBtn');

const sections = {
  map: document.getElementById('map'),
  post: document.getElementById('post'),
  history: document.getElementById('history'),
  notifications: document.getElementById('notifications')
};

const nav = {
  mapBtn: document.getElementById('mapBtn'),
  postBtn: document.getElementById('postBtn'),
  historyBtn: document.getElementById('historyBtn'),
  notifyBtn: document.getElementById('notifyBtn')
};

const welcomeNameEl = document.getElementById('welcomeName');

/* ===== Persistence helpers ===== */
function saveState() {
  localStorage.setItem('helpers', JSON.stringify(helpers));
  localStorage.setItem('registeredHelpers', JSON.stringify(registeredHelpers));
  localStorage.setItem('pickupRequests', JSON.stringify(pickupRequests));
  localStorage.setItem('pickupHistory', JSON.stringify(pickupHistory));
  localStorage.setItem('notifications', JSON.stringify(notifications));
  localStorage.setItem('currentUser', JSON.stringify(currentUser));  // NEW
  localStorage.setItem('activeSection', activeSection);              // NEW
}

/* ===== Geolocation ===== */
function getUserLocation(callback) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => { userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }; callback(true); },
      () => callback(false),
      { enableHighAccuracy: true, timeout: 6000 }
    );
  } else { callback(false); }
}

/* ===== App show/hide ===== */
function showApp() {
  welcomeContainer.style.display = 'none';
  appContainer.style.display = 'grid';
  logoutBtn.style.display = 'inline-block';
  nav.postBtn.style.display = currentUser.role === 'helper' ? 'block' : 'none';
  nav.notifyBtn.style.display = currentUser.role === 'helper' ? 'block' : 'none';
  welcomeNameEl.textContent = currentUser.name ? `Welcome, ${currentUser.name}` : '';
  saveState(); // persist session immediately
}

function showAuth() {
  welcomeContainer.style.display = 'flex';
  appContainer.style.display = 'none';
  logoutBtn.style.display = 'none';
  registerSection.style.display = 'none';
  loginSection.style.display = 'block';
  welcomeNameEl.textContent = '';
  // Clear persisted session so refresh returns to login only after explicit logout/home
  localStorage.removeItem('currentUser');
  localStorage.removeItem('activeSection');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===== Clickable brand (header) -> go Home/Login ===== */
function goHome() {
  currentUser = { name: '', role: '' };
  if (map) { map.remove(); map = null; markers = []; }
  showAuth();
}
window.goHome = goHome;

/* ===== Navigation ===== */
function showSection(sectionId) {
  Object.values(sections).forEach(s => s.classList.remove('active'));
  if (sections[sectionId]) {
    sections[sectionId].classList.add('active');
    activeSection = sectionId;   // remember last open section
    saveState();
  }

  if (sectionId === 'map') { initMap(); updateResourcesList(); }
  else if (sectionId === 'history') { renderHistory(); }
  else if (sectionId === 'notifications') { renderNotifications(); }
}
window.showSection = showSection;

/* ===== Auth UI toggle ===== */
showRegisterBtn.addEventListener('click', () => {
  loginSection.style.display = 'none';
  registerSection.style.display = 'block';
});
showLoginBtn.addEventListener('click', () => {
  registerSection.style.display = 'none';
  loginSection.style.display = 'block';
});

/* ===== Login ===== */
document.getElementById('loginForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('loginName').value.trim();
  const role = document.getElementById('role').value;
  if (!name) return alert('Please enter your name.');
  if (role === 'helper') {
    const found = registeredHelpers.find(h => h.name.toLowerCase() === name.toLowerCase());
    if (!found) return alert('Helper not registered. Please register first.');
  }
  currentUser = { name, role };
  activeSection = 'map'; // default when logging in
  showApp();
  afterLoginSetup();
  showSection(activeSection);
});

/* ===== Register ===== */
document.getElementById('registerForm').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const address = document.getElementById('regAddress').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const resource = document.getElementById('regResource').value.trim();
  if (!name || !address || !phone || !resource) return alert('Please fill all fields.');
  if (registeredHelpers.find(h => h.name.toLowerCase() === name.toLowerCase())) {
    document.getElementById('registerStatus').textContent = 'This name is already registered.'; return;
  }
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
    .then(r => r.json())
    .then(data => {
      let lat = userLocation.lat, lng = userLocation.lng;
      if (data && data.length > 0) { lat = parseFloat(data[0].lat); lng = parseFloat(data[0].lon); }
      const helperObj = { name, address, phone, lat, lng, resource };
      registeredHelpers.push(helperObj);
      helpers.push(helperObj);
      saveState();
      document.getElementById('registerStatus').textContent = 'Registered successfully! You can login now.';
      alert(`Registered as Helper: ${name}`);
      document.getElementById('registerForm').reset();
      setTimeout(() => { document.getElementById('registerStatus').textContent = ''; registerSection.style.display = 'none'; loginSection.style.display = 'block'; }, 1200);
    })
    .catch(() => {
      const helperObj = { name, address, phone, lat: userLocation.lat, lng: userLocation.lng, resource };
      registeredHelpers.push(helperObj); helpers.push(helperObj); saveState();
      document.getElementById('registerStatus').textContent = 'Registered (address geocode failed; saved with fallback location).';
      alert(`Registered as Helper: ${name}`);
      document.getElementById('registerForm').reset();
      setTimeout(() => { document.getElementById('registerStatus').textContent = ''; registerSection.style.display = 'none'; loginSection.style.display = 'block'; }, 1200);
    });
});

/* ===== Logout ===== */
logoutBtn.addEventListener('click', () => {
  if (!confirm('Are you sure you want to logout?')) return;
  goHome();
});

/* ===== Post resource (helpers only) ===== */
document.getElementById('resourceForm').addEventListener('submit', e => {
  e.preventDefault();
  const text = document.getElementById('resourcePost').value.trim();
  if (!text) return alert('Enter a resource.');
  if (currentUser.role !== 'helper') return alert('Only helpers can post resources.');
  let helperRecord = registeredHelpers.find(h => h.name.toLowerCase() === currentUser.name.toLowerCase());
  if (helperRecord) {
    helperRecord.resource = text; helperRecord.lat = userLocation.lat; helperRecord.lng = userLocation.lng;
    const idx = helpers.findIndex(h => h.name.toLowerCase() === helperRecord.name.toLowerCase());
    if (idx >= 0) helpers[idx] = helperRecord; else helpers.push(helperRecord);
  } else {
    const newHelper = { name: currentUser.name, address: 'Not provided', phone: 'Not provided', resource: text, lat: userLocation.lat, lng: userLocation.lng };
    registeredHelpers.push(newHelper); helpers.push(newHelper);
  }
  saveState();
  document.getElementById('resourceForm').reset();
  alert('Resource posted.');
  updateMap(); updateResourcesList(); showSection('map');
});

/* ===== Map ===== */
function initMap() {
  if (!map) {
    try {
      map = L.map('mapContainer', { center: [userLocation.lat, userLocation.lng], zoom: 13, preferCanvas: true, scrollWheelZoom: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19, detectRetina: true, updateWhenIdle: true, updateWhenZooming: false
      }).addTo(map);
    } catch (err) { document.getElementById('mapError').style.display = 'block'; return; }
  }
  updateMap();
}

function updateMap() {
  if (!map) return;
  markers.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m); }); markers = [];
  const userMarker = L.marker([userLocation.lat, userLocation.lng], { title: 'Your Location' }).addTo(map);
  userMarker.bindPopup('Your Location'); markers.push(userMarker);
  helpers.forEach(h => {
    const m = L.marker([h.lat, h.lng], { title: h.name }).addTo(map);
    m.bindPopup(`<b>${h.name}</b><br>${h.resource || ''}<br>Phone: ${h.phone || 'N/A'}`); markers.push(m);
  });
  if (markers.length > 0) {
    const group = new L.featureGroup(markers);
    try { map.fitBounds(group.getBounds().pad(0.2), { animate: true, maxZoom: 15 }); }
    catch { map.setView([userLocation.lat, userLocation.lng], 13); }
  }
}

/* ===== Resources list under map ===== */
function updateResourcesList() {
  const list = document.getElementById('resourcesList'); list.innerHTML = '';
  if (!helpers.length) { list.innerHTML = '<p class="muted">No resources posted yet.</p>'; return; }
  helpers.forEach((h, idx) => {
    const item = document.createElement('div'); item.className = 'resource-item'; let actionsHTML = '';
    if (currentUser.role === 'user') {
      const existingReq = pickupRequests.find(r => r.helperName.toLowerCase() === h.name.toLowerCase() && r.neederName.toLowerCase() === currentUser.name.toLowerCase() && r.status === 'requested');
      actionsHTML = `<button ${existingReq ? 'disabled' : ''} class="request-btn" data-idx="${idx}">${existingReq ? 'Requested' : 'Request Pickup'}</button>`;
    }
    if (currentUser.role === 'helper' && currentUser.name.toLowerCase() === h.name.toLowerCase()) {
      actionsHTML = `<button class="remove-resource-btn" data-idx="${idx}">Remove Resource</button>`;
    }
    item.innerHTML = `
      <div>
        <strong>${h.name}</strong><br>
        <small class="muted">Resource: ${h.resource || '—'}</small><br>
        <small class="muted">Address: ${h.address || '—'}</small><br>
        <small class="muted">Phone: ${h.phone || '—'}</small>
      </div>
      <div>${actionsHTML}</div>
    `;
    list.appendChild(item);
  });
  document.querySelectorAll('.request-btn').forEach(btn => btn.addEventListener('click', () => {
    const idx = parseInt(btn.getAttribute('data-idx'), 10); requestPickup(idx);
  }));
  document.querySelectorAll('.remove-resource-btn').forEach(btn => btn.addEventListener('click', () => {
    const idx = parseInt(btn.getAttribute('data-idx'), 10);
    if (!confirm('Remove this posted resource?')) return;
    helpers.splice(idx, 1); saveState(); updateResourcesList(); updateMap();
  }));
}

/* ===== Request & Confirm ===== */
function requestPickup(helperIdx) {
  if (currentUser.role !== 'user') return alert('Only needers can request pickup.');
  const h = helpers[helperIdx]; if (!h) return alert('Resource not found.');
  const id = 'req_' + Date.now();
  const req = { id, helperName: h.name, helperPhone: h.phone || 'N/A', neederName: currentUser.name, resource: h.resource || 'N/A', status: 'requested', timestamp: new Date().toLocaleString() };
  pickupRequests.push(req);
  notifications.push({ id, helperName: h.name, message: `Pickup requested by ${currentUser.name} for "${req.resource}".`, requestId: id, timestamp: req.timestamp });
  saveState(); alert('Pickup requested. Helper will be notified.');
  updateResourcesList(); renderNotifications();
}
window.requestPickup = requestPickup;

function confirmPickupRequest(requestId) {
  const idx = pickupRequests.findIndex(r => r.id === requestId); if (idx < 0) return alert('Request not found.');
  const r = pickupRequests[idx];
  if (currentUser.role !== 'helper' || currentUser.name.toLowerCase() !== r.helperName.toLowerCase()) return alert('You are not authorized to confirm this request.');
  if (!confirm(`Confirm pickup for ${r.neederName} (resource: ${r.resource})?`)) return;

  pickupRequests[idx].status = 'confirmed';
  pickupRequests[idx].confirmedAt = new Date().toLocaleString();
  pickupHistory.push({ id: r.id, helperName: r.helperName, helperPhone: r.helperPhone, neederName: r.neederName, resource: r.resource, timestamp: pickupRequests[idx].confirmedAt });

  helpers = helpers.filter(h => !(h.name.toLowerCase() === r.helperName.toLowerCase() && h.resource === r.resource));
  notifications = notifications.filter(n => n.requestId !== requestId);
  saveState();

  printReceipt({ helperName: r.helperName, helperPhone: r.helperPhone, neederName: r.neederName, resource: r.resource, timestamp: pickupRequests[idx].confirmedAt });

  updateMap(); updateResourcesList(); renderNotifications(); renderHistory();
}
window.confirmPickupRequest = confirmPickupRequest;

/* ===== Notifications (helpers) ===== */
function renderNotifications() {
  const list = document.getElementById('notificationList'); list.innerHTML = '';
  if (currentUser.role !== 'helper') { list.innerHTML = '<p class="muted">Login as a helper to see notifications.</p>'; return; }
  const myNotifs = notifications.filter(n => n.helperName.toLowerCase() === currentUser.name.toLowerCase());
  if (!myNotifs.length) { list.innerHTML = '<p class="muted">No notifications yet.</p>'; return; }
  myNotifs.forEach(n => {
    const req = pickupRequests.find(r => r.id === n.requestId);
    const div = document.createElement('div'); div.className = 'notification-item';
    let inner = `<div><strong>${n.message}</strong><br><small class="muted">${n.timestamp}</small></div>`;
    if (req) { inner += `<div>${req.status === 'requested' ? `<button class="confirm-btn" data-id="${req.id}">Confirm & Print Receipt</button>` : `<small class="muted">Status: ${req.status}</small>`}</div>`; }
    div.innerHTML = inner; list.appendChild(div);
  });
  document.querySelectorAll('.confirm-btn').forEach(b => b.addEventListener('click', () => {
    const id = b.getAttribute('data-id'); confirmPickupRequest(id);
  }));
}

/* ===== History (helper & needer can print) ===== */
function renderHistory() {
  const list = document.getElementById('historyList'); list.innerHTML = '';
  if (!pickupHistory.length) { list.innerHTML = '<p class="muted">No pickups recorded yet.</p>'; return; }
  const items = pickupHistory.slice().reverse();
  items.forEach((h, idx) => {
    const div = document.createElement('div'); div.className = 'history-item';
    const canPrint = (currentUser.role === 'user' && currentUser.name.toLowerCase() === (h.neederName || '').toLowerCase()) ||
                     (currentUser.role === 'helper' && currentUser.name.toLowerCase() === (h.helperName || '').toLowerCase());
    const printBtn = canPrint ? `<button class="print-history-btn" data-rev-idx="${idx}">Print Receipt</button>` : '';
    div.innerHTML = `
      <div>
        <strong>${h.helperName}</strong> — ${h.resource}<br>
        <small class="muted">Picked up by ${h.neederName} • ${h.timestamp}</small>
      </div>
      <div>${printBtn}</div>
    `;
    list.appendChild(div);
  });
  document.querySelectorAll('.print-history-btn').forEach(btn => btn.addEventListener('click', () => {
    const revIdx = parseInt(btn.getAttribute('data-rev-idx'), 10);
    const h = items[revIdx];
    printReceipt({ helperName: h.helperName, helperPhone: h.helperPhone, neederName: h.neederName, resource: h.resource, timestamp: h.timestamp });
  }));
}

/* ===== Receipt printing ===== */
function printReceipt({ helperName, helperPhone, neederName, resource, timestamp }) {
  const content = `
    <html>
      <head>
        <title>Pickup Receipt</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>
          body { font-family: 'Poppins', sans-serif; padding: 2rem; color: #0f1720; }
          h1 { color: #2563eb; margin-bottom: .5rem; }
          .details { margin-top: 1rem; font-size: 1rem; line-height: 1.5; }
          .details p { margin: .45rem 0; }
          .print-btn { margin-top: 1.25rem; padding: .6rem 1rem; background: #2563eb; color: #fff; border:none; border-radius:8px; cursor:pointer; font-weight:700; }
          @media print { .print-btn { display:none; } }
        </style>
      </head>
      <body>
        <h1>Pickup Receipt</h1>
        <div class="details">
          <p><strong>Helper:</strong> ${escapeHtml(helperName)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(helperPhone)}</p>
          <p><strong>Needer:</strong> ${escapeHtml(neederName)}</p>
          <p><strong>Resource:</strong> ${escapeHtml(resource)}</p>
          <p><strong>Date & Time:</strong> ${escapeHtml(timestamp)}</p>
        </div>
        <button class="print-btn" onclick="window.print()">Print Receipt</button>
      </body>
    </html>
  `;
  const w = window.open('', '_blank', 'width=500,height=650');
  w.document.open(); w.document.write(content); w.document.close();
}
window.printReceipt = printReceipt;

function escapeHtml(str){ if(!str) return ''; return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ===== Session bootstrap ===== */
window.onload = () => {
  if (currentUser.name && currentUser.role) {
    // Restore session & last section
    showApp();
    afterLoginSetup();
    showSection(activeSection);
  } else {
    showAuth();
  }
};

function afterLoginSetup(){
  nav.postBtn.style.display = currentUser.role === 'helper' ? 'block' : 'none';
  nav.notifyBtn.style.display = currentUser.role === 'helper' ? 'block' : 'none';
  logoutBtn.style.display = 'inline-block';
  getUserLocation(() => { initMap(); updateResourcesList(); renderNotifications(); renderHistory(); });
}
