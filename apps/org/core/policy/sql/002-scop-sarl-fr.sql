-- The SCOP SARL in France: a société coopérative et participative that is
-- a société à responsabilité limitée à capital variable, and its default
-- policies, in its order: the procedures, the participant's mandates, the
-- assembly's collective mandates, the rights, and the law's floors on the
-- surplus. Each names the law it states, by its article, or none where it
-- is cella's practice. Every source is the building lane's reading of loi
-- n° 47-1775, loi n° 78-763, the Code de commerce and the GDPR, not
-- settled law: none is reviewed by a co-op lawyer yet (_corpus/doc/forms.md).
-- Its assembly is the circle `ag`, as the form's founding makes its root.
INSERT INTO policy.form (id, label, region) VALUES ('scop-sarl-fr', 'SCOP SARL', 'France');

SELECT policy.offer('scop-sarl-fr', 'consent', 'procedure',
  'By {procedure: consent}, a motion is decided by {method: consent}, with a quorum of {quorum: none}: it passes if no member on its roll objects at its close',
  'A motion passes if no one objects.', NULL, NULL);
SELECT policy.offer('scop-sarl-fr', 'majority', 'procedure',
  'By {procedure: majority}, a motion is decided by a {method: majority} of the votes cast, with a quorum of {quorum: none}: it passes with more for than against',
  'A motion passes with more for than against.', NULL, NULL);
SELECT policy.offer('scop-sarl-fr', 'two-thirds', 'procedure',
  'By {procedure: two-thirds}, a motion is decided by a {method: majority} of {share: 2/3} of the votes cast, with a quorum of {quorum: none}',
  NULL, NULL, NULL);
SELECT policy.offer('scop-sarl-fr', 'election', 'procedure',
  'By {procedure: election}, a person is elected or removed by a {method: majority} of the votes cast, with a quorum of {quorum: none}, by {ballot: secret} ballot',
  NULL, NULL, NULL);
SELECT policy.offer('scop-sarl-fr', 'ordinary', 'procedure',
  'By the {label: ordinary assembly}''s procedure, {procedure: ordinary}, a motion is decided by a {method: majority} of the votes cast, with a quorum of {quorum: 1/4} of the associates on its roll',
  NULL, NULL, 'Code de commerce art. L223-29; loi n° 47-1775 art. 4');
SELECT policy.offer('scop-sarl-fr', 'extraordinary', 'procedure',
  'By the {label: extraordinary assembly}''s procedure, {procedure: extraordinary}, which amends the statutes, a motion is decided by a {method: majority} of {share: 2/3} of the votes cast, with a quorum of {quorum: 1/2} of the associates on its roll',
  NULL, NULL, 'Code de commerce art. L223-30; loi n° 47-1775 art. 4');
SELECT policy.offer('scop-sarl-fr', 'propose', 'mandate',
  'The {role: participant} role holds {power: propose}, to propose a motion of the circle and close it',
  NULL, NULL, NULL);
SELECT policy.offer('scop-sarl-fr', 'discuss', 'mandate',
  'The {role: participant} role holds {power: discuss}, to discuss the circle''s motions, write in its channel and draw up its meetings'' agendas',
  NULL, NULL, NULL);
SELECT policy.offer('scop-sarl-fr', 'admit-member', 'mandate',
  'The {circle: ag} circle holds {power: admit-member}, to admit members, by motion',
  NULL, NULL, 'loi n° 47-1775 art. 7');
SELECT policy.offer('scop-sarl-fr', 'suspend-member', 'mandate',
  'The {circle: ag} circle holds {power: suspend-member}, to suspend a member, by motion',
  NULL, NULL, NULL);
SELECT policy.offer('scop-sarl-fr', 'exclude-member', 'mandate',
  'The {circle: ag} circle holds {power: exclude-member}, to exclude a member, by motion',
  NULL, NULL, 'loi n° 47-1775 art. 7; Code de commerce art. L231-6');
