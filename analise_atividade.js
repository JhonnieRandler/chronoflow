import { initializationError, showFirebaseError } from "./firebase-config.js";
import * as utils from "./utils.js";
import { dataLoader } from "./data-loader.js";
import {
  renderMessageBox,
  renderAnalysisSkeleton,
  renderHTMLTable,
} from "./ui-components.js";

// First, check if Firebase is configured. If not, show an error and stop.
if (initializationError) {
  utils.insertHeader(); // Show nav so user isn't stuck
  showFirebaseError();
  throw initializationError; // Halt script execution
}

// ===== Page Script Starts Here =====

(async () => {
  utils.insertHeader();

  const taskSelectEl = document.getElementById("task-select");
  const analysisOutput = document.getElementById("analysis-output");
  const projectInfo = document.getElementById("project-info");
  const taskSelectorWrapper = document.getElementById("task-selector-wrapper");
  const taskSelectorSkeleton = document.getElementById(
    "task-selector-skeleton"
  );

  let projectBase,
    projectVersions,
    mainResource,
    tomSelectInstance,
    activityMapping,
    weeksData,
    wbsMap,
    chartInstance,
    latestVersionId,
    customValuesData,
    activityDetailsMap,
    milestonesMap,
    itemMilestoneMap;

  const STATUS_MAP = {
    TK_Complete: { text: "Concluída", class: "status-complete" },
    TK_NotStart: { text: "Não Iniciada", class: "status-not-started" },
    TK_Active: { text: "Em Andamento", class: "status-active" },
  };
  const PRED_TYPE_MAP = {
    PR_FF: {
      text: "Término-a-Término",
      class: "pred-ff",
      description:
        "A sucessora só pode terminar após o término da predecessora.",
    },
    PR_FS: {
      text: "Término-a-Início",
      class: "pred-fs",
      description:
        "A sucessora só pode iniciar após o término da predecessora.",
    },
    PR_SS: {
      text: "Início-a-Início",
      class: "pred-ss",
      description: "A sucessora só pode iniciar após o início da predecessora.",
    },
    PR_SF: {
      text: "Início-a-Término",
      class: "pred-sf",
      description:
        "A sucessora só pode terminar após o início da predecessora.",
    },
  };

  // --- Carregamento Inicial ---
  try {
    const coreData = await dataLoader.loadCoreData();
    projectBase = coreData.projectBase;
    projectVersions = coreData.projectVersions;
    mainResource = coreData.mainResource;
    activityMapping = coreData.activityMapping;
    weeksData = coreData.weeksData;
    customValuesData = coreData.customValuesMap;
    activityDetailsMap = coreData.activityDetailsMap;
    milestonesMap = coreData.milestonesMap;
    itemMilestoneMap = coreData.itemMilestoneMap;
    wbsMap = coreData.wbsMap;
    latestVersionId = coreData.latestVersionId;

    if (!projectBase || Object.keys(projectBase).length === 0) {
      projectInfo.textContent =
        "Nenhum projeto base encontrado. Faça o upload de um arquivo .xer.";
      analysisOutput.innerHTML = "";
      taskSelectorSkeleton.classList.add("hidden");
      return;
    }
    if (Object.keys(projectVersions).length === 0) {
      projectInfo.textContent =
        "Nenhuma versão de projeto encontrada. Faça o upload de um arquivo .xer.";
      analysisOutput.innerHTML = "";
      taskSelectorSkeleton.classList.add("hidden");
      return;
    }

    if (!latestVersionId) {
      projectInfo.textContent =
        "Não foi possível encontrar a versão mais recente do projeto.";
      taskSelectorSkeleton.classList.add("hidden");
      return;
    }

    const latestVersion = projectVersions[latestVersionId];
    const lastRecalcDate = latestVersion.PROJECT?.rows[0]?.last_recalc_date;
    const recalcWeek = utils.getWeekForDate(lastRecalcDate, weeksData);

    projectInfo.innerHTML = recalcWeek
      ? `Analisando o projeto na <strong>semana ${recalcWeek}</strong> (versão de ${utils.formatBrazilianDate(
          lastRecalcDate
        )}).`
      : `Analisando o projeto (versão de ${utils.formatBrazilianDate(
          lastRecalcDate
        )}).`;

    await populateTaskSelect();
    taskSelectorSkeleton.classList.add("hidden");
    taskSelectorWrapper.classList.remove("hidden");
  } catch (e) {
    console.error("Erro ao carregar a página de análise:", e);
    analysisOutput.innerHTML = renderMessageBox(
      `Erro ao carregar dados: ${e.message}`,
      "error"
    );
    taskSelectorSkeleton.classList.add("hidden");
  }

  async function populateTaskSelect() {
    if (tomSelectInstance) tomSelectInstance.destroy();

    const allOptions = await dataLoader.getSelectableItems();

    tomSelectInstance = new TomSelect(taskSelectEl, {
      options: allOptions,
      placeholder: "Digite para buscar...",
      create: false,
      sortField: { field: "text", direction: "asc" },
    });
  }

  taskSelectEl.addEventListener("change", (e) => {
    const selectedValue = e.target.value;
    if (!selectedValue) {
      analysisOutput.innerHTML = renderMessageBox(
        "Selecione uma atividade ou grupo.",
        "info"
      );
      return;
    }
    analysisOutput.innerHTML = renderAnalysisSkeleton();

    setTimeout(() => {
      analysisOutput.setAttribute("aria-live", "polite");
      if (selectedValue.startsWith("group::")) {
        displayGroupAnalysis(selectedValue);
      } else {
        displayActivityAnalysis(selectedValue);
      }
    }, 50);
  });

  // --- Funções de Renderização ---
  function renderMilestonesCard(itemId, trendEndDate, wbsPath = []) {
    const allApplicableMilestoneIds = new Set();

    (itemMilestoneMap.get(itemId) || []).forEach((id) =>
      allApplicableMilestoneIds.add(id)
    );

    wbsPath.forEach((wbsNode) => {
      (itemMilestoneMap.get(wbsNode.stable_wbs_id) || []).forEach((id) =>
        allApplicableMilestoneIds.add(id)
      );
    });

    if (allApplicableMilestoneIds.size === 0) {
      return "";
    }

    const trendDateObj = trendEndDate
      ? new Date(trendEndDate.replace(" ", "T"))
      : null;

    const milestonesHtml = Array.from(allApplicableMilestoneIds)
      .map((id) => {
        const milestone = milestonesMap.get(id);
        if (!milestone) return "";

        let statusHtml = '<span class="text-tertiary">N/A</span>';
        if (trendDateObj && milestone.date) {
          const milestoneDateObj = new Date(milestone.date + "T23:59:59");
          if (trendDateObj <= milestoneDateObj) {
            statusHtml =
              '<span class="font-semibold text-green-600 dark:text-green-400">✅ No Prazo</span>';
          } else {
            statusHtml =
              '<span class="font-semibold text-amber-600 dark:text-amber-400">⚠️ Em Atraso</span>';
          }
        }
        return `
        <tr>
          <td class="text-primary">${milestone.name}</td>
          <td>${utils.formatBrazilianDate(milestone.date)}</td>
          <td>${statusHtml}</td>
        </tr>
      `;
      })
      .join("");

    return `
      <div class="card p-6 bg-secondary">
        <h2 class="text-xl font-bold text-primary mb-4">Marcos Vinculados</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Marco</th>
                <th>Data Limite</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${milestonesHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderExecutionPlanCard(itemId) {
    if (!activityDetailsMap.has(itemId)) {
      return "";
    }
    const planSteps = [...activityDetailsMap.get(itemId)];
    planSteps.sort((a, b) => {
      const dateA = a.startDate ? new Date(a.startDate) : 0;
      const dateB = b.startDate ? new Date(b.startDate) : 0;
      if (dateA !== dateB) return dateA - dateB;
      return a.name.localeCompare(b.name);
    });

    const stepsHtml =
      planSteps.length > 0
        ? planSteps
            .map(
              (step) => `
        <tr>
          <td class="text-primary">${step.name}</td>
          <td>${utils.formatBrazilianDate(step.startDate)}</td>
          <td>${utils.formatBrazilianDate(step.endDate)}</td>
        </tr>
      `
            )
            .join("")
        : '<tr><td colspan="3" class="text-center text-tertiary py-4">Nenhuma etapa definida neste plano.</td></tr>';

    return `
      <div class="card p-6 bg-secondary">
        <h2 class="text-xl font-bold text-primary mb-4">Plano de Execução Detalhado</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Etapa</th>
                <th>Data de Início</th>
                <th>Data de Fim</th>
              </tr>
            </thead>
            <tbody>
              ${stepsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderGenuineValuesCard(itemId) {
    const customData = customValuesData.get(itemId);
    if (
      !customData ||
      (customData.planned === null && customData.actual === null)
    ) {
      return "";
    }

    const planned = customData.planned ?? 0;
    const actual = customData.actual ?? 0;
    const remaining = Math.max(0, planned - actual);
    const progress = planned > 0 ? (actual / planned) * 100 : 0;

    return `
      <div class="card genuine-card p-6">
          <h2 class="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-4">Análise de Valores Topográficos</h2>
          <div class="info-grid">
              <div class="info-item genuine-item">
                  <span class="info-item-label">Previsto Topográfico</span>
                  <span class="info-item-value">${utils.formatNumberBR(
                    planned
                  )}</span>
              </div>
              <div class="info-item genuine-item">
                  <span class="info-item-label">Realizado Topográfico</span>
                  <span class="info-item-value">${utils.formatNumberBR(
                    actual
                  )}</span>
              </div>
              <div class="info-item genuine-item">
                  <span class="info-item-label">Saldo Topográfico</span>
                  <span class="info-item-value">${utils.formatNumberBR(
                    remaining
                  )}</span>
              </div>
               <div class="info-item genuine-item">
                  <span class="info-item-label">% Avanço Topográfico</span>
                  <span class="info-item-value">${utils.formatNumberBR(
                    progress
                  )}%</span>
              </div>
          </div>
      </div>`;
  }

  function buildWbsPathHtml(stableIdRef) {
    if (!stableIdRef || !wbsMap || wbsMap.size === 0)
      return `<div class="wbs-breadcrumb mb-4">Caminho WBS não disponível.</div>`;

    const pathObjects = utils.getWbsPathObjects(stableIdRef, wbsMap);
    const pathHtml = pathObjects.map(
      (wbs) => `<span class="breadcrumb-item">${wbs.wbs_name}</span>`
    );

    return pathHtml.length > 0
      ? `<div class="wbs-breadcrumb mb-4">${pathHtml.join(
          '<span class="breadcrumb-separator">&gt;</span>'
        )}</div>`
      : `<div class="wbs-breadcrumb mb-4">Caminho WBS não disponível.</div>`;
  }

  function displayActivityAnalysis(taskCode) {
    const latestVersion = projectVersions[latestVersionId];
    const task = projectBase.TASK.rows.find((t) => t.task_code === taskCode);
    if (!task) {
      analysisOutput.innerHTML = renderMessageBox(
        `Atividade "${taskCode}" não encontrada.`,
        "error"
      );
      return;
    }

    const targetQty = parseFloat(task.target_equip_qty || 0),
      actualQty = parseFloat(task.act_equip_qty || 0);
    const realProgress = targetQty > 0 ? (actualQty / targetQty) * 100 : 0;
    const statusInfo = STATUS_MAP[task.status_code] || {
      text: task.status_code,
      class: "",
    };

    const preds =
      latestVersion.TASKPRED?.rows.filter((p) => p.task_id_code === taskCode) ||
      [];
    const succs =
      latestVersion.TASKPRED?.rows.filter(
        (p) => p.pred_task_id_code === taskCode
      ) || [];

    const relTableHeaders = ["Atividade", "Tipo", "Lag"];
    const predsRows = preds.map((item) => {
      const typeInfo = PRED_TYPE_MAP[item.pred_type] || {
        text: item.pred_type,
        description: "Tipo desconhecido",
        class: "",
      };
      return {
        Atividade: item.pred_task_id_code,
        Tipo: `<span class="badge ${typeInfo.class}" data-tooltip="${typeInfo.description}">${typeInfo.text}</span>`,
        Lag: `${item.lag_hr_cnt}h`,
      };
    });
    const succsRows = succs.map((item) => {
      const typeInfo = PRED_TYPE_MAP[item.pred_type] || {
        text: item.pred_type,
        description: "Tipo desconhecido",
        class: "",
      };
      return {
        Atividade: item.task_id_code,
        Tipo: `<span class="badge ${typeInfo.class}" data-tooltip="${typeInfo.description}">${typeInfo.text}</span>`,
        Lag: `${item.lag_hr_cnt}h`,
      };
    });

    const predsTableHtml =
      preds.length > 0
        ? renderHTMLTable(relTableHeaders, predsRows)
        : renderMessageBox("Nenhuma predecessora encontrada.", "info");

    const succsTableHtml =
      succs.length > 0
        ? renderHTMLTable(relTableHeaders, succsRows)
        : renderMessageBox("Nenhuma sucessora encontrada.", "info");

    const allTaskRsrcData = Object.values(projectVersions).flatMap(
      (version) => version.TASKRSRC?.rows || []
    );
    const weeklyRecords = allTaskRsrcData.filter(
      (r) => r.task_id_code === taskCode
    );
    const byWeek = weeklyRecords.reduce((acc, rec) => {
      const versionData = projectVersions[rec.proj_id];
      if (!versionData) return acc;
      const recalc = versionData.PROJECT?.rows[0]?.last_recalc_date;

      if (!recalc) return acc;
      const weekLabel =
        utils.getWeekForDate(recalc, weeksData) || recalc.split(" ")[0];
      if (!acc[weekLabel]) acc[weekLabel] = { resources: [] };
      acc[weekLabel].resources.push(rec);
      return acc;
    }, {});
    const sortedWeeks = Object.keys(byWeek).sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true })
    );

    let weeklyRowsHtml =
      sortedWeeks.length === 0
        ? '<tr><td colspan="6" class="text-center text-tertiary py-4">Nenhum histórico de recurso encontrado.</td></tr>'
        : sortedWeeks
            .map((weekLabel) =>
              byWeek[weekLabel].resources
                .map((res, i) => {
                  const target = parseFloat(res.target_qty || 0),
                    actual = parseFloat(res.act_reg_qty || 0);
                  const progress =
                    target > 0
                      ? `${((actual / target) * 100).toFixed(2)}%`
                      : "0.00%";
                  const isMain = res.rsrc_id_name === mainResource;
                  return `<tr class="${isMain ? "main-resource-row" : ""}">${
                    i === 0
                      ? `<td rowspan="${byWeek[weekLabel].resources.length}" class="align-top font-semibold">Semana ${weekLabel}</td>`
                      : ""
                  }<td>${res.rsrc_id_name}${
                    isMain ? " ⭐" : ""
                  }</td><td class="text-right">${utils.formatNumberBR(
                    target
                  )}</td><td class="text-right">${utils.formatNumberBR(
                    actual
                  )}</td><td class="text-right">${utils.formatNumberBR(
                    res.remain_qty
                  )}</td><td class="text-right font-medium">${progress}</td></tr>`;
                })
                .join("")
            )
            .join("");

    const trendEndDate = task.act_end_date || task.reend_date;
    const wbsPath = utils.getWbsPathObjects(task.wbs_stable_id_ref, wbsMap);

    let html = `
        <div class="space-y-6">
            <div class="card p-6 bg-secondary">
                <div class="flex justify-between items-start mb-2"><h2 class="text-2xl font-bold text-primary">${
                  task.task_code
                }: ${task.task_name}</h2><span class="badge ${
      statusInfo.class
    }">${statusInfo.text}</span></div>
                ${buildWbsPathHtml(task.wbs_stable_id_ref)}
                <div class="info-grid">
                    <div class="info-item"><span class="info-item-label">Início Planejado</span><span class="info-item-value">${utils.formatBrazilianDate(
                      task.target_start_date
                    )}</span></div>
                    <div class="info-item"><span class="info-item-label">Término Planejado</span><span class="info-item-value">${utils.formatBrazilianDate(
                      task.target_end_date
                    )}</span></div>
                    <div class="info-item"><span class="info-item-label">${
                      task.act_start_date ? "Início Real" : "Início (Tendência)"
                    }</span><span class="info-item-value">${utils.formatBrazilianDate(
      task.act_start_date || task.restart_date
    )}</span></div>
                    <div class="info-item"><span class="info-item-label">${
                      task.act_end_date ? "Término Real" : "Término (Tendência)"
                    }</span><span class="info-item-value">${utils.formatBrazilianDate(
      trendEndDate
    )}</span></div>
                    <div class="info-item"><span class="info-item-label">% Progresso (Cronograma)</span><span class="info-item-value">${utils.formatNumberBR(
                      realProgress
                    )}%</span></div>
                </div>
            </div>
            ${renderGenuineValuesCard(taskCode)}
            ${renderMilestonesCard(taskCode, trendEndDate, wbsPath)}
            ${renderExecutionPlanCard(taskCode)}
            <div class="card p-6 bg-secondary"><h2 class="text-xl font-bold text-primary mb-4">Relacionamentos</h2><div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><h3 class="font-semibold text-secondary mb-2">Predecessoras</h3>${predsTableHtml}</div>
                <div><h3 class="font-semibold text-secondary mb-2">Sucessoras</h3>${succsTableHtml}</div>
            </div></div>
            <div class="card p-6 bg-secondary">
                <h2 class="text-xl font-bold text-primary mb-4">Histórico Semanal de Recursos (Cronograma)</h2>
                <div class="table-container"><table><thead><tr><th>Semana</th><th>Recurso</th><th class="text-right">Qtd. Planejada</th><th class="text-right">Qtd. Real</th><th class="text-right">Qtd. Restante</th><th class="text-right">% Avanço</th></tr></thead><tbody>${weeklyRowsHtml}</tbody></table></div>
            </div>
            ${
              task.status_code !== "TK_NotStart"
                ? `<div class="card p-6 bg-secondary"><h2 class="text-xl font-bold text-primary mb-4">Gráfico de Evolução Material</h2><div class="relative h-96"><canvas id="resourceChart"></canvas></div></div>`
                : ""
            }
        </div>
        `;
    analysisOutput.innerHTML = html;
    renderResourceChart(byWeek, sortedWeeks);
  }

  function renderResourceChart(weeklyData, sortedWeeks) {
    const ctx = document.getElementById("resourceChart")?.getContext("2d");
    if (!ctx) return;

    if (chartInstance) chartInstance.destroy();

    const labels = sortedWeeks.map((w) => `Semana ${w}`);
    const actualData = sortedWeeks.map((w) =>
      weeklyData[w].resources
        .filter((r) => r.rsrc_id_name !== mainResource)
        .reduce((sum, r) => sum + parseFloat(r.act_reg_qty || 0), 0)
    );

    if (labels.length === 0 || actualData.every((d) => d === 0)) {
      ctx.canvas.parentElement.innerHTML =
        '<p class="text-center text-tertiary py-4">Nenhum dado de material para exibir no gráfico.</p>';
      return;
    }

    const isDarkMode = document.documentElement.classList.contains("dark");
    const gridColor = isDarkMode
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(0, 0, 0, 0.1)";
    const labelColor = isDarkMode ? "#9ca3af" : "#475569";
    const titleColor = isDarkMode ? "#e5e7eb" : "#334155";

    const min = Math.min(...actualData),
      max = Math.max(...actualData);
    const buffer = (max - min) * 0.1 || max * 0.1 || 1;

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Qtd. Real de Material",
            data: actualData,
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            fill: true,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: min - buffer < 0 ? 0 : min - buffer,
            max: max + buffer,
            title: {
              display: true,
              text: "Quantidades",
              color: titleColor,
            },
            grid: {
              color: gridColor,
            },
            ticks: {
              color: labelColor,
            },
          },
          x: {
            title: {
              display: true,
              text: "Semanas",
              color: titleColor,
            },
            grid: {
              color: gridColor,
            },
            ticks: {
              color: labelColor,
            },
          },
        },
        plugins: {
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
            titleColor: isDarkMode ? "#f3f4f6" : "#334155",
            bodyColor: isDarkMode ? "#d1d5db" : "#475569",
            borderColor: isDarkMode ? "#4b5563" : "#e2e8f0",
            borderWidth: 1,
          },
          legend: {
            position: "top",
            labels: {
              color: labelColor,
            },
          },
        },
      },
    });
  }

  function displayGroupAnalysis(fullGroupId) {
    const groupId = fullGroupId.replace("group::", "");
    const group = activityMapping.find((g) => g.groupId === groupId);
    if (!group) return;

    const latestVersion = projectVersions[latestVersionId];
    const tasksInGroup = projectBase.TASK.rows.filter((t) =>
      group.taskCodes.includes(t.task_code)
    );
    if (tasksInGroup.length === 0) {
      analysisOutput.innerHTML = renderMessageBox(
        `Nenhuma atividade para o grupo "${group.groupName}" no projeto.`,
        "error"
      );
      return;
    }

    const resourcesInGroup = latestVersion.TASKRSRC.rows.filter((r) =>
      group.taskCodes.includes(r.task_id_code)
    );

    const aggregatedResources = resourcesInGroup.reduce((acc, r) => {
      const name = r.rsrc_id_name;
      if (!acc[name]) acc[name] = { planned: 0, actual: 0, remaining: 0 };
      acc[name].planned += parseFloat(r.target_qty || 0);
      acc[name].actual += parseFloat(r.act_reg_qty || 0);
      acc[name].remaining += parseFloat(r.remain_qty || 0);
      return acc;
    }, {});

    const aggregatedDates = {
      target_start_date: tasksInGroup
        .map((t) => t.target_start_date)
        .filter(Boolean)
        .sort()[0],
      target_end_date: tasksInGroup
        .map((t) => t.target_end_date)
        .filter(Boolean)
        .sort()
        .pop(),
      act_start_date: tasksInGroup
        .map((t) => t.act_start_date)
        .filter(Boolean)
        .sort()[0],
      aggr_end_date: tasksInGroup.every((t) => t.act_end_date)
        ? tasksInGroup
            .map((t) => t.act_end_date)
            .filter(Boolean)
            .sort()
            .pop()
        : tasksInGroup
            .map((t) => t.reend_date || t.target_end_date)
            .filter(Boolean)
            .sort()
            .pop(),
    };
    const aggregatedEndDateLabel = tasksInGroup.every((t) => t.act_end_date)
      ? "Término Real (Agregado)"
      : "Término (Tendência Agregada)";

    let resourcesHtml = Object.keys(aggregatedResources)
      .sort()
      .map((rsrcName) => {
        const r = aggregatedResources[rsrcName];
        const progress = r.planned > 0 ? (r.actual / r.planned) * 100 : 0;
        const isMain = rsrcName === mainResource;
        return `<tr class="${
          isMain ? "main-resource-row" : ""
        }"><td class="text-primary">${rsrcName}${
          isMain ? " ⭐" : ""
        }</td><td class="text-right">${utils.formatNumberBR(
          r.planned
        )}</td><td class="text-right">${utils.formatNumberBR(
          r.actual
        )}</td><td class="text-right">${utils.formatNumberBR(
          r.remaining
        )}</td><td class="text-right font-medium">${utils.formatNumberBR(
          progress
        )}%</td></tr>`;
      })
      .join("");

    // For groups, find the WBS path of the first task as representative
    const representativeWbsPath =
      tasksInGroup.length > 0
        ? utils.getWbsPathObjects(tasksInGroup[0].wbs_stable_id_ref, wbsMap)
        : [];

    const memberTasksRows = tasksInGroup
      .sort((a, b) => a.task_code.localeCompare(b.task_code))
      .map((task) => ({
        Código: `<span class="font-mono text-sm">${task.task_code}</span>`,
        "Nome da Atividade": task.task_name,
      }));

    const memberTasksTableHtml = renderHTMLTable(
      ["Código", "Nome da Atividade"],
      memberTasksRows
    );

    const membersCardHtml = `
      <div class="card p-6 bg-secondary">
        <h2 class="text-xl font-bold text-primary mb-4">Atividades do Grupo (${tasksInGroup.length})</h2>
        <div class="max-h-72 overflow-y-auto">
          ${memberTasksTableHtml}
        </div>
      </div>
    `;

    let html = `
      <div class="space-y-6">
          <div class="card p-6 bg-secondary">
              <div class="flex justify-between items-start mb-4"><h2 class="text-2xl font-bold text-primary">${
                group.groupName
              }</h2><span class="badge status-group">Grupo de Atividades</span></div>
              <div class="info-grid">
                   <div class="info-item"><span class="info-item-label">Início Planejado (Agregado)</span><span class="info-item-value">${utils.formatBrazilianDate(
                     aggregatedDates.target_start_date
                   )}</span></div>
                   <div class="info-item"><span class="info-item-label">Término Planejado (Agregado)</span><span class="info-item-value">${utils.formatBrazilianDate(
                     aggregatedDates.target_end_date
                   )}</span></div>
                   <div class="info-item"><span class="info-item-label">Início Real (Agregado)</span><span class="info-item-value">${utils.formatBrazilianDate(
                     aggregatedDates.act_start_date
                   )}</span></div>
                   <div class="info-item"><span class="info-item-label">${aggregatedEndDateLabel}</span><span class="info-item-value">${utils.formatBrazilianDate(
      aggregatedDates.aggr_end_date
    )}</span></div>
              </div>
          </div>
          ${membersCardHtml}
          ${renderGenuineValuesCard(fullGroupId)}
          ${renderMilestonesCard(
            fullGroupId,
            aggregatedDates.aggr_end_date,
            representativeWbsPath
          )}
          ${renderExecutionPlanCard(fullGroupId)}
          <div class="card p-6 bg-secondary">
              <h2 class="text-xl font-bold text-primary mb-4">Recursos Agregados (Cronograma)</h2>
              <div class="table-container">
                  <table>
                      <thead><tr><th>Recurso</th><th class="text-right">Qtd. Planejada</th><th class="text-right">Qtd. Real</th><th class="text-right">Qtd. Restante</th><th class="text-right">% Avanço</th></tr></thead>
                      <tbody>${resourcesHtml}</tbody>
                  </table>
              </div>
          </div>
      </div>
    `;
    analysisOutput.innerHTML = html;
  }
})();
