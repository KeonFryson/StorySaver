export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const { pathname, searchParams } = url;

		console.log(`[DEBUG] Incoming request: ${request.method} ${pathname}`);

		// Helper: parse JSON body
		async function getJsonBody(req) {
			try {
				const body = await req.json();
				console.log(`[DEBUG] Parsed JSON body:`, body);
				return body;
			} catch (err) {
				console.log(`[DEBUG] Failed to parse JSON body:`, err);
				return null;
			}
		}

		// --- PASSWORD HASHING HELPERS ---

		async function hashPassword(password, salt = null) {
			const encoder = new TextEncoder();
			const pwBuffer = encoder.encode(password);
			salt = salt || crypto.getRandomValues(new Uint8Array(16));
			const key = await crypto.subtle.importKey(
				"raw", pwBuffer, { name: "PBKDF2" }, false, ["deriveBits", "deriveKey"]
			);
			const derived = await crypto.subtle.deriveBits(
				{
					name: "PBKDF2",
					salt: salt,
					iterations: 100_000,
					hash: "SHA-256"
				},
				key,
				256
			);
			return {
				salt: btoa(String.fromCharCode(...salt)),
				hash: btoa(String.fromCharCode(...new Uint8Array(derived)))
			};
		}

		async function verifyPassword(password, storedHash, storedSalt) {
			const salt = Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
			const { hash } = await hashPassword(password, salt);
			return hash === storedHash;
		}

		// --- USERS ---

		// Create user: POST /api/users { email, username, password }
		if (pathname === "/api/users" && request.method === "POST") {
			const body = await getJsonBody(request);
			console.log(`[DEBUG] /api/users POST body:`, body);
			if (!body?.email || !body?.username || !body?.password) {
				console.log(`[DEBUG] Missing email, username, or password`);
				return json({ error: "Missing email, username, or password" }, 400);
			}
			try {
				const { hash, salt } = await hashPassword(body.password);
				console.log(`[DEBUG] Hashed password for ${body.email}`);
				const stmt = env.storytracker_db.prepare(
					"INSERT INTO users (email, username, password, salt) VALUES (?, ?, ?, ?)"
				);
				await stmt.bind(body.email, body.username, hash, salt).run();
				console.log(`[DEBUG] User created: ${body.email}`);
				return json({ success: true });
			} catch (err) {
				console.log(`[DEBUG] Error creating user:`, err);
				return json({ error: err.message }, 400);
			}
		}

		// List users: GET /api/users
		if (pathname === "/api/users" && request.method === "GET") {
			console.log(`[DEBUG] /api/users GET`);
			const { results } = await env.storytracker_db.prepare(
				"SELECT id, email, username, created_at FROM users"
			).all();
			return json(results);
		}

		// --- AUTH ---

		// Login: POST /api/auth { email, password }
		if (pathname === "/api/auth" && request.method === "POST") {
			const body = await getJsonBody(request);
			console.log(`[DEBUG] /api/auth POST body:`, body);
			const { email, password } = body || {};
			if (!email || !password) {
				console.log(`[DEBUG] Missing email or password`);
				return json({ error: "Missing email or password" }, 400);
			}

			const { results } = await env.storytracker_db.prepare(
				"SELECT id, email, password, salt FROM users WHERE email = ?"
			).bind(email).all();
			if (results.length === 0) {
				console.log(`[DEBUG] No user found for email: ${email}`);
				return json({ error: "Invalid credentials" }, 401);
			}

			const user = results[0];
			const valid = await verifyPassword(password, user.password, user.salt);
			console.log(`[DEBUG] Password valid for ${email}: ${valid}`);
			if (!valid) {
				console.log(`[DEBUG] Invalid password for ${email}`);
				return json({ error: "Invalid credentials" }, 401);
			}

			console.log(`[DEBUG] Auth success for ${email}`);
			return json({ user: { id: user.id, email: user.email } });
		}

		// --- STORIES ---

		// Create or update story: POST /api/stories { user_id, title, description, url, ... }
		if (pathname === "/api/stories" && request.method === "POST") {
			const body = await getJsonBody(request);
			console.log(`[DEBUG] /api/stories POST body:`, body);
			if (!body?.user_id || !body?.title || !body?.url) {
				console.log(`[DEBUG] Missing user_id, title, or url`);
				return json({ error: "Missing user_id, title, or url" }, 400);
			}
			try {
				// Check if story exists for this user and title
				const { results } = await env.storytracker_db.prepare(
					"SELECT id FROM stories WHERE user_id = ? AND title = ?"
				).bind(body.user_id, body.title).all();

				if (results.length > 0) {
					// Update existing story
					const storyId = results[0].id;
					const stmt = env.storytracker_db.prepare(
						`UPDATE stories SET
					title = ?,
					description = ?,
					author = ?,
					datesaved = ?,
					chapter = ?,
					maxChapter = ?,
					chapterUrl = ?,
					tags = ?,
					chapters = ?,
					baseUrl = ?,
					url = ?,
					currentThreadmarkNumber = ?
				WHERE id = ?`
					);
					await stmt.bind(
						body.title,
						body.description || null,
						body.author || null,
						body.datesaved || null,
						body.chapter || null,
						body.maxChapter || null,
						body.chapterUrl || null,
						body.tags || null,
						body.chapters ? JSON.stringify(body.chapters) : null,
						body.baseUrl || null,
						body.url || null,
						body.currentThreadmarkNumber || null,
						storyId
					).run();
					console.log(`[DEBUG] Story updated for user_id: ${body.user_id}, title: ${body.title}`);
					return json({ success: true, updated: true });
				} else {
					// Insert new story
					const stmt = env.storytracker_db.prepare(
						"INSERT INTO stories (user_id, title, description, author, url, baseUrl, datesaved, chapter, maxChapter, chapterUrl, tags, chapters, currentThreadmarkNumber) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
					);
					await stmt.bind(
						body.user_id,
						body.title,
						body.description || null,
						body.author || null,
						body.url || null,
						body.baseUrl || null,
						body.datesaved || null,
						body.chapter || null,
						body.maxChapter || null,
						body.chapterUrl || null,
						body.tags || null,
						body.chapters ? JSON.stringify(body.chapters) : null,
						body.currentThreadmarkNumber || null
					).run();
					console.log(`[DEBUG] Story created for user_id: ${body.user_id}, title: ${body.title}`);
					return json({ success: true, created: true });
				}
			} catch (err) {
				console.log(`[DEBUG] Error creating/updating story:`, err);
				return json({ error: err.message }, 400);
			}
		}

		// List stories: GET /api/stories?user_id=#
		if (pathname === "/api/stories" && request.method === "GET") {
			const user_id = searchParams.get("user_id");
			console.log(`[DEBUG] /api/stories GET for user_id: ${user_id}`);
			let query = "SELECT id, user_id, title, description, author, url, baseUrl, datesaved, chapter, maxChapter, maxChapterUpdatedAt, chapterUrl, tags, chapters, currentThreadmarkNumber, created_at FROM stories";
			let params = [];
			if (user_id) {
				query += " WHERE user_id = ?";
				params.push(user_id);
			}
			const { results } = await env.storytracker_db.prepare(query).bind(...params).all();
			return json(results);
		}

		if (pathname.startsWith("/api/stories/") && request.method === "DELETE") {
			const id = pathname.split("/").pop();
			console.log(`[DEBUG] DELETE /api/stories/${id}`);
			if (!id) {
				return json({ error: "Missing story id" }, 400);
			}
			try {
				const stmt = env.storytracker_db.prepare(
					"DELETE FROM stories WHERE id = ?"
				);
				const result = await stmt.bind(id).run();
				if (result.changes === 0) {
					return json({ error: "Story not found" }, 404);
				}
				console.log(`[DEBUG] Story deleted: ${id}`);
				return json({ success: true });
			} catch (err) {
				console.log(`[DEBUG] Error deleting story:`, err);
				return json({ error: err.message }, 400);
			}
		}

		// --- CHAPTERS ---

		// Create chapter: POST /api/chapters { story_id, title, content, chapter_number }
		if (pathname === "/api/chapters" && request.method === "POST") {
			const body = await getJsonBody(request);
			console.log(`[DEBUG] /api/chapters POST body:`, body);
			if (!body?.story_id || !body?.title || !body?.content) {
				console.log(`[DEBUG] Missing story_id, title, or content`);
				return json({ error: "Missing story_id, title, or content" }, 400);
			}
			try {
				const stmt = env.storytracker_db.prepare(
					"INSERT INTO chapters (story_id, title, content, chapter) VALUES (?, ?, ?, ?)"
				);
				await stmt.bind(
					body.story_id,
					body.title,
					body.content,
					body.chapter || null
				).run();
				console.log(`[DEBUG] Chapter created for story_id: ${body.story_id}, title: ${body.title}`);
				return json({ success: true });
			} catch (err) {
				console.log(`[DEBUG] Error creating chapter:`, err);
				return json({ error: err.message }, 400);
			}
		}

		// List chapters: GET /api/chapters?story_id=#
		if (pathname === "/api/chapters" && request.method === "GET") {
			const story_id = searchParams.get("story_id");
			console.log(`[DEBUG] /api/chapters GET for story_id: ${story_id}`);
			let query = `SELECT id, user_id, title, description, author, url, datesaved, chapter, chapterUrl, tags, chapters, created_at FROM stories`;
			let params = [];
			if (story_id) {
				query += " WHERE story_id = ?";
				params.push(story_id);
			}
			const { results } = await env.storytracker_db.prepare(query).bind(...params).all();
			return json(results);
		}

		// --- TRACKING ---

		// Update tracking: POST /api/tracking { user_id, story_id, current_chapter }
		if (pathname === "/api/tracking" && request.method === "POST") {
			const body = await getJsonBody(request);
			console.log(`[DEBUG] /api/tracking POST body:`, body);
			if (!body?.user_id || !body?.story_id || !body?.current_chapter) {
				console.log(`[DEBUG] Missing user_id, story_id, or current_chapter`);
				return json({ error: "Missing user_id, story_id, or current_chapter" }, 400);
			}
			try {
				const stmt = env.storytracker_db.prepare(
					`INSERT INTO user_story_tracking (user_id, story_id, current_chapter)
					 VALUES (?, ?, ?)
					 ON CONFLICT(user_id, story_id) DO UPDATE SET current_chapter=excluded.current_chapter, updated_at=CURRENT_TIMESTAMP`
				);
				await stmt.bind(body.user_id, body.story_id, body.current_chapter).run();
				console.log(`[DEBUG] Tracking updated for user_id: ${body.user_id}, story_id: ${body.story_id}`);
				return json({ success: true });
			} catch (err) {
				console.log(`[DEBUG] Error updating tracking:`, err);
				return json({ error: err.message }, 400);
			}
		}

		// List tracking: GET /api/tracking?user_id=#
		if (pathname === "/api/tracking" && request.method === "GET") {
			const user_id = searchParams.get("user_id");
			console.log(`[DEBUG] /api/tracking GET for user_id: ${user_id}`);
			if (!user_id) {
				console.log(`[DEBUG] Missing user_id`);
				return json({ error: "Missing user_id" }, 400);
			}
			const { results } = await env.storytracker_db.prepare(
				"SELECT * FROM user_story_tracking WHERE user_id = ?"
			).bind(user_id).all();
			return json(results);
		}

		// --- UPDATE CHAPTERS ENDPOINT ---
		if (pathname.match(/^\/api\/stories\/\d+\/update-chapters$/) && request.method === "POST") {
			const storyId = pathname.split("/")[3];
			console.log(`[DEBUG] Update chapters for story: ${storyId}`);

			// Fetch story from DB
			const { results } = await env.storytracker_db.prepare(
				"SELECT * FROM stories WHERE id = ?"
			).bind(storyId).all();
			if (results.length === 0) {
				return json({ error: "Story not found" }, 404);
			}
			const story = results[0];

			// Scrape chapters from story.url
			const chaptersData = await scrapeChaptersFromUrl(story.url, env);

			if (!chaptersData) {
				return json({ error: "Failed to scrape chapters" }, 500);
			}

			// Only update maxChapterUpdatedAt if maxChapter changed
			if (story.maxChapter !== chaptersData.maxChapter) {
				await env.storytracker_db.prepare(
					`UPDATE stories SET chapters = ?, maxChapter = ?, maxChapterUpdatedAt = CURRENT_TIMESTAMP WHERE id = ?`
				).bind(
					JSON.stringify(chaptersData.chapters),
					chaptersData.maxChapter,
					storyId
				).run();
			} else {
				await env.storytracker_db.prepare(
					`UPDATE stories SET chapters = ? WHERE id = ?`
				).bind(
					JSON.stringify(chaptersData.chapters),
					storyId
				).run();
			}
		}

		console.log(`[DEBUG] Not found: ${pathname}`);
		// Default: Not found
		return new Response("Not found", { status: 404 });
	},
	
	async scheduled(event, env, ctx) {
		console.log('[SCHEDULED] Running chapter scrape job');

		const { results: stories } = await env.storytracker_db.prepare(
			"SELECT id, url, maxChapter FROM stories"
		).all();

		for (const story of stories) {
			try {
				const chaptersData = await scrapeChaptersFromUrl(story.url, env);
				if (chaptersData) {
					if (story.maxChapter !== chaptersData.maxChapter) {
						await env.storytracker_db.prepare(
							`UPDATE stories SET chapters = ?, maxChapter = ?, maxChapterUpdatedAt = CURRENT_TIMESTAMP WHERE id = ?`
						).bind(
							JSON.stringify(chaptersData.chapters),
							chaptersData.maxChapter,
							story.id
						).run();
					} else {
						await env.storytracker_db.prepare(
							`UPDATE stories SET chapters = ? WHERE id = ?`
						).bind(
							JSON.stringify(chaptersData.chapters),
							story.id
						).run();
					}
					console.log(`[SCHEDULED] Chapters updated for story: ${story.id}`);
				} else {
					console.log(`[SCHEDULED] Failed to scrape chapters for story: ${story.id}`);
				}
			} catch (err) {
				console.log(`[SCHEDULED] Error scraping story ${story.id}:`, err);
			}
		}
	}

};

