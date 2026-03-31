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

  if (lower.includes("review") || lower.includes("description") || lower.includes("summary")) {
    return "textarea";
  }

  if (lower.includes("rating") || lower.includes("score") || lower.includes("stars")) {
    return "starRatingComponent";
  }

  if (lower.includes("year") || lower.includes("count") || lower.includes("duration") || hasType("number")) {
    return INPUT_COMPONENT;
  }

  if (
    lower.includes("date") ||
    lower.includes("created") ||
    lower.includes("updated") ||
    lower.includes("release") ||
    lower.includes("time") ||
    hasType("date")
  ) {
    return "myDateTimeComponent";
  }

  if (hasType("array")) {
    if (values.some((v) => Array.isArray(v) && v.every((it) => typeof it === "string"))) {
      if (
        lower.includes("cast") ||
        lower.includes("director") ||
        lower.includes("actor") ||
        lower.includes("genre")
      ) {
        return "custom-dropdown";
      }
      return "typeaheadComponent";
    }
    return "textarea";
  }

  if (hasType("boolean")) {
    return "switch-button";
  }

  if (lower.includes("email")) return INPUT_COMPONENT;
  if (lower.includes("url") || lower.includes("link")) return INPUT_COMPONENT;

  if (
    lower.includes("cast") ||
    lower.includes("director") ||
    lower.includes("actor") ||
    lower.includes("genre") ||
    lower.includes("category") ||
    lower.includes("status") ||
    lower.includes("type") ||
    lower.includes("country")
  ) {
    return "custom-dropdown";
  }

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
