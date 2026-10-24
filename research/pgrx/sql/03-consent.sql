SELECT status, count(*) FROM member.member GROUP BY 1;
-- only each member's latest stance counts; any outstanding object/block fails consent
SELECT d.id, d.rule,
       cella.consent(v.member, v.stance ORDER BY v.at) AS consent,
       cella.tally(v.member, v.stance ORDER BY v.at) AS latest
FROM decision.decision d JOIN decision.vote v ON v.decision = d.id
GROUP BY d.id, d.rule ORDER BY d.id;
-- Hugo objected on 10-21 and consented on 10-23: the order decides
SELECT cella.consent(member, stance ORDER BY at DESC) AS reversed_order
FROM decision.vote WHERE decision = 'd-2026-012';
-- d-2026-011 passes once Malik withdraws his objection
SELECT cella.consent(member, stance ORDER BY at) AS after_withdrawal FROM (
  SELECT member, stance, at FROM decision.vote WHERE decision = 'd-2026-011'
  UNION ALL SELECT 'malik@lanterne.example', 'consent', date '2026-10-25') v;
SELECT cella.consent(m, s) FROM (VALUES ('a', 'maybe')) x(m, s);
