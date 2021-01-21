// ==UserScript==
// @name         Torn Bazaar Sorter
// @namespace    
// @version      0.2
// @description
// @author       AquaRegia
// @match        https://www.torn.com/bazaar.php?*
// @grant        none
// ==/UserScript==

(function(original)
{
    window.fetch = async function()
    {
        if(arguments[0].includes("getBazaarItems"))
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
                    let resultList = bazaarItems.list.filter(e => e.name.toLowerCase().includes(searchTerm));
                    resultList = resultList.sort((a, b) => (qualityButton.dataset.order == "1" ? ((a.quality || 0) > (b.quality || 0)) : ((a.quality || 0) < (b.quality || 0))) ? 1 : -1);

                    return Promise.resolve(
                        {
                            text: function()
                            {
                                return Promise.resolve(JSON.stringify(
                                    {
                                        start: bazaarItems.start,
                                        ID: bazaarItems.ID,
                                        list: resultList,
                                        total: resultList.length
                                    }));
                            }
                        });
                }
            }

            let result = await original.apply(this, arguments);
            let json = await result.json();

            let items = json.list;

            if(bazaarItems.list.length < bazaarItems.total && !json.items)
            {
                if(json.start == 0)
                {
                    bazaarItems = {start: 0, ID: json.ID, list: json.list, total: json.total};
                }
                else
                {
                    bazaarItems = {start: 0, ID: json.ID, list: bazaarItems.list.concat(json.list), total: json.total};
                }
            }

            if(qualityButton)
            {
                qualityButton.style.color = bazaarItems.list.length >= bazaarItems.total ? "green" : "red";
            }

            return Promise.resolve(
                {
                    text: function()
                    {
                        return Promise.resolve(JSON.stringify(json));
                    }
                });
        }

        return original.apply(this, arguments);
    };
})(window.fetch);

(function(original)
{
    Element.prototype.appendChild = function()
    {
        let result = original.apply(this, arguments);

        if(arguments[0].className && arguments[0].className.toString().includes("searchBar___"))
        {
            let searchBar = arguments[0];
            let oldButton = searchBar.querySelector("button[aria-label*='Category']");
            let newButton = oldButton.cloneNode(true);
            newButton.ariaLabel = "Search bar button: Quality";
            newButton.innerHTML = "Quality";
            newButton.id = "qualityButton";
            newButton.style.color = bazaarItems.list.length >= bazaarItems.total ? "green" : "red";

            let spoofClick = false;

            searchBar.addEventListener("click", function(e)
            {
                if(spoofClick){return};
                if(bazaarItems.list.length < bazaarItems.total){return};

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

var bazaarItems = {list: [], total: Number.MAX_VALUE};
