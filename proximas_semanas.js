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

const dashboardOutput = document.getElementById("dashboard-output");
const pageSubtitle = document.getElementById("page-subtitle");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const indicatorsContainer = document.getElementById("week-indicators");
const filterControls = document.getElementById("filter-controls");

const modal = document.getElementById("restriction-modal");
const modalContent = modal.querySelector(".modal-content");
const modalItemName = document.getElementById("modal-item-name");
const modalBody = document.getElementById("modal-body");
const modalCloseBtn = document.getElementById("modal-close-btn");

let fullTaskList = [],
  weeksData = [],
  upcomingWeeks = [],
  wbsHierarchy = [],
  wbsMap = new Map(),
  activityMapping = [],
  activityStageMap = new Map(),
  customValuesData = new Map(),
  restrictionsList = [],
  restrictionLinks = [];
let currentWeekIndex = 0;
let groupedByWeek = {};
let currentFilter = "all";
let currentOpenItemId = null;
let projectName = "Projeto";
let activeTomSelect = null;
let lastFocusedElement = null; // For accessibility

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

(async () => {
  try {
    const projectBase = await storage.getProjectBase();
    const projectVersions = await storage.getProjectVersions();

    [weeksData, activityMapping, restrictionsList, restrictionLinks] =
      await Promise.all([
        storage.getData(storage.APP_KEYS.WEEKS_DATA_KEY),
        storage.getData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY),
        storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
        storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
      ]);

    const customValuesRaw = await storage.getData(
      storage.APP_KEYS.CUSTOM_VALUES_KEY
    );
    customValuesData = new Map(customValuesRaw.map((item) => [item.id, item]));

    if (!projectBase || Object.keys(projectBase).length === 0) {
      dashboardOutput.innerHTML = `<div class="message-box col-span-full">Nenhum projeto base encontrado. Faça o upload de um arquivo .xer.</div>`;
      return;
    }
    if (Object.keys(projectVersions).length === 0) {
      dashboardOutput.innerHTML = `<div class="message-box col-span-full">Nenhuma versão de projeto encontrada. Faça o upload de um arquivo .xer.</div>`;
      return;
    }
    if (weeksData.length === 0) {
      dashboardOutput.innerHTML = `<div class="message-box col-span-full">Nenhum mapeamento de semanas encontrado.</div>`;
      return;
    }

    const latestVersionId = utils.getLatestProjectId(projectVersions);
    const latestVersion = projectVersions[latestVersionId];
    projectName = latestVersion?.PROJECT?.rows[0]?.proj_name || "Projeto";

    fullTaskList = projectBase.TASK?.rows || [];
    wbsHierarchy = projectBase.WBS_HIERARCHY?.rows || [];
    wbsMap = new Map(wbsHierarchy.map((w) => [w.stable_wbs_id, w]));

    const currentWeek = utils.getWeekForDate(new Date(), weeksData);
    if (currentWeek === null) {
      dashboardOutput.innerHTML = `<div class="message-box">Data atual fora do mapeamento.</div>`;
      return;
    }

    upcomingWeeks = Array.from({ length: 6 }, (_, i) => currentWeek + 1 + i);

    fullTaskList.forEach(
      (task) =>
        (task.wbsPath = utils.getWbsPathObjects(task.wbs_stable_id_ref, wbsMap))
    );
    activityMapping.forEach((group) => {
      const tasksInGroup = group.taskCodes
        .map((code) => fullTaskList.find((t) => t.task_code === code))
        .filter(Boolean);
      tasksInGroup.sort((a, b) => {
        const dateA = a.target_start_date
          ? new Date(a.target_start_date.replace(" ", "T"))
          : new Date("9999-12-31");
        const dateB = b.target_start_date
          ? new Date(b.target_start_date.replace(" ", "T"))
          : new Date("9999-12-31");
        return dateA - dateB;
      });
      tasksInGroup.forEach((task, index) => {
        activityStageMap.set(task.task_code, {
          groupName: group.groupName,
          stage: index + 1,
          totalStages: tasksInGroup.length,
        });
      });
    });

    await renderCurrentWeekView();
    setupNavigation();
    setupModal();
  } catch (e) {
    console.error(e);
    dashboardOutput.innerHTML = `<div class="message-box" role="alert" style="color: #b91c1c;">Erro: ${e.message}</div>`;
  }
})();

