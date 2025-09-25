// Navigation simple et robuste pour AnalyLit v4.1

document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Navigation simple initialisée');
    
    // Gestion de la navigation
    document.addEventListener('click', function(event) {
        const button = event.target.closest('[data-action="show-section"]');
        if (button) {
            const sectionId = button.getAttribute('data-section-id');
            showSection(sectionId);
            updateActiveButton(button);
        }
        
        // Gestion modale création projet
        if (event.target.matches('[data-action="create-project-modal"]')) {
            showModal('newProjectModal');
        }
        
        // Fermeture modales
        if (event.target.matches('[data-action="close-modal"]')) {
            closeAllModals();
        }
    });
    
    function showSection(sectionId) {
        console.log('📍 Affichage section:', sectionId);
        
        // Cacher toutes les sections
        document.querySelectorAll('.app-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        // Afficher la section demandée
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            targetSection.classList.add('active');
            console.log('✅ Section affichée:', sectionId);
        } else {
            console.error('❌ Section non trouvée:', sectionId);
        }
    }
    
    function updateActiveButton(activeButton) {
        // Retirer active de tous les boutons
        document.querySelectorAll('.app-nav__button').forEach(btn => {
            btn.classList.remove('app-nav__button--active');
        });
        
        // Ajouter active au bouton cliqué
        activeButton.classList.add('app-nav__button--active');
    }
    
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('modal--show');
            modal.style.display = 'flex';
            console.log('✅ Modale affichée:', modalId);
        }
    }
    
    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('modal--show');
            modal.style.display = 'none';
        });
        console.log('✅ Modales fermées');
    }
    
    // Afficher la section projets par défaut
    setTimeout(() => {
        showSection('projects');
        const projectsButton = document.querySelector('[data-section-id="projects"]');
        if (projectsButton) {
            updateActiveButton(projectsButton);
        }
        console.log('🏠 Section projets activée par défaut');
    }, 100);
    
    // Diagnostic
    setTimeout(() => {
        console.log('🔍 DIAGNOSTIC NAVIGATION:');
        console.log('Boutons trouvés:', document.querySelectorAll('.app-nav__button').length);
        console.log('Sections trouvées:', document.querySelectorAll('.app-section').length);
        console.log('Navigation visible:', !!document.querySelector('.app-nav'));
    }, 500);
});