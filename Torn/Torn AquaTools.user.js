// ==UserScript==
// @name         Torn AquaTools
// @namespace    
// @version      1.0
// @description  
// @author       AquaRegia
// @match        https://www.torn.com/*
// @updateURL    https://github.com/AquaRegia/Tampermonkey/raw/main/Torn/Torn%20AquaTools.js
// @downloadURL  https://github.com/AquaRegia/Tampermonkey/raw/main/Torn/Torn%20AquaTools.js
// @grant        GM_addStyle
// @grant        GM_notification
// ==/UserScript==

class Utils
{
    static async sleep(ms)
    {
        return new Promise(e => setTimeout(e, ms));
    }
    
    static stringifyTimestamp(timestamp)
    {
        return new Date(timestamp).toISOString().replace("T", " ").replace("Z", "").split(".")[0];
    }
    
    static getWeekOfYear(timestamp)
    {
        let date = new Date(timestamp);
        let startOfYear = new Date(String(date.getUTCFullYear()));
        let startOfFirstWeek;
        
        if(startOfYear.getUTCDay() < 4)
        {
            startOfFirstWeek = startOfYear.valueOf() - (startOfYear.getUTCDay() - 1)*86400000;
        }
        else
        {
            startOfFirstWeek = startOfYear.valueOf() + (8 - startOfYear.getUTCDay())*86400000;
        }
        
        if(date < startOfFirstWeek)
        {
            return 53;
        }
        else
        {
            return Math.ceil(((date - startOfFirstWeek)+1) / 604800000);
        }
    }
    
    static reverseString(s)
    {
        return Array.from(s).reverse().join("");
    }
}

class AjaxModule
{
    constructor()
    {
        this.ajaxListeners = [];
        //this._forceDarkMode();
        this._overrideXhr();
        this._overrideFetch();
    }
    
    _forceDarkMode()
    {
        (function(original)
        {
            window.unsafeWindow.fetch = async function()
            {
                let result = original.apply(this, arguments);
                
                if(arguments[0].includes("=TopBanner"))
                {
                    let response = await result;
                    let jsonResponse = await response.json();
                    
                    jsonResponse.settings.hasAccessToDarkMode = true;
                    
                    return new Response(JSON.stringify(jsonResponse));
                }

                return result;
            };
        })(window.unsafeWindow.fetch);
    }
    
    _overrideXhr()
    {
        let base = this;
        
        (function(original)
        {
            window.unsafeWindow.XMLHttpRequest.prototype.open = function()
            {
                let result = original.apply(this, arguments);
                let url = arguments[1];
                
                this.addEventListener("readystatechange", function()
                {
                    if(this.readyState == 4 && this.responseText[0] == "{")
                    {
                        let json = JSON.parse(this.responseText);
                        //console.log("XHR:", json);
                        base._runAjaxCallbacks(url, false, json);
                    }
                });
                
                return result;
            };
        })(window.unsafeWindow.XMLHttpRequest.prototype.open);
    }
    
    _overrideFetch()
    {
        let base = this;
        
        (function(original)
        {
            window.unsafeWindow.fetch = async function()
            {
                let url = arguments[0];
                
                let preCall = base._runAjaxCallbacks(url, true);
                if(preCall){return new Response(JSON.stringify(preCall))};
                
                let result = await original.apply(this, arguments);
                let json = await result.clone().json();
                
                let stub = base._runAjaxCallbacks(url, false, json);

                //console.log("Fetch:", url, json);
                return stub ? new Response(JSON.stringify(stub)) : result;
            };
        })(window.unsafeWindow.fetch);
    }
    
    _runAjaxCallbacks(url, abortCall, json)
    {
        let stub;
        
        for(let listener of this.ajaxListeners)
        {
            if(url.toLowerCase().includes(listener.url.toLowerCase()))
            {
                if(abortCall == listener.abortCall)
                {
                    stub = listener.callback(json);
                }
            }
        }
        
        return stub;
    }
}

class ApiModule
{
    constructor()
    {
        this.callLog = JSON.parse(localStorage.getItem("AquaTools_ApiModule_callLog") || "[]");
        this.cacheLog = JSON.parse(localStorage.getItem("AquaTools_ApiModule_cache") || "{}");
        this.apiKey = "";
        
        setInterval(this.updateLogs.bind(this), 1000);
    }
    
