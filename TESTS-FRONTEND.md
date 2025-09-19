# Guide de Tests Frontend pour AnalyLit V4.1

Ce document décrit les étapes pour valider le bon fonctionnement du frontend d'AnalyLit V4.1 après les récentes modifications.

## Prérequis

- Assurez-vous que le backend est en cours d'exécution et accessible (par exemple, via `docker-compose up`).
- Ouvrez l'application frontend dans un navigateur web (généralement `http://localhost:8080`).
- Ouvrez la console développeur de votre navigateur (F12) et assurez-vous qu'il n'y a pas d'erreurs dans l'onglet "Console".

## Checklist de Validation

Procédez aux tests suivants pour chaque section de l'application :

### 1. Chargement Initial et Navigation

- [ ] **Chargement sans erreurs :** À l'ouverture de l'application, vérifiez que la console du navigateur ne contient aucune erreur JavaScript.
- [ ] **Statut de connexion WebSocket :** Vérifiez que l'indicateur de connexion (en haut à droite) affiche un statut "Connecté" ou similaire.
- [ ] **Navigation principale :**
    - [ ] Cliquez sur chaque bouton de la barre de navigation latérale (Projets, Recherche, Résultats, Validation, Grilles, Risque de Biais, Analyses, Import & Fichiers, Chat, Paramètres, Tâches, Rapports).
    - [] Assurez-vous que la section correspondante s'affiche correctement et que le contenu est chargé (ou les placeholders si aucun projet n'est sélectionné).
    - [ ] Vérifiez que le bouton de navigation actif change correctement.

### 2. Section Projets

- [ ] **Création de projet :**
    - [ ] Cliquez sur "Nouveau projet".
    - [ ] Remplissez le formulaire avec un nom et une description.
    - [ ] Sélectionnez un mode d'analyse.
    - [ ] Cliquez sur "Créer".
    - [ ] Vérifiez que le nouveau projet apparaît dans la liste et qu'un message de succès s'affiche.
- [ ] **Sélection de projet :**
    - [ ] Cliquez sur un projet existant dans la liste.
    - [ ] Vérifiez que les détails du projet s'affichent dans le panneau de droite.
    - [ ] Assurez-vous que le projet sélectionné est mis en évidence dans la liste.
- [ ] **Suppression de projet :**
    - [ ] Cliquez sur "Supprimer" pour un projet.
    - [ ] Confirmez la suppression dans la modale.
    - [ ] Vérifiez que le projet disparaît de la liste et qu'un message de succès s'affiche.

### 3. Section Recherche

- [ ] **Lancement de recherche simple :**
    - [ ] Sélectionnez un projet.
    - [ ] Saisissez une requête de recherche (ex: "therapeutic alliance").
    - [ ] Sélectionnez une ou plusieurs bases de données.
    - [ ] Cliquez sur "Lancer la recherche".
    - [ ] Vérifiez qu'un message de lancement s'affiche et que l'overlay de chargement apparaît.
    - [ ] (Optionnel) Vérifiez dans la console backend que la tâche de recherche est bien lancée.
- [ ] **Lancement de recherche experte :**
    - [ ] Activez le mode "Recherche Experte".
    - [ ] Saisissez des requêtes spécifiques pour chaque base sélectionnée.
    - [ ] Cliquez sur "Lancer la recherche".
    - [ ] Vérifiez le message de lancement et l'overlay.

### 4. Section Résultats

- [ ] **Affichage des résultats :**
    - [ ] Après une recherche, naviguez vers la section "Résultats".
    - [ ] Vérifiez que les articles trouvés s'affichent dans le tableau.
- [ ] **Sélection d'articles :**
    - [ ] Cochez/décochez des articles individuellement.
    - [ ] Utilisez le bouton "Tout sélectionner" / "Tout désélectionner".
    - [ ] Vérifiez que le compteur d'articles sélectionnés se met à jour.
- [ ] **Détails d'article :**
    - [ ] Cliquez sur le bouton "Détails" pour un article.
    - [ ] Vérifiez que la modale affiche les informations complètes de l'article.
- [ ] **Traitement par lot (Screening) :**
    - [ ] Sélectionnez quelques articles.
    - [ ] Cliquez sur "Traiter la sélection".
    - [ ] Choisissez un profil d'analyse et lancez le traitement.
    - [ ] Vérifiez qu'un message de lancement s'affiche et que l'overlay apparaît.

### 5. Section Validation

- [ ] **Décision d'inclusion/exclusion :**
    - [ ] Pour chaque article en attente, cliquez sur "Inclure" ou "Exclure".
    - [ ] Vérifiez que le statut de l'article se met à jour et que les compteurs (Inclus/Exclus/En attente) sont corrects.
- [ ] **Réinitialisation :**
    - [ ] Cliquez sur "Réinitialiser" pour un article validé.
    - [ ] Vérifiez que son statut redevient "En attente".
- [ ] **Filtrage :**
    - [ ] Utilisez les boutons de filtre ("Tous", "Inclus", "Exclus", "En attente").
    - [ ] Vérifiez que la liste des articles se filtre correctement.
