// Share sheet → download → copy fallbacks. Nothing is sent anywhere by the app;
// the user picks the destination in the system share sheet.

export function canShareFiles(files) {
  try {
    return Boolean(navigator.canShare && navigator.canShare({ files }));
  } catch {
    return false;
  }
}

/** @returns {'shared'|'downloaded'|'cancelled'} */
export async function shareOrDownload(file, { title, text } = {}) {
  if (canShareFiles([file])) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  } else if (navigator.share && text) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      if (err && err.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(file, file.name);
  return 'downloaded';
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** @returns {Promise<boolean>} */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

export function vcfFile(text, name) {
  return new File([text], name, { type: 'text/vcard' });
}
