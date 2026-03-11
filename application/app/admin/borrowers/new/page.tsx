"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Leaf, UserPlus } from "lucide-react";

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

export default function NewBorrowerPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    nationalId: "",
    district: "",
    primaryActivity: "",
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/borrowers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register borrower");

      router.push(`/admin/borrowers/${data.id}`);
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
          <span className="text-lg font-bold text-slate-900">Register New Borrower</span>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-2xl mx-auto w-full">
        <Card className="border-slate-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2.5 rounded-xl">
                <UserPlus className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Borrower Profile</CardTitle>
                <CardDescription>Register a new MFI client in the system.</CardDescription>
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

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" required value={form.name} onChange={set("name")}
                    placeholder="Tendai Moyo" className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationalId">National ID</Label>
                  <Input id="nationalId" value={form.nationalId} onChange={set("nationalId")}
                    placeholder="63-123456Z80" className="border-slate-200" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email (login) *</Label>
                  <Input id="email" type="email" required value={form.email} onChange={set("email")}
                    placeholder="tendai@example.com" className="border-slate-200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" value={form.phone} onChange={set("phone")}
                    placeholder="+263 77 123 4567" className="border-slate-200" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <select id="district" value={form.district} onChange={set("district")}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">Select district...</option>
                    {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryActivity">Primary Activity</Label>
                  <select id="primaryActivity" value={form.primaryActivity} onChange={set("primaryActivity")}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">Select activity...</option>
                    {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password *</Label>
                <Input id="password" type="password" required value={form.password} onChange={set("password")}
                  placeholder="Set a temporary password for the borrower" className="border-slate-200" />
                <p className="text-xs text-slate-400">The borrower should change this on first login.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8">
                  {loading ? "Registering..." : "Register Borrower"}
                </Button>
                <Link href="/admin/dashboard">
                  <Button type="button" variant="outline" className="h-11">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
