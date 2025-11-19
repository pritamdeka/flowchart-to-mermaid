/**
 * script.js for Flowchart to Mermaid Converter
 * This handles UI logic, image preview, and client-side utility functions.
 */

// ====================================================================
// === GLOBAL STATE & ELEMENTS (Needed for inline HTML calls) ===
// ====================================================================

let uploadedBase64Image = null;
let uploadedFileName = "diagram";
// Keeping this model name as requested
let selectedModel = "gpt-4.1"; 
let userApiKey = null; // Key is null until loaded/entered

// === GLOBAL STATE FOR ZOOM & NODE COUNT ===
let currentZoom = 1.0; 
let nodeCounter = 1; 
// ==========================================

// Get key DOM elements needed globally
const imagePreview = document.getElementById("imagePreview");
const convertButton = document.getElementById("convertButton");
const mermaidTextarea = document.getElementById("mermaidCode");
const loadingOverlay = document.getElementById("loadingOverlay");
const messageBox = document.getElementById("messageBox");

// ====================================================================
// === GLOBAL UTILITY FUNCTIONS ===
// ====================================================================

/**
 * Creates a URL for the Mermaid Live Editor by compressing the code.
 * This version uses the standard pako compression method required by #pako: prefix.
 * @param {string} input The Mermaid code.
 * @returns {string} The base64 compressed string.
 */
function compressToPakoBase64(input) {
    const json = JSON.stringify({ code: input, mermaid: { theme: "default" } });
    const data = new TextEncoder().encode(json);
    
    // 1. Deflate the data (output is a Uint8Array)
    const deflated = pako.deflate(data, { level: 9 }); 
    
    // 2. Convert the Uint8Array to a binary string
    let binaryString = '';
    for (let i = 0; i < deflated.length; i++) {
        binaryString += String.fromCharCode(deflated[i]);
    }

    // 3. Base64 encode the binary string
    return btoa(binaryString);
}


/**
 * Handles file selection, previews the image, and sets the base64 data.
 * Called directly from index.html's onchange attribute.
 */
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        uploadedFileName = file.name.split(".")[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedBase64Image = e.target.result.split(",")[1]; // Get only the base64 part
            imagePreview.src = e.target.result;
            imagePreview.classList.remove("hidden");
            
            if (convertButton) {
                convertButton.disabled = false;
            }
        };
        reader.readAsDataURL(file);
    }
}
// Make the function accessible to the HTML
window.previewImage = previewImage;


/**
 * Displays a temporary message box notification.
 * @param {string} text The message to display.
 */
function showMessage(text) {
    messageBox.textContent = text;
    messageBox.classList.remove("hidden");
    setTimeout(() => messageBox.classList.add("hidden"), 3000);
}


/**
 * Debounce utility to limit function calls.
 */
function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}


// ====================================================================
// === DOMContentLoaded LOGIC (Main event handling) ===
// ====================================================================

