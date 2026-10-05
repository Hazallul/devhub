import api from '../services/api';

/** Tarayıcıya dosya indirtir (Blob → geçici bağlantı). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Oturum gerektiren bir dosyayı indirir: <a href> JWT gönderemediği için dosya axios ile alınır. */
export async function downloadFile(url: string, filename: string) {
  const res = await api.get<Blob>(url, { responseType: 'blob' });
  saveBlob(res.data, filename);
}

/** 1536 → "1,5 KB" */
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} KB`;
  return `${(kb / 1024).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`;
}
