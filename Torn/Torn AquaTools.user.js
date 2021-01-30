// ==UserScript==
// @name         Torn AquaTools
// @namespace
// @version      1.2.0
// @description
// @author       AquaRegia
// @match        https://www.torn.com/*
// @updateURL    https://github.com/AquaRegia/Tampermonkey/raw/main/Torn/Torn%20AquaTools.user.js
// @downloadURL  https://github.com/AquaRegia/Tampermonkey/raw/main/Torn/Torn%20AquaTools.user.js
// @run-at       document-start
// @grant        none
// ==/UserScript==

let GM_addStyle = function(s)
{
    let style = document.createElement("style");
    style.type = "text/css";
    style.innerHTML = s;
    
    document.head.appendChild(style);
}

let GM_notification = function(config)
{
    Notification.requestPermission().then(() => 
    {
        let notification = new Notification(config.title, {body: config.body, image: config.image, tag: "AquaTools"});
        
        if(config.clickHandler)
        {
            notification.addEventListener("click", () => (notification.close() || config.clickHandler()));
        }
    });
}

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
        
        if(startOfYear.getUTCDay() <= 4)
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
        this._overrideXhr();
        this._overrideFetch();
    }
    
    _overrideXhr()
    {
        let base = this;
        
        (function(original)
        {
            window.XMLHttpRequest = function()
            {
                let result = new original(arguments);
                let stub;
                
                result.addEventListener("readystatechange", function()
                {
                    if(this.readyState == 4 && this.responseText[0] == "{")
                    {
                        let json = JSON.parse(this.responseText);
                        //console.log("XHR:", json);
                        stub = base._runAjaxCallbacks(this.responseURL, false, json);
                        
                        if(stub)
                        {
                            Object.defineProperty(this, "responseText", 
                            {
                                get: function(){return JSON.stringify(stub)}
                            });
                        }
                    }
                });
                
                return result;
            };
            window.XMLHttpRequest.prototype = original.prototype;
        })(window.XMLHttpRequest);
    }
    
    _overrideFetch()
    {
        let base = this;
        
        (function(original)
        {
            window.fetch = async function()
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
        })(window.fetch);
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
    }
    
    async fetch(url, cacheMs = 0)
    {
        this.loadCacheLog();
        
        if(this.cacheLog.hasOwnProperty(url) && (this.cacheLog[url].time + cacheMs) >= Date.now())
        {
            return Promise.resolve(this.cacheLog[url].json);
        }
        
        this.loadCallLog();
        
        if(this.callLog.length > 90)
        {
            await Utils.sleep(7500);
        }
        else if(this.callLog.length > this.throttleLimit)
        {
            await Utils.sleep(1500);
        }
        
        this.loadCallLog();
        this.callLog.push(Date.now());
        this.saveCallLog();
        
        let response = await fetch(`https://api.torn.com${url}&key=${this.apiKey}`);

        response.clone().json().then(json => 
        {
            if(!json.hasOwnProperty("error"))
            {
                this.loadCacheLog();
                this.cacheLog[url] = {json: json, time: Date.now()};
                this.saveCacheLog();
            }
        });
        
        return response.json();
    }
    
    loadCallLog()
    {
        let now = Date.now();
        this.callLog = JSON.parse(localStorage.getItem("AquaTools_ApiModule_callLog") || "[]").filter(e => (e+60000) >= now);
    }
    
    loadCacheLog()
    {
        let now = Date.now();
        this.cacheLog = JSON.parse(localStorage.getItem("AquaTools_ApiModule_cache") || "{}");
        
        Object.entries(this.cacheLog).forEach(([index, item]) => 
        {
            if((item.time + 300000) < now)
            {
                delete this.cacheLog[index];
            }
        });
    }
    
    saveCallLog()
    {
        localStorage.setItem("AquaTools_ApiModule_callLog", JSON.stringify(this.callLog));
    }
    
    saveCacheLog()
    {
        localStorage.setItem("AquaTools_ApiModule_cache", JSON.stringify(this.cacheLog));
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
    
    setApiParams(apiKey, throttleLimit)
    {
        this.apiKey = apiKey;
        this.throttleLimit = throttleLimit;
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
    
    setApiParams(...params)
    {
        BaseModule._apiModule.setApiParams(...params);
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

class ChainTargetsModule extends BaseModule
{
    constructor()
    {
        super("/blacklist.php?page=ChainTargets");
        this.loadTargets();
        
        this.maxOkay = 5;
        this.maxBusy = 10;
        
        this.addAjaxListener("getSidebarData", false, (json) => 
        {
            json.lists.chains = 
            {
                added: null, 
                favorite: null, 
                icon: "factions", 
                link: "blacklist.php?page=ChainTargets", 
                linkOrder: 23, 
                name: "Chains", 
                status: null, 
                elements: this.allTargets.filter(e => e.level > 0).map(e => ({name: e.name, link: "/profiles.php?XID=" + e.id, status: "Idle", lastAction: parseInt(((Date.now() - e.lastUpdate)/1000))}))
            };
            
            if(document.location.href.includes(this.targetUrl))
            {
                json.lists.chains.status = "active";
                json.lists.enemies.status = null;
            }

            return json;
        });
        
        this.addSVGToChainsList();
        
        if(document.location.href.includes("/profiles.php?"))
        {
            this.addAjaxListener("getProfileData", false, (json) => 
            {
                let newButton = 
                {
                    actionDescription: "Add to chain list", 
                    link: "#", 
                    message: `Toggle ${json.user.playerName} on your chain list`,
                    state: "active"
                };

                let newButtonsObject = {};
                
                for(let [name, button] of Object.entries(json.profileButtons.buttons))
                {
                    newButtonsObject[name] = button;
                    
                    if(name == "addToEnemyList")
                    {
                        newButtonsObject.addToChainList = newButton;
                    }
                }
                
                json.profileButtons.buttons = newButtonsObject;
                
                this.visitedProfileID = json.user.userID;
                
                return json;
            });
            
            this.modifyProfileButton();
        }
        
        this.ready();
    }
    
    init()
    {
        document.title = "Chain Targets | TORN";
        
        this.freezeTables = false;
        
        let newestTargetUpdate = this.allTargets.length == 0 ? 0 : this.allTargets.reduce((a, b) => a.lastUpdate > b.lastUpdate ? a : b, this.allTargets[0]).lastUpdate;

        this.replaceContent("content-wrapper", element =>
        {
            this.contentElement = element;
            this.contentElement.classList.add("chainTargets");

            this.addStyle();
            this.addHeader();
            
            if(Date.now() > (newestTargetUpdate+5000))
            {
                this.addBody();
                this.addJs();
                this.updateTarget();
                setInterval(this.updateTarget.bind(this), 2000);
            }
            else
            {
                this.contentElement.innerHTML += "<p>It looks like you might be running this already in another tab. If not, wait a couple of seconds and then update this page.</p>";
            }
        });
    }
    
    async modifyProfileButton()
    {
        let button;
        
        while(!(button = document.querySelector(".profile-button-addToChainList")))
        {
            await Utils.sleep(100);
        }
        
        let activeButton = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="-5 -5 36 36" fill="none" stroke="#A1C1A1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
        let inactiveButton = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="-5 -5 36 36" fill="none" stroke="#B1B1B1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
        
        if(this.allTargets.filter(e => e.id == this.visitedProfileID).length > 0)
        {
            button.innerHTML = activeButton;
        }
        else
        {
            button.innerHTML = inactiveButton;
        }
        
        button.addEventListener("click", e => 
        {
            this.loadTargets();
            let target = this.allTargets.filter(e => e.id == this.visitedProfileID);
            
            if(target.length > 0)
            {
                localStorage.setItem("AquaTools_ChainTargets_targets", JSON.stringify(this.allTargets.filter(e => e.id != target[0].id)));
                button.innerHTML = inactiveButton;
            }
            else
            {
                this.allTargets.push({id: this.visitedProfileID, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
                localStorage.setItem("AquaTools_ChainTargets_targets", JSON.stringify(this.allTargets));
                button.innerHTML = activeButton;
            }
        });
    }
    
    async addSVGToChainsList()
    {
        let nav;
        
        while(!(nav = document.querySelector("#nav-chains span")))
        {
            await Utils.sleep(100);
        }
        
        nav.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="20" viewBox="1 0 22 25" fill="none" stroke="#B1B1B1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
    }
    
    loadTargets()
    {
        let now = Date.now();
        
        this.allTargets = JSON.parse(localStorage.getItem("AquaTools_ChainTargets_targets") || "[]");
        
        /*if(this.allTargets.length == 0)
        {
            this.allTargets.push({id: 1043377, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 227273, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 1510560, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 172552, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 2281871, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 2424664, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 134432, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 244894, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 504699, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 984117, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 1102071, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 1311704, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 1499091, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 1500493, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 2500343, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
            this.allTargets.push({id: 2549277, faction: "", status: "", name: "", level: 0, lastUpdate: 0, highlighted: false});
        }*/
        
        let sorter = (a, b) => b.level - a.level;
        
        this.okayTargets = this.allTargets.sort(sorter).filter(e => (now <= (e.lastUpdate + 300000)) && e.status.state == "Okay").slice(0, this.maxOkay);
        let lowestLevelInOkay = this.okayTargets.length == 0 ? 0 : this.okayTargets.reduce((a, b) => a.level < b.level ? a : b, this.okayTargets[0]).level;
        
        this.busyTargets = this.allTargets.sort(sorter).filter(e => (now <= (e.lastUpdate + 300000)) && e.status.state != "Okay" && e.level > lowestLevelInOkay).slice(0, this.maxBusy);
        this.idleTargets = this.allTargets.sort(sorter).filter(e => (now <= (e.lastUpdate + 300000))).slice(this.okayTargets.length + this.busyTargets.length);
        this.unknownTargets = this.allTargets.sort(sorter).filter(e => now > (e.lastUpdate + 300000));
    }
    
    async updateTarget()
    {
        if(this.allTargets.length == 0){return;}
        
        let now = Date.now();
        let nextTarget;
        
        let unknownLevelTargets = this.unknownTargets.filter(e => e.level == 0);
        let freeTargets = this.allTargets.filter(e => e.status.until > now && e.status.state != "Okay");
        let oldBusyTargets = this.busyTargets.filter(e => now > (e.lastUpdate + 60000));
        
        /*if(unknownLevelTargets.length > 0)
        {
            nextTarget = unknownLevelTargets[0];
        }*/
        
        //If level isn't known, no priority can be determined, so pick this first
        if(unknownLevelTargets.length > 0)
        {
            nextTarget = unknownLevelTargets[0];
        }
        //Targets that should be out of hospital or jail by now, more available targets == better choices
        else if(freeTargets.length > 0)
        {
            nextTarget = freeTargets[0];
        }
        //These are all better than the worst one in the okay list, so pick one if 
        //it's older than 1 minute in case they've been revived or busted out of jail
        else if(oldBusyTargets.length > 0)
        {
            nextTarget = oldBusyTargets[0];
        }
        //If the idle list isn't full, pick the oldest Okay one from unknown targets
        else if(this.unknownTargets.length > 0 && this.idleTargets.filter(e => e.status.state == "Okay").length < this.maxOkay)
        {
            nextTarget = this.unknownTargets.filter(e => e.status.state == "Okay").reduce((a, b) => a.lastUpdate < b.lastUpdate ? a : b, this.unknownTargets[0]);
        }
        //Idle list still isn't full, and there are no Okay unknown ones, so just pick the best one
        else if(this.unknownTargets.length > 0 && this.idleTargets.filter(e => e.status.state == "Okay").length < this.maxOkay)
        {
            nextTarget = this.unknownTargets[0];
        }
        //Assuming there's any Okay targets, pick the oldest one
        else if(this.okayTargets.length > 0)
        {
            nextTarget = this.okayTargets.reduce((a, b) => a.lastUpdate < b.lastUpdate ? a : b, this.okayTargets[0]);
        }
        //Both Okay and idle is empty, hail mary and pick the oldest one from any category
        else
        {
            console.log("else");
            nextTarget = this.allTargets.reduce((a, b) => a.lastUpdate < b.lastUpdate ? a : b, this.allTargets[0]);
        }
        
        this.allTargets.forEach(e => e.highlighted = false);
        nextTarget.highlighted = true;
        
        let json = await this.api(`/user/${nextTarget.id}?selections=profile`, 0);

        nextTarget.faction = json.faction;
        nextTarget.status = json.status;
        nextTarget.name = json.name;
        nextTarget.level = json.level;
        nextTarget.lastUpdate = Date.now();
        
        localStorage.setItem("AquaTools_ChainTargets_targets", JSON.stringify(this.allTargets));
        this.loadTargets();
        
        this.updateTableBody();
    }
    
    addStyle()
    {
        GM_addStyle(`
            .chainTargets *
            {
                all: revert;
            }
            
            .chainTargets table.chainTargetsTable
            {
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            
            .chainTargets table.chainTargetsTable a
            {
                color: black;
            }
            
            .chainTargets table.chainTargetsTable th, .chainTargets table.chainTargetsTable td
            {
                border: 1px solid black;
                padding: 5px;
            }
            
            .chainTargets table.chainTargetsTable th
            {
                background-color: #EEE;
            }
            
            .chainTargets table.chainTargetsTable th:nth-child(1){min-width: 60px;}
            .chainTargets table.chainTargetsTable th:nth-child(2){min-width: 160px;}
            .chainTargets table.chainTargetsTable th:nth-child(3){min-width: 40px;}
            .chainTargets table.chainTargetsTable th:nth-child(4){min-width: 60px;}
            .chainTargets table.chainTargetsTable th:nth-child(5){min-width: 110px;}
            .chainTargets table.chainTargetsTable th:nth-child(6){min-width: 50px;}
            
            .chainTarget td
            {
                background-color: #CCC;
            }
            
            .chainTargets tr:nth-child(2n) td
            {
                background-color: #DDD;
            }
            
            .chainTargets table.chainTargetsTable caption
            {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 5px;
            }
            
            .chainTargets table.chainTargetsTable .paddedTime
            {
                font-family: Courier New;
                font-weight: 600;
            }
            
            .chainTargets table.chainTargetsTable .highlighted td
            {
                background-color: #CFC;
            }
            
            .chainTargets table.chainTargetsTable tbody.frozen td
            {
                background-color: #a5c5d9;
            }
        `);
    }
    
    addHeader()
    {
        this.contentElement.innerHTML = `
        <div class="content-title m-bottom10">
            <h4 id="skip-to-content" class="left">Chain Targets</h4>

        <div class="clear"></div>
        <hr class="page-head-delimiter">
        </div>
        `;
    }
    
    addBody()
    {
        let html = "";
        
        html += `
        <table class="chainTargetsTable" id="okayTargets">
            <caption>Okay targets</caption>
            <thead>
                <tr>
                    <th>Faction</th>
                    <th>Name</th>
                    <th>Level</th>
                    <th>State</th>
                    <th>Last update</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
        
        <table class="chainTargetsTable" id="busyTargets">
            <caption>Busy targets</caption>
            <thead>
                <tr>
                    <th>Faction</th>
                    <th>Name</th>
                    <th>Level</th>
                    <th>State</th>
                    <th>Last update</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
        
        <table class="chainTargetsTable" id="idleTargets">
            <caption>Idle targets</caption>
            <thead>
                <tr>
                    <th>Faction</th>
                    <th>Name</th>
                    <th>Level</th>
                    <th>State</th>
                    <th>Last update</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
        
        <table class="chainTargetsTable" id="unknownTargets">
            <caption>Unknown targets</caption>
            <thead>
                <tr>
                    <th>Faction</th>
                    <th>Name</th>
                    <th>Level</th>
                    <th>State</th>
                    <th>Last update</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
        `;
        
        this.contentElement.innerHTML += html;
    }
    
    addJs()
    {
        document.querySelectorAll(".chainTargetsTable tbody").forEach(tbody =>
        {
            tbody.addEventListener("mouseenter", e => 
            {
                this.freezeTables = true;
                tbody.classList.add("frozen");
            });
        });
        
        document.querySelectorAll(".chainTargetsTable tbody").forEach(tbody =>
        {
            tbody.addEventListener("mouseleave", e => 
            {
                this.freezeTables = false;
                tbody.classList.remove("frozen");
            });
        });
    }
    
    updateTableBody()
    {
        let now = Date.now();
        
        let okayTargetsBody = document.querySelector("#okayTargets tbody");
        let busyTargetsBody = document.querySelector("#busyTargets tbody");
        let idleTargetsBody = document.querySelector("#idleTargets tbody");
        let unknownTargetsBody = document.querySelector("#unknownTargets tbody");
        
        let pairs = [
            [okayTargetsBody, this.okayTargets], 
            [busyTargetsBody, this.busyTargets], 
            [idleTargetsBody, this.idleTargets], 
            [unknownTargetsBody, this.unknownTargets], 
        ];
        
        for(let [element, targets] of pairs)
        {
            if(element.classList.contains("frozen")){continue;}
            
            let html = "";
            
            for(let user of targets)
            {
                html += `<tr${user.highlighted ? " class='highlighted'" : ""}>`;
                
                html += `<td style="text-align: center"><a target="_blank" href="https://www.torn.com/factions.php?step=profile&ID=${user.faction.faction_id}">${user.faction.faction_tag}</a></td>`;
                html += `<td><a target="_blank" href="https://www.torn.com/profiles.php?XID=${user.id}">${user.name} [${user.id}]</a></td>`;
                html += `<td style="text-align: center">${user.level}</td>`;
                html += `<td>${user.status.state}</td>`;
                html += `<td style="text-align: center"><span class="paddedTime">${String(parseInt((now - user.lastUpdate)/1000)).padLeft(4, String.fromCharCode(160))}</span> seconds ago</td>`;
                
                html += `<td style="text-align: center">`;
                
                if(user.status.state == "Okay")
                {
                    html += `<a target="_blank" href="https://www.torn.com/loader2.php?sid=getInAttack&user2ID=${user.id}">Attack</a>`;
                }
                else
                {
                    html += `<a target="_blank" href="https://www.torn.com/profiles.php?XID=${user.id}">Profile</a>`;
                }
                
                html += "</td></tr>";
            }
            
            element.innerHTML = html;
        }
    }
}

class CityFindsModule extends BaseModule
{
    constructor(startMinimized, itemGrouping, itemOrder, maxRows, cacheAge)
    {
        super("/city.php");
        
        this.startMinimized = startMinimized == "true";
        this.itemGrouping = itemGrouping;
        this.itemOrder = itemOrder;
        this.maxRows = maxRows;
        this.cacheAge = cacheAge;
        
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
        let json = await this.api(`/market/${id}?selections=bazaar`, this.cacheAge*1000);

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
    constructor(effectivenessLimit, addictionLimit, notificationInterval, cacheAge)
    {
        super("");
        
        this.effectivenessLimit = effectivenessLimit;
        this.addictionLimit = addictionLimit;
        this.notificationInterval = notificationInterval;
        this.cacheAge = cacheAge;
        
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
        let employeeResponse = await this.api(`/company/?selections=employees`, this.cacheAge*1000);
        let profileResponse = await this.api(`/company/?selections=profile`, this.cacheAge*1000);
        let jobPointsResponse = await this.api(`/user/?selections=jobpoints`, this.cacheAge*1000);

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
                
                if(((employee.effectiveness.addiction || 0) <= this.addictionLimit) || (employee.effectiveness.total || 0) <= this.effectivenessLimit)
                {
                    document.querySelector("#effectivenessWarning").innerHTML = `!`;

                    if(Date.now() > new Date(parseInt(localStorage.getItem("lastEffectivenessNotification") || 0) + this.notificationInterval*1000))
                    {
                        localStorage.setItem("lastEffectivenessNotification", Date.now());

                        GM_notification(
                        {
                            title: "Time to rehab!",
                            body: `Your effectiveness (${employee.effectiveness.total}) or addiction (${employee.effectiveness.addiction || 0}) has reached its threshold!`,
                            clickHandler: () => document.location.href = "https://www.torn.com/travelagency.php", 
                            image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAeCAYAAABwmH1PAAAHtklEQVRYR92Yf1ATZxrH3002m1+7bH4HkiAEiEC8AtZWZVQ8r3h2aHutP0DL+aPUai3eTauDd/XOGb1Ox+nN4TBa6zneedhCW1t6XtWqB8KphdNaAQc5hCqSQEgC5AdJyGbZTbJ7swzMMJ2b6z8LQ31n3j/yxz55Ps/zfZ73eV8IzO6CAACCy5dr5UVFmwkAAAMAYGfTBc6B2VwCAADy1zMVz9Rfuv1tXV2zbxJ61nyYbWAkPV2vWP/KU79pvz10rPGrNhcAIDZrtACAmQDmbHKbk+p0uQpUKoC+9ua6YtvwrTcFQfP2zz6+2QkAGJ8EnvqO+8lJfUYW38CcPbiy8hBeUXEoNJm9KeeRl7etsUCqOxfCEcpk0a3c/dHJO2c9Hg9Xy9wSXrv2z9Tu7ru+8vL9wZmC5h3YarXKX96+/JctN1qa6i/cdwIAqEkg+Wt78kvC0MNTLKAEEqA5/eVp275gEHCBgZRKIF9ftqIsy7C4oaLiyIOZkjrvwAAAdOMO6x4BDKUFnOzRKxfu93DOm81y1Qvb0j6KwsRqIuIFVFjc3vQJ8YLXG/FzjeyV8uXLvITt90o4742a05c4YHomND0TwLLSXTnbScZTBeKiT3z94sPdHQHHs79YnIoaH5wTSmBLINQPGErce+tLSaHN5h7duHlFRgztPxmlY/PMqoIXj1ae7ZhW27xyzwjwjr1PF8PKseohtzsEUbo/t1x0Va0rKcgQGbo/ZiHhvDAxDEVJ2NlajxShYjGRmS96J0yF1kOCGL3AsLb48MHqGz8q4NJd1mKxxlsdoyHGNzLe5e/FdlhzsnFRYvunGK5WDQ8PAJoU+h98g617YpExJxh9+AcURXEWxP1qZum696vO35kmaV47Np8ZnrIl27TDWgyrndUaZRpou3OPykxeekQYl/YORZuPJaWo0XgsBMIBihjpMbyuTYW2AXG4UKnGoFiYbr/bQJW2tnr7uS5dWXkooaLi0CgAIM6XrvkC5iYoeNIp5KXN2YX+WM85S5oFIukQ8I2QPRna/KpxWce7VDSihWAC0IQ4QA7rjqBJo+WIVJwECWkQD+EfNn0eOkAQ/vC+t7csESAJsv17P7g4CczLCMoHMGdD9N6fdq52jHjddR/WO1PnKxLTF8HnEpQyM8NEoa77djpJnvl2sgVZSCOuLSQRBgEv4tRjpm9J0eBzsAgWRccjlO+RqmxkUNy58ufZzw/7bQW0X/Pbz2quT3T5uZZhpHRXbh4RH/rLPN38v1+//N3V3KXGAnMu/B5FQWyfvQNiw7ozo0OgIX2Jt1aOYgLno6hbBEOkXCMwMywNkLG0mhtX3Cd++nzmVg/RtQEXz7vY+PngAbvd45mLkoZzcvSqpwoTD1OQp5gYo7tlUMpXSWZiJabGnvF6wpDLMfKI9GgO6lNGd8r0ZIF/JO4BQhZXKnEk6As9srUr3zKmoAshefANjU6RFB4G+2uO93wAAAjzeaPiQ9Kc2jg70g2bns6zLGPOOZyDOpfDF5IItI0WK2qMgdhSR783hgnMJwBgxTKTfafbTkd0BpWMBSEm4lFWkx68hcWG9hlSFFYBiAU9fdK1X5zp+WZyUuOlfqcc5as84IQEkFC2L/Owwaze2dbWDey2IKOQaltSksVEBPIWjTikd5P1lmYG+8+vfcNMUJuE43GS7nF1Y8dQPbtRLKdXpM/Xx0cdooNXzt6vttkIbgrj6ndOAnNZFq96Ln3BiiLl3xQaLKezow90dTnHMSnertVCLBUjsxMVC1oDbNcqIsBSWqMUjTixoyQFJVLA8ZJlgUEUC8prb14MVfX1OQdQ1DDucrm4WXzOHUtTKhFys3TZW1lFloXocUyuwXv7BgXtrT0xNZrYKJJFzBrcYiOgnuUedzRmSsIGPA7Z7SjsWaszCpQyKOXrSEh+DUOlkSxLlixBou85X1d/qa7uFneF5CXLfNXwdGCpUilRZeWqc9ZsSN1tzU1cNujyY41Xm6NapaErDiImsQSOkBFaEhnBTkWAf5PWFM/wuSC3EIYlpmSl0GhSA0cn/GrAhXxdV9fMyXpOZpgLHnL85O8K7vX9a5nD9d1iKsoahCIq0WzBdVqdHgwM2INK1GRnWRaiKSoSCkWkY7TnJ0xMACcZFcBkUjNsFPl3bytzoOXqQOfAQHCMz6GD76YlKC7OF8M4tYmEBsuSzcpFsISRimAICIUiKBaPA7EYABxVPGCjUUk4GB/wjTue1GjViFalDDIM6B96yHxxs8nzj+sNdsdkd+Zt4JiSIO+S1uv1EhEeUzyZp5m/5Gf6PRqjrIgBNMSwpECNK+IsIw3g4+qOS9e6z5AkAcXiUWrIRfa2t7hdDCMh/H4/16SiP5YXDy6QU3M1kr0oBUsxShIkCiEuR2CBb5SJdLc6xt5598WSzo7olVOnPh0MhSbguM3VKbe//xbG17E5YYfvDE93buINmnur+p7HSG3t1q0IktdaUrL3Ht+DxQ9FZyaB/9d/T5zV7598fYMlPXf02dXlTY87MBcEUVXV7ic0emnultLKs5PAvF7y/1+WZzvDnC/wmuL8hFXLE1899sfbJ1wuFzdUPNbAApPJJP7V3sK1XXdd52tqGsjHHXiik2dkZIhwHGfa2tp4vRz8UNP6L1kjT0zzrjGyAAAAAElFTkSuQmCC"
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

            if(jobsLink)
            {
                jobsLink.className += " effectivenessLink";
                jobsLink.appendChild(div);
                div.after(span);
            }

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
        
        this.svgString = window.btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ff5d22" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`);
        
        this.addAjaxListener("sidebarData", false, (json) =>
        {
            let newIcons = 
            {
                AquaTools: 
                {
                    iconID: "AquaToolsIcon", 
                    title: "AquaTools V" + GM_info.script.version, 
                    subtitle: "Module settings",
                    link: "/index.php?page=AquaTools"
                }
            };
            
            Object.entries(json.statusIcons.icons).forEach(([key, value]) => newIcons[key] = value);
            
            json.statusIcons.icons = newIcons;
            
            if(document.location.href.includes(this.targetUrl))
            {
                json.areas.home.status = null;
            }
            
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
        document.title = `AquaTools V${GM_info.script.version} Settings | TORN`;
        
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
        this.setApiParams(this.settings.modules["API"].settings["API_key"].value, 
                        this.settings.modules["API"].settings["Throttle_limit"].value);
        
        for(let [name, module] of Object.entries(this.settings.modules))
        {
            if(module.isActive && (!module.needsApiKey || this.settings.apiKeyIsValid))
            {
                let classRef;
                
                if(name == "Bazaar_Sorter"){classRef = BazaarSorterModule}
                if(name == "Chain_Targets"){classRef = ChainTargetsModule}
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
                        }, 
                        Throttle_limit:
                        {
                            value: 50, 
                            valueType: "number", 
                            description: "How many API requests to allow within 1 minute, before introducing a 1.5 second delay between requests"
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
                Chain_Targets:
                {
                    isActive: false, 
                    needsApiKey: true, 
                    description: "Description of Chain Targets", 
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
                        }, 
                        Cache_age:
                        {
                            value: 60, 
                            valueType: "number", 
                            description: "When fetching the API for item values, it'll use cached values if they're no older than this (in seconds)"
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
                            description: "You will be notified when your total effectiveness is this or lower"
                        }, 
                        Addiction_limit:
                        {
                            value: -5, 
                            valueType: "number", 
                            description: "You will be notified when your addiction penalty is this or lower"
                        }, 
                        Notification_interval:
                        {
                            value: 21600, 
                            valueType: "number", 
                            description: "How often (in seconds) to notify you while you're at or below either limit"
                        }, 
                        Cache_age:
                        {
                            value: 300,
                            valueType: "number", 
                            description: "When fetching the API for your company information, it'll use cached values if they're no older than this (in seconds)"
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
            
            module.description = settingsTemplate.modules[name].description;
            
            for(let [settingName, setting] of Object.entries(module.settings))
            {
                setting.description = settingsTemplate.modules[name].settings[settingName].description;
                if(setting.hasOwnProperty("possibleValues"))
                {
                    setting.possibleValues = settingsTemplate.modules[name].settings[settingName].possibleValues;
                }
            }
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
            padding: 5px;
        }

        #SettingsModule th:last-child
        {
            font-weight: 600;
            font-size: 18px;
            text-decoration: underline;
            border-left: none;
        }
        
        #SettingsModule th.empty
        {
            border-right: none;
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
            font-size: 14px;
            text-align: center;
            font-weight: 600;
        }
        
        #SettingsModule ul
        {
            list-style-type: none;
            margin-bottom: 0;
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
            <h4 id="skip-to-content" class="left">AquaTools V${GM_info.script.version} Settings</h4>

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
                <th class="empty"></th>
                <th>Modules</th>
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
