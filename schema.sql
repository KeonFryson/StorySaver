-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stories table
CREATE TABLE stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Chapters table
CREATE TABLE chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id INTEGER,
  title TEXT,
  content TEXT,
  chapter_number INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(story_id) REFERENCES stories(id)
);

-- Favorites / Tracking table
CREATE TABLE user_story_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  story_id INTEGER,
  current_chapter INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(story_id) REFERENCES stories(id)
);
