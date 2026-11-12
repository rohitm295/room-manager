import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth, onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyCXFw-DrK_ulN3fUYtq2cT85E2mJa8RKUI",
  authDomain: "roomflow-6c920.firebaseapp.com",
  projectId: "roomflow-6c920",
  appId: "1:827966111309:web:85a6bdb0b98f3a865a2604"
});

const db = getFirestore(app);
const auth = getAuth(app);
const $ = id => document.getElementById(id);
const kind = document.body.dataset.page;

let user = null;
let loaded = false;
let editing = "";
let busy = false;

let records = {
  properties: [],
  rooms: [],
  tenants: []
};

const names = {
  properties: "Property",
  rooms: "Room",
  tenants: "Tenant"
};

const col = name =>
  collection(db, "users", user.uid, name);

const ref = (name, id) =>
  doc(db, "users", user.uid, name, id);

const active = tenant =>
  (tenant.status || "Active") === "Active";

const label = record =>
  record?.name || record?.propertyName || "Unnamed";

const money = value =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR"
  }).format(Number(value) || 0);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function floors(property) {
  return [...new Set([
    ...(Array.isArray(property?.floors) ? property.floors : []),
    ...records.rooms
      .filter(room => room.propertyId === property?.id)
      .map(room => room.floor)
  ].filter(Boolean))];
}

function notice(text) {
  $("notice").textContent = text;
  $("formNotice").textContent = text;
}

function controls() {
  for (const id of ["save", "add", "refresh"]) {
    $(id).disabled =
      busy || !user || (id !== "refresh" && !loaded);
  }

  $("cancel").disabled = busy;
}

function options(id, items, placeholder) {
  $(id).replaceChildren(new Option(placeholder, ""));

  for (const [value, text] of items) {
    $(id).add(new Option(text, value));
  }
}

function propertyOptions() {
  options(
    "propertyId",
    records.properties.map(property => [
      property.id,
      label(property)
    ]),
    "Select property"
  );
}

function floorOptions(value = "") {
  const property = records.properties.find(
    property => property.id === $("propertyId").value
  );

  options(
    "floor",
    floors(property).map(floor => [floor, floor]),
    "Select floor"
  );

  $("floor").value = value;

  if (kind === "tenants") {
    roomOptions();
  }
}

function roomOptions(value = "") {
  const propertyId = $("propertyId").value;
  const floor = $("floor").value;

  const current = records.tenants.find(
    tenant => tenant.id === editing
  );

  const availableRooms = records.rooms.filter(room => {
    const anotherTenant = records.tenants.some(tenant =>
      tenant.id !== editing &&
      active(tenant) &&
      tenant.roomId === room.id
    );

    const available =
      room.status === "Available" &&
      !room.occupantTenantId &&
      !room.occupantName &&
      !anotherTenant;

    return room.propertyId === propertyId &&
      room.floor === floor &&
      Boolean(floor) &&
      (available || current?.roomId === room.id);
  });

  if (
    current &&
    !active(current) &&
    current.roomId &&
    !availableRooms.some(room => room.id === current.roomId)
  ) {
    availableRooms.push({
      id: current.roomId,
      name: current.roomName || "Previous room",
      rent: current.monthlyRent
    });
  }

  options(
    "roomId",
    availableRooms.map(room => [
      room.id,
      `${label(room)} — ${money(room.rent)}`
    ]),
    availableRooms.length
      ? "Select available room"
      : "No available rooms"
  );

  $("roomId").value = value;
}

async function load() {
  const uid = user.uid;

  const snapshots = await Promise.all(
    ["properties", "rooms", "tenants"].map(name =>
      getDocs(col(name))
    )
  );

  if (user?.uid !== uid) {
    throw new Error("Session changed. Reload this page.");
  }

  ["properties", "rooms", "tenants"].forEach((name, index) => {
    records[name] = snapshots[index].docs.map(snapshot => ({
      ...snapshot.data(),
      id: snapshot.id
    }));
  });

  loaded = true;
  render();
  controls();
}

