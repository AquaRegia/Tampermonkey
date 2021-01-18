// ==UserScript==
// @name             Torn City Finds
// @namespace        
// @version          0.4
// @description
// @author           AquaRegia
// @match            https://www.torn.com/city.php*
// @grant            none
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
    var parent = element.parentNode;
    parent.innerHTML = "Loading...";

    var sum = 0;

    for(let item of items)
    {
        sum += await getAverageItemCost(item.id) * item.amount;
        await sleep(2000);

        parent.innerHTML = (((items.indexOf(item)+1) / items.length)*100).toFixed(0) + "%";
    }

    parent.innerHTML = "~$" + window.addCommas(sum);
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

                    data = Object.values(data.reduce(function(a, b)
                    {
                        if(Object.keys(a).includes(b.id))
                        {
                            console.log(a[b.id].amount);
                            a[b.id].amount++;
                        }
                        else
                        {
                            a[b.id] = b;
                        }

                        return a;
                    }, {}));

                    console.log(data);

                    var div = document.createElement("div");
                    div.style.clear = "left";
                    div.style.marginBottom = "-15px";
                    div.innerHTML = "<div>Items on map: " + data.reduce((a, b) => a + b.amount, 0) + "</div>";
                    div.innerHTML += "<div id='totalItemValue'>Total value: <span><span style='text-decoration: underline; cursor: pointer'>Calculate!</span></span></div>";

                    document.querySelector("h4").after(div);

                    document.querySelectorAll("#totalItemValue span")[1].addEventListener("click", function(data){return function(){calculateTotalItemValue(data, this)}}(data));
                }
            });
        }

        return result;
    };

})(XMLHttpRequest.prototype.open);
