import {
  initializationError,
  showFirebaseError,
  storage as firebaseStorage, // Alias to avoid name collision with app's storage module
} from "./firebase-config.js";
import * as utils from "./utils.js";
import {
  ref,
  uploadBytes,
  getDownloadURL,
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
utils.insertHeader();

const dashboardOutput = document.getElementById("dashboard-output");
const pageSubtitle = document.getElementById("page-subtitle");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const indicatorsContainer = document.getElementById("week-indicators");
const filterControls = document.getElementById("filter-controls");
const restrictionFilterControls = document.getElementById(
  "restriction-filter-controls"
);

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
  restrictionLinks = [],
  itemRestrictionInfoMap = new Map(),
  activityMediaMap = new Map();
let currentWeekIndex = 0;
let groupedByWeek = {};
let currentFilter = "all";
let currentRestrictionFilter = "all";
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

    const activityMedia = await storage.getActivityMedia();
    activityMediaMap = new Map(
      activityMedia.map((item) => [
        item.id,
        { imageUrl: item.imageUrl, storagePath: item.storagePath },
      ])
    );

    if (!projectBase || Object.keys(projectBase).length === 0) {
      dashboardOutput.innerHTML = `<div class="message-box col-span-full">Nenhum projeto base encontrado. Faça o upload de um arquivo .xer.</div>`;
      filterControls.innerHTML = "";
      indicatorsContainer.innerHTML = "";
      return;
    }
    if (Object.keys(projectVersions).length === 0) {
      dashboardOutput.innerHTML = `<div class="message-box col-span-full">Nenhuma versão de projeto encontrada. Faça o upload de um arquivo .xer.</div>`;
      filterControls.innerHTML = "";
      indicatorsContainer.innerHTML = "";
      return;
    }
    if (weeksData.length === 0) {
      dashboardOutput.innerHTML = `<div class="message-box col-span-full">Nenhum mapeamento de semanas encontrado.</div>`;
      filterControls.innerHTML = "";
      indicatorsContainer.innerHTML = "";
      return;
    }

    const latestVersionId = utils.getLatestProjectId(projectVersions);
    const latestVersion = projectVersions[latestVersionId];
    projectName = latestVersion?.PROJECT?.rows[0]?.proj_name || "Projeto";

    fullTaskList = projectBase.TASK?.rows || [];
    wbsHierarchy = projectBase.WBS_HIERARCHY?.rows || [];
    wbsMap = new Map(wbsHierarchy.map((w) => [w.stable_wbs_id, w]));

    // Pre-process restriction information for performance
    restrictionLinks.forEach((link) => {
      const restriction = restrictionsList.find(
        (r) => r.id === link.restrictionId
      );
      if (!restriction) return;

      if (!itemRestrictionInfoMap.has(link.itemId)) {
        itemRestrictionInfoMap.set(link.itemId, {
          hasPending: false,
          pendingCount: 0,
          pendingCategories: new Set(),
        });
      }

      const info = itemRestrictionInfoMap.get(link.itemId);
      if (restriction.status === "pending") {
        info.hasPending = true;
        info.pendingCount++;
        if (restriction.category) {
          info.pendingCategories.add(restriction.category);
        }
      }
    });

    const currentWeek = utils.getWeekForDate(new Date(), weeksData);
    if (currentWeek === null) {
      dashboardOutput.innerHTML = `<div class="message-box">Data atual fora do mapeamento.</div>`;
      filterControls.innerHTML = "";
      indicatorsContainer.innerHTML = "";
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

    renderStaticControls();
    setupNavigation();
    await renderCurrentWeekView();
    setupEventListeners();
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
  const itemId =
    item.type === "group"
      ? `group::${item.data.groupName}`
      : item.relatedTasks[0].task_code;

  if (currentFilter === "restrictions") {
    const restrictionInfo = itemRestrictionInfoMap.get(itemId);
    if (!restrictionInfo || !restrictionInfo.hasPending) {
      return false; // Must have at least one pending restriction
    }
    if (currentRestrictionFilter === "all") {
      return true; // Has restrictions, and we want all with restrictions
    }
    // Check if any of the item's restrictions match the category filter
    return restrictionInfo.pendingCategories.has(currentRestrictionFilter);
  }

  // --- Original filter logic ---
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

async function renderCurrentWeekView() {
  const weekNumber = upcomingWeeks[currentWeekIndex];
  if (!groupedByWeek[weekNumber]) {
    // Show skeleton on the card itself before processing
    dashboardOutput.innerHTML = `
        <div class="card p-4 md:p-8 bg-secondary" aria-live="polite" aria-busy="true">
            <div class="sr-only">Carregando dados da semana.</div>
             <div class="week-card-header flex flex-col items-center md:items-start text-center md:text-left md:flex-row md:items-center justify-between border-b-2 border-border-accent pb-3 mb-3 md:border-b md:border-border-primary">
                <div>
                    <div class="skeleton skeleton-title" style="width: 250px; height: 1.75rem;"></div>
                    <div class="skeleton skeleton-text mt-2" style="width: 200px;"></div>
                </div>
                <div class="skeleton" style="width: 120px; height: 38px; border-radius: 0.5rem;"></div>
            </div>
            <p class="text-center text-tertiary italic p-8">Processando dados da semana...</p>
        </div>`;
    await processAndCacheWeekData(weekNumber);
  }

  // --- Dynamic Filter Logic ---
  const weekTree = { children: groupedByWeek[weekNumber] || {} };
  let weekHasPendingRestrictions = false;
  const availableRestrictionCategories = new Set();

  function traverseAndCheckRestrictions(node) {
    if (node.items) {
      for (const item of node.items.values()) {
        const itemId =
          item.type === "group"
            ? `group::${item.data.groupName}`
            : item.relatedTasks[0].task_code;
        const restrictionInfo = itemRestrictionInfoMap.get(itemId);
        if (restrictionInfo?.hasPending) {
          weekHasPendingRestrictions = true;
          restrictionInfo.pendingCategories.forEach((cat) =>
            availableRestrictionCategories.add(cat)
          );
        }
      }
    }
    if (node.children) {
      for (const childKey in node.children) {
        traverseAndCheckRestrictions(node.children[childKey]);
      }
    }
  }
  traverseAndCheckRestrictions(weekTree);

  const restrictionsFilterBtn = document.querySelector(
    '.filter-btn[data-filter="restrictions"]'
  );
  if (restrictionsFilterBtn) {
    restrictionsFilterBtn.style.display = weekHasPendingRestrictions
      ? "block"
      : "none";
  }

  if (!weekHasPendingRestrictions && currentFilter === "restrictions") {
    currentFilter = "all"; // Reset to default filter
    document.querySelector(".filter-btn.active")?.classList.remove("active");
    document
      .querySelector('.filter-btn[data-filter="all"]')
      ?.classList.add("active");
  }

  // Centralized logic for sub-filter visibility.
  // This explicitly manages layout classes to prevent CSS specificity conflicts on larger screens,
  // where a responsive class like `sm:flex` could override the `hidden` class.
  if (currentFilter === "restrictions") {
    restrictionFilterControls.classList.remove("hidden");
    restrictionFilterControls.classList.add("grid", "sm:flex");
  } else {
    restrictionFilterControls.classList.add("hidden");
    restrictionFilterControls.classList.remove("grid", "sm:flex");
  }

  const subFilterButtons =
    restrictionFilterControls.querySelectorAll(".sub-filter-btn");
  subFilterButtons.forEach((btn) => {
    const category = btn.dataset.category;
    if (category === "all") {
      btn.style.display = "block";
    } else {
      btn.style.display = availableRestrictionCategories.has(category)
        ? "block"
        : "none";
    }
  });

  if (
    !availableRestrictionCategories.has(currentRestrictionFilter) &&
    currentRestrictionFilter !== "all"
  ) {
    currentRestrictionFilter = "all";
    restrictionFilterControls
      .querySelector(".sub-filter-btn.active")
      ?.classList.remove("active");
    restrictionFilterControls
      .querySelector('.sub-filter-btn[data-category="all"]')
      ?.classList.add("active");
  }

  // --- Rendering Logic ---
  const weekInfo = weeksData.find((w) => parseInt(w.Semana, 10) === weekNumber);
  const dateRange = weekInfo
    ? `${utils.formatBrazilianDate(
        weekInfo.Data_Inicio
      )} - ${utils.formatBrazilianDate(weekInfo.Data_Fim)}`
    : "";

  let hasContent = false;

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
              : item.relatedTasks[0].task_name;
          const itemTitle =
            item.type === "group"
              ? item.data.groupName
              : `${item.relatedTasks[0].task_code}: ${item.relatedTasks[0].task_name}`;

          const hasPhoto = activityMediaMap.has(itemId);
          let photoBadge = hasPhoto
            ? '<span class="photo-badge" title="Este item possui foto">📸</span>'
            : "";
          const pendingCount =
            itemRestrictionInfoMap.get(itemId)?.pendingCount || 0;
          let restrictionBadge =
            pendingCount > 0
              ? `<span class="restriction-badge" title="${pendingCount} restrições pendentes">🚩 ${pendingCount}</span>`
              : "";

          let itemEntryClass = "item-entry";
          const customValue = customValuesData.get(itemId);
          if (
            customValue &&
            (customValue.planned !== null || customValue.actual !== null)
          ) {
            const remaining =
              (customValue.planned || 0) - (customValue.actual || 0);
            tooltipHtml = `data-tooltip="Saldo Topográfico: ${utils.formatNumberBR(
              remaining
            )}"`;
            itemEntryClass += " tooltip has-tooltip";
          }

          if (item.type === "group") {
            const { groupName, totalStages } = activityStageMap.get(
              item.relatedTasks[0].task_code
            );

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
            html += `<div role="button" tabindex="0" class="${itemEntryClass}" ${tooltipHtml} data-item-id="${itemId}" data-item-name="${itemName}"><div class="flex justify-between items-center"><p class="font-semibold text-primary">${groupName}</p><div>${photoBadge}${restrictionBadge}${tagHtml}</div></div><p class="text-sm text-tertiary italic">${stageText} de ${totalStages}</p></div>`;
          } else {
            const task = item.relatedTasks[0];

            if (task.tag.includes("Início"))
              tagHtml += `<span class="tag tag-start">Início</span>`;
            if (task.tag.includes("Fim"))
              tagHtml += `<span class="tag tag-end">Fim</span>`;
            html += `<div role="button" tabindex="0" class="${itemEntryClass}" ${tooltipHtml} data-item-id="${itemId}" data-item-name="${itemTitle}"><div class="flex justify-between items-center"><p class="font-semibold text-primary">${task.task_name}</p><div>${photoBadge}${restrictionBadge}${tagHtml}</div></div><p class="text-sm text-secondary">${task.task_code}</p></div>`;
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
  const filterLabel =
    filterControls.querySelector(".active")?.textContent.trim() || "Todos";
  if (!hasContent) {
    weekContent = `<p class="text-lg text-tertiary italic py-20 text-center">Nenhuma atividade para o filtro "${filterLabel}" nesta semana.</p>`;
  }

  dashboardOutput.innerHTML = `
            <div class="card p-4 md:p-8 bg-secondary" aria-live="polite" aria-busy="false">
              <div class="week-card-header flex flex-col items-center md:items-start text-center md:text-left md:flex-row md:items-center justify-between border-b-2 border-border-accent pb-3 mb-3 md:border-b md:border-border-primary">
                  <div>
                    <h3 class="text-2xl font-bold text-primary">
                        <span>Semana ${weekNumber}</span> 
                        <span class="text-xl font-normal text-tertiary">(${
                          currentWeekIndex + 1
                        }ª de 6)</span>
                    </h3>
                    <p class="text-base font-normal text-tertiary mt-1">${dateRange}</p>
                  </div>
                  <button id="toggle-all-btn" data-state="collapsed" class="text-sm p-2 rounded-md toggle-all-button self-center md:self-auto mt-2 md:mt-0">Expandir Tudo</button>
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
      el.parentElement.closest(".card") === el.parentElement.parentElement;
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
    content.style.overflow = "hidden"; // Set overflow to hidden to prevent tooltips from showing during collapse
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
  btn.textContent = isExpanding ? "Minimizar Tudo" : "Minimizar Tudo";
}

async function expandAllWbs() {
  const allTitleButtons = Array.from(
    dashboardOutput.querySelectorAll(".wbs-title")
  );
  allTitleButtons.forEach((button) => {
    const isCurrentlyExpanded = button.getAttribute("aria-expanded") === "true";
    if (!isCurrentlyExpanded) {
      toggleWbsContent(button);
    }
  });
  const toggleAllBtn = document.getElementById("toggle-all-btn");
  if (toggleAllBtn) {
    toggleAllBtn.dataset.state = "expanded";
    toggleAllBtn.textContent = "Minimizar Tudo";
  }
}

function renderStaticControls() {
  filterControls.innerHTML = `
        <button class="filter-btn active" data-filter="all">Todos</button>
        <button class="filter-btn" data-filter="start">Início</button>
        <button class="filter-btn" data-filter="end">Fim</button>
        <button class="filter-btn" data-filter="ongoing">Andamento</button>
        <button class="filter-btn filter-btn-restrictions col-span-2" data-filter="restrictions" style="display: none;">
            ⚠️ Com Restrições
        </button>
    `;

  restrictionFilterControls.innerHTML = `
        <button class="sub-filter-btn active" data-category="all" style="display: none;">Todas</button>
        <button class="sub-filter-btn" data-category="Método" style="display: none;">Método</button>
        <button class="sub-filter-btn" data-category="Máquina" style="display: none;">Máquina</button>
        <button class="sub-filter-btn" data-category="Mão de Obra" style="display: none;">Mão de Obra</button>
        <button class="sub-filter-btn" data-category="Material" style="display: none;">Material</button>
        <button class="sub-filter-btn" data-category="Medição" style="display: none;">Medição</button>
        <button class="sub-filter-btn" data-category="Meio Ambiente" style="display: none;">Meio Ambiente</button>
    `;
}

function setupNavigation() {
  indicatorsContainer.innerHTML = upcomingWeeks
    .map(
      (_, i) =>
        `<button class="indicator-dot" data-index="${i}" aria-label="Ir para semana ${upcomingWeeks[i]}"></button>`
    )
    .join("");
  updateNavigation();
}

function setupEventListeners() {
  prevBtn.setAttribute("aria-label", "Semana anterior");
  nextBtn.setAttribute("aria-label", "Próxima semana");

  prevBtn.addEventListener("click", async () => {
    if (currentWeekIndex > 0) {
      currentWeekIndex--;
      await renderCurrentWeekView();
    }
  });
  nextBtn.addEventListener("click", async () => {
    if (currentWeekIndex < upcomingWeeks.length - 1) {
      currentWeekIndex++;
      await renderCurrentWeekView();
    }
  });

  indicatorsContainer.querySelectorAll(".indicator-dot").forEach((dot) => {
    dot.addEventListener("click", async () => {
      currentWeekIndex = parseInt(dot.dataset.index);
      await renderCurrentWeekView();
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

    // Check if another animation is cascading upwards
    const parent = content.parentElement.closest(
      ".wbs-content[aria-expanded='true']"
    );
    if (parent) {
      parent.style.maxHeight = parent.scrollHeight + "px";
    }

    // When an element has finished expanding
    if (content.style.maxHeight !== "0px") {
      content.style.maxHeight = "none";
      content.style.overflow = "visible"; // Allow tooltips to show
    }
  });

  filterControls.addEventListener("click", async (e) => {
    const btn = e.target.closest(".filter-btn");
    if (btn && !btn.classList.contains("active")) {
      filterControls.querySelector(".active").classList.remove("active");
      btn.classList.add("active");
      currentFilter = btn.dataset.filter;

      await renderCurrentWeekView();
      if (currentFilter !== "all") {
        await expandAllWbs();
      }
    }
  });

  restrictionFilterControls.addEventListener("click", async (e) => {
    const btn = e.target.closest(".sub-filter-btn");
    if (btn && !btn.classList.contains("active")) {
      restrictionFilterControls
        .querySelector(".active")
        .classList.remove("active");
      btn.classList.add("active");
      currentRestrictionFilter = btn.dataset.category;
      await renderCurrentWeekView();
      await expandAllWbs();
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

  renderDetailsCard();
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

function findItemInCurrentWeekTree(itemId) {
  const weekTree = {
    children: groupedByWeek[upcomingWeeks[currentWeekIndex]] || {},
    items: new Map(),
  }; // Wrap it to have a common structure

  function search(node) {
    if (node.items) {
      for (const item of node.items.values()) {
        const currentItemId =
          item.type === "group"
            ? `group::${item.data.groupName}`
            : item.relatedTasks[0].task_code;
        if (currentItemId === itemId) {
          return item;
        }
      }
    }
    if (node.children) {
      for (const childKey in node.children) {
        const result = search(node.children[childKey]);
        if (result) return result;
      }
    }
    return null;
  }
  return search(weekTree);
}

function renderDetailsCard() {
  if (!currentOpenItemId) return;
  // --- Data Gathering ---
  const itemData = findItemInCurrentWeekTree(currentOpenItemId);

  // Dates
  const itemDates = (() => {
    if (
      !itemData ||
      !itemData.relatedTasks ||
      itemData.relatedTasks.length === 0
    ) {
      return { start: "N/A", end: "N/A" };
    }
    const dates = itemData.relatedTasks.map((task) => ({
      start: new Date(
        (task.act_start_date || task.restart_date).replace(" ", "T")
      ),
      end: new Date(
        (task.reend_date || task.target_end_date).replace(" ", "T")
      ),
    }));
    const minStart = new Date(Math.min(...dates.map((d) => d.start)));
    const maxEnd = new Date(Math.max(...dates.map((d) => d.end)));
    return {
      start: utils.formatBrazilianDate(minStart),
      end: utils.formatBrazilianDate(maxEnd),
    };
  })();

  // Balance
  const customValue = customValuesData.get(currentOpenItemId);
  const balance = (() => {
    if (
      customValue &&
      (customValue.planned !== null || customValue.actual !== null)
    ) {
      const remaining = (customValue.planned || 0) - (customValue.actual || 0);
      return utils.formatNumberBR(remaining);
    }
    return null;
  })();

  // Restrictions
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
                        <div class="flex items-center gap-2 mb-1">
                            ${
                              r.category
                                ? `<span class="restriction-category-badge">${r.category}</span>`
                                : ""
                            }
                            <p class="font-medium text-primary">${r.desc}</p>
                        </div>
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
                        <button class="action-btn toggle-status-btn">${
                          r.status === "pending" ? "Resolver" : "Reabrir"
                        }</button>
                        <button class="action-btn unlink-btn text-yellow-600">Desvincular</button>
                    </div>
                </div>`
      )
      .join("");
  };

  // --- HTML Rendering ---
  let infoCardHtml = `
    <div class="item-info-card">
        <h3 class="text-lg font-semibold text-primary mb-3">Informações Gerais</h3>
        <div class="info-grid">
            <div class="info-grid-item">
                <span class="info-item-label">Início</span>
                <span class="info-item-value">${itemDates.start}</span>
            </div>
            <div class="info-grid-item">
                <span class="info-item-label">Término</span>
                <span class="info-item-value">${itemDates.end}</span>
            </div>
            ${
              balance !== null
                ? `
            <div class="info-grid-item">
                <span class="info-item-label">Saldo Topográfico</span>
                <span class="info-item-value">${balance}</span>
            </div>`
                : ""
            }
        </div>
    </div>`;

  modalBody.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                ${infoCardHtml}
                <div class="mt-6">
                    <h3 class="text-lg font-semibold text-primary mb-2">Restrições Vinculadas</h3>
                    <div class="space-y-4">
                        <div>
                            <h4 class="font-medium text-secondary mb-2">Pendentes</h4>
                            <div id="pending-list" class="space-y-2">${renderList(
                              pending
                            )}</div>
                        </div>
                        <div>
                            <h4 class="font-medium text-secondary mb-2">Resolvidas</h4>
                            <div id="resolved-list" class="space-y-2">${renderList(
                              resolved
                            )}</div>
                        </div>
                    </div>
                </div>
            </div>
             <div>
                <div id="photo-section">
                    <h3 class="text-lg font-semibold text-primary mb-3">Foto da Atividade</h3>
                    <div id="photo-content-wrapper" class="p-4 bg-tertiary rounded-lg border border-border-primary min-h-[200px] flex items-center justify-center">
                        ${renderPhotoContent()}
                    </div>
                </div>
                <div id="add-restriction-section" class="mt-6 pt-6 border-t border-border-primary">
                    <button id="show-add-restriction-form-btn" class="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700">Adicionar/Vincular Restrição</button>
                    <div id="restriction-form-container" class="hidden">
                        <!-- Form will be rendered here -->
                    </div>
                </div>
            </div>
        </div>
        `;

  // --- Event Listeners ---
  document
    .getElementById("show-add-restriction-form-btn")
    .addEventListener("click", renderRestrictionFormContainer);
  modalBody.addEventListener("click", handleModalActions);
  modalBody
    .querySelector("#photo-content-wrapper")
    .addEventListener("click", handlePhotoClick);
  modalBody
    .querySelector("#photo-content-wrapper")
    .addEventListener("change", handlePhotoChange);
}

function renderRestrictionFormContainer() {
  document
    .getElementById("show-add-restriction-form-btn")
    .classList.add("hidden");
  const container = document.getElementById("restriction-form-container");
  container.classList.remove("hidden");

  const linkedIds = new Set(
    restrictionLinks
      .filter((l) => l.itemId === currentOpenItemId)
      .map((l) => l.restrictionId)
  );
  const unlinkedRestrictions = restrictionsList.filter(
    (r) => !linkedIds.has(r.id) && r.status === "pending"
  );
  const unlinkedOptions = unlinkedRestrictions
    .map((r) => `<option value="${r.id}">${r.desc}</option>`)
    .join("");

  const mCategories = [
    "Método",
    "Máquina",
    "Mão de Obra",
    "Material",
    "Medição",
    "Meio Ambiente",
  ];

  container.innerHTML = `
        <div class="space-y-4">
            <div class="p-4 bg-tertiary rounded-lg border border-border-primary">
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
            <div class="p-4 bg-tertiary rounded-lg border border-border-primary">
                <h3 class="text-lg font-semibold text-primary mb-2">Adicionar Nova Restrição</h3>
                <form id="add-restriction-form" class="space-y-4">
                    <div>
                        <label for="restr-desc" class="form-label">Descrição</label>
                        <input type="text" id="restr-desc" class="form-input" required>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label for="restr-resp" class="form-label">Responsável</label>
                            <input type="text" id="restr-resp" class="form-input" required>
                        </div>
                        <div>
                            <label for="restr-due" class="form-label">Prazo</label>
                            <input type="date" id="restr-due" class="form-input" required>
                        </div>
                    </div>
                     <div>
                        <label class="form-label">Causa Raiz (6M)</label>
                        <div id="m-category-selector" class="flex flex-wrap gap-2">
                           ${mCategories
                             .map(
                               (cat) =>
                                 `<button type="button" class="m-category-btn" data-category="${cat}">${cat}</button>`
                             )
                             .join("")}
                        </div>
                        <input type="hidden" id="restr-category" name="restr-category">
                    </div>
                    <div>
                        <button type="submit" class="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700">Adicionar e Vincular</button>
                    </div>
                </form>
            </div>
        </div>
    `;

  if (unlinkedOptions.length > 0) {
    activeTomSelect = new TomSelect("#restr-select", {
      placeholder: "Selecione uma restrição...",
    });
  }

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
    });
}

async function handleModalActions(e) {
  const restrictionItem = e.target.closest(".restriction-item");
  if (!restrictionItem) return;

  const restrictionId = restrictionItem.dataset.restrId;
  const restriction = restrictionsList.find((r) => r.id === restrictionId);
  if (!restriction) return;

  if (e.target.classList.contains("toggle-status-btn")) {
    restriction.status =
      restriction.status === "pending" ? "resolved" : "pending";
    await storage.saveData(
      storage.APP_KEYS.RESTRICTIONS_LIST_KEY,
      restrictionsList
    );
    utils.showToast("Status da restrição alterado.", "success");
  } else if (e.target.classList.contains("unlink-btn")) {
    restrictionLinks = restrictionLinks.filter(
      (l) =>
        !(l.itemId === currentOpenItemId && l.restrictionId === restrictionId)
    );
    await storage.saveData(
      storage.APP_KEYS.RESTRICTION_LINKS_KEY,
      restrictionLinks
    );
    utils.showToast("Restrição desvinculada.", "success");
  } else if (e.target.closest("#link-restriction-form")) {
    e.preventDefault();
    const selectedId = activeTomSelect.getValue();
    if (!selectedId) {
      utils.showToast("Selecione uma restrição para vincular.", "error");
      return;
    }
    restrictionLinks.push({
      restrictionId: selectedId,
      itemId: currentOpenItemId,
    });
    await storage.saveData(
      storage.APP_KEYS.RESTRICTION_LINKS_KEY,
      restrictionLinks
    );
    utils.showToast("Restrição vinculada com sucesso.", "success");
    activeTomSelect.destroy();
    activeTomSelect = null;
  } else if (e.target.closest("#add-restriction-form")) {
    e.preventDefault();
    const newId = uuidv4();
    const newRestriction = {
      id: newId,
      desc: document.getElementById("restr-desc").value.trim(),
      resp: document.getElementById("restr-resp").value.trim(),
      due: document.getElementById("restr-due").value.trim(),
      category: document.getElementById("restr-category").value || null,
      status: "pending",
    };
    if (!newRestriction.desc || !newRestriction.resp || !newRestriction.due) {
      utils.showToast("Preencha todos os campos da nova restrição.", "error");
      return;
    }
    restrictionsList.push(newRestriction);
    restrictionLinks.push({ restrictionId: newId, itemId: currentOpenItemId });
    await Promise.all([
      storage.saveData(
        storage.APP_KEYS.RESTRICTIONS_LIST_KEY,
        restrictionsList
      ),
      storage.saveData(
        storage.APP_KEYS.RESTRICTION_LINKS_KEY,
        restrictionLinks
      ),
    ]);
    utils.showToast("Nova restrição adicionada e vinculada.", "success");
  }

  // Common logic for all actions: update maps and re-render
  itemRestrictionInfoMap.clear();
  restrictionLinks.forEach((link) => {
    const restriction = restrictionsList.find(
      (r) => r.id === link.restrictionId
    );
    if (!restriction) return;

    if (!itemRestrictionInfoMap.has(link.itemId)) {
      itemRestrictionInfoMap.set(link.itemId, {
        hasPending: false,
        pendingCount: 0,
        pendingCategories: new Set(),
      });
    }
    const info = itemRestrictionInfoMap.get(link.itemId);
    if (restriction.status === "pending") {
      info.hasPending = true;
      info.pendingCount++;
      if (restriction.category)
        info.pendingCategories.add(restriction.category);
    }
  });

  renderDetailsCard();
  await renderCurrentWeekView();
}

// --- Photo Management Functions ---

function renderPhotoContent() {
  if (!currentOpenItemId) return "";

  const media = activityMediaMap.get(currentOpenItemId);
  if (media?.imageUrl) {
    return `
      <div class="relative group">
        <img src="${media.imageUrl}" alt="Foto da atividade" class="max-h-[300px] max-w-full rounded-lg object-contain">
        <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center rounded-lg">
            <button class="remove-photo-btn hidden group-hover:block px-4 py-2 bg-red-600 text-white rounded-md text-sm font-semibold">Remover Foto</button>
        </div>
      </div>
    `;
  } else {
    return `
      <div id="photo-upload-area" class="text-center">
        <p class="text-tertiary mb-4">Nenhuma foto para este item.</p>
        <label for="photo-file-input" class="file-input-label cursor-pointer">Adicionar Foto</label>
        <input type="file" id="photo-file-input" class="sr-only" accept="image/png, image/jpeg, image/gif">
      </div>
    `;
  }
}

function handlePhotoClick(e) {
  if (e.target.classList.contains("remove-photo-btn")) {
    handleRemovePhoto();
  }
}

async function handlePhotoChange(e) {
  if (e.target.id !== "photo-file-input") return;

  const file = e.target.files[0];
  if (!file || !currentOpenItemId) return;

  const wrapper = document.getElementById("photo-content-wrapper");
  if (!wrapper) return;

  // Show a loading state
  wrapper.innerHTML = `
      <div class="flex flex-col items-center gap-2 text-primary">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span>Enviando...</span>
      </div>
    `;

  try {
    const existingMedia = activityMediaMap.get(currentOpenItemId);
    // If a photo already exists, delete it from Firebase Storage first
    if (existingMedia?.storagePath) {
      const oldStorageRef = ref(firebaseStorage, existingMedia.storagePath);
      await deleteObject(oldStorageRef).catch((err) =>
        console.warn("Old photo deletion failed, might not exist:", err)
      );
    }

    const fileExtension = file.name.split(".").pop();
    const storagePath = `activity_photos/${currentOpenItemId}_${Date.now()}.${fileExtension}`;
    const storageRef = ref(firebaseStorage, storagePath);

    // Upload the new file
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    // Save metadata to Firestore
    const mediaData = {
      imageUrl: downloadURL,
      storagePath: storagePath,
      uploadedAt: new Date().toISOString(),
    };
    await storage.saveActivityMedia(currentOpenItemId, mediaData);

    // Update local state
    activityMediaMap.set(currentOpenItemId, mediaData);

    // Re-render the photo content and the main week view to show the badge
    wrapper.innerHTML = renderPhotoContent();
    await renderCurrentWeekView();
    utils.showToast("Foto enviada com sucesso!", "success");
  } catch (error) {
    console.error("Erro no upload da foto:", error);
    utils.showToast(`Falha no upload: ${error.message}`, "error");
    // Restore original upload button on error
    wrapper.innerHTML = renderPhotoContent();
  }
}

async function handleRemovePhoto() {
  if (
    !currentOpenItemId ||
    !confirm("Tem certeza que deseja remover esta foto?")
  )
    return;

  const wrapper = document.getElementById("photo-content-wrapper");
  if (!wrapper) return;

  wrapper.innerHTML = `
        <div class="flex flex-col items-center gap-2 text-primary">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            <span>Removendo...</span>
        </div>
    `;

  try {
    const media = activityMediaMap.get(currentOpenItemId);
    if (media?.storagePath) {
      const storageRef = ref(firebaseStorage, media.storagePath);
      await deleteObject(storageRef);
    }

    // Delete from Firestore
    await storage.deleteActivityMedia(currentOpenItemId);

    // Update local state
    activityMediaMap.delete(currentOpenItemId);

    // Re-render
    wrapper.innerHTML = renderPhotoContent();
    await renderCurrentWeekView();
    utils.showToast("Foto removida.", "success");
  } catch (error) {
    console.error("Erro ao remover foto:", error);
    utils.showToast(`Falha ao remover: ${error.message}`, "error");
    wrapper.innerHTML = renderPhotoContent();
  }
}
