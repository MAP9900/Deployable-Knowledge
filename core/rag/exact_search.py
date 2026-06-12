import argparse
import re
from pathlib import Path
from core.rag.chunking import parse_pdf

"""
Script for exact quoted-term search across PDFs in the documents folder.

Examples:
python -m core.rag.exact_search --query '"word"'
"""

def getCorpus():
    print("Getting corpus...")
    #searches for PDFs in the documents folder
    #Pulled from new_bm25.py
    corpusGet = []
    
    BASE_DIR = Path.cwd()
    for i in Path(BASE_DIR / "documents").glob("*.pdf"):
        corpusGet.append(parse_pdf(i))

    corpusText = []
    
    for pageDict in corpusGet:
        for j in pageDict:
            corpusText.append(j["text"])
    
    print(corpusText)
    return corpusText

def extract_quoted_terms(query_text):
    print("Extracting quoted terms! \n ------------------------")
    return re.findall(r'"([^"]+)"', query_text)

def lower_text(text):
    return text.lower()

def search_exact(quoted_terms, corpus_text):
    print("Searching exact matches! \n ------------------------")
    matches = []
    normalized_terms = [lower_text(term) for term in quoted_terms]
    for index, text in enumerate(corpus_text):
        lowered_text = lower_text(text)
        matched_terms = [term for term in normalized_terms if term in lowered_text]
        if matched_terms:
            matches.append(
                {
                    "index": index,
                    "text": text,
                    "matched_terms": matched_terms,})
    return matches

def final_results(matches):
    print("Final results:")
    if not matches:
        print("No exact matches found! \n ------------------------")
        return

    for i, match in enumerate(matches, start=1):
        print(f"Match {i}: \n ------------------------")
        print(f'Corpus index: {match["index"]} \n ------------------------')
        print(f'Matched terms: {match["matched_terms"]} \n ------------------------')
        print("\n ------------------------ \n", match["text"], "\n ------------------------\n")

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--query",
        required=True,
        help='Quoted search terms, ex: \'"F-16" "part 12345"\'',)
    return parser.parse_args()

def main():
    args = parse_args()
    corpus = getCorpus()
    quoted_terms = extract_quoted_terms(args.query)
    if not quoted_terms:
        print('No quoted terms found. Use --query with terms like \'"word"\'.')
        return
    if not corpus:
        print("No PDF pages available to search! \n ------------------------")
        return
    matches = search_exact(quoted_terms, corpus)
    final_results(matches)
    print("------------------------ \n Done! \n ------------------------")

if __name__ == "__main__":
    main()
