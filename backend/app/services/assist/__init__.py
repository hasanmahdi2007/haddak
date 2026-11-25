"""The assistant behind POST /assist (see docs/AI_ASSISTANT.md).

The rule: the AI understands, our code acts. The AI only turns a sentence
into search settings; searching, ranking and everything shown to the user is
done by our own code.

Files:
  normalize.py  - one way to clean up a sentence (used for matching and hashing)
  prompt.py     - the fixed instructions sent to the AI, with our category list
  ai_client.py  - the one AI call (OpenAI, Google or Anthropic), and the shape it must return
  cache.py      - remembered answers (assist_cache table)
  budget.py     - cost of a request, monthly and daily spending caps
  quota.py      - the free daily AI allowance, per person and per IP
  places.py     - looks up "Jounieh" / "الحمرا" in the places table
  service.py    - puts it all together for the router
"""
