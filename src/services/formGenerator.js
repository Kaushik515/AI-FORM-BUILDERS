import { generateId } from "../utils/id.js";
import { inferValidation, mapFieldToComponent } from "../utils/typeMapper.js";

function humanize(fieldName) {
  return String(fieldName)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildFieldComponent(field, orderIndex, connectorMap = {}) {
  const componentType = mapFieldToComponent(field.fieldName, field.observedTypes, field.sampleValues);
  const validation = inferValidation(field.fieldName, field.observedTypes, field.stats);
  const baseId = generateId("cmp");

    const connector = connectorMap[field.fieldName] || connectorMap[field.fieldName.toLowerCase()];
    const componentAttrs = {
      name: field.fieldName,
      label: humanize(field.fieldName),
      placeholder: `Enter ${humanize(field.fieldName).toLowerCase()}`,
      required: !!validation.required,
      validation,
      order: orderIndex + 1,
    };

    // Add connector binding if connector exists
    if (connector) {
      componentAttrs.connector = {
        connectorId: connector.connectorId,
        type: connector.type,
        autoLoad: true,
        source: connector.source,
      };
      componentAttrs.dataSource = connector.connectorId;
      if (connector.dataBindingType) {
        componentAttrs.dataBindingType = connector.dataBindingType;
      }
      if (connector.responseMapping) {
        componentAttrs.responseMapping = connector.responseMapping;
      }
    } else {
      componentAttrs.connector = null;
    }

    return {
      id: baseId,
      type: componentType,
      attributes: componentAttrs,
      style: {
        width: "100%",
        marginBottom: "12px",
      },
    };
}

export function generateFormConfig({ parsedPrompt, schema, connectorsBundle }) {
  const requested = new Set(parsedPrompt.requestedFields.map((v) => v.toLowerCase()));
  const selectedFields = schema.fields.filter(
    (field) => requested.size === 0 || requested.has(field.fieldName.toLowerCase())
  );

  const connectorMap = {};
  (connectorsBundle?.connectors || []).forEach((connector) => {
    if (connector.targetField) {
      connectorMap[connector.targetField] = connector;
      connectorMap[String(connector.targetField).toLowerCase()] = connector;
    }
  });

  const components = selectedFields.map((field, idx) =>
    buildFieldComponent(field, idx, connectorMap)
  );

  if (parsedPrompt.includeBigLayout) {
    components.push({
      id: generateId("cmp"),
      type: "titleComponent",
      attributes: {
        name: "sectionHeader",
        label: "Section Header",
        text: "Additional Details",
        level: "h3",
      },
      style: { marginTop: "20px", marginBottom: "10px" },
    });
  }

  const formJson = {
    version: "1.0",
    source: "ai-automation-poc",
    name: parsedPrompt.formName,
    slug: parsedPrompt.formSlug,
    entity: parsedPrompt.entity,
    formType: "group",
    state: "draft",
    components,
    connectors: connectorsBundle?.connectors || [],
    metadata: {
      generatedAt: new Date().toISOString(),
      requestedFields: parsedPrompt.requestedFields,
      sampleSize: schema.sampleSize,
    },
  };

  const rules = selectedFields.map((field) => {
    const isRequired = field.stats.nonNullRatio >= 0.7;
    return {
      field: field.fieldName,
      ruleType: "required",
      enabled: isRequired,
      message: `${humanize(field.fieldName)} is required`,
    };
  });

  const dependencies = [];

  return {
    selectedFields,
    formJson,
    rules,
    dependencies,
  };
}