    async fetch(url, cacheMs = 0)
    {
        if(this.cacheLog.hasOwnProperty(url) && (this.cacheLog[url].time + cacheMs) > Date.now())
        {
            return Promise.resolve(this.cacheLog[url].json);
        }
        
        if(this.callLog.length > 50)
        {
            await Utils.sleep(1000);
        }
        
        this.callLog.push(Date.now());
        localStorage.setItem("AquaTools_ApiModule_callLog", JSON.stringify(this.callLog));
        
        let response = await fetch(`https://api.torn.com${url}&key=${this.apiKey}`);

        response.clone().json().then(json => 
        {
            if(!json.hasOwnProperty("error"))
            {
                this.cacheLog[url] = {json: json, time: Date.now()};
                localStorage.setItem("AquaTools_ApiModule_cache", JSON.stringify(this.cacheLog));
            }
        });
        
        return response.json();
    }
    
    updateLogs()
    {
        let now = Date.now();

        this.callLog = this.callLog.filter(e => (e+60000) >= now);
        
        Object.entries(this.cacheLog).forEach(([index, item]) => 
        {
            if((item.time + 300000) < now)
            {
                delete this.cacheLog[index];
            }
        });
    }
    
    setApiKey(key)
    {
        this.apiKey = key;
    }
}

class BaseModule
{
    static _ajaxModule = new AjaxModule();
    static _apiModule = new ApiModule();
    
    constructor(targetUrl)
    {
        this.targetUrl = targetUrl;
        this.user = {};
        
        this.addAjaxListener("=TopBanner", false, json =>
        {
            this.user = json.user;
            this.onUserLoaded();
        });
    }
    
    ready()
    {
        if(document.location.href.includes(this.targetUrl))
        {
            this.init();
        }
    }
    
    setApiKey(key)
    {
        BaseModule._apiModule.setApiKey(key);
    }
    
    isApiKeyValid()
    {
        return BaseModule._apiModule.apiKeyIsValid;
    }
    
    log(...data)
    {
        console.log(this.constructor.name + ":", ...data);
    }
    
    addAjaxListener(url, abortCall, callback)
    {
        BaseModule._ajaxModule.ajaxListeners.push({url: url, abortCall: abortCall, callback: callback});
    }
    
    async api()
    {
        return await BaseModule._apiModule.fetch(...arguments);
    }
    
    onUserLoaded()
    {
        
    }
    
    replaceContent(className, callback)
    {
        let shouldStop = false;
        let firstStopSignal = true;

        new MutationObserver((mutationsList, observer) =>
        {
            let latestMutation;
            
            for(const mutation of mutationsList)
            {
                if(mutation.target.className && mutation.target.className.toString().includes(className))
                {
                    mutation.addedNodes.forEach(e => e.remove());
                    shouldStop = true;
                    latestMutation = mutation;
                }
            }

            if(shouldStop && firstStopSignal)
            {
                firstStopSignal = false;
                setTimeout(() =>
                {
                    observer.disconnect();
                    callback(latestMutation.target);
                }, 100);
            }
        }).observe(document, {childList: true, subtree: true});
    }
}

class BazaarSorterModule extends BaseModule
{
    constructor()
    {
        super("bazaar.php");
        
        this.bazaarItems = {list: [], total: Number.MAX_VALUE};
        
        this.ready();
    }
    
    init()
    {
        this.overrideAppendChild();
        this.addAjaxListeners();
    }
    
    sorter(a, b)
    {
        let aq = a.quality || 0;
        let bq = b.quality || 0;

        let order = document.querySelector("#qualityButton").dataset.order == "1";

        return order ? aq - bq : bq - aq;
    }
    
