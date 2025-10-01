const scrapeRateLimit = new Map(); // key: user or IP, value: timestamp
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

		if (pathname.startsWith("/api/stories/") && request.method === "PUT") {
			const id = pathname.split("/").pop();
			const body = await getJsonBody(request);
			if (!id || !body) {
				return json({ error: "Missing story id or body" }, 400);
			}
			try {
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
				const result = await stmt.bind(
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
					id
				).run();
				if (result.changes === 0) {
					return json({ error: "Story not found" }, 404);
				}
				return json({ success: true, updated: true });
			} catch (err) {
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


		// --- SCRAPE ENDPOINT ---
		if (pathname === "/api/scrape" && request.method === "GET") {
			const urlToScrape = searchParams.get("url");
			if (!urlToScrape) {
				return json({ error: "Missing url parameter" }, 400);
			}
			try {
				const res = await fetch(urlToScrape, { headers: { "User-Agent": "StorySaverBot/1.0" } });
				if (!res.ok) {
					return json({
						error: "Failed to fetch source URL",
						status: res.status,
						statusText: res.statusText
					}, res.status);
				}

				// --- Rate limiting logic ---
				const userKey = request.headers.get("x-user-id") || request.headers.get("x-forwarded-for") || "global";
				const now = Date.now();
				const lastScrape = scrapeRateLimit.get(userKey) || 0;
				if (now - lastScrape < 60 * 1000) { // 1 minute
					return json({ error: "Rate limit: Only one scrape per minute allowed." }, 429);
				}
				scrapeRateLimit.set(userKey, now);

				try {
					const res = await fetch(urlToScrape, { headers: { "User-Agent": "StorySaverBot/1.0" } });
					if (!res.ok) {
						return json({
							error: "Failed to fetch source URL",
							status: res.status,
							statusText: res.statusText
						}, res.status);
					}

					const html = await res.text();

				// Helper: get site type from URL
				function getSiteTypeFromUrl(url) {
					const host = (new URL(url)).hostname;
					if (host.includes('sufficientvelocity.com')) return 'SV';
					if (host.includes('questionablequesting.com')) return 'QQ';
					if (host.includes('forums.sufficientvelocity.com')) return 'SV';
					if (host.includes('forum.questionablequesting.com')) return 'QQ';
					if (host.includes('spacebattles.com')) return 'SB';
					return 'GENERIC';
				}

				const site = getSiteTypeFromUrl(urlToScrape);

				// Use DOMParser if available, fallback to regex for environments without DOMParser
				let doc;
				if (typeof DOMParser !== "undefined") {
					const parser = new DOMParser();
					doc = parser.parseFromString(html, "text/html");
				}

				// XenForo forums (SB, SV, QQ)
				// XenForo forums (SB, SV, QQ)
				function scrapeXenforo(doc, html, url) {
					// Title
					let title = "";
					let author = "";
					let desc = "";
					let chapters = [];
					let maxChapter = null;
					let currentChapter = null;
					let currentThreadmarkNumber = null;
					let chapterUrl = url;

					if (doc) {
						title = doc.querySelector('h1.p-title-value')?.textContent?.trim() || doc.querySelector('title')?.textContent?.trim() || "";
						author = doc.querySelector('.message-user .username')?.textContent?.trim() || "";
						desc = doc.querySelector('.message-body .bbWrapper')?.textContent?.trim() || "";
						doc.querySelectorAll('.structItem--threadmark .structItem-title a, .structItem-title a[href*="threadmarks"]').forEach(a => {
							chapters.push({
								title: a.textContent.trim(),
								url: a.href
							});
						});
						if (chapters.length === 0) {
							doc.querySelectorAll('.message-threadmarkList .structItem-title a').forEach(a => {
								chapters.push({
									title: a.textContent.trim(),
									url: a.href
								});
							});
						}
						maxChapter = chapters.length;
						currentChapter = chapters[chapters.length - 1] || null;
						//currentThreadmarkNumber = currentChapter ? chapters.length : null;
						chapterUrl = currentChapter ? currentChapter.url : url;
					} else {
						// Fallback: regex parsing
						const titleMatch = html.match(/<h1[^>]*class="p-title-value"[^>]*>([^<]+)<\/h1>/) || html.match(/<title>([^<]+)<\/title>/);
						title = titleMatch ? titleMatch[1].trim() : "";
						const authorMatch = html.match(/<a[^>]*class="username"[^>]*>([^<]+)<\/a>/);
						author = authorMatch ? authorMatch[1].trim() : "";
						const descMatch = html.match(/<div[^>]*class="message-body[^"]*"[^>]*>\s*<div[^>]*class="bbWrapper"[^>]*>([\s\S]*?)<\/div>/);
						desc = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : "";

						// Threadmarks/chapters: fallback
						const chapterRegex = /<a[^>]*class="structItem-title"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
						let match;
						while ((match = chapterRegex.exec(html)) !== null) {
							chapters.push({
								title: match[2].trim(),
								url: match[1]
							});
						}
						maxChapter = chapters.length;
						currentChapter = chapters[chapters.length - 1] || null;
						//currentThreadmarkNumber = currentChapter ? chapters.length : null;
						chapterUrl = currentChapter ? currentChapter.url : url;

						if (chapters.length === 0) {
							console.log(`[DEBUG] scrapeXenforo fallback: No chapters found for URL: ${url}`);
							const idx = html.indexOf('structItem-title');
							if (idx !== -1) {
								console.log(`[DEBUG] scrapeXenforo fallback: HTML around structItem-title: ${html.slice(Math.max(0, idx - 250), idx + 250)}`);
							} else {
								console.log(`[DEBUG] scrapeXenforo fallback: HTML sample: ${html.slice(0, 500)}`);
							}
						}
					}
					return {
						title,
						author,
						description: desc,
						chapters,
						chapter: currentChapter ? currentChapter.title : "",
						maxChapter,
						chapterUrl,
						url
					};
				}

				// AO3 Example
				function scrapeAO3(html, url) {
					const titleMatch = html.match(/<h2 class="title heading">([^<]+)<\/h2>/);
					const authorMatch = html.match(/rel="author">([^<]+)<\/a>/);
					const descMatch = html.match(/<blockquote class="userstuff">([\s\S]*?)<\/blockquote>/);
					const chapterMatch = html.match(/Chapter (\d+) of (\d+)/);
					return {
						title: titleMatch ? titleMatch[1].trim() : "",
						author: authorMatch ? authorMatch[1].trim() : "",
						description: descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : "",
						maxChapter: chapterMatch ? parseInt(chapterMatch[2], 10) : null,
						chapter: chapterMatch ? `Chapter ${chapterMatch[1]}` : "",
						chapterUrl: url,
						currentThreadmarkNumber: chapterMatch ? parseInt(chapterMatch[1], 10) : null,
						chapters: [],
						url
					};
				}

				// Generic fallback
				function scrapeGeneric(doc, html, url) {
					const title = doc?.querySelector("title")?.textContent?.trim() || (html.match(/<title>([^<]+)<\/title>/)?.[1] || "");
					return {
						title,
						author: "",
						description: "",
						maxChapter: null,
						chapter: "",
						chapterUrl: url,
						currentThreadmarkNumber: null,
						chapters: [],
						url
					};
				}
					function getSiteTypeFromUrl(url) { /* ... */ }
					const site = getSiteTypeFromUrl(urlToScrape);
					let doc;
					if (typeof DOMParser !== "undefined") {
						const parser = new DOMParser();
						doc = parser.parseFromString(html, "text/html");
					}
					function scrapeXenforo(doc, html, url) { /* ... */ }
					function scrapeAO3(html, url) { /* ... */ }
					function scrapeGeneric(doc, html, url) { /* ... */ }
					let result;
					if (site === 'SB' || site === 'SV' || site === 'QQ') {
						result = scrapeXenforo(doc, html, urlToScrape);
					} else if (urlToScrape.includes("archiveofourown.org")) {
						result = scrapeAO3(html, urlToScrape);
					} else {
						result = scrapeGeneric(doc, html, urlToScrape);
					}
					return json(result);
				} catch (err) {
					console.log("[DEBUG] Scrape error:", err);
					return json({ error: "Scrape failed", details: err.message }, 500);
				}
		}


		console.log(`[DEBUG] Not found: ${pathname}`);
		// Default: Not found
		return new Response("Not found", { status: 404 });
	},
};

// Helper: JSON response
function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
		"Access-Control-Allow-Origin": "*",
	});
}
