const params = new URLSearchParams(window.location.search);
const uuid = params.get('uuid');


if (uuid) {
    document.getElementById('player-list-view').style.display = 'none';
    document.getElementById('player-profile-view').style.display = 'block';
    loadProfile(uuid);
    
} else {
    loadPlayerList();
}

function loadPlayerList() {
    const container = document.getElementById("player-list");
    container.innerHTML = '<p class="fetching-txt">Fetching...</p>';
    fetch("https://l3gh.com/api/players")
        .then(res => res.json())
        .then(players => {
            const container = document.getElementById("player-list");
            container.innerHTML = "";
            players.forEach(player => {
                const card = document.createElement("div");
                card.className = "api-player-card";
                card.dataset.uuid = player.uuid;
                card.style.cursor = "pointer";
                card.onclick = () => {
                    window.location.href = `/players?uuid=${player.uuid}`;
                };
                const img = document.createElement("img");
                img.src = `https://mc-heads.net/face/${player.uuid}/80`;
                img.alt = player.name;
                const name = document.createElement("span");
                name.textContent = player.name;  //name
                const time = document.createElement("span");
                time.textContent = ticksToTime(player.playTime);  //playtime
                time.style.fontSize = "0.7rem";
                time.style.color = "#444";
                card.appendChild(img);
                card.appendChild(name);
                card.appendChild(time);
                container.appendChild(card);
            });
             fetch("https://api.mcsrvstat.us/3/l3gh.com")
            .then(res => res.json())
            .then(serverData => {
                const onlineUuids = new Set(
                    (serverData?.players?.list || []).map(p => p.uuid)
                );
                players.forEach(player => {
                    if (onlineUuids.has(player.uuid)) {
                        const dot = document.createElement("span");
                        dot.className = "online-dot";
                        dot.title = "Online";
                        document.querySelector(`[data-uuid="${player.uuid}"]`)?.appendChild(dot);
                    }
                });
            });
        }).catch(err => {
    document.getElementById("player-list").innerHTML = 
        '<p style="color:#444;font-size:0.82rem;">Failed to load players. Try again later.</p>';
});
      
}

function loadProfile(uuid) {
    document.getElementById("player-stats").innerHTML = '<p class="fetching-txt">Fetching...</p>';
    fetch(`https://l3gh.com/api/player/${uuid}`)
        .then(res => res.json())
        .then(data => {
            console.log(data);
            document.getElementById("player-stats").innerHTML = "";
            const headEl = document.getElementById("player-head");
            const img = document.createElement("img");
            img.src = `https://mc-heads.net/face/${uuid}/100`;
            img.alt = data.name;
            headEl.appendChild(img);
            document.getElementById("player-name").textContent = data.name;

            const uuidEl = document.getElementById("player-uuid");
            uuidEl.textContent = uuid;
            uuidEl.style.cursor = "pointer";
            uuidEl.onclick = () => navigator.clipboard.writeText(uuid);

            renderStats(data);
        }).catch(err => {
    document.getElementById("player-stats").innerHTML = 
        '<p style="color:#444;font-size:0.82rem;">Failed to load player data. Try again later.</p>';
});
}

function ticksToTime(ticks) {
    const seconds = Math.floor(ticks / 20);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
}

function makeSection(title, rows, collapsible = false) {
    const section = document.createElement("div");
    section.className = "stat-section";

    if (rows.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No data";
        empty.style.color = "#333";
        empty.style.fontSize = "0.78rem";
        section.appendChild(empty);
        return section;
    }

    if (collapsible) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = title;
        details.appendChild(summary);

        const table = document.createElement("table");
        rows.forEach(([label, value]) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td><b>${label}</b></td><td>${value}</td>`;
            table.appendChild(tr);
        });
        details.appendChild(table);
        section.appendChild(details);
    } else {
        const h3 = document.createElement("h3");
        h3.textContent = title;
        section.appendChild(h3);

        const table = document.createElement("table");
        rows.forEach(([label, value]) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td><b>${label}</b></td><td>${value}</td>`;
            table.appendChild(tr);
        });
        section.appendChild(table);
    }

    return section;
}

