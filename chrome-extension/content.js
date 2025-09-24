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
	console.log("saveStory called");

	var title = getSBTitle();
	console.log("Title:", title);

	var author = getSBAuthor();
	console.log("Author:", author);

	var description = getSBDescription();
	console.log("Description:", description);

	var chapters = getSBChapters();
	console.log("Chapters:", chapters);

	var url = window.location.href;
	console.log("Current URL:", url);

	var dateSaved = new Date().toISOString();
	console.log("Date saved:", dateSaved);

	const currentAnchor = window.location.hash; // e.g. #post-43477411
	console.log("Current anchor:", currentAnchor);

	let currentChapter = null;
	if (currentAnchor) {
		currentChapter = chapters.find(c => c.url.endsWith(currentAnchor));
		console.log("Current chapter match by anchor:", currentChapter);
	}
	// Fallback: If not found, try to match by page or use the last chapter
	if (!currentChapter) {
		// Try to match by page number if available
		const pageNum = getSBPage();
		currentChapter = chapters[parseInt(pageNum, 10) - 1] || chapters[chapters.length - 1] || null;
		console.log("Current chapter fallback:", currentChapter);
	}

	var story = {
		title,
		author,
		description,
		chapters,
		chapter: currentChapter ? currentChapter.title : "0", // <-- This sets story.chapter to current chapter
		chapterUrl: currentChapter ? currentChapter.url : url,
		url,
		dateSaved,
		currentThreadmark: currentChapter
	};
	console.log("Story object to save:", story);

	var savedStories = JSON.parse(localStorage.getItem('savedStories')) || [];
	console.log("Loaded savedStories:", savedStories);

	savedStories = savedStories.filter(s => s.url !== url);
	console.log("Filtered savedStories:", savedStories);

	savedStories.push(story);
	console.log("Updated savedStories:", savedStories);

	localStorage.setItem('savedStories', JSON.stringify(savedStories));
	console.log("Story saved to localStorage");

	return { title, author, description, chapters, chapter: story.chapter, chapterUrl: story.chapterUrl, currentThreadmark: currentChapter };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "saveStory") {
		const result = saveStory();
		sendResponse({ success: true, ...result });
	}
});
