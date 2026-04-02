const INPUT_COMPONENT = "myInputComponent";

function isIsoDateString(value) {
  return typeof value === "string" && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:/.test(value);
}

function inferPrimitiveType(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (isIsoDateString(value)) return "date";
  return typeof value;
}

export function mapFieldToComponent(fieldName, observedTypes = [], values = []) {
  const lower = String(fieldName).toLowerCase();
  const hasType = (name) => observedTypes.includes(name);

  // Long text fields → textarea
  if (
    lower.includes("description") || lower.includes("summary") || lower.includes("comment") ||
    lower.includes("note") || lower.includes("body") || lower.includes("content") ||
    lower.includes("review") || lower.includes("message") || lower.includes("text") ||
    lower.includes("query_string") || lower.includes("headers")
  ) {
    return "textarea";
  }

  // Rating/score → star rating
  if (lower.includes("rating") || lower.includes("score") || lower.includes("stars")) {
    return "starRatingComponent";
  }

  // Numeric fields → input
  if (
    lower.includes("year") || lower.includes("count") || lower.includes("duration") ||
    lower.includes("age") || lower.includes("amount") || lower.includes("price") ||
    lower.includes("quantity") || lower.includes("order") ||
    hasType("number")
  ) {
    return INPUT_COMPONENT;
  }

  // Date/time fields → date picker
  if (
    lower.includes("date") || lower.includes("created") || lower.includes("updated") ||
    lower.includes("modified") || lower.includes("time") || lower.includes("_at") ||
    lower.endsWith("at") ||
    hasType("date")
  ) {
    return "myDateTimeComponent";
  }

  // Arrays of strings → dropdown or typeahead based on cardinality
  if (hasType("array")) {
    const hasStringArrays = values.some(
      (v) => Array.isArray(v) && v.every((it) => typeof it === "string")
    );
    if (hasStringArrays) {
      // Small enum-like arrays → dropdown; large/variable → typeahead
      const maxLen = Math.max(0, ...values.filter(Array.isArray).map((v) => v.length));
      return maxLen > 10 ? "typeaheadComponent" : "custom-dropdown";
    }
    return "textarea";
  }

  // Boolean → switch
  if (hasType("boolean")) {
    return "switch-button";
  }

  // Object → textarea (JSON display)
  if (hasType("object")) {
    // Check if it looks like a small enum-like object with id/label
    const hasIdLabel = values.some(
      (v) => v && typeof v === "object" && !Array.isArray(v) && ("id" in v || "label" in v || "value" in v)
    );
    if (hasIdLabel) return "custom-dropdown";
    return "textarea";
  }

  // String fields — check cardinality for dropdown vs input
  if (hasType("string") && values.length > 0) {
    const uniqueValues = new Set(values.filter((v) => typeof v === "string"));
    // Low cardinality enum → dropdown
    if (uniqueValues.size > 1 && uniqueValues.size <= 20) {
      return "custom-dropdown";
    }
  }

  // Email / URL
  if (lower.includes("email")) return INPUT_COMPONENT;
  if (lower.includes("url") || lower.includes("link")) return INPUT_COMPONENT;

  return INPUT_COMPONENT;
}

export function inferValidation(fieldName, observedTypes = [], stats = {}) {
  const lower = String(fieldName).toLowerCase();
  const rules = {
    required: stats.nonNullRatio >= 0.7,
  };

  if (lower.includes("email")) {
    rules.pattern = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";
    rules.message = "Enter a valid email address";
  }

  if (lower.includes("year") || observedTypes.includes("number")) {
    rules.numeric = true;
    if (lower.includes("year")) {
      rules.min = 1880;
      rules.max = new Date().getFullYear() + 1;
    }
  }

  if (stats.maxStringLength) {
    rules.maxLength = Math.min(stats.maxStringLength + 20, 2000);
  }

  return rules;
}

export function collectTypesFromSamples(values = []) {
  const types = new Set(values.map((value) => inferPrimitiveType(value)));
  return [...types];
}
