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
import { processXerFile } from "./xer-parser.js";

// ===== Page Script Starts Here =====
utils.insertHeader();

const dropArea = document.getElementById("drop-area");
const fileElem = document.getElementById("fileElem");
const confirmationArea = document.getElementById("confirmation-area");
const confirmFileNameSpan = document.getElementById("confirm-file-name");
const processFileBtn = document.getElementById("process-file-btn");
const cancelFileBtn = document.getElementById("cancel-file-btn");
const fileDisplay = document.getElementById("file-display");
const fileNameSpan = document.getElementById("file-name");
const fileFeedback = document.getElementById("file-feedback");
const dashboardOutput = document.getElementById("dashboard-output");
const dashboardSection = document.getElementById("dashboard-section");

let selectedFile = null;

// Tables that define the project structure and are saved only once.
const BASE_TABLE_NAMES = [
  "RSRC",
  "TASK",
  "ACTVCODE",
  "TASKACTV",
  "PROJWBS",
  "WBS_HIERARCHY",
];
// Tables that change weekly and are saved with every upload.
const VERSION_TABLE_NAMES = ["PROJECT", "TASKPRED", "TASKRSRC"];

const COLUMNS_TO_SAVE_MAP = {
  PROJECT: [
    "proj_id",
    "proj_name",
    "last_recalc_date",
    "plan_start_date",
    "scd_end_date",
  ],
  RSRC: ["rsrc_name", "rsrc_type"],
  TASK: [
    "status_code",
    "task_code",
    "task_name",
    "target_equip_qty",
    "act_equip_qty",
    "remain_equip_qty",
    "act_start_date",
    "act_end_date",
    "reend_date",
    "restart_date",
    "target_start_date",
    "target_end_date",
    "wbs_stable_id_ref",
  ],
  TASKPRED: ["task_id_code", "pred_task_id_code", "pred_type", "lag_hr_cnt"],
  TASKRSRC: [
    "proj_id",
    "remain_qty",
    "target_qty",
    "act_reg_qty",
    "rsrc_type",
    "task_id_code",
    "rsrc_id_name",
  ],
  PROJWBS: ["wbs_id", "wbs_name", "parent_wbs_id"],
  WBS_HIERARCHY: ["stable_wbs_id", "wbs_name", "level", "parent_stable_wbs_id"],
  ACTVCODE: ["actv_code_name", "parent_actv_code_name"],
  TASKACTV: ["task_id_code", "actv_code_id_name"],
};

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight() {
  dropArea.classList.add("highlight");
}

function unhighlight() {
  dropArea.classList.remove("highlight");
}

function showConfirmationUI(file) {
  selectedFile = file;
  confirmFileNameSpan.textContent = file.name;
  dropArea.classList.add("hidden");
  confirmationArea.classList.remove("hidden");
  fileDisplay.classList.add("hidden"); // Hide previous file info
}

function hideConfirmationUI() {
  selectedFile = null;
  fileElem.value = ""; // Reset the file input
  dropArea.classList.remove("hidden");
  confirmationArea.classList.add("hidden");
}

async function handleFiles(files, source) {
  if (files.length === 0) return;
  const file = files[0];
  if (!file.name.toLowerCase().endsWith(".xer")) {
    dashboardOutput.innerHTML = `<p class="message-box error">Por favor, selecione um arquivo com a extensão .xer.</p>`;
    fileFeedback.textContent =
      "Erro: Por favor, selecione um arquivo com a extensão .xer.";
    return;
  }

  if (source === "click") {
    showConfirmationUI(file);
  } else {
    // Immediate processing for drag-and-drop
    processFile(file);
  }
}

async function processFile(file) {
  if (!file) return;

  hideConfirmationUI();
  fileNameSpan.textContent = file.name;
  fileDisplay.classList.remove("hidden");
  fileFeedback.textContent = `Processando arquivo ${file.name}.`;
  dashboardOutput.innerHTML = `<p class="message-box info" role="status">Processando e salvando arquivo... Isso pode levar alguns instantes.</p>`;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const fileContent = e.target.result;
      const transformedTables = processXerFile(fileContent);
      const currentProjectId =
        transformedTables["PROJECT"]?.rows[0]?.proj_id || `UNK_${Date.now()}`;

      const projectBase = await storage.getProjectBase();
      const isFirstUpload =
        !projectBase || Object.keys(projectBase).length === 0;

      if (isFirstUpload) {
        const baseData = {};
        BASE_TABLE_NAMES.forEach((tableName) => {
          if (transformedTables[tableName]) {
            baseData[tableName] = filterTableColumns(
              transformedTables[tableName],
              COLUMNS_TO_SAVE_MAP[tableName]
            );
          }
        });
        await storage.saveProjectBase(baseData);
      }

      const versionData = {};
      VERSION_TABLE_NAMES.forEach((tableName) => {
        if (transformedTables[tableName]) {
          versionData[tableName] = filterTableColumns(
            transformedTables[tableName],
            COLUMNS_TO_SAVE_MAP[tableName]
          );
        }
      });
      await storage.saveProjectVersion(currentProjectId, versionData);
      utils.showToast("Arquivo .xer processado e salvo!", "success");
      fileFeedback.textContent = `Arquivo ${file.name} processado e salvo com sucesso.`;
      await loadDashboard();
    } catch (error) {
      console.error("Erro ao processar ou salvar o arquivo:", error);
      utils.showToast(`Erro ao processar: ${error.message}`, "error");
      fileFeedback.textContent = `Erro ao processar o arquivo: ${error.message}`;
      dashboardOutput.innerHTML = `<p class="message-box error" role="alert">Erro ao processar o arquivo: ${error.message}.</p>`;
    }
  };
  reader.readAsText(file, "ISO-8859-1");
}

