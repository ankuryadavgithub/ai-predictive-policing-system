from app.identity_verification import ImageQualityResult, build_verification_decision, mask_aadhaar


def test_mask_aadhaar_masks_first_eight_digits():
    assert mask_aadhaar("123412341234") == "XXXXXXXX1234"


def test_verification_decision_approves_when_all_checks_pass(monkeypatch):
    monkeypatch.setattr(
        "app.identity_verification.assess_image_quality",
        lambda path, kind: ImageQualityResult(
            status="clear",
            reason="passed",
            brightness=120.0,
            sharpness=140.0,
            width=1280,
            height=720,
        ),
    )
    monkeypatch.setattr(
        "app.identity_verification.extract_aadhaar_number",
        lambda path: ("123412341234", "success"),
    )
    monkeypatch.setattr(
        "app.identity_verification.compute_face_match_score",
        lambda aadhaar, selfie: (0.62, "matched"),
    )
    monkeypatch.setattr(
        "app.identity_verification.evaluate_liveness",
        lambda frames, selfie: ("approved", "passed"),
    )

    decision = build_verification_decision("aadhaar.jpg", "selfie.jpg", "frames")

    assert decision.status == "approved"
    assert decision.aadhaar_masked == "XXXXXXXX1234"
    assert decision.rejection_reason is None


def test_verification_decision_sends_ocr_failure_to_manual_review(monkeypatch):
    monkeypatch.setattr(
        "app.identity_verification.assess_image_quality",
        lambda path, kind: ImageQualityResult(
            status="clear",
            reason="passed",
            brightness=120.0,
            sharpness=140.0,
            width=1280,
            height=720,
        ),
    )
    monkeypatch.setattr(
        "app.identity_verification.extract_aadhaar_number",
        lambda path: (None, "failed"),
    )

    decision = build_verification_decision("aadhaar.jpg", "selfie.jpg", None)

    assert decision.status == "pending_manual_review"
    assert decision.aadhaar_masked is None
    assert decision.face_match_status == "pending"


def test_verification_decision_handles_ocr_runtime_failure_with_manual_review(monkeypatch):
    monkeypatch.setattr(
        "app.identity_verification.assess_image_quality",
        lambda path, kind: ImageQualityResult(
            status="clear",
            reason="passed",
            brightness=120.0,
            sharpness=140.0,
            width=1280,
            height=720,
        ),
    )

    def raise_runtime_error(path):
        raise RuntimeError("OCR model initialization failed")

    monkeypatch.setattr(
        "app.identity_verification.extract_aadhaar_number",
        raise_runtime_error,
    )

    decision = build_verification_decision("aadhaar.jpg", "selfie.jpg", None)

    assert decision.status == "pending_manual_review"
    assert decision.aadhaar_masked is None
    assert decision.ocr_status == "unavailable"


def test_verification_decision_rejects_clear_face_mismatch(monkeypatch):
    monkeypatch.setattr(
        "app.identity_verification.assess_image_quality",
        lambda path, kind: ImageQualityResult(
            status="clear",
            reason="passed",
            brightness=120.0,
            sharpness=140.0,
            width=1280,
            height=720,
        ),
    )
    monkeypatch.setattr(
        "app.identity_verification.extract_aadhaar_number",
        lambda path: ("123412341234", "success"),
    )
    monkeypatch.setattr(
        "app.identity_verification.compute_face_match_score",
        lambda aadhaar, selfie: (0.05, "mismatch"),
    )
    monkeypatch.setattr(
        "app.identity_verification.evaluate_liveness",
        lambda frames, selfie: ("approved", "passed"),
    )

    decision = build_verification_decision("aadhaar.jpg", "selfie.jpg", "frames")

    assert decision.status == "rejected"
    assert decision.rejection_reason == "Live selfie does not match the Aadhaar card photo"


def test_verification_decision_sends_low_quality_aadhaar_to_manual_review(monkeypatch):
    def fake_quality(path, kind):
        if kind == "aadhaar":
            return ImageQualityResult(
                status="low_quality",
                reason="aadhaar_blurred",
                brightness=120.0,
                sharpness=20.0,
                width=1280,
                height=720,
            )
        return ImageQualityResult(
            status="clear",
            reason="passed",
            brightness=120.0,
            sharpness=140.0,
            width=1280,
            height=720,
        )

    monkeypatch.setattr("app.identity_verification.assess_image_quality", fake_quality)

    decision = build_verification_decision("aadhaar.jpg", "selfie.jpg", "frames")

    assert decision.status == "pending_manual_review"
    assert decision.ocr_status == "aadhaar_blurred"
    assert decision.rejection_reason == "Aadhaar image is not clear enough for automatic verification"


def test_verification_decision_sends_low_quality_selfie_to_manual_review(monkeypatch):
    def fake_quality(path, kind):
        if kind == "selfie":
            return ImageQualityResult(
                status="low_quality",
                reason="selfie_too_dark",
                brightness=20.0,
                sharpness=140.0,
                width=1280,
                height=720,
            )
        return ImageQualityResult(
            status="clear",
            reason="passed",
            brightness=120.0,
            sharpness=140.0,
            width=1280,
            height=720,
        )

    monkeypatch.setattr("app.identity_verification.assess_image_quality", fake_quality)

    decision = build_verification_decision("aadhaar.jpg", "selfie.jpg", "frames")

    assert decision.status == "pending_manual_review"
    assert decision.liveness_status == "selfie_too_dark"
    assert decision.rejection_reason == "Live selfie is not clear enough for automatic verification"
