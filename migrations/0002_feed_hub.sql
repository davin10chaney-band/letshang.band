-- Round 2: Band Room Feed, group chats, Competition Day Hub, "Who's going?"

-- ---- Feed (students only; official hub updates from admins are also shown to parents)
CREATE TABLE feed_posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL DEFAULT 'post' CHECK (kind IN ('post','poll','ask')),
  body        TEXT NOT NULL DEFAULT '',
  file_id     INTEGER REFERENCES files(id) ON DELETE SET NULL,
  event_id    INTEGER REFERENCES events(id) ON DELETE SET NULL,   -- live update / prediction for an event
  official    INTEGER NOT NULL DEFAULT 0,                         -- admin update (parents can see it too)
  show_voters INTEGER NOT NULL DEFAULT 0,                         -- asks show who's in; polls are anonymous
  deleted_by  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX feed_posts_created ON feed_posts (id DESC);
CREATE INDEX feed_posts_event ON feed_posts (event_id);

CREATE TABLE feed_reactions (
  post_id    INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (post_id, user_id, emoji)
);

CREATE TABLE feed_replies (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL DEFAULT '',
  file_id    INTEGER REFERENCES files(id) ON DELETE SET NULL,
  deleted_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX feed_replies_post ON feed_replies (post_id, id);

CREATE TABLE poll_options (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id  INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  label    TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE poll_votes (
  post_id   INTEGER NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

-- Reports can point at feed posts and replies too
ALTER TABLE reports ADD COLUMN feed_post_id INTEGER;
ALTER TABLE reports ADD COLUMN reply_id INTEGER;

-- ---- Group chats: membership-based channels (kind = 'dm') with a name; optional expiry for trips/carpools
ALTER TABLE channels ADD COLUMN is_group INTEGER NOT NULL DEFAULT 0;
ALTER TABLE channels ADD COLUMN expires_at TEXT;
ALTER TABLE channels ADD COLUMN event_id INTEGER;

-- ---- Competition Day Hub
CREATE TABLE event_schedule (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  at_time  TEXT NOT NULL,            -- "14:30"
  label    TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE event_buses (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,            -- "Bus 1"
  notes    TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE event_bus_riders (
  bus_id  INTEGER NOT NULL REFERENCES event_buses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (bus_id, user_id)
);
CREATE TABLE event_order (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id  INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  band_name TEXT NOT NULL,
  perform_at TEXT,                   -- "15:10"
  is_us     INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE event_rsvps (
  event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('going','maybe','no')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (event_id, user_id)
);