    overrideAppendChild()
    {
        let base = this;
        
        (function(original)
        {
            Element.prototype.appendChild = function()
            {
                let result = original.apply(this, arguments);

                if(arguments[0].className && arguments[0].className.toString().includes("searchBar___"))
                {
                    if(Array.from(arguments[0].classList).filter(e => e.includes("tablet")).length > 0)
                    {
                        console.log("is tablet mode, aborting");
                        return;
                    }

                    if(Array.from(arguments[0].classList).filter(e => e.includes("mobile")).length > 0)
                    {
                        console.log("is mobile mode, aborting");
                        return;
                    }

                    let searchBar = arguments[0];
                    let oldButton = searchBar.querySelector("button[aria-label*='Category']");
                    let newButton = oldButton.cloneNode(true);
                    newButton.ariaLabel = "Search bar button: Quality";
                    newButton.innerHTML = "Quality";
                    newButton.id = "qualityButton";
                    if(base.bazaarItems.list.length >= base.bazaarItems.total)
                    {
                        newButton.style.color = "green";
                        newButton.title = "";
                    }
                    else
                    {
                        newButton.style.color = "red";
                        newButton.title = "Scroll to the bottom of the page in order to enable this button";
                    }

                    let spoofClick = false;

                    searchBar.addEventListener("click", function(e)
                    {
                        if(spoofClick){return;}
                        if(base.bazaarItems.list.length < base.bazaarItems.total){return;}

                        let previousActiveElement = Array.from(searchBar.querySelectorAll("button")).filter(e => Array.from(e.classList).join().includes("active"))[0];
                        let activeClass = Array.from(previousActiveElement.classList).filter(e => e.includes("active"))[0];

                        if(e.target.nodeName == "BUTTON")
                        {
                            let buttons = this.querySelectorAll("button");

                            if(!e.target.ariaLabel.includes("Quality"))
                            {
                                newButton.dataset.isActive = 0;
                                newButton.dataset.order = 0;
                            }
                            else
                            {
                                newButton.dataset.isActive = 1;
                                newButton.dataset.order = newButton.dataset.order == "1" ? 0 : 1;

                                spoofClick = true;

                                if(!previousActiveElement.ariaLabel.includes("Default"))
                                {
                                    buttons[0].click();
                                }

                                buttons[0].click();
                                spoofClick = false;
                            }

                            buttons.forEach(e => (e.classList.remove(activeClass)));
                            e.target.classList.add(activeClass);
                        }
                    }, true);

                    searchBar.insertBefore(newButton, searchBar.querySelector(":last-child"));
                }

                if(arguments[0].className && arguments[0].className.toString().includes("loaderText___"))
                {
                    let qualityButton = document.querySelector("#qualityButton");

                    if(qualityButton && qualityButton.dataset.isActive == "1")
                    {
                        let searchTerm = document.querySelector("[class^='input___']").value.toLowerCase();
                        arguments[0].innerHTML = `Items ordered by Quality ${qualityButton.dataset.order == "1" ? "ascending" : "descending"}${searchTerm.length > 0 ? " and matching: \"" + searchTerm + "\"" : ""}`;
                    }
                }

                return result;
            };
        })(Element.prototype.appendChild);
    }

    addAjaxListeners()
    {
        let base = this;
        
        this.addAjaxListener("getBazaarItems", true, json =>
        {
            let qualityButton = document.querySelector("#qualityButton");
            let searchField = document.querySelector("[class^='input___']");
            let searchTerm = "";

            if(searchField)
            {
                searchTerm = searchField.value.toLowerCase();
            }

            if(qualityButton)
            {
                if(qualityButton.dataset.isActive == "1")
                {
                    let resultList = base.bazaarItems.list.filter(e => e.name.toLowerCase().includes(searchTerm));

                    resultList.sort(base.sorter);

                    return {
                        start: base.bazaarItems.start,
                        ID: base.bazaarItems.ID,
                        list: resultList,
                        total: resultList.length
                    };
                }
            }
        });
        
        this.addAjaxListener("getBazaarItems", false, json => 
        {
            let qualityButton = document.querySelector("#qualityButton");
            
            if(base.bazaarItems.list.length < base.bazaarItems.total && !json.items)
            {
                if(json.start == 0)
                {
                    base.bazaarItems = {start: 0, ID: json.ID, list: json.list, total: json.total};
                }
                else
                {
                    base.bazaarItems = {start: 0, ID: json.ID, list: base.bazaarItems.list.concat(json.list), total: json.total};
                }
            }

            if(qualityButton)
            {
                if(base.bazaarItems.list.length >= base.bazaarItems.total)
                {
                    qualityButton.style.color = "green";
                    qualityButton.title = "";
                }
                else
                {
                    qualityButton.style.color = "red";
                    qualityButton.title = "Scroll to the bottom of the page in order to enable this button";
                }
            }
        });
    }
}

