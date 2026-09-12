(() => {
  "use strict";

  const DATA_URL = "data/encal_subdelegaciones.json";

  const estadoTablero = {
    datos: [],
    datosFiltrados: [],
    graficas: {},
    ordenSubt: { key: "satisfaccion", dir: "desc" },
    ordenTram: { key: "satisfaccion", dir: "asc" },
  };

  const $ = (id) => document.getElementById(id);

  const misElsHtml = {
    fRegion: $("fRegion"),
    fDeleg: $("fDeleg"),
    fSubdeleg: $("fSubdeleg"),
    fTipoTramite: $("fTipoTramite"),
    fTramite: $("fTramite"),
    fSexo: $("fSexo"),
    fEdad: $("fEdad"),
    fTipoUsuario: $("fTipoUsuario"),
    btnReset: $("btnReset"),
    filterSummary: $("filterSummary"),
    topTramites: $("topTramites"),
    kpiSatisfaccion: $("kpiSatisfaccion"),
    kpiCalificacion: $("kpiCalificacion"),
    kpiResuelto: $("kpiResuelto"),
    kpiTiempo: $("kpiTiempo"),
    nEncuestas: $("nEncuestas"),
    poblacionExpandida: $("poblacionExpandida"),
    coberturaActual: $("coberturaActual"),
    miniGestor: $("miniGestor"),
    miniDificultad: $("miniDificultad"),
    miniIdentificado: $("miniIdentificado"),
    miniCorrupcion: $("miniCorrupcion"),
    tbodySub: document.querySelector("#tablaSubdelegaciones tbody"),
    tbodyTram: document.querySelector("#tablaTramites tbody"),
    errorPanel: $("errorPanel"),
    errorMessage: $("errorMessage"),
  };

  const filterDefs = [
    {
      el: misElsHtml.fRegion,
      key: "region",
      label: "Región",
      all: "Todas",
    },
    {
      el: misElsHtml.fDeleg,
      key: "deleg",
      label: "Delegación",
      all: "Todas",
    },
    {
      el: misElsHtml.fSubdeleg,
      key: "subdeleg",
      label: "Subdelegación",
      all: "Todas",
    },
    {
      el: misElsHtml.fTipoTramite,
      key: "tram_DIR_DPES",
      label: "Tipo trámite",
      all: "Todos",
    },
    {
      el: misElsHtml.fTramite,
      key: "tramite",
      label: "Trámite",
      all: "Todos",
    },
    {
      el: misElsHtml.fSexo,
      key: "sexo",
      label: "Sexo",
      all: "Todos",
    },
    {
      el: misElsHtml.fEdad,
      key: "grupo_edad",
      label: "Edad",
      all: "Todos",
    },
    {
      el: misElsHtml.fTipoUsuario,
      key: "tipo_usua",
      label: "Tipo usuario",
      all: "Todos",
    },
  ];

  const nf0 = new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 0,
  });

  const nf1 = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const convertirNumero = (valor) =>
    valor === null ||
    valor === undefined ||
    valor === "" ||
    !Number.isFinite(Number(valor))
      ? null
      : Number(valor);

  const factorExpansion = (registro) =>
    convertirNumero(registro.FE_FinalNR) ?? 0;

  function uniqueSorted(data, key) {
    return [
      ...new Set(
        data
          .map((d) => d[key])
          .filter(
            (v) => v !== null && v !== undefined && String(v).trim() !== "",
          ),
      ),
    ].sort((a, b) =>
      String(a).localeCompare(String(b), "es", {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }

  function setOptions(select, values, current, allLabel) {
    select.innerHTML = `<option value="">${allLabel}</option>`;

    values.forEach((v) => {
      const option = document.createElement("option");
      option.value = String(v);
      option.textContent = String(v);
      select.appendChild(option);
    });

    select.value =
      current && values.map(String).includes(String(current))
        ? String(current)
        : "";
  }

  const selections = () =>
    Object.fromEntries(filterDefs.map((f) => [f.key, f.el.value]));

  const matches = (row, sel, ignore = null) =>
    Object.entries(sel).every(
      ([k, v]) => k === ignore || v === "" || String(row[k]) === String(v),
    );

  function actualizarFiltrosDependientes() {
    const sel = selections();

    filterDefs.forEach((def) => {
      const candidate = estadoTablero.datos.filter((r) =>
        matches(r, sel, def.key),
      );

      let values = uniqueSorted(candidate, def.key);

      if (def.key === "grupo_edad") {
        const order = ["18-29", "30-39", "40-49", "50-59", "60-69", "70+"];

        values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
      }

      setOptions(def.el, values, def.el.value, def.all);

      sel[def.key] = def.el.value;
    });
  }

  function promedioPonderado(datos, campo) {
    let numerador = 0;
    let denominador = 0;

    for (const registro of datos) {
      const valor = convertirNumero(registro[campo]);
      const factor = factorExpansion(registro);

      if (valor === null || factor <= 0) {
        continue;
      }

      numerador += valor * factor;
      denominador += factor;
    }

    if (denominador > 0) {
      return numerador / denominador;
    } else {
      return null;
    }
  }

  function porcentajePonderado(datos, campo) {
    let numerador = 0;
    let denominador = 0;

    for (const registro of datos) {
      const valor = convertirNumero(registro[campo]);
      const factor = factorExpansion(registro);

      if (valor === null || factor <= 0) {
        continue;
      }

      numerador += valor * factor;
      denominador += factor;
    }

    if (denominador > 0) {
      return (numerador / denominador) * 100;
    } else {
      return null;
    }
  }

  function distribucionPonderada(datos, campo, ordenCategorias = []) {
    const acumuladoPorCategoria = new Map();
    let totalPonderado = 0;

    for (const registro of datos) {
      const categoria = registro[campo];
      const factor = factorExpansion(registro);

      if (
        categoria === null ||
        categoria === undefined ||
        categoria === "" ||
        factor <= 0
      ) {
        continue;
      }

      acumuladoPorCategoria.set(
        categoria,
        (acumuladoPorCategoria.get(categoria) || 0) + factor,
      );

      totalPonderado += factor;
    }

    const etiquetas =
      ordenCategorias.length > 0
        ? ordenCategorias.filter((categoria) =>
            acumuladoPorCategoria.has(categoria),
          )
        : [...acumuladoPorCategoria.keys()];

    const porcentajes = etiquetas.map((categoria) => {
      if (totalPonderado > 0) {
        return (acumuladoPorCategoria.get(categoria) / totalPonderado) * 100;
      } else {
        return 0;
      }
    });

    return {
      labels: etiquetas,
      values: porcentajes,
    };
  }

  const fmtPct = (valor) => (valor === null ? "—" : `${nf1.format(valor)}%`);

  const fmtCal = (valor) =>
    valor === null ? "—" : `${nf1.format(valor)} / 10`;

  const fmtMin = (valor) => (valor === null ? "—" : `${nf1.format(valor)} min`);

  function coverageLabel() {
    return (
      [
        misElsHtml.fRegion.value,
        misElsHtml.fDeleg.value,
        misElsHtml.fSubdeleg.value,
      ]
        .filter(Boolean)
        .join(" · ") || "Nacional"
    );
  }

  function renderKPIs() {
    const datos = estadoTablero.datosFiltrados;

    misElsHtml.kpiSatisfaccion.textContent = fmtPct(
      porcentajePonderado(datos, "ind_satisfecho"),
    );

    misElsHtml.kpiCalificacion.textContent = fmtCal(
      promedioPonderado(datos, "calificacion"),
    );

    misElsHtml.kpiResuelto.textContent = fmtPct(
      porcentajePonderado(datos, "ind_resuelto"),
    );

    misElsHtml.kpiTiempo.textContent = fmtMin(
      promedioPonderado(datos, "tiempo_total_min"),
    );

    misElsHtml.nEncuestas.textContent = nf0.format(datos.length);

    misElsHtml.poblacionExpandida.textContent = nf0.format(
      datos.reduce((suma, registro) => suma + factorExpansion(registro), 0),
    );

    misElsHtml.coberturaActual.textContent = coverageLabel();

    misElsHtml.miniGestor.textContent = fmtPct(
      porcentajePonderado(datos, "ind_gestor"),
    );

    misElsHtml.miniDificultad.textContent = fmtPct(
      porcentajePonderado(datos, "ind_dificultad_requisitos"),
    );

    misElsHtml.miniIdentificado.textContent = fmtPct(
      porcentajePonderado(datos, "ind_personal_identificado"),
    );

    misElsHtml.miniCorrupcion.textContent = fmtPct(
      porcentajePonderado(datos, "ind_corrup1"),
    );
  }

  function destroyChart(nombre) {
    if (estadoTablero.graficas[nombre]) {
      estadoTablero.graficas[nombre].destroy();
    }
  }

  function chartOpts(horizontal = false, mostrarEtiquetas = true) {
    return {
      responsive: true,
      maintainAspectRatio: false,

      indexAxis: horizontal ? "y" : "x",

      plugins: {
        legend: {
          display: false,
        },

        tooltip: {
          callbacks: {
            label: (contexto) => `${nf1.format(contexto.raw)}%`,
          },
        },
      },

      scales: {
        x: {
          beginAtZero: true,
          max: horizontal ? 100 : undefined,

          ticks: horizontal
            ? {
                // Gráfica horizontal:
                // el eje X contiene porcentajes.
                callback: (valor) => `${valor}%`,
              }
            : mostrarEtiquetas
              ? {
                  // Gráfica vertical:
                  // muestra las etiquetas originales.
                }
              : {
                  // Gráfica vertical:
                  // sustituye las etiquetas por 1, 2, 3...
                  callback: (valor) => valor + 1,
                },
        },

        y: {
          beginAtZero: true,
          max: horizontal ? undefined : 100,

          ticks: horizontal
            ? mostrarEtiquetas
              ? {
                  // Gráfica horizontal:
                  // muestra las etiquetas originales.
                }
              : {
                  // Gráfica horizontal:
                  // sustituye las etiquetas por 1, 2, 3...
                  callback: (valor) => valor + 1,
                }
            : {
                // Gráfica vertical:
                // el eje Y contiene porcentajes.
                callback: (valor) => `${valor}%`,
              },
        },
      },
    };
  }

  function rendergraficas() {
    const datos = estadoTablero.datosFiltrados;

    destroyChart("sat");

    const sat = distribucionPonderada(datos, "sat", [
      "Muy satisfecho(a)",
      "Satisfecho(a)",
      "Ni satisfecho(a) ni insatisfecho(a)",
      "Insatisfecho(a)",
      "Muy insatisfecho(a)",
    ]);

    estadoTablero.graficas.sat = new Chart($("chartSatisfaccion"), {
      type: "bar",

      data: {
        labels: sat.labels,

        datasets: [
          {
            data: sat.values,

            backgroundColor: [
              "#0b6655",
              "#3d8c7e",
              "#b7aaa0",
              "#c87c5f",
              "#a84242",
            ],

            borderRadius: 7,
          },
        ],
      },

      options: chartOpts(false, false),
    });

    destroyChart("res");

    const res = distribucionPonderada(datos, "tramres", ["Sí", "No"]);

    estadoTablero.graficas.res = new Chart($("chartResolucion"), {
      type: "doughnut",

      data: {
        labels: res.labels,

        datasets: [
          {
            data: res.values,

            backgroundColor: ["#0b6655", "#c87c5f"],

            borderWidth: 0,
          },
        ],
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "66%",

        plugins: {
          legend: {
            position: "bottom",
          },

          tooltip: {
            callbacks: {
              label: (contexto) =>
                `${contexto.label}: ${nf1.format(contexto.raw)}%`,
            },
          },
        },
      },
    });

    destroyChart("trato");

    const trato = distribucionPonderada(datos, "trato", [
      "Excelente",
      "Bueno",
      "Regular",
      "Malo",
      "Pésimo",
    ]);

    estadoTablero.graficas.trato = new Chart($("chartTrato"), {
      type: "bar",

      data: {
        labels: trato.labels,

        datasets: [
          {
            data: trato.values,

            backgroundColor: [
              "#0b6655",
              "#3d8c7e",
              "#b7aaa0",
              "#c87c5f",
              "#a84242",
            ],

            borderRadius: 7,
          },
        ],
      },

      options: chartOpts(false),
    });

    destroyChart("exp");

    const items = [
      ["Dificultad para reunir requisitos", "ind_dificultad_requisitos"],
      ["Recomendación de gestor externo", "ind_gestor"],
      ["Atención inclusiva", "ind_personal_disponible"],
      ["Igualdad en la atención", "ind_atencion_preferente"],
      ["Personal identificado", "ind_personal_identificado"],
      ["Identificación de medios de opinión", "ind_queja_si"],
      ["Conocimiento de alternativa digital", "ind_imssdigi"],
      ["Solicitud de regalos, favores o dinero", "ind_corrup1"],
    ];

    const labels = [];
    const vals = [];

    items.forEach(([label, campo]) => {
      const valor = porcentajePonderado(datos, campo);

      if (valor !== null) {
        labels.push(label);
        vals.push(valor);
      }
    });

    estadoTablero.graficas.exp = new Chart($("chartExperiencia"), {
      type: "bar",

      data: {
        labels,

        datasets: [
          {
            data: vals,
            backgroundColor: "#0b6655",
            borderRadius: 7,
          },
        ],
      },

      options: chartOpts(true),
    });
  }

  function aggregateBy(data, key) {
    const mapa = new Map();

    for (const registro of data) {
      if (!registro[key]) {
        continue;
      }

      (
        mapa.get(registro[key]) ||
        mapa.set(registro[key], []).get(registro[key])
      ).push(registro);
    }

    return [...mapa.entries()].map(([nombre, registros]) => ({
      nombre,
      n: registros.length,

      satisfaccion: porcentajePonderado(registros, "ind_satisfecho"),

      calificacion: promedioPonderado(registros, "calificacion"),

      resuelto: porcentajePonderado(registros, "ind_resuelto"),

      tiempo: promedioPonderado(registros, "tiempo_total_min"),
    }));
  }

  function sortRows(rows, orden) {
    const factor = orden.dir === "asc" ? 1 : -1;

    return rows.sort((a, b) => {
      if (orden.key === "nombre") {
        return (
          String(a.nombre).localeCompare(String(b.nombre), "es", {
            sensitivity: "base",
          }) * factor
        );
      }

      const valorA = a[orden.key];
      const valorB = b[orden.key];

      if (valorA === null && valorB === null) {
        return 0;
      }

      if (valorA === null) {
        return 1;
      }

      if (valorB === null) {
        return -1;
      }

      return (valorA - valorB) * factor;
    });
  }

  function metricClass(valor, referencia, inverso = false) {
    if (valor === null || referencia === null) {
      return "";
    }

    const diferencia = inverso ? referencia - valor : valor - referencia;

    return diferencia >= 3
      ? "metric-good"
      : diferencia <= -3
        ? "metric-low"
        : "metric-watch";
  }

  const esc = (texto) =>
    String(texto)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  function renderSubdelegaciones() {
    const rows = sortRows(
      aggregateBy(estadoTablero.datosFiltrados, "subdeleg"),
      estadoTablero.ordenSubt,
    );

    const datos = estadoTablero.datosFiltrados;

    const refSatisfaccion = porcentajePonderado(datos, "ind_satisfecho");

    const refCalificacion = promedioPonderado(datos, "calificacion");

    const refResuelto = porcentajePonderado(datos, "ind_resuelto");

    const refTiempo = promedioPonderado(datos, "tiempo_total_min");

    misElsHtml.tbodySub.innerHTML = rows
      .map(
        (r) =>
          `<tr>
              <td>${esc(r.nombre)}</td>
              <td>${nf0.format(r.n)}</td>

              <td class="${metricClass(r.satisfaccion, refSatisfaccion)}">
                ${fmtPct(r.satisfaccion)}
              </td>

              <td class="${metricClass(
                r.calificacion === null ? null : r.calificacion * 10,
                refCalificacion === null ? null : refCalificacion * 10,
              )}">
                ${r.calificacion === null ? "—" : nf1.format(r.calificacion)}
              </td>

              <td class="${metricClass(r.resuelto, refResuelto)}">
                ${fmtPct(r.resuelto)}
              </td>

              <td class="${metricClass(r.tiempo, refTiempo, true)}">
                ${fmtMin(r.tiempo)}
              </td>
            </tr>`,
      )
      .join("");
  }

  function renderTramites() {
    let rows = sortRows(
      aggregateBy(estadoTablero.datosFiltrados, "tramite"),
      estadoTablero.ordenTram,
    );

    const limite = Number(misElsHtml.topTramites.value || 15);

    if (limite < 9999) {
      rows = rows.slice(0, limite);
    }

    const datos = estadoTablero.datosFiltrados;

    const refSatisfaccion = porcentajePonderado(datos, "ind_satisfecho");

    const refCalificacion = promedioPonderado(datos, "calificacion");

    const refResuelto = porcentajePonderado(datos, "ind_resuelto");

    const refTiempo = promedioPonderado(datos, "tiempo_total_min");

    misElsHtml.tbodyTram.innerHTML = rows
      .map(
        (r) =>
          `<tr>
              <td>${esc(r.nombre)}</td>
              <td>${nf0.format(r.n)}</td>

              <td class="${metricClass(r.satisfaccion, refSatisfaccion)}">
                ${fmtPct(r.satisfaccion)}
              </td>

              <td class="${metricClass(
                r.calificacion === null ? null : r.calificacion * 10,
                refCalificacion === null ? null : refCalificacion * 10,
              )}">
                ${r.calificacion === null ? "—" : nf1.format(r.calificacion)}
              </td>

              <td class="${metricClass(r.resuelto, refResuelto)}">
                ${fmtPct(r.resuelto)}
              </td>

              <td class="${metricClass(r.tiempo, refTiempo, true)}">
                ${fmtMin(r.tiempo)}
              </td>
            </tr>`,
      )
      .join("");
  }

  function renderFilterSummary() {
    const filtrosActivos = filterDefs
      .filter((f) => f.el.value)
      .map((f) => `${f.label}: ${f.el.value}`);

    misElsHtml.filterSummary.textContent = filtrosActivos.length
      ? filtrosActivos.join(" · ")
      : "Sin filtros activos";
  }

  function renderAll() {
    renderFilterSummary();
    renderKPIs();
    rendergraficas();
    renderSubdelegaciones();
    renderTramites();
  }

  function applyFilters() {
    const selecciones = selections();

    estadoTablero.datosFiltrados = estadoTablero.datos.filter((registro) =>
      matches(registro, selecciones),
    );

    renderAll();
  }

  function resetFilters() {
    filterDefs.forEach((filtro) => (filtro.el.value = ""));

    actualizarFiltrosDependientes();
    applyFilters();
  }

  function wireEvents() {
    filterDefs.forEach((filtro) =>
      filtro.el.addEventListener("change", () => {
        actualizarFiltrosDependientes();
        applyFilters();
      }),
    );

    misElsHtml.btnReset.addEventListener("click", resetFilters);

    misElsHtml.topTramites.addEventListener("change", renderTramites);

    document.querySelectorAll("[data-sort-sub]").forEach((th) =>
      th.addEventListener("click", () => {
        const k = th.dataset.sortSub;

        if (estadoTablero.ordenSubt.key === k) {
          estadoTablero.ordenSubt.dir =
            estadoTablero.ordenSubt.dir === "asc" ? "desc" : "asc";
        } else {
          estadoTablero.ordenSubt.key = k;

          estadoTablero.ordenSubt.dir = k === "nombre" ? "asc" : "desc";
        }

        renderSubdelegaciones();
      }),
    );

    document.querySelectorAll("[data-sort-tram]").forEach((th) =>
      th.addEventListener("click", () => {
        const k = th.dataset.sortTram;

        if (estadoTablero.ordenTram.key === k) {
          estadoTablero.ordenTram.dir =
            estadoTablero.ordenTram.dir === "asc" ? "desc" : "asc";
        } else {
          estadoTablero.ordenTram.key = k;

          estadoTablero.ordenTram.dir =
            k === "nombre" ? "asc" : k === "tiempo" ? "desc" : "asc";
        }

        renderTramites();
      }),
    );
  }

  async function init() {
    try {
      const response = await fetch(DATA_URL, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} al leer ${DATA_URL}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("El JSON debe contener un arreglo de registros.");
      }

      estadoTablero.datos = data;
      estadoTablero.datosFiltrados = data;

      actualizarFiltrosDependientes();
      wireEvents();
      renderAll();
    } catch (e) {
      console.error(e);

      misElsHtml.errorPanel.hidden = false;

      misElsHtml.errorMessage.textContent = e.message || String(e);
    }
  }

  init();
})();