async function processAndCacheWeekData(weekNumber) {
  if (groupedByWeek[weekNumber]) return;

  let groupingLevels = await storage.getData(
    storage.APP_KEYS.WEEKS_VIEW_GROUPING_KEY
  );
  const hiddenActivities = await storage.getData(
    storage.APP_KEYS.WEEKS_VIEW_HIDDEN_ACTIVITIES_KEY
  );

  if (!groupingLevels || groupingLevels.length === 0) {
    const maxLevel = Math.max(
      0,
      ...wbsHierarchy.map((w) => parseInt(w.level, 10))
    );
    groupingLevels = Array.from({ length: maxLevel }, (_, i) => i + 1);
  }

  groupedByWeek[weekNumber] = {};

  const tasksToProcess = fullTaskList.filter((task) => {
    if (
      task.status_code === "TK_Complete" ||
      hiddenActivities.includes(task.task_code)
    )
      return false;

    const startDateStr = task.act_start_date || task.restart_date;
    const endDateStr = task.reend_date || task.target_end_date;
    if (!startDateStr || !endDateStr) return false;

    const startWeek = utils.getWeekForDate(
      startDateStr.replace(" ", "T"),
      weeksData
    );
    const endWeek = utils.getWeekForDate(
      endDateStr.replace(" ", "T"),
      weeksData
    );
    if (startWeek === null || endWeek === null || endWeek < startWeek)
      return false;

    return weekNumber >= startWeek && weekNumber <= endWeek;
  });

  tasksToProcess.forEach((task) => {
    const startDate = new Date(
      (task.act_start_date || task.restart_date).replace(" ", "T")
    );
    const endDate = new Date(
      (task.reend_date || task.target_end_date).replace(" ", "T")
    );
    const startWeek = utils.getWeekForDate(startDate, weeksData);
    const endWeek = utils.getWeekForDate(endDate, weeksData);

    let tag = startWeek === weekNumber ? "Início" : "";
    if (endWeek === weekNumber) tag = tag ? "Início e Fim" : "Fim";

    const groupName = activityStageMap.get(task.task_code)?.groupName;
    const item = groupName
      ? { type: "group", groupName, task: { ...task, tag } }
      : { type: "task", task: { ...task, tag } };

    buildGroupedTreeRecursive(item, groupingLevels, groupedByWeek[weekNumber]);
  });
}

function buildGroupedTreeRecursive(item, levels, currentTree) {
  const { type, task, groupName } = item;
  const [currentLevelToGroup, ...remainingLevels] = levels;
  if (!currentLevelToGroup) return;
  const wbsNodeAtLevel = task.wbsPath.find(
    (p) => p.level == currentLevelToGroup
  );
  if (!wbsNodeAtLevel) {
    const closestParentNode =
      task.wbsPath.length > 0
        ? task.wbsPath[task.wbsPath.length - 1]
        : { wbs_name: "(Sem WBS)", stable_wbs_id: "(Sem WBS)" };
    const groupKey = closestParentNode.stable_wbs_id;
    if (!currentTree[groupKey])
      currentTree[groupKey] = {
        data: closestParentNode,
        children: {},
        items: new Map(),
      };
    const itemKey = type === "group" ? groupName : task.task_code;
    if (!currentTree[groupKey].items.has(itemKey))
      currentTree[groupKey].items.set(itemKey, {
        type,
        data: type === "group" ? { groupName } : task,
        relatedTasks: [],
      });
    currentTree[groupKey].items.get(itemKey).relatedTasks.push(task);
    return;
  }
  const groupKey = wbsNodeAtLevel.stable_wbs_id;
  if (!currentTree[groupKey])
    currentTree[groupKey] = {
      data: wbsNodeAtLevel,
      children: {},
      items: new Map(),
    };
  if (remainingLevels.length === 0) {
    const itemKey = type === "group" ? groupName : task.task_code;
    if (!currentTree[groupKey].items.has(itemKey))
      currentTree[groupKey].items.set(itemKey, {
        type,
        data: type === "group" ? { groupName } : task,
        relatedTasks: [],
      });
    currentTree[groupKey].items.get(itemKey).relatedTasks.push(task);
  } else {
    buildGroupedTreeRecursive(
      item,
      remainingLevels,
      currentTree[groupKey].children
    );
  }
}

