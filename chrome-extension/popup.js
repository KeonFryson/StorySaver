const API_BASE = 'https://storysaver.k-m-fryson112115.workers.dev';

document.addEventListener('DOMContentLoaded', () => {
	const authForm = document.getElementById('auth-form');
	const toggleBtn = document.getElementById('toggle-signup');
	const loginStatus = document.getElementById('loginStatus');
	const saveStoryForm = document.getElementById('saveStoryForm');
	const statusDiv = document.getElementById('status');
	const loggedInBox = document.getElementById('loggedInBox');
	const userInfo = document.getElementById('userInfo');
	const logoutBtn = document.getElementById('logoutBtn');

	let isSignUp = false;
	let currentUser = null;

	// Toggle sign up / sign in
	toggleBtn.addEventListener('click', () => {
		isSignUp = !isSignUp;
		const submitBtn = authForm.querySelector('button[type="submit"]');
		if (isSignUp) {
			toggleBtn.textContent = 'Already have an account? Sign in';
			submitBtn.textContent = 'Create Account';
		} else {
			toggleBtn.textContent = 'Need an account? Sign up';
			submitBtn.textContent = 'Sign In';
		}
		loginStatus.textContent = '';
	});

	authForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		const email = document.getElementById('email').value;
		const password = document.getElementById('password').value;
		loginStatus.style.color = '#1e293b';
		loginStatus.textContent = isSignUp ? 'Creating account...' : 'Signing in...';

		try {
			let res, data;
			if (isSignUp) {
				res = await fetch(`${API_BASE}/api/users`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, username: email, password })
				});
				data = await res.json();
				console.log('Signup response:', data);
				if (res.ok) {
					loginStatus.style.color = '#10b981';
					loginStatus.textContent = 'Account created! Please sign in.';
					setTimeout(() => {
						toggleBtn.click();
					}, 1200);
				} else {
					loginStatus.style.color = '#ef4444';
					loginStatus.textContent = data.error || 'Sign up failed.';
				}
			} else {
				res = await fetch(`${API_BASE}/api/auth`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password })
				});
				data = await res.json();
				console.log('Login response:', data);
				if (res.ok && data.user) {
					loginStatus.style.color = '#10b981';
					loginStatus.textContent = 'Signed in!';
					currentUser = data.user;
					localStorage.setItem('storySaverUser', JSON.stringify(currentUser));
					showLoggedInState(currentUser.email);
				} else {
					loginStatus.style.color = '#ef4444';
					loginStatus.textContent = data.error || 'Invalid credentials!';
				}
			}
		} catch (err) {
			console.error('Network error:', err);
			loginStatus.style.color = '#ef4444';
			loginStatus.textContent = 'Network error.';
		}
		loginStatus.scrollIntoView({ behavior: "smooth", block: "center" });
	});

	function showLoggedInState(email) {
		authForm.style.display = 'none';
		toggleBtn.style.display = 'none';
		saveStoryForm.style.display = 'flex';
		loggedInBox.style.display = 'block';
		userInfo.textContent = 'Welcome, ' + email;
		statusDiv.textContent = '';
	}

	// Handle logout
	logoutBtn.addEventListener('click', () => {
		currentUser = null;
		localStorage.removeItem('storySaverUser');
		authForm.style.display = 'flex';
		toggleBtn.style.display = 'inline-block';
		saveStoryForm.style.display = 'none';
		loggedInBox.style.display = 'none';
		loginStatus.textContent = '';
		statusDiv.textContent = '';
		authForm.reset();
		saveStoryForm.reset();
	});

	// Handle save story
	// Handle save story
	saveStoryForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		statusDiv.style.color = '#1e293b';
		statusDiv.textContent = 'Saving...';
		const user = currentUser || JSON.parse(localStorage.getItem('storySaverUser') || 'null');
		if (!user) {
			statusDiv.style.color = '#ef4444';
			statusDiv.textContent = 'Please sign in first.';
			return;
		}

		// Get the active tab
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const tab = tabs[0];
			if (!tab || !tab.id) {
				statusDiv.style.color = '#ef4444';
				statusDiv.textContent = 'No active tab found.';
				return;
			}
			// Ask content script to extract and save story
			chrome.tabs.sendMessage(tab.id, { action: "saveStory" }, async (response) => {
				if (!response || !response.success) {
					statusDiv.style.color = '#ef4444';
					statusDiv.textContent = 'Failed to extract story data.';
					return;
				}
				// Prepare story data for API
				const newStory = {
					user_id: user.id,
					title: response.title,
					url: tab.url,
					description: response.description,
					author: response.author,
					chapters: response.chapters, // <-- add this
					chapter: response.chapter,   // <-- add this
					chapterUrl: response.chapterUrl, // <-- add this
					tags: response.tags || "",   // <-- add this if available
					datesaved: new Date().toISOString()
				};
				try {
					const res = await fetch(`${API_BASE}/api/stories`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(newStory)
					});
					if (res.ok) {
						statusDiv.style.color = '#10b981';
						statusDiv.textContent = 'Story saved!';
					} else {
						const data = await res.json();
						statusDiv.style.color = '#ef4444';
						statusDiv.textContent = data.error || 'Failed to save story.';
					}
				} catch (err) {
					statusDiv.style.color = '#ef4444';
					statusDiv.textContent = 'Network error.';
				}
			});
		});
	});
	// Auto-login if user info is stored
	const user = JSON.parse(localStorage.getItem('storySaverUser') || 'null');
	if (user) {
		currentUser = user;
		showLoggedInState(user.email);
	}
});
