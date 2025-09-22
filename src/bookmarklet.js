(function () {
	function getSBTitle() {
		// Try to get the thread title from the page
		var titleEl = document.querySelector('h1.p-title-value');
		return titleEl ? titleEl.textContent.trim() : document.title;
	}

	function getSBPage() {
		// Try to get the current page number
		var pageEl = document.querySelector('li.pageNav-page--current, .pageNav-page--current');
		if (pageEl) return pageEl.textContent.trim();
		// Fallback: try to parse from URL
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
		// Remove any existing entry for this URL
		savedStories = savedStories.filter(s => s.url !== url);
		savedStories.push(story);
		localStorage.setItem('savedStories', JSON.stringify(savedStories));

		// Optionally, show a quick confirmation
		alert('Story saved!\n\n' + title + '\n' + chapter);
	}

	// Only run on SpaceBattles
	if (location.hostname.endsWith('spacebattles.com')) {
		saveStory();
	} else {
		alert('This bookmarklet only works on SpaceBattles forums.');
	}
})();
