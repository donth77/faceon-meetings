---
title: Notes IA
summary: Un résumé, des actions à mener et des décisions à partir de ce qui est dit, rédigés dans votre navigateur.
category: hosting
order: 5
---

Les notes IA transforment ce qui se dit dans une réunion en un court résumé, une liste d’actions à mener (avec qui s’en charge et pour quand, quand c’est clair) et les décisions prises. Elles sont désactivées sauf si l’hôte de la réunion les autorise et qu’un hôte les démarre, tout le monde voit quand elles sont activées, et rien n’est enregistré sauf si la personne qui prend les notes le choisit.

## Les autoriser dans vos réunions

Les notes IA sont désactivées au départ pour tous les comptes. Pour les utiliser dans les réunions que vous organisez, allez dans **Paramètres**, puis **Notes IA**, et activez **Notes IA dans les réunions que vous organisez**. Dans une réunion que vous organisez, **Plus**, puis **Notes IA**, propose un bouton qui vous y mène.

Ce choix est conservé avec votre compte : il s’applique donc aussi à vos co-hôtes. Tant qu’il est désactivé, personne ne peut démarrer de notes IA dans vos réunions. Le désactiver arrête aussi celles qui sont en cours dans une réunion que vous organisez à ce moment-là.

## Les activer

Les hôtes et co-hôtes sélectionnent **Plus**, puis **Notes IA**, puis **Démarrer les notes IA**. Chaque réunion commence avec les notes désactivées. Les notes IA ne sont pas disponibles dans les réunions de démonstration, ni dans les réunions dont l’hôte ne les a pas autorisées.

La personne qui les démarre prend les notes : la transcription s’accumule dans son navigateur, et les notes y sont rédigées. Sélectionnez **Arrêter les notes IA** pour les arrêter pour tout le monde. Elles s’arrêtent aussi quand la personne qui prend les notes part.

## Les démarrer automatiquement

Une fois que vos réunions autorisent les notes IA, une réunion peut les démarrer d’elle-même : activez **Démarrer les notes IA automatiquement** quand vous la planifiez, sur la page de la réunion, sur votre page **Salle personnelle** ou dans la réunion (**Participants**, puis **⋯**). Dès lors, les notes IA démarrent dès que vous ou un co-hôte rejoignez la réunion, avec le même message pour tout le monde, et les personnes sur le point de rejoindre la réunion en sont informées à l’avance.

Elles démarrent dans le navigateur de la personne qui arrive, à condition qu’il puisse rédiger des notes (voir Comment les notes sont rédigées, plus bas). Sinon, elles ne démarrent pas, et {appName} explique pourquoi, avec un lien vers **Paramètres**. Une fois que quelqu’un a sélectionné **Arrêter les notes IA**, elles restent désactivées jusqu’à la fin de la réunion, même si quelqu’un la rejoint à nouveau.

## Ce que tout le monde voit

- **Notes IA activées** en haut de la réunion, et un message indiquant qui les a activées.
- Les personnes sur le point de rejoindre la réunion voient la même note avant d’entrer ou, dans une réunion qui démarre les notes IA automatiquement, qu’elles vont démarrer.
- Pour rester en dehors des notes, sélectionnez **Notes IA activées**, puis activez **Ne pas me transcrire**. À partir de là, ce que vous dites n’est pas transcrit, et la personne qui prend les notes voit que vous avez fait ce choix.

## Comment la parole devient du texte

Le navigateur de chaque personne transforme ce qu’_elle_ dit en texte, sur son propre appareil, et n’envoie que le texte à la personne qui prend les notes. L’audio ne quitte jamais l’appareil de personne pour cela, et rien n’est transcrit quand votre micro est coupé.

Cela fonctionne dans Chrome sur ordinateur. La première fois, Chrome a besoin d’un téléchargement unique pour transcrire votre langue : quelques centaines de Mo, qu’il conserve. Vous pouvez le faire avant une réunion, dans **Paramètres**, puis **Notes IA** (**Transcription sur cet appareil**), ou avant de rejoindre une réunion où les notes IA sont activées. Dans une réunion, sélectionnez **Notes IA activées**, puis **Télécharger maintenant**. Tant que ce n’est pas terminé, ce que vous dites n’apparaît pas dans les notes, et la personne qui prend les notes voit que vous attendez.

Quand un navigateur ne peut pas transcrire sur l’appareil (Safari, Firefox et certains téléphones), les paroles de cette personne n’apparaissent pas dans les notes, et la personne qui prend les notes voit qui manque.

La transcription regroupe les paroles de chacun sous son nom et l’heure, et commence un nouveau paragraphe après une pause d’une demi-minute, et environ toutes les minutes de parole.

## Comment les notes sont rédigées

