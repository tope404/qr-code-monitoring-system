const ADMIN_TABS = [
  ["dashboard", "dashboard", "Dashboard", "Who is in and out right now"],
  ["boarders", "group", "Boarders", "Residents and their QR codes"],
  ["logs", "history", "Scan logs", "Every time-in and time-out"],
  ["settings", "settings", "Settings", "Curfew hours and house details"],
];

let ADMIN = { tab: "dashboard", q: "", flt: "all" };
let boarders = [];
let logs = [];
let house = null;

async function initAdmin() {
  const session = requireSession();
  if (!session) return;
  if (session.role !== ROLE_ADMIN) {
    window.location.replace("user.html");
    return;
  }

  await renderAdmin();
  startClock(async () => {
    if (ADMIN.tab === "dashboard") await renderAdmin();
  });
}

async function persist() {
  await saveBoarders(boarders);
  await saveLogs(logs);
}

async function renderAdmin() {
  boarders = await getBoarders();
  logs = await getLogs();
  house = await getHouseInfo();

  if (house && house.name) $("#brand-name").textContent = house.name;

  const navBtn = (t) =>
    `<button class="nav-btn ${ADMIN.tab === t[0] ? "on" : ""}" onclick="goTab('${t[0]}')"><i class="ms">${t[1]}</i><span>${t[2]}</span></button>`;

  $("#nav").innerHTML = ADMIN_TABS.map(navBtn).join("");

  const t = ADMIN_TABS.find((x) => x[0] === ADMIN.tab);
  $("#title").textContent = t[2];
  $("#sub").textContent = t[3];
  $("#view").innerHTML = await ADMIN_VIEWS[ADMIN.tab]();
}

const ADMIN_VIEWS = {
  dashboard: viewDashboard,
  boarders: viewBoarders,
  logs: viewLogs,
  settings: viewSettings,
};

async function viewDashboard() {
  const inside = boarders.filter((b) => b.status === "inside");
  const outside = boarders.filter((b) => b.status !== "inside");
  const cf = await getCurfew();
  const curfew = await isCurfew();
  const pct = boarders.length ? Math.round((inside.length / boarders.length) * 100) : 0;
  const late = logs.filter((l) => l.late).length;

  return `
    ${
      curfew && outside.length
        ? `<div class="alert"><i class="ms">warning</i><span>Curfew is active and ${outside.length} ${
            outside.length > 1 ? "boarders are" : "boarder is"
          } still outside: ${outside.map((b) => esc(b.name)).join(", ")}.</span></div>`
        : ""
    }
    <section class="card hero fade-in">
      <h2>${inside.length} of ${boarders.length} boarders are inside</h2>
      <p>${curfew ? `Curfew is active until ${hourLabel(cf.e)}.` : `Curfew starts at ${hourLabel(cf.s)}.`}</p>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="avatar-row">
        ${boarders
          .map((b) => `<span class="avatar ${b.status === "inside" ? "ok" : ""}" title="${esc(b.name)} – ${esc(b.status)}">${initials(b.name)}</span>`)
          .join("")}
      </div>
    </section>
    <section class="stats">
      <div class="card stat"><span>Scans logged</span><b>${logs.length}</b></div>
      <div class="card stat"><span>Late entries</span><b>${late}</b></div>
      <div class="card stat"><span>Outside now</span><b>${outside.length}</b></div>
    </section>
    <section class="card">
      <h3>Currently outside</h3>
      ${
        outside
          .map(
            (b) => `<div class="list-item">
              <div class="avatar">${initials(b.name)}</div>
              <div class="grow"><div class="name">${esc(b.name)}</div><div class="mu sm">Left at ${esc(b.last)}</div></div>
            </div>`
          )
          .join("") || '<div class="empty">Everyone is inside.</div>'
      }
    </section>
    <section class="card">
      <h3>Recent activity</h3>
      ${logs.slice(0, 5).map(logRow).join("") || '<div class="empty">No scans yet today.</div>'}
    </section>`;
}

function filteredBoarders() {
  const q = ADMIN.q.toLowerCase();
  return boarders.filter((b) => b.name.toLowerCase().includes(q) || b.room.toLowerCase().includes(q));
}

function boarderCard(b) {
  const inside = b.status === "inside";
  return `<div class="card fade-in">
    <div class="list-item">
      <div class="avatar ${inside ? "ok" : ""}">${initials(b.name)}</div>
      <div class="grow">
        <div class="name">${esc(b.name)}</div>
        <div class="mu sm">${esc(b.room)} · ${esc(b.phone)}</div>
        <div class="mu sm">Last scan ${esc(b.last)}</div>
      </div>
      <span class="pill ${inside ? "ok" : ""}">${inside ? "Inside" : "Outside"}</span>
    </div>
    <div class="actions">
      <button class="btn btn-danger btn-block" title="Remove boarder" aria-label="Remove boarder" onclick="askRemove(${b.id})"><i class="ms">delete</i>Remove</button>
    </div>
  </div>`;
}

