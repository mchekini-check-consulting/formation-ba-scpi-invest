import { useQuery } from '@tanstack/react-query';
import { apiBase } from './api';

// Appel GET /health du backend : code HTTP et corps de la réponse
async function lireSante() {
  const reponse = await fetch(`${apiBase()}/health`);
  return { ok: reponse.ok, code: reponse.status, corps: await reponse.text() };
}

// Bandeau en bas de page : gris pendant l'appel, vert si 2xx, rouge sinon
function Bandeau({ sante }) {
  if (sante.isPending) {
    return <Ligne couleur="bg-gray-500">GET /health → …</Ligne>;
  }
  if (sante.isError) {
    return <Ligne couleur="bg-red-600">GET /health → backend injoignable</Ligne>;
  }
  const { ok, code, corps } = sante.data;
  return (
    <Ligne couleur={ok ? 'bg-green-600' : 'bg-red-600'}>
      GET /health → HTTP {code} · {corps}
    </Ligne>
  );
}

function Ligne({ couleur, children }) {
  return (
    <output className={`${couleur} px-6 py-3 font-mono text-sm text-white`}>{children}</output>
  );
}

function App() {
  const sante = useQuery({ queryKey: ['health'], queryFn: lireSante, retry: false });
  const pastille = sante.data?.ok ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="flex flex-col bg-[#fffdf8] min-h-svh text-[#222]">
      <header className="flex justify-between items-center px-6 py-3.5 border-gray-200 border-b text-sm">
        <strong>SCPI Invest+</strong>
        {sante.isSuccess && (
          <span className="flex items-center gap-2 font-mono text-xs">
            <span className={`size-2.5 rounded-full ${pastille}`} />
            backend {sante.data.code}
          </span>
        )}
      </header>
      <main className="flex-1 place-items-center grid">
        <h1 className="m-0 font-serif font-normal text-6xl md:text-8xl">SCPI Invest+</h1>
      </main>
      <Bandeau sante={sante} />
    </div>
  );
}

export default App;
