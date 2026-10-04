// GET /agendar/<tipo> — página pública de agendamento (spec-agenda-propria.md, módulo 4).
// O HTML é sempre o mesmo (src/pages/agendar.astro); o tipo sai do endereço.
import { servirPagina } from '../_pagina-estatica.js';

export const onRequestGet = (context) => servirPagina(context, '/agendar/');
