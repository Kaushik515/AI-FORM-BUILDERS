import dotenv from "dotenv";

dotenv.config();

const fallbackUri = "mongodb://formengine:formengine1234@ec2-65-1-207-137.ap-south-1.compute.amazonaws.com:27017/";

export const CONFIG = {
  mongodbUri: process.env.MONGODB_URI || fallbackUri,
  dbName: process.env.MONGODB_DB_NAME || "dfe",
  sourceCollection: process.env.MONGODB_COLLECTION || "connectors",
  prompt:
    process.env.FORM_PROMPT ||
    "Create a big movie form with title, director, cast, year and reviews",
  formOutputCollection: process.env.FORM_OUTPUT_COLLECTION || "ui_builder_forms",
  runOutputCollection: process.env.RUN_OUTPUT_COLLECTION || "ui_builder_form_runs",
};
