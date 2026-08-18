-- Up Migration
CREATE TABLE passages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain TEXT NOT NULL,
  topic TEXT NOT NULL,
  subpattern TEXT,
  difficulty TEXT NOT NULL,
  question_type TEXT NOT NULL,
  passage_id UUID,
  question_text TEXT NOT NULL,
  image_url TEXT,
  options JSONB NOT NULL,
  correct_option_ids JSONB NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_questions_active ON questions(domain, topic) WHERE deleted_at IS NULL;
CREATE INDEX idx_questions_passage ON questions(passage_id) WHERE deleted_at IS NULL AND passage_id IS NOT NULL;
CREATE INDEX idx_questions_difficulty ON questions(difficulty) WHERE deleted_at IS NULL;

-- Down Migration
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS passages;
