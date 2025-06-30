import { initializationError, showFirebaseError } from "./firebase-config.js";
import * as utils from "./utils.js";

// First, check if Firebase is configured. If not, show an error and stop.
if (initializationError) {
  utils.insertHeader(); // Show nav so user isn't stuck
  showFirebaseError();
  throw initializationError; // Halt script execution
}

// If no error, import other modules and run the app
import { storage } from "./storage.js";

// ===== Page Script Starts Here =====
utils.insertHeader();

let projectBaseData = null;
let activeTomSelects = [];
let currentEditingId = null;
let fileToImport = null;
let lastFocusedElement = null; // For accessibility

const modal = document.getElementById("modal");
const modalContent = modal.querySelector(".modal-content");
const modalTitle = document.getElementById("modal-title");
const modalSubtitle = document.getElementById("modal-subtitle");
const modalHeaderActions = document.getElementById("modal-header-actions");
const modalBody = document.getElementById("modal-body");
const modalMessageArea = document.getElementById("modal-message-area");
const modalSaveBtn = document.getElementById("modal-save-btn");

async function getProjectBase() {
  if (projectBaseData) return projectBaseData;
  projectBaseData = await storage.getProjectBase();
  return projectBaseData;
}

/**
 * Enables the save button once a change is detected in the modal body.
 * The listeners remove themselves after the first interaction for efficiency.
 */
function activateChangeDetection() {
  if (!modalSaveBtn.onclick) return;

  modalSaveBtn.disabled = true;

  const enableButton = () => {
    modalSaveBtn.disabled = false;
    // Clean up listeners after first use
    modalBody.removeEventListener("change", enableButton);
    modalBody.removeEventListener("input", enableButton);
  };

  modalBody.addEventListener("change", enableButton, { once: true });
  modalBody.addEventListener("input", enableButton, { once: true });
}

async function openModal(module) {
  lastFocusedElement = document.activeElement; // Save focus
  modal.setAttribute("aria-hidden", "false");
  modalContent.setAttribute("role", "dialog");
  modalContent.setAttribute("aria-modal", "true");
  modalContent.setAttribute("aria-labelledby", "modal-title");

  modalTitle.textContent = module.title;
  modalSubtitle.textContent = module.subtitle || "";
  modalBody.innerHTML =
    '<div class="message-box info" role="status">Carregando...</div>';

  modal.classList.add("active");
  if (module.needsMoreHeight) {
    modal.classList.add("modal-large");
  }

  document.getElementById("modal-footer").style.display = "flex";
  modalSaveBtn.style.display = "inline-flex";

  const projectData = await getProjectBase();
  if (!projectData || Object.keys(projectData).length === 0) {
    modalBody.innerHTML = `<p class="message-box error" role="alert">Nenhum dado de projeto base encontrado. Por favor, carregue um arquivo .xer na página principal primeiro.</p>`;
    modalSaveBtn.style.display = "none";
    return;
  }

  modalBody.innerHTML = await module.setup(projectData);
  modalHeaderActions.innerHTML = "";

  if (module.headerAction) {
    const btn = document.createElement("button");
    btn.id = module.headerAction.id;
    btn.innerHTML = module.headerAction.icon;
    btn.title = module.headerAction.tooltip;
    btn.setAttribute("aria-label", module.headerAction.tooltip);
    btn.className =
      "bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors";
    modalHeaderActions.appendChild(btn);
  }
  activeTomSelects.forEach((ts) => ts.destroy());
  activeTomSelects = [];
  modalMessageArea.innerHTML = "";

  if (module.save) {
    modalSaveBtn.onclick = module.save;
    activateChangeDetection();
  } else {
    modalSaveBtn.style.display = "none";
    modalSaveBtn.onclick = null;
  }

  const focusableElements = modalContent.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
  }
}

function closeModal() {
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("active");
  modal.classList.remove("modal-large");
  fileToImport = null;
  if (lastFocusedElement) {
    lastFocusedElement.focus(); // Restore focus
    lastFocusedElement = null;
  }
}

function handleFocusTrap(e) {
  if (e.key !== "Tab" || !modal.classList.contains("active")) return;

  const focusableElements = Array.from(
    modalContent.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0);

  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (e.shiftKey) {
    // Shift+Tab
    if (document.activeElement === firstElement) {
      lastElement.focus();
      e.preventDefault();
    }
  } else {
    // Tab
    if (document.activeElement === lastElement) {
      firstElement.focus();
      e.preventDefault();
    }
  }
}

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

async function renderActivityMappingTable() {
  let savedMapping = await storage.getData(
    storage.APP_KEYS.ACTIVITY_MAPPING_KEY
  );
  modalSaveBtn.style.display = "none";
  modalSubtitle.textContent =
    "Gerencie grupos de atividades que representam o mesmo trabalho.";
  if (document.getElementById("add-new-group-btn")) {
    document.getElementById("add-new-group-btn").onclick = () =>
      renderGroupEditForm();
  }

  savedMapping.sort((a, b) => a.groupName.localeCompare(b.groupName));
  let tableHtml = `<div class="table-container"><table><thead><tr><th>Nome do Grupo</th><th>Nº de Atividades</th><th class="text-right">Ações</th></tr></thead><tbody>`;
  if (savedMapping.length > 0) {
    savedMapping.forEach((group, index) => {
      tableHtml += `<tr><td class="font-semibold">${group.groupName}</td><td>${group.taskCodes.length}</td><td class="text-right"><div class="flex items-center justify-end gap-2"><button class="edit-group-btn text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100" data-group-name="${group.groupName}" title="Editar Grupo" aria-label="Editar grupo ${group.groupName}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.5 6.036z" /></svg></button><button class="delete-group-btn text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100" data-group-name="${group.groupName}" title="Excluir Grupo" aria-label="Excluir grupo ${group.groupName}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></td></tr>`;
    });
  } else {
    tableHtml += `<tr><td colspan="3" class="text-center text-tertiary py-6">Nenhum grupo de atividades criado.</td></tr>`;
  }
  tableHtml += `</tbody></table></div>`;
  modalBody.innerHTML = tableHtml;

  modalBody.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-group-btn");
    if (editBtn) {
      renderGroupEditForm(editBtn.dataset.groupName);
      return;
    }
    const deleteBtn = e.target.closest(".delete-group-btn");
    if (deleteBtn) {
      deleteGroup(deleteBtn.dataset.groupName);
      return;
    }
  });
}

