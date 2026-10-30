-- The document feat's analytical contract: each document, how many
-- versions it has, when it was last saved and adopted.
CREATE VIEW document.documents AS
SELECT d.id, d.title,
       (SELECT count(*) FROM document.version v WHERE v.document = d.id)::bigint AS versions,
       (SELECT max(v.saved) FROM document.version v WHERE v.document = d.id) AS saved,
       (SELECT max(a.adopted) FROM document.adopted a WHERE a.document = d.id) AS adopted
FROM document.document d;
