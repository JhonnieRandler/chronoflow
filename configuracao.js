import {
  initializationError,
  showFirebaseError,
  storage as firebaseStorage,
} from "./firebase-config.js";
import * as utils from "./utils.js";
import {
  Modal,
  renderWeeksConfigBody,
  renderResourceConfigBody,
  renderGroupingConfigBody,
  renderHiddenActivitiesBody,
  renderBackupBody,
  renderCustomValuesBody,
} from "./ui-components.js";
import { dataLoader } from "./data-loader.js";
import {
  ref,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

// First, check if Firebase is configured. If not, show an error and stop.
if (initializationError) {
  utils.insertHeader(); // Show nav so user isn't stuck
  showFirebaseError();
  throw initializationError; // Halt script execution
}

// If no error, import other modules and run the app
import { storage } from "./storage.js";

// ===== Page Script Starts Here =====

(async () => {
  utils.insertHeader();

  let activeTomSelects = [];
  let currentEditingId = null;
  let fileToImport = null;
  let activeMilestoneRow = null; // For the new milestone editor

  const modal = new Modal("modal");

  /**
   * Checks if group data uses old name-based IDs and migrates to stable UUIDs.
   * This is a one-time operation that ensures data integrity.
   */
  async function migrateToGroupIds() {
    const [activityMapping, restrictionLinks, customValues, activityMedia] =
      await Promise.all([
        storage.getData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY),
        storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
        storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY),
        storage.getActivityMedia(), // This gets an array [{id, ...data}]
      ]);

    if (!activityMapping.some((group) => !group.groupId)) {
      return; // No migration needed
    }

    utils.showToast(
      "Atualizando estrutura de dados. A página será recarregada em breve.",
      "info",
      5000
    );

    const idMap = new Map();
    activityMapping.forEach((group) => {
      if (!group.groupId) {
        const oldId = `group::${group.groupName}`;
        group.groupId = utils.uuidv4();
        idMap.set(oldId, `group::${group.groupId}`);
      }
    });

    restrictionLinks.forEach((link) => {
      if (idMap.has(link.itemId)) link.itemId = idMap.get(link.itemId);
    });
    customValues.forEach((value) => {
      if (idMap.has(value.id)) value.id = idMap.get(value.id);
    });

    const mediaMigrationPromises = [];
    activityMedia.forEach((mediaDoc) => {
      if (idMap.has(mediaDoc.id)) {
        const newId = idMap.get(mediaDoc.id);
        const { id, ...dataToSave } = mediaDoc; // Destructure to get data without the 'id' field
        mediaMigrationPromises.push(
          storage.saveActivityMedia(newId, dataToSave),
          storage.deleteActivityMedia(mediaDoc.id)
        );
      }
    });

    await Promise.all([
      storage.saveData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY, activityMapping),
      storage.saveData(
        storage.APP_KEYS.RESTRICTION_LINKS_KEY,
        restrictionLinks
      ),
      storage.saveData(storage.APP_KEYS.CUSTOM_VALUES_KEY, customValues),
      ...mediaMigrationPromises,
    ]);

    setTimeout(() => window.location.reload(), 2000);
  }

  // --- Specific Module Handlers ---

  async function handleWeeksConfig() {
    modal.open({
      title: "Mapeamento de Semanas",
      subtitle:
        'Carregue um arquivo Excel (.xlsx) com as colunas "Semana" e "Data".',
      bodyHtml: renderWeeksConfigBody(),
      showFooter: false,
      onOpen: () => {
        let selectedFile = null;
        const dropArea = document.getElementById("weeks-drop-area");
        const fileInput = document.getElementById("weeks-file-input");
        const confirmationArea = document.getElementById(
          "weeks-confirmation-area"
        );
        const confirmFileName = document.getElementById(
          "weeks-confirm-file-name"
        );
        const processBtn = document.getElementById("weeks-process-btn");
        const cancelBtn = document.getElementById("weeks-cancel-btn");

        const showConfirmation = (file) => {
          selectedFile = file;
          confirmFileName.textContent = file.name;
          dropArea.classList.add("hidden");
          confirmationArea.classList.remove("hidden");
        };

        const hideConfirmation = () => {
          selectedFile = null;
          fileInput.value = ""; // Reset file input
          dropArea.classList.remove("hidden");
          confirmationArea.classList.add("hidden");
        };

        processBtn.onclick = () => processAndSaveWeeksFile(selectedFile);
        cancelBtn.onclick = hideConfirmation;

        const handleFile = (file, source) => {
          if (!file || !file.name.toLowerCase().endsWith(".xlsx")) {
            utils.showToast(
              "Tipo de arquivo inválido. Use um arquivo .xlsx",
              "error"
            );
            return;
          }
          if (source === "click") {
            showConfirmation(file);
          } else {
            processAndSaveWeeksFile(file);
          }
        };

        dropArea.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInput.click();
          }
        });
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
            () => dropArea.classList.add("highlight"),
            false
          )
        );
        ["dragleave", "drop"].forEach((eventName) =>
          dropArea.addEventListener(
            eventName,
            () => dropArea.classList.remove("highlight"),
            false
          )
        );
        dropArea.addEventListener(
          "drop",
          (e) => {
            if (e.dataTransfer.files.length > 0) {
              handleFile(e.dataTransfer.files[0], "drag");
            }
          },
          false
        );
        fileInput.addEventListener("change", () => {
          if (fileInput.files.length > 0) {
            handleFile(fileInput.files[0], "click");
          }
        });
      },
    });
  }

  async function handleResourceConfig() {
    const { projectBase } = await dataLoader.loadCoreDataForConfig();
    const resources = projectBase?.RSRC?.rows || [];
    const savedResource = await storage.getData(
      storage.APP_KEYS.MAIN_RESOURCE_KEY
    );

    const bodyHtml = renderResourceConfigBody(resources, savedResource);

    const saveHandler = async (modalInstance) => {
      const select = document.getElementById("modal-resource-select");
      if (select && select.value) {
        await storage.saveData(
          storage.APP_KEYS.MAIN_RESOURCE_KEY,
          select.value
        );
        utils.showToast("Recurso salvo!", "success");
        setTimeout(() => modalInstance.close(), 1500);
      } else {
        utils.showToast("Nenhum recurso selecionado.", "error");
        throw new Error("Nenhum recurso selecionado."); // Prevent modal from closing on error
      }
    };

    modal.open({
      title: "Recurso Principal de Avanço",
      subtitle:
        "Selecione o recurso que representa o avanço físico do projeto.",
      bodyHtml,
      saveHandler,
    });
  }

  async function handleGroupingConfig() {
    const { projectBase } = await dataLoader.loadCoreDataForConfig();
    const wbsHierarchy = projectBase?.WBS_HIERARCHY?.rows || [];
    let bodyHtml;

    if (wbsHierarchy.length === 0) {
      bodyHtml =
        "<p>Nenhuma hierarquia WBS encontrada. Carregue um arquivo .xer primeiro.</p>";
    } else {
      const validLevels = wbsHierarchy
        .map((w) => parseInt(w.level, 10))
        .filter((level) => !isNaN(level) && level > 0);

      const maxLevel = validLevels.length > 0 ? Math.max(...validLevels) : 0;

      const savedLevelsData = await storage.getData(
        storage.APP_KEYS.WEEKS_VIEW_GROUPING_KEY
      );
      const savedLevels = (
        Array.isArray(savedLevelsData) ? savedLevelsData : []
      )
        .map((l) => parseInt(l, 10))
        .filter((l) => !isNaN(l));

      bodyHtml = renderGroupingConfigBody(maxLevel, savedLevels);
    }

    const saveHandler = async (modalInstance) => {
      const selectedLevels = [];
      document
        .querySelectorAll('input[type="checkbox"]:checked')
        .forEach((cb) => {
          if (cb && cb.value) {
            const level = parseInt(cb.value, 10);
            if (!isNaN(level)) {
              selectedLevels.push(level);
            }
          }
        });

      await storage.saveData(
        storage.APP_KEYS.WEEKS_VIEW_GROUPING_KEY,
        selectedLevels.sort((a, b) => a - b)
      );
      utils.showToast("Agrupamento salvo com sucesso!", "success");
      setTimeout(() => modalInstance.close(), 1500);
    };

    modal.open({
      title: "Agrupamento da Visão Semanal",
      subtitle:
        'Selecione os níveis da WBS para agrupar as atividades na página "Próximas Semanas".',
      bodyHtml,
      saveHandler,
    });
  }

  async function handleHiddenActivitiesConfig() {
    const saveHandler = async (modalInstance) => {
      const tomSelect = activeTomSelects[0];
      if (tomSelect) {
        await storage.saveData(
          storage.APP_KEYS.WEEKS_VIEW_HIDDEN_ACTIVITIES_KEY,
          tomSelect.getValue()
        );
        utils.showToast("Lista salva!", "success");
        setTimeout(() => modalInstance.close(), 1500);
      }
    };

    modal.open({
      title: "Ocultar Atividades",
      subtitle:
        "Atividades selecionadas não aparecerão no dashboard de próximas semanas.",
      bodyHtml: renderHiddenActivitiesBody(),
      saveHandler,
      customClass: "modal-large",
      onOpen: async () => {
        const selectEl = document.getElementById("hidden-activities-select");
        const { projectBase } = await dataLoader.loadCoreDataForConfig();
        const allTasks = projectBase?.TASK?.rows || [];
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
          activeTomSelects = [tomSelect];
        }
      },
      onClose: () => {
        activeTomSelects.forEach((ts) => ts.destroy());
        activeTomSelects = [];
      },
    });
  }

  async function handleActivityMappingConfig() {
    modal.open({
      title: "Mapeamento de Atividades",
      customClass: "modal-large",
      headerAction: {
        id: "add-new-group-btn",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`,
        tooltip: "Adicionar Novo Grupo",
      },
      saveHandler: saveGroup,
      onOpen: () => {
        renderActivityMappingTable();
        document.getElementById("add-new-group-btn").onclick = () =>
          renderGroupEditForm();
      },
    });
  }

  async function handleRestrictionsConfig() {
    modal.open({
      title: "Gerenciar Restrições",
      customClass: "modal-large",
      headerAction: {
        id: "add-new-restriction-btn",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`,
        tooltip: "Adicionar Nova Restrição",
      },
      saveHandler: saveRestriction,
      onOpen: () => {
        renderRestrictionsTable();
        document.getElementById("add-new-restriction-btn").onclick = () =>
          renderRestrictionEditForm();
      },
    });
  }

  async function handleCustomValuesConfig() {
    modal.open({
      title: "Valores Personalizados",
      customClass: "modal-large",
      headerAction: {
        id: "add-custom-value-btn",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`,
        tooltip: "Adicionar Novo Valor",
      },
      bodyHtml: renderCustomValuesBody(),
      saveHandler: saveCustomValue,
      onOpen: async () => {
        renderCustomValuesTable();

        const filterSelectEl = document.getElementById(
          "custom-values-filter-select"
        );
        const skeletonEl = document.getElementById(
          "custom-values-filter-skeleton"
        );
        const wrapperEl = document.getElementById(
          "custom-values-filter-wrapper"
        );

        if (filterSelectEl && skeletonEl && wrapperEl) {
          const allItems = await dataLoader.getSelectableItems();
          const tomSelect = new TomSelect(filterSelectEl, {
            options: allItems,
            plugins: ["remove_button"],
          });
          activeTomSelects = [tomSelect];
          skeletonEl.classList.add("hidden");
          wrapperEl.classList.remove("hidden");
        }

        document
          .getElementById("download-template-btn")
          ?.addEventListener("click", handleDownloadTemplate);
        document
          .getElementById("import-spreadsheet-input")
          ?.addEventListener("change", handleImportSpreadsheet);
      },
      onClose: () => {
        activeTomSelects.forEach((ts) => ts.destroy());
        activeTomSelects = [];
      },
    });
  }

  async function handleBackupConfig() {
    modal.open({
      title: "Importar & Exportar",
      subtitle:
        "Salve ou restaure um backup de todos os dados e configurações do sistema.",
      bodyHtml: renderBackupBody(),
      showFooter: false,
      onOpen: () => {
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
        const importDropArea = document.getElementById("import-drop-area");
        const confirmationArea = document.getElementById(
          "import-confirmation-area"
        );
        const confirmFileName = document.getElementById(
          "import-confirm-file-name"
        );
        const processBtn = document.getElementById("import-process-btn");
        const cancelBtn = document.getElementById("import-cancel-btn");

        const processImportFile = (file) => {
          if (!file) return;

          confirmationArea.classList.add("hidden");
          const modalBody = document.getElementById("modal-body");
          modalBody.innerHTML +=
            '<div class="message-box info mt-4">Importando arquivo...</div>';

          const reader = new FileReader();
          reader.onload = async function (e) {
            const feedbackEl = document.getElementById("import-feedback");
            try {
              if (feedbackEl)
                feedbackEl.textContent = `Processando arquivo ${file.name}...`;
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
              importDropArea.classList.remove("hidden"); // Show drop area again on error
            }
          };
          reader.readAsText(file);
        };

        const showConfirmation = (file) => {
          fileToImport = file;
          confirmFileName.textContent = file.name;
          importDropArea.classList.add("hidden");
          confirmationArea.classList.remove("hidden");
        };

        const hideConfirmation = () => {
          fileToImport = null;
          importInput.value = "";
          importDropArea.classList.remove("hidden");
          confirmationArea.classList.add("hidden");
        };

        processBtn.onclick = () => {
          if (
            fileToImport &&
            confirm(
              "Tem certeza que deseja importar este arquivo? Todos os dados atuais (projetos, configurações, etc.) serão substituídos. Esta ação não pode ser desfeita."
            )
          ) {
            processImportFile(fileToImport);
          }
        };
        cancelBtn.onclick = hideConfirmation;

        const handleFileSelection = (selectedFile, source) => {
          if (
            selectedFile &&
            selectedFile.name.toLowerCase().endsWith(".json")
          ) {
            if (source === "click") {
              showConfirmation(selectedFile);
            } else {
              processImportFile(selectedFile);
            }
          } else if (selectedFile) {
            utils.showToast(
              "Tipo de arquivo inválido. Apenas arquivos .json são permitidos.",
              "error"
            );
          }
        };

        importDropArea.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            importInput.click();
          }
        });
        importInput.onchange = () =>
          handleFileSelection(
            importInput.files.length > 0 ? importInput.files[0] : null,
            "click"
          );

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
        ["dragenter", "dragover"].forEach((eventName) =>
          importDropArea.addEventListener(
            eventName,
            () => importDropArea.classList.add("highlight"),
            false
          )
        );
        ["dragleave", "drop"].forEach((eventName) =>
          importDropArea.addEventListener(
            eventName,
            () => importDropArea.classList.remove("highlight"),
            false
          )
        );
        importDropArea.addEventListener(
          "drop",
          (e) => {
            if (e.dataTransfer.files.length > 0) {
              handleFileSelection(e.dataTransfer.files[0], "drag");
            }
          },
          false
        );
      },
      onClose: () => {
        fileToImport = null;
      },
    });
  }

  async function handleActivityDetailsConfig() {
    modal.open({
      title: "Gerenciar Detalhamento",
      subtitle: "Adicione, edite ou remova planos de execução detalhados.",
      customClass: "modal-large",
      showFooter: false,
      headerAction: {
        id: "add-new-plan-btn",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`,
        tooltip: "Adicionar Novo Plano",
      },
      onOpen: () => {
        renderActivityDetailsTable();
        const addBtn = document.getElementById("add-new-plan-btn");
        if (addBtn) {
          addBtn.onclick = () => renderPlanEditForm();
        }
      },
    });
  }

  // --- Table and Form Rendering Functions ---

  async function renderActivityMappingTable() {
    let savedMapping = await storage.getData(
      storage.APP_KEYS.ACTIVITY_MAPPING_KEY
    );
    modal.setSaveHandler(saveGroup);
    modal.setSubtitle(
      "Gerencie grupos de atividades que representam o mesmo trabalho."
    );
    if (document.getElementById("add-new-group-btn")) {
      document.getElementById("add-new-group-btn").onclick = () =>
        renderGroupEditForm();
    }

    savedMapping.sort((a, b) => a.groupName.localeCompare(b.groupName));
    let tableHtml = `<div class="table-container"><table><thead><tr><th>Nome do Grupo</th><th>Nº de Atividades</th><th class="text-right">Ações</th></tr></thead><tbody>`;
    if (savedMapping.length > 0) {
      savedMapping.forEach((group) => {
        tableHtml += `<tr><td class="font-semibold">${group.groupName}</td><td>${group.taskCodes.length}</td><td class="text-right"><div class="flex items-center justify-end gap-2"><button class="edit-group-btn text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100" data-group-id="${group.groupId}" title="Editar Grupo" aria-label="Editar grupo ${group.groupName}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.5 6.036z" /></svg></button><button class="delete-group-btn text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100" data-group-id="${group.groupId}" title="Excluir Grupo" aria-label="Excluir grupo ${group.groupName}"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></td></tr>`;
      });
    } else {
      tableHtml += `<tr><td colspan="3" class="text-center text-tertiary py-6">Nenhum grupo de atividades criado.</td></tr>`;
    }
    tableHtml += `</tbody></table></div>`;
    modal.setBody(tableHtml);
    modal.showSaveButton(false);
  }

  async function renderGroupEditForm(groupId = null) {
    const savedMapping = await storage.getData(
      storage.APP_KEYS.ACTIVITY_MAPPING_KEY
    );
    const group = groupId
      ? savedMapping.find((g) => g.groupId === groupId)
      : { groupName: "", taskCodes: [], groupId: null };
    currentEditingId = groupId;

    modal.setSubtitle(
      groupId
        ? `Editando o grupo "${group.groupName}"`
        : "Criando um novo grupo de atividades."
    );
    modal.showSaveButton(true);
    modal.hideHeaderAction();
    modal.setBody(
      `<div class="space-y-4"><div><label for="group-name-input" class="font-bold text-primary">Nome do Grupo:</label><input type="text" id="group-name-input" value="${group.groupName}" class="form-input mt-1" placeholder="Ex: Escavação Total C2+C3"></div><div><label for="activity-group-select" class="font-semibold text-primary mt-2 block">Atividades do Grupo:</label><select id="activity-group-select" multiple></select></div></div>`
    );

    const { projectBase } = await dataLoader.loadCoreDataForConfig();
    const usedTaskCodes = new Set();
    savedMapping.forEach((g) => {
      if (g.groupId !== groupId) {
        g.taskCodes.forEach((code) => usedTaskCodes.add(code));
      }
    });
    const allTasks = projectBase?.TASK?.rows || [];
    const availableTasks = allTasks.filter(
      (task) => !usedTaskCodes.has(task.task_code)
    );
    const options = availableTasks
      .map((task) => ({
        value: task.task_code,
        text: `${task.task_code} - ${task.task_name}`,
      }))
      .sort((a, b) => a.text.localeCompare(b.text));
    const selectEl = document.getElementById("activity-group-select");
    const tomSelect = new TomSelect(selectEl, {
      options,
      plugins: ["remove_button"],
      placeholder: "Selecione 2 ou mais atividades...",
    });
    tomSelect.setValue(group.taskCodes);
    activeTomSelects = [tomSelect];
  }

  async function renderCustomValuesTable() {
    let savedValues = await storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY);
    modal.setSaveHandler(null);
    modal.showSaveButton(false);
    modal.setSubtitle("Gerencie valores que sobrepõem os dados do cronograma.");
    document
      .getElementById("add-custom-value-btn")
      ?.addEventListener("click", () => renderCustomValueEditForm());

    const { projectBase, activityMapping } =
      await dataLoader.loadCoreDataForConfig();

    const allItems = [
      ...(projectBase?.TASK?.rows || []).map((t) => ({
        id: t.task_code,
        name: `${t.task_code} - ${t.task_name}`,
      })),
      ...activityMapping.map((g) => ({
        id: `group::${g.groupId}`,
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

    const container = document.getElementById("custom-values-table-wrapper");
    if (container) {
      container.innerHTML = tableHtml;
    } else {
      modal.setBody(tableHtml); // Fallback
    }
  }

  async function renderCustomValueEditForm(id = null) {
    const savedValues = await storage.getData(
      storage.APP_KEYS.CUSTOM_VALUES_KEY
    );
    const value = id
      ? savedValues.find((v) => v.id === id)
      : { id: null, planned: "", actual: "" };
    currentEditingId = id;
    modal.showSaveButton(true);
    modal.hideHeaderAction();
    modal.setSubtitle(
      id
        ? `Editando valor para "${value.name || id}"`
        : "Criando um novo valor personalizado."
    );
    modal.setBody(
      `<div class="space-y-4"><div><label for="custom-value-select" class="font-bold text-primary">Atividade ou Grupo</label><select id="custom-value-select" class="mt-1"></select></div><div class="grid grid-cols-2 gap-4"><div><label for="custom-planned-input" class="font-bold text-primary">Previsto Personalizado</label><input type="number" step="any" id="custom-planned-input" class="form-input mt-1" value="${
        value.planned ?? ""
      }" placeholder="Ex: 1500.50"></div><div><label for="custom-actual-input" class="font-bold text-primary">Realizado Personalizado</label><input type="number" step="any" id="custom-actual-input" class="form-input mt-1" value="${
        value.actual ?? ""
      }" placeholder="Ex: 750.25"></div></div></div>`
    );

    const allOptions = await dataLoader.getSelectableItems();

    const usedValueIds = new Set(savedValues.map((v) => v.id));
    if (id) {
      usedValueIds.delete(id);
    }

    const availableOptions = allOptions.filter(
      (opt) => !usedValueIds.has(opt.value)
    );

    const tomSelect = new TomSelect("#custom-value-select", {
      options: availableOptions,
      placeholder: "Selecione...",
    });
    tomSelect.setValue(value.id);
    if (id) {
      tomSelect.disable();
    }
    activeTomSelects = [tomSelect];
  }

  async function renderActivityDetailsTable() {
    const [activityDetails, { projectBase, activityMapping }] =
      await Promise.all([
        storage.getActivityDetails(),
        dataLoader.loadCoreDataForConfig(),
      ]);

    modal.showSaveButton(false);
    document.getElementById("modal-cancel-btn").textContent = "Fechar";

    const addBtn = document.getElementById("add-new-plan-btn");
    if (addBtn) {
      addBtn.style.display = "block";
    }

    if (activityDetails.length === 0) {
      modal.setBody(
        '<div class="message-box info">Nenhum plano de execução detalhado foi criado. Clique no botão + para adicionar um.</div>'
      );
      return;
    }

    const allItemsMap = new Map();
    (projectBase?.TASK?.rows || []).forEach((t) =>
      allItemsMap.set(t.task_code, `${t.task_code} - ${t.task_name}`)
    );
    activityMapping.forEach((g) =>
      allItemsMap.set(`group::${g.groupId}`, `[Grupo] ${g.groupName}`)
    );

    const groupedDetails = activityDetails.reduce((acc, detail) => {
      if (!acc[detail.parentId]) {
        acc[detail.parentId] = [];
      }
      acc[detail.parentId].push(detail);
      return acc;
    }, {});

    const sortedParentIds = Object.keys(groupedDetails).sort((a, b) => {
      const nameA = allItemsMap.get(a) || a;
      const nameB = allItemsMap.get(b) || b;
      return nameA.localeCompare(nameB);
    });

    let tableHtml = `<div class="table-container"><table><thead><tr><th>Atividade / Grupo</th><th class="text-center">Nº de Etapas</th><th class="text-right">Ações</th></tr></thead><tbody>`;

    sortedParentIds.forEach((parentId) => {
      const steps = groupedDetails[parentId];
      const itemName = allItemsMap.get(parentId) || parentId;
      tableHtml += `<tr>
        <td class="font-semibold text-primary">${itemName}</td>
        <td class="text-center">${steps.length}</td>
        <td class="text-right"><div class="flex items-center justify-end gap-2">
          <button class="edit-plan-btn text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-100" data-parent-id="${parentId}" title="Editar Plano" aria-label="Editar plano de ${itemName}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.5 6.036z" /></svg>
          </button>
          <button class="delete-plan-btn text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100" data-parent-id="${parentId}" title="Excluir Plano" aria-label="Excluir plano de ${itemName}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div></td>
      </tr>`;
    });

    tableHtml += `</tbody></table></div>`;
    modal.setBody(tableHtml);
  }

  /**
   * Consolidates data from member tasks into the parent group.
   * @param {Object} group The group object being saved.
   */
  async function consolidateGroupData(group) {
    const { groupId, taskCodes } = group;
    const groupItemId = `group::${groupId}`;

    const [allCustomValues, allRestrictionLinks, allActivityMedia] =
      await Promise.all([
        storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY),
        storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
        storage.getActivityMedia(),
      ]);

    const taskCodesSet = new Set(taskCodes);

    let aggregatedPlanned = 0;
    let aggregatedActual = 0;
    const aggregatedRestrictionIds = new Set();
    let photoToInherit = null;

    for (const taskCode of taskCodes) {
      const customValue = allCustomValues.find((v) => v.id === taskCode);
      if (customValue) {
        aggregatedPlanned += customValue.planned || 0;
        aggregatedActual += customValue.actual || 0;
      }

      allRestrictionLinks.forEach((link) => {
        if (link.itemId === taskCode) {
          aggregatedRestrictionIds.add(link.restrictionId);
        }
      });

      if (!photoToInherit) {
        const media = allActivityMedia.find((m) => m.id === taskCode);
        if (media) {
          photoToInherit = media;
        }
      }
    }

    let updatedCustomValues = allCustomValues.filter(
      (v) => !taskCodesSet.has(v.id)
    );
    const groupValueIndex = updatedCustomValues.findIndex(
      (v) => v.id === groupItemId
    );
    if (aggregatedPlanned > 0 || aggregatedActual > 0) {
      const newGroupValue = {
        id: groupItemId,
        planned: aggregatedPlanned,
        actual: aggregatedActual,
      };
      if (groupValueIndex > -1) {
        updatedCustomValues[groupValueIndex] = newGroupValue;
      } else {
        updatedCustomValues.push(newGroupValue);
      }
    } else if (groupValueIndex > -1) {
      updatedCustomValues.splice(groupValueIndex, 1);
    }

    let updatedRestrictionLinks = allRestrictionLinks.filter(
      (l) => !taskCodesSet.has(l.itemId)
    );
    updatedRestrictionLinks = updatedRestrictionLinks.filter(
      (l) => l.itemId !== groupItemId
    );
    aggregatedRestrictionIds.forEach((restrId) => {
      updatedRestrictionLinks.push({
        restrictionId: restrId,
        itemId: groupItemId,
      });
    });

    const mediaPromises = [];
    if (photoToInherit) {
      const { id, ...data } = photoToInherit;
      mediaPromises.push(storage.saveActivityMedia(groupItemId, data));
    } else {
      const existingGroupMedia = allActivityMedia.find(
        (m) => m.id === groupItemId
      );
      if (existingGroupMedia) {
        mediaPromises.push(storage.deleteActivityMedia(groupItemId));
        if (existingGroupMedia.storagePath) {
          mediaPromises.push(
            deleteObject(ref(firebaseStorage, existingGroupMedia.storagePath))
          );
        }
      }
    }

    for (const taskCode of taskCodes) {
      const media = allActivityMedia.find((m) => m.id === taskCode);
      if (media) {
        mediaPromises.push(storage.deleteActivityMedia(taskCode));
        if (media.storagePath) {
          mediaPromises.push(
            deleteObject(ref(firebaseStorage, media.storagePath))
          );
        }
      }
    }

    await Promise.all([
      storage.saveData(storage.APP_KEYS.CUSTOM_VALUES_KEY, updatedCustomValues),
      storage.saveData(
        storage.APP_KEYS.RESTRICTION_LINKS_KEY,
        updatedRestrictionLinks
      ),
      ...mediaPromises,
    ]);
  }

  async function saveGroup(modalInstance) {
    const groupName = document.getElementById("group-name-input").value;
    const tomSelect = activeTomSelects[0];
    const taskCodes = tomSelect ? tomSelect.getValue() : [];
    if (!groupName.trim()) {
      utils.showToast("O nome do grupo não pode ser vazio.", "error");
      throw new Error("Nome do grupo vazio.");
    }
    if (taskCodes.length < 2) {
      utils.showToast("Um grupo deve ter pelo menos 2 atividades.", "error");
      throw new Error("Grupo precisa de pelo menos 2 atividades.");
    }
    let savedMapping = await storage.getData(
      storage.APP_KEYS.ACTIVITY_MAPPING_KEY
    );

    let groupToSave;
    if (currentEditingId !== null) {
      // Editing existing group
      const index = savedMapping.findIndex(
        (g) => g.groupId === currentEditingId
      );
      if (index > -1) {
        savedMapping[index].groupName = groupName;
        savedMapping[index].taskCodes = taskCodes;
        groupToSave = savedMapping[index];
      }
    } else {
      // Creating new group
      const newGroup = {
        groupName,
        taskCodes,
        groupId: utils.uuidv4(),
      };
      savedMapping.push(newGroup);
      groupToSave = newGroup;
    }
    await storage.saveData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY, savedMapping);

    // Consolidate data for the new/updated group
    if (groupToSave) {
      await consolidateGroupData(groupToSave);
    }

    utils.showToast("Grupo salvo e dados consolidados!", "success");
    setTimeout(() => modalInstance.close(), 1500);
  }

  async function deleteGroup(groupId) {
    const mapping = await storage.getData(
      storage.APP_KEYS.ACTIVITY_MAPPING_KEY
    );
    const group = mapping.find((g) => g.groupId === groupId);
    if (!group) return;

    if (
      confirm(
        `Tem certeza que deseja excluir o grupo "${group.groupName}"? Isso removerá o grupo e todos os seus vínculos (restrições, fotos, valores, plano de execução).`
      )
    ) {
      try {
        const fullGroupId = `group::${groupId}`;

        // Fetch all linked data
        let [restrictionLinks, customValues] = await Promise.all([
          storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
          storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY),
        ]);

        // Filter out the group and its related data
        const newMapping = mapping.filter((g) => g.groupId !== groupId);
        const newLinks = restrictionLinks.filter(
          (l) => l.itemId !== fullGroupId
        );
        const newValues = customValues.filter((v) => v.id !== fullGroupId);

        // Handle media deletion from storage
        const mediaToDelete = await storage
          .getActivityMedia()
          .then((media) => media.find((m) => m.id === fullGroupId));
        const mediaDocDeletionPromise = mediaToDelete
          ? storage.deleteActivityMedia(fullGroupId)
          : Promise.resolve();
        const firebaseStorageDeletionPromise = mediaToDelete?.storagePath
          ? deleteObject(ref(firebaseStorage, mediaToDelete.storagePath)).catch(
              (err) => console.warn("Could not delete from Storage:", err)
            )
          : Promise.resolve();

        // Handle execution plan deletion
        const detailsDeletionPromise =
          storage.deleteActivityDetails(fullGroupId);

        // Save everything back
        await Promise.all([
          storage.saveData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY, newMapping),
          storage.saveData(storage.APP_KEYS.RESTRICTION_LINKS_KEY, newLinks),
          storage.saveData(storage.APP_KEYS.CUSTOM_VALUES_KEY, newValues),
          mediaDocDeletionPromise,
          firebaseStorageDeletionPromise,
          detailsDeletionPromise,
        ]);

        utils.showToast("Grupo excluído com sucesso.", "success");
        await renderActivityMappingTable();
      } catch (error) {
        utils.showToast(`Erro ao excluir: ${error.message}`, "error");
      }
    }
  }

  async function saveCustomValue(modalInstance) {
    const tomSelect = document.getElementById("custom-value-select").tomselect;
    const selectedId = tomSelect ? tomSelect.getValue() : null;
    const plannedVal = document.getElementById("custom-planned-input").value;
    const actualVal = document.getElementById("custom-actual-input").value;

    if (!selectedId) {
      utils.showToast("Selecione uma atividade ou grupo.", "error");
      throw new Error("Nenhum item selecionado.");
    }
    if (plannedVal.trim() === "" && actualVal.trim() === "") {
      utils.showToast(
        "Preencha pelo menos um dos valores (previsto ou realizado).",
        "error"
      );
      throw new Error("Valores vazios.");
    }

    let savedValues = await storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY);
    const newValue = {
      id: selectedId,
      planned: plannedVal.trim() !== "" ? parseFloat(plannedVal) : null,
      actual: actualVal.trim() !== "" ? parseFloat(actualVal) : null,
    };

    const indexToUpdate = savedValues.findIndex((v) => v.id === selectedId); // Use selectedId, not currentEditingId

    if (indexToUpdate > -1) {
      savedValues[indexToUpdate] = newValue;
    } else {
      savedValues.push(newValue);
    }
    await storage.saveData(storage.APP_KEYS.CUSTOM_VALUES_KEY, savedValues);
    utils.showToast("Valor personalizado salvo!", "success");
    setTimeout(() => modalInstance.close(), 1500);
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

  async function deletePlan(parentId) {
    if (
      confirm(
        "Tem certeza que deseja excluir este plano de execução? Esta ação não pode ser desfeita."
      )
    ) {
      try {
        await storage.deleteActivityDetails(parentId);
        utils.showToast("Plano de execução excluído.", "success");
        await renderActivityDetailsTable(); // Re-render the table in the modal
      } catch (error) {
        utils.showToast(`Erro ao excluir plano: ${error.message}`, "error");
      }
    }
  }

  async function handleDownloadTemplate() {
    const btn = document.getElementById("download-template-btn");
    if (!btn) return;
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Gerando...";

    try {
      const [savedValues] = await Promise.all([
        storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY),
      ]);

      const filterSelect = document.getElementById(
        "custom-values-filter-select"
      )?.tomselect;
      const selectedIds = filterSelect ? filterSelect.getValue() : [];
      const customValuesMap = new Map(savedValues.map((v) => [v.id, v]));
      const allSelectableItems = await dataLoader.getSelectableItems();

      // Determine the initial set of items to consider, based on the filter
      let itemsToConsider;
      if (selectedIds.length > 0) {
        const selectedIdsSet = new Set(selectedIds);
        itemsToConsider = allSelectableItems.filter((item) =>
          selectedIdsSet.has(item.value)
        );
      } else {
        itemsToConsider = allSelectableItems;
      }

      if (itemsToConsider.length === 0) {
        utils.showToast(
          "Nenhum item para exportar com os filtros atuais.",
          "info"
        );
        return;
      }

      const dataForSheet = itemsToConsider.map((item) => {
        const values = customValuesMap.get(item.value);

        let cleanName = item.text; // Default to existing text
        if (item.value.startsWith("group::")) {
          cleanName = item.text.replace("[Grupo] ", "");
        } else {
          cleanName = item.text.substring(item.text.indexOf("-") + 2);
        }

        return {
          ID: item.value,
          Nome: cleanName,
          Previsto: values?.planned ?? "",
          Realizado: values?.actual ?? "",
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataForSheet);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Valores Personalizados"
      );

      worksheet["!cols"] = [{ wch: 38 }, { wch: 60 }, { wch: 15 }, { wch: 15 }];

      XLSX.writeFile(workbook, "ChronoFlow_Valores_Personalizados.xlsx");
      utils.showToast("Download do modelo iniciado!", "success");
    } catch (error) {
      console.error("Erro ao gerar template:", error);
      utils.showToast(`Erro ao gerar modelo: ${error.message}`, "error");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
  }

  async function handleImportSpreadsheet(event) {
    const file = event.target.files[0];
    if (!file) return;

    const label = event.target.closest("label");
    const originalContent = label ? label.innerHTML : "Importar Planilha";
    if (label) label.innerHTML = "Processando...";

    utils.showToast("Processando planilha...", "info");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const importedData = XLSX.utils.sheet_to_json(worksheet);

        if (
          importedData.length === 0 ||
          !importedData[0].hasOwnProperty("ID") ||
          !importedData[0].hasOwnProperty("Previsto") ||
          !importedData[0].hasOwnProperty("Realizado")
        ) {
          throw new Error(
            'Planilha inválida. Verifique se as colunas "ID", "Previsto" e "Realizado" existem.'
          );
        }

        const currentValues = await storage.getData(
          storage.APP_KEYS.CUSTOM_VALUES_KEY
        );
        const valuesMap = new Map(currentValues.map((v) => [v.id, v]));

        let updatedCount = 0;
        let newCount = 0;

        importedData.forEach((row) => {
          const id = row["ID"];
          if (!id) return;

          const planned =
            row["Previsto"] !== undefined &&
            row["Previsto"] !== null &&
            row["Previsto"] !== ""
              ? parseFloat(row["Previsto"])
              : null;
          const actual =
            row["Realizado"] !== undefined &&
            row["Realizado"] !== null &&
            row["Realizado"] !== ""
              ? parseFloat(row["Realizado"])
              : null;

          if (planned === null && actual === null) {
            if (valuesMap.has(id)) {
              valuesMap.delete(id);
            }
            return;
          }

          if (valuesMap.has(id)) {
            updatedCount++;
          } else {
            newCount++;
          }

          valuesMap.set(id, { id, planned, actual });
        });

        const newValues = Array.from(valuesMap.values());
        await storage.saveData(storage.APP_KEYS.CUSTOM_VALUES_KEY, newValues);

        utils.showToast(
          `${updatedCount} valore(s) atualizado(s) e ${newCount} novo(s) inserido(s).`,
          "success"
        );
        await renderCustomValuesTable();
      } catch (error) {
        console.error("Erro ao importar planilha:", error);
        utils.showToast(`Erro na importação: ${error.message}`, "error");
      } finally {
        event.target.value = "";
        if (label) label.innerHTML = originalContent;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function processAndSaveWeeksFile(file) {
    const feedbackEl = document.getElementById("weeks-feedback");
    const dropAreaEl = document.getElementById("weeks-drop-area");
    const confirmationAreaEl = document.getElementById(
      "weeks-confirmation-area"
    );

    if (!file) {
      utils.showToast("Nenhum arquivo para processar.", "error");
      return;
    }

    if (dropAreaEl) dropAreaEl.classList.add("hidden");
    if (confirmationAreaEl) confirmationAreaEl.classList.add("hidden");

    const modalBody = document.getElementById("modal-body");
    modalBody.innerHTML +=
      '<div class="message-box info mt-4">Processando arquivo...</div>';

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      utils.showToast(
        "Tipo de arquivo inválido. Use um arquivo .xlsx",
        "error"
      );
      if (feedbackEl)
        feedbackEl.textContent =
          "Erro: Tipo de arquivo inválido. Use um arquivo .xlsx";
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
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
        setTimeout(() => modal.close(), 1500);
      } catch (err) {
        console.error(err);
        utils.showToast(`Erro ao processar o arquivo: ${err.message}`, "error");
        if (dropAreaEl) dropAreaEl.classList.remove("hidden"); // Show drop area again on error
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // --- Restriction Management Functions ---

  async function renderRestrictionsTable() {
    let [restrictionsList, restrictionLinks] = await Promise.all([
      storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
      storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
    ]);
    modal.setSaveHandler(null);
    modal.showSaveButton(false);
    modal.setSubtitle(
      "Gerencie todas as restrições do projeto e seus vínculos."
    );
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

    let tableHtml = `<div class="table-container"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Status</th><th>Nº de Vínculos</th><th class="text-right">Ações</th></tr></thead><tbody>`;
    if (restrictionsList.length > 0) {
      restrictionsList.forEach((restr) => {
        const linkCount = linksByRestrictionId[restr.id]?.length || 0;
        const statusText =
          restr.status === "pending" ? "Pendente" : "Resolvido";
        tableHtml += `
                        <tr>
                            <td class="font-semibold">${restr.desc}</td>
                            <td>${
                              restr.category
                                ? `<span class="restriction-category-badge">${restr.category}</span>`
                                : '<span class="text-quaternary">N/A</span>'
                            }</td>
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
      tableHtml += `<tr><td colspan="5" class="text-center text-tertiary py-6">Nenhuma restrição criada.</td></tr>`;
    }
    tableHtml += `</tbody></table></div>`;
    modal.setBody(tableHtml);
  }

  async function renderRestrictionEditForm(restrictionId = null) {
    const [restrictionsList, restrictionLinks] = await Promise.all([
      storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
      storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
    ]);

    const restriction = restrictionId
      ? restrictionsList.find((r) => r.id === restrictionId)
      : {
          id: null,
          desc: "",
          resp: "",
          due: "",
          status: "pending",
          category: null,
        };
    currentEditingId = restrictionId;

    const linkedItemIds = restrictionId
      ? restrictionLinks
          .filter((l) => l.restrictionId === restrictionId)
          .map((l) => l.itemId)
      : [];

    modal.setSubtitle(
      restrictionId ? `Editando restrição` : "Criando uma nova restrição."
    );
    modal.showSaveButton(true);
    modal.hideHeaderAction();

    const mCategories = [
      "Método",
      "Máquina",
      "Mão de Obra",
      "Material",
      "Medição",
      "Meio Ambiente",
    ];

    modal.setBody(`
                <div class="space-y-4">
                    <div>
                      <label for="restriction-desc-input" class="font-bold text-primary">Descrição da Restrição</label>
                      <input type="text" id="restriction-desc-input" value="${
                        restriction.desc
                      }" class="form-input mt-1" placeholder="Ex: Atraso na entrega de material">
                    </div>
                    <div class="grid grid-cols-1 gap-4">
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
                          <label class="form-label font-bold text-primary">Causa Raiz (6M)</label>
                          <div id="m-category-selector" class="flex flex-wrap gap-2 mt-1">
                             ${mCategories
                               .map(
                                 (cat) =>
                                   `<button type="button" class="m-category-btn ${
                                     restriction.category === cat
                                       ? "active"
                                       : ""
                                   }" data-category="${cat}">${cat}</button>`
                               )
                               .join("")}
                          </div>
                          <input type="hidden" id="restr-category" name="restr-category" value="${
                            restriction.category || ""
                          }">
                      </div>
                    <div>
                        <label for="restriction-links-select" class="font-semibold text-primary mt-2 block">Vincular a Atividades/Grupos:</label>
                        <select id="restriction-links-select" multiple></select>
                    </div>
                </div>`);

    const allOptions = await dataLoader.getSelectableItems();

    const tomSelect = new TomSelect("#restriction-links-select", {
      options: allOptions,
      plugins: ["remove_button"],
      placeholder: "Selecione os itens impactados...",
    });
    tomSelect.setValue(linkedItemIds);
    activeTomSelects = [tomSelect];

    document
      .getElementById("m-category-selector")
      ?.addEventListener("click", (e) => {
        const btn = e.target.closest(".m-category-btn");
        if (!btn) return;

        const categoryInput = document.getElementById("restr-category");
        const isAlreadyActive = btn.classList.contains("active");

        btn.parentElement
          .querySelectorAll(".active")
          .forEach((b) => b.classList.remove("active"));

        if (isAlreadyActive) {
          categoryInput.value = "";
        } else {
          btn.classList.add("active");
          categoryInput.value = btn.dataset.category;
        }
        modal.enableSaveButton();
      });
  }

  async function saveRestriction(modalInstance) {
    const desc = document.getElementById("restriction-desc-input").value.trim();
    if (!desc) {
      utils.showToast("A descrição da restrição não pode ser vazia.", "error");
      throw new Error("Descrição vazia.");
    }

    let [restrictionsList, restrictionLinks] = await Promise.all([
      storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
      storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
    ]);

    const restrictionData = {
      id: currentEditingId || utils.uuidv4(),
      desc: desc,
      resp: document.getElementById("restriction-resp-input").value,
      due: document.getElementById("restriction-due-input").value,
      status: document.getElementById("restriction-status-select").value,
      category: document.getElementById("restr-category").value || null,
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
    setTimeout(() => modalInstance.close(), 1500);
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

  async function renderPlanEditForm(parentId = null) {
    currentEditingId = parentId;

    const [allActivityDetails, allItems] = await Promise.all([
      storage.getActivityDetails(),
      dataLoader.getSelectableItems(),
    ]);

    const allItemsMap = new Map(
      allItems.map((item) => [item.value, item.text])
    );
    let currentSteps = [];
    let itemSelectorHtml = "";
    let availableItems = [];

    // Configure modal for form view
    modal.showSaveButton(true);
    document.getElementById("modal-cancel-btn").textContent = "Voltar à Lista";
    modal.setCancelHandler(handleActivityDetailsConfig);
    modal.hideHeaderAction();

    if (parentId) {
      // EDIT MODE
      modal.setSubtitle(
        `Editando plano para: ${allItemsMap.get(parentId) || parentId}`
      );
      currentSteps = allActivityDetails.filter((d) => d.parentId === parentId);
      // Sort steps by start date, then name
      currentSteps.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate) : 0;
        const dateB = b.startDate ? new Date(b.startDate) : 0;
        if (dateA !== dateB) return dateA - dateB;
        return a.name.localeCompare(b.name);
      });
      itemSelectorHtml = `<input type="hidden" id="plan-parent-id" value="${parentId}">`;
    } else {
      // CREATE MODE
      modal.setSubtitle("Criando um novo plano de execução");
      const itemsWithPlans = new Set(allActivityDetails.map((d) => d.parentId));
      availableItems = allItems.filter(
        (item) => !itemsWithPlans.has(item.value)
      );

      itemSelectorHtml = `
        <div>
          <label for="plan-item-select" class="font-bold text-primary">Atividade ou Grupo</label>
          <select id="plan-item-select" placeholder="Selecione um item..."></select>
        </div>
      `;
    }

    const renderStepRow = (step = { name: "", startDate: "", endDate: "" }) => `
      <div class="execution-step">
        <input type="text" class="form-input flex-grow" placeholder="Descrição da etapa" value="${
          step.name || ""
        }">
        <input type="date" class="form-input" value="${step.startDate || ""}">
        <input type="date" class="form-input" value="${step.endDate || ""}">
        <button type="button" class="remove-step-btn" title="Remover Etapa">&times;</button>
      </div>
    `;

    modal.setBody(`
      <div class="space-y-4">
        ${itemSelectorHtml}
        <div>
          <label class="font-bold text-primary">Etapas do Plano</label>
          <div id="steps-list" class="space-y-2 mt-1 border border-border-primary p-2 rounded-md bg-tertiary max-h-96 overflow-y-auto">
            ${
              currentSteps.length > 0
                ? currentSteps.map(renderStepRow).join("")
                : renderStepRow()
            }
          </div>
          <button id="add-step-btn" type="button" class="mt-2 px-3 py-1.5 bg-gray-200 text-primary rounded-md hover:bg-gray-300 text-sm font-semibold">Adicionar Etapa</button>
        </div>
      </div>
    `);

    if (!parentId) {
      const tomSelect = new TomSelect("#plan-item-select", {
        options: availableItems,
      });
      activeTomSelects = [tomSelect];
    }

    modal.setSaveHandler(savePlan);
  }

  async function savePlan(modalInstance) {
    let parentId;
    if (currentEditingId) {
      parentId = currentEditingId;
    } else {
      const tomSelect = document.getElementById("plan-item-select")?.tomselect;
      parentId = tomSelect ? tomSelect.getValue() : null;
    }

    if (!parentId) {
      utils.showToast("Selecione uma atividade ou grupo.", "error");
      throw new Error("Nenhum item selecionado.");
    }

    const stepsList = document.getElementById("steps-list");
    const stepElements = stepsList.querySelectorAll(".execution-step");
    const steps = Array.from(stepElements)
      .map((el) => {
        const inputs = el.querySelectorAll("input");
        return {
          name: inputs[0].value.trim(),
          startDate: inputs[1].value,
          endDate: inputs[2].value,
        };
      })
      .filter((step) => step.name);

    await storage.saveActivityDetails(parentId, steps);

    utils.showToast("Plano salvo com sucesso!", "success");
    currentEditingId = null; // Reset editing state
    await renderActivityDetailsTable(); // Go back to list view
  }

  // --- Milestone Management Functions ---

  async function handleMilestonesConfig() {
    modal.open({
      title: "Área de Trabalho de Marcos",
      subtitle: "Gerencie múltiplos marcos e seus vínculos de uma só vez.",
      bodyHtml: `
            <div id="milestone-workspace" class="milestone-workspace">
                <div id="milestones-list-panel" class="milestones-list-panel">
                    <div class="skeleton skeleton-block h-full"></div>
                </div>
                <div id="wbs-tree-panel" class="wbs-tree-panel">
                    <div class="skeleton skeleton-block h-full"></div>
                </div>
            </div>`,
      saveHandler: saveAllMilestones,
      customClass: "milestone-editor-modal",
      onOpen: () => {
        renderMilestoneWorkspace();
        // Event listeners for the dynamic content are added in renderMilestoneWorkspace
      },
    });
  }

  async function renderMilestoneWorkspace() {
    const listPanel = document.getElementById("milestones-list-panel");
    const treePanel = document.getElementById("wbs-tree-panel");

    if (!listPanel || !treePanel) return;

    listPanel.innerHTML = ""; // Clear skeleton
    treePanel.innerHTML = ""; // Clear skeleton

    const [milestonesList, milestoneLinks] = await Promise.all([
      storage.getData(storage.APP_KEYS.MILESTONES_LIST_KEY),
      storage.getData(storage.APP_KEYS.MILESTONE_LINKS_KEY),
    ]);

    // Create an in-memory representation for editing
    const linksByMilestoneId = new Map();
    milestoneLinks.forEach((link) => {
      if (!linksByMilestoneId.has(link.milestoneId)) {
        linksByMilestoneId.set(link.milestoneId, new Set());
      }
      linksByMilestoneId.get(link.milestoneId).add(link.itemId);
    });

    listPanel.dataset.links = JSON.stringify(
      Array.from(linksByMilestoneId.entries(), ([key, value]) => [
        key,
        Array.from(value),
      ])
    );

    const renderList = (milestones) => {
      const itemsHtml = milestones
        .map(
          (m) => `
            <div class="milestone-item" data-milestone-id="${m.id}">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <input type="text" class="form-input milestone-name-input" placeholder="Nome do Marco" value="${
                      m.name || ""
                    }">
                    <input type="date" class="form-input milestone-date-input" value="${
                      m.date || ""
                    }">
                </div>
                <div class="flex items-center justify-between">
                     <button type="button" class="link-milestone-btn px-3 py-1.5 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-sm font-semibold">Vincular Atividades</button>
                     <button type="button" class="delete-milestone-btn text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100" title="Excluir Marco">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
        `
        )
        .join("");

      listPanel.innerHTML = `
            <h3 class="text-lg font-bold text-primary mb-3">Marcos</h3>
            <div id="milestones-list-items" class="flex-grow space-y-3 overflow-y-auto pr-2">${itemsHtml}</div>
            <button id="add-milestone-btn" type="button" class="mt-3 w-full px-4 py-2 bg-gray-200 text-primary rounded-md hover:bg-gray-300 font-semibold">Adicionar Novo Marco</button>
        `;
    };

    renderList(milestonesList);

    treePanel.innerHTML = `<div class="milestone-tree-container-wrapper"><h3 class="text-lg font-bold text-primary mb-3">Vincular a: <span id="active-milestone-name" class="text-accent">Nenhum</span></h3><div id="milestone-tree-container" class="milestone-tree-container"><p class="text-tertiary text-center p-8">Selecione "Vincular Atividades" em um marco à esquerda.</p></div></div>`;
  }

  async function renderWbsSelectionTree(selectedIdsSet) {
    const treeContainer = document.getElementById("milestone-tree-container");
    if (!treeContainer) return;

    treeContainer.innerHTML = `<div class="skeleton skeleton-block h-48"></div>`;

    const { projectBase, activityMapping } =
      await dataLoader.loadCoreDataForConfig();
    const tasks = projectBase?.TASK?.rows || [];
    const wbsHierarchy = projectBase?.WBS_HIERARCHY?.rows || [];

    const groupedTaskCodes = new Set(
      activityMapping.flatMap((g) => g.taskCodes)
    );
    const ungroupedTasks = tasks.filter(
      (t) => !groupedTaskCodes.has(t.task_code)
    );

    // Build a tree structure from the flat list
    const wbsMap = new Map();
    wbsHierarchy.forEach((wbs) => {
      wbsMap.set(wbs.stable_wbs_id, { ...wbs, children: [], items: [] });
    });

    const tree = [];
    wbsHierarchy.forEach((wbs) => {
      if (wbs.parent_stable_wbs_id && wbsMap.has(wbs.parent_stable_wbs_id)) {
        wbsMap
          .get(wbs.parent_stable_wbs_id)
          .children.push(wbsMap.get(wbs.stable_wbs_id));
      } else {
        tree.push(wbsMap.get(wbs.stable_wbs_id));
      }
    });

    // Attach tasks and groups to the tree
    ungroupedTasks.forEach((task) => {
      if (wbsMap.has(task.wbs_stable_id_ref)) {
        wbsMap.get(task.wbs_stable_id_ref).items.push({
          type: "task",
          id: task.task_code,
          name: `${task.task_code} - ${task.task_name}`,
        });
      }
    });
    activityMapping.forEach((group) => {
      const firstTask = tasks.find((t) => t.task_code === group.taskCodes[0]);
      if (firstTask && wbsMap.has(firstTask.wbs_stable_id_ref)) {
        wbsMap.get(firstTask.wbs_stable_id_ref).items.push({
          type: "group",
          id: `group::${group.groupId}`,
          name: `[Grupo] ${group.groupName}`,
        });
      }
    });

    function buildTreeHtml(nodes, level) {
      let html = "";
      nodes.sort((a, b) => a.wbs_name.localeCompare(b.wbs_name));

      nodes.forEach((node) => {
        const hasChildren = node.children.length > 0 || node.items.length > 0;
        const isChecked = selectedIdsSet.has(node.stable_wbs_id);
        html += `
                  <div class="milestone-tree-node" data-item-id="${
                    node.stable_wbs_id
                  }">
                      <div class="milestone-tree-item-content" style="padding-left: ${
                        level * 1.5
                      }rem;">
                          ${
                            hasChildren
                              ? '<button type="button" class="milestone-tree-toggle" aria-expanded="false">+</button>'
                              : '<span class="w-6 inline-block"></span>'
                          }
                          <input type="checkbox" id="check-${node.stable_wbs_id.replace(
                            /\W/g,
                            "_"
                          )}" data-item-id="${node.stable_wbs_id}" ${
          isChecked ? "checked" : ""
        }>
                          <label for="check-${node.stable_wbs_id.replace(
                            /\W/g,
                            "_"
                          )}">${node.wbs_name}</label>
                      </div>
                      ${
                        hasChildren
                          ? `<div class="milestone-tree-children" hidden>`
                          : ""
                      }
              `;

        if (hasChildren) {
          html += buildTreeHtml(node.children, level + 1);
          node.items
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach((item) => {
              const isItemChecked = selectedIdsSet.has(item.id);
              html += `
                          <div class="milestone-tree-node" data-item-id="${
                            item.id
                          }">
                               <div class="milestone-tree-item-content" style="padding-left: ${
                                 (level + 1) * 1.5
                               }rem;">
                                  <span class="w-6 inline-block"></span>
                                  <input type="checkbox" id="check-${item.id.replace(
                                    /\W/g,
                                    "_"
                                  )}" data-item-id="${item.id}" ${
                isItemChecked ? "checked" : ""
              }>
                                  <label for="check-${item.id.replace(
                                    /\W/g,
                                    "_"
                                  )}">${item.name}</label>
                              </div>
                          </div>
                      `;
            });
        }
        html += `${hasChildren ? `</div>` : ""}</div>`;
      });
      return html;
    }

    treeContainer.innerHTML = buildTreeHtml(tree, 0);
    updateAllParentCheckboxes(); // Set initial indeterminate states
  }

  function updateParentCheckbox(childCheckbox) {
    const parentChildrenContainer = childCheckbox.closest(
      ".milestone-tree-node"
    ).parentElement;
    if (!parentChildrenContainer.classList.contains("milestone-tree-children"))
      return;

    const parentNode = parentChildrenContainer.closest(".milestone-tree-node");
    const parentCheckbox = parentNode.querySelector(
      ':scope > .milestone-tree-item-content > input[type="checkbox"]'
    );
    if (!parentCheckbox) return;

    const allChildCheckboxes = Array.from(
      parentChildrenContainer.querySelectorAll(
        ':scope > .milestone-tree-node > .milestone-tree-item-content > input[type="checkbox"]'
      )
    );
    const checkedCount = allChildCheckboxes.filter((cb) => cb.checked).length;
    const indeterminateCount = allChildCheckboxes.filter(
      (cb) => cb.indeterminate
    ).length;

    if (checkedCount === 0 && indeterminateCount === 0) {
      parentCheckbox.checked = false;
      parentCheckbox.indeterminate = false;
    } else if (
      checkedCount === allChildCheckboxes.length &&
      indeterminateCount === 0
    ) {
      parentCheckbox.checked = true;
      parentCheckbox.indeterminate = false;
    } else {
      parentCheckbox.checked = false;
      parentCheckbox.indeterminate = true;
    }

    updateParentCheckbox(parentCheckbox); // Recurse up the tree
  }

  function updateAllParentCheckboxes() {
    const allLeafCheckboxes = Array.from(
      document.querySelectorAll(
        '.milestone-tree-container input[type="checkbox"]'
      )
    ).filter((cb) => {
      const childrenContainer = cb.closest(
        ".milestone-tree-item-content"
      ).nextElementSibling;
      return (
        !childrenContainer ||
        !childrenContainer.classList.contains("milestone-tree-children")
      );
    });

    allLeafCheckboxes.forEach((cb) => updateParentCheckbox(cb));
  }

  async function saveAllMilestones(modalInstance) {
    const listPanel = document.getElementById("milestones-list-panel");
    const milestoneItems = listPanel.querySelectorAll(".milestone-item");
    const linksByMilestoneId = new Map(
      JSON.parse(listPanel.dataset.links || "[]").map(([key, value]) => [
        key,
        new Set(value),
      ])
    );

    const finalMilestones = [];
    const finalLinks = [];

    milestoneItems.forEach((item) => {
      const name = item.querySelector(".milestone-name-input").value.trim();
      const date = item.querySelector(".milestone-date-input").value;
      const id = item.dataset.milestoneId;

      if (name && date) {
        finalMilestones.push({ id, name, date });
        const links = linksByMilestoneId.get(id);
        if (links) {
          links.forEach((itemId) => {
            finalLinks.push({ milestoneId: id, itemId });
          });
        }
      }
    });

    await Promise.all([
      storage.saveData(storage.APP_KEYS.MILESTONES_LIST_KEY, finalMilestones),
      storage.saveData(storage.APP_KEYS.MILESTONE_LINKS_KEY, finalLinks),
    ]);

    utils.showToast("Marcos salvos com sucesso!", "success");
    setTimeout(() => modalInstance.close(), 1500);
  }

  // --- Checklist Management Functions ---

  async function handleChecklistsConfig() {
    modal.open({
      title: "Gerenciar Checklists",
      subtitle: "Crie e edite modelos de checklist para usar no planejamento.",
      customClass: "modal-large",
      showFooter: false,
      headerAction: {
        id: "add-new-checklist-btn",
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`,
        tooltip: "Adicionar Novo Checklist",
      },
      onOpen: () => {
        renderChecklistsTable();
      },
    });
  }

  async function renderChecklistsTable() {
    modal.setTitle("Gerenciar Checklists");
    modal.setSubtitle(
      "Crie e edite modelos de checklist para usar no planejamento."
    );
    modal.showHeaderAction();
    document.getElementById("add-new-checklist-btn").onclick = () =>
      renderChecklistEditForm();
    modal.showSaveButton(false);
    modal.setCancelText("Fechar");

    const checklists = await storage.getData(storage.APP_KEYS.CHECKLISTS_KEY);
    checklists.sort((a, b) => a.name.localeCompare(b.name));

    let tableHtml = `<div class="table-container"><table><thead><tr><th>Nome do Checklist</th><th>Nº de Itens</th><th class="text-right">Ações</th></tr></thead><tbody>`;
    if (checklists.length > 0) {
      checklists.forEach((cl) => {
        tableHtml += `<tr>
                <td class="font-semibold text-primary">${cl.name}</td>
                <td>${cl.items.length}</td>
                <td class="text-right"><div class="flex items-center justify-end gap-2">
                    <button class="edit-checklist-btn text-blue-600 hover:text-blue-800 p-1" data-id="${cl.id}" title="Editar Checklist"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.5 6.036z" /></svg></button>
                    <button class="delete-checklist-btn text-red-600 hover:text-red-800 p-1" data-id="${cl.id}" title="Excluir Checklist"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                </div></td>
            </tr>`;
      });
    } else {
      tableHtml += `<tr><td colspan="3" class="text-center text-tertiary py-6">Nenhum checklist criado.</td></tr>`;
    }
    tableHtml += `</tbody></table></div>`;
    modal.setBody(tableHtml);
  }

  async function renderChecklistEditForm(checklistId = null) {
    currentEditingId = checklistId;
    const checklists = await storage.getData(storage.APP_KEYS.CHECKLISTS_KEY);
    const checklist = checklistId
      ? checklists.find((c) => c.id === checklistId)
      : {
          id: null,
          name: "",
          items: [{ id: utils.uuidv4(), question: "", category: "" }],
        };

    modal.setTitle(checklistId ? "Editar Checklist" : "Novo Checklist");
    modal.hideHeaderAction();
    modal.showSaveButton(true);
    modal.setSaveHandler(saveChecklist);
    modal.setCancelText("Cancelar");
    modal.setCancelHandler(handleChecklistsConfig);

    const mCategories = ["MET", "MAQ", "MAO", "MAT", "MED", "MEI"];

    const renderItemRow = (item) => {
      const categoryButtons = mCategories
        .map(
          (cat) =>
            `<button type="button" class="m-category-btn text-xs ${
              item.category === cat ? "active" : ""
            }" data-category="${cat}">${cat}</button>`
        )
        .join("");

      return `<div class="checklist-item-row" data-item-id="${
        item.id || utils.uuidv4()
      }">
              <input type="text" class="form-input flex-grow" placeholder="Texto da pergunta" value="${
                item.question || ""
              }">
              <div class="flex-shrink-0 flex gap-1">${categoryButtons}</div>
              <button type="button" class="remove-item-btn" title="Remover Pergunta">&times;</button>
          </div>`;
    };

    modal.setBody(
      `<div class="space-y-4">
          <div>
              <label for="checklist-name-input" class="form-label font-bold text-primary">Nome do Checklist</label>
              <input type="text" id="checklist-name-input" value="${
                checklist.name || ""
              }" class="form-input" placeholder="Ex: Checklist de Fundações">
          </div>
          <div>
              <label class="form-label font-bold text-primary">Itens do Checklist</label>
              <div id="checklist-items-container" class="space-y-2 p-2 border border-border-primary rounded-md bg-tertiary max-h-96 overflow-y-auto">${checklist.items
                .map(renderItemRow)
                .join("")}</div>
              <button id="add-checklist-item-btn" type="button" class="mt-2 px-3 py-1.5 bg-gray-200 text-primary rounded-md hover:bg-gray-300 text-sm font-semibold">Adicionar Pergunta</button>
          </div>
      </div>`
    );
  }

  async function saveChecklist(modalInstance) {
    const name = document.getElementById("checklist-name-input").value.trim();
    if (!name) {
      utils.showToast("O nome do checklist não pode ser vazio.", "error");
      throw new Error("Nome vazio.");
    }

    const itemsContainer = document.getElementById("checklist-items-container");
    const itemRows = itemsContainer.querySelectorAll(".checklist-item-row");
    const items = Array.from(itemRows)
      .map((row) => {
        const question = row.querySelector('input[type="text"]').value.trim();
        const activeCategoryBtn = row.querySelector(".m-category-btn.active");
        return {
          id: row.dataset.itemId,
          question: question,
          category: activeCategoryBtn
            ? activeCategoryBtn.dataset.category
            : null,
        };
      })
      .filter((item) => item.question); // Only save items with a question

    if (items.length === 0) {
      utils.showToast("O checklist deve ter pelo menos uma pergunta.", "error");
      throw new Error("Checklist vazio.");
    }

    const checklists = await storage.getData(storage.APP_KEYS.CHECKLISTS_KEY);
    if (currentEditingId) {
      const index = checklists.findIndex((c) => c.id === currentEditingId);
      if (index > -1) {
        checklists[index] = { ...checklists[index], name, items };
      }
    } else {
      checklists.push({ id: utils.uuidv4(), name, items });
    }

    await storage.saveData(storage.APP_KEYS.CHECKLISTS_KEY, checklists);
    utils.showToast("Checklist salvo!", "success");
    await renderChecklistsTable(); // Go back to the list
  }

  async function deleteChecklist(checklistId) {
    if (confirm("Tem certeza que deseja excluir este checklist?")) {
      try {
        let checklists = await storage.getData(storage.APP_KEYS.CHECKLISTS_KEY);
        const newChecklists = checklists.filter((c) => c.id !== checklistId);
        await storage.saveData(storage.APP_KEYS.CHECKLISTS_KEY, newChecklists);
        utils.showToast("Checklist excluído.", "success");
        await renderChecklistsTable();
      } catch (error) {
        utils.showToast(`Erro ao excluir: ${error.message}`, "error");
      }
    }
  }

  // --- Page Initialization and Event Listeners ---

  const cardConfigs = {
    "config-weeks": handleWeeksConfig,
    "config-resource": handleResourceConfig,
    "config-grouping": handleGroupingConfig,
    "config-hidden-activities": handleHiddenActivitiesConfig,
    "config-activity-mapping": handleActivityMappingConfig,
    "config-restrictions": handleRestrictionsConfig,
    "config-milestones": handleMilestonesConfig,
    "config-checklists": handleChecklistsConfig,
    "config-custom-values": handleCustomValuesConfig,
    "config-activity-details": handleActivityDetailsConfig,
    "config-backup": handleBackupConfig,
  };

  function handleCardClick(e) {
    const card = e.target.closest(".config-card");
    if (card && cardConfigs[card.id]) {
      cardConfigs[card.id]();
    }
  }

  function handleCardKeydown(e) {
    const card = e.target.closest(".config-card");
    if (card && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      if (cardConfigs[card.id]) {
        cardConfigs[card.id]();
      }
    }
  }

  await migrateToGroupIds(); // Run migration check on page load

  const configContainer = document.querySelector(".grid.gap-6");
  configContainer.addEventListener("click", handleCardClick);
  configContainer.addEventListener("keydown", handleCardKeydown);

  document.getElementById("modal-body").addEventListener("click", (e) => {
    // Dynamic event listeners for content injected into the modal
    if (e.target.closest(".edit-group-btn"))
      renderGroupEditForm(e.target.closest(".edit-group-btn").dataset.groupId);
    if (e.target.closest(".delete-group-btn"))
      deleteGroup(e.target.closest(".delete-group-btn").dataset.groupId);

    if (e.target.closest(".edit-custom-value-btn"))
      renderCustomValueEditForm(
        e.target.closest(".edit-custom-value-btn").dataset.id
      );
    if (e.target.closest(".delete-custom-value-btn"))
      deleteCustomValue(
        e.target.closest(".delete-custom-value-btn").dataset.id
      );

    if (e.target.closest(".edit-restriction-btn"))
      renderRestrictionEditForm(
        e.target.closest(".edit-restriction-btn").dataset.id
      );
    if (e.target.closest(".delete-restriction-btn"))
      deleteRestriction(e.target.closest(".delete-restriction-btn").dataset.id);

    if (e.target.closest(".edit-plan-btn"))
      renderPlanEditForm(e.target.closest(".edit-plan-btn").dataset.parentId);
    if (e.target.closest(".delete-plan-btn"))
      deletePlan(e.target.closest(".delete-plan-btn").dataset.parentId);

    if (e.target.closest(".edit-checklist-btn"))
      renderChecklistEditForm(
        e.target.closest(".edit-checklist-btn").dataset.id
      );
    if (e.target.closest(".delete-checklist-btn"))
      deleteChecklist(e.target.closest(".delete-checklist-btn").dataset.id);

    if (e.target.id === "add-step-btn") {
      const list = document.getElementById("steps-list");
      if (list) {
        list.insertAdjacentHTML(
          "beforeend",
          `<div class="execution-step"><input type="text" class="form-input flex-grow" placeholder="Descrição da etapa"><input type="date" class="form-input"><input type="date" class="form-input"><button type="button" class="remove-step-btn" title="Remover Etapa">&times;</button></div>`
        );
      }
    }
    if (e.target.closest(".remove-step-btn")) {
      e.target.closest(".execution-step").remove();
      modal.enableSaveButton();
    }
    if (e.target.id === "add-checklist-item-btn") {
      const container = document.getElementById("checklist-items-container");
      const mCategories = ["MET", "MAQ", "MAO", "MAT", "MED", "MEI"];
      const categoryButtons = mCategories
        .map(
          (cat) =>
            `<button type="button" class="m-category-btn text-xs" data-category="${cat}">${cat}</button>`
        )
        .join("");
      const newItemHtml = `<div class="checklist-item-row" data-item-id="${utils.uuidv4()}">
        <input type="text" class="form-input flex-grow" placeholder="Texto da pergunta">
        <div class="flex-shrink-0 flex gap-1">${categoryButtons}</div>
        <button type="button" class="remove-item-btn" title="Remover Pergunta">&times;</button>
      </div>`;
      container.insertAdjacentHTML("beforeend", newItemHtml);
      return;
    }
    const checklistItemRow = e.target.closest(".checklist-item-row");
    if (checklistItemRow) {
      if (e.target.closest(".remove-item-btn")) {
        checklistItemRow.remove();
        modal.enableSaveButton();
        return;
      }
      if (e.target.closest(".m-category-btn")) {
        const btn = e.target.closest(".m-category-btn");
        const isAlreadyActive = btn.classList.contains("active");
        btn.parentElement
          .querySelectorAll(".active")
          .forEach((b) => b.classList.remove("active"));
        if (!isAlreadyActive) {
          btn.classList.add("active");
        }
        modal.enableSaveButton();
        return;
      }
    }
    // Milestone Workspace Listeners
    if (e.target.id === "add-milestone-btn") {
      const listItems = document.getElementById("milestones-list-items");
      const newId = `new_${utils.uuidv4()}`;
      const newItemHtml = `
            <div class="milestone-item" data-milestone-id="${newId}">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <input type="text" class="form-input milestone-name-input" placeholder="Novo Marco">
                    <input type="date" class="form-input milestone-date-input">
                </div>
                <div class="flex items-center justify-between">
                     <button type="button" class="link-milestone-btn px-3 py-1.5 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-sm font-semibold">Vincular Atividades</button>
                     <button type="button" class="delete-milestone-btn text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100" title="Excluir Marco">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>`;
      listItems.insertAdjacentHTML("beforeend", newItemHtml);
      modal.enableSaveButton();
      return;
    }
    if (e.target.closest(".delete-milestone-btn")) {
      e.target.closest(".milestone-item").remove();
      modal.enableSaveButton();
      // If the deleted one was active, reset the tree panel
      if (e.target.closest(".milestone-item").classList.contains("is-active")) {
        document.getElementById(
          "wbs-tree-panel"
        ).innerHTML = `<div class="milestone-tree-container-wrapper"><h3 class="text-lg font-bold text-primary mb-3">Vincular a: <span id="active-milestone-name" class="text-accent">Nenhum</span></h3><div id="milestone-tree-container" class="milestone-tree-container"><p class="text-tertiary text-center p-8">Selecione "Vincular Atividades" em um marco à esquerda.</p></div></div>`;
      }
      return;
    }
    if (e.target.closest(".link-milestone-btn")) {
      const milestoneItem = e.target.closest(".milestone-item");
      if (activeMilestoneRow) {
        activeMilestoneRow.classList.remove("is-active");
      }
      activeMilestoneRow = milestoneItem;
      activeMilestoneRow.classList.add("is-active");

      const milestoneName =
        activeMilestoneRow.querySelector(".milestone-name-input").value ||
        "Novo Marco";
      const milestoneId = activeMilestoneRow.dataset.milestoneId;

      document.getElementById("active-milestone-name").textContent =
        milestoneName;

      const listPanel = document.getElementById("milestones-list-panel");
      const linksMap = new Map(
        JSON.parse(listPanel.dataset.links || "[]").map(([key, value]) => [
          key,
          new Set(value),
        ])
      );
      const selectedIdsSet = linksMap.get(milestoneId) || new Set();

      renderWbsSelectionTree(selectedIdsSet);
      modal.enableSaveButton();
      return;
    }
    const milestoneTree = e.target.closest("#milestone-tree-container");
    if (milestoneTree) {
      if (e.target.classList.contains("milestone-tree-toggle")) {
        const childrenDiv = e.target.parentElement.nextElementSibling;
        if (childrenDiv) {
          const isExpanded = e.target.getAttribute("aria-expanded") === "true";
          childrenDiv.hidden = isExpanded;
          e.target.setAttribute("aria-expanded", !isExpanded);
          e.target.textContent = isExpanded ? "+" : "-";
        }
        return;
      }
      if (e.target.type === "checkbox") {
        const isChecked = e.target.checked;
        const childrenContainer = e.target.closest(
          ".milestone-tree-item-content"
        ).nextElementSibling;
        if (childrenContainer) {
          childrenContainer
            .querySelectorAll('input[type="checkbox"]')
            .forEach((cb) => (cb.checked = isChecked));
        }
        updateParentCheckbox(e.target);
        modal.enableSaveButton();
      }
    }
  });

  document.getElementById("modal-body").addEventListener("change", (e) => {
    // Listener for tree checkbox changes in Milestone editor
    const milestoneTree = e.target.closest("#milestone-tree-container");
    if (milestoneTree && activeMilestoneRow) {
      const listPanel = document.getElementById("milestones-list-panel");
      const linksMap = new Map(
        JSON.parse(listPanel.dataset.links || "[]").map(([key, value]) => [
          key,
          new Set(value),
        ])
      );
      const activeId = activeMilestoneRow.dataset.milestoneId;

      if (!linksMap.has(activeId)) {
        linksMap.set(activeId, new Set());
      }
      const activeLinksSet = linksMap.get(activeId);

      const checkboxes = milestoneTree.querySelectorAll(
        'input[type="checkbox"]'
      );
      checkboxes.forEach((cb) => {
        const itemId = cb.dataset.itemId;
        if (cb.checked) {
          activeLinksSet.add(itemId);
        } else {
          activeLinksSet.delete(itemId);
        }
      });
      listPanel.dataset.links = JSON.stringify(
        Array.from(linksMap.entries(), ([key, value]) => [
          key,
          Array.from(value),
        ])
      );
    }
  });
})();
