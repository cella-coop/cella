-- What a passing close carries, each an effect citing it in its
-- transaction: the actions a motion may decide, admissions among them.
SELECT cella.lets_follow('motion:motion:close', 'membership:member:admit', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'membership:member:suspend', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'membership:member:exclude', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'motion:policy:adopt', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'motion:policy:end', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'circle:circle:create', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'circle:circle:amend', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'circle:circle:arrange', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'circle:role:make', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'circle:role:amend', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'circle:seat:add', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'circle:seat:remove', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'circle:role:seat', 'membership-motion');
SELECT cella.lets_follow('motion:motion:close', 'circle:role:unseat', 'membership-motion');
