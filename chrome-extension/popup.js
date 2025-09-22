document.getElementById('saveBtn').addEventListener('click', function () {
	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
		chrome.tabs.sendMessage(tabs[0].id, { action: "saveStory" }, function (response) {
			const status = document.getElementById('status');
			if (chrome.runtime.lastError) {
				status.textContent = "Not a SpaceBattles thread!";
				status.style.color = "#ef4444";
			} else if (response && response.success) {
				status.textContent = `Saved: ${response.title} (${response.chapter})`;
				status.style.color = "#10b981";
			} else {
				status.textContent = "Failed to save.";
				status.style.color = "#ef4444";
			}
		});
	});
});
