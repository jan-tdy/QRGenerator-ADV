(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // ---------- Theme ----------
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("qrgen-theme");
  if (savedTheme) root.setAttribute("data-theme", savedTheme);
  $("themeToggle").addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("qrgen-theme", next);
  });

  // ---------- Tabs ----------
  const tabs = document.querySelectorAll("#dataTabs .tab");
  const panels = document.querySelectorAll(".tab-panel");
  let activeType = "url";

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      activeType = tab.dataset.type;
      document.querySelector(`.tab-panel[data-panel="${activeType}"]`).classList.add("active");
      scheduleUpdate();
    });
  });

  // ---------- Helpers to escape vCard / WiFi special chars ----------
  const escapeField = (str = "") => str.replace(/([\\;,:])/g, "\\$1");

  function pad2(n) { return String(n).padStart(2, "0"); }
  function toICSDate(value) {
    if (!value) return "";
    const d = new Date(value);
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`;
  }

  // ---------- Build QR data string from active tab ----------
  function buildData() {
    switch (activeType) {
      case "url": {
        const v = $("f-url").value.trim();
        return v || "https://example.com";
      }
      case "text":
        return $("f-text").value;

      case "wifi": {
        const ssid = escapeField($("f-wifi-ssid").value);
        const pass = escapeField($("f-wifi-pass").value);
        const enc = $("f-wifi-enc").value;
        const hidden = $("f-wifi-hidden").checked ? "true" : "false";
        const passPart = enc === "nopass" ? "" : `P:${pass};`;
        return `WIFI:T:${enc};S:${ssid};${passPart}H:${hidden};;`;
      }

      case "vcard": {
        const first = $("f-vc-first").value;
        const last = $("f-vc-last").value;
        const org = $("f-vc-org").value;
        const title = $("f-vc-title").value;
        const phone = $("f-vc-phone").value;
        const email = $("f-vc-email").value;
        const url = $("f-vc-url").value;
        const address = $("f-vc-address").value;
        const lines = [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `N:${escapeField(last)};${escapeField(first)};;;`,
          `FN:${escapeField(`${first} ${last}`.trim())}`,
        ];
        if (org) lines.push(`ORG:${escapeField(org)}`);
        if (title) lines.push(`TITLE:${escapeField(title)}`);
        if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
        if (email) lines.push(`EMAIL:${email}`);
        if (url) lines.push(`URL:${url}`);
        if (address) lines.push(`ADR:;;${escapeField(address)};;;;`);
        lines.push("END:VCARD");
        return lines.join("\n");
      }

      case "email": {
        const to = encodeURIComponent($("f-email-to").value);
        const subject = encodeURIComponent($("f-email-subject").value);
        const body = encodeURIComponent($("f-email-body").value);
        return `mailto:${to}?subject=${subject}&body=${body}`;
      }

      case "sms": {
        const phone = $("f-sms-phone").value;
        const body = encodeURIComponent($("f-sms-body").value);
        return `sms:${phone}?body=${body}`;
      }

      case "tel":
        return `tel:${$("f-tel").value}`;

      case "geo": {
        const lat = $("f-geo-lat").value || "0";
        const lng = $("f-geo-lng").value || "0";
        return `geo:${lat},${lng}`;
      }

      case "event": {
        const title = $("f-ev-title").value;
        const loc = $("f-ev-loc").value;
        const desc = $("f-ev-desc").value;
        const start = $("f-ev-start").value;
        const end = $("f-ev-end").value;
        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//QR Generator ADV//EN",
          "BEGIN:VEVENT",
          `UID:${Date.now()}@qrgenerator-adv`,
          `DTSTAMP:${toICSDate(new Date().toISOString())}`,
          `SUMMARY:${escapeField(title)}`,
        ];
        if (loc) lines.push(`LOCATION:${escapeField(loc)}`);
        if (desc) lines.push(`DESCRIPTION:${escapeField(desc)}`);
        if (start) lines.push(`DTSTART:${toICSDate(start)}`);
        if (end) lines.push(`DTEND:${toICSDate(end)}`);
        lines.push("END:VEVENT");
        lines.push("END:VCALENDAR");
        return lines.join("\n");
      }

      default:
        return "";
    }
  }

  // ---------- QR instance ----------
  let qr = null;
  const renderTarget = $("qr-render");

  function currentOptions() {
    const size = parseInt($("s-size").value, 10);
    const margin = parseInt($("s-margin").value, 10);
    const ecc = $("s-ecc").value;

    const useGradient = $("s-gradient-toggle").checked;
    const dotsOptions = useGradient
      ? {
          type: $("s-dots-type").value,
          gradient: {
            type: $("s-grad-type").value,
            rotation: (parseInt($("s-grad-rotation").value, 10) * Math.PI) / 180,
            colorStops: [
              { offset: 0, color: $("s-grad-c1").value },
              { offset: 1, color: $("s-grad-c2").value },
            ],
          },
        }
      : {
          type: $("s-dots-type").value,
          color: $("s-color-dots").value,
        };

    const transparent = $("s-bg-transparent").checked;

    const options = {
      width: size,
      height: size,
      type: "svg",
      data: buildData() || " ",
      margin: margin,
      qrOptions: { errorCorrectionLevel: ecc },
      dotsOptions,
      cornersSquareOptions: { type: $("s-corners-square-type").value, color: dotsOptions.color || dotsOptions.gradient.colorStops[0].color },
      cornersDotOptions: { type: $("s-corners-dot-type").value, color: dotsOptions.color || dotsOptions.gradient.colorStops[1].color },
      backgroundOptions: transparent ? { color: "transparent" } : { color: $("s-color-bg").value },
      imageOptions: {
        crossOrigin: "anonymous",
        margin: $("s-logo-bg").checked ? 6 : 0,
        hideBackgroundDots: $("s-logo-bg").checked,
        imageSize: parseFloat($("s-logo-size").value),
      },
    };

    if (window.__qrLogoDataUrl) {
      options.image = window.__qrLogoDataUrl;
    }

    return options;
  }

  function render() {
    const options = currentOptions();
    renderTarget.innerHTML = "";

    if (!qr) {
      qr = new QRCodeStyling(options);
      qr.append(renderTarget);
    } else {
      qr.update(options);
    }

    $("dataPreviewHint").textContent = `Data: ${(buildData() || "").slice(0, 120)}`;

    const frame = $("s-frame").value;
    const frameText = $("s-frame-text").value || "";
    $("previewWrap").dataset.frame = frame;
    const labelEl = $("frameLabel");
    if (frame !== "none" && frameText) {
      labelEl.textContent = frameText;
      labelEl.classList.remove("hidden");
    } else {
      labelEl.classList.add("hidden");
    }
  }

  let updateTimer = null;
  function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(render, 80);
  }

  // Attach listeners to every input/select/textarea that affects output
  document.querySelectorAll("input, select, textarea").forEach((el) => {
    if (el.id === "s-logo-file" || el.id === "exportFormat") return;
    el.addEventListener("input", scheduleUpdate);
    el.addEventListener("change", scheduleUpdate);
  });

  // ---------- Size label ----------
  $("s-size").addEventListener("input", () => {
    $("sizeVal").textContent = $("s-size").value;
  });

  // ---------- Gradient / transparent toggles ----------
  $("s-gradient-toggle").addEventListener("change", () => {
    const on = $("s-gradient-toggle").checked;
    $("soloColorRow").classList.toggle("hidden", on);
    $("gradientColorRow").classList.toggle("hidden", !on);
  });
  $("s-bg-transparent").addEventListener("change", () => {
    $("bgColorLabel").classList.toggle("hidden", $("s-bg-transparent").checked);
  });

  // ---------- Background theme ----------
  $("s-page-bg").addEventListener("change", () => {
    $("previewWrap").dataset.bg = $("s-page-bg").value;
  });

  // ---------- Logo upload ----------
  $("s-logo-file").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      window.__qrLogoDataUrl = reader.result;
      render();
    };
    reader.readAsDataURL(file);
  });
  $("s-logo-clear").addEventListener("click", () => {
    window.__qrLogoDataUrl = null;
    $("s-logo-file").value = "";
    render();
  });

  // ---------- Geolocation ----------
  $("geoLocateBtn").addEventListener("click", () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      $("f-geo-lat").value = pos.coords.latitude.toFixed(6);
      $("f-geo-lng").value = pos.coords.longitude.toFixed(6);
      scheduleUpdate();
    });
  });

  // ---------- Presets ----------
  const presets = {
    classic: { dots: "square", cornersSquare: "square", cornersDot: "square", gradient: false, color: "#1a1d23", bg: "#ffffff" },
    rounded: { dots: "rounded", cornersSquare: "extra-rounded", cornersDot: "dot", gradient: false, color: "#1f2937", bg: "#ffffff" },
    dots: { dots: "dots", cornersSquare: "dot", cornersDot: "dot", gradient: false, color: "#111827", bg: "#ffffff" },
    gradient: { dots: "classy-rounded", cornersSquare: "extra-rounded", cornersDot: "dot", gradient: true, c1: "#4f46e5", c2: "#0891b2", bg: "#ffffff" },
  };

  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = presets[btn.dataset.preset];
      if (!p) return;
      $("s-dots-type").value = p.dots;
      $("s-corners-square-type").value = p.cornersSquare;
      $("s-corners-dot-type").value = p.cornersDot;
      $("s-gradient-toggle").checked = !!p.gradient;
      $("soloColorRow").classList.toggle("hidden", !!p.gradient);
      $("gradientColorRow").classList.toggle("hidden", !p.gradient);
      if (p.gradient) {
        $("s-grad-c1").value = p.c1;
        $("s-grad-c2").value = p.c2;
      } else {
        $("s-color-dots").value = p.color;
      }
      $("s-color-bg").value = p.bg;
      render();
    });
  });

  // ---------- Save / load local settings ----------
  const FIELD_IDS = [
    "s-size", "s-margin", "s-ecc", "s-dots-type", "s-corners-square-type", "s-corners-dot-type",
    "s-gradient-toggle", "s-color-dots", "s-grad-c1", "s-grad-c2", "s-grad-type", "s-grad-rotation",
    "s-bg-transparent", "s-color-bg", "s-logo-size", "s-logo-bg", "s-page-bg", "s-frame", "s-frame-text",
  ];

  $("saveLocalBtn").addEventListener("click", () => {
    const snapshot = {};
    FIELD_IDS.forEach((id) => {
      const el = $(id);
      snapshot[id] = el.type === "checkbox" ? el.checked : el.value;
    });
    localStorage.setItem("qrgen-settings", JSON.stringify(snapshot));
  });

  $("loadLocalBtn").addEventListener("click", () => {
    const raw = localStorage.getItem("qrgen-settings");
    if (!raw) return;
    const snapshot = JSON.parse(raw);
    FIELD_IDS.forEach((id) => {
      if (!(id in snapshot)) return;
      const el = $(id);
      if (el.type === "checkbox") el.checked = snapshot[id];
      else el.value = snapshot[id];
    });
    $("soloColorRow").classList.toggle("hidden", $("s-gradient-toggle").checked);
    $("gradientColorRow").classList.toggle("hidden", !$("s-gradient-toggle").checked);
    $("bgColorLabel").classList.toggle("hidden", $("s-bg-transparent").checked);
    $("previewWrap").dataset.bg = $("s-page-bg").value;
    $("sizeVal").textContent = $("s-size").value;
    render();
  });

  // ---------- Composite background theme + frame/label on top of the raw QR ----------
  function blobToImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  }

  function drawRoundedRect(ctx, x, y, w, h, r, fill) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  function drawThemeBackground(ctx, w, h, theme) {
    if (theme === "paper") {
      ctx.fillStyle = "#f1ead9";
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.strokeStyle = "rgba(120,100,70,0.3)";
      ctx.lineWidth = 1;
      for (let y = 20; y < h; y += 26) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.setLineDash([w * 0.012, w * 0.008]);
      ctx.lineWidth = Math.max(3, w * 0.008);
      ctx.strokeStyle = "#b8a97e";
      ctx.strokeRect(4, 4, w - 8, h - 8);
      ctx.restore();
    } else if (theme === "stars") {
      const grad = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, Math.max(w, h));
      grad.addColorStop(0, "#1b2140");
      grad.addColorStop(1, "#0a0c1a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      let seed = 42;
      const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 60; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = rand() * 1.4 + 0.3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (!$("s-bg-transparent").checked) {
      ctx.fillStyle = $("s-color-bg").value || "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Returns a canvas with the selected background theme and frame/label baked
  // in, or null when neither is active (callers then use the raw QR export).
  async function getComposedCanvas() {
    const theme = $("s-page-bg").value;
    const frame = $("s-frame").value;
    if (theme === "none" && frame === "none") return null;

    const frameText = $("s-frame-text").value || "";
    const qrImg = await blobToImage(await qr.getRawData("png"));
    const qrSize = qrImg.width;

    const framePad = frame === "scan-me" ? Math.round(qrSize * 0.12) : 0;
    const labelHeight = frame !== "none" && frameText ? Math.round(qrSize * 0.14) : 0;
    const outerPad = theme !== "none" ? Math.round(qrSize * 0.08) : 0;

    const canvasW = qrSize + 2 * framePad + 2 * outerPad;
    const canvasH = qrSize + 2 * framePad + 2 * outerPad + labelHeight;

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext("2d");

    drawThemeBackground(ctx, canvasW, canvasH, theme);

    const qrX = (canvasW - qrSize) / 2;
    const qrY = outerPad + framePad;

    if (theme === "stars") {
      const pad = Math.round(qrSize * 0.05);
      drawRoundedRect(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, qrSize * 0.03, "#ffffff");
    }

    if (frame === "scan-me") {
      ctx.save();
      ctx.setLineDash([qrSize * 0.015, qrSize * 0.01]);
      ctx.lineWidth = Math.max(2, qrSize * 0.01);
      ctx.strokeStyle = theme === "stars" ? "#ffffff" : "#1a1d23";
      ctx.strokeRect(qrX - framePad * 0.6, qrY - framePad * 0.6, qrSize + framePad * 1.2, qrSize + framePad * 1.2);
      ctx.restore();
    }

    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    if (labelHeight > 0) {
      ctx.save();
      ctx.fillStyle = theme === "stars" ? "#ffffff" : "#1a1d23";
      ctx.font = `600 ${Math.round(qrSize * 0.065)}px -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(frameText, canvasW / 2, canvasH - outerPad - labelHeight / 2);
      ctx.restore();
    }

    return canvas;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Export ----------
  $("downloadBtn").addEventListener("click", async () => {
    const format = $("exportFormat").value;
    const name = `qrcode-${Date.now()}`;
    const composed = await getComposedCanvas();

    if (format === "pdf") {
      const canvas = composed || await blobToImage(await qr.getRawData("png")).then((img) => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        c.getContext("2d").drawImage(img, 0, 0);
        return c;
      });
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "pt", format: [canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${name}.pdf`);
      return;
    }

    if (!composed) {
      qr.download({ name, extension: format });
      return;
    }

    if (format === "svg") {
      const pngDataUrl = composed.toDataURL("image/png");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${composed.width}" height="${composed.height}" viewBox="0 0 ${composed.width} ${composed.height}"><image href="${pngDataUrl}" width="${composed.width}" height="${composed.height}"/></svg>`;
      triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${name}.svg`);
      return;
    }

    const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const blob = await canvasToBlob(composed, mime, 0.92);
    triggerDownload(blob, `${name}.${format === "jpeg" ? "jpg" : format}`);
  });

  $("copyBtn").addEventListener("click", async () => {
    try {
      const composed = await getComposedCanvas();
      const blob = composed ? await canvasToBlob(composed, "image/png") : await qr.getRawData("png");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } catch (err) {
      console.warn("Clipboard copy failed:", err);
    }
  });

  // ---------- Init ----------
  render();
})();
