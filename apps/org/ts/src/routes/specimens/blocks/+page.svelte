<script lang="ts">
  import { Blocks, Failed, Frame, blocks } from '@cella/org-ui'
  import { blocks as specimen } from '#lib/remote/specimen.remote.ts'

  // DEV ONLY. Every presentational block kind the kit draws, read-only,
  // for the operator's review and the `blocks` e2e scenario's
  // screenshot: the components `blocks/index.ts` exports, each its own
  // text or content, none of it editable. The dev server alone serves
  // it, which its query says.
  const { Paragraph, Heading, Quote, List, Item, Todo, Code, Divider, Embed } = blocks
  const served = specimen()
</script>

<svelte:boundary>
  {#snippet failed(error)}
    <Failed {error} />
  {/snippet}
  {#if await served}
    <Frame title="Block kinds specimen">
      <Blocks readonly>
        <div class="block">
          <div class="line">
            <div class="body"><Heading level={1}>Heading 1</Heading></div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body"><Heading level={2}>Heading 2</Heading></div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body"><Heading level={3}>Heading 3</Heading></div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body"><Paragraph>A paragraph: plain text, nothing else to its shape.</Paragraph></div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body">
              <List kind="bullet">
                <Item>First</Item>
                <Item>Second</Item>
                <Item depth={1}>Nested</Item>
              </List>
            </div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body">
              <List kind="numbered">
                <Item numbered number={1}>First</Item>
                <Item numbered number={2}>Second</Item>
              </List>
            </div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body"><Todo checked={false}>Not done yet</Todo></div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body"><Todo checked>Done</Todo></div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body"><Quote>A quote, set apart by its rule.</Quote></div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body">
              <Code>
                {#snippet language()}toml{/snippet}
                title = "Specimen"
              </Code>
            </div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body"><Divider /></div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body">
              <Embed>
                <div class="card">
                  <span class="kind">Motion</span>
                  <span class="title">Adopt the budget</span>
                  <div class="meta">Closes 31 Oct 2026</div>
                </div>
              </Embed>
            </div>
          </div>
        </div>
        <div class="block">
          <div class="line">
            <div class="body">
              <Embed>
                <div class="unknown">motion missing</div>
              </Embed>
            </div>
          </div>
        </div>
      </Blocks>
    </Frame>
  {/if}
</svelte:boundary>
