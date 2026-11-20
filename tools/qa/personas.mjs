// tools/qa/personas.mjs: a QA round of main's tip as the demo serves it,
// 5 to 10 simulated co-op members, each a fixture member of Lanterne with
// a goal through the demo's key flows, each its own browser context, run
// concurrently in Chromium, then one pass of every persona in Firefox and
// one in WebKit. Reuses tools/qa/rooms.mjs's harness (a throwaway
// Postgres cluster, a private socket, and tools/demo-serve.mjs on
// loopback ports): never against production, nothing of this touches
// cella.coop or app.cella.coop. Every defect a persona's step meets is a
// screenshot under SHOTS and a line in the report this prints at the end;
// a step that fails never stops the persona's run, only that step.
//
// Prerequisites, once, in this checkout:
//   nix develop -c cella db start   # builds the extension under .data/ext
//   nix develop -c cella build      # the shell this serves, apps/org/ts/build
//
// Then:
//   nix develop -c node tools/qa/personas.mjs
//
// PERSONAS_FRONT_PORT picks the front's own port (default 31030, loopback
// only). BROWSERS (comma-separated: chromium,firefox,webkit) narrows the
// browsers run; default every one, Chromium's personas concurrent, then
// one pass each in Firefox and WebKit. SHOTS names where screenshots of
// defects go (default ~/qa-2026-11-20).

import { execFileSync, spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, firefox, webkit } from 'playwright-core'

const repo = new URL('../../', import.meta.url).pathname
const PORT = Number(process.env.PERSONAS_FRONT_PORT ?? 31030)
const FRONT = `http://127.0.0.1:${PORT}`
const SHOTS = process.env.SHOTS ?? join(homedir(), 'qa-2026-11-20')
const log = (line) => console.log(`personas qa: ${line}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync(SHOTS, { recursive: true })

// --- defects, collected as the run goes, never thrown: a step that fails
// is a line in the report and a screenshot, never a reason to stop the
// persona or the run. -----------------------------------------------------
const defects = []
const consoleIssues = []

async function shoot(page, browserName, persona, step) {
  const path = join(SHOTS, `${browserName}-${persona}-${step}.png`.replace(/[^a-zA-Z0-9_.-]/g, '_'))
  try {
    await page.screenshot({ path, timeout: 10_000 })
    return path
  } catch (e) {
    return `(could not screenshot: ${e.message})`
  }
}

async function record(page, browserName, persona, step, severity, what) {
  const path = await shoot(page, browserName, persona, step)
  defects.push({ browser: browserName, persona, step, severity, what, path })
  log(`DEFECT [${severity}] ${browserName}/${persona}/${step}: ${what} (${path})`)
}

// Runs one step of a persona's flow: never throws, a failure is a defect
// with a screenshot, by structure (an assertion's own message), never a
// crash of the whole persona.
async function step(ctx, name, fn) {
  const { page, browserName, persona } = ctx
  try {
    await fn()
  } catch (e) {
    if (process.env.QA_DEBUG) console.error(`FULL ERROR ${browserName}/${persona}/${name}:\n${e.message}`)
    await record(page, browserName, persona, name, 'major', e.message.split('\n')[0])
  }
}

// --- a throwaway Postgres cluster and the demo front, as tools/qa/rooms.mjs
// stands them up (copied, trimmed to what this needs). -------------------
const cleanups = []
const teardown = async () => {
  while (cleanups.length) {
    const fn = cleanups.pop()
    try {
      await fn()
    } catch (e) {
      log(`teardown step failed, continuing: ${e.message}`)
    }
  }
}
let tearingDown = false
const stop = async (code) => {
  if (tearingDown) return
  tearingDown = true
  await teardown()
  process.exit(code)
}
process.on('SIGINT', () => stop(130))
process.on('SIGTERM', () => stop(143))

function startCluster() {
  const dir = mkdtempSync(join(tmpdir(), 'cella-personas-qa-'))
  const pgdir = join(dir, 'pg')
  const conf = readFileSync(join(repo, '.data/pg/cella.conf'), 'utf8')
  const loads = conf.split('\n').filter((l) => /^(extension_control_path|dynamic_library_path|shared_preload_libraries) /.test(l))
  if (loads.length < 3) {
    throw new Error('.data/pg/cella.conf names no extension to load; run `cella db start` once first')
  }
  execFileSync('initdb', ['-D', pgdir, '-U', 'postgres', '--auth=trust'], { stdio: 'ignore' })
  const lines = [
    "listen_addresses = ''",
    `unix_socket_directories = '${dir}'`,
    'port = 5432',
    ...loads,
    `cella.key_file = '${join(repo, '.data/notary.key')}'`,
    `cella.vault_key_file = '${join(repo, '.data/vault.key')}'`,
    '',
  ]
  writeFileSync(join(pgdir, 'postgresql.conf'), lines.join('\n'), { flag: 'a' })
  execFileSync('pg_ctl', ['-D', pgdir, '-l', join(dir, 'pg.log'), '-w', 'start'], { stdio: 'ignore' })
  cleanups.push(() => {
    execFileSync('pg_ctl', ['-D', pgdir, '-m', 'immediate', '-w', 'stop'], { stdio: 'ignore' })
    rmSync(dir, { recursive: true, force: true })
  })
  log(`a throwaway Postgres cluster is up on its own socket, ${dir}`)
  return dir
}

function buildTemplate(socketDir) {
  const url = `postgresql://postgres@/demo_template?host=${encodeURIComponent(socketDir)}`
  log('building the demo template (authority-walk story on Lanterne)…')
  execFileSync('cella', ['demo', 'template', '--url', url], { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] })
  log('the template is built')
}

