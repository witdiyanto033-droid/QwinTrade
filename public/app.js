const $ = (id) => document.getElementById(id);

const symbolEl = $("symbol");
const intervalEl = $("interval");

let lastBars = [];

async function loadMarket() {
  const symbol = symbolEl?.value || "XAU/USD";
  const interval = intervalEl?.value || "1min";

  try {
    if ($("status")) $("status").textContent = "LOADING...";

    const res = await fetch(
      `/api/market?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Gagal mengambil data market");
    }

    lastBars = data.bars || [];

    // =========================
    // DATA MARKET
    // =========================
    if ($("status")) $("status").textContent = "LIVE";

    if ($("pair")) {
      $("pair").textContent = data.symbol || symbol;
    }

    if ($("price")) {
      const last = lastBars[lastBars.length - 1];
      $("price").textContent =
        last?.close != null ? Number(last.close).toFixed(3) : "—";
    }

    // =========================
    // ANALISA
    // =========================
    const a = data.analysis || {};

    if ($("conf")) {
      $("conf").textContent =
        a.confidence != null ? `${a.confidence}%` : "—";
    }

    if ($("entry")) {
      $("entry").textContent =
        a.entry != null ? a.entry : "—";
    }

    if ($("signal")) {
      $("signal").textContent =
        a.signal || "WAIT";
    }

    if ($("smc")) {
      $("smc").textContent =
        a.structure || a.smc || "—";
    }

    if ($("zones")) {
      $("zones").textContent =
        `Support: ${a.support ?? "—"} | Resistance: ${a.resistance ?? "—"}`;
    }

    // =========================
    // GEMINI
    // =========================
    if ($("ai")) {
      $("ai").textContent =
        data.gemini?.text ||
        "Analisa AI belum tersedia.";
    }

    // =========================
    // DRAW CANDLESTICK
    // =========================
    drawChart(lastBars);

    console.log("MARKET DATA:", data);

  } catch (err) {
    console.error("MARKET ERROR:", err);

    if ($("status")) {
      $("status").textContent = "ERROR";
    }

    if ($("ai")) {
      $("ai").textContent =
        "Gagal mengambil data: " + err.message;
    }
  }
}


// =====================================================
// CANVAS CANDLESTICK CHART
// =====================================================

function drawChart(bars) {
  const container = $("chart");

  if (!container) {
    console.error("Elemen #chart tidak ditemukan.");
    return;
  }

  if (!bars || !bars.length) {
    container.innerHTML =
      '<div style="padding:30px;text-align:center;color:#aaa">Belum ada data candle</div>';
    return;
  }

  // Bersihkan chart lama
  container.innerHTML = "";

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";

  container.appendChild(canvas);

  const rect = container.getBoundingClientRect();

  const dpr = window.devicePixelRatio || 1;

  const width = Math.max(rect.width, 300);
  const height = Math.max(rect.height, 300);

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");

  ctx.scale(dpr, dpr);

  // Ambil candle terakhir
  const data = bars.slice(-80);

  const highs = data.map(x => Number(x.high));
  const lows = data.map(x => Number(x.low));

  const maxPrice = Math.max(...highs);
  const minPrice = Math.min(...lows);

  const range = maxPrice - minPrice || 1;

  const paddingTop = 25;
  const paddingBottom = 35;
  const paddingLeft = 10;
  const paddingRight = 65;

  const chartWidth =
    width - paddingLeft - paddingRight;

  const chartHeight =
    height - paddingTop - paddingBottom;

  function priceToY(price) {
    return (
      paddingTop +
      ((maxPrice - price) / range) * chartHeight
    );
  }

  // Background
  ctx.fillStyle = "#090b18";
  ctx.fillRect(0, 0, width, height);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 6; i++) {
    const y =
      paddingTop +
      (chartHeight / 6) * i;

    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();

    const price =
      maxPrice -
      (range / 6) * i;

    ctx.fillStyle = "#8d91a8";
    ctx.font = "11px Arial";
    ctx.fillText(
      price.toFixed(3),
      width - paddingRight + 5,
      y + 4
    );
  }

  // Candle width
  const candleSpace =
    chartWidth / data.length;

  const candleWidth =
    Math.max(3, candleSpace * 0.65);

  // Draw candles
  data.forEach((candle, i) => {
    const open = Number(candle.open);
    const high = Number(candle.high);
    const low = Number(candle.low);
    const close = Number(candle.close);

    const x =
      paddingLeft +
      i * candleSpace +
      candleSpace / 2;

    const yOpen = priceToY(open);
    const yHigh = priceToY(high);
    const yLow = priceToY(low);
    const yClose = priceToY(close);

    const bullish = close >= open;

    // Wick
    ctx.strokeStyle =
      bullish ? "#21d4a5" : "#ff5c7a";

    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();

    // Body
    const bodyTop =
      Math.min(yOpen, yClose);

    const bodyHeight =
      Math.max(
        Math.abs(yClose - yOpen),
        1
      );

    ctx.fillStyle =
      bullish ? "#21d4a5" : "#ff5c7a";

    ctx.fillRect(
      x - candleWidth / 2,
      bodyTop,
      candleWidth,
      bodyHeight
    );
  });

  // Harga terakhir
  const last = data[data.length - 1];
  const lastPrice = Number(last.close);
  const lastY = priceToY(lastPrice);

  ctx.strokeStyle = "#ffffff";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(paddingLeft, lastY);
  ctx.lineTo(width - paddingRight, lastY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label harga terakhir
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Arial";

  ctx.fillText(
    lastPrice.toFixed(3),
    width - paddingRight + 5,
    lastY - 5
  );

  // Pair
  ctx.fillStyle = "#c9cce0";
  ctx.font = "bold 13px Arial";

  ctx.fillText(
    symbolEl?.value || "XAU/USD",
    12,
    18
  );
}


// =====================================================
// EVENTS
// =====================================================

symbolEl?.addEventListener(
  "change",
  loadMarket
);

intervalEl?.addEventListener(
  "change",
  loadMarket
);


// Resize chart
window.addEventListener(
  "resize",
  () => {
    if (lastBars.length) {
      drawChart(lastBars);
    }
  }
);


// Load pertama
loadMarket();


// Auto refresh 20 detik
setInterval(
  loadMarket,
  20000
);
