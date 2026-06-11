## Matthew Todo
- Flow Chart (Online & Whiteboard)
- Research NER and potential implementation points
- Research Best BM25 Search Method to utilize 

### To Research:
- BM25
- NER
- Exact Search



## BM25 Notes
- Ranking algorithm to estimate (through probabilities) how close a query is to a source document. 
- Rewards documents which contain:
    - Query Words 
    - Rare query terms (Via Inverse Document Frequency)
    - Query terms which appear multiple times (Via term frequency $f(q_i, D)$)
    - Texts which are not excessively long. Document length done by $|D|$ and then normalized to acount for longer documents natrually containing more words. $avgdl$ can then be calculated to determine if a document is longer or shorter than the $avg$. 
    - Included $k_1$ Parameter to weight importance of additional word occurences. The higher the $k_1$, the more weight for repeated occurances. 
    - $b$ Parameter controls for length normalization. $b = 0$: ignore document length. $b = 1$: fully normalize by document length.


## Metadata Issue!!!
- Core Problem: Pagenumber carried through code twice and stored twice in ChromaDB


'pages[i]
metadata[i]["page"]'





