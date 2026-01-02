// --- UI ---
function toggleSettings() {
    document.getElementById('settingsPanel').classList.toggle('hidden');
    document.getElementById('worldsPanel').classList.add('hidden');
}

async function updateSetting(type, val, skipSave = false) {
    val = parseFloat(val);
    if (type === 'brush') {
        brushSize = val; document.getElementById('disp-brush').innerText = val + 'px';
        document.querySelector('input[oninput*="brush"]').value = val;
    } else if (type === 'eraser') {
        eraserSize = val; document.getElementById('disp-eraser').innerText = val + 'px';
        document.querySelector('input[oninput*="eraser"]').value = val;
    } else if (type === 'fire') {
        fireIntensity = val / 100; document.getElementById('disp-fire').innerText = val + '%';
        document.querySelector('input[oninput*="fire"]').value = val;
    } else if (type === 'chaos') {
        fireChaos = val / 100;
        document.getElementById('disp-chaos').innerText = val + '%';
        document.querySelector('input[oninput*="chaos"]').value = val;
    } else if (type === 'speed') {
        simulationSpeed = val / 100;
        document.getElementById('disp-speed').innerText = val + '%';
        document.querySelector('input[oninput*="speed"]').value = val;
    } else if (type === 'music') {
        musicEnabled = !musicEnabled;
        updateMusicVisuals();
        AudioEngine.updateMusic();
    } else if (type === 'sfx') {
        sfxEnabled = !sfxEnabled;
        updateSfxVisuals();
    }

    if (!skipSave) {
        saveAllSettings();
    }
}

function updateMusicVisuals() {
    const btn = document.getElementById('toggleMusic');
    if (!btn) return;
    btn.innerText = musicEnabled ? 'MUSIK: AN' : 'MUSIK: AUS';
    btn.classList.toggle('bg-blue-600/40', musicEnabled);
    btn.classList.toggle('bg-gray-700/60', !musicEnabled);
}

function updateSfxVisuals() {
    const btn = document.getElementById('toggleSfx');
    if (!btn) return;
    btn.innerText = sfxEnabled ? 'SOUNDS: AN' : 'SOUNDS: AUS';
    btn.classList.toggle('bg-blue-600/40', sfxEnabled);
    btn.classList.toggle('bg-gray-700/60', !sfxEnabled);
}

async function saveAllSettings() {
    const settings = {
        brushSize, eraserSize, fireIntensity, fireChaos, simulationSpeed,
        musicEnabled, sfxEnabled,
        selectedExtraIds: activeExtraTools.map(t => t.id)
    };
    await dbStorage.saveSetting('appState', settings);
}

async function loadSavedState() {
    const state = await dbStorage.getSetting('appState');
    if (state) {
        if (state.brushSize !== undefined) updateSetting('brush', state.brushSize, true);
        if (state.eraserSize !== undefined) updateSetting('eraser', state.eraserSize, true);
        if (state.fireIntensity !== undefined) updateSetting('fire', state.fireIntensity * 100, true);
        if (state.fireChaos !== undefined) updateSetting('chaos', Math.round(state.fireChaos * 100), true);
        if (state.simulationSpeed !== undefined) updateSetting('speed', state.simulationSpeed * 100, true);

        if (state.musicEnabled !== undefined) {
            musicEnabled = state.musicEnabled;
            updateMusicVisuals();
            AudioEngine.updateMusic();
        }
        if (state.sfxEnabled !== undefined) {
            sfxEnabled = state.sfxEnabled;
            updateSfxVisuals();
        }

        if (state.selectedExtraIds) {
            activeExtraTools = state.selectedExtraIds
                .map(id => extraToolsSource.find(t => t.id === id))
                .filter(t => t !== undefined);
            renderTools();
        }
    }
}
async function initUI() {
    await loadSavedState();
    refreshUserWorlds();
}

