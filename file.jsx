import { useState, useCallback, useEffect } from "react";

/* =========================
   PROMPTS
========================= */

const makeElicitationPrompt = (input, inputType) =>
  `You are a formal methods expert specializing in program specification and verification.

Analyze the following ${inputType}:

\`\`\`
${input}
\`\`\`

Extract formal specifications. Respond ONLY with valid JSON, absolutely no markdown fences, no extra text before or after:

{
  "summary": "2-3 sentence description of what this does and key behavioral concerns",
  "specifications": [
    {
      "name": "short spec name",
      "type": "precondition|postcondition|invariant|property",
      "informal": "plain English description",
      "formal": "formal notation or annotated pseudocode",
      "lean_sketch": "rough Lean 4 / Coq theorem statement, or empty string"
    }
  ],
  "hidden_assumptions": [
    {
      "assumption": "the hidden assumption",
      "risk": "low|medium|high",
      "explanation": "why this matters if violated"
    }
  ],
  "underspecified_areas": ["area 1", "area 2"],
  "properties_for_testing": [
    {
      "property": "property name",
      "description": "what invariant to test",
      "example": "example input or scenario"
    }
  ]
}`;

const makeComparisonPrompt = (input, results) =>
  `You are a senior formal verification researcher. Multiple AI models each generated formal specifications for the same code or documentation.

Original input:
\`\`\`
${input}
\`\`\`

Model outputs:
${Object.entries(results)
  .map(([m, s]) => `=== ${m.toUpperCase()} ===\n${JSON.stringify(s, null, 2)}`)
  .join("\n\n")}

Respond ONLY with valid JSON:

{
  "overview": "2-3 sentences",
  "agreements": ["shared finding"],
  "disagreements": [
    {
      "area": "aspect",
      "models": {"model": "view"},
      "significance": "low|medium|high",
      "explanation": "why it matters"
    }
  ],
  "missing_from_some_models": ["missing spec"],
  "consensus_specification": "best synthesis",
  "overall_confidence": "low|medium|high",
  "next_steps": ["step 1", "step 2"]
}`;

/* =========================
   MODELS
========================= */

const MODELS = [
  {
    id: "claude",
    label: "Claude",
    sub: "Sonnet 4",
    color: "#A66A3F",
  },
  {
    id: "openai",
    label: "GPT-4o",
    sub: "OpenAI",
    color: "#6F7B52",
  },
  {
    id: "gemini",
    label: "Gemini",
    sub: "1.5 Pro",
    color: "#8A6A52",
  },
];

/* =========================
   COLORS
========================= */

const typeColors = {
  precondition: {
    bg: "rgba(140,88,52,0.16)",
    text: "#C08A5B",
  },

  postcondition: {
    bg: "rgba(92,112,72,0.16)",
    text: "#9CB07A",
  },

  invariant: {
    bg: "rgba(156,120,60,0.16)",
    text: "#D0A15A",
  },

  property: {
    bg: "rgba(110,82,60,0.16)",
    text: "#B28B68",
  },
};

const riskColors = {
  high: {
    bg: "rgba(120,58,42,0.16)",
    text: "#C07A68",
  },

  medium: {
    bg: "rgba(140,104,54,0.16)",
    text: "#C9A065",
  },

  low: {
    bg: "rgba(82,110,68,0.16)",
    text: "#90B07A",
  },
};

/* =========================
   HELPERS
========================= */

const parseJSON = (raw) => {
  try {
    const clean = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    return JSON.parse(clean);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }

    return null;
  }
};

const modelAvailable = (modelId, keys) => {
  if (modelId === "claude") return true;

  return Boolean(keys[modelId]?.trim());
};

/* =========================
   API CALLS
========================= */

const callModel = async (modelId, prompt, keys) => {
  if (modelId !== "claude" && !keys[modelId]) {
    throw new Error(`${modelId} API key missing`);
  }

  /* ---------- CLAUDE ---------- */

  if (modelId === "claude") {
    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    };

    if (keys.claude?.trim()) {
      headers["x-api-key"] = keys.claude;
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.content?.[0]?.text || "";
  }

  /* ---------- OPENAI ---------- */

  if (modelId === "openai") {
    const res = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keys.openai}`,
        },

        body: JSON.stringify({
          model: "gpt-4o",

          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],

          max_tokens: 2000,
        }),
      }
    );

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.choices?.[0]?.message?.content || "";
  }

  /* ---------- GEMINI ---------- */

  if (modelId === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${keys.gemini}`,

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],

          generationConfig: {
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  throw new Error(`Unknown model: ${modelId}`);
};

