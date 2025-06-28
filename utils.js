/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Inserts a vertical, collapsible sidebar navigation.
 */
function insertHeader() {
  const navLinks = [
    {
      href: "index.html",
      text: "Painel Principal",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>',
    },
    {
      href: "proximas_semanas.html",
      text: "Próximas Semanas",
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
    },
    {
      href: "configuracao.html",
      text: "Configurações",
      icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>',
    },
  ];

  let currentPage = window.location.pathname.split("/").pop();
  if (currentPage === "" || currentPage === "/") {
    currentPage = "index.html";
  }

  const navHtml = `
    <nav class="vertical-nav" aria-label="Navegação Principal">
      <div class="nav-header">
         <button class="mobile-nav-close-btn" aria-label="Fechar menu">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>
      <div class="nav-links-container">
          ${navLinks
            .map(
              (link) => `
            <a href="${link.href}" class="nav-link ${
                link.href === currentPage ? "active" : ""
              }" title="${link.text}">
              <span class="nav-icon">${link.icon}</span>
              <span class="nav-text">${link.text}</span>
            </a>
          `
            )
            .join("")}
      </div>
    </nav>
    <div class="sidebar-backdrop"></div>
    <button class="mobile-menu-toggle" aria-label="Abrir menu">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    </button>
  `;

  document.body.insertAdjacentHTML("afterbegin", navHtml);

  const verticalNav = document.querySelector(".vertical-nav");
  const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
  const mobileNavCloseBtn = document.querySelector(".mobile-nav-close-btn");
  const backdrop = document.querySelector(".sidebar-backdrop");

  function openSidebar() {
    verticalNav.classList.add("is-open");
    backdrop.classList.add("is-visible");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    verticalNav.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    document.body.style.overflow = "";
  }

  mobileMenuToggle.addEventListener("click", openSidebar);
  mobileNavCloseBtn.addEventListener("click", closeSidebar);
  backdrop.addEventListener("click", closeSidebar);
}

/**
 * Formata uma string de data (ex: '2023-12-25 14:30') para o padrão brasileiro (dd/mm/yyyy).
 * @param {string} d A string da data.
 * @returns {string} A data formatada ou 'N/A'.
 */
function formatBrazilianDate(d) {
  if (!d) return "N/A";
  const datePart = d.split(" ")[0];
  const [y, m, day] = datePart.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}

/**
 * Formata um número para o padrão brasileiro com 2 casas decimais.
 * @param {number | string} num O número a ser formatado.
 * @returns {string} O número formatado ou '-'.
 */
function formatNumberBR(num) {
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
function getWeekForDate(d, weeksMapping) {
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
 * Encontra o ID do projeto com a data de 'last_recalc_date' mais recente.
 * @param {Object} allProjectsData O objeto contendo todos os dados dos projetos.
 * @returns {string | null} O ID do projeto mais recente ou null.
 */
function getLatestProjectId(allProjectsData) {
  if (!allProjectsData || Object.keys(allProjectsData).length === 0) {
    return null;
  }
  return Object.keys(allProjectsData).reduce((latest, current) => {
    const latestDateStr =
      allProjectsData[latest]?.PROJECT?.rows[0]?.last_recalc_date;
    const currentDateStr =
      allProjectsData[current]?.PROJECT?.rows[0]?.last_recalc_date;
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
function getWbsPathObjects(stableIdRef, wbsMap) {
  let path = [];
  let currentId = stableIdRef;
  while (currentId && wbsMap.has(currentId)) {
    const currentWbs = wbsMap.get(currentId);
    path.unshift(currentWbs);
    currentId = currentWbs.parent_stable_wbs_id;
  }
  return path;
}
