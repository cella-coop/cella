// A TEST-ONLY crash point, which a scenario alone loads into the built
// shell (`node --import`), never `cella serve`: named an op by
// `CELLA_E2E_CRASH`, the server kills itself the moment the notary
// answers that op's entry, `cella.submit`'s for a decision or
// `cella.follow`'s for an effect, before the write goes on to what
// follows it. Its transaction is left open on a dead connection, as a
// server killed mid-write leaves one.

import pg from 'pg'

const op = process.env.CELLA_E2E_CRASH

if (op) {
  const query = pg.Client.prototype.query as (...args: unknown[]) => unknown
  pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
    const out = query.apply(this, args)
    const [text, values] = args
    if (typeof text === 'string' && /cella\.(submit|follow)\(/.test(text) && Array.isArray(values) && values[0] === op && out instanceof Promise) {
      return out.then(() => {
        process.kill(process.pid, 'SIGKILL')
        return new Promise(() => {})
      })
    }
    return out
  } as typeof pg.Client.prototype.query
}
