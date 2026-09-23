const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function publicAssetUrl(path: string): string {
  return `${basePath}/${path.replace(/^\/+/, "")}`;
}
