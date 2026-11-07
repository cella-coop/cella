-- How each action that writes this graft's schema applies to the state
-- before it (architecture.md, "Folds"), once the meeting feat's fold has
-- added the item.

-- meeting:item:add: the motion the item tables, where the entry names
-- one; an item that tables none writes nothing here.
CREATE FUNCTION meeting_motion.fold_add(entry jsonb) RETURNS void
LANGUAGE sql
BEGIN ATOMIC
  INSERT INTO meeting_motion.tabled (item, meeting, motion)
  SELECT (fold_add.entry -> 'payload' ->> 'item')::bigint, fold_add.entry -> 'payload' ->> 'meeting', fold_add.entry -> 'payload' ->> 'motion'
  WHERE fold_add.entry -> 'payload' ->> 'motion' IS NOT NULL;
END;

SELECT cella.lets_fold('meeting:item:add', 1, 'meeting_motion.fold_add(jsonb)', 'meeting-motion');
