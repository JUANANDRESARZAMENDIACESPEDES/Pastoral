import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Confirmación de correo - Pastoral',
  description: 'Confirmación de correo electrónico de Pastoral Juvenil Luqueña.',
};

export default function ConfirmationPage({ searchParams }: any) {
  const success = searchParams?.success === 'true';

  return (
    <main style={mainStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={logoStyle}>Pastoral</div>
          <p style={subtitleStyle}>Juvenil Luqueña</p>
        </div>

        <div style={contentStyle}>
          <div style={badgeStyle(success)}>{success ? '¡Confirmación exitosa!' : 'Algo salió mal'}</div>
          <h1 style={titleStyle}>{success ? 'Correo confirmado' : 'No se pudo validar tu correo'}</h1>
          <p style={textStyle}>
            {success
              ? 'Tu correo fue confirmado correctamente. Ya puedes cerrar esta pestaña si todo salió bien, o volver al panel si lo deseas.'
              : 'Hubo un problema al confirmar tu correo. Intenta usar el enlace nuevamente o ponte en contacto con el administrador.'}
          </p>

          {success ? (
            <div style={messageBoxStyle}>
              <strong>✅ Todo está listo.</strong>
              <p style={{ margin: '6px 0 0' }}>Si todo se ve bien, puedes cerrar esta ventana.</p>
            </div>
          ) : (
            <div style={errorBoxStyle}>
              <strong>⚠️ Algo salió mal.</strong>
              <p style={{ margin: '6px 0 0' }}>Intenta de nuevo o contacta al equipo de Pastoral.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '20px',
  background: 'radial-gradient(circle at top, rgba(245, 196, 125, 0.25), transparent 35%), linear-gradient(180deg, #fdf7e8 0%, #f5efe3 100%)',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  borderRadius: '28px',
  boxShadow: '0 32px 80px rgba(34, 34, 60, 0.12)',
  background: 'rgba(255, 255, 255, 0.98)',
  border: '1px solid rgba(255,255,255,0.9)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #b8860b 0%, #f5c35a 100%)',
  color: '#fff',
  padding: '36px 30px',
  textAlign: 'center',
};

const logoStyle: React.CSSProperties = {
  fontSize: '2.25rem',
  fontWeight: 800,
  letterSpacing: '0.06em',
  marginBottom: '8px',
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  opacity: 0.92,
};

const contentStyle: React.CSSProperties = {
  padding: '36px 30px 46px',
};

const badgeStyle = (success: boolean): React.CSSProperties => ({
  display: 'inline-block',
  padding: '10px 18px',
  borderRadius: '999px',
  background: success ? 'rgba(34, 115, 73, 0.12)' : 'rgba(186, 66, 57, 0.12)',
  color: success ? '#1b5d2c' : '#7a1f1c',
  fontWeight: 700,
  marginBottom: '22px',
});

const titleStyle: React.CSSProperties = {
  fontSize: '2rem',
  lineHeight: 1.05,
  margin: '0 0 20px',
  color: '#1f2937',
};

const textStyle: React.CSSProperties = {
  fontSize: '1rem',
  lineHeight: 1.85,
  color: '#475569',
  margin: 0,
};

const messageBoxStyle: React.CSSProperties = {
  marginTop: '32px',
  padding: '22px',
  borderRadius: '20px',
  background: 'rgba(220, 251, 220, 0.75)',
  border: '1px solid rgba(34, 115, 73, 0.16)',
  color: '#134e2b',
};

const errorBoxStyle: React.CSSProperties = {
  marginTop: '32px',
  padding: '22px',
  borderRadius: '20px',
  background: 'rgba(254, 226, 226, 0.85)',
  border: '1px solid rgba(185, 28, 28, 0.16)',
  color: '#7f1d1d',
};
