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
    sourceCollection: payload.sourceCollection,
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