function renderStats(data) {
    const container = document.getElementById("player-stats");
    const statsObj = data.stats?.stats || {};
    const custom = statsObj["minecraft:custom"] || {};
    const mined = statsObj["minecraft:mined"] || {};
    const pickedUp = statsObj["minecraft:picked_up"] || {};
    const dropped = statsObj["minecraft:dropped"] || {};

    container.appendChild(makeSection("Activity", [
        ["Last Seen", data.lastSeen ? timeAgo(data.lastSeen) : "Unknown"],
        ["Play Time", ticksToTime(custom["minecraft:play_time"] || 0)],
        ["Deaths", custom["minecraft:deaths"] || 0],
        ["Mob Kills", custom["minecraft:mob_kills"] || 0],
        ["Jumps", custom["minecraft:jump"] || 0],
        ["Times Left Game", custom["minecraft:leave_game"] || 0],
    ]));

    container.appendChild(makeSection("Combat", [
        ["Damage Dealt", custom["minecraft:damage_dealt"] || 0],
        ["Damage Taken", custom["minecraft:damage_taken"] || 0],
    ]));

    container.appendChild(makeSection("Movement", [
        ["Walking", cmToKm(custom["minecraft:walk_one_cm"] || 0)],
        ["Sprinting", cmToKm(custom["minecraft:sprint_one_cm"] || 0)],
        ["Flying", cmToKm(custom["minecraft:fly_one_cm"] || 0)],
        ["Falling", cmToKm(custom["minecraft:fall_one_cm"] || 0)],
        ["Swimming", cmToKm(custom["minecraft:swim_one_cm"] || 0)],
        ["Walking on Water", cmToKm(custom["minecraft:walk_on_water_one_cm"] || 0)],
    ]));

    container.appendChild(makeSection("Blocks Mined",
        Object.entries(mined)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k.replace("minecraft:", "").replace(/_/g, " "), v]),
        true
    ));
    container.appendChild(makeSection("Items Picked Up",
        Object.entries(pickedUp)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k.replace("minecraft:", "").replace(/_/g, " "), v]),
        true
    ));
    container.appendChild(makeSection("Items Dropped",
        Object.entries(dropped)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k.replace("minecraft:", "").replace(/_/g, " "), v]),
        true
    ));
        const coveredKeys = new Set([
        "minecraft:play_time", "minecraft:deaths", "minecraft:mob_kills",
        "minecraft:jump", "minecraft:leave_game", "minecraft:damage_dealt",
        "minecraft:damage_taken", "minecraft:walk_one_cm", "minecraft:sprint_one_cm",
        "minecraft:fly_one_cm", "minecraft:fall_one_cm", "minecraft:swim_one_cm",
        "minecraft:walk_on_water_one_cm"
    ]);

    const otherRows = Object.entries(custom)
        .filter(([k]) => !coveredKeys.has(k))
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k.replace("minecraft:", "").replace(/_/g, " "), v]);

    if (otherRows.length > 0) {
        container.appendChild(makeSection("Other", otherRows, true));
    }
}

function cmToKm(cm) {
    return (cm / 100000).toFixed(1) + " km";
}

document.getElementById("player-search").addEventListener("input", e => {
    const query = e.target.value.toLowerCase();
    document.querySelectorAll(".api-player-card").forEach(card => {
        const name = card.querySelector("span").textContent.toLowerCase();
        card.style.display = name.includes(query) ? "flex" : "none";
    });
});

function timeAgo(ms) {
    const diff = Date.now() - ms;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return "Just now";
}


// ── config ────────────────────────────────────────────────────────────────────
const INV_WS_URL   = 'wss://l3gh.com/api/inv-ws';
const INV_WS_TOKEN = 'ThisIsAnAwesomeSecretCuh123456'; // oh my buddah its on github!

// ── state ─────────────────────────────────────────────────────────────────────
let ws            = null;
let wsReady       = false;
let viewingUuid   = null;
const playerCache = {}; // uuid → last received payload

