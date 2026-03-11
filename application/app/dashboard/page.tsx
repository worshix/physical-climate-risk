import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, Plus, Activity, Calendar, MapPin } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    redirect("/auth/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      fields: {
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!user) {
    redirect("/auth/login");
  }

  const userFields = user.fields.map((f: any) => {
    const lastAnalysis = f.analyses[0];
    return {
      id: f.id,
      name: f.name,
      location: f.location || "Unknown Location",
      lastAnalysis: lastAnalysis ? new Date(lastAnalysis.createdAt).toLocaleDateString() : "No analysis yet",
      status: lastAnalysis?.healthStatus || "UNKNOWN",
    };
  });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Sidebar/Top Nav */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">AgriFin Risk Monitor</span>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full">
            <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
              {user.name.charAt(0)}
            </div>
            <span className="text-xs font-medium text-slate-700">{user.name}</span>
          </div>
          <LogoutButton />
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome, {user.name.split(" ")[0]}</h1>
            <p className="text-slate-500">Monitor your farm health and credit risk in real-time.</p>
          </div>
          <Link href="/field/create">
            <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2 h-11 px-6 shadow-sm">
              <Plus className="h-4 w-4" /> Create New Field
            </Button>
          </Link>
        </div>

        {userFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200 text-center shadow-sm">
            <div className="bg-emerald-50 p-6 rounded-full mb-6">
              <MapPin className="h-12 w-12 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">No fields detected</h2>
            <p className="text-slate-500 mb-8 max-w-sm">You haven&apos;t added any fields yet. Start by drawing your field boundary on the satellite map.</p>
            <Link href="/field/create">
              <Button className="bg-emerald-600 hover:bg-emerald-700 h-12 px-8 text-lg font-semibold rounded-xl">
                Get Started
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" /> Your Active Fields
              </h2>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-none">
                {userFields.length} {userFields.length === 1 ? 'Field' : 'Fields'}
              </Badge>
            </div>
            
            <div className="grid gap-4">
              {userFields.map((field: any) => (
                <Card key={field.id} className="hover:shadow-md transition-all duration-200 border-slate-200 overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">{field.name}</h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                            <MapPin className="h-3 w-3" /> {field.location}
                          </div>
                        </div>
                        {field.status === "HEALTHY" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none hover:bg-emerald-100 px-3 py-1">
                            Healthy 🟢
                          </Badge>
                        ) : field.status === "MODERATE_STRESS" ? (
                          <Badge className="bg-amber-100 text-amber-700 border-none hover:bg-amber-100 px-3 py-1">
                            Moderate 🟡
                          </Badge>
                        ) : field.status === "HIGH_STRESS" ? (
                          <Badge className="bg-red-100 text-red-700 border-none hover:bg-red-100 px-3 py-1">
                            Stressed 🔴
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-200">
                            No Data
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          Last sync: {field.lastAnalysis}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 px-6 py-4 flex md:flex-col justify-end gap-2 border-t md:border-t-0 md:border-l border-slate-100">
                      <Link href={`/field/${field.id}`} className="flex-1 md:flex-none">
                        <Button variant="outline" size="sm" className="w-full bg-white text-slate-600 border-slate-200">
                          Details
                        </Button>
                      </Link>
                      <Link href={`/field/${field.id}/analyse`} className="flex-1 md:flex-none">
                        <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold">
                          Analyse
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
