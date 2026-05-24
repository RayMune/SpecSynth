# Project Verify

Project Verify is a research-oriented React app that explores specification elicitation and validation workflows for code, documentation, and informal requirements. The current implementation is a Vite app inside `spec-synth`, and `file.jsx` contains the main prompt generation and AI integration logic.

## Core focus

Project Verify centers on two related capabilities:

1. Specification Elicitation

   Tools that pull formal specifications out of ambiguous sources: documentation, legacy code, requirements docs, conversations with domain experts, and informal descriptions.

   The project aims to demonstrate structured editors, GUIs, and pipelines that translate informal intent into formal artifacts such as Lean-style specifications.

   Example projects:

   - A Coq/Lean spec drafting assistant that turns a natural-language requirement into a candidate specification, with reviewer tooling for the human in the loop.
   - An IDE extension that surfaces hidden assumptions in a legacy C codebase.

2. Specification Validation

   Methods that check whether a candidate specification actually captures the system's intended behavior. This includes testing, cross-checking, mutation, and formal validation.

   Example projects:

   - A property-based fuzzing harness that flags specs which underconstrain or overconstrain the system.
   - Cross-model spec comparison: generate two spec candidates from different LLMs, surface where they disagree.

## Overview

The current app is designed to:

- Build elicitation prompts that ask an AI model to extract formal specifications from input.
- Compare multiple AI outputs and synthesize a consensus response.
- Support Claude, OpenAI GPT-4o, and Gemini model integrations.

## Core features in `file.jsx`

- `makeElicitationPrompt(input, inputType)`: constructs a prompt for extracting structured JSON specifications.
- `makeComparisonPrompt(input, results)`: creates a prompt for comparing model outputs and finding agreements and disagreements.
- `MODELS`: defines available AI models and their UI labels.
- `typeColors` / `riskColors`: maps specification types and risk levels to color values.
- `parseJSON(raw)`: sanitizes responses and parses JSON even when additional formatting is present.
- `modelAvailable(modelId, keys)`: checks if the model has an API key available.
- `callModel(modelId, prompt, keys)`: sends requests to the selected AI service.

## Supported models

- Claude (Anthropic)
- OpenAI GPT-4o
- Gemini 1.5 Pro

## Project structure

- `file.jsx`: prompt templates, parsing helpers, and AI request logic.
- `spec-synth/package.json`: project metadata, dependencies, and scripts.
- `spec-synth/src/`: React app source files.

## Setup and run

From the repository root, navigate into the `spec-synth` folder and install dependencies:

```bash
cd spec-synth
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the build locally:

```bash
npm run preview
```

## Notes

- `file.jsx` provides the logic for generating AI prompts and handling responses, but it is not the full application UI by itself.
- OpenAI and Gemini require API keys for use.
- Claude is included as a default model option and can operate without a configured key in this setup.
- This project is planned to evolve into a library or SDK so integrations are easier and API keys do not need to be uploaded to a public frontend. The goal is to support local model execution and safer local usage when possible.