// ── boot ──────────────────────────────────────────────────────────────────────
(function init() {
    const params = new URLSearchParams(window.location.search);
    const uuid   = params.get('uuid');
    if (!uuid) return; // on list view, nothing to do
    viewingUuid = uuid;
    connectWS();
})();

// ── websocket ─────────────────────────────────────────────────────────────────
function connectWS() {
    ws = new WebSocket(INV_WS_URL);

    ws.onopen = () => {
        ws.send(JSON.stringify({ token: INV_WS_TOKEN }));
    };

    ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch { return; }
        if (msg.auth === 'ok') { wsReady = true; return; }
        if (!msg.uuid) return;

        playerCache[msg.uuid] = msg;

        // only re-render if we're currently viewing this player
        if (msg.uuid === viewingUuid) renderInventoryPanel(msg);
    };

    ws.onclose = () => {
        wsReady = false;
        setTimeout(connectWS, 4000); // reconnect
    };

    ws.onerror = () => ws.close();
}

// called from players.js loadProfile so the panel appears at the right time
function invSetPlayer(uuid) {
    viewingUuid = uuid;
    const container = document.getElementById('player-inventory');
    if (!container) return;

    if (playerCache[uuid]) {
        renderInventoryPanel(playerCache[uuid]);
    } else {
        container.innerHTML = '<p class="inv-waiting">Waiting for inventory data…</p>';
    }
}

// ── rendering ─────────────────────────────────────────────────────────────────
function renderInventoryPanel(data) {
    const container = document.getElementById('player-inventory');
    if (!container) return;
    container.innerHTML = '';

    // tabs
    const tabs = document.createElement('div');
    tabs.className = 'inv-tabs';
    ['Inventory', 'Ender Chest'].forEach((label, i) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className   = 'inv-tab' + (i === 0 ? ' active' : '');
        btn.onclick     = () => switchTab(i, tabs, panels);
        tabs.appendChild(btn);
    });
    container.appendChild(tabs);

    const panels = [];

    // ── panel 0: inventory ────────────────────────────────────────────────────
    const invPanel = document.createElement('div');
    invPanel.className = 'inv-panel';

    // build slot lookup
    const slots = {};
    (data.inventory || []).forEach(entry => {
        if (entry.item) slots[entry.slot] = entry.item;
    });

    // armor column + main grid side by side
    const mainArea = document.createElement('div');
    mainArea.className = 'inv-main-area';

    // armor (head=39 → feet=36, top to bottom)
    const armorCol = document.createElement('div');
    armorCol.className = 'inv-armor-col';
    [39, 38, 37, 36].forEach(s => armorCol.appendChild(makeSlot(slots[s], s)));
    mainArea.appendChild(armorCol);

    // main grid (rows: 9-17, 18-26, 27-35)
    const mainGrid = document.createElement('div');
    mainGrid.className = 'inv-grid';
    for (let s = 9; s <= 35; s++) mainGrid.appendChild(makeSlot(slots[s], s));
    mainArea.appendChild(mainGrid);

    // offhand (slot 40)
    const offhandCol = document.createElement('div');
    offhandCol.className = 'inv-armor-col';
    offhandCol.appendChild(makeSlot(slots[40], 40));
    mainArea.appendChild(offhandCol);

    invPanel.appendChild(mainArea);

    // hotbar (slots 0-8) — separated visually
    const hotbarWrap = document.createElement('div');
    hotbarWrap.className = 'inv-hotbar-wrap';
    const hotbar = document.createElement('div');
    hotbar.className = 'inv-grid inv-hotbar';
    for (let s = 0; s <= 8; s++) hotbar.appendChild(makeSlot(slots[s], s));
    hotbarWrap.appendChild(hotbar);
    invPanel.appendChild(hotbarWrap);

    panels.push(invPanel);
    container.appendChild(invPanel);

    // ── panel 1: ender chest ──────────────────────────────────────────────────
    const ecPanel = document.createElement('div');
    ecPanel.className = 'inv-panel hidden';

    const ecSlots = {};
    (data.enderchest || []).forEach(entry => {
        if (entry.item) ecSlots[entry.slot] = entry.item;
    });

    const ecGrid = document.createElement('div');
    ecGrid.className = 'inv-grid';
    for (let s = 0; s <= 26; s++) ecGrid.appendChild(makeSlot(ecSlots[s], s));
    ecPanel.appendChild(ecGrid);

    panels.push(ecPanel);
    container.appendChild(ecPanel);
}