function setupEventListeners() {
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  ["dragenter", "dragover"].forEach((eventName) =>
    dropArea.addEventListener(eventName, highlight, false)
  );
  ["dragleave", "drop"].forEach((eventName) =>
    dropArea.addEventListener(eventName, unhighlight, false)
  );

  dropArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileElem.click();
    }
  });

  dropArea.addEventListener(
    "drop",
    (e) => handleFiles(e.dataTransfer.files, "drag"),
    false
  );
  fileElem.addEventListener(
    "change",
    (e) => handleFiles(e.target.files, "click"),
    false
  );

  cancelFileBtn.addEventListener("click", hideConfirmationUI);
  processFileBtn.addEventListener("click", () => processFile(selectedFile));
}

function filterTableColumns(tableData, columnsToKeep) {
  if (!tableData?.rows || !columnsToKeep) return { headers: [], rows: [] };
  const newHeaders = columnsToKeep.filter((header) =>
    tableData.headers.includes(header)
  );
  const newRows = tableData.rows.map((row) => {
    const newRow = {};
    newHeaders.forEach((header) => {
      newRow[header] = row[header] ?? "";
    });
    return newRow;
  });
  return { headers: newHeaders, rows: newRows };
}

function displayDashboard(projectVersions, weeksMapping) {
  let versionsListHtml = Object.keys(projectVersions)
    .sort((a, b) => {
      const dateA = new Date(
        projectVersions[a].PROJECT?.rows[0]?.last_recalc_date.replace(
          " ",
          "T"
        ) || 0
      );
      const dateB = new Date(
        projectVersions[b].PROJECT?.rows[0]?.last_recalc_date.replace(
          " ",
          "T"
        ) || 0
      );
      return dateB - dateA;
    })
    .map((versionId) => {
      const versionInfo = projectVersions[versionId]?.PROJECT?.rows[0];
      if (!versionInfo) return "";
      const recalcDate = versionInfo.last_recalc_date;
      const weekNumber = utils.getWeekForDate(recalcDate, weeksMapping);
      const weekText = weekNumber
        ? `Semana ${weekNumber}`
        : "Semana não mapeada";

      return `
            <div class="project-list-item">
              <div class="font-medium text-primary">${weekText} <span class="text-xs text-tertiary font-mono ml-2">(${versionId})</span></div>
              <div class="text-secondary">Atualizado em: ${utils.formatBrazilianDate(
                recalcDate
              )}</div>
            </div>`;
    })
    .join("");

  dashboardOutput.innerHTML = `
            <div>
              <h2 class="text-2xl font-bold text-primary mb-4">Versões Carregadas</h2>
              <div class="space-y-2">${versionsListHtml}</div>
            </div>
        `;
}

function renderDashboardSkeleton() {
  const skeletonItem = `
        <div class="project-list-item">
            <div class="flex-grow">
                <div class="skeleton skeleton-text" style="width: 40%;"></div>
            </div>
            <div class="w-1/3">
                <div class="skeleton skeleton-text"></div>
            </div>
        </div>
    `;
  dashboardOutput.innerHTML = `
        <div>
            <div class="skeleton skeleton-title mb-4" style="width: 300px;"></div>
            <div class="space-y-2">
                ${skeletonItem.repeat(3)}
            </div>
            <div class="sr-only" aria-live="polite">Carregando versões do projeto.</div>
        </div>`;
}

async function loadDashboard() {
  renderDashboardSkeleton();
  dashboardSection.setAttribute("aria-busy", "true");

  try {
    const projectBase = await storage.getProjectBase();
    const projectVersions = await storage.getProjectVersions();
    const weeksMapping = await storage.getData(storage.APP_KEYS.WEEKS_DATA_KEY);

    const versionIds = Object.keys(projectVersions);

    if (!projectBase || Object.keys(projectBase).length === 0) {
      dashboardOutput.innerHTML = `
              <div>
                <p class="message-box info">Nenhuma informação de projeto carregada. Por favor, envie um arquivo .xer para iniciar.</p>
              </div>
            `;
      return;
    }

    if (versionIds.length > 0) {
      displayDashboard(projectVersions, weeksMapping);
      fileDisplay.classList.remove("hidden");
      if (!fileNameSpan.textContent) {
        fileNameSpan.textContent =
          "Dados carregados do armazenamento em nuvem.";
      }
    } else {
      dashboardOutput.innerHTML = `
              <div>
                <p class="message-box info">Dados base do projeto encontrados, mas nenhuma versão semanal foi carregada. Envie um arquivo .xer.</p>
              </div>
            `;
    }
  } catch (error) {
    console.error("Erro ao carregar o dashboard:", error);
    dashboardOutput.innerHTML = `<p class="message-box error" role="alert">Ocorreu um erro ao carregar o dashboard: ${error.message}.</p>`;
  } finally {
    dashboardSection.setAttribute("aria-busy", "false");
  }
}

// Initialize the page
(async () => {
  setupEventListeners();
  await loadDashboard();
})();