class CityFindsModule extends BaseModule
{
    constructor(startMinimized, itemGrouping, itemOrder, maxRows)
    {
        super("/city.php");
        
        this.startMinimized = startMinimized == "true";
        this.itemGrouping = itemGrouping;
        this.itemOrder = itemOrder;
        this.maxRows = maxRows;
        
        this.ready();
    }
    
    init()
    {
        this.addAjaxListener("step=mapData", false, json => 
        {
            let data = JSON.parse(atob(json.territoryUserItems));

            data = data.map(e => (
                {id: String(parseInt(e.d, 36)),
                 time: parseInt(e.ts, 36)*1000,
                 name: e.title
                }));

            this.dataByDate = {totalAmount: data.length};

            for(let [index, item] of Object.entries(data))
            {
                let title = this.getGroupTitle(item, index);

                if(!this.dataByDate.hasOwnProperty(title))
                {
                    this.dataByDate[title] = {timestamp: item.time, items: {}};
                }

                if(this.dataByDate[title].items.hasOwnProperty(item.id))
                {
                    this.dataByDate[title].items[item.id].amount++;
                    this.dataByDate[title].timestamp = item.time;
                }
                else
                {
                    this.dataByDate[title].items[item.id] = {id: item.id, name: item.name, amount: 1};
                }
            }
            
            this.addTable();
            this.addStyle();
        });
    }
    
    getGroupTitle(item, index)
    {
        let result = "";
        
        if(this.itemGrouping == "Name")
        {
            result = item.name;
        }
        else if(this.itemGrouping == "Day")
        {
            result = Utils.stringifyTimestamp(item.time).split(" ")[0];
        }
        else if(this.itemGrouping == "Week")
        {
            let year = new Date(item.time).getUTCFullYear();
            let week = Utils.getWeekOfYear(item.time);
            
            result = `Week ${week} of ${year - (week == 53 ? 1 : 0)}`;
        }
        else if(this.itemGrouping == "Month")
        {
            let monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            
            result = monthNames[new Date(item.time).getUTCMonth()];
        }
        else
        {
            result = `${index}-${item.name}`;
        }
        
        return result.replace(/ /g, "_");
    }
    
