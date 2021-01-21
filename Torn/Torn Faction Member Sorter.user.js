// ==UserScript==
// @name         Torn Faction Member Sorter
// @namespace    
// @version      0.1
// @description  
// @author       AquaRegia
// @match        https://www.torn.com/factions.php?step=your*
// @grant        none
// ==/UserScript==

function sorter(a, b, partialClassName, reversedOrder)
{

    let x = a.querySelector("div[class*='" + partialClassName + "']");
    let y = b.querySelector("div[class*='" + partialClassName + "']");

    if(partialClassName.includes("member"))
    {
        x = x.firstChild.firstChild.id.split("_")[0];
        y = y.firstChild.firstChild.id.split("_")[0];
    }
    else if(partialClassName.includes("position"))
    {
        x = x.firstChild.innerHTML;
        y = y.firstChild.innerHTML;
    }

    else
    {
        x = x.innerHTML;
        y = y.innerHTML;
    }

    x = /^[0-9]+$/.test(x) ? parseInt(x) : x;
    y = /^[0-9]+$/.test(y) ? parseInt(y) : y;

    if(reversedOrder)
    {
        [x, y] = [y, x];
    }

    return x == y ? 0 : (x > y ? -1 : 1);
}

(function(original)
{
    Element.prototype.appendChild = function()
    {
        let result = original.apply(this, arguments);

        if(arguments[0].className && arguments[0].className.toString().includes("membersWrapper___"))
        {
            let rows = arguments[0].querySelectorAll("div[class^='rowWrapper___']");
            let headers = arguments[0].querySelector("[class*='tableHeader__']").querySelectorAll("[class*='level___'], [class*='days___'], [class*='position___']").forEach(function(e)
            {
                e.style.cursor = "pointer";

                e.addEventListener("click", function()
                {
                    if(rows.length > 0)
                    {
                        let sortedRows = Array.from(rows).sort((a, b) => sorter(a, b, e.classList[1], e.dataset.order == "1"));
                        e.dataset.order = e.dataset.order == "1" ? 0 : 1;

                        for(let row of sortedRows)
                        {
                            rows[0].parentNode.prepend(row);
                        }
                    }
                });
            });
        }

        return result;
    };
})(Element.prototype.appendChild);
