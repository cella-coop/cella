-- How a circle meets: the share of its seats that must be present for a
-- meeting to be quorate, in percent, and whether its minutes are adopted
-- by motion before they bind. A circle with no row here needs half its
-- seats and keeps its minutes as written. Set by the seed until a
-- motion sets it.
CREATE TABLE meeting.setting (
  circle text PRIMARY KEY REFERENCES circle.circle,
  quorum integer NOT NULL DEFAULT 50 CHECK (quorum BETWEEN 1 AND 100),
  adopts boolean NOT NULL DEFAULT false
);

GRANT USAGE ON SCHEMA meeting TO cella_app, cella_guards;
GRANT SELECT ON meeting.setting TO cella_app, cella_guards;
