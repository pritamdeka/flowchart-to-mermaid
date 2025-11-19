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
  let userApiKey = null;

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

  // === API Key Handling ===
  document.getElementById("loadApiKeyButton").addEventListener("click", () => {
    document.getElementById("apiKeyFileInput").click();
  });

  function loadApiKeyFromFile(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        userApiKey = e.target.result.trim();
        showMessage("API Key loaded from file.");
      };
      reader.readAsText(file);
    }
  }

  // Allow the user to directly type the API key
  document.getElementById("apiKeyInput").addEventListener("input", (event) => {
    userApiKey = event.target.value;
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
    if (!uploadedBase64Image || !userApiKey) {
      return showMessage("Please upload an image and provide the API key.");
    }

    convertButton.disabled = true;
    loadingOverlay.classList.remove("hidden");
    document.getElementById("results").classList.remove("hidden");
    mermaidTextarea.value = "";
    previewMessage.textContent = "Generating diagram...";

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: uploadedBase64Image, model: selectedModel, apiKey: userApiKey }),
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
      applyTransform();
      enableInlineEditing();
    } catch {
      previewMessage.textContent = "Invalid Mermaid syntax.";
      previewMessage.classList.remove("hidden");
    }
  }

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

});