async function renderGroupEditForm(groupName = null) {
  const savedMapping = await storage.getData(
    storage.APP_KEYS.ACTIVITY_MAPPING_KEY
  );
  const group = groupName
    ? savedMapping.find((g) => g.groupName === groupName)
    : { groupName: "", taskCodes: [] };
  currentEditingId = groupName;
  modalSubtitle.textContent = groupName
    ? `Editando o grupo "${groupName}"`
    : "Criando um novo grupo de atividades.";
  modalSaveBtn.style.display = "inline-flex";
  modalHeaderActions.innerHTML = "";
  modalBody.innerHTML = `<div class="space-y-4"><div><label for="group-name-input" class="font-bold text-primary">Nome do Grupo:</label><input type="text" id="group-name-input" value="${group.groupName}" class="form-input mt-1" placeholder="Ex: Escavação Total C2+C3"></div><div><label for="activity-group-select" class="font-semibold text-primary mt-2 block">Atividades do Grupo:</label><select id="activity-group-select" multiple></select></div></div>`;
  const usedTaskCodes = new Set();
  savedMapping.forEach((g) => {
    if (g.groupName !== groupName) {
      g.taskCodes.forEach((code) => usedTaskCodes.add(code));
    }
  });
  const selectEl = document.getElementById("activity-group-select");
  const allTasks = (await getProjectBase())?.TASK?.rows || [];
  const availableTasks = allTasks.filter(
    (task) => !usedTaskCodes.has(task.task_code)
  );
  const options = availableTasks
    .map((task) => ({
      value: task.task_code,
      text: `${task.task_code} - ${task.task_name}`,
    }))
    .sort((a, b) => a.text.localeCompare(b.text));
  const tomSelect = new TomSelect(selectEl, {
    options,
    plugins: ["remove_button"],
    placeholder: "Selecione 2 ou mais atividades...",
  });
  tomSelect.setValue(group.taskCodes);
  activeTomSelects.push(tomSelect);
  activateChangeDetection();
}

async function renderCustomValuesTable() {
  let savedValues = await storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY);
  modalSaveBtn.style.display = "none";
  modalSubtitle.textContent =
    "Gerencie valores que sobrepõem os dados do cronograma.";
  document
    .getElementById("add-custom-value-btn")
    ?.addEventListener("click", () => renderCustomValueEditForm());

  const project = await getProjectBase();
  const mapping = await storage.getData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY);

  const allItems = [
    ...(project?.TASK?.rows || []).map((t) => ({
      id: t.task_code,
      name: `${t.task_code} - ${t.task_name}`,
    })),
    ...mapping.map((g) => ({
      id: `group::${g.groupName}`,
      name: `[Grupo] ${g.groupName}`,
    })),
  ];
  const itemsMap = new Map(allItems.map((i) => [i.id, i.name]));
  savedValues.forEach((val) => (val.name = itemsMap.get(val.id) || val.id));
  savedValues.sort((a, b) => a.name.localeCompare(b.name));
  let tableHtml = `<div class="table-container"><table><thead><tr><th>Atividade / Grupo</th><th class="text-right">Previsto</th><th class="text-right">Realizado</th><th class="text-right">Ações</th></tr></thead><tbody>`;
  if (savedValues.length > 0) {
    savedValues.forEach((val) => {
      tableHtml += `<tr><td class="font-semibold">${
        val.name
      }</td><td class="text-right">${utils.formatNumberBR(
        val.planned
      )}</td><td class="text-right">${utils.formatNumberBR(
        val.actual
      )}</td><td class="text-right"><div class="flex items-center justify-end gap-2"><button class="edit-custom-value-btn text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100" data-id="${
        val.id
      }" title="Editar Valor" aria-label="Editar valor de ${
        val.name
      }"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.5 6.036z" /></svg></button><button class="delete-custom-value-btn text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100" data-id="${
        val.id
      }" title="Excluir Valor" aria-label="Excluir valor de ${
        val.name
      }"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></td></tr>`;
    });
  } else {
    tableHtml += `<tr><td colspan="4" class="text-center text-tertiary py-6">Nenhum valor personalizado definido.</td></tr>`;
  }
  tableHtml += `</tbody></table></div>`;
  modalBody.innerHTML = tableHtml;

  modalBody.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-custom-value-btn");
    if (editBtn) {
      renderCustomValueEditForm(editBtn.dataset.id);
      return;
    }
    const deleteBtn = e.target.closest(".delete-custom-value-btn");
    if (deleteBtn) {
      deleteCustomValue(deleteBtn.dataset.id);
      return;
    }
  });
}