SELECT policy.offer('scop-sarl-fr', 'adopt-policy', 'mandate',
  'The {circle: ag} circle holds {power: adopt-policy}, to adopt policies, the statutes'' among them, by motion',
  NULL, 'extraordinary', 'Code de commerce art. L223-30');
SELECT policy.offer('scop-sarl-fr', 'end-policy', 'mandate',
  'The {circle: ag} circle holds {power: end-policy}, to end policies, by motion',
  NULL, 'extraordinary', 'Code de commerce art. L223-30');
SELECT policy.offer('scop-sarl-fr', 'approve-distribution', 'mandate',
  'The {circle: ag} circle holds {power: approve-distribution}, to approve a year''s distribution, by motion',
  NULL, NULL, 'loi n° 47-1775 art. 8; loi n° 78-763 art. 33');
SELECT policy.offer('scop-sarl-fr', 'adopt-document', 'mandate',
  'The {circle: ag} circle holds {power: adopt-document}, to adopt a document''s version, by motion',
  NULL, NULL, NULL);
SELECT policy.offer('scop-sarl-fr', 'nest-circle', 'mandate',
  'The {circle: ag} circle holds {power: nest-circle}, to nest circles, by motion',
  NULL, NULL, NULL);
SELECT policy.offer('scop-sarl-fr', 'seat-member', 'mandate',
  'The {circle: ag} circle holds {power: seat-member}, to give and end seats, by motion',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'withdraw-membership', 'mandate',
  'Every {right: person} holds {power: withdraw-membership}, to withdraw their own membership',
  NULL, 'extraordinary', 'Code de commerce art. L231-6');
SELECT policy.offer('scop-sarl-fr', 'erase-own-data', 'mandate',
  'Every {right: person} holds {power: erase-own-data}, to erase their own personal data once they have left',
  NULL, 'extraordinary', 'GDPR art. 17');
SELECT policy.offer('scop-sarl-fr', 'keep-profile', 'mandate',
  'Every {right: person} holds {power: keep-profile}, to keep their own profile and contact details',
  NULL, 'extraordinary', 'GDPR art. 16');
SELECT policy.offer('scop-sarl-fr', 'keep-devices', 'mandate',
  'Every {right: person} holds {power: keep-devices}, to enrol and revoke their own devices',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'upload-file', 'mandate',
  'Every {right: person} holds {power: upload-file}, to upload a file of the co-op''s',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'accept-invitation', 'mandate',
  'Every {right: person} holds {power: accept-invitation}, to take up their invitation to join',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'file-record', 'mandate',
  'Every {right: person} holds {power: file-record}, to file a record of their own',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'mark-read', 'mandate',
  'Every {right: person} holds {power: mark-read}, to mark a text the co-op adopted read',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'record-import', 'mandate',
  'Every {right: person} holds {power: record-import}, to record an import of their own',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'draw-account', 'mandate',
  'Every {right: member} holds {power: draw-account}, to draw on their own account within its draw limit',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'spread-capital', 'mandate',
  'Every {right: member} holds {power: spread-capital}, to spread what they owe for their shares over their pay',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'mark-attendance', 'mandate',
  'Every {right: member} holds {power: mark-attendance}, to mark their own attendance at a meeting',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'save-report', 'mandate',
  'Every {right: member} holds {power: save-report}, to save a report of their own',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'log-time', 'mandate',
  'Every {right: employee} holds {power: log-time}, to log, correct and submit their own time',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'claim-expense', 'mandate',
  'Every {right: employee} holds {power: claim-expense}, to claim their expenses and file their receipts',
  NULL, 'extraordinary', NULL);
SELECT policy.offer('scop-sarl-fr', 'work-share', 'rule',
  'At least {work_share: 25 % | more is stricter} of each year''s surplus goes to all the employees as the work share',
  'At least a quarter of the surplus goes to the workers.', NULL, 'loi n° 78-763 art. 33');
SELECT policy.offer('scop-sarl-fr', 'reserves', 'rule',
  'At least {reserve_share: 15 % | more is stricter} of each year''s surplus goes to the reserves',
  'At least 15 % of the surplus is kept in reserve.', NULL, 'loi n° 78-763 art. 33');
