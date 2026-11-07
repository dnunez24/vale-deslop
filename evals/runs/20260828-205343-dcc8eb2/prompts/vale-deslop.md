A Vale style called Deslop is installed in this directory. It flags the tells of AI-written prose.

Loop until the document is clean:
1. Run: vale --no-global --output=JSON deslop.md
2. Each JSON entry is one tell, with Check, Message, Line, and Span. Fix each one by rewriting the
   flagged text.
3. Re-run step 1.

Stop when the JSON output is {} or after 8 iterations, whichever comes first. Never edit .vale.ini,
never add "vale off" comments, and never delete content to silence a rule.
