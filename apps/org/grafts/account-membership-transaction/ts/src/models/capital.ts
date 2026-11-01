// What an associate pays in on their subscription from the bank, in cents.
export interface Pay {
  member: string
  cents: number
}

export interface Paid {
  member: string
  amount: number
  entry: string
}

// A departed associate's repayment, by its number.
export interface Repay {
  member: string
  n: number
}

export interface Repaid extends Repay {
  amount: number
  entry: string | null
}

// A payment in on a subscription, as a member's page lists it: from the
// bank, or withheld from their pay.
export interface Payment {
  id: string
  entry: string
  date: string
  amount: number
  via: 'bank' | 'pay'
}

// A repayment of a departed associate's capital, due or paid.
export interface Repayment {
  id: string
  n: number
  due: string
  amount: number
  entry: string | null
  paid: string | null
}

// A member's capital paid in and out, as their page shows it: what their
// subscription cost, what they paid of it and what is left, what their
// exit cancelled; and, once they left, what they are owed, repaid and
// still to repay, with the repayment that comes next.
export interface Called {
  subscribed: number | null
  paid: number
  unpaid: number
  cancelled: number
  owed: number
  repaid: number
  left: number
  next: number | null
  payments: Payment[]
  repayments: Repayment[]
}

// A member admitted subscribing their shares, citing the motion that
// admitted them.
export interface Subscribe {
  member: string
  motion: string
}

export interface Subscribed {
  member: string
  account: string
  shares: number
  amount: number
  entry: string
}

// A departed associate's capital withdrawn, citing the motion that ended
// their membership.
export interface Withdraw {
  member: string
  motion: string
}

// What a withdrawal moved to 4567, what it cancelled of the subscription,
// in cents, and the repayments it drew up.
export interface Withdrawn {
  member: string
  owed: number
  cancelled: number
  repayments: number
  entry: string
}
