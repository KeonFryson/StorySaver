-- Users table
CREATE TABLE users (
  id INTEGER IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(255) UNIQUE,
  email NVARCHAR(255) UNIQUE,
  password NVARCHAR(255),
  salt NVARCHAR(255),
  created_at DATETIME DEFAULT GETDATE()
);

-- Stories table
CREATE TABLE stories (
  id INTEGER IDENTITY(1,1) PRIMARY KEY,
  user_id INTEGER,
  title NVARCHAR(255),
  description NVARCHAR(MAX),
  created_at DATETIME DEFAULT GETDATE(),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Chapters table
CREATE TABLE chapters (
  id INTEGER IDENTITY(1,1) PRIMARY KEY,
  story_id INTEGER,
  title NVARCHAR(255),
  content NVARCHAR(MAX),
  chapter_number INTEGER,
  created_at DATETIME DEFAULT GETDATE(),
  FOREIGN KEY(story_id) REFERENCES stories(id)
);

-- Favorites / Tracking table
CREATE TABLE user_story_tracking (
  id INTEGER IDENTITY(1,1) PRIMARY KEY,
  user_id INTEGER,
  story_id INTEGER,
  current_chapter INTEGER,
  updated_at DATETIME DEFAULT GETDATE(),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(story_id) REFERENCES stories(id)
);