function itemMatchesFilter(item) {
  if (currentFilter === "all") return true;
  if (item.type === "group") {
    return item.relatedTasks.some((task) => {
      const tag = task.tag || "";
      if (currentFilter === "start") return tag.includes("Início");
      if (currentFilter === "end") return tag.includes("Fim");
      if (currentFilter === "ongoing") return tag === "";
      return false;
    });
  }
  const tag = item.relatedTasks[0].tag || "";
  if (currentFilter === "start") return tag.includes("Início");
  if (currentFilter === "end") return tag.includes("Fim");
  if (currentFilter === "ongoing") return tag === "";
  return false;
}

function renderWeekSkeleton() {
  dashboardOutput.innerHTML = `
        <div class="week-card" aria-live="polite" aria-busy="true">
             <div class="sr-only">Carregando dados da semana.</div>
            <div class="week-card-header">
                <div>
                    <div class="skeleton skeleton-title" style="width: 250px;"></div>
                    <div class="skeleton skeleton-text" style="width: 200px;"></div>
                </div>
                <div class="skeleton skeleton-block" style="width: 120px; height: 38px;"></div>
            </div>
            <div class="mt-4">
                <div class="skeleton skeleton-block wbs-title" style="height: 38px;"></div>
                <div class="wbs-group">
                    <div class="skeleton skeleton-block wbs-title mt-4" style="height: 38px;"></div>
                    <div class="skeleton skeleton-block mt-2" style="height: 60px;"></div>
                    <div class="skeleton skeleton-block mt-2" style="height: 60px;"></div>
                </div>
                <div class="skeleton skeleton-block wbs-title mt-4" style="height: 38px;"></div>
            </div>
        </div>`;
}

