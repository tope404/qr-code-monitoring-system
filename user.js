const USER_TABS = [
  ["overview", "dashboard", "Overview", "Your status right now"],
  ["settings", "settings", "Settings", "Profile and house details"],
];

let USER = { tab: "overview", q: "", overviewTab: "recent" };
let me = null;
let logs = [];

async function initUser() {
  const session = requireSession();
  if (!session) return;
  if (session.role === ROLE_ADMIN) {
    window.location.replace("admin.html");
    return;
  }

  me = await ensureMyBoarder(session);
  logs = await getLogs();

  const house = await getHouseInfo();
  if (house && house.name) $("#brand-name").textContent = house.name;

  await renderUser();
  startClock(async () => {
    if (USER.tab === "overview") await renderUser();
  });
  document.addEventListener("modal-closed", stopScanner);
}

async function ensureMyBoarder(session) {
  const list = await getBoarders();
  let mine = list.find((b) => b.phone === session.phone);
  if (!mine) {
    mine = {
      id: list.reduce((m, b) => Math.max(m, b.id || 0), 0) + 1,
      name: session.name,
      room: "Unassigned",
      phone: session.phone,
      status: "outside",
      last: "–",
    };
    list.push(mine);
    await saveBoarders(list);
  }
  return mine;
}

async function renderUser() {
  const navBtn = (t) =>
    `<button class="nav-btn ${USER.tab === t[0] ? "on" : ""}" onclick="goUserTab('${t[0]}')"><i class="ms">${t[1]}</i><span>${t[2]}</span></button>`;

  $("#nav").innerHTML =
    navBtn(USER_TABS[0]) +
    `<button class="fab" onclick="openScanner()" title="Scan gate QR code" aria-label="Scan gate QR code"><i class="ms">photo_camera</i></button>` +
    navBtn(USER_TABS[1]);

  const t = USER_TABS.find((x) => x[0] === USER.tab);
  $("#title").textContent = t[2];
  $("#sub").textContent = t[3];
  $("#view").innerHTML = await USER_VIEWS[USER.tab]();
}

const USER_VIEWS = {
  overview: viewOverview,
  settings: viewSettings,
};

async function viewOverview() {
  const inside = me.status === "inside";
  const cf = await getCurfew();
  const curfew = await isCurfew(); // <-- Add 'await' here
  const house = await getHouseInfo();
  const mine = logs.filter((l) => l.name === me.name);
  const late = mine.filter((l) => l.late).length;
  const displayedLogs = USER.overviewTab === "recent" ? mine.slice(0, 5) : mine;

  return `
    <section class="card hero fade-in">
      <h2>You are ${inside ? "inside" : "outside"}</h2>
      <p>Last scan ${esc(me.last)} · ${esc(house?.name || "Boarding house")}</p>
      <span class="pill ${inside ? "ok" : ""}">${inside ? "Inside" : "Outside"}</span>
    </section>
    <section class="stats">
      <div class="card stat"><span>My scans</span><b>${mine.length}</b></div>
      <div class="card stat"><span>Late entries</span><b>${late}</b></div>
      <div class="card stat"><span>Curfew</span><b class="${curfew ? "wn" : "ok"}">${curfew ? "Active" : "Off"}</b></div>
    </section>
    <section class="card">
      <div class="header-row" style="margin-bottom: 8px;">
        <h3 style="margin:0;">My scan activity</h3>
        <div class="segmented" style="width: auto; display: inline-flex;">
          <button class="${USER.overviewTab === 'recent' ? 'on' : ''}" onclick="setOverviewTab('recent')" style="padding: 4px 10px; font-size: 11.5px;">Recent</button>
          <button class="${USER.overviewTab === 'all' ? 'on' : ''}" onclick="setOverviewTab('all')" style="padding: 4px 10px; font-size: 11.5px;">All history</button>
        </div>
      </div>
      ${displayedLogs.map(logRow).join("") || '<div class="empty">No scans yet.</div>'}
    </section>`;
}

async function setOverviewTab(tab) {
  USER.overviewTab = tab;
  await renderUser();
}

async function viewSettings() {
  const cf = await getCurfew();
  const house = await getHouseInfo();
  return `
    <section class="card">
      <h3>My profile</h3>
      <form class="form mt" onsubmit="saveProfile(event)">
        <div class="field">
          <label for="pf-name">Full name</label>
          <input class="input" id="pf-name" required value="${esc(me.name)}">
        </div>
        <div class="field">
          <label for="pf-room">Room</label>
          <input class="input" id="pf-room" required value="${esc(me.room)}">
        </div>
        <div class="field">
          <label for="pf-phone">Contact number</label>
          <input class="input" id="pf-phone" value="${esc(me.phone)}" disabled>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Save profile</button>
      </form>
    </section>
    <section class="card">
      <h3>House details</h3>
      <div class="kv">
        <div><div class="xs mu">Boarding house</div><div class="name">${esc(house?.name || "—")}</div></div>
        <div><div class="xs mu">Address</div><div class="name">${esc(house?.address || "—")}</div></div>
        <div><div class="xs mu">Curfew</div><div class="name">${hourLabel(cf.s)} – ${hourLabel(cf.e)}</div></div>
      </div>
    </section>
    <button class="btn btn-danger btn-block" onclick="logout()"><i class="ms">logout</i>Sign out</button>`;
}