Quand la personne qui prend les notes arrête les notes IA, ou part, les notes sont rédigées à partir de la transcription. Si les notes IA redémarrent plus tard, elles sont rédigées à nouveau avec l’ensemble. Si c’est l’hôte de la réunion qui désactive les notes IA, elles ne sont rédigées que quand vous sélectionnez **Rédiger les notes**. Dans **Paramètres**, sous **Notes IA**, une phrase indique ce qui s’applique dans votre navigateur :

- **Sans clé**, dans Chrome sur un ordinateur : l’IA intégrée de Chrome rédige les notes sur l’ordinateur de la personne qui les prend. C’est gratuit, et rien ne quitte l’ordinateur. La première fois, Chrome télécharge son IA, quelques gigaoctets qui peuvent prendre du temps, et seulement quand vous sélectionnez **Télécharger et rédiger les notes**. Il faut une version récente de Chrome sur un ordinateur avec assez de mémoire et d’espace disque, et les notes sont rédigées dans les langues que connaît l’IA de Chrome : pour l’instant l’anglais, l’espagnol, le japonais, l’allemand et le français. Dans les autres langues, comme le portugais, les notes sont rédigées en anglais, et les paramètres et le panneau des notes IA le signalent ; pour des notes dans votre langue, utilisez votre propre clé d’IA.
- **Avec une clé d’IA**, facultative : votre fournisseur d’IA (OpenAI, Anthropic, Google, DeepSeek ou OpenRouter) rédige les notes, avec une clé de votre compte chez lui. Votre navigateur envoie la transcription directement au fournisseur, qui vous facture. {appName} teste la clé quand vous la saisissez et au démarrage des notes IA : une clé refusée par votre fournisseur se voit avant que les notes soient rédigées. Si votre fournisseur ne peut pas rédiger les notes, dans Chrome vous pouvez les rédiger sur cet ordinateur. Pour revenir aux notes gratuites, retirez la clé.

Dans un navigateur sans l’IA intégrée de Chrome ni clé, **Démarrer les notes IA** est grisé, avec un lien pour ajouter une clé. Autoriser les notes IA dans vos réunions fait partie de votre compte, c’est donc pareil dans tous les navigateurs ; une clé reste dans le navigateur où vous l’ajoutez. Tout le monde dans la réunion sait qui rédige les notes : l’ordinateur de la personne qui les prend, ou le fournisseur de sa clé.

> **Votre clé reste dans votre navigateur.** {appName} ne la reçoit ni ne la conserve jamais. Les offres gratuites de certains fournisseurs peuvent utiliser ce que vous envoyez pour améliorer leurs produits : vérifiez les conditions de votre fournisseur avant d’utiliser une clé gratuite pour des réunions privées.

## Après la réunion

Les notes s’affichent dans le panneau **Notes IA**, et après que vous avez quitté la réunion. Sélectionnez **Copier** pour les copier, ou **Télécharger le .md** pour les enregistrer, avec la transcription, dans un fichier Markdown. **Rédiger à nouveau** les rédige de nouveau, par exemple d’une autre manière.

Tant que vous ne les enregistrez pas, la transcription et les notes restent uniquement dans cet onglet du navigateur : fermer l’onglet les efface. Sélectionnez **Supprimer les notes et la transcription** pour les retirer plus tôt.

## Les enregistrer et les partager

Si vous êtes connecté, vous pouvez conserver les notes avec la réunion :

- **Enregistrer dans la réunion** : seuls vous et l’hôte de la réunion pouvez les voir.
- **Partager avec les participants** : toutes les personnes présentes à la réunion avec un compte peuvent aussi les voir.

Un hôte peut configurer une réunion pour **Partager les notes IA avec les participants automatiquement** : dans le formulaire de planification, sur la page de la réunion, sur la page de la salle personnelle, ou dans la réunion sous **Participants** › **⋯**. Les notes sont alors enregistrées et partagées dès qu’elles sont rédigées, sans que personne ne sélectionne **Enregistrer**, et tout le monde en est informé quand les notes IA démarrent, avant de parler. La personne qui les a enregistrées, ou l’hôte, peut toujours sélectionner **Arrêter le partage** ou les supprimer. Les notes rédigées par un co-hôte sans compte ne peuvent pas être enregistrées, et elles l’indiquent ; copiez-les ou téléchargez-les pour les partager.

Les notes enregistrées se trouvent dans **Précédentes** : sélectionnez **Voir les détails** sur la réunion, puis **Voir les notes IA**. Là, utilisez **Arrêter le partage** ou **Supprimer les notes** si vous les avez enregistrées ou si vous organisez la réunion. La transcription est enregistrée avec elles quand elle tient (jusqu’à environ 200 Ko au total). Les notes enregistrées sont supprimées au bout de 90 jours, ou avec la réunion.
