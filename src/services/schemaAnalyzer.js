import { collectTypesFromSamples } from "../utils/typeMapper.js";

function addFieldStat(fieldMap, fieldName, value) {
  if (!fieldMap[fieldName]) {
    fieldMap[fieldName] = {
      fieldName,
      samples: [],
      nullCount: 0,
      presentCount: 0,
      maxStringLength: 0,
    };
  }

  const node = fieldMap[fieldName];
  node.presentCount += 1;

  if (value === null || value === undefined) {
    node.nullCount += 1;
    return;
  }

  node.samples.push(value);
  if (typeof value === "string") {
    node.maxStringLength = Math.max(node.maxStringLength, value.length);
  }
}

export async function analyzeCollectionSchema(collection, sampleSize = 200) {
  const docs = await collection.find({}, { projection: { _id: 0 } }).limit(sampleSize).toArray();

  if (!docs.length) {
    return {
      sampleSize: 0,
      fields: [],
    };
  }

  const fieldMap = {};
  docs.forEach((doc) => {
    Object.entries(doc).forEach(([fieldName, value]) => {
      addFieldStat(fieldMap, fieldName, value);
    });
  });

  const totalDocs = docs.length;
  const fields = Object.values(fieldMap)
    .map((item) => {
      const values = item.samples.slice(0, 20);
      return {
        fieldName: item.fieldName,
        observedTypes: collectTypesFromSamples(values),
        sampleValues: values,
        stats: {
          presentCount: item.presentCount,
          nullCount: item.nullCount,
          nonNullRatio: item.presentCount ? (item.presentCount - item.nullCount) / item.presentCount : 0,
          maxStringLength: item.maxStringLength,
        },
      };
    })
    .sort((a, b) => b.stats.nonNullRatio - a.stats.nonNullRatio);

  return {
    sampleSize: totalDocs,
    fields,
  };
}
