import { ObjectId } from "mongodb";

/**
 * Generates a GrapeJS project JSON string EXACTLY matching what
 * the UI Builder stores in the `formObjects` field of the `forms` collection.
 *
 * The renderer (View.js) reads:
 *   item.type            → determines which React component to render
 *   item.attributes      → for "input", "textarea", "myDateTimeComponent"
 *   item directly        → for "dropdownConnector", "typeaheadComponent",
 *                          "custom-dropdown", "custom-checkbox", "custom-radio",
 *                          "switch-button"
 */

// ─── Utilities ────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function humanize(name) {
  return String(name)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeClass(name) {
  return [{ name, label: name, type: 1, active: true }];
}

// ─── Component builders matching exact UI Builder GrapeJS types ───────────────

function buildInputComponent(field, inputTypeId = "text") {
  // type trait stored as { id, label } object (select trait value)
  const typeObj = {
    text: { id: "text", label: "Text" },
    number: { id: "number", label: "Number" },
    email: { id: "email", label: "Email" },
    password: { id: "password", label: "Password" },
    textArea: { id: "textArea", label: "Textarea" },
  };
  return {
    type: "input",
    tagName: "input",
    attributes: {
      name: field.fieldName,
      label: humanize(field.fieldName),
      placeholder: `Enter ${humanize(field.fieldName).toLowerCase()}`,
      type: typeObj[inputTypeId] || typeObj.text,
      required: !!field.required,
      class: "form-control",
    },
    classes: makeClass("form-control"),
  };
}

function buildTextareaComponent(field) {
  return {
    type: "input",
    tagName: "input",
    attributes: {
      name: field.fieldName,
      label: humanize(field.fieldName),
      placeholder: `Enter ${humanize(field.fieldName).toLowerCase()}`,
      type: { id: "textArea", label: "Textarea" },
      required: !!field.required,
      rows: 3,
      class: "form-control",
    },
    classes: makeClass("form-control"),
  };
}

function buildDateTimeComponent(field, subtype = "datePicker") {
  const typeMap = {
    datePicker: { id: "datePicker", label: "Date picker" },
    dateTimePicker: { id: "dateTimePicker", label: "Date time picker" },
    dateInput: { id: "dateInput", label: "Date input" },
  };
  return {
    type: "myDateTimeComponent",
    tagName: "input",
    attributes: {
      name: field.fieldName,
      label: humanize(field.fieldName),
      type: typeMap[subtype] || typeMap.datePicker,
      required: !!field.required,
      class: "form-control",
    },
    classes: makeClass("form-control"),
  };
}

/**
 * dropdownConnector — uses a data query reference.
 * Traits have changeProp:1 so they live on the component directly (not in attributes).
 */
function buildDropdownConnectorComponent(field, dataQueryId, labelKey = "label", valueKey = "value") {
  return {
    type: "dropdownConnector",
    tagName: "div",
    // changeProp:1 traits → direct component properties, not in attributes
    name: field.fieldName,
    label: humanize(field.fieldName),
    data_source: dataQueryId ? { id: dataQueryId, label: humanize(field.fieldName) + " Source" } : null,
    labelKey: { id: labelKey, label: labelKey },
    valueKey: { id: valueKey, label: valueKey },
    required: !!field.required,
    multiSelect: false,
    attributes: { class: "dropdownConnectorDiv" },
  };
}

/**
 * custom-dropdown — uses static options string (options trait stores "val1::label1,val2::label2")
 */
function buildStaticDropdownComponent(field, options = []) {
  const optStr = options.length
    ? options.map((o) => `${o.value || o}::${o.label || o}`).join(",")
    : "";
  return {
    type: "custom-dropdown",
    tagName: "select",
    // changeProp:1 — direct properties
    name: field.fieldName,
    label: humanize(field.fieldName),
    data_source: null,
    labelKey: { id: "label", label: "label" },
    valueKey: { id: "value", label: "value" },
    required: !!field.required,
    attributes: {
      name: field.fieldName,
      options: optStr,
      class: "form-control",
    },
    classes: makeClass("form-control"),
  };
}

function buildTypeaheadComponent(field, dataQueryId, labelKey = "label", valueKey = "value") {
  return {
    type: "typeaheadComponent",
    tagName: "div",
    // changeProp:1 → direct properties
    name: field.fieldName,
    label: humanize(field.fieldName),
    data_source: dataQueryId ? { id: dataQueryId, label: humanize(field.fieldName) + " Source" } : null,
    labelKey: { id: labelKey, label: labelKey },
    valueKey: { id: valueKey, label: valueKey },
    required: !!field.required,
    attributes: { class: "typeaheadDv" },
  };
}

