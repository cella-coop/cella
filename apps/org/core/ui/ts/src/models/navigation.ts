// A navigation the page starts and the next one abandons: SvelteKit
// rejects one another navigation overtakes as aborted or cancelled, and
// the browser aborts the fetch of one the page unloads under, as
// Firefox does when a scenario's next `page.goto` leaves it. Nobody
// waits on either, so the page lets go of them where it starts the
// navigation, `goto(to).catch(abandon)`, and raises any other failure.
export const abandoned = (e: unknown): boolean =>
  typeof e === 'object' &&
  e !== null &&
  (('name' in e && e.name === 'AbortError') || (e instanceof Error && /^navigation (aborted|cancelled)$/.test(e.message)))

export function abandon(e: unknown): void {
  if (!abandoned(e)) {
    throw e
  }
}
