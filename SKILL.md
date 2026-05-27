---
name: project-verify
description: >
  SpecSynth — a hackathon research tool for the Apart Research Secure Program Synthesis Hackathon.
  Covers Track 01 (Specification Elicitation) and Track 02 (Cross-Model Specification Validation).
  Use this skill whenever extending, debugging, restyling, or adding features to the SpecSynth
  React app. Also use it when adding new tracks, new model providers, new output sections,
  or changing the API integration logic. If the user says "project verify", "specsynth",
  "the hackathon app", or mentions tracks, spec elicitation, or cross-model comparison in
  the context of this codebase — load this skill first.
---

# Project Verify — SpecSynth

A React single-file artifact (`SpecSynth.jsx`) built for the Apart Research / Atlas Computing
Secure Program Synthesis Hackathon (May 2026). It implements two research tracks:

- **Track 01 — Spec Elicitation**: Given code, documentation, or requirements, extract formal
  specifications (preconditions, postconditions, invariants, properties), hidden assumptions with
  risk levels, underspecified areas, and testable properties. Runs against one or more selected
  LLMs in parallel.

- **Track 02 — Cross-Model Validation**: Sends the same input to 2+ LLMs independently, then
  runs a third-pass Claude analysis to surface disagreements, partial-coverage gaps, agreements,
  a consensus specification, and next steps. Designed to flag where models differ — those
  differences signal underspecification or ambiguity in the original code/docs.

---

## File Location

```
/mnt/user-data/outputs/SpecSynth.jsx   ← single source of truth, edit this
```

All logic, styles, and components live in one file. Do not split into multiple files unless
the user explicitly asks.

---

## Code Style Conventions

These conventions are non-negotiable and must be preserved across all edits:

- **Comments use lowercase with no spaces**: `//specificationelicitationprompt`, `//runtrack1`,
  `//parsemodeljsonresponse`. Never `// Parse JSON response` or `// Run track 1`.
- Inline styles everywhere — no separate CSS classes except inside the `<style>` tag for
  pseudo-elements, animations, hover states, and global resets.
- Component names are PascalCase. Internal helpers (`callModel`, `parseJSON`, `makeElicitationPrompt`)
  are camelCase.
- No TypeScript. Plain JSX with React hooks only.
- All state lives in the root `SpecSynth` component. Sub-components receive only what they render.

---

## Architecture

```
SpecSynth (root)
├── state
│   ├── keys         { claude, openai, gemini }   ← user-supplied API keys
│   ├── showKey      { claude, openai, gemini }   ← toggle plaintext visibility
│   ├── activeTab    "track1" | "track2"
│   ├── keysOpen     boolean
│   ├── t1*          Track 01 state
│   └── t2*          Track 02 state
│
├── utilities (module-level, not components)
│   ├── makeElicitationPrompt(input, inputType) → string
│   ├── makeComparisonPrompt(input, results)    → string
│   ├── callModel(modelId, prompt, keys)        → Promise<string>
│   ├── parseJSON(raw)                          → object | null
│   └── modelAvailable(modelId, keys)          → boolean
│
├── pure display components
│   ├── Badge({ label, colors })
│   ├── SectionTitle({ label })
│   ├── ModelHeader({ model, result })
│   ├── SpecResult({ result, modelColor })      ← renders full spec output for one model
│   ├── CodeArea({ value, onChange, type, onTypeChange })
│   ├── RunBtn({ onClick, loading, disabled, label, loadingLabel })
│   └── Panel({ children, title, badge, badgeColor })
│
└── inline ModelToggle (defined inside SpecSynth, uses closure over keys/toggleModel)
```

---

## Model Registry

Defined at module level as `MODELS`. Each entry:

```js
{ id: "claude", label: "Claude", sub: "Sonnet 4", color: "#c4852a", needsKey: false }
{ id: "openai", label: "GPT-4o", sub: "OpenAI",   color: "#7a9e62", needsKey: true  }
{ id: "gemini", label: "Gemini", sub: "3.0 Pro",  color: "#7a8aaa", needsKey: true  }
```

**Key availability logic** — `modelAvailable(modelId, keys)`:
- Claude: always `true` (API key required)
- OpenAI / Gemini: `true` only if `keys[modelId]` is non-empty

A `useEffect` auto-deselects models from both tracks whenever keys change:
```js
useEffect(() => {
  setT1Models((prev) => prev.filter((m) => modelAvailable(m, keys)));
  setT2Models((prev) => prev.filter((m) => modelAvailable(m, keys)));
}, [keys]);
```

The `ModelToggle` button renders the model as locked (`opacity: 0.38`, `cursor: not-allowed`,
shows `"add key"` label) when the model is unavailable. Never remove this gating — do not
allow selecting a model without its key.

---

## API Integration

