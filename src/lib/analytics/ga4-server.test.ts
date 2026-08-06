import { describe, it, expect } from 'vitest';
import { clientIdFromGaCookie, sessionIdFromGaCookie } from './ga4-server';

// Ces deux parseurs décident si un clic marchand est mesuré ou perdu : un
// client_id mal lu = événement non envoyé, un session_id mal lu = événement
// rattaché à une session fantôme, donc attribution de canal fausse.

describe('clientIdFromGaCookie', () => {
  it('extrait les deux derniers segments du cookie _ga', () => {
    expect(clientIdFromGaCookie('GA1.1.1234567890.1699999999')).toBe('1234567890.1699999999');
  });

  it("accepte les cookies portant un autre numéro de version/domaine", () => {
    expect(clientIdFromGaCookie('GA1.2.987654321.1600000000')).toBe('987654321.1600000000');
  });

  it('renvoie null en absence de cookie (consentement refusé ou gtag bloqué)', () => {
    expect(clientIdFromGaCookie(undefined)).toBeNull();
  });

  it('renvoie null sur un cookie tronqué ou non numérique plutôt que de forger un id', () => {
    expect(clientIdFromGaCookie('GA1.1.abc')).toBeNull();
    expect(clientIdFromGaCookie('GA1.1.abc.def')).toBeNull();
    expect(clientIdFromGaCookie('')).toBeNull();
  });
});

describe('sessionIdFromGaCookie', () => {
  it('lit le format GS1', () => {
    expect(sessionIdFromGaCookie('GS1.1.1770000000.5.1.1770000123.0.0.0')).toBe('1770000000');
  });

  it('lit le format GS2, où le session_id est préfixé par « s »', () => {
    expect(sessionIdFromGaCookie('GS2.1.s1770000456$o5$g1$t1770000500')).toBe('1770000456');
  });

  it('renvoie null sur cookie absent ou illisible', () => {
    expect(sessionIdFromGaCookie(undefined)).toBeNull();
    expect(sessionIdFromGaCookie('garbage')).toBeNull();
  });
});
