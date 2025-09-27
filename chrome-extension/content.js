function getSBTitle() {
	var titleEl = document.querySelector('h1.p-title-value');
	return titleEl ? titleEl.textContent.trim() : document.title;
}
function getBaseThreadUrl(url) {
	// Remove /page-... and #post-... from the URL
	let base = url.split('/page-')[0].split('#')[0];
	// Ensure trailing slash for consistency
	if (!base.endsWith('/')) base += '/';
	return base;
}
async function getSBAuthor() {
	// Get the thread's base URL (without page or anchor)
	let threadUrl = window.location.href.split('/page-')[0].split('#')[0];
	if (!threadUrl.endsWith('/')) threadUrl += '/';

	try {
		const response = await fetch(threadUrl);
		const html = await response.text();
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		const authorEl = doc.querySelector('.message-user .username');
		return authorEl ? authorEl.textContent.trim() : "";
	} catch (e) {
		console.error("Failed to fetch page 1 for author:", e);
		// Fallback: use current page's first post
		var authorEl = document.querySelector('.message-user .username');
		return authorEl ? authorEl.textContent.trim() : "";
	}
}
async function getSBDescription() {
	// Get the thread's base URL (without page or anchor)
	let threadUrl = window.location.href.split('/page-')[0].split('#')[0];
	// Ensure it ends with a slash
	if (!threadUrl.endsWith('/')) threadUrl += '/';

	// Fetch page 1
	try {
		const response = await fetch(threadUrl);
		const html = await response.text();
		// Create a DOM parser
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		// Get the first post's description
		const descEl = doc.querySelector('.message-body .bbWrapper');
		return descEl ? descEl.textContent.trim() : "";
	} catch (e) {
		console.error("Failed to fetch page 1 for description:", e);
		// Fallback: use current page's first post
		var descEl = document.querySelector('.message-body .bbWrapper');
		return descEl ? descEl.textContent.trim() : "";
	}
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
 
async function getAllThreadmarksMultiPage(baseUrl) {
	let allThreadmarks = [];
	let page = 1;
	const parser = new DOMParser();

	while (true) {
		const pageUrl = baseUrl + `threadmarks?per_page=200&page=${page}`;
		const html = await fetch(pageUrl).then(r => r.text());
		const pageDoc = parser.parseFromString(html, 'text/html');
		const threadmarkLinks = pageDoc.querySelectorAll('.structItem--threadmark .structItem-title a');
		const threadmarks = Array.from(threadmarkLinks)
			.filter(a => !a.href.includes('/awards/award/'))
			.map(a => ({
				title: a.innerText.trim(),
				url: a.href
			}));
		if (threadmarks.length === 0) break; // No more threadmarks, stop
		allThreadmarks.push(...threadmarks);
		page++;
	}
	return allThreadmarks;
}

async function getSBAllThreadmarksAndCurrentChapter() {
	let baseUrl = window.location.href.split('/page-')[0].split('#')[0];
	if (!baseUrl.endsWith('/')) baseUrl += '/';

	const threadmarks = await getAllThreadmarksMultiPage(baseUrl);

	// Find current chapter by anchor
	const currentAnchor = window.location.hash;
	let currentChapter = null;
	if (currentAnchor) {
		currentChapter = threadmarks.find(tm => tm.url.endsWith(currentAnchor));
	}
	// Fallback: Try to match by page number if available
	if (!currentChapter) {
		const pageNum = getSBPage();
		currentChapter = threadmarks[parseInt(pageNum, 10) - 1] || threadmarks[threadmarks.length - 1] || null;
	}

	return {
		threadmarks,
		currentChapter
	};
}

function getSBPage() {
	var pageEl = document.querySelector('li.pageNav-page--current, .pageNav-page--current');
	if (pageEl) return pageEl.textContent.trim();
	var match = window.location.href.match(/page-(\d+)/);
	return match ? match[1] : "1";
}

async function saveStory() {
	console.log("saveStory called");

	var title = getSBTitle();
	console.log("Title:", title);

	var author = await getSBAuthor();
	console.log("Author:", author);

	var description = await getSBDescription();
	console.log("Description:", description);

	var url = window.location.href;
	var baseUrl = getBaseThreadUrl(url);
	console.log("Current URL:", url);
	console.log("Base Thread URL:", baseUrl);

	var dateSaved = new Date().toISOString();
	console.log("Date saved:", dateSaved);

	const { threadmarks, currentChapter } = await getSBAllThreadmarksAndCurrentChapter();
	console.log("Threadmarks:", threadmarks);
	console.log("Current chapter:", currentChapter);

	var maxChapter = threadmarks.length;
	console.log("Max chapter number:", maxChapter);

	let currentThreadmarkNumber = null;
	if (currentChapter) {
		const idx = threadmarks.findIndex(tm => tm.url === currentChapter.url);
		currentThreadmarkNumber = idx !== -1 ? idx + 1 : null;
	}
	console.log("Current threadmark number:", currentThreadmarkNumber);


	var story = {
		title,
		author,
		description,
		chapters: threadmarks,
		chapter: currentChapter ? currentChapter.title : "0",
		chapterUrl: currentChapter ? currentChapter.url : url,
		maxChapter,
		currentThreadmarkNumber, // <-- Added here
		url,      // full current URL (with page/post)
		baseUrl,  // base thread URL (no page/post)
		dateSaved,
		currentThreadmark: currentChapter
	};

	console.log("Story object to save:", story);

	var savedStories = JSON.parse(localStorage.getItem('savedStories')) || [];
	console.log("Loaded savedStories:", savedStories);

	// Match by both title and baseUrl
	const existingIndex = savedStories.findIndex(s => s.title === title && s.baseUrl === baseUrl);

	if (existingIndex !== -1) {
		// Only update chapter, chapterUrl, url, and dateSaved for the matching story
		savedStories[existingIndex].chapter = story.chapter;
		savedStories[existingIndex].maxChapter = story.maxChapter;
		savedStories[existingIndex].chapterUrl = story.chapterUrl;
		savedStories[existingIndex].currentThreadmarkNumber = story.currentThreadmarkNumber;
		savedStories[existingIndex].url = url; // update last read location
		savedStories[existingIndex].dateSaved = dateSaved;
		savedStories[existingIndex].currentThreadmark = story.currentThreadmark;
		console.log("Updated chapter for existing story with same title and baseUrl.");
	} else {
		savedStories.push(story);
		console.log("Added new story.");
	}

	localStorage.setItem('savedStories', JSON.stringify(savedStories));
	console.log("Story saved to localStorage");

	return {
		title,
		author,
		description,
		chapters: threadmarks,
		chapter: story.chapter,
		maxChapter,
		currentThreadmarkNumber, // <-- Added here
		chapterUrl: story.chapterUrl,
		currentThreadmark: currentChapter,
		url,
		baseUrl
	};
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "saveStory") {
		saveStory().then(result => {
			sendResponse({ success: true, ...result });
		});
		return true; // Required for async sendResponse
	}
});
