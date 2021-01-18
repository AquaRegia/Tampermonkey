// ==UserScript==
// @name         Torn Effectiveness Warning
// @namespace    
// @version      0.1
// @description  
// @author       AquaRegia
// @match        https://www.torn.com/*
// @grant        GM_addStyle
// @grant        GM_notification
// ==/UserScript==

const API_KEY = "";
const ADDICTION_WARNING = -6;
const EFFECTIVENESS_WARNING = 100;
const NOTIFICATION_INTERVAL = 21600;

function colorize(value, isTotal)
{
    var color = "";

    if(isTotal)
    {
        if(value > 100)
        {
            color = "rgb(122, 187, 32)";
        }
        else if(value < 100)
        {
            color = "rgb(241, 164, 80)";
        }
        else
        {
            color = "black";
        }
    }
    else
    {
        if(value > 0)
        {
            color = "rgb(122, 187, 32)";
        }
        else if(value < 0)
        {
            color = "rgb(251, 122, 122)";
        }
        else
        {
            color = "black";
        }
    }

    return `<span style="all: unset; color: ${color}; font-weight: 600">${value}</span>`;
}

async function getEffectiveness()
{
    var response = await fetch(`https://api.torn.com/company/?selections=employees&key=${API_KEY}`);
    var json = await response.json();

    var myId = document.querySelector("p[class*='menu-info'] a").href.split("XID=")[1];

    var result = "";

    for(let [id, employee] of Object.entries(json.company_employees))
    {
        if(id == myId)
        {
            for(let [name, value] of Object.entries(employee.effectiveness))
            {
                if(name == "total")
                {
                    if(result.length > 0)
                    {
                        result += "<br/>";
                    }
                    name = "effectiveness";
                }

                name = name.replace("_", " ");
                result += name.charAt(0).toUpperCase() + name.slice(1) + ": " + colorize(value, name=="effectiveness");
                result += "<br/>";
            }

            if(((employee.effectiveness.addiction || 0) <= ADDICTION_WARNING) || (employee.effectiveness.total || 0) <= EFFECTIVENESS_WARNING)
            {
                document.querySelector("#effectivenessWarning").innerHTML = `!`;

                if(Date.now() > new Date(parseInt(localStorage.getItem("lastEffectivenessNotification") || 0) + NOTIFICATION_INTERVAL*1000))
                {
                    localStorage.setItem("lastEffectivenessNotification", Date.now());

                    GM_notification(
                    {
                        text: `Your effectiveness (${employee.effectiveness.total}) or addiction (${employee.effectiveness.addiction || 0}) has reached its threshold!`,
                        title: "Time to rehab!",
                        timeout: 15000,
                        onclick: function() { window.focus(); },
                    });
                }
            }
        }
    }

    document.querySelector(".effectivenessLink div").innerHTML = result;
}

GM_addStyle(`

.effectivenessLink > div
{
    display: none;
    position: fixed;
    padding: 10px;

    background-color: white;
    border: 1px solid black;

    z-index: 100;
}

.effectivenessLink:hover > div
{
    display: block;
}

#effectivenessWarning
{
    position: absolute;
    right: 5px;
    color: red;
    font-weight: 600;
}

`);

var div = document.createElement("div");
var span = document.createElement("span");
span.id = "effectivenessWarning";

var jobsLink = document.querySelector("div[class*='area-row'] a[href='/jobs.php']");

if(jobsLink)
{
    jobsLink.className += " effectivenessLink";
    jobsLink.appendChild(div);
    div.after(span);

    document.addEventListener("mousemove", function(e)
    {
        div.style.left = e.clientX + 20 + "px";
        div.style.top = e.clientY + 20 + "px";
    });

    getEffectiveness();
}
