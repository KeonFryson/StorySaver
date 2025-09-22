function getSBTitle() {
	var titleEl = document.querySelector('h1.p-title-value');
	return titleEl ? titleEl.textContent.trim() : document.title;
}

function getSBPage() {
	var pageEl = document.querySelector('li.pageNav-page--current, .pageNav-page--current');
	if (pageEl) return pageEl.textContent.trim();
	var match = window.location.href.match(/page-(\d+)/);
	return match ? match[1] : "1";
}

function saveStory() {
	var title = getSBTitle();
	var chapter = "Page " + getSBPage();
	var url = window.location.href;
	var dateSaved = new Date().toISOString();

	var story = { title, chapter, url, dateSaved };

	var savedStories = JSON.parse(localStorage.getItem('savedStories')) || [];
	savedStories = savedStories.filter(s => s.url !== url);
	savedStories.push(story);
	localStorage.setItem('savedStories', JSON.stringify(savedStories));

	return { title, chapter };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "saveStory") {
		const result = saveStory();
		sendResponse({ success: true, ...result });
	}
});
