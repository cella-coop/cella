// The test and the dev seed run precisely the same ordered story. A named
// step keeps its own assertion and the test runner shows which step failed.
// A step declared by `unseeded` the test runs in its place and the seed
// skips: a browser's, or one that takes a step the story leaves its reader
// to take in the app.
type Step = () => Promise<void>
type Run = (name: string, step: Step) => Promise<unknown>

export function createStory() {
  let setup: Step = async () => {}
  let cleanup: Step = async () => {}
  const steps: { name: string; step: Step; seeds: boolean }[] = []
  return {
    before: (fn: Step) => { setup = fn },
    after: (fn: Step) => { cleanup = fn },
    test: (name: string, step: Step) => { steps.push({ name, step, seeds: true }) },
    unseeded: (name: string, step: Step) => { steps.push({ name, step, seeds: false }) },
    story: async (run: Run = async (name, step) => {
      try { await step() } catch (error) { throw new Error(`story step failed: ${name}`, { cause: error }) }
    }) => {
      // The seed sets CELLA_STORY before it imports a story.
      const seeding = Boolean(process.env.CELLA_STORY)
      await setup()
      try {
        for (const { name, step, seeds } of steps) {
          if (seeding && !seeds) continue
          // Do not continue a failed story: later writes often depend on it.
          await run(name, step)
        }
      } finally {
        await cleanup()
      }
    },
  }
}
