"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Leaf, Users } from "lucide-react";

const DISTRICTS = [
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Manicaland",
  "Masvingo",
  "Matabeleland South",
  "Matabeleland North",
  "Midlands",
];

const ACTIVITIES = [
  "Smallholder Agriculture",
  "Informal Trade",
  "Livestock & Agri-processing",
  "Services & Transport",
  "Other",
];

interface Farmer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  nationalId: string | null;
  district: string | null;
  primaryActivity: string | null;
}

export default function NewBorrowerPage() {
  const router = useRouter();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loadingFarmers, setLoadingFarmers] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    phone: "",
    nationalId: "",
    district: "",
    primaryActivity: "",
  });

  useEffect(() => {
    fetch("/api/admin/borrowers")
      .then((r) => r.json())
      .then((data: Farmer[]) => setFarmers(data))
      .catch(() => setError("Failed to load registered farmers."))
      .finally(() => setLoadingFarmers(false));
  }, []);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const farmer = farmers.find((f) => f.id === id);
    if (farmer) {
      setForm({
        phone: farmer.phone ?? "",
        nationalId: farmer.nationalId ?? "",
        district: farmer.district ?? "",
        primaryActivity: farmer.primaryActivity ?? "",
      });
    } else {
      setForm({ phone: "", nationalId: "", district: "", primaryActivity: "" });
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const selectedFarmer = farmers.find((f) => f.id === selectedId) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/borrowers/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update borrower profile");
      }

      router.push(`/admin/borrowers/${selectedId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <nav className="flex items-center gap-4 px-6 py-4 bg-white border-b border-slate-200">
        <Link href="/admin/dashboard">
          <Button variant="ghost" size="icon" className="text-slate-500">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">Register Farmer as Borrower</span>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full">
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2.5 rounded-xl">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Select a Registered Farmer</CardTitle>
                <CardDescription>
                  Choose a self-registered farmer to onboard as a credit borrower.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                  {error}
                </div>
              )}

              {/* Farmer selector */}
              <div className="space-y-2">
                <Label htmlFor="farmer">Registered Farmer *</Label>
                <select
                  id="farmer"
                  required
                  value={selectedId}
                  onChange={(e) => handleSelect(e.target.value)}
                  disabled={loadingFarmers}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                >
                  <option value="">
                    {loadingFarmers ? "Loading farmers…" : "Select a farmer…"}
                  </option>
                  {farmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {f.email}
                    </option>
                  ))}
                </select>
                {!loadingFarmers && farmers.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No self-registered farmers found. Farmers must register themselves first.
                  </p>
                )}
              </div>

              {/* Profile info — shown once a farmer is selected */}
              {selectedFarmer && (
                <>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 space-y-0.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Farmer Account</p>
                    <p className="text-sm font-semibold text-slate-900">{selectedFarmer.name}</p>
                    <p className="text-sm text-slate-500">{selectedFarmer.email}</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nationalId">National ID</Label>
                      <Input
                        id="nationalId"
                        value={form.nationalId}
                        onChange={set("nationalId")}
                        placeholder="63-123456Z80"
                        className="border-slate-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        onChange={set("phone")}
                        placeholder="+263 77 123 4567"
                        className="border-slate-200"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="district">District</Label>
                      <select
                        id="district"
                        value={form.district}
                        onChange={set("district")}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select district…</option>
                        {DISTRICTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="primaryActivity">Primary Activity</Label>
                      <select
                        id="primaryActivity"
                        value={form.primaryActivity}
                        onChange={set("primaryActivity")}
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select activity…</option>
                        {ACTIVITIES.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={loading || !selectedId}
                  className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8"
                >
                  {loading ? "Registering…" : "Register as Borrower"}
                </Button>
                <Link href="/admin/dashboard">
                  <Button type="button" variant="outline" className="h-11">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
