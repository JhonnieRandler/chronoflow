import { initializationError, showFirebaseError } from "./firebase-config.js";
import * as utils from "./utils.js";
import { renderHTMLTable, renderMessageBox } from "./ui-components.js";

// First, check if Firebase is configured. If not, show an error and stop.
if (initializationError) {
  utils.insertHeader(); // Show nav so user isn't stuck
  showFirebaseError();
  throw initializationError; // Halt script execution
}

// If no error, import other modules and run the app
import { dataLoader } from "./data-loader.js";

// ===== Page Script Starts Here =====
(async () => {
  utils.insertHeader();

  const kpiSection = document.getElementById("kpi-section");
  const paretoChartContainer = document.getElementById(
    "pareto-chart-container"
  );
  const trendChartContainer = document.getElementById("trend-chart-container");
  const pendingRestrictionsList = document.getElementById(
    "pending-restrictions-list"
  );

  let paretoChartInstance = null;
  let trendChartInstance = null;

  /**
   * Main function to load and display all data on the page.
   */
  try {
    const { restrictionsList, weeksData } = await dataLoader.loadCoreData();

    if (!restrictionsList || restrictionsList.length === 0) {
      document.querySelector(".main-content").innerHTML = `
        <div class="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
            ${renderMessageBox(
              "Nenhuma restrição encontrada. Adicione restrições na página de Configurações para começar a análise.",
              "info"
            )}
        </div>
      `;
      return;
    }

    // Process and render all components
    renderKPIs(restrictionsList);
    renderParetoChart(restrictionsList);
    renderTrendChart(restrictionsList, weeksData);
    renderPendingRestrictionsTable(restrictionsList);
  } catch (error) {
    console.error("Erro ao carregar a página de análise de restrições:", error);
    document.querySelector(".main-content").innerHTML = `
      <div class="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
        ${renderMessageBox(
          `Ocorreu um erro ao carregar os dados: ${error.message}`,
          "error"
        )}
      </div>
    `;
  }

  /**
   * Renders the Key Performance Indicators (KPIs).
   * @param {Array<Object>} restrictionsList The list of all restrictions.
   */
  function renderKPIs(restrictionsList) {
    const pendingCount = restrictionsList.filter(
      (r) => r.status === "pending"
    ).length;
    const resolvedCount = restrictionsList.length - pendingCount;

    kpiSection.innerHTML = `
      <div class="card p-6 bg-secondary">
        <h3 class="text-lg font-medium text-secondary">Restrições Pendentes</h3>
        <p class="text-4xl font-bold text-red-500 mt-2">${pendingCount}</p>
      </div>
      <div class="card p-6 bg-secondary">
        <h3 class="text-lg font-medium text-secondary">Restrições Resolvidas</h3>
        <p class="text-4xl font-bold text-green-500 mt-2">${resolvedCount}</p>
      </div>
    `;
  }

  /**
   * Renders the Pareto chart for pending restrictions by cause category.
   * @param {Array<Object>} restrictionsList The list of all restrictions.
   */
  function renderParetoChart(restrictionsList) {
    const pendingRestrictions = restrictionsList.filter(
      (r) => r.status === "pending"
    );

    const countsByCategory = pendingRestrictions.reduce((acc, r) => {
      const category = r.category || "Não Categorizado";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const sortedCategories = Object.entries(countsByCategory).sort(
      ([, a], [, b]) => b - a
    );

    if (sortedCategories.length === 0) {
      paretoChartContainer.innerHTML = `<p class="text-center text-tertiary py-10">Nenhuma restrição pendente para exibir no gráfico.</p>`;
      return;
    }

    const labels = sortedCategories.map(([category]) => category);
    const data = sortedCategories.map(([, count]) => count);

    const total = data.reduce((sum, value) => sum + value, 0);
    let cumulative = 0;
    const cumulativePercentage = data.map((value) => {
      cumulative += value;
      return (cumulative / total) * 100;
    });

    paretoChartContainer.innerHTML = '<canvas id="paretoChart"></canvas>';
    const ctx = document.getElementById("paretoChart").getContext("2d");

    const isDarkMode = document.documentElement.classList.contains("dark");
    const gridColor = isDarkMode
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(0, 0, 0, 0.1)";
    const labelColor = isDarkMode ? "#9ca3af" : "#475569";

    if (paretoChartInstance) paretoChartInstance.destroy();

    paretoChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Nº de Restrições",
            data: data,
            backgroundColor: "rgba(59, 130, 246, 0.7)",
            borderColor: "rgba(59, 130, 246, 1)",
            borderWidth: 1,
            yAxisID: "y",
          },
          {
            label: "% Acumulada",
            data: cumulativePercentage,
            type: "line",
            borderColor: "rgba(239, 68, 68, 1)",
            backgroundColor: "rgba(239, 68, 68, 0.2)",
            tension: 0.1,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            type: "linear",
            position: "left",
            title: { display: true, text: "Contagem", color: labelColor },
            grid: { color: gridColor },
            ticks: { color: labelColor },
          },
          y1: {
            beginAtZero: true,
            max: 100,
            type: "linear",
            position: "right",
            title: {
              display: true,
              text: "Porcentagem Acumulada (%)",
              color: labelColor,
            },
            grid: { drawOnChartArea: false },
            ticks: { color: labelColor, callback: (value) => `${value}%` },
          },
          x: {
            grid: { color: gridColor },
            ticks: { color: labelColor },
          },
        },
        plugins: {
          tooltip: {
            mode: "index",
            intersect: false,
          },
          legend: {
            labels: { color: labelColor },
          },
        },
      },
    });
  }

  /**
   * Renders the trend chart for restriction resolution over time.
   * @param {Array<Object>} restrictionsList The list of all restrictions.
   * @param {Array<Object>} weeksData The weeks mapping data.
   */
  function renderTrendChart(restrictionsList, weeksData) {
    if (!weeksData || weeksData.length === 0) {
      trendChartContainer.innerHTML = `<p class="text-center text-tertiary py-10">Mapeamento de semanas não configurado.</p>`;
      return;
    }

    const restrictionsByWeek = weeksData.reduce((acc, week) => {
      acc[week.Semana] = {
        pending: 0,
        resolved: 0,
        startDate: new Date(week.Data_Inicio + "T00:00:00"),
      };
      return acc;
    }, {});

    restrictionsList.forEach((r) => {
      if (r.due) {
        const weekNumber = utils.getWeekForDate(r.due, weeksData);
        if (weekNumber && restrictionsByWeek[weekNumber]) {
          restrictionsByWeek[weekNumber][r.status]++;
        }
      }
    });

    const sortedWeeks = Object.entries(restrictionsByWeek).sort(
      ([, a], [, b]) => a.startDate - b.startDate
    );

    const labels = sortedWeeks.map(([weekNum]) => `Semana ${weekNum}`);
    const pendingData = sortedWeeks.map(([, data]) => data.pending);
    const resolvedData = sortedWeeks.map(([, data]) => data.resolved);

    trendChartContainer.innerHTML = '<canvas id="trendChart"></canvas>';
    const ctx = document.getElementById("trendChart").getContext("2d");

    const isDarkMode = document.documentElement.classList.contains("dark");
    const gridColor = isDarkMode
      ? "rgba(255, 255, 255, 0.1)"
      : "rgba(0, 0, 0, 0.1)";
    const labelColor = isDarkMode ? "#9ca3af" : "#475569";

    if (trendChartInstance) trendChartInstance.destroy();

    trendChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Pendentes",
            data: pendingData,
            backgroundColor: "rgba(239, 68, 68, 0.7)",
            borderColor: "rgba(239, 68, 68, 1)",
            borderWidth: 1,
          },
          {
            label: "Resolvidas",
            data: resolvedData,
            backgroundColor: "rgba(34, 197, 94, 0.7)",
            borderColor: "rgba(34, 197, 94, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            grid: { color: gridColor },
            ticks: { color: labelColor },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: labelColor },
          },
        },
        plugins: {
          tooltip: {
            mode: "index",
            intersect: false,
          },
          legend: {
            labels: { color: labelColor },
          },
        },
      },
    });
  }

  /**
   * Renders the table of detailed pending restrictions.
   * @param {Array<Object>} restrictionsList The list of all restrictions.
   */
  function renderPendingRestrictionsTable(restrictionsList) {
    const pending = restrictionsList
      .filter((r) => r.status === "pending")
      .sort((a, b) => (new Date(a.due) || 0) - (new Date(b.due) || 0));

    if (pending.length === 0) {
      pendingRestrictionsList.innerHTML = `<p class="text-center text-tertiary py-10">Parabéns! Nenhuma restrição pendente.</p>`;
      return;
    }

    const headers = ["Descrição", "Categoria", "Responsável", "Prazo"];
    const rows = pending.map((r) => ({
      Descrição: `<span class="font-medium text-primary">${r.desc}</span>`,
      Categoria: `<span class="restriction-category-badge">${
        r.category || "N/A"
      }</span>`,
      Responsável: `<span class="text-secondary">${r.resp}</span>`,
      Prazo: `<span class="text-red-600 font-semibold">${utils.formatBrazilianDate(
        r.due
      )}</span>`,
    }));

    pendingRestrictionsList.innerHTML = renderHTMLTable(headers, rows);
  }
})();
