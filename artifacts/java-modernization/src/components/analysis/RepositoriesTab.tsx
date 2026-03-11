import { useState } from "react";
import { useRepositories, useCreateRepository, useDeleteRepository } from "@/hooks/use-repositories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { FileCode, Trash2, Plus, Code } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const schema = z.object({
  name: z.string().min(1, "Repository name is required"),
  javaCode: z.string().min(10, "Source code is required to analyze"),
  packageStructure: z.string().optional(),
});

export function RepositoriesTab({ analysisId }: { analysisId: number }) {
  const { data: repos, isLoading } = useRepositories(analysisId);
  const createMutation = useCreateRepository(analysisId);
  const deleteMutation = useDeleteRepository(analysisId);
  const [isAdding, setIsAdding] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", javaCode: "", packageStructure: "" },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        form.reset();
        setIsAdding(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Source Repositories</h3>
          <p className="text-sm text-muted-foreground mt-1">Add raw Java code or zip archives for the AI to analyze.</p>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} className="gap-2 glow-primary">
            <Plus className="w-4 h-4" /> Add Repository
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="glass-panel p-6 border-primary/30">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repository Name / Module</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. core-services" className="bg-black/30 border-white/10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="javaCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Raw Java Code (Paste classes here)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="public class OrderService { ... }" 
                            className="h-64 font-mono text-xs bg-black/50 border-white/10 resize-y" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="packageStructure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Package Structure (Optional, helps context)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="com.company.order&#10;├── service&#10;├── model&#10;└── config" 
                            className="h-32 font-mono text-xs bg-black/50 border-white/10" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      {createMutation.isPending ? "Adding..." : "Save Repository"}
                    </Button>
                  </div>
                </form>
              </Form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {repos?.map((repo) => (
          <Card key={repo.id} className="p-5 bg-black/20 border-white/5 hover:border-white/10 transition-colors flex flex-col group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <FolderGit2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">{repo.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">Added {new Date(repo.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/20 hover:text-destructive transition-all"
                onClick={() => {
                  if(confirm("Remove this repository?")) deleteMutation.mutate(repo.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 bg-black/40 rounded-lg p-3 border border-white/5 overflow-hidden">
              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                <Code className="w-3.5 h-3.5" /> Code Preview
              </div>
              <pre className="text-[10px] text-white/70 font-mono overflow-hidden h-20 mask-image-b">
                {repo.javaCode.slice(0, 500)}...
              </pre>
            </div>
          </Card>
        ))}

        {!isLoading && repos?.length === 0 && !isAdding && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-white/10 rounded-xl">
            <FileCode className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-1">No repositories added</h3>
            <p className="text-muted-foreground">Add your Java source code to begin the analysis.</p>
            <Button onClick={() => setIsAdding(true)} variant="outline" className="mt-6 border-white/10">
              Add First Repository
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
