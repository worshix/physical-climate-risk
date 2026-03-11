"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, ArrowLeft, CreditCard } from "lucide-react";

function NewLoanForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const borrowerId = searchParams.get("borrowerId") ?? "";

  const [loanRef, setLoanRef] = useState("");
  const [currentRating, setCurrentRating] = useState("");
  const [loanAmount, setLoanAmount] = useState("");
  const [disbursementDate, setDisbursementDate] = useState("");
  const [stage, setStage] = useState("STAGE_1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowerId) { setError("No borrower selected."); return; }
    if (!loanRef.trim() || !currentRating || !loanAmount || !disbursementDate) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrowerId,
          loanRef: loanRef.trim(),
          currentRating: parseInt(currentRating),
          loanAmount: parseFloat(loanAmount),
          disbursementDate,
          stage,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to create loan");
      }
      router.push(`/admin/borrowers/${borrowerId}`);
    } catch (err: any) {
      setError(err.message ?? "Error creating loan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <nav className="flex items-center gap-3 px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <Link href={borrowerId ? `/admin/borrowers/${borrowerId}` : "/admin/dashboard"}>
          <Button variant="ghost" size="icon" className="text-slate-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="bg-emerald-600 p-1.5 rounded-lg">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-slate-900">New Loan</span>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-lg mx-auto w-full">
        <Card className="border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <CreditCard className="h-4 w-4 text-emerald-600" /> Loan Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-sm">Loan Reference</Label>
                <Input
                  value={loanRef}
                  onChange={(e) => setLoanRef(e.target.value)}
                  placeholder="e.g. MFI-2024-001"
                  className="mt-1 border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Initial Rating</Label>
                  <Select onValueChange={setCurrentRating} value={currentRating}>
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
                  <Label className="text-sm">IFRS 9 Stage</Label>
                  <Select onValueChange={setStage} value={stage}>
                    <SelectTrigger className="mt-1 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STAGE_1">Stage 1</SelectItem>
                      <SelectItem value="STAGE_2">Stage 2</SelectItem>
                      <SelectItem value="STAGE_3">Stage 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm">Loan Amount (EAD) — USD</Label>
                <Input
                  type="number" min="1" step="0.01"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="5000.00"
                  className="mt-1 border-slate-200"
                />
              </div>

              <div>
                <Label className="text-sm">Disbursement Date</Label>
                <Input
                  type="date"
                  value={disbursementDate}
                  onChange={(e) => setDisbursementDate(e.target.value)}
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
                {loading ? "Saving…" : "Create Loan"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function NewLoanPage() {
  return (
    <Suspense>
      <NewLoanForm />
    </Suspense>
  );
}
