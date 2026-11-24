const percent = document.querySelector("#porcentaje"),
  quantity = document.querySelector("#cantidad"),
  result = document.querySelector("#resultado");
function calculate() {
  const n = (percent.valueAsNumber * quantity.valueAsNumber) / 100;
  result.textContent = Number.isFinite(n)
    ? "Resultado: " +
      new Intl.NumberFormat("es-PE", { maximumFractionDigits: 8 }).format(n)
    : "Completa ambos valores.";
}
percent.addEventListener("input", calculate);
quantity.addEventListener("input", calculate);
