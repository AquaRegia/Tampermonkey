// ==UserScript==
// @name         ChatGPT Speed Calculator
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Displays how fast a message was generated
// @author       AquaRegia
// @match        https://chat.openai.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        none
// ==/UserScript==

async function sleep(ms)
{
    return new Promise(e => setTimeout(e, ms));
}

function addComment(text)
{
    let allMessages = document.querySelectorAll("main div.items-center.flex-col .text-base");
    let lastMessage = allMessages[allMessages.length - 1];

    let newDiv = document.createElement("div");
    newDiv.className = lastMessage.className;
    newDiv.style.padding = 0;
    newDiv.style.color = "#999";
    newDiv.innerHTML = text;

    lastMessage.parentNode.appendChild(newDiv);
}

(function(original)
{
    window.fetch = function()
    {
        let result = original.apply(this, arguments);

        if(arguments[0] == "https://chat.openai.com/backend-api/conversation")
        {
            result.then(async response =>
            {
                let decoder = new TextDecoder("utf-8");
                let allText = "";
                let gotToTheEnd = false;

                let reader = response.clone().body.getReader();

                while(true)
                {
                    try
                    {
                        const { value, done } = await reader.read();

                        if(done)
                        {
                            break;
                        }
                        else
                        {
                            allText += decoder.decode(value);
                        }
                    }
                    catch(e)
                    {
                        break;
                    }
                }

                let rawJsons = allText.substring(6).split("\n\ndata: ");

                for(let rawJson of rawJsons)
                {
                    if(rawJson == "[DONE]\n\n")
                    {
                        break;
                    }

                    try
                    {
                        let json = JSON.parse(rawJson);
                        console.log(json);

                        if(json.message.end_turn)
                        {
                            let time = Date.now()/1000 - json.message.create_time;
                            let bytes = json.message.content.parts[0].length;

                            if(bytes == 0)
                            {
                                let allMessages = document.querySelectorAll("main div.items-center.flex-col .text-base");
                                let lastMessage = allMessages[allMessages.length - 1];

                                await sleep(50);

                                bytes = lastMessage.innerText.length;
                            }

                            let speed = bytes/time;

                            addComment(`${bytes.toLocaleString()} characters generated in ${time.toFixed(3)} seconds</br>${speed.toLocaleString().split(".")[0]} characters per second`);
                            gotToTheEnd = true;

                            break;
                        }
                    }
                    catch(e){}
                }

                if(!gotToTheEnd)
                {
                    //if gotToTheEnd is false here, we're probably missing data, meaning the output was cut off
                    addComment("Error: This is probably not the entire message");
                }
            });
        }

        return result;
    };
}(window.fetch));
