document.addEventListener("DOMContentLoaded", () => {

// === Compression utility for Mermaid.live ===
function compressToPakoBase64(input) {
  const json = JSON.stringify({ code: input, mermaid: { theme: "default" } });
  const data = new TextEncoder().encode(json);
  const deflated = pako.deflate(data);
  const str = String.fromCharCode.apply(null, deflated);
  return btoa(str);
}

// === Globals ===
let uploadedBase64Image = null;
let uploadedFileName = "diagram";
let selectedModel = "gpt-4.1";
let deleteMode = false;

// === DOM Elements ===
const modelSelector = document.getElementById("modelSelector");
const convertButton = document.getElementById("convertButton");
const mermaidTextarea = document.getElementById("mermaidCode");
const renderTarget = document.getElementById("mermaidRenderTarget");
const previewMessage = document.getElementById("previewMessage");
const loadingOverlay = document.getElementById("loadingOverlay");

// === Mermaid Init ===
mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

// === Model Selector ===
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

// === Image Preview ===
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
      convertButton.disabled = false;
    };
    reader.readAsDataURL(file);
  }
};

// === Generate Mermaid Code ===
convertButton.addEventListener("click", generateMermaidCode);

async function generateMermaidCode() {
  if (!uploadedBase64Image) return showMessage("Please upload an image first.");
  convertButton.disabled = true;
  loadingOverlay.classList.remove("hidden");
  document.getElementById("results").classList.remove("hidden");
  mermaidTextarea.value = "";
  previewMessage.textContent = "Generating diagram...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: uploadedBase64Image, model: selectedModel }),
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

// === Render Diagram ===
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
    enableInlineEditing();
  } catch {
    previewMessage.textContent = "Invalid Mermaid syntax.";
    previewMessage.classList.remove("hidden");
  }
}

// === Inline Editing ===
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

// === Drag-and-Drop Node Palette ===
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
  if (!code.startsWith("graph") && !code.startsWith("flowchart")) code = "flowchart TD\n" + code;
  code += `\n${shapeSyntax}`;
  mermaidTextarea.value = code;
  renderDiagram();
  showMessage(`Added new ${draggedShape}: ${label}`);
  draggedShape = null;
});

// === Download SVG ===
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

// === Download .MMD ===
document.getElementById("downloadMmd").addEventListener("click", () => {
  const code = mermaidTextarea.value;
  if (!code || !code.trim()) return showMessage("No Mermaid code to save.");
  const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${uploadedFileName}.mmd`;
  link.click();
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 500);
  showMessage(`✅ Saved ${uploadedFileName}.mmd`);
});

// === Mermaid Live Editor ===
document.getElementById("openEditorButton").addEventListener("click", async () => {
  const code = mermaidTextarea.value.trim();
  if (!code) return showMessage("No Mermaid code to edit yet!");
  try {
    await navigator.clipboard.writeText(code);
    const compressed = compressToPakoBase64(code);
    const editorUrl = `https://mermaid.live/edit#pako:${compressed}`;
    window.open(editorUrl, "_blank");
    showMessage("Code copied! Opening Mermaid Live Editor...");
  } catch (err) {
    showMessage("Could not open editor or copy code.");
  }
});

// === AI Assistant ===
document.getElementById("runAiButton")?.addEventListener("click", async () => {
  const prompt = document.getElementById("aiPrompt")?.value.trim();
  const currentCode = mermaidTextarea.value.trim();
  if (!prompt) return showMessage("Enter a command for the AI Assistant.");
  if (!currentCode) return showMessage("No Mermaid code to edit.");

  loadingOverlay.classList.remove("hidden");
  try {
    const res = await fetch("/api/ai-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, currentCode }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    mermaidTextarea.value = data.updatedCode;
    renderDiagram();
    document.getElementById("aiPrompt").value = "";
    showMessage("✨ Updated by AI!");
  } catch (e) {
    showMessage("AI failed: " + e.message);
  } finally {
    loadingOverlay.classList.add("hidden");
  }
});

// === Helpers ===
function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function showMessage(text) {
  const box = document.getElementById("messageBox");
  box.textContent = text;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 3000);
}

function autoScaleDiagram() {
  const svg = renderTarget.querySelector("svg");
  if (!svg) return;

  svg.style.maxWidth = "100%";
  svg.style.height = "auto";
  svg.style.objectFit = "contain";

  // Prevent huge SVG vertical overflow
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
}


});
