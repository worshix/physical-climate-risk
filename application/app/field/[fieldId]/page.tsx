import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf, ArrowLeft, Info, Play } from "lucide-react";
import FieldMap from "@/components/Map/FieldMap";
import { DeleteFieldButton } from "@/components/DeleteFieldButton";

export default async function FieldOverviewPage({ params }: { params: { fieldId: string } }) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;

  if (!userId) {
    redirect("/auth/login");
  }

  const { fieldId } = await params;

  const field = await prisma.field.findUnique({
    where: { 
      id: fieldId,
      userId: userId // Only allow access to owner
    },
  });

  if (!field) {
    notFound();
  }

  // Parse polygon if it's stored as a string
  let polygon = null;
  try {
    polygon = typeof field.polygon === 'string' ? JSON.parse(field.polygon) : field.polygon;
  } catch (e) {
    console.error("Failed to parse polygon", e);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="text-slate-500">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Leaf className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">{field.name}</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <Card className="overflow-hidden border-slate-200">
              <div className="aspect-video relative bg-slate-100">
                {polygon ? (
                  <FieldMap 
                    initialViewState={{ 
                      longitude: (polygon.geometry.coordinates[0][0][0] + polygon.geometry.coordinates[0][2][0]) / 2, 
                      latitude: (polygon.geometry.coordinates[0][0][1] + polygon.geometry.coordinates[0][2][1]) / 2, 
                      zoom: 15 
                    }} 
                    polygon={polygon}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    No map data available
                  </div>
                )}
              </div>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{field.name}</h2>
                    <p className="text-slate-500 flex items-center gap-1">
                      <Info className="h-4 w-4" /> This is your tobacco cultivation plot in {field.location || "Zimbabwe"}.
                    </p>
                  </div>
                  <Link href={`/field/${field.id}/analyse`}>
                    <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 gap-2 font-bold px-8 shadow-lg shadow-emerald-200 transition-all hover:-translate-y-1">
                      <Play className="h-4 w-4 fill-white" /> Run Analysis
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
               <Card className="bg-white border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Calculated Area</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-slate-900">{field.area || "4.2"} Hectares</p>
                  </CardContent>
               </Card>
               <Card className="bg-white border-slate-200 shadow-sm transition-transform hover:scale-[1.02]">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-widest">Crop Species</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-emerald-700">{field.cropType || "Tobacco"}</p>
                  </CardContent>
               </Card>
            </div>
          </div>

          {/* Details Sidebar */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Field Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">LOCATION</p>
                  <p className="text-sm text-slate-700 font-medium">{field.location || "Mashonaland West"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">CREATED</p>
                  <p className="text-sm text-slate-700 font-medium">{new Date(field.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="pt-4 mt-4 border-t border-slate-100">
                   <DeleteFieldButton fieldId={field.id} fieldName={field.name} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