/* =========================
   SMALL COMPONENTS
========================= */

const Badge = ({ label, colors }) => (
  <span
    style={{
      padding: "3px 9px",
      borderRadius: "999px",
      fontSize: "10px",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      fontWeight: 500,
      background: colors?.bg,
      color: colors?.text,
    }}
  >
    {label}
  </span>
);

const SectionTitle = ({ label }) => (
  <div
    style={{
      fontSize: "10px",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: "#8A6A52",
      marginBottom: "12px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
    }}
  >
    {label}

    <div
      style={{
        flex: 1,
        height: "1px",
        background: "#3A281A",
      }}
    />
  </div>
);

/* =========================
   PANEL
========================= */

const Panel = ({ children, title, badge, badgeColor }) => (
  <div
    style={{
      background: "#1A120D",
      border: "1px solid #3A281A",
      borderRadius: "14px",
      overflow: "hidden",
      transition: "all 0.18s ease",
    }}
  >
    <div
      style={{
        padding: "14px 20px",
        borderBottom: "1px solid #3A281A",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#24170F",
      }}
    >
      <span
        style={{
          fontSize: "10px",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#8A6A52",
        }}
      >
        {title}
      </span>

      {badge && (
        <span
          style={{
            fontSize: "9px",
            padding: "4px 10px",
            borderRadius: "999px",
            background: `${badgeColor}18`,
            color: badgeColor,
            letterSpacing: "0.08em",
          }}
        >
          {badge}
        </span>
      )}
    </div>

    {children}
  </div>
);

/* =========================
   MAIN APP
========================= */

