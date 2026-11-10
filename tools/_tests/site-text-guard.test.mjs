// The site's text guard (apps/site/index.md, whose words): every way an
// agent's tool call writes, moves, removes or redirects into
// apps/site/src/content/ is refused, naming the path, and so is a remove,
// move or restore of a directory holding it; a read of the text and a
// write anywhere else pass. The hook itself refuses by exit 2 with
// its reason on stderr, as Claude Code reads a PreToolUse hook.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { guard, reason } from '../site-text-guard.mjs'

const repo = new URL('../..', import.meta.url).pathname
const check = guard(repo)
const bash = (command, cwd = repo) => check({ tool_name: 'Bash', tool_input: { command }, cwd })
const tool = (tool_name, tool_input, cwd = repo) => check({ tool_name, tool_input, cwd })
const yaml = 'apps/site/src/content/site.toml'
const text = dirname(yaml)

test('a write into the text by a shell command is refused, naming the path', () => {
  const refused = [
    `echo hi > ${yaml}`,
    `echo hi >> ${yaml}`,
    `printf x >${yaml}`,
    `cat > ${yaml} <<'EOF'\ntitle: x\nEOF`,
    `ls 2> ${yaml}`,
    `echo x &> ${yaml}`,
    `sed -i 's/a/b/' ${yaml}`,
    `sed -Ei.bak 's/a/b/' ${yaml}`,
    `sed --in-place 's/a/b/' ${yaml}`,
    `perl -pi -e 's/a/b/' ${yaml}`,
    `echo x | tee ${yaml}`,
    `echo x | tee -a /tmp/a ${yaml}`,
    `mv /tmp/x ${yaml}`,
    `mv ${yaml} /tmp/x`,
    `cp /tmp/x ${yaml}`,
    `cp /tmp/x apps/site/src/content/`,
    `cp -t apps/site/src/content /tmp/x`,
    `rm ${yaml}`,
    `rm -rf apps/site/src/content`,
    `touch apps/site/src/content/sections/new.mdx`,
    `truncate -s 0 ${yaml}`,
    `git mv apps/site/src/content/sections/what.mdx apps/site/src/content/sections/that.mdx`,
    `git rm ${yaml}`,
    `git rm -- ${yaml}`,
    `git rm --cached -- ${yaml}`,
    `git checkout -- ${yaml}`,
    `git checkout main -- apps/site/src/content`,
    `git restore --source=HEAD~1 ${yaml}`,
    `git -C apps/site restore src/content/site.toml`,
    `find apps/site/src/content -name '*.mdx' -delete`,
    `find apps/site/src/content -name '*.mdx' -exec sed -i 's/a/b/' {} +`,
    `bash -c "echo x > ${yaml}"`,
    `sh -lc 'rm ${yaml}'`,
    `eval "echo x > ${yaml}"`,
    `nix develop -c sed -i s/a/b/ ${yaml}`,
    `env A=1 timeout 5 rm ${yaml}`,
    `sudo -u ixxie rm ${yaml}`,
    `true && echo x > ${yaml}`,
    `echo $(echo x > ${yaml})`,
    `D=apps/site/src/content; echo x > $D/site.toml`,
    `cd apps/site/src/content && echo x > site.toml`,
    `cd apps/site && sed -i s/a/b/ src/content/site.toml`,
    `dd if=/dev/zero of=${yaml} count=1`,
    `node -e "require('fs').writeFileSync('${yaml}', 'x')"`,
    `python3 -c "open('${yaml}', 'w').write('x')"`,
    `echo x > ${join(repo, yaml)}`,
  ]
  for (const command of refused) {
    const why = bash(command)
    assert.ok(why, `refused: ${command}`)
    assert.match(why, /apps\/site\/src\/content/, `names the path: ${command}`)
  }
})

test('from the text\'s own directory, a relative write is refused', () => {
  assert.ok(bash('echo x > site.toml', join(repo, 'apps/site/src/content')))
  assert.ok(bash('sed -i s/a/b/ src/content/site.toml', join(repo, 'apps/site')))
})

