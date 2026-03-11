"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, ArrowLeft, Activity } from "lucide-react";

export default function AddObservationPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const router = useRouter();

  const [obsPeriod, setObsPeriod] = useState("");
  const [obsDate, setObsDate] = useState("");
  const [rating, setRating] = useState("");
  const [defaultFlag, setDefaultFlag] = useState("false");
  const [gamma, setGamma] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!obsPeriod || !obsDate || !rating || gamma === "" || !loanAmount) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/loans/${loanId}/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          obsPeriod: obsPeriod.trim(),
          obsDate,
          rating: parseInt(rating),
          defaultFlag: defaultFlag === "true",
          gamma: parseFloat(gamma),
          loanAmount: parseFloat(loanAmount),
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to add observation");
      }
      router.push(`/admin/loans/${loanId}`);
    } catch (err: any) {
      setError(err.message ?? "Error adding observation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <nav className="flex items-center gap-3 px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <Link href={`/admin/loans/${loanId}`}>
          <Button variant="ghost" size="icon" className="text-slate-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="bg-emerald-600 p-1.5 rounded-lg">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-slate-900">Add Observation</span>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-lg mx-auto w-full">
        <Card className="border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Activity className="h-4 w-4 text-emerald-600" /> Quarterly Rating Observation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Period</Label>
                  <Input
                    value={obsPeriod}
                    onChange={(e) => setObsPeriod(e.target.value)}
                    placeholder="e.g. 2024Q4"
                    className="mt-1 border-slate-200"
                  />
                </div>
                <div>
                  <Label className="text-sm">Observation Date</Label>
                  <Input
                    type="date"
                    value={obsDate}
                    onChange={(e) => setObsDate(e.target.value)}
                    className="mt-1 border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Credit Rating</Label>
                  <Select onValueChange={setRating} value={rating}>
                    <SelectTrigger className="mt-1 border-slate-200">
                      <SelectValue placeholder="1–5" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 — Excellent</SelectItem>
                      <SelectItem value="4">4 — Good</SelectItem>
                      <SelectItem value="3">3 — Watch</SelectItem>
                      <SelectItem value="2">2 — At Risk</SelectItem>
                      <SelectItem value="1">1 — Default</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Default Flag</Label>
                  <Select onValueChange={setDefaultFlag} value={defaultFlag}>
                    <SelectTrigger className="mt-1 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="true">Yes — In Default</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm">γ (SPEI Drought Index)</Label>
                <Input
                  type="number" step="0.01"
                  value={gamma}
                  onChange={(e) => setGamma(e.target.value)}
                  placeholder="e.g. −1.20 (negative = drought)"
                  className="mt-1 border-slate-200"
                />
                <p className="text-xs text-slate-400 mt-0.5">Negative = drought stress · Positive = wet · Threshold γ₀ = −1.10</p>
              </div>

              <div>
                <Label className="text-sm">Outstanding Balance (EAD) — USD</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="4500.00"
                  className="mt-1 border-slate-200"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? "Saving…" : "Add Observation"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
