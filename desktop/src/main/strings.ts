/**
 * The shell's own words: its menus, tray, notifications and dialogs, in the app's
 * language (language.ts picks it). Everything inside the window is the web app, whose
 * words come from its message files. Menu names mark their Windows access key with &,
 * as each language does it ("&File", "ファイル(&F)").
 */
const en = {
  about: (name: string) => `About ${name}`,
  checkForUpdates: "Check for Updates…",
  settings: "Settings…",
  help: "Help",
  quit: (name: string) => `Quit ${name}`,
  hide: (name: string) => `Hide ${name}`,
  hideOthers: "Hide Others",
  showAll: "Show All",
  services: "Services",
  fileMenu: "&File",
  editMenu: "&Edit",
  viewMenu: "&View",
  windowMenu: "&Window",
  helpMenu: "&Help",
  undo: "Undo",
  redo: "Redo",
  cut: "Cut",
  copy: "Copy",
  paste: "Paste",
  pasteAndMatchStyle: "Paste and Match Style",
  delete: "Delete",
  selectAll: "Select All",
  reload: "Reload",
  actualSize: "Actual Size",
  zoomIn: "Zoom In",
  zoomOut: "Zoom Out",
  fullScreen: "Toggle Full Screen",
  minimize: "Minimize",
  zoom: "Zoom",
  close: "Close",
  bringAllToFront: "Bring All to Front",
  open: (name: string) => `Open ${name}`,
  startMeeting: "Start a meeting",
  joinMeeting: "Join a meeting…",
  upcoming: "Upcoming",
  joinNext: (title: string) => `Join “${title}”`,
  mute: "Mute",
  unmute: "Unmute",
  leave: "Leave meeting",
  join: "Join",
  startsIn: (minutes: number) =>
    minutes === 1 ? "Starts in 1 minute" : `Starts in ${minutes} minutes`,
  unread: (count: number) =>
    count === 1 ? "1 unread message" : `${count} unread messages`,
  updateReady: (name: string, version: string) =>
    `${name} ${version} is ready to install`,
  updateReadyDetail: "Restart to finish updating.",
  restartNow: "Restart now",
  later: "Later",
  upToDate: (name: string) => `${name} is up to date`,
  updatesOff: "Updates aren’t set up for this build.",
  updateFailed: "Couldn’t check for updates. Try again later.",
  newVersion: (name: string, version: string) => `${name} ${version} is out`,
  download: "Download",
  ok: "OK",
};

/** Every string the shell shows. Each language has all of them; TypeScript checks it. */
export type Strings = typeof en;

const es: Strings = {
  about: (name) => `Acerca de ${name}`,
  checkForUpdates: "Buscar actualizaciones…",
  settings: "Configuración…",
  help: "Ayuda",
  quit: (name) => `Salir de ${name}`,
  hide: (name) => `Ocultar ${name}`,
  hideOthers: "Ocultar otros",
  showAll: "Mostrar todo",
  services: "Servicios",
  fileMenu: "&Archivo",
  editMenu: "&Edición",
  viewMenu: "&Ver",
  windowMenu: "Ve&ntana",
  helpMenu: "Ay&uda",
  undo: "Deshacer",
  redo: "Rehacer",
  cut: "Cortar",
  copy: "Copiar",
  paste: "Pegar",
  pasteAndMatchStyle: "Pegar con el mismo estilo",
  delete: "Eliminar",
  selectAll: "Seleccionar todo",
  reload: "Volver a cargar",
  actualSize: "Tamaño real",
  zoomIn: "Acercar",
  zoomOut: "Alejar",
  fullScreen: "Pantalla completa",
  minimize: "Minimizar",
  zoom: "Zoom",
  close: "Cerrar",
  bringAllToFront: "Traer todo al frente",
  open: (name) => `Abrir ${name}`,
  startMeeting: "Iniciar una reunión",
  joinMeeting: "Unirse a una reunión…",
  upcoming: "Próximas",
  joinNext: (title) => `Unirse a “${title}”`,
  mute: "Silenciar",
  unmute: "Reactivar audio",
  leave: "Salir de la reunión",
  join: "Unirse",
  startsIn: (minutes) =>
    minutes === 1 ? "Empieza en 1 minuto" : `Empieza en ${minutes} minutos`,
  unread: (count) =>
    count === 1 ? "1 mensaje sin leer" : `${count} mensajes sin leer`,
  updateReady: (name, version) =>
    `${name} ${version} está listo para instalarse`,
  updateReadyDetail: "Reinicia la app para terminar de actualizarla.",
  restartNow: "Reiniciar ahora",
  later: "Más tarde",
  upToDate: (name) => `${name} está actualizado`,
  updatesOff: "Esta versión no tiene configuradas las actualizaciones.",
  updateFailed:
    "No se pudo buscar actualizaciones. Vuelve a intentarlo más tarde.",
  newVersion: (name, version) => `Ya está disponible ${name} ${version}`,
  download: "Descargar",
  ok: "Aceptar",
};

