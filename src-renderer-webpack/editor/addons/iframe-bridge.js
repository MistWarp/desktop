if (typeof window.AddonsPreload === 'undefined' && window.parent !== window) {
  const nativeAlert = window.alert.bind(window);
  const nativeConfirm = window.confirm.bind(window);
  window.AddonsPreload = {
    exportSettings: (settings) => window.parent.postMessage({mwExportAddonSettings: settings}, '*')
  };
  window.PromptsPreload = {
    alert: nativeAlert,
    confirm: nativeConfirm
  };
}
