import { initializationError, showFirebaseError } from "./firebase-config.js";
import * as utils from "./utils.js";
import { renderHTMLTable, renderTableSkeleton } from "./ui-components.js";

// First, check if Firebase is configured. If not, show an error and stop.
if (initializationError) {
  utils.insertHeader(); // Show nav so user isn't stuck
  showFirebaseError();
  throw initializationError; // Halt script execution
}

// If no error, import other modules and run the app
import { dataLoader } from "./data-loader.js";

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

const ALL_POSSIBLE_TABLE_NAMES = [
  ...new Set([...STATIC_TABLES, ...DYNAMIC_TABLES]),
];

async function loadAllData() {
  tableOutput.innerHTML = renderTableSkeleton(5, 10);
  try {
    const data = await dataLoader.loadViewerData();
    projectBase = data.projectBase;
    projectVersions = data.projectVersions;

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

      const defaultTable = ["TASK", "TASKRSRC", "PROJECT"].find((name) => {
        const tableData = getTableData(name, latestVersionId);
        return tableData && tableData.rows.length > 0;
      });

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
        versions[a].PROJECT?.rows[0]?.last_recalc_date.replace(" ", "T") || 0
      );
      const dateB = new Date(
        versions[b].PROJECT?.rows[0]?.last_recalc_date.replace(" ", "T") || 0
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
    tableOutput.innerHTML =
      '<p class="message-box info">Nenhum dado nesta tabela.</p>';
    return;
  }

  let filteredRows = tableData.rows;
  if (filterValue) {
    filteredRows = tableData.rows.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(filterValue)
      )
    );
  }

  tableOutput.innerHTML = renderHTMLTable(tableData.headers, filteredRows);
}

versionSelect.addEventListener("change", () => {
  currentSelectedVersionId = versionSelect.value;
  populateTableSelect();
  tableSelect.disabled = !currentSelectedVersionId;
  filterInput.disabled = !currentSelectedVersionId;
  if (currentSelectedVersionId) {
    // Select the first available table by default
    if (tableSelect.options.length > 1) {
      tableSelect.selectedIndex = 1;
      currentSelectedTableName = tableSelect.value;
    } else {
      currentSelectedTableName = null;
    }
  } else {
    currentSelectedTableName = null;
  }
  renderTable();
});

tableSelect.addEventListener("change", () => {
  currentSelectedTableName = tableSelect.value;
  renderTable();
});

filterInput.addEventListener("input", renderTable);

loadAllData();
