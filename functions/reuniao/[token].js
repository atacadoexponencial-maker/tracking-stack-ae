// GET /reuniao/<token> — confirmação e gerenciamento da reunião pelo lead
// (spec-agenda-propria.md, módulos 5 e 6). HTML de src/pages/reuniao.astro.
import { servirPagina } from '../_pagina-estatica.js';

export const onRequestGet = (context) => servirPagina(context, '/reuniao/');
