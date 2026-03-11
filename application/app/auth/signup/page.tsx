import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Leaf, UserPlus } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <Card className="w-full max-w-md border-slate-200">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-emerald-600 p-2 rounded-xl">
              <Leaf className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Account Registration
          </CardTitle>
          <CardDescription className="text-slate-500">
            AgriFin Risk Monitor
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4 py-6">
          <div className="flex justify-center">
            <div className="bg-slate-100 p-4 rounded-full">
              <UserPlus className="h-10 w-10 text-slate-500" />
            </div>
          </div>
          <p className="text-slate-700 font-medium">
            Accounts are created by your MFI credit officer.
          </p>
          <p className="text-sm text-slate-500">
            If you are a borrower, please contact your branch credit officer
            to have your account registered in the system.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 border-t border-slate-100 pt-6">
          <div className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-emerald-600 font-semibold hover:underline">
              Log in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
