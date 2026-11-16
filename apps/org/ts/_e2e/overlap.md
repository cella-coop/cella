# The e2e scenarios' overlap

Written by `cella test e2e --overlap` at `ad32f1551`: 86 scenarios, 41.3 minutes of scenario time. Each scenario reaches the commands it wrote, the queries it called, by the tables and views their text names, and the routes the shell served it. This is a review list, never a delete list: a scenario leaves the suite only by a change the planner plans from it, which says what it covered and what covers it now ([the CLI](../../rs/index.md)).

## Held whole

Each scenario whose commands, queries and routes another holds whole, most minutes first.

| Scenario | Minutes | Held by |
|---|---:|---|
| `group` | 0.79 | `filter` |
| `filter` | 0.64 | `group` |
| `order` | 0.62 | `filter`, `group` |
| `colour` | 0.46 | `fields`, `logged`, `view` |
| `pinned` | 0.31 | `fields`, `view` |
| `lenses` | 0.17 | `a11y`, `reads`, `view` |
| `withheld` | 0.17 | `a11y`, `authority-walk`, `lineage` |
| `date-field` | 0.14 | `a11y`, `view` |
| `ledger` | 0.14 | `fold` |
| `pending` | 0.11 | `crowd`, `people`, `reserve`, `signin` |
| `reserve` | 0.10 | `crowd`, `people`, `signin` |
| `policy` | 0.08 | `authority-walk` |
| `provenance` | 0.05 | `fold` |
| `procedure` | 0.03 | `authority-walk`, `effects`, `forms`, `requirements`, `roll` |
| `chain` | 0.01 | `authority-walk`, `fold` |

## Sharing most

The pairs sharing at least 90% of the smaller's reach, those held whole left out, by the minutes the smaller takes, the first 40.

| Smaller | Minutes | Larger | Shared |
|---|---:|---|---:|
| `reads` | 2.72 | `a11y` | 72 of 74 |
| `reads` | 2.72 | `view` | 70 of 74 |
| `editor` | 2.43 | `a11y` | 87 of 94 |
| `editor` | 2.43 | `shell` | 88 of 94 |
| `view` | 1.39 | `a11y` | 107 of 108 |
| `amend` | 1.32 | `authority-walk` | 39 of 42 |
| `amend` | 1.32 | `features` | 39 of 42 |
| `amend` | 1.32 | `grant` | 38 of 42 |
| `amend` | 1.32 | `roles` | 40 of 42 |
| `reports` | 1.28 | `a11y` | 30 of 33 |
| `authority-walk` | 1.16 | `shell` | 90 of 98 |
| `account` | 0.68 | `features` | 27 of 29 |
| `account` | 0.68 | `organization` | 27 of 29 |
| `crowd` | 0.67 | `a11y` | 75 of 80 |
| `powers` | 0.67 | `a11y` | 64 of 68 |
| `powers` | 0.67 | `authority-walk` | 67 of 68 |
| `crowd` | 0.67 | `shell` | 73 of 80 |
| `crowd` | 0.67 | `work` | 72 of 80 |
| `powers` | 0.67 | `editor` | 63 of 68 |
| `powers` | 0.67 | `people` | 63 of 68 |
| `powers` | 0.67 | `shell` | 64 of 68 |
| `author` | 0.65 | `a11y` | 49 of 52 |
| `author` | 0.65 | `authority-walk` | 50 of 52 |
| `author` | 0.65 | `boundary` | 47 of 52 |
| `author` | 0.65 | `editor` | 49 of 52 |
| `author` | 0.65 | `effects` | 47 of 52 |
| `author` | 0.65 | `grant` | 48 of 52 |
| `author` | 0.65 | `meetings` | 47 of 52 |
| `author` | 0.65 | `shell` | 50 of 52 |
| `sidebar` | 0.63 | `a11y` | 28 of 30 |
| `sidebar` | 0.63 | `crowd` | 27 of 30 |
| `sidebar` | 0.63 | `fields` | 28 of 30 |
| `sidebar` | 0.63 | `view` | 28 of 30 |
| `grant` | 0.62 | `authority-walk` | 55 of 59 |
| `grant` | 0.62 | `shell` | 54 of 59 |
| `roles` | 0.59 | `authority-walk` | 40 of 44 |
| `fields` | 0.57 | `a11y` | 33 of 35 |
| `fields` | 0.57 | `crowd` | 32 of 35 |
| `fields` | 0.57 | `view` | 33 of 35 |
| `logged` | 0.54 | `a11y` | 39 of 42 |

