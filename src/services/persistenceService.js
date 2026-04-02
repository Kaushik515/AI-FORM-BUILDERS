export async function persistOutputs({
  db,
  formOutputCollection,
  runOutputCollection,
  payload,
}) {
  const formsCol = db.collection(formOutputCollection);
  const runsCol = db.collection(runOutputCollection);

  const formRecord = {
    name: payload.formJson.name,
    slug: payload.formJson.slug,
    formObjects: payload.formJson,
    connectors: payload.formJson.connectors,
    rules: payload.rules,
    dependencies: payload.dependencies,
    sourceDatabase: payload.sourceDatabase,
    sourceCollection: payload.sourceCollection,
    // GrapeJS-compatible data (matches real UI Builder format)
    grapesFormObjects: payload.grapesFormObjects || null,
    grapesRuleData: payload.grapesRuleData || null,
    grapesDataQueries: payload.grapesDataQueries || null,
    grapesMetadata: payload.grapesMetadata || null,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: "draft",
  };

  const formInsert = await formsCol.insertOne(formRecord);

  const runInsert = await runsCol.insertOne({
    prompt: payload.prompt,
    generatedFormId: formInsert.insertedId,
    summary: payload.summary,
    createdAt: new Date(),
  });

  return {
    formId: formInsert.insertedId,
    runId: runInsert.insertedId,
  };
}
