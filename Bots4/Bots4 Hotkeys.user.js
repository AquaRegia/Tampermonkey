// ==UserScript==
// @name         Bots4 Hotkeys
// @namespace    
// @version      0.1
// @description  Enables the use of hotkeys in trains/fights
// @author       AquaRegia
// @match        http://bots4.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bots4.net
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';
    function getEventKey(e)
    {
        if(e.key.length == 1 && e.key != " ")
        {
            return e.key.toUpperCase();
        }
        else
        {
            return e.code.replace("Key", "").replace("Numpad", "").replace("Digit", "");
        }
    }

    if(document.location.href.includes("/workshop"))
    {
        function buttonClickEvent(e)
        {
            targetButton = e.target;
            targetButton.value = "…";
            targetButton.blur();
        }

        function buttonSetEvent(e)
        {
            if(targetButton)
            {
                targetButton.value = getEventKey(e);
                GM_setValue("button_" + targetButton.dataset.index, getEventKey(e));

                targetButton.blur();
                targetButton = null;
            }
        }

        function addButton(text, index)
        {
            let newButton = document.createElement("input");
            newButton.type = "submit";
            newButton.value = text;
            newButton.dataset.index = index;

            newButton.addEventListener("click", buttonClickEvent);

            document.querySelector("#hotkeysContainer").appendChild(newButton);
        }

        let targetButton = null;

        let parentTable = Array.from(document.querySelectorAll(".block-list")).slice(-2)[0];
        let newRow = document.createElement("tr");
        newRow.innerHTML = `
            <th><div>Hotkeys:</div></th>
            <td id="hotkeysContainer"></td>
        `;

        Array.from(parentTable.querySelectorAll("tr")).slice(-1)[0].after(newRow);

        addButton(GM_getValue("button_1", "1"), 1);
        addButton(GM_getValue("button_2", "2"), 2);
        addButton(GM_getValue("button_3", "3"), 3);

        window.addEventListener("keyup", buttonSetEvent);
    }
    else if(document.location.href.includes("/fight") || document.location.href.includes("/train"))
    {
        function hotkeyEvent(e)
        {
            let link = document.querySelector("a[data-hotkey='" + getEventKey(e) + "']");

            if(link && !hotkeyPressed)
            {
                hotkeyPressed = true;
                link.click();
            }
        }

        function editLinks()
        {
            const targetNode = document.querySelector("#battle-log");

            if(!targetNode)
            {
                return;
            }

            const config = { attributes: false, childList: true, subtree: true };
            let linksEdited = 0;

            const callback = (mutationList, observer) => {
                for(const mutation of mutationList)
                {
                    for(let addedNode of mutation.addedNodes)
                    {
                        if(addedNode.nodeName == "A" && (addedNode.innerHTML.includes(" again") || addedNode.innerHTML.includes("Back to")))
                        {
                            addedNode.innerHTML = "[" + buttons[linksEdited] + "] " + addedNode.innerHTML;
                            addedNode.dataset.hotkey = buttons[linksEdited];
                            linksEdited++;
                        }
                    }
                }
            };

            const observer = new MutationObserver(callback);
            observer.observe(targetNode, config);
        }

        let buttons = [GM_getValue("button_1", "1"), GM_getValue("button_2", "2"), GM_getValue("button_3", "3")];
        let hotkeyPressed = false;

        window.addEventListener("keyup", hotkeyEvent);
        editLinks();
    }

})();
