// ==UserScript==
// @name         Torn Wall Presence
// @namespace    
// @version      0.3
// @description  
// @author       AquaRegia
// @match        https://www.torn.com/factions.php?step=*
// @grant        none
// ==/UserScript==

const ON_WALL_COLOR = "#f00";
const OFF_WALL_COLOR = "#0f0";

let wallPresence = JSON.parse(localStorage.wallPresence || "{}");

function tick()
{
    let now = Date.now();

    document.querySelectorAll(".members-list li.your, .members-list li.enemy").forEach(e =>
    {
        let id = e.querySelector(".user.name").href.split("XID=")[1];

        wallPresence[id] = now;
    });

    document.querySelectorAll(".members-list li.table-row").forEach(e =>
    {
        let id = e.querySelector(".user.name").href.split("XID=")[1];
        let seen = wallPresence[id] || 0;

        if((seen + 300000) < now)
        {
            e.style.backgroundColor = OFF_WALL_COLOR;
        }
        else
        {
            e.style.backgroundColor = ON_WALL_COLOR;
        }
    });

    localStorage.wallPresence = JSON.stringify(wallPresence);
}
setInterval(tick, 200);