- [ ] **Lancement d'extraction :**
    - [ ] Incluez au moins un article.
    - [ ] Cliquez sur "Lancer l'extraction".
    - [ ] Sélectionnez une grille et lancez l'extraction.
    - [ ] Vérifiez le message de lancement et l'overlay.

### 6. Section Grilles

- [ ] **Création de grille :**
    - [ ] Cliquez sur "Nouvelle Grille".
    - [ ] Remplissez le nom, la description et ajoutez des champs.
    - [ ] Sauvegardez la grille.
    - [ ] Vérifiez qu'elle apparaît dans la liste.
- [ ] **Modification de grille :**
    - [ ] Cliquez sur "Éditer" pour une grille existante.
    - [ ] Modifiez des informations ou des champs.
    - [ ] Sauvegardez et vérifiez les changements.
- [ ] **Import de grille :**
    - [ ] Cliquez sur "Importer".
    - [ ] Sélectionnez un fichier JSON de grille valide.
    - [ ] Vérifiez que la grille importée apparaît.

### 7. Section Risque de Biais (RoB)

- [ ] **Lancement de l'analyse RoB :**
    - [ ] Sélectionnez des articles dans la section "Résultats".
    - [ ] Naviguez vers la section "Risque de Biais".
    - [ ] Cliquez sur "Lancer l'analyse RoB sur la sélection".
    - [ ] Vérifiez le message de lancement.
- [ ] **Édition et sauvegarde :**
    - [ ] Cliquez sur "Éditer" pour un article.
    - [ ] Remplissez les domaines de biais et les justifications.
    - [ ] Sauvegardez et vérifiez que les données sont conservées.

### 8. Section Analyses

- [ ] **Lancement des analyses :**
    - [ ] Cliquez sur "Nouvelle analyse".
    - [ ] Lancez chaque type d'analyse disponible (Brouillon de Discussion, Graphe de Connaissances, Diagramme PRISMA, Méta-analyse, Statistiques descriptives).
    - [ ] Vérifiez le message de lancement et l'overlay.
- [ ] **Affichage des résultats :**
    - [ ] Après le traitement, vérifiez que les résultats de chaque analyse s'affichent correctement dans la section.

### 9. Section Import & Fichiers

- [ ] **Import Zotero (JSON) :**
    - [ ] Cliquez sur "Choisir un fichier JSON".
    - [ ] Sélectionnez un fichier d'export Zotero valide.
    - [ ] Vérifiez le message de succès et que les articles sont importés (visibles dans "Résultats").
- [ ] **Upload PDFs :**
    - [ ] Cliquez sur "Sélectionner PDFs".
    - [ ] Sélectionnez un ou plusieurs fichiers PDF.
    - [ ] Vérifiez le message de succès.
- [ ] **Import manuel PMID/DOI :**
    - [ ] Cliquez sur "Import manuel PMID/DOI".
    - [ ] Saisissez des identifiants (PMID, DOI, arXiv ID).
    - [ ] Vérifiez le message de succès et l'importation des articles.

### 10. Section Chat

- [ ] **Envoi de message :**
    - [ ] Saisissez une question dans le champ de texte.
    - [ ] Cliquez sur "Envoyer".
    - [ ] Vérifiez que votre message apparaît dans l'historique.
    - [ ] (Optionnel) Si l'indexation PDF est fonctionnelle, vérifiez que l'IA répond.

### 11. Section Paramètres

- [ ] **Gestion des profils d'analyse :**
    - [ ] Créez, modifiez et supprimez des profils.
    - [ ] Vérifiez que les changements sont persistants.
- [ ] **Gestion des prompts :**
    - [ ] Modifiez les prompts système et utilisateur pour différents types.
    - [ ] Sauvegardez et vérifiez les changements.
- [ ] **Statut des files d'attente :**
    - [ ] Vérifiez que le statut des files d'attente s'affiche.
    - [ ] Cliquez sur "Rafraîchir" et vérifiez la mise à jour.
    - [ ] (Optionnel) Videz une file d'attente et vérifiez qu'elle se vide.

### 12. Section Tâches

- [ ] **Affichage des tâches :**
    - [ ] Vérifiez que les tâches en arrière-plan s'affichent avec leur statut.
    - [ ] Lancez une opération longue (ex: recherche) et vérifiez qu'une nouvelle tâche apparaît.
- [ ] **Rafraîchissement automatique :**
    - [ ] Laissez la section ouverte et vérifiez que les statuts se mettent à jour automatiquement.

### 13. Section Rapports

- [ ] **Génération de bibliographie :**
    - [ ] Sélectionnez un style.
    - [ ] Cliquez sur "Générer Bibliographie".
    - [ ] Vérifiez que la bibliographie s'affiche.
- [ ] **Génération de tableau de synthèse :**
    - [ ] Cliquez sur "Générer Tableau".
    - [ ] Vérifiez que le tableau s'affiche.
- [ ] **Export Excel :**
    - [ ] Cliquez sur "Exporter en Excel".
    - [ ] Vérifiez que le fichier Excel est téléchargé.

## Rapport de Bug

Si vous rencontrez des problèmes, veuillez noter :
- La section concernée.
- Les étapes pour reproduire le bug.
- Le comportement attendu.
- Le comportement observé (avec captures d'écran si possible).
- Les messages d'erreur dans la console du navigateur.

