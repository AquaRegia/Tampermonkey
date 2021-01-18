// ==UserScript==
// @name             Torn City Finds
// @namespace        
// @version          0.51
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
            e.style.width = "0";
            max = e.offsetWidth > max ? e.offsetWidth : max;
        });

        document.querySelectorAll(`#cityFindTable td:nth-child(${i}), #cityFindTable th:nth-child(${i})`).forEach(e =>
        {
            e.style.width = max + "px";
        });
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

    return parseInt(sum/quantity);
}

async function calculateTotalItemValue(items, element)
{
    element.innerHTML = "Loading...";

    var sum = 0;
    var promises = [];

    for(let item of items)
    {
        promises.push(getAverageItemCost(item.id).then(function(value)
        {
            document.querySelector("#cityFind-" + item.id).innerHTML = "$" + (value*item.amount).toLocaleString();
            document.querySelector("#cityFind-" + item.id).style.textAlign = "right";
            resizeTable();
            return value*item.amount;
        }));

        parent.innerHTML = Math.max(0, (((promises.length-3) / (items.length-3))*100)).toFixed(0) + "%";

        if(promises.length >= 10)
        {
            await sleep(2000);
        }
    }

    element.innerHTML = "$" + ((await Promise.all(promises)).reduce((a, b) => a+b, 0)).toLocaleString();
    element.style.textAlign = "right";
    element.style.textDecoration = "none";
    element.style.cursor = "auto";
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
                         name: e.title,
                         amount: 1
                        }));

                    data.push({id: "530", time: stringifyDate(new Date(Date.now())), name: "Can of Munster", amount: 1});
                    data.push({id: "532", time: stringifyDate(new Date(Date.now())), name: "Can of Red Cow", amount: 1});
                    data.push({id: "553", time: stringifyDate(new Date(Date.now())), name: "Can of Santa Shooters", amount: 1});
                    data.push({id: "555", time: stringifyDate(new Date(Date.now())), name: "Can of X-MASS", amount: 12345});

                    data = Object.values(data.reduce(function(a, b)
                    {
                        if(Object.keys(a).includes(b.id))
                        {
                            a[b.id].amount++;
                            a[b.id].time = stringifyDate(new Date(parseInt(b.ts, 36)*1000));
                        }
                        else
                        {
                            a[b.id] = b;
                        }

                        return a;
                    }, {}));

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
                    for(let item of data.sort((a, b) => a.time > b.time ? -1 : 1))
                    {
                        html += `
<tr>
<td>${item.name}</td>
<td style="text-align: center">${item.amount}</td>
<td id="cityFind-${item.id}" style="text-align: center">Unknown</td>
</tr>
`;
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
                    document.querySelector("#cityFind-total").innerHTML = data.reduce((a, b) => a + b.amount, 0);

                    resizeTable();

                    document.querySelector("#cityFind-sum").addEventListener("click", function(data)
                    {
                        return function()
                        {
                            if(document.querySelector("#cityFind-sum").innerHTML == "Calculate!")
                            {
                                calculateTotalItemValue(data, this);
                            }
                        }
                    }(data));

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
    display: table;
}

#cityFindTable th
{
    background: #eee;
}

#cityFindTable td
{
    background: #ddd;
}

#cityFindTable tbody
{
    display: block;
    max-height: ${(document.querySelector("#cityFindTable tbody tr").clientHeight * 7)+7}px;
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
