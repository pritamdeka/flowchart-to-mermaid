document.addEventListener("DOMContentLoaded", () => {

// =============================================
// ==========  API KEY (IN MEMORY)  ============
// =============================================
let userApiKey = null;

const apiKeyModal = document.getElementById("apiKeyModal");
const openApiKeyModal = document.getElementById("openApiKeyModal");
const saveApiKeyBtn = document.getElementById("saveApiKey");
const cancelApiKeyBtn = document.getElementById("cancelApiKey");
const apiKeyInput = document.getElementById("apiKeyInput");
const apiKeyFileInput = document.getElementById("apiKeyFile");

// open modal
openApiKeyModal.addEventListener("click", () => {
  apiKeyModal.classList.remove("hidden");
});

// cancel modal
cancelApiKeyBtn.addEventListener("click", () => {
  apiKeyModal.classList.add("hidden");
});

// load key from txt file
apiKeyFileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  apiKeyInput.value = text.trim();
});

// save key
saveApiKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    alert("API key cannot be empty.");
    return;
  }
  userApiKey = key;
  apiKeyModal.classList.add("hidden");
  showMessage("API key saved!");
});

// =============================================
// ======== COMPRESSION FOR MERMAID.LIVE =======
// =============================================
function compressToPakoBase64(input) {
  const json = JSON.stringify({ code: input, mermaid: { theme: "default" } });
  const data = new TextEncoder().encode(json);
  const deflated = pako.deflate(data);
  const str = String.fromCharCode.apply(null, deflated);
  return btoa(str);
}

// =============================================
// =============== GLOBALS =====================
// =============================================
let uploadedBase64Image = null;
let uploadedFileName = "diagram";
let selectedModel = "gpt-4.1";

// zoom + pan
let scale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

// =============================================
// =============== ELEMENTS ====================
// =============================================
const scrollBox = document.getElementById("diagramScrollBox");
const modelSelector = document.getElementById("modelSelector");
const convertButton = document.getElementById("convertButton");
const mermaidTextarea = document.getElementById("mermaidCode");
const renderTarget = document.getElementById("mermaidRenderTarget");
const previewMessage = document.getElementById("previewMessage");
const loadingOverlay = document.getElementById("loadingOverlay");

// =============================================
// =============== MERMAID INIT ================
// =============================================
mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

// =============================================
// ============ MODEL SELECTOR =================
// =============================================
modelSelector.addEventListener("change", (e) => {
  selectedModel = e.target.value;
  uploadedBase64Image = null;
  uploadedFileName = "diagram";
  document.getElementById("imagePreview").classList.add("hidden");
  document.getElementById("imageInput").value = "";
  document.getElementById("results").classList.add("hidden");
  renderTarget.innerHTML = "";
  previewMessage.textContent = "Upload a new image for this model.";
  showMessage(`Model switched to ${selectedModel}.`);
});

// =============================================
// ============= IMAGE PREVIEW =================
// =============================================
window.previewImage = function(event) {
  const file = event.target.files[0];
  const preview = document.getElementById("imagePreview");

  if (file) {
    uploadedFileName = file.name.split(".")[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedBase64Image = e.target.result.split(",")[1];
      preview.src = e.target.result;
      preview.classList.remove("hidden");

      if (userApiKey) convertButton.disabled = false;
    };
    reader.readAsDataURL(file);
  }
};

// =============================================
// ========= GENERATE MERMAID CODE =============
// =============================================
convertButton.addEventListener("click", generateMermaidCode);

async function generateMermaidCode() {
  if (!uploadedBase64Image)
    return showMessage("Please upload an image first.");
  if (!userApiKey)
    return showMessage("Please enter your API key first.");

  convertButton.disabled = true;
  loadingOverlay.classList.remove("hidden");
  document.getElementById("results").classList.remove("hidden");
  mermaidTextarea.value = "";
  previewMessage.textContent = "Generating diagram...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-API-Key": userApiKey     // 🔥 send key to backend
      },
      body: JSON.stringify({
        image: uploadedBase64Image,
        model: selectedModel
      }),
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error);

    const code = result.output?.trim();
    if (!code) throw new Error("No Mermaid code returned.");

    mermaidTextarea.value = code;
    renderDiagram();
  } catch (err) {
    showMessage("Error: " + err.message);
  } finally {
    loadingOverlay.classList.add("hidden");
    convertButton.disabled = false;
  }
}

