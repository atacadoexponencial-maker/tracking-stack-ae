"""google_user_id da equipe interna — excluídos da contagem de presença.

Filtrados pelo ID estável do Google (não por nome), para não derrubar leads
reais com nomes parecidos (ex.: Lucas/Ramon Santos ≠ Felipe Santos).
"""
TEAM_GOOGLE_USER_IDS = {
    "users/103248863365309849873",  # Marcelle (no Meet: Marcelle Fernandes)
    "users/111082220125504877803",  # Day Maciel (no Meet: Adayne Maciel)
    "users/102068618279730112556",  # Felipe Santos
    "users/104184629372232050312",  # Bárbara (no Meet: Barbara Lazzari)
}
