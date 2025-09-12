// web/js/notifications.js
import { appState } from '../app.js';

export function updateNotificationIndicator() {
    const indicator = document.querySelector('.notification-indicator');
    if (!indicator) return;

    const countSpan = indicator.querySelector('.count'); // Cible plus spécifique

    if (appState.unreadNotifications > 0) {
        indicator.style.display = 'flex';
        if(countSpan) {
           countSpan.textContent = appState.unreadNotifications;
        }
    } else {
        indicator.style.display = 'none';
    }
}

export function clearNotifications() {
    appState.unreadNotifications = 0;
    appState.notifications = [];
    updateNotificationIndicator();
}