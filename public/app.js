const $ = (id) => document.getElementById(id);

const symbolEl = $("symbol");
const intervalEl = $("interval");

async function loadMarket() {
  const symbol = symbolEl?.value || "XAUUSD";
  const interval = intervalEl?.value || "1min";

  try {
    const res = await fetch(
      `/api/market?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Gagal mengambil data market");
    }

    // Status
    if ($("status")) {
      $("status").textContent = "LIVE";
    }

    // Confidence
    if ($("conf")) {
      $("conf").textContent =
        data.analysis?.confidence != null
          ? `${data.analysis.confidence}%`
          : "-";
    }

    // Entry
    if ($("entry")) {
      $("entry").textContent =
        data.analysis?.entry != null
          ? data.analysis.entry
          : "-";
    }

    // BUY / SELL
    if ($("signal")) {
      $("signal").textContent =
        data.analysis?.signal || "WAIT";
    }

    // AI analysis
    if ($("ai")) {
      $("ai").textContent =
        data.gemini?.text ||
        data.analysis?.text ||
        "Belum ada analisa AI.";
    }

    // SMC / Structure
    if ($("smc")) {
      $("smc").textContent =
        data.analysis?.structure ||
        data.analysis?.smc ||
        "-";
    }

    // Pair
    if ($("pair")) {
      $("pair").textContent = data.symbol || symbol;
    }

    // Price
    if ($("price")) {
      const bars = data.bars || [];
      const last = bars[bars.length - 1];

      $("price").textContent =
        last?.close != null ? last.close : "-";
    }

    console.log("Market:", data);

  } catch (err) {
    console.error(err);

    if ($("status")) {
      $("status").textContent = "ERROR";
    }

    if ($("ai")) {
      $("ai").textContent = "Gagal mengambil data: " + err.message;
    }
  }
}

// Tombol / perubahan pair
symbolEl?.addEventListener("change", loadMarket);
intervalEl?.addEventListener("change", loadMarket);

// Refresh otomatis
loadMarket();
setInterval(loadMarket, 20000);
