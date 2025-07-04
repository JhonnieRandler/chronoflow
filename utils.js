/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Inserts a vertical, collapsible sidebar navigation.
 */
export function insertHeader() {
  const navLinks = [
    {
      href: "index.html",
      text: "Painel Principal",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>',
    },
    {
      href: "proximas_semanas.html",
      text: "6-Week Look Ahead",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>',
    },
    {
      href: "analise_atividade.html",
      text: "Análise Detalhada",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>',
    },
    {
      href: "visualizador.html",
      text: "Visualizador",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>',
      isDesktopOnly: true,
    },
    {
      href: "configuracao.html",
      text: "Configurações",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear" viewBox="0 0 16 16"><path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492M5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0"/><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115z"/></svg>',
    },
    {
      href: "#presentation-mode",
      text: "Modo Apresentação",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>',
    },
  ];

  let currentPage = window.location.pathname.split("/").pop();
  if (currentPage === "" || currentPage === "/") {
    currentPage = "index.html";
  }

  const navHtml = `
    <nav class="vertical-nav" aria-label="Navegação Principal">
      <div class="nav-header hidden">
         <a href="index.html" class="nav-brand">
            <span class="nav-icon">
                <img src="logo.png" alt="ChronoFlow Logo" class="h-6 w-6">
            </span>
            <span class="nav-text">ChronoFlow</span>
        </a>
         <button class="mobile-nav-close-btn" aria-label="Fechar menu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>
      <div class="nav-brand-container">
        <a href="index.html" class="nav-brand">
            <span class="nav-icon">
                <img src="logo.png" alt="ChronoFlow Logo" class="h-6 w-6">
            </span>
            <span class="nav-text">ChronoFlow</span>
        </a>
      </div>
      <div class="nav-links-container">
          ${navLinks
            .map((link) => {
              const isActive = link.href === currentPage;
              const responsiveClass = link.isDesktopOnly
                ? "hidden md:flex"
                : "flex";
              return `
            <a href="${link.href}" class="nav-link ${responsiveClass} ${
                isActive ? "active" : ""
              }" ${isActive ? 'aria-current="page"' : ""} title="${link.text}">
              <span class="nav-icon">${link.icon}</span>
              <span class="nav-text">${link.text}</span>
            </a>
          `;
            })
            .join("")}
      </div>
       <div class="nav-footer">
            <label for="theme-toggle-checkbox" class="nav-link" title="Alterar Tema">
                <input type="checkbox" id="theme-toggle-checkbox" class="sr-only">
                <span class="nav-icon">
                    <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                    </svg>
                    <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                    </svg>
                </span>
                <span class="nav-text">Modo Noturno</span>
            </label>
        </div>
    </nav>
    <div class="sidebar-backdrop"></div>
    <button class="mobile-menu-toggle" aria-label="Abrir menu de navegação" aria-haspopup="true" aria-expanded="false">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>
  `;

  document.body.insertAdjacentHTML("afterbegin", navHtml);

  // --- Mobile Sidebar Logic ---
  const verticalNav = document.querySelector(".vertical-nav");
  const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
  const mobileNavCloseBtn = document.querySelector(".mobile-nav-close-btn");
  const backdrop = document.querySelector(".sidebar-backdrop");

  function openSidebar() {
    verticalNav.classList.add("is-open");
    backdrop.classList.add("is-visible");
    mobileMenuToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("modal-open");
  }

  function closeSidebar() {
    verticalNav.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    mobileMenuToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("modal-open");
  }

  mobileMenuToggle.addEventListener("click", openSidebar);
  mobileNavCloseBtn.addEventListener("click", closeSidebar);
  backdrop.addEventListener("click", closeSidebar);

  // --- Theme Toggle Logic ---
  const themeToggleCheckbox = document.getElementById("theme-toggle-checkbox");

  const applyTheme = (theme) => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      themeToggleCheckbox.checked = true;
    } else {
      document.documentElement.classList.remove("dark");
      themeToggleCheckbox.checked = false;
    }
  };

  const toggleTheme = () => {
    const currentTheme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  themeToggleCheckbox.addEventListener("change", toggleTheme);

  // Apply saved theme on initial load
  const savedTheme = localStorage.getItem("theme") || "light";
  applyTheme(savedTheme);

  // --- Presentation Mode Logic ---
  const presentationBtn = document.querySelector(
    'a[href="#presentation-mode"]'
  );
  if (presentationBtn) {
    // Create the exit button dynamically but keep it hidden
    const exitBtn = document.createElement("button");
    exitBtn.id = "exit-presentation-btn";
    exitBtn.className = "exit-presentation-btn";
    exitBtn.style.display = "none";
    exitBtn.setAttribute("aria-label", "Sair do modo apresentação");
    exitBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          <span>Sair do Modo Apresentação</span>
      `;
    document.body.appendChild(exitBtn);

    const togglePresentationMode = (activate) => {
      document.body.classList.toggle("presentation-mode", activate);
      exitBtn.style.display = activate ? "flex" : "none";
      if (activate && verticalNav.classList.contains("is-open")) {
        closeSidebar();
      }
    };

    presentationBtn.addEventListener("click", (e) => {
      e.preventDefault();
      togglePresentationMode(true);
    });

    exitBtn.addEventListener("click", () => {
      togglePresentationMode(false);
    });

    window.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        document.body.classList.contains("presentation-mode")
      ) {
        togglePresentationMode(false);
      }
    });
  }
}

/**
 * Shows a toast notification.
 * @param {string} message The message to display.
 * @param {'success'|'error'|'info'} type The type of toast.
 * @param {number} duration Duration in milliseconds.
 */
export function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    // For screen readers, announce changes in this container.
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "true");
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  // Make the toast itself a status region for screen readers.
  toast.setAttribute("role", "status");

  container.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // Animate out and remove
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => {
      if (toast.parentElement) {
        toast.remove();
      }
      if (container.children.length === 0) {
        if (container.parentElement) {
          container.remove();
        }
      }
    });
  }, duration);
}

/**
 * Formata uma string de data (ex: '2023-12-25 14:30' ou '2023-12-25T14:30:00Z') ou um objeto Date para o padrão brasileiro (dd/mm/yyyy).
 * @param {string | Date} d A string da data ou o objeto Date.
 * @returns {string} A data formatada ou 'N/A'.
 */
export function formatBrazilianDate(d) {
  if (!d) return "N/A";
  try {
    // new Date() é robusto e lida com objetos Date, strings ISO com 'T' e strings com espaço.
    // A substituição de ' ' por 'T' aumenta a robustez para o formato do P6.
    const date = new Date(typeof d === "string" ? d.replace(" ", "T") : d);

    // Verifica se a data é válida.
    if (isNaN(date.getTime())) {
      return "N/A";
    }

    // Usa métodos UTC para evitar que o fuso horário mude o dia da data.
    // Isso trata as datas como absolutas, o que é geralmente o esperado para cronogramas.
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0"); // Mês é 0-indexado
    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
  } catch (error) {
    return "N/A"; // Retorna 'N/A' em caso de qualquer erro de parsing.
  }
}

/**
 * Formata um número para o padrão brasileiro com 2 casas decimais.
 * @param {number | string} num O número a ser formatado.
 * @returns {string} O número formatado ou '-'.
 */
export function formatNumberBR(num) {
  if (num === null || num === undefined) return "-";
  const number = typeof num !== "number" ? parseFloat(num) : num;
  if (isNaN(number)) return "-";
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Encontra o número da semana para uma determinada data, com base em um mapeamento de semanas.
 * @param {Date | string} d A data para verificar.
 * @param {Array<Object>} weeksMapping O array de objetos de mapeamento de semanas.
 * @returns {number | null} O número da semana ou null.
 */
export function getWeekForDate(d, weeksMapping) {
  if (!d || !weeksMapping || weeksMapping.length === 0) return null;
  const checkDate = typeof d === "string" ? new Date(d.replace(" ", "T")) : d;
  checkDate.setHours(0, 0, 0, 0);
  const foundWeek = weeksMapping.find((week) => {
    const startDate = new Date(week.Data_Inicio + "T00:00:00");
    const endDate = new Date(week.Data_Fim + "T23:59:59");
    return checkDate >= startDate && checkDate <= endDate;
  });
  return foundWeek ? parseInt(foundWeek.Semana, 10) : null;
}

/**
 * Encontra o ID da versão do projeto com a data de 'last_recalc_date' mais recente.
 * @param {Object} projectVersions O objeto contendo todas as versões dos projetos.
 * @returns {string | null} O ID da versão mais recente ou null.
 */
export function getLatestProjectId(projectVersions) {
  if (!projectVersions || Object.keys(projectVersions).length === 0) {
    return null;
  }
  return Object.keys(projectVersions).reduce((latest, current) => {
    const latestDateStr =
      projectVersions[latest]?.PROJECT?.rows[0]?.last_recalc_date;
    const currentDateStr =
      projectVersions[current]?.PROJECT?.rows[0]?.last_recalc_date;
    if (!currentDateStr) return latest;
    if (!latestDateStr) return current;
    const latestDate = new Date(latestDateStr.replace(" ", "T"));
    const currentDate = new Date(currentDateStr.replace(" ", "T"));
    return currentDate > latestDate ? current : latest;
  });
}

/**
 * Retorna um array de objetos WBS que compõem o caminho hierárquico para um dado ID.
 * @param {string} stableIdRef O ID estável do item WBS inicial.
 * @param {Map<string, Object>} wbsMap O mapa de todos os itens WBS.
 * @returns {Array<Object>} Um array de objetos WBS representando o caminho.
 */
export function getWbsPathObjects(stableIdRef, wbsMap) {
  let path = [];
  let currentId = stableIdRef;
  while (currentId && wbsMap.has(currentId)) {
    const currentWbs = wbsMap.get(currentId);
    path.unshift(currentWbs);
    currentId = currentWbs.parent_stable_wbs_id;
  }
  return path;
}

/**
 * Generates a version 4 UUID.
 * @returns {string} A new UUID.
 */
export function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}
