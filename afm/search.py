#!/usr/bin/env python
# -*- coding: utf-8 -*-

from whoosh.filedb.filestore import FileStorage
from whoosh.qparser import QueryParser

# TODO
# поиск написан на отъебись, лишь бы работал
# вынести апдейт в модель


class SearchIndex(object):
    def __init__(self, index_dir):
        self.storage = FileStorage(index_dir)
        self.ix = self.storage.open_index()

    def search(self, query):
        parser = QueryParser('title', self.ix.schema)
        query = parser.parse(unicode(query))

        with self.ix.searcher() as searcher:
            return [hit.fields() for hit in searcher.search(query)]

    def update(self, doc):
        writer = self.ix.writer()
        writer.update_document(**doc)
        writer.commit()
