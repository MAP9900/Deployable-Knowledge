import argparse
import re

from config import UPLOAD_DIR
from core.rag.chunking import parse_pdf

"""
Script for exact quoted-term search across PDFs in the documents folder.

Examples:
python -m core.rag.exact_search --query '"word"'
python -m core.rag.exact_search --query '"alpha" "beta"'
"""


def get_corpus():
    print(f"Getting corpus from {UPLOAD_DIR}...")
    if not UPLOAD_DIR.exists():
        print("Documents folder does not exist yet.")
        return []

    corpus = []
    for pdf_path in sorted(UPLOAD_DIR.glob("*.pdf")):
        for page in parse_pdf(pdf_path):
            corpus.append(page["text"])

    print(f"Loaded {len(corpus)} page(s) from PDF files.")
    return corpus


def extract_quoted_terms(query_text):
    print("Extracting quoted terms...")
    return re.findall(r'"([^"]+)"', query_text)


def lower_text(text):
    return text.lower()


def search_exact(quoted_terms, corpus_text):
    print("Searching exact matches...")
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
                    "matched_terms": matched_terms,
                }
            )
    return matches


def final_results(matches):
    print("Final results:")
    if not matches:
        print("No exact matches found.")
        return

    for i, match in enumerate(matches, start=1):
        print(f"Match {i}:")
        print(f'Corpus index: {match["index"]}')
        print(f'Matched terms: {match["matched_terms"]}')
        print(match["text"])


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--query",
        required=True,
        help='Quoted search terms, for example: \'"budget" "forecast"\'',
    )
    return parser.parse_args()


def main():
    args = parse_args()
    corpus = get_corpus()
    quoted_terms = extract_quoted_terms(args.query)
    if not quoted_terms:
        print('No quoted terms found. Use --query with terms like \'"word"\'.')
        return
    if not corpus:
        print("No PDF pages available to search.")
        return
    matches = search_exact(quoted_terms, corpus)
    final_results(matches)
    print("Done")

if __name__ == "__main__":
    main()
