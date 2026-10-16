"""Génération des requêtes de recherche.

Combine besoins × lieux × formulations, puis fait tourner la liste d'une
exécution à l'autre (curseur dans l'état) pour couvrir toutes les variantes
sans multiplier les appels à chaque passage.
"""

from __future__ import annotations

from itertools import product

# Formulations réellement employées par une personne qui cherche de l'aide.
BESOINS = [
    "porte claquée",
    "porte fermée à clé",
    "porte bloquée",
    "serrure bloquée",
    "serrure cassée",
    "clé cassée dans la serrure",
    "perdu mes clés",
    "changer la serrure",
    "ouverture de porte",
    "serrure après cambriolage",
    "devis serrurier",
]

DEMANDES = ["cherche serrurier", "besoin serrurier", "recherche serrurier", "serrurier urgence"]

DEPARTEMENTS = {
    "75": "Paris",
    "77": "Seine-et-Marne",
    "78": "Yvelines",
    "91": "Essonne",
    "92": "Hauts-de-Seine",
    "93": "Seine-Saint-Denis",
    "94": "Val-de-Marne",
    "95": "Val-d'Oise",
}


def broad_queries() -> list[str]:
    """Requêtes larges (sources à faible volume comme Bluesky) : le filtrage
    géographique est fait ensuite par le moteur de qualification."""
    return ["serrurier", *DEMANDES, *BESOINS]


def localized_queries(departements: list[str], communes: list[str]) -> list[str]:
    """Requêtes localisées (moteurs de recherche web)."""
    lieux: list[str] = []
    for code in departements:
        if code in DEPARTEMENTS:
            lieux += [DEPARTEMENTS[code], code]
    lieux += communes
    queries: list[str] = []
    seen: set[str] = set()
    # Alterne demandes explicites et besoins précis pour chaque lieu.
    for lieu, terme in product(lieux, [*DEMANDES, *BESOINS]):
        q = f"{terme} {lieu}"
        if q not in seen:
            seen.add(q)
            queries.append(q)
    return queries


# Formulations « forum » : une personne qui demande de l'aide, pas une page de
# professionnel. Test réel du 2026-10-16 : les requêtes génériques
# (« serrurier Aubervilliers ») ne renvoient que concurrents et annuaires.
DEMANDES_FORUM = [
    '"je cherche un serrurier"',
    '"besoin d\'un serrurier"',
    '"quelqu\'un connait un serrurier"',
    '"vous connaissez un serrurier"',
    '"porte claquée" aide',
    '"clé cassée dans la serrure" aide',
]


def demand_queries(departements: list[str], communes: list[str]) -> list[str]:
    """Requêtes moteur de recherche orientées demandes de particuliers."""
    lieux = [DEPARTEMENTS[c] for c in departements if c in DEPARTEMENTS] + communes
    return [f"{d} {lieu}" for lieu, d in product(lieux, DEMANDES_FORUM)]


def next_batch(all_queries: list[str], cursor: int, size: int) -> tuple[list[str], int]:
    """Renvoie `size` requêtes à partir du curseur (rotation) et le nouveau curseur."""
    if not all_queries or size <= 0:
        return [], cursor
    n = len(all_queries)
    start = cursor % n
    batch = [all_queries[(start + i) % n] for i in range(min(size, n))]
    return batch, (start + len(batch)) % n
