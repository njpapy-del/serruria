"""Génération des requêtes de recherche.

Combine besoins × lieux × formulations, puis fait tourner la liste d'une
exécution à l'autre (curseur dans l'état) pour couvrir toutes les variantes
sans multiplier les appels à chaque passage.
"""

from __future__ import annotations

import json
from itertools import product
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

COMMUNES_PATH = Path(__file__).resolve().parents[2] / "src" / "data" / "communes-idf.json"

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
    "serrure forcée",
    "clé oubliée à l'intérieur",
    "clés perdues",
    "porte impossible à ouvrir",
    "devis serrurier",
]

DEMANDES = [
    "cherche serrurier",
    "besoin serrurier",
    "recherche serrurier",
    "serrurier urgence",
    "serrurier urgent",
    "dépannage serrurier",
    "besoin serrurier rapidement",
]

# Analyse concurrentielle UNIQUEMENT : ces recherches renvoient des concurrents et
# des annuaires (test réel Brave du 16/10). Elles ne sont jamais exécutées par le
# radar de prospects et ne produisent jamais de « demande ».
REQUETES_CONCURRENCE = ["serrurier Paris", "serrurier Aubervilliers", "serrurier Saint-Denis", "serrurier Montreuil"]

# Plomberie : catalogue distinct (détection et comptage ; pas de prospects tant
# que l'activité n'est pas activée).
BESOINS_PLOMBERIE = [
    "wc bouché",
    "toilettes bouchées",
    "évier bouché",
    "canalisation bouchée",
    "fuite d'eau",
    "tuyau éclaté",
    "dégât des eaux",
    "cherche plombier",
    "plombier urgence",
]

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


def broad_queries(include_plomberie: bool = True) -> list[str]:
    """Requêtes larges (sources à faible volume comme Bluesky) : le filtrage
    géographique est fait ensuite par le moteur de qualification."""
    return ["serrurier", *DEMANDES, *BESOINS, *(BESOINS_PLOMBERIE if include_plomberie else [])]


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


DEMANDES_FORUM_PLOMBERIE = ['"je cherche un plombier"', '"wc bouché" aide', '"fuite d\'eau" aide']


def demand_queries(departements: list[str], communes: list[str], include_plomberie: bool = True) -> list[str]:
    """Requêtes moteur de recherche orientées demandes de particuliers.
    La serrurerie reste majoritaire (6 formulations sur 9 par lieu)."""
    lieux = [DEPARTEMENTS[c] for c in departements if c in DEPARTEMENTS] + communes
    formulations = [*DEMANDES_FORUM, *(DEMANDES_FORUM_PLOMBERIE if include_plomberie else [])]
    return [f"{d} {lieu}" for lieu, d in product(lieux, formulations)]


def next_batch(all_queries: list[str], cursor: int, size: int) -> tuple[list[str], int]:
    """Renvoie `size` requêtes à partir du curseur (rotation) et le nouveau curseur."""
    if not all_queries or size <= 0:
        return [], cursor
    n = len(all_queries)
    start = cursor % n
    batch = [all_queries[(start + i) % n] for i in range(min(size, n))]
    return batch, (start + len(batch)) % n


# ── Rotation géographique (moteurs de recherche) ─────────────────────────────
# Deux anneaux : PRIORITAIRE (départements + communes proches de la base) et
# LARGE (toutes les communes des départements couverts, de la plus proche à la
# plus lointaine). Chaque passage prend la moitié de ses requêtes dans chaque
# anneau ; chaque requête associe UN lieu à UNE formulation (tournante), pour
# couvrir le maximum de communes distinctes avec un budget limité.

FORMULATIONS_LIEU = [*DEMANDES_FORUM, '"besoin d\'un serrurier" urgent', '"perdu mes clés"']


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (la1, lo1), (la2, lo2) = a, b
    h = sin(radians(la2 - la1) / 2) ** 2 + cos(radians(la1)) * cos(radians(la2)) * sin(radians(lo2 - lo1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(h))


def geo_rings(departements: list[str], base_nom: str = "Aubervilliers", rayon_prioritaire_km: float = 8.0) -> tuple[list[str], list[str]]:
    communes = json.loads(COMMUNES_PATH.read_text("utf-8"))
    base = next(((c[3], c[4]) for c in communes if c[0] == base_nom), None)
    dans_zone = [c for c in communes if c[1] in departements]
    if base is None:
        return [DEPARTEMENTS[d] for d in departements if d in DEPARTEMENTS], [c[0] for c in dans_zone]
    tri = sorted(dans_zone, key=lambda c: _km(base, (c[3], c[4])))
    proches = [c[0] for c in tri if _km(base, (c[3], c[4])) <= rayon_prioritaire_km]
    prioritaire = [DEPARTEMENTS[d] for d in departements if d in DEPARTEMENTS] + proches
    large = [c[0] for c in tri]
    return prioritaire, large


def lieu_queries(lieux: list[str], start: int, n: int) -> tuple[list[tuple[str, str]], int]:
    """n couples (requête, lieu) à partir du curseur ; formulation tournante."""
    if not lieux or n <= 0:
        return [], start
    out = []
    for k in range(n):
        i = start + k
        lieu = lieux[i % len(lieux)]
        form = FORMULATIONS_LIEU[i % len(FORMULATIONS_LIEU)]
        out.append((f"{form} {lieu}", lieu))
    return out, (start + n) % (len(lieux) * len(FORMULATIONS_LIEU))