async function renderCustomValueEditForm(id = null) {
  const savedValues = await storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY);
  const value = id
    ? savedValues.find((v) => v.id === id)
    : { id: null, planned: "", actual: "" };
  currentEditingId = id;
  modalSaveBtn.style.display = "inline-flex";
  modalHeaderActions.innerHTML = "";
  modalSubtitle.textContent = id
    ? `Editando valor para "${value.name || id}"`
    : "Criando um novo valor personalizado.";
  modalBody.innerHTML = `<div class="space-y-4"><div><label for="custom-value-select" class="font-bold text-primary">Atividade ou Grupo</label><select id="custom-value-select" class="mt-1"></select></div><div class="grid grid-cols-2 gap-4"><div><label for="custom-planned-input" class="font-bold text-primary">Previsto Personalizado</label><input type="number" step="any" id="custom-planned-input" class="form-input mt-1" value="${
    value.planned ?? ""
  }" placeholder="Ex: 1500.50"></div><div><label for="custom-actual-input" class="font-bold text-primary">Realizado Personalizado</label><input type="number" step="any" id="custom-actual-input" class="form-input mt-1" value="${
    value.actual ?? ""
  }" placeholder="Ex: 750.25"></div></div></div>`;
  const usedValueIds = new Set(savedValues.map((v) => v.id));
  if (id) {
    usedValueIds.delete(id);
  }
  const project = await getProjectBase();
  const mapping = await storage.getData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY);
  const allTasks = (project?.TASK?.rows || []).map((t) => ({
    value: t.task_code,
    text: `${t.task_code} - ${t.task_name}`,
  }));
  const allGroups = mapping.map((g) => ({
    value: `group::${g.groupName}`,
    text: `[Grupo] ${g.groupName}`,
  }));
  const allOptions = [...allTasks, ...allGroups];
  const availableOptions = allOptions
    .filter((opt) => !usedValueIds.has(opt.value))
    .sort((a, b) => a.text.localeCompare(b.text));
  const tomSelect = new TomSelect("#custom-value-select", {
    options: availableOptions,
    placeholder: "Selecione...",
  });
  tomSelect.setValue(value.id);
  if (id) {
    tomSelect.disable();
  }
  activeTomSelects.push(tomSelect);
  activateChangeDetection();
}

async function saveGroup() {
  modalSaveBtn.disabled = true;
  modalSaveBtn.textContent = "Salvando...";
  try {
    const groupName = document.getElementById("group-name-input").value;
    const tomSelect = activeTomSelects[0];
    const taskCodes = tomSelect ? tomSelect.getValue() : [];
    if (!groupName.trim()) {
      utils.showToast("O nome do grupo não pode ser vazio.", "error");
      return;
    }
    if (taskCodes.length < 2) {
      utils.showToast("Um grupo deve ter pelo menos 2 atividades.", "error");
      return;
    }
    let savedMapping = await storage.getData(
      storage.APP_KEYS.ACTIVITY_MAPPING_KEY
    );
    const newGroup = { groupName, taskCodes };
    if (currentEditingId !== null) {
      const index = savedMapping.findIndex(
        (g) => g.groupName === currentEditingId
      );
      if (index > -1) savedMapping[index] = newGroup;
    } else {
      savedMapping.push(newGroup);
    }
    await storage.saveData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY, savedMapping);
    utils.showToast("Grupo salvo com sucesso!", "success");
    setTimeout(closeModal, 1500);
  } catch (error) {
    utils.showToast(`Erro ao salvar grupo: ${error.message}`, "error");
  } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.textContent = "Salvar";
  }
}

async function deleteGroup(groupName) {
  if (confirm(`Tem certeza que deseja excluir o grupo "${groupName}"?`)) {
    try {
      let savedMapping = await storage.getData(
        storage.APP_KEYS.ACTIVITY_MAPPING_KEY
      );
      const newMapping = savedMapping.filter((g) => g.groupName !== groupName);
      await storage.saveData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY, newMapping);
      utils.showToast("Grupo excluído.", "success");
      await renderActivityMappingTable();
    } catch (error) {
      utils.showToast(`Erro ao excluir: ${error.message}`, "error");
    }
  }
}
async function saveCustomValue() {
  modalSaveBtn.disabled = true;
  modalSaveBtn.textContent = "Salvando...";
  try {
    const tomSelect = document.getElementById("custom-value-select").tomselect;
    const selectedId = tomSelect ? tomSelect.getValue() : null;
    const plannedVal = document.getElementById("custom-planned-input").value;
    const actualVal = document.getElementById("custom-actual-input").value;

    if (!selectedId) {
      utils.showToast("Selecione uma atividade ou grupo.", "error");
      return;
    }
    if (plannedVal.trim() === "" && actualVal.trim() === "") {
      utils.showToast(
        "Preencha pelo menos um dos valores (previsto ou realizado).",
        "error"
      );
      return;
    }

    let savedValues = await storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY);
    const newValue = {
      id: selectedId,
      planned: plannedVal.trim() !== "" ? parseFloat(plannedVal) : null,
      actual: actualVal.trim() !== "" ? parseFloat(actualVal) : null,
    };

    const indexToUpdate = savedValues.findIndex(
      (v) => v.id === currentEditingId
    );

    if (indexToUpdate > -1) {
      savedValues[indexToUpdate] = newValue;
    } else {
      savedValues.push(newValue);
    }
    await storage.saveData(storage.APP_KEYS.CUSTOM_VALUES_KEY, savedValues);
    utils.showToast("Valor personalizado salvo!", "success");
    setTimeout(closeModal, 1500);
  } catch (error) {
    utils.showToast(`Erro ao salvar: ${error.message}`, "error");
  } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.textContent = "Salvar";
  }
}
async function deleteCustomValue(id) {
  if (confirm("Tem certeza que deseja excluir este valor personalizado?")) {
    try {
      let savedValues = await storage.getData(
        storage.APP_KEYS.CUSTOM_VALUES_KEY
      );
      const newValues = savedValues.filter((v) => v.id !== id);
      await storage.saveData(storage.APP_KEYS.CUSTOM_VALUES_KEY, newValues);
      utils.showToast("Valor excluído.", "success");
      await renderCustomValuesTable();
    } catch (error) {
      utils.showToast(`Erro ao excluir: ${error.message}`, "error");
    }
  }
}

