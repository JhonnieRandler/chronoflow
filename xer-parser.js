/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Encapsulates all logic for parsing and transforming raw .xer file data.
 */

/**
 * Parses the content of a .xer file into a structured object of tables.
 * @param {string} xerContent The raw text content of the .xer file.
 * @returns {Object} An object where keys are table names and values are objects with headers and rows.
 */
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

/**
 * Transforms the parsed tables by creating stable IDs, resolving foreign keys,
 * and enriching the data for application use.
 * @param {Object} parsedTables The raw tables parsed from the XER file.
 * @param {string} currentProjectId The ID of the current project being processed.
 * @returns {Object} The transformed tables object.
 */
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

/**
 * Main processing function for a XER file.
 * @param {string} fileContent The content of the .xer file.
 * @returns {Object} The fully parsed and transformed tables.
 */
export function processXerFile(fileContent) {
  const parsedTables = parseXER(fileContent);
  const currentProjectId =
    parsedTables["PROJECT"]?.rows[0]?.proj_id || `UNK_${Date.now()}`;
  return transformData(parsedTables, currentProjectId);
}