async function viewBoarders() {
  const rows = filteredBoarders();
  return `
    <div class="search-box">
      <i class="ms">search</i>
      <input class="input" placeholder="Search by name or room" value="${esc(ADMIN.q)}" oninput="onSearch(this.value)">
    </div>
    <div class="stack" id="tb">
      ${rows.map(boarderCard).join("") || '<div class="card empty">No boarders match your search.</div>'}
    </div>`;
}

function filteredLogs() {
  const q = ADMIN.q.toLowerCase();
  return logs.filter((x) => {
    if (!x) return false;
    
    // Case-insensitive check for filter type (All, Time In, Time Out)
    const matchesFlt = ADMIN.flt === "all" || 
      String(x.type || "").toLowerCase() === String(ADMIN.flt || "").toLowerCase();
    
    // Safe search check ensuring name exists before calling toLowerCase
    const matchesQ = !q || String(x.name || "").toLowerCase().includes(q);
    
    return matchesFlt && matchesQ;
  });
}

async function viewLogs() {
  const rows = filteredLogs();
  return `
    <div class="search-box">
      <i class="ms">search</i>
      <input class="input" placeholder="Search by boarder" value="${esc(ADMIN.q)}" oninput="onSearch(this.value)">
    </div>
    <div class="segmented">
      ${[["all", "All"], ["Time In", "Time in"], ["Time Out", "Time out"]]
        .map((f) => `<button class="${ADMIN.flt === f[0] ? "on" : ""}" onclick="setLogFilter('${f[0]}')">${f[1]}</button>`)
        .join("")}
    </div>
    <div class="stack" id="tb">
      ${rows.length ? `<div class="card">${rows.map(logRow).join("")}</div>` : '<div class="card empty">No scans match your filters.</div>'}
    </div>`;
}

async function viewSettings() {
  const cf = await getCurfew();
  const options = (v) =>
    Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === v ? "selected" : ""}>${hourLabel(h)}</option>`).join("");

  return `
    <section class="card">
      <h3>Curfew hours</h3>
      <p class="mu sm">Boarders who scan in during curfew are flagged as late entries.</p>
      <div class="field-row mt">
        <div class="field">
          <label for="cf-start">Curfew starts</label>
          <select class="input" id="cf-start">${options(cf.s)}</select>
        </div>
        <div class="field">
          <label for="cf-end">Curfew ends</label>
          <select class="input" id="cf-end">${options(cf.e)}</select>
        </div>
      </div>
      <button class="btn btn-primary btn-block mt" onclick="saveCurfewFromForm()">Save curfew</button>
    </section>
    <section class="card">
      <h3>Boarding house</h3>
      <div class="kv">
        <div><div class="xs mu">Name</div><div class="name">${esc(house?.name || "—")}</div></div>
        <div><div class="xs mu">Address</div><div class="name">${esc(house?.address || "—")}</div></div>
        <div><div class="xs mu">Owner</div><div class="name">${esc(house?.landlordName || house?.owner || "—")}</div></div>
        <div><div class="xs mu">Registered boarders</div><div class="name">${boarders.length}</div></div>
      </div>
    </section>
    <button class="btn btn-danger btn-block" onclick="logout()"><i class="ms">logout</i>Sign out</button>`;
}

async function goTab(tab) {
  ADMIN.tab = tab;
  ADMIN.q = "";
  ADMIN.flt = "all";
  await renderAdmin();
  window.scrollTo(0, 0);
}

function onSearch(value) {
  ADMIN.q = value;
  const el = $("#tb");
  if (!el) return;
  el.innerHTML =
    ADMIN.tab === "logs"
      ? filteredLogs().length
        ? `<div class="card">${filteredLogs().map(logRow).join("")}</div>`
        : '<div class="card empty">No scans match your filters.</div>'
      : filteredBoarders().map(boarderCard).join("") ||
        '<div class="card empty">No boarders match your search.</div>';
}

async function setLogFilter(value) {
  ADMIN.flt = value;
  await renderAdmin();
}

function askRemove(id) {
  const b = boarders.find((x) => x.id === id);
  openModal(`<h3>Remove ${esc(b.name)}?</h3>
    <p class="mu sm">Their account will be removed. Past scan logs are kept.</p>
    <div class="actions">
      <button class="btn" onclick="closeModal()">Keep boarder</button>
      <button class="btn btn-danger" onclick="removeBoarder(${id})">Remove</button>
    </div>`);
}

async function removeBoarder(id) {
  const b = boarders.find((x) => x.id === id);
  boarders = boarders.filter((x) => x.id !== id);
  await saveBoarders(boarders);
  closeModal();
  await renderAdmin();
  toast(`${b.name} removed`);
}

async function saveCurfewFromForm() {
  await saveCurfew({ s: Number($("#cf-start").value), e: Number($("#cf-end").value) });
  toast("Curfew saved");
  await renderAdmin();
}

(async function() {
  await initAdmin();
})();