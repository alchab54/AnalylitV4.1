// Support minimal pour tests Cypress
document.addEventListener('DOMContentLoaded', function() {
    console.log('🧪 Cypress Test Support chargé');
    
    // Navigation simple
    document.addEventListener('click', function(event) {
        // Navigation sections
        const navButton = event.target.closest('[data-action="show-section"]');
        if (navButton) {
            const sectionId = navButton.dataset.sectionId;
            showSection(sectionId);
            setActiveNavButton(navButton);
        }
        
        // Modale création
        if (event.target.matches('[data-action="create-project-modal"]')) {
            showModal('newProjectModal');
        }
        
        // Fermer modale
        if (event.target.matches('[data-action="close-modal"]')) {
            hideModal('newProjectModal');
        }
        
        // Submit formulaire
        if (event.target.matches('#createProjectForm button[type="submit"]')) {
            event.preventDefault();
            handleCreateProject();
        }
    });
    
    function showSection(sectionId) {
        // Cacher toutes sections
        document.querySelectorAll('.app-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        // Afficher section demandée
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'block';
            section.classList.add('active');
        }
    }
    
    function setActiveNavButton(activeButton) {
        document.querySelectorAll('.app-nav__button').forEach(btn => {
            btn.classList.remove('app-nav__button--active');
        });
        activeButton.classList.add('app-nav__button--active');
    }
    
    function showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'flex';
        modal.classList.add('modal--show');
    }
    
    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'none';
        modal.classList.remove('modal--show');
    }
    
    function handleCreateProject() {
        const projectName = document.getElementById('projectName').value;
        
        if (!projectName) {
            alert('Nom requis');
            return;
        }
        
        // Simuler création pour tests
        createProjectCard(projectName);
        hideModal('newProjectModal');
        
        // Reset formulaire
        document.getElementById('projectName').value = '';
    }
    
    function createProjectCard(name) {
        const projectsGrid = document.getElementById('projects-list');
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
            <div class="project-card__header">
                <h3 class="project-card__title">${name}</h3>
            </div>
            <div class="project-card__footer">
                <span>Articles: 0</span>
                <button data-action="delete-project" class="btn btn--danger btn--sm">Supprimer</button>
            </div>
        `;
        projectsGrid.appendChild(card);
    }
    
    // Interface debug pour Cypress
    window.AnalyLit = {
        debug: {
            showSections: () => {
                const sections = document.querySelectorAll('.app-section');
                sections.forEach(section => {
                    console.log(`${section.id}: ${section.classList.contains('active') ? 'ACTIVE' : 'hidden'}`);
                });
            },
            forceShowSection: (id) => {
                showSection(id);
            }
        }
    };
    
    console.log('✅ Test support initialisé');
});