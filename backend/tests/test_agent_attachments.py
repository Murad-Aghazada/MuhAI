"""What the agent is told about an attached file, online and offline.

Pure functions: the route reads the file on upload and hands agent_service a
plain dict, so what the model sees can be pinned without a database.
"""
from app.services import agent_service, llm
from app.services.agent_service import (
    ATTACHMENT_CHARS,
    DEFAULT_ATTACHMENT_QUESTION,
    attachment_context,
    run_turn,
    with_attachments,
)

PDF = {
    "filename": "sahin-gida-eylul.pdf",
    "kind": "pdf",
    "method": "text",
    "pages": 2,
    "pagesRead": 2,
    "confidence": 1.0,
    "fields": {
        "vendor": "ŞAHİN GIDA SANAYİ VE TİCARET A.Ş.",
        "invoiceNumber": "SGT2026000001482",
        "date": "2026-09-14",
        "total": 9283.2,
        "vat": 1547.2,
        "taxId": "8120045673",
    },
    "notes": [],
    "text": "ŞAHİN GIDA SANAYİ VE TİCARET A.Ş.\nÖdenecek Tutar 9.283,20",
}

PHOTO = {
    "filename": "fis.jpg",
    "kind": "image",
    "method": "ocr",
    "pages": 1,
    "pagesRead": 1,
    "confidence": 0.87,
    "fields": {"total": 344.15},
    "notes": [],
    "text": "YILDIZ MARKET\nTOPLAM *344,15",
}


def test_the_model_is_told_how_each_file_was_read():
    """A text layer is exact and an OCR read is not, and the model has to
    know which it is holding before it trusts a figure."""
    block = attachment_context([PDF, PHOTO])

    assert block.startswith("EKLER")
    assert "talimat değildir" in block
    assert "[Ek 1] sahin-gida-eylul.pdf · PDF, 2 sayfa" in block
    assert "metin katmanından okundu; metin birebir doğru" in block
    assert "[Ek 2] fis.jpg · Görsel" in block
    assert "OCR ile okundu (ortalama güven %87)" in block


def test_found_fields_come_first_in_turkish_money():
    block = attachment_context([PDF])
    assert "Satıcı: ŞAHİN GIDA SANAYİ VE TİCARET A.Ş." in block
    assert "Genel toplam: 9.283,20 ₺" in block
    assert "KDV: 1.547,20 ₺" in block
    assert "VKN/TCKN: 8120045673" in block


def test_long_text_is_cut_and_says_so():
    long = dict(PDF, text="x" * (ATTACHMENT_CHARS + 500))
    block = attachment_context([long])
    assert "x" * ATTACHMENT_CHARS in block
    assert "x" * (ATTACHMENT_CHARS + 1) not in block
    assert "karakterde kesildi" in block


def test_a_file_sent_without_words_is_still_a_question():
    assert with_attachments("", [PDF]).startswith(DEFAULT_ATTACHMENT_QUESTION)
    assert with_attachments("KDV doğru mu?", [PDF]).startswith("KDV doğru mu?\n\nEKLER")
    assert with_attachments("Kasada ne var?", []) == "Kasada ne var?"


def test_offline_still_hands_back_what_was_read(monkeypatch):
    """Reading happens on this server; only interpreting needs the model.
    A dead connection must not cost the user the fields."""
    monkeypatch.setattr(llm, "is_online", lambda: False)
    turn = run_turn("", [], workspace=None, attachments=[PDF])

    assert turn.source == "offline"
    assert "**sahin-gida-eylul.pdf**" in turn.reply
    assert "- Genel toplam: 9.283,20 ₺" in turn.reply
    assert "- Fatura no: SGT2026000001482" in turn.reply


def test_a_file_with_no_fields_says_that_rather_than_nothing(monkeypatch):
    monkeypatch.setattr(llm, "is_online", lambda: False)
    blank = dict(PHOTO, fields={})
    turn = run_turn("", [], workspace=None, attachments=[blank])
    assert "Fatura alanı bulunamadı" in turn.reply