async function getQQCsrfToken() {
	const loginPageUrl = 'https://forum.questionablequesting.com/login/';
	const response = await fetch(loginPageUrl, {
		headers: {
			'User-Agent': 'Mozilla/5.0 (compatible; StorySaverBot/1.0)',
			'Referer': 'https://forum.questionablequesting.com/'
		}
	});
	const html = await response.text();
	const match = html.match(/<input[^>]+name="_xfToken"[^>]+value="([^"]+)"/);
	if (!match) throw new Error('CSRF token not found on QQ login page');
	return match[1];
}

// --- QQ Authentication State ---
let qqAuthenticationState = "unknown"; // "authenticated", "unauthenticated", "unknown"

async function loginToQQ(username, password, threadUrl) {
	const loginUrl = 'https://forum.questionablequesting.com/login/login';
	const csrfToken = await getQQCsrfToken();
	const formData = new URLSearchParams();
	formData.append('login', username);
	formData.append('password', password);
	formData.append('_xfToken', csrfToken);
	formData.append('remember', '1');
	formData.append('redirect', threadUrl || '/');

	const response = await fetch(loginUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': 'Mozilla/5.0 (compatible; StorySaverBot/1.0)',
			'Referer': 'https://forum.questionablequesting.com/login/'
		},
		body: formData,
		redirect: 'manual'
	});

	// Collect all cookies from login response
	let cookies = {};
	const setCookie = response.headers.get('set-cookie');
	if (setCookie) {
		setCookie.split(',').forEach(cookieStr => {
			const [cookiePair] = cookieStr.split(';');
			const [name, value] = cookiePair.split('=');
			cookies[name.trim()] = value ? value.trim() : '';
		});
	}

	console.log('[QQ LOGIN] Initial cookies after login:', cookies);

	// Fetch thread page for additional cookies
	if (response.status === 303) {
		qqAuthenticationState = "authenticated";
		console.log(`[QQ LOGIN] Login successful for ${username}`);
		const threadResponse = await fetch(threadUrl, {
			headers: {
				'Cookie': Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
				'User-Agent': 'Mozilla/5.0 (compatible; StorySaverBot/1.0)',
				'Referer': 'https://forum.questionablequesting.com/'
			}
		});
		const threadSetCookie = threadResponse.headers.get('set-cookie');
		if (threadSetCookie) {
			threadSetCookie.split(',').forEach(cookieStr => {
				const [cookiePair] = cookieStr.split(';');
				const [name, value] = cookiePair.split('=');
				cookies[name.trim()] = value ? value.trim() : '';
			});
		}
		console.log('[QQ LOGIN] Cookies after thread page fetch:', cookies);
	} else {
		qqAuthenticationState = "unauthenticated";
		console.warn(`[QQ LOGIN] Login failed for ${username} (status: ${response.status})`);
		return null;
	}

	// Log required cookies
	console.log('[QQ LOGIN] xf_csrf:', cookies['xf_csrf'] || '(not found)');
	console.log('[QQ LOGIN] xf_session:', cookies['xf_session'] || '(not found)');
	console.log('[QQ LOGIN] xf_user:', cookies['xf_user'] || '(not found)');

	// Build cookie string for requests
	const requiredCookies = ['xf_csrf', 'xf_session', 'xf_user'];
	const cookieString = requiredCookies
		.filter(c => c in cookies)
		.map(c => `${c}=${cookies[c]}`)
		.join('; ');

	return cookieString;
}

