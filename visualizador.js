import {
  initializationError,
  showFirebaseError,
} from "./firebase-config.js";
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

const versionSelect = document.getElementById("version-select");
const tableSelect = document.getElementById("table-select");
const filterInput = document.getElementById("filter-input");
const tableOutput = document.getElementById("table-output");
const currentTableTitle = document.getElementById("current-table-title");

let projectBase = null;
let projectVersions = {};
let currentSelectedVersionId = null;
let currentSelectedTableName = null;

const STATIC_TABLES = [
  "RSRC",
  "TASK",
  "WBS_HIERARCHY",
  "PROJWBS",
  "ACTVCODE",
  "TASKACTV",
];
const DYNAMIC_TABLES = ["PROJECT", "TASKPRED", "TASKRSRC"];

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
  TASKPRED: [
    "task_id_code",
    "pred_task_id_code",
    "pred_type",
    "lag_hr_cnt",
  ],
  TASKRSRC: [
    "proj_id",
    "remain_qty",
    "target_qty",
    "act_reg_qty",
    "rsrc_type",
    "task_id_code",
    "rsrc_id_name",
  ],
  ACTVCODE: ["actv_code_name", "parent_actv_code_name"],
  TASKACTV: ["task_id_code", "actv_code_id_name"],
  PROJWBS: ["wbs_id", "wbs_name", "parent_wbs_id"],
  WBS_HIERARCHY: [
    "stable_wbs_id",
    "wbs_name",
    "level",
    "parent_stable_wbs_id",
  ],
};

const ALL_POSSIBLE_TABLE_NAMES = [
  ...new Set([...STATIC_TABLES, ...DYNAMIC_TABLES]),
];

function renderTableSkeleton() {
  const skeletonRow = `
        <tr>
            ${Array(5)
              .fill('<td><div class="skeleton skeleton-text"></div></td>')
              .join("")}
        </tr>
    `;
  tableOutput.innerHTML = `
        <div class="table-container">
            <table class="w-full">
                <thead>
                    <tr>
                        ${Array(5)
                          .fill(
                            '<th><div class="skeleton skeleton-text"></div></th>'
                          )
                          .join("")}
                    </tr>
                </thead>
                <tbody>
                    ${skeletonRow.repeat(5)}
                </tbody>
            </table>
        </div>
    `;
}

async function loadAllData() {
  renderTableSkeleton();
  try {
    projectBase = await storage.getProjectBase();
    projectVersions = await storage.getProjectVersions();

    if (!projectBase || Object.keys(projectBase).length === 0) {
      tableOutput.innerHTML = `<p class="message-box info">Nenhum dado base de projeto encontrado. Por favor, envie um arquivo .xer.</p>`;
      disableControls();
      return;
    }
    const versionIds = Object.keys(projectVersions);
    if (versionIds.length === 0) {
      tableOutput.innerHTML = `<p class="message-box info">Nenhuma versão de projeto encontrada. Por favor, envie um arquivo .xer.</p>`;
      disableControls();
      return;
    }

    populateVersionSelect(projectVersions);

    const latestVersionId = utils.getLatestProjectId(projectVersions);
    if (latestVersionId) {
      versionSelect.value = latestVersionId;
      currentSelectedVersionId = latestVersionId;
      populateTableSelect();
      tableSelect.disabled = false;
      filterInput.disabled = false;

      const defaultTable = ["TASK", "TASKRSRC", "PROJECT"].find(
        (name) => {
          const tableData = getTableData(name, latestVersionId);
          return tableData && tableData.rows.length > 0;
        }
      );

      if (defaultTable) {
        tableSelect.value = defaultTable;
        currentSelectedTableName = defaultTable;
        renderTable();
      } else {
        tableOutput.innerHTML =
          '<p class="message-box info">Nenhuma tabela com dados encontrada para esta versão.</p>';
      }
    }
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
    tableOutput.innerHTML = `<p class="message-box error">Erro ao carregar dados salvos: ${error.message}.</p>`;
  }
}

function disableControls() {
  versionSelect.disabled = true;
  tableSelect.disabled = true;
  filterInput.disabled = true;
}

