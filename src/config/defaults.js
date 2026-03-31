import dotenv from "dotenv";

dotenv.config();

const fallbackUri = "mongodb+srv://Appuser:Poc@123@cluster0.dqtqsx6.mongodb.net/";

export const CONFIG = {
  mongodbUri: process.env.MONGODB_URI || fallbackUri,
  dbName: process.env.MONGODB_DB_NAME || "appdb",
  sourceCollection: process.env.MONGODB_COLLECTION || "sample_mflix",
  prompt:
    process.env.FORM_PROMPT ||
    "Create a big movie form with title, director, cast, year and reviews",
  formOutputCollection: process.env.FORM_OUTPUT_COLLECTION || "ui_builder_forms",
  runOutputCollection: process.env.RUN_OUTPUT_COLLECTION || "ui_builder_form_runs",
};
