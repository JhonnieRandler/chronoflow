/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Provides reusable UI components and rendering functions to create a simple
 * "template engine", separating presentation from logic. This module exports
 * a generic Modal class and various functions to render common UI elements
 * like skeletons, tables, and message boxes.
 */
import * as utils from "./utils.js";

/**
 * A reusable Modal class to handle dialogs across the application.
 * It manages state, content, focus trapping, and events for a generic modal element.
 */
export class Modal {
  #modal;
  #content;
  #title;
  #subtitle;
  #headerActions;
  #body;
  #footer;
  #saveBtn;
  #cancelBtn;
  #closeBtns;

  #lastFocusedElement = null;
  #saveHandler = null;
  #cancelHandler = null;
  #onOpen = null;
  #onClose = null;

  /**
   * @param {string} modalId The ID of the main modal overlay element.
   */
  constructor(modalId) {
    this.#modal = document.getElementById(modalId);
    if (!this.#modal) {
      throw new Error(`Modal element with ID '${modalId}' not found.`);
    }

    // Find components within the modal structure
    this.#content = this.#modal.querySelector(".modal-content");
    this.#title = this.#modal.querySelector("#modal-title");
    this.#subtitle = this.#modal.querySelector("#modal-subtitle");
    this.#headerActions = this.#modal.querySelector("#modal-header-actions");
    this.#body = this.#modal.querySelector("#modal-body");
    this.#footer = this.#modal.querySelector("#modal-footer");
    this.#saveBtn = this.#modal.querySelector("#modal-save-btn");
    this.#cancelBtn = this.#modal.querySelector("#modal-cancel-btn");
    this.#closeBtns = this.#modal.querySelectorAll(
      "#modal-close-btn, .modal-close-btn"
    );

    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleBackdropClick = this._handleBackdropClick.bind(this);
    this._init();
  }

  _init() {
    this.#closeBtns.forEach((btn) =>
      btn.addEventListener("click", () => this.close())
    );
    this.#cancelBtn?.addEventListener("click", () => this._handleCancel());
    this.#saveBtn?.addEventListener("click", () => this._handleSave());
    this.#modal.addEventListener("click", this._handleBackdropClick);
  }

  open({
    title,
    subtitle = "",
    bodyHtml = "",
    saveHandler = null,
    cancelHandler = null,
    headerAction = null,
    customClass = "",
    showFooter = true,
    onOpen = null,
    onClose = null,
  }) {
    this.#lastFocusedElement = document.activeElement;

    this.#modal.className = "modal-overlay";
    if (customClass) {
      customClass.split(" ").forEach((cls) => {
        if (cls) this.#modal.classList.add(cls);
      });
    }

    this.#modal.setAttribute("aria-hidden", "false");
    this.#content.setAttribute("role", "dialog");
    this.#content.setAttribute("aria-modal", "true");
    if (this.#title)
      this.#content.setAttribute("aria-labelledby", "modal-title");

    this.setTitle(title);
    this.setSubtitle(subtitle);
    this.setBody(bodyHtml);

    this.#saveHandler = saveHandler;
    this.#cancelHandler = cancelHandler;
    this.#onOpen = onOpen;
    this.#onClose = onClose;

    if (this.#headerActions) {
      this.#headerActions.innerHTML = "";
      this.#headerActions.style.display = "none";
      if (headerAction) {
        this.#headerActions.style.display = "block";
        const btn = document.createElement("button");
        btn.id = headerAction.id;
        btn.innerHTML = headerAction.icon;
        btn.title = headerAction.tooltip;
        btn.setAttribute("aria-label", headerAction.tooltip);
        btn.className =
          "bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors";
        this.#headerActions.appendChild(btn);
      }
    }

    if (this.#footer) {
      this.#footer.style.display = showFooter ? "flex" : "none";
    }
    if (this.#saveBtn) {
      this.showSaveButton(!!saveHandler);
      this.#saveBtn.disabled = true;
    }

    document.body.classList.add("modal-open");
    this.#modal.classList.add("active");
    document.addEventListener("keydown", this._handleKeyDown);

    if (typeof this.#onOpen === "function") this.#onOpen();
    this._focusFirstElement();
  }

  close() {
    // Prevent closing if not open.
    if (!this.#modal.classList.contains("active")) {
      return;
    }

    document.body.classList.remove("modal-open");
    this.#modal.classList.remove("active");
    this.#modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", this._handleKeyDown);

    // Important: Store the callback, then nullify the instance property *before* calling the callback.
    // This prevents race conditions where the callback itself might re-open this same modal
    // and set a new `onClose` handler, which would then be incorrectly nulled by this method's completion.
    const closeCallback = this.#onClose;

    this.setBody("");
    this.#saveHandler = null;
    this.#cancelHandler = null;
    this.#onOpen = null;
    this.#onClose = null; // Reset instance property.

    if (this.#lastFocusedElement) {
      this.#lastFocusedElement.focus();
    }
    this.#lastFocusedElement = null;

    if (typeof closeCallback === "function") {
      closeCallback();
    }
  }

  // Setters
  setTitle(text) {
    if (this.#title) this.#title.textContent = text;
  }
  setSubtitle(text) {
    if (this.#subtitle) this.#subtitle.textContent = text;
  }
  setBody(html) {
    if (this.#body) this.#body.innerHTML = html;
  }
  setSaveHandler(handler) {
    this.#saveHandler = handler;
  }
  setCancelHandler(handler) {
    this.#cancelHandler = handler;
  }
  setCancelText(text) {
    if (this.#cancelBtn) this.#cancelBtn.textContent = text;
  }
  enableSaveButton() {
    if (this.#saveBtn) this.#saveBtn.disabled = false;
  }
  showSaveButton(show) {
    if (this.#saveBtn)
      this.#saveBtn.style.display = show ? "inline-flex" : "none";
  }
  showHeaderAction(show = true) {
    if (this.#headerActions)
      this.#headerActions.style.display = show ? "block" : "none";
  }
  hideHeaderAction() {
    this.showHeaderAction(false);
  }

  async _handleSave() {
    if (!this.#saveHandler || !this.#saveBtn || this.#saveBtn.disabled) return;
    const originalText = this.#saveBtn.textContent;
    this.#saveBtn.disabled = true;
    this.#saveBtn.textContent = "Salvando...";
    try {
      await this.#saveHandler(this);
    } catch (error) {
      console.warn("Save handler rejected:", error.message);
      this.#saveBtn.disabled = false;
      this.#saveBtn.textContent = originalText;
    }
  }

  _handleCancel() {
    if (typeof this.#cancelHandler === "function") {
      this.#cancelHandler();
    } else {
      this.close();
    }
  }

  _handleBackdropClick(event) {
    if (event.target === this.#modal) {
      this.close();
    }
  }

  _handleKeyDown(event) {
    if (event.key === "Escape") this.close();
    if (event.key === "Tab") this._trapFocus(event);
  }

  _trapFocus(event) {
    const focusableElements = Array.from(
      this.#content.querySelectorAll(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0);
    if (focusableElements.length === 0) return;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }

  _focusFirstElement() {
    const focusableElements = this.#content.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements.length > 0) {
      const first = [...focusableElements].find((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      });
      if (first) first.focus();
    }
  }
}

// --- Generic Skeletons ---

export function renderDashboardSkeleton() {
  const skeletonItem = `
    <div class="project-list-item">
      <div class="flex-grow pr-4">
        <div class="skeleton h-5 w-3/4 rounded-md"></div>
      </div>
      <div class="w-1/3">
        <div class="skeleton h-5 w-full rounded-md"></div>
      </div>
    </div>`;
  return `
    <div>
        <div class="skeleton h-8 w-64 rounded-md mb-4"></div>
        <div class="space-y-2">${skeletonItem.repeat(3)}</div>
        <div class="sr-only" aria-live="polite">Carregando versões do projeto.</div>
    </div>`;
}

export function renderTableSkeleton(columnCount = 5, rowCount = 5) {
  const headerCells = Array(columnCount)
    .fill('<th><div class="skeleton skeleton-text"></div></th>')
    .join("");
  const bodyCells = Array(columnCount)
    .fill('<td><div class="skeleton skeleton-text"></div></td>')
    .join("");
  const bodyRows = Array(rowCount).fill(`<tr>${bodyCells}</tr>`).join("");
  return `
    <div class="table-container">
        <table class="w-full">
            <thead><tr>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
        </table>
    </div>`;
}

export function renderSixWeekViewSkeleton() {
  return `
    <div class="card p-4 md:p-8 bg-secondary" aria-live="polite" aria-busy="true">
        <div class="sr-only">Carregando dados da semana.</div>
         <div class="week-card-header flex flex-col items-center md:items-start text-center md:text-left md:flex-row md:items-center justify-between border-b-2 border-border-accent pb-3 mb-3 md:border-b md:border-border-primary">
            <div class="w-full md:w-3/4">
                <div class="skeleton h-7 w-3/4 md:w-1/2 rounded-md"></div>
                <div class="skeleton h-5 w-1/2 md:w-1/3 rounded-md mt-2"></div>
            </div>
            <div class="skeleton h-9 w-32 rounded-md mt-4 md:mt-0"></div>
        </div>
        <div class="mt-4 space-y-6">
             <div class="wbs-group">
                <div class="wbs-title">
                    <div class="skeleton h-6 w-3/5 rounded-md"></div>
                </div>
                <div class="wbs-content !max-h-full">
                    <div class="item-list space-y-3">
                         <div class="item-entry">
                            <div class="flex justify-between items-center">
                                <div class="skeleton h-5 w-4/5 rounded-md"></div>
                                <div class="skeleton h-5 w-12 rounded-full"></div>
                            </div>
                            <div class="skeleton h-4 w-1/3 rounded-md mt-2"></div>
                        </div>
                        <div class="item-entry">
                            <div class="flex justify-between items-center">
                                <div class="skeleton h-5 w-3/4 rounded-md"></div>
                                <div class="skeleton h-5 w-12 rounded-full"></div>
                            </div>
                            <div class="skeleton h-4 w-2/5 rounded-md mt-2"></div>
                        </div>
                    </div>
                </div>
            </div>
             <div class="wbs-group">
                <div class="wbs-title">
                    <div class="skeleton h-6 w-1/2 rounded-md"></div>
                </div>
            </div>
        </div>
    </div>`;
}

export function renderAnalysisSkeleton() {
  return `
        <div role="status" aria-label="Carregando análise da atividade">
            <div class="card p-6 bg-secondary">
                <div class="flex justify-between items-start mb-2">
                    <div class="skeleton skeleton-title" style="width: 70%;"></div>
                    <div class="skeleton skeleton-block" style="width: 100px; height: 1.75rem;"></div>
                </div>
                <div class="skeleton skeleton-text mb-4" style="width: 90%;"></div>
                <div class="info-grid">
                    ${Array(5)
                      .fill(
                        '<div class="info-item"><div class="skeleton skeleton-text" style="width: 50%;"></div><div class="skeleton skeleton-title" style="width: 80%; height: 1.25rem;"></div></div>'
                      )
                      .join("")}
                </div>
            </div>
            <div class="card p-6 bg-secondary mt-6">
                <div class="skeleton skeleton-title" style="width: 40%;"></div>
                <div class="skeleton skeleton-block" style="height: 150px;"></div>
            </div>
             <div class="card p-6 bg-secondary mt-6">
                <div class="skeleton skeleton-title" style="width: 60%;"></div>
                <div class="skeleton skeleton-block" style="height: 200px;"></div>
            </div>
            <div class="sr-only" aria-live="polite">Carregando dados.</div>
        </div>
    `;
}

// --- Generic Components ---

export function renderHTMLTable(headers, rows) {
  if (!rows || rows.length === 0) {
    return '<p class="message-box info">Nenhum dado para exibir.</p>';
  }
  const headerHtml = headers.map((h) => `<th>${h}</th>`).join("");
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${headers.map((h) => `<td>${row[h] ?? ""}</td>`).join("")}</tr>`
    )
    .join("");
  return `<div class="table-container overflow-x-auto"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

export function renderMessageBox(message, type = "info") {
  return `<p class="message-box ${type}">${message}</p>`;
}

// --- Page Specific Renderers ---

// index.js
export function renderProjectListItem(versionId, versionInfo, weekText) {
  const recalcDate = versionInfo.last_recalc_date;
  return `
    <div class="project-list-item">
      <div class="font-medium text-primary">${weekText} <span class="text-xs text-tertiary font-mono ml-2">(${versionId})</span></div>
      <div class="text-secondary">Atualizado em: ${utils.formatBrazilianDate(
        recalcDate
      )}</div>
    </div>`;
}

// configuracao.js
export function renderWeeksConfigBody() {
  return `
        <div id="weeks-drop-area" class="drop-area" tabindex="0" role="region" aria-labelledby="modal-title" aria-describedby="modal-subtitle">
           <p class="text-xl text-tertiary mb-4 hidden md:block">Arraste e solte o arquivo .xlsx aqui</p>
           <p class="text-quaternary mb-4 hidden md:block">- OU -</p>
           <label for="weeks-file-input" class="file-input-label">Selecionar Arquivo</label>
           <input type="file" id="weeks-file-input" accept=".xlsx" class="sr-only"/>
        </div>
        <div id="weeks-confirmation-area" class="confirmation-area hidden">
           <p class="text-secondary mb-4">Arquivo selecionado: <strong id="weeks-confirm-file-name" class="text-primary"></strong></p>
           <div class="flex justify-center gap-4">
             <button id="weeks-cancel-btn" class="px-4 py-2 bg-gray-200 text-primary rounded-md hover:bg-gray-300">Cancelar</button>
             <button id="weeks-process-btn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Processar Arquivo</button>
           </div>
         </div>
         <div id="weeks-feedback" class="sr-only" aria-live="polite"></div>
    `;
}

export function renderResourceConfigBody(resources, savedResource) {
  if (resources.length === 0) {
    return "<p>Nenhum recurso encontrado. Carregue um arquivo .xer primeiro.</p>";
  }
  const options = resources
    .map(
      (r) =>
        `<option value="${r.rsrc_name}" ${
          savedResource === r.rsrc_name ? "selected" : ""
        }>${r.rsrc_name}</option>`
    )
    .join("");
  return `<label for="modal-resource-select" class="sr-only">Recurso Principal</label><select id="modal-resource-select" class="form-input">${options}</select>`;
}

export function renderGroupingConfigBody(maxLevel, savedLevels) {
  let checkboxesHtml =
    '<fieldset><legend class="sr-only">Níveis de agrupamento</legend><div class="grid grid-cols-4 gap-2">';
  if (maxLevel > 0) {
    for (let i = 1; i <= maxLevel; i++) {
      checkboxesHtml += `<div><input type="checkbox" id="level-${i}" value="${i}" ${
        savedLevels.includes(i) ? "checked" : ""
      } class="mr-2"><label for="level-${i}">Nível ${i}</label></div>`;
    }
  } else {
    checkboxesHtml +=
      '<p class="text-secondary col-span-4">Nenhum nível de WBS válido encontrado no projeto.</p>';
  }
  checkboxesHtml += "</div></fieldset>";
  return checkboxesHtml;
}

export function renderHiddenActivitiesBody() {
  return `<label for="hidden-activities-select" class="sr-only">Atividades a ocultar</label><select id="hidden-activities-select" multiple placeholder="Busque por código ou nome..."></select>`;
}

export function renderBackupBody() {
  return `
        <div class="space-y-6">
            <div>
                <h3 id="export-title" class="font-semibold text-lg text-primary mb-2">Exportar Dados</h3>
                <p id="export-subtitle" class="text-secondary mb-4">Clique no botão para baixar um arquivo .json contendo todos os projetos, configurações e valores personalizados.</p>
                <button id="export-btn" class="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-semibold">Exportar Todos os Dados</button>
            </div>
            <div class="border-t pt-6">
                <h3 id="import-title" class="font-semibold text-lg text-primary mb-2">Importar Dados</h3>
                <p id="import-subtitle" class="text-secondary mb-4">Arraste um arquivo de backup (.json) ou selecione-o para restaurar os dados. <strong class="text-red-600">Atenção: Isso substituirá todos os dados atuais.</strong></p>
                <div id="import-drop-area" class="drop-area" tabindex="0" role="region" aria-labelledby="import-title" aria-describedby="import-subtitle">
                    <p class="text-xl text-tertiary mb-4 hidden md:block">Arraste e solte o arquivo .json aqui</p>
                    <p class="text-quaternary my-4 hidden md:block">- OU -</p>
                    <label for="import-file-input" class="file-input-label">Selecionar Arquivo de Backup</label>
                    <input type="file" id="import-file-input" accept=".json" class="sr-only"/>
                </div>
                 <div id="import-confirmation-area" class="confirmation-area hidden">
                    <p class="text-secondary mb-4">Arquivo selecionado: <strong id="import-confirm-file-name" class="text-primary"></strong></p>
                    <div class="flex justify-center gap-4">
                      <button id="import-cancel-btn" class="px-4 py-2 bg-gray-200 text-primary rounded-md hover:bg-gray-300">Cancelar</button>
                      <button id="import-process-btn" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold">Confirmar e Importar</button>
                    </div>
                </div>
                <div id="import-feedback" class="sr-only" aria-live="polite"></div>
            </div>
        </div>`;
}

export function renderCustomValuesBody() {
  return `
        <div class="space-y-6">
            <div class="p-4 bg-tertiary rounded-lg border border-border-primary">
                <h4 class="font-semibold text-primary mb-2">Importar & Exportar via Excel</h4>
                <p class="text-sm text-secondary mb-4">Otimize a atualização de dados em massa. Itens que pertencem a grupos não serão exportados individualmente.</p>
                
                <div class="space-y-3">
                    <div>
                        <label for="custom-values-filter-select" class="form-label">Filtrar itens para exportação (opcional):</label>
                        <div id="custom-values-filter-skeleton">
                            <div class="skeleton skeleton-block" style="height: 46px; border-radius: 0.5rem;"></div>
                        </div>
                        <div id="custom-values-filter-wrapper" class="hidden">
                            <select id="custom-values-filter-select" multiple placeholder="Deixe em branco para exportar todos os itens..."></select>
                        </div>
                    </div>
                    <div class="flex gap-2 justify-end pt-2">
                        <button id="download-template-btn" class="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-semibold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Baixar Modelo
                        </button>
                        <label class="cursor-pointer px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-semibold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Importar Planilha
                            <input type="file" id="import-spreadsheet-input" class="sr-only" accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
                        </label>
                    </div>
                </div>
            </div>
            
            <div id="custom-values-table-wrapper" class="pt-4 border-t border-border-primary">
                 <!-- Table will be rendered here -->
            </div>
        </div>
    `;
}
