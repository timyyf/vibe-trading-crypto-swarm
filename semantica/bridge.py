"""Semantica Bridge — REST service that wraps ContextGraph (stdlib-only).

Exposes read+write endpoints over the Semantica ``ContextGraph`` so the
Node/Netlify backend can record decisions, query precedents, causal chains
and graph stats without importing the heavy Semantica core dependencies
(torch/transformers/spacy — installed with ``--no-deps``).

Persistence:
  - Optional Postgres (``DATABASE_URL``) is the durable source of truth for
    decisions. The Render free tier has an ephemeral filesystem, so without
    Postgres memory is lost on sleep/restart.
  - On startup, decisions are replayed from Postgres back into the graph
    (IDs preserved) so precedents/causal chain keep working across restarts.
  - ``SEMANTICA_KG_PATH`` enables best-effort JSON snapshots of nodes/edges
    (decisions are NOT included in save_to_file).
"""

import json
import logging
import os
import sys
import threading
import types
from typing import Any, Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

# --- stdlib-only import do ContextGraph -----------------------------------
# ``semantica.context.__init__`` importa agent_context -> context_retriever ->
# vector_store -> scipy (e, no pior caso, torch/transformers). Para manter a
# imagem do Render free enxuta, só carregamos ``context_graph`` (que é
# stdlib + utils) registrando um módulo ``semantica.context`` falso que aponta
# para o diretório real — o __init__ pesado nunca roda. Pinado a 0.6.0.
import semantica as _semantica_pkg  # noqa: E402  (import raiz é leve)

if "semantica.context" not in sys.modules:
    _dummy = types.ModuleType("semantica.context")
    _dummy.__path__ = [os.path.join(os.path.dirname(_semantica_pkg.__file__), "context")]
    sys.modules["semantica.context"] = _dummy

from semantica.context.context_graph import ContextGraph  # noqa: E402

log = logging.getLogger("semantica-bridge")

# ---------------------------------------------------------------------------
# Singleton graph (ContextGraph is stdlib-only for decisions/precedents/chain)
# ---------------------------------------------------------------------------

_graph: Optional[ContextGraph] = None
_graph_lock = threading.RLock()

_db = None  # psycopg connection pool / connection (set only if DATABASE_URL)


def get_graph() -> ContextGraph:
    global _graph
    if _graph is None:
        with _graph_lock:
            if _graph is None:
                g = ContextGraph(advanced_analytics=False)
                kg_path = os.environ.get("SEMANTICA_KG_PATH")
                if kg_path and os.path.exists(kg_path):
                    try:
                        g.load_from_file(kg_path)
                        log.info("Loaded graph from %s", kg_path)
                    except Exception as exc:  # pragma: no cover - best effort
                        log.warning("Could not load graph from %s: %s", kg_path, exc)
                _graph = g
    return _graph


def _ensure_decision_storage(g: ContextGraph) -> None:
    if not hasattr(g, "_decisions"):
        g._decisions = {}
        g._decision_index = {}
        g._entity_index = {}
        g._temporal_index = []
    g._decisions = getattr(g, "_decisions", {})
    g._decision_index = getattr(g, "_decision_index", {})
    g._entity_index = getattr(g, "_entity_index", {})
    g._temporal_index = getattr(g, "_temporal_index", [])


def _restore_decision(g: ContextGraph, decision: Dict[str, Any]) -> None:
    """Re-insert a persisted decision dict into the in-memory graph.

    Uses the library's internal storage (pinned to semantica==0.6.0) to
    preserve stable decision IDs across restarts. Falls back to
    ``record_decision`` if internals drift.
    """
    _ensure_decision_storage(g)
    decision_id = str(decision.get("id", ""))
    category = str(decision.get("category", ""))
    entities = [e for e in (decision.get("entities") or []) if e]
    timestamp = float(decision.get("timestamp") or 0.0)

    if decision_id and decision_id not in g._decisions:
        try:
            # Best-effort graph nodes/edges for the decision
            g._add_decision_to_graph(decision)
        except Exception as exc:  # pragma: no cover
            log.warning("Could not add decision %s to graph: %s", decision_id, exc)

        g._decisions[decision_id] = decision
        g._decision_index.setdefault(category, set()).add(decision_id)
        for entity in entities:
            g._entity_index.setdefault(entity, set()).add(decision_id)
        if timestamp:
            g._temporal_index.append((decision_id, timestamp))
            g._temporal_index.sort(key=lambda x: x[1], reverse=True)


# ---------------------------------------------------------------------------
# Postgres persistence (durable decisions across Render free sleep/restart)
# ---------------------------------------------------------------------------

