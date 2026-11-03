/* =========================================================
   setup.js – first-time account setup (setup.html)

   Landlord / Landlady → boarding house details → admin.html
   Boarder             → join a boarding house  → user.html
   ========================================================= */

function initSetup() {
  const session = requireSession();
  if (!session) return;

  const user = getUsers().find((u) => u.phone === session.phone);
  if (!user) {
    endSession();
    window.location.replace("login.html");
    return;
  }

  const isAdmin = user.role === ROLE_ADMIN;
  $("#setup-title").textContent = isAdmin ? "Boarding house setup" : "Join a boarding house";
  $("#setup-sub").textContent = isAdmin
    ? "Provide basic details about your property"
    : "Tell us which boarding house you are staying in";

  if (isAdmin) renderLandlordSetup(user);
  else renderBoarderSetup(user);
}

function markSetupDone() {
  const session = getSession();
  if (!session) return;
  const users = getUsers();
  const user = users.find((u) => u.phone === session.phone);
  if (user) {
    user.setupDone = true;
    saveUsers(users);
  }
}

const val = (id) => document.getElementById(id).value.trim();

/* ---------- Landlord / landlady setup ---------- */
function renderLandlordSetup(user) {
  const house = getHouseInfo();
  $("#setup-content").innerHTML = `
    <form class="form" onsubmit="saveLandlordSetup(event)">
      <div class="field">
        <label for="bh-name">Boarding house name</label>
        <input class="input" id="bh-name" required placeholder="e.g. Quebael Boarding House" value="${esc(house?.name || "")}">
      </div>
      <div class="field">
        <label for="bh-owner">Landlord / landlady name</label>
        <input class="input" id="bh-owner" required placeholder="Full name" value="${esc(user.name)}">
      </div>
      <div class="field">
        <label for="bh-address">Boarding house address</label>
        <input class="input" id="bh-address" required placeholder="e.g. Rang-Ayan, Roxas, Isabela" value="${esc(house?.address || "")}">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="bh-total-rooms">Total rooms</label>
          <input class="input" id="bh-total-rooms" type="number" min="1" required placeholder="6" value="${house?.totalRooms ?? ""}">
        </div>
        <div class="field">
          <label for="bh-occupied-rooms">Occupied rooms</label>
          <input class="input" id="bh-occupied-rooms" type="number" min="0" required placeholder="5" value="${house?.occupiedRooms ?? ""}">
        </div>
      </div>
      <div class="field">
        <label for="bh-total-boarders">Registered boarders</label>
        <input class="input" id="bh-total-boarders" type="number" min="0" required placeholder="5" value="${house?.totalBoarders ?? ""}">
      </div>
      <button type="submit" class="btn btn-primary btn-block mt">Save &amp; open admin dashboard</button>
    </form>
    <p class="auth-switch">Not you? <button type="button" class="link" onclick="logout()">Sign out</button></p>`;
}

function saveLandlordSetup(e) {
  e.preventDefault();
  saveHouseInfo({
    name: val("bh-name"),
    owner: val("bh-owner"),
    address: val("bh-address"),
    totalRooms: Number(val("bh-total-rooms")),
    occupiedRooms: Number(val("bh-occupied-rooms")),
    totalBoarders: Number(val("bh-total-boarders")),
  });
  markSetupDone();
  toast("Boarding house saved!");
  setTimeout(() => (window.location.href = "admin.html"), 700);
}


function renderBoarderSetup(user) {
  const house = getHouseInfo();
  $("#setup-content").innerHTML = `
    <form class="form" onsubmit="saveBoarderSetup(event)">
      <div class="field">
        <label for="bh-join">Boarding house name</label>
        <input class="input" id="bh-join" required placeholder="e.g. Quebael Boarding House" value="${esc(house?.name || "")}">
      </div>
      <div class="field">
        <label for="b-room">Your room</label>
        <input class="input" id="b-room" required placeholder="e.g. Room 3">
      </div>
      <div class="field">
        <label for="b-phone">Contact number</label>
        <input class="input" id="b-phone" type="tel" required value="${esc(user.phone)}">
      </div>
      <button type="submit" class="btn btn-primary btn-block">Save &amp; open my dashboard</button>
    </form>
    <p class="auth-switch">Not you? <button type="button" class="link" onclick="logout()">Sign out</button></p>`;
}

function saveBoarderSetup(e) {
  e.preventDefault();
  const session = getSession();
  if (!session) return;

  const boarders = getBoarders();
  const room = val("b-room");
  const mine = boarders.find((b) => b.phone === session.phone);
  if (mine) {
    mine.name = session.name;
    mine.room = room;
  } else {
    boarders.push({
      id: boarders.reduce((m, b) => Math.max(m, b.id || 0), 0) + 1,
      name: session.name,
      room,
      phone: session.phone,
      status: "outside",
      last: "–",
    });
  }
  saveBoarders(boarders);
  writeJSON(STORE_KEYS.selected, val("bh-join"));

  markSetupDone();
  toast("You're all set!");
  setTimeout(() => (window.location.href = "user.html"), 700);
}

initSetup();
