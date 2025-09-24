// web/js/notifications.js
import { appState } from './app-improved.js'; // Read from state
import { showToast } from './ui-improved.js';
import { setNotifications, setUnreadNotificationsCount } from './state.js';

export function updateNotificationIndicator() {
    const indicator = document.querySelector('.notification-indicator');
    if (!indicator) return;

    const countEl = indicator.querySelector('span:last-child');
    if (appState.unreadNotifications > 0) { // Read from state
        indicator.style.display = 'flex';
        if(countEl) countEl.textContent = `Notifications (${appState.unreadNotifications})`;
    } else {
        indicator.style.display = 'none';
    }
}

export function clearNotifications() { // This function is called by core.js
    setUnreadNotificationsCount(0);
    setNotifications([]);
    updateNotificationIndicator();
}

export function handleWebSocketNotification(data) {
    showToast(data.message, data.type || 'info');
    setUnreadNotificationsCount(appState.unreadNotifications + 1);
    updateNotificationIndicator();
}