function render() {
  const propertyId =
    new URLSearchParams(location.search).get("propertyId");

  const visible = records[kind].filter(record =>
    kind !== "rooms" ||
    !propertyId ||
    record.propertyId === propertyId
  );

  $("list").innerHTML = visible.map(record => {
    let details = "";

    if (kind === "properties") {
      const floorSummary = floors(record).map(floor => {
        const rooms = records.rooms.filter(room =>
          room.propertyId === record.id &&
          room.floor === floor
        );

        const available = rooms.filter(room =>
          room.status === "Available" &&
          !room.occupantTenantId &&
          !room.occupantName &&
          !records.tenants.some(tenant =>
            active(tenant) && tenant.roomId === room.id
          )
        ).length;

        return `${escapeHTML(floor)}: ${rooms.length} rooms, ${available} available`;
      }).join("<br>");

      details = `
        <p>${escapeHTML(record.address)}</p>
        <p>${floorSummary || "No floors added yet."}</p>
        <p>Status: ${escapeHTML(record.status || "active")}</p>
        <a href="rooms.html?propertyId=${encodeURIComponent(record.id)}">
          Manage rooms
        </a>
      `;
    }

    if (kind === "rooms") {
      const property = records.properties.find(
        property => property.id === record.propertyId
      );

      details = `
        <p>
          ${escapeHTML(label(property))} ·
          ${escapeHTML(record.floor || "Floor not set")}
        </p>
        <p>
          ${money(record.rent)} ·
          ${escapeHTML(record.status || "")}
        </p>
        <p>${escapeHTML(record.occupantName || "")}</p>
      `;
    }

    if (kind === "tenants") {
      details = `
        <p>
          ${escapeHTML(record.propertyName)} ·
          ${escapeHTML(record.floor || "")} ·
          ${escapeHTML(record.roomName)}
        </p>
        <p>
          ${escapeHTML(record.phone)} ·
          ${money(record.monthlyRent)} ·
          ${escapeHTML(record.status || "Active")}
        </p>
        <p>
          In: ${escapeHTML(record.moveInDate || "—")}
          <br>
          Out: ${escapeHTML(record.moveOutDate || "—")}
        </p>
      `;
    }

    return `
      <article>
        <h2>${escapeHTML(label(record))}</h2>
        ${details}
        <p>
          <button type="button" data-edit="${escapeHTML(record.id)}">
            Edit
          </button>
        </p>
      </article>
    `;
  }).join("") || "<p>No records yet. Add your first record.</p>";
}

function reset() {
  notice("");
  editing = "";
  $("form").reset();

  for (const element of $("form").elements) {
    element.disabled = false;
  }

  $("formTitle").textContent = "Add " + names[kind];

  if (kind !== "properties") {
    propertyOptions();

    const propertyId =
      new URLSearchParams(location.search).get("propertyId");

    if (propertyId) {
      $("propertyId").value = propertyId;
    }

    floorOptions();
  }

  controls();
}

function edit(id) {
  const record = records[kind].find(record => record.id === id);
  if (!record) return;

  reset();
  editing = id;
  $("formTitle").textContent = "Edit " + names[kind];

  for (const element of $("form").elements) {
    if (element.name && record[element.name] !== undefined) {
      element.value = record[element.name];
    }
  }

  if (kind === "properties") {
    $("floors").value = floors(record).join("\n");
  } else {
    const previousRoom = records.rooms.find(
      room => room.id === record.roomId
    );

    floorOptions(record.floor || previousRoom?.floor || "");

    if (kind === "tenants") {
      roomOptions(record.roomId);
    }
  }

  if (kind === "tenants" && !active(record)) {
    for (const id of [
      "propertyId", "floor", "roomId", "moveInDate", "status"
    ]) {
      $(id).disabled = true;
    }
  }

  $("dialog").showModal();
}

