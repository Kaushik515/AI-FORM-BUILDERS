import { generateId } from "../utils/id.js";

/**
 * Detect if a field should have a data-binding connector based on its actual
 * observed data (types, sample values, cardinality) rather than hardcoded names.
 */
function fieldNeedsConnector(field) {
  const lower = field.fieldName.toLowerCase();
  const types = field.observedTypes || [];
  const samples = field.sampleValues || [];

  // Skip internal/meta fields
  if (lower === "_id" || lower === "__v" || lower.startsWith("_")) return false;

  // Arrays of strings → dropdown / typeahead
  if (types.includes("array")) {
    const hasStringArrays = samples.some(
      (v) => Array.isArray(v) && v.length > 0 && v.every((it) => typeof it === "string")
    );
    if (hasStringArrays) return true;
  }

  // String fields with low cardinality (enum-like) → dropdown
  if (types.includes("string") && samples.length > 0) {
    const uniqueValues = new Set(samples.filter((v) => typeof v === "string"));
    // If fewer than 50 unique values in the sample, treat as categorical
    if (uniqueValues.size > 1 && uniqueValues.size <= 50) return true;
  }

  // Object fields with nested structure → could be connector-driven
  if (types.includes("object")) return true;

  return false;
}

export function buildConnectors(
  parsedPrompt,
  selectedFields,
  sourceCollection,
  sourceDatabase = "dfe"
) {
  const formId = generateId("form");
  const connectors = [];
  const byTargetField = new Set();

  selectedFields.forEach((field) => {
    const fieldName = field.fieldName;
    const lower = fieldName.toLowerCase();

    if (byTargetField.has(lower)) return;
    if (!fieldNeedsConnector(field)) return;

    const isArray = (field.observedTypes || []).includes("array");

    // Build a pipeline that extracts distinct values for this field
    const pipeline = isArray
      ? [
          { $unwind: `$${fieldName}` },
          { $group: { _id: `$${fieldName}`, count: { $sum: 1 } } },
          { $project: { label: "$_id", value: "$_id", itemCount: "$count", _id: 0 } },
          { $sort: { label: 1 } },
          { $limit: 500 },
        ]
      : [
          { $group: { _id: `$${fieldName}`, count: { $sum: 1 } } },
          { $match: { _id: { $ne: null } } },
          { $project: { label: { $toString: "$_id" }, value: { $toString: "$_id" }, itemCount: "$count", _id: 0 } },
          { $sort: { label: 1 } },
          { $limit: 500 },
        ];

    connectors.push({
      connectorId: generateId("connector"),
      type: "mongodb-aggregation",
      name: `${fieldName} Data Connector`,
      purpose: `Fetch unique ${fieldName} values from ${sourceCollection}`,
      targetField: lower,
      autoLoad: true,
      source: {
        collection: sourceCollection,
        database: sourceDatabase,
        pipeline,
      },
      dataBindingType: isArray ? "typeahead" : "dropdown",
      responseMapping: {
        labelField: "label",
        valueField: "value",
      },
      caching: {
        enabled: true,
        ttl: 3600,
      },
    });
    byTargetField.add(lower);
  });

  return { formId, connectors };
}