## Each scenario

What each reaches, and what it alone reaches, which no other scenario covers.

| Scenario | Minutes | Commands | Queries | Routes | Its own |
|---|---:|---:|---:|---:|---|
| `a11y` | 9.61 | 0 | 126 | 57 | `query patronage_timesheet.time_share`, `route GET /bases/:id`, `route GET /distributions/:id`, `route GET /imports`, `route GET /log/:id`, `route GET /terms/:id`, `route GET /timesheets/:id` |
| `account` | 0.68 | 1 | 18 | 10 |  |
| `admission` | 0.14 | 6 | 82 | 0 |  |
| `amend` | 1.32 | 4 | 30 | 8 |  |
| `analytics` | 0.00 | 0 | 74 | 0 |  |
| `analytics-shell` | 0.56 | 1 | 6 | 0 |  |
| `api` | 0.03 | 2 | 16 | 10 | `route GET /api/expenses`, `route GET /api/nowhere`, `route GET /api/payslips`, `route GET /api/payslips/:id`, `route POST /api/project/budget`, `route POST /api/task/create`, `route POST /api/task/fly` |
| `author` | 0.65 | 1 | 42 | 9 |  |
| `authority` | 0.04 | 11 | 15 | 0 |  |
| `authority-walk` | 1.16 | 7 | 77 | 14 |  |
| `bills` | 0.02 | 3 | 7 | 0 |  |
| `books` | 0.05 | 8 | 12 | 0 |  |
| `boundary` | 0.26 | 0 | 57 | 15 | `route GET /settings/nowhere` |
| `bundle` | 0.03 | 7 | 9 | 0 |  |
| `calendar` | 0.01 | 0 | 0 | 0 |  |
| `capital` | 0.10 | 28 | 34 | 0 |  |
| `chain` | 0.01 | 5 | 7 | 0 |  |
| `clients` | 0.08 | 1 | 33 | 8 |  |
| `collective` | 0.11 | 7 | 10 | 0 |  |
| `colour` | 0.46 | 0 | 21 | 7 |  |
| `contacts` | 0.07 | 2 | 61 | 7 |  |
| `crowd` | 0.67 | 1 | 67 | 12 |  |
| `date-field` | 0.14 | 0 | 26 | 6 |  |
| `denial` | 0.08 | 0 | 131 | 0 |  |
| `document` | 0.03 | 7 | 12 | 0 |  |
| `drag` | 0.00 | 0 | 0 | 0 |  |
| `editor` | 2.43 | 3 | 76 | 15 |  |
| `effects` | 1.07 | 11 | 46 | 8 |  |
| `pinned` | 0.31 | 0 | 22 | 7 |  |
| `features` | 1.28 | 4 | 28 | 11 |  |
| `fields` | 0.57 | 0 | 26 | 9 |  |
| `files` | 0.05 | 5 | 59 | 9 | `route GET /files/:id/content` |
| `filter` | 0.64 | 0 | 25 | 9 |  |
| `finance` | 0.07 | 14 | 18 | 0 |  |
| `fold` | 0.47 | 110 | 119 | 0 | `command contact-project:project:link`, `command contact:contact:archive`, `command expense-project:expense:rebill`, `command expense:expense:refuse`, `command invoice-project:invoice:link`, `command meeting:meeting:cancel`, `command project:milestone:complete` |
| `forms` | 0.05 | 6 | 20 | 0 |  |
| `founding` | 0.19 | 2 | 79 | 0 |  |
| `generated` | 0.10 | 6 | 14 | 0 |  |
| `governance` | 0.14 | 14 | 23 | 0 |  |
| `grant` | 0.62 | 6 | 44 | 9 |  |
| `group` | 0.79 | 0 | 25 | 9 |  |
| `import` | 0.09 | 8 | 37 | 6 | `route GET /imports/:id` |
| `ink` | 0.19 | 0 | 18 | 6 | `route GET /specimens/ink` |
| `ledger` | 0.14 | 13 | 76 | 0 |  |
| `lenses` | 0.17 | 0 | 42 | 0 |  |
| `lineage` | 0.34 | 0 | 26 | 9 |  |
| `logged` | 0.54 | 2 | 30 | 10 |  |
| `mandate` | 0.05 | 7 | 10 | 0 |  |
| `meetings` | 0.64 | 10 | 48 | 14 |  |
| `notarised` | 0.04 | 4 | 5 | 0 | `command test:run:note`, `command test:run:stray` |
| `order` | 0.62 | 0 | 23 | 8 |  |
| `organization` | 0.43 | 1 | 21 | 9 |  |
| `owning` | 0.01 | 2 | 21 | 0 |  |
| `participation` | 0.17 | 7 | 43 | 7 |  |
| `particulars` | 0.02 | 5 | 8 | 0 |  |
| `patronage` | 0.26 | 12 | 27 | 0 |  |
| `pending` | 0.11 | 1 | 2 | 5 |  |
| `people` | 0.40 | 16 | 66 | 7 |  |
| `policy` | 0.08 | 4 | 13 | 0 |  |
| `powers` | 0.67 | 0 | 61 | 7 |  |
| `preview` | 1.28 | 1 | 98 | 6 |  |
| `privacy` | 0.03 | 11 | 17 | 0 |  |
| `procedure` | 0.03 | 4 | 5 | 0 |  |
| `protected` | 0.01 | 4 | 7 | 0 |  |
| `provenance` | 0.05 | 10 | 7 | 0 |  |
| `reading` | 0.29 | 3 | 94 | 13 |  |
| `reads` | 2.72 | 2 | 68 | 4 |  |
| `refusal` | 0.11 | 8 | 16 | 5 |  |
| `report-reader` | 0.17 | 6 | 26 | 7 |  |
| `reports` | 1.28 | 2 | 26 | 5 |  |
| `requirements` | 0.07 | 5 | 7 | 0 |  |
| `reserve` | 0.10 | 1 | 3 | 5 |  |
| `restore` | 0.63 | 6 | 147 | 0 | `query account.rubric`, `query cella.authority`, `query cella.checkpoint`, `query cella.commitment`, `query cella.fold_head`, `query cella.guard`, `query cella.kept_field`, `query cella.keyring`, `query cella.personal`, `query cella.power`, `query cella.reach`, `query cella.retention`, `query cella.signer`, `query cella.slot`, `query cella.table_hash`, `query circle_person.standing`, `query file.contract`, `query file.receipt`, `query file.record`, `query file.shared`, `query file_membership.opener`, `query motion.ask_guard`, `query motion.cite_guard`, `query motion.cites`, `query motion.puts`, `query motion.stance_power`, `query patronage.division`, `query payslip_transaction.payment_lines`, `query person.rights`, `query report.drawn`, `query transaction.journal`, `query transaction.line_check`, `query vault.swept` |
| `role-seat` | 0.03 | 7 | 7 | 0 |  |
| `roles` | 0.59 | 6 | 30 | 8 |  |
| `roll` | 0.04 | 4 | 8 | 0 |  |
| `settings` | 0.40 | 0 | 18 | 7 | `route GET /specimens/settings` |
| `shell` | 0.79 | 8 | 107 | 34 | `route GET /invoices/:id/content` |
| `sidebar` | 0.63 | 0 | 22 | 8 |  |
| `signin` | 0.25 | 3 | 58 | 11 | `route POST /_app/remote/ja21py/accept`, `route POST /sign-out` |
| `tenure` | 0.01 | 8 | 5 | 0 |  |
| `view` | 1.39 | 0 | 75 | 33 |  |
| `views` | 0.01 | 0 | 0 | 0 |  |
| `waiting` | 0.01 | 2 | 3 | 0 |  |
| `withheld` | 0.17 | 0 | 25 | 6 |  |
| `work` | 0.17 | 10 | 81 | 13 |  |
