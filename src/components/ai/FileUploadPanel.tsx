import React, { useState, useCallback, useRef } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, FileText, Loader2, CheckCircle, AlertCircle, RefreshCw, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
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

      setExpandedFile(fileId);

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
    for (const file of files) {
      if (file.status === "done" && !file.summaryByRole[role] && file.rawFile) {
        await regenerateSummaryForRole(file, role);
      }
    }
  };

  const selectedRoleInfo = ROLES.find((r) => r.value === selectedRole);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      {/* Solid backdrop - no blur */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal Panel - solid background, no transparency */}
      <div className="relative z-[151] w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col rounded-2xl border-2 border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Document Analyzer</h2>
              <p className="text-xs text-muted-foreground">
                AI-powered analysis tailored to your role
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Role Selection - solid background */}
        <div className="p-5 border-b border-border bg-muted">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="text-sm font-medium text-foreground">Analyze as:</span>
            <Select value={selectedRole} onValueChange={handleRoleChange}>
              <SelectTrigger className="w-[220px] bg-card border-border">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    <span>{selectedRoleInfo?.icon}</span>
                    <span className="text-foreground">{selectedRoleInfo?.label}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value} className="py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{role.icon}</span>
                      <div>
                        <div className="font-medium text-foreground">{role.label}</div>
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

        {/* Content Area - scrollable */}
        <div className="flex-1 overflow-y-auto p-5 bg-card">
          {/* Upload Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer bg-muted/50",
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 hover:bg-muted"
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
          {files.length > 0 && (
            <div className="mt-6 space-y-4">
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
                <div
                  key={file.id}
                  className="bg-muted rounded-xl overflow-hidden border border-border"
                >
                  {/* File Header */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
                    onClick={() =>
                      setExpandedFile(expandedFile === file.id ? null : file.id)
                    }
                  >
                    <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center shrink-0 border border-border">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                        {file.status === "done" && (
                          <span className="ml-2 text-green-400">• Analysis ready</span>
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
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      )}
                      {file.status === "error" && (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      )}
                      {expandedFile === file.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        className="p-1.5 rounded-full hover:bg-card transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Summary */}
                  {expandedFile === file.id && (
                    <div className="border-t border-border bg-card">
                      <div className="p-4">
                        {file.error && (
                          <div className="flex items-center gap-2 p-3 bg-destructive/20 rounded-lg text-destructive text-sm mb-3 border border-destructive/30">
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
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                                <span>{selectedRoleInfo?.icon}</span>
                                <span>{selectedRoleInfo?.label} Perspective</span>
                              </div>
                              <Button
                                variant="outline"
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
                            <div className="bg-background rounded-lg p-5 border border-border max-h-[400px] overflow-y-auto">
                              <SummaryContent content={file.summaryByRole[selectedRole]} />
                            </div>
                          </div>
                        )}

                        {file.status === "processing" && (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                            <p className="text-sm text-foreground font-medium">
                              Analyzing document as {selectedRoleInfo?.label}...
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              This may take a moment
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - solid background */}
        <div className="p-4 border-t border-border bg-muted">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Powered by Google Gemini 2.5 Flash</span>
            <span>Switch roles to see different perspectives</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Component to render formatted summary content
function SummaryContent({ content }: { content: string }) {
  const lines = content.split('\n');
  
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();
        
        if (!trimmedLine) return <div key={index} className="h-2" />;
        
        // H2 headers
        if (trimmedLine.startsWith('## ')) {
          return (
            <h3 key={index} className="text-base font-semibold text-foreground mt-5 mb-2 pb-2 border-b border-border/50">
              {trimmedLine.replace('## ', '')}
            </h3>
          );
        }
        
        // H3 headers
        if (trimmedLine.startsWith('### ')) {
          return (
            <h4 key={index} className="text-sm font-semibold text-foreground mt-4 mb-2">
              {trimmedLine.replace('### ', '')}
            </h4>
          );
        }
        
        // Bold text with colons (like "What to do:", "Why it matters:")
        if (trimmedLine.startsWith('**') && trimmedLine.includes(':**')) {
          const match = trimmedLine.match(/^\*\*(.+?):\*\*\s*(.*)$/);
          if (match) {
            return (
              <p key={index} className="text-muted-foreground">
                <strong className="text-foreground font-medium">{match[1]}:</strong> {match[2]}
              </p>
            );
          }
        }
        
        // List items
        if (trimmedLine.startsWith('- ')) {
          const itemContent = trimmedLine.slice(2);
          // Check for bold content in list item
          const boldMatch = itemContent.match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
          if (boldMatch) {
            return (
              <div key={index} className="flex gap-2 text-muted-foreground ml-4">
                <span className="text-primary">•</span>
                <span>
                  <strong className="text-foreground font-medium">{boldMatch[1]}</strong>
                  {boldMatch[2] && `: ${boldMatch[2]}`}
                </span>
              </div>
            );
          }
          return (
            <div key={index} className="flex gap-2 text-muted-foreground ml-4">
              <span className="text-primary">•</span>
              <span>{itemContent}</span>
            </div>
          );
        }
        
        // Horizontal rule
        if (trimmedLine === '---') {
          return <hr key={index} className="my-4 border-border/50" />;
        }
        
        // Italic text (usually tips or notes)
        if (trimmedLine.startsWith('*') && trimmedLine.endsWith('*') && !trimmedLine.startsWith('**')) {
          return (
            <p key={index} className="text-muted-foreground italic text-xs">
              {trimmedLine.slice(1, -1)}
            </p>
          );
        }
        
        // Regular paragraph - handle inline bold
        const formattedLine = trimmedLine.replace(
          /\*\*(.+?)\*\*/g, 
          '<strong class="text-foreground font-medium">$1</strong>'
        );
        
        return (
          <p 
            key={index} 
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: formattedLine }}
          />
        );
      })}
    </div>
  );
}