// =============================================
// ============= RENDER DIAGRAM ================
// =============================================
mermaidTextarea.addEventListener("input", debounce(renderDiagram, 600));

async function renderDiagram() {
  const code = mermaidTextarea.value.trim();
  renderTarget.innerHTML = "";

  if (!code) {
    previewMessage.textContent = "Enter Mermaid code to preview.";
    previewMessage.classList.remove("hidden");
    return;
  }

  try {
    const tempDiv = document.createElement("div");
    tempDiv.classList.add("mermaid");
    tempDiv.textContent = code;

    renderTarget.innerHTML = "";
    renderTarget.appendChild(tempDiv);

    await mermaid.run({ nodes: [tempDiv] });

    previewMessage.classList.add("hidden");

    autoScaleDiagram();
    applyTransform();
    enableInlineEditing();

  } catch {
    previewMessage.textContent = "Invalid Mermaid syntax.";
    previewMessage.classList.remove("hidden");
  }
}

// =============================================
// ============== INLINE EDITING ===============
// =============================================
function enableInlineEditing() {
  renderTarget.querySelectorAll("text").forEach((t) => {
    t.style.cursor = "pointer";
    t.onclick = (e) => {
      const oldText = t.textContent.trim();
      const input = document.createElement("input");
      input.value = oldText;
      input.style.position = "fixed";
      input.style.left = e.clientX + "px";
      input.style.top = e.clientY + "px";
      document.body.appendChild(input);
      input.focus();
      input.onblur = () => {
        updateNodeText(oldText, input.value.trim());
        input.remove();
      };
    };
  });
}

function updateNodeText(oldText, newText) {
  const code = mermaidTextarea.value.replaceAll(oldText, newText);
  mermaidTextarea.value = code;
  renderDiagram();
}

// =============================================
// ============== DRAG & DROP NODES ============
// =============================================
const nodePalette = document.getElementById("nodePalette");
const diagramArea = document.getElementById("diagramPreview");
let draggedShape = null;

nodePalette.querySelectorAll("[draggable='true']").forEach((item) => {
  item.addEventListener("dragstart", (e) => {
    draggedShape = e.target.dataset.shape;
  });
});

diagramArea.addEventListener("dragover", (e) => e.preventDefault());

diagramArea.addEventListener("drop", (e) => {
  e.preventDefault();
  if (!draggedShape) return;

  const id = prompt(`Enter ID for the new ${draggedShape}:`);
  const label = prompt("Enter label:");
  if (!id || !label) return;

  let shapeSyntax = "";
  switch (draggedShape) {
    case "process": shapeSyntax = `${id}[${label}]`; break;
    case "decision": shapeSyntax = `${id}{${label}}`; break;
    case "terminator": shapeSyntax = `${id}([${label}])`; break;
    case "io": shapeSyntax = `${id}[/ ${label} /]`; break;
    case "subroutine": shapeSyntax = `${id}[[${label}]]`; break;
    case "database": shapeSyntax = `${id}((${label}))`; break;
    case "note": shapeSyntax = `${id}["${label}"]`; break;
  }

  let code = mermaidTextarea.value.trim();
  if (!code.startsWith("graph") && !code.startsWith("flowchart"))
    code = "flowchart TD\n" + code;

  code += `\n${shapeSyntax}`;
  mermaidTextarea.value = code;
  renderDiagram();

  showMessage(`Added new ${draggedShape}: ${label}`);
  draggedShape = null;
});

// =============================================
// ============== DOWNLOAD SVG =================
// =============================================
document.getElementById("downloadSvg").addEventListener("click", () => {
  const svg = renderTarget.querySelector("svg");
  if (!svg) return showMessage("No diagram to download.");

  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${uploadedFileName}.svg`;
  link.click();
  URL.revokeObjectURL(link.href);
});

// =============================================
// =============== DOWNLOAD MMD ================
// =============================================
document.getElementById("downloadMmd").addEventListener("click", () => {
  const code = mermaidTextarea.value;
  if (!code.trim()) return showMessage("No Mermaid code to save.");

  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${uploadedFileName}.mmd`;
  link.click();

  setTimeout(() => window.URL.revokeObjectURL(url), 500);
  showMessage(`Saved ${uploadedFileName}.mmd`);
});

