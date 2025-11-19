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

  // === API Key Popup Modal ===
  async function promptForApiKey() {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.className =
        "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

      modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-xl p-6 w-96 space-y-4 text-gray-700">
          <h2 class="text-lg font-semibold text-indigo-600 text-center">Enter API Key</h2>
          <p class="text-sm text-gray-500 text-center">Provide your API key or upload a .txt file containing it.</p>
          <input type="text" id="apiKeyInput" placeholder="Paste API key here"
                 class="w-full border border-gray-300 p-2 rounded focus:ring-indigo-500 focus:border-indigo-500" />
          <input type="file" id="apiKeyFileInput" accept=".txt"
                 class="w-full text-sm text-gray-500" />
          <div class="flex justify-end gap-3 pt-3">
            <button id="cancelApiKey" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
            <button id="confirmApiKey" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Continue</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const input = modal.querySelector("#apiKeyInput");
      const fileInput = modal.querySelector("#apiKeyFileInput");
      const cancelBtn = modal.querySelector("#cancelApiKey");
      const confirmBtn = modal.querySelector("#confirmApiKey");

      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            input.value = ev.target.result.trim();
          };
          reader.readAsText(file);
        }
      });

      cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      confirmBtn.onclick = () => {
        const key = input.value.trim();
        document.body.removeChild(modal);
        resolve(key);
      };
    });
  }

  // === Generate Mermaid Code ===
  convertButton.addEventListener("click", async () => {
    if (!uploadedBase64Image) return showMessage("Please upload an image first.");

    userApiKey = await promptForApiKey();
    if (!userApiKey) {
      showMessage("API key required to continue.");
      return;
    }

    // Validate key type
    if (selectedModel.startsWith("gpt-") && !userApiKey.startsWith("sk-")) {
      return showMessage("Invalid API key for GPT models (must start with sk-).");
    }
    if (selectedModel.startsWith("gemini") && userApiKey.startsWith("sk-")) {
      return showMessage("Invalid API key for Gemini models.");
    }

    generateMermaidCode();
  });

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