async function renderCurrentWeekView() {
  const weekNumber = upcomingWeeks[currentWeekIndex];
  if (!groupedByWeek[weekNumber]) {
    renderWeekSkeleton();
    await processAndCacheWeekData(weekNumber);
  }

  const weekTree = { children: groupedByWeek[weekNumber] || {} };
  const weekInfo = weeksData.find((w) => parseInt(w.Semana, 10) === weekNumber);
  const dateRange = weekInfo
    ? `${utils.formatBrazilianDate(
        weekInfo.Data_Inicio
      )} - ${utils.formatBrazilianDate(weekInfo.Data_Fim)}`
    : "";

  let hasContent = false;
  const linkedRestrictionIds = new Set(restrictionLinks.map((l) => l.itemId));
  const pendingRestrictionsCount = restrictionLinks.reduce((acc, link) => {
    const restr = restrictionsList.find((r) => r.id === link.restrictionId);
    if (restr && restr.status === "pending") {
      if (!acc[link.itemId]) acc[link.itemId] = 0;
      acc[link.itemId]++;
    }
    return acc;
  }, {});

  const renderNode = (node) => {
    let html = "";
    const sortedChildrenKeys = Object.keys(node.children).sort((a, b) =>
      node.children[a].data.wbs_name.localeCompare(
        node.children[b].data.wbs_name
      )
    );

    sortedChildrenKeys.forEach((key) => {
      const childNode = node.children[key];
      const filteredItems = Array.from(childNode.items.values()).filter(
        itemMatchesFilter
      );
      const childrenHtml = renderNode(childNode);
      if (filteredItems.length === 0 && childrenHtml === "") return;

      const contentId = `wbs-content-${key.replace(/[^a-zA-Z0-9]/g, "-")}`;
      const titleId = `wbs-title-${key.replace(/[^a-zA-Z0-9]/g, "-")}`;

      html += `<div class="wbs-group">
        <button id="${titleId}" class="wbs-title" aria-expanded="false" aria-controls="${contentId}">
            <span class="text-primary">${childNode.data.wbs_name}</span>
            <span class="wbs-toggle" aria-hidden="true">+</span>
        </button>
        <div id="${contentId}" class="wbs-content" role="region" aria-labelledby="${titleId}">`;

      if (filteredItems.length > 0) {
        html += '<div class="item-list">';
        filteredItems.forEach((item) => {
          hasContent = true;
          let tagHtml = "";
          let tooltipHtml = "";

          const itemId =
            item.type === "group"
              ? `group::${item.data.groupName}`
              : item.relatedTasks[0].task_code;
          const itemName =
            item.type === "group"
              ? item.data.groupName
              : `${item.relatedTasks[0].task_code}: ${item.relatedTasks[0].task_name}`;

          const pendingCount = pendingRestrictionsCount[itemId] || 0;
          let restrictionBadge =
            pendingCount > 0
              ? `<span class="restriction-badge" title="${pendingCount} restrições pendentes">🚩 ${pendingCount}</span>`
              : "";

          let itemEntryClass = "item-entry";

          if (item.type === "group") {
            const { groupName, totalStages } = activityStageMap.get(
              item.relatedTasks[0].task_code
            );
            const groupId = `group::${groupName}`;
            const customValue = customValuesData.get(groupId);
            if (customValue) {
              const remaining =
                (customValue.planned || 0) - (customValue.actual || 0);
              tooltipHtml = `data-tooltip="Saldo Topográfico: ${utils.formatNumberBR(
                remaining
              )}"`;
              itemEntryClass += " tooltip has-tooltip";
            }

            const startsInWeek = item.relatedTasks.some((t) =>
              t.tag.includes("Início")
            );
            const endsInWeek = item.relatedTasks.some((t) =>
              t.tag.includes("Fim")
            );
            if (startsInWeek)
              tagHtml += `<span class="tag tag-start">Início</span>`;
            if (endsInWeek) tagHtml += `<span class="tag tag-end">Fim</span>`;

            const stagesInWeek = item.relatedTasks
              .map((t) => activityStageMap.get(t.task_code).stage)
              .sort((a, b) => a - b);
            const stageText =
              stagesInWeek.length > 1
                ? `Etapas ${stagesInWeek.join(", ")}`
                : `Etapa ${stagesInWeek[0]}`;
            html += `<div role="button" tabindex="0" class="${itemEntryClass}" ${tooltipHtml} data-item-id="${itemId}" data-item-name="${itemName}"><div class="flex justify-between items-center"><p class="font-semibold text-primary">${groupName}</p><div>${restrictionBadge}${tagHtml}</div></div><p class="text-sm text-tertiary italic">${stageText} de ${totalStages}</p></div>`;
          } else {
            const task = item.relatedTasks[0];
            const customValue = customValuesData.get(task.task_code);

            if (customValue) {
              const remaining =
                (customValue.planned || 0) - (customValue.actual || 0);
              tooltipHtml = `data-tooltip="Saldo Topográfico: ${utils.formatNumberBR(
                remaining
              )}"`;
              itemEntryClass += " tooltip has-tooltip";
            }

            if (task.tag.includes("Início"))
              tagHtml += `<span class="tag tag-start">Início</span>`;
            if (task.tag.includes("Fim"))
              tagHtml += `<span class="tag tag-end">Fim</span>`;
            html += `<div role="button" tabindex="0" class="${itemEntryClass}" ${tooltipHtml} data-item-id="${itemId}" data-item-name="${itemName}"><div class="flex justify-between items-center"><p class="font-semibold text-primary">${task.task_code}</p><div>${restrictionBadge}${tagHtml}</div></div><p class="text-sm text-secondary">${task.task_name}</p></div>`;
          }
        });
        html += "</div>";
      }
      html += childrenHtml;
      html += `</div></div>`;
    });
    return html;
  };

  let weekContent = renderNode(weekTree);
  if (!hasContent) {
    weekContent = `<p class="text-lg text-tertiary italic py-20 text-center">Nenhuma atividade para o filtro "${currentFilter}" nesta semana.</p>`;
  }

  dashboardOutput.innerHTML = `
            <div class="week-card" aria-live="polite" aria-busy="false">
              <div class="week-card-header">
                  <div>
                    <h3 class="text-2xl font-bold text-primary">
                        <span>Semana ${weekNumber}</span> 
                        <span class="text-xl font-normal text-tertiary">(${
                          currentWeekIndex + 1
                        }ª de 6)</span>
                    </h3>
                    <p class="text-base font-normal text-tertiary mt-1">${dateRange}</p>
                  </div>
                  <button id="toggle-all-btn" data-state="collapsed" class="text-sm p-2 rounded-md toggle-all-button">Expandir Tudo</button>
              </div>
              ${weekContent}
            </div>`;

  document.querySelectorAll(".wbs-content").forEach((content) => {
    content.style.maxHeight = "0px";
  });

  // Set initial tabindex state for accessibility
  dashboardOutput.querySelectorAll(".wbs-title, .item-entry").forEach((el) => {
    // Check if the element is a direct child of the main content area (week-card)
    const isTopLevel =
      el.parentElement.closest(".week-card") === el.parentElement.parentElement;
    if (el.classList.contains("wbs-title") && isTopLevel) {
      el.setAttribute("tabindex", "0");
    } else {
      el.setAttribute("tabindex", "-1");
    }
  });

  document
    .getElementById("toggle-all-btn")
    ?.addEventListener("click", toggleAllWbs);
  updateNavigation();
}

