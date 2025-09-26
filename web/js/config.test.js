/**
 * @jest-environment jsdom
 */
import CONFIG from './config.js';

describe('Module Config', () => {
  it('devrait exporter un objet de configuration', () => {
    // Ce test simple s'assure que le fichier n'est pas vide et exporte bien un objet.
    expect(CONFIG).toBeDefined();
    expect(typeof CONFIG).toBe('object');
    expect(CONFIG.API_BASE_URL).toBeDefined();
  });
});