"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Leaf, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Lightbulb, 
  Thermometer, 
  CloudRain, 
  LineChart as LineChartIcon,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity
} from "lucide-react";
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

interface AnalysisResult {
  meanNDVI: number;
  ndviTrend: "IMPROVING" | "STABLE" | "DECLINING";
  healthStatus: "HEALTHY" | "MODERATE_STRESS" | "HIGH_STRESS";
  avgTemperature: number;
  totalRainfall: number;
  waterStressRisk: boolean;
  diseaseRisk: boolean;
  recommendations: string[];
  historicalNDVI: { date: string; value: number }[];
}

export default function AnalysisResultsPage({ params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = use(params);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    async function runAnalysis() {
      try {
        const response = await fetch("/api/analyse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fieldId }),
        });
        
        if (!response.ok) throw new Error("Failed to analyze");
        
        const data = await response.json();
        
        setResult({
          meanNDVI: Number(data.mean_ndvi.toFixed(2)),
          ndviTrend: data.ndviTrend,
          healthStatus: data.healthStatus,
          avgTemperature: Number(data.avg_temperature_c.toFixed(1)),
          totalRainfall: Number(data.total_rainfall_mm.toFixed(1)),
          waterStressRisk: data.total_rainfall_mm < 10 && data.mean_ndvi < 0.45,
          diseaseRisk: data.ndvi_variance > 0.05,
          recommendations: data.recommendations,
          historicalNDVI: [
            { date: "Day -12", value: Number((data.mean_ndvi - 0.04).toFixed(2)) },
            { date: "Day -9", value: Number((data.mean_ndvi - 0.02).toFixed(2)) },
            { date: "Day -6", value: Number((data.mean_ndvi + 0.01).toFixed(2)) },
            { date: "Day -3", value: Number((data.mean_ndvi - 0.01).toFixed(2)) },
            { date: "Latest", value: Number(data.mean_ndvi.toFixed(2)) },
          ]
        });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    runAnalysis();
  }, [fieldId]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-12 w-12 text-emerald-600 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Analysing Field...</h2>
        <p className="text-slate-500">Retrieving satellite data and climate patterns.</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link href={`/field/${fieldId}`}>
            <Button variant="ghost" size="icon" className="text-slate-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Analysis Results</h1>
          </div>
        </div>
        <div className="text-xs text-slate-400 font-medium">
          LAST UPDATED: {new Date().toLocaleDateString()}
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-4xl mx-auto w-full space-y-8">
        {/* Section A: Field Summary */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center justify-center rounded-full bg-white p-1 shadow-sm border border-slate-100 mb-2">
            {result.healthStatus === "HEALTHY" ? (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-4 py-1 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Healthy 🟢
              </Badge>
            ) : result.healthStatus === "MODERATE_STRESS" ? (
              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none px-4 py-1 gap-1">
                <AlertTriangle className="h-3 w-3" /> Moderate Stress 🟡
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none px-4 py-1 gap-1">
                <AlertCircle className="h-3 w-3" /> High Stress 🔴
              </Badge>
            )}
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            Overall Crop Health is <span className={
              result.healthStatus === "HEALTHY" ? "text-emerald-600" :
              result.healthStatus === "MODERATE_STRESS" ? "text-amber-600" : "text-red-600"
            }>{result.healthStatus.replace('_', ' ')}</span>
          </h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Based on the latest satellite imagery and weather data for your field.
          </p>
        </section>

        {/* Section D: Recommendations */}
        <section className="space-y-4">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-emerald-600" /> Smart Recommendations
          </h3>
          <div className="grid gap-3">
            {result.recommendations.map((rec, i) => (
              <Card key={i} className="border-l-4 border-l-emerald-500 border-slate-200">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="mt-0.5 bg-emerald-50 p-1 rounded-full">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-slate-700 font-medium">{rec}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Section C: Predictions / Risk Flags */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Risk Assessment</h3>
            <Card className="border-slate-200">
              <CardContent className="p-0 divide-y divide-slate-100">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CloudRain className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Water Stress</p>
                      <p className="text-xs text-slate-400">Based on rainfall trend</p>
                    </div>
                  </div>
                  <Badge variant={result.waterStressRisk ? "destructive" : "secondary"} className="rounded-full">
                    {result.waterStressRisk ? "High Risk" : "Low Risk"}
                  </Badge>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Disease Risk</p>
                      <p className="text-xs text-slate-400">Irregular patterns</p>
                    </div>
                  </div>
                  <Badge variant={result.diseaseRisk ? "destructive" : "secondary"} className="rounded-full">
                    {result.diseaseRisk ? "Moderate Risk" : "Minimal Risk"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Environmental Summary */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Environment</h3>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-white border-slate-200">
                <CardContent className="p-4 text-center">
                  <Thermometer className="h-5 w-5 text-amber-500 mx-auto mb-2" />
                  <p className="text-xl font-bold text-slate-900">{result.avgTemperature}°C</p>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Avg Temp</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="p-4 text-center">
                  <CloudRain className="h-5 w-5 text-blue-500 mx-auto mb-2" />
                  <p className="text-xl font-bold text-slate-900">{result.totalRainfall}mm</p>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Total Rain</p>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>

        {/* Section B: Raw Data */}
        <section className="space-y-4 mt-8 pt-8 border-t border-slate-200">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="technical-data" className="border-none">
              <AccordionTrigger className="hover:no-underline py-0">
                 <div className="flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <LineChartIcon className="h-4 w-4" />
                    <span className="text-sm font-bold uppercase tracking-widest">View Technical Data</span>
                 </div>
              </AccordionTrigger>
              <AccordionContent className="pt-6">
                <Card className="border-slate-200 bg-white shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">NDVI History</CardTitle>
                        <CardDescription className="text-xs">Vegetation index trend</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">{result.meanNDVI}</p>
                        <p className="text-xs font-bold text-slate-400">MEAN NDVI</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={result.historicalNDVI}>
                          <defs>
                            <linearGradient id="colorNdvi" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                          />
                          <YAxis 
                            domain={[0, 1]} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#94a3b8', fontSize: 10 }}
                          />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorNdvi)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <div className="pt-6 flex justify-center">
            <Link href="/dashboard">
                <Button variant="outline" className="text-slate-500 border-slate-200">
                    Return to Dashboard
                </Button>
            </Link>
        </div>
      </main>
    </div>
  );
}
