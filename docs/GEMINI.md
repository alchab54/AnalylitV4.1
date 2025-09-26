aide moi aàresoudre mes problemes  de frontendr  elevé por les tests cypress 


PS C:\Users\alich\Downloads\exported-assets (1)> npm run test:all

> analylit-frontend-tests@1.0.0 test:all
> npm run test:unit && npm run test:e2e


> analylit-frontend-tests@1.0.0 test:unit
> jest --config jest.config.cjs --coverage --verbose

  console.log
    🔗 API Request: GET /api/test-endpoint

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/api.js:19:13)

  console.log
    🔗 API Request: GET /api/projects/123/results

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/api.js:19:13)

  console.log
    🔗 API Request: GET /api/error-endpoint

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/api.js:19:13)

  console.error
    ❌ API Error for /api/error-endpoint: Error: Erreur interne du serveur
        at fetchAPI (C:\Users\alich\Downloads\exported-assets (1)\web\js\api.js:32:19)
        at processTicksAndRejections (node:internal/process/task_queues:105:5)
        at Object.<anonymous> (C:\Users\alich\Downloads\exported-assets (1)\web\js\api.test.js:66:5)

      43 |
      44 |     } catch (error) {
    > 45 |         console.error(`❌ API Error for ${url}:`, error);
         |                 ^
      46 |         throw error;
      47 |     }
      48 | }

      at error (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/api.js:45:17)
      at Object.<anonymous> (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/api.test.js:66:5)

  console.log
    🔗 API Request: GET /api/network-fail

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/api.js:19:13)

  console.error
    ❌ API Error for /api/network-fail: TypeError: Failed to fetch
        at Object.<anonymous> (C:\Users\alich\Downloads\exported-assets (1)\web\js\api.test.js:72:36)
        at Promise.then.completed (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-circus\build\utils.js:298:28)
        at new Promise (<anonymous>)
        at callAsyncCircusFn (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-circus\build\utils.js:231:10)
        at _callCircusTest (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-circus\build\run.js:316:40)
        at processTicksAndRejections (node:internal/process/task_queues:105:5)
        at _runTest (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-circus\build\run.js:252:3)
        at _runTestsForDescribeBlock (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-circus\build\run.js:126:9)
        at _runTestsForDescribeBlock (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-circus\build\run.js:121:9)
        at run (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-circus\build\run.js:71:3)
        at runAndTransformResultsToJestFormat (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapterInit.js:122:21)
        at jestAdapter (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-circus\build\legacy-code-todo-rewrite\jestAdapter.js:79:19)
        at runTestInternal (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-runner\build\runTest.js:367:16)
        at runTest (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-runner\build\runTest.js:444:34)
        at Object.worker (C:\Users\alich\Downloads\exported-assets (1)\node_modules\jest-runner\build\testWorker.js:106:12)

      43 |
      44 |     } catch (error) {
    > 45 |         console.error(`❌ API Error for ${url}:`, error);
         |                 ^
      46 |         throw error;
      47 |     }
      48 | }

      at error (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/api.js:45:17)
      at Object.<anonymous> (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/api.test.js:74:5)

 PASS  web/js/api.test.js
  fetchAPI Utility
    √ devrait gérer une réponse 200 OK avec JSON valide (44 ms)
    √ devrait retourner un tableau vide pour une réponse vide sur un endpoint de collection (2 ms)
    √ devrait gérer une erreur API (ex: 500) avec un message JSON (16 ms)
    √ devrait gérer un échec réseau (fetch lui-même échoue) (5 ms)

 PASS  web/js/constants.test.js
  Module Constants - Configuration centralisée
    SELECTORS
      √ devrait contenir tous les sélecteurs DOM essentiels (11 ms)
    API_ENDPOINTS
      √ devrait contenir tous les endpoints API essentiels (1 ms)
      √ les fonctions d'endpoints dynamiques devraient fonctionner (1 ms)
    MESSAGES
      √ devrait contenir tous les messages utilisateur essentiels (1 ms)
      √ les fonctions de messages dynamiques devraient fonctionner (1 ms)

  console.log
    🎯 showToast() appelé: Message de test info

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:165:13)

  console.log
    🧹 Suppression toasts existants: 0

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:169:13)

  console.log
    📝 Création toast avec classe: toast toast--info toast--show

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:177:13)

  console.log
    ✅ Toast ajouté au DOM: HTMLDivElement {}

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:187:13)

  console.log
    ✅ Styles appliqués au toast

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:204:13)

  console.log
    🎯 showToast() appelé: Opération réussie success

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:165:13)

  console.log
    🧹 Suppression toasts existants: 0

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:169:13)

  console.log
    📝 Création toast avec classe: toast toast--success toast--show

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:177:13)

  console.log
    ✅ Toast ajouté au DOM: HTMLDivElement {}

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:187:13)

  console.log
    ✅ Styles appliqués au toast

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:204:13)

  console.log
    🎯 showToast() appelé: Erreur survenue error

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:165:13)

  console.log
    🧹 Suppression toasts existants: 0

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:169:13)

  console.log
    📝 Création toast avec classe: toast toast--error toast--show

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:177:13)

  console.log
    ✅ Toast ajouté au DOM: HTMLDivElement {}

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:187:13)

  console.log
    ✅ Styles appliqués au toast

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:204:13)

  console.log
    🎯 showToast() appelé: Message temporaire info

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:165:13)

  console.log
    🧹 Suppression toasts existants: 0

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:169:13)

  console.log
    📝 Création toast avec classe: toast toast--info toast--show

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:177:13)

  console.log
    ✅ Toast ajouté au DOM: HTMLDivElement {}

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:187:13)

  console.log
    ✅ Styles appliqués au toast

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:204:13)

  console.log
    🎯 showToast() appelé: Succès ! success

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:165:13)

  console.log
    🧹 Suppression toasts existants: 0

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:169:13)

  console.log
    📝 Création toast avec classe: toast toast--success toast--show

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:177:13)

  console.log
    ✅ Toast ajouté au DOM: HTMLDivElement {}

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:187:13)

  console.log
    ✅ Styles appliqués au toast

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:204:13)

  console.log
    🎯 showToast() appelé: Erreur ! error

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:165:13)

  console.log
    🧹 Suppression toasts existants: 0

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:169:13)

  console.log
    📝 Création toast avec classe: toast toast--error toast--show

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:177:13)

  console.log
    ✅ Toast ajouté au DOM: HTMLDivElement {}

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:187:13)

  console.log
    ✅ Styles appliqués au toast

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/ui-improved.js:204:13)

 PASS  web/js/toast.test.js
  Module Toast - Notifications
    showToast()
      √ devrait créer et afficher un toast avec message simple (82 ms)
      √ devrait afficher un toast de succès avec la bonne classe CSS (16 ms)
      √ devrait afficher un toast d'erreur avec la bonne classe CSS (9 ms)
      √ devrait supprimer le toast après le délai spécifié (9 ms)
    Fonctions de raccourci
      √ showSuccess() devrait créer un toast de succès (8 ms)
      √ showError() devrait créer un toast d'erreur (7 ms)

  console.log
    🔍 Interface de debug disponible: window.AnalyLitState

      at Object.log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/state.js:877:13)

  console.log
    Job ID: task-abc

      at log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/import.js:137:13)

 PASS  web/js/projects.test.js
  Module Projects
    √ devrait charger le module sans erreur (8 ms)

 PASS  web/js/import.test.js
  Fonctions d'importation
    handleIndexPdfs
      √ devrait appeler showLoadingOverlay et updateLoadingProgress au démarrage (45 ms)

  console.log
    🔍 Interface de debug disponible: window.AnalyLitState

      at Object.log (C:\Users\alich\Downloads\exported-assets (1)../../../../web/js/state.js:877:13)

 PASS  web/js/articles.test.js
  Module Articles
    √ devrait charger le module sans erreur (9 ms)

