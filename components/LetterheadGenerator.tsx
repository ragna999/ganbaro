"use client";

import { useState, useRef } from "react";

type Style = "classic" | "corporate" | "minimal";
type PageSize = "a4" | "letter";

interface Form {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  color: string;
  style: Style;
  pageSize: PageSize;
}

const COLOR_PRESETS = [
  { label: "Violet",  value: "#7c3aed" },
  { label: "Blue",    value: "#1d4ed8" },
  { label: "Green",   value: "#15803d" },
  { label: "Red",     value: "#b91c1c" },
  { label: "Slate",   value: "#334155" },
  { label: "Black",   value: "#111111" },
];

const PAGE_DIMS = {
  a4:     { w: 595, h: 842 },
  letter: { w: 612, h: 792 },
};

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

async function logoToPng(file: File): Promise<Uint8Array> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d")!.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej()), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

const defaultForm: Form = {
  companyName: "", tagline: "", address: "", phone: "", email: "", website: "",
  color: "#7c3aed", style: "classic", pageSize: "a4",
};

export default function LetterheadGenerator() {
  const [form, setForm] = useState<Form>(defaultForm);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  function setField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleLogo(f: File) {
    if (!f.type.startsWith("image/")) { setError("Logo must be an image file."); return; }
    setError("");
    if (logoUrl) URL.revokeObjectURL(logoUrl);
    setLogo(f);
    setLogoUrl(URL.createObjectURL(f));
  }

  async function handleDownload() {
    if (!form.companyName.trim()) { setError("Please enter a company name."); return; }
    setProcessing(true);
    setError("");

    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

      const doc = await PDFDocument.create();
      const fontBold    = await doc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

      const { w: W, h: H } = PAGE_DIMS[form.pageSize];
      const page = doc.addPage([W, H]);
      const { r, g, b } = hexToRgb(form.color);
      const accentColor = rgb(r, g, b);
      const white = rgb(1, 1, 1);
      const dark  = rgb(0.1, 0.1, 0.1);
      const muted = rgb(0.45, 0.45, 0.45);
      const margin = 50;

      // Embed logo if provided
      let embeddedLogo: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
      if (logo) {
        try {
          const pngData = await logoToPng(logo);
          embeddedLogo = await doc.embedPng(pngData);
        } catch { /* skip logo on error */ }
      }

      const contactParts = [form.address, form.phone, form.email, form.website].filter(Boolean);
      const contactLine = contactParts.join("  ·  ");

      // ── CLASSIC ──────────────────────────────────────────────────────────
      if (form.style === "classic") {
        // Header band
        const hh = 90;
        page.drawRectangle({ x: 0, y: H - hh, width: W, height: hh, color: accentColor });

        // Logo in header (left)
        if (embeddedLogo) {
          const maxLH = hh - 20;
          const scale = Math.min(maxLH / embeddedLogo.height, 100 / embeddedLogo.width);
          const lw = embeddedLogo.width * scale;
          const lh = embeddedLogo.height * scale;
          page.drawImage(embeddedLogo, { x: margin, y: H - hh / 2 - lh / 2, width: lw, height: lh });
        }

        // Company name & tagline (centered)
        const nameSize = 24;
        const nameW = fontBold.widthOfTextAtSize(form.companyName, nameSize);
        page.drawText(form.companyName, {
          x: W / 2 - nameW / 2, y: H - hh / 2 + (form.tagline ? 8 : 0),
          size: nameSize, font: fontBold, color: white,
        });
        if (form.tagline) {
          const tagW = fontRegular.widthOfTextAtSize(form.tagline, 10);
          page.drawText(form.tagline, {
            x: W / 2 - tagW / 2, y: H - hh / 2 - 14,
            size: 10, font: fontRegular, color: rgb(r * 0.7 + 0.3, g * 0.7 + 0.3, b * 0.7 + 0.3),
          });
        }

        // Footer band
        const fh = 36;
        page.drawRectangle({ x: 0, y: 0, width: W, height: fh, color: accentColor });
        if (contactLine) {
          const cw = fontRegular.widthOfTextAtSize(contactLine, 8);
          page.drawText(contactLine, {
            x: W / 2 - cw / 2, y: fh / 2 - 4,
            size: 8, font: fontRegular, color: white,
          });
        }

        // Thin accent line below header
        page.drawLine({ start: { x: 0, y: H - hh - 2 }, end: { x: W, y: H - hh - 2 }, thickness: 2, color: rgb(r * 0.8, g * 0.8, b * 0.8) });
      }

      // ── CORPORATE ────────────────────────────────────────────────────────
      if (form.style === "corporate") {
        // Left color strip
        const stripW = 8;
        page.drawRectangle({ x: 0, y: 0, width: stripW, height: H, color: accentColor });

        const cx = stripW + margin;

        // Logo
        if (embeddedLogo) {
          const maxLH = 50;
          const scale = Math.min(maxLH / embeddedLogo.height, 80 / embeddedLogo.width);
          const lw = embeddedLogo.width * scale;
          const lh = embeddedLogo.height * scale;
          page.drawImage(embeddedLogo, { x: cx, y: H - 30 - lh, width: lw, height: lh });
        }

        // Company name
        page.drawText(form.companyName, {
          x: cx, y: H - 50,
          size: 22, font: fontBold, color: accentColor,
        });
        if (form.tagline) {
          page.drawText(form.tagline, {
            x: cx, y: H - 66,
            size: 9, font: fontRegular, color: muted,
          });
        }

        // Thin line below header
        page.drawLine({ start: { x: cx, y: H - 78 }, end: { x: W - margin, y: H - 78 }, thickness: 1, color: accentColor });

        // Footer: contact info left, line above
        page.drawLine({ start: { x: cx, y: 48 }, end: { x: W - margin, y: 48 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        if (contactLine) {
          page.drawText(contactLine, { x: cx, y: 34, size: 8, font: fontRegular, color: muted });
        }
      }

      // ── MINIMAL ──────────────────────────────────────────────────────────
      if (form.style === "minimal") {
        // Company name top-left
        page.drawText(form.companyName, {
          x: margin, y: H - 48,
          size: 20, font: fontBold, color: dark,
        });
        if (form.tagline) {
          page.drawText(form.tagline, {
            x: margin, y: H - 64, size: 9, font: fontRegular, color: muted,
          });
        }

        // Logo top-right
        if (embeddedLogo) {
          const maxLH = 40;
          const scale = Math.min(maxLH / embeddedLogo.height, 80 / embeddedLogo.width);
          const lw = embeddedLogo.width * scale;
          const lh = embeddedLogo.height * scale;
          page.drawImage(embeddedLogo, { x: W - margin - lw, y: H - 30 - lh, width: lw, height: lh });
        }

        // Accent line
        page.drawLine({ start: { x: margin, y: H - 74 }, end: { x: W - margin, y: H - 74 }, thickness: 2, color: accentColor });

        // Contact info top-right (if no logo)
        if (!embeddedLogo && contactParts.length > 0) {
          let cy = H - 48;
          contactParts.forEach((part) => {
            const pw = fontRegular.widthOfTextAtSize(part, 8);
            page.drawText(part, { x: W - margin - pw, y: cy, size: 8, font: fontRegular, color: muted });
            cy -= 13;
          });
        }

        // Footer
        page.drawLine({ start: { x: margin, y: 42 }, end: { x: W - margin, y: 42 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
        if (contactLine) {
          const cw = fontRegular.widthOfTextAtSize(contactLine, 8);
          page.drawText(contactLine, {
            x: W / 2 - cw / 2, y: 28, size: 8, font: fontRegular, color: muted,
          });
        }
      }

      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.companyName.replace(/\s+/g, "-").toLowerCase()}-letterhead.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to generate letterhead. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors";
  const labelCls = "block text-xs font-medium text-zinc-400 mb-1.5";
  const { r, g, b } = hexToRgb(form.color);

  return (
    
      <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-8">

        {/* ── Left: Form ── */}
        <div className="flex-1 space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100">Letterhead Generator</h2>
            <p className="text-zinc-500 mt-1 text-sm">
              Create a professional company letterhead. Download as PDF, ready to use.
            </p>
          </div>

          {/* Company info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Company Info</p>
            <div><label className={labelCls}>Company Name *</label><input className={inputCls} value={form.companyName} onChange={(e) => setField("companyName", e.target.value)} placeholder="Acme Corp" /></div>
            <div><label className={labelCls}>Tagline</label><input className={inputCls} value={form.tagline} onChange={(e) => setField("tagline", e.target.value)} placeholder="Building the future, one step at a time." /></div>
            <div>
              <label className={labelCls}>Logo (optional)</label>
              {logoUrl ? (
                <div className="flex items-center gap-3 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
                  <img src={logoUrl} alt="logo" className="h-8 w-auto object-contain rounded" />
                  <span className="text-xs text-zinc-400 flex-1 truncate">{logo?.name}</span>
                  <button onClick={() => { setLogo(null); URL.revokeObjectURL(logoUrl); setLogoUrl(""); }} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Remove</button>
                </div>
              ) : (
                <button onClick={() => logoInputRef.current?.click()} className="w-full border border-dashed border-zinc-700 hover:border-violet-500 rounded-lg px-3 py-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-center">
                  Click to upload logo (PNG, JPG, WebP)
                </button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogo(f); e.target.value = ""; }} />
            </div>
          </div>

          {/* Contact info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Contact Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className={labelCls}>Address</label><input className={inputCls} value={form.address} onChange={(e) => setField("address", e.target.value)} placeholder="Jl. Sudirman No. 1, Jakarta" /></div>
              <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+62 21 000 0000" /></div>
              <div><label className={labelCls}>Email</label><input className={inputCls} value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="hello@acme.com" /></div>
              <div><label className={labelCls}>Website</label><input className={inputCls} value={form.website} onChange={(e) => setField("website", e.target.value)} placeholder="www.acme.com" /></div>
            </div>
          </div>

          {/* Style & color */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Design</p>

            {/* Style */}
            <div>
              <p className={labelCls}>Layout style</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "classic",   label: "Classic",   desc: "Colored header band" },
                  { value: "corporate", label: "Corporate", desc: "Left accent strip" },
                  { value: "minimal",   label: "Minimal",   desc: "Clean & simple" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setField("style", opt.value)}
                    className={`p-2.5 rounded-lg text-left border transition-colors ${
                      form.style === opt.value
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
                    }`}
                  >
                    <p className="text-xs font-semibold text-zinc-200">{opt.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div>
              <p className={labelCls}>Primary color</p>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setField("color", c.value)}
                    title={c.label}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      form.color === c.value ? "border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <label className="w-7 h-7 rounded-full border-2 border-zinc-600 overflow-hidden cursor-pointer relative" title="Custom color">
                  <input type="color" value={form.color} onChange={(e) => setField("color", e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  <div className="w-full h-full rounded-full" style={{ backgroundColor: form.color }} />
                </label>
              </div>
            </div>

            {/* Page size */}
            <div>
              <p className={labelCls}>Page size</p>
              <div className="flex gap-2">
                {(["a4", "letter"] as const).map((ps) => (
                  <button
                    key={ps}
                    onClick={() => setField("pageSize", ps)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      form.pageSize === ps
                        ? "bg-violet-600 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {ps.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            onClick={handleDownload}
            disabled={processing}
            className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {processing ? "Generating PDF…" : "Download Letterhead PDF"}
          </button>
        </div>

        {/* ── Right: Preview ── */}
        <div className="lg:w-72 xl:w-80 shrink-0">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Preview</p>
          <div className="sticky top-0">
            {/* A4-ratio preview card */}
            <div className="w-full rounded-xl overflow-hidden border border-zinc-700 bg-white" style={{ aspectRatio: "595/842" }}>
              {form.style === "classic" && (
                <div className="h-full flex flex-col text-[0px]">
                  {/* Header */}
                  <div className="shrink-0 flex flex-col items-center justify-center gap-0.5 py-3" style={{ backgroundColor: form.color }}>
                    {logoUrl && <img src={logoUrl} alt="" className="h-5 object-contain mb-0.5" />}
                    <span className="text-white font-bold text-[7px] leading-none">{form.companyName || "Company Name"}</span>
                    {form.tagline && <span className="text-[4.5px] leading-none" style={{ color: `rgba(${Math.round(r*255*0.7+77)},${Math.round(g*255*0.7+77)},${Math.round(b*255*0.7+77)},1)` }}>{form.tagline}</span>}
                  </div>
                  {/* Body */}
                  <div className="flex-1 bg-white" />
                  {/* Footer */}
                  <div className="shrink-0 py-1.5 flex items-center justify-center" style={{ backgroundColor: form.color }}>
                    <span className="text-white text-[3.5px] leading-none opacity-80">{[form.address, form.phone, form.email, form.website].filter(Boolean).join("  ·  ") || "contact@company.com"}</span>
                  </div>
                </div>
              )}

              {form.style === "corporate" && (
                <div className="h-full flex text-[0px]">
                  {/* Strip */}
                  <div className="w-2 shrink-0 h-full" style={{ backgroundColor: form.color }} />
                  {/* Content */}
                  <div className="flex-1 flex flex-col px-3 py-3">
                    {logoUrl && <img src={logoUrl} alt="" className="h-4 object-contain object-left mb-1" />}
                    <span className="font-bold text-[7px] leading-none" style={{ color: form.color }}>{form.companyName || "Company Name"}</span>
                    {form.tagline && <span className="text-[4px] text-gray-400 leading-none mt-0.5">{form.tagline}</span>}
                    <div className="mt-1 h-px w-full" style={{ backgroundColor: form.color }} />
                    <div className="flex-1" />
                    <div className="h-px w-full bg-gray-200 mb-1" />
                    <span className="text-[3.5px] text-gray-400 leading-none">{[form.address, form.phone, form.email, form.website].filter(Boolean).join("  ·  ") || "contact@company.com"}</span>
                  </div>
                </div>
              )}

              {form.style === "minimal" && (
                <div className="h-full flex flex-col px-3 py-3 text-[0px]">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-[7px] text-gray-900 leading-none">{form.companyName || "Company Name"}</span>
                      {form.tagline && <p className="text-[4px] text-gray-400 leading-none mt-0.5">{form.tagline}</p>}
                    </div>
                    {logoUrl && <img src={logoUrl} alt="" className="h-5 object-contain" />}
                  </div>
                  <div className="mt-1.5 h-0.5 w-full rounded" style={{ backgroundColor: form.color }} />
                  <div className="flex-1" />
                  <div className="h-px w-full bg-gray-200 mb-1" />
                  <span className="text-[3.5px] text-gray-400 leading-none text-center block">{[form.address, form.phone, form.email, form.website].filter(Boolean).join("  ·  ") || "contact@company.com"}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-600 mt-2 text-center">Approximate preview</p>
          </div>
        </div>

      </div>
  );
}
