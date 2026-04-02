import { generateId } from "../utils/id.js";
import { inferValidation, mapFieldToComponent } from "../utils/typeMapper.js";

/**
 * Generates a GrapeJS-compatible formObjects JSON that the real
 * the UI Builder renderer can consume directly.
 *
 * Structure: { pages: [{ frames: [{ component: { components: [...] } }] }], styles: [...] }
 * Component types match the real UI Builder: "input", "custom-dropdown", "typeaheadComponent",
 * "myDateTimeComponent", "custom-checkbox", "custom-radio", "switch-button",
 * "dropdownConnector", "button", "titleComponent", etc.
 */

function humanize(fieldName) {
  return String(fieldName)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeClass(name) {
  return [{ name, label: name, type: 1, active: true }];
}

function buildLabelComponent(fieldName, fieldId) {
  return {
    tagName: "label",
    type: "label",
    attributes: { for: fieldId },
    classes: makeClass("form-label"),
    components: [
      {
        type: "textnode",
        content: humanize(fieldName),
      },
    ],
  };
}

function buildInputComponent(field, connectorMap) {
  const fieldId = generateId("i");
  const validation = inferValidation(field.fieldName, field.observedTypes, field.stats);
  const lower = field.fieldName.toLowerCase();

  let inputType = { id: "text", label: "Text" };
  if (lower.includes("email")) inputType = { id: "email", label: "Email" };
  else if (lower.includes("password")) inputType = { id: "password", label: "Password" };
  else if (lower.includes("year") || lower.includes("count") || lower.includes("duration") || field.observedTypes.includes("number"))
    inputType = { id: "number", label: "Number" };

  return {
    type: "input",
    tagName: "input",
    attributes: {
      name: field.fieldName,
      placeholder: `Enter ${humanize(field.fieldName).toLowerCase()}`,
      type: inputType,
      required: !!validation.required,
      minLength: validation.min || "",
      maxLength: validation.maxLength || "",
    },
    classes: makeClass("form-control"),
  };
}

function buildTextareaComponent(field) {
  const validation = inferValidation(field.fieldName, field.observedTypes, field.stats);
  return {
    type: "textarea",
    tagName: "textarea",
    attributes: {
      name: field.fieldName,
      placeholder: `Enter ${humanize(field.fieldName).toLowerCase()}`,
      required: !!validation.required,
    },
    classes: makeClass("form-control"),
  };
}

function buildDateTimeComponent(field) {
  const validation = inferValidation(field.fieldName, field.observedTypes, field.stats);
  const lower = field.fieldName.toLowerCase();
  let dateType = { id: "datePicker", label: "Date picker" };
  if (lower.includes("time")) dateType = { id: "dateTimePicker", label: "Date time picker" };
  return {
    type: "myDateTimeComponent",
    tagName: "input",
    attributes: {
      name: field.fieldName,
      type: dateType,
      required: !!validation.required,
    },
    classes: makeClass("form-control"),
  };
}

function buildDropdownComponent(field, connectorMap) {
  const validation = inferValidation(field.fieldName, field.observedTypes, field.stats);
  const connector = connectorMap[field.fieldName] || connectorMap[field.fieldName.toLowerCase()];

  return {
    type: "custom-dropdown",
    tagName: "select",
    attributes: {
      name: field.fieldName,
      ...(connector ? {
        data_source: { id: connector.connectorId, label: connector.name },
        labelKey: connector.responseMapping?.labelField || "label",
        valueKey: connector.responseMapping?.valueField || "value",
      } : {}),
      required: !!validation.required,
    },
    classes: makeClass("form-control"),
  };
}

function buildTypeaheadComponent(field, connectorMap) {
  const validation = inferValidation(field.fieldName, field.observedTypes, field.stats);
  const connector = connectorMap[field.fieldName] || connectorMap[field.fieldName.toLowerCase()];

  return {
    type: "typeaheadComponent",
    tagName: "div",
    content: `<div class="row typeahead-focus-scope"><div class="col-md-12"><input type="text" placeholder="Please choose ${humanize(field.fieldName).toLowerCase()}" class="form-control"/></div></div>`,
    attributes: {
      name: field.fieldName,
      ...(connector ? {
        data_source: { id: connector.connectorId, label: connector.name },
        labelKey: connector.responseMapping?.labelField || "label",
        valueKey: connector.responseMapping?.valueField || "value",
      } : {}),
      required: !!validation.required,
    },
  };
}

function buildDropdownConnectorComponent(field, connectorMap) {
  const validation = inferValidation(field.fieldName, field.observedTypes, field.stats);
  const connector = connectorMap[field.fieldName] || connectorMap[field.fieldName.toLowerCase()];

  return {
    type: "dropdownConnector",
    tagName: "div",
    content: `<div class="row"><div class="col-md-12"><input type="text" placeholder="Please choose" class="form-control"/></div></div>`,
    attributes: {
      name: field.fieldName,
      ...(connector ? {
        data_source: { id: connector.connectorId, label: connector.name },
        labelKey: connector.responseMapping?.labelField || "label",
        valueKey: connector.responseMapping?.valueField || "value",
      } : {}),
      required: !!validation.required,
      multiSelect: false,
    },
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

function buildRadioComponent(field) {
  return {
    type: "custom-radio",
    tagName: "input",
    attributes: {
      type: "radio",
      name: field.fieldName,
      label: humanize(field.fieldName),
      labels: "Yes,No",
      values: "yes,no",
      required: false,
    },
  };
}

function buildSwitchComponent(field) {
  return {
    type: "switch-button",
    tagName: "div",
    attributes: {
      name: field.fieldName,
      label: humanize(field.fieldName),
    },
  };
}

function buildStarRatingComponent(field) {
  return {
    type: "starRating",
    tagName: "div",
    attributes: {
      name: field.fieldName,
      label: humanize(field.fieldName),
      maxStars: "5",
    },
  };
}

function buildComponentForField(field, connectorMap) {
  const componentType = mapFieldToComponent(field.fieldName, field.observedTypes, field.sampleValues);

  switch (componentType) {
    case "myInputComponent":
      return buildInputComponent(field, connectorMap);
    case "textarea":
      return buildTextareaComponent(field);
    case "myDateTimeComponent":
      return buildDateTimeComponent(field);
    case "custom-dropdown":
      return buildDropdownComponent(field, connectorMap);
    case "typeaheadComponent":
      return buildTypeaheadComponent(field, connectorMap);
    case "dropdownConnector":
      return buildDropdownConnectorComponent(field, connectorMap);
    case "custom-checkbox":
      return buildCheckboxComponent(field);
    case "custom-radio":
      return buildRadioComponent(field);
    case "switch-button":
      return buildSwitchComponent(field);
    case "starRatingComponent":
      return buildStarRatingComponent(field);
    default:
      return buildInputComponent(field, connectorMap);
  }
}

/**
 * Wraps a field component in a Bootstrap row/col with a label — mimicking how
 * the UI Builder studio lays out fields.
 */
function wrapFieldInRow(field, fieldComponent) {
  const fieldId = fieldComponent.attributes?.name || generateId("f");
  return {
    tagName: "div",
    type: "default",
    name: "Row",
    attributes: { title: "form" },
    classes: [
      ...makeClass("row"),
      ...makeClass("mb-3"),
    ],
    components: [
      {
        tagName: "div",
        type: "default",
        name: "Cell",
        attributes: { title: "form" },
        classes: makeClass("col-md-12"),
        components: [
          buildLabelComponent(field.fieldName, fieldId),
          fieldComponent,
        ],
      },
    ],
  };
}

/**
 * Build a submit button component matching the UI Builder's button type.
 */
function buildSubmitButton(dataSourceConnector) {
  return {
    tagName: "div",
    type: "default",
    name: "Row",
    classes: [
      ...makeClass("row"),
      ...makeClass("mt-3"),
    ],
    components: [
      {
        tagName: "div",
        type: "default",
        name: "Cell",
        classes: makeClass("col-md-12"),
        components: [
          {
            type: "button",
            tagName: "button",
            content: "Submit",
            attributes: {
              type: "button",
              buttonType: { id: "save", label: "Save" },
              ...(dataSourceConnector ? {
                data_source: { id: dataSourceConnector.connectorId, label: dataSourceConnector.name },
              } : {}),
            },
            classes: [
              ...makeClass("btn"),
              ...makeClass("btn-primary"),
            ],
          },
          {
            type: "button",
            tagName: "button",
            content: "Cancel",
            attributes: {
              type: "button",
              buttonType: { id: "link", label: "Link" },
              redirectUrl: "/",
            },
            classes: [
              ...makeClass("btn"),
              ...makeClass("btn-secondary"),
              ...makeClass("ms-2"),
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Build a title component matching the UI Builder's titleComponent type.
 */
function buildTitleComponent(text) {
  return {
    type: "titleComponent",
    tagName: "h2",
    content: text,
    attributes: {
      name: "formTitle",
      label: text,
    },
    classes: [
      ...makeClass("mb-4"),
    ],
  };
}

/**
 * Generates a complete GrapeJS-compatible formObjects JSON.
 * This matches the format: { pages: [{ frames: [{ component: { components: [...] } }] }], styles: [] }
 */
export function generateGrapesFormConfig({ parsedPrompt, schema, connectorsBundle }) {
  const requested = new Set(parsedPrompt.requestedFields.map((v) => v.toLowerCase()));
  const selectedFields = schema.fields.filter(
    (field) => requested.size === 0 || requested.has(field.fieldName.toLowerCase())
  );

  // Build connector lookup  
  const connectorMap = {};
  (connectorsBundle?.connectors || []).forEach((connector) => {
    if (connector.targetField) {
      connectorMap[connector.targetField] = connector;
      connectorMap[String(connector.targetField).toLowerCase()] = connector;
    }
  });

  // Build field rows  
  const fieldRows = selectedFields.map((field) => {
    const fieldComp = buildComponentForField(field, connectorMap);
    return wrapFieldInRow(field, fieldComp);
  });

  // Build form wrapper
  const formComponent = {
    tagName: "form",
    type: "form",
    attributes: {
      method: "post",
      data_source: connectorsBundle?.connectors?.[0]
        ? { id: connectorsBundle.connectors[0].connectorId, label: connectorsBundle.connectors[0].name }
        : {},
    },
    classes: makeClass("container"),
    components: [
      buildTitleComponent(parsedPrompt.formName),
      ...fieldRows,
      buildSubmitButton(connectorsBundle?.connectors?.find(c => c.type === "mongodb-aggregation")),
    ],
  };

  // GrapeJS project structure
  const formObjects = {
    pages: [
      {
        name: "main",
        frames: [
          {
            component: {
              tagName: "div",
              type: "wrapper",
              components: [formComponent],
            },
          },
        ],
      },
    ],
    styles: [
      {
        selectors: [{ name: "container", label: "container", type: 1 }],
        style: {
          "max-width": "900px",
          "margin": "0 auto",
          "padding": "30px",
        },
      },
      {
        selectors: [{ name: "form-control", label: "form-control", type: 1 }],
        style: {
          "width": "100%",
          "padding": "8px 12px",
          "border": "1px solid #ced4da",
          "border-radius": "4px",
          "font-size": "14px",
        },
      },
      {
        selectors: [{ name: "form-label", label: "form-label", type: 1 }],
        style: {
          "font-weight": "600",
          "margin-bottom": "4px",
          "display": "block",
          "font-size": "14px",
        },
      },
      {
        selectors: [{ name: "mb-3", label: "mb-3", type: 1 }],
        style: { "margin-bottom": "16px" },
      },
      {
        selectors: [{ name: "mb-4", label: "mb-4", type: 1 }],
        style: { "margin-bottom": "24px" },
      },
      {
        selectors: [{ name: "mt-3", label: "mt-3", type: 1 }],
        style: { "margin-top": "16px" },
      },
    ],
  };

  // Build rules compatible with UI Builder's ruleData format
  const rules = selectedFields
    .filter((f) => f.stats.nonNullRatio >= 0.7)
    .map((field) => ({
      ruleType: "mainRule",
      query: {
        combinator: "and",
        rules: [
          {
            field: field.fieldName,
            operator: "isEmpty",
            value: "",
          },
        ],
      },
      conditionTrue: [
        {
          field: field.fieldName,
          operation: "manadatory",
        },
      ],
      conditionFalse: [],
    }));

  // Build data query/connector configs compatible with UI Builder's data query format
  const dataQueries = (connectorsBundle?.connectors || []).map((connector) => ({
    _id: connector.connectorId,
    title: connector.name,
    type: connector.type === "mongodb-aggregation" ? "REST" : "REST",
    method: "GET",
    data: JSON.stringify({
      responseKeys: connector.responseMapping
        ? [connector.responseMapping.labelField, connector.responseMapping.valueField]
        : [],
    }),
    form: parsedPrompt.formSlug,
  }));

  return {
    selectedFields,
    formObjects,
    formObjectsString: JSON.stringify(formObjects),
    rules,
    ruleDataString: JSON.stringify(rules),
    dataQueries,
    connectors: connectorsBundle?.connectors || [],
    metadata: {
      formName: parsedPrompt.formName,
      entity: parsedPrompt.entity,
      generatedAt: new Date().toISOString(),
      componentTypes: selectedFields.map((f) => ({
        field: f.fieldName,
        type: mapFieldToComponent(f.fieldName, f.observedTypes, f.sampleValues),
      })),
    },
  };
}
