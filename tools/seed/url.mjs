// A libpq connection URL's parts, as node-pg's client takes them and as
// the PG* variables name them: its user, password, host, port and
// database, its `host` parameter a socket's directory where it names one,
// as `postgresql://postgres@/scope?host=/run/postgresql` does. WHATWG's
// URL refuses such a URL, with a user and no host.
export function parts(url) {
  const m = /^postgres(?:ql)?:\/\/(?:([^:@/]*)(?::([^@/]*))?@)?([^/?]*)(?:\/([^?]*))?(?:\?(.*))?$/.exec(url)
  if (!m) {
    throw new Error(`${url.replace(/:[^:@/]*@/, ':…@')} is no postgresql:// URL`)
  }
  const [, user, password, at, database, query] = m
  const params = new URLSearchParams(query ?? '')
  const [hostname, port] = at.startsWith('[') ? [at.slice(1, at.indexOf(']')), at.split(']:')[1]] : at.split(':')
  const given = (v) => (v ? decodeURIComponent(v) : undefined)
  return {
    user: given(user) ?? params.get('user') ?? undefined,
    password: given(password) ?? params.get('password') ?? undefined,
    host: params.get('host') ?? given(hostname),
    port: Number(port ?? params.get('port')) || undefined,
    database: given(database) ?? params.get('dbname') ?? undefined,
  }
}
