"""The platform org resolver: the single answer to "which org is the platform"."""

from datetime import datetime

import pytest
from fastapi import HTTPException

from src.db.organizations import Organization
from src.services.orgs.platform import (
    find_platform_org,
    get_platform_org,
    get_platform_org_id,
    require_platform_org,
)


def _org(id: int, slug: str, is_demo: bool = False) -> Organization:
    return Organization(
        id=id,
        name=slug,
        slug=slug,
        email=f"{slug}@org.test",
        org_uuid=f"org_{slug}",
        is_demo=is_demo,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )


async def test_no_org_means_not_installed(db):
    assert await find_platform_org(db) is None
    with pytest.raises(HTTPException) as exc:
        await get_platform_org(db)
    assert exc.value.status_code == 503


async def test_lowest_id_non_demo_org_when_no_seeded_slug(db, monkeypatch):
    monkeypatch.delenv("STARLAB_INITIAL_ORG_SLUG", raising=False)
    db.add(_org(1, "demo", is_demo=True))
    db.add(_org(2, "school"))
    db.add(_org(3, "later"))
    await db.commit()

    org = await get_platform_org(db)
    assert org.slug == "school"
    assert await get_platform_org_id(db) == 2


async def test_seeded_slug_wins_over_lower_ids(db, monkeypatch):
    monkeypatch.delenv("STARLAB_INITIAL_ORG_SLUG", raising=False)
    db.add(_org(1, "legacy"))
    db.add(_org(5, "default"))
    await db.commit()

    assert (await get_platform_org(db)).slug == "default"


async def test_configured_initial_slug_is_honored(db, monkeypatch):
    monkeypatch.setenv("STARLAB_INITIAL_ORG_SLUG", "Acme")
    db.add(_org(1, "legacy"))
    db.add(_org(4, "acme"))
    await db.commit()

    assert (await get_platform_org(db)).slug == "acme"


async def test_a_demo_org_is_never_the_platform_even_with_the_seeded_slug(db, monkeypatch):
    monkeypatch.delenv("STARLAB_INITIAL_ORG_SLUG", raising=False)
    db.add(_org(1, "default", is_demo=True))
    db.add(_org(2, "school"))
    await db.commit()

    assert (await get_platform_org(db)).slug == "school"


async def test_only_demo_orgs_means_not_installed(db):
    db.add(_org(1, "demo", is_demo=True))
    await db.commit()

    with pytest.raises(HTTPException) as exc:
        await get_platform_org(db)
    assert exc.value.status_code == 503


async def test_require_platform_org_rejects_any_other_id_as_not_found(db, org, other_org):
    assert (await require_platform_org(org.id, db)).id == org.id
    with pytest.raises(HTTPException) as exc:
        await require_platform_org(other_org.id, db)
    assert exc.value.status_code == 404
    with pytest.raises(HTTPException) as exc:
        await require_platform_org(999, db)
    assert exc.value.status_code == 404
