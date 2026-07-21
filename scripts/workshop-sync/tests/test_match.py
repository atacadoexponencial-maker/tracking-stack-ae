import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from match import normalize_name, match_workshop


def test_normalize_strips_accents_and_orders_tokens():
    assert normalize_name("Cláudio Alves") == normalize_name("alves claudio")
    assert normalize_name("  João   Silva ") == "joao silva"


def test_exact_name_match_marks_present():
    parts = [{"google_user_id": "users/1", "display_name": "Claudio Alves",
              "total_minutes": 50, "first_join": "t0", "last_leave": "t1"}]
    regs = [{"name": "Cláudio Alves", "email": "c@x.com", "registered_at": "r0"}]
    out = match_workshop(parts, regs, {})
    assert out["participants"][0]["registrant_email"] == "c@x.com"
    assert out["learned"] == [{"google_user_id": "users/1", "email": "c@x.com",
                               "display_name": "Claudio Alves"}]


def test_no_name_match_is_sem_inscricao():
    parts = [{"google_user_id": "users/9", "display_name": "Fulano Anonimo",
              "total_minutes": 10, "first_join": "t0", "last_leave": "t1"}]
    regs = [{"name": "Outra Pessoa", "email": "o@x.com", "registered_at": "r0"}]
    out = match_workshop(parts, regs, {})
    assert out["participants"][0]["registrant_email"] is None
    assert out["learned"] == []


def test_identity_map_wins_without_name_match():
    # mesmo com nome diferente, o google_user_id conhecido resolve o email
    parts = [{"google_user_id": "users/1", "display_name": "iPhone da Ana",
              "total_minutes": 30, "first_join": "t0", "last_leave": "t1"}]
    regs = [{"name": "Ana Souza", "email": "ana@x.com", "registered_at": "r0"}]
    out = match_workshop(parts, regs, {"users/1": "ana@x.com"})
    assert out["participants"][0]["registrant_email"] == "ana@x.com"
    # já era conhecido: não re-aprende
    assert out["learned"] == []


def test_learned_only_new_pairs():
    parts = [{"google_user_id": "users/2", "display_name": "Bia Lima",
              "total_minutes": 20, "first_join": "t0", "last_leave": "t1"}]
    regs = [{"name": "Bia Lima", "email": "bia@x.com", "registered_at": "r0"}]
    out = match_workshop(parts, regs, {"users/2": "bia@x.com"})
    assert out["learned"] == []
