document.getElementById('saveBtn').addEventListener('click', function () {
	const status = document.getElementById('status');
	// Get user info from chrome.storage
	chrome.storage.local.get(['authToken', 'userEmail', 'userId'], function (items) {
		// You may need to store userId on login, or fetch it from your API using the token/email
		const { authToken, userEmail, userId } = items;
		if (!userId) {
			status.textContent = "Please log in first.";
			status.style.color = "#ef4444";
			return;
		}
		// Get story data from content script
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, { action: "saveStory" }, async function (response) {
				if (chrome.runtime.lastError) {
					status.textContent = "Not a SpaceBattles thread!";
					status.style.color = "#ef4444";
					return;
				}
				if (response && response.success) {
					// Prepare story data for API
					const storyData = {
						user_id: userId,
						title: response.title,
						description: response.chapter // You can add more fields if needed
					};
					try {
						const apiRes = await fetch('https://storysaver.k-m-fryson112115.workers.dev/api/stories', {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json'
								// Optionally add Authorization: `Bearer ${authToken}` if your API uses tokens
							},
							body: JSON.stringify(storyData)
						});
						if (apiRes.ok) {
							status.textContent = `Saved to website: ${response.title} (${response.chapter})`;
							status.style.color = "#10b981";
						} else {
							const err = await apiRes.json();
							status.textContent = "Failed to save to website: " + (err.error || apiRes.statusText);
							status.style.color = "#ef4444";
						}
					} catch (e) {
						status.textContent = "Network error saving to website.";
						status.style.color = "#ef4444";
					}
				} else {
					status.textContent = "Failed to save.";
					status.style.color = "#ef4444";
				}
			});
		});
	});
});
