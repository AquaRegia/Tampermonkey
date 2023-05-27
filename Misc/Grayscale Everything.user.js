// ==UserScript==
// @name         Grayscale Everything
// @namespace    
// @version      0.2
// @description  Remove all colors from every website
// @author       AquaRegia
// @match        *://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document_start
// ==/UserScript==

(function() {
    'use strict';
    let style = GM_addStyle("html{filter: grayscale(1) !important;}");

    function toggle()
    {
        if(!style.disabled)
        {
            style.disabled = true;
            GM_setValue("disabled", true);
        }
        else
        {
            style.disabled = false;
            GM_setValue("disabled", false);
        }
    }

    let disabled = GM_getValue("disabled", false);

    if(disabled)
    {
        toggle();
    }

    GM_registerMenuCommand("Toggle", toggle);

})();
