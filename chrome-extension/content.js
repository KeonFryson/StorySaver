// Utility: Detect site
function getSiteType() {
	const host = window.location.hostname;
	if (host.includes('sufficientvelocity.com')) return 'SV';
	if (host.includes('questionablequesting.com')) return 'QQ';
	if (host.includes('forums.sufficientvelocity.com')) return 'SV';
	if (host.includes('forum.questionablequesting.com')) return 'QQ';
	return 'SB'; // Default: SpaceBattles
}

// Title
function getThreadTitle() {
	const site = getSiteType();
	if (site === 'SV' || site === 'SB') {
		const el = document.querySelector('h1.p-title-value');
		return el ? el.textContent.trim() : document.title;
	}
	if (site === 'QQ') {
		const el = document.querySelector('h1.p-title-value');
		return el ? el.textContent.trim() : document.title;
	}
	return document.title;
}

// Author
async function getThreadAuthor() {
	const site = getSiteType();
	let threadUrl = window.location.href.split('/page-')[0].split('#')[0];
	if (!threadUrl.endsWith('/')) threadUrl += '/';

	try {
		const response = await fetch(threadUrl);
		const html = await response.text();
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		if (site === 'SV' || site === 'SB' || site === 'QQ') {
			const authorEl = doc.querySelector('.message-user .username');
			return authorEl ? authorEl.textContent.trim() : "";
		}
		return "";
	} catch (e) {
		// Fallback: use current page's first post
		const authorEl = document.querySelector('.message-user .username');
		return authorEl ? authorEl.textContent.trim() : "";
	}
}

// Description
async function getThreadDescription() {
	const site = getSiteType();
	let threadUrl = window.location.href.split('/page-')[0].split('#')[0];
	if (!threadUrl.endsWith('/')) threadUrl += '/';

	try {
		const response = await fetch(threadUrl);
		const html = await response.text();

		// Check if DOMParser is available
		if (typeof DOMParser === 'undefined') {
			console.error('DOMParser is undefined!');
			return "";
		}

		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		if (site === 'SV' || site === 'SB' || site === 'QQ') {
			const descEl = doc.querySelector('.message-body .bbWrapper');
			return descEl ? descEl.textContent.trim() : "";
		}
		return "";
	} catch (e) {
		console.error("Failed to fetch page 1 for description:", e);
		const descEl = document.querySelector('.message-body .bbWrapper');
		return descEl ? descEl.textContent.trim() : "";
	}
}

// Chapters/Threadmarks
function getThreadChapters() {
	const site = getSiteType();
	let chapters = [];
	if (site === 'SV' || site === 'SB' || site === 'QQ') {
		document.querySelectorAll('.structItem--threadmark .structItem-title a, .structItem-title a[href*="threadmarks"]').forEach(a => {
			chapters.push({
				title: a.innerText.trim(),
				url: a.href
			});
		});
		if (chapters.length === 0) {
			document.querySelectorAll('.message-threadmarkList .structItem-title a').forEach(a => {
				chapters.push({
					title: a.innerText.trim(),
					url: a.href
				});
			});
		}
	}
	return chapters;
}

// Multi-page threadmarks
async function getAllThreadmarksMultiPage(baseUrl) {
	let allThreadmarks = [];
	let page = 1;
	const parser = new DOMParser();
	const site = getSiteType();

	while (true) {
		let pageUrl;
		if (site === 'SV' || site === 'SB' || site === 'QQ') {
			pageUrl = baseUrl + `threadmarks?per_page=200&page=${page}`;
		} else {
			break;
		}
		const html = await fetch(pageUrl).then(r => r.text());
		const pageDoc = parser.parseFromString(html, 'text/html');
		const threadmarkLinks = pageDoc.querySelectorAll('.structItem--threadmark .structItem-title a');
		const threadmarks = Array.from(threadmarkLinks)
			.filter(a => !a.href.includes('/awards/award/'))
			.map(a => ({
				title: a.innerText.trim(),
				url: a.href
			}));
		if (threadmarks.length === 0) break;
		allThreadmarks.push(...threadmarks);
		page++;
	}
	return allThreadmarks;
}

async function getAllThreadmarksAndCurrentChapter() {
	let baseUrl = window.location.href.split('/page-')[0].split('#')[0];
	if (!baseUrl.endsWith('/')) baseUrl += '/';

	const threadmarks = await getAllThreadmarksMultiPage(baseUrl);

	// Find current chapter by anchor
	const currentAnchor = window.location.hash;
	let currentChapter = null;
	if (currentAnchor) {
		currentChapter = threadmarks.find(tm => tm.url.endsWith(currentAnchor));
	}
	if (!currentChapter) {
		const pageNum = getPageNumber();
		currentChapter = threadmarks[parseInt(pageNum, 10) - 1] || threadmarks[threadmarks.length - 1] || null;
	}

	return {
		threadmarks,
		currentChapter
	};
}

function getPageNumber() {
	var pageEl = document.querySelector('li.pageNav-page--current, .pageNav-page--current');
	if (pageEl) return pageEl.textContent.trim();
	var match = window.location.href.match(/page-(\d+)/);
	return match ? match[1] : "1";
}

async function saveStory() {
	console.log("saveStory called");

	var title = getThreadTitle();
	console.log("Title:", title);

	var author = await getThreadAuthor();
	console.log("Author:", author);

	var description = await getThreadDescription();
	console.log("Description:", description);

	var url = window.location.href;
	var baseUrl = url.split('/page-')[0].split('#')[0];
	if (!baseUrl.endsWith('/')) baseUrl += '/';
	console.log("Current URL:", url);
	console.log("Base Thread URL:", baseUrl);

	var dateSaved = new Date().toISOString();
	console.log("Date saved:", dateSaved);

	const { threadmarks, currentChapter } = await getAllThreadmarksAndCurrentChapter();
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
		currentThreadmarkNumber,
		url,
		baseUrl,
		dateSaved,
		currentThreadmark: currentChapter
	};

	console.log("Story object to save:", story);

	var savedStories = JSON.parse(localStorage.getItem('savedStories')) || [];
	console.log("Loaded savedStories:", savedStories);

	const existingIndex = savedStories.findIndex(s => s.title === title && s.baseUrl === baseUrl);

	if (existingIndex !== -1) {
		savedStories[existingIndex].chapter = story.chapter;
		savedStories[existingIndex].maxChapter = story.maxChapter;
		savedStories[existingIndex].chapterUrl = story.chapterUrl;
		savedStories[existingIndex].currentThreadmarkNumber = story.currentThreadmarkNumber;
		savedStories[existingIndex].url = url;
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
		currentThreadmarkNumber,
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
		return true;
	}
	if (request.action === "getLatestChapters") {
		getAllThreadmarksAndCurrentChapter().then(({ threadmarks }) => {
			sendResponse({
				maxChapter: threadmarks.length,
				chapters: threadmarks
			});
		});
		return true;
	}
});
