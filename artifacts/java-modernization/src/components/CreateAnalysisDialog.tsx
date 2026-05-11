import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useCreateAnalysis } from "@/hooks/use-analyses";
import { useLocation } from "wouter";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateAnalysisDialog({ open, onOpenChange }: Props) {
  const [_, setLocation] = useLocation();
  const createMutation = useCreateAnalysis();
  
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    createMutation.mutate(data, {
      onSuccess: (res) => {
        form.reset();
        onOpenChange(false);
        setLocation(`/analysis/${res.id}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Analysis Session</DialogTitle>
          <DialogDescription>
            Start a new codebase analysis. Import repositories from GitHub or paste code in the next step.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Payment Service Analysis" className="bg-black/20" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Context about this codebase (optional)..." className="resize-none bg-black/20" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {createMutation.isPending ? "Creating..." : "Create Session"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