async function processAndSaveWeeksFile(file) {
  const feedbackEl = document.getElementById("weeks-feedback");
  if (!file) {
    utils.showToast("Por favor, selecione um arquivo.", "error");
    if (feedbackEl)
      feedbackEl.textContent = "Erro: Por favor, selecione um arquivo.";
    return;
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    utils.showToast("Tipo de arquivo inválido. Use um arquivo .xlsx", "error");
    document.getElementById("weeks-file-name").textContent = "";
    if (feedbackEl)
      feedbackEl.textContent =
        "Erro: Tipo de arquivo inválido. Use um arquivo .xlsx";
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      if (feedbackEl)
        feedbackEl.textContent = `Arquivo ${file.name} selecionado. Processando...`;
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet);
      if (
        json.length === 0 ||
        !json[0].hasOwnProperty("Semana") ||
        !json[0].hasOwnProperty("Data")
      ) {
        throw new Error(
          'O arquivo Excel deve conter as colunas "Semana" e "Data".'
        );
      }
      const processedWeeks = json
        .map((row) => ({
          Semana: row.Semana,
          Data: new Date((row.Data - (25567 + 2)) * 86400 * 1000),
        }))
        .sort((a, b) => a.Data - b.Data);
      const weekRanges = [];
      let currentWeek = null;
      for (let i = 0; i < processedWeeks.length; i++) {
        if (processedWeeks[i].Semana !== currentWeek?.Semana) {
          if (currentWeek) {
            currentWeek.Data_Fim = new Date(processedWeeks[i - 1].Data);
            weekRanges.push(currentWeek);
          }
          currentWeek = {
            Semana: processedWeeks[i].Semana,
            Data_Inicio: new Date(processedWeeks[i].Data),
          };
        }
      }
      if (currentWeek) {
        currentWeek.Data_Fim = new Date(
          processedWeeks[processedWeeks.length - 1].Data
        );
        weekRanges.push(currentWeek);
      }
      const finalData = weekRanges.map((w) => ({
        Semana: w.Semana,
        Data_Inicio: w.Data_Inicio.toISOString().split("T")[0],
        Data_Fim: w.Data_Fim.toISOString().split("T")[0],
      }));
      await storage.saveData(storage.APP_KEYS.WEEKS_DATA_KEY, finalData);
      utils.showToast("Mapeamento de semanas salvo com sucesso!", "success");
      if (feedbackEl)
        feedbackEl.textContent = "Mapeamento de semanas salvo com sucesso!";
      setTimeout(closeModal, 1500);
    } catch (err) {
      console.error(err);
      utils.showToast(`Erro ao processar o arquivo: ${err.message}`, "error");
      if (feedbackEl)
        feedbackEl.textContent = `Erro ao processar o arquivo: ${err.message}`;
    }
  };
  reader.readAsArrayBuffer(file);
}

