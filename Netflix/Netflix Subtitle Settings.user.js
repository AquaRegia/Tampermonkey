// ==UserScript==
// @name         Netflix Subtitle Settings
// @namespace    
// @version      0.1
// @description  
// @author       AquaRegia
// @match        https://www.netflix.com/*
// @grant        GM_addStyle
// ==/UserScript==

var globalStyle;

function getSettings()
{
    var settings = localStorage.getItem("subtitleSettings");
    return settings ? JSON.parse(settings) : {textColor: "#ffffff", shadowColor: "#000000", fontSize: "30", fontFamily: "Netflix Sans", shadowSize: "8"};
}

function updateStyle()
{
    var settings = getSettings();

    if(globalStyle)
    {
        globalStyle.parentNode.removeChild(globalStyle);
    }

    globalStyle = GM_addStyle(`
.player-timedtext-text-container > span, #colorHeader
{
    color: ${settings.textColor} !important;
    text-shadow: ${settings.shadowColor} 0px 0px ${settings.shadowSize}px !important;
    font-family: ${settings.fontFamily} !important;
}

.player-timedtext-text-container > span
{
    font-size: ${settings.fontSize}px !important;
}
`);
}

function saveSettings()
{
    var settings = {textColor: document.querySelector("#textColor").value,
                    shadowColor: document.querySelector("#shadowColor").value,
                    fontSize: document.querySelector("#fontSize").value,
                    fontFamily: document.querySelector("#fontFamily").value,
                    shadowSize: document.querySelector("#shadowSize").value};
    localStorage.setItem("subtitleSettings", JSON.stringify(settings));

    updateStyle();
}

function getSettingsElement()
{
    var settings = getSettings();

    var container = document.createElement("div");
    container.className = "track-list structural";

    var header = document.createElement("h3");
    header.className = "list-header";
    header.id = "colorHeader";
    header.style.padding = getComputedStyle(document.querySelector(".list-header")).padding;

    var list = document.createElement("ul");
    var listItemTextColor = document.createElement("li");
    var listItemShadowColor = document.createElement("li");
    var listItemFontSize = document.createElement("li");
    var listItemFontFamily = document.createElement("li");
    var listItemShadowSize = document.createElement("li");

    var inputTextColor = document.createElement("input");
    inputTextColor.type = "color";
    inputTextColor.id = "textColor";
    inputTextColor.value = settings.textColor;
    inputTextColor.addEventListener("input", saveSettings);

    var inputShadowColor = document.createElement("input");
    inputShadowColor.type = "color";
    inputShadowColor.id = "shadowColor";
    inputShadowColor.value = settings.shadowColor;
    inputShadowColor.addEventListener("input", saveSettings);

    var inputFontSize = document.createElement("input");
    inputFontSize.type = "range";
    inputFontSize.id = "fontSize";
    inputFontSize.min = "16";
    inputFontSize.max = "70";
    inputFontSize.step = "2";
    inputFontSize.value = settings.fontSize;
    inputFontSize.addEventListener("input", saveSettings);

    var selectFontFamily = document.createElement("select");
    selectFontFamily.id = "fontFamily";
    selectFontFamily.style.color = "black";
    selectFontFamily.style.userSelect = "all";
    selectFontFamily.addEventListener("change", saveSettings);
    selectFontFamily.addEventListener("mouseup", e => e.stopPropagation());
    selectFontFamily.addEventListener("click", e => e.stopPropagation());

    var selectedFontFamily = settings.fontFamily;

    for(const font of ["Netflix Sans", "Alice", "Amatic SC", "Caveat", "Philosopher", "Roboto", "Space Mono", "Ultra", "VT323"])
    {
        let option = document.createElement("option");
        option.value = font;
        option.innerHTML = font;

        if(font == selectedFontFamily)
        {
            option.selected = "selected";
        }

        selectFontFamily.appendChild(option);
    }

    var inputShadowSize = document.createElement("input");
    inputShadowSize.type = "range";
    inputShadowSize.id = "shadowSize";
    inputShadowSize.min = "0";
    inputShadowSize.max = "50";
    inputShadowSize.step = "2";
    inputShadowSize.value = settings.shadowSize;
    inputShadowSize.addEventListener("input", saveSettings);

    container.appendChild(header);
    container.appendChild(list);

    header.appendChild(document.createTextNode("Settings"));

    list.appendChild(listItemFontFamily);
    list.appendChild(listItemTextColor);
    list.appendChild(listItemFontSize);
    list.appendChild(listItemShadowColor);
    list.appendChild(listItemShadowSize);

    listItemFontFamily.appendChild(selectFontFamily);
    listItemFontFamily.appendChild(document.createTextNode(" Font"));

    listItemTextColor.appendChild(inputTextColor);
    listItemTextColor.appendChild(document.createTextNode(" Text color"));

    listItemFontSize.appendChild(inputFontSize);
    listItemFontSize.appendChild(document.createTextNode(" Text size"));

    listItemShadowColor.appendChild(inputShadowColor);
    listItemShadowColor.appendChild(document.createTextNode(" Shadow color"));

    listItemShadowSize.appendChild(inputShadowSize);
    listItemShadowSize.appendChild(document.createTextNode(" Shadow size"));

    return container;
}

const targetNode = document.body;
const config = {childList: true, subtree: true};

const callback = function(mutationsList, observer)
{
    for(const mutation of mutationsList)
    {
        if(mutation.addedNodes.length > 0)
        {
            if(mutation.addedNodes[0].className == "popup-content audio-subtitle-controller")
            {
                mutation.addedNodes[0].appendChild(getSettingsElement());
            }
        }
    }
};

const observer = new MutationObserver(callback);
observer.observe(targetNode, config);

GM_addStyle(`
@import url('https://fonts.googleapis.com/css2?family=Alice&family=Amatic+SC&family=Caveat&family=Philosopher&family=Roboto&family=Space+Mono&family=Ultra&family=VT323&display=swap');
`);

updateStyle();
