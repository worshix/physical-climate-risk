"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Leaf, Shield, BarChart3, Satellite } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.user.role === "ADMIN") {
        router.push("/admin/dashboard");
      } else {
        router.push("/borrower/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding (desktop only) */}
      <div className="hidden md:flex md:w-[45%] bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600 flex-col justify-between p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        <div className="relative flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">Mitiga Global Analytics Engine</span>
        </div>
        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white mb-3 leading-tight">
              IFRS 9 Physical Climate Risk Platform
            </h2>
            <p className="text-emerald-100 text-base leading-relaxed">
              Satellite-derived drought signals drive Two-Regime Markov-Switching credit migration
              for Zimbabwe&apos;s microfinance sector.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[
              { icon: Shield,    text: "IFRS 9 compliant ECL framework" },
              { icon: BarChart3, text: "Four-scenario drought stress testing" },
              { icon: Satellite, text: "SPEI-3 satellite drought index" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-emerald-100 text-sm">
                <div className="p-1.5 bg-white/15 rounded-md shrink-0">
                  <Icon className="h-4 w-4 text-white" />
                </div>
                {text}
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-emerald-200/60 text-xs">Research prototype · {new Date().getFullYear()}</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 md:hidden">
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-2.5 rounded-xl shadow-lg">
              <Leaf className="h-8 w-8 text-white" />
            </div>
          </div>

          <Card className="border-0 shadow-2xl">
            <CardHeader className="space-y-1 text-center pb-6 pt-8">
              <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</CardTitle>
              <CardDescription className="text-slate-500">
                Sign in to your Mitiga account
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    className="h-11 border-slate-200 focus:border-emerald-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    className="h-11 border-slate-200 focus:border-emerald-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base font-semibold shadow-sm mt-2"
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Sign In"}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="border-t border-slate-100 pt-6 pb-8 px-8">
              <p className="text-center w-full text-sm text-slate-500">
                No account?{" "}
                <Link href="/auth/signup" className="text-emerald-600 font-semibold hover:underline">
                  Contact your credit officer
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