const ptBR: Strings = {
  about: (name) => `Sobre o ${name}`,
  checkForUpdates: "Verificar atualizações…",
  settings: "Configurações…",
  help: "Ajuda",
  quit: (name) => `Sair do ${name}`,
  hide: (name) => `Ocultar ${name}`,
  hideOthers: "Ocultar outros",
  showAll: "Mostrar tudo",
  services: "Serviços",
  fileMenu: "&Arquivo",
  editMenu: "&Editar",
  viewMenu: "E&xibir",
  windowMenu: "&Janela",
  helpMenu: "Aj&uda",
  undo: "Desfazer",
  redo: "Refazer",
  cut: "Recortar",
  copy: "Copiar",
  paste: "Colar",
  pasteAndMatchStyle: "Colar com o mesmo estilo",
  delete: "Excluir",
  selectAll: "Selecionar tudo",
  reload: "Recarregar",
  actualSize: "Tamanho real",
  zoomIn: "Aumentar zoom",
  zoomOut: "Diminuir zoom",
  fullScreen: "Tela cheia",
  minimize: "Minimizar",
  zoom: "Zoom",
  close: "Fechar",
  bringAllToFront: "Trazer tudo para a frente",
  open: (name) => `Abrir o ${name}`,
  startMeeting: "Iniciar uma reunião",
  joinMeeting: "Participar de uma reunião…",
  upcoming: "Próximas",
  joinNext: (title) => `Participar de “${title}”`,
  mute: "Desativar áudio",
  unmute: "Ativar áudio",
  leave: "Sair da reunião",
  join: "Participar",
  startsIn: (minutes) =>
    minutes === 1 ? "Começa em 1 minuto" : `Começa em ${minutes} minutos`,
  unread: (count) =>
    count === 1 ? "1 mensagem não lida" : `${count} mensagens não lidas`,
  updateReady: (name, version) =>
    `O ${name} ${version} está pronto para instalar`,
  updateReadyDetail: "Reinicie o app para terminar a atualização.",
  restartNow: "Reiniciar agora",
  later: "Mais tarde",
  upToDate: (name) => `O ${name} está atualizado`,
  updatesOff: "As atualizações não estão configuradas nesta versão.",
  updateFailed:
    "Não foi possível verificar se há atualizações. Tente de novo mais tarde.",
  newVersion: (name, version) => `O ${name} ${version} já está disponível`,
  download: "Baixar",
  ok: "OK",
};

const fr: Strings = {
  about: (name) => `À propos de ${name}`,
  checkForUpdates: "Rechercher des mises à jour…",
  settings: "Paramètres…",
  help: "Aide",
  quit: (name) => `Quitter ${name}`,
  hide: (name) => `Masquer ${name}`,
  hideOthers: "Masquer les autres",
  showAll: "Tout afficher",
  services: "Services",
  fileMenu: "&Fichier",
  editMenu: "&Édition",
  viewMenu: "&Affichage",
  windowMenu: "Fe&nêtre",
  helpMenu: "Aid&e",
  undo: "Annuler",
  redo: "Rétablir",
  cut: "Couper",
  copy: "Copier",
  paste: "Coller",
  pasteAndMatchStyle: "Coller et adapter le style",
  delete: "Supprimer",
  selectAll: "Tout sélectionner",
  reload: "Actualiser",
  actualSize: "Taille réelle",
  zoomIn: "Zoom avant",
  zoomOut: "Zoom arrière",
  fullScreen: "Plein écran",
  minimize: "Réduire",
  zoom: "Zoom",
  close: "Fermer",
  bringAllToFront: "Tout ramener au premier plan",
  open: (name) => `Ouvrir ${name}`,
  startMeeting: "Démarrer une réunion",
  joinMeeting: "Rejoindre une réunion…",
  upcoming: "À venir",
  joinNext: (title) => `Rejoindre « ${title} »`,
  mute: "Couper le micro",
  unmute: "Activer le micro",
  leave: "Quitter la réunion",
  join: "Rejoindre",
  startsIn: (minutes) =>
    minutes === 1
      ? "Commence dans 1 minute"
      : `Commence dans ${minutes} minutes`,
  unread: (count) =>
    count === 1 ? "1 message non lu" : `${count} messages non lus`,
  updateReady: (name, version) => `${name} ${version} est prêt à être installé`,
  updateReadyDetail: "Redémarrez pour terminer la mise à jour.",
  restartNow: "Redémarrer maintenant",
  later: "Plus tard",
  upToDate: (name) => `${name} est à jour`,
  updatesOff: "Les mises à jour ne sont pas configurées pour cette version.",
  updateFailed:
    "Impossible de rechercher des mises à jour. Réessayez plus tard.",
  newVersion: (name, version) => `${name} ${version} est disponible`,
  download: "Télécharger",
  ok: "OK",
};

/** The languages the shell speaks, named as the web app names them. */
export const translations: Record<string, Strings> = {
  en,
  es,
  "pt-BR": ptBR,
  fr,
};

/** The shell's words in its current language; setLanguage switches them. */
export const strings: Strings = { ...en };

let current = "en";

/**
 * The language for the first of these tags the shell speaks: the same tag, or else one
 * in the same base language ("pt-PT" → "pt-BR"); English when none matches.
 */
export function languageFor(
  tags: readonly (string | null | undefined)[],
): string {
  const languages = Object.keys(translations);
  for (const tag of tags) {
    if (!tag) continue;
    const wanted = tag.replace("_", "-").toLowerCase();
    const exact = languages.find(
      (language) => language.toLowerCase() === wanted,
    );
    if (exact) return exact;
    const base = wanted.split("-")[0];
    const sameLanguage = languages.find(
      (language) => language.split("-")[0]?.toLowerCase() === base,
    );
    if (sameLanguage) return sameLanguage;
  }
  return "en";
}

/** Switches the shell's words to a language it speaks; true when that changed them. */
export function setLanguage(language: string): boolean {
  const next = translations[language];
  if (!next || language === current) return false;
  Object.assign(strings, next);
  current = language;
  return true;
}

/** A menu name without its Windows access key, for macOS: "&File" → "File". */
export function withoutAccessKey(label: string): string {
  return label.replace(/\s*\(&.\)$/, "").replace(/&(.)/, "$1");
}
