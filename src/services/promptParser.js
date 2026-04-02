import { slugify } from "../utils/id.js";

function parseListFromPrompt(prompt) {
  const normalized = String(prompt).replace(/\s+/g, " ").trim();

  // Try "with field1, field2 and field3"
  const withMatch = normalized.match(/with\s+(.+)$/i);
  if (withMatch) {
    const csvLike = withMatch[1].replace(/\s+and\s+/gi, ",");
    return csvLike
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((token) => token.toLowerCase());
  }

  // Try "fields: field1, field2, field3" or "fields field1 field2"
  const fieldsMatch = normalized.match(/fields?[:\s]+(.+)$/i);
  if (fieldsMatch) {
    const csvLike = fieldsMatch[1].replace(/\s+and\s+/gi, ",");
    return csvLike
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((token) => token.toLowerCase());
  }

  return [];
}

function extractEntityName(text) {
  const lower = text.toLowerCase();
  // Try "Create a <entity> form" or "Build <entity> form"
  const match = lower.match(/(?:create|build|generate|make)\s+(?:a\s+)?(?:big\s+)?(.+?)\s+form/i);
  if (match) {
    const entity = match[1].trim();
    // Skip generic words
    if (!["new", "simple", "basic", "the", "my"].includes(entity)) {
      return entity;
    }
  }
  return "generic";
}

export function parsePrompt(prompt) {
  const text = String(prompt || "").trim();
  const lower = text.toLowerCase();

  const explicit = parseListFromPrompt(text);
  // If no explicit fields, return empty — let schemaAnalyzer provide ALL fields from the collection
  const requestedFields = explicit;

  const entity = extractEntityName(text);
  const formName = entity !== "generic"
    ? `AI ${entity.charAt(0).toUpperCase() + entity.slice(1)} Form`
    : "AI Generated Form";

  return {
    rawPrompt: text,
    entity,
    formName,
    formSlug: slugify(formName),
    requestedFields,
    includeReviewsSection: lower.includes("review"),
    includeBigLayout: lower.includes("big"),
  };
}
