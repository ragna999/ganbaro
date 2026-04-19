"use client";

import { useState } from "react";

interface LineItem {
  id: string;
  description: string;
  qty: string;
  rate: string;
}

interface InvoiceForm {
  fromName: string;
  fromEmail: string;
  fromPhone: string;
  fromAddress: string;
  toName: string;
  toEmail: string;
  toAddress: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  currency: string;
  taxRate: string;
  notes: string;
}

const CURRENCIES = ["USD", "EUR", "GBP", "IDR", "SGD", "AUD", "JPY"];

function uid() { return Math.random().toString(36).slice(2, 9); }

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const defaultForm: InvoiceForm = {
  fromName: "", fromEmail: "", fromPhone: "", fromAddress: "",
  toName: "", toEmail: "", toAddress: "",
  invoiceNumber: "INV-001",
  date: new Date().toISOString().split("T")[0],
  dueDate: new Date(Date.now() + 30 * 864e5).toISOString().split("T")[0],
  currency: "USD",
  taxRate: "",
  notes: "",
};

export default function InvoiceGenerator() {
  const [form, setForm] = useState<InvoiceForm>(defaultForm);
  const [items, setItems] = useState<LineItem[]>([
    { id: uid(), description: "", qty: "1", rate: "" },
  ]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  function setField(key: keyof InvoiceForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setItem(id: string, key: keyof LineItem, value: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [key]: value } : i)));
  }

  function addItem() {
    setItems((prev) => [...prev, { id: uid(), description: "", qty: "1", rate: "" }]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const subtotal = items.reduce((sum, i) => {
    const qty = parseFloat(i.qty) || 0;
    const rate = parseFloat(i.rate) || 0;
    return sum + qty * rate;
  }, 0);
  const taxAmount = subtotal * ((parseFloat(form.taxRate) || 0) / 100);
  const total = subtotal + taxAmount;

  async function handleGenerate() {
    if (!form.fromName || !form.toName) {
      setError("Please fill in at least the sender and recipient names.");
      return;
    }
    setProcessing(true);
    setError("");

    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

      const doc = await PDFDocument.create();
      const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
      const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

      const W = 595, H = 842;
      const margin = 50;
      const page = doc.addPage([W, H]);

      // Color helpers
      const black  = rgb(0.07, 0.07, 0.07);
      const muted  = rgb(0.45, 0.45, 0.45);
      const white  = rgb(1, 1, 1);
      const accent = rgb(0.29, 0.0, 0.51);
      const light  = rgb(0.96, 0.96, 0.96);
      const lineC  = rgb(0.85, 0.85, 0.85);

      // ── Header band ──────────────────────────────────────
      page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: rgb(0.07, 0.07, 0.07) });
      page.drawText(form.fromName || "Your Company", {
        x: margin, y: H - 55, size: 20, font: fontBold, color: white,
      });
      page.drawText("INVOICE", {
        x: W - margin - fontBold.widthOfTextAtSize("INVOICE", 22),
        y: H - 55, size: 22, font: fontBold, color: rgb(0.7, 0.5, 1),
      });

      // ── Info row ─────────────────────────────────────────
      let y = H - 120;
      const col2 = W / 2 + 20;

      // From details
      page.drawText("From", { x: margin, y, size: 8, font: fontBold, color: accent });
      y -= 16;
      if (form.fromEmail) { page.drawText(form.fromEmail, { x: margin, y, size: 9, font: fontRegular, color: muted }); y -= 13; }
      if (form.fromPhone) { page.drawText(form.fromPhone, { x: margin, y, size: 9, font: fontRegular, color: muted }); y -= 13; }
      if (form.fromAddress) {
        form.fromAddress.split("\n").forEach((line) => {
          page.drawText(line.trim(), { x: margin, y, size: 9, font: fontRegular, color: muted }); y -= 13;
        });
      }

      // Invoice details (right side)
      const infoY = H - 136;
      const labelW = 80;
      const rows: [string, string][] = [
        ["Invoice #", form.invoiceNumber],
        ["Date",      form.date],
        ["Due Date",  form.dueDate],
        ["Currency",  form.currency],
      ];
      let ry = infoY;
      rows.forEach(([label, val]) => {
        page.drawText(label, { x: col2, y: ry, size: 9, font: fontBold, color: muted });
        page.drawText(val, { x: col2 + labelW, y: ry, size: 9, font: fontRegular, color: black });
        ry -= 15;
      });

      // ── Bill To ──────────────────────────────────────────
      y = Math.min(y, ry) - 20;
      page.drawText("Bill To", { x: margin, y, size: 8, font: fontBold, color: accent });
      y -= 15;
      page.drawText(form.toName, { x: margin, y, size: 10, font: fontBold, color: black });
      y -= 14;
      if (form.toEmail) { page.drawText(form.toEmail, { x: margin, y, size: 9, font: fontRegular, color: muted }); y -= 13; }
      if (form.toAddress) {
        form.toAddress.split("\n").forEach((line) => {
          page.drawText(line.trim(), { x: margin, y, size: 9, font: fontRegular, color: muted }); y -= 13;
        });
      }

      // ── Table ────────────────────────────────────────────
      y -= 20;
      const tableTop = y;
      const cols = { desc: margin, qty: 340, rate: 410, amount: 490 };

      // Table header
      page.drawRectangle({ x: margin, y: tableTop - 22, width: W - margin * 2, height: 24, color: rgb(0.12, 0.0, 0.22) });
      page.drawText("Description", { x: cols.desc + 6, y: tableTop - 15, size: 8, font: fontBold, color: white });
      page.drawText("Qty",         { x: cols.qty,       y: tableTop - 15, size: 8, font: fontBold, color: white });
      page.drawText("Rate",        { x: cols.rate,       y: tableTop - 15, size: 8, font: fontBold, color: white });
      page.drawText("Amount",      { x: cols.amount,     y: tableTop - 15, size: 8, font: fontBold, color: white });

      y = tableTop - 24;

      // Table rows
      items.forEach((item, idx) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const amount = qty * rate;
        const rowH = 24;

        if (idx % 2 === 1) {
          page.drawRectangle({ x: margin, y: y - rowH, width: W - margin * 2, height: rowH, color: light });
        }

        const desc = item.description || "(no description)";
        const maxDescW = cols.qty - cols.desc - 12;
        let displayDesc = desc;
        while (fontRegular.widthOfTextAtSize(displayDesc, 9) > maxDescW && displayDesc.length > 0) {
          displayDesc = displayDesc.slice(0, -1);
        }
        if (displayDesc.length < desc.length) displayDesc = displayDesc.slice(0, -1) + "…";

        page.drawText(displayDesc, { x: cols.desc + 6, y: y - 15, size: 9, font: fontRegular, color: black });
        page.drawText(qty.toString(),                  { x: cols.qty,   y: y - 15, size: 9, font: fontRegular, color: black });
        page.drawText(formatCurrency(rate, form.currency),   { x: cols.rate,  y: y - 15, size: 9, font: fontRegular, color: black });
        page.drawText(formatCurrency(amount, form.currency), { x: cols.amount,y: y - 15, size: 9, font: fontRegular, color: black });

        y -= rowH;
        // Row bottom line
        page.drawLine({ start: { x: margin, y }, end: { x: W - margin, y }, thickness: 0.5, color: lineC });
      });

      // ── Totals ───────────────────────────────────────────
      y -= 15;
      const totalsX = cols.rate - 30;
      const totalsValX = cols.amount;

      page.drawText("Subtotal", { x: totalsX, y, size: 9, font: fontRegular, color: muted });
      page.drawText(formatCurrency(subtotal, form.currency), { x: totalsValX, y, size: 9, font: fontRegular, color: black });

      if (parseFloat(form.taxRate) > 0) {
        y -= 16;
        page.drawText(`Tax (${form.taxRate}%)`, { x: totalsX, y, size: 9, font: fontRegular, color: muted });
        page.drawText(formatCurrency(taxAmount, form.currency), { x: totalsValX, y, size: 9, font: fontRegular, color: black });
      }

      y -= 8;
      page.drawLine({ start: { x: totalsX, y }, end: { x: W - margin, y }, thickness: 0.7, color: black });
      y -= 18;
      page.drawText("Total", { x: totalsX, y, size: 11, font: fontBold, color: black });
      page.drawText(formatCurrency(total, form.currency), { x: totalsValX, y, size: 11, font: fontBold, color: black });

      // ── Notes ────────────────────────────────────────────
      if (form.notes.trim()) {
        y -= 35;
        page.drawText("Notes", { x: margin, y, size: 8, font: fontBold, color: accent });
        y -= 14;
        form.notes.split("\n").forEach((line) => {
          page.drawText(line.trim(), { x: margin, y, size: 9, font: fontRegular, color: muted });
          y -= 13;
        });
      }

      // ── Footer ───────────────────────────────────────────
      page.drawLine({ start: { x: margin, y: 40 }, end: { x: W - margin, y: 40 }, thickness: 0.5, color: lineC });
      page.drawText("Generated with Ganbaro", {
        x: margin, y: 26, size: 8, font: fontRegular, color: rgb(0.7, 0.7, 0.7),
      });

      const bytes = await doc.save();
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form.invoiceNumber || "invoice"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError("Failed to generate invoice. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-lg px-3 py-2 text-sm placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors";
  const labelCls = "block text-xs font-medium text-zinc-400 mb-1.5";

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col p-4 sm:p-8 gap-6">
        {/* Header */}
        <div className="shrink-0">
          <h2 className="text-2xl font-bold text-zinc-100">Invoice Generator</h2>
          <p className="text-zinc-500 mt-1 text-sm">
            Fill in the details and download a professional PDF invoice. Nothing is saved or uploaded.
          </p>
        </div>

        {/* From / To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">From (You)</p>
            <div><label className={labelCls}>Business / Name *</label><input className={inputCls} value={form.fromName} onChange={(e) => setField("fromName", e.target.value)} placeholder="Acme Corp" /></div>
            <div><label className={labelCls}>Email</label><input className={inputCls} value={form.fromEmail} onChange={(e) => setField("fromEmail", e.target.value)} placeholder="hello@acme.com" /></div>
            <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.fromPhone} onChange={(e) => setField("fromPhone", e.target.value)} placeholder="+62 812 000 0000" /></div>
            <div><label className={labelCls}>Address</label><textarea className={`${inputCls} resize-none`} rows={2} value={form.fromAddress} onChange={(e) => setField("fromAddress", e.target.value)} placeholder="Jl. Sudirman No. 1, Jakarta" /></div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Bill To (Client)</p>
            <div><label className={labelCls}>Business / Name *</label><input className={inputCls} value={form.toName} onChange={(e) => setField("toName", e.target.value)} placeholder="Client Corp" /></div>
            <div><label className={labelCls}>Email</label><input className={inputCls} value={form.toEmail} onChange={(e) => setField("toEmail", e.target.value)} placeholder="client@example.com" /></div>
            <div><label className={labelCls}>Address</label><textarea className={`${inputCls} resize-none`} rows={3} value={form.toAddress} onChange={(e) => setField("toAddress", e.target.value)} placeholder="123 Main St, New York" /></div>
          </div>
        </div>

        {/* Invoice details */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Invoice Details</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className={labelCls}>Invoice #</label><input className={inputCls} value={form.invoiceNumber} onChange={(e) => setField("invoiceNumber", e.target.value)} /></div>
            <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={form.date} onChange={(e) => setField("date", e.target.value)} /></div>
            <div><label className={labelCls}>Due Date</label><input type="date" className={inputCls} value={form.dueDate} onChange={(e) => setField("dueDate", e.target.value)} /></div>
            <div>
              <label className={labelCls}>Currency</label>
              <select className={inputCls} value={form.currency} onChange={(e) => setField("currency", e.target.value)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Items</p>
          <div className="space-y-2 mb-3">
            <div className="hidden sm:grid grid-cols-[1fr_80px_110px_40px] gap-2 px-1">
              {["Description", "Qty", `Rate (${form.currency})`, ""].map((h) => (
                <span key={h} className="text-xs text-zinc-500">{h}</span>
              ))}
            </div>
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_80px_110px_40px] gap-2 items-center">
                <input
                  className={inputCls}
                  placeholder="Service or product description"
                  value={item.description}
                  onChange={(e) => setItem(item.id, "description", e.target.value)}
                />
                <input
                  className={inputCls}
                  type="number" min="0" step="any"
                  placeholder="1"
                  value={item.qty}
                  onChange={(e) => setItem(item.id, "qty", e.target.value)}
                />
                <input
                  className={inputCls}
                  type="number" min="0" step="any"
                  placeholder="0.00"
                  value={item.rate}
                  onChange={(e) => setItem(item.id, "rate", e.target.value)}
                />
                <button
                  onClick={() => removeItem(item.id)}
                  disabled={items.length === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-red-900/60 text-zinc-500 hover:text-red-400 disabled:opacity-20 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addItem}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            + Add item
          </button>
        </div>

        {/* Tax + Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Tax</p>
            <div><label className={labelCls}>Tax rate (%)</label><input className={inputCls} type="number" min="0" max="100" step="0.1" placeholder="e.g. 11" value={form.taxRate} onChange={(e) => setField("taxRate", e.target.value)} /></div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Notes / Terms</p>
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              placeholder="Payment due within 30 days. Thank you for your business."
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
            />
          </div>
        </div>

        {/* Totals summary */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex justify-end">
            <div className="space-y-1.5 text-sm min-w-[220px]">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, form.currency)}</span>
              </div>
              {parseFloat(form.taxRate) > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Tax ({form.taxRate}%)</span>
                  <span>{formatCurrency(taxAmount, form.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-100 font-bold text-base pt-2 border-t border-zinc-700">
                <span>Total</span>
                <span>{formatCurrency(total, form.currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          onClick={handleGenerate}
          disabled={processing}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
        >
          {processing ? "Generating PDF…" : "Download Invoice PDF"}
        </button>
      </div>
    </div>
  );
}
