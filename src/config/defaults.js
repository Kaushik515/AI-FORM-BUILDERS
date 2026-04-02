import dotenv from "dotenv";

dotenv.config();

if (!process.env.MONGODB_URI) {
  console.error("ERROR: MONGODB_URI is not set. Copy .env.example to .env and fill in your credentials.");
  process.exit(1);
}

export const CONFIG = {
  mongodbUri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DB_NAME || "dfe",
  sourceCollection: process.env.MONGODB_COLLECTION || "connectors",
  prompt:
    process.env.FORM_PROMPT ||
    "Create a big movie form with title, director, cast, year and reviews",
  formOutputCollection: process.env.FORM_OUTPUT_COLLECTION || "ui_builder_forms",
  runOutputCollection: process.env.RUN_OUTPUT_COLLECTION || "ui_builder_form_runs",
  companyId: parseInt(process.env.COMPANY_ID || "0", 10),
  companyName: process.env.COMPANY_NAME || "Default Company",
};
