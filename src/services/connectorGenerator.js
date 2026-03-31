import { generateId } from "../utils/id.js";

export function buildConnectors(parsedPrompt, selectedFields, sourceCollection) {
  const formId = generateId("form");
  const connectors = [];

  const byTargetField = new Set();

  if (parsedPrompt.includeReviewsSection) {
    connectors.push({
      connectorId: generateId("connector"),
      type: "computed",
      name: "Review Summary Connector",
      purpose: "Prepare review preview text",
      source: {
        transform: "combine review count and average score when available",
      },
      targetField: "reviews",
      autoLoad: true,
    });
    byTargetField.add("reviews");
  }

  // Process selected fields and create connectors for fields that need data binding
  selectedFields.forEach((field) => {
    const fieldName = field.fieldName.toLowerCase();

    const needsConnector =
      fieldName.includes("cast") ||
      fieldName.includes("director") ||
      fieldName.includes("genre") ||
      fieldName.includes("actor") ||
      fieldName.includes("category") ||
      fieldName.includes("status") ||
      fieldName.includes("type") ||
      fieldName.includes("country");

    if (needsConnector && !byTargetField.has(fieldName)) {
      const unwindField = fieldName.includes("cast")
        ? "cast"
        : fieldName.includes("director")
        ? "directors"
        : fieldName.includes("genre")
        ? "genres"
        : fieldName;

      const pipeline = [
        { $unwind: `$${unwindField}` },
        {
          $group: {
            _id: `$${unwindField}`,
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            label: "$_id",
            value: "$_id",
            itemCount: "$count",
            _id: 0,
          },
        },
        { $sort: { label: 1 } },
        { $limit: 500 },
      ];

      connectors.push({
        connectorId: generateId("connector"),
        type: "mongodb-aggregation",
        name: `${field.fieldName} Data Connector`,
        purpose: `Fetch unique ${field.fieldName} values from ${sourceCollection}`,
        targetField: fieldName,
        autoLoad: true,
        source: {
          collection: sourceCollection,
          database: "appdb",
          pipeline,
        },
        dataBindingType: "dropdown",
        responseMapping: {
          labelField: "label",
          valueField: "value",
        },
        caching: {
          enabled: true,
          ttl: 3600,
        },
      });
      byTargetField.add(fieldName);
    }
  });

  return { formId, connectors };

}
