import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Leaf, AlertTriangle, Lightbulb, ArrowRight,
  TrendingDown, Shield, BarChart3,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">AgriFin Risk Monitor</span>
        </div>
        <Link href="/auth/login">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Sign In</Button>
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1">
        <section className="px-6 py-20 md:py-32 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6 border border-emerald-200">
            <Shield className="h-3.5 w-3.5" /> IFRS 9 · ECL · Two-Regime Markov-Switching Model
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">
            Physical Climate Risk <br />
            <span className="text-emerald-600">in Agricultural Credit</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            A microfinance credit risk platform for Zimbabwean MFIs. Satellite-derived drought signals
            drive a Two-Regime Markov-Switching model to compute IFRS 9–compliant Expected Credit Loss.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/login">
              <Button size="lg" className="h-14 px-8 text-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                Credit Officer Login <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg gap-2">
                Register as a Farmer <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <section className="bg-white py-20 px-6 border-y border-slate-200">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">
              How AgriFin Risk Monitor works
            </h2>
            <p className="text-center text-slate-500 mb-16 max-w-xl mx-auto">
              From satellite NDVI to IFRS 9 provisioning in one integrated workflow.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-slate-200">
                <CardHeader>
                  <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
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

              <Card className="border-slate-200">
                <CardHeader>
                  <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
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

              <Card className="border-slate-200">
                <CardHeader>
                  <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
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

        {/* Model parameters */}
        <section className="py-14 px-6 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-10">Model Parameters</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Sharpness κ",   value: "1.25",  sub: "Regime switching" },
              { label: "Threshold γ₀",  value: "−1.10", sub: "Drought threshold" },
              { label: "LGD",           value: "45%",   sub: "Loss given default" },
              { label: "Discount Rate", value: "5%",    sub: "Annual, quarterly DF" },
            ].map(({ label, value, sub }) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 text-center">
                <p className="text-2xl font-bold text-slate-900 font-mono">{value}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-slate-200 text-center text-slate-400 text-sm">
        <p className="font-semibold text-slate-600">AgriFin Risk Monitor</p>
        <p className="mt-1">IFRS 9 Physical Climate Risk Platform · Zimbabwe Microfinance Sector</p>
        <p className="mt-1">© {new Date().getFullYear()} AgriFin Risk Monitor. Research prototype.</p>
      </footer>
    </div>
  );
}