test('a read of the text and a write elsewhere pass', () => {
  const passed = [
    `cat ${yaml}`,
    `grep -rn title apps/site/src/content`,
    `git diff -- apps/site/src/content`,
    `git log --stat -- apps/site/src/content`,
    `head -n 5 ${yaml} > /tmp/head.txt`,
    `cp ${yaml} /tmp/site.toml`,
    `sed -n 1,5p ${yaml}`,
    `sed -i s/a/b/ apps/site/src/pages/index.astro`,
    `echo x > apps/site/src/components/new.astro`,
    `rm -rf apps/site/dist`,
    `mv /tmp/a /tmp/b`,
    `find apps/site/src/content -name '*.mdx' -exec grep -l title {} +`,
    `node -e "console.log(require('fs').readFileSync('${yaml}', 'utf8'))"`,
    `git checkout main`,
    `git restore apps/site/src/pages/index.astro`,
    `ls 2>&1 | tee /tmp/out.txt`,
    `cat <<'EOF' > /tmp/note.md\nrm ${yaml}\nEOF`,
    `echo "apps/site/src/content is the operator's" > /tmp/note.md`,
    `cella site build`,
  ]
  for (const command of passed) assert.equal(bash(command), null, `passes: ${command}`)
})

test('a call that names the text and writes nothing there passes', () => {
  const passed = [
    `corpus message send plan "the guard refused a mention of ${text}; it passes now" --about stream/x`,
    `git commit -m "doc(site): say who writes ${text}"`,
    `git commit -m 'echo x > ${yaml}'`,
    `grep -r title ${text}`,
    `grep -rn "${text}" tools`,
    `cat ${text}/sections/what.mdx`,
    `ls ${text}`,
    `rg -l Diagram ${text}/sections`,
    `echo '${text}' | wc -c`,
  ]
  for (const command of passed) assert.equal(bash(command), null, `passes: ${command}`)
})

test('the reviewer\'s four commands, which change a directory holding the text, are refused', () => {
  assert.match(bash('rm -rf apps/site'), /rm -r removes apps\/site, which holds apps\/site\/src\/content/)
  assert.match(bash('mv apps/site /tmp/site'), /mv moves apps\/site, which holds/)
  assert.equal(bash('git restore .'), `git restore overwrites ${repo.replace(/\/$/, '')}, which holds ${text}`)
  assert.match(bash('git clean -fd apps/site'), /git clean removes apps\/site, which holds/)
})

test('a remove, move or restore of a directory holding the text is refused, by any spelling', () => {
  const refused = [
    'rm -r apps',
    'rm -R apps/site/src',
    'rm --recursive -f apps/site/',
    'rm -fr .',
    'rm -rf ./apps//site',
    `rm -rf ${repo}`,
    'rm -rf *',
    'rm -rf apps/s*',
    'rm -rf apps/site/src/con[tx]ent',
    'cd apps && rm -rf site',
    'cd apps/site/src && rm -rf ..',
    'rmdir apps/site/src/content',
    'rmdir apps/site',
    'mv apps /tmp/apps',
    'mv -t /tmp apps/site/src',
    'mv /tmp/content apps/site/src',
    'mv /tmp/content -t apps/site/src',
    'mv -T /tmp/site apps/site',
    'cp -r /tmp/src apps/site',
    'git mv apps/site apps/web',
    'git rm -r apps/site',
    'git rm -rf --cached .',
    'git rm -r -- apps/site',
    'git rm -rf -- .',
    'git rm -r --cached -- apps',
    'find apps/site -name "*.mdx" -delete',
    'find . -name "*.bak" -delete',
    'find apps -type f -exec rm {} +',
    'find apps/site -name "*.mdx" -exec sed -i s/a/b/ {} +',
    'rsync -a --delete /tmp/site/ apps/site/',
    'rsync -a --delete-after /tmp/src/ apps/site/src',
    'git restore apps/site',
    'git restore -s HEAD~1 -- apps',
    'git restore :/',
    'git restore ":(top)apps/site"',
    'git restore "apps/*"',
    'git restore "*.toml"',
    'git restore -SW .',
    'git checkout .',
    'git checkout -- .',
    'git checkout HEAD~1 -- apps/site',
    'git checkout main -- :/',
    'git clean -fd',
    'git clean -fdx .',
    'git clean -fd :/',
    'git -C apps/site clean -fd',
    'git -C apps/site restore ..',
    'cd apps/site && git clean -fdx',
    'cd apps/site/src && git restore ..',
    'sh -c "rm -rf apps/site"',
  ]
  for (const command of refused) {
    const why = bash(command)
    assert.ok(why, `refused: ${command}`)
    assert.match(why, /apps\/site\/src\/content/, `names the text: ${command}`)
  }
})

