import { Router } from 'express';
import type { Pool } from 'pg';

const COLONNES = 'id, nom, description, cree_le as "creeLe"';

// GET /items : liste ; POST /items {nom, description} : création (nom obligatoire).
// Exposé par la passerelle : https://api.<env>.check-consulting.net/formation-ba-scpi-invest/backend/items
export function itemsRouter(pool: Pool): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const { rows } = await pool.query(`select ${COLONNES} from item order by id`);
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const { nom, description } = req.body ?? {};
    if (typeof nom !== 'string' || !nom.trim()) {
      res.status(400).json({ message: 'nom obligatoire' });
      return;
    }
    const desc = typeof description === 'string' && description.trim() ? description.trim() : null;
    const { rows } = await pool.query(
      `insert into item (nom, description) values ($1, $2) returning ${COLONNES}`,
      [nom.trim(), desc],
    );
    res.status(201).json(rows[0]);
  });

  return router;
}