    addTable()
    {
        let div = document.createElement("div");

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
        <tbody class="${this.startMinimized ? "hidden" : "" }">`;

        let sorter = (a, b) => -1;
        
        if(this.itemGrouping == "None" || this.itemGrouping == "Name")
        {
            if(this.itemOrder == "Time")
            {
                sorter = (a, b) => a[0] == "totalAmount" || b[0] == "totalAmount" ? 0 : a[1].timestamp > b[1].timestamp ? -1 : 1;
            }
            else if(this.itemOrder == "Name")
            {
                sorter = (a, b) => a[0] == "totalAmount" || b[0] == "totalAmount" ? 0 : Utils.reverseString(Utils.reverseString(a[0]).split("-")[0]) < Utils.reverseString(Utils.reverseString(b[0]).split("-")[0]) ? -1 : 1;
            }
            else if(this.itemOrder == "Amount")
            {
                sorter = (a, b) => a[0] == "totalAmount" || b[0] == "totalAmount" ? 0 : (Object.values(Object.values(b[1].items))[0].amount - Object.values(Object.values(a[1].items))[0].amount) - 1;
            }
        }
        
        for(let [title, entry] of Object.entries(this.dataByDate).sort(sorter))
        {
            if(title == "totalAmount"){continue;}

            if(this.itemGrouping != "None" && this.itemGrouping != "Name")
            {
                html += `<tr>`;
                html += `<td colspan="3" style="text-align: center; background-color: #CCC">${title.replace(/\_/g, " ")}</td>`;
                html += `</tr>`;
            }

            for(let item of Object.values(entry.items))
            {
                html += `<tr style="background-color: #DDD"><td>${item.name}</td><td style="text-align: center">${item.amount}</td><td class="cityFindItem-${item.id} cityFindTitle-${title}">Unknown</td></tr>`;
            }

            if(this.itemGrouping != "None" && this.itemGrouping != "Name")
            {
                html += `<tr style="background-color: #EEE"><td style="text-align: center">Subtotal:</td><td style="text-align: center">${Object.values(entry.items).reduce((a, b) => a + b.amount, 0)}</td><td class="cityFindTitleTotal-${title}">Unknown</td></tr>`;
            }
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
        document.querySelector("#cityFind-total").innerHTML = this.dataByDate.totalAmount;

        this.resizeTable();
        let base = this;

        document.querySelector("#cityFind-sum").addEventListener("click", function()
        {
            if(this.innerHTML == "Calculate!")
            {
                base.calculateTotalItemValue(this);
            }
        });

        document.querySelector("#cityFindTable thead").addEventListener("click", function()
        {
            document.querySelector("#cityFindTable tbody").classList.toggle("hidden");
        });
    }
    
    addStyle()
    {
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
            max-height: ${this.maxRows*23 - 1}px;
            overflow-y: scroll;
            overflow-x: hidden;
        }

        #cityFindTable th, #cityFindTable td
        {
            padding: 5px;
        }

        #cityFindTable thead
        {
            cursor: pointer;
        }

        #cityFindTable .hidden
        {
            display: none;
        }
        `);
    }
    
    resizeTable()
    {
        let toggled = false;

        if(document.querySelector("#cityFindTable tbody").classList.contains("hidden"))
        {
            document.querySelector("#cityFindTable tbody").classList.toggle("hidden");
            toggled = true;
        }

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

        if(toggled)
        {
            document.querySelector("#cityFindTable tbody").classList.toggle("hidden");
        }
    }

    async getAverageItemCost(id)
    {
        let json = await this.api(`/market/${id}?selections=bazaar`, 60000);

        let quantity = 0;
        let sum = 0;

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
    
    async calculateTotalItemValue(sumElement)
    {
        sumElement.innerHTML = "Loading...";

        let total = 0;

        document.querySelectorAll("#cityFindTable td:nth-child(3)").forEach(e => (e.innerHTML = "Queued"));
        document.querySelectorAll("#cityFindTable td:nth-child(3)[class*='Total']").forEach(e => (e.innerHTML = "Loading..."));

        for(let [title, entry] of Object.entries(this.dataByDate))
        {
            if(title == "totalAmount"){continue;}

            let subTotal = 0;

            for(let [key, item] of Object.entries(entry.items))
            {
                let element = document.querySelector(`.cityFindTitle-${title}.cityFindItem-${item.id}`);
                element.innerHTML = "Loading...";
                
                let value = await this.getAverageItemCost(item.id);

                element.innerHTML = "$" + (value*item.amount).toLocaleString();
                element.style.textAlign = "right";

                this.resizeTable();
                subTotal += value*item.amount;
            }

            total += subTotal;

            if(this.itemGrouping != "None" && this.itemGrouping != "Name")
            {
                let subTotalElement = document.querySelector(`.cityFindTitleTotal-${title}`);

                subTotalElement.innerHTML = "$" + subTotal.toLocaleString();
                subTotalElement.style.textAlign = "right";
            }
        }
        
        if(this.itemOrder == "Value" && (this.itemGrouping == "None" || this.itemGrouping == "Name"))
        {
            Array.from(document.querySelectorAll("#cityFindTable tbody tr")).sort((a, b) => 
            {
                return parseInt(b.children[2].innerHTML.replace(/[^0-9]/g, "")) - parseInt(a.children[2].innerHTML.replace(/[^0-9]/g, ""));
            }).forEach(e => 
            {
                e.parentNode.appendChild(e);
            });
        }

        sumElement.innerHTML = "$" + total.toLocaleString();
        sumElement.style.textAlign = "right";
        sumElement.style.textDecoration = "none";
        sumElement.style.cursor = "auto";
    }
}

class CompanyEffectivenessModule extends BaseModule
{
    constructor(effectivenessLimit, addictionLimit, notificationInterval)
    {
        super("");
        
        this.effectivenessLimit = effectivenessLimit;
        this.addictionLimit = addictionLimit;
        this.notificationInterval = notificationInterval;
        
        this.ready();
    }
    
    init()
    {
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
    }
    
