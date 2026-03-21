const params = new URLSearchParams(window.location.search);
const uuid = params.get('uuid');



if (uuid) {
    document.getElementById('player-list-view').style.display = 'none';
    document.getElementById('player-profile-view').style.display = 'block';
    loadProfile(uuid);
} else {
    loadPlayerList();
    renderStats(data);
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
        });
}

function ticksToTime(ticks) {
    const seconds = Math.floor(ticks / 20);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
}

function renderStats(data) {
    const container = document.getElementById("player-stats");
    const custom = data.stats["minecraft:custom"] || {};

    // Activity section
    const activity = document.createElement("div");
    activity.className = "stat-section";
    activity.innerHTML = `
        <h3>Activity</h3>
        <p>Play Time: ${ticksToTime(custom["minecraft:play_time"] || 0)}</p>
        <p>Deaths: ${custom["minecraft:deaths"] || 0}</p>
        <p>Mob Kills: ${custom["minecraft:mob_kills"] || 0}</p>
    `;
    container.appendChild(activity);
}