import type { Metadata } from "next";
import InvoiceGenerator from "@/components/InvoiceGenerator";

export const metadata: Metadata = {
  title: "Invoice Generator — Ganbaro",
  description:
    "Create professional PDF invoices for free. Fill in your details, add line items, set tax, and download instantly. Nothing is uploaded to a server.",
  alternates: { canonical: "https://ganbaro.vercel.app/invoice-generator" },
};

export default function InvoiceGeneratorPage() {
  return <InvoiceGenerator />;
}