-----------------------|---------|----------|---------|---------|-------------------------------------------------------
File                   | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------------|---------|----------|---------|---------|-------------------------------------------------------
All files              |    2.35 |     1.23 |    1.71 |    2.54 |
 js                    |    2.35 |     1.23 |    1.71 |    2.54 |
  admin-dashboard.js   |       0 |        0 |       0 |       0 | 5-168
  analyses.js          |       0 |        0 |       0 |       0 | 9-576
  api-client.js        |       0 |        0 |       0 |       0 | 2-21
  api.js               |   86.36 |       75 |     100 |   86.36 | 16,30,40
  app-improved.js      |       0 |        0 |       0 |       0 | 11-212
  app-nav.js           |       0 |        0 |       0 |       0 | 1-44
  articles.js          |    1.09 |        0 |       0 |    1.19 | 11-437,443-452,459-481
  atn-analyzer.js      |       0 |        0 |       0 |       0 | 8-662
  chat.js              |       0 |        0 |       0 |       0 | 9-189
  config.js            |       0 |      100 |     100 |       0 | 4
  constants.js         |   16.94 |        0 |    9.25 |   16.94 | 58,60,65-77,79-95,109-200,206-317
  core.js              |       0 |        0 |       0 |       0 | 76-477
  grids.js             |       0 |        0 |       0 |       0 | 12-235
  import.js            |    8.65 |      2.5 |    6.66 |    9.09 | 10-122,141-249
  layout-optimizer.js  |       0 |        0 |       0 |       0 | 11-462
  navigation-fix.js    |       0 |        0 |       0 |       0 | 2-178
  navigation-simple.js |       0 |        0 |       0 |       0 | 3-88
  notifications.js     |       0 |        0 |       0 |       0 | 7-28
  projects.js          |       0 |        0 |       0 |       0 | 18-424
  reporting.js         |       0 |        0 |       0 |       0 | 8-526
  rob-manager.js       |       0 |        0 |       0 |       0 | 8-529
  rob.js               |       0 |        0 |       0 |       0 | 7-191
  screening.js         |       0 |        0 |       0 |       0 | 13-65
  search.js            |       0 |        0 |       0 |       0 | 8-180
  selection.js         |       0 |        0 |       0 |       0 | 3-31
  settings.js          |       0 |        0 |       0 |       0 | 10-1162
  stakeholders.js      |       0 |        0 |       0 |       0 | 9-329
  state.js             |    4.52 |     1.78 |    1.66 |    4.63 | 81-197,207-573,595-810,872-874
  sw.js                |       0 |        0 |       0 |       0 | 1-43
  tasks.js             |       0 |        0 |       0 |       0 | 12-83
  theme-manager.js     |       0 |        0 |       0 |       0 | 5-105
  thesis-helpers.js    |       0 |        0 |       0 |       0 | 8-71
  thesis-workflow.js   |       0 |        0 |       0 |       0 | 8-628
  ui-improved.js       |   11.74 |     3.68 |   11.47 |   12.53 | ...36,225-258,275-293,320-396,408-636,646-718,731-855
  utils.js             |       0 |        0 |       0 |       0 | 14-431
  validation.js        |       0 |        0 |       0 |       0 | 11-254
 js/tests              |       0 |      100 |     100 |       0 |
  jest.setup.js        |       0 |      100 |     100 |       0 | 1-6
