-- Let's Hang High School (letshang.band) — one band, students + parents sign themselves up with the band code.

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  role           TEXT NOT NULL CHECK (role IN ('student','parent')),
  is_admin       INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  display_name   TEXT NOT NULL,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash      TEXT NOT NULL,
  pass_salt      TEXT NOT NULL,
  avatar         TEXT NOT NULL DEFAULT 'star',
  section        TEXT,                       -- students: percussion, brass, woodwinds, guard, front, leadership
  instrument     TEXT,
  grade          INTEGER,                    -- 9-12
  can_drive      INTEGER NOT NULL DEFAULT 0, -- student says they're a licensed driver who can give rides
  phone          TEXT,
  sms_opt_in     INTEGER NOT NULL DEFAULT 0,
  notify_prefs   TEXT NOT NULL DEFAULT '{}',
  theme          TEXT NOT NULL DEFAULT 'neon',
  recovery_hash  TEXT,
  recovery_salt  TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE rate_events (
  id  INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX rate_events_key ON rate_events (key, at);

-- Channels: section threads, topic threads inside a section, direct messages, parent threads.
CREATE TABLE channels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL CHECK (kind IN ('section','topic','dm')),
  audience   TEXT NOT NULL CHECK (audience IN ('students','parents')),
  section    TEXT,                       -- for section/topic channels
  name       TEXT NOT NULL,
  about      TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  locked     INTEGER NOT NULL DEFAULT 0,  -- only admins can post
  archived   INTEGER NOT NULL DEFAULT 0,
  last_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE channel_members (            -- DMs only
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX channel_members_user ON channel_members (user_id);
CREATE TABLE channel_reads (
  channel_id   INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE files (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key     TEXT NOT NULL UNIQUE,
  owner_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('pdf','image','audio')),
  deleted    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL DEFAULT '',
  file_id    INTEGER REFERENCES files(id) ON DELETE SET NULL,
  deleted_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX posts_channel ON posts (channel_id, id);

CREATE TABLE blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- who was reported
  post_id     INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  reason      TEXT NOT NULL,
  details     TEXT,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_by INTEGER,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Guardrail log (what was blocked and why — admins see counts, not private messages)
CREATE TABLE guard_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,      -- language, hate, sexual, violence, harassment, selfharm, photo
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('rehearsal','game','competition','concert','sectional','other')),
  section    TEXT,                -- NULL = whole band
  starts_at  TEXT NOT NULL,
  ends_at    TEXT,
  location   TEXT,
  details    TEXT,
  call_time  TEXT,                -- e.g. 17:30
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  cancelled  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX events_starts ON events (starts_at);

CREATE TABLE spots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('house','park','school','food','music','other')),
  address    TEXT,
  notes      TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  archived   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE hangouts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  spot_id    INTEGER REFERENCES spots(id) ON DELETE SET NULL,
  place      TEXT,
  starts_at  TEXT NOT NULL,
  details    TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
  cancelled  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE hangout_rsvps (
  hangout_id INTEGER NOT NULL REFERENCES hangouts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('going','maybe','no')),
  PRIMARY KEY (hangout_id, user_id)
);

CREATE TABLE rides (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('pickup','dropoff','ride')),
  reason       TEXT NOT NULL DEFAULT 'other' CHECK (reason IN ('rain','snow','storm','cold','late','gear','other')),
  starts_at    TEXT NOT NULL,
  from_place   TEXT NOT NULL,
  to_place     TEXT NOT NULL,
  seats        INTEGER NOT NULL DEFAULT 1,
  note         TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','cancelled')),
  claimed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claimed_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Ride offers: a driver (licensed student or parent) posts a trip with open seats; students grab a seat.