async function saveTenant(data, id) {
  const target = id
    ? ref("tenants", id)
    : doc(col("tenants"));

  await runTransaction(db, async transaction => {
    const oldSnap = await transaction.get(target);
    const old = oldSnap.exists() ? oldSnap.data() : null;

    if (id && !old) {
      throw new Error("Tenant was removed. Refresh.");
    }

    const expected = records.tenants.find(tenant => tenant.id === id);

    if (
      expected &&
      JSON.stringify({ ...old, id }) !== JSON.stringify(expected)
    ) {
      throw new Error(
        "Tenant changed. Close the form, refresh and try again."
      );
    }

    if (old?.roomId && old.roomId !== data.roomId) {
      throw new Error(
        "Move out this tenant and add a new stay to change rooms."
      );
    }

    if (
      old &&
      !active(old) &&
      (
        active(data) ||
        old.moveInDate !== data.moveInDate ||
        old.propertyId !== data.propertyId ||
        (old.floor || "") !== data.floor
      )
    ) {
      throw new Error("This stay is closed. Add a new stay.");
    }

    if (old && !active(old)) {
      transaction.update(target, {
        ...data,
        propertyName: old.propertyName || "",
        roomName: old.roomName || "",
        updatedAt: serverTimestamp()
      });
      return;
    }

    const roomIds = [...new Set(
      [old?.roomId, data.roomId].filter(Boolean)
    )];

    const roomSnaps = new Map();

    for (const roomId of roomIds) {
      roomSnaps.set(
        roomId,
        await transaction.get(ref("rooms", roomId))
      );
    }

    const propertySnap = await transaction.get(
      ref("properties", data.propertyId)
    );

    const selectedRoomSnap = roomSnaps.get(data.roomId);
    const room = selectedRoomSnap?.exists()
      ? selectedRoomSnap.data()
      : null;

    if (
      active(data) &&
      (
        !propertySnap.exists() ||
        !room ||
        room.propertyId !== data.propertyId ||
        room.floor !== data.floor
      )
    ) {
      throw new Error("Property, floor or room changed. Refresh.");
    }

    const mine = Boolean(old) &&
      old.roomId === data.roomId &&
      active(old);

    if (
      mine &&
      room &&
      !room.occupantTenantId &&
      room.occupantName &&
      room.occupantName !== old.name
    ) {
      throw new Error("Room occupant does not match this tenant.");
    }

    if (
      active(data) &&
      mine &&
      ["Maintenance", "Inactive"].includes(room.status)
    ) {
      throw new Error("Room is unavailable. Check its status.");
    }

    if (
      active(data) &&
      !mine &&
      (
        room.status !== "Available" ||
        room.occupantTenantId ||
        room.occupantName
      )
    ) {
      throw new Error(
        "Room is no longer available. Refresh and choose another."
      );
    }

    if (
      active(data) &&
      room.occupantTenantId &&
      room.occupantTenantId !== target.id
    ) {
      throw new Error("Room already belongs to another tenant.");
    }

    if (
      active(data) &&
      records.tenants.some(tenant =>
        tenant.id !== id &&
        active(tenant) &&
        tenant.roomId === data.roomId
      )
    ) {
      throw new Error("Another existing tenant is linked to this room.");
    }

    if (old?.roomId && active(old) && !active(data)) {
      const previousSnap = roomSnaps.get(old.roomId);

      if (previousSnap?.exists()) {
        const previous = previousSnap.data();

        if (
          previous.occupantTenantId &&
          previous.occupantTenantId !== target.id
        ) {
          throw new Error("Previous room ownership changed. Refresh.");
        }

        transaction.update(ref("rooms", old.roomId), {
          status: ["Maintenance", "Inactive"].includes(previous.status)
            ? previous.status
            : "Available",
          occupantTenantId: "",
          occupantName: "",
          updatedAt: serverTimestamp()
        });
      }
    }

    if (active(data)) {
      transaction.update(ref("rooms", data.roomId), {
        status: "Occupied",
        occupantTenantId: target.id,
        occupantName: data.name,
        updatedAt: serverTimestamp()
      });
    }

    const payload = {
      ...data,
      propertyName: active(data)
        ? label(propertySnap.data())
        : old?.propertyName || "",
      roomName: active(data)
        ? label(room)
        : old?.roomName || "",
      updatedAt: serverTimestamp()
    };

    if (old) {
      transaction.update(target, payload);
    } else {
      transaction.set(target, {
        ...payload,
        createdAt: serverTimestamp()
      });
    }
  });
}

async function saveRoom(data, id) {
  const target = id
    ? ref("rooms", id)
    : doc(col("rooms"));

  await runTransaction(db, async transaction => {
    const roomSnap = await transaction.get(target);
    const old = roomSnap.exists() ? roomSnap.data() : null;

    const propertySnap = await transaction.get(
      ref("properties", data.propertyId)
    );

    if (id && !old) {
      throw new Error("Room was removed. Refresh.");
    }

    if (
      !propertySnap.exists() ||
      !floors({
        ...propertySnap.data(),
        id: data.propertyId
      }).includes(data.floor)
    ) {
      throw new Error("Select a valid property and floor.");
    }

    const linked = old && (
      old.occupantTenantId ||
      old.occupantName ||
      old.status === "Occupied" ||
      records.tenants.some(tenant =>
        active(tenant) && tenant.roomId === id
      )
    );

    if (
      linked &&
      (
        old.propertyId !== data.propertyId ||
        old.floor !== data.floor ||
        old.status !== data.status
      )
    ) {
      throw new Error(
        "Move out the tenant before changing the room location or status."
      );
    }

    if (!linked && data.status === "Occupied") {
      throw new Error("Assign occupants from the Tenants page.");
    }

    const payload = {
      ...data,
      propertyName: label(propertySnap.data()),
      updatedAt: serverTimestamp()
    };

    if (old) {
      transaction.update(target, payload);
    } else {
      transaction.set(target, {
        ...payload,
        occupantTenantId: "",
        occupantName: "",
        createdAt: serverTimestamp()
      });
    }
  });
}