const CONFIG_MODULES = {
  weeks: {
    title: "Mapeamento de Semanas",
    subtitle:
      'Carregue um arquivo Excel (.xlsx) com as colunas "Semana" e "Data".',
    setup: () => `
             <div id="weeks-drop-area" class="drop-area" tabindex="0" role="region" aria-labelledby="modal-title" aria-describedby="modal-subtitle">
                <p class="text-xl text-tertiary mb-4">Arraste e solte o arquivo .xlsx aqui</p>
                <p class="text-quaternary mb-4">- OU -</p>
                <label for="weeks-file-input" class="file-input-label">Selecionar Arquivo</label>
                <input type="file" id="weeks-file-input" accept=".xlsx" class="sr-only"/>
                <p id="weeks-file-name" class="mt-4 text-sm font-medium text-primary"></p>
                <div id="weeks-feedback" class="sr-only" aria-live="polite"></div>
             </div>`,
    save: null,
  },
  resource: {
    title: "Recurso Principal de Avanço",
    subtitle: "Selecione o recurso que representa o avanço físico do projeto.",
    setup: async (project) => {
      const resources = project?.RSRC?.rows || [];
      if (resources.length === 0)
        return "<p>Nenhum recurso encontrado. Carregue um arquivo .xer primeiro.</p>";
      const savedResource = await storage.getData(
        storage.APP_KEYS.MAIN_RESOURCE_KEY
      );
      const options = resources
        .map(
          (r) =>
            `<option value="${r.rsrc_name}" ${
              savedResource === r.rsrc_name ? "selected" : ""
            }>${r.rsrc_name}</option>`
        )
        .join("");
      return `<label for="modal-resource-select" class="sr-only">Recurso Principal</label><select id="modal-resource-select" class="form-input">${options}</select>`;
    },
    save: async () => {
      modalSaveBtn.disabled = true;
      modalSaveBtn.textContent = "Salvando...";
      try {
        const select = document.getElementById("modal-resource-select");
        if (select && select.value) {
          await storage.saveData(
            storage.APP_KEYS.MAIN_RESOURCE_KEY,
            select.value
          );
          utils.showToast("Recurso salvo!", "success");
          setTimeout(closeModal, 1500);
        } else {
          utils.showToast("Nenhum recurso selecionado.", "error");
        }
      } catch (error) {
        utils.showToast(`Erro ao salvar: ${error.message}`, "error");
      } finally {
        modalSaveBtn.disabled = false;
        modalSaveBtn.textContent = "Salvar";
      }
    },
  },
  grouping: {
    title: "Agrupamento da Visão Semanal",
    subtitle:
      'Selecione os níveis da WBS para agrupar as atividades na página "Próximas Semanas".',
    setup: async (project) => {
      const wbsHierarchy = project?.WBS_HIERARCHY?.rows || [];
      if (wbsHierarchy.length === 0)
        return "<p>Nenhuma hierarquia WBS encontrada. Carregue um arquivo .xer primeiro.</p>";
      const maxLevel = Math.max(
        0,
        ...wbsHierarchy.map((w) => parseInt(w.level, 10))
      );
      const savedLevels = await storage.getData(
        storage.APP_KEYS.WEEKS_VIEW_GROUPING_KEY
      );
      let checkboxesHtml =
        '<fieldset><legend class="sr-only">Níveis de agrupamento</legend><div class="grid grid-cols-4 gap-2">';
      for (let i = 1; i <= maxLevel; i++) {
        checkboxesHtml += `<div><input type="checkbox" id="level-${i}" value="${i}" ${
          savedLevels.includes(i) ? "checked" : ""
        } class="mr-2"><label for="level-${i}">Nível ${i}</label></div>`;
      }
      checkboxesHtml += "</div></fieldset>";
      return checkboxesHtml;
    },
    save: async () => {
      modalSaveBtn.disabled = true;
      modalSaveBtn.textContent = "Salvando...";
      try {
        const selectedLevels = [];
        document
          .querySelectorAll('input[type="checkbox"]:checked')
          .forEach((cb) => {
            selectedLevels.push(parseInt(cb.value));
          });
        await storage.saveData(
          storage.APP_KEYS.WEEKS_VIEW_GROUPING_KEY,
          selectedLevels.sort((a, b) => a - b)
        );
        utils.showToast("Agrupamento salvo com sucesso!", "success");
        setTimeout(closeModal, 1500);
      } catch (error) {
        utils.showToast(`Erro ao salvar: ${error.message}`, "error");
      } finally {
        modalSaveBtn.disabled = false;
        modalSaveBtn.textContent = "Salvar";
      }
    },
  },
  "hidden-activities": {
    title: "Ocultar Atividades",
    subtitle:
      "Atividades selecionadas não aparecerão no dashboard de próximas semanas.",
    needsMoreHeight: true,
    setup: async () =>
      `<label for="hidden-activities-select" class="sr-only">Atividades a ocultar</label><select id="hidden-activities-select" multiple placeholder="Busque por código ou nome..."></select>`,
    save: async () => {
      modalSaveBtn.disabled = true;
      modalSaveBtn.textContent = "Salvando...";
      try {
        const tomSelect = activeTomSelects[0];
        if (tomSelect) {
          await storage.saveData(
            storage.APP_KEYS.WEEKS_VIEW_HIDDEN_ACTIVITIES_KEY,
            tomSelect.getValue()
          );
          utils.showToast("Lista salva!", "success");
          setTimeout(closeModal, 1500);
        }
      } catch (error) {
        utils.showToast(`Erro ao salvar: ${error.message}`, "error");
      } finally {
        modalSaveBtn.disabled = false;
        modalSaveBtn.textContent = "Salvar";
      }
    },
  },
  "activity-mapping": {
    title: "Mapeamento de Atividades",
    needsMoreHeight: true,
    headerAction: {
      id: "add-new-group-btn",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`,
      tooltip: "Adicionar Novo Grupo",
    },
    setup: () => "",
    save: saveGroup,
  },
  restrictions: {
    title: "Gerenciar Restrições",
    needsMoreHeight: true,
    headerAction: {
      id: "add-new-restriction-btn",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`,
      tooltip: "Adicionar Nova Restrição",
    },
    setup: () => "",
    save: saveRestriction,
  },
  "custom-values": {
    title: "Valores Personalizados",
    needsMoreHeight: true,
    headerAction: {
      id: "add-custom-value-btn",
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`,
      tooltip: "Adicionar Novo Valor",
    },
    setup: () => "",
    save: saveCustomValue,
  },
  backup: {
    title: "Importar & Exportar",
    subtitle:
      "Salve ou restaure um backup de todos os dados e configurações do sistema.",
    setup: () => `
                <div class="space-y-6">
                    <div>
                        <h3 id="export-title" class="font-semibold text-lg text-primary mb-2">Exportar Dados</h3>
                        <p id="export-subtitle" class="text-secondary mb-4">Clique no botão para baixar um arquivo .json contendo todos os projetos, configurações e valores personalizados.</p>
                        <button id="export-btn" class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-semibold">Exportar Todos os Dados</button>
                    </div>
                    <div class="border-t pt-6">
                        <h3 id="import-title" class="font-semibold text-lg text-primary mb-2">Importar Dados</h3>
                        <p id="import-subtitle" class="text-secondary mb-4">Arraste um arquivo de backup (.json) ou selecione-o para restaurar os dados. <strong class="text-red-600">Atenção: Isso substituirá todos os dados atuais.</strong></p>
                        <div id="import-drop-area" class="drop-area" tabindex="0" role="region" aria-labelledby="import-title" aria-describedby="import-subtitle">
                            <p class="text-xl text-tertiary mb-4">Arraste e solte o arquivo .json aqui</p>
                            <p class="text-quaternary my-4">- OU -</p>
                            <label for="import-file-input" class="file-input-label">Selecionar Arquivo de Backup</label>
                            <input type="file" id="import-file-input" accept=".json" class="sr-only"/>
                            <p id="import-file-name" class="mt-4 text-sm font-medium text-primary"></p>
                            <div id="import-feedback" class="sr-only" aria-live="polite"></div>
                        </div>
                        <button id="start-import-btn" class="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed" disabled>Confirmar e Importar Arquivo</button>
                    </div>
                </div>`,
    save: null,
  },
};

// --- Inicialização da Página e Event Listeners ---
(async () => {
  const cardConfigs = {
    "config-weeks": "weeks",
    "config-resource": "resource",
    "config-grouping": "grouping",
    "config-hidden-activities": "hidden-activities",
    "config-activity-mapping": "activity-mapping",
    "config-restrictions": "restrictions",
    "config-custom-values": "custom-values",
    "config-backup": "backup",
  };
  for (const [cardId, moduleName] of Object.entries(cardConfigs)) {
    const cardElement = document.getElementById(cardId);
    if (cardElement) {
      const module = CONFIG_MODULES[moduleName];
      cardElement.addEventListener("click", () => handleCardClick(module));
      cardElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick(module);
        }
      });
    }
  }

  async function handleCardClick(module) {
    await openModal(module);

    // Post-modal-open setup for specific modules
    if (module === CONFIG_MODULES.weeks) {
      document.getElementById("modal-footer").style.display = "none";
      const dropArea = document.getElementById("weeks-drop-area");
      const fileInput = document.getElementById("weeks-file-input");
      const fileNameDisplay = document.getElementById("weeks-file-name");

      dropArea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileInput.click();
        }
      });

      const handleFile = (file) => {
        if (file) {
          fileNameDisplay.textContent = `Arquivo: ${file.name}`;
          processAndSaveWeeksFile(file);
        }
      };

      ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) =>
        dropArea.addEventListener(
          eventName,
          (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          false
        )
      );
      ["dragenter", "dragover"].forEach((eventName) =>
        dropArea.addEventListener(
          eventName,
          () => dropArea.classList.add("border-blue-500", "bg-blue-50"),
          false
        )
      );
      ["dragleave", "drop"].forEach((eventName) =>
        dropArea.addEventListener(
          eventName,
          () => dropArea.classList.remove("border-blue-500", "bg-blue-50"),
          false
        )
      );
      dropArea.addEventListener(
        "drop",
        async (e) => {
          if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
          }
        },
        false
      );
      fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
          handleFile(fileInput.files[0]);
        }
      });
    } else if (module === CONFIG_MODULES["hidden-activities"]) {
      const selectEl = document.getElementById("hidden-activities-select");
      const project = await getProjectBase();
      const allTasks = project?.TASK?.rows || [];
      const options = allTasks
        .sort((a, b) => a.task_code.localeCompare(b.task_code))
        .map((t) => ({
          value: t.task_code,
          text: `${t.task_code} - ${t.task_name}`,
        }));
      if (selectEl) {
        const tomSelect = new TomSelect(selectEl, {
          options,
          plugins: ["remove_button"],
        });
        tomSelect.setValue(
          await storage.getData(
            storage.APP_KEYS.WEEKS_VIEW_HIDDEN_ACTIVITIES_KEY
          )
        );
        activeTomSelects.push(tomSelect);
        activateChangeDetection();
      }
    } else if (module === CONFIG_MODULES["activity-mapping"]) {
      await renderActivityMappingTable();
    } else if (module === CONFIG_MODULES.restrictions) {
      await renderRestrictionsTable();
    } else if (module === CONFIG_MODULES["custom-values"]) {
      await renderCustomValuesTable();
    } else if (module === CONFIG_MODULES.backup) {
      document.getElementById("modal-footer").style.display = "none";

      document.getElementById("export-btn").onclick = async () => {
        const backupData = await storage.exportAllData();
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `chronoflow_backup_${
          new Date().toISOString().split("T")[0]
        }.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        utils.showToast("Exportação iniciada.", "success");
      };

      const importInput = document.getElementById("import-file-input");
      const importBtn = document.getElementById("start-import-btn");
      const importDropArea = document.getElementById("import-drop-area");
      const importFileNameDisplay = document.getElementById("import-file-name");

      importDropArea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          importInput.click();
        }
      });

      const handleFileSelection = (selectedFile) => {
        const feedbackEl = document.getElementById("import-feedback");
        if (selectedFile && selectedFile.name.toLowerCase().endsWith(".json")) {
          fileToImport = selectedFile;
          importFileNameDisplay.textContent = `Arquivo: ${fileToImport.name}`;
          if (feedbackEl)
            feedbackEl.textContent = `Arquivo ${fileToImport.name} selecionado.`;
          importBtn.disabled = false;
          importDropArea.classList.add("border-green-500", "bg-green-50");
          importDropArea.classList.remove("border-red-500", "bg-red-50");
        } else {
          fileToImport = null;
          importBtn.disabled = true;
          importDropArea.classList.remove("border-green-500", "bg-green-50");
          if (selectedFile) {
            importFileNameDisplay.textContent =
              "Por favor, use um arquivo .json válido.";
            if (feedbackEl)
              feedbackEl.textContent =
                "Erro: Por favor, use um arquivo .json válido.";
            importDropArea.classList.add("border-red-500", "bg-red-50");
            utils.showToast(
              "Tipo de arquivo inválido. Apenas arquivos .json são permitidos.",
              "error"
            );
          } else {
            importFileNameDisplay.textContent = "";
          }
        }
      };

      importInput.onchange = () => {
        handleFileSelection(
          importInput.files.length > 0 ? importInput.files[0] : null
        );
      };

      ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
        importDropArea.addEventListener(
          eventName,
          (e) => {
            e.preventDefault();
            e.stopPropagation();
          },
          false
        );
      });
      ["dragenter", "dragover"].forEach((eventName) => {
        importDropArea.addEventListener(
          eventName,
          () => {
            if (!importDropArea.classList.contains("border-green-500")) {
              importDropArea.classList.add("border-blue-500", "bg-blue-50");
            }
          },
          false
        );
      });
      ["dragleave", "drop"].forEach((eventName) => {
        importDropArea.addEventListener(
          eventName,
          () => {
            importDropArea.classList.remove("border-blue-500", "bg-blue-50");
          },
          false
        );
      });
      importDropArea.addEventListener(
        "drop",
        (e) => {
          if (e.dataTransfer.files.length > 0) {
            importInput.files = e.dataTransfer.files;
            handleFileSelection(e.dataTransfer.files[0]);
          }
        },
        false
      );

      importBtn.onclick = async () => {
        if (
          fileToImport &&
          confirm(
            "Tem certeza que deseja importar este arquivo? Todos os dados atuais (projetos, configurações, etc.) serão substituídos. Esta ação não pode ser desfeita."
          )
        ) {
          importBtn.textContent = "Importando...";
          importBtn.disabled = true;
          const reader = new FileReader();
          reader.onload = async function (e) {
            const feedbackEl = document.getElementById("import-feedback");
            try {
              if (feedbackEl)
                feedbackEl.textContent = `Processando arquivo ${fileToImport.name}...`;
              const data = JSON.parse(e.target.result);
              const importedKeys = await storage.importAllData(data);
              if (importedKeys > 0) {
                if (feedbackEl)
                  feedbackEl.textContent =
                    "Dados importados com sucesso! A página será recarregada.";
                utils.showToast(
                  "Dados importados com sucesso! A página será recarregada.",
                  "success"
                );
                setTimeout(() => window.location.reload(), 2000);
              } else {
                throw new Error("O arquivo não parece ser um backup válido.");
              }
            } catch (err) {
              if (feedbackEl)
                feedbackEl.textContent = `Erro ao importar: ${err.message}`;
              utils.showToast(`Erro ao importar: ${err.message}`, "error");
              importBtn.textContent = "Confirmar e Importar Arquivo";
              importBtn.disabled = false;
            }
          };
          reader.readAsText(fileToImport);
        } else if (!fileToImport) {
          utils.showToast(
            "Por favor, selecione um arquivo para importar.",
            "error"
          );
        }
      };
    }
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document
    .getElementById("modal-close-btn")
    .addEventListener("click", closeModal);
  document
    .getElementById("modal-cancel-btn")
    .addEventListener("click", closeModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      closeModal();
    }
    handleFocusTrap(e);
  });
})();

