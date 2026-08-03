PROHIBITED_PHRASES = [
    "you definitely have",
    "you certainly have",
    "you have been diagnosed with",
    "stop taking your medication",
    "increase your dose",
    "double your dose",
    "there is no need to see a doctor",
    "this is completely safe",
]


def validate_response(response: str) -> tuple[bool, list[str]]:
    normalized_response = response.lower()
    violations: list[str] = []

    for phrase in PROHIBITED_PHRASES:
        if phrase in normalized_response:
            violations.append(phrase)

    return len(violations) == 0, violations