export const SCHEMA_VERSION = 4;

export const schemaV2 = `
PRAGMA foreign_keys = ON;
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY, name TEXT NOT NULL,
  checksum TEXT NOT NULL, applied_at TEXT NOT NULL
);
CREATE TABLE goals (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL, archived_from TEXT,
  origin_kind TEXT NOT NULL DEFAULT 'personal' CHECK (origin_kind IN ('personal', 'routine')),
  origin_reference TEXT
);
CREATE TABLE goal_revisions (
  id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL CHECK (revision_number >= 1),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  category TEXT NOT NULL CHECK (category IN ('Pessoal', 'Saúde', 'Estudos', 'Trabalho')),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'once')),
  weekday_mask INTEGER NOT NULL DEFAULT 0,
  effective_from TEXT NOT NULL, effective_to TEXT, created_at TEXT NOT NULL,
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK ((frequency = 'daily' AND weekday_mask BETWEEN 1 AND 127)
    OR (frequency IN ('weekly', 'once') AND weekday_mask = 0)),
  UNIQUE (goal_id, revision_number), UNIQUE (goal_id, effective_from), UNIQUE (goal_id, id)
);
CREATE TABLE day_plans (
  local_date TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind = 'rest'),
  note TEXT NOT NULL DEFAULT '', timezone TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE goal_occurrences (
  id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL, period_kind TEXT NOT NULL CHECK (period_kind IN ('day', 'week')),
  period_start TEXT NOT NULL, period_end_exclusive TEXT NOT NULL,
  eligible_from TEXT NOT NULL, timezone TEXT NOT NULL,
  title_snapshot TEXT NOT NULL, description_snapshot TEXT NOT NULL DEFAULT '',
  category_snapshot TEXT NOT NULL,
  frequency_snapshot TEXT NOT NULL CHECK (frequency_snapshot IN ('daily', 'weekly', 'once')),
  origin_snapshot TEXT,
  disposition TEXT NOT NULL DEFAULT 'scheduled' CHECK (disposition IN ('scheduled', 'rest', 'cancelled')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'missed')),
  recorded_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (goal_id, revision_id) REFERENCES goal_revisions(goal_id, id) ON DELETE RESTRICT,
  UNIQUE (goal_id, period_kind, period_start),
  CHECK (period_end_exclusive > period_start),
  CHECK (eligible_from >= period_start AND eligible_from < period_end_exclusive),
  CHECK (disposition = 'scheduled' OR status = 'pending'),
  CHECK (period_kind != 'week' OR frequency_snapshot = 'weekly'),
  CHECK (frequency_snapshot != 'weekly' OR period_kind = 'week')
);
CREATE TABLE occurrence_events (
  id TEXT PRIMARY KEY, occurrence_id TEXT NOT NULL REFERENCES goal_occurrences(id) ON DELETE RESTRICT,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('pending', 'done', 'missed')),
  next_status TEXT NOT NULL CHECK (next_status IN ('pending', 'done', 'missed')),
  changed_at TEXT NOT NULL,
  change_reason TEXT NOT NULL CHECK (change_reason IN ('checklist', 'history_correction')),
  CHECK (previous_status != next_status)
);
CREATE INDEX revisions_by_goal_and_date ON goal_revisions(goal_id, effective_from, effective_to);
CREATE INDEX occurrences_by_period ON goal_occurrences(period_kind, period_start, disposition, status);
CREATE INDEX occurrences_by_category ON goal_occurrences(category_snapshot, period_start);
CREATE INDEX events_by_occurrence ON occurrence_events(occurrence_id, changed_at);
`;

// Additive migration: preserve the v2 schema and its checksum verbatim.
export const schemaV3 = `
CREATE TABLE routine_runs (
  id TEXT PRIMARY KEY,
  operation_key TEXT NOT NULL UNIQUE,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL CHECK (template_version >= 1),
  name_snapshot TEXT NOT NULL,
  principle_snapshot TEXT NOT NULL,
  source_label_snapshot TEXT NOT NULL,
  source_url_snapshot TEXT NOT NULL,
  source_checked_on TEXT NOT NULL,
  activities_snapshot_json TEXT NOT NULL,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  request_json TEXT NOT NULL,
  CHECK (ends_on >= starts_on)
);
CREATE INDEX runs_by_template_and_dates ON routine_runs(template_id, starts_on, ends_on);
`;

export const schemaV4 = `
CREATE TABLE personal_preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme TEXT NOT NULL CHECK (theme IN ('violet', 'ocean', 'forest')),
  show_encouragement INTEGER NOT NULL CHECK (show_encouragement IN (0, 1)),
  updated_at TEXT NOT NULL
);
CREATE TABLE long_term_goals (
  id TEXT PRIMARY KEY,
  operation_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK (length(description) <= 500),
  category TEXT NOT NULL CHECK (category IN ('Pessoal', 'Saúde', 'Estudos', 'Trabalho')),
  target_value REAL NOT NULL CHECK (target_value >= 1 AND target_value <= 1000000000),
  current_value REAL NOT NULL CHECK (current_value >= 0 AND current_value <= target_value),
  unit TEXT NOT NULL CHECK (length(trim(unit)) BETWEEN 1 AND 30),
  due_on TEXT,
  archived_at TEXT,
  created_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  create_request_json TEXT NOT NULL
);
`;
