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
	console.debug("saveStory called");

	var title = getSBTitle();
	console.debug("Title:", title);

	var author = getSBAuthor();
	console.debug("Author:", author);

	var description = getSBDescription();
	console.debug("Description:", description);

	var chapters = getSBChapters();
	console.debug("Chapters:", chapters);

	var chapter = "Page " + getSBPage();
	console.debug("Current page:", chapter);

	var url = window.location.href;
	console.debug("Current URL:", url);

	var dateSaved = new Date().toISOString();
	console.debug("Date saved:", dateSaved);

	const currentAnchor = window.location.hash;
	console.debug("Current anchor:", currentAnchor);

	let currentThreadmark = null;
	if (currentAnchor) {
		currentThreadmark = chapters.find(c => c.url.endsWith(currentAnchor));
		console.debug("Threadmark match by anchor:", currentThreadmark);
	}

	var story = {
		title,
		author,
		description,
		chapters,
		chapter,
		url,
		dateSaved,
		currentThreadmark
	};
	console.debug("Story object to save:", story);

	var savedStories = JSON.parse(localStorage.getItem('savedStories')) || [];
	console.debug("Loaded savedStories:", savedStories);

	savedStories = savedStories.filter(s => s.url !== url);
	console.debug("Filtered savedStories:", savedStories);

	savedStories.push(story);
	console.debug("Updated savedStories:", savedStories);

	localStorage.setItem('savedStories', JSON.stringify(savedStories));
	console.debug("Story saved to localStorage");

	return { title, author, description, chapters, chapter, currentThreadmark };
} chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "saveStory") {
		const result = saveStory();
		sendResponse({ success: true, ...result });
	}
});
