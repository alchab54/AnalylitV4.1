// web/js/notifications.js
import { appState } from '../app.js';
import { showToast } from './ui-improved.js';

export function updateNotificationIndicator() {
    const indicator = document.querySelector('.notification-indicator');
    if (!indicator) return;

    const countEl = indicator.querySelector('span:last-child');
    if (appState.unreadNotifications > 0) {
        indicator.style.display = 'flex';
        if(countEl) countEl.textContent = `Notifications (${appState.unreadNotifications})`;
    } else {
        indicator.style.display = 'none';
    }
}

export function clearNotifications() {
    appState.unreadNotifications = 0;
    appState.notifications = [];
    updateNotificationIndicator();
}

export function handleWebSocketNotification(data) {
    showToast(data.message, data.type || 'info');
    appState.unreadNotifications++;
    updateNotificationIndicator();
}