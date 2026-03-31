import { CONFIG } from "./config/defaults.js";
import { connectMongo } from "./services/mongoService.js";
import { analyzeCollectionSchema } from "./services/schemaAnalyzer.js";
import { parsePrompt } from "./services/promptParser.js";
import { buildConnectors } from "./services/connectorGenerator.js";
import { generateFormConfig } from "./services/formGenerator.js";
import { persistOutputs } from "./services/persistenceService.js";

function buildFallbackFields(parsedPrompt) {
  return parsedPrompt.requestedFields.map((fieldName) => ({
    fieldName,
    observedTypes: fieldName.toLowerCase().includes("year") ? ["number"] : ["string"],
    sampleValues: [],
    stats: {
      presentCount: 0,
      nullCount: 0,
      nonNullRatio: 0,
      maxStringLength: 200,
    },
  }));
}

function readPromptFromArgs(defaultPrompt) {
  const promptIndex = process.argv.findIndex((arg) => arg === "--prompt");
  if (promptIndex >= 0 && process.argv[promptIndex + 1]) {
    return process.argv[promptIndex + 1];
  }
  return defaultPrompt;
}

async function run() {
  const prompt = readPromptFromArgs(CONFIG.prompt);
  const parsedPrompt = parsePrompt(prompt);

  let client;
  try {
    const conn = await connectMongo(CONFIG.mongodbUri, CONFIG.dbName);
    client = conn.client;
    const db = conn.db;

    const sourceCollection = db.collection(CONFIG.sourceCollection);
    const schema = await analyzeCollectionSchema(sourceCollection, 250);

    const requestedSet = new Set(parsedPrompt.requestedFields.map((f) => f.toLowerCase()));
    const candidateFields = schema.fields.length ? schema.fields : buildFallbackFields(parsedPrompt);
    const selectedForConnectors = candidateFields.filter(
      (f) => requestedSet.size === 0 || requestedSet.has(f.fieldName.toLowerCase())
    );

    const connectorsBundle = buildConnectors(parsedPrompt, selectedForConnectors, CONFIG.sourceCollection);
    const generated = generateFormConfig({
      parsedPrompt,
      schema: {
        ...schema,
        fields: candidateFields,
      },
      connectorsBundle,
    });

    const persisted = await persistOutputs({
      db,
      formOutputCollection: CONFIG.formOutputCollection,
      runOutputCollection: CONFIG.runOutputCollection,
      payload: {
        prompt,
        sourceCollection: CONFIG.sourceCollection,
        formJson: generated.formJson,
        rules: generated.rules,
        dependencies: generated.dependencies,
        summary: {
          selectedFields: generated.selectedFields.map((f) => f.fieldName),
          connectors: generated.formJson.connectors.map((c) => c.name),
        },
      },
    });

    const result = {
      message: "AI form configuration completed successfully.",
      database: CONFIG.dbName,
      sourceCollection: CONFIG.sourceCollection,
      outputCollections: {
        formOutputCollection: CONFIG.formOutputCollection,
        runOutputCollection: CONFIG.runOutputCollection,
      },
      generated: {
        formName: generated.formJson.name,
        fields: generated.selectedFields.map((f) => f.fieldName),
        connectors: generated.formJson.connectors.map((c) => c.name),
        rulesCount: generated.rules.length,
        dependenciesCount: generated.dependencies.length,
      },
      persisted,
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("AI form configuration failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (client) await client.close();
  }
}

run();