CREATE TABLE ride_offers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  driver_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at  TEXT NOT NULL,
  from_place TEXT NOT NULL,
  to_place   TEXT NOT NULL,
  seats      INTEGER NOT NULL DEFAULT 3,
  note       TEXT,
  cancelled  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE ride_seats (
  offer_id   INTEGER NOT NULL REFERENCES ride_offers(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (offer_id, user_id)
);

CREATE TABLE notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  dedupe_key TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX notifications_user ON notifications (user_id, read_at);

CREATE TABLE sms_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_phone   TEXT NOT NULL,
  body       TEXT NOT NULL,
  status     TEXT,
  provider_sid TEXT,
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- School schedule (whole band) + high school calendar
CREATE TABLE school_calendar (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  school_year TEXT NOT NULL,
  start_date  TEXT NOT NULL,
  end_date    TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('no_school','first_day','last_day','resume','quarter_end','event')),
  title       TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES
  ('band_name', 'Marching Band'),
  ('school_arrive', '07:50'),
  ('school_start', '08:00'),
  ('school_end', '15:20'),
  ('walk_minutes', '20'),
  ('walk_miles', '1.0'),
  ('location_name', 'Sioux Falls, SD'),
  ('lat', '43.5446'),
  ('lon', '-96.7311');

-- Default sections (students) and parent threads
INSERT INTO channels (kind, audience, section, name, about) VALUES
  ('section', 'students', 'all',        'All Band',         'Announcements and whole-band chat'),
  ('section', 'students', 'percussion', 'Percussion',       'Battery + pit'),
  ('section', 'students', 'brass',      'Brass',            'Trumpets, mellos, bones, baris, tubas'),
  ('section', 'students', 'woodwinds',  'Woodwinds',        'Flutes, clarinets, saxes'),
  ('section', 'students', 'guard',      'Color Guard',      'Flags, rifles, sabres'),
  ('section', 'students', 'front',      'Front Ensemble',   'Pit, keys, electronics'),
  ('section', 'students', 'leadership', 'Leadership',       'Drum majors + section leaders'),
  ('section', 'parents',  'parents',    'All Parents',      'Parents and boosters'),
  ('topic',   'parents',  'parents',    'Carpools',         'Who can drive where'),
  ('topic',   'parents',  'parents',    'Uniforms + Fitting', NULL),
  ('topic',   'parents',  'parents',    'Food + Volunteers',  NULL),
  ('topic',   'students', 'all',        'Movement 1',       'Show music + drill notes'),
  ('topic',   'students', 'all',        'Movement 2',       'Show music + drill notes'),
  ('topic',   'students', 'all',        'Movement 3',       'Show music + drill notes'),
  ('topic',   'students', 'all',        'Closer',           'Show music + drill notes');

-- 2026-27 Sioux Falls School District calendar (high school + all levels)
INSERT INTO school_calendar (school_year, start_date, end_date, kind, title) VALUES
  ('2026-27', '2026-08-20', '2026-08-20', 'event',       'High School PST'),
  ('2026-27', '2026-08-27', '2026-08-27', 'first_day',   'First Day of School'),
  ('2026-27', '2026-09-04', '2026-09-04', 'no_school',   'Labor Day Break'),
  ('2026-27', '2026-09-07', '2026-09-07', 'no_school',   'Labor Day Break'),
  ('2026-27', '2026-10-12', '2026-10-12', 'no_school',   'Native American Day'),
  ('2026-27', '2026-10-13', '2026-10-13', 'no_school',   'Inservice'),
  ('2026-27', '2026-10-19', '2026-10-19', 'event',       'High School Conferences (evening)'),
  ('2026-27', '2026-10-26', '2026-10-26', 'event',       'High School Conferences (evening)'),
  ('2026-27', '2026-10-29', '2026-10-29', 'quarter_end', 'End of 1st Quarter'),
  ('2026-27', '2026-11-11', '2026-11-11', 'no_school',   'Veterans Day'),
  ('2026-27', '2026-11-25', '2026-11-25', 'no_school',   'Compensatory Day'),
  ('2026-27', '2026-11-26', '2026-11-27', 'no_school',   'Thanksgiving Break'),
  ('2026-27', '2026-12-23', '2027-01-01', 'no_school',   'Holiday Break'),
  ('2026-27', '2027-01-04', '2027-01-04', 'resume',      'Classes Resume'),
  ('2026-27', '2027-01-13', '2027-01-14', 'event',       'High School Semester Tests'),
  ('2026-27', '2027-01-14', '2027-01-14', 'quarter_end', 'End of 2nd Quarter'),
  ('2026-27', '2027-01-15', '2027-01-15', 'no_school',   'Teacher Work Day'),
  ('2026-27', '2027-01-18', '2027-01-18', 'no_school',   'Martin Luther King Jr. Day'),
  ('2026-27', '2027-02-15', '2027-02-16', 'no_school',   'Presidents'' Day Break'),
  ('2026-27', '2027-03-01', '2027-03-01', 'no_school',   'Inservice'),
  ('2026-27', '2027-03-02', '2027-03-02', 'event',       'High School Conferences (evening)'),
  ('2026-27', '2027-03-08', '2027-03-08', 'event',       'High School Conferences (evening)'),
  ('2026-27', '2027-03-23', '2027-03-23', 'quarter_end', 'End of 3rd Quarter'),
  ('2026-27', '2027-03-26', '2027-03-29', 'no_school',   'Spring Break'),
  ('2026-27', '2027-04-19', '2027-04-19', 'no_school',   'Compensatory Day'),
  ('2026-27', '2027-05-23', '2027-05-23', 'event',       'Graduation'),
  ('2026-27', '2027-05-25', '2027-05-26', 'event',       'High School Semester Tests'),
  ('2026-27', '2027-05-26', '2027-05-26', 'last_day',    'Last Day of School');
