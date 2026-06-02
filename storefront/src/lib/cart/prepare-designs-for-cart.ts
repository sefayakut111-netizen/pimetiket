export function isEphemeralPreviewUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return url.startsWith("blob:") || url.startsWith("data:");
}

export interface DesignInput {
  id: string;
  file: File;
  previewUrl: string;
  generatedPreviewUrl?: string | null;
  name: string;
  sizeBytes: number;
  mimeType: string;
  tempId?: string;
}

export interface PrimaryDesignSource {
  tempId?: string;
  generatedPreviewUrl?: string | null;
  previewUrl?: string;
}

export interface AdditionalDesignEntry {
  tempId: string;
  previewUrl: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

async function resolveDesignPreviewUrl(d: DesignInput): Promise<string> {
  if (d.generatedPreviewUrl && !isEphemeralPreviewUrl(d.generatedPreviewUrl)) {
    return d.generatedPreviewUrl;
  }
  if (d.previewUrl && !isEphemeralPreviewUrl(d.previewUrl)) {
    return d.previewUrl;
  }
  const { persistDesignPreview } = await import("@/lib/design-preview");
  return (await persistDesignPreview(d.file, d.id)) ?? d.previewUrl;
}

/**
 * Sepete eklemeden önce tasarım preview/tempId hazırlığı.
 * DesignDropZone veya editör zaten yüklemişse gereksiz persist/upload atlanır.
 */
export async function prepareDesignsForCart(
  designs: DesignInput[],
  primarySource?: PrimaryDesignSource | null
): Promise<{
  persistedDesigns: Array<DesignInput & { previewUrl: string }>;
  resolvedDesignTempId?: string;
  resolvedPreviewUrl?: string;
  additionalDesigns?: AdditionalDesignEntry[];
  uploadFailed?: boolean;
}> {
  const persistedDesigns = await Promise.all(
    designs.map(async (d, index) => {
      const dropzonePreview =
        index === 0
          ? primarySource?.generatedPreviewUrl ?? primarySource?.previewUrl
          : undefined;
      if (
        index === 0 &&
        primarySource?.tempId &&
        dropzonePreview &&
        !isEphemeralPreviewUrl(dropzonePreview)
      ) {
        return { ...d, previewUrl: dropzonePreview };
      }
      return { ...d, previewUrl: await resolveDesignPreviewUrl(d) };
    })
  );

  let resolvedDesignTempId = primarySource?.tempId;
  let resolvedPreviewUrl =
    primarySource?.generatedPreviewUrl ??
    primarySource?.previewUrl ??
    persistedDesigns[0]?.previewUrl;

  const primary = persistedDesigns[0];
  if (!resolvedDesignTempId && primary) {
    const { uploadFileToTempDesign } = await import("@/lib/design-temp-upload");
    const uploaded = await uploadFileToTempDesign(primary.file);
    console.log("[cart-add] designTempId:", uploaded?.tempId ?? null);
    if (!uploaded?.tempId) {
      return {
        persistedDesigns,
        resolvedDesignTempId: undefined,
        resolvedPreviewUrl,
        uploadFailed: true,
      };
    }
    resolvedDesignTempId = uploaded.tempId;
    if (uploaded.generatedPreviewUrl) {
      resolvedPreviewUrl = uploaded.generatedPreviewUrl;
    }
  } else {
    console.log("[cart-add] designTempId:", resolvedDesignTempId ?? null);
  }

  const additionalDesigns =
    persistedDesigns.length > 1
      ? await Promise.all(
          persistedDesigns.slice(1).map(async (d) => {
            if (d.tempId && !d.tempId.startsWith("local-")) {
              return {
                tempId: d.tempId,
                previewUrl: d.generatedPreviewUrl ?? d.previewUrl,
                fileName: d.name,
                sizeBytes: d.sizeBytes,
                mimeType: d.mimeType,
              };
            }
            const { uploadFileToTempDesign } = await import(
              "@/lib/design-temp-upload"
            );
            const up = await uploadFileToTempDesign(d.file);
            return {
              tempId: up?.tempId ?? `local-${d.id}`,
              previewUrl: up?.generatedPreviewUrl ?? d.previewUrl,
              fileName: d.name,
              sizeBytes: d.sizeBytes,
              mimeType: d.mimeType,
            };
          })
        )
      : undefined;

  return {
    persistedDesigns,
    resolvedDesignTempId,
    resolvedPreviewUrl,
    additionalDesigns,
  };
}
