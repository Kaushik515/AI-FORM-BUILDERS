import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { connectMongo } from "./src/services/mongoService.js";
import { analyzeCollectionSchema } from "./src/services/schemaAnalyzer.js";
import { parsePrompt } from "./src/services/promptParser.js";
import { buildConnectors } from "./src/services/connectorGenerator.js";
import { generateFormConfig } from "./src/services/formGenerator.js";
import { persistOutputs } from "./src/services/persistenceService.js";
import { CONFIG } from "./src/config/defaults.js";
import { ObjectId } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Helper to get DB connection
async function getDB() {
  const conn = await connectMongo(CONFIG.mongodbUri, CONFIG.dbName);
  return conn;
}

// API Routes

// List all forms
app.get("/api/forms", async (req, res) => {
  try {
    const { client, db } = await getDB();
    const forms = await db
      .collection(CONFIG.formOutputCollection)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    await client.close();
    res.json({ success: true, data: forms });
  } catch (error) {
    console.error("Error listing forms:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get form detail
app.get("/api/forms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { client, db } = await getDB();

    let form;
    try {
      form = await db
        .collection(CONFIG.formOutputCollection)
        .findOne({ _id: new ObjectId(id) });
    } catch (e) {
      form = await db
        .collection(CONFIG.formOutputCollection)
        .findOne({ _id: id });
    }

    await client.close();

    if (!form) {
      return res
        .status(404)
        .json({ success: false, error: "Form not found" });
    }

    res.json({ success: true, data: form });
  } catch (error) {
    console.error("Error getting form:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate new form
app.post("/api/forms/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Prompt is required" });
    }

    const parsedPrompt = parsePrompt(prompt);
    const { client, db } = await getDB();

    const sourceCollection = db.collection(CONFIG.sourceCollection);
    const schema = await analyzeCollectionSchema(sourceCollection, 250);

    function buildFallbackFields(parsedPrompt) {
      return parsedPrompt.requestedFields.map((fieldName) => ({
        fieldName,
        observedTypes: fieldName.toLowerCase().includes("year")
          ? ["number"]
          : ["string"],
        sampleValues: [],
        stats: {
          presentCount: 0,
          nullCount: 0,
          nonNullRatio: 0,
          maxStringLength: 200,
        },
      }));
    }

    const requestedSet = new Set(
      parsedPrompt.requestedFields.map((f) => f.toLowerCase())
    );
    const candidateFields =
      schema.fields.length > 0 ? schema.fields : buildFallbackFields(parsedPrompt);
    const selectedForConnectors = candidateFields.filter(
      (f) =>
        requestedSet.size === 0 || requestedSet.has(f.fieldName.toLowerCase())
    );

    const connectorsBundle = buildConnectors(
      parsedPrompt,
      selectedForConnectors,
      CONFIG.sourceCollection
    );
    const generated = generateFormConfig({
      parsedPrompt,
      schema: { ...schema, fields: candidateFields },
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

    await client.close();

    res.json({
      success: true,
      data: {
        message: "Form generated successfully",
        formId: persisted.formId,
        runId: persisted.runId,
        formName: generated.formJson.name,
        fieldsCount: generated.selectedFields.length,
        connectorsCount: generated.formJson.connectors.length,
      },
    });
  } catch (error) {
    console.error("Error generating form:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reorder form components
app.put("/api/forms/:id/reorder", async (req, res) => {
  try {
    const { id } = req.params;
    const { componentOrder } = req.body;

    if (!Array.isArray(componentOrder)) {
      return res.status(400).json({ success: false, error: "componentOrder must be an array of component IDs" });
    }

    const { client, db } = await getDB();

    let form;
    try {
      form = await db.collection(CONFIG.formOutputCollection).findOne({ _id: new ObjectId(id) });
    } catch (e) {
      form = await db.collection(CONFIG.formOutputCollection).findOne({ _id: id });
    }

    if (!form) {
      await client.close();
      return res.status(404).json({ success: false, error: "Form not found" });
    }

    const components = form.formObjects?.components || [];
    const idMap = new Map(components.map((c) => [c.id, c]));
    const reordered = [];
    for (const cid of componentOrder) {
      if (idMap.has(cid)) {
        const comp = idMap.get(cid);
        comp.attributes.order = reordered.length + 1;
        reordered.push(comp);
        idMap.delete(cid);
      }
    }
    // Append any components not in the reorder list
    for (const remaining of idMap.values()) {
      remaining.attributes.order = reordered.length + 1;
      reordered.push(remaining);
    }

    try {
      await db.collection(CONFIG.formOutputCollection).updateOne(
        { _id: new ObjectId(id) },
        { $set: { "formObjects.components": reordered, updatedAt: new Date() } }
      );
    } catch (e) {
      await db.collection(CONFIG.formOutputCollection).updateOne(
        { _id: id },
        { $set: { "formObjects.components": reordered, updatedAt: new Date() } }
      );
    }

    await client.close();
    res.json({ success: true, message: "Layout saved", componentsCount: reordered.length });
  } catch (error) {
    console.error("Error reordering form:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save free-position layout
app.put("/api/forms/:id/positions", async (req, res) => {
  try {
    const { id } = req.params;
    const { positions } = req.body;

    if (!Array.isArray(positions)) {
      return res.status(400).json({ success: false, error: "positions must be an array" });
    }

    const { client, db } = await getDB();

    let form;
    try {
      form = await db.collection(CONFIG.formOutputCollection).findOne({ _id: new ObjectId(id) });
    } catch (e) {
      form = await db.collection(CONFIG.formOutputCollection).findOne({ _id: id });
    }

    if (!form) {
      await client.close();
      return res.status(404).json({ success: false, error: "Form not found" });
    }

    const components = form.formObjects?.components || [];
    const posMap = new Map(positions.map((p) => [p.id, { x: p.x, y: p.y }]));

    // Sort by y then x to derive display order
    const sorted = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);
    const orderMap = new Map(sorted.map((p, i) => [p.id, i + 1]));

    const updated = components.map((c) => {
      if (posMap.has(c.id)) {
        c.position = posMap.get(c.id);
        c.attributes.order = orderMap.get(c.id) || c.attributes.order;
      }
      return c;
    });

    const idField = form._id;
    try {
      await db.collection(CONFIG.formOutputCollection).updateOne(
        { _id: new ObjectId(id) },
        { $set: { "formObjects.components": updated, updatedAt: new Date() } }
      );
    } catch (e) {
      await db.collection(CONFIG.formOutputCollection).updateOne(
        { _id: id },
        { $set: { "formObjects.components": updated, updatedAt: new Date() } }
      );
    }

    await client.close();
    res.json({ success: true, message: "Positions saved", count: updated.length });
  } catch (error) {
    console.error("Error saving positions:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete form
app.delete("/api/forms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { client, db } = await getDB();

    let result;
    try {
      result = await db
        .collection(CONFIG.formOutputCollection)
        .deleteOne({ _id: new ObjectId(id) });
    } catch (e) {
      result = await db
        .collection(CONFIG.formOutputCollection)
        .deleteOne({ _id: id });
    }

    await client.close();

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Form not found" });
    }

    res.json({ success: true, message: "Form deleted successfully" });
  } catch (error) {
    console.error("Error deleting form:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ AI Form Generator UI running at http://localhost:${PORT}\n`);
  console.log(`   Open in browser: http://localhost:${PORT}\n`);
});
