# Translation glossary

FaceOn speaks English (the source, `en.json`), Spanish (`es`), Portuguese (Brazil, `pt-BR`), French (`fr`), German (`de`) and Japanese (`ja`). Each language uses the words people already know from Zoom and Google Meet in that language. This page keeps those words, and how each language sounds, consistent. Read it before changing a message, and add a term here when a new one comes up.

## Rules for every language

- **Plain and natural.** Write the way a careful native speaker would say it, not word for word from English. Short sentences, everyday words.
- **Placeholders stay as they are:** `{appName}`, `{name}`, `{count, plural, …}`, `{role, select, …}` and tags like `<terms>…</terms>`. Translate the words inside plural and select branches, never the keywords or the argument names. Each language gives the plural forms its grammar has (Japanese has only `other`).
- **Product and proper names stay:** FaceOn (`{appName}`), Gmail, Stream, Chrome, Microsoft Authenticator, GitHub, Resend.
- **Google Calendar** goes by the name Google gives it in each language: Google Calendar (es), Google Agenda (pt-BR and fr), Google Kalender (de), Google カレンダー (ja). The add-on's Calendar option stays “{appName} meeting”, as Google shows it.
- **Dates, times and numbers** come from `Intl` in the code; never write them into a message.
- **Typography:** each language's own quotation marks and spacing (`« … »` with narrow spaces in French, `„…“` in German, `「…」` in Japanese), and the ellipsis character `…`.
- **Longer text is fine.** Controls make room for labels about 35% longer than English, but prefer the shorter of two equally clear wordings, especially on buttons.

## How each language sounds

| Language             | Address                                      | Notes                                                                                                                                        |
| -------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Spanish (`es`)       | **tú**, as Google Meet does in Latin America | One neutral Latin American Spanish: _video_ (not _vídeo_), _computadora_, _celular_. Avoid regionalisms.                                     |
| Portuguese (`pt-BR`) | **você**                                     | Brazilian, not European: _tela_, _celular_, _arquivo_, _equipe_.                                                                             |
| French (`fr`)        | **vous**                                     | Narrow no-break space before `: ; ! ?` and inside `« »`. Capitalize only the first word of a label.                                          |
| German (`de`)        | **Sie**                                      | Nouns capitalized; compounds hyphenated where English names stay (_Meeting-ID_). Buttons are infinitives (_Teilnehmen_).                     |
| Japanese (`ja`)      | Polite **です／ます** in sentences           | Buttons and menu items are short nouns or verbs (_参加_, _ミュート解除_). Full-width punctuation 、。！？; no spaces between Japanese words. |

## Core terms

The controls everyone knows. Use exactly these.

