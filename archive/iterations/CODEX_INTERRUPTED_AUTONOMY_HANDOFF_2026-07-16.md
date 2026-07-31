# WAKE ENGINE AUTONOMY BUILD - INTERRUPTED STATE - 2026-07-16

Read `CODEX_READ_ME_FIRST.md` first.

Authorized repo only:

`C:\Users\justi\Documents\repos\wake-engine`

## Status

The Phase 7 baseline remains the last fully validated product state:

- final Phase 7 gate verdict: pass
- 18 checks
- 0 blockers
- 22 smoke checks
- 118 Electron UI controls/actions

That verdict predates the autonomy/image extension described below.

The autonomy/image extension was interrupted during implementation. It is saved on disk, builds successfully, but is not finished, mounted in the UI, or covered by the final gate.

Review performed after restart on 2026-07-16:

- `npm run guard:local`: passed
- `node --check server/image-generation.js`: passed
- `node --check server/index.js`: passed
- `npm run build`: passed
- dev ports `5177` and `8786`: not running after shutdown
- smoke/gate/UI audit were not rerun for this partial extension

## User Direction Being Implemented

Wake Engine should become substantially more autonomous:

- project memory is the default brief
- operator direction is optional most of the time
- one action creates an original multi-platform campaign
- campaign outputs cover TikTok, Instagram, X, and LinkedIn
- a platform switcher renders each result in that platform's native visual language
- Wake creates high-quality original images, not only visual prompts
- technical receipts stay available but do not dominate the primary creation flow
- the user reviews and approves finished work instead of manually operating each internal stage

## Partial Files And Work Already Saved

### `server/image-generation.js`

New file. Implemented:

- Hugging Face image inference provider contract
- OpenAI-compatible image provider contract
- platform-specific output dimensions for TikTok, Instagram, X, and LinkedIn
- original-image prompt hardening
- PNG/JPEG/WebP validation
- local image persistence under `server/data/generated-images`
- SHA-256 metadata
- local `/generated-images/...` URL metadata
- honest provider status when no engine is connected

Current provider configuration is absent. No `WAKE_IMAGE_API_KEY`, `HF_TOKEN`, or `OPENAI_API_KEY` was present during the restart review. Real image generation therefore remains blocked until one image provider is connected once.

### `server/index.js`

Partial autonomy backend implemented:

- imports the image-generation provider
- creates and serves `server/data/generated-images`
- adds persisted `campaigns` and `generatedImages` collections
- returns campaigns, generated images, and image provider status from `/api/state`
- returns campaign/image collections from `/api/history`
- adds `GET /api/image-generation/status`
- adds `POST /api/autopilot`
- adds `POST /api/images/generate`
- builds project-scoped autonomous source context from existing local project sources
- runs the Tier Zero network and content cluster automatically
- creates preview packages for TikTok, Instagram, X, and LinkedIn
- attempts two original campaign images automatically when a provider is configured
- persists campaign, image, generation, A2A, tool, and history records

Known incomplete backend item:

- the UI sends an optional `source` field to `/api/autopilot`, but `autonomousProjectSource` currently uses only persisted project sources plus `direction`; the typed unsaved source must be included before completion

### `src/main.jsx`

Partial autonomy UI implemented:

- `PlatformMedia`
- `PlatformPreview`
- TikTok native preview composition
- Instagram native preview composition
- X native preview composition
- LinkedIn native preview composition
- `CampaignAutopilot`
- optional direction input
- one-action campaign creation control
- research/write/design/QA progress strip
- platform segmented switcher
- campaign copy/script/CTA review panel
- copy, export, generate-image, and connect-image-engine actions
- advanced source drawer
- campaign/image React state
- `createCampaign`
- `generateCampaignImage`
- `exportCampaign`
- project-switch reset behavior
- latest persisted campaign hydration behavior

Critical incomplete UI items:

- `<CampaignAutopilot>` is not yet rendered anywhere
- the old manual Console/Cluster flow is still the visible product
- no CSS exists yet for the new autonomy or platform-preview classes
- the old Active Task, Next Step, Ability Header, Action Rail, and Chat blocks have not yet been moved behind the finished campaign experience

## Exact Review Findings

Automated restart review returned:

```json
{
  "autopilotRendered": false,
  "autopilotCss": false,
  "typedSourceUsedByServer": false,
  "imageProviderConfigured": false
}
```

The current production build succeeds because the new React components and handlers are syntactically valid, but the components are not mounted. A passing build is not evidence that the autonomy feature is complete.

The old Phase 7 gate artifact must not be cited as validation of the autonomy/image extension.

## Required Continuation Order

1. Include optional unsaved source content in autonomous project context.
2. Mount `CampaignAutopilot` as the primary Console experience.
3. Make the campaign the visible first result and move technical/manual controls into a collapsed advanced area.
4. Add polished responsive CSS for all native previews and autonomous campaign states.
5. Add honest image-provider setup/status UI without exposing secrets or claiming live generation when unconfigured.
6. Add smoke coverage for no-direction project-memory creation, all four platform packages, project isolation, persistence, image-provider blocked state, and a mocked successful image path.
7. Update Electron UI audit for the one-action campaign flow and all four platform previews.
8. Run build, focused smoke, full gate once, and visual verification at desktop/mobile sizes.
9. Update the main detailed handoff only after the extension passes.

## Truth Boundaries

- No real image was generated during the interrupted work because no image provider was configured.
- The implementation does not fake image generation with placeholders or claim prompts are images.
- The current hardware review found Intel UHD graphics only and no running local image-generation service on the checked common ports.
- A one-time provider connection is acceptable; repeated campaign prompting should not be required.
- The existing Ollama text model integration remains separate from image generation.

## Do Not Do

- Do not work from the OneDrive duplicate.
- Do not remove the Phase 7 validated functionality.
- Do not present the partial autonomy code as completed.
- Do not leave the new platform preview components unmounted.
- Do not use generic decorative placeholders as generated campaign images.
- Do not make the user manually run frame, agents, cluster, and export for every campaign.
- Do not expose every internal trace in the primary campaign review surface.

## Saved Stopping Point

The machine shutdown did not erase the implementation. The repo currently contains a syntactically valid backend provider/orchestration layer and unmounted React campaign-preview components. The next pass should continue from this precise point rather than restart or redesign the autonomy feature.
