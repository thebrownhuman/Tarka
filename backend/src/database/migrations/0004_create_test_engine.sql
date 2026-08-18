-- Up Migration
CREATE TABLE tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  duration_seconds INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE test_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL,
  question_id UUID NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_test_questions_test_position_unique ON test_questions(test_id, position) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_test_questions_test_question_unique ON test_questions(test_id, question_id) WHERE deleted_at IS NULL;

CREATE TABLE test_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  base_duration_seconds INT NOT NULL,
  extended_seconds INT NOT NULL DEFAULT 0,
  current_question_index INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  score INT,
  results_released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_test_attempts_duration_cap CHECK (base_duration_seconds + extended_seconds <= 7200)
);

CREATE INDEX idx_test_attempts_candidate_test_active ON test_attempts(candidate_id, test_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_test_attempts_test ON test_attempts(test_id) WHERE deleted_at IS NULL;

CREATE TABLE test_attempt_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  attempt_id UUID NOT NULL,
  question_id UUID NOT NULL,
  selected_option_ids JSONB NOT NULL DEFAULT '[]',
  is_correct BOOLEAN,
  served_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  time_spent_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_test_attempt_answers_attempt_question_unique ON test_attempt_answers(attempt_id, question_id) WHERE deleted_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS test_attempt_answers;
DROP TABLE IF EXISTS test_attempts;
DROP TABLE IF EXISTS test_questions;
DROP TABLE IF EXISTS tests;
