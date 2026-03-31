import { MongoClient } from "mongodb";

function safeEncodePassword(rawPassword = "") {
  try {
    return encodeURIComponent(decodeURIComponent(rawPassword));
  } catch {
    return encodeURIComponent(rawPassword);
  }
}

function normalizeMongoUri(uri = "") {
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    return uri;
  }

  const protocol = uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
  const withoutProtocol = uri.slice(protocol.length);
  const slashIndex = withoutProtocol.indexOf("/");
  const authority = slashIndex >= 0 ? withoutProtocol.slice(0, slashIndex) : withoutProtocol;
  const tail = slashIndex >= 0 ? withoutProtocol.slice(slashIndex) : "";

  const lastAt = authority.lastIndexOf("@");
  if (lastAt < 0) return uri;

  const creds = authority.slice(0, lastAt);
  const host = authority.slice(lastAt + 1);
  const colonIndex = creds.indexOf(":");
  if (colonIndex < 0) return uri;

  const user = creds.slice(0, colonIndex);
  const password = creds.slice(colonIndex + 1);
  const encodedPassword = safeEncodePassword(password);

  return `${protocol}${user}:${encodedPassword}@${host}${tail}`;
}

export async function connectMongo(mongodbUri, dbName) {
  const normalizedUri = normalizeMongoUri(mongodbUri);
  const client = new MongoClient(normalizedUri, {
    serverSelectionTimeoutMS: 15000,
  });

  await client.connect();
  const db = client.db(dbName);
  return { client, db };
}