async function scrapeChaptersFromUrl(url, env) {
	function getSiteType(url) {
		if (url.includes('sufficientvelocity.com')) return 'SV';
		if (url.includes('spacebattles.com')) return 'SB';
		if (url.includes('questionablequesting.com')) return 'QQ';
		return null;
	}

	const site = getSiteType(url);
	console.log(`[SCRAPE] Site type: ${site} for url: ${url}`);
	if (!site) return null;

	let chapters = [];
	let page = 1;
	let maxChapter = 0;

	// --- HARDCODED QQ COOKIE ---
	let qqSessionCookie = null;
	if (site === 'QQ') {
		// Replace this string with your actual cookie values
		qqSessionCookie = "xf_csrf=JRwgHX7o4E7o1JC8; xf_session=RXIUCNAOXGAmFaL-7S3LGRaZV-PouKej; xf_user=93603%2CXwSBUqIZHeMGhhOI_zB5nNA34VM7oQVxlKw_iAP7";
		console.log(`[SCRAPE] Using hardcoded QQ_SESSION_COOKIE`);
	}

	while (true) {
		let pageUrl;
		if (site === 'SV' || site === 'SB' || site === 'QQ') {
			let baseUrl = url.split('/page-')[0].split('#')[0];
			if (!baseUrl.endsWith('/')) baseUrl += '/';
			pageUrl = `${baseUrl}threadmarks?per_page=200&page=${page}`;
		} else {
			break;
		}

		console.log(`[SCRAPE] Fetching page: ${pageUrl}`);
		let response;
		if (site === 'QQ' && qqSessionCookie) {
			response = await fetch(pageUrl, {
				headers: {
					'Cookie': qqSessionCookie,
					'User-Agent': 'Mozilla/5.0 (compatible; StorySaverBot/1.0)',
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
					'Referer': url.split('/threadmarks')[0]
				}
			});
		} else {
			response = await fetch(pageUrl);
		}

		console.log(`[SCRAPE] Response status: ${response.status}`);
		if (!response.ok) break;

		const html = await response.text();
		console.log(`[SCRAPE] HTML length: ${html.length}`);

		let pageChapters = [];
		try {
			const dom = new DOMParser().parseFromString(html, "text/html");
			let threadmarkDivs = dom.querySelectorAll('.structItem.structItem--threadmark');
			pageChapters = Array.from(threadmarkDivs).map(div => {
				const titleDiv = div.querySelector('.structItem-title.threadmark_depth0');
				const anchor = titleDiv ? titleDiv.querySelector('a') : null;
				return {
					title: anchor ? anchor.textContent.trim() : null,
					url: anchor ? (anchor.href.startsWith('http') ? anchor.href : `https://${site === 'SV' ? 'forums.sufficientvelocity.com' : site === 'SB' ? 'forums.spacebattles.com' : 'forum.questionablequesting.com'}${anchor.getAttribute('href')}`) : null,
					author: div.getAttribute('data-content-author'),
					date: div.getAttribute('data-content-date'),
					likes: div.getAttribute('data-likes')
				};
			});
		} catch (err) {
			console.log(`[SCRAPE] DOMParser failed, fallback to regex`);
			const matches = [...html.matchAll(/<div[^>]*class="structItem-title threadmark_depth0"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi)];
			pageChapters = matches.map(m => ({
				title: m[2].replace(/<[^>]+>/g, '').trim(),
				url: m[1].startsWith('http') ? m[1] : `https://${site === 'SV' ? 'forums.sufficientvelocity.com' : site === 'SB' ? 'forums.spacebattles.com' : 'forum.questionablequesting.com'}${m[1]}`,
				author: null,
				date: null,
				likes: null
			}));
		}

		console.log(`[SCRAPE] Chapters parsed on page ${page}: ${pageChapters.length}`);
		if (pageChapters.length === 0) break;
		chapters.push(...pageChapters);
		page++;
	}

	maxChapter = chapters.length;
	console.log(`[SCRAPE] Total chapters found: ${maxChapter}`);

	return { chapters, maxChapter };
}


// Helper: JSON response
function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
		"Access-Control-Allow-Origin": "*",
	});
}
