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

const dropArea = document.getElementById("drop-area");
const fileElem = document.getElementById("fileElem");
const fileDisplay = document.getElementById("file-display");
const fileNameSpan = document.getElementById("file-name");
const dashboardOutput = document.getElementById("dashboard-output");
const dashboardSection = document.getElementById("dashboard-section");

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

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  dropArea.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}
["dragenter", "dragover"].forEach((eventName) =>
  dropArea.addEventListener(eventName, highlight, false)
);
["dragleave", "drop"].forEach((eventName) =>
  dropArea.addEventListener(eventName, unhighlight, false)
);
function highlight() {
  dropArea.classList.add("highlight");
}
function unhighlight() {
  dropArea.classList.remove("highlight");
}
dropArea.addEventListener("drop", handleDrop, false);
function handleDrop(e) {
  handleFiles(e.dataTransfer.files);
}
fileElem.addEventListener("change", function (e) {
  handleFiles(e.target.files);
});

async function handleFiles(files) {
  if (files.length === 0) return;
  const file = files[0];
  if (!file.name.toLowerCase().endsWith(".xer")) {
    dashboardOutput.innerHTML = `<p class="message-box error">Por favor, selecione um arquivo com a extensão .xer.</p>`;
    return;
  }
  fileNameSpan.textContent = file.name;
  fileDisplay.classList.remove("hidden");
  dashboardOutput.innerHTML = `<p class="message-box info" role="status">Processando e salvando arquivo... Isso pode levar alguns instantes.</p>`;

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const fileContent = e.target.result;
      const parsedTables = parseXER(fileContent);
      const currentProjectId =
        parsedTables["PROJECT"]?.rows[0]?.proj_id || `UNK_${Date.now()}`;
      const transformedTables = transformData(parsedTables, currentProjectId);

      // Check if the base project data already exists.
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

      // Always save the weekly version data.
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
      await loadDashboard();
    } catch (error) {
      console.error("Erro ao processar ou salvar o arquivo:", error);
      utils.showToast(`Erro ao processar: ${error.message}`, "error");
      dashboardOutput.innerHTML = `<p class="message-box error" role="alert">Erro ao processar o arquivo: ${error.message}.</p>`;
    }
  };
  reader.readAsText(file, "ISO-8859-1");
}

function parseXER(xerContent) {
  const lines = xerContent.split(/\r?\n/);
  const tables = {};
  let currentTableName = null;
  let currentTableHeaders = [];
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("%T")) {
      currentTableName = trimmedLine.substring(2).trim();
      tables[currentTableName] = { headers: [], rows: [] };
    } else if (trimmedLine.startsWith("%F") && currentTableName) {
      currentTableHeaders = trimmedLine
        .substring(2)
        .split("\t")
        .map((h) => h.trim())
        .filter((h) => h.length > 0);
      tables[currentTableName].headers = currentTableHeaders;
    } else if (
      trimmedLine.startsWith("%R") &&
      currentTableName &&
      currentTableHeaders.length > 0
    ) {
      const values = trimmedLine.substring(2).trimStart().split("\t");
      const rowObject = {};
      currentTableHeaders.forEach((header, i) => {
        rowObject[header] = values[i]?.trim() || "";
      });
      tables[currentTableName].rows.push(rowObject);
    }
  }
  return tables;
}

