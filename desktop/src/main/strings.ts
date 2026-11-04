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

const de: Strings = {
  about: (name) => `Über ${name}`,
  checkForUpdates: "Nach Updates suchen…",
  settings: "Einstellungen…",
  help: "Hilfe",
  quit: (name) => `${name} beenden`,
  hide: (name) => `${name} ausblenden`,
  hideOthers: "Andere ausblenden",
  showAll: "Alle einblenden",
  services: "Dienste",
  fileMenu: "&Datei",
  editMenu: "&Bearbeiten",
  viewMenu: "&Ansicht",
  windowMenu: "&Fenster",
  helpMenu: "&Hilfe",
  undo: "Rückgängig",
  redo: "Wiederholen",
  cut: "Ausschneiden",
  copy: "Kopieren",
  paste: "Einsetzen",
  pasteAndMatchStyle: "Einsetzen und Stil anpassen",
  delete: "Löschen",
  selectAll: "Alles auswählen",
  reload: "Neu laden",
  actualSize: "Originalgröße",
  zoomIn: "Vergrößern",
  zoomOut: "Verkleinern",
  fullScreen: "Vollbild",
  minimize: "Minimieren",
  zoom: "Zoomen",
  close: "Schließen",
  bringAllToFront: "Alle nach vorne bringen",
  open: (name) => `${name} öffnen`,
  startMeeting: "Meeting starten",
  joinMeeting: "An einem Meeting teilnehmen…",
  upcoming: "Anstehend",
  joinNext: (title) => `An „${title}“ teilnehmen`,
  mute: "Stummschalten",
  unmute: "Stummschaltung aufheben",
  leave: "Meeting verlassen",
  join: "Teilnehmen",
  startsIn: (minutes) =>
    minutes === 1 ? "Beginnt in 1 Minute" : `Beginnt in ${minutes} Minuten`,
  unread: (count) =>
    count === 1 ? "1 ungelesene Nachricht" : `${count} ungelesene Nachrichten`,
  updateReady: (name, version) =>
    `${name} ${version} ist bereit zur Installation`,
  updateReadyDetail: "Starten Sie neu, um das Update abzuschließen.",
  restartNow: "Jetzt neu starten",
  later: "Später",
  upToDate: (name) => `${name} ist auf dem neuesten Stand`,
  updatesOff: "Updates sind für diese Version nicht eingerichtet.",
  updateFailed:
    "Die Suche nach Updates ist fehlgeschlagen. Versuchen Sie es später erneut.",
  newVersion: (name, version) => `${name} ${version} ist erschienen`,
  download: "Herunterladen",
  ok: "OK",
};

const ja: Strings = {
  about: (name) => `${name} について`,
  checkForUpdates: "アップデートを確認…",
  settings: "設定…",
  help: "ヘルプ",
  quit: (name) => `${name} を終了`,
  hide: (name) => `${name} を非表示`,
  hideOthers: "ほかを非表示",
  showAll: "すべてを表示",
  services: "サービス",
  fileMenu: "ファイル(&F)",
  editMenu: "編集(&E)",
  viewMenu: "表示(&V)",
  windowMenu: "ウィンドウ(&W)",
  helpMenu: "ヘルプ(&H)",
  undo: "取り消す",
  redo: "やり直す",
  cut: "切り取り",
  copy: "コピー",
  paste: "貼り付け",
  pasteAndMatchStyle: "ペーストしてスタイルを合わせる",
  delete: "削除",
  selectAll: "すべてを選択",
  reload: "再読み込み",
  actualSize: "実際のサイズ",
  zoomIn: "拡大",
  zoomOut: "縮小",
  fullScreen: "全画面表示",
  minimize: "最小化",
  zoom: "拡大/縮小",
  close: "閉じる",
  bringAllToFront: "すべてを手前に移動",
  open: (name) => `${name} を開く`,
  startMeeting: "ミーティングを開始",
  joinMeeting: "ミーティングに参加…",
  upcoming: "今後",
  joinNext: (title) => `「${title}」に参加`,
  mute: "ミュート",
  unmute: "ミュート解除",
  leave: "ミーティングを退出",
  join: "参加",
  startsIn: (minutes) => `${minutes} 分後に開始`,
  unread: (count) => `未読メッセージ ${count} 件`,
  updateReady: (name, version) =>
    `${name} ${version} をインストールする準備ができました`,
  updateReadyDetail: "再起動すると、アップデートが完了します。",
  restartNow: "今すぐ再起動",
  later: "後で",
  upToDate: (name) => `${name} は最新の状態です`,
  updatesOff: "このビルドではアップデートが設定されていません。",
  updateFailed:
    "アップデートを確認できませんでした。後でもう一度お試しください。",
  newVersion: (name, version) => `${name} ${version} が公開されました`,
  download: "ダウンロード",
  ok: "OK",
};

/** The languages the shell speaks, named as the web app names them. */
export const translations: Record<string, Strings> = {
  en,
  es,
  "pt-BR": ptBR,
  fr,
  de,
  ja,
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
