/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Centralizes all data loading and pre-processing logic for the application.
 * This module fetches raw data from the `storage` module and transforms it
 * into formats (like Maps) that are ready for consumption by the UI pages.
 */
import { storage } from "./storage.js";
import * as utils from "./utils.js";

/**
 * Fetches and processes all the core data needed for the main analysis pages.
 * This is an expensive call and should only be used on pages that need the full dataset.
 * @returns {Promise<Object>} An object containing all processed data structures.
 */
async function loadCoreData() {
  const [
    projectBase,
    projectVersions,
    mainResource,
    activityMapping,
    weeksData,
    customValues,
    restrictionsList,
    restrictionLinks,
    milestonesList,
    milestoneLinks,
    checklists,
    checklistRuns,
    activityMedia,
    activityDetails,
  ] = await Promise.all([
    storage.getProjectBase(),
    storage.getProjectVersions(),
    storage.getData(storage.APP_KEYS.MAIN_RESOURCE_KEY),
    storage.getData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY),
    storage.getData(storage.APP_KEYS.WEEKS_DATA_KEY),
    storage.getData(storage.APP_KEYS.CUSTOM_VALUES_KEY),
    storage.getData(storage.APP_KEYS.RESTRICTIONS_LIST_KEY),
    storage.getData(storage.APP_KEYS.RESTRICTION_LINKS_KEY),
    storage.getData(storage.APP_KEYS.MILESTONES_LIST_KEY),
    storage.getData(storage.APP_KEYS.MILESTONE_LINKS_KEY),
    storage.getData(storage.APP_KEYS.CHECKLISTS_KEY),
    storage.getData(storage.APP_KEYS.CHECKLIST_RUNS_KEY),
    storage.getActivityMedia(),
    storage.getActivityDetails(),
  ]);

  // --- Pre-process data into useful Maps ---
  const wbsMap = new Map(
    projectBase?.WBS_HIERARCHY?.rows.map((wbs) => [wbs.stable_wbs_id, wbs]) ||
      []
  );
  const customValuesMap = new Map(customValues.map((v) => [v.id, v]));
  const activityMediaMap = new Map(activityMedia.map((m) => [m.id, m]));
  const milestonesMap = new Map(milestonesList.map((m) => [m.id, m]));

  const activityDetailsMap = activityDetails.reduce((acc, detail) => {
    if (!acc.has(detail.parentId)) {
      acc.set(detail.parentId, []);
    }
    acc.get(detail.parentId).push(detail);
    return acc;
  }, new Map());

  const itemRestrictionInfoMap = new Map();
  restrictionLinks.forEach((link) => {
    const restriction = restrictionsList.find(
      (r) => r.id === link.restrictionId
    );
    if (restriction && restriction.status === "pending") {
      if (!itemRestrictionInfoMap.has(link.itemId)) {
        itemRestrictionInfoMap.set(link.itemId, {
          hasPending: true,
          pendingCount: 0,
          pendingCategories: new Set(),
        });
      }
      const info = itemRestrictionInfoMap.get(link.itemId);
      info.pendingCount++;
      if (restriction.category) {
        info.pendingCategories.add(restriction.category);
      }
    }
  });

  const itemMilestoneMap = new Map();
  milestoneLinks.forEach((link) => {
    if (!itemMilestoneMap.has(link.itemId)) {
      itemMilestoneMap.set(link.itemId, []);
    }
    itemMilestoneMap.get(link.itemId).push(link.milestoneId);
  });

  const checklistRunsByWbsId = new Map();
  checklistRuns.forEach((run) => {
    checklistRunsByWbsId.set(run.wbsId, run);
  });

  const latestVersionId = utils.getLatestProjectId(projectVersions);

  return {
    projectBase,
    projectVersions,
    mainResource,
    activityMapping,
    weeksData,
    customValuesMap,
    restrictionsList,
    restrictionLinks,
    milestonesMap,
    milestoneLinks,
    itemMilestoneMap,
    activityMediaMap,
    activityDetailsMap,
    wbsMap,
    latestVersionId,
    itemRestrictionInfoMap,
    checklists,
    checklistRuns,
    checklistRunsByWbsId,
  };
}

/**
 * Gets a unified list of selectable items (ungrouped tasks and groups).
 * @returns {Promise<Array<Object>>} A list of { value, text } objects for TomSelect.
 */
async function getSelectableItems() {
  const [projectBase, activityMapping] = await Promise.all([
    storage.getProjectBase(),
    storage.getData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY),
  ]);

  const allTasks = projectBase?.TASK?.rows || [];
  const groupedTaskCodes = new Set(activityMapping.flatMap((g) => g.taskCodes));

  const ungroupedTasks = allTasks
    .filter((task) => !groupedTaskCodes.has(task.task_code))
    .map((task) => ({
      value: task.task_code,
      text: `${task.task_code} - ${task.task_name}`,
    }));

  const groups = activityMapping.map((group) => ({
    value: `group::${group.groupId}`,
    text: `[Grupo] ${group.groupName}`,
  }));

  return [...ungroupedTasks, ...groups].sort((a, b) =>
    a.text.localeCompare(b.text)
  );
}

/**
 * Loads only the data needed for the main dashboard.
 * @returns {Promise<Object>}
 */
async function loadDashboardData() {
  const [projectBase, projectVersions, weeksData] = await Promise.all([
    storage.getProjectBase(),
    storage.getProjectVersions(),
    storage.getData(storage.APP_KEYS.WEEKS_DATA_KEY),
  ]);
  return { projectBase, projectVersions, weeksData };
}

/**
 * Loads only the data needed for the table visualizer.
 * @returns {Promise<Object>}
 */
async function loadViewerData() {
  const [projectBase, projectVersions] = await Promise.all([
    storage.getProjectBase(),
    storage.getProjectVersions(),
  ]);
  return { projectBase, projectVersions };
}

/**
 * Loads only the data needed for the configuration page.
 * @returns {Promise<Object>}
 */
async function loadCoreDataForConfig() {
  const [projectBase, activityMapping] = await Promise.all([
    storage.getProjectBase(),
    storage.getData(storage.APP_KEYS.ACTIVITY_MAPPING_KEY),
  ]);
  return { projectBase, activityMapping };
}

export const dataLoader = {
  loadCoreData,
  getSelectableItems,
  loadDashboardData,
  loadViewerData,
  loadCoreDataForConfig,
};
