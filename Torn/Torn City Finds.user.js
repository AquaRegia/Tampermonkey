// ==UserScript==
// @name             Torn City Finds
// @namespace
// @version          0.63
// @description
// @author           AquaRegia
// @match            https://www.torn.com/city.php*
// @grant            GM_addStyle
// ==/UserScript==

const API_KEY = "";

async function sleep(ms)
{
    return new Promise(e => setTimeout(e, ms));
}

function stringifyDate(date)
{
    return date.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
}

function resizeTable()
{
    for(let i = 1; i < 4; i++)
    {
        let max = 0;

        document.querySelectorAll(`#cityFindTable td:nth-child(${i}), #cityFindTable th:nth-child(${i})`).forEach(e =>
        {
            if(!e.hasAttribute("colspan"))
            {
                let currentWidth = getComputedStyle(e).width.replace(/[^0-9]/g, "");
                max = currentWidth > max ? currentWidth : max;
            }
        });

        document.querySelectorAll(`#cityFindTable td:nth-child(${i}), #cityFindTable th:nth-child(${i})`).forEach(e =>
        {
            if(!e.hasAttribute("colspan"))
            {
                e.style.width = max + "px";
            }
        });
    }
}

function memoize(f)
{
    let cache = {};

    return function()
    {
        if(cache.hasOwnProperty(arguments[0]))
        {
            return cache[arguments[0]];
        }

        let result = f(arguments[0]);
        cache[arguments[0]] = result;

        return result;
    }
}

async function getAverageItemCost(id)
{
    var response = await fetch(`https://api.torn.com/market/${id}?selections=bazaar&key=${API_KEY}`);
    var json = await response.json();

    var quantity = 0;
    var sum = 0;

    for(let bazaar of json.bazaar)
    {
        for(let i = 0; i < bazaar.quantity; i++)
        {
            quantity += 1;
            sum += bazaar.cost;

            if(quantity >= 10)
            {
                break;
            }
        }

        if(quantity >= 10)
        {
            break;
        }
    }

    let result = parseInt(sum/quantity);

    return result;
}
getAverageItemCost = memoize(getAverageItemCost);

async function calculateTotalItemValue(dataByDate, sumElement)
{
    sumElement.innerHTML = "Loading...";

    var total = 0;
    var requests = 0;

    document.querySelectorAll("#cityFindTable td:nth-child(3)").forEach(e => (e.innerHTML = "Queued"));
    document.querySelectorAll("#cityFindTable td:nth-child(3)[class*='Total']").forEach(e => (e.innerHTML = "Loading..."));

    for(let [date, entry] of Object.entries(dataByDate).sort((a, b) => a[0] > b[0] ? -1 : 1))
    {
        if(date == "totalAmount"){continue;}

        let promises = [];

        for(let item of Object.values(entry))
        {
            let element = document.querySelector(`.cityFindDate-${date}.cityFindItem-${item.id}`);

            promises.push(getAverageItemCost(item.id).then(function(value)
            {
                element.innerHTML = "$" + (value*item.amount).toLocaleString();
                element.style.textAlign = "right";

                resizeTable();
                return value*item.amount;
            }));

            requests++;

            element.innerHTML = "Loading...";

            if(requests >= 10)
            {
                await sleep(2000);
            }
        }

        let subTotal = ((await Promise.all(promises)).reduce((a, b) => a+b, 0));
        total += subTotal;

        document.querySelector(`.cityFindDateTotal-${date}`).innerHTML = "$" + subTotal.toLocaleString();
    }

    sumElement.innerHTML = "$" + total.toLocaleString();
    sumElement.style.textAlign = "right";
    sumElement.style.textDecoration = "none";
    sumElement.style.cursor = "auto";
}

