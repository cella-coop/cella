// The site's text guard (apps/site/index.md, whose words): a Claude Code
// PreToolUse hook, wired in .claude/settings.json, that refuses an agent's
// write to apps/site/src/content/**, the operator's text. It reads the
// tool call on stdin and refuses, by exit 2 and its reason on stderr, an
// Edit, Write or NotebookEdit of a file there, and a shell command that
// writes, moves, removes or redirects into one: a redirect, sed -i or
// perl -i, tee, mv, cp, rm, touch and their kin, git mv, rm, checkout or
// restore, find's -delete or a writer it execs, a sh -c or eval of any
// of these, and an inline script naming the path that writes a file.
// It refuses a write and nothing else: a read passes, and so does a call
// that names the path without writing there, a search, a commit message
// or a message sent through corpus among them, and every write elsewhere.
// It reads the shell as a lexer does, not as the shell runs it: a command
// that builds the path at run time goes past it, which the doc says.
// tools/site-text-guard.sh finds the node it runs on, and stands in for
// it where there is none.
//
//   node tools/site-text-guard.mjs < <hook input>

import { readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TEXT = 'apps/site/src/content'
// The path named in a word, wherever the command runs from.
const NAMED = /(^|\/)apps\/site\/src\/content(\/|$)/

// Operators, longest first; a redirect writes its target, an input reads it.
const OPS = ['&>>', '<<<', '<<-', '&>', '>>', '>|', '>&', '<&', '<<', '&&', '||', ';;', '|&', ';', '|', '&', '(', ')', '>', '<']
const WRITES = new Set(['>', '>>', '>|', '&>', '&>>', '>&'])
const READS = new Set(['<', '<<', '<<-', '<<<', '<&'])
// Words that separate simple commands.
const BREAKS = new Set([';', ';;', '&&', '||', '|', '|&', '&', '(', ')'])
// Words before a command that are not it.
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', '}', 'time'])
// Commands that run the rest of their words as a command, with the
// options each takes a value for.
const WRAPPERS = {
  sudo: ['-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-U'],
  doas: ['-u', '-C'],
  env: ['-u', '-C', '-S'],
  nice: ['-n'],
  timeout: ['-s', '-k'],
  xargs: ['-a', '-d', '-E', '-I', '-L', '-n', '-P', '-s'],
  command: [],
  builtin: [],
  exec: ['-a'],
  nohup: [],
  stdbuf: ['-i', '-o', '-e'],
}
// Commands each of whose operands it writes, moves or removes.
const EVERY = new Set(['rm', 'rmdir', 'unlink', 'shred', 'touch', 'truncate', 'mkdir', 'mv', 'tee'])
// Commands that write their last operand, or the directory -t names.
const LAST = new Set(['cp', 'install', 'ln', 'rsync', 'scp'])
// Commands that edit a file in place under -i.
const IN_PLACE = new Set(['sed', 'gsed', 'perl', 'ruby'])
// The tools that write a file by its path.
const EDITS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])
// Shells that run the script their -c hands them.
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish'])
// Interpreters and the options that hand them a script inline.
const INLINE = {
  node: ['-e', '--eval', '-p', '--print'],
  bun: ['-e', '--eval', '-p', '--print'],
  deno: ['eval'],
  python: ['-c'],
  python3: ['-c'],
  perl: ['-e', '-E'],
  ruby: ['-e'],
}
// What an inline script calls to write a file.
const WRITER = /writeFile|appendFile|createWriteStream|copyFile|cpSync|rename|unlink|rmSync|rmdir|truncate|write_text|write_bytes|shutil\.|os\.remove|open\([^)]*['"][wax+]/

/** Splits a shell script into words and operators, `{ t, v }`, with the
 * scripts of its `$(…)` and backticks apart, and its heredocs' bodies
 * dropped. */
export function lex(src) {
  const tokens = []
  const nested = []
  const heredocs = []
  let word = null
  let tag = null
  let i = 0
  const push = () => {
    if (word === null) return
    if (tag) heredocs.push({ end: word, strip: tag.strip })
    else tokens.push({ t: 'word', v: word })
    tag = null
    word = null
  }
  const add = (s) => (word = (word ?? '') + s)
  // The script of a `$(` at `from`, to its matching `)`.
  const balanced = (from) => {
    let depth = 1
    let j = from
    for (; j < src.length && depth; j++) {
      if (src[j] === '\\') j++
      else if (src[j] === "'") j = Math.max(j, src.indexOf("'", j + 1))
      else if (src[j] === '(') depth++
      else if (src[j] === ')') depth--
    }
    nested.push(src.slice(from, j - 1))
    return j
  }
  const backtick = (from) => {
    const j = src.indexOf('`', from)
    const end = j < 0 ? src.length : j
    nested.push(src.slice(from, end))
    return end + 1
  }
  while (i < src.length) {
    const c = src[i]
    if (c === '\n') {
      push()
      tokens.push({ t: 'op', v: ';' })
      i++
      for (const { end, strip } of heredocs.splice(0)) {
        while (i < src.length) {
          const nl = src.indexOf('\n', i)
          const line = src.slice(i, nl < 0 ? src.length : nl)
          i = nl < 0 ? src.length : nl + 1
          if ((strip ? line.replace(/^\t+/, '') : line) === end) break
        }
      }
    } else if (c === ' ' || c === '\t') {
      push()
      i++
    } else if (c === '#' && word === null) {
      while (i < src.length && src[i] !== '\n') i++
    } else if (c === "'") {
      const j = src.indexOf("'", i + 1)
      add(src.slice(i + 1, j < 0 ? src.length : j))
      i = j < 0 ? src.length : j + 1
    } else if (c === '"') {
      add('')
      i++
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && '"\\$`\n'.includes(src[i + 1])) {
          if (src[i + 1] !== '\n') add(src[i + 1])
          i += 2
        } else if (src[i] === '$' && src[i + 1] === '(') {
          i = balanced(i + 2)
          add('$(…)')
        } else if (src[i] === '`') {
          i = backtick(i + 1)
          add('$(…)')
        } else add(src[i++])
      }
      i++
    } else if (c === '\\') {
      if (src[i + 1] !== '\n') add(src[i + 1] ?? '')
      i += 2
    } else if (c === '$' && src[i + 1] === '(') {
      i = balanced(i + 2)
      add('$(…)')
    } else if (c === '`') {
      i = backtick(i + 1)
      add('$(…)')
    } else {
      const op = OPS.find((o) => src.startsWith(o, i))
      if (!op) {
        add(c)
        i++
        continue
      }
      // A descriptor before a redirect is part of it: 2>, 1>>.
      if ((op[0] === '>' || op[0] === '<') && word !== null && /^\d+$/.test(word)) word = null
      push()
      i += op.length
      if (op === '<<' || op === '<<-') tag = { strip: op === '<<-' }
      else tokens.push({ t: 'op', v: op })
    }
  }
  push()
  return { tokens, nested }
}

