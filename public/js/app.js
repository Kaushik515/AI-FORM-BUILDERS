// DOM Elements
const promptInput = document.getElementById("promptInput");
const generateBtn = document.getElementById("generateBtn");
const refreshBtn = document.getElementById("refreshBtn");
const formsList = document.getElementById("formsList");
const generationResult = document.getElementById("generationResult");
const errorBox = document.getElementById("errorBox");
const formModal = document.getElementById("formModal");
const modalOverlay = document.getElementById("modalOverlay");
const closeModal = document.getElementById("closeModal");
const formDetails = document.getElementById("formDetails");

// State
let allForms = [];

// Event Listeners
generateBtn.addEventListener("click", generateForm);
refreshBtn.addEventListener("click", loadForms);
closeModal.addEventListener("click", closeFormModal);
modalOverlay.addEventListener("click", closeFormModal);

// Quick Template Buttons
document.querySelectorAll(".prompt-template").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    promptInput.value = btn.dataset.prompt;
    promptInput.focus();
  });
});

// Initialize
loadForms();

// Functions
async function generateForm() {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    showError("Please enter a prompt");
    return;
  }

  hideError();
  hideResult();
  generateBtn.disabled = true;
  document.querySelector(".btn-text").classList.add("hidden");
  document.querySelector(".btn-loader").classList.remove("hidden");

  try {
    const response = await fetch("/api/forms/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const result = await response.json();

    if (!response.ok) {
      showError(result.error || "Failed to generate form");
      return;
    }

    if (result.success) {
      showResult(result.data);
      promptInput.value = "";
      loadForms();
    }
  } catch (error) {
    showError(error.message || "Error generating form");
  } finally {
    generateBtn.disabled = false;
    document.querySelector(".btn-text").classList.remove("hidden");
    document.querySelector(".btn-loader").classList.add("hidden");
  }
}

async function loadForms() {
  try {
    formsList.innerHTML = '<div class="loading">Loading forms...</div>';

    const response = await fetch("/api/forms");
    const result = await response.json();

    if (!result.success) {
      formsList.innerHTML =
        '<div class="loading" style="color: #ef4444;">Error loading forms</div>';
      return;
    }

    allForms = result.data;

    if (allForms.length === 0) {
      formsList.innerHTML =
        '<div class="loading">No forms yet. Create one using the generator!</div>';
      return;
    }

    formsList.innerHTML = allForms
      .map((form, index) => renderFormCard(form, index))
      .join("");

    // Add event listeners to cards
    document.querySelectorAll(".btn-view").forEach((btn, idx) => {
      btn.addEventListener("click", () => viewFormDetail(allForms[idx]._id));
    });

    document.querySelectorAll(".btn-delete").forEach((btn, idx) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteForm(allForms[idx]._id, idx);
      });
    });
  } catch (error) {
    formsList.innerHTML =
      '<div class="loading" style="color: #ef4444;">Error loading forms</div>';
    console.error("Error loading forms:", error);
  }
}

async function viewFormDetail(formId) {
  try {
    const response = await fetch(`/api/forms/${formId}`);
    const result = await response.json();

    if (!result.success) {
      alert("Error loading form details");
      return;
    }

    const form = result.data;
    displayFormDetails(form);
    openFormModal();
  } catch (error) {
    alert("Error loading form details: " + error.message);
  }
}