def _pg():
    global _db
    url = os.environ.get("DATABASE_URL")
    if not url:
        return None
    if _db is None:
        try:
            import psycopg  # type: ignore

            _db = psycopg.connect(url, autocommit=True)
            with _db.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS semantica_decisions (
                        decision_id TEXT PRIMARY KEY,
                        data JSONB NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                    """
                )
        except Exception as exc:
            log.warning("Postgres unavailable, falling back to in-memory: %s", exc)
            _db = False
    return _db if _db is not False else None


def _replay_from_postgres() -> int:
    conn = _pg()
    if conn is None:
        return 0
    g = get_graph()
    restored = 0
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT data FROM semantica_decisions ORDER BY created_at")
            for (data,) in cur.fetchall():
                _restore_decision(g, data)
                restored += 1
    except Exception as exc:
        log.warning("Failed to replay decisions from Postgres: %s", exc)
        return 0
    if restored:
        log.info("Replayed %d decisions from Postgres", restored)
    return restored


def _persist_decision(decision: Dict[str, Any]) -> None:
    conn = _pg()
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO semantica_decisions (decision_id, data)
                VALUES (%s, %s)
                ON CONFLICT (decision_id) DO UPDATE SET data = EXCLUDED.data
                """,
                (decision.get("id"), json.dumps(decision, default=str)),
            )
    except Exception as exc:
        log.warning("Failed to persist decision to Postgres: %s", exc)


def _persist_snapshot() -> None:
    kg_path = os.environ.get("SEMANTICA_KG_PATH")
    if kg_path:
        try:
            get_graph().save_to_file(kg_path)
        except Exception as exc:
            log.warning("Failed to save KG snapshot: %s", exc)


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class DecisionCreate(BaseModel):
    category: str = Field(..., min_length=1, max_length=100)
    scenario: str = Field(..., min_length=1, max_length=5000)
    reasoning: str = Field(..., min_length=1, max_length=10000)
    outcome: str = Field(..., min_length=1, max_length=1000)
    confidence: float = Field(..., ge=0.0, le=1.0)
    entities: Optional[List[str]] = None
    decision_maker: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class EntityCreate(BaseModel):
    id: str = Field(..., min_length=1)
    label: Optional[str] = None
    node_type: str = "entity"
    metadata: Optional[Dict[str, Any]] = None


class RelationshipCreate(BaseModel):
    source_id: str = Field(..., min_length=1)
    target_id: str = Field(..., min_length=1)
    rel_type: str = "related_to"
    metadata: Optional[Dict[str, Any]] = None


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logging.basicConfig(level=os.environ.get("SEMANTICA_LOG_LEVEL", "INFO"))
    get_graph()  # warm up
    _replay_from_postgres()
    yield