/** The lexed script's simple commands, `{ words, writes }`, in order: its
 * words, and the targets its redirects write. */
function commands(tokens) {
  const out = []
  let cur = { words: [], writes: [] }
  for (let k = 0; k < tokens.length; k++) {
    const { t, v } = tokens[k]
    if (t === 'word') cur.words.push(v)
    else if (WRITES.has(v) || READS.has(v)) {
      if (tokens[k + 1]?.t === 'word') {
        k++
        if (WRITES.has(v)) cur.writes.push(tokens[k].v)
      }
    } else if (BREAKS.has(v)) {
      out.push(cur)
      cur = { words: [], writes: [] }
    }
  }
  out.push(cur)
  return out.filter((c) => c.words.length || c.writes.length)
}

/** The guard over one repository, its text under `root`'s apps/site/src/content. */
export function guard(root = REPO) {
  const real = (p) => {
    // The nearest existing ancestor's real path, the rest appended.
    for (let at = p, rest = ''; ; rest = join(basename(at), rest), at = dirname(at)) {
      try {
        return join(realpathSync(at), rest)
      } catch {
        if (dirname(at) === at) return p
      }
    }
  }
  const text = real(join(root, TEXT))
  const inside = (p) => p === text || p.startsWith(text + sep)

  /** The path of the text a word names, from `cwd`, or null. */
  const names = (word, cwd) => {
    if (!word || (word.startsWith('-') && !word.includes('/'))) return null
    const p = real(resolve(cwd, word))
    if (inside(p)) return relative(real(root), p) || TEXT
    if (NAMED.test(word.replace(/\/+/g, '/'))) return word
    return null
  }

  /** Why a shell script writes the text, or null. */
  const shell = (src, state) => {
    const { tokens, nested } = lex(src)
    for (const n of nested) {
      const why = shell(n, { ...state })
      if (why) return why
    }
    for (const cmd of commands(tokens)) {
      const why = simple(cmd, state)
      if (why) return why
    }
    return null
  }

  const expand = (word, vars) =>
    word
      .replace(/^~(?=\/|$)/, homedir())
      .replace(/\$\{(\w+)\}|\$(\w+)/g, (m, a, b) => vars[a ?? b] ?? m)

  /** Why one simple command writes the text, or null; a `cd` moves `state`. */
  const simple = ({ words: raw, writes }, state) => {
    let words = raw.map((w) => expand(w, state.vars))
    for (const target of writes) {
      const hit = names(expand(target, state.vars), state.cwd)
      if (hit) return `a redirect writes ${hit}`
    }
    while (words.length && (KEYWORDS.has(words[0]) || /^\w+=/.test(words[0]))) {
      const [, name, value] = words[0].match(/^(\w+)=(.*)$/s) ?? []
      if (name) state.vars[name] = value
      words = words.slice(1)
    }
    return run(words, state)
  }

  /** Why the command `words` writes the text, or null. */
  const run = (words, state) => {
    if (!words.length) return null
    const [head, ...args] = words
    const cmd = basename(head)
    const operands = args.filter((a) => !a.startsWith('-') || a === '-')
    const any = (list, verb) => {
      for (const a of list) {
        const hit = names(a, state.cwd)
        if (hit) return `${verb} ${hit}`
      }
      return null
    }

    if (cmd in WRAPPERS) {
      let k = 0
      while (k < args.length) {
        if (WRAPPERS[cmd].includes(args[k])) k += 2
        else if (args[k].startsWith('-') || (cmd === 'env' && /^\w+=/.test(args[k]))) k++
        else break
      }
      // timeout's duration comes before its command.
      if (cmd === 'timeout') k++
      return run(args.slice(k), state)
    }
    if (cmd === 'nix') {
      const k = args.findIndex((a) => a === '-c' || a === '--command')
      return k < 0 ? null : run(args.slice(k + 1), state)
    }
    if (cmd === 'cd' || cmd === 'pushd') {
      const to = operands[0]
      if (to !== '-') state.cwd = to ? resolve(state.cwd, to) : homedir()
      return null
    }
    if (cmd === 'eval') return shell(args.join(' '), state)
    if (SHELLS.has(cmd)) {
      const k = args.findIndex((a) => /^-[a-z]*c[a-z]*$/.test(a))
      return k < 0 || args[k + 1] === undefined ? null : shell(args[k + 1], { ...state })
    }
    if (cmd === 'git') {
      let k = 0
      let cwd = state.cwd
      for (; k < args.length && args[k].startsWith('-'); k++) {
        if (args[k] === '-C') cwd = resolve(cwd, args[++k] ?? '.')
        else if (['-c', '--git-dir', '--work-tree', '--namespace'].includes(args[k])) k++
      }
      const sub = args[k]
      if (!['mv', 'rm', 'checkout', 'restore', 'clean'].includes(sub)) return null
      const paths = args.slice(k + 1).filter((a) => !a.startsWith('-'))
      return any(paths.map((a) => resolve(cwd, a)), `git ${sub}`)
    }
    if (cmd === 'find') {
      const starts = []
      for (const a of args) {
        if (a.startsWith('-') || a === '!' || a === '(') break
        starts.push(a)
      }
      const hits = starts.filter((s) => names(s, state.cwd))
      if (!hits.length) return null
      if (args.includes('-delete')) return `find -delete removes ${names(hits[0], state.cwd)}`
      for (let k = 0; k < args.length; k++) {
        if (!['-exec', '-execdir', '-ok', '-okdir'].includes(args[k])) continue
        const end = args.findIndex((a, j) => j > k && (a === ';' || a === '+'))
        const exec = args.slice(k + 1, end < 0 ? args.length : end)
        for (const hit of hits) {
          const why = run(exec.map((a) => a.replaceAll('{}', hit)), { ...state })
          if (why) return `find -exec: ${why}`
        }
      }
      return null
    }
    if (IN_PLACE.has(cmd) && args.some((a) => a === '--in-place' || a.startsWith('--in-place=') || /^-[a-zA-Z]*i/.test(a))) {
      return any(operands, `${cmd} -i edits`)
    }
    if (cmd in INLINE) {
      const k = args.findIndex((a) => INLINE[cmd].includes(a) || /^-[a-zA-Z]*[ec]$/.test(a))
      const script = k < 0 ? null : args[k + 1]
      if (script && script.includes(TEXT) && WRITER.test(script)) return `an inline ${cmd} script writes ${TEXT}`
      return null
    }
    if (EVERY.has(cmd)) return any(operands, `${cmd} changes`)
    if (LAST.has(cmd)) {
      const t = args.findIndex((a) => a === '-t' || a === '--target-directory')
      const eq = args.find((a) => a.startsWith('--target-directory='))
      const dest = eq ? eq.slice(eq.indexOf('=') + 1) : t >= 0 ? args[t + 1] : operands.length >= 2 ? operands.at(-1) : null
      return dest ? any([dest], `${cmd} writes`) : null
    }
    if (cmd === 'dd') {
      const of = args.find((a) => a.startsWith('of='))
      return of ? any([of.slice(3)], 'dd writes') : null
    }
    return null
  }

  /** Why a tool call writes the text, or null. */
  return (call) => {
    const input = call.tool_input ?? {}
    const cwd = call.cwd ?? process.cwd()
    if (call.tool_name === 'Bash') return input.command ? shell(input.command, { cwd, vars: {} }) : null
    if (!EDITS.has(call.tool_name)) return null
    const file = input.file_path ?? input.notebook_path
    if (!file) return null
    const hit = names(isAbsolute(file) ? file : resolve(cwd, file), cwd)
    return hit ? `${call.tool_name} writes ${hit}` : null
  }
}

/** The refusal an agent reads, saying what would fix it. */
export const reason = (why) =>
  `The site's text is the operator's, and no agent writes it: ${why}. ` +
  'Change the site\'s structure or its components instead, and say in your entry\'s Flag what its text needs; ' +
  'the operator writes it (AGENTS.md; apps/site/index.md, whose words).'

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let call
  try {
    call = JSON.parse(readFileSync(0, 'utf8'))
  } catch {
    process.exit(0)
  }
  const why = guard()(call)
  if (why) {
    console.error(reason(why))
    process.exit(2)
  }
}