test('the same commands on a directory beside the text, and a branch switched to, pass', () => {
  const passed = [
    'rm -rf apps/org/dist',
    'rm -rf apps/site/dist apps/site/node_modules',
    'rm -r apps/site/src/pages/old',
    'rm apps',
    'rmdir apps/site/src/empty',
    'mv apps/site/dist /tmp/dist',
    'mv /tmp/x apps/site',
    'mv /tmp/x apps/site/src/pages/',
    'cp -r /tmp/assets apps/site/public',
    'cp -r apps/site /tmp/site',
    'rsync -a /tmp/site/ apps/site/',
    'rsync -a --delete apps/site/ /tmp/site/',
    'rsync -a --delete /tmp/dist/ apps/site/dist/',
    'find . -name "*.md"',
    'find apps/site -name "*.mdx" -exec grep -l title {} +',
    'find apps/org -name "*.log" -delete',
    'git restore apps/org',
    'git restore --staged .',
    'git restore ":!apps/site"',
    'git restore "apps/org/*"',
    'git checkout main',
    'git checkout -b feature origin/main',
    'git checkout -B 26-11-07-x origin/26-11-07-x',
    'git checkout HEAD~1 -- apps/org',
    'git rm -- apps/org/x',
    'git rm -r -- apps/org',
    'git rm -rf -- apps/site/dist',
    'git switch main',
    'git switch -c feature',
    'git clean -fd apps/org',
    'git clean -n',
    'git clean --dry-run -d .',
    'git -C apps/org clean -fdx',
    'cd apps/org && git clean -fdx',
    'git -C /tmp restore .',
    'git -C /tmp clean -fdx',
    'git stash list',
    'git stash pop',
    'git reset --soft HEAD~1',
    'git reset HEAD apps/site',
    'git add .',
    'git status -- apps/site',
    'git diff .',
    'ls apps/site',
    'corpus message send plan "rm -rf apps/site and git restore . pass now"',
    'git commit -m "guard(site): refuse rm -rf apps/site and git clean"',
  ]
  for (const command of passed) assert.equal(bash(command), null, `passes: ${command}`)
})

test('git reset --hard, git stash and a forced checkout or switch are refused while the text has changes git has not committed', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-repo-'))
  const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  git('init', '-q')
  mkdirSync(join(root, text), { recursive: true })
  mkdirSync(join(root, 'apps/org'), { recursive: true })
  writeFileSync(join(root, yaml), 'title: x\n')
  writeFileSync(join(root, 'apps/org/a.ts'), 'x\n')
  git('add', '.')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init')
  const run = (command, cwd = root) => guard(root)({ tool_name: 'Bash', tool_input: { command }, cwd })
  const forms = ['git reset --hard', 'git reset --hard HEAD~1', 'git stash', 'git stash -u', 'git stash push', 'git stash save wip', 'git stash push -m wip', 'git stash push -- apps/site', 'git -C apps/org stash',
    'git checkout -f main', 'git checkout --force main', 'git checkout -qf main', 'git checkout -f', 'git -C apps/org checkout -f main',
    'git switch -f main', 'git switch --force main', 'git switch --discard-changes main', 'git switch -c fix --discard-changes']

  writeFileSync(join(root, 'apps/org/a.ts'), 'y\n')
  for (const command of forms) assert.equal(run(command), null, `passes while the text is committed: ${command}`)

  writeFileSync(join(root, yaml), 'title: y\n')
  for (const command of forms) {
    const why = run(command)
    assert.ok(why, `refused while the text has changes: ${command}`)
    assert.match(why, /the changes git has not committed in apps\/site\/src\/content/)
  }
  assert.equal(run('git stash push -- apps/org'), null)
  assert.equal(run('git stash push apps/org'), null)
  assert.equal(run('git stash list'), null)
  assert.equal(run('git checkout main'), null)
  assert.equal(run('git checkout -b fix'), null)
  assert.equal(run('git switch main'), null)
  assert.equal(run('git switch -c fix'), null)
  assert.equal(run('git checkout -f main', tmpdir()), null)
  assert.equal(run('git reset --hard', tmpdir()), null)
})

