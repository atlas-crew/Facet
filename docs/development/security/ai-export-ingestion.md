# AI Export Ingestion Security Notes

Facet treats pasted AI conversation exports as untrusted user input.

Controls:

- Client preview scans each AI export paste for word count, estimated tokens, detected career sections, and common prompt-injection phrases before the paste can be added as supplemental context.
- The extraction prompt serializes AI exports with per-source `FACET_AI_EXPORT` delimiters and tells the model to treat delimited text as data, not instructions.
- `callLlmProxy` sends estimated per-paste token counts to the proxy. The proxy rejects any paste above `MAX_PASTED_CONTENT_TOKENS`, default `20000`.
- Identity extraction rejects model output containing known leakage artifacts such as the extraction system prompt, test harness text, or Facet AI export delimiters.

These checks are defense in depth. They reduce accidental or deliberate prompt-injection success, but they do not make pasted AI text privileged or trusted.