document.addEventListener("DOMContentLoaded", () => {

    // === DOM Elements (Defined again locally for DOMContentLoaded scope) ===
    const modelSelector = document.getElementById("modelSelector");
    const renderTarget = document.getElementById("mermaidRenderTarget");
    const previewMessage = document.getElementById("previewMessage");
    const diagramScrollBox = document.getElementById("diagramScrollBox");
    const aiPromptInput = document.getElementById("aiPrompt");
    const runAiButton = document.getElementById("runAiButton");
    
    // Zoom button references
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const zoomResetBtn = document.getElementById('zoomResetBtn');
    const zoomFitBtn = document.getElementById('zoomFitBtn');


    // === Mermaid Init ===
    // Initializes Mermaid but prevents it from running automatically on page load
    mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });


    // === Model Selector ===
    // We'll store the previous model prefix for comparison (e.g., 'gpt' or 'gemini')
    let previousModelPrefix = selectedModel.split('-')[0];

    modelSelector.addEventListener("change", (e) => {
        const newModel = e.target.value;
        const newModelPrefix = newModel.split('-')[0];

        // CONDITION: Reset API key only if the vendor prefix has changed (e.g., gpt -> gemini)
        if (newModelPrefix !== previousModelPrefix) {
            userApiKey = null;
            showMessage(`Model switched to ${newModel}. API Key required for new vendor.`);
        } else {
            // Keep existing key if the vendor is the same (e.g., gpt-4.1 -> gpt-4.1-mini)
            showMessage(`Model switched to ${newModel}. API Key retained.`);
        }

        // Update global state variables
        selectedModel = newModel;
        previousModelPrefix = newModelPrefix; // Update the prefix for the next comparison
        
        // Reset non-key related state regardless of vendor switch
        uploadedBase64Image = null;
        uploadedFileName = "diagram";
        document.getElementById("imageInput").value = "";
        document.getElementById("results").classList.add("hidden");
        renderTarget.innerHTML = "";
        previewMessage.textContent = "Upload a new image for this model.";
        imagePreview.classList.add("hidden");
        convertButton.disabled = true;
    });

    
    // =======================================================
    // === 🔑 API Key Popup Modal (Implemented Logic) ===
    // =======================================================
    async function promptForApiKey() {
        return new Promise((resolve) => {
            const modal = document.createElement("div");
            modal.className =
                "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

            // Modal HTML structure - Added error display area
            modal.innerHTML = `
                <div class="bg-white rounded-xl shadow-xl p-6 w-96 space-y-4 text-gray-700">
                    <h2 class="text-lg font-semibold text-indigo-600 text-center">API Key Required</h2>
                    <p class="text-sm text-gray-500 text-center">This feature requires your API key for the selected model.</p>
                    
                    <div id="modalError" class="hidden text-sm text-red-600 bg-red-100 p-2 rounded"></div>

                    <input type="password" id="modalApiKeyInput" placeholder="Paste API key here (e.g., sk-...)"
                                class="w-full border border-gray-300 p-2 rounded focus:ring-indigo-500 focus:border-indigo-500" />
                    <div class="flex items-center gap-2">
                        <label for="apiKeyFileInput" class="cursor-pointer px-3 py-2 text-sm bg-gray-100 border border-gray-300 rounded hover:bg-gray-200">
                            Upload .txt Key
                        </label>
                        <input type="file" id="apiKeyFileInput" accept=".txt" class="hidden" />
                        <span id="fileNameDisplay" class="text-xs text-gray-500 truncate flex-1">No file chosen</span>
                    </div>
                    <div class="flex justify-end gap-3 pt-3">
                        <button id="cancelApiKey" class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Cancel</button>
                        <button id="confirmApiKey" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Continue</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const input = modal.querySelector("#modalApiKeyInput");
            const fileInput = modal.querySelector("#apiKeyFileInput");
            const fileNameDisplay = modal.querySelector("#fileNameDisplay");
            const modalError = modal.querySelector("#modalError");
            const cancelBtn = modal.querySelector("#cancelApiKey");
            const confirmBtn = modal.querySelector("#confirmApiKey");

            // Helper to display error inside the modal and reset input fields
            function displayModalError(message) {
                modalError.textContent = message;
                modalError.classList.remove('hidden');
                // Reset the input fields so user can immediately retry
                input.value = ''; 
                fileInput.value = null; 
                fileNameDisplay.textContent = 'No file chosen';
                input.focus();
            }

            // Handle file upload selection
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) {
                    fileNameDisplay.textContent = file.name;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        // Populate the text input with the key from the file
                        input.value = ev.target.result.trim();
                    };
                    reader.readAsText(file);
                }
            });

            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
                resolve(null);
            };

            // CORE CHANGE: Validation on Confirm button click
            confirmBtn.onclick = () => {
                const key = input.value.trim();
                if (!key) {
                    displayModalError("API Key cannot be empty.");
                    return;
                }

                // Client-side format validation (based on selected model)
                const isGpt = selectedModel.startsWith("gpt-");
                
                if (isGpt && !key.startsWith("sk-")) {
                    displayModalError(`Invalid format. GPT keys must start with 'sk-'. Please re-enter your key.`);
                    return;
                }
                if (!isGpt && key.startsWith("sk-")) {
                    displayModalError(`Invalid key. Gemini keys should not start with 'sk-'. Please re-enter your key.`);
                    return;
                }
                
                // If the key passes client-side format check, we close the modal and resolve.
                document.body.removeChild(modal);
                resolve(key);
            };
        });
    }
    // =======================================================


    // === Generate Mermaid Code (Core API Call Logic) ===
    convertButton.addEventListener("click", async () => {
        if (!uploadedBase64Image) return showMessage("Please upload an image first.");
        generateMermaidCode();
    });

    async function generateMermaidCode() {
        if (!uploadedBase64Image) {
            return showMessage("Please upload an image first.");
        }

        // 1. Check/Prompt for API Key (Reset logic happens in catch block)
        if (!userApiKey) {
            userApiKey = await promptForApiKey();
            if (!userApiKey) {
                showMessage("API key required to continue.");
                return;
            }
        }

        // 2. Quick Key Validation (client-side guess)
        const isGpt = selectedModel.startsWith("gpt-");
        if (isGpt && !userApiKey.startsWith("sk-")) {
            userApiKey = null;
            return showMessage("Invalid API key format for GPT models (expected 'sk-').");
        }
        if (!isGpt && userApiKey.startsWith("sk-")) {
            userApiKey = null;
            return showMessage("Invalid API key for Gemini models (should not start with 'sk-').");
        }
        
        convertButton.disabled = true;
        loadingOverlay.classList.remove("hidden");
        document.getElementById("results").classList.remove("hidden");
        mermaidTextarea.value = "";
        previewMessage.textContent = "Generating diagram...";
        previewMessage.classList.remove("hidden");
        renderTarget.innerHTML = '';


        try {
            // --- API Call ---
            const response = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: uploadedBase64Image, model: selectedModel, apiKey: userApiKey }),
            });

            const result = await response.json();
            if (result.error) throw new Error(result.error);

            let code = result.output?.trim();
            if (!code) throw new Error("No Mermaid code returned.");
            
            // Basic cleanup: remove markdown fences if present
            code = code.replace(/```mermaid\n?|\n?```/g, '').trim(); 

            mermaidTextarea.value = code;
            renderDiagram();
            showMessage("Code generated successfully!");
        } catch (err) {
            showMessage("Error: " + err.message);
            // FIX: Reset API key on server/network error
            userApiKey = null; 
        } finally {
            loadingOverlay.classList.add("hidden");
            convertButton.disabled = false;
        }
    }

    // === Helper function to apply the current zoom level ===
    function applyZoomTransform() {
        const svgElement = renderTarget.querySelector('svg');
        if (svgElement) {
            // Find the wrapper element that Mermaid places around the SVG content
            const graphContainer = svgElement.closest('div'); 
            if (graphContainer) {
                // Apply the scale transformation to the wrapper div
                graphContainer.style.transform = `scale(${currentZoom})`;
                // Set the origin to top-left for predictable scaling
                graphContainer.style.transformOrigin = '0 0'; 
            }
        }
    }

    // === Render Diagram ===
    // Use debounce on input to avoid rendering on every single key stroke
    mermaidTextarea.addEventListener("input", debounce(renderDiagram, 600));

    async function renderDiagram() {
        const code = mermaidTextarea.value.trim();
        renderTarget.innerHTML = "";
        
        if (!code) {
            previewMessage.textContent = "Enter Mermaid code to preview.";
            previewMessage.classList.remove("hidden");
            return;
        }
        
        previewMessage.classList.add("hidden");

        try {
            // Use the standard Mermaid API run/render methods
            const { svg } = await mermaid.render('mermaidSvg', code);
            renderTarget.innerHTML = svg;

            // Immediately reset zoom after rendering a new diagram
            currentZoom = 1.0; 
            applyZoomTransform();

            // Scroll to top-left when rendering new diagram
            diagramScrollBox.scrollLeft = 0;
            diagramScrollBox.scrollTop = 0;
            
        } catch (e) {
            previewMessage.textContent = "Invalid Mermaid syntax. Check the console for details.";
            previewMessage.classList.remove("hidden");
            console.error("Mermaid Render Error:", e);
        }
    }


    // === Export and Share Functionality ===

    // 1. Download SVG
    document.getElementById('downloadSvg').addEventListener('click', () => {
        const svgElement = renderTarget.querySelector('svg');
        if (!svgElement) return showMessage("No diagram rendered to download.");

        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = uploadedFileName + '.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage("SVG downloaded successfully.");
    });

    // 2. Download MMD
    document.getElementById('downloadMmd').addEventListener('click', () => {
        const code = mermaidTextarea.value;
        if (!code) return showMessage("No Mermaid code to save.");
        
        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = uploadedFileName + '.mmd';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showMessage(".MMD file saved successfully.");
    });
    
    // 3. Open in Mermaid Live Editor (Uses pako compression)
    document.getElementById('openEditorButton').addEventListener('click', () => {
        const code = mermaidTextarea.value.trim();
        if (!code) return showMessage("No Mermaid code to open.");

        try {
            // Use the compression function defined globally
            const compressed = compressToPakoBase64(code);
            // FIX: Ensure the #pako: prefix is used
            const liveUrl = `https://mermaid.live/edit#pako:${compressed}`; 
            window.open(liveUrl, '_blank');
            showMessage("Opening Mermaid Live Editor...");
        } catch (error) {
            showMessage("Error creating Live Editor URL.");
            console.error("Compression error:", error);
        }
    });

    // =======================================================
    // === ➕ Zoom Controls Implementation ===
    // =======================================================

    // 1. Zoom In (＋)
    zoomInBtn.addEventListener('click', () => {
        currentZoom = Math.min(2.0, currentZoom + 0.1); // Max zoom of 200%
        applyZoomTransform();
        showMessage(`Zoom: ${Math.round(currentZoom * 100)}%`);
    });

    // 2. Zoom Out (－)
    zoomOutBtn.addEventListener('click', () => {
        currentZoom = Math.max(0.4, currentZoom - 0.1); // Min zoom of 40%
        applyZoomTransform();
        showMessage(`Zoom: ${Math.round(currentZoom * 100)}%`);
    });

    // 3. Zoom Reset
    zoomResetBtn.addEventListener('click', () => {
        currentZoom = 1.0;
        applyZoomTransform();
        showMessage('Zoom Reset (100%)');
    });

    // 4. Zoom Fit 
    zoomFitBtn.addEventListener('click', () => {
        const svgElement = renderTarget.querySelector('svg');
        const scrollBox = document.getElementById('diagramScrollBox');

        if (!svgElement || !scrollBox) return showMessage('Diagram not ready to fit.');
        
        // Get natural dimensions of the SVG
        const svgBounds = svgElement.getBoundingClientRect();
        const svgWidth = svgBounds.width;
        
        // Get visible width of the scroll container
        const containerWidth = scrollBox.clientWidth;

        if (svgWidth > 0 && containerWidth > 0) {
            // Calculate the scale needed to make the SVG fit the container width
            // We subtract a small margin (e.g., 20px) for padding
            currentZoom = (containerWidth - 20) / svgWidth;
            currentZoom = Math.min(1.0, currentZoom); // Don't scale up past 100%
            applyZoomTransform();
            showMessage(`Zoom Fit: ${Math.round(currentZoom * 100)}%`);
        } else {
            showMessage('Cannot calculate fit zoom.');
        }
    });

    // =======================================================
    // === 🔗 Connection Drawing Logic (Manual Prompt) ===
    // =======================================================
    
    // Utility to check if diagram syntax exists
    function isDiagramStarted(code) {
        return code.trim().startsWith('flowchart') || 
               code.trim().startsWith('graph') || 
               code.trim().startsWith('sequenceDiagram');
    }

    window.drawConnection = function() { // Made global for console testing
        let currentCode = mermaidTextarea.value.trim();

        if (!isDiagramStarted(currentCode)) {
            showMessage("Start a diagram first (e.g., drag a node).");
            return;
        }

        const sourceId = prompt("Enter the Source Node ID (e.g., N1):");
        if (!sourceId) return;

        const targetId = prompt(`Enter the Target Node ID for the arrow from ${sourceId} (e.g., N2):`);
        if (!targetId) return;
        
        const linkLabel = prompt("Enter a label for the arrow (optional):");

        let arrowCode;
        if (linkLabel) {
            arrowCode = `${sourceId} -- "${linkLabel}" --> ${targetId}`;
        } else {
            arrowCode = `${sourceId} --> ${targetId}`;
        }

        // Insert the new connection code at the end of the existing code
        const newCode = currentCode + `\n    ${arrowCode}`;
        
        mermaidTextarea.value = newCode;
        mermaidTextarea.dispatchEvent(new Event('input')); // Trigger render

        showMessage(`Added connection: ${sourceId} -> ${targetId}`);
    }


    // =======================================================
    // === 🖱️ Drag-and-Drop Node Palette Logic (UPDATED) ===
    // =======================================================

    // Map shape names to Mermaid syntax wrappers
    const nodeSyntaxMap = {
        process: (id, label) => `${id}["${label}"]`,
        decision: (id, label) => `${id}{${label}}`,
        terminator: (id, label) => `${id}([${label}])`,
        io: (id, label) => `${id}[/${label}/]`,
        subroutine: (id, label) => `${id}[(${label})]`,
        database: (id, label) => `${id}[(${label})]`,
        // Note: Note syntax requires a specific node ID to attach to, simplifying for drag-and-drop
        note: (id, label) => `N_temp${id}[Note attachment point]\n    note right of N_temp${id} : ${label}`
    };

    // 1. Get all draggable nodes from the palette
    const draggableNodes = document.querySelectorAll('#nodePalette [draggable="true"]');

    draggableNodes.forEach(node => {
        node.addEventListener('dragstart', (e) => {
            const shape = node.getAttribute('data-shape');
            e.dataTransfer.setData('text/plain', shape);
            e.dataTransfer.effectAllowed = 'copy';
            showMessage(`Dragging ${shape} node...`);
        });
    });

    const dropTarget = document.body; 

    dropTarget.addEventListener('dragover', (e) => {
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'copy';
    });

    dropTarget.addEventListener('drop', (e) => {
        e.preventDefault();
        const shape = e.dataTransfer.getData('text/plain');

        if (shape && nodeSyntaxMap[shape]) {
            const newNodeId = `N${nodeCounter++}`;
            const defaultLabel = shape.charAt(0).toUpperCase() + shape.slice(1);
            
            const nodeLabel = prompt(`Enter label for the new ${defaultLabel} node (ID: ${newNodeId}):`, defaultLabel) || defaultLabel;

            // Generate the Mermaid code for the new node
            const newNodeCode = nodeSyntaxMap[shape](newNodeId, nodeLabel);

            // 3. Insert Code into the Textarea
            let currentCode = mermaidTextarea.value.trim();
            
            // If the diagram is empty, initialize a flowchart
            if (!isDiagramStarted(currentCode)) {
                currentCode = `flowchart TD`; 
            }
            
            // Insert new node after the diagram type definition (first line)
            const firstLineBreak = currentCode.indexOf('\n');
            let newCode;

            if (firstLineBreak === -1) {
                // Only diagram type (e.g., 'flowchart TD') exists
                newCode = `${currentCode}\n    ${newNodeCode}`;
            } else {
                // Insert new node after the diagram type definition (first line)
                newCode = currentCode.substring(0, firstLineBreak + 1) + 
                          `    ${newNodeCode}\n` + 
                          currentCode.substring(firstLineBreak + 1);
            }
            
            // 4. Update the Textarea and Trigger Rendering
            mermaidTextarea.value = newCode;
            mermaidTextarea.dispatchEvent(new Event('input'));

            showMessage(`Added node ${newNodeId}: "${nodeLabel}" to the diagram.`);
        } else if (shape) {
            showMessage(`Unknown drop payload.`);
        }
    });


    // =======================================================
    // === ⚡ AI Assistant (Call /api/ai-edit) ===
    // =======================================================

    runAiButton.addEventListener('click', async () => {
        const prompt = aiPromptInput.value.trim();
        const currentCode = mermaidTextarea.value.trim();

        if (!currentCode) return showMessage("Please generate or enter Mermaid code first.");
        if (!prompt) return showMessage("Please enter a modification for the AI.");

        runAiEdit(prompt, currentCode);
    });

    async function runAiEdit(prompt, currentCode) {
        // 1. Check/Prompt for API Key 
        if (!userApiKey) {
            userApiKey = await promptForApiKey();
            if (!userApiKey) {
                showMessage("API key required to continue.");
                return;
            }
        }

        // 2. Quick Key Validation (client-side guess)
        const isGpt = selectedModel.startsWith("gpt-");
        if (isGpt && !userApiKey.startsWith("sk-")) {
            userApiKey = null;
            return showMessage("Invalid API key format for GPT models (expected 'sk-').");
        }
        if (!isGpt && userApiKey.startsWith("sk-")) {
            userApiKey = null;
            return showMessage("Invalid API key for Gemini models (should not start with 'sk-').");
        }
        
        runAiButton.disabled = true;
        loadingOverlay.classList.remove("hidden");
        aiPromptInput.value = '';
        showMessage("Sending request to AI Assistant...");
        
        try {
            const response = await fetch("/api/ai-edit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    currentCode,
                    model: selectedModel,
                    apiKey: userApiKey
                }),
            });

            const result = await response.json();
            
            if (result.error) throw new Error(result.error);

            const updatedCode = result.updatedCode?.trim();
            if (!updatedCode) throw new Error("AI returned no updated code.");
            
            // Update the textarea with the new code, which automatically triggers renderDiagram via the 'input' event listener
            mermaidTextarea.value = updatedCode;
            mermaidTextarea.dispatchEvent(new Event('input')); // Force rendering if model didn't trigger 'input'

            showMessage("AI updated the diagram successfully!");

        } catch (err) {
            showMessage("AI Edit Error: " + err.message);
            // FIX: Reset API key on server/network error
            userApiKey = null;
        } finally {
            loadingOverlay.classList.add("hidden");
            runAiButton.disabled = false;
        }
    }
    
    // Initial state setup 
    convertButton.disabled = true;
});