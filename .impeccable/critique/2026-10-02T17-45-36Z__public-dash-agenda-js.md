---
target: aba Agenda do dash
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\agenda.js"
target_fingerprint: "sha256:a31208ad5a89386c805fe7977aab0c5816eeed6ca29167fc53c2121d024b8e27"
target_path: "C:\\Users\\marce\\OneDrive\\tracking-avancado\\public\\dash\\agenda.js"
timestamp: 2026-10-02T17-45-36Z
slug: public-dash-agenda-js
---
# Crítica da Agenda (dash + /agendar + /reuniao), 02/10/2026
Método: dual-agent (A: revisão de design · B: detector)
Nota: 21/40 (1:1, 2:3, 3:2, 4:2, 5:2, 6:2, 7:1, 8:3, 9:3, 10:2)
P0: resultados longe do clique (horários livres, detalhe, grade) → gaveta; ações silenciosas (copiar, duplicar, pausar, conflito) → aviso curto.
P1: Agendamentos sem "Hoje / Próximas / Aguardando presença", passado no topo; presença direto na linha; remarcar com um toque sem confirmação (dash e /reuniao), dash usa parede de botões em vez do calendário.
P2: inconsistência entre vistas (grades com 3 botões, rótulos minúsculos, coluna de conflito com nome errado); travessão em agenda.js:172 e :634; 3 campos sem rótulo no editor de perguntas.
P3: página pública: fuso não aparece na confirmação, no celular não rola até os horários, aviso de horário ocupado some em 8 s, cookies cobrem a descrição.
Detector: páginas públicas código 0 (só avisos de escala, régua do dash; cor #9b1c1c fora da paleta); dash sem achados na Agenda.