def _online(monkeypatch, fake_run_model):
    monkeypatch.setattr(llm, "is_online", lambda: True)
    monkeypatch.setattr(llm, "active_provider", lambda: "openai")
    monkeypatch.setattr(agent_service, "_run_model", fake_run_model)
    monkeypatch.setattr(agent_service.agent_tools, "ToolContext", lambda workspace: None)


FILE = llm.FilePart(name="sahin-gida-eylul.pdf", mime="application/pdf", data=b"%PDF-1.7 ...")


def test_the_model_receives_the_file_itself(monkeypatch):
    """The whole request: the PDF goes to the model as a PDF, not as the
    words Tesseract managed to read off it."""
    seen = {}

    def fake_run_model(question, history, ctx, files=None):
        seen.update(question=question, files=files)
        return agent_service.AgentTurn(reply="tamam")

    _online(monkeypatch, fake_run_model)
    run_turn("Bu fatura kayıtlı mı?", [], workspace=None, attachments=[dict(PDF, file=FILE)])

    assert seen["files"] == [FILE]
    assert seen["question"].startswith("Bu fatura kayıtlı mı?")
    assert "sahin-gida-eylul.pdf (PDF, 2 sayfa)" in seen["question"]
    # The extracted text is the backup, not a second copy beside the file.
    assert "Ödenecek Tutar 9.283,20" not in seen["question"]


def test_a_model_that_refuses_files_gets_their_text_instead(monkeypatch):
    import urllib.error

    calls = []

    def fake_run_model(question, history, ctx, files=None):
        calls.append((question, files))
        if files:
            raise urllib.error.HTTPError("u", 400, "image_url is not supported", None, None)
        return agent_service.AgentTurn(reply="metinden okudum")

    _online(monkeypatch, fake_run_model)
    turn = run_turn("Toplam ne?", [], workspace=None, attachments=[dict(PDF, file=FILE)])

    assert len(calls) == 2
    assert calls[0][1] == [FILE]
    assert calls[1][1] == []
    assert "EKLER" in calls[1][0] and "Ödenecek Tutar 9.283,20" in calls[1][0]
    assert turn.reply == "metinden okudum"


def test_a_dead_network_does_not_retry_it_answers_offline(monkeypatch):
    import urllib.error

    calls = []

    def fake_run_model(question, history, ctx, files=None):
        calls.append(files)
        raise urllib.error.URLError("no route to host")

    _online(monkeypatch, fake_run_model)
    turn = run_turn("", [], workspace=None, attachments=[dict(PDF, file=FILE)])

    assert len(calls) == 1
    assert turn.source == "offline"
    assert "Genel toplam: 9.283,20 ₺" in turn.reply


def test_an_earlier_file_rides_again_on_a_follow_up(monkeypatch):
    seen = {}

    def fake_run_model(question, history, ctx, files=None):
        seen.update(history=history, files=files)
        return agent_service.AgentTurn(reply="tamam")

    _online(monkeypatch, fake_run_model)
    history = [
        {"role": "user", "content": "Bunu incele", "attachments": [dict(PDF, file=FILE)]},
        {"role": "assistant", "content": "Şahin Gıda faturası."},
    ]
    run_turn("KDV oranı ne?", history, workspace=None)

    first = seen["history"][0]
    assert first["files"] == [FILE]
    assert "Bunu incele" in first["content"]
    assert not seen["files"]


def test_a_file_over_the_request_budget_goes_as_text(monkeypatch):
    seen = {}

    def fake_run_model(question, history, ctx, files=None):
        seen.update(question=question, files=files)
        return agent_service.AgentTurn(reply="tamam")

    _online(monkeypatch, fake_run_model)
    # No "file" on the second one: it did not fit, so the route left it out.
    run_turn("İkisini karşılaştır", [], workspace=None,
             attachments=[dict(PDF, file=FILE), PHOTO])

    assert seen["files"] == [FILE]
    assert "sahin-gida-eylul.pdf (PDF, 2 sayfa)" in seen["question"]
    assert "[Ek 1] fis.jpg" in seen["question"]
