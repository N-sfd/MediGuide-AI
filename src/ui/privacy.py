"""Privacy center HTML and drawer helpers."""

PRIVACY_STATUS_HTML = """
<div class="mg-privacy-center">
  <h3>Privacy status</h3>
  <ul class="mg-privacy-checklist">
    <li>✓ Local language model</li>
    <li>✓ Local voice transcription</li>
    <li>✓ Local document analysis</li>
    <li>✓ Approved-source retrieval</li>
    <li>✓ Chat storage disabled</li>
    <li>✓ Audio storage disabled</li>
  </ul>
  <div class="mg-privacy-demo">
    <strong>Public demo mode</strong>
    <p>Do not enter identifying medical information.</p>
  </div>
</div>
"""

PRIVACY_PAGE_LEAD = (
    "MediGuide is designed for private, on-device processing. "
    "Use the shield in the header anytime to review privacy status."
)
