"use client";

import { useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Leaf, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import FieldMap from "@/components/Map/FieldMap";

const CROP_TYPES = [
  "Maize",
  "Smallholder Mixed",
  "Horticulture / Vegetables",
  "Tobacco",
  "Livestock",
  "Sorghum / Millet",
  "Other",
];

const ZW_CENTER = { lat: -19.0, lng: 29.8 };

type Step = "field" | "analysing" | "done";

function OnboardingForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("field");
  const [fieldName, setFieldName]   = useState("");
  const [cropType, setCropType]     = useState("");
  const [polygon, setPolygon]       = useState<unknown>(null);
  const [latInput, setLatInput]     = useState("");
  const [lngInput, setLngInput]     = useState("");
  const [mapCenter, setMapCenter]   = useState<{ lat: number; lng: number } | null>(ZW_CENTER);
  const [error, setError]           = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ score: number; speiLabel: string; spei: number } | null>(null);

  const onPolygonCreated = useCallback((data: unknown) => {
    const geoJson = data as { features?: unknown[] };
    if (geoJson?.features?.[0]) setPolygon(geoJson.features[0]);
    else setPolygon(null);
  }, []);

  const handleGoToCoords = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError("Enter valid coordinates (lat −90–90, lng −180–180).");
      return;
    }
    setError(null);
    setMapCenter({ lat, lng });
  };

  const handleSaveAndAnalyse = async () => {
    if (!fieldName.trim()) { setError("Please enter a name for your field."); return; }
    if (!cropType)          { setError("Please select what you grow."); return; }
    if (!polygon)           { setError("Please draw your field boundary on the map."); return; }
    setError(null);
    setStep("analysing");

    try {
      // 1. Create the field
      const fieldRes = await fetch("/api/borrower/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fieldName.trim(), cropType, polygon }),
      });
      if (!fieldRes.ok) {
        const body = await fieldRes.json() as { error?: string };
        throw new Error(body.error ?? "Could not save field.");
      }
      const field = await fieldRes.json() as { id: string };

      // 2. Trigger SPEI + satellite analysis
      const analyseRes = await fetch(`/api/borrower/field/${field.id}/analyse`, {
        method: "POST",
      });
      if (!analyseRes.ok) {
        const body = await analyseRes.json() as { error?: string };
        throw new Error(body.error ?? "Analysis failed.");
      }
      const result = await analyseRes.json() as {
        analysis: { agriculturalScore: number };
        spei: { value: number; label: string };
      };

      setAnalysisResult({
        score: Math.round(result.analysis.agriculturalScore),
        speiLabel: result.spei.label,
        spei: Math.round(result.spei.value * 100) / 100,
      });
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStep("field");
    }
  };

  // ── Done / success screen ──────────────────────────────────────────────────
  if (step === "done" && analysisResult) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-emerald-100 rounded-full p-5">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your farm is set up!</h1>
            <p className="text-slate-500 mt-2 text-sm">
              We've analysed your field using satellite imagery and climate data.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Farm Health Score</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">{analysisResult.score}<span className="text-base text-slate-400">/100</span></p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Drought Index (SPEI)</p>
              <p className="text-3xl font-black text-slate-800 mt-1">{analysisResult.spei}</p>
              <p className="text-xs text-slate-500 mt-1">{analysisResult.speiLabel}</p>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            The SPEI (Standardized Precipitation Evapotranspiration Index) is the drought index
            used by your MFI's credit risk model. Values below −1.0 indicate drought stress.
          </p>

          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            onClick={() => router.push("/borrower/dashboard")}
          >
            Go to My Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // ── Analysing / loading screen ─────────────────────────────────────────────
  if (step === "analysing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Analysing your field…</h2>
          <p className="text-sm text-slate-500 max-w-xs">
            Fetching 3 years of climate records and computing your SPEI drought index.
            This may take up to 30 seconds.
          </p>
        </div>
      </div>
    );
  }

  // ── Main field setup screen ────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Set Up Your Farm</h1>
            <p className="text-xs text-slate-400">Step 1 of 1 — draw your field to get your climate score</p>
          </div>
        </div>
        <Button
          onClick={handleSaveAndAnalyse}
          className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          disabled={!polygon || !fieldName || !cropType}
        >
          <CheckCircle2 className="h-4 w-4" />
          Save & Get My Score
        </Button>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 border-r border-slate-200 bg-white p-6 flex flex-col gap-6 overflow-y-auto hidden md:flex">
          {/* Instructions */}
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-1">
            <p className="text-sm font-bold text-emerald-800">How this works</p>
            <ol className="text-xs text-emerald-700 space-y-1 list-decimal list-inside">
              <li>Enter your field name and crop type</li>
              <li>Navigate to your farm on the map</li>
              <li>Draw the boundary using the polygon tool</li>
              <li>Click "Save & Get My Score" — we'll fetch satellite and climate data</li>
            </ol>
          </div>

          <div className="space-y-1.5">
            <Label>Field name <span className="text-red-500">*</span></Label>
            <Input
              value={fieldName}
              onChange={e => setFieldName(e.target.value)}
              placeholder="e.g. Home Plot / North Field"
            />
          </div>

          <div className="space-y-1.5">
            <Label>What do you grow? <span className="text-red-500">*</span></Label>
            <Select value={cropType} onValueChange={setCropType}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {CROP_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Navigate to your farm</p>
            <p className="text-xs text-slate-500">Enter the coordinates if you know them, or zoom in on the map manually.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-slate-500">Latitude</Label>
                <Input
                  type="number" step="any"
                  value={latInput}
                  onChange={e => setLatInput(e.target.value)}
                  placeholder="−17.83"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Longitude</Label>
                <Input
                  type="number" step="any"
                  value={lngInput}
                  onChange={e => setLngInput(e.target.value)}
                  placeholder="31.05"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleGoToCoords} className="w-full gap-2 text-xs">
              <MapPin className="h-3 w-3" /> Go to Location
            </Button>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1">Draw field boundary</p>
            <p className="text-xs text-slate-500">
              Use the <span className="font-semibold">polygon tool</span> (toolbar on the left of the map) to outline your field.
            </p>
            {!!polygon && (
              <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Boundary drawn
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
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

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingForm />
    </Suspense>
  );
}
