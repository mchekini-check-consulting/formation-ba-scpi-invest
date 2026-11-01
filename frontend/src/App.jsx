// Landing page : fond mauve, message de bienvenue à l'équipe en mauve clair, et un chat dessiné
const CHAT = String.raw`
      /\_/\
     ( o.o )
      > ^ <
     /     \
    (  | |  )
   (__d   b__)
       \_/~~
`;

function App() {
  return (
    <main className="place-items-center content-center gap-8 grid bg-purple-500 min-h-svh text-purple-50">
      <h1 className="m-0 font-serif font-normal text-6xl text-center md:text-8xl">Hello la team</h1>
      <figure className="m-0">
        <pre aria-hidden="true" className="m-0 font-mono text-2xl md:text-4xl leading-tight">{CHAT}</pre>
        <figcaption className="sr-only">Un chat</figcaption>
      </figure>
    </main>
  );
}

export default App;
