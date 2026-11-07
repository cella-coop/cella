// The test and the dev seed run precisely the same ordered story. A named
// step keeps its own assertion and the test runner shows which step failed.
type Step = () => Promise<void>
type Run = (name: string, step: Step) => Promise<unknown>

export function createStory() {
  let setup: Step = async () => {}
  let cleanup: Step = async () => {}
  const steps: { name: string; step: Step }[] = []
  return {
    before: (fn: Step) => { setup = fn },
    after: (fn: Step) => { cleanup = fn },
    test: (name: string, step: Step) => { steps.push({ name, step }) },
    story: async (run: Run = async (name, step) => {
      try { await step() } catch (error) { throw new Error(`story step failed: ${name}`, { cause: error }) }
    }) => {
      await setup()
      try {
        for (const { name, step } of steps) {
          // Do not continue a failed story: later writes often depend on it.
          await run(name, step)
        }
      } finally {
        await cleanup()
      }
    },
  }
}
