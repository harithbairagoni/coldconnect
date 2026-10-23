import firebaseConfig from "../../../firebase-applet-config.json";

function getFirestoreBaseUrl(): string {
  const dbId =
    firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
      ? firebaseConfig.firestoreDatabaseId
      : "(default)";
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${dbId}/documents`;
}

export function toFirestoreValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === "boolean") {
    return { booleanValue: val };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === "string") {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.filter((v) => v !== undefined).map(toFirestoreValue),
      },
    };
  }
  if (typeof val === "object") {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export function fromFirestoreValue(val: unknown): unknown {
  if (!val || typeof val !== "object") return val;
  const obj = val as Record<string, unknown>;

  if ("stringValue" in obj) return obj.stringValue;
  if ("booleanValue" in obj) return obj.booleanValue;
  if ("integerValue" in obj) return parseInt(String(obj.integerValue), 10);
  if ("doubleValue" in obj) return Number(obj.doubleValue);
  if ("nullValue" in obj) return null;
  if ("timestampValue" in obj) return obj.timestampValue;
  if ("arrayValue" in obj) {
    const arr = obj.arrayValue as { values?: unknown[] } | undefined;
    return (arr?.values || []).map(fromFirestoreValue);
  }
  if ("mapValue" in obj) {
    const map = obj.mapValue as { fields?: Record<string, unknown> } | undefined;
    const res: Record<string, unknown> = {};
    const fields = map?.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = fromFirestoreValue(v);
    }
    return res;
  }
  return obj;
}

export function parseFirestoreDocument<T = Record<string, unknown>>(doc: {
  name?: string;
  fields?: Record<string, unknown>;
  createTime?: string;
  updateTime?: string;
}): T & { id: string } {
  const id = doc.name ? doc.name.split("/").pop() || "" : "";
  const result: Record<string, unknown> = { id };
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      result[k] = fromFirestoreValue(v);
    }
  }
  return result as T & { id: string };
}

export async function getServerFirestoreDoc<T = Record<string, unknown>>(
  path: string,
  idToken: string,
): Promise<(T & { id: string }) | null> {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const url = `${getFirestoreBaseUrl()}/${cleanPath}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore GET failed (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as { name?: string; fields?: Record<string, unknown> };
  return parseFirestoreDocument<T>(json);
}

export async function createFirestoreDoc<T = Record<string, unknown>>(
  parentPath: string,
  docId: string | null,
  data: Record<string, unknown>,
  idToken: string,
): Promise<T & { id: string }> {
  const cleanParent = parentPath.startsWith("/") ? parentPath.slice(1) : parentPath;
  const docIdParam = docId ? `?documentId=${encodeURIComponent(docId)}` : "";
  const url = `${getFirestoreBaseUrl()}/${cleanParent}${docIdParam}`;

  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore POST failed (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as { name?: string; fields?: Record<string, unknown> };
  return parseFirestoreDocument<T>(json);
}

export async function listFirestoreDocs<T = Record<string, unknown>>(
  parentPath: string,
  idToken: string,
): Promise<Array<T & { id: string }>> {
  const cleanParent = parentPath.startsWith("/") ? parentPath.slice(1) : parentPath;
  const url = `${getFirestoreBaseUrl()}/${cleanParent}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore list failed (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as {
    documents?: Array<{ name?: string; fields?: Record<string, unknown> }>;
  };
  if (!json.documents || !Array.isArray(json.documents)) {
    return [];
  }

  return json.documents.map((doc) => parseFirestoreDocument<T>(doc));
}

export async function updateServerFirestoreDoc(
  path: string,
  updates: Record<string, unknown>,
  idToken: string,
): Promise<void> {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  const keys = Object.keys(updates).filter((k) => updates[k] !== undefined);
  if (keys.length === 0) return;

  const updateMaskParams = keys
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `${getFirestoreBaseUrl()}/${cleanPath}?${updateMaskParams}`;

  const fields: Record<string, unknown> = {};
  for (const key of keys) {
    fields[key] = toFirestoreValue(updates[key]);
  }

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore PATCH failed (${res.status}): ${errText}`);
  }
}

export async function deleteFirestoreDoc(
  collectionPath: string,
  docId: string,
  idToken: string,
): Promise<void> {
  const url = `${getFirestoreBaseUrl()}/${collectionPath}/${docId}`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to delete document ${docId}: ${res.status} ${errText}`);
  }
}
