import pg from 'pg';

// bigint (item.id) renvoyé en number, comme le Long de Spring, et non en string
pg.types.setTypeParser(20, Number);

// DATABASE_URL injectée par la plateforme (helm.yaml : database) ;
// sans elle (poste de dev) : la base de compose.yaml
export function createPool(
  url = process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/scpi_invest',
): pg.Pool {
  return new pg.Pool({ connectionString: url });
}
