def format_citation(article, style='apa'):
    """
    Formats an article's metadata into a citation string based on the specified style.
    Assumes 'article' is a dictionary-like object with keys like 'authors', 'publication_date', 'title', 'journal'.
    """
    authors = article.get('authors', 'Auteur inconnu')
    year = article.get('publication_date', 's.d.') # s.d. for sans date
    title = article.get('title', 'Titre inconnu')
    journal = article.get('journal', 'Journal inconnu')

    # Basic formatting for first author
    first_author = authors.split(',')[0].split(' ')[0] if authors else 'Auteur inconnu'

    if style == 'apa':
        return f"{first_author}, {year}. {title}. *{journal}*."
    elif style == 'vancouver':
        # Vancouver style is typically numerical and more complex, this is a simplification
        return f"{first_author}. {title}. {journal}. {year}."
    else:
        return f"[{first_author} ({year})] {title}"

# Add other reporting related functions here as needed