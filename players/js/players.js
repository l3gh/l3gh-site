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
        });
      
}

function loadProfile(uuid) {
    document.getElementById("player-stats").innerHTML = '<p class="fetching-txt">Fetching...</p>';
    fetch(`https://l3gh.com/api/player/${uuid}`)
        .then(res => res.json())
        .then(data => {
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