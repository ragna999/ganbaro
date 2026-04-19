export interface Tool {
  id: string;
  path: string;
  icon: string;
  label: string;
  desc: string;
  category: string;
}

export const tools: Tool[] = [
  { id: "repo",     path: "/repo-explainer",  icon: "⚡",  label: "Repo Explainer",  desc: "Explain any public GitHub repo: architecture, tech stack, and key insights.",    category: "AI"      },
  { id: "doc",      path: "/doc-qa",           icon: "📄",  label: "Doc Q&A",         desc: "Upload a PDF and ask anything about its content. Powered by AI.",                 category: "AI"      },
  { id: "reader",   path: "/pdf-reader",       icon: "🎧",  label: "PDF Reader",      desc: "Listen to any text-based PDF read aloud. Adjust speed and voice.",                category: "PDF"     },
  { id: "splitter", path: "/pdf-splitter",     icon: "✂️",  label: "PDF Splitter",    desc: "Split large PDFs into smaller chunks. Great before running OCR.",                 category: "PDF"     },
  { id: "ocr",      path: "/pdf-ocr",          icon: "🔍",  label: "PDF OCR",         desc: "Extract text from scanned PDFs. Output as a text-based PDF. Max 50 pages.",       category: "PDF"     },
  { id: "ascii",    path: "/ascii-art",        icon: "🖼️",  label: "ASCII Art",       desc: "Convert any image into ASCII art. Download as PNG or JPG.",                       category: "Fun"     },
  { id: "compress", path: "/file-compressor",  icon: "📦",  label: "File Compressor", desc: "Compress images, PDFs, and DOCX files locally. Nothing is uploaded to a server.", category: "Utility" },
  { id: "img2pdf",  path: "/image-to-pdf",    icon: "📑",  label: "Image to PDF",    desc: "Combine multiple images into a single PDF. Reorder, choose page size, and download.", category: "Utility" },
  { id: "merger",   path: "/pdf-merger",      icon: "📎",  label: "PDF Merger",      desc: "Combine multiple PDF files into one. Reorder pages before merging.",                    category: "PDF"     },
  { id: "watermark",path: "/watermark-pdf",   icon: "🔏",  label: "Watermark PDF",   desc: "Add a text watermark to every page of a PDF. Choose opacity, angle, and layout.",      category: "PDF"     },
  { id: "invoice",     path: "/invoice-generator",    icon: "🧾", label: "Invoice Generator",    desc: "Create and download professional PDF invoices. Add items, tax, and notes.",            category: "Utility" },
  { id: "letterhead", path: "/letterhead-generator", icon: "📋", label: "Letterhead Generator", desc: "Design a company letterhead with your logo and brand color. Download as PDF.",          category: "Utility" },
];

export const faqItems = [
  {
    tool: "⚡ Repo Explainer",
    q: "What is Repo Explainer?",
    a: "Paste any public GitHub repo URL and AI will explain its architecture, tech stack, how it works, and key insights from the codebase. Perfect for developers who want to quickly understand a new project.",
  },
  {
    tool: "📄 Doc Q&A",
    q: "What is Doc Q&A?",
    a: "Upload a PDF (a paper, book, manual, or report) then ask anything about its content. The AI will answer based on the document.",
  },
  {
    tool: "🎧 PDF Reader",
    q: "What is PDF Reader?",
    a: "Upload a text-based PDF and your browser will read it aloud. Adjust speed, choose a voice, and jump to any paragraph. Ideal for learning while doing something else.",
  },
  {
    tool: "✂️ PDF Splitter",
    q: "What is PDF Splitter?",
    a: "Split large PDFs into smaller parts with a page count you choose. Useful before using PDF OCR, which has a 50-page limit.",
  },
  {
    tool: "🔍 PDF OCR",
    q: "What is PDF OCR?",
    a: "Upload a scanned PDF and this tool extracts the text using OCR. The result can be downloaded as a text-based PDF, ready for PDF Reader or Doc Q&A. Max 50 pages. Use PDF Splitter first for large files.",
  },
  {
    tool: "🖼️ ASCII Art",
    q: "What is ASCII Art?",
    a: "Upload any image and convert it into ASCII art using text characters. Choose a character set, adjust width, invert brightness, and download the result as PNG or JPG.",
  },
  {
    tool: "📦 File Compressor",
    q: "What is File Compressor?",
    a: "Compress images (JPG/PNG/WebP), PDFs, or DOCX files directly in your browser. Nothing is uploaded to a server. Images can be reduced by up to 80%.",
  },
  {
    tool: "📑 Image to PDF",
    q: "What is Image to PDF?",
    a: "Upload multiple images and combine them into a single PDF. You can reorder the images, choose a page size (fit to image, A4, or Letter), and download the result. Runs entirely in your browser.",
  },
  {
    tool: "📎 PDF Merger",
    q: "What is PDF Merger?",
    a: "Upload multiple PDF files, reorder them, and merge them into a single PDF. Useful for combining reports, scans, or chapters into one document. Runs entirely in your browser.",
  },
  {
    tool: "🔏 Watermark PDF",
    q: "What is Watermark PDF?",
    a: "Add a custom text watermark to every page of a PDF. Choose the text, opacity (light, medium, heavy), angle (diagonal or horizontal), and layout (centered or tiled). Download the watermarked PDF instantly.",
  },
  {
    tool: "🧾 Invoice Generator",
    q: "What is Invoice Generator?",
    a: "Fill in your business info, client details, line items, tax rate, and notes — then download a professional PDF invoice. Supports multiple currencies. Nothing is uploaded to a server.",
  },
  {
    tool: "📋 Letterhead Generator",
    q: "What is Letterhead Generator?",
    a: "Create a professional company letterhead with your company name, tagline, logo, contact info, and brand color. Choose from three layout styles (Classic, Corporate, Minimal) and download as a PDF ready to use in Word or as a template.",
  },
];

export const categoryColor: Record<string, string> = {
  AI:      "bg-violet-500/10 text-violet-400 border-violet-500/20",
  PDF:     "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Utility: "bg-green-500/10 text-green-400 border-green-500/20",
  Fun:     "bg-orange-500/10 text-orange-400 border-orange-500/20",
};
