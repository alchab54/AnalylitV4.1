document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('mainNav');
  const buttons = nav?.querySelectorAll('.app-nav__btn') || [];
  const sections = document.querySelectorAll('.app-section');
  // Activer Projets par défaut
  function setActive(sectionId) {
    // boutons
    buttons.forEach(b => {
      b.classList.toggle('app-nav__btn--active', b.dataset.section === sectionId);
    });
    // sections
    sections.forEach(s => {
      s.classList.toggle('hidden', s.id !== sectionId);
    });
  }
  // Défaut: première section existante
  const defaultSection = buttons[0]?.dataset.section || sections[0]?.id;
  if (defaultSection) setActive(defaultSection);
  // Click handlers
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      if (target) setActive(target);
    });
  });
});