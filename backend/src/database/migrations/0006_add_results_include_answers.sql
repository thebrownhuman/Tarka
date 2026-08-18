-- Up Migration
ALTER TABLE test_attempts ADD COLUMN results_include_answers BOOLEAN NOT NULL DEFAULT FALSE;

-- Down Migration
ALTER TABLE test_attempts DROP COLUMN results_include_answers;
