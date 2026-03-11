import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Leaf className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900 tracking-tight">TobaccoGuard</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login">
            <Button variant="ghost" className="text-slate-600 hover:text-slate-900">Login</Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Sign Up</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="px-6 py-20 md:py-32 max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
            Monitor your tobacco field <br />
            <span className="text-emerald-600">using satellite data</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Get actionable insights into your crop's health, detect stress early, and receive smart recommendations to maximize your yield.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg" className="h-14 px-8 text-lg bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                Get Started Now <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-slate-200 text-slate-600 hover:bg-slate-50">
                View Demo
              </Button>
            </Link>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="bg-white py-20 px-6 border-y border-slate-200">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-slate-900 mb-16">Why use TobaccoGuard?</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="border-none shadow-none bg-slate-50/50">
                <CardHeader>
                  <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                    <Leaf className="h-6 w-6 text-emerald-600" />
                  </div>
                  <CardTitle className="text-xl font-bold">Crop health monitoring</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Track the vegetation index (NDVI) of your field in real-time using high-resolution satellite imagery.</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-none bg-slate-50/50">
                <CardHeader>
                  <div className="bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                  </div>
                  <CardTitle className="text-xl font-bold">Early stress detection</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Identify water stress or potential disease outbreaks before they become visible to the naked eye.</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-none bg-slate-50/50">
                <CardHeader>
                  <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                    <Lightbulb className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-xl font-bold">Smart recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600">Receive precise advice on irrigation and field management based on weather and satellite data.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-slate-200 text-center text-slate-500 text-sm">
        <p>© 2026 TobaccoGuard. All rights reserved.</p>
      </footer>
    </div>
  );
}
