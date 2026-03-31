import crypto from "node:crypto";

export function generateId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
