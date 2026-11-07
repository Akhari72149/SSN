CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT position_name_length CHECK (length(trim(name)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX position_event_name_unique ON positions(event_id,lower(name));
CREATE INDEX position_event_idx ON positions(event_id);

ALTER TABLE shifts ADD COLUMN position_id uuid REFERENCES positions(id) ON DELETE RESTRICT;
CREATE INDEX shift_position_starts_idx ON shifts(position_id,starts_at);
CREATE INDEX shift_event_range_idx ON shifts(event_id,starts_at,ends_at);
