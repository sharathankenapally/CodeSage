import { AppLayout } from "@/components/layout/AppLayout";
import { Code2, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <AppLayout>
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center mx-auto mb-8 shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 opacity-50"></div>
             <Code2 className="w-10 h-10 text-white relative z-10" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Legacy Java Modernization</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Select an analysis session from the sidebar or create a new one to begin migrating your monolithic Java 8 codebases to microservices.
          </p>
          <div className="pt-4 flex items-center justify-center text-sm font-medium text-primary gap-2">
            <ArrowRight className="w-4 h-4 animate-pulse" />
            Click 'New Analysis' in the sidebar to start
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