function handleToggleClick(by) {
  if (me.status === "inside") {
    openNoteModal(by);
  } else {
    gateToggle(by);
  }
}

function openNoteModal(by) {
  closeModal();
  openModal(`<h3>Leaving Note</h3>
    <p class="mu sm">Where are you going and when will you return?</p>
    <form onsubmit="submitNote(event, '${by}')" class="form mt">
      <div class="field">
        <label for="note-dest">Destination / Where are you going?</label>
        <input class="input" id="note-dest" required placeholder="e.g. Grocery store / School / Home">
      </div>
      <div class="field">
        <label for="note-return">Expected Return Time / Day</label>
        <input class="input" id="note-return" required placeholder="e.g. Later at 5:00 PM / Tomorrow 8 AM">
      </div>
      <div class="actions">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Submit &amp; Check Out</button>
      </div>
    </form>`);
  $("#note-dest").focus();
}

function submitNote(e, by) {
  e.preventDefault();
  const dest = $("#note-dest").value.trim();
  const ret = $("#note-return").value.trim();
  closeModal();
  gateToggle(by, `Going to: ${dest} | Return: ${ret}`);
}

async function goUserTab(tab) {
  USER.tab = tab;
  USER.q = "";
  await renderUser();
  window.scrollTo(0, 0);
}

async function saveProfile(e) {
  e.preventDefault();
  const name = $("#pf-name").value.trim();
  const room = $("#pf-room").value.trim();
  if (!name || !room) return;

  me.name = name;
  me.room = room;
  const list = await getBoarders();
  const idx = list.findIndex((b) => b.phone === me.phone);
  if (idx >= 0) list[idx] = me;
  await saveBoarders(list);

  const users = await getUsers();
  const u = users.find((x) => x.phone === me.phone);
  if (u && u.name !== name) {
    u.name = name;
    await saveUsers(users);
    setSession(u);
  }

  toast("Profile saved");
  await renderUser();
}

async function gateToggle(by, note = "") {
  const goingIn = me.status !== "inside";
  me.status = goingIn ? "inside" : "outside";
  me.last = nowTime();

  const list = await getBoarders();
  const b = list.find((x) => x.phone === me.phone);
  if (b) {
    b.status = me.status;
    b.last = me.last;
  }
  await saveBoarders(list);

  logs = await getLogs();
  
  if (goingIn) {
    const lastOut = logs.find((l) => l.name === me.name && l.type === "Time Out" && !l.completed);
    if (lastOut) {
      lastOut.completed = true;
    }
  }

  const curfewActive = await isCurfew(); // <-- Add 'await' here

  logs.unshift({ 
    name: me.name, 
    type: goingIn ? "Time In" : "Time Out", 
    time: me.last, 
    by, 
    late: goingIn && curfewActive,
    note: note ? note : undefined
  });
  await saveLogs(logs);

  await renderUser();
  toast(goingIn ? "Welcome home — you are marked inside" : "Take care — you are marked outside");
}

let scanStream = null;
let scanTimer = null;

function openScanner() {
  openModal(`<h3>Scan gate QR code</h3>
    <p class="mu sm">Point your camera at the gate QR code to log your time-in or time-out.</p>
    <div class="scan-frame"><video id="scan-video" class="scanner-video" playsinline muted></video></div>
    <div class="actions">
      <button class="btn btn-block" onclick="closeModal()"><i class="ms">close</i>Close</button>
    </div>`);
  startScanner();
}

async function startScanner() {
  const video = $("#scan-video");
  if (!video || !navigator.mediaDevices?.getUserMedia || !window.jsQR) {
    toast("Camera or QR reader unavailable — use the manual button instead", "error");
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = scanStream;
    await video.play();
    scanTimer = setInterval(scanFrame, 250);
  } catch {
    toast("Camera unavailable — use the manual button instead", "error");
  }
}

function scanFrame() {
  const video = $("#scan-video");
  if (!video || !video.videoWidth) return;

  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = Math.round((320 * video.videoHeight) / video.videoWidth);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = window.jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });

  if (code && code.data) handleScannedBadge(code.data.trim());
}

function handleScannedBadge(data) {
  if (data !== "BH_GATE_CHECKPOINT") {
    toast("Invalid gate QR code. Please scan the official gate code.", "error");
    return;
  }
  closeModal();
  if (me.status === "inside") {
    openNoteModal("Gate QR");
  } else {
    gateToggle("Gate QR");
  }
}

function stopScanner() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
}

(async function() {
  await initUser();
})();