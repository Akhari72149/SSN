ALTER TABLE user_accounts
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN archived_by_user_id uuid,
  ADD COLUMN archive_reason text;

ALTER TABLE user_accounts
  ADD CONSTRAINT user_account_archived_by_fkey
    FOREIGN KEY (archived_by_user_id) REFERENCES user_accounts(id) ON DELETE RESTRICT,
  ADD CONSTRAINT user_account_archive_consistency
    CHECK (
      (archived_at IS NULL AND archived_by_user_id IS NULL AND archive_reason IS NULL)
      OR
      (archived_at IS NOT NULL AND archived_by_user_id IS NOT NULL AND length(trim(archive_reason)) BETWEEN 10 AND 500)
    );

CREATE INDEX user_account_archived_by_idx ON user_accounts(archived_by_user_id);
CREATE INDEX user_account_archived_at_idx ON user_accounts(archived_at);
