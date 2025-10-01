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

		// --- STORIES ---

		// Create or update story: POST /api/stories { user_id, title, description, url, ... }
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
			let query = "SELECT id, user_id, title, description, author, url, baseUrl, datesaved, chapter, maxChapter, chapterUrl, tags, chapters, currentThreadmarkNumber, created_at FROM stories";
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

			// Scrape chapters from story.url (implement your scraping logic here)
			const chaptersData = await scrapeChaptersFromUrl(story.url);

			if (!chaptersData) {
				return json({ error: "Failed to scrape chapters" }, 500);
			}

			// Update chapters and maxChapter, but DO NOT change currentThreadmarkNumber
			const stmt = env.storytracker_db.prepare(
				`UPDATE stories SET chapters = ?, maxChapter = ? WHERE id = ?`
			);
			await stmt.bind(
				JSON.stringify(chaptersData.chapters),
				chaptersData.maxChapter,
				storyId
			).run();

			console.log(`[DEBUG] Chapters updated for story: ${storyId}`);
			return json({ success: true, updated: true });
		}

		console.log(`[DEBUG] Not found: ${pathname}`);
		// Default: Not found
		return new Response("Not found", { status: 404 });
	},
};

async function scrapeChaptersFromUrl(url) {
	try {
		// Detect site type
		const host = new URL(url).hostname;
		let site = "SB";
		if (host.includes('sufficientvelocity.com')) site = "SV";
		if (host.includes('questionablequesting.com')) site = "QQ";
		if (host.includes('forums.sufficientvelocity.com')) site = "SV";
		if (host.includes('forum.questionablequesting.com')) site = "QQ";

		// Normalize base URL
		let baseUrl = url.split('/page-')[0].split('#')[0];
		if (!baseUrl.endsWith('/')) baseUrl += '/';

		let allThreadmarks = [];
		let page = 1;
		const maxPages = 10; // Safety limit

		while (page <= maxPages) {
			let pageUrl;
			if (site === 'SV' || site === 'SB' || site === 'QQ') {
				pageUrl = baseUrl + `threadmarks?per_page=200&page=${page}`;
			} else {
				break;
			}
			const response = await fetch(pageUrl);
			if (!response.ok) break;
			const html = await response.text();

			// Simulate: document.querySelectorAll('.structItem--threadmark .structItem-title a')
			const threadmarkRegex = /<div[^>]*class="structItem--threadmark[^"]*"[^>]*>[\s\S]*?<a[^>]*class="structItem-title[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
			let match;
			let found = false;
			while ((match = threadmarkRegex.exec(html)) !== null) {
				const href = match[1];
				const title = match[2].replace(/<[^>]+>/g, '').trim();
				if (!href.includes('/awards/award/')) {
					allThreadmarks.push({
						title,
						url: href.startsWith('http') ? href : `https://${host}${href}`
					});
					found = true;
				}
			}

			// Fallback: .message-threadmarkList .structItem-title a
			if (!found) {
				const fallbackRegex = /<div[^>]*class="message-threadmarkList[^"]*"[^>]*>[\s\S]*?<a[^>]*class="structItem-title[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
				while ((match = fallbackRegex.exec(html)) !== null) {
					const href = match[1];
					const title = match[2].replace(/<[^>]+>/g, '').trim();
					if (!href.includes('/awards/award/')) {
						allThreadmarks.push({
							title,
							url: href.startsWith('http') ? href : `https://${host}${href}`
						});
					}
				}
			}

			// If no threadmarks found, stop
			if (!found && allThreadmarks.length === 0) break;
			page++;
		}

		return {
			chapters: allThreadmarks,
			maxChapter: allThreadmarks.length
		};
	} catch (err) {
		console.log("[DEBUG] scrapeChaptersFromUrl error:", err);
		return null;
	}
}

// Helper: JSON response
function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
		"Access-Control-Allow-Origin": "*",
	});
}