function switchTab(index, tabs, panels) {
    tabs.querySelectorAll('.inv-tab').forEach((t, i) =>
        t.classList.toggle('active', i === index));
    panels.forEach((p, i) => p.classList.toggle('hidden', i !== index));
}

// ── slot element ──────────────────────────────────────────────────────────────
function makeSlot(item, slotIndex) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    if (!item) return slot;

    slot.classList.add('filled');

    const img = document.createElement('img');
    img.src   = itemTexture(item.id);
    img.alt   = item.id;
    img.onerror = () => {
        // try block texture
        const name = item.id.replace('minecraft:', '');
        img.onerror = () => { img.style.display = 'none'; };
        img.src = `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/block/${name}.png`;
    };
    slot.appendChild(img);

    if (item.count > 1) {
        const count = document.createElement('span');
        count.className = 'inv-count';
        count.textContent = item.count;
        slot.appendChild(count);
    }

    // tooltip with item name
    const name = formatItemName(item.id);
    slot.title = name;

    // shulker box: hover (desktop) / tap (mobile) popup
    if (item.id.includes('shulker_box')) {
        attachShulkerPopup(slot, item);
    }

    return slot;
}

// ── shulker popup ─────────────────────────────────────────────────────────────
function attachShulkerPopup(slot, item) {
    const items = item.nbt?.BlockEntityTag?.Items || [];
    if (items.length === 0) return;

    // build 27-slot array from NBT
    const contents = new Array(27).fill(null);
    items.forEach(entry => {
        const s = typeof entry.Slot === 'object' ? entry.Slot.value : entry.Slot;
        if (s >= 0 && s < 27) {
            contents[s] = { id: entry.id, count: entry.Count?.value ?? entry.Count ?? 1 };
        }
    });

    let popup = null;

    function showPopup() {
        if (popup) return;
        popup = document.createElement('div');
        popup.className = 'shulker-popup';

        const label = document.createElement('p');
        label.className = 'shulker-label';
        label.textContent = formatItemName(item.id);
        popup.appendChild(label);

        const grid = document.createElement('div');
        grid.className = 'inv-grid shulker-grid';
        contents.forEach((c, i) => grid.appendChild(makeSlot(c, i)));
        popup.appendChild(grid);

        document.body.appendChild(popup);
        positionPopup(popup, slot);
    }

    function hidePopup() {
        if (popup) { popup.remove(); popup = null; }
    }

    function positionPopup(pop, anchor) {
        const rect  = anchor.getBoundingClientRect();
        const pw    = pop.offsetWidth  || 200;
        const ph    = pop.offsetHeight || 100;
        let   left  = rect.left + window.scrollX;
        let   top   = rect.bottom + window.scrollY + 6;

        if (left + pw > window.innerWidth)  left = window.innerWidth  - pw - 8;
        if (top  + ph > window.innerHeight + window.scrollY) top = rect.top + window.scrollY - ph - 6;

        pop.style.left = left + 'px';
        pop.style.top  = top  + 'px';
    }

    // desktop: hover
    slot.addEventListener('mouseenter', showPopup);
    slot.addEventListener('mouseleave', hidePopup);

    // mobile: tap toggle
    slot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (popup) { hidePopup(); } else { showPopup(); }
    }, { passive: false });
}

// ── helpers ───────────────────────────────────────────────────────────────────
function itemTexture(id) {
    const name = id.replace('minecraft:', '');
    return `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/${name}.png`;
}

function formatItemName(id) {
    return id.replace('minecraft:', '').replace(/_/g, ' ')
             .replace(/\b\w/g, c => c.toUpperCase());
}