(function(open) {
    XMLHttpRequest.prototype.open = function()
    {
        var result = open.apply(this, arguments);

        if(arguments[1].includes("step=mapData"))
        {
            this.addEventListener("readystatechange", function()
            {
                if(this.readyState == 4)
                {
                    var data = JSON.parse(atob(JSON.parse(this.responseText).territoryUserItems));

                    data = data.map(e => (
                        {id: String(parseInt(e.d, 36)),
                         time: stringifyDate(new Date(parseInt(e.ts, 36)*1000)),
                         name: e.title
                        }));

                    /*data.push({id: "530", time: stringifyDate(new Date(Date.now()-10000000000)), name: "Can of Munster"});
                    data.push({id: "530", time: stringifyDate(new Date(Date.now()-10000000000)), name: "Can of Munster"});*/

                    var dataByDate = {totalAmount: data.length};

                    for(let item of data)
                    {
                        let date = item.time.split(" ")[0];

                        if(!dataByDate.hasOwnProperty(date))
                        {
                            dataByDate[date] = {};
                        }

                        if(dataByDate[date].hasOwnProperty(item.id))
                        {
                            dataByDate[date][item.id].amount++;
                        }
                        else
                        {
                            dataByDate[date][item.id] = {id: item.id, name: item.name, amount: 1};
                        }
                    }

                    console.log(dataByDate);

                    var div = document.createElement("div");

                    var html = "";

                    html += `
<table id="cityFindTable">
<thead>
<tr>
<th>Item</th>
<th>Amount</th>
<th>Value</th>
</tr>
</thead>
<tbody>`;

                    for(let [date, entry] of Object.entries(dataByDate).sort((a, b) => a[0] > b[0] ? -1 : 1))
                    {
                        if(date == "totalAmount"){continue;}

                        html += `<tr>`;
                        html += `<td colspan="3" style="text-align: center; background-color: #CCC">${date}</td>`;
                        html += `</tr>`;

                        for(let item of Object.values(entry))
                        {
                            html += `<tr style="background-color: #DDD"><td>${item.name}</td><td style="text-align: center">${item.amount}</td><td class="cityFindItem-${item.id} cityFindDate-${date}">Unknown</td></tr>`;
                        }

                        html += `<tr style="background-color: #EEE"><td style="text-align: center">Subtotal:</td><td style="text-align: center">${Object.values(entry).reduce((a, b) => a + b.amount, 0)}</td><td class="cityFindDateTotal-${date}">Unknown</td></tr>`;
                    }

                    html += `
</tbody>
<tfoot>
<tr>
<th>Total:</th>
<th id="cityFind-total">0</th>
<th id="cityFind-sum" style="text-align: center; text-decoration: underline; cursor: pointer">Calculate!</th>
</tr>
</tfoot>
</table>

`;

                    div.innerHTML += html;

                    document.querySelector("h4").after(div);
                    document.querySelector("#cityFind-total").innerHTML = dataByDate.totalAmount;

                    resizeTable();

                    document.querySelector("#cityFind-sum").addEventListener("click", function()
                    {
                        if(this.innerHTML == "Calculate!" && API_KEY.length > 0)
                        {
                            calculateTotalItemValue(dataByDate, this);
                        }
                    });

                    GM_addStyle(`

#cityFindTable, #cityFindTable *
{
    all: revert;
}

#cityFindTable
{
    clear: left;
    margin: 4px 0 -15px;
    border-collapse: collapse;
}

#cityFindTable td, #cityFindTable th
{
    border-collapse: collapse;
    border: 1px solid #000;
}

#cityFindTable td
{
    border-bottom: none;
}

#cityFindTable tr:first-child td
{
    border-top: none;
}

#cityFindTable thead, #cityFindTable tfoot, #cityFindTable tr
{
    display: table-row;
}

#cityFindTable th
{
    background: #eee;
}

#cityFindTable tbody
{
    display: block;
    max-height: 137px;
    overflow-y: scroll;
    overflow-x: hidden;
}

#cityFindTable th, #cityFindTable td
{
    padding: 5px;
}

`);

                }
            });
        }

        return result;
    };

})(XMLHttpRequest.prototype.open);
