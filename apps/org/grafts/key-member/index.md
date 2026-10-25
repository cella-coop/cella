+++
title = "key-member"
updated = 2026-10-25
+++

A member's devices, from the first one their invitation carries. Declared
by the `member` feat.

## Schema

`key_member` (`sql/`): `key_member.invitation`, the first device an
invitation carries: the invitee's address, the public key their device
made and the label they gave it, with no foreign key into either feat.
A key is carried by one invitation. The app role may select and insert;
the rules role, `cella_rules`, may select.

`key_member.enrol`, a trigger after a member moves from invited to active,
enrols the invitation's device in that write's own transaction, on the
verdict date, enrolled by no device. An admission whose invitation
carries no device is refused, SQLSTATE `09000`, so no member is admitted
unable to sign, and nothing it wrote stays.

## Rules

- `key_member.carries`, on `member:member:invite`: the invitation carries
  the key its payload names, which no device holds yet.

The invitation's payload commits to the key, so the log says which device
an admission enrolled: the admission's own entry names the member, and
the invitation's the key. The label is the invitee's wording and stays
out.

## Handlers

- `invite` (confluent): the member feat's `inviting`, then the device it
  carries, in one write under the member feat's op; submits `{ member,
  invited, key }`. A key that is not 32 bytes in hex, or one another
  invitation carries, is refused before it reaches the notary.

## Shell

Replaces the members collection's New form and its `invite` write with
the invitation carrying a first device: name, address, the device's
label and its key. On a member's page, the first device until their
admission enrols it, and every device enrolled under their address, as
the key feat lists them; under Joining, whether they hold a device
that signs, and the one their invitation carries until it is enrolled.

## Lanterne

Inès's invitation carries her phone, whose TEST-ONLY key the seed
derives from her address and its label; d-2026-012's close enrols it.
Her laptop came with her hire (`key-worker`).