// --- INVENTORY LOGIC ---
function renderTools() {
    const container = document.getElementById('tools-container');
    container.innerHTML = '';

    // Combine permanent and active extra
    allCurrentTools = [...permanentTools];
    // permanentTools has Eraser at end.
    // Let's just put extras before eraser for better UX
    const eraser = allCurrentTools.pop();
    allCurrentTools = [...allCurrentTools, ...activeExtraTools, eraser];

    allCurrentTools.forEach(t => {
        const btn = document.createElement('button');
        btn.onclick = () => setMaterial(t.id);
        btn.id = 'btn-' + t.id;
        btn.className = `mat-btn w-28 h-8 ${t.col} hover:brightness-110 border-r-4 ${t.border} 
                        pointer-events-auto-child text-[8px] uppercase flex items-center pl-3 
                        shadow-lg transition-transform hover:translate-x-2 relative`;

        // Add marker for optional tools
        if (activeExtraTools.find(ex => ex.id === t.id)) {
            btn.innerHTML = `<span>${t.name}</span> <span class="absolute right-2 text-yellow-300 text-[6px]">*</span>`;
        } else {
            btn.innerText = t.name;
        }

        container.appendChild(btn);
    });

    // Re-highlight current
    setMaterial(currentMaterial);
}

function toggleBigInventory() {
    document.getElementById('bigInventory').classList.toggle('open');
    // Re-render if opening
    if (document.getElementById('bigInventory').classList.contains('open')) {
        renderBigInventory();
    }
}

function renderBigInventory() {
    const gridEl = document.getElementById('bigInventoryGrid');
    gridEl.innerHTML = '';

    extraToolsSource.forEach(item => {
        const isSelected = activeExtraTools.some(x => x.id === item.id);
        const el = document.createElement('button');
        el.onclick = () => selectExtraTool(item.id);

        el.className = `inventory-item flex flex-col items-stretch ${isSelected ? 'active' : ''}`;

        // Create a box similar to sidebar items
        el.innerHTML = `
            <div class="item-box ${item.col} h-10 flex items-center justify-between px-3 shadow-md">
                <span class="text-[8px] text-white uppercase font-bold drop-shadow">${item.name}</span>
                ${isSelected ? '<span class="text-[6px] text-yellow-200">✓</span>' : ''}
            </div>
            <span class="text-[7px] text-gray-500 mt-1 text-left px-1">${item.desc}</span>
        `;

        gridEl.appendChild(el);
    });
}

function selectExtraTool(id) {
    const target = extraToolsSource.find(t => t.id === id);
    if (!target) return;

    // Check if already active
    const idx = activeExtraTools.findIndex(t => t.id === id);

    if (idx >= 0) {
        // Already active -> REMOVE IT (Deselection)
        activeExtraTools.splice(idx, 1);

        // If the removed tool was the current selected one, switch to 'stone'
        if (currentMaterial === id) {
            setMaterial('stone');
        }

        renderBigInventory();
        renderTools();
    } else {
        // Add
        if (activeExtraTools.length >= 4) { // Limit 4
            // Remove first one (FIFO)
            activeExtraTools.shift();
        }
        activeExtraTools.push(target);
        renderBigInventory();
        renderTools();
        saveAllSettings(); // Persist selection
        setMaterial(id);
    }
}

// --- WORLD SAVING ---
let currentEditingWorldId = null;
let currentEditingWorldName = "";

function openCreateWorldDialog() {
    document.getElementById('saveDialog').classList.remove('hidden');
    document.getElementById('worldNameInput').focus();
}

function closeCreateWorldDialog() {
    document.getElementById('saveDialog').classList.add('hidden');
    document.getElementById('worldNameInput').value = '';
}

async function saveCurrentWorld() {
    const name = document.getElementById('worldNameInput').value.trim() || 'Unbenannt';
    const id = 'user-' + Date.now();
    await dbStorage.saveWorld(id, name, grid);
    closeCreateWorldDialog();
    refreshUserWorlds();
    enterEditMode(id, name);
}

function enterEditMode(id, name) {
    currentEditingWorldId = id;
    currentEditingWorldName = name;
    updateEditStatusUI();
}