function toggleWbsContent(titleButton) {
  const content = titleButton.nextElementSibling;
  const icon = titleButton.querySelector(".wbs-toggle");
  if (!content || !content.classList.contains("wbs-content")) return;

  const isExpanded = titleButton.getAttribute("aria-expanded") === "true";

  if (isExpanded) {
    // COLLAPSING
    content.style.maxHeight = content.scrollHeight + "px";
    requestAnimationFrame(() => {
      titleButton.setAttribute("aria-expanded", "false");
      content.style.maxHeight = "0px";
      if (icon) icon.textContent = "+";
      // Disable all focusable descendants
      const focusableDescendants = content.querySelectorAll(
        ".item-entry, .wbs-title"
      );
      focusableDescendants.forEach((item) =>
        item.setAttribute("tabindex", "-1")
      );
    });
  } else {
    // EXPANDING
    titleButton.setAttribute("aria-expanded", "true");
    if (icon) icon.textContent = "-";
    content.style.maxHeight = content.scrollHeight + "px";
    // Enable only direct children
    const directItemEntries = content.querySelectorAll(
      ":scope > .item-list > .item-entry"
    );
    directItemEntries.forEach((item) => item.setAttribute("tabindex", "0"));
    const directWbsTitles = content.querySelectorAll(
      ":scope > .wbs-group > .wbs-title"
    );
    directWbsTitles.forEach((item) => item.setAttribute("tabindex", "0"));
  }
}

function toggleAllWbs(event) {
  const btn = event.target;
  const isExpanding = btn.dataset.state === "collapsed";

  const allTitleButtons = Array.from(
    dashboardOutput.querySelectorAll(".wbs-title")
  );

  allTitleButtons.forEach((button) => {
    const shouldBeExpanded = isExpanding;
    const isCurrentlyExpanded = button.getAttribute("aria-expanded") === "true";
    if (shouldBeExpanded !== isCurrentlyExpanded) {
      toggleWbsContent(button);
    }
  });

  btn.dataset.state = isExpanding ? "expanded" : "collapsed";
  btn.textContent = isExpanding ? "Minimizar Tudo" : "Expandir Tudo";
}

