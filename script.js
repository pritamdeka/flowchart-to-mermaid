let uploadedBase64Image = null;
let selectedModel = "gpt-4.1";

const modelSelector = document.getElementById("modelSelector");
const convertButton = document.getElementById("convertButton");

modelSelector.addEventListener("change", (e) => {
  selectedModel = e.target.value;
});

function previewImage(event) {
  const file = event.target.files[0];
  const preview = document.getElementById("imagePreview");
  const button = document.getElementById("convertButton");

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedBase64Image = e.target.result.split(",")[1];
      preview.src = e.target.result;
      preview.classList.remove("hidden");
      button.disabled = false;
    };
    reader.readAsDataURL(file);
  }
}

async function generateMermaidCode() {
  if (!uploadedBase64Image) return showMessage("Please upload an image first.");

  convertButton.disabled = true;
  convertButton.textContent = "Processing...";

  document.getElementById("results").classList.remove("hidden");
  document.getElementById("mermaidCode").value = "";
  document.getElementById("previewMessage").textContent = "Generating diagram...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: uploadedBase64Image,
        model: selectedModel,
      }),
    });

    const result = await response.json();
    if (result.error) throw new Error(result.error);

    const code = result.output?.trim();
    if (!code) throw new Error("No Mermaid code returned.");

    document.getElementById("mermaidCode").value = code;
    renderDiagram();
  } catch (err) {
    showMessage("Error: " + err.message);
  } finally {
    convertButton.disabled = false;
    convertButton.textContent = "Generate Code";
  }
}

async function renderDiagram() {
  const code = document.getElementById("mermaidCode").value.trim();
  const target = document.getElementById("mermaidRenderTarget");
  const msg = document.getElementById("previewMessage");
  target.innerHTML = "";

  if (!code) {
    msg.textContent = "Enter Mermaid code to preview.";
    msg.classList.remove("hidden");
    return;
  }

  try {
    const { svg } = await mermaid.render("graphDiv", code);
    target.innerHTML = svg;
    msg.classList.add("hidden");
  } catch (err) {
    msg.textContent = "Invalid Mermaid syntax.";
    showMessage("Mermaid rendering error.");
  }
}

function showMessage(text) {
  const box = document.getElementById("messageBox");
  box.textContent = text;
  box.classList.remove("hidden");
  setTimeout(() => box.classList.add("hidden"), 4000);
}
