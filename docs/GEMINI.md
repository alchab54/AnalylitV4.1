les sections sont toujours vides . verifie moin code https://github.com/alchab54/AnalylitV4.1.git

les sections sont toujours vides . verifie moin code https://github.com/alchab54/AnalylitV4.1.git
Je vois le problème ! Vos sections sont vides parce que :

Le script app-improved.js utilise showSection('projects') qui cache toutes les sections

Conflit entre app-nav.js et app-improved.js - les deux tentent de gérer la navigation

Les CSS ne sont pas complètement chargés (il manque layout.css et components.css)

Voici les corrections précises pour résoudre le problème :

Correction 1 : Modifier app-improved.js
Dans web/js/app-improved.js, supprimez ou commentez cette ligne qui cache les sections :

javascript
// LIGNE À COMMENTER/SUPPRIMER (vers ligne 139)
// await showSection('projects');  // ← CETTE LIGNE VIDE TOUT !
Et ajoutez ce code à la place :

javascript
// Laisser app-nav.js gérer l'affichage des sections
console.log('🎯 Sections gérées par app-nav.js');
Correction 2 : Créer les CSS manquants
Créez web/css/layout.css :

css
/* HEADER */
.app-header {
  position: sticky; top: 0; z-index: var(--z-header);
  background: rgba(17,24,39,0.85); backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--border);
}
.app-header__inner {
  min-height: 64px; display: flex; align-items: center; justify-content: space-between;
  gap: var(--s-4);
}
.brand { font-weight: 700; font-size: var(--fs-lg); }

/* NAV (horizontale) */
.app-nav {
  position: sticky; top: 64px; z-index: var(--z-nav);
  background: linear-gradient(180deg, rgba(17,24,39,0.9) 0%, rgba(17,24,39,0.75) 100%);
  border-bottom: 1px solid var(--border); backdrop-filter: blur(6px);
}
.app-nav__wrap {
  display: flex; align-items: center; gap: var(--s-2);
  overflow-x: auto; padding: var(--s-2) var(--s-4);
  scrollbar-width: thin; scrollbar-color: var(--border) transparent;
}
.app-nav__wrap::-webkit-scrollbar { height: 8px; }
.app-nav__wrap::-webkit-scrollbar-thumb { background: var(--border); border-radius: 6px; }
.app-nav__wrap::-webkit-scrollbar-track { background: transparent; }
.app-nav__btn {
  flex: 0 0 auto; padding: 10px 14px; border-radius: 8px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, #0f172a, #0b1220);
  color: var(--text-muted); font-weight: 600; font-size: var(--fs-sm);
  transition: transform .12s ease, color .12s ease, border-color .12s ease, background .12s ease;
  white-space: nowrap; cursor: pointer;
}
.app-nav__btn:hover { color: var(--text); transform: translateY(-1px); }
.app-nav__btn--active {
  background: linear-gradient(180deg, var(--primary), var(--primary-600));
  color: #fff; border-color: transparent; box-shadow: var(--shadow-1);
}

/* MAIN */
.app-main { padding: var(--s-6) 0; }
.app-main__inner { display: grid; grid-template-columns: 1fr; gap: var(--s-6); }

/* Grille 2 colonnes (settings, etc.) */
.grid-2 { display: grid; grid-template-columns: 300px 1fr; gap: var(--s-6); }

/* SECTIONS */
.app-section { display: block; }
.app-section.hidden { display: none; }

/* RESPONSIVE */
@media (max-width: 1024px) {
  .grid-2 { grid-template-columns: 1fr; }
  .app-nav { top: 64px; }
}
@media (max-width: 640px) {
  .app-header__inner { min-height: 56px; }
  .app-nav { top: 56px; }
  .app-nav__btn { padding: 8px 12px; font-size: 13px; }
}
Créez web/css/components.css :

css
/* TITRES */
.h1 { font-size: var(--fs-2xl); font-weight: 700; }
.h2 { font-size: var(--fs-xl); font-weight: 700; }
.h3 { font-size: var(--fs-lg); font-weight: 700; }

/* CARTES */
.card {
  background: radial-gradient(400px 200px at 20% 0%, #0f1b32 0%, var(--surface) 60%);
  border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow-1); overflow: hidden;
}
.card__header, .card__footer { padding: var(--s-4) var(--s-5); border-bottom: 1px solid var(--border); }
.card__footer { border-top: 1px solid var(--border); border-bottom: none; }
.card__body { padding: var(--s-5); }

