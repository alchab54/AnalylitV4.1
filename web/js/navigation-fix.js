// Correction d'urgence pour la navigation manquante
console.log('Navigation Fix - Initialisation...');

function forceNavigationDisplay() {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', forceNavigationDisplay);
        return;
    }

    console.log('Navigation Fix - DOM prêt');

    // Forcer l'affichage de la navigation
    const nav = document.querySelector('.app-nav');
    if (nav) {
        console.log('Navigation trouvée, application des styles...');
        nav.style.display = 'block';
        nav.style.visibility = 'visible';
        nav.style.opacity = '1';
        nav.style.position = 'sticky';
        nav.style.top = '0';
        nav.style.zIndex = '1000';
        nav.style.background = 'white';
        nav.style.borderBottom = '2px solid #3b82f6';
        nav.style.minHeight = '60px';
        nav.style.width = '100%';
        nav.style.left = '0';
        nav.style.right = '0';
        
        // Forcer l'affichage du container
        const container = nav.querySelector('.container');
        if (container) {
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.height = '60px';
            container.style.width = '100%';
            container.style.maxWidth = '1200px';
            container.style.margin = '0 auto';
            container.style.padding = '0 1rem';
        }

        // Forcer l'affichage des boutons
        const buttons = nav.querySelectorAll('.app-nav__button');
        buttons.forEach((btn, index) => {
            btn.style.display = 'inline-flex';
            btn.style.visibility = 'visible';
            btn.style.opacity = '1';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.padding = '0.75rem 1rem';
            btn.style.marginRight = '0.5rem';
            btn.style.background = index === 0 ? '#3b82f6' : '#f3f4f6';
            btn.style.color = index === 0 ? 'white' : '#374151';
            btn.style.border = '1px solid #d1d5db';
            btn.style.borderRadius = '0.5rem';
            btn.style.minWidth = '100px';
            btn.style.height = '40px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '0.875rem';
            btn.style.fontWeight = '600';
            btn.style.whiteSpace = 'nowrap';
            
            // Ajouter les événements de clic
            btn.addEventListener('click', function() {
                // Retirer la classe active de tous les boutons
                buttons.forEach(b => {
                    b.classList.remove('app-nav__button--active');
                    b.style.background = '#f3f4f6';
                    b.style.color = '#374151';
                });
                
                // Ajouter la classe active au bouton cliqué
                this.classList.add('app-nav__button--active');
                this.style.background = '#3b82f6';
                this.style.color = 'white';
                
                // Afficher la section correspondante
                const sectionId = this.getAttribute('data-section-id');
                if (sectionId) {
                    // Cacher toutes les sections
                    document.querySelectorAll('.app-section').forEach(section => {
                        section.style.display = 'none';
                        section.classList.remove('active');
                    });
                    
                    // Afficher la section correspondante
                    const targetSection = document.getElementById(sectionId);
                    if (targetSection) {
                        targetSection.style.display = 'block';
                        targetSection.classList.add('active');
                    }
                }
            });
        });

        console.log(`Navigation Fix - ${buttons.length} boutons configurés`);
    } else {
        console.error('Navigation Fix - Navigation introuvable !');
        
        // Créer la navigation si elle n'existe pas
        createEmergencyNavigation();
    }
}

function createEmergencyNavigation() {
    console.log('Navigation Fix - Création d\'une navigation d\'urgence...');
    
    const header = document.querySelector('.app-header');
    if (!header) {
        console.error('Header introuvable !');
        return;
    }

    const emergencyNav = document.createElement('nav');
    emergencyNav.className = 'app-nav app-nav--emergency';
    emergencyNav.innerHTML = `
        <div class="container">
            <button class="app-nav__button app-nav__button--active" data-section-id="projects">
                📁 Projets
            </button>
            <button class="app-nav__button" data-section-id="search">
                🔍 Recherche
            </button>
            <button class="app-nav__button" data-section-id="results">
                📄 Résultats
            </button>
            <button class="app-nav__button" data-section-id="validation">
                ✅ Validation
            </button>
            <button class="app-nav__button" data-section-id="grids">
                📋 Grilles
            </button>
            <button class="app-nav__button" data-section-id="analyses">
                📊 Analyses
            </button>
            <button class="app-nav__button" data-section-id="import">
                📥 Import
            </button>
            <button class="app-nav__button" data-section-id="chat">
                💬 Chat IA
            </button>
            <button class="app-nav__button" data-section-id="settings">
                ⚙️ Paramètres
            </button>
        </div>
    `;

    // Insérer après le header
    header.insertAdjacentElement('afterend', emergencyNav);
    
    // Appliquer les styles
    setTimeout(() => forceNavigationDisplay(), 100);
}

// Fonction de test pour vérifier la présence des éléments
function debugNavigation() {
    console.log('=== DEBUG NAVIGATION ===');
    console.log('Header:', document.querySelector('.app-header'));
    console.log('Navigation:', document.querySelector('.app-nav'));
    console.log('Boutons nav:', document.querySelectorAll('.app-nav__button').length);
    console.log('Sections:', document.querySelectorAll('.app-section').length);
    console.log('CSS chargé:', document.querySelectorAll('link[href*="style-improved"]').length);
    console.log('========================');
}

// Initialiser immédiatement
forceNavigationDisplay();

// Réessayer après un délai si nécessaire
setTimeout(forceNavigationDisplay, 500);
setTimeout(forceNavigationDisplay, 1000);

// Debug après chargement
setTimeout(debugNavigation, 2000);

// Exposer les fonctions pour le debugging
window.forceNavigationDisplay = forceNavigationDisplay;
window.debugNavigation = debugNavigation;