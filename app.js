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

  // ---------- Themed renderers (paper: hand-drawn modules, stars: star-shaped modules) ----------
  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h >>> 0;
  }

  function mulberry32(seed) {
    let s = seed;
    return () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildQrMatrix(data, ecc) {
    const qrObj = qrcode(0, ecc);
    qrObj.addData(data || " ");
    qrObj.make();
    const count = qrObj.getModuleCount();
    const matrix = [];
    for (let r = 0; r < count; r++) {
      const row = [];
      for (let c = 0; c < count; c++) row.push(qrObj.isDark(r, c));
      matrix.push(row);
    }
    return { matrix, count };
  }

  // Per ISO/IEC 18004: the 7x7 finder pattern + its 1-module separator ring,
  // at each of the three corners. Rendered explicitly (see finder() below),
  // so the general module loop must leave this area alone entirely.
  function isCornerFinderBox(r, c, count) {
    return (r < 8 && c < 8) || (r < 8 && c >= count - 8) || (r >= count - 8 && c < 8);
  }

  // Alignment pattern center coordinates by QR version (1-40), from the
  // official ISO/IEC 18004 Annex E table.
  const ALIGNMENT_POSITION_TABLE = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
    [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
    [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102],
    [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
    [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
  ];

  // Timing patterns (row/col 6), the two format-info strips (row/col 8,
  // including the permanently-dark module), and alignment pattern squares
  // must keep their exact light/dark value and a crisp square shape — a
  // decoder's grid calibration and masking both depend on them. Only plain
  // data/error-correction codeword modules are safe to decorate.
  function isStructuralModule(r, c, count, alignmentCenters) {
    if (r === 6 || c === 6) return true;
    if (r === 8 && (c < 9 || c >= count - 8)) return true;
    if (c === 8 && (r < 9 || r >= count - 8)) return true;
    for (const pr of alignmentCenters) {
      for (const pc of alignmentCenters) {
        if (Math.abs(r - pr) <= 2 && Math.abs(c - pc) <= 2) return true;
      }
    }
    return false;
  }

  function gradientDefSvg(id, dotsOptions) {
    if (!dotsOptions.gradient) return { fillAttr: dotsOptions.color, defs: "" };
    const g = dotsOptions.gradient;
    if (g.type === "radial") {
      return {
        fillAttr: `url(#${id})`,
        defs: `<radialGradient id="${id}" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${g.colorStops[0].color}"/><stop offset="1" stop-color="${g.colorStops[1].color}"/></radialGradient>`,
      };
    }
    const dx = Math.cos(g.rotation);
    const dy = Math.sin(g.rotation);
    const x1 = 50 - dx * 50, y1 = 50 - dy * 50, x2 = 50 + dx * 50, y2 = 50 + dy * 50;
    return {
      fillAttr: `url(#${id})`,
      defs: `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop offset="0" stop-color="${g.colorStops[0].color}"/><stop offset="1" stop-color="${g.colorStops[1].color}"/></linearGradient>`,
    };
  }

  function starPath(cx, cy, outerR, innerR) {
    const points = 5;
    const step = Math.PI / points;
    let d = "";
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = -Math.PI / 2 + i * step;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
    }
    return d + "Z";
  }

  function sketchRectPath(x, y, size, rand) {
    const j = size * 0.26;
    const bow = size * 0.1;
    const corner = (cx, cy) => [cx + (rand() - 0.5) * j, cy + (rand() - 0.5) * j];
    const [x1, y1] = corner(x, y);
    const [x2, y2] = corner(x + size, y);
    const [x3, y3] = corner(x + size, y + size);
    const [x4, y4] = corner(x, y + size);
    const mid = (a, b, off) => [(a[0] + b[0]) / 2 + (rand() - 0.5) * off, (a[1] + b[1]) / 2 + (rand() - 0.5) * off];
    const m12 = mid([x1, y1], [x2, y2], bow);
    const m23 = mid([x2, y2], [x3, y3], bow);
    const m34 = mid([x3, y3], [x4, y4], bow);
    const m41 = mid([x4, y4], [x1, y1], bow);
    const p = (n) => n.toFixed(2);
    return `M${p(x1)},${p(y1)} Q${p(m12[0])},${p(m12[1])} ${p(x2)},${p(y2)} Q${p(m23[0])},${p(m23[1])} ${p(x3)},${p(y3)} Q${p(m34[0])},${p(m34[1])} ${p(x4)},${p(y4)} Q${p(m41[0])},${p(m41[1])} ${p(x1)},${p(y1)} Z`;
  }

  // Renders the QR as a fully custom SVG: wobbly hand-drawn squares for the
  // "paper" theme, five-point stars for the "stars" theme. Finder patterns
  // stay plain rounded squares so the code keeps scanning reliably.
  function renderThemedQrSvg(data, ecc, theme, requestedSize, dotsOptions, cornerSquareColor, cornerDotColor, bgColor, logoDataUrl, logoSizeFraction, logoBg) {
    const { matrix, count } = buildQrMatrix(data, ecc);
    const quiet = 4;
    const total = count + quiet * 2;
    // Dense data (many modules) needs more pixels per module than sparse
    // data for the sketch/star shapes to stay reliably scannable at low
    // resolution, so the rendered size can exceed the requested one.
    const size = Math.max(requestedSize, total * 10);
    const cell = size / total;
    const rand = mulberry32(hashSeed(data + theme));
    const gradId = "qrgrad-" + Math.abs(hashSeed(data)).toString(36);
    const { fillAttr, defs } = gradientDefSvg(gradId, dotsOptions);

    let logoStart = null;
    let logoEnd = null;
    if (logoDataUrl) {
      const clearModules = Math.ceil(count * logoSizeFraction * 1.15);
      logoStart = Math.floor((count - clearModules) / 2);
      logoEnd = logoStart + clearModules;
    }

    const version = Math.round((count - 17) / 4);
    const alignmentCenters = ALIGNMENT_POSITION_TABLE[version - 1] || [];

    let modules = "";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!matrix[r][c] || isCornerFinderBox(r, c, count)) continue;
        if (logoStart !== null && r >= logoStart && r < logoEnd && c >= logoStart && c < logoEnd) continue;
        const x = (c + quiet) * cell;
        const y = (r + quiet) * cell;
        if (isStructuralModule(r, c, count, alignmentCenters)) {
          modules += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="${fillAttr}"/>`;
        } else if (theme === "stars") {
          modules += `<path d="${starPath(x + cell / 2, y + cell / 2, cell * 0.62, cell * 0.32)}" fill="${fillAttr}"/>`;
        } else {
          modules += `<path d="${sketchRectPath(x + cell * 0.08, y + cell * 0.08, cell * 0.84, rand)}" fill="${fillAttr}"/>`;
        }
      }
    }

    const innerBg = bgColor === "transparent" ? "#ffffff" : bgColor;
    const finder = (originR, originC) => {
      const ox = (originC + quiet) * cell;
      const oy = (originR + quiet) * cell;
      return `<rect x="${ox}" y="${oy}" width="${cell * 7}" height="${cell * 7}" rx="${cell * 1.2}" fill="${cornerSquareColor}"/>
        <rect x="${ox + cell}" y="${oy + cell}" width="${cell * 5}" height="${cell * 5}" rx="${cell * 0.9}" fill="${innerBg}"/>
        <rect x="${ox + cell * 2}" y="${oy + cell * 2}" width="${cell * 3}" height="${cell * 3}" rx="${cell * 0.6}" fill="${cornerDotColor}"/>`;
    };
    const finders = finder(0, 0) + finder(0, count - 7) + finder(count - 7, 0);

    let logoMarkup = "";
    if (logoDataUrl && logoStart !== null) {
      const lx = (logoStart + quiet) * cell;
      const lsize = (logoEnd - logoStart) * cell;
      if (logoBg) {
        logoMarkup += `<rect x="${lx - cell * 0.3}" y="${lx - cell * 0.3}" width="${lsize + cell * 0.6}" height="${lsize + cell * 0.6}" rx="${cell}" fill="#ffffff"/>`;
      }
      logoMarkup += `<image href="${logoDataUrl}" x="${lx}" y="${lx}" width="${lsize}" height="${lsize}" preserveAspectRatio="xMidYMid slice"/>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${defs}</defs><rect width="${size}" height="${size}" fill="${bgColor === "transparent" ? "none" : bgColor}"/>${modules}${finders}${logoMarkup}</svg>`;
  }

  function themedDotsOptions() {
    const useGradient = $("s-gradient-toggle").checked;
    return useGradient
      ? {
          color: null,
          gradient: {
            type: $("s-grad-type").value,
            rotation: (parseInt($("s-grad-rotation").value, 10) * Math.PI) / 180,
            colorStops: [
              { offset: 0, color: $("s-grad-c1").value },
              { offset: 1, color: $("s-grad-c2").value },
            ],
          },
        }
      : { color: $("s-color-dots").value, gradient: null };
  }

  function buildThemedSvgString(theme, size) {
    const ecc = $("s-ecc").value;
    const dotsOptions = themedDotsOptions();
    const cornerSquareColor = dotsOptions.color || dotsOptions.gradient.colorStops[0].color;
    const cornerDotColor = dotsOptions.color || dotsOptions.gradient.colorStops[1].color;
    const bg = $("s-bg-transparent").checked ? "transparent" : $("s-color-bg").value;
    return renderThemedQrSvg(
      buildData() || " ",
      ecc,
      theme,
      size,
      dotsOptions,
      cornerSquareColor,
      cornerDotColor,
      bg,
      window.__qrLogoDataUrl,
      parseFloat($("s-logo-size").value),
      $("s-logo-bg").checked
    );
  }

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
    const theme = $("s-page-bg").value;
    renderTarget.innerHTML = "";

    if (theme === "paper" || theme === "stars") {
      const size = parseInt($("s-size").value, 10);
      renderTarget.innerHTML = buildThemedSvgString(theme, size);
      qr = null;
    } else {
      const options = currentOptions();
      if (!qr) {
        qr = new QRCodeStyling(options);
        qr.append(renderTarget);
      } else {
        qr.update(options);
      }
    }

    ["s-dots-type", "s-corners-square-type", "s-corners-dot-type"].forEach((id) => {
      $(id).disabled = theme !== "none";
    });

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

  // The raw QR image with no background theme or frame baked in yet: the
  // qr-code-styling render for the default look, or our own sketch/star SVG
  // rasterized to an image for the "paper" / "stars" themes.
  async function getBaseQrImage() {
    const theme = $("s-page-bg").value;
    if (theme === "paper" || theme === "stars") {
      const size = parseInt($("s-size").value, 10);
      const svgString = buildThemedSvgString(theme, size);
      return blobToImage(new Blob([svgString], { type: "image/svg+xml" }));
    }
    return blobToImage(await qr.getRawData("png"));
  }

  // Returns a canvas with the selected background theme and frame/label baked
  // in, or null when neither is active (callers then use the raw QR export).
  async function getComposedCanvas() {
    const theme = $("s-page-bg").value;
    const frame = $("s-frame").value;
    if (theme === "none" && frame === "none") return null;

    const frameText = $("s-frame-text").value || "";
    const qrImg = await getBaseQrImage();
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
      const canvas = composed || await getBaseQrImage().then((img) => {
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
