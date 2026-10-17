import { applyAppearance } from './still/appearance';
import '@/locales/browser/config.ts';
import 'large-small-dynamic-viewport-units-polyfill';

import { checkPlatform } from './base/browser/checkPlatform';
import { startDesktop } from './desktop/main';
import { startMobile } from './mobile/main';

function shouldLoadDesktop() {
  if (checkPlatform().isElectron) {
    return true;
  }
  const pathname = location.pathname;
  if (pathname !== '/') {
    return pathname.startsWith('/desktop');
  }
  // Check if user agent matches mobile device
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  if (isMobileDevice || window.matchMedia('(max-width: 767px)').matches) {
    return false;
  }

  return true;
}

applyAppearance();

if (shouldLoadDesktop()) {
  startDesktop();
} else {
  startMobile();
}
