import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function safeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function safeObject(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
}

function cleanJson(text) {
  if (!text) return "";
  let out = String(text).trim();

  if (out.startsWith("```")) {
    out = out
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");
  }

  return out.trim();
}

function normalizeResult(data) {
  const screens = safeArray(data.screens).map((s, index) => ({
    id: String(s?.id || `screen-${index + 1}`),
    title: String(s?.title || `Screen ${index + 1}`),
    kind: String(s?.kind || "overview"),
  }));

  const rawSchemas = safeArray(data?.uiSchema?.screenSchemas);
  const screenSchemas = rawSchemas.map((schema, index) => ({
    screenId: String(schema?.screenId || screens[index]?.id || `screen-${index + 1}`),
    title: String(schema?.title || screens[index]?.title || `Screen ${index + 1}`),
    blocks: safeArray(schema?.blocks).map((block) => ({
      type: String(block?.type || "text"),
      title: block?.title ? String(block.title) : undefined,
      subtitle: block?.subtitle ? String(block.subtitle) : undefined,
      text: block?.text ? String(block.text) : undefined,
      entity: block?.entity ? String(block.entity) : undefined,
      label: block?.label ? String(block.label) : undefined,
      action: block?.action ? String(block.action) : undefined,
      items: Array.isArray(block?.items) ? block.items.map(String) : undefined,
      fields: Array.isArray(block?.fields) ? block.fields.map(String) : undefined,
    })),
  }));

  const files = safeArray(data.files).map((f, index) => ({
    path: String(f?.path || `Desktop/BuilderProjects/generated-project/file-${index + 1}.txt`),
    content: String(f?.content || ""),
  }));

  const projectTree = safeArray(data.projectTree).map((t, index) => ({
    id: String(t?.id || `tree-${index + 1}`),
    path: String(t?.path || `Desktop/BuilderProjects/generated-project/path-${index + 1}`),
    type: t?.type === "folder" ? "folder" : "file",
  }));

  const result = {
    projectName: String(data.projectName || "generated-project"),
    displayName: String(data.displayName || "Generated Project"),
    prompt: String(data.prompt || ""),
    projectType: String(data.projectType || "generic"),
    style: String(data.style || "modern modular"),
    targetPath: String(
      data.targetPath || `Desktop/BuilderProjects/${String(data.projectName || "generated-project")}/`
    ),
    architecture: safeObject(data.architecture, {
      frontend: "Next.js prototype",
      backend: "Node backend",
      storage: "JSON/mock",
      auth: "Not connected",
      style: "modern modular",
    }),
    entities: safeArray(data.entities).map(String),
    screens,
    ui: screenSchemas,
    dataModel: safeObject(data.dataModel, {}),
    files,
    projectTree,
    logs: safeArray(data.logs).map(String),
    validation: safeArray(data.validation).map((v, index) => ({
      id: String(v?.id || `validation-${index + 1}`),
      name: String(v?.name || `Validation ${index + 1}`),
      passed: Boolean(v?.passed),
    })),
    fileCount: files.length,
    treeCount: projectTree.length,
    mode: "live-vercel-openai",
  };

  if (!result.logs.length) {
    result.logs = [
      "Prompt ricevuto",
      "Generazione AI completata",
      "Package normalizzato",
      "Preview pronta",
    ];
  }

  if (!result.validation.length) {
    result.validation = [
      { id: "v1", name: "Project package exists", passed: true },
      { id: "v2", name: "Screens generated", passed: result.screens.length > 0 },
      { id: "v3", name: "Files generated", passed: result.files.length > 0 },
    ];
  }

  return result;
}

export async function GET() {
  return Response.json({
    ok: true,
    route: "/api/generate",
    hasKey: Boolean(process.env.OPENAI_API_KEY),
  });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").trim();

    if (!prompt) {
      return Response.json({ error: "Prompt mancante" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "Manca OPENAI_API_KEY su Vercel" },
        { status: 500 }
      );
    }

    const systemPrompt = `
Sei un motore AI che trasforma un prompt utente in un package completo di applicazione.
Restituisci SOLO JSON valido.
Non usare markdown.
Non scrivere testo fuori dal JSON.

Formato richiesto:
{
  "projectName": "string",
  "displayName": "string",
  "prompt": "string",
  "projectType": "string",
  "style": "string",
  "targetPath": "string",
  "architecture": {
    "frontend": "string",
    "backend": "string",
    "storage": "string",
    "auth": "string",
    "style": "string"
  },
  "entities": ["string"],
  "screens": [
    {
      "id": "string",
      "title": "string",
      "kind": "overview|collection|detail|summary|form"
    }
  ],
  "uiSchema": {
    "screenSchemas": [
      {
        "screenId": "string",
        "title": "string",
        "blocks": [
          {
            "type": "hero|chips|title|stats|cards|focus|text|button|form",
            "title": "string?",
            "subtitle": "string?",
            "text": "string?",
            "entity": "string?",
            "label": "string?",
            "action": "string?",
            "items": ["string"]?,
            "fields": ["string"]?
          }
        ]
      }
    ]
  },
  "dataModel": {},
  "projectTree": [
    {
      "id": "string",
      "path": "string",
      "type": "file|folder"
    }
  ],
  "files": [
    {
      "path": "string",
      "content": "string"
    }
  ],
  "logs": ["string"],
  "validation": [
    {
      "id": "string",
      "name": "string",
      "passed": true
    }
  ]
}

Regole:
- Genera un risultato coerente con il prompt.
- Non usare sempre lo stesso layout o gli stessi contenuti.
- targetPath deve iniziare con Desktop/BuilderProjects/
- genera almeno 4 screens
- genera almeno 10 files
- genera projectTree coerente con i files
- i blocchi UI devono essere compatibili con questi tipi:
  hero, chips, title, stats, cards, focus, text, button, form
- dataModel deve contenere le entità usate dai blocchi
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Prompt utente: ${prompt}` },
      ],
      max_output_tokens: 6000,
    });

    const raw = cleanJson(response.output_text);
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return Response.json(
        {
          error: "Il modello non ha restituito JSON valido",
          raw,
        },
        { status: 500 }
      );
    }

    const normalized = normalizeResult(parsed);
    return Response.json(normalized);
  } catch (error) {
    return Response.json(
      {
        error: error?.message || "Errore interno backend",
      },
      { status: 500 }
    );
  }
        }
