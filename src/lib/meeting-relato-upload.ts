import { supabase } from "@/integrations/supabase/client";

export const MEETING_RELATO_BUCKET = "acolhimento-anexos";
export const MEETING_RELATO_ACCEPT = ".pdf,.jpg,.jpeg,.png,.docx";
export const MEETING_RELATO_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export function validateMeetingRelatoFile(file: File): string | null {
  if (file.size > MEETING_RELATO_MAX_BYTES) {
    return "O arquivo deve ter no máximo 10 MB.";
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Formato não permitido. Use PDF, JPG, PNG ou DOCX.";
  }
  return null;
}

export async function uploadMeetingRelato(params: {
  file: File;
  requestId: string;
  meetingId: string;
  userId: string;
}): Promise<string> {
  const validationError = validateMeetingRelatoFile(params.file);
  if (validationError) throw new Error(validationError);

  const ext = params.file.name.includes(".")
    ? params.file.name.split(".").pop()!.toLowerCase()
    : "bin";
  const storagePath = `authenticated/meetings/${params.requestId}/${params.meetingId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(MEETING_RELATO_BUCKET)
    .upload(storagePath, params.file, { contentType: params.file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: attachmentError } = await supabase.from("attachments").insert({
    request_id: params.requestId,
    meeting_id: params.meetingId,
    filename: params.file.name,
    storage_path: storagePath,
    mime_type: params.file.type,
    size_bytes: params.file.size,
    uploaded_by: params.userId,
  });
  if (attachmentError) throw attachmentError;

  return storagePath;
}

export async function uploadClosureRelato(params: {
  file: File;
  requestId: string;
  closureId: string;
  userId: string;
}): Promise<string> {
  const validationError = validateMeetingRelatoFile(params.file);
  if (validationError) throw new Error(validationError);

  const ext = params.file.name.includes(".")
    ? params.file.name.split(".").pop()!.toLowerCase()
    : "bin";
  const storagePath = `authenticated/closures/${params.requestId}/${params.closureId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(MEETING_RELATO_BUCKET)
    .upload(storagePath, params.file, { contentType: params.file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { error: attachmentError } = await supabase.from("attachments").insert({
    request_id: params.requestId,
    filename: params.file.name,
    storage_path: storagePath,
    mime_type: params.file.type,
    size_bytes: params.file.size,
    uploaded_by: params.userId,
  });
  if (attachmentError) throw attachmentError;

  return storagePath;
}

export async function getMeetingRelatoDownloadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MEETING_RELATO_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
