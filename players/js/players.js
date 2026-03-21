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
    fetch("https://l3gh.com/api/players")
        .then(res => res.json())
        .then(players => {
            const container = document.getElementById("player-list");
            container.innerHTML = "";
            players.forEach(player => {
                const card = document.createElement("div");
                card.className = "api-player-card";
                card.style.cursor = "pointer";
                card.onclick = () => {
                    window.location.href = `/players?uuid=${player.uuid}`;
                };
                const img = document.createElement("img");
                img.src = `https://mc-heads.net/face/${player.uuid}/80`;
                img.alt = player.name;
                const name = document.createElement("span");
                name.textContent = player.name;
                card.appendChild(img);
                card.appendChild(name);
                container.appendChild(card);
            });
        });
        
}

function loadProfile(uuid) {
    fetch(`https://l3gh.com/api/player/${uuid}`)
        .then(res => res.json())
        .then(data => {
            // head
            const headEl = document.getElementById("player-head");
            const img = document.createElement("img");
            img.src = `https://mc-heads.net/avatar/${uuid}/100`;
            img.alt = data.name;
            headEl.appendChild(img);

            // name
            document.getElementById("player-name").textContent = data.name;

            // stats coming soon
            renderStats(data);
        });
}

function ticksToTime(ticks) {
    const seconds = Math.floor(ticks / 20);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
}

function makeSection(title, rows) {
    const section = document.createElement("div");
    section.className = "stat-section";
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
    return section;
}

function renderStats(data) {
    const container = document.getElementById("player-stats");
    const custom = data.stats["minecraft:custom"] || {};
    const mined = data.stats["minecraft:mined"] || {};
    const pickedUp = data.stats["minecraft:picked_up"] || {};
    const dropped = data.stats["minecraft:dropped"] || {};

    container.appendChild(makeSection("Activity", [
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
        Object.entries(mined).map(([k, v]) => [k.replace("minecraft:", "").replace(/_/g, " "), v])
    ));

    container.appendChild(makeSection("Items Picked Up",
        Object.entries(pickedUp).map(([k, v]) => [k.replace("minecraft:", "").replace(/_/g, " "), v])
    ));

    container.appendChild(makeSection("Items Dropped",
        Object.entries(dropped).map(([k, v]) => [k.replace("minecraft:", "").replace(/_/g, " "), v])
    ));
}

function cmToKm(cm) {
    return (cm / 100000).toFixed(1) + " km";
}