from fastapi import APIRouter, Depends

from app.deps import DB, CurrentUser, get_current_user
from app.schemas.misc import SaveVocabRequest, SaveVocabResponse
from app.services.vocab_service import save_words

router = APIRouter(prefix="/vocab", tags=["vocab"], dependencies=[Depends(get_current_user)])


@router.post("/save", response_model=SaveVocabResponse)
async def save(body: SaveVocabRequest, db: DB, user: CurrentUser) -> SaveVocabResponse:
    saved, total = await save_words(db, user, body.session_id, body.words)
    return SaveVocabResponse(saved=saved, total=total)
