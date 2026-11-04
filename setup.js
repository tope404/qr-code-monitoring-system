/* =========================================================
   setup.js – Fixed Firestore Async & Element ID Mismatches
   ========================================================= */

async function initSetup() {
  const session = getSession();
  if (!session) {
    window.location.replace("login.html");
    return;
  }

  const users = await getUsers();
  const user = users.find((u) => u.phone === session.phone);
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  const house = await getHouseInfo();

  const isAdmin = user.role === ROLE_ADMIN;
  $("#setup-title").textContent = isAdmin ? "Boarding house setup" : "Join a boarding house";
  $("#setup-sub").textContent = isAdmin
    ? "Provide basic details about your property"
    : "Tell us which boarding house you are staying in";

  if (isAdmin) renderLandlordSetup(user, house);
  else renderBoarderSetup(user, house);
}

// Initialize setup on page load
(async function() {
  await initSetup();
})();

async function markSetupDone(phone) {
  const users = await getUsers();
  const user = users.find((u) => u.phone === phone);
  if (user) {
    user.setupDone = true;
    await saveUsers(users);
  }
}

const val = (id) => document.getElementById(id).value.trim();

function renderLandlordSetup(user, house) {
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

async function saveLandlordSetup(e) {
  e.preventDefault();
  const session = getSession();
  if (!session) return;

  const houseName = $("#bh-name")?.value.trim() || "";
  const landlordName = $("#bh-owner")?.value.trim() || "";
  const address = $("#bh-address")?.value.trim() || "";
  const totalRooms = $("#bh-total-rooms")?.value || "";
  const occupiedRooms = $("#bh-occupied-rooms")?.value || "";
  const regBoarders = $("#bh-total-boarders")?.value || "";

  // Save house info to Firestore
  await saveHouseInfo({ name: houseName, landlordName, address, totalRooms, occupiedRooms, totalBoarders: regBoarders });

  // RESET GLOBAL LOGS AND BOARDERS FOR THE NEW HOUSE
  await saveLogs([]); // Clear previous scan history
  
  // Clear old boarders collection documents
  const boardersRef = db.collection("boarders");
  const snapshot = await boardersRef.get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // Mark setup as done asynchronously
  await markSetupDone(session.phone);

  toast("Setup completed successfully with a clean slate!");
  setTimeout(() => {
    window.location.href = "admin.html";
  }, 700);
}

function renderBoarderSetup(user, house) {
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

async function saveBoarderSetup(e) {
  e.preventDefault();
  const session = getSession();
  if (!session) return;

  const enteredHouseName = val("bh-join");
  
  // Fetch current house info from Firestore to check against
  const house = await getHouseInfo();

  // Strict check: if no house exists, or the name doesn't match (case-insensitive)
  if (!house || !house.name || house.name.trim().toLowerCase() !== enteredHouseName.trim().toLowerCase()) {
    toast("Boarding house name not found in the database. Please ask your landlord for the exact name.", "error");
    return; // Stop execution, prevent setup completion
  }

  const boarders = await getBoarders();
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
  
  await saveBoarders(boarders);
  writeJSON(STORE_KEYS.selected, enteredHouseName);

  await markSetupDone(session.phone);
  toast("You're all set!");
  setTimeout(() => (window.location.href = "user.html"), 700);
}