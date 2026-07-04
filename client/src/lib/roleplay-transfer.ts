export type ParsedZipItem = {
  key: string;
  title: string;
  sourceFile: string;
  file: File;
};

export type ParseScenarioFilesResult = {
  items: ParsedZipItem[];
  errors: { fileName: string; message: string }[];
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] || fallback;
}

function isZipFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

export async function fetchAndDownloadExport(ids: number[]): Promise<void> {
  if (!ids.length) throw new Error("No scenarios selected");
  const res = await fetch(`/api/roleplays/export?ids=${ids.join(",")}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // keep statusText
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const filename = filenameFromDisposition(
    res.headers.get("Content-Disposition"),
    `scenarios-export-${new Date().toISOString().slice(0, 10)}.zip`,
  );
  downloadBlob(blob, filename);
}

export async function importScenariosZip(
  file: File,
): Promise<{ created: unknown[]; warnings: string[] }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/roleplays/import", {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = data.error || data.message || message;
    } catch {
      // keep
    }
    throw new Error(message);
  }
  return res.json();
}

/** Import one or more scenario zip packages sequentially. */
export async function importScenariosZips(
  files: File[],
): Promise<{ created: unknown[]; warnings: string[] }> {
  if (!files.length) throw new Error("Select at least one zip file");

  const created: unknown[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const result = await importScenariosZip(file);
      created.push(...(result.created ?? []));
      for (const warning of result.warnings ?? []) {
        warnings.push(`"${file.name}": ${warning}`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "import failed";
      errors.push(`"${file.name}": ${detail}`);
    }
  }

  if (!created.length && errors.length) {
    throw new Error(errors.join(" "));
  }
  if (errors.length) {
    warnings.push(...errors.map((message) => `Failed ${message}`));
  }
  return { created, warnings };
}

export async function parseScenarioFiles(
  files: FileList | File[],
): Promise<ParseScenarioFilesResult> {
  const items: ParsedZipItem[] = [];
  const errors: { fileName: string; message: string }[] = [];
  const usedKeys = new Set<string>();

  for (const file of Array.from(files)) {
    if (!isZipFile(file)) {
      errors.push({
        fileName: file.name,
        message: "Only zip scenario packages are supported",
      });
      continue;
    }

    let key = file.name;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${file.name}::${suffix}`;
      suffix += 1;
    }
    usedKeys.add(key);

    items.push({
      key,
      title: file.name.replace(/\.zip$/i, ""),
      sourceFile: file.name,
      file,
    });
  }

  return { items, errors };
}