| English                      | es                                           | pt-BR                                     | fr                                         | de                                      | ja                                       |
| ---------------------------- | -------------------------------------------- | ----------------------------------------- | ------------------------------------------ | --------------------------------------- | ---------------------------------------- |
| Meeting                      | reunión                                      | reunião                                   | réunion                                    | Meeting                                 | ミーティング                             |
| New meeting                  | Nueva reunión                                | Nova reunião                              | Nouvelle réunion                           | Neues Meeting                           | 新規ミーティング                         |
| Join                         | Unirse                                       | Participar                                | Rejoindre                                  | Teilnehmen                              | 参加                                     |
| Schedule                     | Programar                                    | Agendar                                   | Planifier                                  | Planen                                  | スケジュール                             |
| Mute / Unmute                | Silenciar / Reactivar audio                  | Desativar áudio / Ativar áudio            | Couper le micro / Activer le micro         | Stummschalten / Stummschaltung aufheben | ミュート / ミュート解除                  |
| Start video / Stop video     | Iniciar video / Detener video                | Iniciar vídeo / Parar vídeo               | Démarrer la vidéo / Arrêter la vidéo       | Video starten / Video stoppen           | ビデオの開始 / ビデオの停止              |
| Share screen / Stop sharing  | Compartir pantalla / Dejar de compartir      | Compartilhar tela / Parar de compartilhar | Partager l’écran / Arrêter le partage      | Bildschirm freigeben / Freigabe beenden | 画面を共有 / 共有を停止                  |
| Participants                 | Participantes                                | Participantes                             | Participants                               | Teilnehmer                              | 参加者                                   |
| Chat                         | Chat                                         | Chat                                      | Chat                                       | Chat                                    | チャット                                 |
| Reactions                    | Reacciones                                   | Reações                                   | Réactions                                  | Reaktionen                              | リアクション                             |
| Raise hand / Lower hand      | Levantar la mano / Bajar la mano             | Levantar a mão / Abaixar a mão            | Lever la main / Baisser la main            | Hand heben / Hand senken                | 手を挙げる / 手を降ろす                  |
| Waiting room                 | Sala de espera                               | Sala de espera                            | Salle d’attente                            | Warteraum                               | 待機室                                   |
| Admit                        | Admitir                                      | Admitir                                   | Admettre                                   | Zulassen                                | 許可                                     |
| Leave meeting                | Salir de la reunión                          | Sair da reunião                           | Quitter la réunion                         | Meeting verlassen                       | ミーティングを退出                       |
| End meeting for all          | Finalizar la reunión para todos              | Encerrar reunião para todos               | Mettre fin à la réunion pour tous          | Meeting für alle beenden                | 全員に対してミーティングを終了           |
| Meeting ID                   | ID de reunión                                | ID da reunião                             | ID de réunion                              | Meeting-ID                              | ミーティング ID                          |
| Passcode                     | Código de acceso                             | Código de acesso                          | Code secret                                | Kenncode                                | パスコード                               |
| Host / Co-host               | Anfitrión / Coanfitrión                      | Anfitrião / Coanfitrião                   | Hôte / Co-hôte                             | Host / Co-Host                          | ホスト / 共同ホスト                      |
| Guest                        | Invitado                                     | Convidado                                 | Invité                                     | Gast                                    | ゲスト                                   |
| Personal room                | Sala personal                                | Sala pessoal                              | Salle personnelle                          | Persönlicher Raum                       | パーソナル ルーム                        |
| Gallery view / Speaker view  | Vista de galería / Vista del orador          | Galeria / Orador                          | Vue galerie / Vue intervenant              | Galerieansicht / Sprecheransicht        | ギャラリー ビュー / スピーカー ビュー    |
| Spotlight                    | Destacar                                     | Destacar                                  | Mettre en avant                            | Hervorheben                             | スポットライト                           |
| Background / Blur            | Fondo / Desenfocar                           | Plano de fundo / Desfocar                 | Arrière-plan / Flouter                     | Hintergrund / Weichzeichnen             | 背景 / ぼかし                            |
| Noise suppression            | Supresión de ruido                           | Supressão de ruído                        | Suppression du bruit                       | Rauschunterdrückung                     | ノイズ抑制                               |
| Upcoming / Previous          | Próximas / Anteriores                        | Próximas / Anteriores                     | À venir / Précédentes                      | Anstehend / Vergangen                   | 今後 / 過去                              |
| AI notes                     | Notas de IA                                  | Notas de IA                               | Notes IA                                   | KI-Notizen                              | AI メモ                                  |
| Settings                     | Configuración                                | Configurações                             | Paramètres                                 | Einstellungen                           | 設定                                     |
| Sign in / Sign up / Sign out | Iniciar sesión / Registrarse / Cerrar sesión | Entrar / Criar conta / Sair               | Se connecter / S’inscrire / Se déconnecter | Anmelden / Registrieren / Abmelden      | サインイン / サインアップ / サインアウト |
| Help                         | Ayuda                                        | Ajuda                                     | Aide                                       | Hilfe                                   | ヘルプ                                   |
| Ctrl (key)                   | Ctrl                                         | Ctrl                                      | Ctrl                                       | Strg                                    | Ctrl                                     |

## Suggesting better wording

Anyone can suggest a better translation from **Settings → General** or the footer of a public page, which opens an issue on GitHub. Changes go through the glossary first when they touch a core term.
