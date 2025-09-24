// layout-optimizer.js - Optimiseur d'interface pour AnalyLit v4.1

/**
 * Système d'optimisation automatique de l'interface
 * Élimine les espaces inutiles et améliore la compacité
 */
import { debounce } from './utils.js';

export class LayoutOptimizer {
    constructor() {
        this.config = {
            // Espacements optimisés
            compactSpacing: {
                xs: '4px',
                sm: '8px', 
                md: '12px',
                lg: '16px',
                xl: '24px'
            },
            
            // Seuils d'optimisation
            emptyContainerThreshold: 0,
            minContentHeight: 100,
            maxContainerWidth: 1200
        };
        
        this.initialized = false;
    }

    /**
     * Initialise l'optimiseur de layout
     */
    init() {
        if (this.initialized) return;
        
        console.log('🎯 Initialisation Layout Optimizer...');
        
        // Attendre que le DOM soit prêt
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupOptimizer());
        } else {
            this.setupOptimizer();
        }
        
        this.initialized = true;

        this.debounceTimeout = null;
    }

    /**
     * Configure l'optimiseur
     */
    setupOptimizer() {
        // Appliquer les optimisations de base
        this.optimizeContainers();
        this.optimizeSpacing();
        this.optimizeGrids();
        this.removeEmptyElements();
        
        // Observer les changements
        this.setupMutationObserver();
        
        // Optimiser lors des changements de section
        this.setupSectionObserver();
        
        // Optimisation périodique
        this.setupPeriodicOptimization();
        
        console.log('✅ Layout Optimizer activé');
    }

    /**
     * Optimise les conteneurs principaux
     */
    optimizeContainers() {
        // Container principal
        const containers = document.querySelectorAll('.container');
        containers.forEach(container => {
            container.style.maxWidth = this.config.maxContainerWidth + 'px';
            container.style.padding = `0 ${this.config.compactSpacing.lg}`;
            container.style.margin = '0 auto';
        });

        // Header
        const header = document.querySelector('.app-header');
        if (header) {
            header.style.height = '60px';
            header.style.padding = `0 ${this.config.compactSpacing.lg}`;
            header.style.minHeight = 'auto';
        }

        // Navigation
        const nav = document.querySelector('.app-nav');
        if (nav) {
            nav.style.height = '48px';
            nav.style.minHeight = 'auto';
        }

        // Main content
        const main = document.querySelector('.app-main');
        if (main) {
            main.style.padding = `${this.config.compactSpacing.lg} 0`;
            main.style.minHeight = 'calc(100vh - 108px)'; // header + nav
        }
    }

    /**
     * Optimise les espacements
     */
    optimizeSpacing() {
        // Sections
        const sections = document.querySelectorAll('.section');
        sections.forEach(section => {
            section.style.padding = '0';
            section.style.margin = '0';
            
            // Section header
            const header = section.querySelector('.section-header');
            if (header) {
                header.style.marginBottom = this.config.compactSpacing.lg;
            }
        });

        // Cards
        const cards = document.querySelectorAll('.card');
        cards.forEach((card, index) => {
            card.style.marginBottom = this.config.compactSpacing.md;
            card.style.padding = this.config.compactSpacing.md;
            
            // Dernière card
            if (index === cards.length - 1) {
                card.style.marginBottom = '0';
            }
        });

        // Formulaires
        const formGroups = document.querySelectorAll('.form-group');
        formGroups.forEach((group, index) => {
            group.style.marginBottom = this.config.compactSpacing.md;
            
            if (index === formGroups.length - 1) {
                group.style.marginBottom = '0';
            }
        });
    }

    /**
     * Optimise les grilles
     */
    optimizeGrids() {
        // Projects grid
        const projectsGrid = document.querySelector('.projects-grid');
        if (projectsGrid) {
            projectsGrid.style.display = 'grid';
            projectsGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
            projectsGrid.style.gap = this.config.compactSpacing.md;
            projectsGrid.style.margin = '0';
        }

        // Metrics grid
        const metricsGrids = document.querySelectorAll('.metrics-grid');
        metricsGrids.forEach(grid => {
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(120px, 1fr))';
            grid.style.gap = this.config.compactSpacing.sm;
            grid.style.marginBottom = this.config.compactSpacing.lg;
        });

        // Analysis grid
        const analysisGrids = document.querySelectorAll('.analysis-grid');
        analysisGrids.forEach(grid => {
            grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
            grid.style.gap = this.config.compactSpacing.md;
        });
    }

    /**
     * Supprime les éléments vides qui prennent de l'espace
     */
    removeEmptyElements() {
        // Containers vides
        const emptyContainers = document.querySelectorAll('.card, .section, .container');
        emptyContainers.forEach(container => {
            if (this.isEffectivelyEmpty(container)) {
                container.style.display = 'none';
            }
        });

        // Paragraphes vides
        const emptyP = document.querySelectorAll('p');
        emptyP.forEach(p => {
            if (!p.textContent.trim() && p.children.length === 0) {
                p.style.display = 'none';
            }
        });

        // Divs vides avec des classes d'espacement
        const spacingDivs = document.querySelectorAll('.spacer, .gap, .margin, .padding');
        spacingDivs.forEach(div => {
            if (this.isEffectivelyEmpty(div)) {
                div.remove();
            }
        });
    }

    /**
     * Vérifie si un élément est effectivement vide
     */
    isEffectivelyEmpty(element) {
        if (!element) return true;
        
        const hasText = element.textContent.trim().length > 0;
        const hasVisibleChildren = element.querySelectorAll('*').length > this.config.emptyContainerThreshold;
        const hasBackgroundImage = getComputedStyle(element).backgroundImage !== 'none';
        const hasMinHeight = parseInt(getComputedStyle(element).minHeight) > this.config.minContentHeight;
        
        return !hasText && !hasVisibleChildren && !hasBackgroundImage && !hasMinHeight;
    }

    /**
     * Configure l'observateur de mutations pour optimiser automatiquement
     */
    setupMutationObserver() {
        const observer = new MutationObserver((mutations) => {
            let shouldOptimize = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldOptimize = true;
                }
            });
            
            if (shouldOptimize) {
                // Optimiser avec un délai pour éviter trop d'appels
                this.debounceOptimize();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Observe les changements de section pour optimiser
     */
    setupSectionObserver() {
        const navButtons = document.querySelectorAll('.app-nav__button');
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                setTimeout(() => this.optimizeCurrentSection(), 100);
            });
        });
    }

    /**
     * Optimise la section actuellement active
     */
    optimizeCurrentSection() {
        const activeSection = document.querySelector('.section--active');
        if (!activeSection) return;
        
        // Optimiser spécifiquement cette section
        const cards = activeSection.querySelectorAll('.card');
        const grids = activeSection.querySelectorAll('[class*="grid"]');
        
        // Réappliquer les optimisations
        cards.forEach(card => {
            if (this.isEffectivelyEmpty(card)) {
                card.style.display = 'none';
            } else {
                card.style.display = 'block';
                card.style.marginBottom = this.config.compactSpacing.md;
                card.style.padding = this.config.compactSpacing.md;
            }
        });
        
        grids.forEach(grid => {
            if (grid.children.length === 0) {
                grid.style.display = 'none';
            } else {
                grid.style.display = 'grid';
            }
        });
    }

    /**
     * Optimisation périodique pour maintenir la propreté
     */
    setupPeriodicOptimization() {
        setInterval(() => {
            this.removeEmptyElements();
            this.optimizeSpacing();
        }, 30000); // Toutes les 30 secondes
    }

    /**
     * Débounce pour éviter trop d'optimisations
     */
    debounceOptimize() {
        if (this.optimizeTimeout) {
            clearTimeout(this.optimizeTimeout);
        }
        
        this.optimizeTimeout = setTimeout(() => {
            this.optimizeSpacing();
            this.removeEmptyElements();
        }, 300);
    }

    /**
     * Mode compact forcé pour les écrans petits
     */
    enableCompactMode() {
        document.body.classList.add('layout-compact');
        
        // CSS compact via JavaScript
        const style = document.createElement('style');
        style.textContent = `
            .layout-compact .container {
                padding: ${this.config.compactSpacing.sm} !important;
            }
            
            .layout-compact .card {
                padding: ${this.config.compactSpacing.sm} !important;
                margin-bottom: ${this.config.compactSpacing.sm} !important;
            }
            
            .layout-compact .section-header {
                margin-bottom: ${this.config.compactSpacing.md} !important;
            }
            
            .layout-compact .form-group {
                margin-bottom: ${this.config.compactSpacing.sm} !important;
            }
            
            .layout-compact .projects-grid {
                grid-template-columns: 1fr !important;
                gap: ${this.config.compactSpacing.sm} !important;
            }
        `;
        
        document.head.appendChild(style);
        
        console.log('📱 Mode compact activé');
    }

    /**
     * Responsive automatique
     */
    setupResponsiveOptimization() {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        
        const handleMediaQuery = (e) => {
            if (e.matches) {
                this.enableCompactMode();
            } else {
                document.body.classList.remove('layout-compact');
            }
        };
        
        mediaQuery.addListener(handleMediaQuery);
        handleMediaQuery(mediaQuery);
    }

    /**
     * Vérifie et applique le mode compact selon les conditions actuelles
     */
    checkCompactMode() {
        if (!this.isInitialized) return;
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const zoomLevel = window.devicePixelRatio || 1;
        
        // Seuils pour activer le mode compact
        const compactWidthThreshold = 1024;
        const compactHeightThreshold = 600;
        const compactZoomThreshold = 1.2;
        
        const shouldBeCompact = 
            viewportWidth < compactWidthThreshold ||
            viewportHeight < compactHeightThreshold ||
            zoomLevel > compactZoomThreshold ||
            this.forceCompactMode;
            
        if (shouldBeCompact && !this.isCompactMode) {
            this.enableCompactMode();
        } else if (!shouldBeCompact && this.isCompactMode && !this.forceCompactMode) {
            this.disableCompactMode();
        }
    }

    /**
     * Fonction utilitaire debounce intégrée à la classe
     */
    debounce(func, wait) {
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(func, wait);
    }

    /**
     * Automatically enables compact mode on high zoom levels.
     */
    setupZoomBasedCompactMode() {
        const evaluateCompactMode = () => {
            const bodyWidth = document.body.offsetWidth;
            const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
            // Force compact mode if zoom makes content wider than viewport or on low pixel ratio
            if ((vw > 0 && bodyWidth / vw > 1.2) || window.devicePixelRatio < 1) {
                document.body.classList.add('compact');
            } else {
                document.body.classList.remove('compact');
            }
        };

        window.addEventListener('resize', () => this.debounce(this.checkCompactMode.bind(this), 150));
        // Note: 'zoom' n'est pas un événement standard, utilisez 'orientationchange' ou supprimez-le
        window.addEventListener('orientationchange', () => this.debounce(this.checkCompactMode.bind(this), 150));
    }

    /**
     * API publique pour optimisation manuelle
     */
    forceOptimize() {
        console.log('🔧 Optimisation forcée...');
        this.optimizeContainers();
        this.optimizeSpacing();
        this.optimizeGrids();
        this.removeEmptyElements();
        this.optimizeCurrentSection();
        console.log('✅ Optimisation terminée');
    }

    /**
     * Statistiques d'optimisation
     */
    getOptimizationStats() {
        const stats = {
            emptyElementsRemoved: document.querySelectorAll('[style*="display: none"]').length,
            totalCards: document.querySelectorAll('.card').length,
            activeSection: document.querySelector('.section--active')?.id || 'none',
            containerWidth: document.querySelector('.container')?.offsetWidth || 0,
            totalSections: document.querySelectorAll('.section').length
        };
        
        return stats;
    }
}

// Instance globale
export const layoutOptimizer = new LayoutOptimizer();

// Auto-initialisation si chargé comme script
if (typeof window !== 'undefined') {
    window.layoutOptimizer = layoutOptimizer;
    layoutOptimizer.init();
    layoutOptimizer.setupZoomBasedCompactMode();
}

// Interface de debug
if (typeof window !== 'undefined') {
    window.optimizeLayout = () => layoutOptimizer.forceOptimize();
    window.getLayoutStats = () => layoutOptimizer.getOptimizationStats();
}