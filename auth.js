const firebaseConfig = {
  apiKey: "AIzaSyBHZ5xhgP349p4McmDjpr3a0qt3O3OzRWM",
  authDomain: "qr-code-monitoring-system.firebaseapp.com",
  projectId: "qr-code-monitoring-system",
  storageBucket: "qr-code-monitoring-system.firebasestorage.app",
  messagingSenderId: "1051126335842",
  appId: "1:1051126335842:web:e569bdeac18a70464c443b"
};


firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


const STORE_KEYS = {
  users: "users",
  session: "qbh_session", 
  info: "info",
  selected: "qbh_selected_bh",
  boarders: "boarders",
  logs: "logs",
  curfew: "curfew",
  theme: "qbh-theme",
};


const $ = (sel, root = document) => root.querySelector(sel);

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value === null || value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const initials = (n) =>
  n
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const nowTime = () => new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const hourLabel = (h) => `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;


function seedDemoData() {
  if (!localStorage.getItem(STORE_KEYS.info)) {
    writeJSON(STORE_KEYS.info, {
      name: "Quebael Boarding House",
      owner: "Maria Quebael",
      address: "Rang-Ayan, Roxas, Isabela",
      totalRooms: 6,
      occupiedRooms: 5,
      totalBoarders: 5,
    });
  }
  if (!localStorage.getItem(STORE_KEYS.curfew)) {
    writeJSON(STORE_KEYS.curfew, { s: 20, e: 5 }); // 8:00 PM – 5:00 AM
  }
}

async function getUsers() {
  try {
    const snapshot = await db.collection("users").get();
    return snapshot.docs.map(doc => doc.data());
  } catch (e) {
    console.error("Error getting users:", e);
    return [];
  }
}

async function saveUsers(users) {
  try {
    // Save each user object in a document indexed by phone number
    const batch = db.batch();
    users.forEach(u => {
      const ref = db.collection("users").doc(u.phone);
      batch.set(ref, u);
    });
    await batch.commit();
  } catch (e) {
    console.error("Error saving users:", e);
  }
}

async function getBoarders() {
  try {
    const snapshot = await db.collection("boarders").get();
    return snapshot.docs.map(doc => doc.data());
  } catch (e) {
    return [];
  }
}

async function saveBoarders(list) {
  try {
    const batch = db.batch();
    list.forEach(b => {
      const ref = db.collection("boarders").doc(String(b.id));
      batch.set(ref, b);
    });
    await batch.commit();
  } catch (e) {
    console.error("Error saving boarders:", e);
  }
}

async function getLogs() {
  try {
    const snapshot = await db.collection("logs").orderBy("time", "desc").get();
    return snapshot.docs.map(doc => doc.data());
  } catch (e) {
    return [];
  }
}

async function saveLogs(list) {
  try {
    // For logs, we can store them in a single document or individual docs
    await db.collection("metadata").doc("logs_data").set({ items: list });
  } catch (e) {
    console.error("Error saving logs:", e);
  }
}

async function getCurfew() {
  try {
    const doc = await db.collection("metadata").doc("curfew").get();
    return doc.exists ? doc.data() : { s: 20, e: 5 };
  } catch {
    return { s: 20, e: 5 };
  }
}

async function saveCurfew(cf) {
  try {
    await db.collection("metadata").doc("curfew").set(cf);
  } catch (e) {
    console.error("Error saving curfew:", e);
  }
}

async function getHouseInfo() {
  try {
    const doc = await db.collection("metadata").doc("house_info").get();
    return doc.exists ? doc.data() : null;
  } catch {
    return null;
  }
}

async function saveHouseInfo(info) {
  try {
    await db.collection("metadata").doc("house_info").set(info);
  } catch (e) {
    console.error("Error saving house info:", e);
  }
}


const getSession = () => readJSON(STORE_KEYS.session, null);
const setSession = (user) => writeJSON(STORE_KEYS.session, { name: user.name, phone: user.phone, role: user.role });
const endSession = () => localStorage.removeItem(STORE_KEYS.session);

function requireSession() {
  const session = getSession();
  if (!session) {
    window.location.replace("login.html");
    return null;
  }
  return session;
}

const dashboardFor = (user) => (user.role === ROLE_ADMIN ? "admin.html" : "user.html");

function logout() {
  endSession();
  window.location.replace("login.html");
}

function isCurfew() {
  const { s, e } = getCurfew();
  const h = new Date().getHours();
  return s > e ? h >= s || h < e : h >= s && h < e;
}


function toast(message, type = "success") {
  const wrap = $("#toast-container") || $("#toasts");
  if (!wrap) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s ease";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}


function applySavedTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORE_KEYS.theme);
  } catch {}
  const dark = saved ? saved === "dark" : false;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  const icon = $("#theme-icon");
  if (icon) icon.textContent = dark ? "light_mode" : "dark_mode";
}

function toggleTheme() {
  const dark = document.documentElement.dataset.theme !== "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem(STORE_KEYS.theme, dark ? "dark" : "light");
  } catch {}
  const icon = $("#theme-icon");
  if (icon) icon.textContent = dark ? "light_mode" : "dark_mode";
}


let _lastCurfew = null;

function startClock(onCurfewChange) {
  const tick = () => {
    const d = new Date();
    const curfew = isCurfew();

    const dateEl = $("#date");
    if (dateEl) dateEl.textContent = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

    const clockEl = $("#clock");
    if (clockEl) clockEl.textContent = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    const cfEl = $("#cf");
    if (cfEl) {
      cfEl.className = "pill " + (curfew ? "wn" : "ok");
      cfEl.textContent = curfew ? "Curfew active" : "Curfew inactive";
    }

    if (curfew !== _lastCurfew) {
      _lastCurfew = curfew;
      if (onCurfewChange) onCurfewChange(curfew);
    }
  };
  tick();
  return setInterval(tick, 1000);
}

function logRow(x) {
  const timeIn = x.type === "Time In";
  const isDoneOut = x.type === "Time Out" && x.completed;
  
  return `<div class="list-item">
    <div class="avatar ${timeIn ? "ok" : (isDoneOut ? "" : "wn")}"><i class="ms">${timeIn ? "login" : "logout"}</i></div>
    <div class="grow">
      <div class="name">${esc(x.name)}</div>
      <div class="mu sm">${esc(x.type)} by ${esc(x.by)}</div>
      ${x.note ? `<div class="mu xs" style="margin-top: 2px; color: ${isDoneOut ? 'var(--mu)' : 'var(--ac)'}; ${isDoneOut ? 'text-decoration: line-through;' : ''}">📝 ${esc(x.note)}</div>` : ""}
    </div>
    <div class="ta-r">
      <div class="name sm">${esc(x.time)}</div>
      ${x.late ? '<span class="pill dg">Late entry</span>' : ""}
      ${isDoneOut ? '<span class="pill ok" style="margin-top: 2px;">Returned</span>' : ""}
    </div>
  </div>`;
}

function openModal(html) {
  $("#ov").innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`;
}

