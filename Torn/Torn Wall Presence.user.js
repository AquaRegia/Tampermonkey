// ==UserScript==
// @name         Torn Wall Presence
// @namespace    
// @version      0.1
// @description  
// @author       AquaRegia
// @match        https://www.torn.com/factions.php?step=*
// @grant        none
// ==/UserScript==

let wallPresence = JSON.parse(localStorage.wallPresence || "{}");

function tick()
{
    let now = Date.now();

    document.querySelectorAll(".members-list li.your").forEach(e =>
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
            e.style.backgroundColor = "#300";
        }
    });

    localStorage.wallPresence = JSON.stringify(wallPresence);
}
setInterval(tick, 200);
