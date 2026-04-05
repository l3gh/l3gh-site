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
            if (uuid !== viewingUuid) return; // navigated away
            renderInventoryPanel(data);
        })
        .catch(err => {
            const container = document.getElementById('player-inventory');
            if (!container || uuid !== viewingUuid) return;
            if (err.message === 'not found') {
                container.innerHTML = '<p class="inv-waiting">No inventory data yet — player has not logged in since the mod was installed.</p>';
            }
        });
}

// ── rendering ─────────────────────────────────────────────────────────────────
function renderInventoryPanel(data) {
    const container = document.getElementById('player-inventory');
    if (!container) return;

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

// ── slot element ──────────────────────────────────────────────────────────────
function makeSlot(item) {
    const slot = document.createElement('div');
    slot.className = 'inv-slot';
    if (!item || !item.id) return slot;

    slot.classList.add('filled');

    const img = document.createElement('img');
    img.src = itemTexture(item.id);
    img.alt = item.id;
    img.onerror = () => {
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

    slot.title = formatItemName(item.id);

    if (item.id.includes('shulker_box')) {
        attachShulkerPopup(slot, item);
    }

    return slot;
}

// ── shulker popup ─────────────────────────────────────────────────────────────
function attachShulkerPopup(slot, item) {
    const items = item.nbt?.BlockEntityTag?.Items || [];
    if (items.length === 0) return;

    const contents = new Array(27).fill(null);
    items.forEach(entry => {
        // NBT ints can be wrapped as {type, value} objects by NbtOps
        const s = typeof entry.Slot === 'object' ? entry.Slot.value : entry.Slot;
        const c = typeof entry.Count === 'object' ? entry.Count.value : entry.Count;
        if (s >= 0 && s < 27) {
            contents[s] = { id: entry.id, count: c ?? 1, nbt: entry.tag };
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
        contents.forEach(c => grid.appendChild(makeSlot(c)));
        popup.appendChild(grid);

        document.body.appendChild(popup);
        positionPopup(popup, slot);
    }

    function hidePopup() {
        if (popup) { popup.remove(); popup = null; }
    }

    function positionPopup(pop, anchor) {
        const rect = anchor.getBoundingClientRect();
        const pw   = pop.offsetWidth  || 220;
        const ph   = pop.offsetHeight || 120;
        let left   = rect.left + window.scrollX;
        let top    = rect.bottom + window.scrollY + 6;

        if (left + pw > window.innerWidth) left = window.innerWidth - pw - 8;
        if (top + ph > window.innerHeight + window.scrollY) top = rect.top + window.scrollY - ph - 6;

        pop.style.left = left + 'px';
        pop.style.top  = top  + 'px';
    }

    slot.addEventListener('mouseenter', showPopup);
    slot.addEventListener('mouseleave', hidePopup);
    slot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        popup ? hidePopup() : showPopup();
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