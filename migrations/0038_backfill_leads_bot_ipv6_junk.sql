-- Revisão de 2026-09-13.
--
-- O bot que gerou 61 leads falsos na /lives-semanais-v1 (bloco IPv6
-- 2605:a143:2218:7058::/64) foi barrado na escrita em 2026-09-08 (12d6de1),
-- mas os Lead já gravados ficaram com is_bot = 0 e is_junk = 0. Resultado:
-- a Conversão por LP (que corta por IP na sessão) não os contava, enquanto o
-- KPI Leads, a série diária, o CPL por funil/canal e "Novos no CRM" contavam
-- — e o CPL da lives-v1 em agosto saía ~2/3 abaixo do real.
--
-- is_junk = 1 é o mesmo mecanismo usado para leads internos de teste: some
-- das métricas, o dado segue no banco. Idempotente (só toca is_junk = 0).
-- O IP fica em sessions, não em event_log, daí a subquery (61 linhas via
-- idx_event_log_session_id).

UPDATE event_log
   SET is_junk = 1
 WHERE event_name = 'Lead'
   AND is_junk = 0
   AND session_id IN (
     SELECT session_id FROM sessions
      WHERE ip_address LIKE '2605:a143:2218:7058:%'
   );