function exitEditMode() {
    currentEditingWorldId = null;
    currentEditingWorldName = "";
    updateEditStatusUI();
}

function updateEditStatusUI() {
    const status = document.getElementById('editingStatus');
    const nameEl = document.getElementById('editingWorldName');
    if (currentEditingWorldId) {
        status.classList.remove('hidden');
        nameEl.innerText = currentEditingWorldName;
    } else {
        status.classList.add('hidden');
    }
}

async function autoSaveIfEditing() {
    if (currentEditingWorldId) {
        await dbStorage.saveWorld(currentEditingWorldId, currentEditingWorldName, grid);
    }
}

async function refreshUserWorlds() {
    const worlds = await dbStorage.getAllWorlds();
    const list = document.getElementById('userWorldsList');
    list.innerHTML = '';

    if (worlds.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = "text-[7px] text-gray-500 italic mt-2 text-center uppercase tracking-widest";
        emptyMsg.innerText = "Erstelle deine erste Welt";
        list.appendChild(emptyMsg);
        return;
    }

    worlds.sort((a, b) => b.timestamp - a.timestamp).forEach(w => {
        const row = document.createElement('div');
        row.className = "flex justify-between items-center group bg-white/5 hover:bg-white/10 p-1 rounded transition-all mb-1";

        row.innerHTML = `
            <button onclick="loadUserWorld('${w.id}')" class="flex-1 text-left truncate text-[10px] hover:text-yellow-400">
                📁 ${w.name.toUpperCase()}
            </button>
            <button onclick="deleteUserWorld(event, '${w.id}')" class="text-red-500 hover:text-red-400 px-2 text-[8px] font-bold">
                [X]
            </button>
        `;
        list.appendChild(row);
    });
}

async function loadUserWorld(id) {
    const all = await dbStorage.getAllWorlds();
    const w = all.find(x => x.id === id);
    if (w) {
        resetWorld();
        grid.set(w.data);
        toggleWorlds(); // Close panel
        enterEditMode(w.id, w.name);
    }
}

let worldToDeleteId = null;

async function deleteUserWorld(event, id) {
    event.stopPropagation();
    worldToDeleteId = id;
    document.getElementById('deleteConfirmDialog').classList.remove('hidden');

    // Set up click handler for the confirm button
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.onclick = async () => {
        if (currentEditingWorldId === worldToDeleteId) exitEditMode();
        await dbStorage.deleteWorld(worldToDeleteId);
        refreshUserWorlds();
        closeDeleteConfirmDialog();
    };
}

function closeDeleteConfirmDialog() {
    document.getElementById('deleteConfirmDialog').classList.add('hidden');
    worldToDeleteId = null;
}
window.deleteUserWorld = deleteUserWorld;
window.closeDeleteConfirmDialog = closeDeleteConfirmDialog;
window.loadUserWorld = loadUserWorld;

function setMaterial(id) {
    currentMaterial = id;

    // Check in all current tools
    let tool = allCurrentTools.find(t => t.id === id);
    // Fallback lookup if not in current list (e.g. if we just clicked a placeholder that isn't really a tool yet but is in ID range)
    if (!tool) tool = extraToolsSource.find(t => t.id === id) || permanentTools.find(t => t.id === id);

    if (tool) document.getElementById('currentMat').innerText = tool.name;

    document.querySelectorAll('.mat-btn').forEach(b => {
        b.classList.remove('translate-x-4', 'border-white');
    });
    const btn = document.getElementById('btn-' + id);
    if (btn) btn.classList.add('translate-x-4', 'border-white');
}

// Close big inventory when clicking outside (on the canvas)
document.addEventListener('mousedown', (e) => {
    const bigInv = document.getElementById('bigInventory');
    if (bigInv.classList.contains('open')) {
        // If click is NOT inside bigInv and NOT on a button that might open it
        if (!bigInv.contains(e.target) && !e.target.closest('button')) {
            toggleBigInventory();
        }
    }
});