// --- Restriction Management Functions ---

async function renderRestrictionsTable() {
  let [restrictionsList, restrictionLinks] = await Promise.all([
    storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
    storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
  ]);
  modalSaveBtn.style.display = "none";
  modalSubtitle.textContent =
    "Gerencie todas as restrições do projeto e seus vínculos.";
  if (document.getElementById("add-new-restriction-btn")) {
    document.getElementById("add-new-restriction-btn").onclick = () =>
      renderRestrictionEditForm();
  }

  const linksByRestrictionId = restrictionLinks.reduce((acc, link) => {
    if (!acc[link.restrictionId]) acc[link.restrictionId] = [];
    acc[link.restrictionId].push(link.itemId);
    return acc;
  }, {});

  restrictionsList.sort((a, b) => a.desc.localeCompare(b.desc));

  let tableHtml = `<div class="table-container"><table><thead><tr><th>Descrição</th><th>Status</th><th>Nº de Vínculos</th><th class="text-right">Ações</th></tr></thead><tbody>`;
  if (restrictionsList.length > 0) {
    restrictionsList.forEach((restr) => {
      const linkCount = linksByRestrictionId[restr.id]?.length || 0;
      const statusText = restr.status === "pending" ? "Pendente" : "Resolvido";
      tableHtml += `
                      <tr>
                          <td class="font-semibold">${restr.desc}</td>
                          <td><span class="badge ${
                            restr.status === "pending"
                              ? "status-pending-restr"
                              : "status-resolved-restr"
                          }">${statusText}</span></td>
                          <td>${linkCount}</td>
                          <td class="text-right">
                              <div class="flex items-center justify-end gap-2">
                                  <button class="edit-restriction-btn text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100" data-id="${
                                    restr.id
                                  }" title="Editar Restrição" aria-label="Editar restrição: ${
        restr.desc
      }"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.5 6.036z" /></svg></button>
                                  <button class="delete-restriction-btn text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100" data-id="${
                                    restr.id
                                  }" title="Excluir Restrição" aria-label="Excluir restrição: ${
        restr.desc
      }"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                              </div>
                          </td>
                      </tr>`;
    });
  } else {
    tableHtml += `<tr><td colspan="4" class="text-center text-tertiary py-6">Nenhuma restrição criada.</td></tr>`;
  }
  tableHtml += `</tbody></table></div>`;
  modalBody.innerHTML = tableHtml;

  modalBody.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-restriction-btn");
    if (editBtn) {
      renderRestrictionEditForm(editBtn.dataset.id);
      return;
    }
    const deleteBtn = e.target.closest(".delete-restriction-btn");
    if (deleteBtn) {
      deleteRestriction(deleteBtn.dataset.id);
      return;
    }
  });
}

