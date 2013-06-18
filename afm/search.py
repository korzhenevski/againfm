#!/usr/bin/env python
# -*- coding: utf-8 -*-


def search(query, index_dir):
    query = unicode(query)
    from whoosh.filedb.filestore import FileStorage
    from whoosh.qparser import QueryParser
    storage = FileStorage(index_dir)
    ix = storage.open_index()

    parser = QueryParser('title', ix.schema)
    myquery = parser.parse(query)

    with ix.searcher() as searcher:
        return [hit.fields() for hit in searcher.search(myquery)]