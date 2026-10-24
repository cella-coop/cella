+++
title = "Key"
updated = 2026-10-24
+++

Members' devices and their keys. A device key signs a member's votes and approvals; rotating it keeps the member's address.

## Writes

| Write | Label | Why |
|---|---|---|
| `POST /api/key/enrol` | confluent | signed by the member's current key; the address stays |
| `POST /api/key/revoke` | ordered | ordered against that device's writes |
| `POST /api/key/recover` | ordered | guardian shares |