function renderFormField(cmp) {
  const a = cmp.attributes || {};
  const name = a.name || "";
  const label = a.label || name;
  const placeholder = a.placeholder || "";
  const required = a.required ? '<span class="field-required">*</span>' : "";
  const requiredAttr = a.required ? "required" : "";
  const connectorBadge = a.connector
    ? `<span class="field-connector-badge" title="Bound to connector ${a.connector.connectorId || ""}">⚡ ${a.dataBindingType || a.connector.type || "connected"}</span>`
    : "";

  let input = "";

  switch (cmp.type) {
    case "textarea":
      input = `<textarea class="preview-input preview-textarea" name="${name}" placeholder="${placeholder}" rows="3" ${requiredAttr}></textarea>`;
      break;

    case "custom-dropdown":
      input = `<select class="preview-input preview-select" name="${name}" ${requiredAttr}>
        <option value="" disabled selected>${placeholder || "Select " + label + "..."}</option>
        <option value="option1">Option 1 (from connector)</option>
        <option value="option2">Option 2 (from connector)</option>
        <option value="option3">Option 3 (from connector)</option>
      </select>`;
      break;

    case "typeaheadComponent":
      input = `<input class="preview-input" type="text" name="${name}" placeholder="🔍 ${placeholder || "Type to search..."}" list="dl_${name}" ${requiredAttr}>
      <datalist id="dl_${name}">
        <option value="Sample 1">
        <option value="Sample 2">
        <option value="Sample 3">
      </datalist>`;
      break;

    case "myDateTimeComponent":
      input = `<input class="preview-input" type="datetime-local" name="${name}" ${requiredAttr}>`;
      break;

    case "switch-button":
      input = `<label class="preview-switch"><input type="checkbox" name="${name}"><span class="preview-switch-slider"></span><span class="preview-switch-label">${label}</span></label>`;
      break;

    case "starRatingComponent":
      input = `<div class="preview-stars" data-name="${name}">
        ${[1, 2, 3, 4, 5].map((n) => `<span class="star" data-val="${n}" onclick="this.parentElement.dataset.selected=${n};this.parentElement.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('star-active',i<${n}))">★</span>`).join("")}
      </div>`;
      break;

    case "titleComponent":
      const level = a.level || "h3";
      return `<div class="preview-section-header"><${level}>${a.text || label}</${level}></div>`;

    default:
      const inputType =
        a.validation?.numeric ? "number" : name.includes("email") ? "email" : name.includes("url") ? "url" : "text";
      let extra = "";
      if (a.validation?.min !== undefined) extra += ` min="${a.validation.min}"`;
      if (a.validation?.max !== undefined) extra += ` max="${a.validation.max}"`;
      if (a.validation?.maxLength) extra += ` maxlength="${a.validation.maxLength}"`;
      input = `<input class="preview-input" type="${inputType}" name="${name}" placeholder="${placeholder}" ${requiredAttr}${extra}>`;
      break;
  }

  const posX = cmp.position?.x ?? null;
  const posY = cmp.position?.y ?? null;
  const posStyle = (posX !== null && posY !== null)
    ? `left:${posX}px;top:${posY}px;`
    : '';

  return `
    <div class="canvas-field" data-cmp-id="${cmp.id}" data-cmp-name="${name}" style="${posStyle}">
      <div class="canvas-field-grip" title="Drag to move anywhere">⠿</div>
      <div class="field-content">
        <label class="preview-label">${label} ${required} ${connectorBadge}</label>
        ${input}
      </div>
    </div>
  `;
}

