"""Lab timeline helpers and public schemas.

Deliberately no re-exports here: src.database.repository imports
src.labs.normalization directly, and src.labs.service imports back from
src.database.repository, so eagerly importing `service` in this __init__
(as a prior version did) created a circular import whenever something
imported src.database.repository before anything had imported src.labs.
Import the submodules you need directly, e.g. `from src.labs.service import
create_observations_from_document` or `from src.labs.normalization import
normalize_test_name`.
"""
