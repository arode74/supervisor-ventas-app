// scripts/utils/fechas_chile.js

// Formatea una Date a YYYY-MM-DD usando la fecha LOCAL del navegador
export function formatoFechaLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// “Hoy” según el navegador (si el PC está en horario Chile)
export function hoyChileLocal() {
  return formatoFechaLocal(new Date());
}

// Rango permitido: mes actual y mes anterior (para input date)
export function rangoMesActualYAnterior() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes0 = hoy.getMonth(); // 0–11

  const inicioMin = new Date(anio, mes0 - 1, 1); // 1er día mes anterior
  const finMax    = new Date(anio, mes0 + 1, 0); // último día mes actual

  return {
    min: formatoFechaLocal(inicioMin),
    max: formatoFechaLocal(finMax),
    hoy: formatoFechaLocal(hoy),
  };
}