function buildCheckboxComponent(field) {
  return {
    type: "custom-checkbox",
    tagName: "input",
    attributes: {
      type: "checkbox",
      name: field.fieldName,
      label: humanize(field.fieldName),
      value: "true",
      required: false,
    },
  };
}

function buildSwitchButtonComponent(field) {
  return {
    type: "switch-button",
    tagName: "div",
    // switch-button reads these directly off the item
    name: field.fieldName,
    label: humanize(field.fieldName),
    attributes: { class: "switchBtnDv" },
  };
}

function buildSubmitButton() {
  return {
    type: "button",
    tagName: "button",
    content: "Submit",
    buttonType: { id: "save", label: "Save" },
    attributes: {
      type: "button",
      class: "btn btn-primary",
    },
    classes: [...makeClass("btn"), ...makeClass("btn-primary")],
  };
}

function buildCancelButton() {
  return {
    type: "button",
    tagName: "button",
    content: "Cancel",
    buttonType: { id: "link", label: "Link" },
    redirectUrl: "/",
    attributes: {
      type: "button",
      class: "btn btn-secondary ms-2",
    },
    classes: [...makeClass("btn"), ...makeClass("btn-secondary"), ...makeClass("ms-2")],
  };
}

function buildTitleComponent(text) {
  return {
    type: "titleComponent",
    tagName: "h2",
    content: text,
    name: "formTitle",
    label: text,
    attributes: { class: "sPageHeading1" },
    classes: makeClass("mb-3"),
  };
}

/**
 * Wraps a field component in a Bootstrap row with label column + field column,
 * exactly as the UI Builder studio lays out fields.
 */
function wrapInRow(fieldComponent) {
  return {
    tagName: "div",
    type: "default",
    classes: [...makeClass("row"), ...makeClass("margin-b-10")],
    attributes: { title: "form" },
    components: [
      {
        tagName: "div",
        type: "default",
        classes: [...makeClass("col-sm-3"), ...makeClass("col-lg-3")],
        components: [
          {
            tagName: "label",
            type: "label",
            attributes: {
              for: fieldComponent.attributes?.name || fieldComponent.name || "",
              class: "control-label col-sm-3",
            },
            components: [
              {
                type: "textnode",
                content: humanize(
                  fieldComponent.attributes?.name || fieldComponent.name || ""
                ),
              },
            ],
          },
        ],
      },
      {
        tagName: "div",
        type: "default",
        classes: [...makeClass("col-sm-9"), ...makeClass("col-lg-9")],
        components: [fieldComponent],
      },
    ],
  };
}

// ─── Schema field → component type inference ──────────────────────────────────

function inferComponentType(field) {
  const name = field.fieldName.toLowerCase();
  const types = field.observedTypes || [];
  const samples = field.sampleValues || [];

  // Boolean/switch
  if (types.includes("boolean")) return "switch-button";

  // Date fields
  if (
    types.includes("date") ||
    name.includes("date") ||
    name.includes("_at") ||
    name.includes("createdat") ||
    name.includes("updatedat")
  ) {
    if (name.includes("time")) return "myDateTimeComponent-datetime";
    return "myDateTimeComponent";
  }

  // Long text
  if (
    (field.stats?.maxStringLength || 0) > 300 ||
    name.includes("description") ||
    name.includes("comment") ||
    name.includes("notes") ||
    name.includes("body") ||
    name.includes("message") ||
    name.includes("content")
  ) {
    return "textarea";
  }

  // Arrays with values → connector dropdown
  if (types.includes("array") && samples.length > 0) return "dropdownConnector";

  // Enum strings (low cardinality, ≤ 20 unique values) → static dropdown
  if (types.includes("string") && samples.length > 2 && samples.length <= 20) {
    // Only if samples look like discrete values (short strings, no spaces)
    const allShort = samples.every((s) => String(s).length < 40);
    if (allShort) return "custom-dropdown";
  }

  // Email
  if (name.includes("email")) return "input-email";

  // Number
  if (
    types.includes("number") ||
    types.includes("int") ||
    types.includes("double") ||
    name.includes("count") ||
    name.includes("qty") ||
    name.includes("amount") ||
    name.includes("year") ||
    name.includes("age")
  ) {
    return "input-number";
  }

  // Object fields → usually need typeahead/lookup
  if (types.includes("object")) return "typeaheadComponent";

  return "input";
}

// ─── Main: build GrapeJS formObjects JSON ────────────────────────────────────