-----------------------|---------|----------|---------|---------|-------------------------------------------------------
Test Suites: 6 passed, 6 total
Tests:       18 passed, 18 total
Snapshots:   0 total
Time:        6.89 s
Ran all test suites.

> analylit-frontend-tests@1.0.0 test:e2e
> cypress run --headless



DevTools listening on ws://127.0.0.1:61388/devtools/browser/519ed638-d54b-4a7a-a9d1-1008a560cf07

====================================================================================================

  (Run Starting)

  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Cypress:        13.10.0                                                                        │
  │ Browser:        Electron 118 (headless)                                                        │
  │ Node Version:   v22.17.0 (C:\Program Files\nodejs\node.exe)                                    │
  │ Specs:          6 found (01-smoke-test.cy.js, 02-projects-workflow.cy.js, 03-articles-workflow │
  │                 .cy.js, 04-analyses-workflow.cy.js, atn-specialized.cy.js, thesis-workflow.cy. │
  │                 js)                                                                            │
  │ Searched:       cypress/e2e/**/*.cy.{js,jsx,ts,tsx}                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────────┘


────────────────────────────────────────────────────────────────────────────────────────────────────

  Running:  01-smoke-test.cy.js                                                             (1 of 6)


  Tests de Smoke - Vérifications de base AnalyLit
    √ Devrait charger la page principale sans erreur JavaScript (739ms)
    √ Devrait afficher la section des projets par défaut (213ms)
    √ Devrait vérifier la connexion WebSocket (299ms)


  3 passing (1s)


  (Results)

  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Tests:        3                                                                                │
  │ Passing:      3                                                                                │
  │ Failing:      0                                                                                │
  │ Pending:      0                                                                                │
  │ Skipped:      0                                                                                │
  │ Screenshots:  0                                                                                │
  │ Video:        true                                                                             │
  │ Duration:     1 second                                                                         │
  │ Spec Ran:     01-smoke-test.cy.js                                                              │
  └────────────────────────────────────────────────────────────────────────────────────────────────┘


  (Video)

  -  Video output: C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\videos\01-smoke-test.cy.js.mp4