function displayFormDetails(form) {
  const formObj = form.formObjects || {};
  const components = formObj.components || [];

  let html = `
    <div class="form-detail-header">
      <h2>${form.name}</h2>
      <div class="form-detail-meta">
        <span class="form-card-badge">${form.status || "draft"}</span>
        <span class="form-detail-date">${new Date(form.createdAt).toLocaleString()}</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="detail-tabs">
      <button class="detail-tab active" onclick="switchTab('preview', this)">📝 Form Preview</button>
      <button class="detail-tab" onclick="switchTab('connectors', this)">🔗 Connectors</button>
      <button class="detail-tab" onclick="switchTab('rules', this)">✓ Rules</button>
      <button class="detail-tab" onclick="switchTab('json', this)">{ } JSON</button>
    </div>
  `;

  // ─── PREVIEW TAB ───
  html += `<div class="tab-content tab-preview active" data-tab="preview">`;
  html += `<div class="canvas-toolbar">
    <span class="canvas-toolbar-label">✋ Grab the ⠿ handle to move fields anywhere on the canvas</span>
    <div class="canvas-toolbar-btns">
      <button class="btn btn-sm btn-secondary" onclick="resetPositions()">↩ Reset Positions</button>
      <button class="btn btn-sm btn-primary" style="width:auto;margin:0;padding:8px 16px;" onclick="saveFieldPositions('${form._id}')">💾 Save Layout</button>
    </div>
  </div>`;
  if (components.length > 0) {
    html += `<div class="free-canvas" id="freeCanvas">`;
    html += components.map((cmp) => renderFormField(cmp)).join("");
    html += `</div>`;
  } else {
    html += `<p style="color:#999;text-align:center;padding:40px;">No components in this form.</p>`;
  }
  html += `</div>`;

  // ─── CONNECTORS TAB ───
  html += `<div class="tab-content tab-connectors" data-tab="connectors">`;
  if (form.connectors && form.connectors.length > 0) {
    html += form.connectors
      .map(
        (conn) => `
        <div class="connector-card">
          <div class="connector-card-head">
            <strong>${conn.name}</strong>
            <span class="connector-type-badge">${conn.type}</span>
          </div>
          <div class="connector-card-body">
            <p><strong>Target Field:</strong> ${conn.targetField}</p>
            ${conn.source?.collection ? `<p><strong>Collection:</strong> ${conn.source.collection}</p>` : ""}
            ${conn.source?.database ? `<p><strong>Database:</strong> ${conn.source.database}</p>` : ""}
            ${conn.dataBindingType ? `<p><strong>Binding:</strong> ${conn.dataBindingType}</p>` : ""}
            ${conn.responseMapping ? `<p><strong>Mapping:</strong> label → ${conn.responseMapping.labelField}, value → ${conn.responseMapping.valueField}</p>` : ""}
            ${conn.source?.pipeline ? `<details><summary>Pipeline (${conn.source.pipeline.length} stages)</summary><pre class="connector-pipeline">${JSON.stringify(conn.source.pipeline, null, 2)}</pre></details>` : ""}
          </div>
        </div>`
      )
      .join("");
  } else {
    html += `<p style="color:#999;text-align:center;padding:40px;">No connectors.</p>`;
  }
  html += `</div>`;

  // ─── RULES TAB ───
  html += `<div class="tab-content tab-rules" data-tab="rules">`;
  if (form.rules && form.rules.length > 0) {
    html += `<table class="rules-table"><thead><tr><th>Field</th><th>Rule</th><th>Enabled</th><th>Message</th></tr></thead><tbody>`;
    html += form.rules
      .map(
        (r) => `<tr>
        <td><strong>${r.field}</strong></td>
        <td>${r.ruleType}</td>
        <td>${r.enabled ? "✅" : "—"}</td>
        <td><em>${r.message}</em></td>
      </tr>`
      )
      .join("");
    html += `</tbody></table>`;
  }
  if (form.dependencies && form.dependencies.length > 0) {
    html += `<h4 style="margin:20px 0 10px;">Dependencies</h4>`;
    html += form.dependencies
      .map(
        (d) => `<div class="dep-row">${d.sourceField} → ${d.targetField} <small>(${d.behavior})</small></div>`
      )
      .join("");
  }
  if ((!form.rules || form.rules.length === 0) && (!form.dependencies || form.dependencies.length === 0)) {
    html += `<p style="color:#999;text-align:center;padding:40px;">No rules or dependencies.</p>`;
  }
  html += `</div>`;

  // ─── JSON TAB ───
  html += `<div class="tab-content tab-json" data-tab="json">
    <div class="json-box"><pre>${JSON.stringify(form.formObjects || form, null, 2)}</pre></div>
  </div>`;

  formDetails.innerHTML = html;

  // ─── Wire up free-move after DOM is written ───
  requestAnimationFrame(() => initFreeMove());
}

// ═══════════ FREE-POSITION DRAG ENGINE ═══════════
let _dragEl = null;
let _offsetX = 0;
let _offsetY = 0;

function initFreeMove() {
  const canvas = document.getElementById('freeCanvas');
  if (!canvas) return;

  // Auto-layout fields that have no saved position (stack them)
  const fields = canvas.querySelectorAll('.canvas-field');
  let autoY = 16;
  fields.forEach((field) => {
    if (!field.style.left || !field.style.top) {
      field.style.left = '16px';
      field.style.top = autoY + 'px';
    }
    autoY += field.offsetHeight + 16;
    field.style.position = 'absolute';
  });

  // Set canvas minimum height to fit all fields
  canvas.style.minHeight = (autoY + 60) + 'px';

  // Attach grip listeners
  canvas.querySelectorAll('.canvas-field-grip').forEach((grip) => {
    grip.addEventListener('mousedown', onGripDown);
  });

  // Global mouse listeners (attached once)
  document.addEventListener('mousemove', onFieldMove);
  document.addEventListener('mouseup', onFieldUp);
}

function onGripDown(e) {
  e.preventDefault();
  _dragEl = this.closest('.canvas-field');
  if (!_dragEl) return;
  const rect = _dragEl.getBoundingClientRect();
  const canvasRect = _dragEl.parentElement.getBoundingClientRect();
  _offsetX = e.clientX - rect.left;
  _offsetY = e.clientY - rect.top;
  _dragEl.classList.add('field-moving');
  _dragEl.style.zIndex = 1000;
}

