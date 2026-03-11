"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Leaf, ArrowLeft, Map as MapIcon, Save, MapPin } from "lucide-react";
import FieldMap from "@/components/Map/FieldMap";

const CROP_TYPES = [
  "Smallholder Agriculture",
  "Maize",
  "Tobacco",
  "Horticulture",
  "Livestock",
  "Sorghum/Millet",
  "Other",
];

// Zimbabwe default centre
const ZW_CENTER = { lat: -19.0, lng: 29.8 };

function CreateFieldForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const borrowerId = searchParams.get("borrowerId") ?? "";

  const [fieldName, setFieldName] = useState("");
  const [cropType, setCropType] = useState("");
  const [polygon, setPolygon] = useState<any>(null);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(ZW_CENTER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onPolygonCreated = useCallback((data: any) => {
    if (data?.features?.[0]) {
      setPolygon(data.features[0]);
    } else {
      setPolygon(null);
    }
  }, []);

  const handleGoToCoordinates = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError("Enter valid coordinates (lat −90–90, lng −180–180).");
      return;
    }
    setError("");
    setMapCenter({ lat, lng });
  };

  const handleSave = async () => {
    if (!borrowerId) { setError("No borrower selected."); return; }
    if (!fieldName.trim()) { setError("Field name is required."); return; }
    if (!cropType) { setError("Select a crop type."); return; }
    if (!polygon) { setError("Draw the field boundary on the map."); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ borrowerId, name: fieldName.trim(), cropType, polygon }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to save field");
      }

      const field = await res.json();
      router.push(`/admin/fields/${field.id}/analyse`);
    } catch (err: any) {
      setError(err.message ?? "Error saving field.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <Link href={borrowerId ? `/admin/borrowers/${borrowerId}` : "/admin/dashboard"}>
            <Button variant="ghost" size="icon" className="text-slate-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Add Field</h1>
          </div>
        </div>
        <Button
          onClick={handleSave}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          disabled={loading}
        >
          <Save className="h-4 w-4" />
          {loading ? "Saving…" : "Save & Analyse"}
        </Button>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-slate-200 bg-white p-6 overflow-y-auto hidden md:flex md:flex-col gap-6">
          <div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mb-2">1</div>
            <p className="text-sm font-medium text-slate-700 mb-1">Field name</p>
            <Input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="e.g. North Plot A"
              className="border-slate-200"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-slate-700 mb-1 block">Crop type</Label>
            <Select onValueChange={setCropType} value={cropType}>
              <SelectTrigger className="border-slate-200">
                <SelectValue placeholder="Select crop…" />
              </SelectTrigger>
              <SelectContent>
                {CROP_TYPES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mb-2">2</div>
            <p className="text-sm font-medium text-slate-700 mb-1">Navigate to field</p>
            <p className="text-xs text-slate-500 mb-2">Enter coordinates to jump to your farm location.</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <Label className="text-xs text-slate-500">Latitude</Label>
                <Input
                  type="number" step="any" value={latInput}
                  onChange={(e) => setLatInput(e.target.value)}
                  placeholder="−17.83"
                  className="border-slate-200 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Longitude</Label>
                <Input
                  type="number" step="any" value={lngInput}
                  onChange={(e) => setLngInput(e.target.value)}
                  placeholder="31.05"
                  className="border-slate-200 h-8 text-xs"
                />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleGoToCoordinates} className="w-full gap-2 text-xs">
              <MapPin className="h-3 w-3" /> Go to Location
            </Button>
          </div>

          <div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mb-2">3</div>
            <p className="text-sm font-medium text-slate-700 mb-1">Draw boundary</p>
            <p className="text-xs text-slate-500">Use the polygon tool on the map to outline the field.</p>
            {polygon && (
              <p className="text-xs text-emerald-600 font-medium mt-2">✓ Boundary drawn</p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative bg-slate-200">
          <FieldMap
            editable
            onPolygonCreated={onPolygonCreated}
            goToLocation={mapCenter}
            initialViewState={{ latitude: ZW_CENTER.lat, longitude: ZW_CENTER.lng, zoom: 6 }}
          />
        </div>
      </main>
    </div>
  );
}

export default function CreateFieldPage() {
  return (
    <Suspense>
      <CreateFieldForm />
    </Suspense>
  );
}