────────────────────────────────────────────────────────────────────────────────────────────────────

  Running:  02-projects-workflow.cy.js                                                      (2 of 6)


  Workflow de Gestion des Projets
    √ Devrait ouvrir et fermer la modale de création de projet (1315ms)
    √ Devrait créer un nouveau projet avec succès (1329ms)
    (Attempt 1 of 3) Devrait afficher les détails d'un projet sélectionné
    (Attempt 2 of 3) Devrait afficher les détails d'un projet sélectionné
    1) Devrait afficher les détails d'un projet sélectionné
    (Attempt 1 of 3) Devrait permettre la suppression d'un projet
    (Attempt 2 of 3) Devrait permettre la suppression d'un projet
    2) Devrait permettre la suppression d'un projet


  2 passing (1m)
  2 failing

  1) Workflow de Gestion des Projets
       Devrait afficher les détails d'un projet sélectionné:
     AssertionError: Timed out retrying after 8000ms: Expected to find element: `.metrics-grid`, but never found it.
      at Context.eval (webpack://analylit-frontend-tests/./cypress/e2e/02-projects-workflow.cy.js:39:28)

  2) Workflow de Gestion des Projets
       Devrait permettre la suppression d'un projet:
     AssertionError: Timed out retrying after 8000ms: expected confirmStub to have been called exactly once, but it was never called
      at Context.eval (webpack://analylit-frontend-tests/./cypress/e2e/02-projects-workflow.cy.js:70:27)




  (Results)

  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Tests:        4                                                                                │
  │ Passing:      2                                                                                │
  │ Failing:      2                                                                                │
  │ Pending:      0                                                                                │
  │ Skipped:      0                                                                                │
  │ Screenshots:  6                                                                                │
  │ Video:        true                                                                             │
  │ Duration:     1 minute, 6 seconds                                                              │
  │ Spec Ran:     02-projects-workflow.cy.js                                                       │
  └────────────────────────────────────────────────────────────────────────────────────────────────┘


  (Screenshots)

  -  C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\screenshots\02-proj     (1280x720)
     ects-workflow.cy.js\Workflow de Gestion des Projets -- Devrait afficher les déta
     ils d'un projet sélectionné (failed).png
  -  C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\screenshots\02-proj     (1280x720)
     ects-workflow.cy.js\Workflow de Gestion des Projets -- Devrait afficher les déta
     ils d'un projet sélectionné (failed) (attempt 2).png
  -  C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\screenshots\02-proj     (1280x720)
     ects-workflow.cy.js\Workflow de Gestion des Projets -- Devrait afficher les déta
     ils d'un projet sélectionné (failed) (attempt 3).png
  -  C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\screenshots\02-proj     (1280x720)
     ects-workflow.cy.js\Workflow de Gestion des Projets -- Devrait permettre la supp
     ression d'un projet (failed).png
  -  C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\screenshots\02-proj     (1280x720)
     ects-workflow.cy.js\Workflow de Gestion des Projets -- Devrait permettre la supp
     ression d'un projet (failed) (attempt 2).png
  -  C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\screenshots\02-proj     (1280x720)
     ects-workflow.cy.js\Workflow de Gestion des Projets -- Devrait permettre la supp
     ression d'un projet (failed) (attempt 3).png


  (Video)

  -  Video output: C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\videos\02-projects-workflow.cy.js.mp4


────────────────────────────────────────────────────────────────────────────────────────────────────

  Running:  03-articles-workflow.cy.js                                                      (3 of 6)


  Workflow de Gestion des Articles
    √ Devrait afficher la liste des articles du projet sélectionné (2485ms)
    √ Devrait permettre la sélection multiple d'articles (2026ms)
    √ Devrait ouvrir les détails d'un article (2075ms)
    (Attempt 1 of 3) Devrait permettre le screening par lot
    (Attempt 2 of 3) Devrait permettre le screening par lot
    1) Devrait permettre le screening par lot
    √ Devrait gérer l'état vide quand aucun article n'est présent (2069ms)


  4 passing (41s)
  1 failing

  1) Workflow de Gestion des Articles
       Devrait permettre le screening par lot:
     AssertionError: Timed out retrying after 8000ms: expected '<button.btn.btn--primary>' not to be 'disabled'
      at Context.eval (webpack://analylit-frontend-tests/./cypress/e2e/03-articles-workflow.cy.js:38:50)




  (Results)

  ┌────────────────────────────────────────────────────────────────────────────────────────────────┐
  │ Tests:        5                                                                                │
  │ Passing:      4                                                                                │
  │ Failing:      1                                                                                │
  │ Pending:      0                                                                                │
  │ Skipped:      0                                                                                │
  │ Screenshots:  3                                                                                │
  │ Video:        true                                                                             │
  │ Duration:     41 seconds                                                                       │
  │ Spec Ran:     03-articles-workflow.cy.js                                                       │
  └────────────────────────────────────────────────────────────────────────────────────────────────┘


  (Screenshots)

  -  C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\screenshots\03-arti     (1280x720)
     cles-workflow.cy.js\Workflow de Gestion des Articles -- Devrait permettre le scr
     eening par lot (failed).png
  -  C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\screenshots\03-arti     (1280x720)
     cles-workflow.cy.js\Workflow de Gestion des Articles -- Devrait permettre le scr
     eening par lot (failed) (attempt 2).png
  -  C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\screenshots\03-arti     (1280x720)
     cles-workflow.cy.js\Workflow de Gestion des Articles -- Devrait permettre le scr
     eening par lot (failed) (attempt 3).png


  (Video)

  -  Video output: C:\Users\alich\Downloads\exported-assets (1)\reports\cypress\videos\03-articles-workflow.cy.js.mp4