### Claude (Anthropic)
```
POST https://api.anthropic.com/v1/messages
model: claude-sonnet-4-20250514
max_tokens: 2000
```
- No `x-api-key` header needed when running inside the Claude artifact environment.
- If `keys.claude` is set, pass it as `x-api-key` (user's own billing).

### OpenAI
```
POST https://api.openai.com/v1/chat/completions
model: gpt-4o
Authorization: Bearer <keys.openai>
```

### Gemini
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=<keys.gemini>
```

All three return raw text which is then passed to `parseJSON`. Strip ` ```json ` fences before
parsing. Fall back to regex `\{[\s\S]*\}` extraction if direct parse fails.

---

## Prompt Schemas

### Elicitation prompt output shape
```json
{
  "summary": "string",
  "specifications": [
    {
      "name": "string",
      "type": "precondition|postcondition|invariant|property",
      "informal": "string",
      "formal": "string",
      "lean_sketch": "string or empty"
    }
  ],
  "hidden_assumptions": [
    { "assumption": "string", "risk": "low|medium|high", "explanation": "string" }
  ],
  "underspecified_areas": ["string"],
  "properties_for_testing": [
    { "property": "string", "description": "string", "example": "string" }
  ]
}
```

### Comparison prompt output shape
```json
{
  "overview": "string",
  "agreements": ["string"],
  "disagreements": [
    {
      "area": "string",
      "models": { "claude": "string", "openai": "string" },
      "significance": "low|medium|high",
      "explanation": "string"
    }
  ],
  "missing_from_some_models": ["string"],
  "consensus_specification": "string",
  "overall_confidence": "low|medium|high",
  "next_steps": ["string"]
}
```

If a model returns malformed JSON, its result is stored as `{ error: "message" }` and rendered
as an error card. The comparison step only runs if `≥ 2` valid (non-error) results exist.

---

## Design System — Earth Tone Palette

All colors are hardcoded as hex strings (no CSS variables). When editing or extending,
stay within this palette:

| Token              | Value     | Use                                      |
|--------------------|-----------|------------------------------------------|
| `bg`               | `#0e0a06` | Page background, deepest panels          |
| `surface`          | `#150e08` | Panel backgrounds                        |
| `panel`            | `#1c1209` | Card backgrounds, header bars            |
| `border`           | `#2e1f0f` | All borders                              |
| `border-dim`       | `#3d2a14` | Scrollbar thumb, dim accents             |
| `accent-primary`   | `#c4852a` | Claude model color, run buttons, logo    |
| `accent-secondary` | `#d4a054` | Lean sketch border, property examples    |
| `text-primary`     | `#c8aa88` | Body text, main content                  |
| `text-muted`       | `#7a5e40` | Secondary labels, explanations           |
| `text-dim`         | `#5a3e24` | Section titles, disabled states          |
| `text-darkest`     | `#3d2a14` | Empty state hints                        |
| `openai-color`     | `#7a9e62` | OpenAI model accent                      |
| `gemini-color`     | `#7a8aaa` | Gemini model accent                      |

**Spec type badge colors:**
```
precondition  → bg rgba(196,96,48,0.14)   text #d4845a
postcondition → bg rgba(122,158,98,0.14)  text #96b87a
invariant     → bg rgba(196,160,48,0.14)  text #d4b45a
property      → bg rgba(158,96,128,0.14)  text #c07aa0
```

**Risk badge colors:**
```
high   → bg rgba(176,64,48,0.16)  text #c47060
medium → bg rgba(184,120,48,0.16) text #c49858
low    → bg rgba(96,144,80,0.16)  text #88b070
```

**Grid overlay**: `rgba(196,133,42,0.025)` at 44px — warm amber tint on dark brown ground.

**Typography**: `Fira Code` for code, formal notation, lean sketches, property names.
`DM Mono` for UI chrome, labels, buttons. `Syncopate` for the `SPECSYNTH` logo only.
All loaded from Google Fonts at the top of the `<style>` tag.

---

## Layout

Two-column grid: `380px 1fr` with `gap: 20px`. Left column = input panel (fixed width).
Right column = scrollable results. Collapses to single column below `800px`.

Header is sticky, `backdrop-filter: blur(12px)`, tabs use a 2px bottom border for active state.
The API keys drawer sits between the header and the track grid, toggled by the header button
which shows `"⚙ api keys · N active"` where `N = availableModels.length`.

---

## Adding a New Track

1. Add a new tab button in the header tabs section.
2. Add corresponding state block (input, type, models, results, loading).
3. Write a new prompt function at the module level following the naming convention.
4. Add the track's JSX inside `{activeTab === "trackN" && (...)}`.
5. Reuse `Panel`, `CodeArea`, `RunBtn`, `ModelToggle`, `SpecResult`, `SectionTitle` — do not
   create new styled wrappers unless the output shape genuinely differs.
6. Follow the same parallel-call pattern used in `runTrack1` and `runTrack2`.

---

## Adding a New Model Provider

1. Add an entry to `MODELS` with a new earth-tone `color` (pick from the muted/dusty range —
   avoid neons or saturated hues).
2. Add a branch to `callModel` for the new `modelId`.
3. Add a key field entry in the API keys drawer JSX.
4. Update `modelAvailable` if the new provider has different availability logic.

---

## Common Extension Points

| Goal                              | Where to edit                                      |
|-----------------------------------|----------------------------------------------------|
| Change elicitation output schema  | `makeElicitationPrompt` + `SpecResult` component   |
| Add a new spec type               | `typeColors` object + prompt text                  |
| Add Lean 4 export button          | Inside `SpecResult`, below the lean_sketch block   |
| Persist results across sessions   | Replace `useState` with `window.storage` API       |
| Add a third track                 | See "Adding a New Track" above                     |
| Change fonts                      | Google Fonts import at top of `<style>` tag        |
| Change button color scheme        | `RunBtn` inline style + `accent-primary` references|

---

## Known Constraints

- Gemini `gemini-1.5-pro` is the stable model string as of May 2026. If it 404s, try
  `gemini-1.5-pro-latest` or `gemini-pro`.
- The comparison analysis always uses Claude as the arbitrating model (`callModel("claude", ...)`),
  regardless of which models the user selected. This is intentional — Claude has built-in access
  and the comparison pass is a meta-analysis step.
- Do not add `localStorage` or `sessionStorage` — these are unsupported in Claude artifacts.
  Use `window.storage` (the artifact persistent storage API) if persistence is needed.
- The `<style>` tag uses `@import url(...)` for Google Fonts. This works in the artifact
  renderer. Do not switch to `<link>` tags — they won't render.
