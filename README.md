# SpecSynth

This SpecSynth hackathon project is a React-based frontend for generating and comparing formal specifications from code or documentation using AI models. The project uses a Vite app in `spec-synth`, while `file.jsx` contains the core prompt templates and model API logic.

## Overview

The application is designed to:

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
