/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Manages all data persistence for the application, providing a centralized
 * and abstract way to interact with Firebase Cloud Firestore.
 * This module now stores project data in separate collections for static base
 * data (`project_base`) and weekly progress (`project_versions`) to optimize
 * performance and scalability.
 */
import { db, initializationError } from "./firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const APP_KEYS = {
  WEEKS_DATA_KEY: "projectWeeksRangeData",
  MAIN_RESOURCE_KEY: "mainProgressResource",
  WEEKS_VIEW_GROUPING_KEY: "weeksViewGroupingConfig",
  WEEKS_VIEW_HIDDEN_ACTIVITIES_KEY: "weeksViewHiddenActivities",
  ACTIVITY_MAPPING_KEY: "activityMapping",
  CUSTOM_VALUES_KEY: "customActivityValues",
  RESTRICTIONS_LIST_KEY: "restrictionsList",
  RESTRICTION_LINKS_KEY: "restrictionLinks",
};

// This list is used to validate keys during import.
const ALL_CONFIG_KEYS = Object.values(APP_KEYS);

const STORAGE_DEFAULTS = {
  [APP_KEYS.WEEKS_DATA_KEY]: [],
  [APP_KEYS.MAIN_RESOURCE_KEY]: "",
  [APP_KEYS.WEEKS_VIEW_GROUPING_KEY]: [],
  [APP_KEYS.WEEKS_VIEW_HIDDEN_ACTIVITIES_KEY]: [],
  [APP_KEYS.ACTIVITY_MAPPING_KEY]: [],
  [APP_KEYS.CUSTOM_VALUES_KEY]: [],
  [APP_KEYS.RESTRICTIONS_LIST_KEY]: [],
  [APP_KEYS.RESTRICTION_LINKS_KEY]: [],
};

// If Firebase fails to initialize, db will be undefined, and we must handle this gracefully.
const configCollectionRef = !initializationError
  ? collection(db, "p6-app-data")
  : null;
const baseCollectionRef = !initializationError
  ? collection(db, "project_base")
  : null;
const versionsCollectionRef = !initializationError
  ? collection(db, "project_versions")
  : null;
const mediaCollectionRef = !initializationError
  ? collection(db, "activity_media")
  : null;

/**
 * Retrieves configuration data for a specific key from the 'p6-app-data' collection.
 * @param {string} key The key (and document ID) for the config data.
 * @returns {Promise<any>} The data or a default value if not found.
 */
async function getData(key) {
  if (!configCollectionRef) return STORAGE_DEFAULTS[key];
  try {
    const docRef = doc(configCollectionRef, key);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const documentData = docSnap.data();
      return documentData.data !== undefined
        ? documentData.data
        : STORAGE_DEFAULTS[key];
    } else {
      return STORAGE_DEFAULTS[key];
    }
  } catch (e) {
    console.error(`Error reading config document '${key}' from Firestore:`, e);
    return STORAGE_DEFAULTS[key];
  }
}

/**
 * Saves a configuration value to a specific key in the 'p6-app-data' collection.
 * @param {string} key The key (and document ID) for the data.
 * @param {any} value The data to save.
 */
async function saveData(key, value) {
  if (!configCollectionRef)
    throw new Error("Firebase not initialized, cannot save data.");
  try {
    const docRef = doc(configCollectionRef, key);
    await setDoc(docRef, { data: value });
  } catch (e) {
    console.error(`Error saving config document '${key}' to Firestore:`, e);
    throw e;
  }
}

/**
 * Retrieves the static base data of the project. Assumes one project per app instance.
 * @returns {Promise<Object | null>} The project base data object, or null if not found.
 */
