function getSBTitle() {
	var titleEl = document.querySelector('h1.p-title-value');
	return titleEl ? titleEl.textContent.trim() : document.title;
}

function getSBAuthor() {
	var authorEl = document.querySelector('.message-user .username');
	return authorEl ? authorEl.textContent.trim() : "";
}

function getSBDescription() {
	var descEl = document.querySelector('.message-body .bbWrapper');
	return descEl ? descEl.textContent.trim() : "";
}

function getSBChapters() {
	let chapters = [];
	// Try to get threadmarks from the threadmarks block
	document.querySelectorAll('.structItem--threadmark .structItem-title a, .structItem-title a[href*="threadmarks"]').forEach(a => {
		chapters.push({
			title: a.innerText.trim(),
			url: a.href
		});
	});
	// Fallback: Try to get threadmarks from the threadmarks list
	if (chapters.length === 0) {
		document.querySelectorAll('.message-threadmarkList .structItem-title a').forEach(a => {
			chapters.push({
				title: a.innerText.trim(),
				url: a.href
			});
		});
	}
	return chapters;
}

function getSBPage() {
	var pageEl = document.querySelector('li.pageNav-page--current, .pageNav-page--current');
	if (pageEl) return pageEl.textContent.trim();
	var match = window.location.href.match(/page-(\d+)/);
	return match ? match[1] : "1";
}

function saveStory() {
	var title = getSBTitle();
	var author = getSBAuthor();
	var description = getSBDescription();
	var chapters = getSBChapters();
	var chapter = "Page " + getSBPage();
	var url = window.location.href;
	var dateSaved = new Date().toISOString();

	var story = { title, author, description, chapters, chapter, url, dateSaved };

	var savedStories = JSON.parse(localStorage.getItem('savedStories')) || [];
	savedStories = savedStories.filter(s => s.url !== url);
	savedStories.push(story);
	localStorage.setItem('savedStories', JSON.stringify(savedStories));

	return { title, author, description, chapters, chapter };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "saveStory") {
		const result = saveStory();
		sendResponse({ success: true, ...result });
	}
});
