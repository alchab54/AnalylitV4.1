document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('mainNav');
  const buttons = nav ? Array.from(nav.querySelectorAll('.app-nav__btn')) : [];
  const sections = Array.from(document.querySelectorAll('.app-section'));

  function setActive(sectionId) {
    // boutons
    buttons.forEach(b => b.classList.toggle('app-nav__btn--active', b.dataset.section === sectionId));
    // sections
    sections.forEach(s => s.classList.toggle('hidden', s.id !== sectionId));
    // scroll au top doux
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Détection: activer la première section existante si aucune active
  let initial = 'projects';
  const hasSection = sections.some(s => s.id === initial);
  if (!hasSection && sections.length) {
    initial = sections[0].id;
  }
  setActive(initial);

  // Écouteurs
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      if (!target) return;
      // Si la section n’existe pas encore (rendue plus tard), on attend et on réessaye
      if (!document.getElementById(target)) {
        setTimeout(() => setActive(target), 50);
      } else {
        setActive(target);
      }
    });
  });
});