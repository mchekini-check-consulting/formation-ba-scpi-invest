import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
// Polices du modèle « bleu éditorial », livrées avec l'application (pas d'appel à Google Fonts)
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/figtree/800.css';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import './index.css';
import Routeur from './Routeur.jsx';

// Cache des requêtes serveur (TanStack Query) partagé par toute l'application
const queryClient = new QueryClient();

// useTransitions : les navigations par <Link> passent par React.startTransition, ce qui
// déclenche les animations <ViewTransition> (MiseEnPage.jsx, PageCompte.jsx)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter useTransitions>
        <Routeur />
      </BrowserRouter>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  </StrictMode>,
);