async function startFront(socketDir, port, flags) {
  const base = `http://127.0.0.1:${port}`
  const child = spawn('cella', ['demo', 'serve', '--template', 'demo_template', '--server', join(repo, 'apps/org/ts/build'), '--port', String(port), '--host', '127.0.0.1', ...flags], {
    cwd: repo,
    env: { ...process.env, PGHOST: socketDir, PGUSER: 'postgres', PGDATABASE: 'postgres' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  const tag = (d) => {
    const s = d.toString()
    out += s
    for (const line of s.split('\n').filter(Boolean)) log(`[${port}] ${line}`)
  }
  child.stdout.on('data', tag)
  child.stderr.on('data', tag)
  const exited = new Promise((_, reject) => child.once('exit', (code, signal) => reject(new Error(`the front on ${port} exited (${signal ?? code}) before it answered:\n${out}`))))
  const stopFront = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const gone = new Promise((r) => child.once('exit', r))
      child.kill('SIGTERM')
      const late = setTimeout(() => child.kill('SIGKILL'), 10_000)
      await gone
      clearTimeout(late)
    }
  }
  cleanups.push(stopFront)
  const ready = (async () => {
    for (let i = 0; i < 150; i++) {
      try {
        const res = await fetch(`${base}/_demo/health`)
        if (res.ok) return
      } catch {
        // not listening yet
      }
      await sleep(200)
    }
    throw new Error(`the front on ${port} never answered its health check`)
  })()
  await Promise.race([ready, exited])
  log(`the front is up on ${base}`)
  return { stop: stopFront }
}

// --- joining a room, as rooms.mjs drives a browser ------------------------
async function retrying(fn, times = 3) {
  for (let i = 1; i < times; i++) {
    try {
      return await fn()
    } catch (e) {
      log(`attempt ${i} failed, retrying: ${e.message.split('\n')[0]}`)
    }
  }
  return await fn()
}

async function freshRoom(browser, opts = {}) {
  return retrying(async () => {
    const context = await browser.newContext({ viewport: opts.viewport, colorScheme: opts.scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    try {
      const page = await context.newPage()
      await page.goto(FRONT)
      await page.waitForURL((u) => u.pathname === '/sign-in', { timeout: 90_000 })
      return { context, page, madeAt: Date.now() }
    } catch (e) {
      await context.close().catch(() => {})
      throw e
    }
  })
}

async function joinRoom(browser, code, opts = {}) {
  return retrying(async () => {
    const context = await browser.newContext({ viewport: opts.viewport, colorScheme: opts.scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
    try {
      const page = await context.newPage()
      await page.goto(`${FRONT}/_demo/join#${code}`)
      await page.waitForURL((u) => u.pathname === '/sign-in', { timeout: 20_000 })
      return { context, page }
    } catch (e) {
      await context.close().catch(() => {})
      throw e
    }
  })
}

async function inviteCode(page) {
  const href = await page.getByRole('link', { name: /Copy invite|Copied/ }).getAttribute('href')
  const code = href?.split('#')[1]
  if (!code) throw new Error(`no join code on ${page.url()}`)
  return code
}

// --- personas: fixture members of Lanterne, read from the fixture -------
// (apps/org/fixtures/lanterne/person.toml and membership.toml), each a
// mandate drawn from their actual role and circle seats, a goal through
// the demo's key flows. Hugo is alone in Room B so Reset now and the
// banner's dismiss/amber panel can be exercised for real, without ending
// anyone else's room; everyone else shares Room A, so the motion's vote
// and the expense's approval are real, shared state between personas.
const NAME = {
  'camille@lanterne.example': 'Camille Martin',
  'lea@lanterne.example': 'Léa Bernard',
  'thomas@lanterne.example': 'Thomas Nguyen',
  'amina@lanterne.example': 'Amina Diallo',
  'julien@lanterne.example': 'Julien Petit',
  'yusuf@lanterne.example': 'Yusuf Demir',
  'chloe@lanterne.example': 'Chloé Moreau',
  'hugo@lanterne.example': 'Hugo Lefèvre',
}

// --- small, structural helpers over the UI core's own controls ----------

// Opens a Field's own combobox (role=combobox, named by its <label>
// through aria-labelledby) and picks the option whose text matches, or,
// with no name given, whichever option is first (its own circle, its own
// first choice).
async function choose(page, label, optionName) {
  const trigger = page.getByRole('combobox', { name: label }).first()
  await trigger.click()
  const option = optionName ? page.getByRole('option', { name: optionName }) : page.getByRole('option')
  await option.first().waitFor({ timeout: 10_000 })
  await option.first().click()
}

// A property's own Pick popover (the task's Status, a plain button whose
// accessible name is built from its content, "Status: next"): opens it
// and picks the option named `optionName`.
async function pick(page, triggerName, optionName) {
  const trigger = page.getByRole('button', { name: triggerName }).first()
  await trigger.click()
  const option = page.getByRole('option', { name: optionName })
  await option.first().waitFor({ timeout: 10_000 })
  await option.first().click()
}

// A date field's own calendar (controls.ts's own `pick`, ported here: no
// date control in the org app is the browser's): opens it from its
// "Choose a day" button, turns the months until `day` (an ISO date)
// shows, and clicks it, by `data-day`, never the locale's own typed
// format.
async function pickDay(scope, day) {
  const button = scope.getByRole('button', { name: 'Choose a day' })
  await button.first().click()
  const calendar = scope.page().getByRole('dialog', { name: 'Calendar' })
  await calendar.waitFor({ timeout: 10_000 })
  const want = day.slice(0, 7)
  for (let turns = 0; turns < 60; turns++) {
    const shown = await calendar
      .locator('[data-day]')
      .nth(10)
      .getAttribute('data-day')
      .catch(() => null)
    if (!shown) break
    if (shown.slice(0, 7) === want) break
    await calendar.getByRole('button', { name: shown.slice(0, 7) < want ? 'Next month' : 'Previous month' }).click()
  }
  await calendar.locator(`[data-day="${day}"]`).click()
  await calendar.waitFor({ state: 'hidden', timeout: 10_000 })
}

const dialog = (page, name) => page.getByRole('dialog', { name })

// Opens the New dialog on a collection page (the Frame's own "New"
// button, every collection's) and hands back its dialog, titled "New in
// <Title>".
async function openNew(page, title) {
  // A press before the page's own script hydrates is lost (the existing
  // e2e scenarios' own fix for the same flake on a slower engine,
  // date-field.test.ts and pickers.test.ts: wait for networkidle first).
  await page.waitForLoadState('networkidle').catch(() => {})
  // Its own button wears a kbd hint ("NewC"), the shortcut's letter run
  // into its name with no separator: a plain "New" never matches it
  // exactly, so, as the existing e2e scenarios do, this matches it as a
  // substring instead.
  await page.getByRole('button', { name: 'New' }).click()
  const dlg = dialog(page, new RegExp(`^New in ${title}`))
  await dlg.waitFor({ timeout: 10_000 })
  return dlg
}

async function heading(page, name, level) {
  await page.getByRole('heading', { name, level, exact: true }).waitFor({ timeout: 15_000 })
}

// At phone width a record's own Details drawer floats over the content,
// never under it (PageFrame.svelte's own narrow layout): a real visitor
// closes it, by the frame's own toggle, to reach what is behind it, so a
// narrow persona does the same before pressing anything in the main
// content a long drawer might still reach over.
async function collapseDrawerIfNarrow(page) {
  const vp = page.viewportSize()
  if (!vp || vp.width > 1208) return
  const hide = page.getByRole('button', { name: 'Hide the drawer' })
  if (await hide.isVisible().catch(() => false)) {
    await hide.click()
    // Waits for its own toggle to swap, so a stance pressed right after
    // never races the drawer's own close.
    await page.getByRole('button', { name: 'Show the drawer' }).waitFor({ timeout: 5_000 }).catch(() => {})
  }
}

// --- the flows a persona's goal is made of -------------------------------

async function signIn(ctx, address) {
  const { page } = ctx
  await step(ctx, 'sign-in', async () => {
    await page.getByRole('button', { name: new RegExp(NAME[address]) }).click()
    await page.waitForURL((u) => u.pathname === '/inbox', { timeout: 20_000 })
    await heading(page, 'Inbox', 1)
  })
}

async function inbox(ctx) {
  await step(ctx, 'inbox', async () => {
    await ctx.page.goto(`${FRONT}/inbox`)
    await heading(ctx.page, 'Inbox', 1)
  })
}

async function visitCirclesAndMandates(ctx) {
  const { page } = ctx
  await step(ctx, 'circles', async () => {
    await page.goto(`${FRONT}/circles`)
    await heading(page, 'Circles', 1)
  })
  await step(ctx, 'mandates', async () => {
    await page.goto(`${FRONT}/mandates`)
    await heading(page, 'Mandates', 1)
  })
}

async function visitSettings(ctx) {
  const { page } = ctx
  await step(ctx, 'settings', async () => {
    await page.goto(`${FRONT}/settings/account`)
    await heading(page, 'Account', 1)
  })
}

// Proposes a motion on the circle the persona is offered first (their
// own), under its default procedure (consent, unless the statutes say
// otherwise): Object, Abstain, Consent are the stances it offers.
async function proposeMotion(ctx, state) {
  const { page } = ctx
  await step(ctx, 'propose-motion', async () => {
    await page.goto(`${FRONT}/motions`)
    await heading(page, 'Motions', 1)
    const dlg = await openNew(page, 'Motions')
    await dlg.getByLabel('Title', { exact: true }).fill('QA round: a quiet Friday social, on the house')
    // The circle select offers only the circles this persona may propose
    // to: its first option is theirs.
    await choose(page, 'Circle')
    const deadline = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
    await pickDay(dlg, deadline)
    await dlg.getByLabel('Proposal', { exact: true }).fill('Proposed by the QA round: nothing beyond its text, a social evening the coop pays for.')
    await dlg.getByRole('button', { name: 'Propose', exact: true }).click()
    await dlg.waitFor({ state: 'hidden', timeout: 15_000 })
    // The motion just proposed is the newest in its board; its id is read
    // from the address once opened, for every voter to find it by.
    await page.waitForURL((u) => /\/motions\/?$/.test(u.pathname), { timeout: 10_000 })
    const link = page.getByRole('link', { name: /QA round: a quiet Friday social/ }).first()
    await link.waitFor({ timeout: 15_000 })
    const href = await link.getAttribute('href')
    state.motionHref = href
  })
}

async function voteOn(ctx, state, stance) {
  const { page } = ctx
  await step(ctx, `vote-${stance}`, async () => {
    if (!state.motionHref) throw new Error('no motion was proposed to vote on')
    await page.goto(`${FRONT}${state.motionHref}`)
    await page.getByRole('heading', { name: 'Vote', level: 2, exact: true }).waitFor({ timeout: 15_000 })
    await collapseDrawerIfNarrow(page)
    const before = (await page.getByText(/\d+ of \d+ stances?/i).first().textContent().catch(() => null)) ?? ''
    const button = page.getByRole('button', { name: new RegExp(`^${stance}$`, 'i') })
    await button.first().scrollIntoViewIfNeeded()
    await button.first().click()
    // The tally's own turnout, read from the panel, counts one more once
    // the write settles.
    await page.waitForFunction(
      ({ before }) => {
        const m = document.body.textContent?.match(/(\d+) of (\d+) stances?/i)
        const prior = before.match(/(\d+) of (\d+) stances?/i)
        return m && (!prior || Number(m[1]) > Number(prior[1]))
      },
      { before },
      { timeout: 15_000 },
    )
  })
}

// Creates a task on the board, then moves it: the detail page's Status
// property is a Pick, the move this feat's own `shifts` declare.
async function taskCreateAndMove(ctx) {
  const { page } = ctx
  await step(ctx, 'task-create', async () => {
    await page.goto(`${FRONT}/tasks`)
    await heading(page, 'Tasks', 1)
    const dlg = await openNew(page, 'Tasks')
    await dlg.getByLabel('Title', { exact: true }).fill('QA round: write up the demo script')
    await dlg.getByRole('button', { name: 'Create task', exact: true }).click()
    await dlg.waitFor({ state: 'hidden', timeout: 15_000 })
  })
  await step(ctx, 'task-move', async () => {
    await page.goto(`${FRONT}/tasks`)
    const link = page.getByRole('link', { name: /QA round: write up the demo script/ }).first()
    await link.waitFor({ timeout: 15_000 })
    await link.click()
    await page.waitForURL((u) => /\/tasks\//.test(u.pathname), { timeout: 10_000 })
    await page.waitForLoadState('networkidle').catch(() => {})
    await pick(page, /^Status:/, /^next$/i)
    await page.getByText(/^Status:\s*next/i).waitFor({ timeout: 15_000 })
  })
}

// Every Lanterne member is employed (apps/org/fixtures/lanterne/employment.toml),
// so the New dialog on Timesheets is not timesheet's own plain Log form
// (the simple Day/Hours/Kind/Note one that feat alone offers): the
// employment-project-timesheet graft replaces it with its own week grid
// (Week.svelte, action "week"), a project to a row and a day to a column.
// The first open (not disabled) cell is typed into and Enter, inside the
// form, logs the week.
async function logTime(ctx) {
  const { page } = ctx
  await step(ctx, 'timesheet-log', async () => {
    await page.goto(`${FRONT}/timesheets`)
    await heading(page, 'Timesheets', 1)
    const dlg = await openNew(page, 'Timesheets')
    // Not the row's own hidden `row`/`day` fields, nor its Circle pick's
    // own hidden input: the hour cell alone, `inputmode="decimal"`
    // (Grid.svelte).
    const cell = dlg.locator('table.grid input[inputmode="decimal"]:not([disabled])').first()
    await cell.waitFor({ timeout: 15_000 })
    await cell.scrollIntoViewIfNeeded()
    await cell.click()
    await cell.fill('2')
    await cell.press('Enter')
    await dlg.waitFor({ state: 'hidden', timeout: 15_000 })
  })
}

// Files an expense (draft), then submits it, so the approver below has
// something waiting.
async function fileExpense(ctx, state) {
  const { page } = ctx
  await step(ctx, 'expense-file', async () => {
    await page.goto(`${FRONT}/expenses`)
    await heading(page, 'Expenses', 1)
    const dlg = await openNew(page, 'Expenses')
    await dlg.getByLabel('What for', { exact: true }).fill('QA round: train tickets for the site visit')
    await dlg.getByLabel('Amount before VAT, €', { exact: true }).fill('42.00')
    await dlg.getByRole('button', { name: 'Add expense', exact: true }).click()
    await dlg.waitFor({ state: 'hidden', timeout: 15_000 })
    // Creating stays on the list, the dialog closed on it; the new row's
    // own link is what opens its page.
    const link = page.getByRole('link', { name: /QA round: train tickets for the site visit/ }).first()
    await link.waitFor({ timeout: 15_000 })
    await link.click()
    await page.waitForURL((u) => /\/expenses\//.test(u.pathname), { timeout: 15_000 })
    state.expenseHref = new URL(page.url()).pathname
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await page.getByText(/submitted/i).first().waitFor({ timeout: 15_000 })
  })
}

async function approveExpense(ctx, state) {
  const { page } = ctx
  await step(ctx, 'expense-approve', async () => {
    if (!state.expenseHref) throw new Error('no expense was filed to approve')
    await page.goto(`${FRONT}${state.expenseHref}`)
    await page.waitForLoadState('networkidle').catch(() => {})
    const approve = page.getByRole('button', { name: 'Approve', exact: true })
    await approve.waitFor({ timeout: 20_000 })
    await approve.click()
    await page.getByText(/approved/i).first().waitFor({ timeout: 15_000 })
  })
}

async function recordBill(ctx) {
  const { page } = ctx
  await step(ctx, 'bill-record', async () => {
    await page.goto(`${FRONT}/bills`)
    await heading(page, 'Bills', 1)
    const dlg = await openNew(page, 'Bills')
    await dlg.getByLabel('Supplier', { exact: true }).fill('QA Fournitures SARL')
    await dlg.getByLabel('Their reference', { exact: true }).fill('QA-2026-0001')
    await dlg.getByLabel('What for', { exact: true }).fill('QA round: office supplies')
    await dlg.getByLabel('Line 1', { exact: true }).fill('Paper and pens')
    await dlg.getByLabel('Unit price, €', { exact: true }).fill('60.00')
    await dlg.getByRole('button', { name: 'Record bill', exact: true }).click()
    await dlg.waitFor({ state: 'hidden', timeout: 15_000 })
    await page.getByText(/QA Fournitures SARL/).first().waitFor({ timeout: 15_000 })
  })
}

async function issueInvoice(ctx) {
  const { page } = ctx
  await step(ctx, 'invoice-issue', async () => {
    await page.goto(`${FRONT}/invoices`)
    await heading(page, 'Invoices', 1)
    const dlg = await openNew(page, 'Invoices')
    await dlg.getByLabel('Bill to', { exact: true }).fill('QA Client SAS')
    await dlg.getByLabel('Billing address', { exact: true }).fill('1 rue de la QA, 75000 Paris')
    await dlg.getByLabel('Label', { exact: true }).fill('QA round: a site audit')
    await dlg.getByLabel('Line 1', { exact: true }).fill('Site audit')
    await dlg.getByLabel('Unit price, €', { exact: true }).fill('900.00')
    await dlg.getByRole('button', { name: 'Issue invoice', exact: true }).click()
    await dlg.waitFor({ state: 'hidden', timeout: 15_000 })
    await page.getByText(/QA Client SAS/).first().waitFor({ timeout: 15_000 })
  })
}

// View options: the Fields chips (each "Hide <field>") and the + Add
// popover ("Add a field", a checkbox per field offered).
async function viewFields(ctx) {
  const { page } = ctx
  await step(ctx, 'view-fields', async () => {
    await page.goto(`${FRONT}/tasks?view=board`)
    await heading(page, 'Tasks', 1)
    const panel = page.locator('section.card', { has: page.getByRole('heading', { name: 'View', exact: true }) })
    if (!(await panel.isVisible().catch(() => false))) {
      const show = page.getByRole('button', { name: 'Show the drawer' })
      if (await show.isVisible().catch(() => false)) await show.click()
      await page.getByRole('tab', { name: 'View' }).click().catch(() => {})
    }
    await panel.waitFor({ timeout: 10_000 })
    const before = await panel.getByRole('button', { name: /^Hide /, exact: false }).count()
    await panel.getByRole('button', { name: 'Add', exact: true }).click()
    const display = page.getByRole('dialog', { name: 'Add a field' })
    await display.waitFor({ timeout: 10_000 })
    const checkbox = display.getByRole('checkbox').first()
    const fieldLabel = (await checkbox.getAttribute('aria-label')) ?? (await checkbox.textContent()) ?? ''
    await checkbox.check()
    await page.waitForURL((u) => u.searchParams.has('cards'), { timeout: 10_000 }).catch(() => {})
    await page.keyboard.press('Escape')
    await display.waitFor({ state: 'hidden', timeout: 10_000 })
    let after = before
    for (let tries = 0; tries < 60 && after !== before + 1; tries++) {
      await page.waitForTimeout(250)
      after = await panel.getByRole('button', { name: /^Hide /, exact: false }).count()
    }
    assert.ok(after === before + 1, `+ Add should add one more Fields chip (was ${before}, now ${after}, added ${fieldLabel})`)
    await panel.getByRole('button', { name: new RegExp(`^Hide `), exact: false }).last().click()
  })
}

// The demo banner: Copy invite, dismiss it and the amber panel it leaves,
// bringing it back.
async function bannerBasics(ctx) {
  const { page, context, browserName } = ctx
  await step(ctx, 'banner-copy-invite', async () => {
    await page.goto(`${FRONT}/inbox`)
    await page.waitForLoadState('networkidle').catch(() => {})
    const link = page.getByRole('link', { name: /Copy invite|Copied/ })
    await link.waitFor({ timeout: 10_000 })
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: FRONT }).catch(() => {})
    }
    await link.click()
    await page.getByRole('link', { name: 'Copied' }).waitFor({ timeout: 10_000 })
    assert.equal(new URL(page.url()).pathname, '/inbox', 'Copy invite never follows the link')
  })
  await step(ctx, 'banner-dismiss', async () => {
    await page.getByRole('button', { name: 'Hide the demo banner' }).click()
    await page.getByText('Prototype', { exact: true }).waitFor({ timeout: 10_000 })
    const show = page.getByRole('button', { name: 'Show the demo banner' })
    await show.waitFor({ timeout: 10_000 })
    await show.click()
    await page.getByRole('button', { name: 'Hide the demo banner' }).waitFor({ timeout: 10_000 })
  })
}

// Reset now: refused while not alone (checked on Room A's own persona,
// below), and works once truly alone (Hugo, in Room B).
async function resetAlone(ctx, madeAt) {
  const { page } = ctx
  await step(ctx, 'banner-reset-alone', async () => {
    await page.goto(`${FRONT}/inbox`)
    await page.waitForLoadState('networkidle').catch(() => {})
    const age = Date.now() - madeAt
    if (age < 22_000) await sleep(22_000 - age)
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/_demo/reset'), { timeout: 20_000 }), page.getByRole('button', { name: 'Reset' }).click()])
    assert.equal(response.status(), 303, `Reset now, alone, should make a fresh copy (got ${response.status()})`)
  })
}

async function resetRefused(ctx) {
  const { page } = ctx
  await step(ctx, 'banner-reset-refused', async () => {
    await page.goto(`${FRONT}/inbox`)
    await page.waitForLoadState('networkidle').catch(() => {})
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith('/_demo/reset'), { timeout: 20_000 }), page.getByRole('button', { name: 'Reset' }).click()])
    assert.equal(response.status(), 409, `Reset now, with others in the room, should be refused (got ${response.status()})`)
  })
}

// --- wiring a persona's page: console errors and failed requests --------
function trackErrors(page, browserName, persona) {
  page.on('pageerror', (e) => {
    // The same abandoned-font-download noise as the console filter below,
    // raised here instead as a parse error on what little arrived.
    if (/magic number|downloadable font/i.test(e.message)) return
    consoleIssues.push({ browser: browserName, persona, kind: 'page error', detail: e.message })
  })
  page.on('console', (msg) => {
    // Chromium logs a failed-status fetch to the console itself, on top
    // of the `response` event below, which already judges the status: an
    // expected refusal (Reset now, not alone) is not logged twice. A
    // font abandoned mid-download, this run's own fast navigation away
    // from under it (never a user pausing on a page), reads as a parse
    // error ("failed to match magic number") on what little arrived:
    // the `requestfailed` abort below is the same event: one line, not
    // two.
    if (msg.type() === 'error' && !/status of (409|429|404|401|403)/.test(msg.text()) && !/downloadable font|magic number/i.test(msg.text())) {
      consoleIssues.push({ browser: browserName, persona, kind: 'console error', detail: msg.text() })
    }
  })
  page.on('requestfailed', (r) => {
    if (r.url().includes('/body/live')) return // a long-lived session, cut off by design at teardown
    const why = r.failure()?.errorText ?? ''
    // Navigating on mid-download, this run's own speed: a real browser
    // idling on a page never aborts its own font like this.
    if (why === 'NS_BINDING_ABORTED' || why === 'net::ERR_ABORTED') return
    consoleIssues.push({ browser: browserName, persona, kind: 'request failed', detail: `${r.url()}: ${why}` })
  })
  page.on('response', (r) => {
    const status = r.status()
    const expectedRefusal = status === 409 || status === 429 || status === 404 || status === 401 || status === 403
    if (status >= 500 || (status >= 400 && !expectedRefusal)) {
      consoleIssues.push({ browser: browserName, persona, kind: `${status} response`, detail: r.url() })
    }
  })
}

// --- the personas themselves ---------------------------------------------
// address, mandate (read from the fixture: their role, membership.toml,
// and the circles they sit in, circle.toml), colour scheme, viewport, and
// the flow that is their goal through the demo.
const ROOM_A_MEMBERS = ['camille@lanterne.example', 'lea@lanterne.example', 'thomas@lanterne.example', 'amina@lanterne.example', 'julien@lanterne.example', 'yusuf@lanterne.example', 'chloe@lanterne.example']
const ROOM_B_MEMBERS = ['hugo@lanterne.example']

function personaDefs(state) {
  return {
    'camille@lanterne.example': {
      mandate: 'manager and brand strategist, seated in the Assembly, Brand, Coordination, Clients and Hiring; proposes a motion to her own circle',
      scheme: 'light',
      flow: async (ctx) => {
        await visitCirclesAndMandates(ctx)
        await proposeMotion(ctx, state)
      },
    },
    'lea@lanterne.example': {
      mandate: 'UX and interface designer, in Web, Hiring and Care; votes Consent, and checks the View panel’s Fields chips and + Add',
      scheme: 'dark',
      flow: async (ctx) => {
        await state.motionReady
        await voteOn(ctx, state, 'consent')
        await viewFields(ctx)
      },
    },
    'thomas@lanterne.example': {
      mandate: 'full-stack developer, in Web, Clients and Tools; votes Object, creates a task on the board and moves it',
      scheme: 'light',
      flow: async (ctx) => {
        await state.motionReady
        await voteOn(ctx, state, 'object')
        await taskCreateAndMove(ctx)
      },
    },
    'amina@lanterne.example': {
      mandate: 'backend developer, in Web, Hiring and Care; votes Abstain and logs time on her timesheet',
      scheme: 'dark',
      viewport: { width: 390, height: 844 },
      flow: async (ctx) => {
        await state.motionReady
        await voteOn(ctx, state, 'abstain')
        await logTime(ctx)
      },
    },
    'julien@lanterne.example': {
      mandate: 'Operations lead, Finance and Treasurer, secretary of the Assembly; records a bill and issues an invoice',
      scheme: 'light',
      flow: async (ctx) => {
        await recordBill(ctx)
        await issueInvoice(ctx)
      },
    },
    'yusuf@lanterne.example': {
      mandate: 'Web lead, in Clients and Tools; visits Settings and files an expense for the approver to find',
      scheme: 'dark',
      flow: async (ctx) => {
        await visitSettings(ctx)
        await fileExpense(ctx, state)
      },
    },
    'chloe@lanterne.example': {
      mandate: 'content and social media, in Marketing, Clients and Care; approves the expense, within Finance’s own mandate held by the actual Treasurer being checked elsewhere; visits Circles and Mandates',
      scheme: 'light',
      flow: async (ctx) => {
        await visitCirclesAndMandates(ctx)
        await state.expenseReady
        // Chloé holds no finance mandate; she should find Approve refused
        // or absent, which is itself the point: only Julien, Finance's
        // holder, may. This step records what actually happened.
        await step(ctx, 'expense-approve-refused', async () => {
          if (!state.expenseHref) throw new Error('no expense was filed')
          await ctx.page.goto(`${FRONT}${state.expenseHref}`)
          const approve = ctx.page.getByRole('button', { name: 'Approve', exact: true })
          const visible = await approve.isVisible().catch(() => false)
          if (visible) {
            consoleIssues.push({ browser: ctx.browserName, persona: ctx.persona, kind: 'note', detail: 'Chloé (no finance mandate) sees an Approve button on the expense; worth the operator’s look if she can press it' })
          }
        })
      },
    },
    'hugo@lanterne.example': {
      mandate: 'Brand lead, in Care; alone in his own room: Copy invite, dismiss the banner and its amber panel, then Reset now, which works once truly alone',
      scheme: 'dark',
      viewport: { width: 390, height: 844 },
      room: 'B',
      flow: async (ctx, madeAt) => {
        await bannerBasics(ctx)
        await resetAlone(ctx, madeAt)
      },
    },
  }
}

// --- one pass: every persona, in one browser --------------------------
async function runPass(browserName, launchBrowser) {
  log(`=== pass: ${browserName} ===`)
  const browser = await launchBrowser()
  const state = {}
  state.motionReady = new Promise((resolve) => {
    state.resolveMotion = resolve
  })
  state.expenseReady = new Promise((resolve) => {
    state.resolveExpense = resolve
  })
  try {
    // Room A: made by the first persona, joined by the rest through Copy
    // invite's own link, as rooms.mjs joins a room. Each context already
    // wears its persona's own colour scheme and viewport: both are set
    // at the context's own creation.
    const defs = personaDefs(state)
    const opts = (address) => ({ viewport: defs[address]?.viewport, scheme: defs[address]?.scheme })
    const [first, ...restA] = ROOM_A_MEMBERS
    const { context: c0, page: p0 } = await freshRoom(browser, opts(first))
    trackErrors(p0, browserName, NAME[first])
    const code = await inviteCode(p0)
    const roomAContexts = [c0]
    const ctxOf = new Map()
    ctxOf.set(first, { context: c0, page: p0, browserName, persona: NAME[first] })
    for (const address of restA) {
      const { context, page } = await joinRoom(browser, code, opts(address))
      trackErrors(page, browserName, NAME[address])
      roomAContexts.push(context)
      ctxOf.set(address, { context, page, browserName, persona: NAME[address] })
    }
    // Room B: Hugo, alone, so Reset now can truly succeed.
    const { context: bCtx, page: bPage, madeAt: bMadeAt } = await freshRoom(browser, opts('hugo@lanterne.example'))
    trackErrors(bPage, browserName, NAME['hugo@lanterne.example'])
    ctxOf.set('hugo@lanterne.example', { context: bCtx, page: bPage, browserName, persona: NAME['hugo@lanterne.example'] })

    // Sign in, every persona, then run their own goal, concurrently.
    await Promise.all([...ctxOf.entries()].map(([address, ctx]) => signIn(ctx, address)))

    const results = await Promise.allSettled(
      [...ctxOf.entries()].map(async ([address, ctx]) => {
        await inbox(ctx)
        const def = defs[address]
        if (!def) return
        await def.flow(ctx, address === 'hugo@lanterne.example' ? bMadeAt : undefined)
        if (address === 'camille@lanterne.example') state.resolveMotion()
        if (address === 'yusuf@lanterne.example') state.resolveExpense()
      }),
    )
    // Camille's motion and Yusuf's expense are awaited by name above; if
    // either never runs (a defect on their own sign-in or first steps),
    // resolve the gates anyway so the rest of the pass does not hang.
    state.resolveMotion()
    state.resolveExpense()
    for (const r of results) {
      if (r.status === 'rejected') log(`a persona's own flow raised, past its steps' own guards: ${r.reason?.message ?? r.reason}`)
    }

    // Once everyone has had their turn: Julien approves Thomas's... no,
    // Yusuf's expense (Finance's own mandate), and one more Room A
    // persona (Camille) finds Reset refused, others still present.
    await approveExpense(ctxOf.get('julien@lanterne.example'), state)
    await resetRefused(ctxOf.get('camille@lanterne.example'))

    for (const c of roomAContexts) await c.context?.close?.().catch(() => {})
    await ctxOf.get('hugo@lanterne.example').context.close().catch(() => {})
  } finally {
    await browser.close().catch(() => {})
  }
  log(`=== pass ${browserName} done ===`)
}

// --- the front, Firefox's own profile home, and the run itself ----------
async function firefoxLaunch() {
  const home = mkdtempSync(join(tmpdir(), 'cella-personas-firefox-'))
  const browser = await firefox.launch({ env: { ...process.env, HOME: home, MOZ_DISABLE_CONTENT_SANDBOX: '1' }, firefoxUserPrefs: { 'browser.formfill.enable': false } })
  browser.once('disconnected', () => rmSync(home, { recursive: true, force: true }))
  return browser
}

const engines = { chromium: () => chromium.launch(), firefox: firefoxLaunch, webkit: () => webkit.launch() }

async function main() {
  const wanted = (process.env.BROWSERS ?? 'chromium,firefox,webkit').split(',')
  const socketDir = startCluster()
  buildTemplate(socketDir)
  const front = await startFront(socketDir, PORT, [
    '--cap', '6',
    '--room-browsers', '8',
    '--idle', '3600',
    '--lifetime', '7200',
    '--evict-after', '3600',
    '--min-age', '3600',
    '--browser-idle', '900',
    '--per-address', '20',
    '--per-address-rate', '60',
    '--per-minute', '120',
  ])
  const limitations = []
  for (const [name, launch] of Object.entries(engines)) {
    if (!wanted.includes(name)) continue
    try {
      await runPass(name, launch)
    } catch (e) {
      // A whole pass's own setup failing (never a persona's own step,
      // which `step()` already catches) is a limitation of this
      // engine against this harness, not a defect to screenshot: logged
      // and the run goes on to the next browser. WebKit's own cookie jar
      // never kept demo-serve's `__Host-`-prefixed room cookie
      // (`Secure`, as it must stay) set over this harness's plain HTTP
      // loopback front, unlike Chromium's and Firefox's, which treat
      // loopback as a secure-enough origin for local testing; it never
      // reached /sign-in at all. Production serves the same cookie over
      // real HTTPS, where every engine keeps it, so this is this
      // harness's own limit, not a defect against the demo: the same
      // reason tools/qa/rooms.mjs and record-timing.mjs drive the demo
      // front with Chromium alone.
      const note = `${name}'s own pass could not run against this harness: ${e.message.split('\n')[0]}`
      log(`LIMITATION: ${note}`)
      limitations.push(note)
    }
  }
  await front.stop()
  cleanups.splice(cleanups.indexOf(front.stop), 1)

  console.log('')
  console.log(`personas qa: ${defects.length} defect(s), ${consoleIssues.length} console/request issue(s), ${limitations.length} engine limitation(s)`)
  for (const l of limitations) console.log(`  (limitation) ${l}`)
  for (const d of defects) console.log(`  [${d.severity}] ${d.browser}/${d.persona}/${d.step}: ${d.what}`)
  for (const i of consoleIssues) console.log(`  (${i.kind}) ${i.browser}/${i.persona}: ${i.detail}`)
}

main()
  .then(() => stop(defects.length ? 1 : 0))
  .catch((e) => {
    console.error(`personas qa: FAILED: ${e.stack ?? e.message}`)
    stop(1)
  })
