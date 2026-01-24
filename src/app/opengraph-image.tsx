import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'City Baddies - Bons Plans Beauté';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        {/* Decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '-100px',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(155,21,21,0.3) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50px',
            right: '-50px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(212,168,85,0.2) 0%, transparent 70%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          {/* Logo text */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 100,
              color: 'white',
              letterSpacing: '-0.02em',
              marginBottom: '20px',
            }}
          >
            CITY <span style={{ color: '#d4a855', fontStyle: 'italic' }}>BADDIES</span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 32,
              color: '#888888',
              fontWeight: 300,
              marginBottom: '40px',
            }}
          >
            Bons Plans Beauté & Promos Maquillage
          </div>

          {/* Features */}
          <div
            style={{
              display: 'flex',
              gap: '40px',
              marginTop: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                color: 'white',
              }}
            >
              <div style={{ fontSize: 48, fontWeight: 300 }}>-70%</div>
              <div style={{ fontSize: 14, color: '#9b1515', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                Max Réduction
              </div>
            </div>
            <div
              style={{
                width: '1px',
                background: 'rgba(255,255,255,0.2)',
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                color: 'white',
              }}
            >
              <div style={{ fontSize: 48, fontWeight: 300 }}>24/7</div>
              <div style={{ fontSize: 14, color: '#666', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                Deals Vérifiés
              </div>
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            fontSize: 14,
            color: '#555',
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
          }}
        >
          citybaddies.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
