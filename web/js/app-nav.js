document.addEventListener('DOMContentLoaded', () => {
  // On attend que le state soit disponible via l'interface de debug
  // C'est une façon de s'assurer que app-improved.js a fini son initialisation.
  const checkStateReady = setInterval(() => {
    if (window.AnalyLitState && typeof window.AnalyLitState.setCurrentSection === 'function') {
      clearInterval(checkStateReady);
      initializeNavigation(window.AnalyLitState.setCurrentSection);
    }
  }, 100);

  function initializeNavigation(setCurrentSection) {
    const nav = document.getElementById('mainNav');
    const buttons = nav ? Array.from(nav.querySelectorAll('.app-nav__btn')) : [];
    const sections = Array.from(document.querySelectorAll('.app-section'));

    function setActive(sectionId, isInitialLoad = false) {
      const target = document.getElementById(sectionId);
      if (!target) return;

      // Mettre à jour les classes CSS
      buttons.forEach(b => b.classList.toggle('app-nav__btn--active', b.dataset.section === sectionId));
      sections.forEach(s => s.classList.toggle('hidden', s.id !== sectionId));

      // Si ce n'est pas le chargement initial, on déclenche le rendu du contenu
      if (!isInitialLoad) {
        setCurrentSection(sectionId);
      }

      // Scroll au top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Activer "projects" par défaut au chargement de la page, sans déclencher de rendu supplémentaire
    let initial = 'projects';
    if (!document.getElementById(initial) && sections.length) {
      initial = sections[0].id;
    }
    setActive(initial, true); // true pour indiquer que c'est le chargement initial

    // Gérer les clics sur les boutons de navigation
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetSectionId = btn.dataset.section;
        setActive(targetSectionId);
      });
    });
  }
});