function onFieldMove(e) {
  if (!_dragEl) return;
  const canvas = _dragEl.parentElement;
  const canvasRect = canvas.getBoundingClientRect();

  let newX = e.clientX - canvasRect.left - _offsetX;
  let newY = e.clientY - canvasRect.top - _offsetY;

  // Clamp within canvas bounds
  newX = Math.max(0, Math.min(newX, canvas.scrollWidth - _dragEl.offsetWidth));
  newY = Math.max(0, newY);

  _dragEl.style.left = newX + 'px';
  _dragEl.style.top = newY + 'px';

  // Expand canvas if dragged near bottom
  if (newY + _dragEl.offsetHeight + 40 > canvas.offsetHeight) {
    canvas.style.minHeight = (newY + _dragEl.offsetHeight + 80) + 'px';
  }
}

function onFieldUp() {
  if (!_dragEl) return;
  _dragEl.classList.remove('field-moving');
  _dragEl.style.zIndex = '';
  _dragEl = null;
}

function resetPositions() {
  const canvas = document.getElementById('freeCanvas');
  if (!canvas) return;
  let y = 16;
  canvas.querySelectorAll('.canvas-field').forEach((field) => {
    field.style.left = '16px';
    field.style.top = y + 'px';
    y += field.offsetHeight + 16;
  });
  canvas.style.minHeight = (y + 60) + 'px';
}

async function saveFieldPositions(formId) {
  const fields = document.querySelectorAll('#freeCanvas .canvas-field[data-cmp-id]');
  const positions = Array.from(fields).map((f) => ({
    id: f.dataset.cmpId,
    x: parseInt(f.style.left, 10) || 0,
    y: parseInt(f.style.top, 10) || 0,
  }));

  try {
    const res = await fetch(`/api/forms/${formId}/positions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions }),
    });
    const result = await res.json();
    if (result.success) {
      alert('Layout saved!');
      loadForms();
    } else {
      alert('Error saving layout: ' + (result.error || 'Unknown'));
    }
  } catch (err) {
    alert('Error saving layout: ' + err.message);
  }
}

function switchTab(tabName, btnEl) {
  // Toggle tab buttons
  document.querySelectorAll(".detail-tab").forEach((t) => t.classList.remove("active"));
  btnEl.classList.add("active");
  // Toggle tab content
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
  const target = document.querySelector(`.tab-content[data-tab="${tabName}"]`);
  if (target) target.classList.add("active");
}

async function deleteForm(formId, index) {
  if (!confirm("Are you sure you want to delete this form?")) {
    return;
  }

  try {
    const response = await fetch(`/api/forms/${formId}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!result.success) {
      alert("Error deleting form");
      return;
    }

    loadForms();
  } catch (error) {
    alert("Error deleting form: " + error.message);
  }
}

function renderFormCard(form, index) {
  const formObj = form.formObjects || {};
  const componentsCount = formObj.components
    ? formObj.components.length
    : 0;
  const connectorsCount = form.connectors ? form.connectors.length : 0;
  const createdDate = new Date(form.createdAt).toLocaleDateString();

  return `
    <div class="form-card">
      <div class="form-card-header">
        <span class="form-card-title">${form.name}</span>
        <span class="form-card-badge">${form.status || "draft"}</span>
      </div>
      
      <div class="form-card-meta">
        <span>📦 ${componentsCount} Components</span>
        <span>🔗 ${connectorsCount} Connectors</span>
      </div>
      
      <div class="form-card-date">Created: ${createdDate}</div>
      
      <div class="form-card-actions">
        <button class="btn-view">👁️ View</button>
        <button class="btn-delete">🗑️ Delete</button>
      </div>
    </div>
  `;
}

function showResult(data) {
  document.getElementById("resultName").textContent = data.formName;
  document.getElementById("resultId").textContent = data.formId;
  document.getElementById("resultFields").textContent = data.fieldsCount;
  document.getElementById("resultConnectors").textContent = data.connectorsCount;
  generationResult.classList.remove("hidden");
}

function hideResult() {
  generationResult.classList.add("hidden");
}

function showError(message) {
  document.getElementById("errorMessage").textContent = message;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.classList.add("hidden");
}

function openFormModal() {
  formModal.classList.remove("hidden");
  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeFormModal() {
  formModal.classList.add("hidden");
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "auto";
}
