/**
 * Site Images — shared types (server + client paylaşır)
 */

export interface SiteImage {
  slot: string;
  storagePath: string;
  publicUrl: string;
  altText: string | null;
  title: string | null;
  linkUrl: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
}

export interface DbRow {
  slot: string;
  storage_path: string;
  alt_text: string | null;
  title: string | null;
  link_url: string | null;
  width: number | null;
  height: number | null;
  mime_type: string | null;
}

export const BUCKET = "public-assets";

export function rowToImage(row: DbRow, supabaseUrl: string): SiteImage {
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${row.storage_path}`;
  return {
    slot: row.slot,
    storagePath: row.storage_path,
    publicUrl,
    altText: row.alt_text,
    title: row.title,
    linkUrl: row.link_url,
    width: row.width,
    height: row.height,
    mimeType: row.mime_type,
  };
}
