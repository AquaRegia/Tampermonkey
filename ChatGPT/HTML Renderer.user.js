// ==UserScript==
// @name         ChatGPT HTML Renderer
// @version      0.1
// @description  Adds functionality to HTML code blocks
// @author       AquaRegia
// @match        https://chat.openai.com/chat/*
// @match        https://chat.openai.com/chat
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        none
// ==/UserScript==

setInterval(function()
{
	document.querySelectorAll("pre:not(.done) > div").forEach(e => 
	{
		let typeElement = e.children[0].querySelector("span");

		if(typeElement.textContent == "html")
		{
			let f = document.createElement("iframe");
			f.style.display = "none";
			f.style.width = "100%";
			f.style.height = "640px";
			
			e.appendChild(f);
			
			let launcher = document.createElement("span");
			launcher.style.marginLeft = "auto";
			launcher.textContent = "open in new window";
		
			typeElement.after(launcher);
		
			typeElement.style.cursor = "pointer";
			launcher.style.cursor = "pointer";
			
			launcher.addEventListener("click", label => 
			{
				let newWindow = window.open("about:blank", "newWindow");
				newWindow.document.write(e.children[1].innerText);
				newWindow.document.close();
			});
			
			typeElement.addEventListener("click", label => 
			{
				f.srcdoc = e.children[1].innerText;
			
				[e.children[1].style.display, e.children[2].style.display] = [e.children[2].style.display, e.children[1].style.display];
			});
		}
		
		e.parentNode.className = "done";
	});
}, 1000);