async function getProjectBase() {
  if (!baseCollectionRef) return null;
  try {
    const docRef = doc(baseCollectionRef, "main_project");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (e) {
    console.error("Error fetching project base:", e);
    return null;
  }
}

/**
 * Saves the static base data of the project.
 * @param {Object} projectData The static project data to save.
 */
async function saveProjectBase(projectData) {
  if (!baseCollectionRef)
    throw new Error("Firebase not initialized, cannot save project base.");
  try {
    const docRef = doc(baseCollectionRef, "main_project");
    await setDoc(docRef, projectData);
  } catch (e) {
    console.error("Error saving project base:", e);
    throw e;
  }
}

/**
 * Retrieves all project version documents from the 'project_versions' collection.
 * @returns {Promise<Object>} An object where keys are version IDs and values are version data.
 */
async function getProjectVersions() {
  if (!versionsCollectionRef) return {};
  const versions = {};
  try {
    const querySnapshot = await getDocs(versionsCollectionRef);
    querySnapshot.forEach((doc) => {
      versions[doc.id] = doc.data();
    });
    return versions;
  } catch (e) {
    console.error("Error fetching all project versions:", e);
    return {};
  }
}

/**
 * Saves a single project version's data to the 'project_versions' collection.
 * @param {string} versionId The ID of the version (e.g., project ID from XER file).
 * @param {Object} versionData The version data object to save.
 */
async function saveProjectVersion(versionId, versionData) {
  if (!versionsCollectionRef)
    throw new Error("Firebase not initialized, cannot save project version.");
  try {
    const versionDocRef = doc(versionsCollectionRef, versionId);
    await setDoc(versionDocRef, versionData);
  } catch (e) {
    console.error(`Error saving project version '${versionId}':`, e);
    throw e;
  }
}

/**
 * Retrieves all media metadata documents from the 'activity_media' collection.
 * @returns {Promise<Array<Object>>} An array of media objects, each with id and data.
 */
async function getActivityMedia() {
  if (!mediaCollectionRef) return [];
  const media = [];
  try {
    const querySnapshot = await getDocs(mediaCollectionRef);
    querySnapshot.forEach((doc) => {
      media.push({ id: doc.id, ...doc.data() });
    });
    return media;
  } catch (e) {
    console.error("Error fetching activity media:", e);
    return [];
  }
}

/**
 * Saves a media metadata document for a specific item.
 * @param {string} itemId The ID of the task or group.
 * @param {Object} data The media data { imageUrl, storagePath, uploadedAt }.
 */
async function saveActivityMedia(itemId, data) {
  if (!mediaCollectionRef) throw new Error("Firebase not initialized.");
  try {
    const docRef = doc(mediaCollectionRef, itemId);
    await setDoc(docRef, data);
  } catch (e) {
    console.error(`Error saving media for item '${itemId}':`, e);
    throw e;
  }
}

/**
 * Deletes a media metadata document for a specific item.
 * @param {string} itemId The ID of the task or group to delete media for.
 */
async function deleteActivityMedia(itemId) {
  if (!mediaCollectionRef) throw new Error("Firebase not initialized.");
  try {
    const docRef = doc(mediaCollectionRef, itemId);
    await deleteDoc(docRef);
  } catch (e) {
    console.error(`Error deleting media for item '${itemId}':`, e);
    throw e;
  }
}

/**
 * Exports all data from all collections into a single structured JS object for backup.
 * @returns {Promise<Object>} An object containing all stored data.
 */
async function exportAllData() {
  if (
    !configCollectionRef ||
    !baseCollectionRef ||
    !versionsCollectionRef ||
    !mediaCollectionRef
  )
    return {};
  const backupData = {
    config: {},
    base: {},
    versions: {},
    media: {},
  };
  try {
    // Export config data
    const configSnapshot = await getDocs(configCollectionRef);
    configSnapshot.forEach((doc) => {
      backupData.config[doc.id] = doc.data().data;
    });

    // Export base project data
    const baseDoc = await getDoc(doc(baseCollectionRef, "main_project"));
    if (baseDoc.exists()) {
      backupData.base = baseDoc.data();
    }

    // Export versions data
    const versionsSnapshot = await getDocs(versionsCollectionRef);
    versionsSnapshot.forEach((doc) => {
      backupData.versions[doc.id] = doc.data();
    });

    // Export media data
    const mediaSnapshot = await getDocs(mediaCollectionRef);
    mediaSnapshot.forEach((doc) => {
      backupData.media[doc.id] = doc.data();
    });

    return backupData;
  } catch (e) {
    console.error("Error exporting all data from Firestore:", e);
    return { config: {}, base: {}, versions: {}, media: {} };
  }
}

/**
 * Imports data from a structured JS object, overwriting existing data.
 * @param {Object} data The object containing `config`, `base`, `versions`, and `media` data.
 * @returns {Promise<number>} The number of documents successfully written.
 */
async function importAllData(data) {
  if (
    !configCollectionRef ||
    !baseCollectionRef ||
    !versionsCollectionRef ||
    !mediaCollectionRef ||
    !data ||
    typeof data !== "object" ||
    !data.config ||
    !data.base ||
    !data.versions ||
    !data.media
  ) {
    throw new Error("Invalid backup file structure.");
  }

  const batch = writeBatch(db);

  // Import config data
  for (const key in data.config) {
    if (
      Object.hasOwnProperty.call(data.config, key) &&
      ALL_CONFIG_KEYS.includes(key)
    ) {
      const docRef = doc(configCollectionRef, key);
      batch.set(docRef, { data: data.config[key] });
    }
  }

  // Import base project data
  if (Object.keys(data.base).length > 0) {
    const docRef = doc(baseCollectionRef, "main_project");
    batch.set(docRef, data.base);
  }

  // Import versions data
  for (const versionId in data.versions) {
    if (Object.hasOwnProperty.call(data.versions, versionId)) {
      const docRef = doc(versionsCollectionRef, versionId);
      batch.set(docRef, data.versions[versionId]);
    }
  }

  // Import media data
  for (const itemId in data.media) {
    if (Object.hasOwnProperty.call(data.media, itemId)) {
      const docRef = doc(mediaCollectionRef, itemId);
      batch.set(docRef, data.media[itemId]);
    }
  }

  try {
    await batch.commit();
    // Batch writes don't return a count, so we calculate it.
    const count =
      Object.keys(data.config).length +
      (Object.keys(data.base).length > 0 ? 1 : 0) +
      Object.keys(data.versions).length +
      Object.keys(data.media).length;
    return count;
  } catch (e) {
    console.error("Error importing all data to Firestore:", e);
    throw e;
  }
}

// Expose the public API for the storage module
export const storage = {
  APP_KEYS,
  getData,
  saveData,
  getProjectBase,
  saveProjectBase,
  getProjectVersions,
  saveProjectVersion,
  getActivityMedia,
  saveActivityMedia,
  deleteActivityMedia,
  exportAllData,
  importAllData,
};
