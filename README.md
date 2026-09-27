# Kilossk Painter

LLM/VLM이 이미지 생성 모델이 아니라 **Painter tools를 직접 호출해 획을 그리는** 1024×1024 whiteboard 실험 앱입니다.

동일 좌표계에 3개 레이어를 겹칩니다.
1. AI 레이어 — AI/MCP만 수정
2. 사람 레이어 — 사람이 직접 그림
3. 사진 레이어 — 참조 이미지

OpenRouter, Upstage Solar Pro 3/4, Custom OpenAI-compatible API와 MCP companion bridge를 지원합니다.
