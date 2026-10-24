// The feat's public writes, POST /api/transaction/<op> once the server
// exists. `record` and the write specs let a graft post an entry inside its
// own write's transaction.
export { adjust, adjusting, pay, paying, payroll, post, posting, record, running } from '../handlers/index.ts'
