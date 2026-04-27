import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, AlertTriangle, ArrowRight, TrendingDown, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-1.5 rounded-lg shadow-sm">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">Mitiga Global Analytics Engine</span>
        </div>
        <Link href="/auth/login">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">Sign In</Button>
        </Link>
      </nav>

      <main className="flex-1">
        {/* Hero — full gradient */}
        <section className="relative px-6 py-24 md:py-36 overflow-hidden text-center">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-600" />
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="relative max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/15 text-white text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-8 border border-white/25">
              <Shield className="h-3.5 w-3.5" /> IFRS 9 · ECL · Two-Regime Markov-Switching Model
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-6 tracking-tight leading-tight">
              Physical Climate Risk <br />
              <span className="text-emerald-200">in Agricultural Credit</span>
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              A microfinance credit risk platform for Zimbabwean MFIs. Satellite-derived drought signals
              drive a Two-Regime Markov-Switching model to compute IFRS 9–compliant Expected Credit Loss.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/login">
                <Button
                  size="lg"
                  className="h-14 px-8 text-lg bg-white text-emerald-700 hover:bg-emerald-50 gap-2 shadow-xl font-bold"
                >
                  Credit Officer Login <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 px-8 text-lg gap-2 bg-transparent border-white/50 text-white hover:bg-white/10 hover:text-white"
                >
                  Register as a Farmer <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="bg-slate-900 py-8 px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "IFRS 9",      label: "Compliant Framework", color: "text-emerald-400" },
              { value: "SPEI-3",      label: "Drought Index Signal", color: "text-blue-400" },
              { value: "45%",         label: "LGD Parameter",        color: "text-amber-400" },
              { value: "4 Scenarios", label: "ECL Forecasting",      color: "text-violet-400" },
            ].map(({ value, label, color }) => (
              <div key={label}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Feature cards */}
        <section className="bg-white py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">How Mitiga Global Analytics Engine works</h2>
              <p className="text-slate-500 max-w-xl mx-auto">
                From satellite NDVI to IFRS 9 provisioning in one integrated workflow.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-0 shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600" />
                <CardHeader>
                  <div className="bg-emerald-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                    <Leaf className="h-6 w-6 text-emerald-600" />
                  </div>
                  <CardTitle className="text-xl font-bold">Satellite Field Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">
                    Admin draws farm polygons on a map. The system fetches NDVI and 14-day weather
                    data to compute an agricultural health score (0–100) and a drought proxy γ.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                <CardHeader>
                  <div className="bg-amber-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                  <CardTitle className="text-xl font-bold">Two-Regime Credit Migration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">
                    The logistic regime weight ω(γ) blends M_normal and M_stress migration matrices.
                    Under drought stress (γ &lt; −1.10), credit deterioration accelerates significantly.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
                <div className="h-1.5 bg-gradient-to-r from-blue-400 to-indigo-500" />
                <CardHeader>
                  <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                    <TrendingDown className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-xl font-bold">IFRS 9 ECL Forecasting</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">
                    1-year and lifetime ECL computed with LGD 45%, discount rate 5%. Four IFRS 9
                    scenarios (baseline / moderate drought / severe drought / wet recovery) produce
                    a probability-weighted expected ECL.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Model parameters — dark */}
        <section className="py-16 px-6 bg-gradient-to-br from-slate-800 to-slate-900">
          <h2 className="text-2xl font-bold text-white text-center mb-12">Model Parameters</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              { label: "Sharpness κ",   value: "1.25",  sub: "Regime switching",    accent: "from-emerald-500 to-teal-500" },
              { label: "Threshold γ₀",  value: "−1.10", sub: "Drought threshold",   accent: "from-amber-500 to-orange-500" },
              { label: "LGD",           value: "45%",   sub: "Loss given default",  accent: "from-red-500 to-rose-500" },
              { label: "Discount Rate", value: "5%",    sub: "Annual, quarterly DF", accent: "from-blue-500 to-indigo-500" },
            ].map(({ label, value, sub, accent }) => (
              <div
                key={label}
                className="relative rounded-xl border border-white/10 bg-white/5 p-5 text-center overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accent}`} />
                <p className="text-2xl font-bold text-white font-mono">{value}</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 px-6 bg-slate-900 border-t border-slate-800 text-center text-slate-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="bg-emerald-600 p-1 rounded">
            <Leaf className="h-3 w-3 text-white" />
          </div>
          <span className="font-semibold text-slate-300">Mitiga Global Analytics Engine</span>
        </div>
        <p>IFRS 9 Physical Climate Risk Platform · Zimbabwe Microfinance Sector</p>
        <p className="mt-1">© {new Date().getFullYear()} Mitiga Global Analytics Engine. Research prototype.</p>
      </footer>
    </div>
  );
}