function buildGrapesFormObjects(formName, fields, dataQueryMap) {
  const rows = fields.map((field) => {
    const ctype = inferComponentType(field);
    const dqId = dataQueryMap[field.fieldName] || null;
    let comp;

    switch (ctype) {
      case "switch-button":
        comp = buildSwitchButtonComponent(field);
        break;
      case "myDateTimeComponent":
        comp = buildDateTimeComponent(field, "datePicker");
        break;
      case "myDateTimeComponent-datetime":
        comp = buildDateTimeComponent(field, "dateTimePicker");
        break;
      case "textarea":
        comp = buildTextareaComponent(field);
        break;
      case "dropdownConnector":
        comp = dqId
          ? buildDropdownConnectorComponent(field, dqId)
          : buildStaticDropdownComponent(field, field.sampleValues || []);
        break;
      case "custom-dropdown":
        comp = buildStaticDropdownComponent(field, field.sampleValues || []);
        break;
      case "typeaheadComponent":
        comp = dqId
          ? buildTypeaheadComponent(field, dqId)
          : buildInputComponent(field, "text");
        break;
      case "input-email":
        comp = buildInputComponent(field, "email");
        break;
      case "input-number":
        comp = buildInputComponent(field, "number");
        break;
      default:
        comp = buildInputComponent(field, "text");
    }

    return wrapInRow(comp);
  });

  const buttonRow = {
    tagName: "div",
    type: "default",
    classes: [...makeClass("row"), ...makeClass("margin-t-15")],
    components: [
      {
        tagName: "div",
        type: "default",
        classes: makeClass("col-md-12"),
        components: [buildSubmitButton(), buildCancelButton()],
      },
    ],
  };

  const pageId = uuid();
  const frameId = uuid();

  return {
    pages: [
      {
        id: pageId,
        name: "Default",
        frames: [
          {
            id: frameId,
            component: {
              type: "wrapper",
              stylable: false,
              components: [
                buildTitleComponent(formName),
                ...rows,
                buttonRow,
              ],
            },
          },
        ],
      },
    ],
    styles: [],
  };
}

// ─── Build ruleData JSON (UI Builder format) ────────────────────────────────

function buildRuleData(fields) {
  const required = fields.filter((f) => f.required || (f.stats?.nonNullRatio || 0) >= 0.7);
  if (!required.length) return "";
  const rules = required.map((f) => ({
    ruleType: "mainRule",
    query: {
      combinator: "and",
      rules: [{ field: f.fieldName, operator: "isEmpty", value: "" }],
    },
    conditionTrue: [{ field: f.fieldName, operation: "manadatory" }],
    conditionFalse: [],
  }));
  return JSON.stringify(rules);
}

// ─── Build dataqueries documents for dfe.dataqueries ─────────────────────────

/**
 * Creates data query documents that use existing connector IDs from dfe.connectors.
 * If no matching connector exists, we create a simple inline REST query.
 */