function setupNavigation() {
  prevBtn.setAttribute("aria-label", "Semana anterior");
  nextBtn.setAttribute("aria-label", "Próxima semana");

  prevBtn.addEventListener("click", () => {
    if (currentWeekIndex > 0) {
      currentWeekIndex--;
      renderCurrentWeekView();
    }
  });
  nextBtn.addEventListener("click", () => {
    if (currentWeekIndex < upcomingWeeks.length - 1) {
      currentWeekIndex++;
      renderCurrentWeekView();
    }
  });

  indicatorsContainer.innerHTML = upcomingWeeks
    .map(
      (_, i) =>
        `<button class="indicator-dot" data-index="${i}" aria-label="Ir para semana ${upcomingWeeks[i]}"></button>`
    )
    .join("");
  indicatorsContainer.querySelectorAll(".indicator-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      currentWeekIndex = parseInt(dot.dataset.index);
      renderCurrentWeekView();
    });
  });

  dashboardOutput.addEventListener("click", (e) => {
    const toggleTitle = e.target.closest(".wbs-title");
    if (toggleTitle) {
      toggleWbsContent(toggleTitle);
    }

    const itemEntry = e.target.closest(".item-entry[data-item-id]");
    if (itemEntry) {
      openRestrictionsModal(
        itemEntry.dataset.itemId,
        itemEntry.dataset.itemName
      );
    }
  });

  dashboardOutput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const itemEntry = e.target.closest(".item-entry[data-item-id]");
      if (itemEntry) {
        e.preventDefault();
        openRestrictionsModal(
          itemEntry.dataset.itemId,
          itemEntry.dataset.itemName
        );
      }
    }
  });

  dashboardOutput.addEventListener("transitionend", (e) => {
    const content = e.target;
    if (
      !content.classList.contains("wbs-content") ||
      e.propertyName !== "max-height"
    )
      return;
    const parent = content.parentElement.closest(
      ".wbs-content[aria-expanded='true']"
    );
    if (parent) parent.style.maxHeight = parent.scrollHeight + "px";
    if (content.style.maxHeight !== "0px") content.style.maxHeight = "none";
  });

  filterControls.addEventListener("click", (e) => {
    if (e.target.matches(".filter-btn")) {
      filterControls.querySelector(".active").classList.remove("active");
      e.target.classList.add("active");
      currentFilter = e.target.dataset.filter;
      renderCurrentWeekView();
    }
  });
}

function updateNavigation() {
  prevBtn.disabled = currentWeekIndex === 0;
  nextBtn.disabled = currentWeekIndex === upcomingWeeks.length - 1;

  indicatorsContainer
    .querySelectorAll(".indicator-dot")
    .forEach((dot, index) => {
      dot.classList.toggle("active", index === currentWeekIndex);
      dot.setAttribute("aria-pressed", index === currentWeekIndex);
    });
}

// --- Restriction Modal Functions ---
function setupModal() {
  modalCloseBtn.setAttribute("aria-label", "Fechar modal de restrições");
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  modalCloseBtn.addEventListener("click", closeModal);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      closeModal();
    }
    handleFocusTrap(e);
  });
}

