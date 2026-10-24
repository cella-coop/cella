// The feat's public writes, POST /api/transaction/<op> once the server
// exists. `record` and the write specs let a graft post an entry inside its
// own write's transaction.
export { adjust, adjusting, pay, paying, post, posting, record } from '../handlers/index.ts'
