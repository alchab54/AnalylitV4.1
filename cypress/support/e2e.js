// ===================================================================
// == ANALYLIT V4.1 - SUPPORT E2E ==
// ===================================================================

// Importer les commandes personnalisées
import './commands'

// Configuration globale - Gestion des erreurs
beforeEach(() => {
  // Ignorer les erreurs non-critiques spécifiques à AnalyLit
  cy.on('uncaught:exception', (err, runnable) => {
    // Erreurs Ollama (normales en développement)
    if (err.message.includes('Connection refused') || 
        err.message.includes('11434') ||
        err.message.includes('OLLAMA') ||
        err.message.includes('HTTPConnectionPool')) {
      console.warn('🔸 Erreur Ollama ignorée (normale):', err.message)
      return false
    }
    
    // Erreurs WebSocket (normales)
    if (err.message.includes('WebSocket') || 
        err.message.includes('socket.io') ||
        err.message.includes('websocket')) {
      console.warn('🔸 Erreur WebSocket ignorée (normale):', err.message)
      return false
    }
    
    // Erreurs de script réseau
    if (err.message.includes('Script error') ||
        err.message.includes('Non-Error promise rejection') ||
        err.message.includes('Network Error')) {
      console.warn('🔸 Erreur réseau ignorée:', err.message)
      return false
    }
    
    // Laisser passer les vraies erreurs d'application
    console.error('❌ Erreur critique détectée:', err.message)
    return true
  })
})

// Nettoyage après chaque test
afterEach(() => {
  // Nettoyer le localStorage entre les tests
  cy.clearLocalStorage()
})

// Configuration globale Cypress
Cypress.on('window:before:load', (win) => {
  // Désactiver les animations pour accélérer les tests
  win.document.addEventListener('DOMContentLoaded', () => {
    const style = win.document.createElement('style')
    style.innerHTML = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-delay: 0.01ms !important;
        transition-duration: 0.01ms !important;
        transition-delay: 0.01ms !important;
      }
    `
    win.document.head.appendChild(style)
  })
})