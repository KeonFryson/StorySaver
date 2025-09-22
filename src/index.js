/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const { pathname, searchParams } = url;

		// Helper: parse JSON body
		async function getJsonBody(req) {
			try {
				return await req.json();
			} catch {
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
			if (!body?.email || !body?.username || !body?.password) {
				return json({ error: "Missing email, username, or password" }, 400);
			}
			try {
				const { hash, salt } = await hashPassword(body.password);
				const stmt = env.storytracker_db.prepare(
					"INSERT INTO users (email, username, password, salt) VALUES (?, ?, ?, ?)"
				);
				await stmt.bind(body.email, body.username, hash, salt).run();
				return json({ success: true });
			} catch (err) {
				return json({ error: err.message }, 400);
			}
		}

		// List users: GET /api/users
		if (pathname === "/api/users" && request.method === "GET") {
			const { results } = await env.storytracker_db.prepare(
				"SELECT id, email, username, created_at FROM users"
			).all();
			return json(results);
		}

		// --- AUTH ---

		// Login: POST /api/auth { email, password }
		if (pathname === "/api/auth" && request.method === "POST") {
			const body = await getJsonBody(request);
			const { email, password } = body || {};
			if (!email || !password) return json({ error: "Missing email or password" }, 400);

			const { results } = await env.storytracker_db.prepare(
				"SELECT id, email, password, salt FROM users WHERE email = ?"
			).bind(email).all();
			if (results.length === 0) return json({ error: "Invalid credentials" }, 401);

			const user = results[0];
			const valid = await verifyPassword(password, user.password, user.salt);
			if (!valid) return json({ error: "Invalid credentials" }, 401);

			return json({ user: { id: user.id, email: user.email } });
		}

		// --- STORIES ---

		// Create story: POST /api/stories { user_id, title, description }
		if (pathname === "/api/stories" && request.method === "POST") {
			const body = await getJsonBody(request);
			if (!body?.user_id || !body?.title) {
				return json({ error: "Missing user_id or title" }, 400);
			}
			try {
				const stmt = env.storytracker_db.prepare(
					"INSERT INTO stories (user_id, title, description) VALUES (?, ?, ?)"
				);
				await stmt.bind(body.user_id, body.title, body.description || null).run();
				return json({ success: true });
			} catch (err) {
				return json({ error: err.message }, 400);
			}
		}

		// List stories: GET /api/stories?user_id=#
		if (pathname === "/api/stories" && request.method === "GET") {
			const user_id = searchParams.get("user_id");
			let query = "SELECT id, user_id, title, description, created_at FROM stories";
			let params = [];
			if (user_id) {
				query += " WHERE user_id = ?";
				params.push(user_id);
			}
			const { results } = await env.storytracker_db.prepare(query).bind(...params).all();
			return json(results);
		}

		// --- CHAPTERS ---

		// Create chapter: POST /api/chapters { story_id, title, content, chapter_number }
		if (pathname === "/api/chapters" && request.method === "POST") {
			const body = await getJsonBody(request);
			if (!body?.story_id || !body?.title || !body?.content) {
				return json({ error: "Missing story_id, title, or content" }, 400);
			}
			try {
				const stmt = env.storytracker_db.prepare(
					"INSERT INTO chapters (story_id, title, content, chapter_number) VALUES (?, ?, ?, ?)"
				);
				await stmt.bind(
					body.story_id,
					body.title,
					body.content,
					body.chapter_number || null
				).run();
				return json({ success: true });
			} catch (err) {
				return json({ error: err.message }, 400);
			}
		}

		// List chapters: GET /api/chapters?story_id=#
		if (pathname === "/api/chapters" && request.method === "GET") {
			const story_id = searchParams.get("story_id");
			let query = "SELECT id, story_id, title, content, chapter_number, created_at FROM chapters";
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
			if (!body?.user_id || !body?.story_id || !body?.current_chapter) {
				return json({ error: "Missing user_id, story_id, or current_chapter" }, 400);
			}
			try {
				const stmt = env.storytracker_db.prepare(
					`INSERT INTO user_story_tracking (user_id, story_id, current_chapter)
					 VALUES (?, ?, ?)
					 ON CONFLICT(user_id, story_id) DO UPDATE SET current_chapter=excluded.current_chapter, updated_at=CURRENT_TIMESTAMP`
				);
				await stmt.bind(body.user_id, body.story_id, body.current_chapter).run();
				return json({ success: true });
			} catch (err) {
				return json({ error: err.message }, 400);
			}
		}

		// List tracking: GET /api/tracking?user_id=#
		if (pathname === "/api/tracking" && request.method === "GET") {
			const user_id = searchParams.get("user_id");
			if (!user_id) return json({ error: "Missing user_id" }, 400);
			const { results } = await env.storytracker_db.prepare(
				"SELECT * FROM user_story_tracking WHERE user_id = ?"
			).bind(user_id).all();
			return json(results);
		}

		// Default: Not found
		return new Response("Not found", { status: 404 });
	},
};

// Helper: JSON response
function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
