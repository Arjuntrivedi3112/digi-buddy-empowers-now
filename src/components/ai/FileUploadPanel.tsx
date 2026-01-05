import React, { useState, useCallback, useRef } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, Loader2, CheckCircle, AlertCircle, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ROLES = [
  { value: "general", label: "General", icon: "🎯", description: "Comprehensive overview" },
  { value: "qa", label: "QA Engineer", icon: "🧪", description: "Testing & quality focus" },
  { value: "backend", label: "Backend Dev", icon: "⚙️", description: "APIs & architecture" },
  { value: "frontend", label: "Frontend Dev", icon: "🎨", description: "UI/UX implementation" },
  { value: "security", label: "Security", icon: "🔒", description: "Privacy & compliance" },
  { value: "product", label: "Product Manager", icon: "📊", description: "Business & strategy" },
  { value: "adops", label: "Ad Ops", icon: "📢", description: "Campaign & optimization" },
];

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  status: "uploading" | "processing" | "done" | "error";
  summaryByRole: Record<string, string>;
  error?: string;
  rawFile?: File;
};

export function FileUploadPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedRole, setSelectedRole] = useState("general");
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  const getSummaryForRole = async (file: File, role: string): Promise<string> => {
    const fileContent = await readFileContent(file);
    const { data, error } = await supabase.functions.invoke("summarize-doc", {
      body: { fileName: file.name, fileContent, role },
    });
    if (error) throw new Error(error.message || "Failed to summarize document");
    if (data.error) throw new Error(data.error);
    return data.summary;
  };

  const processFiles = async (fileList: File[]) => {
    for (const file of fileList) {
      const fileId = Date.now().toString() + "-" + file.name;
      setFiles((prev) => [
        ...prev,
        {
          id: fileId,
          name: file.name,
          size: file.size,
          status: "uploading",
          summaryByRole: {},
          rawFile: file,
        },
      ]);

      // Auto-expand the first file
      setExpandedFile((prev) => prev || fileId);

      try {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: "processing" } : f))
        );

        const summary = await getSummaryForRole(file, selectedRole);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status: "done",
                  summaryByRole: { ...f.summaryByRole, [selectedRole]: summary },
                }
              : f
          )
        );

        toast.success(`Analysis complete for ${file.name}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to process file";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, status: "error", error: errorMessage } : f
          )
        );
        toast.error(errorMessage);
      }
    }
  };

  const regenerateSummaryForRole = async (file: UploadedFile, role: string) => {
    if (!file.rawFile) {
      toast.error("Original file not available. Please re-upload.");
      return;
    }

    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, status: "processing" } : f))
    );

    try {
      const summary = await getSummaryForRole(file.rawFile, role);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id
            ? {
                ...f,
                status: "done",
                summaryByRole: { ...f.summaryByRole, [role]: summary },
              }
            : f
        )
      );
      toast.success(`Updated analysis for ${role} perspective`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to regenerate";
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: "error", error: errorMessage } : f
        )
      );
      toast.error(errorMessage);
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    if (expandedFile === fileId) {
      setExpandedFile(null);
    }
  };

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (fileList) {
        processFiles(Array.from(fileList));
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [selectedRole]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const fileList = e.dataTransfer.files;
      if (fileList) {
        processFiles(Array.from(fileList));
      }
    },
    [selectedRole]
  );

  const handleRoleChange = async (role: string) => {
    setSelectedRole(role);
    // Regenerate for files that don't have this role's summary
    for (const file of files) {
      if (file.status === "done" && !file.summaryByRole[role] && file.rawFile) {
        await regenerateSummaryForRole(file, role);
      }
    }
  };

  const selectedRoleInfo = ROLES.find((r) => r.value === selectedRole);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99] bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[100] md:w-full md:max-w-3xl md:max-h-[85vh] overflow-hidden"
      >
        <div className="h-full flex flex-col rounded-2xl border border-border/50 bg-card text-card-foreground shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Document Analyzer</h2>
                <p className="text-xs text-muted-foreground">
                  AI-powered analysis tailored to your role
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Selection */}
          <div className="p-5 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-medium">Analyze as:</span>
              <Select value={selectedRole} onValueChange={handleRoleChange}>
                <SelectTrigger className="w-[200px] bg-background">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span>{selectedRoleInfo?.icon}</span>
                      <span>{selectedRoleInfo?.label}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <span>{role.icon}</span>
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {role.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Each role provides step-by-step action plans specific to that perspective
            </p>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Upload Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt,.md,.json,.csv"
                multiple
                className="hidden"
              />
              <Upload
                className={cn(
                  "w-12 h-12 mx-auto mb-4 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground"
                )}
              />
              <p className="font-medium text-foreground mb-1">
                Drop files here or click to upload
              </p>
              <p className="text-sm text-muted-foreground">
                Supports PDF, DOC, DOCX, TXT, MD, JSON, CSV
              </p>
            </div>

            {/* Uploaded Files */}
            <AnimatePresence>
              {files.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">
                      Analyzed Documents ({files.length})
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiles([])}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear all
                    </Button>
                  </div>

                  {files.map((file) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-muted/50 rounded-xl overflow-hidden border border-border/50"
                    >
                      {/* File Header */}
                      <div
                        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/70 transition-colors"
                        onClick={() =>
                          setExpandedFile(expandedFile === file.id ? null : file.id)
                        }
                      >
                        <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center shrink-0 border border-border/50">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                            {file.status === "done" && (
                              <span className="ml-2 text-green-500">• Analysis ready</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {file.status === "processing" && (
                            <div className="flex items-center gap-2 text-primary">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-xs">Analyzing...</span>
                            </div>
                          )}
                          {file.status === "done" && (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )}
                          {file.status === "error" && (
                            <AlertCircle className="w-5 h-5 text-destructive" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFile(file.id);
                            }}
                            className="p-1.5 rounded-full hover:bg-muted transition-colors"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Summary */}
                      <AnimatePresence>
                        {expandedFile === file.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 pt-0 border-t border-border/50">
                              {file.error && (
                                <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm mb-3">
                                  <AlertCircle className="w-4 h-4 shrink-0" />
                                  <span>{file.error}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      file.rawFile &&
                                      regenerateSummaryForRole(file, selectedRole)
                                    }
                                    className="ml-auto"
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Retry
                                  </Button>
                                </div>
                              )}

                              {file.summaryByRole[selectedRole] && (
                                <div className="mt-3">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>{selectedRoleInfo?.icon}</span>
                                      <span>{selectedRoleInfo?.label} Perspective</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        file.rawFile &&
                                        regenerateSummaryForRole(file, selectedRole)
                                      }
                                      className="text-xs"
                                    >
                                      <RefreshCw className="w-3 h-3 mr-1" />
                                      Regenerate
                                    </Button>
                                  </div>
                                  <div className="prose prose-sm prose-invert max-w-none bg-background/50 rounded-lg p-4 border border-border/30 max-h-[400px] overflow-y-auto">
                                    <div
                                      className="text-sm leading-relaxed"
                                      dangerouslySetInnerHTML={{
                                        __html: formatMarkdown(file.summaryByRole[selectedRole]),
                                      }}
                                    />
                                  </div>
                                </div>
                              )}

                              {file.status === "processing" && (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                                  <p className="text-sm text-muted-foreground">
                                    Analyzing document as {selectedRoleInfo?.label}...
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    This may take a moment
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border/50 bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Powered by Google Gemini 2.5 Flash via Lovable AI</span>
              <span>Switch roles to see different perspectives</span>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// Simple markdown to HTML converter for the summary
function formatMarkdown(text: string): string {
  return text
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold mt-4 mb-2 text-foreground">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-semibold mt-5 mb-3 text-foreground border-b border-border/30 pb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold mt-6 mb-3 text-foreground">$1</h2>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1 text-muted-foreground">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul class="list-disc mb-3">$&</ul>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-4 border-border/50" />')
    // Paragraphs (simple approach)
    .replace(/\n\n/g, '</p><p class="mb-3 text-muted-foreground">')
    // Wrap in paragraph tags
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p class="mb-2 text-muted-foreground">${match}</p>`;
    });
}
