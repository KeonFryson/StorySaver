document.getElementById('loginForm').addEventListener('submit', async function (e) {
	e.preventDefault();
	const email = document.getElementById('email').value;
	const password = document.getElementById('password').value;
	const loginStatus = document.getElementById('loginStatus');

	try {
		const response = await fetch('https://storysaver.k-m-fryson112115.workers.dev/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});

		if (response.ok) {
			const data = await response.json();
			// Store token and email in chrome.storage for later use
			chrome.storage.local.set({ authToken: data.token, userEmail: email }, function () {
				loginStatus.textContent = "Login successful!";
				loginStatus.style.color = "#10b981";
			});
		} else {
			loginStatus.textContent = "Login failed. Check your credentials.";
			loginStatus.style.color = "#ef4444";
		}
	} catch (error) {
		loginStatus.textContent = "Network error.";
		loginStatus.style.color = "#ef4444";
	}
});

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
