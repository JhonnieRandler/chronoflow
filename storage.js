/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Manages all data persistence for the application, providing a centralized
 * and abstract way to interact with the browser's storage.
 * This approach allows for easier future modifications, such as migrating
 * from localStorage to another storage mechanism like IndexedDB, by
 * changing only this file.
 */

const APP_KEYS = {
  PROJECTS_DATA_KEY: "allProjectsData",
  TASKRSRC_DATA_KEY: "allTaskRsrcData",
  WEEKS_DATA_KEY: "projectWeeksRangeData",
  MAIN_RESOURCE_KEY: "mainProgressResource",
  WEEKS_VIEW_GROUPING_KEY: "weeksViewGroupingConfig",
  WEEKS_VIEW_HIDDEN_ACTIVITIES_KEY: "weeksViewHiddenActivities",
  ACTIVITY_MAPPING_KEY: "activityMapping",
  CUSTOM_VALUES_KEY: "customActivityValues",
};

const ALL_DATA_KEYS = Object.values(APP_KEYS);

/**
 * Provides default values for each storage key to ensure type safety
 * and prevent errors when data is not yet present in storage.
 */
const STORAGE_DEFAULTS = {
  [APP_KEYS.PROJECTS_DATA_KEY]: {},
  [APP_KEYS.TASKRSRC_DATA_KEY]: [],
  [APP_KEYS.WEEKS_DATA_KEY]: [],
  [APP_KEYS.MAIN_RESOURCE_KEY]: "",
  [APP_KEYS.WEEKS_VIEW_GROUPING_KEY]: [],
  [APP_KEYS.WEEKS_VIEW_HIDDEN_ACTIVITIES_KEY]: [],
  [APP_KEYS.ACTIVITY_MAPPING_KEY]: [],
  [APP_KEYS.CUSTOM_VALUES_KEY]: [],
};

/**
 * Retrieves and parses data from localStorage for a given key.
 * If the data doesn't exist or a parsing error occurs, it returns a
 * predefined default value for that key.
 * @param {string} key The key for the data to retrieve (should be one of APP_KEYS).
 * @returns {any} The parsed data or its default value.
 */
function getData(key) {
  try {
    const item = localStorage.getItem(key);
    // For string values like MAIN_RESOURCE_KEY, we don't parse JSON
    if (key === APP_KEYS.MAIN_RESOURCE_KEY) {
      return item === null ? STORAGE_DEFAULTS[key] : item;
    }
    return item ? JSON.parse(item) : STORAGE_DEFAULTS[key] || null;
  } catch (e) {
    console.error(`Error reading or parsing ${key} from storage:`, e);
    return STORAGE_DEFAULTS[key] || null;
  }
}

/**
 * Stringifies and saves data to localStorage for a given key.
 * If the value is null or undefined, the key is removed from storage.
 * @param {string} key The key for the data to save (should be one of APP_KEYS).
 * @param {any} value The data to be saved.
 */
function saveData(key, value) {
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      // For simple strings, no need to stringify
      const valueToStore =
        typeof value === "string" ? value : JSON.stringify(value);
      localStorage.setItem(key, valueToStore);
    }
  } catch (e) {
    console.error(`Error saving ${key} to storage:`, e);
  }
}

/**
 * Gathers all application data from localStorage for backup purposes.
 * @returns {Object} An object containing all stored data as raw strings.
 */
function exportAllData() {
  const backupData = {};
  ALL_DATA_KEYS.forEach((key) => {
    const data = localStorage.getItem(key);
    if (data) {
      backupData[key] = data;
    }
  });
  return backupData;
}

/**
 * Imports a data backup, restoring all data into localStorage.
 * @param {Object} data The backup data object with raw string values.
 * @returns {number} The number of keys successfully imported.
 */
function importAllData(data) {
  let importedKeys = 0;
  ALL_DATA_KEYS.forEach((key) => {
    if (data[key]) {
      localStorage.setItem(key, data[key]);
      importedKeys++;
    }
  });
  return importedKeys;
}

// Expose the public API for the storage module
const storage = {
  APP_KEYS,
  getData,
  saveData,
  exportAllData,
  importAllData,
};
