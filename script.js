let uploadedBase64Image = null;
let selectedModel = "gpt-4.1";

const modelSelector = document.getElementById("modelSelector");
const convertButton = document.getElementById("convertButton");
const mermaidTextarea = document.getElementById("mermaidCode");
const renderTarget = document.getElementById("mermaidRenderTarget");
const previewMessage = document.getElementById("previewMessage");

mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });

// Reset on model change
modelSelector.addEventListener("change", (e) => {
  selectedModel = e.target.value;
  uploadedBase64Image = null;
  document.getElementById("imagePreview").classList.add("hidden");
  document.getElementById("imageInput").value = "";
  document.getElementById("results").classList.add("hidden");
  renderTarget.innerHTML = "";
  previewMessage.textContent = "Upload a new image for this model.";
  showMessage(`Model switched to ${selectedModel}.`);
});

function previewImage(event) {
  const file = event.target.files[0];
  const preview = document.getElementById("imagePreview");
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedBase64Image = e.target.result.split(",")[1];
      preview.src = e.target.result;
      preview.classList.remove("hidden");
      convertButton.disabled = false;
    };
    reader.readAsDataURL(file);
  }
}

async function generateMermaidCode() {
  if (!uploadedBase64Image) return showMessage("Please upload an image first.");
  convertButton.disabled = true;
  convertButton.textContent = "Processing...";
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
    convertButton.disabled = false;
    convertButton.textContent = "Generate Code";
  }
}

document.getElementById("updatePreview").addEventListener("click", renderDiagram);
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
  } catch (err) {
    previewMessage.textContent = "Invalid Mermaid syntax.";
    previewMessage.classList.remove("hidden");
  }
}

// ---------- Mermaid Live Editor Integration ----------
const openEditorButton = document.getElementById("openEditorButton");
const editorContainer = document.getElementById("editorContainer");
const editorIframe = document.getElementById("mermaidEditor");

openEditorButton.addEventListener("click", () => {
  editorContainer.classList.toggle("hidden");
  if (!editorContainer.classList.contains("hidden")) {
    const code = mermaidTextarea.value.trim();
    if (!code) return showMessage("No Mermaid code to edit yet!");
    editorIframe.contentWindow.postMessage({ type: "setCode", code }, "https://mermaid.live");
    showMessage("Loaded diagram into Mermaid Live Editor!");
    editorContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

window.addEventListener("message", (event) => {
  if (event.origin !== "https://mermaid.live") return;
  const { type, code } = event.data;
  if (type === "codeUpdate" && code) {
    mermaidTextarea.value = code;
    renderDiagram();
  }
});

// ---------- Download buttons with timestamped filenames ----------
function getTimestampedName(ext = "svg") {
  const now = new Date();
  const formatted = now
    .toISOString()
    .replace("T", "_")
    .slice(0, 16)
    .replace(/:/g, "-");
  return `diagram_${formatted}.${ext}`;
}

document.getElementById("downloadSvg").addEventListener("click", () => {
  const svg = renderTarget.querySelector("svg");
  if (!svg) return showMessage("No diagram to download.");
  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = getTimestampedName("svg");
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("downloadMmd").addEventListener("click", () => {
  const code = mermaidTextarea.value.trim();
  if (!code) return showMessage("No Mermaid code to save.");
  const blob = new Blob([code], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = getTimestampedName("mmd");
  link.click();
  URL.revokeObjectURL(link.href);
});

// ---------- Utility ----------
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
