import { slugify } from "../utils/id.js";

const KNOWN_MOVIE_FIELDS = ["title", "director", "cast", "year", "reviews"];

function parseListFromPrompt(prompt) {
  const normalized = String(prompt).replace(/\s+/g, " ").trim();
  const match = normalized.match(/with\s+(.+)$/i);
  if (!match) return [];

  const csvLike = match[1].replace(/\s+and\s+/gi, ",");
  return csvLike
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

export function parsePrompt(prompt) {
  const text = String(prompt || "").trim();
  const lower = text.toLowerCase();

  const explicit = parseListFromPrompt(text);
  const requestedFields = explicit.length ? explicit : KNOWN_MOVIE_FIELDS.filter((f) => lower.includes(f));

  const entity = lower.includes("movie") ? "movie" : "generic";
  const formName = entity === "movie" ? "AI Movie Form" : "AI Generated Form";

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
