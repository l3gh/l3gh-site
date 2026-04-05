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

function cleanupTooltips() {
    // Find any shulker popups or item tooltips and remove them
    document.querySelectorAll('.shulker-popup, .item-tooltip').forEach(el => el.remove());
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

            if (typeof invSetPlayer === 'function') invSetPlayer(uuid); // ← add this

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
const INV_POLL_INTERVAL = 5000; // ms

// ── state ─────────────────────────────────────────────────────────────────────
let pollTimer    = null;
let viewingUuid  = null;

// ── boot ──────────────────────────────────────────────────────────────────────
(function init() {
    const params = new URLSearchParams(window.location.search);
    const uuid   = params.get('uuid');
    if (!uuid) return;
    viewingUuid = uuid;
})();

// called from players.js loadProfile after the profile is shown
function invSetPlayer(uuid) {
    viewingUuid = uuid;
    lastInvData = null;
    if (pollTimer) clearInterval(pollTimer);

    const container = document.getElementById('player-inventory');
    if (!container) return;
    container.innerHTML = '<p class="inv-waiting">Fetching inventory…</p>';

    fetchAndRender(uuid);
    pollTimer = setInterval(() => fetchAndRender(uuid), INV_POLL_INTERVAL);
}

function fetchAndRender(uuid) {
    fetch(`https://l3gh.com/api/inv/${uuid}`)
        .then(res => {
            if (res.status === 404) throw new Error('not found');
            return res.json();
        })
        .then(data => {
            if (uuid !== viewingUuid) return; 

            // Convert the data to a string to compare it easily
            const currentDataStr = JSON.stringify(data);

            // IF the string is exactly the same as last time, STOP HERE.
            if (currentDataStr === lastInvData) {
                console.log("Inventory unchanged, skipping render.");
                return; 
            }

            // Otherwise, update the cache and render
            lastInvData = currentDataStr;
            renderInventoryPanel(data);
        })
        .catch(err => {
            const container = document.getElementById('player-inventory');
            if (!container || uuid !== viewingUuid) return;
            if (err.message === 'not found') {
                container.innerHTML = '<p class="inv-waiting">No inventory data yet.</p>';
            }
        });
}

// ── rendering ─────────────────────────────────────────────────────────────────
function renderInventoryPanel(data) {
    const container = document.getElementById('player-inventory');
    if (!container) return;

    cleanupTooltips();  // i clean the ghost popups with this
    // preserve active tab across re-renders
    const activeTab = container.querySelector('.inv-tab.active');
    const activeIdx = activeTab ? parseInt(activeTab.dataset.idx) : 0;

    container.innerHTML = '';

    // source badge
    const meta = document.createElement('p');
    meta.className = 'inv-meta';
    const ago = data.timestamp ? timeAgoInv(data.timestamp) : 'unknown';
    meta.textContent = data.source === 'live'
        ? `Live · updated ${ago}`
        : `Last seen ${ago}`;
    container.appendChild(meta);

    // tabs
    const tabs = document.createElement('div');
    tabs.className = 'inv-tabs';
    const panels = [];
    ['Inventory', 'Ender Chest'].forEach((label, i) => {
        const btn = document.createElement('button');
        btn.textContent  = label;
        btn.className    = 'inv-tab' + (i === activeIdx ? ' active' : '');
        btn.dataset.idx  = i;
        btn.onclick      = () => switchTab(i, tabs, panels);
        tabs.appendChild(btn);
    });
    container.appendChild(tabs);

    // ── panel 0: main inventory ───────────────────────────────────────────────
    const invPanel = document.createElement('div');
    invPanel.className = 'inv-panel' + (activeIdx !== 0 ? ' hidden' : '');

    const slots = {};
    (data.inventory || []).forEach(e => { if (e.item) slots[e.slot] = e.item; });

    const mainArea = document.createElement('div');
    mainArea.className = 'inv-main-area';

    // armor column (head→feet top to bottom = slots 39,38,37,36)
    const armorCol = document.createElement('div');
    armorCol.className = 'inv-armor-col';
    [39, 38, 37, 36].forEach(s => armorCol.appendChild(makeSlot(slots[s])));
    mainArea.appendChild(armorCol);

    // main grid (slots 9-35, three rows)
    const mainGrid = document.createElement('div');
    mainGrid.className = 'inv-grid';
    for (let s = 9; s <= 35; s++) mainGrid.appendChild(makeSlot(slots[s]));
    mainArea.appendChild(mainGrid);

    // offhand (slot 40)
    const offhandCol = document.createElement('div');
    offhandCol.className = 'inv-armor-col';
    offhandCol.appendChild(makeSlot(slots[40]));
    mainArea.appendChild(offhandCol);

    invPanel.appendChild(mainArea);

    // hotbar (slots 0-8)
    const hotbarWrap = document.createElement('div');
    hotbarWrap.className = 'inv-hotbar-wrap';
    const hotbar = document.createElement('div');
    hotbar.className = 'inv-grid';
    for (let s = 0; s <= 8; s++) hotbar.appendChild(makeSlot(slots[s]));
    hotbarWrap.appendChild(hotbar);
    invPanel.appendChild(hotbarWrap);

    panels.push(invPanel);
    container.appendChild(invPanel);

    // ── panel 1: ender chest ──────────────────────────────────────────────────
    const ecPanel = document.createElement('div');
    ecPanel.className = 'inv-panel' + (activeIdx !== 1 ? ' hidden' : '');

    const ecSlots = {};
    (data.enderchest || []).forEach(e => { if (e.item) ecSlots[e.slot] = e.item; });

    const ecGrid = document.createElement('div');
    ecGrid.className = 'inv-grid';
    for (let s = 0; s <= 26; s++) ecGrid.appendChild(makeSlot(ecSlots[s]));
    ecPanel.appendChild(ecGrid);

    panels.push(ecPanel);
    container.appendChild(ecPanel);
}

function switchTab(index, tabs, panels) {
    tabs.querySelectorAll('.inv-tab').forEach((t, i) =>
        t.classList.toggle('active', i === index));
    panels.forEach((p, i) => p.classList.toggle('hidden', i !== index));
}

function getItemInfo(item) {
    if (!item) return null;
    
    let name = formatItemName(item.id);
    let nameClass = '';
    
    // Handle Custom Names (often JSON strings)
    if (item.nbt?.display?.Name) {
        try {
            const parsed = JSON.parse(item.nbt.display.Name);
            name = parsed.text || parsed;
            nameClass = 'rarity-uncommon'; // Color named items
        } catch(e) { name = item.nbt.display.Name; }
    }

    // Handle Enchantments
    let enchants = [];
    const rawEnchants = item.nbt?.Enchantments || item.nbt?.StoredEnchantments || [];
    rawEnchants.forEach(en => {
        const enName = en.id.replace('minecraft:', '').replace(/_/g, ' ');
        enchants.push(`${enName.charAt(0).toUpperCase() + enName.slice(1)} ${en.lvl}`);
    });

    // Handle Lore
    let lore = [];
    if (item.nbt?.display?.Lore) {
        item.nbt.display.Lore.forEach(line => {
            try {
                const parsed = JSON.parse(line);
                lore.push(parsed.text || parsed);
            } catch(e) { lore.push(line); }
        });
    }

    return { name, nameClass, enchants, lore };
}

function createTooltipElement(item, info, isSticky) {
    const div = document.createElement('div');
    div.className = 'item-tooltip' + (isSticky ? ' sticky' : '');
    
    // 1. Item Name
    let html = `<span class="tt-name ${info.nameClass}">${info.name}</span>`;
    
    // 2. Enchantments (Cyan-ish color)
    if (info.enchants && info.enchants.length > 0) {
        html += `<div class="tt-enchants">` + 
                info.enchants.map(en => `<span class="tt-enchant-line">${en}</span>`).join('') + 
                `</div>`;
    }
    
    // 3. Lore (Purple-ish color)
    if (info.lore && info.lore.length > 0) {
        html += `<div class="tt-lore">${info.lore.join('<br>')}</div>`;
    }

    div.innerHTML = html;

    // 4. Shulker Contents (Special Case)
    if (item.id.includes('shulker_box')) {
        const shulkerData = item.nbt?.BlockEntityTag?.Items || [];
        if (shulkerData.length > 0) {
            const label = document.createElement('p');
            label.className = 'shulker-label';
            label.style.marginTop = '8px';
            label.textContent = "Contents:";
            div.appendChild(label);

            const grid = document.createElement('div');
            grid.className = 'inv-grid shulker-grid tt-shulker-grid';
            
            const contents = new Array(27).fill(null);
            shulkerData.forEach(entry => {
                const s = typeof entry.Slot === 'object' ? entry.Slot.value : entry.Slot;
                const c = typeof entry.Count === 'object' ? entry.Count.value : entry.Count;
                if (s >= 0 && s < 27) {
                    contents[s] = { id: entry.id, count: c ?? 1, nbt: entry.tag };
                }
            });

            // Note: We use a simplified version of makeSlot or just images here 
            // to avoid infinite tooltip recursion!
            contents.forEach(c => {
                const s = document.createElement('div');
                s.className = 'inv-slot' + (c ? ' filled' : '');
                if (c) {
                    const img = document.createElement('img');
                    img.src = itemTexture(c.id);
                    s.appendChild(img);
                }
                grid.appendChild(s);
            });
            div.appendChild(grid);
        }
    }

    return div;
}

// ── slot element ──────────────────────────────────────────────────────────────
function makeSlot(item) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    if (!item || !item.id) return slot;

    slot.classList.add('filled');
    const info = getItemInfo(item);

    const img = document.createElement('img');
    const itemName = item.id.replace('minecraft:', '');
    img.src = itemTexture(item.id);
    img.alt = "";
    
    img.onerror = () => {
        if (img.src.includes('/item/')) {
            img.src = `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/block/${itemName}.png`;
        } 
        else if (img.src.includes('/block/')) {
            img.src = `https://minecraftitemids.com/item/32/${itemName}.png`;
        }
        else {
            img.style.display = 'none'; // Hide if completely missing
        }
    };
    slot.appendChild(img);

    if (item.count > 1) {
        const count = document.createElement('span');
        count.className = 'inv-count';
        count.textContent = item.count;
        slot.appendChild(count);
    }

    // TOOLTIP & POPUP LOGIC
    let currentPopup = null;

    const show = (isSticky) => {
        // Close any other open tooltips first
        cleanupTooltips();
        
        currentPopup = createTooltipElement(item, info, isSticky);
        document.body.appendChild(currentPopup);
        positionPopup(currentPopup, slot);
    };

    const hide = () => {
        if (currentPopup && !currentPopup.classList.contains('sticky')) {
            currentPopup.remove();
            currentPopup = null;
        }
    };

    // Desktop Hover
    slot.addEventListener('mouseenter', () => show(false));
    slot.addEventListener('mouseleave', hide);

    // Mobile/PC Click (Toggle)
    slot.addEventListener('click', (e) => {
        e.stopPropagation();
        const existing = document.querySelector('.item-tooltip.sticky');
        if (existing) {
            cleanupTooltips();
        } else {
            show(true);
        }
    });

    return slot;
}


