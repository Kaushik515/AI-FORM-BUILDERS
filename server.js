import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { connectMongo } from "./src/services/mongoService.js";
import { analyzeCollectionSchema } from "./src/services/schemaAnalyzer.js";
import { parsePrompt } from "./src/services/promptParser.js";
import { buildConnectors } from "./src/services/connectorGenerator.js";
import { generateFormConfig } from "./src/services/formGenerator.js";
import { generateGrapesFormConfig } from "./src/services/grapesFormGenerator.js";
import { persistOutputs } from "./src/services/persistenceService.js";
import { publishToUiBuilder } from "./src/services/formPublisher.js";
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

async function getDBByName(dbName) {
  const conn = await connectMongo(CONFIG.mongodbUri, dbName);
  return conn;
}

// API Routes

// List databases available in the configured MongoDB URI
app.get("/api/databases", async (req, res) => {
  try {
    const { client } = await getDB();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    await client.close();

    const names = (dbs.databases || [])
      .map((db) => db.name)
      .filter((name) => !["admin", "local", "config"].includes(name))
      .sort((a, b) => a.localeCompare(b));

    res.json({
      success: true,
      data: {
        currentDb: CONFIG.dbName,
        databases: names,
      },
    });
  } catch (error) {
    console.error("Error listing databases:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// List collections in a database
app.get("/api/databases/:dbName/collections", async (req, res) => {
  try {
    const { dbName } = req.params;
    const { client, db } = await getDBByName(dbName);

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const names = collections
      .map((item) => item.name)
      .filter((name) => !name.startsWith("system."))
      .sort((a, b) => a.localeCompare(b));

    await client.close();

    res.json({
      success: true,
      data: {
        dbName,
        currentCollection:
          dbName === CONFIG.dbName ? CONFIG.sourceCollection : null,
        collections: names,
      },
    });
  } catch (error) {
    console.error("Error listing collections:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    const { prompt, dbName, sourceCollection } = req.body;

    if (!prompt || !prompt.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Prompt is required" });
    }

    const selectedDbName = (dbName || CONFIG.dbName).trim();
    const selectedCollection = (sourceCollection || CONFIG.sourceCollection).trim();

    const parsedPrompt = parsePrompt(prompt);
    const { client, db } = await getDBByName(selectedDbName);

    const sourceCollectionRef = db.collection(selectedCollection);
    const schema = await analyzeCollectionSchema(sourceCollectionRef, 250);

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
      selectedCollection,
      selectedDbName
    );

    // Generate BOTH formats: legacy + GrapeJS-compatible
    const generated = generateFormConfig({
      parsedPrompt,
      schema: { ...schema, fields: candidateFields },
      connectorsBundle,
    });
    const grapesGenerated = generateGrapesFormConfig({
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
        sourceDatabase: selectedDbName,
        sourceCollection: selectedCollection,
        formJson: generated.formJson,
        rules: generated.rules,
        dependencies: generated.dependencies,
        grapesFormObjects: grapesGenerated.formObjects,
        grapesRuleData: grapesGenerated.rules,
        grapesDataQueries: grapesGenerated.dataQueries,
        grapesMetadata: grapesGenerated.metadata,
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

// Get GrapeJS-compatible formObjects for a form (as the real UI Builder would consume)
app.get("/api/forms/:id/grapes", async (req, res) => {
  try {
    const { id } = req.params;
    const { client, db } = await getDB();

    let form;
    try {
      form = await db.collection(CONFIG.formOutputCollection).findOne({ _id: new ObjectId(id) });
    } catch (e) {
      form = await db.collection(CONFIG.formOutputCollection).findOne({ _id: id });
    }
    await client.close();

    if (!form) {
      return res.status(404).json({ success: false, error: "Form not found" });
    }

    res.json({
      success: true,
      data: {
        _id: form._id,
        name: form.name,
        formObjects: form.grapesFormObjects,
        ruleData: form.grapesRuleData,
        dataQueries: form.grapesDataQueries,
        metadata: form.grapesMetadata,
      },
    });
  } catch (error) {
    console.error("Error getting grapes form:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resolve live options for a saved connector using its persisted pipeline
app.get("/api/forms/:id/connectors/:connectorId/options", async (req, res) => {
  try {
    const { id, connectorId } = req.params;
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

    const connector = (form.connectors || []).find((c) => c.connectorId === connectorId);
    if (!connector) {
      await client.close();
      return res.status(404).json({ success: false, error: "Connector not found" });
    }

    if (connector.type !== "mongodb-aggregation") {
      await client.close();
      return res.json({ success: true, data: [] });
    }

    const sourceCollectionName = connector.source?.collection || CONFIG.sourceCollection;
    const sourceDbName = connector.source?.database || form.sourceDatabase || CONFIG.dbName;
    const pipeline = Array.isArray(connector.source?.pipeline) ? connector.source.pipeline : [];

    const sourceDb = client.db(sourceDbName);
    const docs = await sourceDb
      .collection(sourceCollectionName)
      .aggregate(pipeline)
      .limit(500)
      .toArray();

    const labelField = connector.responseMapping?.labelField || "label";
    const valueField = connector.responseMapping?.valueField || "value";
    const options = docs
      .map((item) => ({
        label: item[labelField] ?? item.label ?? item.value ?? String(item._id ?? ""),
        value: item[valueField] ?? item.value ?? item[labelField] ?? String(item._id ?? ""),
      }))
      .filter((item) => item.label !== "" && item.value !== "");

    await client.close();
    return res.json({ success: true, data: options });
  } catch (error) {
    console.error("Error resolving connector options:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a single component from a form
app.delete("/api/forms/:id/components/:cmpId", async (req, res) => {
  try {
    const { id, cmpId } = req.params;
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
    const filtered = components.filter((c) => c.id !== cmpId);

    if (filtered.length === components.length) {
      await client.close();
      return res.status(404).json({ success: false, error: "Component not found" });
    }

    // Also remove matching connector
    const removedCmp = components.find((c) => c.id === cmpId);
    let connectors = form.connectors || [];
    if (removedCmp?.attributes?.name) {
      connectors = connectors.filter(
        (c) => c.targetField !== removedCmp.attributes.name
      );
    }

    try {
      await db.collection(CONFIG.formOutputCollection).updateOne(
        { _id: new ObjectId(id) },
        { $set: { "formObjects.components": filtered, connectors, updatedAt: new Date() } }
      );
    } catch (e) {
      await db.collection(CONFIG.formOutputCollection).updateOne(
        { _id: id },
        { $set: { "formObjects.components": filtered, connectors, updatedAt: new Date() } }
      );
    }

    await client.close();
    res.json({ success: true, message: "Component deleted", remainingCount: filtered.length });
  } catch (error) {
    console.error("Error deleting component:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save form customization (reorder, positions, AI upgrades)
app.put("/api/forms/:id/customize", async (req, res) => {
  try {
    const { id } = req.params;
    const { componentOrder, positions, aiUpgrades } = req.body;
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

    // Reorder based on componentOrder, drop any deleted components
    const reordered = [];
    if (Array.isArray(componentOrder)) {
      for (const cid of componentOrder) {
        if (idMap.has(cid)) {
          const comp = idMap.get(cid);
          comp.attributes.order = reordered.length + 1;
          // Apply position
          if (Array.isArray(positions)) {
            const pos = positions.find((p) => p.id === cid);
            if (pos) comp.position = { x: pos.x, y: pos.y };
          }
          // Mark AI upgrade
          if (aiUpgrades && aiUpgrades[cid]) {
            comp.aiUpgraded = true;
          } else {
            delete comp.aiUpgraded;
          }
          reordered.push(comp);
        }
      }
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
    res.json({ success: true, message: "Customization saved", componentsCount: reordered.length });
  } catch (error) {
    console.error("Error saving customization:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish form to dfe.forms (exact UI Builder document format)
app.post("/api/forms/:id/publish", async (req, res) => {
  try {
    const { id } = req.params;
    const { client, db } = await getDB();

    // 1. Load the POC form
    let pocForm;
    try {
      pocForm = await db.collection(CONFIG.formOutputCollection).findOne({ _id: new ObjectId(id) });
    } catch (e) {
      pocForm = await db.collection(CONFIG.formOutputCollection).findOne({ _id: id });
    }

    if (!pocForm) {
      await client.close();
      return res.status(404).json({ success: false, error: "Form not found" });
    }

    // 2. Get the target database (dfe)
    const targetDbName = pocForm.sourceDatabase || CONFIG.dbName;
    const targetDb = client.db(targetDbName);

    // 3. Publish — writes to dfe.forms and optionally dfe.dataqueries
    const result = await publishToUiBuilder({
      db: targetDb,
      pocForm,
      createdBy: "AI Form Generator",
      companyId: 0,
      companyName: "",
      createDataQueries: true,
    });

    // 4. Mark the POC form as published
    const updateFields = {
      publishedFormId: result.publishedFormId,
      publishedAt: new Date(),
      status: "published",
      updatedAt: new Date(),
    };
    try {
      await db.collection(CONFIG.formOutputCollection).updateOne(
        { _id: new ObjectId(id) },
        { $set: updateFields }
      );
    } catch (e) {
      await db.collection(CONFIG.formOutputCollection).updateOne(
        { _id: id },
        { $set: updateFields }
      );
    }

    await client.close();

    res.json({
      success: true,
      data: {
        message: "Form published to UI Builder successfully",
        publishedFormId: result.publishedFormId,
        publishedFormName: result.publishedFormName,
        dataQueryIds: result.dataQueryIds,
        componentsCount: result.formObjectsPreview,
        targetDatabase: targetDbName,
        targetCollection: "forms",
      },
    });
  } catch (error) {
    console.error("Error publishing form:", error.message);
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
