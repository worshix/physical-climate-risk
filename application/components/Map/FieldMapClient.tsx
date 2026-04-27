"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const FieldMap = dynamic(() => import("./FieldMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100">
      <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
    </div>
  ),
});

export default function FieldMapClient({ polygonString }: { polygonString: string }) {
  let polygon: unknown = null;
  try { polygon = JSON.parse(polygonString); } catch { /* ignore */ }
  if (!polygon) return null;
  return <FieldMap polygon={polygon} editable={false} />;
}