// ── helpers ───────────────────────────────────────────────────────────────────
function positionPopup(pop, anchor) {
    const rect = anchor.getBoundingClientRect();
    const popWidth = pop.offsetWidth;
    const popHeight = pop.offsetHeight;
    const padding = 10;

    // Default position: Try to show to the right of the slot
    let x = rect.right + 10;
    let y = rect.top - 10;

    // 1. RIGHT EDGE CHECK: If it goes off the right, move it to the left of the slot
    if (x + popWidth > window.innerWidth) {
        x = rect.left - popWidth - 10;
    }

    // 2. LEFT EDGE CHECK: If it's STILL off (too wide for mobile), center it
    if (x < 0) {
        x = (window.innerWidth - popWidth) / 2;
    }

    // 3. BOTTOM EDGE CHECK: If it goes off the bottom, shift it up
    if (y + popHeight > window.innerHeight) {
        y = window.innerHeight - popHeight - padding;
    }

    // 4. TOP EDGE CHECK: Ensure it doesn't go off the top
    if (y < padding) {
        y = padding;
    }

    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
}

function itemTexture(id) {
    const name = id.replace('minecraft:', '');
    return `https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/${name}.png`;
}

function formatItemName(id) {
    return id.replace('minecraft:', '').replace(/_/g, ' ')
             .replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgoInv(ms) {
    const diff = Date.now() - ms;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
}

document.addEventListener('click', () => {
    cleanupTooltips();
});