function populateVersionSelect(versions) {
  versionSelect.innerHTML =
    '<option value="">-- Selecione uma versão --</option>';
  Object.keys(versions)
    .sort((a, b) => {
      const dateA = new Date(
        versions[a].PROJECT?.rows[0]?.last_recalc_date.replace(
          " ",
          "T"
        ) || 0
      );
      const dateB = new Date(
        versions[b].PROJECT?.rows[0]?.last_recalc_date.replace(
          " ",
          "T"
        ) || 0
      );
      return dateB - dateA;
    })
    .forEach((versionId) => {
      const option = document.createElement("option");
      const versionDate =
        versions[versionId].PROJECT?.rows[0]?.last_recalc_date;
      option.value = versionId;
      option.textContent = `${versionId} (${utils.formatBrazilianDate(
        versionDate
      )})`;
      versionSelect.appendChild(option);
    });
}

function populateTableSelect() {
  tableSelect.innerHTML =
    '<option value="">-- Selecione uma tabela --</option>';
  if (!currentSelectedVersionId) return;

  ALL_POSSIBLE_TABLE_NAMES.forEach((tableName) => {
    const tableData = getTableData(tableName, currentSelectedVersionId);
    if (tableData && tableData.rows.length > 0) {
      const option = document.createElement("option");
      option.value = tableName;
      option.textContent = tableName;
      tableSelect.appendChild(option);
    }
  });
}

function getTableData(tableName, versionId) {
  if (STATIC_TABLES.includes(tableName)) {
    return projectBase[tableName];
  }
  if (DYNAMIC_TABLES.includes(tableName)) {
    return projectVersions[versionId]?.[tableName];
  }
  return null;
}

function renderTable() {
  if (!currentSelectedTableName || !currentSelectedVersionId) {
    tableOutput.innerHTML =
      '<p class="message-box info">Selecione uma versão e uma tabela para visualizar.</p>';
    currentTableTitle.classList.add("hidden");
    return;
  }
  currentTableTitle.textContent = `Tabela: ${currentSelectedTableName}`;
  currentTableTitle.classList.remove("hidden");

  const filterValue = filterInput.value.toLowerCase().trim();
  const tableData = getTableData(
    currentSelectedTableName,
    currentSelectedVersionId
  );

  if (!tableData || !tableData.rows || tableData.rows.length === 0) {
    tableOutput.innerHTML = `<p class="message-box info">A tabela "${currentSelectedTableName}" não contém dados para esta versão.</p>`;
    return;
  }

  let rowsToProcess = tableData.rows;
  let headers =
    COLUMNS_TO_SAVE_MAP[currentSelectedTableName] ||
    (rowsToProcess.length > 0 ? Object.keys(rowsToProcess[0]) : []);

  const finalFilteredRows = rowsToProcess.filter((rowObject) => {
    if (!filterValue) return true;
    return Object.values(rowObject).some((value) =>
      String(value).toLowerCase().includes(filterValue)
    );
  });

  if (finalFilteredRows.length === 0) {
    tableOutput.innerHTML = `<p class="message-box info">${
      filterValue
        ? `Nenhum resultado encontrado para "${filterValue}"`
        : "A tabela não contém dados"
    }.</p>`;
    return;
  }

  let tableHtml = `<div class="table-container overflow-x-auto"><table class="min-w-full"><thead><tr>${headers
    .map(
      (h) => `<th class="py-2 px-4 whitespace-nowrap">${h}</th>`
    )
    .join("")}</tr></thead><tbody>`;
  tableHtml += finalFilteredRows
    .map(
      (row) =>
        `<tr>${headers
          .map(
            (h) =>
              `<td class="py-2 px-4 whitespace-nowrap">${
                row[h] || ""
              }</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  tableHtml += `</tbody></table></div>`;
  tableOutput.innerHTML = tableHtml;
}

versionSelect.addEventListener("change", function () {
  currentSelectedVersionId = this.value;
  if (currentSelectedVersionId) {
    tableSelect.disabled = false;
    filterInput.disabled = false;
    populateTableSelect();
    tableOutput.innerHTML =
      '<p class="message-box info">Selecione uma tabela para visualizar.</p>';
    currentTableTitle.classList.add("hidden");
    filterInput.value = "";
    tableSelect.value = "";
    currentSelectedTableName = null;
  } else {
    tableSelect.disabled = true;
    filterInput.disabled = true;
    tableSelect.innerHTML =
      '<option value="">-- Selecione uma tabela --</option>';
  }
});
tableSelect.addEventListener("change", function () {
  currentSelectedTableName = this.value;
  renderTable();
});
filterInput.addEventListener("input", renderTable);

(async () => {
  await loadAllData();
})();