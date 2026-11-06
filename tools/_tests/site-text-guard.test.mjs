// The site's text guard (apps/site/index.md, whose words): every way an
// agent's tool call writes, moves, removes or redirects into
// apps/site/src/content/ is refused, naming the path; a read of the text
// and a write anywhere else pass. The hook itself refuses by exit 2 with
// its reason on stderr, as Claude Code reads a PreToolUse hook.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { guard, reason } from '../site-text-guard.mjs'

const repo = new URL('../..', import.meta.url).pathname
const check = guard(repo)
const bash = (command, cwd = repo) => check({ tool_name: 'Bash', tool_input: { command }, cwd })
const tool = (tool_name, tool_input, cwd = repo) => check({ tool_name, tool_input, cwd })
const yaml = 'apps/site/src/content/site.yaml'

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
    `git checkout -- ${yaml}`,
    `git checkout main -- apps/site/src/content`,
    `git restore --source=HEAD~1 ${yaml}`,
    `git -C apps/site restore src/content/site.yaml`,
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
    `D=apps/site/src/content; echo x > $D/site.yaml`,
    `cd apps/site/src/content && echo x > site.yaml`,
    `cd apps/site && sed -i s/a/b/ src/content/site.yaml`,
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
  assert.ok(bash('echo x > site.yaml', join(repo, 'apps/site/src/content')))
  assert.ok(bash('sed -i s/a/b/ src/content/site.yaml', join(repo, 'apps/site')))
})

test('a read of the text and a write elsewhere pass', () => {
  const passed = [
    `cat ${yaml}`,
    `grep -rn title apps/site/src/content`,
    `git diff -- apps/site/src/content`,
    `git log --stat -- apps/site/src/content`,
    `head -n 5 ${yaml} > /tmp/head.txt`,
    `cp ${yaml} /tmp/site.yaml`,
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

test('an Edit, Write or NotebookEdit of the text is refused, and of anything else passes', () => {
  assert.match(tool('Edit', { file_path: join(repo, yaml), old_string: 'a', new_string: 'b' }), /Edit writes apps\/site\/src\/content\/site\.yaml/)
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
  assert.match(refused.stderr, /apps\/site\/src\/content\/site\.yaml/)
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
  assert.match(entry.hooks[0].command, /tools\/site-text-guard\.mjs/)
})