$("form").addEventListener("submit", async event => {
  event.preventDefault();

  if (busy || !user || !loaded) return;

  busy = true;
  controls();
  notice("Saving…");

  try {
    const data = Object.fromEntries(new FormData($("form")));

    if (kind === "tenants" && editing) {
      const old = records.tenants.find(tenant => tenant.id === editing);

      if (old && !active(old)) {
        for (const key of [
          "propertyId", "floor", "roomId", "moveInDate", "status"
        ]) {
          data[key] = old[key] || "";
        }
      }
    }

    for (const key in data) {
      if (typeof data[key] === "string") {
        data[key] = data[key].trim();
      }
    }

    if (!data.name) {
      throw new Error("Enter a name.");
    }

    if (kind === "properties") {
      data.floors = [...new Set(
        data.floors
          .split(/\n|,/)
          .map(floor => floor.trim())
          .filter(Boolean)
      )];

      if (!data.floors.length) {
        throw new Error("Add at least one floor.");
      }

      if (
        editing &&
        records.rooms.some(room =>
          room.propertyId === editing &&
          room.floor &&
          !data.floors.includes(room.floor)
        )
      ) {
        throw new Error(
          "A floor containing rooms cannot be removed or renamed."
        );
      }

      const target = editing
        ? ref("properties", editing)
        : doc(col("properties"));

      await runTransaction(db, async transaction => {
        const snapshot = await transaction.get(target);

        if (editing && !snapshot.exists()) {
          throw new Error("Property removed. Refresh.");
        }

        const payload = {
          ...data,
          updatedAt: serverTimestamp()
        };

        if (snapshot.exists()) {
          transaction.update(target, payload);
        } else {
          transaction.set(target, {
            ...payload,
            createdAt: serverTimestamp()
          });
        }
      });
    } else if (kind === "rooms") {
      data.rent = Number(data.rent);

      if (!Number.isFinite(data.rent) || data.rent < 0) {
        throw new Error("Enter valid rent.");
      }

      if (
        records.rooms.some(room =>
          room.id !== editing &&
          room.propertyId === data.propertyId &&
          room.floor === data.floor &&
          label(room).trim().toLowerCase() === data.name.toLowerCase()
        )
      ) {
        throw new Error("Room number already exists on this floor.");
      }

      await saveRoom(data, editing);
    } else {
      if (!editing && data.status !== "Active") {
        throw new Error("Create an active stay first.");
      }

      if (!data.moveInDate) {
        throw new Error("Enter move-in date.");
      }

      if (data.status === "Inactive" && !data.moveOutDate) {
        throw new Error("Enter move-out date.");
      }

      if (data.status === "Active") {
        data.moveOutDate = "";
      }

      data.monthlyRent = Number(data.monthlyRent);
      data.securityDeposit = Number(data.securityDeposit);

      if (
        !Number.isFinite(data.monthlyRent) ||
        data.monthlyRent < 0 ||
        !Number.isFinite(data.securityDeposit) ||
        data.securityDeposit < 0
      ) {
        throw new Error("Enter valid rent and deposit.");
      }

      if (
        data.moveOutDate &&
        data.moveOutDate < data.moveInDate
      ) {
        throw new Error("Move-out must follow move-in.");
      }

      await saveTenant(data, editing);
    }

    $("dialog").close();

    try {
      await load();
      reset();
      notice("Saved successfully.");
    } catch (error) {
      loaded = false;
      notice(
        "Saved, but refresh failed. Click Refresh before another change."
      );
    }
  } catch (error) {
    console.error(error);
    notice(
      error.message || "Save failed. Check connection and permissions."
    );
  } finally {
    busy = false;
    controls();
  }
});

$("cancel").addEventListener("click", () => {
  if (!busy) $("dialog").close();
});

$("dialog").addEventListener("cancel", event => {
  if (busy) event.preventDefault();
});

$("add").addEventListener("click", () => {
  if (busy || !loaded) return;
  reset();
  $("dialog").showModal();
});

$("list").addEventListener("click", event => {
  const button = event.target.closest("[data-edit]");

  if (button && !busy && loaded) {
    edit(button.dataset.edit);
  }
});

$("refresh").addEventListener("click", async () => {
  if (busy || !user) return;

  busy = true;
  controls();

  try {
    await load();
    reset();
    notice("Refreshed.");
  } catch (error) {
    loaded = false;
    notice(error.message);
  } finally {
    busy = false;
    controls();
  }
});

if (kind !== "properties") {
  $("propertyId").addEventListener("change", () => floorOptions());

  if (kind === "tenants") {
    $("floor").addEventListener("change", () => roomOptions());

    $("roomId").addEventListener("change", () => {
      const room = records.rooms.find(
        room => room.id === $("roomId").value
      );

      if (room) {
        $("monthlyRent").value = room.rent ?? 0;
      }
    });
  }
}

onAuthStateChanged(auth, async currentUser => {
  if (!currentUser) {
    location.replace("login.html");
    return;
  }

  user = currentUser;

  try {
    await load();
    reset();
    controls();
    notice("");
  } catch (error) {
    notice("Could not load records: " + error.message);
    controls();
  }
});

controls();
