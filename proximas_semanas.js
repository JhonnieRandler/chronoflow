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
(async () => {
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

  const checklistRunnerModal = document.getElementById(
    "checklist-runner-modal"
  );
  const checklistRunnerModalTitle = document.getElementById(
    "checklist-runner-modal-title"
  );
  const checklistRunnerModalSubtitle = document.getElementById(
    "checklist-runner-modal-subtitle"
  );
  const checklistRunnerModalBody = document.getElementById(
    "checklist-runner-modal-body"
  );
  const checklistRunnerModalCloseBtn = document.getElementById(
    "checklist-runner-modal-close-btn"
  );
  const checklistRunnerCancelBtn = document.getElementById(
    "checklist-runner-cancel-btn"
  );
  const checklistRunnerSaveBtn = document.getElementById(
    "checklist-runner-save-btn"
  );

  const restrictionLinkerModal = document.getElementById(
    "restriction-linker-modal"
  );
  const restrictionLinkerBody = document.getElementById(
    "restriction-linker-body"
  );
  const restrictionLinkerCloseBtn = document.getElementById(
    "restriction-linker-close-btn"
  );
  const restrictionLinkerCancelBtn = document.getElementById(
    "restriction-linker-cancel-btn"
  );
  const restrictionLinkerSaveBtn = document.getElementById(
    "restriction-linker-save-btn"
  );

  const fullscreenViewer = document.getElementById("fullscreen-viewer");
  const fullscreenImage = document.getElementById("fullscreen-image");
  const fullscreenCloseBtn = document.getElementById("fullscreen-close-btn");

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
    checklists = [],
    checklistRuns = [],
    checklistRunsByWbsId = new Map(),
    itemRestrictionInfoMap = new Map(),
    activityMediaMap = new Map(),
    activityDetailsMap = new Map(),
    milestonesMap = new Map(),
    itemMilestoneMap = new Map();
  let currentWeekIndex = 0;
  let groupedByWeek = {};
  let currentFilter = "all";
  let currentRestrictionFilter = "all";
  let currentOpenItemId = null;
  let projectName = "Projeto";
  let activeTomSelect = null;
  let lastFocusedElement = null; // For accessibility
  let activeRestrictionLinkerItem = null; // For the new linker workspace
  let restrictionLinksInMemory = new Map(); // For the new linker workspace

  try {
    const projectBase = await storage.getProjectBase();
    const projectVersions = await storage.getProjectVersions();

    [
      weeksData,
      activityMapping,
      restrictionsList,
      restrictionLinks,
      checklists,
      checklistRuns,
    ] = await Promise.all([
      storage.getData(storage.APP_KEYS.WEEKS_DATA_KEY),
      storage.getData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY),
      storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
      storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
      storage.getData(storage.APP_KEYS.CHECKLISTS_KEY),
      storage.getData(storage.APP_KEYS.CHECKLIST_RUNS_KEY),
    ]);

    checklistRunsByWbsId = new Map(
      checklistRuns.map((run) => [run.wbsId, run])
    );

    const milestonesList = await storage.getData(
      storage.APP_KEYS.MILESTONES_LIST_KEY
    );
    const milestoneLinks = await storage.getData(
      storage.APP_KEYS.MILESTONE_LINKS_KEY
    );

    milestonesMap = new Map(milestonesList.map((m) => [m.id, m]));
    milestoneLinks.forEach((link) => {
      if (!itemMilestoneMap.has(link.itemId)) {
        itemMilestoneMap.set(link.itemId, []);
      }
      itemMilestoneMap.get(link.itemId).push(link.milestoneId);
    });

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

    const activityDetails = await storage.getActivityDetails();
    activityDetails.forEach((detail) => {
      if (!activityDetailsMap.has(detail.parentId)) {
        activityDetailsMap.set(detail.parentId, []);
      }
      activityDetailsMap.get(detail.parentId).push(detail);
    });

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
          groupId: group.groupId,
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
    setupFullscreenViewer();
  } catch (e) {
    console.error(e);
    dashboardOutput.innerHTML = `<div class="message-box" role="alert" style="color: #b91c1c;">Erro: ${e.message}</div>`;
  }

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
        ...wbsHierarchy
          .map((w) => parseInt(w.level, 10))
          .filter((l) => !isNaN(l))
      );
      groupingLevels =
        maxLevel > 0 ? Array.from({ length: maxLevel }, (_, i) => i + 1) : [];
    }

    groupedByWeek[weekNumber] = {};

    const tasksToProcess = fullTaskList.filter((task) => {
      if (
        task.status_code === "TK_Complete" ||
        hiddenActivities.includes(task.task_code)
      ) {
        return false;
      }

      // Check 1: Does the main task's schedule overlap with the week?
      const startDateStr = task.act_start_date || task.restart_date;
      const endDateStr = task.reend_date || task.target_end_date;
      if (startDateStr && endDateStr) {
        const startWeek = utils.getWeekForDate(
          startDateStr.replace(" ", "T"),
          weeksData
        );
        const endWeek = utils.getWeekForDate(
          endDateStr.replace(" ", "T"),
          weeksData
        );
        if (startWeek !== null && endWeek !== null && endWeek >= startWeek) {
          if (weekNumber >= startWeek && weekNumber <= endWeek) {
            return true;
          }
        }
      }

      // Check 2: If not, does any of its execution plan steps overlap?
      const groupInfo = activityStageMap.get(task.task_code);
      const itemId = groupInfo ? `group::${groupInfo.groupId}` : task.task_code;

      const plan = activityDetailsMap.get(itemId);
      if (plan && plan.length > 0) {
        for (const step of plan) {
          if (step.startDate && step.endDate) {
            const stepStartWeek = utils.getWeekForDate(
              step.startDate,
              weeksData
            );
            const stepEndWeek = utils.getWeekForDate(step.endDate, weeksData);
            if (
              stepStartWeek !== null &&
              stepEndWeek !== null &&
              stepEndWeek >= stepStartWeek
            ) {
              if (weekNumber >= stepStartWeek && weekNumber <= stepEndWeek) {
                return true;
              }
            }
          }
        }
      }

      return false;
    });

    tasksToProcess.forEach((task) => {
      // 1. Determine the hierarchy path for the task based on grouping levels
      const groupPathKeys = [];
      const taskWbsPath = task.wbsPath || [];

      for (const level of groupingLevels) {
        const wbsNodeAtLevel = taskWbsPath.find(
          (p) => parseInt(p.level, 10) === parseInt(level, 10)
        );

        if (wbsNodeAtLevel) {
          groupPathKeys.push(wbsNodeAtLevel.stable_wbs_id);
        } else {
          // If a selected level is not found, find the deepest actual parent.
          const deepestParent =
            taskWbsPath.length > 0 ? taskWbsPath[taskWbsPath.length - 1] : null;
          if (deepestParent) {
            // Only add if it's not a duplicate of the last key already in the path
            if (
              groupPathKeys.length === 0 ||
              groupPathKeys[groupPathKeys.length - 1] !==
                deepestParent.stable_wbs_id
            ) {
              groupPathKeys.push(deepestParent.stable_wbs_id);
            }
          }
          // Once a level is missed, we stop trying to apply the user's selected levels
          // and use the task's own deepest parent.
          break;
        }
      }

      // 2. Traverse the tree structure and create nodes if they don't exist
      let currentSubtree = groupedByWeek[weekNumber];
      for (const groupKey of groupPathKeys) {
        if (!currentSubtree[groupKey]) {
          const wbsNodeData = wbsMap.get(groupKey);
          currentSubtree[groupKey] = {
            data: wbsNodeData,
            children: {},
            items: new Map(),
          };
        }
        // Move into the children of the current node for the next iteration
        currentSubtree = currentSubtree[groupKey].children;
      }

      // 3. Place the item (task or group) into the correct final location
      let finalParentNode = { children: groupedByWeek[weekNumber] }; // A temporary root
      for (const key of groupPathKeys) {
        finalParentNode = finalParentNode.children[key];
      }

      const groupInfo = activityStageMap.get(task.task_code);
      const itemKey = groupInfo ? groupInfo.groupId : task.task_code;

      // Determine the tag (Start/End)
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

      const taskWithTag = { ...task, tag };

      if (!finalParentNode.items.has(itemKey)) {
        finalParentNode.items.set(itemKey, {
          type: groupInfo ? "group" : "task",
          data: groupInfo
            ? { groupName: groupInfo.groupName, groupId: groupInfo.groupId }
            : taskWithTag,
          relatedTasks: [],
        });
      }
      finalParentNode.items.get(itemKey).relatedTasks.push(taskWithTag);
    });
  }

  function itemMatchesFilter(item) {
    const itemId =
      item.type === "group"
        ? `group::${item.data.groupId}`
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

  function checkMilestoneConflicts(item) {
    const itemId =
      item.type === "group"
        ? `group::${item.data.groupId}`
        : item.relatedTasks[0].task_code;
    const wbsPath = item.relatedTasks[0].wbsPath || [];

    const allApplicableMilestoneIds = new Set();

    // Add milestones directly linked to the item
    (itemMilestoneMap.get(itemId) || []).forEach((id) =>
      allApplicableMilestoneIds.add(id)
    );

    // Add milestones from parent WBS nodes
    wbsPath.forEach((wbsNode) => {
      (itemMilestoneMap.get(wbsNode.stable_wbs_id) || []).forEach((id) =>
        allApplicableMilestoneIds.add(id)
      );
    });

    if (allApplicableMilestoneIds.size === 0) {
      return { hasConflict: false, tooltip: "" };
    }

    const trendEndDates = item.relatedTasks.map(
      (t) => new Date((t.reend_date || t.target_end_date).replace(" ", "T"))
    );
    const latestTrendEndDate = new Date(Math.max.apply(null, trendEndDates));

    if (isNaN(latestTrendEndDate.getTime())) {
      return { hasConflict: false, tooltip: "" };
    }

    let conflicts = [];
    allApplicableMilestoneIds.forEach((milestoneId) => {
      const milestone = milestonesMap.get(milestoneId);
      if (milestone && milestone.date) {
        const milestoneDate = new Date(milestone.date + "T23:59:59");
        if (latestTrendEndDate > milestoneDate) {
          conflicts.push(
            `Atenção: A tendência de término (${utils.formatBrazilianDate(
              latestTrendEndDate
            )}) ultrapassa o marco '${
              milestone.name
            }' (${utils.formatBrazilianDate(milestoneDate)}).`
          );
        }
      }
    });

    return {
      hasConflict: conflicts.length > 0,
      tooltip: conflicts.join("\n"),
    };
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
              ? `group::${item.data.groupId}`
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

    const weekInfo = weeksData.find(
      (w) => parseInt(w.Semana, 10) === weekNumber
    );
    const dateRange = weekInfo
      ? `${utils.formatBrazilianDate(
          weekInfo.Data_Inicio
        )} - ${utils.formatBrazilianDate(weekInfo.Data_Fim)}`
      : "";
    const weekStartDate = weekInfo
      ? new Date(weekInfo.Data_Inicio + "T00:00:00")
      : null;
    const weekEndDate = weekInfo
      ? new Date(weekInfo.Data_Fim + "T23:59:59")
      : null;
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

        const checklistRun = checklistRunsByWbsId.get(key);
        const checklistButtonText = checklistRun
          ? "Ver Checklist"
          : "Checklist";
        const checklistRunIdAttr = checklistRun
          ? `data-run-id="${checklistRun.runId}"`
          : "";

        html += `<div class="wbs-group">
          <div class="wbs-title">
            <button id="${titleId}" class="wbs-title-toggle-area" aria-expanded="false" aria-controls="${contentId}">
                <span class="text-primary">${childNode.data.wbs_name}</span>
                <span class="wbs-toggle" aria-hidden="true">+</span>
            </button>
            <button class="run-checklist-btn" data-wbs-id="${key}" data-wbs-name="${childNode.data.wbs_name}" ${checklistRunIdAttr} title="${checklistButtonText} para ${childNode.data.wbs_name}">${checklistButtonText}</button>
          </div>
          <div id="${contentId}" class="wbs-content" role="region" aria-labelledby="${titleId}">`;

        if (filteredItems.length > 0) {
          html += '<div class="item-list">';
          filteredItems.forEach((item) => {
            hasContent = true;
            let tagHtml = "";
            let tooltipHtml = "";

            const itemId =
              item.type === "group"
                ? `group::${item.data.groupId}`
                : item.relatedTasks[0].task_code;
            const itemName =
              item.type === "group"
                ? item.data.groupName
                : item.relatedTasks[0].task_name;

            const hasDetails = activityDetailsMap.has(itemId);

            const milestoneConflict = checkMilestoneConflicts(item);
            let milestoneBadge = milestoneConflict.hasConflict
              ? `<span class="milestone-badge milestone-conflict-icon" data-tooltip="${milestoneConflict.tooltip}">🏁</span>`
              : ``;

            const hasPhoto = activityMediaMap.has(itemId);
            let photoBadge = hasPhoto
              ? '<span class="photo-badge" title="Este item possui foto">📸</span>'
              : "";

            const pendingCount =
              itemRestrictionInfoMap.get(itemId)?.pendingCount || 0;
            let restrictionBadge =
              pendingCount > 0
                ? `<span class="restriction-badge" title="${pendingCount} restrições pendentes">🚩</span>`
                : "";

            let itemEntryClass = "item-entry";
            if (milestoneConflict.hasConflict) {
              itemEntryClass += " milestone-conflict";
            }
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
              if (!milestoneConflict.hasConflict) {
                // Avoid overwriting milestone tooltip
                itemEntryClass += " tooltip has-tooltip";
              }
            }

            let subTextHtml;
            if (hasDetails && weekStartDate && weekEndDate) {
              const plan = activityDetailsMap.get(itemId) || [];
              const stepsInWeek = plan
                .filter((step) => {
                  const stepStart = step.startDate
                    ? new Date(step.startDate + "T00:00:00")
                    : null;
                  const stepEnd = step.endDate
                    ? new Date(step.endDate + "T23:59:59")
                    : null;
                  if (!stepStart || !stepEnd) return false;
                  return stepStart <= weekEndDate && stepEnd >= weekStartDate;
                })
                .map((step) => step.name)
                .join(", ");

              if (stepsInWeek) {
                subTextHtml = `<p class="text-sm text-tertiary italic">Etapas: ${stepsInWeek}</p>`;
              } else {
                subTextHtml = `<p class="text-sm text-secondary">${
                  item.relatedTasks[0].task_code || "Grupo"
                }</p>`;
              }
            } else if (item.type === "group") {
              const { totalStages } = activityStageMap.get(
                item.relatedTasks[0].task_code
              );
              const stagesInWeek = item.relatedTasks
                .map((t) => activityStageMap.get(t.task_code).stage)
                .sort((a, b) => a - b);
              const stageText =
                stagesInWeek.length > 1
                  ? `Etapas ${stagesInWeek.join(", ")}`
                  : `Etapa ${stagesInWeek[0]}`;
              subTextHtml = `<p class="text-sm text-tertiary italic">${stageText} de ${totalStages}</p>`;
            } else {
              subTextHtml = `<p class="text-sm text-secondary">${item.relatedTasks[0].task_code}</p>`;
            }

            if (item.type === "group") {
              const startsInWeek = item.relatedTasks.some((t) =>
                t.tag.includes("Início")
              );
              const endsInWeek = item.relatedTasks.some((t) =>
                t.tag.includes("Fim")
              );
              if (startsInWeek)
                tagHtml += `<span class="tag tag-start">Início</span>`;
              if (endsInWeek) tagHtml += `<span class="tag tag-end">Fim</span>`;
            } else {
              const task = item.relatedTasks[0];
              if (task.tag.includes("Início"))
                tagHtml += `<span class="tag tag-start">Início</span>`;
              if (task.tag.includes("Fim"))
                tagHtml += `<span class="tag tag-end">Fim</span>`;
            }

            html += `
              <div role="button" tabindex="0" class="${itemEntryClass}" ${tooltipHtml} data-item-id="${itemId}" data-item-name="${itemName}">
                  <div class="flex justify-between items-center">
                      <p class="font-semibold text-primary">${itemName}</p>
                      <div>${milestoneBadge}${photoBadge}${restrictionBadge}${tagHtml}</div>
                  </div>
                  ${subTextHtml}
              </div>`;
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
                    <div class="flex items-center gap-2 self-center md:self-auto mt-2 md:mt-0">
                      <button class="toggle-all-button text-sm p-2 rounded-md" data-state="collapsed">Expandir Tudo</button>
                    </div>
                </div>
                ${weekContent}
              </div>`;

    document.querySelectorAll(".wbs-content").forEach((content) => {
      content.style.maxHeight = "0px";
    });

    document.querySelectorAll(".wbs-title, .item-entry").forEach((el) => {
      const isTopLevel =
        el.parentElement.closest(".card") === el.parentElement.parentElement;
      if (el.classList.contains("wbs-title") && isTopLevel) {
        el.setAttribute("tabindex", "0");
      } else {
        el.setAttribute("tabindex", "-1");
      }
    });

    document
      .querySelector(".toggle-all-button")
      ?.addEventListener("click", toggleAllWbs);
    updateNavigation();
  }

  function toggleWbsContent(titleButton) {
    const content = document.getElementById(
      titleButton.getAttribute("aria-controls")
    );
    const icon = titleButton.querySelector(".wbs-toggle");
    if (!content) return;

    const isExpanded = titleButton.getAttribute("aria-expanded") === "true";

    content.style.overflow = "hidden";

    if (isExpanded) {
      content.style.maxHeight = content.scrollHeight + "px";
      requestAnimationFrame(() => {
        content.style.maxHeight = "0px";
      });
      titleButton.setAttribute("aria-expanded", "false");
      if (icon) icon.textContent = "+";
    } else {
      const currentScrollHeight = content.scrollHeight;
      content.style.maxHeight = currentScrollHeight + "px";
      titleButton.setAttribute("aria-expanded", "true");
      if (icon) icon.textContent = "-";

      const handleTransitionEnd = () => {
        if (titleButton.getAttribute("aria-expanded") === "true") {
          content.style.maxHeight = "none";
          content.style.overflow = "visible";
        }
        content.removeEventListener("transitionend", handleTransitionEnd);
      };
      content.addEventListener("transitionend", handleTransitionEnd);
    }
  }

  function toggleAllWbs(event) {
    const btn = event.target;
    const isExpanding = btn.dataset.state === "collapsed";
    const allTitleButtons = Array.from(
      dashboardOutput.querySelectorAll(".wbs-title-toggle-area")
    );
    allTitleButtons.forEach((button) => {
      const isCurrentlyExpanded =
        button.getAttribute("aria-expanded") === "true";
      if (isExpanding !== isCurrentlyExpanded) {
        button.click();
      }
    });
    btn.dataset.state = isExpanding ? "expanded" : "collapsed";
    btn.textContent = isExpanding ? "Recolher Tudo" : "Expandir Tudo";
  }

  async function expandAllWbs() {
    const allTitleButtons = Array.from(
      dashboardOutput.querySelectorAll(".wbs-title-toggle-area")
    );
    allTitleButtons.forEach((button) => {
      const isCurrentlyExpanded =
        button.getAttribute("aria-expanded") === "true";
      if (!isCurrentlyExpanded) {
        toggleWbsContent(button);
      }
    });
    const toggleAllBtn = document.querySelector(".toggle-all-button");
    if (toggleAllBtn) {
      toggleAllBtn.dataset.state = "expanded";
      toggleAllBtn.textContent = "Recolher Tudo";
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
      const toggleTitle = e.target.closest(".wbs-title-toggle-area");
      if (toggleTitle) {
        toggleWbsContent(toggleTitle);
        return;
      }

      const checklistBtn = e.target.closest(".run-checklist-btn");
      if (checklistBtn) {
        openChecklistRunnerModal(
          checklistBtn.dataset.wbsId,
          checklistBtn.dataset.wbsName,
          checklistBtn.dataset.runId
        );
        return;
      }

      const itemEntry = e.target.closest(".item-entry[data-item-id]");
      if (itemEntry) {
        openModal(itemEntry.dataset.itemId, itemEntry.dataset.itemName);
        return;
      }
    });

    dashboardOutput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const itemEntry = e.target.closest(".item-entry[data-item-id]");
        if (itemEntry) {
          e.preventDefault();
          openModal(itemEntry.dataset.itemId, itemEntry.dataset.itemName);
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
      if (content.style.maxHeight !== "0px") {
        content.style.overflow = "visible";
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

  // --- Modal Functions ---
  function findItemInWeekTree(itemId) {
    const weekNumber = upcomingWeeks[currentWeekIndex];
    const tree = groupedByWeek[weekNumber] || {};
    let foundItem = null;

    function find(node) {
      if (foundItem) return;
      if (node.items) {
        for (const item of node.items.values()) {
          const currentId =
            item.type === "group"
              ? `group::${item.data.groupId}`
              : item.relatedTasks[0].task_code;
          if (currentId === itemId) {
            foundItem = item;
            return;
          }
        }
      }
      if (node.children) {
        for (const childKey in node.children) {
          find(node.children[childKey]);
        }
      }
    }
    find({ children: tree });
    return foundItem;
  }

  function _renderMilestoneAlertForModal(itemData) {
    if (!itemData) return "";
    const conflictInfo = checkMilestoneConflicts(itemData);
    if (!conflictInfo.hasConflict) return "";

    const message = conflictInfo.tooltip.replace(/\n/g, "<br>");
    return `
      <div class="p-4 mb-6 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200 rounded-md">
          <h4 class="font-bold">Marco em Risco</h4>
          <p>${message}</p>
      </div>`;
  }

  function _renderInfoAndValuesCardForModal(itemData) {
    const { relatedTasks } = itemData || {};
    if (!relatedTasks || relatedTasks.length === 0) {
      return `<h3 class="text-lg font-semibold text-primary mb-3">Informações Gerais</h3><p class="text-tertiary">Nenhuma tarefa encontrada.</p>`;
    }

    const plannedDates = (() => {
      const dates = relatedTasks
        .map((task) => ({
          start: task.target_start_date
            ? new Date(task.target_start_date.replace(" ", "T"))
            : null,
          end: task.target_end_date
            ? new Date(task.target_end_date.replace(" ", "T"))
            : null,
        }))
        .filter((d) => d.start && d.end);
      if (dates.length === 0) return { start: "N/A", end: "N/A" };
      const minStart = new Date(
        Math.min.apply(
          null,
          dates.map((d) => d.start)
        )
      );
      const maxEnd = new Date(
        Math.max.apply(
          null,
          dates.map((d) => d.end)
        )
      );
      return {
        start: utils.formatBrazilianDate(minStart),
        end: utils.formatBrazilianDate(maxEnd),
      };
    })();

    const trendDates = (() => {
      const dates = relatedTasks
        .map((task) => ({
          start:
            task.act_start_date || task.restart_date
              ? new Date(
                  (task.act_start_date || task.restart_date).replace(" ", "T")
                )
              : null,
          end:
            task.act_end_date || task.reend_date
              ? new Date(
                  (task.act_end_date || task.reend_date).replace(" ", "T")
                )
              : null,
        }))
        .filter((d) => d.start && d.end);
      if (dates.length === 0)
        return { start: "N/A", end: "N/A", endLabel: "Término (Tendência)" };
      const minStart = new Date(
        Math.min.apply(
          null,
          dates.map((d) => d.start)
        )
      );
      const maxEnd = new Date(
        Math.max.apply(
          null,
          dates.map((d) => d.end)
        )
      );
      const endLabel = relatedTasks.every((t) => t.act_end_date)
        ? "Término Real"
        : "Término (Tendência)";
      return {
        start: utils.formatBrazilianDate(minStart),
        end: utils.formatBrazilianDate(maxEnd),
        endLabel,
      };
    })();

    const customValue = customValuesData.get(currentOpenItemId);
    const hasCustomValues =
      customValue &&
      (customValue.planned != null || customValue.actual != null);
    let customValuesHtml = "";
    if (hasCustomValues) {
      const planned = customValue.planned ?? 0;
      const actual = customValue.actual ?? 0;
      const remaining = planned - actual;
      customValuesHtml = `
            <div class="mt-4 pt-4 border-t border-border-primary">
                <h4 class="text-base font-semibold text-primary mb-2">Valores Topográficos</h4>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div class="info-grid-item-small"><span class="block text-xs font-medium text-tertiary">Previsto</span><span class="text-base font-bold text-primary">${utils.formatNumberBR(
                      planned
                    )}</span></div>
                    <div class="info-grid-item-small"><span class="block text-xs font-medium text-tertiary">Realizado</span><span class="text-base font-bold text-primary">${utils.formatNumberBR(
                      actual
                    )}</span></div>
                    <div class="info-grid-item-small"><span class="block text-xs font-medium text-tertiary">Saldo</span><span class="text-base font-bold text-primary">${utils.formatNumberBR(
                      remaining
                    )}</span></div>
                </div>
            </div>
        `;
    }

    return `<h3 class="text-lg font-semibold text-primary mb-3">Informações Gerais</h3><div class="grid grid-cols-2 lg:grid-cols-4 gap-4"><div class="info-grid-item"><span class="block text-sm font-medium text-tertiary">Início Planejado</span><span class="text-lg font-bold text-primary">${plannedDates.start}</span></div><div class="info-grid-item"><span class="block text-sm font-medium text-tertiary">Término Planejado</span><span class="text-lg font-bold text-primary">${plannedDates.end}</span></div><div class="info-grid-item"><span class="block text-sm font-medium text-tertiary">Início (Tendência)</span><span class="text-lg font-bold text-primary">${trendDates.start}</span></div><div class="info-grid-item"><span class="block text-sm font-medium text-tertiary">${trendDates.endLabel}</span><span class="text-lg font-bold text-primary">${trendDates.end}</span></div></div>${customValuesHtml}`;
  }

  function _renderPhotoSectionForModal() {
    return `<div id="photo-section"><h3 class="text-lg font-semibold text-primary mb-3">Foto da Atividade</h3><div id="photo-content-wrapper" class="bg-tertiary rounded-lg border border-border-primary min-h-[300px] flex items-center justify-center overflow-hidden">${renderPhotoContent()}</div></div>`;
  }

  function _renderRestrictionsSectionForModal() {
    return `<div id="restrictions-section" class="pt-6 border-t border-border-primary"><div class="flex justify-between items-center mb-3"><h3 class="text-lg font-semibold text-primary">Restrições Vinculadas</h3><div class="flex gap-2"><button id="create-new-restriction-btn" class="px-3 py-1.5 bg-green-100 dark:bg-green-900 dark:text-green-200 text-green-800 rounded-md hover:bg-green-200 dark:hover:bg-green-800 text-sm font-semibold">Criar Nova</button><button id="add-restriction-link-btn" class="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 dark:text-blue-200 text-blue-800 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 text-sm font-semibold">Vincular Existente</button></div></div><div id="item-restrictions-list"></div></div>`;
  }

  function _renderExecutionPlanContainer() {
    const hasPlan = activityDetailsMap.has(currentOpenItemId);
    const buttonText = hasPlan ? "Editar Plano" : "Criar Plano";
    return `<div id="plan-section" class="pt-6 border-t border-border-primary"><div class="flex justify-between items-center mb-3"><h3 class="text-lg font-semibold text-primary">Plano de Execução Detalhado</h3><button id="toggle-plan-edit-btn" class="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 text-sm font-semibold">${buttonText}</button></div><div id="execution-plan-content">${renderExecutionPlan_ViewMode()}</div></div>`;
  }

  async function openModal(itemId, itemName) {
    currentOpenItemId = itemId;
    lastFocusedElement = document.activeElement;
    modalItemName.textContent = itemName;

    const itemData = findItemInWeekTree(currentOpenItemId);

    modalBody.innerHTML = `
        <div id="modal-alerts-container">${_renderMilestoneAlertForModal(
          itemData
        )}</div>
        <div class="space-y-6">
          ${_renderPhotoSectionForModal()}
          ${_renderInfoAndValuesCardForModal(itemData)}
          ${_renderRestrictionsSectionForModal()}
          ${_renderExecutionPlanContainer()}
        </div>`;

    setupPhotoEventListeners();
    await renderItemRestrictionsList();
    modal.classList.add("active");
    document.body.classList.add("modal-open");
    modalContent.focus();
  }

  function renderPhotoContent() {
    const media = activityMediaMap.get(currentOpenItemId);

    if (media && media.imageUrl) {
      return `<div class="relative group w-full h-full">
                  <img src="${media.imageUrl}" alt="Foto da atividade" class="w-full h-full object-cover cursor-pointer">
                  <button class="remove-photo-btn absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100" title="Remover Foto">&times;</button>
               </div>`;
    } else {
      return `<div class="text-center p-4">
                  <p class="text-tertiary mb-2">Sem foto. Arraste e solte uma imagem aqui, cole da área de transferência (Ctrl+V) ou clique para selecionar.</p>
                  <label for="photo-upload-input" class="file-input-label text-sm">Selecionar Foto</label>
                  <input type="file" id="photo-upload-input" class="sr-only" accept="image/*">
               </div>`;
    }
  }

  function setupPhotoEventListeners() {
    const photoWrapper = document.getElementById("photo-content-wrapper");
    if (!photoWrapper) return;
    photoWrapper.onclick = (e) => {
      if (e.target.closest(".remove-photo-btn")) {
        handleRemovePhoto();
      } else if (e.target.tagName === "IMG") {
        openFullscreen(e.target.src);
      } else if (e.target.closest('label[for="photo-upload-input"]')) {
        // Already handled by the label itself
      } else {
        const input = document.getElementById("photo-upload-input");
        if (input) input.click();
      }
    };
    const uploadInput = document.getElementById("photo-upload-input");
    if (uploadInput)
      uploadInput.onchange = (e) => handlePhotoUpload(e.target.files[0]);

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) =>
      photoWrapper.addEventListener(
        eventName,
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        false
      )
    );
    ["dragenter", "dragover"].forEach((eventName) =>
      photoWrapper.addEventListener(
        eventName,
        () => photoWrapper.classList.add("highlight"),
        false
      )
    );
    ["dragleave", "drop"].forEach((eventName) =>
      photoWrapper.addEventListener(
        eventName,
        () => photoWrapper.classList.remove("highlight"),
        false
      )
    );
    photoWrapper.addEventListener("drop", handlePhotoDrop, false);
    modal.addEventListener("paste", handlePhotoPaste);
  }

  function handlePhotoDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    handlePhotoUpload(file);
  }

  function handlePhotoPaste(e) {
    if (!modal.classList.contains("active")) return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        handlePhotoUpload(blob);
        break;
      }
    }
  }

  async function handlePhotoUpload(file) {
    if (!file || !currentOpenItemId) return;
    utils.showToast("Enviando foto...", "info");
    const photoWrapper = document.getElementById("photo-content-wrapper");
    photoWrapper.innerHTML =
      '<div class="text-tertiary flex items-center justify-center h-full">Enviando...</div>';

    try {
      const existingMedia = activityMediaMap.get(currentOpenItemId);
      if (existingMedia && existingMedia.storagePath) {
        await deleteObject(
          ref(firebaseStorage, existingMedia.storagePath)
        ).catch((err) =>
          console.warn("Old photo not found, continuing...", err)
        );
      }

      const storagePath = `activity_photos/${currentOpenItemId}_${Date.now()}_${
        file.name
      }`;
      const imageRef = ref(firebaseStorage, storagePath);
      await uploadBytes(imageRef, file);
      const imageUrl = await getDownloadURL(imageRef);

      const mediaData = {
        imageUrl,
        storagePath,
        uploadedAt: new Date().toISOString(),
      };
      await storage.saveActivityMedia(currentOpenItemId, mediaData);
      activityMediaMap.set(currentOpenItemId, mediaData);

      utils.showToast("Foto enviada com sucesso!", "success");
      photoWrapper.innerHTML = renderPhotoContent();
      const existingBadge = document.querySelector(
        `.item-entry[data-item-id="${currentOpenItemId}"] .photo-badge`
      );
      if (!existingBadge) {
        document
          .querySelector(
            `.item-entry[data-item-id="${currentOpenItemId}"] .flex.justify-between div`
          )
          ?.insertAdjacentHTML(
            "beforeend",
            '<span class="photo-badge" title="Este item possui foto">📸</span>'
          );
      }
    } catch (error) {
      console.error("Photo upload error:", error);
      utils.showToast(`Erro no upload: ${error.message}`, "error");
      photoWrapper.innerHTML = renderPhotoContent(); // Re-render to show upload button again
    }
  }

  async function handleRemovePhoto() {
    if (
      !currentOpenItemId ||
      !confirm("Tem certeza que deseja remover esta foto?")
    )
      return;
    utils.showToast("Removendo foto...", "info");
    const photoWrapper = document.getElementById("photo-content-wrapper");
    photoWrapper.innerHTML =
      '<div class="text-tertiary flex items-center justify-center h-full">Removendo...</div>';

    try {
      const media = activityMediaMap.get(currentOpenItemId);
      if (media && media.storagePath) {
        await deleteObject(ref(firebaseStorage, media.storagePath));
      }
      await storage.deleteActivityMedia(currentOpenItemId);
      activityMediaMap.delete(currentOpenItemId);

      utils.showToast("Foto removida.", "success");
      photoWrapper.innerHTML = renderPhotoContent();
      document
        .querySelector(
          `.item-entry[data-item-id="${currentOpenItemId}"] .photo-badge`
        )
        ?.remove();
    } catch (error) {
      console.error("Photo removal error:", error);
      utils.showToast(`Erro ao remover: ${error.message}`, "error");
      photoWrapper.innerHTML = renderPhotoContent();
    }
  }

  async function renderItemRestrictionsList() {
    const listContainer = document.getElementById("item-restrictions-list");
    if (!listContainer) return;

    // Unhide the action buttons container in case it was hidden
    const buttonsContainer =
      listContainer.previousElementSibling?.querySelector(".flex.gap-2");
    if (buttonsContainer) buttonsContainer.style.display = "flex";

    const currentLinks = restrictionLinks.filter(
      (link) => link.itemId === currentOpenItemId
    );
    const currentRestrictionIds = new Set(
      currentLinks.map((l) => l.restrictionId)
    );

    if (currentRestrictionIds.size === 0) {
      listContainer.innerHTML = `<p class="text-sm text-tertiary p-4 bg-tertiary rounded-md">Nenhuma restrição vinculada a este item.</p>`;
      return;
    }
    let html = '<div class="space-y-2">';
    restrictionsList.forEach((restr) => {
      if (currentRestrictionIds.has(restr.id)) {
        const statusClass =
          restr.status === "pending"
            ? "status-pending-restr"
            : "status-resolved-restr";
        html += `<div class="restriction-item text-sm"><div class="flex justify-between items-start"><div><p class="font-semibold text-primary">${
          restr.desc
        }</p><p class="text-tertiary">Prazo: ${utils.formatBrazilianDate(
          restr.due
        )}</p></div><span class="badge ${statusClass}">${
          restr.status === "pending" ? "Pendente" : "Resolvido"
        }</span></div></div>`;
      }
    });
    html += "</div>";
    listContainer.innerHTML = html;
  }

  function renderNewRestrictionFormForModal() {
    const listContainer = document.getElementById("item-restrictions-list");
    if (!listContainer) return;

    // Hide the action buttons
    const container = listContainer.previousElementSibling;
    container.querySelector(".flex.gap-2").style.display = "none";

    const mCategories = [
      "Método",
      "Máquina",
      "Mão de Obra",
      "Material",
      "Medição",
      "Meio Ambiente",
    ];

    listContainer.innerHTML = `
      <div class="p-4 bg-tertiary dark:bg-gray-800 rounded-lg border border-border-primary space-y-4">
          <h4 class="font-semibold text-primary">Criar Nova Restrição</h4>
          <div>
            <label for="new-restr-desc" class="form-label text-sm">Descrição</label>
            <input type="text" id="new-restr-desc" class="form-input text-sm" placeholder="Ex: Atraso na entrega de material...">
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="new-restr-resp" class="form-label text-sm">Responsável</label>
              <input type="text" id="new-restr-resp" class="form-input text-sm">
            </div>
            <div>
              <label for="new-restr-due" class="form-label text-sm">Prazo</label>
              <input type="date" id="new-restr-due" class="form-input text-sm">
            </div>
          </div>
          <div>
            <label class="form-label text-sm">Causa Raiz (6M)</label>
            <div class="flex flex-wrap gap-2 mt-1">
               ${mCategories
                 .map(
                   (cat) =>
                     `<button type="button" class="m-category-btn text-xs" data-category="${cat}">${cat}</button>`
                 )
                 .join("")}
            </div>
            <input type="hidden" id="new-restr-category">
          </div>
          <div class="text-right mt-4 pt-4 border-t border-border-primary">
            <button id="cancel-new-restriction-btn" class="px-3 py-1.5 bg-gray-200 text-primary rounded-md hover:bg-gray-300 text-sm font-semibold">Cancelar</button>
            <button id="save-new-restriction-btn" class="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-semibold ml-2">Salvar e Vincular</button>
          </div>
      </div>
    `;
  }

  async function saveNewRestrictionAndLink() {
    const btn = document.getElementById("save-new-restriction-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Salvando...";
    }

    try {
      const desc = document.getElementById("new-restr-desc").value.trim();
      if (!desc) {
        utils.showToast(
          "A descrição da restrição não pode ser vazia.",
          "error"
        );
        return;
      }

      const newRestriction = {
        id: utils.uuidv4(),
        desc: desc,
        resp: document.getElementById("new-restr-resp").value,
        due: document.getElementById("new-restr-due").value,
        status: "pending",
        category: document.getElementById("new-restr-category").value || null,
      };

      restrictionsList.push(newRestriction);

      const newLink = {
        restrictionId: newRestriction.id,
        itemId: currentOpenItemId,
      };
      restrictionLinks.push(newLink);

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

      const info = itemRestrictionInfoMap.get(currentOpenItemId) || {
        hasPending: false,
        pendingCount: 0,
        pendingCategories: new Set(),
      };
      info.hasPending = true;
      info.pendingCount++;
      if (newRestriction.category) {
        info.pendingCategories.add(newRestriction.category);
      }
      itemRestrictionInfoMap.set(currentOpenItemId, info);

      utils.showToast("Restrição criada e vinculada!", "success");

      await renderItemRestrictionsList();

      const restrictionBadge = document.querySelector(
        `.item-entry[data-item-id="${currentOpenItemId}"] .restriction-badge`
      );
      if (!restrictionBadge) {
        document
          .querySelector(
            `.item-entry[data-item-id="${currentOpenItemId}"] .flex.justify-between div`
          )
          ?.insertAdjacentHTML(
            "beforeend",
            `<span class="restriction-badge" title="${info.pendingCount} restrições pendentes">🚩</span>`
          );
      } else {
        restrictionBadge.title = `${info.pendingCount} restrições pendentes`;
      }
    } catch (error) {
      utils.showToast(`Erro ao salvar: ${error.message}`, "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Salvar e Vincular";
      }
    }
  }

  function renderExecutionPlan_ViewMode() {
    const plan = activityDetailsMap.get(currentOpenItemId) || [];
    if (plan.length === 0) {
      return `<p class="text-sm text-tertiary p-4 bg-tertiary rounded-md">Nenhuma etapa detalhada para este item.</p>`;
    }
    plan.sort(
      (a, b) =>
        (new Date(a.startDate) || 0) - (new Date(b.startDate) || 0) ||
        a.name.localeCompare(b.name)
    );
    const rows = plan
      .map(
        (step) => `
      <tr>
        <td class="text-primary py-2 px-3">${step.name}</td>
        <td class="py-2 px-3">${utils.formatBrazilianDate(step.startDate)}</td>
        <td class="py-2 px-3">${utils.formatBrazilianDate(step.endDate)}</td>
      </tr>`
      )
      .join("");
    return `<div class="table-container text-sm"><table><thead><tr><th class="py-2 px-3">Etapa</th><th class="py-2 px-3">Início</th><th class="py-2 px-3">Término</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderExecutionPlan_EditMode() {
    const contentDiv = document.getElementById("execution-plan-content");
    if (!contentDiv) return;

    const currentPlan = activityDetailsMap.get(currentOpenItemId) || [];
    currentPlan.sort(
      (a, b) =>
        (new Date(a.startDate) || 0) - (new Date(b.startDate) || 0) ||
        a.name.localeCompare(b.name)
    );

    const renderStepRow = (step = { name: "", startDate: "", endDate: "" }) => `
      <div class="execution-step">
        <input type="text" class="form-input flex-grow text-sm" placeholder="Descrição da etapa" value="${
          step.name || ""
        }">
        <input type="date" class="form-input text-sm" value="${
          step.startDate || ""
        }">
        <input type="date" class="form-input text-sm" value="${
          step.endDate || ""
        }">
        <button type="button" class="remove-step-btn" title="Remover Etapa">&times;</button>
      </div>`;

    contentDiv.innerHTML = `
      <div class="space-y-2" id="steps-list">
        ${
          currentPlan.length > 0
            ? currentPlan.map(renderStepRow).join("")
            : renderStepRow()
        }
      </div>
      <div class="flex justify-between items-center mt-3">
        <button id="add-step-btn" type="button" class="px-3 py-1.5 bg-gray-200 text-primary rounded-md hover:bg-gray-300 text-sm font-semibold">Adicionar Etapa</button>
        <div>
          <button id="cancel-plan-edit-btn" type="button" class="px-4 py-2 bg-gray-200 text-primary rounded-md hover:bg-gray-300 font-semibold">Cancelar</button>
          <button id="save-plan-btn" type="button" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold ml-2">Salvar Plano</button>
        </div>
      </div>`;
  }

  async function saveRestrictionLinks() {
    const tomSelect = activeTomSelect;
    if (!tomSelect || !currentOpenItemId) return;

    const btn = document.getElementById("save-restriction-links-btn");
    btn.disabled = true;
    btn.textContent = "Salvando...";

    try {
      const selectedIds = new Set(tomSelect.getValue());
      const otherLinks = restrictionLinks.filter(
        (l) => l.itemId !== currentOpenItemId
      );
      const newLinks = Array.from(selectedIds).map((id) => ({
        restrictionId: id,
        itemId: currentOpenItemId,
      }));
      restrictionLinks = [...otherLinks, ...newLinks];

      await storage.saveData(
        storage.APP_KEYS.RESTRICTION_LINKS_KEY,
        restrictionLinks
      );

      // Update local cache
      const pendingRestrictionsInLink = newLinks.filter((l) => {
        const restr = restrictionsList.find((r) => r.id === l.restrictionId);
        return restr && restr.status === "pending";
      });

      if (pendingRestrictionsInLink.length > 0) {
        const categories = new Set(
          pendingRestrictionsInLink
            .map(
              (l) =>
                restrictionsList.find((r) => r.id === l.restrictionId)?.category
            )
            .filter(Boolean)
        );
        itemRestrictionInfoMap.set(currentOpenItemId, {
          hasPending: true,
          pendingCount: pendingRestrictionsInLink.length,
          pendingCategories: categories,
        });
      } else {
        itemRestrictionInfoMap.delete(currentOpenItemId);
      }

      await renderItemRestrictionsList();

      const restrictionBadge = document.querySelector(
        `.item-entry[data-item-id="${currentOpenItemId}"] .restriction-badge`
      );
      const pendingCount =
        itemRestrictionInfoMap.get(currentOpenItemId)?.pendingCount || 0;

      if (pendingCount > 0) {
        if (!restrictionBadge) {
          document
            .querySelector(
              `.item-entry[data-item-id="${currentOpenItemId}"] .flex.justify-between div`
            )
            ?.insertAdjacentHTML(
              "beforeend",
              `<span class="restriction-badge" title="${pendingCount} restrições pendentes">🚩</span>`
            );
        } else {
          restrictionBadge.title = `${pendingCount} restrições pendentes`;
        }
      } else {
        restrictionBadge?.remove();
      }

      utils.showToast("Vínculos de restrição salvos!", "success");
    } catch (error) {
      utils.showToast(`Erro ao salvar: ${error.message}`, "error");
    } finally {
      if (activeTomSelect) {
        activeTomSelect.destroy();
        activeTomSelect = null;
      }
      btn.disabled = false;
      btn.textContent = "Adicionar/Editar Vínculos";
    }
  }

  function setupModal() {
    modalCloseBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // Checklist Runner Modal
    checklistRunnerModalCloseBtn.addEventListener(
      "click",
      closeChecklistRunnerModal
    );
    checklistRunnerCancelBtn.addEventListener(
      "click",
      closeChecklistRunnerModal
    );
    checklistRunnerModal.addEventListener("click", (e) => {
      if (e.target === checklistRunnerModal) closeChecklistRunnerModal();
    });

    // Restriction Linker Modal
    restrictionLinkerCloseBtn.addEventListener(
      "click",
      closeRestrictionLinkerModal
    );
    restrictionLinkerCancelBtn.addEventListener(
      "click",
      closeRestrictionLinkerModal
    );
    restrictionLinkerSaveBtn.addEventListener(
      "click",
      saveRestrictionLinksFromWorkspace
    );
    restrictionLinkerModal.addEventListener("click", (e) => {
      if (e.target === restrictionLinkerModal) closeRestrictionLinkerModal();
    });

    modalBody.addEventListener("click", async (e) => {
      if (e.target.id === "add-restriction-link-btn") {
        e.target.textContent = "Carregando...";
        e.target.disabled = true;
        const itemLinks = restrictionLinks
          .filter((l) => l.itemId === currentOpenItemId)
          .map((l) => l.restrictionId);
        const options = restrictionsList.map((r) => ({
          value: r.id,
          text: r.desc,
        }));
        const listContainer = document.getElementById("item-restrictions-list");
        listContainer.innerHTML = `
                <select id="restriction-link-select" multiple></select>
                <div class="text-right mt-2">
                    <button id="cancel-restriction-link-btn" class="px-3 py-1.5 bg-gray-200 text-primary rounded-md hover:bg-gray-300 text-sm font-semibold">Cancelar</button>
                    <button id="save-restriction-links-btn" class="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-semibold ml-2">Salvar Vínculos</button>
                </div>`;

        activeTomSelect = new TomSelect("#restriction-link-select", {
          options,
          plugins: ["remove_button"],
        });
        activeTomSelect.setValue(itemLinks);

        document.getElementById("save-restriction-links-btn").onclick =
          saveRestrictionLinks;
        document.getElementById("cancel-restriction-link-btn").onclick =
          async () => {
            if (activeTomSelect) {
              activeTomSelect.destroy();
              activeTomSelect = null;
            }
            await renderItemRestrictionsList();
          };

        return;
      }

      if (e.target.id === "create-new-restriction-btn") {
        renderNewRestrictionFormForModal();
        return;
      }

      if (e.target.id === "cancel-new-restriction-btn") {
        await renderItemRestrictionsList();
        return;
      }

      if (e.target.id === "save-new-restriction-btn") {
        await saveNewRestrictionAndLink();
        return;
      }

      if (
        e.target.closest(".m-category-btn") &&
        e.target.closest("#item-restrictions-list")
      ) {
        const btn = e.target.closest(".m-category-btn");
        const categoryInput = document.getElementById("new-restr-category");
        const isAlreadyActive = btn.classList.contains("active");
        btn.parentElement
          .querySelectorAll(".active")
          .forEach((b) => b.classList.remove("active"));
        if (isAlreadyActive) {
          if (categoryInput) categoryInput.value = "";
        } else {
          btn.classList.add("active");
          if (categoryInput) categoryInput.value = btn.dataset.category;
        }
        return;
      }

      if (e.target.id === "toggle-plan-edit-btn") {
        renderExecutionPlan_EditMode();
        return;
      }

      if (e.target.id === "cancel-plan-edit-btn") {
        document.getElementById("execution-plan-content").innerHTML =
          renderExecutionPlan_ViewMode();
        return;
      }

      if (e.target.id === "save-plan-btn") {
        const btn = e.target;
        btn.textContent = "Salvando...";
        btn.disabled = true;

        const steps = Array.from(
          document.querySelectorAll("#steps-list .execution-step")
        )
          .map((el) => ({
            name: el.querySelector('input[type="text"]').value.trim(),
            startDate: el.querySelector('input[type="date"]:nth-of-type(1)')
              .value,
            endDate: el.querySelector('input[type="date"]:nth-of-type(2)')
              .value,
          }))
          .filter((s) => s.name);

        try {
          await storage.saveActivityDetails(currentOpenItemId, steps);
          activityDetailsMap.set(currentOpenItemId, steps);
          utils.showToast("Plano salvo!", "success");
          document.getElementById("execution-plan-content").innerHTML =
            renderExecutionPlan_ViewMode();
          const toggleBtn = document.getElementById("toggle-plan-edit-btn");
          toggleBtn.textContent =
            steps.length > 0 ? "Editar Plano" : "Criar Plano";
        } catch (err) {
          utils.showToast(`Erro ao salvar: ${err.message}`, "error");
        }
        return;
      }

      if (e.target.id === "add-step-btn") {
        const list = document.getElementById("steps-list");
        const stepHtml = `<div class="execution-step"><input type="text" class="form-input flex-grow text-sm" placeholder="Descrição da etapa"><input type="date" class="form-input text-sm"><input type="date" class="form-input text-sm"><button type="button" class="remove-step-btn" title="Remover Etapa">&times;</button></div>`;
        list.insertAdjacentHTML("beforeend", stepHtml);
        return;
      }

      if (e.target.closest(".remove-step-btn")) {
        e.target.closest(".execution-step").remove();
      }
    });
  }

  function closeModal() {
    if (activeTomSelect) {
      activeTomSelect.destroy();
      activeTomSelect = null;
    }
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
    modal.removeEventListener("paste", handlePhotoPaste);
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  // --- Checklist Runner Functions ---
  async function openChecklistRunnerModal(wbsId, wbsName, runId) {
    lastFocusedElement = document.activeElement;
    document.body.classList.add("modal-open");

    // Store context in the modal's dataset
    checklistRunnerModal.dataset.wbsId = wbsId;
    checklistRunnerModal.dataset.runId = runId || "";

    const run = runId ? checklistRuns.find((r) => r.runId === runId) : null;

    if (checklists.length === 0) {
      checklistRunnerModalBody.innerHTML = `<div class="message-box info">Nenhum modelo de checklist foi configurado. Vá para a página de Configurações para criar um.</div>`;
      checklistRunnerSaveBtn.style.display = "none";
      checklistRunnerModal.classList.add("active");
      checklistRunnerModalCloseBtn.focus();
      return;
    }

    checklistRunnerSaveBtn.style.display = "inline-flex";
    checklistRunnerModalTitle.textContent = run
      ? `Ver/Editar Checklist`
      : `Executar Checklist`;
    checklistRunnerModalSubtitle.textContent = `Para WBS: ${wbsName}`;

    let bodyHtml;
    if (run) {
      // If a run exists, we don't need the template selector. Go straight to the form.
      bodyHtml = '<div id="checklist-runner-content"></div>';
    } else {
      // If it's a new run, show the template selector.
      bodyHtml = `
            <div class="space-y-4">
                <div>
                    <label for="checklist-template-select" class="form-label font-bold text-primary">Selecione um Checklist</label>
                    <select id="checklist-template-select" class="form-input">
                        <option value="">-- Escolha um modelo --</option>
                        ${checklists
                          .map(
                            (c) => `<option value="${c.id}">${c.name}</option>`
                          )
                          .join("")}
                    </select>
                </div>
                <div id="checklist-runner-content" class="mt-4"></div>
            </div>`;
    }

    checklistRunnerModalBody.innerHTML = bodyHtml;

    if (run) {
      renderChecklistRunnerForm(run.checklistId, wbsId, run);
    } else {
      const select = document.getElementById("checklist-template-select");
      select.onchange = () =>
        renderChecklistRunnerForm(select.value, wbsId, null);
    }

    checklistRunnerModal.classList.add("active");
  }

  function renderChecklistRunnerForm(checklistId, wbsId, run) {
    const contentDiv = document.getElementById("checklist-runner-content");
    if (!checklistId) {
      contentDiv.innerHTML = "";
      checklistRunnerSaveBtn.disabled = true;
      return;
    }

    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist) {
      contentDiv.innerHTML = `<p class="text-tertiary">Modelo de checklist não encontrado.</p>`;
      return;
    }

    // Store checklistId in the modal for the save function
    checklistRunnerModal.dataset.checklistId = checklistId;

    const savedAnswers = new Map(Object.entries(run?.answers || {}));

    const questionsHtml = checklist.items
      .map((item) => {
        const savedAnswerData = savedAnswers.get(item.id) || {};
        const answer = savedAnswerData.answer || "C"; // Default to "Conforme"

        return `
        <div class="p-3 border-b border-border-primary dark:border-gray-700" data-question-id="${
          item.id
        }">
            <p class="mb-2 text-primary">${
              item.question
            } <span class="text-xs text-tertiary font-mono">${
          item.category || ""
        }</span></p>
            <div class="flex gap-4">
                <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="q_${
                  item.id
                }" value="C" ${
          answer === "C" ? "checked" : ""
        } class="accent-blue-600"> C</label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="q_${
                  item.id
                }" value="NC" ${
          answer === "NC" ? "checked" : ""
        } class="accent-red-600"> NC</label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="q_${
                  item.id
                }" value="NA" ${
          answer === "NA" ? "checked" : ""
        } class="accent-gray-500"> NA</label>
            </div>
        </div>
      `;
      })
      .join("");

    contentDiv.innerHTML = `
      <div class="mt-4">
          <h4 class="font-semibold text-primary mb-2">Perguntas</h4>
          <div class="border border-border-primary dark:border-gray-600 rounded-md max-h-96 overflow-y-auto">${questionsHtml}</div>
      </div>`;

    checklistRunnerSaveBtn.disabled = false;
    checklistRunnerSaveBtn.onclick = saveChecklistRun;
  }

  async function saveChecklistRun() {
    checklistRunnerSaveBtn.disabled = true;
    checklistRunnerSaveBtn.textContent = "Salvando...";

    const wbsId = checklistRunnerModal.dataset.wbsId;
    const runId = checklistRunnerModal.dataset.runId || utils.uuidv4();
    const checklistId = checklistRunnerModal.dataset.checklistId;

    const checklistTemplate = checklists.find((c) => c.id === checklistId);
    if (!checklistTemplate) {
      utils.showToast("Erro: Modelo de checklist não encontrado.", "error");
      checklistRunnerSaveBtn.disabled = false;
      checklistRunnerSaveBtn.textContent = "Salvar Checklist";
      return;
    }

    // Use local copies to batch updates
    let allRuns = [...checklistRuns];
    let allRestrictions = [...restrictionsList];

    let run = allRuns.find((r) => r.runId === runId);
    if (!run) {
      run = {
        runId,
        wbsId,
        checklistId,
        createdAt: new Date().toISOString(),
        answers: {},
      };
      allRuns.push(run);
    }
    const oldAnswers = new Map(Object.entries(run.answers || {}));
    run.answers = {};

    const M_CATEGORIES_MAP = {
      MET: "Método",
      MAQ: "Máquina",
      MAO: "Mão de Obra",
      MAT: "Material",
      MED: "Medição",
      MEI: "Meio Ambiente",
    };
    const newRestrictionsGenerated = [];

    const questionElements =
      checklistRunnerModalBody.querySelectorAll("[data-question-id]");
    for (const qElement of questionElements) {
      const questionId = qElement.dataset.questionId;
      const radio = qElement.querySelector(
        `input[name="q_${questionId}"]:checked`
      );
      const newAnswer = radio ? radio.value : "NA";
      const questionTemplate = checklistTemplate.items.find(
        (it) => it.id === questionId
      );
      const oldAnswerData = oldAnswers.get(questionId);

      let restrictionId = oldAnswerData?.restrictionId || null;
      let restrictionExists = restrictionId
        ? allRestrictions.some((r) => r.id === restrictionId)
        : false;

      if (restrictionId && !restrictionExists) {
        restrictionId = null;
      }

      if (newAnswer === "NC") {
        if (restrictionExists) {
          const restr = allRestrictions.find((r) => r.id === restrictionId);
          if (restr && restr.status === "resolved") {
            restr.status = "pending";
          }
        } else {
          const newRestriction = {
            id: utils.uuidv4(),
            desc: questionTemplate.question,
            category:
              M_CATEGORIES_MAP[questionTemplate.category] ||
              questionTemplate.category ||
              null,
            status: "pending",
            resp: "",
            due: "",
            createdByChecklistRun: runId,
            createdByQuestion: questionId,
          };
          allRestrictions.push(newRestriction);
          newRestrictionsGenerated.push(newRestriction); // Collect for the linker
          restrictionId = newRestriction.id;
        }
      } else {
        // newAnswer is 'C' or 'NA'
        if (restrictionExists) {
          const restr = allRestrictions.find((r) => r.id === restrictionId);
          if (restr) restr.status = "resolved";
        }
      }

      run.answers[questionId] = {
        answer: newAnswer,
        restrictionId: restrictionId,
      };
    }

    // Persist run and restriction status changes
    checklistRuns = allRuns;
    restrictionsList = allRestrictions;
    checklistRunsByWbsId.set(wbsId, run);

    // If new restrictions were created, open the linker. Otherwise, just save and refresh.
    if (newRestrictionsGenerated.length > 0) {
      // Save the new restrictions first so they have an ID for the linker
      await Promise.all([
        storage.saveData(storage.APP_KEYS.CHECKLIST_RUNS_KEY, checklistRuns),
        storage.saveData(
          storage.APP_KEYS.RESTRICTIONS_LIST_KEY,
          restrictionsList
        ),
      ]);
      openRestrictionLinkerWorkspace(newRestrictionsGenerated, wbsId);
    } else {
      // Just save everything and refresh UI
      await Promise.all([
        storage.saveData(storage.APP_KEYS.CHECKLIST_RUNS_KEY, checklistRuns),
        storage.saveData(
          storage.APP_KEYS.RESTRICTIONS_LIST_KEY,
          restrictionsList
        ),
      ]);
      utils.showToast("Checklist salvo!", "success");
      closeChecklistRunnerModal();
      await renderCurrentWeekView();
    }

    checklistRunnerSaveBtn.disabled = false;
    checklistRunnerSaveBtn.textContent = "Salvar Checklist";
  }

  // --- Restriction Linker Workspace Functions ---

  async function openRestrictionLinkerWorkspace(newRestrictions, wbsId) {
    closeChecklistRunnerModal();
    lastFocusedElement = document.activeElement;
    document.body.classList.add("modal-open");
    restrictionLinkerModal.classList.add("active");

    restrictionLinksInMemory = new Map(
      newRestrictions.map((r) => [r.id, new Set()])
    );

    const leftPanelHtml = `
      <div class="restrictions-list-panel">
        <h3 class="text-lg font-bold text-primary mb-3">Restrições Geradas</h3>
        <div id="restrictions-list-items" class="space-y-2">
          ${newRestrictions
            .map(
              (r) => `
            <div class="restriction-link-item" data-restriction-id="${
              r.id
            }" tabindex="0">
              <p class="font-semibold text-primary pointer-events-none">${
                r.desc
              }</p>
              <p class="text-sm text-tertiary pointer-events-none">${
                r.category || "Sem categoria"
              }</p>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    const rightPanelHtml = `
      <div class="activities-tree-panel">
        <h3 class="text-lg font-bold text-primary mb-3">Vincular a: <span id="active-restriction-name" class="text-accent">Nenhuma</span></h3>
        <div id="activities-tree-container">
          <p class="text-tertiary text-center p-8">Selecione uma restrição à esquerda para começar.</p>
        </div>
      </div>
    `;

    restrictionLinkerBody.innerHTML = `
        <div id="restriction-workspace" data-wbs-id="${wbsId}">
            ${leftPanelHtml}
            ${rightPanelHtml}
        </div>`;

    restrictionLinkerBody.addEventListener("click", handleLinkerWorkspaceClick);
  }

  function handleLinkerWorkspaceClick(e) {
    const restrictionItem = e.target.closest(".restriction-link-item");
    if (restrictionItem) {
      if (activeRestrictionLinkerItem) {
        activeRestrictionLinkerItem.classList.remove("is-active");
      }
      activeRestrictionLinkerItem = restrictionItem;
      activeRestrictionLinkerItem.classList.add("is-active");

      const restrictionId = restrictionItem.dataset.restrictionId;
      const restrictionName =
        restrictionItem.querySelector("p.font-semibold").textContent;
      document.getElementById("active-restriction-name").textContent =
        restrictionName;

      const wbsId = document.getElementById("restriction-workspace").dataset
        .wbsId;
      const selectedIds =
        restrictionLinksInMemory.get(restrictionId) || new Set();
      renderActivitySelectionTree(wbsId, selectedIds);
      return;
    }

    const treeContainer = e.target.closest("#activities-tree-container");
    if (treeContainer) {
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
        if (!activeRestrictionLinkerItem) return;
        const restrictionId = activeRestrictionLinkerItem.dataset.restrictionId;
        const linksSet = restrictionLinksInMemory.get(restrictionId);
        if (!linksSet) return;

        const checkbox = e.target;
        const itemId = checkbox.dataset.itemId;

        if (checkbox.checked) {
          linksSet.add(itemId);
        } else {
          linksSet.delete(itemId);
        }

        // Cascade changes to children
        const childrenContainer = checkbox.closest(
          ".milestone-tree-item-content"
        ).nextElementSibling;
        if (childrenContainer) {
          childrenContainer
            .querySelectorAll('input[type="checkbox"]')
            .forEach((childCb) => {
              if (checkbox.checked) {
                linksSet.add(childCb.dataset.itemId);
                childCb.checked = true;
              } else {
                linksSet.delete(childCb.dataset.itemId);
                childCb.checked = false;
              }
            });
        }
        updateParentCheckbox(checkbox);
      }
    }
  }

  function updateParentCheckbox(childCheckbox) {
    const parentNode = childCheckbox
      .closest(".milestone-tree-children")
      ?.closest(".milestone-tree-node");
    if (!parentNode) return;

    const parentCheckbox = parentNode.querySelector(
      ':scope > .milestone-tree-item-content > input[type="checkbox"]'
    );
    if (!parentCheckbox) return;

    const allChildCheckboxes = Array.from(
      parentNode.querySelectorAll(
        '.milestone-tree-children input[type="checkbox"]'
      )
    );
    const checkedCount = allChildCheckboxes.filter((cb) => cb.checked).length;

    if (checkedCount === 0) {
      parentCheckbox.checked = false;
      parentCheckbox.indeterminate = false;
    } else if (checkedCount === allChildCheckboxes.length) {
      parentCheckbox.checked = true;
      parentCheckbox.indeterminate = false;
    } else {
      parentCheckbox.checked = false;
      parentCheckbox.indeterminate = true;
    }

    updateParentCheckbox(parentCheckbox); // Recurse up the tree
  }

  async function renderActivitySelectionTree(wbsId, selectedItemIdsSet) {
    const treeContainer = document.getElementById("activities-tree-container");
    if (!treeContainer) return;

    treeContainer.innerHTML = `<div class="skeleton skeleton-block h-48"></div>`;

    const wbsDescendants = fullTaskList.filter(
      (task) =>
        task.wbsPath.some((wbsNode) => wbsNode.stable_wbs_id === wbsId) &&
        task.status_code !== "TK_Complete"
    );

    // Build a tree structure from the flat list
    const itemsByParent = new Map();
    wbsDescendants.forEach((task) => {
      task.wbsPath.forEach((wbs, index, arr) => {
        const parentId = index > 0 ? arr[index - 1].stable_wbs_id : "root";
        if (!itemsByParent.has(parentId))
          itemsByParent.set(parentId, { wbs: new Map(), items: [] });
        if (!itemsByParent.get(parentId).wbs.has(wbs.stable_wbs_id)) {
          itemsByParent.get(parentId).wbs.set(wbs.stable_wbs_id, wbs);
        }
      });
      const deepestParentId =
        task.wbsPath.length > 0
          ? task.wbsPath[task.wbsPath.length - 1].stable_wbs_id
          : "root";
      if (!itemsByParent.has(deepestParentId))
        itemsByParent.set(deepestParentId, { wbs: new Map(), items: [] });

      const groupInfo = activityStageMap.get(task.task_code);
      const item = groupInfo
        ? {
            type: "group",
            id: `group::${groupInfo.groupId}`,
            name: `[Grupo] ${groupInfo.groupName}`,
          }
        : {
            type: "task",
            id: task.task_code,
            name: `${task.task_code} - ${task.task_name}`,
          };

      const parentItems = itemsByParent.get(deepestParentId).items;
      if (!parentItems.some((i) => i.id === item.id)) {
        parentItems.push(item);
      }
    });

    function buildTreeHtml(wbsNodeId) {
      let html = "";
      const nodeData = itemsByParent.get(wbsNodeId) || {
        wbs: new Map(),
        items: [],
      };

      const childrenWbs = Array.from(nodeData.wbs.values()).sort((a, b) =>
        a.wbs_name.localeCompare(b.wbs_name)
      );
      const childrenItems = nodeData.items.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      childrenWbs.forEach((wbs) => {
        const hasChildren = itemsByParent.has(wbs.stable_wbs_id);
        const isChecked = selectedItemIdsSet.has(wbs.stable_wbs_id);
        html += `
              <div class="milestone-tree-node" data-item-id="${
                wbs.stable_wbs_id
              }">
                  <div class="milestone-tree-item-content">
                      ${
                        hasChildren
                          ? '<button type="button" class="milestone-tree-toggle" aria-expanded="false">+</button>'
                          : '<span class="w-6 inline-block"></span>'
                      }
                      <input type="checkbox" id="check-${wbs.stable_wbs_id.replace(
                        /\W/g,
                        "_"
                      )}" data-item-id="${wbs.stable_wbs_id}" ${
          isChecked ? "checked" : ""
        }>
                      <label for="check-${wbs.stable_wbs_id.replace(
                        /\W/g,
                        "_"
                      )}">${wbs.wbs_name}</label>
                  </div>
                  ${
                    hasChildren
                      ? `<div class="milestone-tree-children pl-4" hidden>${buildTreeHtml(
                          wbs.stable_wbs_id
                        )}</div>`
                      : ""
                  }
              </div>`;
      });

      childrenItems.forEach((item) => {
        const isItemChecked = selectedItemIdsSet.has(item.id);
        html += `
              <div class="milestone-tree-node" data-item-id="${item.id}">
                   <div class="milestone-tree-item-content">
                      <span class="w-6 inline-block"></span>
                      <input type="checkbox" id="check-${item.id.replace(
                        /\W/g,
                        "_"
                      )}" data-item-id="${item.id}" ${
          isItemChecked ? "checked" : ""
        }>
                      <label for="check-${item.id.replace(/\W/g, "_")}">${
          item.name
        }</label>
                  </div>
              </div>
          `;
      });

      return html;
    }

    // Find the root WBS for the given wbsId to start building the tree
    const rootWbsForContext = wbsMap.get(wbsId);
    let initialHtml = "";
    if (rootWbsForContext) {
      const isChecked = selectedItemIdsSet.has(rootWbsForContext.stable_wbs_id);
      initialHtml = `
          <div class="milestone-tree-node" data-item-id="${
            rootWbsForContext.stable_wbs_id
          }">
              <div class="milestone-tree-item-content">
                  <button type="button" class="milestone-tree-toggle" aria-expanded="false">+</button>
                  <input type="checkbox" id="check-${rootWbsForContext.stable_wbs_id.replace(
                    /\W/g,
                    "_"
                  )}" data-item-id="${rootWbsForContext.stable_wbs_id}" ${
        isChecked ? "checked" : ""
      }>
                  <label for="check-${rootWbsForContext.stable_wbs_id.replace(
                    /\W/g,
                    "_"
                  )}">${rootWbsForContext.wbs_name}</label>
              </div>
              <div class="milestone-tree-children pl-4" hidden>${buildTreeHtml(
                rootWbsForContext.stable_wbs_id
              )}</div>
          </div>`;
    }

    treeContainer.innerHTML = initialHtml;
    // Set initial indeterminate states for all parent checkboxes
    treeContainer.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      const childrenContainer = cb.closest(
        ".milestone-tree-item-content"
      ).nextElementSibling;
      if (childrenContainer) {
        updateParentCheckbox(
          childrenContainer.querySelector('input[type="checkbox"]')
        );
      }
    });
  }

  async function saveRestrictionLinksFromWorkspace() {
    restrictionLinkerSaveBtn.disabled = true;
    restrictionLinkerSaveBtn.textContent = "Salvando...";

    try {
      const newLinks = [];
      for (const [
        restrictionId,
        itemIds,
      ] of restrictionLinksInMemory.entries()) {
        itemIds.forEach((itemId) => {
          newLinks.push({ restrictionId, itemId });
        });
      }

      restrictionLinks.push(...newLinks);
      await storage.saveData(
        storage.APP_KEYS.RESTRICTION_LINKS_KEY,
        restrictionLinks
      );

      // Update local cache for UI refresh
      newLinks.forEach((link) => {
        const restriction = restrictionsList.find(
          (r) => r.id === link.restrictionId
        );
        if (!restriction || restriction.status !== "pending") return;

        if (!itemRestrictionInfoMap.has(link.itemId)) {
          itemRestrictionInfoMap.set(link.itemId, {
            hasPending: false,
            pendingCount: 0,
            pendingCategories: new Set(),
          });
        }
        const info = itemRestrictionInfoMap.get(link.itemId);
        info.hasPending = true;
        info.pendingCount++;
        if (restriction.category)
          info.pendingCategories.add(restriction.category);
      });

      utils.showToast("Vínculos salvos com sucesso!", "success");
      closeRestrictionLinkerModal();
      await renderCurrentWeekView();
    } catch (error) {
      utils.showToast(`Erro ao salvar vínculos: ${error.message}`, "error");
    } finally {
      restrictionLinkerSaveBtn.disabled = false;
      restrictionLinkerSaveBtn.textContent = "Salvar Vínculos";
    }
  }

  function closeRestrictionLinkerModal() {
    restrictionLinkerModal.classList.remove("active");
    document.body.classList.remove("modal-open");
    restrictionLinkerBody.innerHTML = "";
    restrictionLinksInMemory.clear();
    activeRestrictionLinkerItem = null;
    if (lastFocusedElement) {
      lastFocusedElement.focus();
    }
  }

  function closeChecklistRunnerModal() {
    checklistRunnerModal.classList.remove("active");
    document.body.classList.remove("modal-open");
    // Clear dataset to avoid state bleed
    delete checklistRunnerModal.dataset.wbsId;
    delete checklistRunnerModal.dataset.runId;
    delete checklistRunnerModal.dataset.checklistId;

    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }

  function setupFullscreenViewer() {
    fullscreenCloseBtn.addEventListener("click", closeFullscreen);
    fullscreenViewer.addEventListener("click", (e) => {
      if (e.target === fullscreenViewer) closeFullscreen();
    });
    window.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        !fullscreenViewer.classList.contains("hidden")
      ) {
        closeFullscreen();
      }
    });
  }

  function openFullscreen(src) {
    fullscreenImage.src = src;
    fullscreenViewer.classList.remove("hidden");
    document.body.classList.add("modal-open");
    fullscreenCloseBtn.focus();
  }

  function closeFullscreen() {
    fullscreenViewer.classList.add("hidden");
    document.body.classList.remove("modal-open");
    fullscreenImage.src = "";
    if (lastFocusedElement) lastFocusedElement.focus();
  }
})();