function transformData(parsedTables, currentProjectId) {
  const transformed = JSON.parse(JSON.stringify(parsedTables));

  const wbsData = transformed.PROJWBS?.rows || [];
  const wbsMap = new Map(wbsData.map((wbs) => [wbs.wbs_id, wbs]));
  const hierarchyData = [];
  const originalToStableIdMap = new Map();
  const levelCache = new Map();

  wbsData.forEach((wbs) => {
    let path = [wbs.wbs_name];
    let current = wbs;
    while (current.parent_wbs_id && wbsMap.has(current.parent_wbs_id)) {
      current = wbsMap.get(current.parent_wbs_id);
      path.unshift(current.wbs_name);
    }
    const stableId = path.join(" > ");
    originalToStableIdMap.set(wbs.wbs_id, stableId);
  });

  function getWbsLevel(wbsId) {
    if (levelCache.has(wbsId)) return levelCache.get(wbsId);
    const wbs = wbsMap.get(wbsId);
    if (!wbs || !wbs.parent_wbs_id || !wbsMap.has(wbs.parent_wbs_id)) {
      levelCache.set(wbsId, 1);
      return 1;
    }
    const parentLevel = getWbsLevel(wbs.parent_wbs_id);
    const currentLevel = parentLevel + 1;
    levelCache.set(wbsId, currentLevel);
    return currentLevel;
  }

  const rootWbs = wbsData.find(
    (w) => !w.parent_wbs_id || !wbsMap.has(w.parent_wbs_id)
  );
  const rootWbsStableId = rootWbs
    ? originalToStableIdMap.get(rootWbs.wbs_id)
    : null;

  wbsData.forEach((wbs) => {
    if (originalToStableIdMap.get(wbs.wbs_id) === rootWbsStableId) return;
    hierarchyData.push({
      stable_wbs_id: originalToStableIdMap.get(wbs.wbs_id),
      wbs_name: wbs.wbs_name,
      level: getWbsLevel(wbs.wbs_id) - 1,
      parent_stable_wbs_id:
        originalToStableIdMap.get(wbs.parent_wbs_id) === rootWbsStableId
          ? null
          : originalToStableIdMap.get(wbs.parent_wbs_id),
    });
  });

  transformed["WBS_HIERARCHY"] = {
    headers: ["stable_wbs_id", "wbs_name", "level", "parent_stable_wbs_id"],
    rows: hierarchyData,
  };

  const rsrcIdToNameMap = new Map(
    transformed.RSRC?.rows.map((r) => [r.rsrc_id, r.rsrc_name])
  );
  const taskIdToCodeMap = new Map(
    transformed.TASK?.rows.map((t) => [t.task_id, t.task_code])
  );
  const actvCodeIdToNameMap = new Map(
    transformed.ACTVCODE?.rows.map((c) => [c.actv_code_id, c.actv_code_name])
  );

  if (transformed.TASK) {
    transformed.TASK.rows.forEach((task) => {
      task.wbs_stable_id_ref = originalToStableIdMap.get(task.wbs_id) || null;
      task.act_start_date = task.act_start_date || task.actual_start_dt || "";
      task.act_end_date = task.act_end_date || task.actual_end_dt || "";
      task.target_start_date =
        task.target_start_date || task.target_start_dt || "";
      task.target_end_date = task.target_end_date || task.target_end_dt || "";
      task.restart_date = task.restart_date || "";
      task.reend_date = task.reend_date || "";
    });
    const newHeaders = [
      "wbs_stable_id_ref",
      "act_start_date",
      "act_end_date",
      "restart_date",
      "reend_date",
      "target_start_date",
      "target_end_date",
    ];
    newHeaders.forEach(
      (h) =>
        !transformed.TASK.headers.includes(h) &&
        transformed.TASK.headers.push(h)
    );
  }

  if (transformed.TASKPRED) {
    transformed.TASKPRED.rows.forEach((pred) => {
      pred.task_id_code = taskIdToCodeMap.get(pred.task_id) || pred.task_id;
      pred.pred_task_id_code =
        taskIdToCodeMap.get(pred.pred_task_id) || pred.pred_task_id;
    });
    if (!transformed.TASKPRED.headers.includes("task_id_code")) {
      transformed.TASKPRED.headers.push("task_id_code");
    }
    if (!transformed.TASKPRED.headers.includes("pred_task_id_code")) {
      transformed.TASKPRED.headers.push("pred_task_id_code");
    }
  }
  if (transformed.TASKRSRC) {
    transformed.TASKRSRC.rows.forEach((taskrsrc) => {
      taskrsrc.task_id_code =
        taskIdToCodeMap.get(taskrsrc.task_id) || taskrsrc.task_id;
      taskrsrc.rsrc_id_name =
        rsrcIdToNameMap.get(taskrsrc.rsrc_id) || taskrsrc.rsrc_id;
      taskrsrc.proj_id = currentProjectId;
    });
    if (!transformed.TASKRSRC.headers.includes("task_id_code")) {
      transformed.TASKRSRC.headers.push("task_id_code");
    }
    if (!transformed.TASKRSRC.headers.includes("rsrc_id_name")) {
      transformed.TASKRSRC.headers.push("rsrc_id_name");
    }
    if (!transformed.TASKRSRC.headers.includes("proj_id")) {
      transformed.TASKRSRC.headers.push("proj_id");
    }
  }
  if (transformed.ACTVCODE) {
    transformed.ACTVCODE.rows.forEach((code) => {
      code.parent_actv_code_name =
        actvCodeIdToNameMap.get(code.parent_actv_code_id) || "";
    });
    if (!transformed.ACTVCODE.headers.includes("parent_actv_code_name")) {
      transformed.ACTVCODE.headers.push("parent_actv_code_name");
    }
  }
  if (transformed.TASKACTV) {
    transformed.TASKACTV.rows.forEach((taskactv) => {
      taskactv.task_id_code =
        taskIdToCodeMap.get(taskactv.task_id) || taskactv.task_id;
      taskactv.actv_code_id_name =
        actvCodeIdToNameMap.get(taskactv.actv_code_id) || taskactv.actv_code_id;
    });
    if (!transformed.TASKACTV.headers.includes("task_id_code")) {
      transformed.TASKACTV.headers.push("task_id_code");
    }
    if (!transformed.TASKACTV.headers.includes("actv_code_id_name")) {
      transformed.TASKACTV.headers.push("actv_code_id_name");
    }
  }
  return transformed;
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

(async () => {
  await loadDashboard();
})();