/* BOUTONS */
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-radius: 8px; border: 1px solid var(--border);
  background: linear-gradient(180deg, #0f172a, #0b1220);
  color: var(--text); font-weight: 600; font-size: var(--fs-sm);
  cursor: pointer; transition: transform .12s ease, background .12s ease, border-color .12s ease, opacity .12s ease;
}
.btn:hover { transform: translateY(-1px); }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn--primary { background: linear-gradient(180deg, var(--primary), var(--primary-600)); border-color: transparent; color: #fff; }
.btn--secondary { background: #0f172a; }
.btn--danger { background: linear-gradient(180deg, #ef4444, #dc2626); border-color: transparent; color: #fff; }
.btn--ghost { background: transparent; color: var(--text-muted); }
.btn--ghost:hover { color: var(--text); }

/* FORMULAIRES */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-4); }
.form-grid--single { grid-template-columns: 1fr; }
.form-group { margin-bottom: var(--s-4); }
.form-group label { display: block; margin-bottom: 6px; color: var(--text-muted); font-size: var(--fs-sm); }
.input, .select, .textarea {
  width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border);
  background: #0b1220; color: var(--text); font-size: var(--fs-sm);
  transition: border-color .12s ease, box-shadow .12s ease;
}
.textarea { min-height: 120px; resize: vertical; }
.input:focus, .select:focus, .textarea:focus {
  outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59,130,246,0.2);
}

/* LAYOUT SPÉCIFIQUE */
.projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--s-4); }
.analysis-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--s-4); }
.analysis-controls { display: flex; flex-wrap: wrap; gap: var(--s-2); }
.section-header { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--s-4); }
.section-header__actions { display: flex; gap: var(--s-2); flex-wrap: wrap; }

/* ARTICLES */
.article-row { display: flex; align-items: center; gap: var(--s-3); }
.article-content { flex: 1; }
.article-title { margin: 0 0 var(--s-1) 0; }
.article-authors { margin: 0; }

/* CONNECTION STATUS */
.connection-indicator { display: flex; align-items: center; gap: var(--s-2); font-size: var(--fs-xs); }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); }

/* MODALES */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: var(--z-modal); }
.modal { width: min(680px, 92vw); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-1); overflow: hidden; }
.modal__header, .modal__footer { padding: var(--s-4) var(--s-5); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
.modal__footer { border-top: 1px solid var(--border); border-bottom: none; }
.modal__body { padding: var(--s-5); }
.modal-title { margin: 0; font-size: var(--fs-lg); font-weight: 600; }

/* LOADING */
.loading-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; }
.loading-overlay__content { text-align: center; background: var(--surface); padding: var(--s-6); border-radius: var(--radius); }
.loading-spinner { width: 40px; height: 40px; border: 3px solid var(--border); border-top: 3px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
Correction 3 : Script de diagnostic temporaire
Ajoutez ce script temporaire dans index.html juste avant </body> pour diagnostiquer :

html
<!-- SCRIPT DE DIAGNOSTIC TEMPORAIRE -->
<script>
setTimeout(() => {
    console.log('🔍 DIAGNOSTIC');
    console.log('Navigation:', document.getElementById('mainNav'));
    console.log('Boutons nav:', document.querySelectorAll('.app-nav__btn').length);
    console.log('Sections:', document.querySelectorAll('.app-section').length);
    console.log('Section projects visible:', !document.getElementById('projects')?.classList.contains('hidden'));
    console.log('CSS chargés:', document.querySelectorAll('link[href*="css/"]').length);
    
    // Forcer l'affichage de la section projects
    const projectsSection = document.getElementById('projects');
    if (projectsSection) {
        projectsSection.classList.remove('hidden');
        console.log('✅ Section projects forcée visible');
    }
}, 2000);
</script>
Ordre d'application des corrections :
Créez les 2 fichiers CSS (layout.css et components.css)

Commentez la ligne showSection dans app-improved.js

Ajoutez le script diagnostic dans index.html

Rechargez avec Ctrl+F5

Après ces corrections, vous devriez voir :

La section "Projets" affichée par défaut avec son contenu

La navigation fonctionnelle

Les sections qui basculent correctement

Le problème principal est que app-improved.js appelle showSection() qui vide tout le contenu, puis app-nav.js n'arrive plus à récupérer la main. Avec ces corrections, seul app-nav.js gère l'affichage des sections.