app = FastAPI(title="Semantica Bridge", version="0.1.0", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Health & stats
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    g = get_graph()
    _ensure_decision_storage(g)
    return {
        "status": "healthy",
        "node_count": len(getattr(g, "nodes", {})),
        "decision_count": len(g._decisions),
    }


@app.get("/stats")
def stats():
    g = get_graph()
    _ensure_decision_storage(g)
    categories: Dict[str, int] = {}
    for cat, ids in g._decision_index.items():
        categories[str(cat)] = len(ids)
    outcomes: Dict[str, int] = {}
    for d in g._decisions.values():
        outcome = str(d.get("outcome", "DESCONHECIDO"))
        outcomes[outcome] = outcomes.get(outcome, 0) + 1
    return {
        "node_count": len(getattr(g, "nodes", {})),
        "edge_count": len(getattr(g, "edges", [])),
        "decision_count": len(g._decisions),
        "categories": categories,
        "outcomes": outcomes,
    }


# ---------------------------------------------------------------------------
# Writes
# ---------------------------------------------------------------------------

@app.post("/decision", status_code=201)
def create_decision(body: DecisionCreate):
    try:
        decision_id = get_graph().record_decision(
            category=body.category,
            scenario=body.scenario,
            reasoning=body.reasoning,
            outcome=body.outcome,
            confidence=body.confidence,
            entities=body.entities,
            decision_maker=body.decision_maker,
            metadata=body.metadata,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    g = get_graph()
    _ensure_decision_storage(g)
    decision = g._decisions.get(decision_id)
    _persist_decision(decision if decision is not None else {"id": decision_id})
    _persist_snapshot()
    return {"decision_id": decision_id}


@app.post("/entity", status_code=201)
def create_entity(body: EntityCreate):
    try:
        get_graph().add_node(
            node_id=body.id,
            node_type=body.node_type,
            content=body.label or body.id,
            **(body.metadata or {}),
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    _persist_snapshot()
    return {"status": "added", "id": body.id}


@app.post("/relationship", status_code=201)
def create_relationship(body: RelationshipCreate):
    g = get_graph()
    if body.source_id not in getattr(g, "nodes", {}):
        raise HTTPException(status_code=404, detail=f"Source node '{body.source_id}' not found")
    if body.target_id not in getattr(g, "nodes", {}):
        raise HTTPException(status_code=404, detail=f"Target node '{body.target_id}' not found")
    try:
        g.add_edge(
            source_id=body.source_id,
            target_id=body.target_id,
            edge_type=body.rel_type,
            **(body.metadata or {}),
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    _persist_snapshot()
    return {"status": "added"}


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

def _decision_to_api(decision: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "decision_id": decision.get("id"),
        "category": decision.get("category"),
        "scenario": decision.get("scenario"),
        "reasoning": decision.get("reasoning"),
        "outcome": decision.get("outcome"),
        "confidence": decision.get("confidence"),
        "entities": decision.get("entities") or [],
        "decision_maker": decision.get("decision_maker"),
        "timestamp": decision.get("timestamp"),
        "recorded_at": decision.get("recorded_at"),
        "metadata": decision.get("metadata") or {},
    }


@app.get("/decisions")
def list_decisions(
    category: Optional[str] = Query(None),
    symbol: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    g = get_graph()
    _ensure_decision_storage(g)
    decisions = list(g._decisions.values())

    if category:
        decisions = [d for d in decisions if str(d.get("category", "")).lower() == category.lower()]
    if symbol:
        needle = symbol.upper()
        decisions = [
            d
            for d in decisions
            if needle
            in {
                str(e).upper()
                for e in (d.get("entities") or [])
            }
            | {
                str(d.get("metadata", {}).get("symbol", "")).upper(),
                str(d.get("metadata", {}).get("assetSymbol", "")).upper(),
            }
        ]

    decisions.sort(key=lambda d: float(d.get("timestamp") or 0.0), reverse=True)
    return [_decision_to_api(d) for d in decisions[:limit]]


@app.get("/decisions/{decision_id}")
def get_decision(decision_id: str):
    g = get_graph()
    _ensure_decision_storage(g)
    decision = g._decisions.get(decision_id)
    if decision is None:
        raise HTTPException(status_code=404, detail=f"Decision '{decision_id}' not found")
    return _decision_to_api(decision)


@app.get("/decisions/{decision_id}/precedents")
def decision_precedents(decision_id: str, limit: int = Query(10, ge=1, le=100)):
    g = get_graph()
    _ensure_decision_storage(g)
    decision = g._decisions.get(decision_id)
    if decision is None:
        raise HTTPException(status_code=404, detail=f"Decision '{decision_id}' not found")
    try:
        results = g.find_precedents_by_scenario(
            scenario=str(decision.get("scenario", "")),
            category=decision.get("category"),
            limit=limit,
            similarity_threshold=0.1,
            use_semantic_search=False,
        )
    except Exception as exc:
        log.warning("find_precedents failed: %s", exc)
        results = []
    precedents = []
    for item in results:
        if isinstance(item, dict):
            decision = item.get("decision") if isinstance(item.get("decision"), dict) else item
            did = decision.get("id") or item.get("id") or item.get("decision_id")
            if did == decision_id:
                continue
            precedents.append(
                {
                    **_decision_to_api(decision),
                    "similarity": item.get("similarity", item.get("score")),
                }
            )
    return precedents[:limit]


@app.get("/decisions/{decision_id}/chain")
def decision_chain(decision_id: str, direction: str = Query("upstream"), max_depth: int = Query(10, ge=1, le=50)):
    g = get_graph()
    _ensure_decision_storage(g)
    if decision_id not in g._decisions:
        raise HTTPException(status_code=404, detail=f"Decision '{decision_id}' not found")
    try:
        chain = g.get_causal_chain(decision_id, direction=direction, max_depth=max_depth)
    except Exception as exc:
        log.warning("get_causal_chain failed: %s", exc)
        chain = []
    return {
        "decision_id": decision_id,
        "direction": direction,
        "chain": [_decision_to_api(c) if isinstance(c, dict) else {"id": str(c)} for c in chain],
    }


@app.get("/precedents")
def precedents(
    scenario: str = Query(..., min_length=1),
    category: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=100),
):
    g = get_graph()
    _ensure_decision_storage(g)
    if not getattr(g, "_decisions", None):
        return []
    try:
        results = g.find_precedents_by_scenario(
            scenario=scenario,
            category=category,
            limit=limit,
            similarity_threshold=0.1,
            use_semantic_search=False,
        )
    except Exception as exc:
        log.warning("precedents search failed: %s", exc)
        results = []
    return [
        {
            **( _decision_to_api(item["decision"]) if isinstance(item.get("decision"), dict) else _decision_to_api(item) ),
            "similarity": item.get("similarity", item.get("score")),
        }
        for item in results
    ]


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
