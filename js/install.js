// Инсталирането се предлага само от Настройки. Приложението никога не подканя само.
let deferred = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
});

window.addEventListener('appinstalled', () => { deferred = null; });

export const canInstall = () => deferred !== null;

export async function promptInstall() {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
}