async function renderRestrictionEditForm(restrictionId = null) {
  const [restrictionsList, restrictionLinks, activityMapping] =
    await Promise.all([
      storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
      storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
      storage.getData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY),
    ]);

  const restriction = restrictionId
    ? restrictionsList.find((r) => r.id === restrictionId)
    : { desc: "", resp: "", due: "", status: "pending" };
  currentEditingId = restrictionId;

  const linkedItemIds = restrictionId
    ? restrictionLinks
        .filter((l) => l.restrictionId === restrictionId)
        .map((l) => l.itemId)
    : [];

  modalSubtitle.textContent = restrictionId
    ? `Editando restrição`
    : "Criando uma nova restrição.";
  modalSaveBtn.style.display = "inline-flex";
  modalHeaderActions.innerHTML = "";

  modalBody.innerHTML = `
              <div class="space-y-4">
                  <div>
                    <label for="restriction-desc-input" class="font-bold text-primary">Descrição da Restrição</label>
                    <input type="text" id="restriction-desc-input" value="${
                      restriction.desc
                    }" class="form-input mt-1" placeholder="Ex: Atraso na entrega de material">
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div><label for="restriction-resp-input" class="font-bold text-primary">Responsável</label><input type="text" id="restriction-resp-input" value="${
                        restriction.resp
                      }" class="form-input mt-1"></div>
                      <div><label for="restriction-due-input" class="font-bold text-primary">Prazo</label><input type="date" id="restriction-due-input" value="${
                        restriction.due
                      }" class="form-input mt-1"></div>
                      <div>
                          <label for="restriction-status-select" class="font-bold text-primary">Status</label>
                          <select id="restriction-status-select" class="form-input mt-1">
                              <option value="pending" ${
                                restriction.status === "pending"
                                  ? "selected"
                                  : ""
                              }>Pendente</option>
                              <option value="resolved" ${
                                restriction.status === "resolved"
                                  ? "selected"
                                  : ""
                              }>Resolvido</option>
                          </select>
                      </div>
                  </div>
                  <div>
                      <label for="restriction-links-select" class="font-semibold text-primary mt-2 block">Vincular a Atividades/Grupos:</label>
                      <select id="restriction-links-select" multiple></select>
                  </div>
              </div>`;

  const project = await getProjectBase();
  const allTasks = (project?.TASK?.rows || []).map((t) => ({
    value: t.task_code,
    text: `${t.task_code} - ${t.task_name}`,
  }));
  const allGroups = activityMapping.map((g) => ({
    value: `group::${g.groupName}`,
    text: `[Grupo] ${g.groupName}`,
  }));
  const allOptions = [...allTasks, ...allGroups].sort((a, b) =>
    a.text.localeCompare(b.text)
  );

  const tomSelect = new TomSelect("#restriction-links-select", {
    options: allOptions,
    plugins: ["remove_button"],
    placeholder: "Selecione os itens impactados...",
  });
  tomSelect.setValue(linkedItemIds);
  activeTomSelects.push(tomSelect);

  activateChangeDetection();
}