// =============================================
// ============== MERMAID LIVE ================
// =============================================
document.getElementById("openEditorButton").addEventListener("click", async () => {
  const code = mermaidTextarea.value.trim();
  if (!code) return showMessage("No Mermaid code to edit yet!");

  try {
    await navigator.clipboard.writeText(code);
    const compressed = compressToPakoBase64(code);
    window.open(`https://mermaid.live/edit#pako:${compressed}`, "_blank");

    showMessage("Opening Mermaid Live Editor...");
  } catch {
    showMessage("Could not open editor or copy code.");
  }
});

// =============================================
// ============ AI EDITING BUTTON ==============
// =============================================
document.getElementById("runAiButton")?.addEventListener("click", async () => {
  const prompt = document.getElementById("aiPrompt")?.value.trim();
  if (!prompt) return showMessage("Enter a command for the AI Assistant.");

  if (!userApiKey)
    return showMessage("Please enter your API key first.");

  const currentCode = mermaidTextarea.value.trim();
  if (!currentCode) return showMessage("No Mermaid code to edit.");

  loadingOverlay.classList.remove("hidden");

  try {
    const res = await fetch("/api/ai-edit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-API-Key": userApiKey     // 🔥 pass key securely
      },
      body: JSON.stringify({ prompt, currentCode }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    mermaidTextarea.value = data.updatedCode;
    renderDiagram();

    document.getElementById("aiPrompt").value = "";
    showMessage("Updated by AI!");
  } catch (e) {
    showMessage("AI failed: " + e.message);
  } finally {
    loadingOverlay.classList.add("hidden");
  }
});

// =============================================
// ============== HELPERS ======================
// =============================================
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// =============================================
// ============== ZOOM CONTROLS ================
// =============================================
function applyTransform() {
  const svg = renderTarget.querySelector("svg");
  if (!svg) return;

  svg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  svg.style.transformOrigin = "top left";
}

function zoomIn() { scale *= 1.15; applyTransform(); }
function zoomOut() { scale /= 1.15; applyTransform(); }
function resetZoom() { scale = 1; panX = 0; panY = 0; applyTransform(); }

function fitToScreen() {
  const svg = renderTarget.querySelector("svg");
  if (!svg) return;

  const boxWidth = scrollBox.clientWidth;
  const boxHeight = scrollBox.clientHeight;

  const svgWidth = svg.viewBox.baseVal.width || svg.getBBox().width;
  const svgHeight = svg.viewBox.baseVal.height || svg.getBBox().height;

  const scaleW = boxWidth / svgWidth;
  const scaleH = boxHeight / svgHeight;

  scale = Math.min(scaleW, scaleH);
  panX = 0;
  panY = 0;

  applyTransform();
}

// PANNING
scrollBox.addEventListener("mousedown", (e) => {
  isPanning = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
});

scrollBox.addEventListener("mousemove", (e) => {
  if (!isPanning) return;
  panX = e.clientX - startX;
  panY = e.clientY - startY;
  applyTransform();
});

scrollBox.addEventListener("mouseup", () => (isPanning = false));
scrollBox.addEventListener("mouseleave", () => (isPanning = false));

// =============================================
// ============== SVG AUTOSCALE ================
// =============================================
function autoScaleDiagram() {
  const svg = renderTarget.querySelector("svg");
  if (!svg) return;
  svg.style.maxWidth = "100%";
  svg.style.height = "auto";
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
}

// =============================================
// ============== MESSAGE BOX ==================
// =============================================
function showMessage(text) {
  const box = document.getElementById("messageBox");
  box.textContent = text;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3000);
}

// =============================================
// ========== ZOOM BUTTON HANDLERS =============
// =============================================
document.getElementById("zoomInBtn")?.addEventListener("click", zoomIn);
document.getElementById("zoomOutBtn")?.addEventListener("click", zoomOut);
document.getElementById("zoomResetBtn")?.addEventListener("click", resetZoom);
document.getElementById("zoomFitBtn")?.addEventListener("click", fitToScreen);

});