    async getEffectiveness()
    {
        let employeeResponse = await this.api(`/company/?selections=employees`, 300000);
        let profileResponse = await this.api(`/company/?selections=profile`, 300000);
        let jobPointsResponse = await this.api(`/user/?selections=jobpoints`, 300000);

        let jobPoints = jobPointsResponse.jobpoints.companies[profileResponse.company.company_type].jobpoints;
        
        let myId = this.user.data.userID;

        let result = "Job points: " + jobPoints;
        result += "<br/><br/>";

        for(let [id, employee] of Object.entries(employeeResponse.company_employees))
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
                    result += name.charAt(0).toUpperCase() + name.slice(1) + ": " + this.colorize(value, name=="effectiveness");
                    result += "<br/>";
                }
                
                if(((employee.effectiveness.addiction || 0) < this.addictionLimit) || (employee.effectiveness.total || 0) < this.effectivenessLimit)
                {
                    document.querySelector("#effectivenessWarning").innerHTML = `!`;

                    if(Date.now() > new Date(parseInt(localStorage.getItem("lastEffectivenessNotification") || 0) + this.notificationInterval*1000))
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
    
    colorize(value, isTotal)
    {
        let color = "";

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
    
    onUserLoaded()
    {
        if(this.user.state.isLoggedIn && 
        this.user.state.status == "ok" && 
        !this.user.state.isTravelling &&
        !this.user.state.isAbroad)
        {
            let div = document.createElement("div");
            let span = document.createElement("span");
            span.id = "effectivenessWarning";

            let jobsLink = document.querySelector("div[class*='area-row'] a[href='/jobs.php']");

            jobsLink.className += " effectivenessLink";
            jobsLink.appendChild(div);
            div.after(span);

            document.addEventListener("mousemove", function(e)
            {
                div.style.left = e.clientX + 20 + "px";
                div.style.top = e.clientY + 20 + "px";
            });

            this.getEffectiveness();
        }
    }
}

class SettingsModule extends BaseModule
{
    constructor()
    {
        super("/index.php?page=AquaTools");
        
        this.modules = [];
        
        this.svgString = window.unsafeWindow.btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff5d22" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`);
        
        this.addAjaxListener("sidebarData", false, (json) =>
        {
            let newIcons = 
            {
                AquaTools: 
                {
                    iconID: "AquaToolsIcon", 
                    title: "AquaTools", 
                    subtitle: "Module settings",
                    link: "/index.php?page=AquaTools"
                }
            };
            
            Object.entries(json.statusIcons.icons).forEach(([key, value]) => newIcons[key] = value);
            
            json.statusIcons.icons = newIcons;
            
            return json;
        });
        
        GM_addStyle(`
        #AquaToolsIcon-sidebar
        {
            background-image: url("data:image/svg+xml;base64,${this.svgString}");
        }
        `);
        
        this.initSettings();
        this.initModules();
        
        this.ready();
    }

    init()
    {
        this.replaceContent("content-wrapper", element =>
        {
            this.contentElement = element;

            this.addStyle();
            this.addHeader();
            this.addBody();
            this.addJs();
        });
    }
    
    initModules()
    {
        this.setApiKey(this.settings.modules["API"].settings["API_key"].value);
        
        for(let [name, module] of Object.entries(this.settings.modules))
        {
            if(module.isActive && (!module.needsApiKey || this.settings.apiKeyIsValid))
            {
                let classRef;
                
                if(name == "Bazaar_Sorter"){classRef = BazaarSorterModule}
                if(name == "City_Finds"){classRef = CityFindsModule}
                if(name == "Company_Effectiveness"){classRef = CompanyEffectivenessModule}
                
                if(classRef)
                {
                    this.modules.push(new classRef(...Object.values(module.settings).map(e => e.value)));
                }
            }
        }
    }
    
    initSettings()
    {
        this.settings = JSON.parse(localStorage.getItem("AquaTools_settings")) || {};
        
        let settingsTemplate = {
            apiKeyIsValid: false, 
            modules: 
            {
                API:
                {
                    isActive: true, 
                    needsApiKey: false, //ironic, isn't it?
                    description: "Description of API",
                    settingsHidden: true, 
                    settings: 
                    {
                        API_key:
                        {
                            value: "", 
                            valueType: "text", 
                            description: "Your API key from the Torn settings page"
                        }
                    }
                }, 
                Bazaar_Sorter: 
                {
                    isActive: false, 
                    needsApiKey: false, 
                    description: "Description of Bazaar Sorter", 
                    settingsHidden: true, 
                    settings: {}
                }, 
                City_Finds: 
                {
                    isActive: false, 
                    needsApiKey: true, 
                    description: "Description of City Finds", 
                    settingsHidden: true, 
                    settings:
                    {
                        Start_minimized: 
                        {
                            value: "true", 
                            valueType: "boolean", 
                            description: "Item table can be toggled on or off by clicking the header, this chooses the default"
                        },
                        Item_grouping: 
                        {
                            value: "Day",
                            valueType: "list", 
                            possibleValues: ["None", "Name", "Day", "Week", "Month"], 
                            description: "How to group the items"
                        },
                        Item_order: 
                        {
                            value: "Time", 
                            valueType: "list", 
                            possibleValues: ["Time", "Name", "Amount", "Value"], 
                            description: "How to sort the items, only works when the item grouping isn't time related"
                        }, 
                        Max_rows: 
                        {
                            value: 8, 
                            valueType: "number",
                            description: "How many rows to show at most in the table (excluding header and footer) when expanded"
                        }
                    }
                }, 
                Company_Effectiveness:
                {
                    isActive: false, 
                    needsApiKey: true, 
                    description: "Description of Company Effectiveness", 
                    settingsHidden: true, 
                    settings: 
                    {
                        Effectiveness_limit:
                        {
                            value: 100, 
                            valueType: "number", 
                            description: "You will be notified when your total effectiveness is lower than this"
                        }, 
                        Addiction_limit:
                        {
                            value: -5, 
                            valueType: "number", 
                            description: "You will be notified when your addiction penalty is lower than this"
                        }, 
                        Notification_interval:
                        {
                            value: 21600, 
                            valueType: "number", 
                            description: "How often (in seconds) to notify you while you're below either limit"
                        }
                    }
                }
            }
        };

        this.settings = {...settingsTemplate, ...this.settings};
        this.settings.modules = {...settingsTemplate.modules, ...this.settings.modules};
        
        for(let [name, module] of Object.entries(this.settings.modules))
        {
            module.settings = {...settingsTemplate.modules[name].settings, ...module.settings};
        }
        
        this.saveSettings();
    }
    
    addStyle()
    {
        GM_addStyle(`
        #SettingsModule, #SettingsModule *, #saveSettings
        {
            all: revert;
        }

        #SettingsModule
        {
            border-collapse: collapse;
            min-width: 400px;
        }
        
        #SettingsModule th, #SettingsModule td
        {
            border: 1px solid black;
            padding: 4px;
        }
        
        #SettingsModule th
        {
            font-weight: 600;
        }
        
        #SettingsModule .hidden
        {
            display: none;
        }

        #SettingsModule tr:nth-child(2) td:first-child
        {
            width: 20px;
        }
        
        #SettingsModule tr td:nth-child(2)
        {
            cursor: pointer;
        }
        
        #SettingsModule ul
        {
            list-style-type: none;
            padding: 0;
        }
        
        #SettingsModule li
        {
            margin-top: 1px;
        }
        
        #SettingsModule .valid
        {
            border: 2px solid green;
        }
        
        #SettingsModule .invalid
        {
            border: 2px solid red;
        }
        
        #SettingsModule input:not([type='checkbox']), #SettingsModule select
        {
            box-sizing: border-box;
            width: 150px;
        }
        
        #saveSettings
        {
            margin-top: 10px;
        }
        `);
    }
    
    addHeader()
    {
        this.contentElement.innerHTML = `
        <div class="content-title m-bottom10">
            <h4 id="skip-to-content" class="left">AquaTool Settings</h4>

        <div class="clear"></div>
        <hr class="page-head-delimiter">
        </div>
        `;
    }

    addBody()
    {
        let html = "";
        
        html += `
        <table id="SettingsModule">
            <tr>
                <th colspan="2">Modules</th>
            </tr>
            `;
            
        for(let [moduleName, module] of Object.entries(this.settings.modules))
        {
            html += "<tr class='module'>";
            html += "<td>";
            html += `<input type="checkbox" ${module.isActive && (!module.needsApiKey || this.settings.apiKeyIsValid) ? "checked" : ""} ${(!module.needsApiKey && moduleName != "API") || (this.settings.apiKeyIsValid && moduleName != "API") ? "" : "disabled"}/>`;
            html += "</td>";
            html += "<td>";
            html += moduleName.replace(/\_/g, " ");
            html += "</td>";
            html += "</tr>";
            
            html += `<tr class="${module.settingsHidden && (this.settings.apiKeyIsValid || moduleName != "API") ? "hidden" : ""}" id="${moduleName}-settings">`;
            html += "<td colspan='2'>";
            html += module.description;
            html += "<ul>";
            for(let [settingName, setting] of Object.entries(module.settings))
            {
                html += `<li title="${setting.description}" class="${settingName}">`;
                
                if(setting.valueType == "number")
                {
                    html += `<input type="number" value="${setting.value}"/>`;
                }
                else if(setting.valueType == "boolean")
                {
                    html += `<select><option value="true" ${setting.value == "true" ? "selected" : ""}>True</option><option value="false" ${setting.value == "false" ? "selected" : ""}>False</option></select>`;
                }
                else if(setting.valueType == "text")
                {
                    let className = settingName == "API_key" ? (this.settings.apiKeyIsValid ? "valid" : "invalid") : "";
                    
                    html += `<input type="text" class="${className}" value="${setting.value}"/>`;
                }
                else if(setting.valueType == "list")
                {
                    html += "<select>";
                    
                    for(let optionName of setting.possibleValues)
                    {
                        html += `<option value="${optionName}" ${optionName == setting.value ? "selected" : ""}>${optionName}</option>`;
                    }
                    
                    html += "</select>";
                }
                
                html += " " + settingName.replace(/\_/g, " ");
                html += "</li>";
            }
            html += "</ul>"
            html += "</td>";
        }

        html += `
        </table>
        <button id="saveSettings">Save changes</button>
        `;
        
        this.contentElement.innerHTML += html;
    }

    addJs()
    {
        let base = this;
        
        document.querySelectorAll("#SettingsModule tr:not(:first-child):not([id$='settings'])").forEach(function(e)
        {
            e.addEventListener("click", function(e)
            {
                if(e.target.nodeName == "TD" && e.target == e.target.parentNode.lastElementChild)
                {
                    
                    let module = base.settings.modules[e.target.innerHTML.replace(/ /g, "_")];
                    this.nextElementSibling.classList.toggle("hidden");
                    
                    if(module)
                    {
                        module.settingsHidden = this.nextElementSibling.className.includes("hidden") ? true : false;
                        base.saveSettings();
                    }
                }
            });
        });
        
        document.querySelector("#saveSettings").addEventListener("click", e =>
        {
            this.loadSettingsFromTable();

            fetch(`https://api.torn.com/user/?selections=basic&key=${this.settings.modules["API"].settings["API_key"].value}`)
            .then(response =>
            {
                response.json()
                .then(json => 
                {
                    this.settings.apiKeyIsValid = !json.hasOwnProperty("error");
                    this.saveSettings();
                    
                    document.location.reload();
                });
            });
        });
    }

    saveSettings()
    {
        localStorage.setItem("AquaTools_settings", JSON.stringify(this.settings));
    }
    
    loadSettingsFromTable()
    {
        document.querySelectorAll("#SettingsModule .module").forEach(tr => 
        {
            let module = this.settings.modules[tr.lastChild.innerHTML.replace(/ /g, "_")];
            
            if(!tr.firstChild.querySelector("input").disabled)
            {
                module.isActive = tr.firstChild.querySelector("input").checked;
            }
        });
        
        document.querySelectorAll("#SettingsModule [id$='-settings']").forEach(tr => 
        {
            let moduleName = tr.id.split("-settings")[0];
            
            tr.querySelectorAll("li").forEach(li => 
            {
                let settingName = li.className;
                let settingValue = li.querySelector("input, select").value;
                
                this.settings.modules[moduleName].settings[settingName].value = settingValue;
            });
            
        });

        this.saveSettings();
    }
}

let settings = new SettingsModule();
