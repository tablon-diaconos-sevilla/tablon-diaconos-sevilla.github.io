// Recogida automática de titulares: cada hora, en el minuto 7.
// (Las horas de Netlify van en UTC; al ser cada hora, da igual.)
// Sustituye a la antigua tarea de GitHub Actions.

import { actualizarTablon } from "../lib/tablon.mjs";

export default async () => {
  await actualizarTablon();
};

export const config = {
  schedule: "7 * * * *",
};
