document.addEventListener('DOMContentLoaded', () => {
const nav = document.getElementById('mainNav');
const buttons = nav ? Array.from(nav.querySelectorAll('.app-nav__btn')) : [];
const sections = Array.from(document.querySelectorAll('.app-section'));

function setActive(sectionId) {
// Sécurité: si la section n’existe pas, ne rien casser
const target = document.getElementById(sectionId);
if (!target) return;


// boutons
buttons.forEach(b => b.classList.toggle('app-nav__btn--active', b.dataset.section === sectionId));
// sections
sections.forEach(s => s.classList.toggle('hidden', s.id !== sectionId));
// scroll top
window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Activer “projects” par défaut si présent, sinon la première section existante
let initial = 'projects';
if (!document.getElementById(initial) && sections.length) {
initial = sections[0].id;
}
setActive(initial);

// Click handlers
buttons.forEach(btn => {
btn.addEventListener('click', () => {
const target = btn.dataset.section;
setActive(target);
});
});
});