function buildDataQueryDoc({ title, formId, formSlug, connectorDoc, createdBy }) {
  // data field is a stringified JSON of the query config
  const data = JSON.stringify({
    url: connectorDoc?.url || "",
    method: connectorDoc?.verb || "get",
    body: { type: "raw", subtype: "json", value: "" },
    headers: connectorDoc?.headers
      ? JSON.parse(connectorDoc.headers.replace(/'/g, '"')).reduce((acc, h) => {
          try {
            const parsed = h;
            if (parsed.key) acc[parsed.key] = parsed.value;
          } catch {
            /* */
          }
          return acc;
        }, {})
      : { "Content-Type": "application/json" },
    query_string: [],
    responseKeys: ["label", "value"],
    authentication: connectorDoc?.authentication || null,
  });

  return {
    title,
    type: "REST",
    data,
    form: formSlug,
    connector: connectorDoc?._id || null,
    createdBy: createdBy || "AI Automation POC",
    createdById: 0,
    modifiedBy: createdBy || "AI Automation POC",
    modifiedById: 0,
    companyId: 0,
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ─── Main export: publish a POC form to dfe.forms ────────────────────────────

/**
 * Takes a POC-generated form record, generates the exact UI Builder formObjects,
 * optionally creates data query documents, and inserts everything into:
 *   - dfe.forms          (the form, readable by UI Builder getAllForms / getForm)
 *   - dfe.dataqueries    (one query per connector-backed field, optional)
 *
 * @param {Object} opts
 * @param {Object}   opts.db              MongoDB db instance for `dfe`
 * @param {Object}   opts.pocForm         POC form record from `forms` collection
 * @param {string}   opts.createdBy       Author name to stamp on the document
 * @param {number}   opts.companyId       Company id (0 = global)
 * @param {string}   opts.companyName     Company name
 * @param {boolean}  opts.createDataQueries  Whether to write dataqueries docs
 * @returns {Object} { publishedFormId, publishedFormName, dataQueryIds }
 */
export async function publishToUiBuilder({
  db,
  pocForm,
  createdBy = "AI Automation POC",
  companyId = 0,
  companyName = "",
  createDataQueries = true,
}) {
  const now = new Date();

  // ── 1. Resolve fields from the POC grapesFormObjects metadata ────────────
  const metadata = pocForm.grapesMetadata || {};
  const formName = metadata.formName || pocForm.name;
  const formSlug = formName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Rebuild field list from saved connectors + grapesMetadata componentTypes
  const componentTypes = Array.isArray(metadata.componentTypes) ? metadata.componentTypes : [];
  const connectors = pocForm.connectors || [];

  // Gather schema fields from existing POC metadata
  const fields = componentTypes.map((ct) => {
    const savedConnector = connectors.find((c) => c.targetField === ct.field);
    const inferredRequired = (pocForm.rules || []).some(
      (r) => typeof r === "string"
        ? r.includes(`field=${ct.field}`) && r.includes("ruleType=required")
        : r?.field === ct.field && r?.ruleType === "required"
    );
    return {
      fieldName: ct.field,
      observedTypes: [ct.type === "myDateTimeComponent" ? "date" : ct.type === "switch-button" ? "boolean" : "string"],
      sampleValues: [],
      required: inferredRequired,
      stats: { nonNullRatio: inferredRequired ? 1 : 0, maxStringLength: 100 },
    };
  });

  // ── 2. Optionally look up real connectors and create dataqueries ──────────
  const dataQueryMap = {}; // fieldName → dataQueryId (string)
  const dataQueryIds = [];

  if (createDataQueries && connectors.length > 0) {
    // Look up real connectors in dfe.connectors to use as backing APIs
    const realConnectors = await db.collection("connectors")
      .find({ module: pocForm.sourceCollection || "unknown" })
      .limit(10)
      .toArray();

    for (const conn of connectors) {
      const field = conn.targetField;
      if (!field) continue;

      // Find a matching real connector (by module = source collection)
      const realConn = realConnectors[0] || null;

      const dqTitle = `${humanize(field)} Data Source`;
      const dqDoc = buildDataQueryDoc({
        title: dqTitle,
        formId: String(pocForm._id),
        formSlug,
        connectorDoc: realConn,
        createdBy,
      });

      const inserted = await db.collection("dataqueries").insertOne(dqDoc);
      const dqId = String(inserted.insertedId);
      dataQueryMap[field] = dqId;
      dataQueryIds.push({ field, id: dqId, title: dqTitle });
    }
  }

  // ── 3. Build GrapeJS formObjects JSON ─────────────────────────────────────
  const grapesProject = buildGrapesFormObjects(formName, fields, dataQueryMap);
  const formObjectsString = JSON.stringify(grapesProject);
  const ruleDataString = buildRuleData(fields);

  // ── 4. Build the exact UI Builder form document ──────────────────────────
  const formDoc = {
    // Core fields read by getAllForms / getForm GraphQL queries
    name: formName,
    companyId,
    companyName,
    pageType: "form",
    formObjects: formObjectsString,       // ← stringified GrapeJS JSON
    ruleData: ruleDataString,             // ← stringified rules JSON
    customScript: "",
    status: true,
    statusText: "Draft",
    isPublic: false,
    isPublished: false,

    // Audit fields the list view shows
    createdBy,
    createdByFullname: createdBy,
    createdById: 0,
    updatedBy: createdBy,
    updatedByFullname: createdBy,
    updatedById: 0,
    updatedOn: now,
    createdAt: now,
    updatedAt: now,

    // Back-reference to POC form for traceability
    _pocFormId: String(pocForm._id),
    _pocSourceCollection: pocForm.sourceCollection || "",
    _pocSourceDatabase: pocForm.sourceDatabase || "",
  };

  // ── 5. Insert into dfe.forms ──────────────────────────────────────────────
  const insertResult = await db.collection("forms").insertOne(formDoc);
  const publishedFormId = String(insertResult.insertedId);

  // ── 6. Update dataqueries with the final form slug ────────────────────────
  if (dataQueryIds.length > 0) {
    const dqObjectIds = dataQueryIds.map((d) => {
      try { return new ObjectId(d.id); } catch { return d.id; }
    });
    await db.collection("dataqueries").updateMany(
      { _id: { $in: dqObjectIds } },
      { $set: { form: publishedFormId } }
    );
  }

  return {
    publishedFormId,
    publishedFormName: formName,
    dataQueryIds,
    formObjectsPreview: grapesProject.pages[0]?.frames[0]?.component?.components?.length || 0,
  };
}
