import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
export async function saveTextFile(name: string, content: string, type = 'text/plain') {
  if (Capacitor.isNativePlatform()) {
    const path = `still-exports/${crypto.randomUUID()}/${name}`;
    const result = await Filesystem.writeFile({
      path,
      data: content,
      encoding: Encoding.UTF8,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({ title: name, url: result.uri });
  } else {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