function closeModal() {
  $("#ov").innerHTML = "";
  document.dispatchEvent(new CustomEvent("modal-closed"));
}


let authState = "login";
let selectedRole = "";

function setAuthState(state) {
  authState = state;
  renderAuth();
}

function selectRole(role) {
  selectedRole = role;
  setAuthState("register");
}

function renderAuth() {
  const container = $("#auth-content");
  if (!container) return;

  if (authState === "role-select") {
    container.innerHTML = `
      <div class="fade-in">
        <div class="auth-head">
          <h2>Welcome, first-time user!</h2>
          <p>Select your account type to get started</p>
        </div>
        <div class="form">
          <button type="button" class="option-btn" onclick="selectRole('${ROLE_BOARDER}')">
            <span class="option-icon"><i class="ms">person</i></span>
            <span class="grow">
              <b>Boarder</b>
              <span class="mu xs">I am a resident staying at the boarding house</span>
            </span>
            <i class="ms">chevron_right</i>
          </button>
          <button type="button" class="option-btn" onclick="selectRole('${ROLE_ADMIN}')">
            <span class="option-icon admin"><i class="ms">admin_panel_settings</i></span>
            <span class="grow">
              <b>Landlord / Landlady</b>
              <span class="mu xs">I own or manage the boarding house</span>
            </span>
            <i class="ms">chevron_right</i>
          </button>
        </div>
        <p class="auth-switch">Already registered? <button type="button" class="link" onclick="setAuthState('login')">Sign in here</button></p>
      </div>`;
  } else if (authState === "register") {
    container.innerHTML = `
      <div class="fade-in">
        <div class="register-head">
          <button type="button" class="back-btn" onclick="setAuthState('role-select')" title="Back"><i class="ms">arrow_back</i></button>
          <div>
            <h2>Register account</h2>
            <div class="mu xs">Signing up as: <b class="name">${esc(selectedRole)}</b></div>
          </div>
        </div>
        <form onsubmit="handleRegister(event)" class="form mt">
          <div class="field">
            <label for="reg-name">Full name</label>
            <input class="input" id="reg-name" required placeholder="e.g. Juan Dela Cruz">
          </div>
          <div class="field">
            <label for="reg-phone">Phone number</label>
            <input class="input" id="reg-phone" type="tel" required placeholder="e.g. 09171234567">
          </div>
          <div class="field">
            <label for="reg-password">Password</label>
            <input class="input" id="reg-password" type="password" required placeholder="Create a password">
          </div>
          <button type="submit" class="btn btn-primary btn-block mt">Register &amp; continue</button>
        </form>
        <p class="auth-switch">Already have an account? <button type="button" class="link" onclick="setAuthState('login')">Log in</button></p>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="fade-in">
        <div class="auth-head">
          <h2>Sign in to your account</h2>
          <p>Enter your phone number and password to access</p>
        </div>
        <form onsubmit="handleLogin(event)" class="form">
          <div class="field">
            <label for="login-phone">Phone number</label>
            <input class="input" id="login-phone" type="tel" required placeholder="e.g. 09171234567">
          </div>
          <div class="field">
            <label for="login-password">Password</label>
            <input class="input" id="login-password" type="password" required placeholder="Enter password">
          </div>
          <button type="submit" class="btn btn-primary btn-block mt">Sign in</button>
        </form>
        <p class="auth-switch">First time user? <button type="button" class="link" onclick="setAuthState('role-select')">Register account</button></p>
      </div>`;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = $("#reg-name").value.trim();
  const phone = $("#reg-phone").value.trim();
  const password = $("#reg-password").value;

  const users = await getUsers();
  if (users.some((u) => u.phone === phone)) {
    toast("That phone number is already registered", "error");
    return;
  }

  users.push({ name, phone, password, role: selectedRole, setupDone: false });
  await saveUsers(users);

  setSession({ name, phone, role: selectedRole });
  toast("Account registered! Let's set up your account.");
  setTimeout(() => (window.location.href = "setup.html"), 700);
}

async function handleLogin(e) {
  e.preventDefault();
  const phone = $("#login-phone").value.trim();
  const password = $("#login-password").value;

  const users = await getUsers();
  const user = users.find((u) => u.phone === phone && u.password === password);
  if (!user) {
    toast("Invalid phone number or password", "error");
    return;
  }

  setSession(user);
  toast(`Welcome back, ${user.name}!`);

  setTimeout(() => {
    window.location.href = user.setupDone ? dashboardFor(user) : "setup.html";
  }, 700);
}

function handleLogin(e) {
  e.preventDefault();
  const phone = $("#login-phone").value.trim();
  const password = $("#login-password").value;

  const user = getUsers().find((u) => u.phone === phone && u.password === password);
  if (!user) {
    toast("Invalid phone number or password", "error");
    return;
  }

  setSession(user);
  toast(`Welcome back, ${user.name}!`);

  setTimeout(() => {
    window.location.href = user.setupDone ? dashboardFor(user) : "setup.html";
  }, 700);
}


(async function initAuthPage() {
  seedDemoData();
  applySavedTheme();

  if ($("#auth-content")) {
    const session = getSession();
    if (session) {
      const users = await getUsers();
      const user = users.find((u) => u.phone === session.phone);
      window.location.replace(user && user.setupDone ? dashboardFor(user) : "setup.html");
      return;
    }
    renderAuth();
  }
})();