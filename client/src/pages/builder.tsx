import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, ComponentBlock } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { nanoid } from "nanoid";
import { ComponentLibrary } from "@/components/builder/component-library";
import { CanvasBlock } from "@/components/builder/canvas-block";
import { PropertiesPanel } from "@/components/builder/properties-panel";
import { AiPanel } from "@/components/builder/ai-panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Layers,
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Send,
  Save,
  Settings,
  Sparkles,
  Loader2,
  Plus,
} from "lucide-react";

function CanvasDropZone({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onDeleteBlock,
  onAddBlock,
}: {
  blocks: ComponentBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onDeleteBlock: (id: string) => void;
  onAddBlock: (type: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop-zone" });

  return (
    <div
      ref={setNodeRef}
      className="flex-1 overflow-auto bg-muted/30"
      onClick={() => onSelectBlock(null)}
    >
      <div className="max-w-3xl mx-auto p-6 min-h-full">
        {blocks.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-md transition-colors ${
              isOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center mb-4">
              <Layers className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-1" data-testid="text-empty-canvas">
              {isOver ? "Drop here to add" : "Start building"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Drag components from the left panel or use AI to generate sections
            </p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Button variant="outline" size="sm" onClick={() => onAddBlock("hero")} data-testid="button-add-hero">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Hero
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAddBlock("heading")} data-testid="button-add-heading">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Heading
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAddBlock("text")} data-testid="button-add-text">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Text
              </Button>
            </div>
          </div>
        ) : (
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map((block) => (
                <CanvasBlock
                  key={block.id}
                  block={block}
                  isSelected={selectedBlockId === block.id}
                  onSelect={() => onSelectBlock(block.id)}
                  onDelete={() => onDeleteBlock(block.id)}
                />
              ))}
            </div>
            <div
              className={`mt-4 border-2 border-dashed rounded-md p-4 text-center transition-colors ${
                isOver ? "border-primary bg-primary/5" : "border-transparent hover:border-border"
              }`}
            >
              <p className="text-xs text-muted-foreground">
                {isOver ? "Drop here to add at bottom" : "Drag more components here"}
              </p>
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

function createDefaultBlock(type: string): ComponentBlock {
  const id = nanoid(8);
  const defaults: Record<string, any> = {
    hero: { title: "Welcome to Your Website", subtitle: "Build something amazing with our drag-and-drop builder", buttonText: "Get Started" },
    section: { title: "New Section" },
    heading: { text: "Heading", align: "left" },
    text: { text: "Add your content here. This is a paragraph block that you can customize.", align: "left" },
    button: { text: "Click Me", url: "#", align: "left" },
    image: { src: "", alt: "Image", height: "200px" },
    divider: {},
    spacer: { height: "40px" },
    features: {
      features: [
        { title: "Feature 1", desc: "Description of feature one" },
        { title: "Feature 2", desc: "Description of feature two" },
        { title: "Feature 3", desc: "Description of feature three" },
      ],
    },
  };
  return { id, type: type as ComponentBlock["type"], props: defaults[type] || {} };
}

export default function Builder() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { isPro } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [blocks, setBlocks] = useState<ComponentBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [history, setHistory] = useState<ComponentBlock[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitNotes, setSubmitNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<any>(null);
  const initialLoadRef = useRef(false);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  useEffect(() => {
    if (project && !initialLoadRef.current) {
      const schema = Array.isArray(project.schema) ? (project.schema as ComponentBlock[]) : [];
      setBlocks(schema);
      setHistory([schema]);
      setHistoryIndex(0);
      initialLoadRef.current = true;
    }
  }, [project]);

  const pushHistory = useCallback((newBlocks: ComponentBlock[]) => {
    setHistory((prev) => {
      const trimmed = prev.slice(0, historyIndex + 1);
      return [...trimmed, newBlocks];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const updateBlocks = useCallback((newBlocks: ComponentBlock[]) => {
    setBlocks(newBlocks);
    pushHistory(newBlocks);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await apiRequest("PATCH", `/api/projects/${projectId}`, { schema: newBlocks });
      } catch {}
      setIsSaving(false);
    }, 1000);
  }, [projectId, pushHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setBlocks(history[newIndex]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setBlocks(history[newIndex]);
    }
  }, [history, historyIndex]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;

    if (activeData?.fromLibrary) {
      const newBlock = createDefaultBlock(activeData.type);
      const newBlocks = [...blocks];
      if (over.id === "canvas-drop-zone") {
        newBlocks.push(newBlock);
      } else {
        const overIndex = blocks.findIndex((b) => b.id === over.id);
        if (overIndex >= 0) {
          newBlocks.splice(overIndex + 1, 0, newBlock);
        } else {
          newBlocks.push(newBlock);
        }
      }
      updateBlocks(newBlocks);
      setSelectedBlockId(newBlock.id);
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        updateBlocks(arrayMove(blocks, oldIndex, newIndex));
      }
    }
  };

  const handleBlockUpdate = (updated: ComponentBlock) => {
    const newBlocks = blocks.map((b) => (b.id === updated.id ? updated : b));
    updateBlocks(newBlocks);
  };

  const handleDeleteBlock = (id: string) => {
    const newBlocks = blocks.filter((b) => b.id !== id);
    if (selectedBlockId === id) setSelectedBlockId(null);
    updateBlocks(newBlocks);
  };

  const handleApplyAiBlocks = (newBlocks: ComponentBlock[]) => {
    const withIds = newBlocks.map((b) => ({ ...b, id: b.id || nanoid(8) }));
    updateBlocks([...blocks, ...withIds]);
    toast({ title: "Blocks applied", description: `${withIds.length} block(s) added to canvas` });
  };

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/export/${projectId}`, { credentials: "include" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project?.name || "website"}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err: any) => {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (notes: string) => {
      await apiRequest("POST", "/api/submissions", { projectId, notes });
    },
    onSuccess: () => {
      setShowSubmitDialog(false);
      setSubmitNotes("");
      toast({ title: "Submitted!", description: "Your project has been submitted for review" });
    },
    onError: (err: any) => {
      toast({ title: "Submit failed", description: err.message, variant: "destructive" });
    },
  });

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col bg-background">
        <header className="border-b bg-card flex items-center justify-between gap-2 px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary shrink-0">
              <Layers className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-medium text-sm truncate" data-testid="text-project-name">{project?.name || "Project"}</span>
            {isSaving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Saving</span>}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0} data-testid="button-undo">
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1} data-testid="button-redo">
              <Redo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || !isPro}
              data-testid="button-export"
            >
              <Download className="w-4 h-4 mr-1" />
              {!isPro ? "Pro only" : exportMutation.isPending ? "Exporting..." : "Export"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowSubmitDialog(true)} data-testid="button-submit">
              <Send className="w-4 h-4 mr-1" />
              Submit
            </Button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          <div className="w-64 border-r bg-card shrink-0 overflow-hidden">
            <ComponentLibrary />
          </div>

          <CanvasDropZone
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onDeleteBlock={handleDeleteBlock}
            onAddBlock={(type: string) => {
              const newBlock = createDefaultBlock(type);
              updateBlocks([...blocks, newBlock]);
              setSelectedBlockId(newBlock.id);
            }}
          />

          <div className="w-80 border-l bg-card shrink-0 overflow-hidden">
            <Tabs defaultValue="properties" className="h-full flex flex-col">
              <TabsList className="mx-3 mt-2 shrink-0">
                <TabsTrigger value="properties" className="flex-1 gap-1" data-testid="tab-properties">
                  <Settings className="w-3.5 h-3.5" />
                  Properties
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex-1 gap-1" data-testid="tab-ai">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI
                </TabsTrigger>
              </TabsList>
              <TabsContent value="properties" className="flex-1 mt-0 overflow-hidden">
                <PropertiesPanel block={selectedBlock} onChange={handleBlockUpdate} />
              </TabsContent>
              <TabsContent value="ai" className="flex-1 mt-0 overflow-hidden">
                <AiPanel onApplyBlocks={handleApplyAiBlocks} projectId={projectId} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit to Team</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitMutation.mutate(submitNotes);
            }}
          >
            <Textarea
              placeholder="Add any notes for the review team..."
              value={submitNotes}
              onChange={(e) => setSubmitNotes(e.target.value)}
              className="resize-none min-h-[80px]"
              data-testid="input-submit-notes"
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={submitMutation.isPending} data-testid="button-confirm-submit">
                {submitMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