test('the hook\'s wrapper runs the guard with a node, and with none refuses only an edit tool\'s write', (t) => {
  const wrapper = join(repo, 'tools/site-text-guard.sh')
  const empty = mkdtempSync(join(tmpdir(), 'guard-'))
  const call = (input, PATH) =>
    spawnSync('/bin/sh', [wrapper], { input: JSON.stringify(input), encoding: 'utf8', env: { PATH, HOME: empty, USER: 'nobody' } })
  const write = { tool_name: 'Write', tool_input: { file_path: join(repo, yaml), content: 'x' }, cwd: repo }
  const shellWrite = { tool_name: 'Bash', tool_input: { command: `echo x > ${yaml}` }, cwd: repo }
  const mention = { tool_name: 'Bash', tool_input: { command: `grep -r title ${text}` }, cwd: repo }

  const withNode = dirname(process.execPath)
  assert.equal(call(write, withNode).status, 2)
  assert.equal(call(shellWrite, withNode).status, 2)
  assert.equal(call(mention, withNode).status, 0)

  if (existsSync('/run/current-system/sw/bin/node')) return t.skip('this system keeps a node where the wrapper looks')
  const refused = call(write, empty)
  assert.equal(refused.status, 2)
  assert.match(refused.stderr, /operator's/)
  assert.ok(refused.stderr.includes(`Write writes ${join(repo, yaml)}`))
  assert.equal(call({ ...write, tool_name: 'Edit', tool_input: { file_path: yaml, old_string: 'a', new_string: 'b' } }, empty).status, 2)
  assert.equal(call({ tool_name: 'NotebookEdit', tool_input: { notebook_path: join(repo, text, 'x.ipynb') } }, empty).status, 2)
  assert.equal(call({ ...write, tool_input: { file_path: join(repo, 'apps/site/src/pages/index.astro'), content: 'x' } }, empty).status, 0)
  assert.equal(call(shellWrite, empty).status, 0)
  assert.equal(call(mention, empty).status, 0)
  assert.equal(spawnSync('/bin/sh', [wrapper], { input: 'not json', encoding: 'utf8', env: { PATH: empty } }).status, 0)
})

test('an Edit, Write or NotebookEdit of the text is refused, and of anything else passes', () => {
  assert.match(tool('Edit', { file_path: join(repo, yaml), old_string: 'a', new_string: 'b' }), /Edit writes apps\/site\/src\/content\/site\.toml/)
  assert.match(tool('Write', { file_path: join(repo, 'apps/site/src/content/sections/new.mdx'), content: 'x' }), /Write writes/)
  assert.ok(tool('Write', { file_path: yaml, content: 'x' }))
  assert.ok(tool('NotebookEdit', { notebook_path: join(repo, 'apps/site/src/content/x.ipynb'), new_source: 'x' }))
  assert.equal(tool('Edit', { file_path: join(repo, 'apps/site/src/pages/index.astro'), old_string: 'a', new_string: 'b' }), null)
  assert.equal(tool('Read', { file_path: join(repo, yaml) }), null)
})

test('the hook refuses by exit 2, its reason on stderr, and lets the rest through', () => {
  const hook = join(repo, 'tools/site-text-guard.mjs')
  const call = (input) => spawnSync(process.execPath, [hook], { input: JSON.stringify(input), encoding: 'utf8' })
  const refused = call({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `sed -i s/a/b/ ${yaml}` }, cwd: repo })
  assert.equal(refused.status, 2)
  assert.match(refused.stderr, /operator's/)
  assert.match(refused.stderr, /apps\/site\/src\/content\/site\.toml/)
  assert.equal(refused.stderr.trim(), reason(`sed -i edits ${yaml}`))
  const passed = call({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `cat ${yaml}` }, cwd: repo })
  assert.equal(passed.status, 0)
  assert.equal(passed.stderr, '')
  const malformed = spawnSync(process.execPath, [hook], { input: 'not json', encoding: 'utf8' })
  assert.equal(malformed.status, 0)
})

test('the settings deny the edit tools on the text and wire the hook', () => {
  const settings = JSON.parse(readFileSync(join(repo, '.claude/settings.json'), 'utf8'))
  for (const t of ['Edit', 'Write', 'NotebookEdit']) assert.ok(settings.permissions.deny.includes(`${t}(apps/site/src/content/**)`), t)
  const [entry] = settings.hooks.PreToolUse
  for (const t of ['Bash', 'Edit', 'Write', 'NotebookEdit']) assert.match(entry.matcher, new RegExp(`\\b${t}\\b`))
  assert.match(entry.hooks[0].command, /tools\/site-text-guard\.sh/)
})
