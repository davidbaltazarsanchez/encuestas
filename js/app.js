(() => {
  "use strict";

  const DATA_URL = "data/encal_subdelegaciones.json";
  const state = {
    allData: [], filteredData: [], charts: {},
    sortSub: { key: "satisfaccion", dir: "desc" },
    sortTram: { key: "satisfaccion", dir: "asc" }
  };

  const $ = id => document.getElementById(id);
  const els = {
    fRegion: $("fRegion"), fDeleg: $("fDeleg"), fSubdeleg: $("fSubdeleg"),
    fTipoTramite: $("fTipoTramite"), fTramite: $("fTramite"), fSexo: $("fSexo"),
    fEdad: $("fEdad"), fTipoUsuario: $("fTipoUsuario"), btnReset: $("btnReset"),
    filterSummary: $("filterSummary"), topTramites: $("topTramites"),
    kpiSatisfaccion: $("kpiSatisfaccion"), kpiCalificacion: $("kpiCalificacion"),
    kpiResuelto: $("kpiResuelto"), kpiTiempo: $("kpiTiempo"),
    nEncuestas: $("nEncuestas"), poblacionExpandida: $("poblacionExpandida"),
    coberturaActual: $("coberturaActual"), miniGestor: $("miniGestor"),
    miniDificultad: $("miniDificultad"), miniIdentificado: $("miniIdentificado"),
    miniCorrupcion: $("miniCorrupcion"),
    tbodySub: document.querySelector("#tablaSubdelegaciones tbody"),
    tbodyTram: document.querySelector("#tablaTramites tbody"),
    errorPanel: $("errorPanel"), errorMessage: $("errorMessage")
  };

  const filterDefs = [
    { el: els.fRegion, key: "region", label: "Región", all: "Todas" },
    { el: els.fDeleg, key: "deleg", label: "Delegación", all: "Todas" },
    { el: els.fSubdeleg, key: "subdeleg", label: "Subdelegación", all: "Todas" },
    { el: els.fTipoTramite, key: "tram_DIR_DPES", label: "Tipo trámite", all: "Todos" },
    { el: els.fTramite, key: "tramite", label: "Trámite", all: "Todos" },
    { el: els.fSexo, key: "sexo", label: "Sexo", all: "Todos" },
    { el: els.fEdad, key: "grupo_edad", label: "Edad", all: "Todos" },
    { el: els.fTipoUsuario, key: "tipo_usua", label: "Tipo usuario", all: "Todos" }
  ];

  const nf0 = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const num = v => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) ? null : Number(v);
  const fe = row => num(row.FE_FinalNR) ?? 0;

  function uniqueSorted(data, key) {
    return [...new Set(data.map(d => d[key]).filter(v => v !== null && v !== undefined && String(v).trim() !== ""))]
      .sort((a,b) => String(a).localeCompare(String(b), "es", { numeric:true, sensitivity:"base" }));
  }

  function setOptions(select, values, current, allLabel) {
    select.innerHTML = `<option value="">${allLabel}</option>`;
    values.forEach(v => {
      const o = document.createElement("option"); o.value = String(v); o.textContent = String(v); select.appendChild(o);
    });
    select.value = current && values.map(String).includes(String(current)) ? String(current) : "";
  }

  const selections = () => Object.fromEntries(filterDefs.map(f => [f.key, f.el.value]));
  const matches = (row, sel, ignore=null) => Object.entries(sel).every(([k,v]) => k === ignore || v === "" || String(row[k]) === String(v));

  function refreshDependentFilters() {
    const sel = selections();
    filterDefs.forEach(def => {
      const candidate = state.allData.filter(r => matches(r, sel, def.key));
      let values = uniqueSorted(candidate, def.key);
      if (def.key === "grupo_edad") {
        const order = ["18-29","30-39","40-49","50-59","60-69","70+"];
        values.sort((a,b) => order.indexOf(a) - order.indexOf(b));
      }
      setOptions(def.el, values, def.el.value, def.all);
      sel[def.key] = def.el.value;
    });
  }

  function weightedPercent(data, key) {
    let n = 0, d = 0;
    for (const r of data) {
      const v = num(r[key]), w = fe(r);
      if (v === null || w <= 0) continue;
      n += v*w; d += w;
    }
    return d ? n/d*100 : null;
  }

  function weightedAverage(data, key) {
    let n = 0, d = 0;
    for (const r of data) {
      const v = num(r[key]), w = fe(r);
      if (v === null || w <= 0) continue;
      n += v*w; d += w;
    }
    return d ? n/d : null;
  }

  function weightedDistribution(data, key, order=[]) {
    const map = new Map(); let total = 0;
    for (const r of data) {
      const v = r[key], w = fe(r);
      if (v === null || v === undefined || v === "" || w <= 0) continue;
      map.set(v, (map.get(v)||0)+w); total += w;
    }
    const labels = order.length ? order.filter(x => map.has(x)) : [...map.keys()];
    return { labels, values: labels.map(x => total ? map.get(x)/total*100 : 0) };
  }

  const fmtPct = v => v === null ? "—" : `${nf1.format(v)}%`;
  const fmtCal = v => v === null ? "—" : `${nf1.format(v)} / 10`;
  const fmtMin = v => v === null ? "—" : `${nf1.format(v)} min`;

  function coverageLabel() {
    return [els.fRegion.value, els.fDeleg.value, els.fSubdeleg.value].filter(Boolean).join(" · ") || "Nacional";
  }

  function renderKPIs() {
    const d = state.filteredData;
    els.kpiSatisfaccion.textContent = fmtPct(weightedPercent(d, "ind_satisfecho"));
    els.kpiCalificacion.textContent = fmtCal(weightedAverage(d, "calificacion"));
    els.kpiResuelto.textContent = fmtPct(weightedPercent(d, "ind_resuelto"));
    els.kpiTiempo.textContent = fmtMin(weightedAverage(d, "tiempo_total_min"));
    els.nEncuestas.textContent = nf0.format(d.length);
    els.poblacionExpandida.textContent = nf0.format(d.reduce((s,r)=>s+fe(r),0));
    els.coberturaActual.textContent = coverageLabel();
    els.miniGestor.textContent = fmtPct(weightedPercent(d, "ind_gestor"));
    els.miniDificultad.textContent = fmtPct(weightedPercent(d, "ind_dificultad_requisitos"));
    els.miniIdentificado.textContent = fmtPct(weightedPercent(d, "ind_personal_identificado"));
    els.miniCorrupcion.textContent = fmtPct(weightedPercent(d, "ind_corrup1"));
  }

  function destroyChart(name) { if (state.charts[name]) state.charts[name].destroy(); }
  function chartOpts(horizontal=false) {
    return { responsive:true, maintainAspectRatio:false, indexAxis:horizontal?"y":"x",
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>`${nf1.format(c.raw)}%`}}},
      scales:{ x:{beginAtZero:true,max:horizontal?100:undefined,ticks:{callback:v=>horizontal?`${v}%`:v}}, y:{beginAtZero:true,max:horizontal?undefined:100,ticks:{callback:v=>horizontal?v:`${v}%`}} }
    };
  }

  function renderCharts() {
    const d = state.filteredData;
    destroyChart("sat");
    const sat = weightedDistribution(d,"sat",["Muy satisfecho(a)","Satisfecho(a)","Ni satisfecho(a) ni insatisfecho(a)","Insatisfecho(a)","Muy insatisfecho(a)"]);
    state.charts.sat = new Chart($("chartSatisfaccion"),{type:"bar",data:{labels:sat.labels,datasets:[{data:sat.values,backgroundColor:["#0b6655","#3d8c7e","#b7aaa0","#c87c5f","#a84242"],borderRadius:7}]},options:chartOpts(false)});

    destroyChart("res");
    const res = weightedDistribution(d,"tramres",["Sí","No"]);
    state.charts.res = new Chart($("chartResolucion"),{type:"doughnut",data:{labels:res.labels,datasets:[{data:res.values,backgroundColor:["#0b6655","#c87c5f"],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:"66%",plugins:{legend:{position:"bottom"},tooltip:{callbacks:{label:c=>`${c.label}: ${nf1.format(c.raw)}%`}}}}});

    destroyChart("trato");
    const tr = weightedDistribution(d,"trato",["Excelente","Bueno","Regular","Malo","Pésimo"]);
    state.charts.trato = new Chart($("chartTrato"),{type:"bar",data:{labels:tr.labels,datasets:[{data:tr.values,backgroundColor:["#0b6655","#3d8c7e","#b7aaa0","#c87c5f","#a84242"],borderRadius:7}]},options:chartOpts(false)});

    destroyChart("exp");
    const items = [["Dificultad con requisitos","ind_dificultad_requisitos"],["Uso de gestor","ind_gestor"],["Personal disponible","ind_personal_disponible"],["Atención preferente","ind_atencion_preferente"],["Personal identificado","ind_personal_identificado"],["Respuesta Sí en queja","ind_queja_si"],["IMSS Digital","ind_imssdigi"],["Respuesta Sí en corrupción","ind_corrup1"]];
    const labels=[], vals=[]; items.forEach(([l,k])=>{const v=weightedPercent(d,k);if(v!==null){labels.push(l);vals.push(v);}});
    state.charts.exp = new Chart($("chartExperiencia"),{type:"bar",data:{labels,datasets:[{data:vals,backgroundColor:"#0b6655",borderRadius:7}]},options:chartOpts(true)});
  }

  function aggregateBy(data,key){
    const m=new Map(); for(const r of data){if(!r[key])continue;(m.get(r[key])||m.set(r[key],[]).get(r[key])).push(r);}
    return [...m.entries()].map(([nombre,rows])=>({nombre,n:rows.length,satisfaccion:weightedPercent(rows,"ind_satisfecho"),calificacion:weightedAverage(rows,"calificacion"),resuelto:weightedPercent(rows,"ind_resuelto"),tiempo:weightedAverage(rows,"tiempo_total_min")}));
  }

  function sortRows(rows,s){
    const f=s.dir==="asc"?1:-1; return rows.sort((a,b)=>{
      if(s.key==="nombre") return String(a.nombre).localeCompare(String(b.nombre),"es",{sensitivity:"base"})*f;
      const av=a[s.key],bv=b[s.key]; if(av===null&&bv===null)return 0;if(av===null)return 1;if(bv===null)return -1;return(av-bv)*f;
    });
  }

  function metricClass(value,ref,inverse=false){if(value===null||ref===null)return"";const d=inverse?ref-value:value-ref;return d>=3?"metric-good":d<=-3?"metric-low":"metric-watch";}
  const esc=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

  function renderSubdelegaciones(){
    const rows=sortRows(aggregateBy(state.filteredData,"subdeleg"),state.sortSub), d=state.filteredData;
    const rs=weightedPercent(d,"ind_satisfecho"),rc=weightedAverage(d,"calificacion"),rr=weightedPercent(d,"ind_resuelto"),rt=weightedAverage(d,"tiempo_total_min");
    els.tbodySub.innerHTML=rows.map(r=>`<tr><td>${esc(r.nombre)}</td><td>${nf0.format(r.n)}</td><td class="${metricClass(r.satisfaccion,rs)}">${fmtPct(r.satisfaccion)}</td><td class="${metricClass(r.calificacion===null?null:r.calificacion*10,rc===null?null:rc*10)}">${r.calificacion===null?"—":nf1.format(r.calificacion)}</td><td class="${metricClass(r.resuelto,rr)}">${fmtPct(r.resuelto)}</td><td class="${metricClass(r.tiempo,rt,true)}">${fmtMin(r.tiempo)}</td></tr>`).join("");
  }

  function renderTramites(){
    let rows=sortRows(aggregateBy(state.filteredData,"tramite"),state.sortTram); const limit=Number(els.topTramites.value||15); if(limit<9999)rows=rows.slice(0,limit);
    const d=state.filteredData,rs=weightedPercent(d,"ind_satisfecho"),rc=weightedAverage(d,"calificacion"),rr=weightedPercent(d,"ind_resuelto"),rt=weightedAverage(d,"tiempo_total_min");
    els.tbodyTram.innerHTML=rows.map(r=>`<tr><td>${esc(r.nombre)}</td><td>${nf0.format(r.n)}</td><td class="${metricClass(r.satisfaccion,rs)}">${fmtPct(r.satisfaccion)}</td><td class="${metricClass(r.calificacion===null?null:r.calificacion*10,rc===null?null:rc*10)}">${r.calificacion===null?"—":nf1.format(r.calificacion)}</td><td class="${metricClass(r.resuelto,rr)}">${fmtPct(r.resuelto)}</td><td class="${metricClass(r.tiempo,rt,true)}">${fmtMin(r.tiempo)}</td></tr>`).join("");
  }

  function renderFilterSummary(){const a=filterDefs.filter(f=>f.el.value).map(f=>`${f.label}: ${f.el.value}`);els.filterSummary.textContent=a.length?a.join(" · "):"Sin filtros activos";}
  function renderAll(){renderFilterSummary();renderKPIs();renderCharts();renderSubdelegaciones();renderTramites();}
  function applyFilters(){const s=selections();state.filteredData=state.allData.filter(r=>matches(r,s));renderAll();}
  function resetFilters(){filterDefs.forEach(f=>f.el.value="");refreshDependentFilters();applyFilters();}

  function wireEvents(){
    filterDefs.forEach(f=>f.el.addEventListener("change",()=>{refreshDependentFilters();applyFilters();}));
    els.btnReset.addEventListener("click",resetFilters); els.topTramites.addEventListener("change",renderTramites);
    document.querySelectorAll("[data-sort-sub]").forEach(th=>th.addEventListener("click",()=>{const k=th.dataset.sortSub;if(state.sortSub.key===k)state.sortSub.dir=state.sortSub.dir==="asc"?"desc":"asc";else{state.sortSub.key=k;state.sortSub.dir=k==="nombre"?"asc":"desc";}renderSubdelegaciones();}));
    document.querySelectorAll("[data-sort-tram]").forEach(th=>th.addEventListener("click",()=>{const k=th.dataset.sortTram;if(state.sortTram.key===k)state.sortTram.dir=state.sortTram.dir==="asc"?"desc":"asc";else{state.sortTram.key=k;state.sortTram.dir=k==="nombre"?"asc":(k==="tiempo"?"desc":"asc");}renderTramites();}));
  }

  async function init(){
    try{
      const response=await fetch(DATA_URL,{cache:"no-store"}); if(!response.ok)throw new Error(`HTTP ${response.status} al leer ${DATA_URL}`);
      const data=await response.json(); if(!Array.isArray(data))throw new Error("El JSON debe contener un arreglo de registros.");
      state.allData=data;state.filteredData=data;refreshDependentFilters();wireEvents();renderAll();
    }catch(e){console.error(e);els.errorPanel.hidden=false;els.errorMessage.textContent=e.message||String(e);}
  }

  init();
})();