function handleFocusTrap(e) {
  if (e.key !== "Tab" || !modal.classList.contains("active")) return;

  const focusableElements = Array.from(
    modalContent.querySelectorAll(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(
    (el) =>
      el.offsetWidth > 0 ||
      el.offsetHeight > 0 ||
      el.classList.contains("ts-control")
  );

  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (e.shiftKey) {
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

function openRestrictionsModal(itemId, itemName) {
  lastFocusedElement = document.activeElement;
  currentOpenItemId = itemId;
  modalItemName.textContent = itemName;

  modalContent.setAttribute("role", "dialog");
  modalContent.setAttribute("aria-modal", "true");
  modalContent.setAttribute("aria-labelledby", "modal-item-name");
  modal.classList.add("active");

  renderModalContent();
}

function closeModal() {
  currentOpenItemId = null;
  if (activeTomSelect) {
    activeTomSelect.destroy();
    activeTomSelect = null;
  }
  modal.classList.remove("active");
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

function renderModalContent() {
  if (!currentOpenItemId) return;

  const linkedIds = new Set(
    restrictionLinks
      .filter((l) => l.itemId === currentOpenItemId)
      .map((l) => l.restrictionId)
  );
  const linkedRestrictions = restrictionsList.filter((r) =>
    linkedIds.has(r.id)
  );
  const pending = linkedRestrictions
    .filter((r) => r.status === "pending")
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  const resolved = linkedRestrictions
    .filter((r) => r.status === "resolved")
    .sort((a, b) => new Date(b.due) - new Date(a.due));

  const renderList = (list) => {
    if (list.length === 0)
      return '<p class="text-tertiary italic text-center py-4">Nenhuma.</p>';
    return list
      .map(
        (r) => `
                <div class="restriction-item status-${
                  r.status
                }" data-restr-id="${r.id}">
                    <div class="flex-grow">
                        <p class="font-medium text-primary">${r.desc}</p>
                        <p class="text-sm text-tertiary mt-1">
                            <span class="font-semibold">Resp:</span> ${
                              r.resp
                            } | 
                            <span class="font-semibold">Prazo:</span> ${utils.formatBrazilianDate(
                              r.due
                            )}
                        </p>
                    </div>
                    <div class="restriction-actions">
                        <button class="action-btn toggle-status-btn">
                            ${r.status === "pending" ? "Resolver" : "Reabrir"}
                        </button>
                        <button class="action-btn unlink-btn text-yellow-600">Desvincular</button>
                    </div>
                </div>`
      )
      .join("");
  };

  const unlinkedRestrictions = restrictionsList.filter(
    (r) => !linkedIds.has(r.id) && r.status === "pending"
  );
  const unlinkedOptions = unlinkedRestrictions
    .map((r) => `<option value="${r.id}">${r.desc}</option>`)
    .join("");

  modalBody.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
                <div class="space-y-6">
                    <div>
                        <h3 class="text-lg font-semibold text-primary mb-2">Vincular Restrição Existente</h3>
                        ${
                          unlinkedOptions.length > 0
                            ? `
                        <form id="link-restriction-form" class="flex items-end gap-2">
                            <div class="flex-grow">
                                <label for="restr-select" class="form-label">Restrições Pendentes</label>
                                <select id="restr-select">${unlinkedOptions}</select>
                            </div>
                            <button type="submit" class="bg-yellow-500 text-white font-semibold py-2 px-4 rounded-md hover:bg-yellow-600 h-10">Vincular</button>
                        </form>`
                            : `<p class="text-sm text-tertiary italic">Nenhuma outra restrição pendente para vincular.</p>`
                        }
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold text-primary mb-2">Adicionar Nova Restrição</h3>
                        <form id="add-restriction-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                            <div class="sm:col-span-2">
                                <label for="restr-desc" class="form-label">Descrição</label>
                                <input type="text" id="restr-desc" class="form-input" required>
                            </div>
                            <div>
                                <label for="restr-resp" class="form-label">Responsável</label>
                                <input type="text" id="restr-resp" class="form-input" required>
                            </div>
                            <div>
                                <label for="restr-due" class="form-label">Prazo</label>
                                <input type="date" id="restr-due" class="form-input" required>
                            </div>
                            <div class="sm:col-span-2">
                                <button type="submit" class="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700">Adicionar e Vincular</button>
                            </div>
                        </form>
                    </div>
                </div>
                <div class="space-y-6 mt-6 lg:mt-0">
                     <div>
                        <h3 class="text-lg font-semibold text-primary mb-2">Pendentes</h3>
                        <div id="pending-list" class="space-y-2">${renderList(
                          pending
                        )}</div>
                    </div>
                     <div>
                        <h3 class="text-lg font-semibold text-primary mb-2">Resolvidas</h3>
                        <div id="resolved-list" class="space-y-2">${renderList(
                          resolved
                        )}</div>
                    </div>
                </div>
            </div>`;

  if (unlinkedOptions.length > 0 && !activeTomSelect) {
    activeTomSelect = new TomSelect("#restr-select", {
      placeholder: "Selecione...",
    });
  }

  document
    .getElementById("add-restriction-form")
    .addEventListener("submit", handleSaveRestriction);
  if (document.getElementById("link-restriction-form")) {
    document
      .getElementById("link-restriction-form")
      .addEventListener("submit", handleLinkRestriction);
  }
  modalBody.addEventListener("click", handleModalActions);

  // Set initial focus for accessibility inside a timeout to ensure elements are rendered
  setTimeout(() => {
    // Try to focus the TomSelect first if it exists
    if (activeTomSelect) {
      activeTomSelect.focus();
    } else {
      // Otherwise, focus the description input
      const descInput = document.getElementById("restr-desc");
      if (descInput) {
        descInput.focus();
      } else {
        // As a final fallback, focus the close button.
        modalCloseBtn.focus();
      }
    }
  }, 100); // A small delay to ensure the modal is fully rendered.
}

function handleModalActions(e) {
  const restrictionItem = e.target.closest(".restriction-item");
  if (!restrictionItem) return;
  const restrictionId = restrictionItem.dataset.restrId;

  if (e.target.classList.contains("toggle-status-btn")) {
    toggleRestrictionStatus(restrictionId);
  } else if (e.target.classList.contains("unlink-btn")) {
    unlinkRestriction(restrictionId);
  }
}

async function handleSaveRestriction(e) {
  e.preventDefault();
  const desc = document.getElementById("restr-desc").value;
  const resp = document.getElementById("restr-resp").value;
  const due = document.getElementById("restr-due").value;

  if (!desc || !resp || !due) return;

  const newRestriction = {
    id: uuidv4(),
    desc,
    resp,
    due,
    status: "pending",
  };
  restrictionsList.push(newRestriction);
  restrictionLinks.push({
    restrictionId: newRestriction.id,
    itemId: currentOpenItemId,
  });

  await Promise.all([
    storage.saveData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY, restrictionsList),
    storage.saveData(storage.APP_KEYS.RESTRICTION_LINKS_KEY, restrictionLinks),
  ]);

  e.target.reset();
  if (activeTomSelect) {
    activeTomSelect.destroy();
    activeTomSelect = null;
  }
  renderModalContent();
  renderCurrentWeekView();
}

async function handleLinkRestriction(e) {
  e.preventDefault();
  const selectedId = activeTomSelect.getValue();
  if (!selectedId) return;

  restrictionLinks.push({
    restrictionId: selectedId,
    itemId: currentOpenItemId,
  });
  await storage.saveData(
    storage.APP_KEYS.RESTRICTION_LINKS_KEY,
    restrictionLinks
  );

  activeTomSelect.destroy();
  activeTomSelect = null;
  renderModalContent();
  renderCurrentWeekView();
}

async function toggleRestrictionStatus(restrictionId) {
  const restriction = restrictionsList.find((r) => r.id === restrictionId);
  if (restriction) {
    restriction.status =
      restriction.status === "pending" ? "resolved" : "pending";
    await storage.saveData(
      storage.APP_KEYS.RESTRICTIONS_LIST_KEY,
      restrictionsList
    );
    renderModalContent();
    renderCurrentWeekView();
  }
}

async function unlinkRestriction(restrictionId) {
  if (
    confirm(
      "Tem certeza que deseja desvincular esta restrição desta atividade? A restrição não será excluída."
    )
  ) {
    restrictionLinks = restrictionLinks.filter(
      (l) =>
        !(l.itemId === currentOpenItemId && l.restrictionId === restrictionId)
    );
    await storage.saveData(
      storage.APP_KEYS.RESTRICTION_LINKS_KEY,
      restrictionLinks
    );
    if (activeTomSelect) {
      activeTomSelect.destroy();
      activeTomSelect = null;
    }
    renderModalContent();
    renderCurrentWeekView();
  }
}