async function saveRestriction() {
  modalSaveBtn.disabled = true;
  modalSaveBtn.textContent = "Salvando...";
  try {
    const desc = document.getElementById("restriction-desc-input").value.trim();
    if (!desc) {
      utils.showToast("A descrição da restrição não pode ser vazia.", "error");
      return;
    }

    let [restrictionsList, restrictionLinks] = await Promise.all([
      storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
      storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
    ]);

    const restrictionData = {
      id: currentEditingId || uuidv4(),
      desc: desc,
      resp: document.getElementById("restriction-resp-input").value,
      due: document.getElementById("restriction-due-input").value,
      status: document.getElementById("restriction-status-select").value,
    };

    if (currentEditingId) {
      const index = restrictionsList.findIndex(
        (r) => r.id === currentEditingId
      );
      if (index > -1) restrictionsList[index] = restrictionData;
    } else {
      restrictionsList.push(restrictionData);
    }

    const tomSelect = activeTomSelects[0];
    const selectedItemIds = tomSelect ? tomSelect.getValue() : [];
    const otherLinks = restrictionLinks.filter(
      (l) => l.restrictionId !== restrictionData.id
    );
    const newLinks = selectedItemIds.map((itemId) => ({
      restrictionId: restrictionData.id,
      itemId,
    }));
    const finalLinks = [...otherLinks, ...newLinks];

    await Promise.all([
      storage.saveData(
        storage.APP_KEYS.RESTRICTIONS_LIST_KEY,
        restrictionsList
      ),
      storage.saveData(storage.APP_KEYS.RESTRICTION_LINKS_KEY, finalLinks),
    ]);

    utils.showToast("Restrição salva com sucesso!", "success");
    setTimeout(closeModal, 1500);
  } catch (error) {
    utils.showToast(`Erro ao salvar restrição: ${error.message}`, "error");
  } finally {
    modalSaveBtn.disabled = false;
    modalSaveBtn.textContent = "Salvar";
  }
}

async function deleteRestriction(restrictionId) {
  if (
    confirm(
      "Tem certeza que deseja excluir esta restrição? Todos os seus vínculos também serão removidos."
    )
  ) {
    try {
      let [restrictionsList, restrictionLinks] = await Promise.all([
        storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
        storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
      ]);

      const newRestrictionsList = restrictionsList.filter(
        (r) => r.id !== restrictionId
      );
      const newRestrictionLinks = restrictionLinks.filter(
        (l) => l.restrictionId !== restrictionId
      );

      await Promise.all([
        storage.saveData(
          storage.APP_KEYS.RESTRICTIONS_LIST_KEY,
          newRestrictionsList
        ),
        storage.saveData(
          storage.APP_KEYS.RESTRICTION_LINKS_KEY,
          newRestrictionLinks
        ),
      ]);

      utils.showToast("Restrição excluída.", "success");
      await renderRestrictionsTable();
    } catch (error) {
      utils.showToast(`Erro ao excluir: ${error.message}`, "error");
    }
  }
}
