import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMeetingRelatoDownloadUrl } from "@/lib/meeting-relato-upload";
import { toast } from "sonner";

export function MeetingRelatoDownload({ storagePath, label = "Baixar arquivo do relato" }: { storagePath: string; label?: string }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const url = await getMeetingRelatoDownloadUrl(storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error("Erro ao abrir arquivo", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
      <Download className="mr-2 h-3.5 w-3.5" />
      {loading ? "Abrindo…" : label}
    </Button>
  );
}
