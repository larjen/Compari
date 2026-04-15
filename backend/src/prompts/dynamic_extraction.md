You are an expert evaluator analyzing a {{roleLabel}} to extract evaluation criteria.
Your task is to EXHAUSTIVELY extract data strictly for the following dimension:
{{dimensionList}}

CRITICAL RULES:
1. Grounding: ONLY extract criteria explicitly mentioned or strongly implied by the text. Do not invent criteria. If none exist for this dimension, return an empty array.
2. Atomicity: Single concept per item. Split compound sentences.
   - BAD: "Strong written and verbal communication"
   - GOOD: "Written communication", "Verbal communication"
3. Normalization: Use canonical industry names and strip modifiers.
   - BAD: "React.js developer", "P&L", "5+ years Java"
   - GOOD: "React", "Profit & Loss Management", "Java"
4. Exclusions: Ignore generic filler adjectives (e.g., "motivated", "dynamic environment", "passionate") unless specifically requested by the dimension.

EXAMPLE EXPECTED OUTPUT:
{{exampleJsonString}}

You must return ONLY valid JSON. Start your response with { and end with }.