export default function SpecSynth() {
  const [keys, setKeys] = useState({
    claude: "",
    openai: "",
    gemini: "",
  });

  const [showKey, setShowKey] = useState({
    claude: false,
    openai: false,
    gemini: false,
  });

  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState("code");

  const [selectedModels, setSelectedModels] = useState(["claude"]);

  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const [keysOpen, setKeysOpen] = useState(false);

  useEffect(() => {
    setSelectedModels((prev) =>
      prev.filter((m) => modelAvailable(m, keys))
    );
  }, [keys]);

  const toggleModel = useCallback((id) => {
    setSelectedModels((prev) =>
      prev.includes(id)
        ? prev.filter((m) => m !== id)
        : [...prev, id]
    );
  }, []);

  const run = async () => {
    if (!input.trim()) return;

    setLoading(true);
    setResults({});

    const prompt = makeElicitationPrompt(input, inputType);

    await Promise.all(
      selectedModels.map(async (model) => {
        try {
          const raw = await callModel(model, prompt, keys);

          const parsed = parseJSON(raw);

          setResults((prev) => ({
            ...prev,
            [model]: parsed || {
              error: "Could not parse response",
            },
          }));
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            [model]: {
              error: err.message,
            },
          }));
        }
      })
    );

    setLoading(false);
  };

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html,
        body {
          background: #120C08;
        }

        body {
          font-family: Inter, sans-serif;
        }

        .root {
          min-height: 100vh;
          background: #120C08;
          color: #D8C2A8;
        }

        .root::before {
          content: '';
          position: fixed;
          inset: 0;

          background-image:
            linear-gradient(rgba(185,122,69,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(185,122,69,0.03) 1px, transparent 1px);

          background-size: 42px 42px;

          pointer-events: none;
        }

        .header {
          position: sticky;
          top: 0;
          z-index: 100;

          background: rgba(18,12,8,0.92);

          backdrop-filter: blur(12px);

          border-bottom: 1px solid #3A281A;

          box-shadow: 0 8px 32px rgba(0,0,0,0.28);

          display: flex;
          align-items: center;

          padding: 0 24px;
        }

        .logo {
          padding: 22px 24px 22px 0;

          margin-right: 24px;

          border-right: 1px solid #3A281A;

          font-size: 13px;
          font-weight: 700;

          letter-spacing: 0.18em;

          color: #B97A45;
        }

        .tabs {
          display: flex;
          flex: 1;
        }

        .tab {
          padding: 0 22px;
          height: 64px;

          border: none;
          border-bottom: 2px solid transparent;

          background: transparent;

          color: #8A6A52;

          font-size: 11px;

          letter-spacing: 0.12em;

          text-transform: uppercase;

          cursor: pointer;

          transition: all 0.18s ease;
        }

        .tab:hover {
          color: #D8C2A8;
        }

        .tab.active {
          color: #B97A45;
          border-bottom-color: #B97A45;
        }

        .keys-btn {
          padding: 10px 16px;

          background: transparent;

          border: 1px solid #3A281A;

          border-radius: 10px;

          color: #8A6A52;

          cursor: pointer;

          transition: all 0.18s ease;
        }

        .keys-btn:hover {
          color: #D8C2A8;
          border-color: #8A6A52;
        }

        .main {
          max-width: 1500px;
          margin: 0 auto;

          padding: 28px;
        }

        .keys-panel {
          display: grid;
          grid-template-columns: repeat(3, 1fr);

          gap: 18px;

          margin-bottom: 24px;

          background: #1A120D;

          border: 1px solid #3A281A;

          border-radius: 14px;

          padding: 22px;
        }

        .input {
          width: 100%;
          min-height: 300px;

          padding: 16px;

          background: #24170F;

          border: 1px solid #3A281A;

          border-radius: 12px;

          color: #D8C2A8;

          font-size: 13px;

          line-height: 1.7;

          resize: vertical;

          outline: none;
        }

        .input:focus {
          border-color: #B97A45;
        }

        .model-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;

          margin-top: 18px;
        }

        .model-btn {
          padding: 9px 15px;

          border-radius: 999px;

          background: transparent;

          border: 1px solid #3A281A;

          color: #8A6A52;

          cursor: pointer;

          transition: all 0.18s ease;

          font-size: 11px;

          letter-spacing: 0.08em;
        }

        .model-btn:hover {
          transform: translateY(-1px);
        }

        .run-btn {
          width: 100%;

          margin-top: 20px;

          padding: 14px;

          border-radius: 12px;

          border: 1px solid #B97A45;

          background: transparent;

          color: #B97A45;

          cursor: pointer;

          transition: all 0.18s ease;

          letter-spacing: 0.16em;

          text-transform: uppercase;

          font-size: 11px;
        }

        .run-btn:hover {
          transform: translateY(-1px);

          background: rgba(185,122,69,0.05);
        }

        .grid {
          display: grid;
          grid-template-columns: 390px 1fr;

          gap: 22px;
        }

        .result-card {
          background: #24170F;

          border: 1px solid #3A281A;

          border-radius: 14px;

          overflow: hidden;

          margin-bottom: 18px;
        }

        .result-header {
          padding: 14px 18px;

          border-bottom: 1px solid #3A281A;

          display: flex;
          align-items: center;
          gap: 10px;
        }

        .result-body {
          padding: 18px;
        }

        @media(max-width: 900px) {
          .grid {
            grid-template-columns: 1fr;
          }

          .keys-panel {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="root">
        <header className="header">
          <div className="logo">SPECSYNTH</div>

          <div className="tabs">
            <button className="tab active">
              Specification Extraction
            </button>
          </div>

          <button
            className="keys-btn"
            onClick={() => setKeysOpen((v) => !v)}
          >
            API Keys
          </button>
        </header>

        <main className="main">
          {keysOpen && (
            <div className="keys-panel">
              {[
                {
                  id: "claude",
                  label: "Anthropic Claude",
                  placeholder:
                    "Optional Claude API key",
                },

                {
                  id: "openai",
                  label: "OpenAI GPT-4o",
                  placeholder:
                    "Optional OpenAI API key",
                },

                {
                  id: "gemini",
                  label: "Google Gemini",
                  placeholder:
                    "Optional Gemini API key",
                },
              ].map((k) => (
                <div key={k.id}>
                  <div
                    style={{
                      marginBottom: "8px",
                      fontSize: "11px",
                      color: "#8A6A52",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {k.label}
                  </div>

                  <div
                    style={{
                      position: "relative",
                    }}
                  >
                    <input
                      type={showKey[k.id] ? "text" : "password"}
                      value={keys[k.id]}
                      placeholder={k.placeholder}
                      onChange={(e) =>
                        setKeys((prev) => ({
                          ...prev,
                          [k.id]: e.target.value,
                        }))
                      }
                      className="input"
                      style={{
                        minHeight: "unset",
                        height: "48px",
                        paddingRight: "50px",
                      }}
                    />

                    <button
                      onClick={() =>
                        setShowKey((prev) => ({
                          ...prev,
                          [k.id]: !prev[k.id],
                        }))
                      }
                      style={{
                        position: "absolute",
                        right: "14px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#8A6A52",
                        cursor: "pointer",
                      }}
                    >
                      {showKey[k.id] ? "●" : "○"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid">
            <Panel
              title="Input Source"
              badge="TRACK 01"
              badgeColor="#B97A45"
            >
              <div
                style={{
                  padding: "20px",
                }}
              >
                <textarea
                  className="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="// Paste code, requirements, or docs..."
                />

                <div className="model-row">
                  {MODELS.map((m) => {
                    const selected =
                      selectedModels.includes(m.id);

                    const available =
                      modelAvailable(m.id, keys);

                    return (
                      <button
                        key={m.id}
                        className="model-btn"
                        onClick={() =>
                          available && toggleModel(m.id)
                        }
                        style={{
                          borderColor:
                            selected && available
                              ? m.color
                              : "#3A281A",

                          background:
                            selected && available
                              ? `${m.color}18`
                              : "transparent",

                          color:
                            selected && available
                              ? m.color
                              : "#8A6A52",

                          opacity: available ? 1 : 0.65,

                          filter: available
                            ? "none"
                            : "grayscale(0.35)",
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="run-btn"
                  onClick={run}
                  disabled={
                    loading ||
                    !input.trim() ||
                    selectedModels.length === 0
                  }
                >
                  {loading
                    ? "Running..."
                    : "Extract Specifications"}
                </button>
              </div>
            </Panel>

            <Panel title="Extracted Specifications">
              <div
                style={{
                  padding: "20px",
                }}
              >
                {!Object.keys(results).length && !loading && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#8A6A52",
                      padding: "70px 0",
                    }}
                  >
                    Run extraction to view results
                  </div>
                )}

                {Object.entries(results).map(
                  ([model, result]) => {
                    const m = MODELS.find(
                      (x) => x.id === model
                    );

                    return (
                      <div
                        key={model}
                        className="result-card"
                      >
                        <div className="result-header">
                          <div
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: m?.color,
                            }}
                          />

                          <div
                            style={{
                              color: m?.color,
                              letterSpacing: "0.1em",
                              textTransform: "uppercase",
                              fontSize: "11px",
                            }}
                          >
                            {m?.label}
                          </div>
                        </div>

                        <div className="result-body">
                          {result.error ? (
                            <div
                              style={{
                                color: "#C07A68",
                              }}
                            >
                              {result.error}
                            </div>
                          ) : (
                            <>
                              {result.summary && (
                                <div
                                  style={{
                                    marginBottom: "18px",
                                    lineHeight: 1.7,
                                    color: "#D8C2A8",
                                  }}
                                >
                                  {result.summary}
                                </div>
                              )}

                              {result.specifications?.length >
                                0 && (
                                <div>
                                  <SectionTitle
                                    label={`Specifications (${result.specifications.length})`}
                                  />

                                  {result.specifications.map(
                                    (spec, i) => (
                                      <div
                                        key={i}
                                        style={{
                                          marginBottom: "14px",

                                          background:
                                            "#1A120D",

                                          border:
                                            "1px solid #3A281A",

                                          borderRadius:
                                            "12px",

                                          padding: "14px",
                                        }}
                                      >
                                        <div
                                          style={{
                                            marginBottom:
                                              "10px",
                                          }}
                                        >
                                          <Badge
                                            label={
                                              spec.type
                                            }
                                            colors={
                                              typeColors[
                                                spec.type
                                              ]
                                            }
                                          />
                                        </div>

                                        <div
                                          style={{
                                            marginBottom:
                                              "10px",

                                            color:
                                              "#D8C2A8",

                                            fontWeight:
                                              600,
                                          }}
                                        >
                                          {spec.name}
                                        </div>

                                        <div
                                          style={{
                                            lineHeight:
                                              1.7,

                                            color:
                                              "#C7B29B",
                                          }}
                                        >
                                          {
                                            spec.informal
                                          }
                                        </div>

                                        {spec.formal && (
                                          <pre
                                            style={{
                                              marginTop:
                                                "12px",

                                              padding:
                                                "12px",

                                              overflow:
                                                "auto",

                                              background:
                                                "#120C08",

                                              borderRadius:
                                                "10px",

                                              color:
                                                "#C9A065",

                                              fontSize:
                                                "12px",
                                            }}
                                          >
                                            {
                                              spec.formal
                                            }
                                          </pre>
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </Panel>
          </div>
        </main>
      </div>
    </>
  );
}